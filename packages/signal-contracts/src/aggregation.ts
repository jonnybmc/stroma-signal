import type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalDeviceDistribution,
  SignalDeviceHardware,
  SignalEnvironment,
  SignalEventV1,
  SignalExperienceFunnel,
  SignalExperienceStage,
  SignalExperienceStageSummary,
  SignalFormFactorDistribution,
  SignalMetricSelectionInput,
  SignalMetricSelectionResult,
  SignalNetworkSignals,
  SignalNetworkTier,
  SignalQuartiles,
  SignalTierDistribution,
  SignalTierMetricSummary
} from './types.js';
import {
  SIGNAL_EVENT_VERSION,
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_MIN_LCP_COVERAGE,
  SIGNAL_MIN_RACE_OBSERVATIONS,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_VERSION
} from './types.js';

const CLASSIFIED_TIERS: SignalNetworkTier[] = ['urban', 'moderate', 'constrained_moderate', 'constrained'];
const EXPERIENCE_STAGES: SignalExperienceStage[] = ['fcp', 'lcp', 'inp'];

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

const POOR_STAGE_THRESHOLDS: Record<SignalExperienceStage, number> = {
  fcp: SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  lcp: SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  inp: SIGNAL_FUNNEL_INP_POOR_THRESHOLD
};

function isLoadShapedEvent(event: SignalEventV1): boolean {
  return event.meta.navigation_type !== 'restore' && event.meta.navigation_type !== 'prerender';
}

function asPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function p75(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.75) - 1);
  const fallback = sorted[sorted.length - 1];
  return Math.round(sorted[index] ?? fallback ?? 0);
}

// Quartile threshold — below this sample count we don't trust the percentile
// math, so the report surfaces `null` and the reader sees an honest "not
// enough data" caveat instead of a noisy made-up number.
const QUARTILE_MIN_SAMPLE = 20;

function quartiles(values: number[]): SignalQuartiles | null {
  if (values.length < QUARTILE_MIN_SAMPLE) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (percentile: number): number => {
    const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
    return sorted[index] ?? 0;
  };
  return {
    p25: Math.round(pick(0.25) * 10) / 10,
    p50: Math.round(pick(0.5) * 10) / 10,
    p75: Math.round(pick(0.75) * 10) / 10
  };
}

function coresBucket(cores: number): keyof SignalDeviceHardware['cores_hist'] {
  if (cores <= 1) return '1';
  if (cores <= 2) return '2';
  if (cores <= 4) return '4';
  if (cores <= 6) return '6';
  if (cores <= 8) return '8';
  return '12_plus';
}

function memoryBucket(memoryGb: number | null): keyof SignalDeviceHardware['memory_gb_hist'] {
  if (memoryGb == null) return 'unknown';
  if (memoryGb <= 0.5) return '0_5';
  if (memoryGb <= 1) return '1';
  if (memoryGb <= 2) return '2';
  if (memoryGb <= 4) return '4';
  return '8_plus';
}

function effectiveTypeBucket(value: string | null): keyof SignalNetworkSignals['effective_type_hist'] {
  switch (value) {
    case 'slow-2g':
      return 'slow_2g';
    case '2g':
      return '2g';
    case '3g':
      return '3g';
    case '4g':
      return '4g';
    default:
      return 'unknown';
  }
}

function browserBucket(value: string): keyof SignalEnvironment['browser_hist'] {
  const normalized = value.toLowerCase();
  if (normalized.includes('edge')) return 'edge';
  if (normalized.includes('chrome')) return 'chrome';
  if (normalized.includes('firefox')) return 'firefox';
  if (normalized.includes('safari')) return 'safari';
  return 'other';
}

const ZERO_CORES_HIST: SignalDeviceHardware['cores_hist'] = {
  '1': 0,
  '2': 0,
  '4': 0,
  '6': 0,
  '8': 0,
  '12_plus': 0
};

const ZERO_MEMORY_HIST: SignalDeviceHardware['memory_gb_hist'] = {
  '0_5': 0,
  '1': 0,
  '2': 0,
  '4': 0,
  '8_plus': 0,
  unknown: 0
};

const ZERO_EFFECTIVE_TYPE_HIST: SignalNetworkSignals['effective_type_hist'] = {
  slow_2g: 0,
  '2g': 0,
  '3g': 0,
  '4g': 0,
  unknown: 0
};

const ZERO_BROWSER_HIST: SignalEnvironment['browser_hist'] = {
  chrome: 0,
  safari: 0,
  firefox: 0,
  edge: 0,
  other: 0
};

function distributePercent<K extends string>(counters: Record<K, number>, total: number): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of Object.keys(counters) as K[]) {
    out[key] = asPercent(counters[key], total);
  }
  return out;
}

interface TierAccumulator {
  observations: number;
  lcp: number[];
  fcp: number[];
  ttfb: number[];
}

interface StageAccumulator {
  measured: number;
  poor: number;
}

interface FunnelTierAccumulator {
  observations: number;
  stages: Record<SignalExperienceStage, StageAccumulator>;
}

function createTierAccumulator(): TierAccumulator {
  return {
    observations: 0,
    lcp: [],
    fcp: [],
    ttfb: []
  };
}

function createStageAccumulator(): StageAccumulator {
  return {
    measured: 0,
    poor: 0
  };
}

function createFunnelTierAccumulator(): FunnelTierAccumulator {
  return {
    observations: 0,
    stages: {
      fcp: createStageAccumulator(),
      lcp: createStageAccumulator(),
      inp: createStageAccumulator()
    }
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

function createEmptyExperienceStageSummary(stage: SignalExperienceStage): SignalExperienceStageSummary {
  return {
    poor_threshold_ms: POOR_STAGE_THRESHOLDS[stage],
    tiers: {
      urban: { coverage: 0, poor_share: 0 },
      moderate: { coverage: 0, poor_share: 0 },
      constrained_moderate: { coverage: 0, poor_share: 0 },
      constrained: { coverage: 0, poor_share: 0 }
    }
  };
}

function summarizeExperienceStage(
  accumulators: Record<SignalNetworkTier, FunnelTierAccumulator>,
  stage: SignalExperienceStage
): SignalExperienceStageSummary {
  const summary = createEmptyExperienceStageSummary(stage);

  for (const tier of CLASSIFIED_TIERS) {
    const accumulator = accumulators[tier];
    const stageAccumulator = accumulator.stages[stage];
    summary.tiers[tier] = {
      coverage: asPercent(stageAccumulator.measured, accumulator.observations),
      poor_share: asPercent(stageAccumulator.poor, stageAccumulator.measured)
    };
  }

  return summary;
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

function metricValueForStage(event: SignalEventV1, stage: SignalExperienceStage): number | null {
  switch (stage) {
    case 'fcp':
      return event.vitals.fcp_ms;
    case 'lcp':
      return event.vitals.lcp_ms;
    case 'inp':
      return event.vitals.inp_ms;
  }
}

function stageIsPoor(stage: SignalExperienceStage, value: number): boolean {
  return value > POOR_STAGE_THRESHOLDS[stage];
}

function resolveActiveStages(
  classifiedSampleSize: number,
  stageMeasuredCounts: Record<SignalExperienceStage, number>
): SignalExperienceStage[] {
  if (classifiedSampleSize <= 0) return [];

  const activeStages: SignalExperienceStage[] = ['fcp'];

  if (
    stageMeasuredCounts.lcp >= SIGNAL_MIN_RACE_OBSERVATIONS &&
    asPercent(stageMeasuredCounts.lcp, classifiedSampleSize) >= SIGNAL_MIN_LCP_COVERAGE
  ) {
    activeStages.push('lcp');
  }

  if (
    stageMeasuredCounts.inp >= SIGNAL_MIN_RACE_OBSERVATIONS &&
    asPercent(stageMeasuredCounts.inp, classifiedSampleSize) >= SIGNAL_MIN_LCP_COVERAGE
  ) {
    activeStages.push('inp');
  }

  return activeStages;
}

function buildExperienceFunnel(
  classifiedEvents: SignalEventV1[],
  accumulators: Record<SignalNetworkTier, FunnelTierAccumulator>,
  stageMeasuredCounts: Record<SignalExperienceStage, number>
): SignalExperienceFunnel {
  const activeStages = resolveActiveStages(classifiedEvents.length, stageMeasuredCounts);

  let measuredSessionCount = 0;
  let poorSessionCount = 0;

  if (activeStages.length > 0) {
    for (const event of classifiedEvents) {
      const stageValues = activeStages.map((stage) => metricValueForStage(event, stage));
      if (stageValues.some((value) => value == null)) continue;

      measuredSessionCount += 1;
      if (
        activeStages.some((stage, index) => {
          const value = stageValues[index];
          return value != null && stageIsPoor(stage, value);
        })
      ) {
        poorSessionCount += 1;
      }
    }
  }

  return {
    active_stages: activeStages,
    measured_session_coverage: asPercent(measuredSessionCount, classifiedEvents.length),
    poor_session_share: asPercent(poorSessionCount, measuredSessionCount),
    stages: {
      fcp: summarizeExperienceStage(accumulators, 'fcp'),
      lcp: summarizeExperienceStage(accumulators, 'lcp'),
      inp: summarizeExperienceStage(accumulators, 'inp')
    }
  };
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

export function deriveSignalAggregateWarnings(
  input: Pick<SignalAggregateV1, 'mode' | 'sample_size' | 'race_metric'>
): string[] {
  const warnings: string[] = [];
  if (input.mode === 'preview' && input.sample_size < SIGNAL_PREVIEW_MINIMUM_SAMPLE) {
    warnings.push('Sample size below the recommended preview threshold.');
  }
  if (input.race_metric === 'none') {
    warnings.push('Act 2 cannot render a comparable race with the current data.');
  }
  return warnings;
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
  const reportEvents = events.filter(isLoadShapedEvent);
  const total = reportEvents.length;
  const domain = reportEvents[0]?.host ?? events[0]?.host ?? 'unknown.local';
  let earliest = now;
  let latest = now;
  let hasTimestamp = false;

  const networkDistribution: SignalTierDistribution = { ...ZERO_TIER_DISTRIBUTION };
  const deviceDistribution: SignalDeviceDistribution = { ...ZERO_DEVICE_DISTRIBUTION };
  const topPathCounts = new Map<string, number>();
  let connectionReuseCount = 0;
  let lcpCount = 0;

  // Iteration 6 — actionable signal counters. Every field here answers a
  // specific product-team decision (see SignalDeviceHardware / etc. docs).
  const coresCounters = { ...ZERO_CORES_HIST };
  const memoryCounters = { ...ZERO_MEMORY_HIST };
  let memoryAvailableCount = 0;
  const effectiveTypeCounters = { ...ZERO_EFFECTIVE_TYPE_HIST };
  let effectiveTypeAvailableCount = 0;
  let saveDataCount = 0;
  const downlinkSamples: number[] = [];
  const rttSamples: number[] = [];
  const browserCounters = { ...ZERO_BROWSER_HIST };
  // Form-factor counters — derived from device_screen_w at the three
  // canonical breakpoints. Stays null if no rows contribute (defensive:
  // preserves the nullable contract on legacy / empty aggregates).
  const formFactorCounters = { mobile: 0, tablet: 0, desktop: 0 };
  let formFactorValidCount = 0;
  const tierAccumulators: Record<SignalNetworkTier, TierAccumulator> = {
    urban: createTierAccumulator(),
    moderate: createTierAccumulator(),
    constrained_moderate: createTierAccumulator(),
    constrained: createTierAccumulator()
  };
  const funnelAccumulators: Record<SignalNetworkTier, FunnelTierAccumulator> = {
    urban: createFunnelTierAccumulator(),
    moderate: createFunnelTierAccumulator(),
    constrained_moderate: createFunnelTierAccumulator(),
    constrained: createFunnelTierAccumulator()
  };
  const stageMeasuredCounts: Record<SignalExperienceStage, number> = {
    fcp: 0,
    lcp: 0,
    inp: 0
  };
  const classifiedEvents: SignalEventV1[] = [];

  for (const event of reportEvents) {
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
      classifiedEvents.push(event);

      const tierAccumulator = tierAccumulators[event.net_tier];
      tierAccumulator.observations += 1;
      if (event.vitals.lcp_ms != null) tierAccumulator.lcp.push(event.vitals.lcp_ms);
      if (event.vitals.fcp_ms != null) tierAccumulator.fcp.push(event.vitals.fcp_ms);
      if (event.vitals.ttfb_ms != null) tierAccumulator.ttfb.push(event.vitals.ttfb_ms);

      const funnelAccumulator = funnelAccumulators[event.net_tier];
      funnelAccumulator.observations += 1;
      for (const stage of EXPERIENCE_STAGES) {
        const stageValue = metricValueForStage(event, stage);
        if (stageValue == null) continue;

        stageMeasuredCounts[stage] += 1;
        funnelAccumulator.stages[stage].measured += 1;
        if (stageIsPoor(stage, stageValue)) {
          funnelAccumulator.stages[stage].poor += 1;
        }
      }
    }

    deviceDistribution[event.device_tier] += 1;

    // Iteration 6 — preserve every actionable signal the SDK already
    // captures so the report can render it as evidence. Coverage counters
    // stay first-class so the report can surface honest caveats where the
    // browser didn't expose the underlying API (Safari/Firefox).
    coresCounters[coresBucket(event.device_cores)] += 1;
    memoryCounters[memoryBucket(event.device_memory_gb)] += 1;
    if (event.device_memory_gb != null) memoryAvailableCount += 1;

    effectiveTypeCounters[effectiveTypeBucket(event.context.effective_type)] += 1;
    if (event.context.effective_type != null) effectiveTypeAvailableCount += 1;
    if (event.context.save_data === true) saveDataCount += 1;
    if (event.context.downlink_mbps != null) downlinkSamples.push(event.context.downlink_mbps);
    if (event.context.rtt_ms != null) rttSamples.push(event.context.rtt_ms);

    browserCounters[browserBucket(event.meta.browser)] += 1;

    // Form-factor bucket — breakpoints locked in aggregation-spec.md.
    // Defensive: skip rows with screen_w ≤ 0 (SDK always writes a value,
    // but the guard costs nothing and keeps the aggregate nullable when
    // every row happens to be invalid).
    if (event.device_screen_w > 0) {
      if (event.device_screen_w < 768) formFactorCounters.mobile += 1;
      else if (event.device_screen_w < 1280) formFactorCounters.tablet += 1;
      else formFactorCounters.desktop += 1;
      formFactorValidCount += 1;
    }
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

  const warnings = deriveSignalAggregateWarnings({
    mode,
    sample_size: total,
    race_metric: metricChoice.race_metric
  });

  const deviceHardware: SignalDeviceHardware = {
    cores_hist: distributePercent(coresCounters, total) as SignalDeviceHardware['cores_hist'],
    memory_gb_hist: distributePercent(memoryCounters, total) as SignalDeviceHardware['memory_gb_hist'],
    memory_coverage: asPercent(memoryAvailableCount, total)
  };

  const networkSignals: SignalNetworkSignals = {
    effective_type_hist: distributePercent(effectiveTypeCounters, total) as SignalNetworkSignals['effective_type_hist'],
    effective_type_coverage: asPercent(effectiveTypeAvailableCount, total),
    save_data_share: asPercent(saveDataCount, total),
    downlink_mbps: quartiles(downlinkSamples),
    rtt_ms: quartiles(rttSamples)
  };

  const environment: SignalEnvironment = {
    browser_hist: distributePercent(browserCounters, total) as SignalEnvironment['browser_hist']
  };

  // Form-factor distribution stays undefined when no rows contributed —
  // preserves the nullable contract for legacy / empty decoded aggregates.
  const formFactorDistribution: SignalFormFactorDistribution | undefined =
    formFactorValidCount > 0
      ? {
          mobile: asPercent(formFactorCounters.mobile, formFactorValidCount),
          tablet: asPercent(formFactorCounters.tablet, formFactorValidCount),
          desktop: asPercent(formFactorCounters.desktop, formFactorValidCount)
        }
      : undefined;

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
    experience_funnel: buildExperienceFunnel(classifiedEvents, funnelAccumulators, stageMeasuredCounts),
    device_hardware: deviceHardware,
    network_signals: networkSignals,
    environment,
    form_factor_distribution: formFactorDistribution,
    top_page_path: computeTopPagePathFromCounts(topPathCounts),
    warnings
  };
}
