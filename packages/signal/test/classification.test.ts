import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectBrowser } from '../src/core/browser.js';
import { classifyDevice, defaultDeviceTier } from '../src/core/classify-device.js';
import { classifyNetwork, DEFAULT_NETWORK_THRESHOLDS, type NetworkSnapshot } from '../src/core/classify-network.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Browser detection
// ---------------------------------------------------------------------------
describe('detectBrowser', () => {
  it('detects Chrome', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe('chrome');
  });

  it('detects Safari (excludes Chrome/Chromium UA substrings)', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      )
    ).toBe('safari');
  });

  it('detects Firefox', () => {
    expect(detectBrowser('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0')).toBe('firefox');
  });

  it('detects Edge', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      )
    ).toBe('edge');
  });

  it('returns unknown for empty or unrecognized UA', () => {
    expect(detectBrowser('')).toBe('unknown');
    expect(detectBrowser('Googlebot/2.1')).toBe('unknown');
  });

  it('detects Chrome on iOS (UA includes both Safari/ and Chrome/)', () => {
    expect(
      detectBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1'
      )
    ).toBe('safari');
    // Note: CriOS doesn't contain 'Chrome/' — this is correct Safari detection for iOS Chrome wrapper
  });

  it('falls back gracefully when navigator is unavailable', () => {
    expect(detectBrowser(undefined as unknown as string)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Device tier classification
// ---------------------------------------------------------------------------
describe('defaultDeviceTier', () => {
  it('classifies budget mobile as low', () => {
    // 2 cores (0 pts) + null memory (excluded) + 360px screen (0 pts) = 0/6 → low
    expect(defaultDeviceTier(2, null, 360)).toBe('low');
  });

  it('classifies mid-range device as mid', () => {
    // 4 cores (1 pt) + 2GB (1 pt) + 768px (2 pts) = 4/9 → mid (≤ floor(9*2/3)=6)
    expect(defaultDeviceTier(4, 2, 768)).toBe('mid');
  });

  it('classifies high-end desktop as high', () => {
    // 8 cores (3 pts) + 8GB (3 pts) + 1920px (3 pts) = 9/9 → high
    expect(defaultDeviceTier(8, 8, 1920)).toBe('high');
  });

  it('handles null memory by using 2 dimensions', () => {
    // 8 cores (3 pts) + null memory + 1920px (3 pts) = 6/6 → high
    expect(defaultDeviceTier(8, null, 1920)).toBe('high');
    // 1 core (0 pts) + null memory + 320px (0 pts) = 0/6 → low
    expect(defaultDeviceTier(1, null, 320)).toBe('low');
  });

  it('classifies boundary cases correctly', () => {
    // 2 cores (0) + 1GB (0) + 479px (0) = 0/9 → low (≤ floor(9/3)=3)
    expect(defaultDeviceTier(2, 1, 479)).toBe('low');
    // 3 cores (1) + 1.5GB (1) + 480px (1) = 3/9 → low (≤ 3)
    expect(defaultDeviceTier(3, 1.5, 480)).toBe('low');
    // 3 cores (1) + 2GB (1) + 768px (2) = 4/9 → mid (> 3 && ≤ 6)
    expect(defaultDeviceTier(3, 2, 768)).toBe('mid');
  });
});

describe('classifyDevice', () => {
  it('reads navigator.hardwareConcurrency and screen dimensions', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 });
    vi.stubGlobal('screen', { width: 1440, height: 900 });

    const snapshot = classifyDevice();
    expect(snapshot.device_cores).toBe(4);
    expect(snapshot.device_screen_w).toBe(1440);
    expect(snapshot.device_screen_h).toBe(900);
    expect(snapshot.device_memory_gb).toBeNull(); // no deviceMemory on this mock
  });

  it('falls back to 1 core and 0 screen when APIs unavailable', () => {
    vi.stubGlobal('navigator', undefined);
    vi.stubGlobal('screen', undefined);

    const snapshot = classifyDevice();
    expect(snapshot.device_cores).toBe(1);
    expect(snapshot.device_screen_w).toBe(0);
    expect(snapshot.device_screen_h).toBe(0);
    expect(snapshot.device_tier).toBe('low');
  });

  it('uses override function when provided', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    vi.stubGlobal('screen', { width: 1920, height: 1080 });

    const snapshot = classifyDevice(() => 'low');
    expect(snapshot.device_tier).toBe('low');
    expect(snapshot.device_cores).toBe(8); // raw values still captured
  });

  it('reads deviceMemory on Chromium browsers', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 4 });
    vi.stubGlobal('screen', { width: 1920, height: 1080 });

    const snapshot = classifyDevice();
    expect(snapshot.device_memory_gb).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Network tier classification
// ---------------------------------------------------------------------------
describe('classifyNetwork', () => {
  function makeNavTiming(overrides: Partial<PerformanceNavigationTiming> = {}): PerformanceNavigationTiming {
    return {
      connectStart: 100,
      connectEnd: 130,
      secureConnectionStart: 110,
      workerStart: 0,
      ...overrides
    } as PerformanceNavigationTiming;
  }

  it('returns unavailable_missing_timing when navigation entry is null', () => {
    const result = classifyNetwork(null, DEFAULT_NETWORK_THRESHOLDS);
    expect(result).toEqual<NetworkSnapshot>({
      net_tier: null,
      net_tcp_ms: null,
      net_tcp_source: 'unavailable_missing_timing'
    });
  });

  it('returns unavailable_sw when workerStart > 0', () => {
    const result = classifyNetwork(makeNavTiming({ workerStart: 50 }), DEFAULT_NETWORK_THRESHOLDS);
    expect(result.net_tcp_source).toBe('unavailable_sw');
    expect(result.net_tier).toBeNull();
  });

  it('returns unavailable_reused when connectEnd - connectStart <= 0', () => {
    const result = classifyNetwork(
      makeNavTiming({ connectStart: 100, connectEnd: 100, secureConnectionStart: 0 }),
      DEFAULT_NETWORK_THRESHOLDS
    );
    expect(result.net_tcp_source).toBe('unavailable_reused');
    expect(result.net_tier).toBeNull();
  });

  it('returns unavailable_tls_coalesced when secureConnectionStart === connectStart', () => {
    const result = classifyNetwork(
      makeNavTiming({ connectStart: 100, connectEnd: 200, secureConnectionStart: 100 }),
      DEFAULT_NETWORK_THRESHOLDS
    );
    expect(result.net_tcp_source).toBe('unavailable_tls_coalesced');
    expect(result.net_tier).toBeNull();
  });

  it('returns nav_timing_tcp_isolated with urban tier for fast TCP', () => {
    // secureConnectionStart - connectStart = 120 - 100 = 20ms → urban (<50)
    const result = classifyNetwork(
      makeNavTiming({ connectStart: 100, connectEnd: 200, secureConnectionStart: 120 }),
      DEFAULT_NETWORK_THRESHOLDS
    );
    expect(result.net_tcp_source).toBe('nav_timing_tcp_isolated');
    expect(result.net_tier).toBe('urban');
    expect(result.net_tcp_ms).toBe(20);
  });

  it('returns nav_timing_tcp_isolated with constrained tier for slow TCP', () => {
    // secureConnectionStart - connectStart = 600 - 100 = 500ms → constrained (>400)
    const result = classifyNetwork(
      makeNavTiming({ connectStart: 100, connectEnd: 700, secureConnectionStart: 600 }),
      DEFAULT_NETWORK_THRESHOLDS
    );
    expect(result.net_tcp_source).toBe('nav_timing_tcp_isolated');
    expect(result.net_tier).toBe('constrained');
    expect(result.net_tcp_ms).toBe(500);
  });

  it('returns nav_timing_full when secureConnectionStart is 0', () => {
    // connectEnd - connectStart = 230 - 100 = 130ms → moderate (50-150)
    const result = classifyNetwork(
      makeNavTiming({ connectStart: 100, connectEnd: 230, secureConnectionStart: 0 }),
      DEFAULT_NETWORK_THRESHOLDS
    );
    expect(result.net_tcp_source).toBe('nav_timing_full');
    expect(result.net_tier).toBe('moderate');
    expect(result.net_tcp_ms).toBe(130);
  });

  it('classifies all 4 tier boundaries correctly', () => {
    // Use nav_timing_full path (secureConnectionStart=0) so connectEnd-connectStart = tcpMs
    const classify = (tcpMs: number) =>
      classifyNetwork(
        makeNavTiming({ connectStart: 100, connectEnd: 100 + tcpMs, secureConnectionStart: 0 }),
        DEFAULT_NETWORK_THRESHOLDS
      ).net_tier;

    expect(classify(1)).toBe('urban'); // 1ms < 50 → urban
    expect(classify(49)).toBe('urban'); // 49ms < 50 → urban
    expect(classify(50)).toBe('moderate'); // 50ms → moderate
    expect(classify(150)).toBe('moderate'); // 150ms → moderate
    expect(classify(151)).toBe('constrained_moderate'); // 151ms → constrained_moderate
    expect(classify(400)).toBe('constrained_moderate'); // 400ms → constrained_moderate
    expect(classify(401)).toBe('constrained'); // 401ms → constrained
  });

  it('respects custom threshold overrides', () => {
    const custom = { urban: 20, moderate: 80, constrained_moderate: 200 };
    const result = classifyNetwork(
      makeNavTiming({ connectStart: 100, connectEnd: 200, secureConnectionStart: 0 }),
      custom
    );
    // connectEnd - connectStart = 100ms → > 80, ≤ 200 → constrained_moderate
    expect(result.net_tier).toBe('constrained_moderate');
  });
});
