import { afterEach, describe, expect, it, vi } from 'vitest';

import { chromeColdNavFixture } from '@stroma-labs/signal-contracts';

import { bootstrapSpikeLabGa4, createSpikeLabGa4Sink } from './ga4-helper.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('spike-lab ga4 helper', () => {
  it('sends perf_tier_report through gtag from the spike-lab-only sink', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', {
      gtag,
      dataLayer: []
    });

    createSpikeLabGa4Sink().handle(chromeColdNavFixture);

    expect(gtag).toHaveBeenCalledWith('event', 'perf_tier_report', expect.objectContaining({
      event_id: chromeColdNavFixture.event_id
    }));
  });

  it('attaches to an existing loading script and transitions to ready once it loads', () => {
    const listeners = new Map<string, Array<() => void>>();
    const existingScript = {
      dataset: { loaded: 'false' },
      addEventListener(type: string, callback: () => void) {
        const current = listeners.get(type) ?? [];
        current.push(callback);
        listeners.set(type, current);
      }
    } as unknown as HTMLScriptElement;
    const onStateChange = vi.fn();

    vi.stubGlobal('window', {
      dataLayer: []
    });
    vi.stubGlobal('document', {
      getElementById: () => existingScript,
      createElement: vi.fn(),
      head: { append: vi.fn() }
    } as unknown as Document);

    bootstrapSpikeLabGa4('G-TEST123', false, onStateChange);
    listeners.get('load')?.forEach((callback) => callback());

    expect(onStateChange).toHaveBeenCalledWith('loading');
    expect(onStateChange).toHaveBeenCalledWith('ready');
  });
});
