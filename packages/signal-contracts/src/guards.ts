import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalDeviceDistribution,
  SignalDeviceTier,
  SignalEventV1,
  SignalInteractionType,
  SignalLcpAttribution,
  SignalLcpElementType,
  SignalLoadState,
  SignalNavigationType,
  SignalNetTcpSource,
  SignalNetworkTier,
  SignalRaceFallbackReason,
  SignalRaceMetric,
  SignalTierDistribution,
  SignalTierMetricSummary,
  SignalWarehouseRowV1
} from './types.js';
import { SIGNAL_EVENT_VERSION, SIGNAL_REPORT_VERSION } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNumberOrNull(value: unknown): value is number | null {
  return value == null || isNumber(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value == null || isString(value);
}

function isBooleanOrNull(value: unknown): value is boolean | null {
  return value == null || isBoolean(value);
}

function hasEnumValue<T extends string>(valid: ReadonlySet<T>, value: unknown): value is T {
  return typeof value === 'string' && valid.has(value as T);
}

const VALID_NETWORK_TIERS = new Set<SignalNetworkTier>([
  'urban',
  'moderate',
  'constrained_moderate',
  'constrained'
]);
const VALID_DEVICE_TIERS = new Set<SignalDeviceTier>(['low', 'mid', 'high']);
const VALID_NET_TCP_SOURCES = new Set<SignalNetTcpSource>([
  'nav_timing_tcp_isolated',
  'nav_timing_full',
  'unavailable_reused',
  'unavailable_sw',
  'unavailable_tls_coalesced',
  'unavailable_missing_timing'
]);
const VALID_MODES = new Set<SignalAggregateV1['mode']>(['preview', 'production']);
const VALID_COMPARISON_TIERS = new Set<SignalComparisonTier>([
  'urban',
  'moderate',
  'constrained_moderate',
  'constrained',
  'none'
]);
const VALID_RACE_METRICS = new Set<SignalRaceMetric>(['lcp', 'fcp', 'ttfb', 'none']);
const VALID_RACE_FALLBACK_REASONS = new Set<SignalRaceFallbackReason>([
  'lcp_coverage_below_threshold',
  'fcp_unavailable',
  'insufficient_comparable_data'
]);
const VALID_NAVIGATION_TYPES = new Set<SignalNavigationType>([
  'navigate',
  'reload',
  'back-forward',
  'prerender',
  'restore'
]);
const VALID_LOAD_STATES = new Set<SignalLoadState>(['loading', 'interactive', 'complete']);
const VALID_INTERACTION_TYPES = new Set<SignalInteractionType>(['pointer', 'keyboard']);
const VALID_LCP_ELEMENT_TYPES = new Set<SignalLcpElementType>(['image', 'text']);

function isTierDistribution(value: unknown): value is SignalTierDistribution {
  if (!isRecord(value)) return false;
  return (
    isNumber(value['urban']) &&
    isNumber(value['moderate']) &&
    isNumber(value['constrained_moderate']) &&
    isNumber(value['constrained']) &&
    isNumber(value['unknown'])
  );
}

function isDeviceDistribution(value: unknown): value is SignalDeviceDistribution {
  if (!isRecord(value)) return false;
  return isNumber(value['low']) && isNumber(value['mid']) && isNumber(value['high']);
}

function isCoverage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNumber(value['network_coverage']) &&
    isNumber(value['unclassified_network_share']) &&
    isNumber(value['connection_reuse_share']) &&
    isNumber(value['lcp_coverage']) &&
    isNumberOrNull(value['selected_metric_urban_coverage']) &&
    isNumberOrNull(value['selected_metric_comparison_coverage'])
  );
}

function isTierMetricSummary(value: unknown): value is SignalTierMetricSummary {
  if (!isRecord(value)) return false;
  return (
    isNumber(value['observations']) &&
    isNumber(value['lcp_observations']) &&
    isNumber(value['fcp_observations']) &&
    isNumber(value['ttfb_observations']) &&
    isNumberOrNull(value['lcp_ms']) &&
    isNumberOrNull(value['fcp_ms']) &&
    isNumberOrNull(value['ttfb_ms']) &&
    isNumber(value['lcp_coverage']) &&
    isNumber(value['fcp_coverage']) &&
    isNumber(value['ttfb_coverage'])
  );
}

function isLcpAttribution(value: unknown): value is SignalLcpAttribution {
  if (!isRecord(value)) return false;
  return (
    hasEnumValue(VALID_LOAD_STATES, value['load_state']) &&
    isStringOrNull(value['target']) &&
    (value['element_type'] == null || hasEnumValue(VALID_LCP_ELEMENT_TYPES, value['element_type'])) &&
    isStringOrNull(value['resource_url'])
  );
}

function isInpAttribution(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasEnumValue(VALID_LOAD_STATES, value['load_state']) &&
    isStringOrNull(value['interaction_target']) &&
    (value['interaction_type'] == null || hasEnumValue(VALID_INTERACTION_TYPES, value['interaction_type'])) &&
    isNumberOrNull(value['interaction_time_ms']) &&
    isNumberOrNull(value['input_delay_ms']) &&
    isNumberOrNull(value['processing_duration_ms']) &&
    isNumberOrNull(value['presentation_delay_ms'])
  );
}

function isSignalVitals(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNumberOrNull(value['lcp_ms']) &&
    isNumberOrNull(value['cls']) &&
    isNumberOrNull(value['inp_ms']) &&
    isNumberOrNull(value['fcp_ms']) &&
    isNumberOrNull(value['ttfb_ms']) &&
    (value['lcp_attribution'] == null || isLcpAttribution(value['lcp_attribution'])) &&
    (value['inp_attribution'] == null || isInpAttribution(value['inp_attribution']))
  );
}

function isSignalContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isStringOrNull(value['effective_type']) &&
    isNumberOrNull(value['downlink_mbps']) &&
    isNumberOrNull(value['rtt_ms']) &&
    isBooleanOrNull(value['save_data']) &&
    isStringOrNull(value['connection_type'])
  );
}

function isSignalMeta(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value['pkg_version']) &&
    isString(value['browser']) &&
    isString(value['nav_type']) &&
    (value['navigation_type'] == null || hasEnumValue(VALID_NAVIGATION_TYPES, value['navigation_type']))
  );
}

export function explainSignalAggregateIssues(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return ['Expected a JSON object matching SignalAggregateV1.'];
  }

  if (value['v'] !== SIGNAL_EVENT_VERSION) issues.push(`Expected "v" to be ${SIGNAL_EVENT_VERSION}.`);
  if (value['rv'] !== SIGNAL_REPORT_VERSION) issues.push(`Expected "rv" to be ${SIGNAL_REPORT_VERSION}.`);
  if (!VALID_MODES.has(value['mode'] as SignalAggregateV1['mode'])) issues.push('Expected "mode" to be "preview" or "production".');
  if (!isString(value['domain'])) issues.push('Expected "domain" to be a string.');
  if (!isNumber(value['sample_size'])) issues.push('Expected "sample_size" to be a number.');
  if (!isNumber(value['classified_sample_size'])) issues.push('Expected "classified_sample_size" to be a number.');
  if (!isNumber(value['period_days'])) issues.push('Expected "period_days" to be a number.');
  if (!isNumber(value['generated_at'])) issues.push('Expected "generated_at" to be a number.');
  if (!isTierDistribution(value['network_distribution'])) issues.push('Expected "network_distribution" to include urban, moderate, constrained_moderate, constrained, and unknown percentages.');
  if (!isDeviceDistribution(value['device_distribution'])) issues.push('Expected "device_distribution" to include low, mid, and high percentages.');
  if (!VALID_COMPARISON_TIERS.has(value['comparison_tier'] as SignalComparisonTier)) issues.push('Expected "comparison_tier" to be a valid tier or "none".');
  if (!VALID_RACE_METRICS.has(value['race_metric'] as SignalRaceMetric)) issues.push('Expected "race_metric" to be one of lcp, fcp, ttfb, or none.');
  if (
    !(
      value['race_fallback_reason'] == null ||
      VALID_RACE_FALLBACK_REASONS.has(value['race_fallback_reason'] as SignalRaceFallbackReason)
    )
  ) {
    issues.push('Expected "race_fallback_reason" to be a valid fallback reason or null.');
  }
  if (!isCoverage(value['coverage'])) issues.push('Expected "coverage" to include network, reuse, LCP, and selected metric coverage values.');

  const vitals = value['vitals'];
  if (!isRecord(vitals)) {
    issues.push('Expected "vitals" to include "urban" and "comparison" summaries.');
  } else {
    if (!isTierMetricSummary(vitals['urban'])) issues.push('Expected "vitals.urban" to be a valid tier metric summary.');
    if (!isTierMetricSummary(vitals['comparison'])) issues.push('Expected "vitals.comparison" to be a valid tier metric summary.');
  }

  if (!(value['top_page_path'] == null || isString(value['top_page_path']))) {
    issues.push('Expected "top_page_path" to be a string or null.');
  }

  if (!Array.isArray(value['warnings']) || value['warnings'].some((warning) => !isString(warning))) {
    issues.push('Expected "warnings" to be an array of strings.');
  }

  return issues;
}

export function isSignalAggregateV1(value: unknown): value is SignalAggregateV1 {
  return explainSignalAggregateIssues(value).length === 0;
}

export function explainSignalEventIssues(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return ['Expected a JSON object matching SignalEventV1.'];
  }

  if (value['v'] !== SIGNAL_EVENT_VERSION) issues.push(`Expected "v" to be ${SIGNAL_EVENT_VERSION}.`);
  if (!isString(value['event_id'])) issues.push('Expected "event_id" to be a string.');
  if (!isNumber(value['ts'])) issues.push('Expected "ts" to be a number.');
  if (!isString(value['host'])) issues.push('Expected "host" to be a string.');
  if (!isString(value['url'])) issues.push('Expected "url" to be a string.');
  if (!isStringOrNull(value['ref'])) issues.push('Expected "ref" to be a string or null.');
  if (!(value['net_tier'] == null || hasEnumValue(VALID_NETWORK_TIERS, value['net_tier']))) {
    issues.push('Expected "net_tier" to be a valid network tier or null.');
  }
  if (!isNumberOrNull(value['net_tcp_ms'])) issues.push('Expected "net_tcp_ms" to be a number or null.');
  if (!hasEnumValue(VALID_NET_TCP_SOURCES, value['net_tcp_source'])) issues.push('Expected "net_tcp_source" to be a valid network timing source.');
  if (!hasEnumValue(VALID_DEVICE_TIERS, value['device_tier'])) issues.push('Expected "device_tier" to be low, mid, or high.');
  if (!isNumber(value['device_cores'])) issues.push('Expected "device_cores" to be a number.');
  if (!isNumberOrNull(value['device_memory_gb'])) issues.push('Expected "device_memory_gb" to be a number or null.');
  if (!isNumber(value['device_screen_w'])) issues.push('Expected "device_screen_w" to be a number.');
  if (!isNumber(value['device_screen_h'])) issues.push('Expected "device_screen_h" to be a number.');
  if (!isSignalVitals(value['vitals'])) issues.push('Expected "vitals" to include numeric vitals and valid attribution objects when present.');
  if (!isSignalContext(value['context'])) issues.push('Expected "context" to include connection fields with number/string/null values.');
  if (!isSignalMeta(value['meta'])) issues.push('Expected "meta" to include pkg_version, browser, nav_type, and a valid optional navigation_type.');

  return issues;
}

export function isSignalEventV1(value: unknown): value is SignalEventV1 {
  return explainSignalEventIssues(value).length === 0;
}

export function explainSignalWarehouseRowIssues(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return ['Expected a JSON object matching SignalWarehouseRowV1.'];
  }

  if (value['schema_version'] !== SIGNAL_EVENT_VERSION) issues.push(`Expected "schema_version" to be ${SIGNAL_EVENT_VERSION}.`);
  if (!isString(value['event_id'])) issues.push('Expected "event_id" to be a string.');
  if (!isString(value['observed_at'])) issues.push('Expected "observed_at" to be an ISO timestamp string.');
  if (!isString(value['host'])) issues.push('Expected "host" to be a string.');
  if (!isString(value['path'])) issues.push('Expected "path" to be a string.');
  if (!isStringOrNull(value['referrer'])) issues.push('Expected "referrer" to be a string or null.');
  if (!(value['net_tier'] == null || hasEnumValue(VALID_NETWORK_TIERS, value['net_tier']))) issues.push('Expected "net_tier" to be a valid network tier or null.');
  if (!isNumberOrNull(value['net_tcp_ms'])) issues.push('Expected "net_tcp_ms" to be a number or null.');
  if (!hasEnumValue(VALID_NET_TCP_SOURCES, value['net_tcp_source'])) issues.push('Expected "net_tcp_source" to be a valid network timing source.');
  if (!hasEnumValue(VALID_DEVICE_TIERS, value['device_tier'])) issues.push('Expected "device_tier" to be low, mid, or high.');
  if (!isNumber(value['device_cores'])) issues.push('Expected "device_cores" to be a number.');
  if (!isNumberOrNull(value['device_memory_gb'])) issues.push('Expected "device_memory_gb" to be a number or null.');
  if (!isNumber(value['device_screen_w'])) issues.push('Expected "device_screen_w" to be a number.');
  if (!isNumber(value['device_screen_h'])) issues.push('Expected "device_screen_h" to be a number.');
  if (!isNumberOrNull(value['lcp_ms'])) issues.push('Expected "lcp_ms" to be a number or null.');
  if (!isNumberOrNull(value['cls'])) issues.push('Expected "cls" to be a number or null.');
  if (!isNumberOrNull(value['inp_ms'])) issues.push('Expected "inp_ms" to be a number or null.');
  if (!isNumberOrNull(value['fcp_ms'])) issues.push('Expected "fcp_ms" to be a number or null.');
  if (!isNumberOrNull(value['ttfb_ms'])) issues.push('Expected "ttfb_ms" to be a number or null.');
  if (!isStringOrNull(value['effective_type'])) issues.push('Expected "effective_type" to be a string or null.');
  if (!isNumberOrNull(value['downlink_mbps'])) issues.push('Expected "downlink_mbps" to be a number or null.');
  if (!isNumberOrNull(value['rtt_ms'])) issues.push('Expected "rtt_ms" to be a number or null.');
  if (!isBooleanOrNull(value['save_data'])) issues.push('Expected "save_data" to be a boolean or null.');
  if (!isStringOrNull(value['connection_type'])) issues.push('Expected "connection_type" to be a string or null.');
  if (!isString(value['browser'])) issues.push('Expected "browser" to be a string.');
  if (!isString(value['nav_type'])) issues.push('Expected "nav_type" to be a string.');
  if (!(value['navigation_type'] == null || hasEnumValue(VALID_NAVIGATION_TYPES, value['navigation_type']))) issues.push('Expected "navigation_type" to be a valid navigation type or null.');
  if (!(value['lcp_load_state'] == null || hasEnumValue(VALID_LOAD_STATES, value['lcp_load_state']))) issues.push('Expected "lcp_load_state" to be a valid load state or null.');
  if (!isStringOrNull(value['lcp_target'])) issues.push('Expected "lcp_target" to be a string or null.');
  if (!(value['lcp_element_type'] == null || hasEnumValue(VALID_LCP_ELEMENT_TYPES, value['lcp_element_type']))) issues.push('Expected "lcp_element_type" to be image, text, or null.');
  if (!isStringOrNull(value['lcp_resource_url'])) issues.push('Expected "lcp_resource_url" to be a string or null.');
  if (!(value['inp_load_state'] == null || hasEnumValue(VALID_LOAD_STATES, value['inp_load_state']))) issues.push('Expected "inp_load_state" to be a valid load state or null.');
  if (!isStringOrNull(value['interaction_target'])) issues.push('Expected "interaction_target" to be a string or null.');
  if (!(value['interaction_type'] == null || hasEnumValue(VALID_INTERACTION_TYPES, value['interaction_type']))) issues.push('Expected "interaction_type" to be pointer, keyboard, or null.');
  if (!isNumberOrNull(value['interaction_time_ms'])) issues.push('Expected "interaction_time_ms" to be a number or null.');
  if (!isNumberOrNull(value['input_delay_ms'])) issues.push('Expected "input_delay_ms" to be a number or null.');
  if (!isNumberOrNull(value['processing_duration_ms'])) issues.push('Expected "processing_duration_ms" to be a number or null.');
  if (!isNumberOrNull(value['presentation_delay_ms'])) issues.push('Expected "presentation_delay_ms" to be a number or null.');

  return issues;
}

export function isSignalWarehouseRowV1(value: unknown): value is SignalWarehouseRowV1 {
  return explainSignalWarehouseRowIssues(value).length === 0;
}
