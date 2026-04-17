import { describe, expect, it } from 'vitest';

import {
  affirmingAggregateFixture,
  aggregateSignalEvents,
  chooseRaceMetric,
  chromeColdNavFixture,
  decodeSignalReportUrl,
  deriveSignalAggregateWarnings,
  encodeSignalReportUrl,
  explainSignalAggregateIssues,
  explainSignalEventIssues,
  explainSignalWarehouseRowIssues,
  fcpFallbackAggregateFixture,
  flattenSignalEventForGa4,
  highUnclassifiedShareAggregateFixture,
  lowInpCoverageAggregateFixture,
  mixedLifecycleAggregateFixture,
  prerenderLifecycleFixture,
  previewAggregateFixture,
  restoreLifecycleFixture,
  SIGNAL_AGGREGATION_SPEC_V1,
  SIGNAL_GA4_EVENT_NAME,
  SIGNAL_GA4_FIELD_MAP_V1,
  SIGNAL_MIN_LCP_COVERAGE,
  SIGNAL_MIN_RACE_OBSERVATIONS,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  safariFallbackFixture,
  safariHeavyAggregateFixture,
  signalReportScenarioFixtures,
  singleStageFunnelFixture,
  strongLcpCoverageAggregateFixture,
  toSignalWarehouseRow,
  ttfbFallbackAggregateFixture
} from '../src/index.js';

describe('signal contracts', () => {
  it('round-trips a report url', () => {
    const encoded = encodeSignalReportUrl(previewAggregateFixture);
    const decoded = decodeSignalReportUrl(encoded.url);

    expect(decoded.domain).toBe(previewAggregateFixture.domain);
    expect(decoded.network_distribution).toEqual(previewAggregateFixture.network_distribution);
    expect(decoded.device_distribution).toEqual(previewAggregateFixture.device_distribution);
    expect(decoded.comparison_tier).toBe(previewAggregateFixture.comparison_tier);
    expect(decoded.race_metric).toBe(previewAggregateFixture.race_metric);
    expect(decoded.race_fallback_reason).toBe(previewAggregateFixture.race_fallback_reason);
    expect(decoded.coverage).toEqual(previewAggregateFixture.coverage);
    expect(decoded.vitals.urban.lcp_coverage).toBe(previewAggregateFixture.vitals.urban.lcp_coverage);
    expect(decoded.vitals.urban.fcp_coverage).toBe(previewAggregateFixture.vitals.urban.fcp_coverage);
    expect(decoded.vitals.urban.ttfb_coverage).toBe(previewAggregateFixture.vitals.urban.ttfb_coverage);
    expect(decoded.vitals.comparison.lcp_coverage).toBe(previewAggregateFixture.vitals.comparison.lcp_coverage);
    expect(decoded.vitals.comparison.fcp_coverage).toBe(previewAggregateFixture.vitals.comparison.fcp_coverage);
    expect(decoded.vitals.comparison.ttfb_coverage).toBe(previewAggregateFixture.vitals.comparison.ttfb_coverage);
    expect(decoded.experience_funnel).toEqual(previewAggregateFixture.experience_funnel);
  });

  it('rejects invalid enum values in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?nt=20,20,20,20,20&dt=34,33,33&s=100&p=7&nc=100&ct=%3Cscript%3E&rm=none'
      )
    ).toThrow('Invalid encoded enum value for "ct"');
  });

  it('prefers fcp when lcp coverage is too low', () => {
    expect(
      chooseRaceMetric({
        urban: {
          lcp_observations: 12,
          fcp_observations: 30,
          ttfb_observations: 30,
          lcp_coverage: 40,
          fcp_coverage: 100,
          ttfb_coverage: 100
        },
        comparison: {
          lcp_observations: 14,
          fcp_observations: 30,
          ttfb_observations: 30,
          lcp_coverage: 45,
          fcp_coverage: 100,
          ttfb_coverage: 100
        }
      })
    ).toEqual({
      race_metric: 'fcp',
      race_fallback_reason: 'lcp_coverage_below_threshold'
    });
  });

  it('selects lcp as primary when both tiers have strong lcp coverage', () => {
    expect(
      chooseRaceMetric({
        urban: {
          lcp_observations: 40,
          fcp_observations: 40,
          ttfb_observations: 40,
          lcp_coverage: 80,
          fcp_coverage: 100,
          ttfb_coverage: 100
        },
        comparison: {
          lcp_observations: 30,
          fcp_observations: 30,
          ttfb_observations: 30,
          lcp_coverage: 75,
          fcp_coverage: 100,
          ttfb_coverage: 100
        }
      })
    ).toEqual({ race_metric: 'lcp', race_fallback_reason: null });
  });

  it('falls back to ttfb when both lcp and fcp observations are insufficient', () => {
    expect(
      chooseRaceMetric({
        urban: {
          lcp_observations: 5,
          fcp_observations: 10,
          ttfb_observations: 30,
          lcp_coverage: 20,
          fcp_coverage: 40,
          ttfb_coverage: 100
        },
        comparison: {
          lcp_observations: 3,
          fcp_observations: 8,
          ttfb_observations: 28,
          lcp_coverage: 15,
          fcp_coverage: 32,
          ttfb_coverage: 100
        }
      })
    ).toEqual({ race_metric: 'ttfb', race_fallback_reason: 'fcp_unavailable' });
  });

  it('returns none when no metric meets observation thresholds', () => {
    expect(
      chooseRaceMetric({
        urban: {
          lcp_observations: 5,
          fcp_observations: 5,
          ttfb_observations: 5,
          lcp_coverage: 20,
          fcp_coverage: 20,
          ttfb_coverage: 20
        },
        comparison: {
          lcp_observations: 3,
          fcp_observations: 3,
          ttfb_observations: 3,
          lcp_coverage: 15,
          fcp_coverage: 15,
          ttfb_coverage: 15
        }
      })
    ).toEqual({ race_metric: 'none', race_fallback_reason: 'insufficient_comparable_data' });
  });

  it('flattens canonical events for ga4 without renaming the event', () => {
    const flattened = flattenSignalEventForGa4(chromeColdNavFixture);

    expect(flattened.event).toBe(SIGNAL_GA4_EVENT_NAME);
    expect(Object.keys(flattened)).toHaveLength(25);
    expect(flattened.net_tier).toBe(chromeColdNavFixture.net_tier);
    expect(flattened.device_screen_w).toBe(chromeColdNavFixture.device_screen_w);
    expect(flattened.lcp_ms).toBe(chromeColdNavFixture.vitals.lcp_ms);
    expect(flattened.navigation_type).toBe('navigate');
    expect(flattened.lcp_load_state).toBe('complete');
    expect(flattened.lcp_element_type).toBe('image');
    expect(flattened.inp_load_state).toBe('interactive');
    expect(flattened.interaction_type).toBe('pointer');
    expect(flattened.input_delay_ms).toBe(42);
    expect(flattened.processing_duration_ms).toBe(180);
    expect(flattened.presentation_delay_ms).toBe(118);
    expect(flattened).not.toHaveProperty('lcp_target');
    expect(flattened).not.toHaveProperty('lcp_resource_url');
    expect(flattened).not.toHaveProperty('interaction_target');
    expect(flattened).not.toHaveProperty('interaction_time_ms');
    expect(flattened).not.toHaveProperty('v');
    expect(flattened).not.toHaveProperty('ts');
    expect(flattened).not.toHaveProperty('ref');
    expect(flattened).not.toHaveProperty('device_cores');
    expect(flattened).not.toHaveProperty('device_memory_gb');
    expect(flattened).not.toHaveProperty('device_screen_h');
    expect(flattened).not.toHaveProperty('cls');
    expect(flattened).not.toHaveProperty('inp_ms');
    expect(flattened).not.toHaveProperty('effective_type');
    expect(flattened).not.toHaveProperty('downlink_mbps');
    expect(flattened).not.toHaveProperty('rtt_ms');
    expect(flattened).not.toHaveProperty('save_data');
    expect(flattened).not.toHaveProperty('connection_type');
    expect(flattened).not.toHaveProperty('pkg_version');
  });

  it('keeps the canonical GA4-safe subset under the standard-property event parameter limit', () => {
    const flattened = flattenSignalEventForGa4(chromeColdNavFixture);
    const ga4SafeFieldCount = Object.keys(SIGNAL_GA4_FIELD_MAP_V1.fields).length;

    expect(ga4SafeFieldCount).toBe(24);
    expect(ga4SafeFieldCount).toBeLessThanOrEqual(25);
    expect(Object.keys(flattened).filter((key) => key !== 'event')).toHaveLength(ga4SafeFieldCount);
  });

  it('preserves nullable safari vitals in the normalized warehouse row', () => {
    const warehouseRow = toSignalWarehouseRow(safariFallbackFixture);

    expect(warehouseRow.browser).toBe('safari');
    expect(warehouseRow.lcp_ms).toBeNull();
    expect(warehouseRow.cls).toBeNull();
    expect(warehouseRow.inp_ms).toBeNull();
    expect(warehouseRow.fcp_ms).toBe(safariFallbackFixture.vitals.fcp_ms);
    expect(warehouseRow.ttfb_ms).toBe(safariFallbackFixture.vitals.ttfb_ms);
    expect(warehouseRow.navigation_type).toBe('navigate');
    expect(warehouseRow.lcp_load_state).toBeNull();
    expect(warehouseRow.lcp_target).toBeNull();
    expect(warehouseRow.lcp_resource_url).toBeNull();
    expect(warehouseRow.interaction_target).toBeNull();
    expect(warehouseRow.input_delay_ms).toBeNull();
  });

  it('preserves full diagnostics in the normalized warehouse row', () => {
    const warehouseRow = toSignalWarehouseRow(chromeColdNavFixture);

    expect(warehouseRow.navigation_type).toBe('navigate');
    expect(warehouseRow.lcp_load_state).toBe('complete');
    expect(warehouseRow.lcp_target).toBe('img');
    expect(warehouseRow.lcp_element_type).toBe('image');
    expect(warehouseRow.lcp_resource_url).toBe('/assets/hero.webp');
    expect(warehouseRow.inp_load_state).toBe('interactive');
    expect(warehouseRow.interaction_target).toBe('button');
    expect(warehouseRow.interaction_type).toBe('pointer');
    expect(warehouseRow.interaction_time_ms).toBe(5230);
    expect(warehouseRow.input_delay_ms).toBe(42);
    expect(warehouseRow.processing_duration_ms).toBe(180);
    expect(warehouseRow.presentation_delay_ms).toBe(118);
  });

  it('aggregates large event sets without spreading timestamps onto the call stack', () => {
    const events = Array.from({ length: 120_000 }, (_, index) => ({
      ...chromeColdNavFixture,
      event_id: `evt_${index}`,
      ts: 1_700_000_000_000 + index,
      url: index % 2 === 0 ? '/pricing' : '/offers'
    }));

    const aggregate = aggregateSignalEvents(events, 'production', 1_700_010_000_000);

    expect(aggregate.sample_size).toBe(120_000);
    expect(aggregate.period_days).toBeGreaterThanOrEqual(1);
    expect(aggregate.top_page_path).toBe('/pricing');
  });

  it('computes a measured three-stage experience funnel when coverage is strong', () => {
    const funnel = strongLcpCoverageAggregateFixture.experience_funnel;

    expect(funnel).toBeDefined();
    expect(funnel?.active_stages).toEqual(['fcp', 'lcp', 'inp']);
    expect(funnel?.stages.fcp.poor_threshold_ms).toBe(3000);
    expect(funnel?.stages.lcp.poor_threshold_ms).toBe(4000);
    expect(funnel?.stages.inp.poor_threshold_ms).toBe(500);
    expect(funnel?.measured_session_coverage).toBe(100);
  });

  it('drops INP from the measured funnel when INP coverage is too weak', () => {
    const funnel = lowInpCoverageAggregateFixture.experience_funnel;

    expect(funnel).toBeDefined();
    expect(funnel?.active_stages).toEqual(['fcp', 'lcp']);
    expect(funnel?.stages.inp.tiers.urban.coverage).toBeLessThan(50);
    expect(funnel?.stages.inp.tiers.moderate.coverage).toBeLessThan(50);
  });

  it('classifies poor-session share from measured threshold crossings only', () => {
    const makePoorEvent = (event_id: string, ts: number, net_tier: 'urban' | 'moderate', poor: boolean) => ({
      ...chromeColdNavFixture,
      event_id,
      ts,
      net_tier,
      vitals: {
        ...chromeColdNavFixture.vitals,
        fcp_ms: poor ? 3_400 : 1_100,
        lcp_ms: poor ? 4_500 : 2_400,
        inp_ms: poor ? 640 : 180
      }
    });

    const aggregate = aggregateSignalEvents(
      [
        ...Array.from({ length: 30 }, (_, index) =>
          makePoorEvent(`urban_${index}`, chromeColdNavFixture.ts + index, 'urban', index < 15)
        ),
        ...Array.from({ length: 30 }, (_, index) =>
          makePoorEvent(`moderate_${index}`, chromeColdNavFixture.ts + 100 + index, 'moderate', index < 15)
        )
      ],
      'production',
      chromeColdNavFixture.ts + 1_000
    );

    expect(aggregate.experience_funnel?.active_stages).toEqual(['fcp', 'lcp', 'inp']);
    expect(aggregate.experience_funnel?.measured_session_coverage).toBe(100);
    expect(aggregate.experience_funnel?.poor_session_share).toBe(50);
  });

  it('produces no NaN in the codec output when the aggregate has zero sample size', () => {
    const emptyAggregate = aggregateSignalEvents([], 'preview', Date.now());
    expect(emptyAggregate.sample_size).toBe(0);

    const encoded = encodeSignalReportUrl(emptyAggregate);
    expect(encoded.url).not.toContain('NaN');
    expect(encoded.url).not.toContain('Infinity');

    const decoded = decodeSignalReportUrl(encoded.url);
    expect(decoded.sample_size).toBe(0);
    expect(decoded.network_distribution.urban).toBe(0);
    expect(decoded.device_distribution.low).toBe(0);
  });

  it('handles 100% unclassified traffic without NaN or malformed percentages', () => {
    const encoded = encodeSignalReportUrl(highUnclassifiedShareAggregateFixture);
    expect(encoded.url).not.toContain('NaN');
    const decoded = decodeSignalReportUrl(encoded.url);
    expect(decoded.coverage.unclassified_network_share).toBeGreaterThan(50);
    expect(decoded.network_distribution.unknown).toBeGreaterThan(50);
  });

  it('excludes restore and prerender events from default report aggregates', () => {
    const aggregate = aggregateSignalEvents(
      [chromeColdNavFixture, restoreLifecycleFixture, prerenderLifecycleFixture],
      'preview',
      Date.UTC(2026, 3, 8, 11, 0, 0)
    );

    expect(aggregate.sample_size).toBe(1);
    expect(aggregate.classified_sample_size).toBe(1);
    expect(aggregate.top_page_path).toBe('/personal-loans');
    expect(aggregate.coverage.network_coverage).toBe(100);
    expect(aggregate.coverage.lcp_coverage).toBe(100);
    expect(aggregate.vitals.urban.observations).toBe(0);
    expect(aggregate.vitals.comparison.observations).toBe(1);
    expect(aggregate.domain).toBe('example.co.za');
  });

  it('decodes older rv=1 report urls without the additive experience funnel block', () => {
    const decoded = decodeSignalReportUrl(
      'https://signal.stroma.design/r?mode=preview&d=example.co.za&nt=25,25,25,25,0&dt=34,33,33&lu=2100&lt=4200&fu=1100&ft=1900&tu=220&tt=380&ulc=100&ufc=100&utc=100&clc=100&cfc=100&ctc=100&s=100&p=7&nc=100&nu=0&nr=0&lc=100&ct=moderate&rm=lcp'
    );

    expect(decoded.domain).toBe('example.co.za');
    expect(decoded.experience_funnel).toBeUndefined();
  });

  it('ships scenario fixtures that cover the intended report fallbacks and edge cases', () => {
    expect(signalReportScenarioFixtures.map((fixture) => fixture.id)).toEqual([
      'preview',
      'mixed-lifecycle',
      'strong-lcp',
      'affirming-balance',
      'fcp-fallback',
      'ttfb-fallback',
      'insufficient-race',
      'low-inp-coverage',
      'high-unclassified',
      'safari-heavy',
      'full-depth',
      'sober-mood',
      'single-stage-funnel',
      'form-factor-mobile-desktop-only',
      'form-factor-mobile-tablet-only',
      'form-factor-mobile-only',
      'zero-classified',
      'empty-funnel-legacy',
      'no-hardware-block'
    ]);
    expect(mixedLifecycleAggregateFixture.sample_size).toBe(1);
    expect(strongLcpCoverageAggregateFixture.race_metric).toBe('lcp');
    expect(affirmingAggregateFixture.experience_funnel?.poor_session_share).toBeLessThanOrEqual(12);
    expect(fcpFallbackAggregateFixture.race_metric).toBe('fcp');
    expect(ttfbFallbackAggregateFixture.race_metric).toBe('ttfb');
    expect(lowInpCoverageAggregateFixture.experience_funnel?.active_stages).toEqual(['fcp', 'lcp']);
    expect(highUnclassifiedShareAggregateFixture.coverage.unclassified_network_share).toBeGreaterThan(50);
    expect(safariHeavyAggregateFixture.coverage.lcp_coverage).toBeLessThan(25);
  });

  it('computes correct p75 metrics for single-event aggregates', () => {
    // Single event with known LCP → p75 should equal that value
    const singleEvent = { ...chromeColdNavFixture, net_tier: 'urban' as const };
    const agg = aggregateSignalEvents([singleEvent], 'preview');
    expect(agg.vitals.urban.lcp_ms).toBe(Math.round(singleEvent.vitals.lcp_ms ?? 0));
    expect(agg.vitals.urban.fcp_ms).toBe(Math.round(singleEvent.vitals.fcp_ms ?? 0));
    expect(agg.vitals.urban.ttfb_ms).toBe(Math.round(singleEvent.vitals.ttfb_ms ?? 0));
  });

  it('returns null metrics for empty tier accumulator', () => {
    // No comparison events → comparison tier vitals should be null
    const urbanOnly = { ...chromeColdNavFixture, net_tier: 'urban' as const };
    const agg = aggregateSignalEvents([urbanOnly], 'preview');
    expect(agg.vitals.comparison.lcp_ms).toBeNull();
    expect(agg.vitals.comparison.fcp_ms).toBeNull();
    expect(agg.vitals.comparison.ttfb_ms).toBeNull();
  });

  it('resolves single-stage funnel when only FCP has sufficient coverage', () => {
    expect(singleStageFunnelFixture.experience_funnel?.active_stages).toEqual(['fcp']);
  });

  it('resolves full three-stage funnel with strong coverage', () => {
    expect(strongLcpCoverageAggregateFixture.experience_funnel?.active_stages).toEqual(['fcp', 'lcp', 'inp']);
  });

  it('resolves two-stage funnel when INP is below coverage threshold', () => {
    expect(lowInpCoverageAggregateFixture.experience_funnel?.active_stages).toEqual(['fcp', 'lcp']);
  });

  it('derives correct warnings for different aggregate states', () => {
    // Preview + small sample + no race → 2 warnings
    expect(deriveSignalAggregateWarnings({ mode: 'preview', sample_size: 5, race_metric: 'none' })).toHaveLength(2);
    // Production + large sample + LCP race → 0 warnings
    expect(deriveSignalAggregateWarnings({ mode: 'production', sample_size: 200, race_metric: 'lcp' })).toHaveLength(0);
    // Preview + adequate sample + no race → 1 warning (race only)
    expect(deriveSignalAggregateWarnings({ mode: 'preview', sample_size: 200, race_metric: 'none' })).toHaveLength(1);
    // Production + small sample + LCP race → 0 warnings (preview check only applies to preview mode)
    expect(deriveSignalAggregateWarnings({ mode: 'production', sample_size: 5, race_metric: 'lcp' })).toHaveLength(0);
  });

  it('keeps the aggregation spec object in sync with types.ts constants', () => {
    expect(SIGNAL_AGGREGATION_SPEC_V1.previewMinimumSample).toBe(SIGNAL_PREVIEW_MINIMUM_SAMPLE);
    expect(SIGNAL_AGGREGATION_SPEC_V1.minRaceObservations).toBe(SIGNAL_MIN_RACE_OBSERVATIONS);
    expect(SIGNAL_AGGREGATION_SPEC_V1.minLcpCoverage).toBe(SIGNAL_MIN_LCP_COVERAGE);
    expect(SIGNAL_AGGREGATION_SPEC_V1.funnelPoorThresholds.fcp).toBe(3000);
    expect(SIGNAL_AGGREGATION_SPEC_V1.funnelPoorThresholds.lcp).toBe(4000);
    expect(SIGNAL_AGGREGATION_SPEC_V1.funnelPoorThresholds.inp).toBe(500);
  });

  it('explains invalid aggregate input with actionable contract issues', () => {
    expect(explainSignalAggregateIssues({ foo: 'bar' })).toContain('Expected "v" to be 1.');
    expect(explainSignalAggregateIssues(previewAggregateFixture)).toEqual([]);
  });

  it('rejects out-of-range percentages in aggregate guard validation', () => {
    const invalid = {
      ...previewAggregateFixture,
      network_distribution: { ...previewAggregateFixture.network_distribution, urban: 150 }
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((issue) => issue.includes('network_distribution.urban'))).toBe(true);
    expect(issues.some((issue) => issue.includes('between 0 and 100'))).toBe(true);
  });

  it('rejects negative sample_size in aggregate guard validation', () => {
    const invalid = { ...previewAggregateFixture, sample_size: -5 };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((issue) => issue.includes('sample_size'))).toBe(true);
    expect(issues.some((issue) => issue.includes('non-negative'))).toBe(true);
  });

  it('rejects network distribution that does not sum to ~100', () => {
    const invalid = {
      ...previewAggregateFixture,
      network_distribution: { urban: 0, moderate: 0, constrained_moderate: 0, constrained: 0, unknown: 0 }
    };
    // All zeros is acceptable (empty data) — sum is 0, no coherence error
    expect(explainSignalAggregateIssues(invalid).some((i) => i.includes('sum to ~100'))).toBe(false);

    const invalid2 = {
      ...previewAggregateFixture,
      network_distribution: { urban: 50, moderate: 50, constrained_moderate: 50, constrained: 0, unknown: 0 }
    };
    // 150% total — should fail
    const issues2 = explainSignalAggregateIssues(invalid2);
    expect(issues2.some((i) => i.includes('network_distribution'))).toBe(true);
    expect(issues2.some((i) => i.includes('sum to ~100'))).toBe(true);
  });

  it('rejects device distribution that does not sum to ~100', () => {
    const invalid = {
      ...previewAggregateFixture,
      device_distribution: { low: 10, mid: 10, high: 10 }
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((i) => i.includes('device_distribution'))).toBe(true);
    expect(issues.some((i) => i.includes('sum to ~100'))).toBe(true);
  });

  it('rejects classified_sample_size exceeding sample_size', () => {
    const invalid = {
      ...previewAggregateFixture,
      sample_size: 10,
      classified_sample_size: 20
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((i) => i.includes('classified_sample_size'))).toBe(true);
    expect(issues.some((i) => i.includes('exceed'))).toBe(true);
  });

  it('rejects incoherent coverage sums in aggregate guard validation', () => {
    const invalid = {
      ...previewAggregateFixture,
      coverage: {
        ...previewAggregateFixture.coverage,
        network_coverage: 100,
        unclassified_network_share: 80
      }
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((i) => i.includes('network_coverage + coverage.unclassified_network_share'))).toBe(true);
  });

  it('rejects classified-share mismatch between network_distribution and coverage', () => {
    const invalid = {
      ...previewAggregateFixture,
      network_distribution: { urban: 25, moderate: 25, constrained_moderate: 25, constrained: 25, unknown: 0 },
      coverage: {
        ...previewAggregateFixture.coverage,
        network_coverage: 0,
        unclassified_network_share: 100
      },
      classified_sample_size: 0
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((i) => i.includes('classified network_distribution share'))).toBe(true);
  });

  it('rejects unclassified-share mismatch between network_distribution and coverage', () => {
    const invalid = {
      ...previewAggregateFixture,
      network_distribution: { urban: 0, moderate: 0, constrained_moderate: 0, constrained: 0, unknown: 0 },
      coverage: {
        ...previewAggregateFixture.coverage,
        network_coverage: 0,
        unclassified_network_share: 100
      },
      classified_sample_size: 0
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((i) => i.includes('network_distribution.unknown'))).toBe(true);
  });

  it('rejects classified_sample_size mismatching sample_size × network_coverage', () => {
    const invalid = {
      ...previewAggregateFixture,
      sample_size: 100,
      coverage: {
        ...previewAggregateFixture.coverage,
        network_coverage: 75,
        unclassified_network_share: 25
      },
      classified_sample_size: 10
    };
    const issues = explainSignalAggregateIssues(invalid);
    expect(issues.some((i) => i.includes('sample_size × coverage.network_coverage'))).toBe(true);
  });

  it('rejects incoherent report URLs via the decoder', () => {
    // nt=0,0,0,0,0 with nc=100 means 100% coverage but 0% in every tier — incoherent
    // The decoder runs explainSignalAggregateIssues post-decode, but this specific case
    // has nt summing to 0 which we allow (empty data). However, dt=10,10,10 sums to 30 — should fail.
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=0,0,0,0,0&dt=10,10,10&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=100&nu=0&nr=0&lc=0&ct=none&rm=none&ga=1712572800000'
      )
    ).toThrow('device_distribution');
  });

  it('rejects report urls whose coverage sum is internally contradictory', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=25,25,25,25,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=100&p=7&nc=100&nu=80&nr=0&lc=0&ct=none&rm=none&ga=1712572800000'
      )
    ).toThrow('network_coverage + coverage.unclassified_network_share');
  });

  it('rejects report urls whose classified share contradicts network_distribution', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=25,25,25,25,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=100&p=7&nc=0&nu=100&nr=0&lc=0&ct=none&rm=none&ga=1712572800000'
      )
    ).toThrow('classified network_distribution share');
  });

  it('rejects report urls whose unknown share contradicts coverage', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=0,0,0,0,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=100&p=7&nc=0&nu=100&nr=0&lc=0&ct=none&rm=none&ga=1712572800000'
      )
    ).toThrow('network_distribution.unknown');
  });

  it('preserves device-hardware / network-signals / environment blocks through the codec', () => {
    const encoded = encodeSignalReportUrl(strongLcpCoverageAggregateFixture);
    const decoded = decodeSignalReportUrl(encoded.url);

    expect(decoded.device_hardware).toEqual(strongLcpCoverageAggregateFixture.device_hardware);
    expect(decoded.network_signals).toEqual(strongLcpCoverageAggregateFixture.network_signals);
    expect(decoded.environment).toEqual(strongLcpCoverageAggregateFixture.environment);
  });

  it('marks the memory histogram as unknown when Safari / Firefox sessions dominate', () => {
    const hardware = safariHeavyAggregateFixture.device_hardware;
    expect(hardware).toBeDefined();
    // Safari series pushes device_memory_gb to null; those sessions land
    // in the unknown bucket and drop memory_coverage below 100.
    expect(hardware?.memory_gb_hist.unknown).toBeGreaterThan(0);
    expect(hardware?.memory_coverage).toBeLessThan(100);
  });

  it('drops effective_type / downlink / rtt to unknown + null on Safari-heavy samples', () => {
    const signals = safariHeavyAggregateFixture.network_signals;
    expect(signals).toBeDefined();
    expect(signals?.effective_type_hist.unknown).toBeGreaterThan(0);
    expect(signals?.effective_type_coverage).toBeLessThan(100);
  });

  it('tracks browser distribution in the environment block', () => {
    const env = safariHeavyAggregateFixture.environment;
    expect(env).toBeDefined();
    expect(env?.browser_hist.safari).toBeGreaterThan(0);
    // Safari-heavy fixture keeps a small Chromium support series so the
    // Chrome bucket stays non-zero.
    expect(env?.browser_hist.chrome).toBeGreaterThan(0);
  });

  it('keeps rv=1 urls decoding cleanly when the new blocks are absent', () => {
    const decoded = decodeSignalReportUrl(
      'https://signal.stroma.design/r?mode=preview&d=example.co.za&nt=25,25,25,25,0&dt=34,33,33&lu=2100&lt=4200&fu=1100&ft=1900&tu=220&tt=380&ulc=100&ufc=100&utc=100&clc=100&cfc=100&ctc=100&s=100&p=7&nc=100&nu=0&nr=0&lc=100&ct=moderate&rm=lcp'
    );

    expect(decoded.device_hardware).toBeUndefined();
    expect(decoded.network_signals).toBeUndefined();
    expect(decoded.environment).toBeUndefined();
  });

  it('preserves generated_at through the codec round-trip', () => {
    const encoded = encodeSignalReportUrl(strongLcpCoverageAggregateFixture);
    const decoded = decodeSignalReportUrl(encoded.url);

    expect(decoded.generated_at).toBe(strongLcpCoverageAggregateFixture.generated_at);
  });

  it('falls back to Date.now() for generated_at when decoding legacy urls without ga param', () => {
    const before = Date.now();
    const decoded = decodeSignalReportUrl(
      'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp'
    );
    const after = Date.now();

    expect(decoded.generated_at).toBeGreaterThanOrEqual(before);
    expect(decoded.generated_at).toBeLessThanOrEqual(after);
  });

  it('decodes urls with empty nsl and nsr params without crashing', () => {
    // Simulates the normalized SQL builder output when downlink/rtt quartiles
    // are unavailable (< 20 observations). The SQL now omits the params
    // entirely, but old URLs may have &nsl=&nsr= with empty values.
    const url =
      'https://signal.stroma.design/r?mode=production&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&nse=0,0,30,60,10&nsv=90&nsd=5&nsl=&nsr=';
    const decoded = decodeSignalReportUrl(url);

    expect(decoded.network_signals).toBeDefined();
    expect(decoded.network_signals?.downlink_mbps).toBeNull();
    expect(decoded.network_signals?.rtt_ms).toBeNull();
  });

  it('throws on malformed required numeric params instead of silently defaulting to zero', () => {
    // s=abc is a required param — must throw, not silently produce a zeroed report
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=abc&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=abc&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp'
      )
    ).toThrow('Invalid numeric value for required parameter "s"');
  });

  it('throws on malformed optional numeric params instead of coercing them to zero', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=abc&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp'
      )
    ).toThrow('Invalid numeric value for parameter "lu"');
  });

  it('throws when a present ga param is malformed', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=not-a-timestamp'
      )
    ).toThrow('Invalid numeric value for required parameter "ga"');
  });

  it('rejects out-of-range top-level coverage in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=140&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1712572800000'
      )
    ).toThrow('coverage.network_coverage');
  });

  it('rejects out-of-range vitals coverage in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=180&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1712572800000'
      )
    ).toThrow('vitals.urban.lcp_coverage');
  });

  it('rejects out-of-range experience funnel tier coverage and poor share in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1712572800000&es=fcp,lcp&ec=80&ep=20&fpt=3000&lpt=4000&ipt=500&fcs=120,80,70,60&fps=10,20,30,40&lcs=90,80,70,60&lps=10,20,30,140&ics=0,0,0,0&ips=0,0,0,0'
      )
    ).toThrow('experience_funnel.stages.fcp.tiers.urban.coverage');
  });

  it('rejects out-of-range optional device hardware percentages in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1712572800000&dhc=101,0,0,0,0,0&dhm=0,0,0,0,0,100&dhv=80'
      )
    ).toThrow('device_hardware.cores_hist.1');
  });

  it('rejects out-of-range optional network signal percentages in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1712572800000&nse=0,0,0,101,0&nsv=80&nsd=5'
      )
    ).toThrow('network_signals.effective_type_hist.4g');
  });

  it('rejects out-of-range optional environment percentages in report urls', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1712572800000&eb=0,0,0,0,101'
      )
    ).toThrow('environment.browser_hist.other');
  });

  it('throws on semantic inconsistency: race_metric without comparison tier', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=none&rm=lcp'
      )
    ).toThrow('comparison tier is "none"');
  });

  it('throws on semantic inconsistency: primary LCP race with fallback reason', () => {
    expect(() =>
      decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&rr=lcp_coverage_below_threshold'
      )
    ).toThrow('should not have a fallback reason');
  });

  it('adds missing-freshness warning for legacy URLs without ga param', () => {
    const decoded = decodeSignalReportUrl(
      'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp'
    );

    expect(decoded.warnings.length).toBeGreaterThan(0);
    expect(decoded.warnings.some((warning) => warning.includes('freshness'))).toBe(true);
  });

  it('keeps legacy rv=1 urls without additive blocks backward compatible', () => {
    const decoded = decodeSignalReportUrl(
      'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp'
    );

    expect(decoded.experience_funnel).toBeUndefined();
    expect(decoded.device_hardware).toBeUndefined();
    expect(decoded.network_signals).toBeUndefined();
    expect(decoded.environment).toBeUndefined();
  });

  it('rejects invalid diagnostic enums in canonical events and warehouse rows', () => {
    const lcpAttribution = chromeColdNavFixture.vitals.lcp_attribution;
    if (!lcpAttribution) throw new Error('Expected chromeColdNavFixture to include lcp_attribution.');

    const invalidEvent = {
      ...chromeColdNavFixture,
      meta: {
        ...chromeColdNavFixture.meta,
        navigation_type: 'soft-nav'
      },
      vitals: {
        ...chromeColdNavFixture.vitals,
        lcp_attribution: {
          ...lcpAttribution,
          load_state: 'hydrating'
        }
      }
    };
    const invalidWarehouseRow = {
      ...toSignalWarehouseRow(chromeColdNavFixture),
      interaction_type: 'tap',
      lcp_element_type: 'video'
    };

    expect(explainSignalEventIssues(invalidEvent)).toContain(
      'Expected "meta" to include pkg_version, browser, nav_type, and a valid optional navigation_type.'
    );
    expect(explainSignalWarehouseRowIssues(invalidWarehouseRow)).toContain(
      'Expected "lcp_element_type" to be image, text, or null.'
    );
    expect(explainSignalWarehouseRowIssues(invalidWarehouseRow)).toContain(
      'Expected "interaction_type" to be pointer, keyboard, or null.'
    );
  });

  it('extracts lcp_breakdown + culprit_kind + inp dominant_phase into the warehouse row', () => {
    const enrichedEvent = {
      ...chromeColdNavFixture,
      vitals: {
        ...chromeColdNavFixture.vitals,
        lcp_breakdown: {
          resource_load_delay_ms: 210,
          resource_load_time_ms: 1_480,
          element_render_delay_ms: 6_240
        },
        lcp_attribution: {
          ...(chromeColdNavFixture.vitals.lcp_attribution ?? {
            load_state: null,
            target: null,
            element_type: null,
            resource_url: null
          }),
          culprit_kind: 'hero_image' as const
        },
        inp_attribution: {
          ...(chromeColdNavFixture.vitals.inp_attribution ?? {
            load_state: null,
            interaction_target: null,
            interaction_type: null,
            interaction_time_ms: null,
            input_delay_ms: null,
            processing_duration_ms: null,
            presentation_delay_ms: null
          }),
          dominant_phase: 'processing' as const
        }
      }
    };
    const warehouseRow = toSignalWarehouseRow(enrichedEvent);

    expect(warehouseRow.lcp_breakdown_resource_load_delay_ms).toBe(210);
    expect(warehouseRow.lcp_breakdown_resource_load_time_ms).toBe(1_480);
    expect(warehouseRow.lcp_breakdown_element_render_delay_ms).toBe(6_240);
    expect(warehouseRow.lcp_attribution_culprit_kind).toBe('hero_image');
    expect(warehouseRow.inp_attribution_dominant_phase).toBe('processing');
  });

  it('leaves lcp_breakdown and enum diagnostics null in the warehouse row when capture omits them', () => {
    const warehouseRow = toSignalWarehouseRow(chromeColdNavFixture);

    expect(warehouseRow.lcp_breakdown_resource_load_delay_ms).toBeNull();
    expect(warehouseRow.lcp_breakdown_resource_load_time_ms).toBeNull();
    expect(warehouseRow.lcp_breakdown_element_render_delay_ms).toBeNull();
    expect(warehouseRow.lcp_attribution_culprit_kind).toBeNull();
    expect(warehouseRow.inp_attribution_dominant_phase).toBeNull();
  });

  it('flattens lcp_dominant_subpart + culprit + inp phase for GA4 from enriched capture', () => {
    const enrichedEvent = {
      ...chromeColdNavFixture,
      vitals: {
        ...chromeColdNavFixture.vitals,
        ttfb_ms: 813,
        lcp_breakdown: {
          resource_load_delay_ms: 210,
          resource_load_time_ms: 1_480,
          element_render_delay_ms: 6_240
        },
        lcp_attribution: {
          ...(chromeColdNavFixture.vitals.lcp_attribution ?? {
            load_state: null,
            target: null,
            element_type: null,
            resource_url: null
          }),
          culprit_kind: 'hero_image' as const
        },
        inp_attribution: {
          ...(chromeColdNavFixture.vitals.inp_attribution ?? {
            load_state: null,
            interaction_target: null,
            interaction_type: null,
            interaction_time_ms: null,
            input_delay_ms: null,
            processing_duration_ms: null,
            presentation_delay_ms: null
          }),
          dominant_phase: 'processing' as const
        }
      }
    };
    const flattened = flattenSignalEventForGa4(enrichedEvent);

    // element_render_delay is the largest of {ttfb=813, rld=210, rlt=1480, erd=6240}
    expect(flattened.lcp_dominant_subpart).toBe('element_render_delay');
    expect(flattened.lcp_culprit_kind).toBe('hero_image');
    expect(flattened.inp_dominant_phase).toBe('processing');
  });

  it('aggregates lcp_story and inp_story when observations cross the race threshold', () => {
    const events = Array.from({ length: 30 }, (_, index) => ({
      ...chromeColdNavFixture,
      event_id: `enriched_${index}`,
      ts: chromeColdNavFixture.ts + index * 1_000,
      vitals: {
        ...chromeColdNavFixture.vitals,
        ttfb_ms: 400,
        lcp_breakdown: {
          resource_load_delay_ms: 120,
          resource_load_time_ms: 880,
          element_render_delay_ms: 4_600
        },
        lcp_attribution: {
          ...(chromeColdNavFixture.vitals.lcp_attribution ?? {
            load_state: null,
            target: null,
            element_type: null,
            resource_url: null
          }),
          culprit_kind: 'hero_image' as const
        },
        inp_attribution: {
          ...(chromeColdNavFixture.vitals.inp_attribution ?? {
            load_state: null,
            interaction_target: null,
            interaction_type: null,
            interaction_time_ms: null,
            input_delay_ms: null,
            processing_duration_ms: null,
            presentation_delay_ms: null
          }),
          dominant_phase: 'processing' as const
        }
      }
    }));

    const aggregate = aggregateSignalEvents(events, 'production', chromeColdNavFixture.ts + 120_000);

    // Distribution is a time-share across subparts: {ttfb=400, rld=120, rlt=880, erd=4600}
    // totals 6000ms; element_render_delay dominates at 4600/6000 ≈ 77%.
    expect(aggregate.lcp_story).toBeDefined();
    expect(aggregate.lcp_story?.dominant_subpart).toBe('element_render_delay');
    expect(aggregate.lcp_story?.dominant_subpart_share_pct).toBe(77);
    expect(aggregate.lcp_story?.dominant_culprit_kind).toBe('hero_image');
    expect(aggregate.lcp_story?.subpart_distribution_pct?.element_render_delay).toBe(77);
    expect(aggregate.lcp_story?.subpart_distribution_pct?.resource_load_time).toBe(15);
    expect(aggregate.lcp_story?.subpart_distribution_pct?.ttfb).toBe(7);
    expect(aggregate.lcp_story?.subpart_distribution_pct?.resource_load_delay).toBe(2);

    expect(aggregate.inp_story).toBeDefined();
    expect(aggregate.inp_story?.dominant_phase).toBe('processing');
    expect(aggregate.inp_story?.dominant_phase_share_pct).toBe(100);
    expect(aggregate.inp_story?.phase_distribution_pct?.processing).toBe(100);
  });

  it('omits lcp_story / inp_story when the observation threshold is not met', () => {
    const events = Array.from({ length: SIGNAL_MIN_RACE_OBSERVATIONS - 1 }, (_, index) => ({
      ...chromeColdNavFixture,
      event_id: `thin_${index}`,
      ts: chromeColdNavFixture.ts + index * 1_000,
      vitals: {
        ...chromeColdNavFixture.vitals,
        ttfb_ms: 400,
        lcp_breakdown: {
          resource_load_delay_ms: 100,
          resource_load_time_ms: 200,
          element_render_delay_ms: 2_000
        },
        inp_attribution: {
          ...(chromeColdNavFixture.vitals.inp_attribution ?? {
            load_state: null,
            interaction_target: null,
            interaction_type: null,
            interaction_time_ms: null,
            input_delay_ms: null,
            processing_duration_ms: null,
            presentation_delay_ms: null
          }),
          dominant_phase: 'input_delay' as const
        }
      }
    }));

    const aggregate = aggregateSignalEvents(events, 'preview', chromeColdNavFixture.ts + 60_000);

    expect(aggregate.lcp_story).toBeUndefined();
    expect(aggregate.inp_story).toBeUndefined();
  });

  it('round-trips lcp_story and inp_story through the report URL codec', () => {
    const enriched = {
      ...strongLcpCoverageAggregateFixture,
      lcp_story: {
        dominant_subpart: 'element_render_delay' as const,
        dominant_subpart_share_pct: 74,
        dominant_culprit_kind: 'hero_image' as const,
        subpart_distribution_pct: {
          ttfb: 8,
          resource_load_delay: 6,
          resource_load_time: 12,
          element_render_delay: 74
        }
      },
      inp_story: {
        dominant_phase: 'processing' as const,
        dominant_phase_share_pct: 62,
        phase_distribution_pct: {
          input_delay: 14,
          processing: 62,
          presentation: 24
        }
      }
    };

    const encoded = encodeSignalReportUrl(enriched);
    const decoded = decodeSignalReportUrl(encoded.url);

    expect(decoded.lcp_story).toEqual(enriched.lcp_story);
    expect(decoded.inp_story).toEqual(enriched.inp_story);
  });

  it('leaves lcp_story and inp_story undefined when absent from the encoded URL', () => {
    const encoded = encodeSignalReportUrl(strongLcpCoverageAggregateFixture);
    const decoded = decodeSignalReportUrl(encoded.url);

    expect(decoded.lcp_story).toBeUndefined();
    expect(decoded.inp_story).toBeUndefined();
  });
});
