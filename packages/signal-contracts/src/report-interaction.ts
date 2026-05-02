// Report-interaction telemetry contract for the hosted Tier Report.
// Separate from `SignalEventV1` because (a) the report route emits a
// different event shape than the Signal beacon captures on client
// pages, (b) the ingest endpoint for these is dedicated
// (`/ingest/report-interaction`), and (c) bundling them into
// `SignalEventV1` would force every Signal consumer to branch on event
// kinds they do not care about.
//
// The share token (`st`) is the per-URL identifier the report builder
// generates when a report is prepared for a specific recipient. The
// warehouse join from this event back to the recipient is done
// out-of-band (the operator's own tracking sheet ↔ `st` pairs).

export const SIGNAL_REPORT_INTERACTION_VERSION = 1 as const;

export type SignalReportInteractionKind =
  | 'report_opened'
  | 'report_slide_advanced'
  // Intent-capture kinds — emitted from the /r closing section's
  // three-card router + 5-pill freeform demand-signal row. Each click
  // is a fire-and-forget signal of latent demand for one of the four
  // wedges. Free at the click; pricing decisions get made on the next
  // surface, never inline.
  | 'intent_pi_early_access'
  | 'intent_rapid_fix'
  | 'intent_monitoring'
  | 'intent_freeform';

export type SignalReportInteractionIntentKind = Extract<SignalReportInteractionKind, `intent_${string}`>;

/** Two-stage capture pattern. Initial click logs an anonymous demand
 * signal; the optional follow-up (email + cadence) lands as a `followup`
 * carrying the same `intent_capture_id`. Server upserts so one CTA click
 * == one demand-signal row, not one event-per-interaction. */
export type SignalReportInteractionIntentStage = 'initial' | 'followup';

export type SignalReportInteractionIntentCadence = 'weekly' | 'monthly';

export type SignalReportInteractionIntentPillId =
  | 'weekly_inbox'
  | 'multi_page'
  | 'multi_client_portfolio'
  | 'competitor_context'
  | 'something_else';

export type SignalReportInteractionRoute = 'r';

export type SignalReportInteractionUaTier = 'mobile' | 'tablet' | 'desktop';

export interface SignalReportInteractionV1 {
  v: typeof SIGNAL_REPORT_INTERACTION_VERSION;
  event_kind: SignalReportInteractionKind;
  // Per-event UUID — so retries / dedupe at the ingest layer can
  // collapse duplicates from a flaky network without losing signal.
  event_id: string;
  ts: number;
  // Share token from the URL param `st`. Required — a report
  // interaction without a share token cannot be correlated to a
  // specific send, which defeats the validation-signal purpose.
  st: string;
  route: SignalReportInteractionRoute;
  // Version param from the URL (`rv`). Optional because some events
  // may originate before the version is parsed; the per-kind required
  // map below asserts it for kinds that need it.
  rv?: number;
  // Populated when event_kind === 'report_slide_advanced' — identifies
  // which section of the report entered the viewport.
  section_id?: string;
  // Cumulative ms spent before this event fired on the prior section.
  // Optional because the first event in a session has no prior dwell.
  dwell_ms?: number;
  ua_browser?: string;
  ua_tier?: SignalReportInteractionUaTier;
  // ─── Intent-capture payload (only set on intent_* kinds) ─────────────
  /** Stable client-side UUID generated at the moment of the first click
   * for a given CTA. Sent on the initial event AND on any follow-up
   * event for the same intent (e.g. email-submit follow-up after a PI
   * early-access click). The snapshot-engine repository UPSERTs by this
   * id so the row count == demand-signal count, not click count. */
  intent_capture_id?: string;
  /** Marks whether this event is the initial CTA click or a follow-up
   * carrying additional payload (email, cadence, freeform_text). */
  intent_stage?: SignalReportInteractionIntentStage;
  intent_email?: string;
  /** Monitoring-card only. */
  intent_cadence?: SignalReportInteractionIntentCadence;
  /** Freeform pill row only. Identifies which of the 5 pills was
   * clicked. `something_else` is paired with `intent_freeform_text`. */
  intent_pill_id?: SignalReportInteractionIntentPillId;
  /** Capped 200 chars server-side. Emitted only when
   * `intent_pill_id === 'something_else'`. */
  intent_freeform_text?: string;
}

export const SIGNAL_REPORT_INTERACTION_VALID_KINDS: ReadonlySet<SignalReportInteractionKind> = new Set([
  'report_opened',
  'report_slide_advanced',
  'intent_pi_early_access',
  'intent_rapid_fix',
  'intent_monitoring',
  'intent_freeform'
]);

export const SIGNAL_REPORT_INTERACTION_VALID_INTENT_STAGES: ReadonlySet<SignalReportInteractionIntentStage> = new Set([
  'initial',
  'followup'
]);

export const SIGNAL_REPORT_INTERACTION_VALID_INTENT_CADENCES: ReadonlySet<SignalReportInteractionIntentCadence> =
  new Set(['weekly', 'monthly']);

export const SIGNAL_REPORT_INTERACTION_VALID_INTENT_PILL_IDS: ReadonlySet<SignalReportInteractionIntentPillId> =
  new Set(['weekly_inbox', 'multi_page', 'multi_client_portfolio', 'competitor_context', 'something_else']);

export const SIGNAL_REPORT_INTERACTION_VALID_ROUTES: ReadonlySet<SignalReportInteractionRoute> = new Set(['r']);

export const SIGNAL_REPORT_INTERACTION_VALID_UA_TIERS: ReadonlySet<SignalReportInteractionUaTier> = new Set([
  'mobile',
  'tablet',
  'desktop'
]);

// Per-kind required fields. Every event kind declares which fields
// beyond the base must be present so the downstream metrics view can
// aggregate without defensive-null checks at query time.
//
// Base fields required on every event: v, event_kind, event_id, ts,
// st, route. Everything below is event-kind-specific in addition to
// the base.
const KIND_REQUIRED_FIELDS: Record<SignalReportInteractionKind, readonly string[]> = {
  report_opened: ['rv'],
  report_slide_advanced: ['rv', 'section_id'],
  intent_pi_early_access: ['intent_capture_id', 'intent_stage'],
  intent_rapid_fix: ['intent_capture_id', 'intent_stage'],
  intent_monitoring: ['intent_capture_id', 'intent_stage'],
  intent_freeform: ['intent_capture_id', 'intent_stage', 'intent_pill_id']
};

/** Intent kinds where a `followup` event MUST carry at least one of
 * email / cadence / freeform_text — otherwise the followup carries no
 * new information and is a wire-format error. */
const INTENT_FOLLOWUP_PAYLOAD_FIELDS: readonly (keyof Pick<
  SignalReportInteractionV1,
  'intent_email' | 'intent_cadence' | 'intent_freeform_text'
>)[] = ['intent_email', 'intent_cadence', 'intent_freeform_text'];

const MAX_INTENT_FREEFORM_TEXT_LENGTH = 200;
const MAX_INTENT_EMAIL_LENGTH = 254;

// Lightweight guard — the ingest endpoint and the client emitters
// share a single source of truth for validity. Returns an array of
// human-readable issue strings (empty = valid).
export function explainReportInteractionIssues(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) {
    return ['Expected a JSON object matching SignalReportInteractionV1.'];
  }
  const v = value as Record<string, unknown>;
  const issues: string[] = [];

  if (v.v !== SIGNAL_REPORT_INTERACTION_VERSION) {
    issues.push(`Expected "v" to be ${SIGNAL_REPORT_INTERACTION_VERSION}.`);
  }

  const kindValid =
    typeof v.event_kind === 'string' &&
    SIGNAL_REPORT_INTERACTION_VALID_KINDS.has(v.event_kind as SignalReportInteractionKind);
  if (!kindValid) {
    issues.push('Expected "event_kind" to be a known report interaction kind.');
  }
  if (typeof v.event_id !== 'string' || v.event_id.length === 0) {
    issues.push('Expected "event_id" to be a non-empty string.');
  }
  if (typeof v.ts !== 'number' || !Number.isFinite(v.ts)) {
    issues.push('Expected "ts" to be a finite number.');
  }
  // Share token: intent_* kinds may carry an empty string (the /r URL
  // may not have an `st` param when loaded directly without a share
  // link). The legacy report_opened / report_slide_advanced kinds keep
  // the non-empty requirement.
  if (typeof v.st !== 'string') {
    issues.push('Expected "st" (share token) to be a string.');
  } else if (v.st.length === 0 && typeof v.event_kind === 'string' && !v.event_kind.startsWith('intent_')) {
    issues.push('Expected "st" (share token) to be a non-empty string.');
  }
  if (
    typeof v.route !== 'string' ||
    !SIGNAL_REPORT_INTERACTION_VALID_ROUTES.has(v.route as SignalReportInteractionRoute)
  ) {
    issues.push('Expected "route" to be "r".');
  }

  if (kindValid) {
    const kind = v.event_kind as SignalReportInteractionKind;
    const required = KIND_REQUIRED_FIELDS[kind];
    for (const field of required) {
      const present = v[field] != null;
      if (!present) {
        issues.push(`Expected "${field}" to be present for event_kind "${kind}".`);
      }
    }
  }

  // Route/version consistency: rv must equal 1 when set.
  if (v.route === 'r' && v.rv != null && v.rv !== 1) {
    issues.push('Expected "rv" to be 1 when route === "r".');
  }

  // Optional-field validity when present.
  if (v.ua_tier != null && !SIGNAL_REPORT_INTERACTION_VALID_UA_TIERS.has(v.ua_tier as SignalReportInteractionUaTier)) {
    issues.push('Expected "ua_tier" to be "mobile" | "tablet" | "desktop" when present.');
  }
  if (v.dwell_ms != null && (typeof v.dwell_ms !== 'number' || v.dwell_ms < 0)) {
    issues.push('Expected "dwell_ms" to be a non-negative number when present.');
  }

  // Intent-payload validity (when present + when required by kind).
  if (v.intent_capture_id != null) {
    if (typeof v.intent_capture_id !== 'string' || v.intent_capture_id.length === 0) {
      issues.push('Expected "intent_capture_id" to be a non-empty string when present.');
    }
  }
  if (
    v.intent_stage != null &&
    !SIGNAL_REPORT_INTERACTION_VALID_INTENT_STAGES.has(v.intent_stage as SignalReportInteractionIntentStage)
  ) {
    issues.push('Expected "intent_stage" to be "initial" | "followup" when present.');
  }
  if (v.intent_email != null) {
    if (typeof v.intent_email !== 'string') {
      issues.push('Expected "intent_email" to be a string when present.');
    } else if (v.intent_email.length === 0 || v.intent_email.length > MAX_INTENT_EMAIL_LENGTH) {
      issues.push(`Expected "intent_email" length to be 1–${MAX_INTENT_EMAIL_LENGTH} when present.`);
    } else if (!v.intent_email.includes('@')) {
      issues.push('Expected "intent_email" to contain "@" when present (RFC-5322 lite).');
    }
  }
  if (
    v.intent_cadence != null &&
    !SIGNAL_REPORT_INTERACTION_VALID_INTENT_CADENCES.has(v.intent_cadence as SignalReportInteractionIntentCadence)
  ) {
    issues.push('Expected "intent_cadence" to be "weekly" | "monthly" when present.');
  }
  if (
    v.intent_pill_id != null &&
    !SIGNAL_REPORT_INTERACTION_VALID_INTENT_PILL_IDS.has(v.intent_pill_id as SignalReportInteractionIntentPillId)
  ) {
    issues.push(
      'Expected "intent_pill_id" to be one of: weekly_inbox, multi_page, multi_client_portfolio, competitor_context, something_else when present.'
    );
  }
  if (v.intent_freeform_text != null) {
    if (typeof v.intent_freeform_text !== 'string') {
      issues.push('Expected "intent_freeform_text" to be a string when present.');
    } else if (v.intent_freeform_text.length > MAX_INTENT_FREEFORM_TEXT_LENGTH) {
      issues.push(`Expected "intent_freeform_text" length to be ≤ ${MAX_INTENT_FREEFORM_TEXT_LENGTH} when present.`);
    }
  }
  if (
    kindValid &&
    typeof v.event_kind === 'string' &&
    v.event_kind.startsWith('intent_') &&
    v.intent_stage === 'followup'
  ) {
    const hasPayload = INTENT_FOLLOWUP_PAYLOAD_FIELDS.some((field) => v[field] != null);
    if (!hasPayload) {
      issues.push(
        'Expected "followup" intent event to carry at least one of intent_email / intent_cadence / intent_freeform_text.'
      );
    }
  }

  return issues;
}

export function isSignalReportInteractionV1(value: unknown): value is SignalReportInteractionV1 {
  return explainReportInteractionIssues(value).length === 0;
}

/**
 * Default ingest endpoint path (legacy). Held for backwards compatibility
 * with any consumer constructing a same-origin URL; the canonical default
 * for the new intent-capture emitter is the full URL constant below.
 *
 * @deprecated Prefer `SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT` for
 *  cross-origin sendBeacon delivery. Will be removed in a future major.
 */
export const SIGNAL_REPORT_INTERACTION_INGEST_PATH = '/ingest/report-interaction';

/**
 * Canonical ingest URL for the report-interaction telemetry endpoint.
 * Hosted by the stroma-snapshot-engine workspace at
 * `https://api.stroma.design/api/v1/intent`.
 *
 * The new intent-capture client emitter (in apps/signal-report) defaults
 * to this URL. Consumers can override via init config when self-hosting
 * the ingest endpoint.
 */
export const SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT = 'https://api.stroma.design/api/v1/intent';
