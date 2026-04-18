import { chromeColdNavFixture } from '@stroma-labs/signal-contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readSignalContext } from '../src/core/context.js';
import { createEventId } from '../src/core/create-event-id.js';
import { createCallbackSink } from '../src/sinks/callback.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Network context reading
// ---------------------------------------------------------------------------
describe('readSignalContext', () => {
  it('reads all fields from navigator.connection when available', () => {
    vi.stubGlobal('navigator', {
      connection: {
        effectiveType: '4g',
        downlink: 10.5,
        rtt: 50,
        saveData: false,
        type: 'wifi'
      }
    });

    const ctx = readSignalContext();
    expect(ctx.effective_type).toBe('4g');
    expect(ctx.downlink_mbps).toBe(10.5);
    expect(ctx.rtt_ms).toBe(50);
    expect(ctx.save_data).toBe(false);
    expect(ctx.connection_type).toBe('wifi');
  });

  it('returns all null when navigator.connection is unavailable (Safari/Firefox)', () => {
    vi.stubGlobal('navigator', {});

    const ctx = readSignalContext();
    expect(ctx.effective_type).toBeNull();
    expect(ctx.downlink_mbps).toBeNull();
    expect(ctx.rtt_ms).toBeNull();
    expect(ctx.save_data).toBeNull();
    expect(ctx.connection_type).toBeNull();
  });

  it('handles partial connection object gracefully', () => {
    vi.stubGlobal('navigator', {
      connection: {
        effectiveType: '3g'
        // downlink, rtt, saveData, type all missing
      }
    });

    const ctx = readSignalContext();
    expect(ctx.effective_type).toBe('3g');
    expect(ctx.downlink_mbps).toBeNull();
    expect(ctx.rtt_ms).toBeNull();
    expect(ctx.save_data).toBeNull();
    expect(ctx.connection_type).toBeNull();
  });

  it('returns all null when navigator itself is unavailable', () => {
    vi.stubGlobal('navigator', undefined);

    const ctx = readSignalContext();
    expect(ctx.effective_type).toBeNull();
    expect(ctx.downlink_mbps).toBeNull();
  });

  it('captures visibility_hidden_at_load=false when the document is visible', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { visibilityState: 'visible' });

    const ctx = readSignalContext();
    expect(ctx.visibility_hidden_at_load).toBe(false);
  });

  it('captures visibility_hidden_at_load=true when the document is hidden', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', { visibilityState: 'hidden' });

    const ctx = readSignalContext();
    expect(ctx.visibility_hidden_at_load).toBe(true);
  });

  it('defaults visibility_hidden_at_load to false when document is unavailable', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('document', undefined);

    const ctx = readSignalContext();
    expect(ctx.visibility_hidden_at_load).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Event ID generation
// ---------------------------------------------------------------------------
describe('createEventId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' });

    expect(createEventId()).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('falls back to timestamp-based ID when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});

    const id = createEventId();
    expect(id).toMatch(/^signal_\d+_[a-z0-9]+$/);
  });

  it('falls back when crypto is entirely unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    const id = createEventId();
    expect(id).toMatch(/^signal_\d+_[a-z0-9]+$/);
  });
});

// ---------------------------------------------------------------------------
// Callback sink
// ---------------------------------------------------------------------------
describe('createCallbackSink', () => {
  it('forwards the event to the onReport callback', () => {
    const onReport = vi.fn();
    const sink = createCallbackSink({ onReport });

    sink.handle(chromeColdNavFixture);

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledWith(chromeColdNavFixture);
  });

  it('has the id "callback"', () => {
    const sink = createCallbackSink({ onReport: vi.fn() });
    expect(sink.id).toBe('callback');
  });

  it('returns the callback return value for async sinks', async () => {
    const onReport = vi.fn(() => Promise.resolve());
    const sink = createCallbackSink({ onReport });

    const result = sink.handle(chromeColdNavFixture);
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(onReport).toHaveBeenCalledTimes(1);
  });
});
