import { describe, expect, it } from 'vitest';

import {
  aggregateSignalEvents,
  chooseRaceMetric,
  chromeColdNavFixture,
  decodeSignalReportUrl,
  encodeSignalReportUrl,
  explainSignalAggregateIssues,
  explainSignalEventIssues,
  explainSignalWarehouseRowIssues,
  fcpFallbackAggregateFixture,
  flattenSignalEventForGa4,
  highUnclassifiedShareAggregateFixture,
  mixedLifecycleAggregateFixture,
  prerenderLifecycleFixture,
  previewAggregateFixture,
  restoreLifecycleFixture,
  SIGNAL_GA4_EVENT_NAME,
  safariFallbackFixture,
  safariHeavyAggregateFixture,
  signalReportScenarioFixtures,
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
  });

  it('rejects invalid enum values in report urls', () => {
    expect(() =>
      decodeSignalReportUrl('https://signal.stroma.design/r?nt=20,20,20,20,20&dt=34,33,33&ct=%3Cscript%3E&rm=none')
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

  it('flattens canonical events for ga4 without renaming the event', () => {
    const flattened = flattenSignalEventForGa4(chromeColdNavFixture);

    expect(flattened.event).toBe(SIGNAL_GA4_EVENT_NAME);
    expect(flattened.net_tier).toBe(chromeColdNavFixture.net_tier);
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

  it('ships scenario fixtures that cover the intended report fallbacks and edge cases', () => {
    expect(signalReportScenarioFixtures.map((fixture) => fixture.id)).toEqual([
      'preview',
      'mixed-lifecycle',
      'strong-lcp',
      'fcp-fallback',
      'ttfb-fallback',
      'insufficient-race',
      'high-unclassified',
      'safari-heavy'
    ]);
    expect(mixedLifecycleAggregateFixture.sample_size).toBe(1);
    expect(strongLcpCoverageAggregateFixture.race_metric).toBe('lcp');
    expect(fcpFallbackAggregateFixture.race_metric).toBe('fcp');
    expect(ttfbFallbackAggregateFixture.race_metric).toBe('ttfb');
    expect(highUnclassifiedShareAggregateFixture.coverage.unclassified_network_share).toBeGreaterThan(50);
    expect(safariHeavyAggregateFixture.coverage.lcp_coverage).toBeLessThan(25);
  });

  it('explains invalid aggregate input with actionable contract issues', () => {
    expect(explainSignalAggregateIssues({ foo: 'bar' })).toContain('Expected "v" to be 1.');
    expect(explainSignalAggregateIssues(previewAggregateFixture)).toEqual([]);
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
});
