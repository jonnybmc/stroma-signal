import { chromeColdNavFixture, previewAggregateFixture } from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { createPreviewCollector } from '../src/report/index.js';

describe('preview collector', () => {
  it('generates a preview url from collected events', () => {
    const collector = createPreviewCollector();
    collector.handle(chromeColdNavFixture);

    const report = collector.getReportUrl();
    expect(report.url).toContain('https://signal.stroma.design/r?');
    expect(report.mode).toBe('preview');
  });

  it('preserves warnings from aggregate generation', () => {
    const collector = createPreviewCollector();
    for (let index = 0; index < previewAggregateFixture.sample_size; index += 1) {
      collector.handle({
        ...chromeColdNavFixture,
        event_id: `evt_${index}`,
        ts: chromeColdNavFixture.ts + index
      });
    }

    expect(collector.getAggregate()?.sample_size).toBe(previewAggregateFixture.sample_size);
  });

  it('stores an internal copy so later caller mutations do not rewrite preview history', () => {
    const collector = createPreviewCollector();
    const event = {
      ...chromeColdNavFixture,
      meta: { ...chromeColdNavFixture.meta }
    };

    collector.handle(event);
    event.meta.browser = 'mutated-browser';

    expect(collector.getEvents()[0]?.meta.browser).toBe(chromeColdNavFixture.meta.browser);
  });

  it('getSummary returns null before any events are collected', () => {
    const collector = createPreviewCollector();
    expect(collector.getSummary()).toBeNull();
  });

  it('getSummary returns a non-empty string after events are collected', () => {
    const collector = createPreviewCollector();
    collector.handle(chromeColdNavFixture);
    const summary = collector.getSummary();
    expect(summary).toBeTypeOf('string');
    expect(summary).not.toBeNull();
    expect(summary?.length).toBeGreaterThan(0);
    expect(summary).toContain('Signal Report');
  });

  it('exportEvents produces valid JSON', () => {
    const collector = createPreviewCollector();
    collector.handle(chromeColdNavFixture);
    const json = collector.exportEvents('json');
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].event_id).toBe('evt_chrome_cold_nav');
  });

  it('exportEvents produces valid CSV with header and data row', () => {
    const collector = createPreviewCollector();
    collector.handle(chromeColdNavFixture);
    const csv = collector.exportEvents('csv');
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('event_id');
    expect(lines[1]).toContain('evt_chrome_cold_nav');
  });

  it('exportEvents returns header-only CSV when no events collected', () => {
    const collector = createPreviewCollector();
    const csv = collector.exportEvents('csv');
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('event_id');
  });
});
