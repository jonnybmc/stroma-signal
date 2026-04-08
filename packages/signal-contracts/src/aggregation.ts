import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalDeviceDistribution,
  SignalEventV1,
  SignalMetricSelectionInput,
  SignalMetricSelectionResult,
  SignalNetworkTier,
  SignalTierDistribution,
  SignalTierMetricSummary
} from './types.js';
import {
  SIGNAL_EVENT_VERSION,
  SIGNAL_MIN_LCP_COVERAGE,
  SIGNAL_MIN_RACE_OBSERVATIONS,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_VERSION
} from './types.js';

const CLASSIFIED_TIERS: SignalNetworkTier[] = ['urban', 'moderate', 'constrained_moderate', 'constrained'];

const ZERO_TIER_DISTRIBUTION: SignalTierDistribution = {
  urban: 0,
  moderate: 0,
  constrained_moderate: 0,
  constrained: 0,
  unknown: 0
};

const ZERO_DEVICE_DISTRIBUTION: SignalDeviceDistribution = {
  low: 0,
  mid: 0,
  high: 0
};

function asPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function p75(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.75) - 1);
  return Math.round(sorted[index] ?? sorted[sorted.length - 1]!);
}

interface TierAccumulator {
  observations: number;
  lcp: number[];
  fcp: number[];
  ttfb: number[];
}

function createTierAccumulator(): TierAccumulator {
  return {
    observations: 0,
    lcp: [],
    fcp: [],
    ttfb: []
  };
}

function summarizeTier(accumulator: TierAccumulator): SignalTierMetricSummary {
  const { observations, lcp, fcp, ttfb } = accumulator;
  return {
    observations,
    lcp_observations: lcp.length,
    fcp_observations: fcp.length,
    ttfb_observations: ttfb.length,
    lcp_ms: p75(lcp),
    fcp_ms: p75(fcp),
    ttfb_ms: p75(ttfb),
    lcp_coverage: asPercent(lcp.length, observations),
    fcp_coverage: asPercent(fcp.length, observations),
    ttfb_coverage: asPercent(ttfb.length, observations)
  };
}

function createEmptyTierSummary(): SignalTierMetricSummary {
  return {
    observations: 0,
    lcp_observations: 0,
    fcp_observations: 0,
    ttfb_observations: 0,
    lcp_ms: null,
    fcp_ms: null,
    ttfb_ms: null,
    lcp_coverage: 0,
    fcp_coverage: 0,
    ttfb_coverage: 0
  };
}

function pickComparisonTier(distribution: SignalTierDistribution): SignalComparisonTier {
  const counts = CLASSIFIED_TIERS.filter((tier) => tier !== 'urban')
    .map((tier) => ({
      tier,
      count: distribution[tier]
    }))
    .sort((left, right) => right.count - left.count);

  const best = counts[0];
  return best && best.count > 0 ? best.tier : 'none';
}

export function chooseRaceMetric(input: SignalMetricSelectionInput): SignalMetricSelectionResult {
  if (
    input.urban.lcp_observations >= SIGNAL_MIN_RACE_OBSERVATIONS &&
    input.comparison.lcp_observations >= SIGNAL_MIN_RACE_OBSERVATIONS &&
    input.urban.lcp_coverage >= SIGNAL_MIN_LCP_COVERAGE &&
    input.comparison.lcp_coverage >= SIGNAL_MIN_LCP_COVERAGE
  ) {
    return { race_metric: 'lcp', race_fallback_reason: null };
  }

  if (
    input.urban.fcp_observations >= SIGNAL_MIN_RACE_OBSERVATIONS &&
    input.comparison.fcp_observations >= SIGNAL_MIN_RACE_OBSERVATIONS
  ) {
    return { race_metric: 'fcp', race_fallback_reason: 'lcp_coverage_below_threshold' };
  }

  if (
    input.urban.ttfb_observations >= SIGNAL_MIN_RACE_OBSERVATIONS &&
    input.comparison.ttfb_observations >= SIGNAL_MIN_RACE_OBSERVATIONS
  ) {
    return { race_metric: 'ttfb', race_fallback_reason: 'fcp_unavailable' };
  }

  return {
    race_metric: 'none',
    race_fallback_reason: 'insufficient_comparable_data'
  };
}

function computeTopPagePathFromCounts(counts: Map<string, number>): string | null {
  let topPath: string | null = null;
  let topCount = 0;
  for (const [path, count] of counts.entries()) {
    if (count > topCount) {
      topPath = path;
      topCount = count;
    }
  }
  return topPath;
}

export function aggregateSignalEvents(
  events: SignalEventV1[],
  mode: SignalAggregateV1['mode'] = 'preview',
  now = Date.now()
): SignalAggregateV1 {
  const total = events.length;
  const domain = events[0]?.host ?? 'unknown.local';
  let earliest = now;
  let latest = now;
  let hasTimestamp = false;

  const networkDistribution: SignalTierDistribution = { ...ZERO_TIER_DISTRIBUTION };
  const deviceDistribution: SignalDeviceDistribution = { ...ZERO_DEVICE_DISTRIBUTION };
  const topPathCounts = new Map<string, number>();
  let connectionReuseCount = 0;
  let lcpCount = 0;
  const tierAccumulators: Record<SignalNetworkTier, TierAccumulator> = {
    urban: createTierAccumulator(),
    moderate: createTierAccumulator(),
    constrained_moderate: createTierAccumulator(),
    constrained: createTierAccumulator()
  };

  for (const event of events) {
    if (!hasTimestamp) {
      earliest = event.ts;
      latest = event.ts;
      hasTimestamp = true;
    } else {
      if (event.ts < earliest) earliest = event.ts;
      if (event.ts > latest) latest = event.ts;
    }

    topPathCounts.set(event.url, (topPathCounts.get(event.url) ?? 0) + 1);
    if (event.net_tcp_source === 'unavailable_reused') connectionReuseCount += 1;
    if (event.vitals.lcp_ms != null) lcpCount += 1;

    if (event.net_tier == null) {
      networkDistribution.unknown += 1;
    } else {
      networkDistribution[event.net_tier] += 1;
      const accumulator = tierAccumulators[event.net_tier];
      accumulator.observations += 1;
      if (event.vitals.lcp_ms != null) accumulator.lcp.push(event.vitals.lcp_ms);
      if (event.vitals.fcp_ms != null) accumulator.fcp.push(event.vitals.fcp_ms);
      if (event.vitals.ttfb_ms != null) accumulator.ttfb.push(event.vitals.ttfb_ms);
    }
    deviceDistribution[event.device_tier] += 1;
  }

  const classifiedSampleSize = total - networkDistribution.unknown;
  const periodDays = total === 0 ? 0 : Math.max(0, Math.ceil((latest - earliest) / 86_400_000));
  const comparisonTier = pickComparisonTier(networkDistribution);
  const urban = summarizeTier(tierAccumulators.urban);
  const comparison =
    comparisonTier === 'none' ? createEmptyTierSummary() : summarizeTier(tierAccumulators[comparisonTier]);
  const metricChoice = chooseRaceMetric({
    urban,
    comparison
  });

  const coverage = {
    network_coverage: asPercent(classifiedSampleSize, total),
    unclassified_network_share: asPercent(total - classifiedSampleSize, total),
    connection_reuse_share: asPercent(connectionReuseCount, total),
    lcp_coverage: asPercent(lcpCount, total),
    selected_metric_urban_coverage:
      metricChoice.race_metric === 'none'
        ? null
        : metricChoice.race_metric === 'lcp'
          ? urban.lcp_coverage
          : metricChoice.race_metric === 'fcp'
            ? urban.fcp_coverage
            : urban.ttfb_coverage,
    selected_metric_comparison_coverage:
      metricChoice.race_metric === 'none'
        ? null
        : metricChoice.race_metric === 'lcp'
          ? comparison.lcp_coverage
          : metricChoice.race_metric === 'fcp'
            ? comparison.fcp_coverage
            : comparison.ttfb_coverage
  };

  const warnings: string[] = [];
  if (mode === 'preview' && total < SIGNAL_PREVIEW_MINIMUM_SAMPLE) {
    warnings.push('Sample size below the recommended preview threshold.');
  }
  if (metricChoice.race_metric === 'none') {
    warnings.push('Act 2 cannot render a comparable race with the current data.');
  }

  return {
    v: SIGNAL_EVENT_VERSION,
    rv: SIGNAL_REPORT_VERSION,
    mode,
    generated_at: now,
    domain,
    sample_size: total,
    classified_sample_size: classifiedSampleSize,
    period_days: periodDays,
    network_distribution: {
      urban: asPercent(networkDistribution.urban, total),
      moderate: asPercent(networkDistribution.moderate, total),
      constrained_moderate: asPercent(networkDistribution.constrained_moderate, total),
      constrained: asPercent(networkDistribution.constrained, total),
      unknown: asPercent(networkDistribution.unknown, total)
    },
    device_distribution: {
      low: asPercent(deviceDistribution.low, total),
      mid: asPercent(deviceDistribution.mid, total),
      high: asPercent(deviceDistribution.high, total)
    },
    comparison_tier: comparisonTier,
    race_metric: metricChoice.race_metric,
    race_fallback_reason: metricChoice.race_fallback_reason,
    coverage,
    vitals: {
      urban,
      comparison
    },
    top_page_path: computeTopPagePathFromCounts(topPathCounts),
    warnings
  };
}
