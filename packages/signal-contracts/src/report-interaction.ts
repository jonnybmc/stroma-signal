// Report-interaction telemetry contract. Separate from SignalEventV1
// because (a) the /r and /pi report routes emit a different event
// shape than the Signal beacon captures on client pages, (b) the
// ingest endpoint for these is dedicated (/ingest/report-interaction)
// per the architecture plan, and (c) bundling them into SignalEventV1
// would force every Signal consumer to branch on event_kind they
// don't care about.
//
// The share token (`st`) is the per-URL identifier the builder
// generates when a report is prepared for a specific prospect. The
// warehouse join from this event back to the prospect is done
// out-of-band (the user's own tracking sheet ↔ st pairs).

export const SIGNAL_REPORT_INTERACTION_VERSION = 1 as const;

export type SignalReportInteractionKind =
  | 'pi_opened'
  | 'pi_closed'
  | 'pi_section_viewed'
  | 'pi_offer_clicked'
  | 'report_opened'
  | 'report_slide_advanced';

export type SignalReportInteractionRoute = 'pi' | 'r';

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
  // Version param from the URL. `piv` when route === 'pi', `rv`
  // when route === 'r'. Optional because some events may originate
  // before the version is parsed; guards assert the right one based
  // on route.
  piv?: number;
  rv?: number;
  // Populated when event_kind === 'pi_section_viewed' — identifies
  // which section of the /pi artifact entered the viewport.
  section_id?: string;
  // Populated when event_kind === 'pi_offer_clicked' —
  // Act-4-style offer-card index + href for the click.
  offer_index?: number;
  offer_href?: string;
  // Cumulative ms spent before this event fired on the prior
  // section/slide. Optional because the first event in a session
  // has no prior dwell to measure.
  dwell_ms?: number;
  ua_browser?: string;
  ua_tier?: SignalReportInteractionUaTier;
}

export const SIGNAL_REPORT_INTERACTION_VALID_KINDS: ReadonlySet<SignalReportInteractionKind> = new Set([
  'pi_opened',
  'pi_closed',
  'pi_section_viewed',
  'pi_offer_clicked',
  'report_opened',
  'report_slide_advanced'
]);

export const SIGNAL_REPORT_INTERACTION_VALID_ROUTES: ReadonlySet<SignalReportInteractionRoute> = new Set(['pi', 'r']);

export const SIGNAL_REPORT_INTERACTION_VALID_UA_TIERS: ReadonlySet<SignalReportInteractionUaTier> = new Set([
  'mobile',
  'tablet',
  'desktop'
]);

// Per-kind required fields. The kill criterion (5 responses / first yes
// / 90 days) is only meaningful if the validation telemetry is
// structurally useful — this means every event kind carries the fields
// a downstream materialised view needs to aggregate against.
//
// Base fields required on every event: v, event_kind, event_id, ts,
// st, route. Everything below is event-kind-specific in addition to
// the base.
const KIND_REQUIRED_FIELDS: Record<SignalReportInteractionKind, readonly string[]> = {
  pi_opened: ['piv'],
  pi_closed: ['piv', 'dwell_ms'],
  pi_offer_clicked: ['piv', 'offer_index', 'offer_href'],
  pi_section_viewed: ['piv', 'section_id'],
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
    issues.push('Expected "route" to be "pi" or "r".');
  }

  // Per-kind required fields (v6.1 tightening). Each event kind
  // declares which fields beyond the base must be present, so the
  // downstream metrics view can aggregate without defensive-null
  // checks at query time.
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

  // Route-version consistency: when route === 'pi', piv must equal 1
  // when set; when 'r', rv must equal 1 when set. Existence is
  // enforced by KIND_REQUIRED_FIELDS above.
  if (v.route === 'pi' && v.piv != null && v.piv !== 1) {
    issues.push('Expected "piv" to be 1 when route === "pi".');
  }
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
  if (v.offer_index != null && (typeof v.offer_index !== 'number' || v.offer_index < 0)) {
    issues.push('Expected "offer_index" to be a non-negative number when present.');
  }

  return issues;
}

export function isSignalReportInteractionV1(value: unknown): value is SignalReportInteractionV1 {
  return explainReportInteractionIssues(value).length === 0;
}

// Default ingest endpoint. Separate from Signal's /collect. Clients
// deploying PI override via env; the view-model carries the final
// URL into the beacon fire call.
export const SIGNAL_REPORT_INTERACTION_INGEST_PATH = '/ingest/report-interaction';
