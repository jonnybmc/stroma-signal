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

export type SignalReportInteractionKind = 'report_opened' | 'report_slide_advanced';

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
}

export const SIGNAL_REPORT_INTERACTION_VALID_KINDS: ReadonlySet<SignalReportInteractionKind> = new Set([
  'report_opened',
  'report_slide_advanced'
]);

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
  report_slide_advanced: ['rv', 'section_id']
};

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
  if (typeof v.st !== 'string' || v.st.length === 0) {
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

  return issues;
}

export function isSignalReportInteractionV1(value: unknown): value is SignalReportInteractionV1 {
  return explainReportInteractionIssues(value).length === 0;
}

// Default ingest endpoint. Separate from Signal's `/collect`. Clients
// override via env or inline configuration tag if hosting their own
// ingest template.
export const SIGNAL_REPORT_INTERACTION_INGEST_PATH = '/ingest/report-interaction';
