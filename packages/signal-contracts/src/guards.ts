import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalCoverage,
  SignalDeviceDistribution,
  SignalDeviceTier,
  SignalEventV1,
  SignalExperienceFunnel,
  SignalExperienceStage,
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

const VALID_NETWORK_TIERS = new Set<SignalNetworkTier>(['urban', 'moderate', 'constrained_moderate', 'constrained']);
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
const VALID_EXPERIENCE_STAGES = new Set<SignalExperienceStage>(['fcp', 'lcp', 'inp']);
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
    isNumber(value.urban) &&
    isNumber(value.moderate) &&
    isNumber(value.constrained_moderate) &&
    isNumber(value.constrained) &&
    isNumber(value.unknown)
  );
}

function isDeviceDistribution(value: unknown): value is SignalDeviceDistribution {
  if (!isRecord(value)) return false;
  return isNumber(value.low) && isNumber(value.mid) && isNumber(value.high);
}

function isCoverage(value: unknown): value is SignalCoverage {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.network_coverage) &&
    isNumber(value.unclassified_network_share) &&
    isNumber(value.connection_reuse_share) &&
    isNumber(value.lcp_coverage) &&
    isNumberOrNull(value.selected_metric_urban_coverage) &&
    isNumberOrNull(value.selected_metric_comparison_coverage)
  );
}

function isTierMetricSummary(value: unknown): value is SignalTierMetricSummary {
  if (!isRecord(value)) return false;
  return (
    isNumber(value.observations) &&
    isNumber(value.lcp_observations) &&
    isNumber(value.fcp_observations) &&
    isNumber(value.ttfb_observations) &&
    isNumberOrNull(value.lcp_ms) &&
    isNumberOrNull(value.fcp_ms) &&
    isNumberOrNull(value.ttfb_ms) &&
    isNumber(value.lcp_coverage) &&
    isNumber(value.fcp_coverage) &&
    isNumber(value.ttfb_coverage)
  );
}

function isExperienceTierStageSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isNumber(value.coverage) && isNumber(value.poor_share);
}

function isExperienceStageSummary(value: unknown): boolean {
  if (!isRecord(value) || !isNumber(value.poor_threshold_ms) || !isRecord(value.tiers)) return false;
  return (
    isExperienceTierStageSummary(value.tiers.urban) &&
    isExperienceTierStageSummary(value.tiers.moderate) &&
    isExperienceTierStageSummary(value.tiers.constrained_moderate) &&
    isExperienceTierStageSummary(value.tiers.constrained)
  );
}

function isExperienceFunnel(value: unknown): value is SignalExperienceFunnel {
  if (!isRecord(value) || !Array.isArray(value.active_stages)) return false;
  if (value.active_stages.some((stage) => !hasEnumValue(VALID_EXPERIENCE_STAGES, stage))) return false;
  if (!isNumber(value.measured_session_coverage) || !isNumber(value.poor_session_share)) return false;
  if (!isRecord(value.stages)) return false;
  return (
    isExperienceStageSummary(value.stages.fcp) &&
    isExperienceStageSummary(value.stages.lcp) &&
    isExperienceStageSummary(value.stages.inp)
  );
}

function isLcpAttribution(value: unknown): value is SignalLcpAttribution {
  if (!isRecord(value)) return false;
  return (
    hasEnumValue(VALID_LOAD_STATES, value.load_state) &&
    isStringOrNull(value.target) &&
    (value.element_type == null || hasEnumValue(VALID_LCP_ELEMENT_TYPES, value.element_type)) &&
    isStringOrNull(value.resource_url)
  );
}

function isInpAttribution(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasEnumValue(VALID_LOAD_STATES, value.load_state) &&
    isStringOrNull(value.interaction_target) &&
    (value.interaction_type == null || hasEnumValue(VALID_INTERACTION_TYPES, value.interaction_type)) &&
    isNumberOrNull(value.interaction_time_ms) &&
    isNumberOrNull(value.input_delay_ms) &&
    isNumberOrNull(value.processing_duration_ms) &&
    isNumberOrNull(value.presentation_delay_ms)
  );
}

function isSignalVitals(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isNumberOrNull(value.lcp_ms) &&
    isNumberOrNull(value.cls) &&
    isNumberOrNull(value.inp_ms) &&
    isNumberOrNull(value.fcp_ms) &&
    isNumberOrNull(value.ttfb_ms) &&
    (value.lcp_attribution == null || isLcpAttribution(value.lcp_attribution)) &&
    (value.inp_attribution == null || isInpAttribution(value.inp_attribution))
  );
}

function isSignalContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isStringOrNull(value.effective_type) &&
    isNumberOrNull(value.downlink_mbps) &&
    isNumberOrNull(value.rtt_ms) &&
    isBooleanOrNull(value.save_data) &&
    isStringOrNull(value.connection_type)
  );
}

function isSignalMeta(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.pkg_version) &&
    isString(value.browser) &&
    isString(value.nav_type) &&
    (value.navigation_type == null || hasEnumValue(VALID_NAVIGATION_TYPES, value.navigation_type))
  );
}

export function explainSignalAggregateIssues(value: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return ['Expected a JSON object matching SignalAggregateV1.'];
  }

  if (value.v !== SIGNAL_EVENT_VERSION) issues.push(`Expected "v" to be ${SIGNAL_EVENT_VERSION}.`);
  if (value.rv !== SIGNAL_REPORT_VERSION) issues.push(`Expected "rv" to be ${SIGNAL_REPORT_VERSION}.`);
  if (!VALID_MODES.has(value.mode as SignalAggregateV1['mode']))
    issues.push('Expected "mode" to be "preview" or "production".');
  if (!isString(value.domain)) issues.push('Expected "domain" to be a string.');
  if (!isNumber(value.sample_size)) issues.push('Expected "sample_size" to be a number.');
  if (!isNumber(value.classified_sample_size)) issues.push('Expected "classified_sample_size" to be a number.');
  if (!isNumber(value.period_days)) issues.push('Expected "period_days" to be a number.');
  if (!isNumber(value.generated_at)) issues.push('Expected "generated_at" to be a number.');
  if (!isTierDistribution(value.network_distribution))
    issues.push(
      'Expected "network_distribution" to include urban, moderate, constrained_moderate, constrained, and unknown percentages.'
    );
  if (!isDeviceDistribution(value.device_distribution))
    issues.push('Expected "device_distribution" to include low, mid, and high percentages.');
  if (!VALID_COMPARISON_TIERS.has(value.comparison_tier as SignalComparisonTier))
    issues.push('Expected "comparison_tier" to be a valid tier or "none".');
  if (!VALID_RACE_METRICS.has(value.race_metric as SignalRaceMetric))
    issues.push('Expected "race_metric" to be one of lcp, fcp, ttfb, or none.');
  if (
    !(
      value.race_fallback_reason == null ||
      VALID_RACE_FALLBACK_REASONS.has(value.race_fallback_reason as SignalRaceFallbackReason)
    )
  ) {
    issues.push('Expected "race_fallback_reason" to be a valid fallback reason or null.');
  }
  if (!isCoverage(value.coverage))
    issues.push('Expected "coverage" to include network, reuse, LCP, and selected metric coverage values.');

  const vitals = value.vitals;
  if (!isRecord(vitals)) {
    issues.push('Expected "vitals" to include "urban" and "comparison" summaries.');
  } else {
    if (!isTierMetricSummary(vitals.urban)) issues.push('Expected "vitals.urban" to be a valid tier metric summary.');
    if (!isTierMetricSummary(vitals.comparison))
      issues.push('Expected "vitals.comparison" to be a valid tier metric summary.');
  }

  if (!(value.top_page_path == null || isString(value.top_page_path))) {
    issues.push('Expected "top_page_path" to be a string or null.');
  }

  if (!(value.experience_funnel == null || isExperienceFunnel(value.experience_funnel))) {
    issues.push(
      'Expected "experience_funnel" to include active stages, measured coverage, poor session share, and per-stage tier summaries when present.'
    );
  }

  if (value.device_hardware != null) {
    const dh = value.device_hardware;
    if (!isRecord(dh) || !isRecord(dh.cores_hist) || !isRecord(dh.memory_gb_hist) || !isNumber(dh.memory_coverage)) {
      issues.push(
        'Expected "device_hardware" to include cores_hist, memory_gb_hist, and memory_coverage when present.'
      );
    }
  }

  if (value.network_signals != null) {
    const ns = value.network_signals;
    if (
      !isRecord(ns) ||
      !isRecord(ns.effective_type_hist) ||
      !isNumber(ns.effective_type_coverage) ||
      !isNumber(ns.save_data_share)
    ) {
      issues.push(
        'Expected "network_signals" to include effective_type_hist, effective_type_coverage, and save_data_share when present.'
      );
    }
  }

  if (value.environment != null) {
    const env = value.environment;
    if (!isRecord(env) || !isRecord(env.browser_hist)) {
      issues.push('Expected "environment" to include browser_hist when present.');
    }
  }

  if (value.form_factor_distribution != null) {
    const ff = value.form_factor_distribution;
    if (!isRecord(ff) || !isNumber(ff.mobile) || !isNumber(ff.tablet) || !isNumber(ff.desktop)) {
      issues.push('Expected "form_factor_distribution" to include mobile, tablet, and desktop shares when present.');
    }
  }

  if (!Array.isArray(value.warnings) || value.warnings.some((warning) => !isString(warning))) {
    issues.push('Expected "warnings" to be an array of strings.');
  }

  // Semantic range validation — percentages must be 0–100, counts non-negative
  if (isNumber(value.sample_size) && value.sample_size < 0) {
    issues.push('Expected "sample_size" to be non-negative.');
  }
  if (isNumber(value.classified_sample_size) && value.classified_sample_size < 0) {
    issues.push('Expected "classified_sample_size" to be non-negative.');
  }
  if (isNumber(value.period_days) && value.period_days < 0) {
    issues.push('Expected "period_days" to be non-negative.');
  }
  if (isNumber(value.generated_at) && value.generated_at < 0) {
    issues.push('Expected "generated_at" to be non-negative.');
  }
  if (isTierDistribution(value.network_distribution)) {
    const nd = value.network_distribution;
    const ndEntries: Array<[string, unknown]> = [
      ['urban', nd.urban],
      ['moderate', nd.moderate],
      ['constrained_moderate', nd.constrained_moderate],
      ['constrained', nd.constrained],
      ['unknown', nd.unknown]
    ];
    for (const [key, v] of ndEntries) {
      if (isNumber(v) && (v < 0 || v > 100)) {
        issues.push(`Expected "network_distribution.${key}" to be between 0 and 100.`);
      }
    }
  }
  if (isDeviceDistribution(value.device_distribution)) {
    const dd = value.device_distribution;
    const ddEntries: Array<[string, unknown]> = [
      ['low', dd.low],
      ['mid', dd.mid],
      ['high', dd.high]
    ];
    for (const [key, v] of ddEntries) {
      if (isNumber(v) && (v < 0 || v > 100)) {
        issues.push(`Expected "device_distribution.${key}" to be between 0 and 100.`);
      }
    }
  }
  if (isCoverage(value.coverage)) {
    const cov = value.coverage;
    const covEntries: Array<[string, unknown]> = [
      ['network_coverage', cov.network_coverage],
      ['unclassified_network_share', cov.unclassified_network_share],
      ['connection_reuse_share', cov.connection_reuse_share],
      ['lcp_coverage', cov.lcp_coverage],
      ['selected_metric_urban_coverage', cov.selected_metric_urban_coverage],
      ['selected_metric_comparison_coverage', cov.selected_metric_comparison_coverage]
    ];
    for (const [key, v] of covEntries) {
      if (isNumber(v) && (v < 0 || v > 100)) {
        issues.push(`Expected "coverage.${key}" to be between 0 and 100.`);
      }
    }
  }
  // Validate nested tier metric coverages
  if (isRecord(value.vitals)) {
    for (const tierKey of ['urban', 'comparison'] as const) {
      const tier = value.vitals[tierKey];
      if (isTierMetricSummary(tier)) {
        for (const covKey of ['lcp_coverage', 'fcp_coverage', 'ttfb_coverage'] as const) {
          if (tier[covKey] < 0 || tier[covKey] > 100) {
            issues.push(`Expected "vitals.${tierKey}.${covKey}" to be between 0 and 100.`);
          }
        }
      }
    }
  }
  // Validate experience funnel stage coverage and poor_share
  if (value.experience_funnel != null && isExperienceFunnel(value.experience_funnel)) {
    const ef = value.experience_funnel;
    if (ef.measured_session_coverage < 0 || ef.measured_session_coverage > 100) {
      issues.push('Expected "experience_funnel.measured_session_coverage" to be between 0 and 100.');
    }
    if (ef.poor_session_share < 0 || ef.poor_session_share > 100) {
      issues.push('Expected "experience_funnel.poor_session_share" to be between 0 and 100.');
    }
    for (const stageKey of ['fcp', 'lcp', 'inp'] as const) {
      const stage = ef.stages[stageKey];
      for (const tierKey of ['urban', 'moderate', 'constrained_moderate', 'constrained'] as const) {
        const tier = stage.tiers[tierKey];
        if (tier.coverage < 0 || tier.coverage > 100) {
          issues.push(
            `Expected "experience_funnel.stages.${stageKey}.tiers.${tierKey}.coverage" to be between 0 and 100.`
          );
        }
        if (tier.poor_share < 0 || tier.poor_share > 100) {
          issues.push(
            `Expected "experience_funnel.stages.${stageKey}.tiers.${tierKey}.poor_share" to be between 0 and 100.`
          );
        }
      }
    }
  }
  // Validate optional device_hardware percentages
  if (value.device_hardware != null && isRecord(value.device_hardware)) {
    const dh = value.device_hardware;
    if (isNumber(dh.memory_coverage) && (dh.memory_coverage < 0 || dh.memory_coverage > 100)) {
      issues.push('Expected "device_hardware.memory_coverage" to be between 0 and 100.');
    }
    if (isRecord(dh.cores_hist)) {
      for (const [k, v] of Object.entries(dh.cores_hist)) {
        if (isNumber(v) && (v < 0 || v > 100)) {
          issues.push(`Expected "device_hardware.cores_hist.${k}" to be between 0 and 100.`);
        }
      }
    }
    if (isRecord(dh.memory_gb_hist)) {
      for (const [k, v] of Object.entries(dh.memory_gb_hist)) {
        if (isNumber(v) && (v < 0 || v > 100)) {
          issues.push(`Expected "device_hardware.memory_gb_hist.${k}" to be between 0 and 100.`);
        }
      }
    }
  }
  // Validate optional network_signals percentages
  if (value.network_signals != null && isRecord(value.network_signals)) {
    const ns = value.network_signals;
    if (isNumber(ns.effective_type_coverage) && (ns.effective_type_coverage < 0 || ns.effective_type_coverage > 100)) {
      issues.push('Expected "network_signals.effective_type_coverage" to be between 0 and 100.');
    }
    if (isNumber(ns.save_data_share) && (ns.save_data_share < 0 || ns.save_data_share > 100)) {
      issues.push('Expected "network_signals.save_data_share" to be between 0 and 100.');
    }
    if (isRecord(ns.effective_type_hist)) {
      for (const [k, v] of Object.entries(ns.effective_type_hist)) {
        if (isNumber(v) && (v < 0 || v > 100)) {
          issues.push(`Expected "network_signals.effective_type_hist.${k}" to be between 0 and 100.`);
        }
      }
    }
  }
  // Validate optional environment percentages
  if (value.environment != null && isRecord(value.environment)) {
    const env = value.environment;
    if (isRecord(env.browser_hist)) {
      for (const [k, v] of Object.entries(env.browser_hist)) {
        if (isNumber(v) && (v < 0 || v > 100)) {
          issues.push(`Expected "environment.browser_hist.${k}" to be between 0 and 100.`);
        }
      }
    }
  }

  // Validate optional form_factor_distribution — range + sum-to-100.
  if (value.form_factor_distribution != null && isRecord(value.form_factor_distribution)) {
    const ff = value.form_factor_distribution;
    for (const key of ['mobile', 'tablet', 'desktop'] as const) {
      const v = ff[key];
      if (isNumber(v) && (v < 0 || v > 100)) {
        issues.push(`Expected "form_factor_distribution.${key}" to be between 0 and 100.`);
      }
    }
    if (isNumber(ff.mobile) && isNumber(ff.tablet) && isNumber(ff.desktop)) {
      const ffSum = ff.mobile + ff.tablet + ff.desktop;
      if (ffSum > 0 && Math.abs(ffSum - 100) > 2) {
        issues.push(`Expected form_factor_distribution to sum to ~100 (got ${ffSum}).`);
      }
    }
  }

  // Cross-field coherence — catches structurally valid but semantically impossible aggregates.
  // Independent rounding means sums may be 99 or 101 — allow ±2 tolerance.
  if (isTierDistribution(value.network_distribution)) {
    const nd = value.network_distribution;
    const ndSum = nd.urban + nd.moderate + nd.constrained_moderate + nd.constrained + nd.unknown;
    if (ndSum > 0 && Math.abs(ndSum - 100) > 2) {
      issues.push(`Expected network_distribution to sum to ~100 (got ${ndSum}).`);
    }
  }
  if (isDeviceDistribution(value.device_distribution)) {
    const dd = value.device_distribution;
    const ddSum = dd.low + dd.mid + dd.high;
    if (ddSum > 0 && Math.abs(ddSum - 100) > 2) {
      issues.push(`Expected device_distribution to sum to ~100 (got ${ddSum}).`);
    }
  }
  if (isNumber(value.sample_size) && isNumber(value.classified_sample_size)) {
    if (value.classified_sample_size > value.sample_size) {
      issues.push('Expected "classified_sample_size" to not exceed "sample_size".');
    }
  }
  if (isNumber(value.sample_size) && value.sample_size > 0 && isCoverage(value.coverage)) {
    const coverage = value.coverage;
    const coverageSum = coverage.network_coverage + coverage.unclassified_network_share;
    if (Math.abs(coverageSum - 100) > 2) {
      issues.push(
        `Expected coverage.network_coverage + coverage.unclassified_network_share to sum to ~100 (got ${coverageSum}).`
      );
    }
  }
  if (isTierDistribution(value.network_distribution) && isCoverage(value.coverage)) {
    const nd = value.network_distribution;
    const coverage = value.coverage;
    const classifiedShare = nd.urban + nd.moderate + nd.constrained_moderate + nd.constrained;
    if (Math.abs(classifiedShare - coverage.network_coverage) > 2) {
      issues.push(
        `Expected classified network_distribution share to align with coverage.network_coverage (got ${classifiedShare} vs ${coverage.network_coverage}).`
      );
    }
    if (Math.abs(nd.unknown - coverage.unclassified_network_share) > 2) {
      issues.push(
        `Expected network_distribution.unknown to align with coverage.unclassified_network_share (got ${nd.unknown} vs ${coverage.unclassified_network_share}).`
      );
    }
  }
  if (isNumber(value.sample_size) && isNumber(value.classified_sample_size) && isCoverage(value.coverage)) {
    const coverage = value.coverage;
    const expectedClassifiedSampleSize = Math.round((value.sample_size * coverage.network_coverage) / 100);
    if (Math.abs(value.classified_sample_size - expectedClassifiedSampleSize) > 1) {
      issues.push(
        `Expected "classified_sample_size" to align with sample_size × coverage.network_coverage (got ${value.classified_sample_size} vs ${expectedClassifiedSampleSize}).`
      );
    }
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

  if (value.v !== SIGNAL_EVENT_VERSION) issues.push(`Expected "v" to be ${SIGNAL_EVENT_VERSION}.`);
  if (!isString(value.event_id)) issues.push('Expected "event_id" to be a string.');
  if (!isNumber(value.ts)) issues.push('Expected "ts" to be a number.');
  if (!isString(value.host)) issues.push('Expected "host" to be a string.');
  if (!isString(value.url)) issues.push('Expected "url" to be a string.');
  if (!isStringOrNull(value.ref)) issues.push('Expected "ref" to be a string or null.');
  if (!(value.net_tier == null || hasEnumValue(VALID_NETWORK_TIERS, value.net_tier))) {
    issues.push('Expected "net_tier" to be a valid network tier or null.');
  }
  if (!isNumberOrNull(value.net_tcp_ms)) issues.push('Expected "net_tcp_ms" to be a number or null.');
  if (!hasEnumValue(VALID_NET_TCP_SOURCES, value.net_tcp_source))
    issues.push('Expected "net_tcp_source" to be a valid network timing source.');
  if (!hasEnumValue(VALID_DEVICE_TIERS, value.device_tier))
    issues.push('Expected "device_tier" to be low, mid, or high.');
  if (!isNumber(value.device_cores)) issues.push('Expected "device_cores" to be a number.');
  if (!isNumberOrNull(value.device_memory_gb)) issues.push('Expected "device_memory_gb" to be a number or null.');
  if (!isNumber(value.device_screen_w)) issues.push('Expected "device_screen_w" to be a number.');
  if (!isNumber(value.device_screen_h)) issues.push('Expected "device_screen_h" to be a number.');
  if (!isSignalVitals(value.vitals))
    issues.push('Expected "vitals" to include numeric vitals and valid attribution objects when present.');
  if (!isSignalContext(value.context))
    issues.push('Expected "context" to include connection fields with number/string/null values.');
  if (!isSignalMeta(value.meta))
    issues.push('Expected "meta" to include pkg_version, browser, nav_type, and a valid optional navigation_type.');

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

  if (value.schema_version !== SIGNAL_EVENT_VERSION)
    issues.push(`Expected "schema_version" to be ${SIGNAL_EVENT_VERSION}.`);
  if (!isString(value.event_id)) issues.push('Expected "event_id" to be a string.');
  if (!isString(value.observed_at)) issues.push('Expected "observed_at" to be an ISO timestamp string.');
  if (!isString(value.host)) issues.push('Expected "host" to be a string.');
  if (!isString(value.path)) issues.push('Expected "path" to be a string.');
  if (!isStringOrNull(value.referrer)) issues.push('Expected "referrer" to be a string or null.');
  if (!(value.net_tier == null || hasEnumValue(VALID_NETWORK_TIERS, value.net_tier)))
    issues.push('Expected "net_tier" to be a valid network tier or null.');
  if (!isNumberOrNull(value.net_tcp_ms)) issues.push('Expected "net_tcp_ms" to be a number or null.');
  if (!hasEnumValue(VALID_NET_TCP_SOURCES, value.net_tcp_source))
    issues.push('Expected "net_tcp_source" to be a valid network timing source.');
  if (!hasEnumValue(VALID_DEVICE_TIERS, value.device_tier))
    issues.push('Expected "device_tier" to be low, mid, or high.');
  if (!isNumber(value.device_cores)) issues.push('Expected "device_cores" to be a number.');
  if (!isNumberOrNull(value.device_memory_gb)) issues.push('Expected "device_memory_gb" to be a number or null.');
  if (!isNumber(value.device_screen_w)) issues.push('Expected "device_screen_w" to be a number.');
  if (!isNumber(value.device_screen_h)) issues.push('Expected "device_screen_h" to be a number.');
  if (!isNumberOrNull(value.lcp_ms)) issues.push('Expected "lcp_ms" to be a number or null.');
  if (!isNumberOrNull(value.cls)) issues.push('Expected "cls" to be a number or null.');
  if (!isNumberOrNull(value.inp_ms)) issues.push('Expected "inp_ms" to be a number or null.');
  if (!isNumberOrNull(value.fcp_ms)) issues.push('Expected "fcp_ms" to be a number or null.');
  if (!isNumberOrNull(value.ttfb_ms)) issues.push('Expected "ttfb_ms" to be a number or null.');
  if (!isStringOrNull(value.effective_type)) issues.push('Expected "effective_type" to be a string or null.');
  if (!isNumberOrNull(value.downlink_mbps)) issues.push('Expected "downlink_mbps" to be a number or null.');
  if (!isNumberOrNull(value.rtt_ms)) issues.push('Expected "rtt_ms" to be a number or null.');
  if (!isBooleanOrNull(value.save_data)) issues.push('Expected "save_data" to be a boolean or null.');
  if (!isStringOrNull(value.connection_type)) issues.push('Expected "connection_type" to be a string or null.');
  if (!isString(value.browser)) issues.push('Expected "browser" to be a string.');
  if (!isString(value.nav_type)) issues.push('Expected "nav_type" to be a string.');
  if (!(value.navigation_type == null || hasEnumValue(VALID_NAVIGATION_TYPES, value.navigation_type)))
    issues.push('Expected "navigation_type" to be a valid navigation type or null.');
  if (!(value.lcp_load_state == null || hasEnumValue(VALID_LOAD_STATES, value.lcp_load_state)))
    issues.push('Expected "lcp_load_state" to be a valid load state or null.');
  if (!isStringOrNull(value.lcp_target)) issues.push('Expected "lcp_target" to be a string or null.');
  if (!(value.lcp_element_type == null || hasEnumValue(VALID_LCP_ELEMENT_TYPES, value.lcp_element_type)))
    issues.push('Expected "lcp_element_type" to be image, text, or null.');
  if (!isStringOrNull(value.lcp_resource_url)) issues.push('Expected "lcp_resource_url" to be a string or null.');
  if (!(value.inp_load_state == null || hasEnumValue(VALID_LOAD_STATES, value.inp_load_state)))
    issues.push('Expected "inp_load_state" to be a valid load state or null.');
  if (!isStringOrNull(value.interaction_target)) issues.push('Expected "interaction_target" to be a string or null.');
  if (!(value.interaction_type == null || hasEnumValue(VALID_INTERACTION_TYPES, value.interaction_type)))
    issues.push('Expected "interaction_type" to be pointer, keyboard, or null.');
  if (!isNumberOrNull(value.interaction_time_ms)) issues.push('Expected "interaction_time_ms" to be a number or null.');
  if (!isNumberOrNull(value.input_delay_ms)) issues.push('Expected "input_delay_ms" to be a number or null.');
  if (!isNumberOrNull(value.processing_duration_ms))
    issues.push('Expected "processing_duration_ms" to be a number or null.');
  if (!isNumberOrNull(value.presentation_delay_ms))
    issues.push('Expected "presentation_delay_ms" to be a number or null.');

  return issues;
}

export function isSignalWarehouseRowV1(value: unknown): value is SignalWarehouseRowV1 {
  return explainSignalWarehouseRowIssues(value).length === 0;
}
