import { deriveSignalAggregateWarnings } from './aggregation.js';
import { explainSignalAggregateIssues, isSignalAggregateV1 } from './guards.js';
import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalContextStory,
  SignalDeviceHardware,
  SignalEffectiveTypeDominant,
  SignalEnvironment,
  SignalExperienceFunnel,
  SignalExperienceStage,
  SignalFormFactorDistribution,
  SignalInpPhase,
  SignalInpStory,
  SignalLcpCulpritKind,
  SignalLcpStory,
  SignalLcpSubpart,
  SignalLoafCause,
  SignalLoafStory,
  SignalNetworkSignals,
  SignalQuartiles,
  SignalRaceFallbackReason,
  SignalRaceMetric,
  SignalReportUrlResult,
  SignalThirdPartyStory,
  SignalThirdPartyTier,
  SignalTierMetricSummary
} from './types.js';
import {
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_BASE_URL,
  SIGNAL_REPORT_URL_HARD_LIMIT_BYTES,
  SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES,
  SIGNAL_REPORT_URL_SOFT_LIMIT_WARNING
} from './types.js';

const VALID_COMPARISON_TIERS = new Set<SignalComparisonTier>([
  'urban',
  'moderate',
  'constrained_moderate',
  'constrained',
  'none'
]);

const VALID_RACE_METRICS = new Set<SignalRaceMetric>(['lcp', 'fcp', 'ttfb', 'none']);
const VALID_EXPERIENCE_STAGES = new Set<SignalExperienceStage>(['fcp', 'lcp', 'inp']);

const VALID_RACE_FALLBACK_REASONS = new Set<SignalRaceFallbackReason>([
  'lcp_coverage_below_threshold',
  'fcp_unavailable',
  'insufficient_comparable_data'
]);

const VALID_LCP_SUBPARTS = new Set<SignalLcpSubpart>([
  'ttfb',
  'resource_load_delay',
  'resource_load_time',
  'element_render_delay'
]);

const VALID_LCP_CULPRIT_KINDS = new Set<SignalLcpCulpritKind>([
  'hero_image',
  'headline_text',
  'banner_image',
  'product_image',
  'video_poster',
  'unknown'
]);

const VALID_INP_PHASES = new Set<SignalInpPhase>(['input_delay', 'processing', 'presentation']);

const VALID_THIRD_PARTY_TIERS = new Set<SignalThirdPartyTier>(['none', 'light', 'moderate', 'heavy']);

const VALID_LOAF_CAUSES = new Set<SignalLoafCause>(['script', 'layout', 'style', 'paint']);

const VALID_EFFECTIVE_TYPE_DOMINANT = new Set<SignalEffectiveTypeDominant>(['4g', '3g', '2g', 'slow-2g', 'unknown']);

export const SIGNAL_FRESHNESS_UNKNOWN_WARNING =
  'Report generation timestamp is unknown — this link predates freshness tracking.';

function joinInts(values: number[]): string {
  return values.map((value) => Math.round(Number.isFinite(value) ? value : 0)).join(',');
}

function parseInts(value: string | null, expectedLength: number): number[] {
  const parts = (value ?? '').split(',').map((item) => Number(item));
  if (parts.length !== expectedLength || parts.some((item) => !Number.isFinite(item))) {
    throw new Error(`Invalid encoded integer tuple: ${value ?? 'null'}`);
  }
  return parts;
}

function joinDecimals(values: number[]): string {
  return values
    .map((value) => {
      const safe = Number.isFinite(value) ? value : 0;
      return (Math.round(safe * 10) / 10).toFixed(1);
    })
    .join(',');
}

function parseDecimals(value: string | null, expectedLength: number): number[] | null {
  if (value == null || value === '') return null;
  const parts = value.split(',').map((item) => Number(item));
  if (parts.length !== expectedLength || parts.some((item) => !Number.isFinite(item))) {
    throw new Error(`Invalid encoded decimal tuple: ${value}`);
  }
  return parts;
}

function encodeStages(stages: SignalExperienceStage[]): string {
  return stages.join(',');
}

function parseStages(value: string | null): SignalExperienceStage[] {
  if (value == null) {
    throw new Error('Missing encoded experience funnel stages.');
  }

  if (!value) return [];

  return value.split(',').map((stage) => {
    if (!VALID_EXPERIENCE_STAGES.has(stage as SignalExperienceStage)) {
      throw new Error(`Invalid encoded experience stage: ${stage}`);
    }
    return stage as SignalExperienceStage;
  });
}

function metricValue(summary: SignalTierMetricSummary, key: 'lcp_ms' | 'fcp_ms' | 'ttfb_ms'): string {
  return summary[key] == null ? '0' : String(summary[key]);
}

function encodeExperienceFunnel(params: URLSearchParams, funnel: SignalExperienceFunnel): void {
  params.set('es', encodeStages(funnel.active_stages));
  params.set('ec', String(funnel.measured_session_coverage));
  params.set('ep', String(funnel.poor_session_share));
  params.set('fpt', String(funnel.stages.fcp.poor_threshold_ms));
  params.set('lpt', String(funnel.stages.lcp.poor_threshold_ms));
  params.set('ipt', String(funnel.stages.inp.poor_threshold_ms));
  params.set(
    'fcs',
    joinInts([
      funnel.stages.fcp.tiers.urban.coverage,
      funnel.stages.fcp.tiers.moderate.coverage,
      funnel.stages.fcp.tiers.constrained_moderate.coverage,
      funnel.stages.fcp.tiers.constrained.coverage
    ])
  );
  params.set(
    'fps',
    joinInts([
      funnel.stages.fcp.tiers.urban.poor_share,
      funnel.stages.fcp.tiers.moderate.poor_share,
      funnel.stages.fcp.tiers.constrained_moderate.poor_share,
      funnel.stages.fcp.tiers.constrained.poor_share
    ])
  );
  params.set(
    'lcs',
    joinInts([
      funnel.stages.lcp.tiers.urban.coverage,
      funnel.stages.lcp.tiers.moderate.coverage,
      funnel.stages.lcp.tiers.constrained_moderate.coverage,
      funnel.stages.lcp.tiers.constrained.coverage
    ])
  );
  params.set(
    'lps',
    joinInts([
      funnel.stages.lcp.tiers.urban.poor_share,
      funnel.stages.lcp.tiers.moderate.poor_share,
      funnel.stages.lcp.tiers.constrained_moderate.poor_share,
      funnel.stages.lcp.tiers.constrained.poor_share
    ])
  );
  params.set(
    'ics',
    joinInts([
      funnel.stages.inp.tiers.urban.coverage,
      funnel.stages.inp.tiers.moderate.coverage,
      funnel.stages.inp.tiers.constrained_moderate.coverage,
      funnel.stages.inp.tiers.constrained.coverage
    ])
  );
  params.set(
    'ips',
    joinInts([
      funnel.stages.inp.tiers.urban.poor_share,
      funnel.stages.inp.tiers.moderate.poor_share,
      funnel.stages.inp.tiers.constrained_moderate.poor_share,
      funnel.stages.inp.tiers.constrained.poor_share
    ])
  );
}

function encodeDeviceHardware(params: URLSearchParams, hardware: SignalDeviceHardware): void {
  params.set(
    'dhc',
    joinInts([
      hardware.cores_hist['1'],
      hardware.cores_hist['2'],
      hardware.cores_hist['4'],
      hardware.cores_hist['6'],
      hardware.cores_hist['8'],
      hardware.cores_hist['12_plus']
    ])
  );
  params.set(
    'dhm',
    joinInts([
      hardware.memory_gb_hist['0_5'],
      hardware.memory_gb_hist['1'],
      hardware.memory_gb_hist['2'],
      hardware.memory_gb_hist['4'],
      hardware.memory_gb_hist['8_plus'],
      hardware.memory_gb_hist.unknown
    ])
  );
  params.set('dhv', String(hardware.memory_coverage));
}

function encodeNetworkSignals(params: URLSearchParams, signals: SignalNetworkSignals): void {
  params.set(
    'nse',
    joinInts([
      signals.effective_type_hist.slow_2g,
      signals.effective_type_hist['2g'],
      signals.effective_type_hist['3g'],
      signals.effective_type_hist['4g'],
      signals.effective_type_hist.unknown
    ])
  );
  params.set('nsv', String(signals.effective_type_coverage));
  params.set('nsd', String(signals.save_data_share));
  if (signals.downlink_mbps) {
    params.set('nsl', joinDecimals([signals.downlink_mbps.p25, signals.downlink_mbps.p50, signals.downlink_mbps.p75]));
  }
  if (signals.rtt_ms) {
    params.set('nsr', joinInts([signals.rtt_ms.p25, signals.rtt_ms.p50, signals.rtt_ms.p75]));
  }
}

function encodeLcpStory(params: URLSearchParams, story: SignalLcpStory): void {
  if (story.subpart_distribution_pct) {
    params.set(
      'lss',
      joinInts([
        story.subpart_distribution_pct.ttfb,
        story.subpart_distribution_pct.resource_load_delay,
        story.subpart_distribution_pct.resource_load_time,
        story.subpart_distribution_pct.element_render_delay
      ])
    );
  }
  if (story.dominant_subpart) params.set('lsd', story.dominant_subpart);
  if (story.dominant_subpart_share_pct != null) params.set('lsr', String(story.dominant_subpart_share_pct));
  if (story.dominant_culprit_kind) params.set('lsc', story.dominant_culprit_kind);
}

function encodeInpStory(params: URLSearchParams, story: SignalInpStory): void {
  if (story.phase_distribution_pct) {
    params.set(
      'isp',
      joinInts([
        story.phase_distribution_pct.input_delay,
        story.phase_distribution_pct.processing,
        story.phase_distribution_pct.presentation
      ])
    );
  }
  if (story.dominant_phase) params.set('isd', story.dominant_phase);
  if (story.dominant_phase_share_pct != null) params.set('isr', String(story.dominant_phase_share_pct));
}

function encodeThirdPartyStory(params: URLSearchParams, story: SignalThirdPartyStory): void {
  if (story.median_share_pct != null) params.set('tps', String(story.median_share_pct));
  if (story.dominant_tier) params.set('tpt', story.dominant_tier);
  if (story.dominant_tier_share_pct != null) params.set('tpr', String(story.dominant_tier_share_pct));
  if (story.median_origin_count != null) params.set('tpo', String(story.median_origin_count));
}

function encodeLoafStory(params: URLSearchParams, story: SignalLoafStory): void {
  if (story.dominant_cause) params.set('lfd', story.dominant_cause);
  if (story.dominant_cause_share_pct != null) params.set('lfr', String(story.dominant_cause_share_pct));
  if (story.worst_frame_ms_p75 != null) params.set('lfw', String(story.worst_frame_ms_p75));
}

function encodeContextStory(params: URLSearchParams, story: SignalContextStory): void {
  if (story.save_data_share_pct != null) params.set('csd', String(story.save_data_share_pct));
  if (story.median_rtt_ms != null) params.set('cmr', String(story.median_rtt_ms));
  if (story.cellular_share_pct != null) params.set('ccs', String(story.cellular_share_pct));
  if (story.effective_type_dominant) params.set('cet', story.effective_type_dominant);
}

function encodeEnvironment(params: URLSearchParams, env: SignalEnvironment): void {
  params.set(
    'eb',
    joinInts([
      env.browser_hist.chrome,
      env.browser_hist.safari,
      env.browser_hist.firefox,
      env.browser_hist.edge,
      env.browser_hist.other
    ])
  );
}

// Top-level encode/decode pairs. Each pair owns one block of the aggregate
// shape and is colocated so a contract change has one place to update both
// sides. Histograms use exhaustive tuple destructuring — `parseInts` already
// throws on length mismatch, so the previous `?? 0` defaults were unreachable
// and have been removed.

function encodeNetworkDistribution(params: URLSearchParams, dist: SignalAggregateV1['network_distribution']): void {
  params.set('nt', joinInts([dist.urban, dist.moderate, dist.constrained_moderate, dist.constrained, dist.unknown]));
}

function decodeNetworkDistribution(params: URLSearchParams): SignalAggregateV1['network_distribution'] {
  const [urban, moderate, constrained_moderate, constrained, unknown] = parseInts(params.get('nt'), 5) as [
    number,
    number,
    number,
    number,
    number
  ];
  return { urban, moderate, constrained_moderate, constrained, unknown };
}

function encodeDeviceDistribution(params: URLSearchParams, dist: SignalAggregateV1['device_distribution']): void {
  params.set('dt', joinInts([dist.low, dist.mid, dist.high]));
}

function decodeDeviceDistribution(params: URLSearchParams): SignalAggregateV1['device_distribution'] {
  const [low, mid, high] = parseInts(params.get('dt'), 3) as [number, number, number];
  return { low, mid, high };
}

function encodeVitals(params: URLSearchParams, vitals: SignalAggregateV1['vitals']): void {
  params.set('lu', metricValue(vitals.urban, 'lcp_ms'));
  params.set('lt', metricValue(vitals.comparison, 'lcp_ms'));
  params.set('fu', metricValue(vitals.urban, 'fcp_ms'));
  params.set('ft', metricValue(vitals.comparison, 'fcp_ms'));
  params.set('tu', metricValue(vitals.urban, 'ttfb_ms'));
  params.set('tt', metricValue(vitals.comparison, 'ttfb_ms'));
  params.set('ulc', String(vitals.urban.lcp_coverage));
  params.set('ufc', String(vitals.urban.fcp_coverage));
  params.set('utc', String(vitals.urban.ttfb_coverage));
  params.set('clc', String(vitals.comparison.lcp_coverage));
  params.set('cfc', String(vitals.comparison.fcp_coverage));
  params.set('ctc', String(vitals.comparison.ttfb_coverage));
}

function decodeVitals(params: URLSearchParams): SignalAggregateV1['vitals'] {
  return {
    urban: toMetricSummary({
      observations: 0,
      lcp_observations: 0,
      fcp_observations: 0,
      ttfb_observations: 0,
      lcp_ms: readNumberParam(params, 'lu') || null,
      fcp_ms: readNumberParam(params, 'fu') || null,
      ttfb_ms: readNumberParam(params, 'tu') || null,
      lcp_coverage: readNumberParam(params, 'ulc'),
      fcp_coverage: readNumberParam(params, 'ufc'),
      ttfb_coverage: readNumberParam(params, 'utc')
    }),
    comparison: toMetricSummary({
      observations: 0,
      lcp_observations: 0,
      fcp_observations: 0,
      ttfb_observations: 0,
      lcp_ms: readNumberParam(params, 'lt') || null,
      fcp_ms: readNumberParam(params, 'ft') || null,
      ttfb_ms: readNumberParam(params, 'tt') || null,
      lcp_coverage: readNumberParam(params, 'clc'),
      fcp_coverage: readNumberParam(params, 'cfc'),
      ttfb_coverage: readNumberParam(params, 'ctc')
    })
  };
}

function encodeCoverage(params: URLSearchParams, coverage: SignalAggregateV1['coverage']): void {
  params.set('nc', String(coverage.network_coverage));
  params.set('nu', String(coverage.unclassified_network_share));
  params.set('nr', String(coverage.connection_reuse_share));
  params.set('lc', String(coverage.lcp_coverage));
  if (coverage.selected_metric_urban_coverage != null) {
    params.set('ruc', String(coverage.selected_metric_urban_coverage));
  }
  if (coverage.selected_metric_comparison_coverage != null) {
    params.set('rcc', String(coverage.selected_metric_comparison_coverage));
  }
  // Denominator bookkeeping. Emit only when present so older aggregates
  // (without raw / excluded counts) round-trip unchanged.
  if (coverage.raw_sample_size != null) {
    params.set('rs', String(coverage.raw_sample_size));
  }
  if (coverage.excluded_background_sessions != null) {
    params.set('xb', String(coverage.excluded_background_sessions));
  }
}

function decodeCoverage(params: URLSearchParams, networkCoverage: number): SignalAggregateV1['coverage'] {
  return {
    network_coverage: networkCoverage,
    unclassified_network_share: readNumberParam(params, 'nu'),
    connection_reuse_share: readNumberParam(params, 'nr'),
    lcp_coverage: readNumberParam(params, 'lc'),
    selected_metric_urban_coverage: params.get('ruc') == null ? null : readNumberParam(params, 'ruc'),
    selected_metric_comparison_coverage: params.get('rcc') == null ? null : readNumberParam(params, 'rcc'),
    ...(params.get('rs') == null ? {} : { raw_sample_size: readNumberParam(params, 'rs') }),
    ...(params.get('xb') == null ? {} : { excluded_background_sessions: readNumberParam(params, 'xb') })
  };
}

function encodeFormFactor(params: URLSearchParams, ff: SignalFormFactorDistribution): void {
  params.set('ff', joinInts([ff.mobile, ff.tablet, ff.desktop]));
}

function encodeAggregate(aggregate: SignalAggregateV1): URLSearchParams {
  const params = new URLSearchParams();

  // Identity + provenance
  params.set('rv', String(aggregate.rv));
  params.set('mode', aggregate.mode);
  params.set('d', aggregate.domain);
  params.set('s', String(aggregate.sample_size));
  params.set('p', String(aggregate.period_days));
  params.set('ga', String(aggregate.generated_at));

  // Distributions
  encodeNetworkDistribution(params, aggregate.network_distribution);
  encodeDeviceDistribution(params, aggregate.device_distribution);

  // Per-tier vitals + coverage
  encodeVitals(params, aggregate.vitals);
  encodeCoverage(params, aggregate.coverage);

  // Race classification
  params.set('ct', aggregate.comparison_tier);
  params.set('rm', aggregate.race_metric);
  if (aggregate.race_fallback_reason) params.set('rr', aggregate.race_fallback_reason);

  // Additive optional blocks
  if (aggregate.experience_funnel) encodeExperienceFunnel(params, aggregate.experience_funnel);
  if (aggregate.device_hardware) encodeDeviceHardware(params, aggregate.device_hardware);
  if (aggregate.network_signals) encodeNetworkSignals(params, aggregate.network_signals);
  if (aggregate.environment) encodeEnvironment(params, aggregate.environment);
  if (aggregate.form_factor_distribution) encodeFormFactor(params, aggregate.form_factor_distribution);
  if (aggregate.lcp_story) encodeLcpStory(params, aggregate.lcp_story);
  if (aggregate.inp_story) encodeInpStory(params, aggregate.inp_story);
  if (aggregate.third_party_story) encodeThirdPartyStory(params, aggregate.third_party_story);
  if (aggregate.loaf_story) encodeLoafStory(params, aggregate.loaf_story);
  if (aggregate.context_story) encodeContextStory(params, aggregate.context_story);

  if (aggregate.top_page_path) params.set('v', aggregate.top_page_path);

  return params;
}

function measureByteLength(text: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : Buffer.byteLength(text, 'utf8');
}

export function encodeSignalReportUrl(
  aggregate: SignalAggregateV1,
  baseUrl = SIGNAL_REPORT_BASE_URL
): SignalReportUrlResult {
  if (!isSignalAggregateV1(aggregate)) {
    throw new Error('encodeSignalReportUrl expected a valid SignalAggregateV1 object.');
  }

  const params = encodeAggregate(aggregate);
  const url = `${baseUrl}?${params.toString()}`;

  // URL-size budget. Hard breach throws — a silently-truncated URL
  // would fail at the proxy/browser layer with no useful error. Soft
  // breach stays emittable but surfaces a warning the caller can log.
  const urlByteLength = measureByteLength(url);
  const warnings = [...aggregate.warnings];
  if (urlByteLength >= SIGNAL_REPORT_URL_HARD_LIMIT_BYTES) {
    throw new Error(
      `encodeSignalReportUrl produced a ${urlByteLength}-byte URL exceeding the ${SIGNAL_REPORT_URL_HARD_LIMIT_BYTES}-byte hard limit.`
    );
  }
  if (urlByteLength >= SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES) {
    warnings.push(`${SIGNAL_REPORT_URL_SOFT_LIMIT_WARNING}:${urlByteLength}`);
  }

  return {
    url,
    aggregate,
    warnings,
    sampleSize: aggregate.sample_size,
    meetsRecommendation: aggregate.sample_size >= SIGNAL_PREVIEW_MINIMUM_SAMPLE,
    mode: aggregate.mode
  };
}

function toMetricSummary(values: {
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
}): SignalTierMetricSummary {
  return values;
}

function readNumberParam(params: URLSearchParams, key: string, fallback = 0): number {
  const raw = params.get(key);
  if (raw == null) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for parameter "${key}": ${raw}`);
  }
  return parsed;
}

function readRequiredNumberParam(params: URLSearchParams, key: string): number {
  const raw = params.get(key);
  if (raw == null) {
    throw new Error(`Missing required report URL parameter: "${key}".`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for required parameter "${key}": ${raw}`);
  }
  return parsed;
}

function readEnumParam<T extends string>(params: URLSearchParams, key: string, validValues: Set<T>, fallback: T): T {
  const raw = params.get(key);
  if (raw == null) return fallback;
  if (!validValues.has(raw as T)) {
    throw new Error(`Invalid encoded enum value for "${key}": ${raw}`);
  }
  return raw as T;
}

function readOptionalEnumParam<T extends string>(params: URLSearchParams, key: string, validValues: Set<T>): T | null {
  const raw = params.get(key);
  if (raw == null) return null;
  if (!validValues.has(raw as T)) {
    throw new Error(`Invalid encoded enum value for "${key}": ${raw}`);
  }
  return raw as T;
}

function readOptionalExperienceFunnel(params: URLSearchParams): SignalExperienceFunnel | undefined {
  if (params.get('es') == null) return undefined;

  const activeStages = parseStages(params.get('es'));
  const fcpCoverage = parseInts(params.get('fcs'), 4);
  const fcpPoor = parseInts(params.get('fps'), 4);
  const lcpCoverage = parseInts(params.get('lcs'), 4);
  const lcpPoor = parseInts(params.get('lps'), 4);
  const inpCoverage = parseInts(params.get('ics'), 4);
  const inpPoor = parseInts(params.get('ips'), 4);

  return {
    active_stages: activeStages,
    measured_session_coverage: readNumberParam(params, 'ec'),
    poor_session_share: readNumberParam(params, 'ep'),
    stages: {
      fcp: {
        poor_threshold_ms: readNumberParam(params, 'fpt', SIGNAL_FUNNEL_FCP_POOR_THRESHOLD),
        tiers: {
          urban: { coverage: fcpCoverage[0] ?? 0, poor_share: fcpPoor[0] ?? 0 },
          moderate: { coverage: fcpCoverage[1] ?? 0, poor_share: fcpPoor[1] ?? 0 },
          constrained_moderate: { coverage: fcpCoverage[2] ?? 0, poor_share: fcpPoor[2] ?? 0 },
          constrained: { coverage: fcpCoverage[3] ?? 0, poor_share: fcpPoor[3] ?? 0 }
        }
      },
      lcp: {
        poor_threshold_ms: readNumberParam(params, 'lpt', SIGNAL_FUNNEL_LCP_POOR_THRESHOLD),
        tiers: {
          urban: { coverage: lcpCoverage[0] ?? 0, poor_share: lcpPoor[0] ?? 0 },
          moderate: { coverage: lcpCoverage[1] ?? 0, poor_share: lcpPoor[1] ?? 0 },
          constrained_moderate: { coverage: lcpCoverage[2] ?? 0, poor_share: lcpPoor[2] ?? 0 },
          constrained: { coverage: lcpCoverage[3] ?? 0, poor_share: lcpPoor[3] ?? 0 }
        }
      },
      inp: {
        poor_threshold_ms: readNumberParam(params, 'ipt', SIGNAL_FUNNEL_INP_POOR_THRESHOLD),
        tiers: {
          urban: { coverage: inpCoverage[0] ?? 0, poor_share: inpPoor[0] ?? 0 },
          moderate: { coverage: inpCoverage[1] ?? 0, poor_share: inpPoor[1] ?? 0 },
          constrained_moderate: { coverage: inpCoverage[2] ?? 0, poor_share: inpPoor[2] ?? 0 },
          constrained: { coverage: inpCoverage[3] ?? 0, poor_share: inpPoor[3] ?? 0 }
        }
      }
    }
  };
}

function readOptionalDeviceHardware(params: URLSearchParams): SignalDeviceHardware | undefined {
  if (params.get('dhc') == null) return undefined;
  // `parseInts` validates length === 6 and finiteness — destructure
  // exhaustively instead of indexing with `?? 0` defaults that can
  // never fire.
  const [c1, c2, c4, c6, c8, c12] = parseInts(params.get('dhc'), 6) as [number, number, number, number, number, number];
  const [m05, m1, m2, m4, m8, mUnknown] = parseInts(params.get('dhm'), 6) as [
    number,
    number,
    number,
    number,
    number,
    number
  ];
  return {
    cores_hist: { '1': c1, '2': c2, '4': c4, '6': c6, '8': c8, '12_plus': c12 },
    memory_gb_hist: { '0_5': m05, '1': m1, '2': m2, '4': m4, '8_plus': m8, unknown: mUnknown },
    memory_coverage: readNumberParam(params, 'dhv')
  };
}

function readOptionalNetworkSignals(params: URLSearchParams): SignalNetworkSignals | undefined {
  if (params.get('nse') == null) return undefined;
  const [eSlow2g, e2g, e3g, e4g, eUnknown] = parseInts(params.get('nse'), 5) as [
    number,
    number,
    number,
    number,
    number
  ];
  const downlinkRaw = parseDecimals(params.get('nsl'), 3) as [number, number, number] | null;
  const nsrValue = params.get('nsr');
  const rttRaw = nsrValue == null || nsrValue === '' ? null : (parseInts(nsrValue, 3) as [number, number, number]);
  const downlink: SignalQuartiles | null = downlinkRaw
    ? { p25: downlinkRaw[0], p50: downlinkRaw[1], p75: downlinkRaw[2] }
    : null;
  const rtt: SignalQuartiles | null = rttRaw ? { p25: rttRaw[0], p50: rttRaw[1], p75: rttRaw[2] } : null;
  return {
    effective_type_hist: { slow_2g: eSlow2g, '2g': e2g, '3g': e3g, '4g': e4g, unknown: eUnknown },
    effective_type_coverage: readNumberParam(params, 'nsv'),
    save_data_share: readNumberParam(params, 'nsd'),
    downlink_mbps: downlink,
    rtt_ms: rtt
  };
}

function readOptionalEnvironment(params: URLSearchParams): SignalEnvironment | undefined {
  if (params.get('eb') == null) return undefined;
  const [chrome, safari, firefox, edge, other] = parseInts(params.get('eb'), 5) as [
    number,
    number,
    number,
    number,
    number
  ];
  return { browser_hist: { chrome, safari, firefox, edge, other } };
}

function readOptionalLcpStory(params: URLSearchParams): SignalLcpStory | undefined {
  const raw = params.get('lss');
  const dominant = params.get('lsd');
  const dominantShare = params.get('lsr');
  const culprit = params.get('lsc');
  if (raw == null && dominant == null && dominantShare == null && culprit == null) return undefined;

  let distribution: SignalLcpStory['subpart_distribution_pct'] = null;
  if (raw != null) {
    const parts = parseInts(raw, 4);
    distribution = {
      ttfb: parts[0] ?? 0,
      resource_load_delay: parts[1] ?? 0,
      resource_load_time: parts[2] ?? 0,
      element_render_delay: parts[3] ?? 0
    };
  }

  let dominantSubpart: SignalLcpSubpart | null = null;
  if (dominant != null) {
    if (!VALID_LCP_SUBPARTS.has(dominant as SignalLcpSubpart)) {
      throw new Error(`Invalid encoded enum value for "lsd": ${dominant}`);
    }
    dominantSubpart = dominant as SignalLcpSubpart;
  }

  let culpritKind: SignalLcpCulpritKind | null = null;
  if (culprit != null) {
    if (!VALID_LCP_CULPRIT_KINDS.has(culprit as SignalLcpCulpritKind)) {
      throw new Error(`Invalid encoded enum value for "lsc": ${culprit}`);
    }
    culpritKind = culprit as SignalLcpCulpritKind;
  }

  return {
    dominant_subpart: dominantSubpart,
    dominant_subpart_share_pct: dominantShare == null ? null : readNumberParam(params, 'lsr'),
    dominant_culprit_kind: culpritKind,
    subpart_distribution_pct: distribution
  };
}

function readOptionalInpStory(params: URLSearchParams): SignalInpStory | undefined {
  const raw = params.get('isp');
  const dominant = params.get('isd');
  const dominantShare = params.get('isr');
  if (raw == null && dominant == null && dominantShare == null) return undefined;

  let distribution: SignalInpStory['phase_distribution_pct'] = null;
  if (raw != null) {
    const parts = parseInts(raw, 3);
    distribution = {
      input_delay: parts[0] ?? 0,
      processing: parts[1] ?? 0,
      presentation: parts[2] ?? 0
    };
  }

  let dominantPhase: SignalInpPhase | null = null;
  if (dominant != null) {
    if (!VALID_INP_PHASES.has(dominant as SignalInpPhase)) {
      throw new Error(`Invalid encoded enum value for "isd": ${dominant}`);
    }
    dominantPhase = dominant as SignalInpPhase;
  }

  return {
    dominant_phase: dominantPhase,
    dominant_phase_share_pct: dominantShare == null ? null : readNumberParam(params, 'isr'),
    phase_distribution_pct: distribution
  };
}

function readOptionalThirdPartyStory(params: URLSearchParams): SignalThirdPartyStory | undefined {
  const shareRaw = params.get('tps');
  const tierRaw = params.get('tpt');
  const tierShareRaw = params.get('tpr');
  const originRaw = params.get('tpo');
  if (shareRaw == null && tierRaw == null && tierShareRaw == null && originRaw == null) return undefined;

  let dominantTier: SignalThirdPartyTier | null = null;
  if (tierRaw != null) {
    if (!VALID_THIRD_PARTY_TIERS.has(tierRaw as SignalThirdPartyTier)) {
      throw new Error(`Invalid encoded enum value for "tpt": ${tierRaw}`);
    }
    dominantTier = tierRaw as SignalThirdPartyTier;
  }

  return {
    median_share_pct: shareRaw == null ? null : readNumberParam(params, 'tps'),
    dominant_tier: dominantTier,
    dominant_tier_share_pct: tierShareRaw == null ? null : readNumberParam(params, 'tpr'),
    median_origin_count: originRaw == null ? null : readNumberParam(params, 'tpo')
  };
}

function readOptionalLoafStory(params: URLSearchParams): SignalLoafStory | undefined {
  const causeRaw = params.get('lfd');
  const shareRaw = params.get('lfr');
  const worstRaw = params.get('lfw');
  if (causeRaw == null && shareRaw == null && worstRaw == null) return undefined;

  let dominantCause: SignalLoafCause | null = null;
  if (causeRaw != null) {
    if (!VALID_LOAF_CAUSES.has(causeRaw as SignalLoafCause)) {
      throw new Error(`Invalid encoded enum value for "lfd": ${causeRaw}`);
    }
    dominantCause = causeRaw as SignalLoafCause;
  }

  return {
    dominant_cause: dominantCause,
    dominant_cause_share_pct: shareRaw == null ? null : readNumberParam(params, 'lfr'),
    worst_frame_ms_p75: worstRaw == null ? null : readNumberParam(params, 'lfw')
  };
}

function readOptionalContextStory(params: URLSearchParams): SignalContextStory | undefined {
  const saveRaw = params.get('csd');
  const rttRaw = params.get('cmr');
  const cellRaw = params.get('ccs');
  const effRaw = params.get('cet');
  if (saveRaw == null && rttRaw == null && cellRaw == null && effRaw == null) return undefined;

  let effectiveDominant: SignalEffectiveTypeDominant | null = null;
  if (effRaw != null) {
    if (!VALID_EFFECTIVE_TYPE_DOMINANT.has(effRaw as SignalEffectiveTypeDominant)) {
      throw new Error(`Invalid encoded enum value for "cet": ${effRaw}`);
    }
    effectiveDominant = effRaw as SignalEffectiveTypeDominant;
  }

  return {
    save_data_share_pct: saveRaw == null ? null : readNumberParam(params, 'csd'),
    median_rtt_ms: rttRaw == null ? null : readNumberParam(params, 'cmr'),
    cellular_share_pct: cellRaw == null ? null : readNumberParam(params, 'ccs'),
    effective_type_dominant: effectiveDominant
  };
}

function readOptionalFormFactor(params: URLSearchParams): SignalFormFactorDistribution | undefined {
  if (params.get('ff') == null) return undefined;
  const [mobile, tablet, desktop] = parseInts(params.get('ff'), 3) as [number, number, number];
  return { mobile, tablet, desktop };
}

export function decodeSignalReportUrl(value: string | URL): SignalAggregateV1 {
  const url = typeof value === 'string' ? new URL(value) : value;
  const params = url.searchParams;

  // Validate the integer-tuple distributions FIRST so a malformed `nt`
  // surfaces a clear "Invalid encoded integer tuple" error before any
  // missing-required-scalar throws. Order is observable contract
  // (e2e tests assert on the message of the first thrown error for
  // hostile URLs) — keep these two probes ahead of `s` / `nc` / `p`.
  const networkDistribution = decodeNetworkDistribution(params);
  const deviceDistribution = decodeDeviceDistribution(params);

  // Required scalars
  const sampleSize = readRequiredNumberParam(params, 's');
  const networkCoverage = readRequiredNumberParam(params, 'nc');
  const periodDays = readRequiredNumberParam(params, 'p');

  // Race classification (closed enums)
  const comparisonTier = readEnumParam(params, 'ct', VALID_COMPARISON_TIERS, 'none');
  const raceMetric = readEnumParam(params, 'rm', VALID_RACE_METRICS, 'none');
  const raceFallbackReason = readOptionalEnumParam(params, 'rr', VALID_RACE_FALLBACK_REASONS);

  // Semantic validation — short-circuit before assembling the rest of the
  // object so error messages name the original cause.
  if (sampleSize < 0) throw new Error('Invalid report URL: sample size cannot be negative.');
  if (periodDays < 0) throw new Error('Invalid report URL: period days cannot be negative.');
  if (raceMetric !== 'none' && comparisonTier === 'none') {
    throw new Error(`Invalid report URL: race metric is "${raceMetric}" but comparison tier is "none".`);
  }
  if (raceFallbackReason != null && raceMetric === 'lcp') {
    throw new Error('Invalid report URL: primary LCP race should not have a fallback reason.');
  }

  // Freshness + warnings derivation
  const gaRaw = params.get('ga');
  const generatedAt = gaRaw != null ? readRequiredNumberParam(params, 'ga') : 0;
  const mode: SignalAggregateV1['mode'] = params.get('mode') === 'production' ? 'production' : 'preview';
  const warnings = deriveSignalAggregateWarnings({ mode, sample_size: sampleSize, race_metric: raceMetric });
  if (!generatedAt) {
    warnings.push(SIGNAL_FRESHNESS_UNKNOWN_WARNING);
  }

  const aggregate: SignalAggregateV1 = {
    v: 1,
    rv: 1,
    mode,
    generated_at: generatedAt || Date.now(),
    domain: params.get('d') ?? 'unknown.local',
    sample_size: sampleSize,
    classified_sample_size: Math.round((sampleSize * networkCoverage) / 100),
    period_days: periodDays,
    network_distribution: networkDistribution,
    device_distribution: deviceDistribution,
    comparison_tier: comparisonTier,
    race_metric: raceMetric,
    race_fallback_reason: raceFallbackReason,
    coverage: decodeCoverage(params, networkCoverage),
    vitals: decodeVitals(params),
    experience_funnel: readOptionalExperienceFunnel(params),
    device_hardware: readOptionalDeviceHardware(params),
    network_signals: readOptionalNetworkSignals(params),
    environment: readOptionalEnvironment(params),
    form_factor_distribution: readOptionalFormFactor(params),
    lcp_story: readOptionalLcpStory(params),
    inp_story: readOptionalInpStory(params),
    third_party_story: readOptionalThirdPartyStory(params),
    loaf_story: readOptionalLoafStory(params),
    context_story: readOptionalContextStory(params),
    top_page_path: params.get('v'),
    warnings
  };

  const issues = explainSignalAggregateIssues(aggregate);
  if (issues.length > 0) {
    throw new Error(`Invalid report URL: ${issues[0]}`);
  }

  return aggregate;
}
