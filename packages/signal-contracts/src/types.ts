export const SIGNAL_EVENT_VERSION = 1 as const;
export const SIGNAL_REPORT_VERSION = 1 as const;
export const SIGNAL_PREVIEW_MINIMUM_SAMPLE = 100 as const;
export const SIGNAL_MIN_RACE_OBSERVATIONS = 25 as const;
export const SIGNAL_MIN_LCP_COVERAGE = 50 as const;
export const SIGNAL_FUNNEL_FCP_POOR_THRESHOLD = 3000 as const;
export const SIGNAL_FUNNEL_LCP_POOR_THRESHOLD = 4000 as const;
export const SIGNAL_FUNNEL_INP_POOR_THRESHOLD = 500 as const;
export const SIGNAL_REPORT_BASE_URL = 'https://signal.stroma.design/r';
export const SIGNAL_BUILDER_BASE_URL = 'https://signal.stroma.design/build';
export const SIGNAL_GA4_EVENT_NAME = 'perf_tier_report';

// Marginal-coverage caveat thresholds. When the race cohort lands within
// this slack of `SIGNAL_MIN_LCP_COVERAGE` / `SIGNAL_MIN_RACE_OBSERVATIONS`
// the aggregate raises a tone-tempering warning so the view model can
// swap certain claims for lighter phrasing.
export const SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT = 10 as const;
export const SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS = 10 as const;
export const SIGNAL_COVERAGE_MARGINAL_WARNING = 'coverage_marginal';

// Minimum Save-Data share narratable in Act 1. Sub-1% readings are
// either rounding artifacts or hostile-browser noise — not surprising
// enough to carry a narrative line.
export const SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT = 1 as const;

// Minimum cellular-network share narratable in Act 1. Chromium-only
// `connection_type` means Safari/Firefox cohorts are systematically
// `null`; a small non-zero share on Chromium-Android slices isn't
// surprising enough to frame in editorial voice. Hard-gate at 10%.
export const SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT = 10 as const;

// Report URL byte budgets. GA4 DataLayer → URL transport is commonly
// capped around 2 KB by proxies; 4 KB is the hard ceiling most CDNs
// accept. A soft breach emits a warning; a hard breach throws so we
// never ship a truncated / silently-broken URL.
export const SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES = 2048 as const;
export const SIGNAL_REPORT_URL_HARD_LIMIT_BYTES = 4096 as const;
export const SIGNAL_REPORT_URL_SOFT_LIMIT_WARNING = 'signal_report_url_exceeds_soft_limit';

export type SignalNetworkTier = 'urban' | 'moderate' | 'constrained_moderate' | 'constrained';

export type SignalDeviceTier = 'low' | 'mid' | 'high';

export type SignalNetTcpSource =
  | 'nav_timing_tcp_isolated'
  | 'nav_timing_full'
  | 'unavailable_reused'
  | 'unavailable_sw'
  | 'unavailable_tls_coalesced'
  | 'unavailable_missing_timing';

export type SignalRaceMetric = 'lcp' | 'fcp' | 'ttfb' | 'none';
export type SignalRaceFallbackReason =
  | 'lcp_coverage_below_threshold'
  | 'fcp_unavailable'
  | 'insufficient_comparable_data';

export type SignalComparisonTier = SignalNetworkTier | 'none';
export type SignalNavigationType = 'navigate' | 'reload' | 'back-forward' | 'prerender' | 'restore';
export type SignalLoadState = 'loading' | 'interactive' | 'complete';
export type SignalInteractionType = 'pointer' | 'keyboard';
export type SignalLcpElementType = 'image' | 'text';
export type SignalExperienceStage = 'fcp' | 'lcp' | 'inp';

// Enrichment unions. Each one corresponds to a story the hosted report
// can narrate when the SDK has captured enough signal. All are additive
// and non-breaking — events without these fields decode cleanly.

// LCP subpart that dominates paint delay. `ttfb` maps to the existing
// `vitals.ttfb_ms` field — no duplicate storage.
export type SignalLcpSubpart = 'ttfb' | 'resource_load_delay' | 'resource_load_time' | 'element_render_delay';

// Classifier output for the LCP element's likely editorial role. Runs
// against the sanitized `resource_url` + element `target` tag — no CSS
// selectors leave the browser (privacy posture preserved).
export type SignalLcpCulpritKind =
  | 'hero_image'
  | 'headline_text'
  | 'banner_image'
  | 'product_image'
  | 'video_poster'
  | 'unknown';

// Which INP substage dominates the slowest interaction: waiting for the
// main thread (input_delay), running event handlers (processing), or
// painting the visual update (presentation).
export type SignalInpPhase = 'input_delay' | 'processing' | 'presentation';

// LoAF dominant-cause bucket (Chromium 123+). Derived from the worst
// long-animation-frame entry's substage durations.
export type SignalLoafCause = 'script' | 'layout' | 'style' | 'paint';

// Third-party script weight pre-LCP, tiered. 0% narrates positively
// ("served entirely from your own origins"); missing data stays null.
export type SignalThirdPartyTier = 'none' | 'light' | 'moderate' | 'heavy';

// Dominant Network Information API effective type in the audience.
// `unknown` covers Safari/Firefox and any session that didn't expose
// the API. `slow-2g` matches the spec's hyphenated casing.
export type SignalEffectiveTypeDominant = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

export interface SignalNetworkTierThresholds {
  urban: number;
  moderate: number;
  constrained_moderate: number;
}

// Canonical TCP-handshake (ms) thresholds used by the SDK network
// classifier. Single source of truth — the SDK imports these to bin
// per-event TCP times; report renderers import them via
// `formatNetworkBand()` to derive the human-readable band copy. Keeping
// the values here means a tuning lower than 50ms ripples to one place.
export const DEFAULT_NETWORK_THRESHOLDS: SignalNetworkTierThresholds = {
  urban: 50,
  moderate: 150,
  constrained_moderate: 400
} as const;

// Bucket boundaries the SDK device classifier uses to score per-event
// CPU / memory / screen signals before composing the device tier. These
// are NOT strict tier definitions — the tier is a sum-of-scores
// composite — but they are the canonical numbers any descriptive copy
// about "what tier X means" has to draw from.
export interface SignalDeviceScoreBoundaries {
  // Inclusive upper bounds for cores scoring (cores <= low → 0,
  // <= mid → 1, <= high → 2, else 3).
  cores: { low: number; mid: number; high: number };
  // Inclusive upper bounds for memory_gb scoring (same staircase shape).
  memory_gb: { low: number; mid: number; high: number };
  // Exclusive upper bounds for screen_w scoring (< mobile → 0,
  // < tablet → 1, < desktop → 2, else 3).
  screen_w: { mobile: number; tablet: number; desktop: number };
}

export const DEFAULT_DEVICE_SCORE_BOUNDARIES: SignalDeviceScoreBoundaries = {
  cores: { low: 2, mid: 4, high: 6 },
  memory_gb: { low: 1, mid: 2, high: 4 },
  screen_w: { mobile: 480, tablet: 768, desktop: 1280 }
} as const;

// Human-readable network band derived from the canonical thresholds.
// One helper, one set of glyphs (en-dash, ≥), so report renderers stay
// in lock-step with the classifier when the numbers move.
export function formatNetworkBand(
  tier: SignalNetworkTier,
  thresholds: SignalNetworkTierThresholds = DEFAULT_NETWORK_THRESHOLDS
): string {
  switch (tier) {
    case 'urban':
      return `< ${thresholds.urban} ms TCP`;
    case 'moderate':
      return `${thresholds.urban}–${thresholds.moderate} ms TCP`;
    case 'constrained_moderate':
      return `${thresholds.moderate}–${thresholds.constrained_moderate} ms TCP`;
    case 'constrained':
      return `≥ ${thresholds.constrained_moderate} ms TCP`;
  }
}

// Human-readable device signature derived from the canonical score
// boundaries. The output is approximate (the SDK tier is a composite
// of three scores, not a strict bucket), but the cutoff numbers come
// from the same source the classifier uses, so any change to the score
// boundaries propagates to report copy.
export function formatDeviceSignature(
  tier: SignalDeviceTier,
  boundaries: SignalDeviceScoreBoundaries = DEFAULT_DEVICE_SCORE_BOUNDARIES
): string {
  const { cores, memory_gb, screen_w } = boundaries;
  switch (tier) {
    case 'high':
      return `${cores.high}+ cores · ${memory_gb.high}+ GB · ${screen_w.desktop}px+`;
    case 'mid':
      return `${cores.mid}–${cores.high} cores · ${memory_gb.mid}–${memory_gb.high} GB · ${screen_w.tablet}px+`;
    case 'low':
      return `≤${cores.low} cores · ≤${memory_gb.low} GB · <${screen_w.tablet}px`;
  }
}

export interface SignalLcpAttribution {
  load_state: SignalLoadState;
  target: string | null;
  element_type: SignalLcpElementType | null;
  resource_url: string | null;
  // Classifier output. Null when classification falls through or
  // `element_type` is null.
  culprit_kind?: SignalLcpCulpritKind | null;
}

export interface SignalInpAttribution {
  load_state: SignalLoadState;
  interaction_target: string | null;
  interaction_type: SignalInteractionType | null;
  interaction_time_ms: number | null;
  input_delay_ms: number | null;
  processing_duration_ms: number | null;
  presentation_delay_ms: number | null;
  // Dominant phase (argmax of input_delay/processing/presentation with
  // `processing > input_delay > presentation` tiebreak). Null when all
  // three source values are null.
  dominant_phase?: SignalInpPhase | null;
}

// LCP subpart breakdown — Chromium-only. Nulled as a group if any input
// is missing (opaque cross-origin resource timing, etc.). Partial
// breakdowns mislead aggregation, so we enforce all-or-nothing.
export interface SignalLcpBreakdown {
  resource_load_delay_ms: number | null;
  resource_load_time_ms: number | null;
  element_render_delay_ms: number | null;
}

// Third-party script weight pre-LCP. `pre_lcp_script_bytes` is
// deliberately NOT persisted — raw bytes without compression/cache
// context are non-narratable. Share % is the whole point.
// `origin_count` hides when < 3 for small-site privacy posture.
export interface SignalVitalsThirdParty {
  pre_lcp_script_share_pct: number | null;
  origin_count: number | null;
}

// Long Animation Frame summary — Chromium 123+. Only the worst-duration
// frame is retained (bounded memory per capture performance principles).
export interface SignalVitalsLoaf {
  worst_duration_ms: number | null;
  dominant_cause: SignalLoafCause | null;
  script_origin_count: number | null;
}

// Navigation Timing breakdown — decomposes the full navigation into
// named subparts (DNS / TCP / TLS / redirect / SW / request-response
// phases) plus three TTFB definitions plus protocol/payload metadata
// plus a provenance sub-block.
//
// Field discipline:
//   null = unavailable / not exposed / not applicable
//   0    = exposed and genuinely zero-duration (cached DNS, reused
//          connection, no redirect — meaningful zeros)
//
// This differs from `lcp_breakdown` (strict all-or-nothing): nav-timing
// subparts have legitimate independent absence (a reused connection
// has dns_ms=null but request_to_first_byte_ms can still be measured).
// The BLOCK is null only when no Navigation Timing entry exists.
export interface SignalVitalsNavigationTimingProvenance {
  // Each flag is true only when we have positive evidence; false when
  // we have positive evidence the condition does NOT apply; null when
  // the underlying signal is itself unavailable. Avoids encoding
  // "absence of signal" as "absence of condition."
  early_hints_present: boolean | null;
  activation_adjusted: boolean | null;
  timing_redacted_suspected: boolean | null;
  // ResourceTiming editor's draft (e.g. 'cache', 'navigational-prefetch').
  delivery_type: string | null;
  // HTTP status code if exposed.
  response_status: number | null;
}

export interface SignalVitalsNavigationTiming {
  // Subparts. Each ms-duration uses null vs 0 discipline.
  dns_ms: number | null;
  tcp_ms: number | null;
  tls_ms: number | null;
  redirect_ms: number | null;
  service_worker_ms: number | null;

  // Request/response phase split — disambiguated names per the 2026
  // API. responseStart can resolve to firstInterimResponseStart when
  // a 1xx response exists; finalResponseHeadersStart is the clean
  // anchor for "time to actual HTML response."
  request_to_first_byte_ms: number | null;
  request_to_final_headers_ms: number | null;
  response_download_ms: number | null;
  interim_to_final_response_ms: number | null;

  // Three named TTFB definitions — the "TTFB doesn't mean what you
  // think it means" central insight.
  nav_ttfb_ms: number | null;
  connection_ttfb_ms: number | null;
  // Math.max(0, responseStart - activationStart) — clamped because
  // responseStart can precede activationStart on prerender.
  activation_adjusted_ttfb_ms: number | null;

  // Raw anchor timestamps for downstream verification + future TTFB
  // recalculation (ms relative to nav startTime).
  first_interim_response_start_ms: number | null;
  final_response_headers_start_ms: number | null;

  // Protocol + payload — useful for h2/h3/http/1.1 cohort splits.
  next_hop_protocol: string | null;
  transfer_size: number | null;
  encoded_body_size: number | null;
  // 2026 ResourceTiming editor's draft fields (gated on availability).
  decoded_body_size: number | null;
  content_encoding: string | null;

  provenance: SignalVitalsNavigationTimingProvenance;
}

export interface SignalVitals {
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  fcp_ms: number | null;
  ttfb_ms: number | null;
  lcp_attribution?: SignalLcpAttribution;
  inp_attribution?: SignalInpAttribution;
  // LCP subpart math. Chromium-only; null on Safari/Firefox or
  // when the all-or-nothing rule strips a partial breakdown.
  lcp_breakdown?: SignalLcpBreakdown | null;
  // Third-party pre-paint script share. Requires an LCP anchor —
  // null on browsers without LCP or when no scripts were loaded pre-LCP.
  third_party?: SignalVitalsThirdParty | null;
  // LoAF worst-frame attribution. Chromium 123+; null otherwise.
  loaf?: SignalVitalsLoaf | null;
  // Navigation Timing decomposition. Block is null when no
  // PerformanceNavigationTiming entry exists; subparts are
  // independently null/0 per their own input availability.
  navigation_timing?: SignalVitalsNavigationTiming | null;
}

export interface SignalContext {
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  save_data: boolean | null;
  connection_type: string | null;
  // True when `document.visibilityState === 'hidden'` at event creation
  // (backgrounded tab, prerendered navigation). Aggregation uses it as a
  // pre-accumulator filter so background loads don't poison percentiles.
  // Optional on the type so older fixtures and historical events round-trip.
  visibility_hidden_at_load?: boolean;
}

export interface SignalMeta {
  pkg_version: string;
  browser: string;
  navigation_type?: SignalNavigationType;
}

export interface SignalEventV1 {
  v: typeof SIGNAL_EVENT_VERSION;
  event_id: string;
  ts: number;
  host: string;
  url: string;
  ref: string | null;
  net_tier: SignalNetworkTier | null;
  net_tcp_ms: number | null;
  net_tcp_source: SignalNetTcpSource;
  device_tier: SignalDeviceTier;
  device_cores: number;
  device_memory_gb: number | null;
  device_screen_w: number;
  device_screen_h: number;
  vitals: SignalVitals;
  context: SignalContext;
  meta: SignalMeta;
  // Optional identity / attribution fields. When populated by the host
  // site or by an SDK extension, these enable warehouse-side joins
  // between SignalEventV1 rows and other analytics or ad-platform data.
  // All four are optional so events from sites that do not populate
  // them round-trip through the contract unchanged.
  //   ga_session_id          — GA4 session identifier (from `_ga_<id>`)
  //   user_pseudo_id         — GA4 pseudonymous user identifier
  //   gclid                  — Google Click ID, useful for ad joins
  //   conversion_fingerprint — independent conversion event hash that
  //                            does not depend on Meta Pixel, Google
  //                            conversion tags, or ITP-gated cookies
  ga_session_id?: string | null;
  user_pseudo_id?: string | null;
  gclid?: string | null;
  conversion_fingerprint?: string | null;
}

export interface SignalWarehouseRowV1 {
  schema_version: typeof SIGNAL_EVENT_VERSION;
  event_id: string;
  observed_at: string;
  host: string;
  path: string;
  referrer: string | null;
  net_tier: SignalNetworkTier | null;
  net_tcp_ms: number | null;
  net_tcp_source: SignalNetTcpSource;
  device_tier: SignalDeviceTier;
  device_cores: number;
  device_memory_gb: number | null;
  device_screen_w: number;
  device_screen_h: number;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  fcp_ms: number | null;
  ttfb_ms: number | null;
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  save_data: boolean | null;
  connection_type: string | null;
  browser: string;
  navigation_type: SignalNavigationType | null;
  lcp_load_state: SignalLoadState | null;
  lcp_target: string | null;
  lcp_element_type: SignalLcpElementType | null;
  lcp_resource_url: string | null;
  inp_load_state: SignalLoadState | null;
  interaction_target: string | null;
  interaction_type: SignalInteractionType | null;
  interaction_time_ms: number | null;
  input_delay_ms: number | null;
  processing_duration_ms: number | null;
  presentation_delay_ms: number | null;
  // Enrichment columns — optional on the type so historical warehouse
  // exports without these fields round-trip cleanly. Populated by
  // `toSignalWarehouseRow()` in `ga4.ts`.
  lcp_breakdown_resource_load_delay_ms?: number | null;
  lcp_breakdown_resource_load_time_ms?: number | null;
  lcp_breakdown_element_render_delay_ms?: number | null;
  lcp_attribution_culprit_kind?: SignalLcpCulpritKind | null;
  inp_attribution_dominant_phase?: SignalInpPhase | null;
  third_party_pre_lcp_script_share_pct?: number | null;
  third_party_origin_count?: number | null;
  loaf_dominant_cause?: SignalLoafCause | null;
  context_visibility_hidden_at_load?: boolean | null;
  // Navigation Timing breakdown columns. Warehouse-only — these do
  // NOT enter the GA4 compact subset (which is at the 24-field cap).
  // Per-subpart null vs 0 discipline mirrors the SignalVitalsNavigationTiming
  // interface. Optional on the type so historical warehouse rows
  // round-trip unchanged.
  navigation_timing_dns_ms?: number | null;
  navigation_timing_tcp_ms?: number | null;
  navigation_timing_tls_ms?: number | null;
  navigation_timing_redirect_ms?: number | null;
  navigation_timing_service_worker_ms?: number | null;
  navigation_timing_request_to_first_byte_ms?: number | null;
  navigation_timing_request_to_final_headers_ms?: number | null;
  navigation_timing_response_download_ms?: number | null;
  navigation_timing_interim_to_final_response_ms?: number | null;
  navigation_timing_nav_ttfb_ms?: number | null;
  navigation_timing_connection_ttfb_ms?: number | null;
  navigation_timing_activation_adjusted_ttfb_ms?: number | null;
  navigation_timing_first_interim_response_start_ms?: number | null;
  navigation_timing_final_response_headers_start_ms?: number | null;
  navigation_timing_next_hop_protocol?: string | null;
  navigation_timing_transfer_size?: number | null;
  navigation_timing_encoded_body_size?: number | null;
  navigation_timing_decoded_body_size?: number | null;
  navigation_timing_content_encoding?: string | null;
  navigation_timing_provenance_early_hints_present?: boolean | null;
  navigation_timing_provenance_activation_adjusted?: boolean | null;
  navigation_timing_provenance_timing_redacted_suspected?: boolean | null;
  navigation_timing_provenance_delivery_type?: string | null;
  navigation_timing_provenance_response_status?: number | null;
  // Optional identity / attribution columns. Mirror the optional fields
  // on `SignalEventV1`; populated by the host site or an SDK extension
  // when warehouse-side joins to other analytics or ad-platform data
  // are wanted. Optional so historical warehouse rows round-trip
  // unchanged.
  ga_session_id?: string | null;
  user_pseudo_id?: string | null;
  gclid?: string | null;
  conversion_fingerprint?: string | null;
}

export interface SignalTierDistribution {
  urban: number;
  moderate: number;
  constrained_moderate: number;
  constrained: number;
  unknown: number;
}

export interface SignalDeviceDistribution {
  low: number;
  mid: number;
  high: number;
}

export interface SignalCoverage {
  network_coverage: number;
  unclassified_network_share: number;
  connection_reuse_share: number;
  lcp_coverage: number;
  selected_metric_urban_coverage: number | null;
  selected_metric_comparison_coverage: number | null;
  // Pre-filter observation count, before the visibility filter drops
  // background-tab loads. Post-filter count is the top-level `sample_size`.
  // Aggregation-time invariant:
  //   raw_sample_size === sample_size + excluded_background_sessions
  // Optional on the type so older aggregates without these fields decode.
  raw_sample_size?: number;
  excluded_background_sessions?: number;
}

export interface SignalTierMetricSummary {
  observations: number;
  lcp_observations: number;
  fcp_observations: number;
  ttfb_observations: number;
  lcp_ms: number | null;
  fcp_ms: number | null;
  ttfb_ms: number | null;
  lcp_coverage: number;
  fcp_coverage: number;
  ttfb_coverage: number;
}

export interface SignalExperienceTierStageSummary {
  coverage: number;
  poor_share: number;
}

export interface SignalExperienceStageSummary {
  poor_threshold_ms: number;
  tiers: Record<SignalNetworkTier, SignalExperienceTierStageSummary>;
}

export interface SignalExperienceFunnel {
  active_stages: SignalExperienceStage[];
  measured_session_coverage: number;
  poor_session_share: number;
  stages: {
    fcp: SignalExperienceStageSummary;
    lcp: SignalExperienceStageSummary;
    inp: SignalExperienceStageSummary;
  };
}

/* ---------------------------------------------------------------------
 * actionable compute reality.
 *
 * Every new block here carries data the SDK already captures per session
 * but the aggregator used to throw away. Each field has to pass the
 * usefulness filter — it must unlock a concrete product-team decision
 * (ship less JS, adopt Save-Data, prioritise webkit testing, etc.).
 *
 * Chromium-only signals degrade gracefully: deviceMemory falls into the
 * `unknown` bucket on Safari/Firefox, the Network Information API fields
 * degrade to `null` / `unknown`, and coverage percentages are tracked as
 * first-class fields so the report can surface honest caveats.
 * ------------------------------------------------------------------- */

// Form-factor distribution derived from device_screen_w at aggregation
// time. Breakpoints: <768 mobile, 768–1279 tablet, ≥1280 desktop.
// Unlocks the "what's my mobile share?" question that paid-media / CRO /
// SEO buyers ask first — and the Google mobile-page-experience scoring
// signal they operate against.
export interface SignalFormFactorDistribution {
  mobile: number;
  tablet: number;
  desktop: number;
}

export interface SignalDeviceHardware {
  // Logical CPU cores — universal via navigator.hardwareConcurrency.
  // Drives the JS-bundle-budget decision: how much main-thread work
  // the audience can afford.
  cores_hist: {
    '1': number;
    '2': number;
    '4': number;
    '6': number;
    '8': number;
    '12_plus': number;
  };
  // Device memory — Chromium-only, bucketed 0.25–8 GB. Safari and
  // Firefox sessions land in `unknown`. Drives the memory-budget
  // decision: whether to audit in-memory caches and leaks.
  memory_gb_hist: {
    '0_5': number;
    '1': number;
    '2': number;
    '4': number;
    '8_plus': number;
    unknown: number;
  };
  // Share of sessions where navigator.deviceMemory was exposed. Used
  // to caveat the memory histogram honestly.
  memory_coverage: number;
}

export interface SignalQuartiles {
  p25: number;
  p50: number;
  p75: number;
}

export interface SignalNetworkSignals {
  // Network Information API effective type. Chromium-only; Safari and
  // Firefox sessions land in `unknown`. Drives the adaptive-loading
  // decision: when to defer non-critical resources.
  effective_type_hist: {
    slow_2g: number;
    '2g': number;
    '3g': number;
    '4g': number;
    unknown: number;
  };
  effective_type_coverage: number;
  // Share of sessions with Save-Data flag on. Drives the Save-Data
  // HTTP header honour decision.
  save_data_share: number;
  // Downlink Mbps quartiles — Chromium-only. Null when coverage is
  // too low to defend the percentile math. Drives the page-weight
  // budget decision.
  downlink_mbps: SignalQuartiles | null;
  // RTT ms quartiles — Chromium-only. Null when coverage is too low.
  // Drives the request-consolidation decision.
  rtt_ms: SignalQuartiles | null;
}

export interface SignalEnvironment {
  // Browser family distribution, parsed from navigator.userAgent.
  // Drives the testing matrix priority decision (webkit guards,
  // feature flag scope, etc.).
  browser_hist: {
    chrome: number;
    safari: number;
    firefox: number;
    edge: number;
    other: number;
  };
}

/* ---------------------------------------------------------------------
 * Aggregate narrative stories.
 *
 * Each story answers a single question the hosted report narrates inline.
 * `dominant_subpart_share_pct < 35%` triggers the hedged copy branch —
 * surfaced via the `share_pct` field so the view model can decide.
 * Undefined story = block omitted entirely.
 * ------------------------------------------------------------------- */

// Act 2 — "why does LCP fail?" Surfaced as an inline line under the
// race gauge plus a 4-bar micro-chart of the subpart distribution.
export interface SignalLcpStory {
  dominant_subpart: SignalLcpSubpart | null;
  dominant_subpart_share_pct: number | null;
  dominant_culprit_kind: SignalLcpCulpritKind | null;
  subpart_distribution_pct: {
    ttfb: number;
    resource_load_delay: number;
    resource_load_time: number;
    element_render_delay: number;
  } | null;
}

// Act 3 — "why do interactions feel slow?" Pairs with the existing INP
// funnel node.
export interface SignalInpStory {
  dominant_phase: SignalInpPhase | null;
  dominant_phase_share_pct: number | null;
  phase_distribution_pct: {
    input_delay: number;
    processing: number;
    presentation: number;
  } | null;
}

// Act 2 — "what's the external cause?" Pre-frames the race gauge.
// `dominant_tier === 'none'` is narrated positively; the report never
// treats a zero-third-party share as absence.
export interface SignalThirdPartyStory {
  median_share_pct: number | null;
  dominant_tier: SignalThirdPartyTier | null;
  dominant_tier_share_pct: number | null;
  median_origin_count: number | null;
}

// Act 3 — LoAF worst-frame attribution across the cohort. Null-safe for
// early Chrome 123 betas that produced partial entries.
export interface SignalLoafStory {
  dominant_cause: SignalLoafCause | null;
  dominant_cause_share_pct: number | null;
  worst_frame_ms_p75: number | null;
}

// Act 1 — audience reality. `save_data_share_pct < 1` and
// `cellular_share_pct < 10` both fall back to line-omission in the
// view model (not surprising enough to narrate).
export interface SignalContextStory {
  save_data_share_pct: number | null;
  median_rtt_ms: number | null;
  cellular_share_pct: number | null;
  effective_type_dominant: SignalEffectiveTypeDominant | null;
}

// Per-subpart summary used by the navigation-timing story.
// Observation count exposed alongside quartiles per the rule that
// quartiles without coverage will overclaim — especially load-bearing
// for DNS/TCP/TLS because reused connections systematically remove
// those subparts from the sample.
export interface SignalNavigationTimingSubpartSummary {
  observations: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

// Subpart of nav_ttfb that carries the largest typical contribution
// across the cohort. Computed under STRICT denominator: only events
// where ALL of {dns, tcp, tls, request_to_first_byte, response_download,
// redirect} are non-null contribute. Otherwise DNS-20-samples gets
// unfairly compared to request-200-samples.
export type SignalNavigationTimingDominantSubpart = 'dns' | 'tcp' | 'tls' | 'redirect' | 'request' | 'response';

// Aggregator narrative — adds up the per-event vitals.navigation_timing
// captures into per-subpart distributions plus a strict-denominator
// dominant TTFB subpart, a protocol histogram, and a provenance
// roll-up. Gated on SIGNAL_MIN_RACE_OBSERVATIONS to avoid surfacing a
// subpart distribution from a single stray sample.
export interface SignalNavigationTimingStory {
  subparts: {
    dns_ms: SignalNavigationTimingSubpartSummary;
    tcp_ms: SignalNavigationTimingSubpartSummary;
    tls_ms: SignalNavigationTimingSubpartSummary;
    redirect_ms: SignalNavigationTimingSubpartSummary;
    service_worker_ms: SignalNavigationTimingSubpartSummary;
    request_to_first_byte_ms: SignalNavigationTimingSubpartSummary;
    request_to_final_headers_ms: SignalNavigationTimingSubpartSummary;
    response_download_ms: SignalNavigationTimingSubpartSummary;
    nav_ttfb_ms: SignalNavigationTimingSubpartSummary;
    connection_ttfb_ms: SignalNavigationTimingSubpartSummary;
    activation_adjusted_ttfb_ms: SignalNavigationTimingSubpartSummary;
  };
  dominant_ttfb_subpart: SignalNavigationTimingDominantSubpart | null;
  // Number of events that contributed to the dominance calculation
  // (i.e. had every comparable subpart non-null). Surfaced for honesty
  // — a dominance verdict over 18 events is not the same as one over
  // 1,800 events.
  dominant_ttfb_subpart_strict_observations: number;
  next_hop_protocol_histogram: {
    h2: number;
    h3: number;
    'http/1.1': number;
    other: number;
  };
  provenance_roll_up: {
    early_hints_share_pct: number;
    activation_adjusted_share_pct: number;
    timing_redacted_suspected_share_pct: number;
  };
}

export interface SignalAggregateV1 {
  v: typeof SIGNAL_EVENT_VERSION;
  rv: typeof SIGNAL_REPORT_VERSION;
  mode: 'preview' | 'production';
  generated_at: number;
  domain: string;
  sample_size: number;
  classified_sample_size: number;
  period_days: number;
  network_distribution: SignalTierDistribution;
  device_distribution: SignalDeviceDistribution;
  comparison_tier: SignalComparisonTier;
  race_metric: SignalRaceMetric;
  race_fallback_reason: SignalRaceFallbackReason | null;
  coverage: SignalCoverage;
  vitals: {
    urban: SignalTierMetricSummary;
    comparison: SignalTierMetricSummary;
  };
  experience_funnel?: SignalExperienceFunnel;
  device_hardware?: SignalDeviceHardware;
  network_signals?: SignalNetworkSignals;
  environment?: SignalEnvironment;
  // Form-factor split (mobile/tablet/desktop), derived from device_screen_w
  // at aggregation time. Additive optional field landing in 0.1 to surface
  // the mobile-friendliness axis paid-media buyers ask for first. Emitted
  // by both GA4 and normalized SQL paths.
  form_factor_distribution?: SignalFormFactorDistribution;
  // Narrative story blocks. Each is omitted entirely when upstream data
  // is insufficient (Safari-only cohort, below-threshold coverage, etc.)
  // — undefined always means "don't render".
  lcp_story?: SignalLcpStory;
  inp_story?: SignalInpStory;
  third_party_story?: SignalThirdPartyStory;
  loaf_story?: SignalLoafStory;
  context_story?: SignalContextStory;
  // Navigation Timing decomposition story. Per-subpart distributions
  // + strict-denominator dominance + protocol histogram + provenance
  // roll-up. Optional — undefined when below SIGNAL_MIN_RACE_OBSERVATIONS
  // events carried a SignalVitalsNavigationTiming block.
  navigation_timing_story?: SignalNavigationTimingStory;
  top_page_path: string | null;
  warnings: string[];
}

export interface SignalReportUrlResult {
  url: string;
  aggregate: SignalAggregateV1;
  warnings: string[];
  sampleSize: number;
  meetsRecommendation: boolean;
  mode: SignalAggregateV1['mode'];
}

export interface SignalMetricSelectionInput {
  urban: Pick<
    SignalTierMetricSummary,
    'lcp_observations' | 'fcp_observations' | 'ttfb_observations' | 'lcp_coverage' | 'fcp_coverage' | 'ttfb_coverage'
  >;
  comparison: Pick<
    SignalTierMetricSummary,
    'lcp_observations' | 'fcp_observations' | 'ttfb_observations' | 'lcp_coverage' | 'fcp_coverage' | 'ttfb_coverage'
  >;
}

export interface SignalMetricSelectionResult {
  race_metric: SignalRaceMetric;
  race_fallback_reason: SignalRaceFallbackReason | null;
}

export interface SignalSink {
  id: string;
  handle: (event: SignalEventV1) => void | Promise<void>;
}

export interface SignalGa4FieldMapV1 {
  eventName: typeof SIGNAL_GA4_EVENT_NAME;
  fields: Record<string, string>;
}

export interface SignalAggregationSpecV1 {
  previewMinimumSample: typeof SIGNAL_PREVIEW_MINIMUM_SAMPLE;
  minRaceObservations: typeof SIGNAL_MIN_RACE_OBSERVATIONS;
  minLcpCoverage: typeof SIGNAL_MIN_LCP_COVERAGE;
  funnelPoorThresholds: {
    fcp: typeof SIGNAL_FUNNEL_FCP_POOR_THRESHOLD;
    lcp: typeof SIGNAL_FUNNEL_LCP_POOR_THRESHOLD;
    inp: typeof SIGNAL_FUNNEL_INP_POOR_THRESHOLD;
  };
}
