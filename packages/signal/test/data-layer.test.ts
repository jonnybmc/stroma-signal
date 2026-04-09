import { chromeColdNavFixture, flattenSignalEventForGa4, SIGNAL_GA4_EVENT_NAME } from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { createDataLayerSink } from '../src/ga4/index.js';

describe('dataLayer sink', () => {
  it('pushes flattened payloads into the dataLayer path', () => {
    const target = {} as Window & typeof globalThis;
    const sink = createDataLayerSink({ target });

    sink.handle(chromeColdNavFixture);

    const payload = (target as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer[0];
    expect(payload).toEqual(flattenSignalEventForGa4(chromeColdNavFixture));
  });

  it('appends to an existing custom data layer and respects custom event names', () => {
    const existingPayload = { event: 'existing_event' };
    const target = {
      signalLayer: [existingPayload]
    } as unknown as Window & typeof globalThis;
    const sink = createDataLayerSink({
      target,
      dataLayerName: 'signalLayer',
      eventName: 'custom_signal_event'
    });

    sink.handle(chromeColdNavFixture);
    sink.handle({
      ...chromeColdNavFixture,
      event_id: 'evt_2'
    });

    const payloads = (target as unknown as { signalLayer: Array<Record<string, unknown>> }).signalLayer;
    expect(payloads).toHaveLength(3);
    expect(payloads[0]).toBe(existingPayload);
    expect(payloads[1]?.event).toBe('custom_signal_event');
    expect(payloads[2]?.event).toBe('custom_signal_event');
    expect(payloads[1]?.event_id).toBe(chromeColdNavFixture.event_id);
    expect(payloads[2]?.event_id).toBe('evt_2');
  });

  it('defaults the event name to the canonical perf_tier_report constant', () => {
    const target = {} as Window & typeof globalThis;
    const sink = createDataLayerSink({ target });

    sink.handle(chromeColdNavFixture);

    const payload = (target as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer[0];
    expect(payload.event).toBe(SIGNAL_GA4_EVENT_NAME);
  });

  it('keeps the dataLayer payload on the compact GA4-safe subset', () => {
    const target = {} as Window & typeof globalThis;
    const sink = createDataLayerSink({ target });

    sink.handle(chromeColdNavFixture);

    const payload = (target as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer[0];
    expect(Object.keys(payload)).toHaveLength(21);
    expect(payload).not.toHaveProperty('device_cores');
    expect(payload).not.toHaveProperty('device_memory_gb');
    expect(payload).not.toHaveProperty('device_screen_w');
    expect(payload).not.toHaveProperty('device_screen_h');
    expect(payload).not.toHaveProperty('effective_type');
    expect(payload).not.toHaveProperty('downlink_mbps');
    expect(payload).not.toHaveProperty('rtt_ms');
    expect(payload).not.toHaveProperty('save_data');
    expect(payload).not.toHaveProperty('connection_type');
    expect(payload).not.toHaveProperty('pkg_version');
  });
});
