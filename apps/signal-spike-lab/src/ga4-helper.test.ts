import { chromeColdNavFixture } from '@stroma-labs/signal-contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

    expect(gtag).toHaveBeenCalledWith(
      'event',
      'perf_tier_report',
      expect.objectContaining({
        event_id: chromeColdNavFixture.event_id
      })
    );

    const payload = gtag.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(Object.keys(payload)).toHaveLength(22);
    expect(payload.debug_mode).toBe(true);
    expect(payload).not.toHaveProperty('device_cores');
    expect(payload).not.toHaveProperty('device_memory_gb');
    expect(payload).not.toHaveProperty('device_screen_h');
    expect(payload).not.toHaveProperty('effective_type');
    expect(payload).not.toHaveProperty('downlink_mbps');
    expect(payload).not.toHaveProperty('rtt_ms');
    expect(payload).not.toHaveProperty('save_data');
    expect(payload).not.toHaveProperty('connection_type');
    expect(payload).not.toHaveProperty('pkg_version');
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
    for (const callback of listeners.get('load') ?? []) callback();

    expect(onStateChange).toHaveBeenCalledWith('loading');
    expect(onStateChange).toHaveBeenCalledWith('ready');
  });

  it('queues bootstrap commands into dataLayer as single gtag command tuples', () => {
    const dataLayer: Array<Record<string, unknown> | unknown[] | IArguments> = [];
    const onStateChange = vi.fn();

    vi.stubGlobal('window', {
      dataLayer
    });
    vi.stubGlobal('document', {
      getElementById: () => null,
      createElement: vi.fn(() => ({
        dataset: { loaded: 'false' },
        addEventListener: vi.fn()
      })),
      head: { append: vi.fn() }
    } as unknown as Document);

    bootstrapSpikeLabGa4('G-TEST123', false, onStateChange);

    expect(Array.from(dataLayer[0] as IArguments)).toEqual(['js', expect.any(Date)]);
    expect(Array.from(dataLayer[1] as IArguments)).toEqual([
      'config',
      'G-TEST123',
      expect.objectContaining({
        send_page_view: false,
        debug_mode: true
      })
    ]);
  });
});
