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

function flipCardToConfirmation(card: HTMLElement, message?: string): void {
  card.dataset['state'] = 'logged';
  if (message != null) {
    const text = card.querySelector<HTMLElement>('[data-closing-confirmation-text]');
    if (text) text.textContent = message;
  }
  // Clear the hidden attribute so AT picks up the role="status" announcement.
  // CSS reveals via display:flex !important regardless, but `hidden` would
  // suppress the live-region read.
  const slot = card.querySelector<HTMLElement>('.closing-card-confirmation');
  if (slot) slot.hidden = false;
}

function attachCardClickHandlers(ctx: ResolvedReportContext): void {
  for (const card of document.querySelectorAll<HTMLElement>('[data-closing-card]')) {
    const state = readCardState(card);
    if (!state) continue;
    card.dataset['captureId'] = state.captureId;

    if (state.ctaHref) {
      attachLinkCtaHandler(card, state, ctx);
    } else {
      attachFormSubmitHandler(card, state, ctx);
    }
  }
}

/** Rapid-Fix-style card: a single text-link CTA that POSTs the intent
 *  via sendBeacon (queued at the network layer before navigation) then
 *  lets the browser follow the link. */
function attachLinkCtaHandler(card: HTMLElement, state: CardState, ctx: ResolvedReportContext): void {
  const cta = card.querySelector<HTMLAnchorElement>('a[data-closing-cta]');
  if (!cta) return;

  cta.addEventListener('click', () => {
    if (card.dataset['state'] === 'logged') return;
    sendIntent(basePayload(ctx, state.intentKind, state.captureId));
    flipCardToConfirmation(card, '✓ noted — opening the booking page');
    // No preventDefault — let the <a> redirect.
  });
}

/** PI / Monitoring card: form with email field (and optional cadence)
 *  visible from the start. Submit POSTs ONE event with all data and
 *  transforms the card to the quiet confirmation state. The click IS
 *  the email submit — no two-stage anonymous-then-followup dance, so
 *  the in-between dishonest copy ("we will let you know" before any
 *  email exists) can't appear. */
function attachFormSubmitHandler(card: HTMLElement, state: CardState, ctx: ResolvedReportContext): void {
  const form = card.querySelector<HTMLFormElement>('[data-closing-form]');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (card.dataset['state'] === 'logged') return;

    const emailInput = state.collectsEmail ? card.querySelector<HTMLInputElement>('[data-closing-email]') : null;
    const cadenceInput = state.collectsCadence
      ? card.querySelector<HTMLInputElement>('[data-closing-cadence] input[type="radio"]:checked')
      : null;

    // For email-collecting cards, browser-native `required` + `type=email`
    // catches empty / malformed input. Belt-and-braces here too.
    if (state.collectsEmail) {
      const value = emailInput?.value.trim() ?? '';
      if (value.length === 0 || !value.includes('@')) {
        emailInput?.focus();
        return;
      }
    }

    const intent_email = emailInput?.value.trim() || undefined;
    const intent_cadence = (cadenceInput?.value as SignalReportInteractionIntentCadence | undefined) ?? undefined;

    const payload: SignalReportInteractionV1 = {
      ...basePayload(ctx, state.intentKind, state.captureId)
    };
    if (intent_email) payload.intent_email = intent_email;
    if (intent_cadence) payload.intent_cadence = intent_cadence;

    sendIntent(payload);
    flipCardToConfirmation(card, '✓ noted — we will be in touch');
  });
}

function attachMultiselectHandler(ctx: ResolvedReportContext): void {
  const form = document.querySelector<HTMLFormElement>('[data-closing-multiselect]');
  if (!form) return;

  const summaryLabel = form.querySelector<HTMLElement>('[data-closing-multiselect-label]');
  const freeformWrap = form.querySelector<HTMLElement>('[data-closing-multiselect-freeform]');
  const freeformText = form.querySelector<HTMLTextAreaElement>('[data-closing-multiselect-freeform-text]');
  const checkboxes = form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="closing-pill"]');

  // Update the summary label as checkboxes flip + reveal the freeform
  // textarea when "something else" is among the checked.
  function refreshSummary(): void {
    const checked = Array.from(checkboxes).filter((cb) => cb.checked);
    if (summaryLabel) {
      summaryLabel.textContent =
        checked.length === 0
          ? 'Choose any that apply'
          : checked.length === 1
            ? '1 selected'
            : `${checked.length} selected`;
    }
    const wantsFreeform = checked.some((cb) => cb.dataset['collectsFreeformText'] === 'true');
    if (freeformWrap) freeformWrap.hidden = !wantsFreeform;
  }
  for (const cb of checkboxes) cb.addEventListener('change', refreshSummary);
  refreshSummary();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.dataset['state'] === 'logged') return;

    const checked = Array.from(checkboxes).filter((cb) => cb.checked);
    if (checked.length === 0) return;

    // Fire one intent event per checked option. Each gets its own
    // capture_id so the snapshot-engine row count == demand-signal
    // count. The "something_else" event carries the freeform text.
    const freeformValue = freeformText?.value.trim() ?? '';
    for (const cb of checked) {
      const pillId = cb.value as SignalReportInteractionIntentPillId;
      const payload: SignalReportInteractionV1 = {
        ...basePayload(ctx, 'intent_freeform', generateCaptureId()),
        intent_pill_id: pillId
      };
      if (pillId === 'something_else' && freeformValue) {
        payload.intent_freeform_text = freeformValue.slice(0, 200);
      }
      sendIntent(payload);
    }

    form.dataset['state'] = 'logged';
    const slot = form.querySelector<HTMLElement>('.closing-multiselect-confirmation');
    if (slot) slot.hidden = false;
  });
}

export function bootIntentTelemetry(): void {
  if (typeof document === 'undefined') return;
  const ctx = resolveReportContext();
  attachCardClickHandlers(ctx);
  attachMultiselectHandler(ctx);
}
