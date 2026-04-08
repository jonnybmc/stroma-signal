import { chromeColdNavFixture } from '@stroma-labs/signal-contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBeaconSink } from '../src/sinks/beacon.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('beacon sink', () => {
  it('uses sendBeacon when the browser accepts the payload', () => {
    const sendBeacon = vi.fn(() => true);
    const fetch = vi.fn();

    vi.stubGlobal('navigator', { sendBeacon } as Navigator);
    vi.stubGlobal('fetch', fetch);

    createBeaconSink({ endpoint: 'https://collector.example/ingest' }).handle(chromeColdNavFixture);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to keepalive fetch when sendBeacon is unavailable or rejected', async () => {
    const sendBeacon = vi.fn(() => false);
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));

    vi.stubGlobal('navigator', { sendBeacon } as Navigator);
    vi.stubGlobal('fetch', fetch);

    createBeaconSink({ endpoint: 'https://collector.example/ingest' }).handle(chromeColdNavFixture);
    await Promise.resolve();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://collector.example/ingest',
      expect.objectContaining({
        method: 'POST',
        keepalive: true
      })
    );
  });

  it('reports fallback failures through the optional error callback', async () => {
    const sendBeacon = vi.fn(() => false);
    const fetchError = new Error('collector down');
    const fetch = vi.fn(() => Promise.reject(fetchError));
    const onError = vi.fn();

    vi.stubGlobal('navigator', { sendBeacon } as Navigator);
    vi.stubGlobal('fetch', fetch);

    createBeaconSink({ endpoint: 'https://collector.example/ingest', onError }).handle(chromeColdNavFixture);
    await Promise.resolve();

    expect(onError).toHaveBeenCalledWith(fetchError, chromeColdNavFixture);
  });
});
