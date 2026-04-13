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

export interface SignalNetworkTierThresholds {
  urban: number;
  moderate: number;
  constrained_moderate: number;
}

export interface SignalLcpAttribution {
  load_state: SignalLoadState;
  target: string | null;
  element_type: SignalLcpElementType | null;
  resource_url: string | null;
}

export interface SignalInpAttribution {
  load_state: SignalLoadState;
  interaction_target: string | null;
  interaction_type: SignalInteractionType | null;
  interaction_time_ms: number | null;
  input_delay_ms: number | null;
  processing_duration_ms: number | null;
  presentation_delay_ms: number | null;
}

export interface SignalVitals {
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  fcp_ms: number | null;
  ttfb_ms: number | null;
  lcp_attribution?: SignalLcpAttribution;
  inp_attribution?: SignalInpAttribution;
}

export interface SignalContext {
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  save_data: boolean | null;
  connection_type: string | null;
}

export interface SignalMeta {
  pkg_version: string;
  browser: string;
  nav_type: string;
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
  nav_type: string;
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
 * Iteration 6: actionable compute reality.
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
