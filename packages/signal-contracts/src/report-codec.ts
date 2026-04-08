import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalRaceFallbackReason,
  SignalRaceMetric,
  SignalReportUrlResult,
  SignalTierMetricSummary
} from './types.js';
import { SIGNAL_PREVIEW_MINIMUM_SAMPLE, SIGNAL_REPORT_BASE_URL } from './types.js';
import { isSignalAggregateV1 } from './guards.js';

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

function joinInts(values: number[]): string {
  return values.map((value) => Math.round(value)).join(',');
}

function parseInts(value: string | null, expectedLength: number): number[] {
  const parts = (value ?? '').split(',').map((item) => Number(item));
  if (parts.length !== expectedLength || parts.some((item) => !Number.isFinite(item))) {
    throw new Error(`Invalid encoded integer tuple: ${value ?? 'null'}`);
  }
  return parts;
}

function metricValue(summary: SignalTierMetricSummary, key: 'lcp_ms' | 'fcp_ms' | 'ttfb_ms'): string {
  return summary[key] == null ? '0' : String(summary[key]);
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
    joinInts([
      aggregate.device_distribution.low,
      aggregate.device_distribution.mid,
      aggregate.device_distribution.high
    ])
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
  if (aggregate.top_page_path) params.set('v', aggregate.top_page_path);
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
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  validValues: Set<T>,
  fallback: T
): T {
  const raw = params.get(key);
  if (raw == null) return fallback;
  if (!validValues.has(raw as T)) {
    throw new Error(`Invalid encoded enum value for "${key}": ${raw}`);
  }
  return raw as T;
}

function readOptionalEnumParam<T extends string>(
  params: URLSearchParams,
  key: string,
  validValues: Set<T>
): T | null {
  const raw = params.get(key);
  if (raw == null) return null;
  if (!validValues.has(raw as T)) {
    throw new Error(`Invalid encoded enum value for "${key}": ${raw}`);
  }
  return raw as T;
}

export function decodeSignalReportUrl(value: string | URL): SignalAggregateV1 {
  const url = typeof value === 'string' ? new URL(value) : value;
  const params = url.searchParams;
  const network = parseInts(params.get('nt'), 5);
  const devices = parseInts(params.get('dt'), 3);
  return {
    v: 1,
    rv: 1,
    mode: params.get('mode') === 'production' ? 'production' : 'preview',
    generated_at: Date.now(),
    domain: params.get('d') ?? 'unknown.local',
    sample_size: readNumberParam(params, 's'),
    classified_sample_size: Math.round(
      (readNumberParam(params, 's') * readNumberParam(params, 'nc')) / 100
    ),
    period_days: readNumberParam(params, 'p'),
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
    comparison_tier: readEnumParam(params, 'ct', VALID_COMPARISON_TIERS, 'none'),
    race_metric: readEnumParam(params, 'rm', VALID_RACE_METRICS, 'none'),
    race_fallback_reason: readOptionalEnumParam(params, 'rr', VALID_RACE_FALLBACK_REASONS),
    coverage: {
      network_coverage: readNumberParam(params, 'nc'),
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
    top_page_path: params.get('v'),
    warnings: []
  };
}
