// Client-side intent telemetry for the closing-section router.
//
// Discipline (load-bearing, see plan file):
// - Delivery via navigator.sendBeacon() — Content-Type: text/plain;charset=utf-8
//   so cross-origin POST to the snapshot engine does NOT trigger a CORS
//   preflight. Survives page navigation. Fire-and-forget. Critical for the
//   Rapid Fix click which redirects after queueing.
// - intent_capture_id generated client-side at the moment of the first
//   click; reused on the optional follow-up (email + cadence). Snapshot
//   engine UPSERTs by capture id so one CTA click == one demand-signal row.
// - Confirmation copy stays in observation register (✓ noted, not Thanks!).
// - Failure is silent. The signal in the snapshot-engine table is the
//   source of truth; the client confirmation is only a UX cue.

import {
  SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT,
  SIGNAL_REPORT_INTERACTION_VERSION,
  type SignalReportInteractionIntentCadence,
  type SignalReportInteractionIntentKind,
  type SignalReportInteractionIntentPillId,
  type SignalReportInteractionV1
} from '@stroma-labs/signal-contracts';

interface ResolvedReportContext {
  domain: string | null;
  share_token: string | null;
  rv: 1 | undefined;
}

/** Resolve the report context once per boot. The `/r` URL carries the
 *  domain (`d=`), optional share token (`st=`), and rv version. */
function resolveReportContext(): ResolvedReportContext {
  if (typeof location === 'undefined') {
    return { domain: null, share_token: null, rv: undefined };
  }
  const params = new URLSearchParams(location.search);
  const rvParam = params.get('rv');
  return {
    domain: params.get('d'),
    share_token: params.get('st'),
    rv: rvParam === '1' ? 1 : undefined
  };
}

function generateCaptureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes — RFC4122-ish v4-shaped string.
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  rand[6] = (rand[6]! & 0x0f) | 0x40;
  rand[8] = (rand[8]! & 0x3f) | 0x80;
  const hex = rand.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildEventId(): string {
  return `evt_${generateCaptureId().replace(/-/g, '').slice(0, 24)}`;
}

function sendIntent(payload: SignalReportInteractionV1): boolean {
  const body = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=utf-8' });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const queued = navigator.sendBeacon(SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT, body);
      if (queued) return true;
    } catch {
      // Fall through to the fetch fallback.
    }
  }

  // Fetch fallback — keepalive + safelisted content-type so the network
  // doesn't preflight and the request survives navigation. Same delivery
  // semantics as sendBeacon for our payload sizes.
  if (typeof fetch !== 'undefined') {
    void fetch(SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      keepalive: true,
      mode: 'cors'
    }).catch(() => {});
    return true;
  }
  return false;
}

interface CardState {
  intentKind: SignalReportInteractionIntentKind;
  captureId: string;
  ctaHref: string | null;
  collectsEmail: boolean;
  collectsCadence: boolean;
}

function readCardState(card: HTMLElement): CardState | null {
  const intentKind = card.dataset['intentKind'] as SignalReportInteractionIntentKind | undefined;
  if (!intentKind) return null;
  return {
    intentKind,
    captureId: card.dataset['captureId'] ?? generateCaptureId(),
    ctaHref: card.dataset['ctaHref'] && card.dataset['ctaHref'].length > 0 ? card.dataset['ctaHref'] : null,
    collectsEmail: card.dataset['collectsEmail'] === 'true',
    collectsCadence: card.dataset['collectsCadence'] === 'true'
  };
}

function basePayload(
  ctx: ResolvedReportContext,
  intentKind: SignalReportInteractionIntentKind,
  captureId: string
): SignalReportInteractionV1 {
  return {
    v: SIGNAL_REPORT_INTERACTION_VERSION,
    event_kind: intentKind,
    event_id: buildEventId(),
    ts: Date.now(),
    st: ctx.share_token ?? '',
    route: 'r',
    rv: ctx.rv,
    intent_capture_id: captureId,
    intent_stage: 'initial'
  };
}

function flipCardToConfirmation(card: HTMLElement, message: string): void {
  card.dataset['state'] = 'logged';
  const text = card.querySelector<HTMLElement>('[data-closing-confirmation-text]');
  if (text) text.textContent = message;
}

/** Pick the initial confirmation message for a given card. Honesty
 * discipline: state ONLY what was actually captured at this moment —
 * never reference future communication or imply something is pending.
 * - cta_href card (Rapid Fix): "opening the booking page" because that's
 *   exactly what happens next
 * - email-collecting card BEFORE follow-up submit: anonymous interest
 *   was logged. No contact captured. The followup form below speaks for
 *   itself; the outer message must not imply we have anything to act on.
 * - cta_href === null + collects nothing: bare acknowledgment */
function pickInitialConfirmation(state: CardState): string {
  if (state.ctaHref) {
    return '✓ noted — opening the booking page';
  }
  return '✓ interest noted';
}

function attachCardClickHandlers(ctx: ResolvedReportContext): void {
  for (const card of document.querySelectorAll<HTMLElement>('[data-closing-card]')) {
    const state = readCardState(card);
    if (!state) continue;

    // Persist the capture id on the element so a follow-up email submit
    // re-uses the same id (server UPSERTs on it).
    card.dataset['captureId'] = state.captureId;

    const cta = card.querySelector<HTMLElement>('[data-closing-cta]');
    if (!cta) continue;

    cta.addEventListener('click', (e) => {
      if (card.dataset['state'] === 'logged' && !state.ctaHref) return;

      const payload = basePayload(ctx, state.intentKind, state.captureId);
      sendIntent(payload);

      if (state.ctaHref) {
        // External redirect — let the link's default navigation happen.
        // sendBeacon has already queued the payload; navigation is safe.
        flipCardToConfirmation(card, pickInitialConfirmation(state));
        // Do NOT preventDefault — the <a> handles the redirect.
        return;
      }

      // In-place capture — no redirect. Prevent default in case the CTA
      // is a <button> inside a <form> or similar.
      e.preventDefault();
      flipCardToConfirmation(card, pickInitialConfirmation(state));

      // Wire the follow-up Send button (only present when the card
      // collects email or cadence).
      if (state.collectsEmail || state.collectsCadence) {
        attachFollowupSend(card, ctx, state);
      }
    });
  }
}

function attachFollowupSend(card: HTMLElement, ctx: ResolvedReportContext, state: CardState): void {
  const sendBtn = card.querySelector<HTMLButtonElement>('[data-closing-followup-send]');
  if (!sendBtn) return;
  if (sendBtn.dataset['wired'] === 'true') return;
  sendBtn.dataset['wired'] = 'true';

  sendBtn.addEventListener('click', () => {
    const emailInput = state.collectsEmail ? card.querySelector<HTMLInputElement>('[data-closing-email]') : null;
    const cadenceInput = state.collectsCadence
      ? card.querySelector<HTMLInputElement>('[data-closing-cadence] input[type="radio"]:checked')
      : null;

    const intent_email = emailInput?.value.trim() || undefined;
    const intent_cadence = (cadenceInput?.value as SignalReportInteractionIntentCadence | undefined) ?? undefined;

    if (!intent_email && !intent_cadence) {
      // Empty followup — nothing to add. Skip the POST.
      return;
    }

    const followup: SignalReportInteractionV1 = {
      ...basePayload(ctx, state.intentKind, state.captureId),
      event_id: buildEventId(),
      ts: Date.now(),
      intent_stage: 'followup'
    };
    if (intent_email) followup.intent_email = intent_email;
    if (intent_cadence) followup.intent_cadence = intent_cadence;

    sendIntent(followup);

    // Update the OUTER confirmation text to reflect ONLY what was
    // captured — promise email follow-up only when an email was given;
    // otherwise stay in observation register. Remove the followup form
    // so the card lands in a single quiet state.
    const outerText = card.querySelector<HTMLElement>('[data-closing-confirmation-text]');
    if (outerText) {
      outerText.textContent = intent_email
        ? '✓ email saved — we will let you know when it ships'
        : '✓ preference noted';
    }
    const followupBlock = card.querySelector<HTMLElement>('[data-closing-followup]');
    if (followupBlock) followupBlock.remove();
  });
}

function attachPillClickHandlers(ctx: ResolvedReportContext): void {
  for (const pill of document.querySelectorAll<HTMLButtonElement>('[data-closing-pill]')) {
    const pillId = pill.dataset['closingPill'] as SignalReportInteractionIntentPillId | undefined;
    if (!pillId) continue;
    const collectsFreeform = pill.dataset['collectsFreeformText'] === 'true';
    const captureId = generateCaptureId();
    pill.dataset['captureId'] = captureId;

    pill.addEventListener('click', () => {
      if (pill.dataset['state'] === 'logged') return;

      // For pills that DON'T collect freeform text, log immediately and
      // flip to ✓ noted in place.
      if (!collectsFreeform) {
        sendIntent({
          ...basePayload(ctx, 'intent_freeform', captureId),
          intent_pill_id: pillId
        });
        pill.dataset['state'] = 'logged';
        return;
      }

      // For "something_else", expand the pill into an inline textarea +
      // Send link. Don't log the intent until the user submits — a bare
      // click on "something else" without text is noise.
      if (pill.dataset['state'] === 'expanded') return;
      pill.dataset['state'] = 'expanded';
      const wrap = document.createElement('div');
      wrap.className = 'closing-pill-freeform';
      wrap.innerHTML = `
        <textarea maxlength="200" placeholder="What would actually help? (200 chars max)"></textarea>
        <button type="button" class="closing-pill-freeform-send">send</button>
      `;
      pill.insertAdjacentElement('afterend', wrap);
      const textarea = wrap.querySelector<HTMLTextAreaElement>('textarea');
      const sendLink = wrap.querySelector<HTMLButtonElement>('button');
      sendLink?.addEventListener('click', () => {
        const text = textarea?.value.trim() ?? '';
        if (!text) return;
        sendIntent({
          ...basePayload(ctx, 'intent_freeform', captureId),
          intent_stage: 'followup',
          intent_pill_id: 'something_else',
          intent_freeform_text: text.slice(0, 200)
        });
        wrap.innerHTML = '<p class="closing-card-confirmation-text">✓ noted — thank you</p>';
        pill.dataset['state'] = 'logged';
      });
    });
  }
}

export function bootIntentTelemetry(): void {
  if (typeof document === 'undefined') return;
  const ctx = resolveReportContext();
  attachCardClickHandlers(ctx);
  attachPillClickHandlers(ctx);
}
