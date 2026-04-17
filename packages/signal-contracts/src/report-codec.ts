import { deriveSignalAggregateWarnings } from './aggregation.js';
import { explainSignalAggregateIssues, isSignalAggregateV1 } from './guards.js';
import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalDeviceHardware,
  SignalEnvironment,
  SignalExperienceFunnel,
  SignalExperienceStage,
  SignalFormFactorDistribution,
  SignalNetworkSignals,
  SignalQuartiles,
  SignalRaceFallbackReason,
  SignalRaceMetric,
  SignalReportUrlResult,
  SignalTierMetricSummary
} from './types.js';
import {
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_BASE_URL
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

function encodeAggregate(aggregate: SignalAggregateV1): URLSearchParams {
  const params = new URLSearchParams();
  params.set('rv', String(aggregate.rv));
  params.set('mode', aggregate.mode);
  params.set('d', aggregate.domain);
  params.set(
    'nt',
    joinInts([
      aggregate.network_distribution.urban,
      aggregate.network_distribution.moderate,
      aggregate.network_distribution.constrained_moderate,
      aggregate.network_distribution.constrained,
      aggregate.network_distribution.unknown
    ])
  );
  params.set(
    'dt',
    joinInts([aggregate.device_distribution.low, aggregate.device_distribution.mid, aggregate.device_distribution.high])
  );
  params.set('lu', metricValue(aggregate.vitals.urban, 'lcp_ms'));
  params.set('lt', metricValue(aggregate.vitals.comparison, 'lcp_ms'));
  params.set('fu', metricValue(aggregate.vitals.urban, 'fcp_ms'));
  params.set('ft', metricValue(aggregate.vitals.comparison, 'fcp_ms'));
  params.set('tu', metricValue(aggregate.vitals.urban, 'ttfb_ms'));
  params.set('tt', metricValue(aggregate.vitals.comparison, 'ttfb_ms'));
  params.set('ulc', String(aggregate.vitals.urban.lcp_coverage));
  params.set('ufc', String(aggregate.vitals.urban.fcp_coverage));
  params.set('utc', String(aggregate.vitals.urban.ttfb_coverage));
  params.set('clc', String(aggregate.vitals.comparison.lcp_coverage));
  params.set('cfc', String(aggregate.vitals.comparison.fcp_coverage));
  params.set('ctc', String(aggregate.vitals.comparison.ttfb_coverage));
  params.set('s', String(aggregate.sample_size));
  params.set('p', String(aggregate.period_days));
  params.set('nc', String(aggregate.coverage.network_coverage));
  params.set('nu', String(aggregate.coverage.unclassified_network_share));
  params.set('nr', String(aggregate.coverage.connection_reuse_share));
  params.set('lc', String(aggregate.coverage.lcp_coverage));
  params.set('ct', aggregate.comparison_tier);
  params.set('rm', aggregate.race_metric);
  if (aggregate.race_fallback_reason) params.set('rr', aggregate.race_fallback_reason);
  if (aggregate.coverage.selected_metric_urban_coverage != null) {
    params.set('ruc', String(aggregate.coverage.selected_metric_urban_coverage));
  }
  if (aggregate.coverage.selected_metric_comparison_coverage != null) {
    params.set('rcc', String(aggregate.coverage.selected_metric_comparison_coverage));
  }
  if (aggregate.experience_funnel) {
    encodeExperienceFunnel(params, aggregate.experience_funnel);
  }
  if (aggregate.device_hardware) {
    encodeDeviceHardware(params, aggregate.device_hardware);
  }
  if (aggregate.network_signals) {
    encodeNetworkSignals(params, aggregate.network_signals);
  }
  if (aggregate.environment) {
    encodeEnvironment(params, aggregate.environment);
  }
  if (aggregate.form_factor_distribution) {
    params.set(
      'ff',
      joinInts([
        aggregate.form_factor_distribution.mobile,
        aggregate.form_factor_distribution.tablet,
        aggregate.form_factor_distribution.desktop
      ])
    );
  }
  if (aggregate.top_page_path) params.set('v', aggregate.top_page_path);
  params.set('ga', String(aggregate.generated_at));
  return params;
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
  return {
    url,
    aggregate,
    warnings: [...aggregate.warnings],
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
  const cores = parseInts(params.get('dhc'), 6);
  const memory = parseInts(params.get('dhm'), 6);
  return {
    cores_hist: {
      '1': cores[0] ?? 0,
      '2': cores[1] ?? 0,
      '4': cores[2] ?? 0,
      '6': cores[3] ?? 0,
      '8': cores[4] ?? 0,
      '12_plus': cores[5] ?? 0
    },
    memory_gb_hist: {
      '0_5': memory[0] ?? 0,
      '1': memory[1] ?? 0,
      '2': memory[2] ?? 0,
      '4': memory[3] ?? 0,
      '8_plus': memory[4] ?? 0,
      unknown: memory[5] ?? 0
    },
    memory_coverage: readNumberParam(params, 'dhv')
  };
}

function readOptionalNetworkSignals(params: URLSearchParams): SignalNetworkSignals | undefined {
  if (params.get('nse') == null) return undefined;
  const effective = parseInts(params.get('nse'), 5);
  const downlinkRaw = parseDecimals(params.get('nsl'), 3);
  const nsrValue = params.get('nsr');
  const rttRaw = nsrValue == null || nsrValue === '' ? null : parseInts(nsrValue, 3);
  const downlink: SignalQuartiles | null = downlinkRaw
    ? { p25: downlinkRaw[0] ?? 0, p50: downlinkRaw[1] ?? 0, p75: downlinkRaw[2] ?? 0 }
    : null;
  const rtt: SignalQuartiles | null = rttRaw ? { p25: rttRaw[0] ?? 0, p50: rttRaw[1] ?? 0, p75: rttRaw[2] ?? 0 } : null;
  return {
    effective_type_hist: {
      slow_2g: effective[0] ?? 0,
      '2g': effective[1] ?? 0,
      '3g': effective[2] ?? 0,
      '4g': effective[3] ?? 0,
      unknown: effective[4] ?? 0
    },
    effective_type_coverage: readNumberParam(params, 'nsv'),
    save_data_share: readNumberParam(params, 'nsd'),
    downlink_mbps: downlink,
    rtt_ms: rtt
  };
}

function readOptionalEnvironment(params: URLSearchParams): SignalEnvironment | undefined {
  if (params.get('eb') == null) return undefined;
  const browsers = parseInts(params.get('eb'), 5);
  return {
    browser_hist: {
      chrome: browsers[0] ?? 0,
      safari: browsers[1] ?? 0,
      firefox: browsers[2] ?? 0,
      edge: browsers[3] ?? 0,
      other: browsers[4] ?? 0
    }
  };
}

function readOptionalFormFactor(params: URLSearchParams): SignalFormFactorDistribution | undefined {
  if (params.get('ff') == null) return undefined;
  const shares = parseInts(params.get('ff'), 3);
  return {
    mobile: shares[0] ?? 0,
    tablet: shares[1] ?? 0,
    desktop: shares[2] ?? 0
  };
}

export function decodeSignalReportUrl(value: string | URL): SignalAggregateV1 {
  const url = typeof value === 'string' ? new URL(value) : value;
  const params = url.searchParams;
  const network = parseInts(params.get('nt'), 5);
  const devices = parseInts(params.get('dt'), 3);

  const sampleSize = readRequiredNumberParam(params, 's');
  const networkCoverage = readRequiredNumberParam(params, 'nc');
  const periodDays = readRequiredNumberParam(params, 'p');

  const comparisonTier = readEnumParam(params, 'ct', VALID_COMPARISON_TIERS, 'none');
  const raceMetric = readEnumParam(params, 'rm', VALID_RACE_METRICS, 'none');
  const raceFallbackReason = readOptionalEnumParam(params, 'rr', VALID_RACE_FALLBACK_REASONS);

  // Semantic validation
  if (sampleSize < 0) throw new Error('Invalid report URL: sample size cannot be negative.');
  if (periodDays < 0) throw new Error('Invalid report URL: period days cannot be negative.');
  if (raceMetric !== 'none' && comparisonTier === 'none') {
    throw new Error(`Invalid report URL: race metric is "${raceMetric}" but comparison tier is "none".`);
  }
  if (raceFallbackReason != null && raceMetric === 'lcp') {
    throw new Error('Invalid report URL: primary LCP race should not have a fallback reason.');
  }

  const gaRaw = params.get('ga');
  const generatedAt = gaRaw != null ? readRequiredNumberParam(params, 'ga') : 0;
  const warnings = deriveSignalAggregateWarnings({
    mode: params.get('mode') === 'production' ? 'production' : 'preview',
    sample_size: sampleSize,
    race_metric: raceMetric
  });
  if (!generatedAt) {
    warnings.push(SIGNAL_FRESHNESS_UNKNOWN_WARNING);
  }

  const aggregate: SignalAggregateV1 = {
    v: 1,
    rv: 1,
    mode: params.get('mode') === 'production' ? 'production' : 'preview',
    generated_at: generatedAt || Date.now(),
    domain: params.get('d') ?? 'unknown.local',
    sample_size: sampleSize,
    classified_sample_size: Math.round((sampleSize * networkCoverage) / 100),
    period_days: periodDays,
    network_distribution: {
      urban: network[0] ?? 0,
      moderate: network[1] ?? 0,
      constrained_moderate: network[2] ?? 0,
      constrained: network[3] ?? 0,
      unknown: network[4] ?? 0
    },
    device_distribution: {
      low: devices[0] ?? 0,
      mid: devices[1] ?? 0,
      high: devices[2] ?? 0
    },
    comparison_tier: comparisonTier,
    race_metric: raceMetric,
    race_fallback_reason: raceFallbackReason,
    coverage: {
      network_coverage: networkCoverage,
      unclassified_network_share: readNumberParam(params, 'nu'),
      connection_reuse_share: readNumberParam(params, 'nr'),
      lcp_coverage: readNumberParam(params, 'lc'),
      selected_metric_urban_coverage: params.get('ruc') == null ? null : readNumberParam(params, 'ruc'),
      selected_metric_comparison_coverage: params.get('rcc') == null ? null : readNumberParam(params, 'rcc')
    },
    vitals: {
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
    },
    experience_funnel: readOptionalExperienceFunnel(params),
    device_hardware: readOptionalDeviceHardware(params),
    network_signals: readOptionalNetworkSignals(params),
    environment: readOptionalEnvironment(params),
    form_factor_distribution: readOptionalFormFactor(params),
    top_page_path: params.get('v'),
    warnings
  };

  const issues = explainSignalAggregateIssues(aggregate);
  if (issues.length > 0) {
    throw new Error(`Invalid report URL: ${issues[0]}`);
  }

  return aggregate;
}
