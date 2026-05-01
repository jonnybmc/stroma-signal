import { describe, expect, it } from 'vitest';

import { deriveNavigationTiming, duration } from '../src/core/observe-vitals.js';

// Type helper to build a hand-crafted PerformanceNavigationTiming-like
// object without all the inherited PerformanceEntry fields. Tests pass
// fixtures cast through `unknown` to a minimally-typed object so the
// derive function sees what real browsers expose.
type FakeNavigationTiming = Partial<PerformanceNavigationTiming> & {
  firstInterimResponseStart?: number;
  finalResponseHeadersStart?: number;
  deliveryType?: string;
  responseStatus?: number;
  contentEncoding?: string;
  activationStart?: number;
};

function navEntry(overrides: FakeNavigationTiming): PerformanceNavigationTiming {
  // Cast through unknown — fixtures don't need every PerformanceEntry
  // property, only the Navigation Timing fields the derive function
  // reads. The local extended-DOM type in observe-vitals.ts handles
  // the optional/missing-field branches.
  return overrides as unknown as PerformanceNavigationTiming;
}

describe('duration() helper — guardrails', () => {
  it('returns null on null / undefined inputs', () => {
    expect(duration(undefined, 100)).toBeNull();
    expect(duration(100, undefined)).toBeNull();
    expect(duration(undefined, undefined)).toBeNull();
  });

  it('returns null on NaN / Infinity / -Infinity', () => {
    expect(duration(Number.NaN, 100)).toBeNull();
    expect(duration(100, Number.NaN)).toBeNull();
    expect(duration(Number.POSITIVE_INFINITY, 100)).toBeNull();
    expect(duration(100, Number.POSITIVE_INFINITY)).toBeNull();
    expect(duration(Number.NEGATIVE_INFINITY, 100)).toBeNull();
  });

  it('returns null when end < start (timestamp-order pathology)', () => {
    expect(duration(200, 100)).toBeNull();
    expect(duration(100.5, 100.4)).toBeNull();
  });

  it('returns null when start === 0 by default', () => {
    expect(duration(0, 100)).toBeNull();
  });

  it('returns rounded duration when start === 0 with allowZeroStart', () => {
    expect(duration(0, 100, { allowZeroStart: true })).toBe(100);
    expect(duration(0, 100.4, { allowZeroStart: true })).toBe(100);
    expect(duration(0, 100.6, { allowZeroStart: true })).toBe(101);
  });

  it('returns rounded positive duration on the happy path', () => {
    expect(duration(50, 150)).toBe(100);
    expect(duration(50, 150.4)).toBe(100);
    expect(duration(50, 150.6)).toBe(101);
  });

  it('returns 0 when start === end and allowZeroStart is true (degenerate but valid)', () => {
    expect(duration(0, 0, { allowZeroStart: true })).toBe(0);
    expect(duration(100, 100)).toBe(0);
  });
});

describe('deriveNavigationTiming() — block-level behavior', () => {
  it('returns null when navigation entry is null', () => {
    expect(deriveNavigationTiming(null)).toBeNull();
  });

  it('returns a fully-null block when every input is undefined', () => {
    const result = deriveNavigationTiming(navEntry({}));
    expect(result).not.toBeNull();
    expect(result?.dns_ms).toBeNull();
    expect(result?.tcp_ms).toBeNull();
    expect(result?.tls_ms).toBeNull();
    expect(result?.next_hop_protocol).toBeNull();
    expect(result?.transfer_size).toBeNull();
    expect(result?.provenance.early_hints_present).toBeNull();
  });

  it('does not throw on hostile inputs (negative / Infinity / NaN)', () => {
    expect(() =>
      deriveNavigationTiming(
        navEntry({
          startTime: Number.NaN,
          responseStart: Number.POSITIVE_INFINITY,
          requestStart: -100,
          domainLookupStart: Number.NEGATIVE_INFINITY
        })
      )
    ).not.toThrow();
    const result = deriveNavigationTiming(
      navEntry({
        startTime: Number.NaN,
        responseStart: Number.POSITIVE_INFINITY,
        requestStart: -100,
        domainLookupStart: Number.NEGATIVE_INFINITY
      })
    );
    // Every derived duration should be null because at least one input
    // is invalid. None should be NaN or Infinity.
    expect(result?.dns_ms).toBeNull();
    expect(result?.request_to_first_byte_ms).toBeNull();
    expect(result?.nav_ttfb_ms).toBeNull();
  });
});

describe('deriveNavigationTiming() — per-subpart matrix', () => {
  it('happy path: DNS + TCP + TLS + request + response all populated', () => {
    const result = deriveNavigationTiming(
      navEntry({
        startTime: 0,
        domainLookupStart: 10,
        domainLookupEnd: 30,
        connectStart: 30,
        secureConnectionStart: 50,
        connectEnd: 80,
        requestStart: 100,
        responseStart: 200,
        responseEnd: 300,
        nextHopProtocol: 'h3'
      })
    );
    expect(result?.dns_ms).toBe(20);
    expect(result?.tcp_ms).toBe(50);
    expect(result?.tls_ms).toBe(30);
    expect(result?.request_to_first_byte_ms).toBe(100);
    expect(result?.response_download_ms).toBe(100);
    expect(result?.nav_ttfb_ms).toBe(200);
    expect(result?.connection_ttfb_ms).toBe(190);
    expect(result?.next_hop_protocol).toBe('h3');
  });

  it('reused connection: DNS + TCP + TLS all null but request/response still measured', () => {
    const result = deriveNavigationTiming(
      navEntry({
        startTime: 0,
        domainLookupStart: 0,
        domainLookupEnd: 0,
        connectStart: 0,
        connectEnd: 0,
        secureConnectionStart: 0,
        requestStart: 100,
        responseStart: 200,
        responseEnd: 300
      })
    );
    expect(result?.dns_ms).toBeNull();
    expect(result?.tcp_ms).toBeNull();
    expect(result?.tls_ms).toBeNull();
    expect(result?.request_to_first_byte_ms).toBe(100);
    expect(result?.response_download_ms).toBe(100);
  });

  it('TLS-coalesced (secureConnectionStart === connectStart): tls_ms is null, not negative', () => {
    const result = deriveNavigationTiming(
      navEntry({
        connectStart: 100,
        secureConnectionStart: 100,
        connectEnd: 150
      })
    );
    expect(result?.tls_ms).toBeNull();
    expect(result?.tcp_ms).toBe(50);
  });

  it('service-worker path: service_worker_ms populated when workerStart > 0', () => {
    const result = deriveNavigationTiming(
      navEntry({
        workerStart: 50,
        fetchStart: 80
      })
    );
    expect(result?.service_worker_ms).toBe(30);
  });

  it('no service worker: service_worker_ms is null even if fetchStart > 0', () => {
    const result = deriveNavigationTiming(
      navEntry({
        workerStart: 0,
        fetchStart: 80
      })
    );
    expect(result?.service_worker_ms).toBeNull();
  });

  it('redirect_ms preserves zero (no redirect occurred — meaningful zero)', () => {
    const result = deriveNavigationTiming(
      navEntry({
        redirectStart: 0,
        redirectEnd: 0
      })
    );
    expect(result?.redirect_ms).toBe(0);
  });

  it('redirect_ms populated when a redirect was followed', () => {
    const result = deriveNavigationTiming(
      navEntry({
        redirectStart: 10,
        redirectEnd: 50
      })
    );
    expect(result?.redirect_ms).toBe(40);
  });

  it('activation_adjusted_ttfb_ms clamped to 0 when responseStart < activationStart', () => {
    // Hostile fixture: response arrived BEFORE activation (real on
    // prerendered pages where the resource is cached).
    const result = deriveNavigationTiming(
      navEntry({
        responseStart: 100,
        activationStart: 250
      })
    );
    expect(result?.activation_adjusted_ttfb_ms).toBe(0);
    expect(result?.activation_adjusted_ttfb_ms).not.toBeLessThan(0);
  });

  it('activation_adjusted_ttfb_ms returns null when activationStart === 0 (non-prerender)', () => {
    const result = deriveNavigationTiming(
      navEntry({
        responseStart: 200,
        activationStart: 0
      })
    );
    expect(result?.activation_adjusted_ttfb_ms).toBeNull();
  });

  it('activation_adjusted_ttfb_ms positive when activationStart precedes responseStart (normal prerender activation)', () => {
    const result = deriveNavigationTiming(
      navEntry({
        responseStart: 250,
        activationStart: 100
      })
    );
    expect(result?.activation_adjusted_ttfb_ms).toBe(150);
  });

  it('request_to_final_headers_ms uses finalResponseHeadersStart when exposed', () => {
    const result = deriveNavigationTiming(
      navEntry({
        requestStart: 100,
        responseStart: 150,
        firstInterimResponseStart: 150,
        finalResponseHeadersStart: 220
      })
    );
    expect(result?.request_to_first_byte_ms).toBe(50);
    expect(result?.request_to_final_headers_ms).toBe(120);
    expect(result?.interim_to_final_response_ms).toBe(70);
  });

  it('payload + protocol fields read directly when present', () => {
    const result = deriveNavigationTiming(
      navEntry({
        nextHopProtocol: 'h2',
        transferSize: 5000,
        encodedBodySize: 4500,
        decodedBodySize: 18000,
        contentEncoding: 'gzip'
      })
    );
    expect(result?.next_hop_protocol).toBe('h2');
    expect(result?.transfer_size).toBe(5000);
    expect(result?.encoded_body_size).toBe(4500);
    expect(result?.decoded_body_size).toBe(18000);
    expect(result?.content_encoding).toBe('gzip');
  });

  it('payload fields null when not exposed (extended-DOM-type guard)', () => {
    // No transferSize / encodedBodySize / decodedBodySize / contentEncoding
    // on the entry — simulates older browser or TAO-less response.
    const result = deriveNavigationTiming(navEntry({ requestStart: 100, responseStart: 200 }));
    expect(result?.next_hop_protocol).toBeNull();
    expect(result?.transfer_size).toBeNull();
    expect(result?.encoded_body_size).toBeNull();
    expect(result?.decoded_body_size).toBeNull();
    expect(result?.content_encoding).toBeNull();
  });

  it('protocol returns null on empty string (treats "" as not-exposed)', () => {
    const result = deriveNavigationTiming(navEntry({ nextHopProtocol: '' }));
    expect(result?.next_hop_protocol).toBeNull();
  });
});

describe('deriveNavigationTiming() — provenance flags', () => {
  it('early_hints_present: true when firstInterimResponseStart > 0', () => {
    const result = deriveNavigationTiming(
      navEntry({
        firstInterimResponseStart: 80,
        finalResponseHeadersStart: 150
      })
    );
    expect(result?.provenance.early_hints_present).toBe(true);
  });

  it('early_hints_present: false when only final headers seen, no interim', () => {
    const result = deriveNavigationTiming(
      navEntry({
        firstInterimResponseStart: 0,
        finalResponseHeadersStart: 150
      })
    );
    expect(result?.provenance.early_hints_present).toBe(false);
  });

  it('early_hints_present: null when neither anchor exposed', () => {
    const result = deriveNavigationTiming(navEntry({}));
    expect(result?.provenance.early_hints_present).toBeNull();
  });

  it('activation_adjusted: true on prerender (activationStart > 0)', () => {
    const result = deriveNavigationTiming(navEntry({ activationStart: 100 }));
    expect(result?.provenance.activation_adjusted).toBe(true);
  });

  it('activation_adjusted: false on regular nav (activationStart === 0)', () => {
    const result = deriveNavigationTiming(navEntry({ activationStart: 0 }));
    expect(result?.provenance.activation_adjusted).toBe(false);
  });

  it('activation_adjusted: null when API not exposed', () => {
    const result = deriveNavigationTiming(navEntry({}));
    expect(result?.provenance.activation_adjusted).toBeNull();
  });

  it('timing_redacted_suspected: true only on multi-field zero pattern (responseStart, requestStart, transferSize all 0)', () => {
    const result = deriveNavigationTiming(
      navEntry({
        responseStart: 0,
        requestStart: 0,
        transferSize: 0
      })
    );
    expect(result?.provenance.timing_redacted_suspected).toBe(true);
  });

  it('timing_redacted_suspected: false on a single zero (does NOT infer from secureConnectionStart === 0 alone)', () => {
    // requestStart populated normally → not a redaction pattern.
    const result = deriveNavigationTiming(
      navEntry({
        responseStart: 200,
        requestStart: 100,
        transferSize: 0,
        secureConnectionStart: 0
      })
    );
    expect(result?.provenance.timing_redacted_suspected).toBe(false);
  });

  it('timing_redacted_suspected: null when comparable signals unavailable', () => {
    const result = deriveNavigationTiming(navEntry({}));
    expect(result?.provenance.timing_redacted_suspected).toBeNull();
  });
});
