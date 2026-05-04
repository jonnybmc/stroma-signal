// Client-side intent telemetry for the closing-section modal.
//
// Discipline (load-bearing, see plan file):
// - Single discreet trigger button opens a native <dialog>; modal form
//   asks one question first ("What would help?"), reveals only the
//   conditional fields the chosen path needs, and submits via one button.
// - Delivery via navigator.sendBeacon() — Content-Type: text/plain;charset=utf-8
//   so cross-origin POST to the snapshot engine does NOT trigger a CORS
//   preflight. Survives page navigation. Fire-and-forget.
// - Wire format unchanged: same `intent_*` event kinds, same UPSERT-by-
//   intent_capture_id semantics on the snapshot-engine Turso table.
//   PI / Rapid Fix / Monitoring → 1 event each. Something else → N
//   events (one per checked sub-pill, distinct capture_ids per pill so
//   row count == demand-signal count).
// - Every event from this surface is `intent_stage: 'initial'`. The
//   prior two-stage anonymous-then-followup flow is gone — the click
//   that opens the modal carries no telemetry; submission carries
//   everything in one shot.
// - Confirmation copy stays in observation register (✓ noted, not
//   Thanks! / Welcome!).
// - Failure is silent. The signal in the snapshot-engine table is the
//   source of truth; the client confirmation is only a UX cue.

import {
  isSignalReportInteractionV1,
  SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT,
  SIGNAL_REPORT_INTERACTION_VERSION,
  type SignalReportInteractionIntentCadence,
  type SignalReportInteractionIntentKind,
  type SignalReportInteractionIntentPillId,
  type SignalReportInteractionV1
} from '@stroma-labs/signal-contracts';

const RAPID_FIX_REDIRECT = 'https://www.stroma.design/book?service=rapid-fix';

export type ClosingModalChoice = 'pi_early_access' | 'rapid_fix' | 'monitoring' | 'something_else';

export interface ResolvedReportContext {
  domain: string | null;
  share_token: string | null;
  rv: 1 | undefined;
}

/** Resolve the report context once per boot. The `/r` URL carries the
 *  domain (`d=`), optional share token (`st=`), and rv version. */
export function resolveReportContext(): ResolvedReportContext {
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

export function generateCaptureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes — RFC4122-ish v4-shaped string.
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  rand[6] = ((rand[6] ?? 0) & 0x0f) | 0x40;
  rand[8] = ((rand[8] ?? 0) & 0x3f) | 0x80;
  const hex = rand.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildEventId(): string {
  return `evt_${generateCaptureId().replace(/-/g, '').slice(0, 24)}`;
}

export function basePayload(
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

export function sendIntent(payload: SignalReportInteractionV1): boolean {
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

/** Typed snapshot of the modal form's current state. Extracted by
 *  `readFormState` from a real `HTMLFormElement` at submit time;
 *  unit tests build it directly so they don't need a DOM. */
export interface ClosingModalFormState {
  choice: ClosingModalChoice | null;
  email?: string;
  cadence?: SignalReportInteractionIntentCadence;
  freeformText?: string;
  pills: SignalReportInteractionIntentPillId[];
}

function readFormState(form: HTMLFormElement): ClosingModalFormState {
  const formData = new FormData(form);
  const choice = formData.get('choice');
  const email = (formData.get('email') as string | null)?.trim();
  const cadence = formData.get('cadence');
  const freeformText = (formData.get('freeform_text') as string | null)?.trim();
  const pills = formData.getAll('pill') as SignalReportInteractionIntentPillId[];
  return {
    choice: typeof choice === 'string' ? (choice as ClosingModalChoice) : null,
    email: email && email.length > 0 ? email : undefined,
    cadence: typeof cadence === 'string' ? (cadence as SignalReportInteractionIntentCadence) : undefined,
    freeformText: freeformText && freeformText.length > 0 ? freeformText : undefined,
    pills
  };
}

/**
 * Pure function: given a form-state snapshot, produce the intent events
 * that would be sent on submit. Exported for unit tests.
 *
 * Returns an empty array when the form is in an invalid state (e.g.
 * "something_else" picked but no sub-pill checked, or no choice picked).
 * Caller blocks the submit when this returns `[]`.
 *
 * Mapping (matches the existing wire contract — see plan file):
 *   - `pi_early_access` → 1 × `intent_pi_early_access` (with `intent_email` if non-empty)
 *   - `rapid_fix` → 1 × `intent_rapid_fix` (no email/cadence regardless of form state)
 *   - `monitoring` → 1 × `intent_monitoring` (with `intent_cadence` defaulting to weekly,
 *     plus `intent_email` if non-empty)
 *   - `something_else` + N pills → N × `intent_freeform`, distinct capture_ids,
 *     each with `intent_pill_id`. The `something_else` pill carries
 *     `intent_freeform_text` when the textarea is non-empty.
 */
export function buildEventsFromForm(
  state: ClosingModalFormState,
  ctx: ResolvedReportContext
): SignalReportInteractionV1[] {
  if (!state.choice) return [];

  if (state.choice === 'pi_early_access') {
    const payload = basePayload(ctx, 'intent_pi_early_access', generateCaptureId());
    if (state.email) payload.intent_email = state.email;
    return [payload];
  }

  if (state.choice === 'rapid_fix') {
    return [basePayload(ctx, 'intent_rapid_fix', generateCaptureId())];
  }

  if (state.choice === 'monitoring') {
    const payload = basePayload(ctx, 'intent_monitoring', generateCaptureId());
    if (state.email) payload.intent_email = state.email;
    payload.intent_cadence = state.cadence ?? 'weekly';
    return [payload];
  }

  // something_else → one event per checked sub-pill, each with own capture_id
  if (state.pills.length === 0) return [];
  return state.pills.map((pillId) => {
    const payload = basePayload(ctx, 'intent_freeform', generateCaptureId());
    payload.intent_pill_id = pillId;
    if (pillId === 'something_else' && state.freeformText) {
      payload.intent_freeform_text = state.freeformText.slice(0, 200);
    }
    return payload;
  });
}

interface ModalElements {
  trigger: HTMLButtonElement;
  dialog: HTMLDialogElement;
  form: HTMLFormElement;
  dismiss: HTMLButtonElement | null;
  confirmation: HTMLElement | null;
  submit: HTMLButtonElement | null;
}

function findModalElements(): ModalElements | null {
  const trigger = document.querySelector<HTMLButtonElement>('[data-closing-modal-open]');
  const dialog = document.querySelector<HTMLDialogElement>('dialog#closing-modal');
  const form = document.querySelector<HTMLFormElement>('[data-closing-modal-form]');
  if (!trigger || !dialog || !form) return null;
  return {
    trigger,
    dialog,
    form,
    dismiss: form.querySelector<HTMLButtonElement>('[data-closing-modal-dismiss]'),
    confirmation: form.querySelector<HTMLElement>('[data-closing-modal-confirmation]'),
    submit: form.querySelector<HTMLButtonElement>('[data-closing-modal-submit]')
  };
}

/** Per-browser persistence of "this share-token already received an
 *  intent submission from this browser" so revisits (the same operator
 *  re-opening the report later) don't see the trigger. Sharing a
 *  report URL still works as expected: a new browser/device has fresh
 *  storage and sees the modal independently — every distinct viewer's
 *  signal is captured. */
const INTENT_SUBMITTED_KEY_PREFIX = 'stroma:intent:';

function intentSubmittedKey(shareToken: string | null): string | null {
  if (!shareToken || shareToken.length === 0) return null;
  return `${INTENT_SUBMITTED_KEY_PREFIX}${shareToken}`;
}

function hasAlreadySubmitted(shareToken: string | null): boolean {
  const key = intentSubmittedKey(shareToken);
  if (!key) return false;
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    // Safari private mode / disabled storage — fail-open (modal shows).
    return false;
  }
}

function markAsSubmitted(shareToken: string | null): void {
  const key = intentSubmittedKey(shareToken);
  if (!key) return;
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage quota / disabled — silent no-op. Worst case: modal shows
    // again on next visit, user submits twice. Acceptable.
  }
}

function attachModalHandler(ctx: ResolvedReportContext): void {
  const els = findModalElements();
  if (!els) return;
  const { trigger, dialog, form, dismiss, confirmation, submit } = els;

  // Per-browser memory: if this share-token already saw a submit from
  // this browser, hide the trigger entirely. Sharing a report still
  // works — different browsers / devices have fresh storage and see
  // the modal independently. Keeps the report clean as a static
  // artifact for revisits.
  if (hasAlreadySubmitted(ctx.share_token)) {
    trigger.hidden = true;
    dialog.hidden = true;
    return;
  }

  // Open via trigger (or via the keyboard-driven `Enter` on the trigger).
  trigger.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  });

  // Dismiss button (the × in the modal header).
  dismiss?.addEventListener('click', () => dialog.close());

  // Backdrop click closes — the dialog itself receives the click when
  // the user clicks outside the form (since the form is a child of the
  // dialog and stops propagation by being smaller than the dialog box).
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Radio change drives CSS reveal via [data-choice] attribute.
  form.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name === 'choice') {
      dialog.dataset.choice = target.value;
    }
    if (target.name === 'pill' && target.value === 'something_else') {
      dialog.dataset.pillSomethingElse = target.checked ? 'true' : '';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.dataset.state === 'logged') return;

    // Email is OPTIONAL on every path — submitting without it counts
    // the demand signal in aggregate (which is what the modal exists
    // for); the email is the affordance for "follow up directly".
    const events = buildEventsFromForm(readFormState(form), ctx);
    if (events.length === 0) {
      // No valid choice (browser-native `required` on the first radio
      // catches this) or "something else" with no pill checked. Focus
      // the first choice radio so the user lands on the gap.
      form.querySelector<HTMLInputElement>('input[name="choice"]')?.focus();
      return;
    }

    // Validate every event against the wire contract before sending so
    // a future bug in buildEventsFromForm shows up here, not at the
    // ingest endpoint.
    if (!events.every((evt) => isSignalReportInteractionV1(evt))) return;

    for (const evt of events) sendIntent(evt);

    form.dataset.state = 'logged';
    if (submit) submit.disabled = true;
    if (confirmation) confirmation.hidden = false;
    markAsSubmitted(ctx.share_token);

    // Rapid Fix path — navigate to the booking page after sendIntent
    // returns. sendBeacon is spec-bound to hold the request open across
    // navigation, so the event flushes cleanly.
    const choice = events[0]?.event_kind;
    if (choice === 'intent_rapid_fix') {
      window.location.assign(RAPID_FIX_REDIRECT);
    }
  });
}

export function bootIntentTelemetry(): void {
  if (typeof document === 'undefined') return;
  const ctx = resolveReportContext();
  attachModalHandler(ctx);
}
