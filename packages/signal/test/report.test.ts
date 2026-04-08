import { describe, expect, it } from 'vitest';

import { chromeColdNavFixture, previewAggregateFixture } from '@stroma-labs/signal-contracts';

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
});
