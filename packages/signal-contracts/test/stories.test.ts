import { describe, expect, it } from 'vitest';
import type { SignalEventV1, SignalVitalsNavigationTiming } from '../src/index.js';
import { chromeColdNavFixture, classifyThirdPartyShareTier, SIGNAL_MIN_RACE_OBSERVATIONS } from '../src/index.js';
// Story accumulators are deliberately internal — not part of the public
// barrel. Reach in directly so the unit-test surface matches the
// internal-module contract rather than expanding the public API.
import {
  createInpStoryAccumulator,
  createLcpStoryAccumulator,
  createLoafStoryAccumulator,
  createNavigationTimingStoryAccumulator,
  createThirdPartyStoryAccumulator,
  finalizeContextStory,
  finalizeInpStory,
  finalizeLcpStory,
  finalizeLoafStory,
  finalizeNavigationTimingStory,
  finalizeThirdPartyStory,
  ingestInpStoryEvent,
  ingestLcpStoryEvent,
  ingestLoafStoryEvent,
  ingestNavigationTimingStoryEvent,
  ingestThirdPartyStoryEvent
} from '../src/stories/index.js';

// Direct unit coverage for the per-story accumulators so a future split
// or rewrite has a tight, fast-running parity check that does not have
// to round-trip through the full aggregator.

function buildLcpEvent(overrides: Partial<SignalEventV1['vitals']> = {}): SignalEventV1 {
  return {
    ...chromeColdNavFixture,
    event_id: 'evt_lcp_test',
    vitals: {
      ...chromeColdNavFixture.vitals,
      ttfb_ms: 200,
      lcp_breakdown: {
        resource_load_delay_ms: 100,
        resource_load_time_ms: 600,
        element_render_delay_ms: 100
      },
      lcp_attribution: {
        load_state: 'complete',
        target: 'img',
        element_type: 'image',
        resource_url: '/hero.webp',
        culprit_kind: 'hero_image'
      },
      ...overrides
    }
  };
}

describe('stories/lcp accumulator', () => {
  it('returns undefined below SIGNAL_MIN_RACE_OBSERVATIONS', () => {
    const acc = createLcpStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS - 1; i += 1) {
      ingestLcpStoryEvent(acc, buildLcpEvent());
    }
    expect(finalizeLcpStory(acc)).toBeUndefined();
  });

  it('reports dominant_subpart and dominant_culprit_kind once enough events ingest', () => {
    const acc = createLcpStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS; i += 1) {
      ingestLcpStoryEvent(acc, buildLcpEvent());
    }
    const story = finalizeLcpStory(acc);
    expect(story).toBeDefined();
    expect(story?.dominant_subpart).toBe('resource_load_time');
    expect(story?.dominant_culprit_kind).toBe('hero_image');
    expect(story?.subpart_distribution_pct).toBeDefined();
  });

  it('skips events with missing breakdown inputs (all-or-nothing rule)', () => {
    const acc = createLcpStoryAccumulator();
    const partial = buildLcpEvent({
      lcp_breakdown: { resource_load_delay_ms: null, resource_load_time_ms: 100, element_render_delay_ms: 50 }
    });
    ingestLcpStoryEvent(acc, partial);
    expect(acc.observations).toBe(0);
  });
});

describe('stories/inp accumulator', () => {
  function buildInpEvent(phase: 'input_delay' | 'processing' | 'presentation'): SignalEventV1 {
    return {
      ...chromeColdNavFixture,
      vitals: {
        ...chromeColdNavFixture.vitals,
        inp_attribution: {
          load_state: 'interactive',
          interaction_target: 'button',
          interaction_type: 'pointer',
          interaction_time_ms: 1000,
          input_delay_ms: 10,
          processing_duration_ms: 50,
          presentation_delay_ms: 30,
          dominant_phase: phase
        }
      }
    };
  }

  it('returns undefined below threshold', () => {
    const acc = createInpStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS - 1; i += 1) {
      ingestInpStoryEvent(acc, buildInpEvent('processing'));
    }
    expect(finalizeInpStory(acc)).toBeUndefined();
  });

  it('reports the dominant phase and percentage distribution once threshold is met', () => {
    const acc = createInpStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS; i += 1) {
      ingestInpStoryEvent(acc, buildInpEvent(i % 5 === 0 ? 'input_delay' : 'processing'));
    }
    const story = finalizeInpStory(acc);
    expect(story).toBeDefined();
    expect(story?.dominant_phase).toBe('processing');
    expect(story?.phase_distribution_pct.processing).toBeGreaterThan(50);
  });

  it('ignores events without dominant_phase', () => {
    const acc = createInpStoryAccumulator();
    const eventWithoutPhase: SignalEventV1 = {
      ...chromeColdNavFixture,
      vitals: { ...chromeColdNavFixture.vitals, inp_attribution: undefined }
    };
    ingestInpStoryEvent(acc, eventWithoutPhase);
    expect(acc.observations).toBe(0);
  });
});

describe('stories/third-party classifyThirdPartyShareTier (public helper)', () => {
  it.each([
    [null, null],
    [undefined, null],
    [-1, null],
    [Number.NaN, null],
    [0, 'none'],
    [0.5, 'light'],
    [15, 'light'],
    [15.001, 'moderate'],
    [40, 'moderate'],
    [40.001, 'heavy'],
    [99, 'heavy']
  ] as const)('classifies share=%s as %s', (share, expected) => {
    expect(classifyThirdPartyShareTier(share)).toBe(expected);
  });
});

describe('stories/third-party accumulator', () => {
  function buildThirdPartyEvent(share: number, originCount: number): SignalEventV1 {
    return {
      ...chromeColdNavFixture,
      vitals: {
        ...chromeColdNavFixture.vitals,
        third_party: { pre_lcp_script_share_pct: share, origin_count: originCount }
      }
    };
  }

  it('returns undefined below threshold', () => {
    const acc = createThirdPartyStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS - 1; i += 1) {
      ingestThirdPartyStoryEvent(acc, buildThirdPartyEvent(20, 5));
    }
    expect(finalizeThirdPartyStory(acc)).toBeUndefined();
  });

  it('reports moderate dominance for a 20-30% share cohort', () => {
    const acc = createThirdPartyStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS; i += 1) {
      ingestThirdPartyStoryEvent(acc, buildThirdPartyEvent(20 + (i % 10), 5));
    }
    const story = finalizeThirdPartyStory(acc);
    expect(story).toBeDefined();
    expect(story?.dominant_tier).toBe('moderate');
    expect(story?.median_share_pct).toBeGreaterThan(0);
  });

  it('drops null shares', () => {
    const acc = createThirdPartyStoryAccumulator();
    const eventWithoutShare: SignalEventV1 = {
      ...chromeColdNavFixture,
      vitals: { ...chromeColdNavFixture.vitals, third_party: { pre_lcp_script_share_pct: null, origin_count: 5 } }
    };
    ingestThirdPartyStoryEvent(acc, eventWithoutShare);
    expect(acc.observations).toBe(0);
  });
});

describe('stories/loaf accumulator', () => {
  function buildLoafEvent(cause: 'script' | 'layout' | 'style' | 'paint', worstMs: number): SignalEventV1 {
    return {
      ...chromeColdNavFixture,
      vitals: {
        ...chromeColdNavFixture.vitals,
        loaf: { worst_duration_ms: worstMs, dominant_cause: cause, script_origin_count: 2 }
      }
    };
  }

  it('returns undefined below threshold', () => {
    const acc = createLoafStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS - 1; i += 1) {
      ingestLoafStoryEvent(acc, buildLoafEvent('script', 200));
    }
    expect(finalizeLoafStory(acc)).toBeUndefined();
  });

  it('reports script dominance and a worst_frame_ms_p75 value', () => {
    const acc = createLoafStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS; i += 1) {
      ingestLoafStoryEvent(acc, buildLoafEvent(i % 6 === 0 ? 'paint' : 'script', 200 + i * 5));
    }
    const story = finalizeLoafStory(acc);
    expect(story).toBeDefined();
    expect(story?.dominant_cause).toBe('script');
    expect(story?.worst_frame_ms_p75).toBeGreaterThan(0);
  });

  it('ignores events with null cause', () => {
    const acc = createLoafStoryAccumulator();
    const eventWithoutCause: SignalEventV1 = {
      ...chromeColdNavFixture,
      vitals: {
        ...chromeColdNavFixture.vitals,
        loaf: { worst_duration_ms: 200, dominant_cause: null, script_origin_count: null }
      }
    };
    ingestLoafStoryEvent(acc, eventWithoutCause);
    expect(acc.observations).toBe(0);
  });
});

describe('stories/context finalizer', () => {
  it('returns undefined when total is zero', () => {
    expect(
      finalizeContextStory({
        total: 0,
        saveDataCount: 0,
        cellularCount: 0,
        rttMedianMs: null,
        effectiveTypeCounters: { '4g': 0, '3g': 0, '2g': 0, slow_2g: 0, unknown: 0 }
      })
    ).toBeUndefined();
  });

  it('reports the dominant effective_type when one bucket leads', () => {
    const story = finalizeContextStory({
      total: 100,
      saveDataCount: 10,
      cellularCount: 30,
      rttMedianMs: 180,
      effectiveTypeCounters: { '4g': 60, '3g': 30, '2g': 5, slow_2g: 0, unknown: 5 }
    });
    expect(story).toBeDefined();
    expect(story?.effective_type_dominant).toBe('4g');
    expect(story?.save_data_share_pct).toBe(10);
    expect(story?.cellular_share_pct).toBe(30);
    expect(story?.median_rtt_ms).toBe(180);
  });

  it('returns null effective_type_dominant when all buckets are empty', () => {
    const story = finalizeContextStory({
      total: 100,
      saveDataCount: 0,
      cellularCount: 0,
      rttMedianMs: null,
      effectiveTypeCounters: { '4g': 0, '3g': 0, '2g': 0, slow_2g: 0, unknown: 0 }
    });
    expect(story).toBeDefined();
    expect(story?.effective_type_dominant).toBeNull();
  });
});

describe('stories/navigation-timing accumulator', () => {
  // Builder for a fully-populated nav_timing block. Caller can pass
  // overrides to null specific subparts and exercise the per-subpart
  // observation-count + strict-denominator rules.
  function buildNavTiming(overrides: Partial<SignalVitalsNavigationTiming> = {}): SignalVitalsNavigationTiming {
    return {
      dns_ms: 20,
      tcp_ms: 50,
      tls_ms: 30,
      redirect_ms: 0,
      service_worker_ms: null,
      request_to_first_byte_ms: 100,
      request_to_final_headers_ms: 110,
      response_download_ms: 80,
      interim_to_final_response_ms: 10,
      nav_ttfb_ms: 200,
      connection_ttfb_ms: 180,
      activation_adjusted_ttfb_ms: null,
      first_interim_response_start_ms: 100,
      final_response_headers_start_ms: 110,
      next_hop_protocol: 'h2',
      transfer_size: 5000,
      encoded_body_size: 4500,
      decoded_body_size: 18000,
      content_encoding: 'gzip',
      provenance: {
        early_hints_present: true,
        activation_adjusted: false,
        timing_redacted_suspected: false,
        delivery_type: null,
        response_status: 200
      },
      ...overrides
    };
  }

  function buildNavEvent(navigation_timing: SignalVitalsNavigationTiming | null): SignalEventV1 {
    return {
      ...chromeColdNavFixture,
      vitals: { ...chromeColdNavFixture.vitals, navigation_timing }
    };
  }

  it('returns undefined below SIGNAL_MIN_RACE_OBSERVATIONS', () => {
    const acc = createNavigationTimingStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS - 1; i += 1) {
      ingestNavigationTimingStoryEvent(acc, buildNavEvent(buildNavTiming()));
    }
    expect(finalizeNavigationTimingStory(acc)).toBeUndefined();
  });

  it('per-subpart observation count reflects independent absence', () => {
    const acc = createNavigationTimingStoryAccumulator();
    // 50 events: DNS null in 30 of them (reused-connection pattern);
    // request_to_first_byte populated in all 50.
    for (let i = 0; i < 50; i += 1) {
      const block = buildNavTiming({
        dns_ms: i < 20 ? 25 : null
      });
      ingestNavigationTimingStoryEvent(acc, buildNavEvent(block));
    }
    const story = finalizeNavigationTimingStory(acc);
    expect(story).toBeDefined();
    expect(story?.subparts.dns_ms.observations).toBe(20);
    expect(story?.subparts.request_to_first_byte_ms.observations).toBe(50);
    expect(story?.subparts.dns_ms.p75).toBeGreaterThan(0);
  });

  it('strict-denominator dominance: only events with all comparable subparts contribute', () => {
    const acc = createNavigationTimingStoryAccumulator();
    // 50 events. 30 have only response_download_ms populated (no dns,
    // no tcp, no tls, no redirect, no request). 20 have ALL six
    // dominance fields populated. The dominance verdict must reflect
    // only the 20-event strict cohort, not the 50-event union.
    for (let i = 0; i < 50; i += 1) {
      const block =
        i < 20
          ? buildNavTiming({
              dns_ms: 10,
              tcp_ms: 10,
              tls_ms: 10,
              redirect_ms: 0,
              request_to_first_byte_ms: 50,
              response_download_ms: 200 // dominant in this strict cohort
            })
          : buildNavTiming({
              dns_ms: null,
              tcp_ms: null,
              tls_ms: null,
              redirect_ms: null,
              request_to_first_byte_ms: null,
              response_download_ms: 5
            });
      ingestNavigationTimingStoryEvent(acc, buildNavEvent(block));
    }
    const story = finalizeNavigationTimingStory(acc);
    expect(story).toBeDefined();
    expect(story?.dominant_ttfb_subpart_strict_observations).toBe(20);
    expect(story?.dominant_ttfb_subpart).toBe('response');
  });

  it('protocol histogram counts each bucket', () => {
    const acc = createNavigationTimingStoryAccumulator();
    const protocols = ['h2', 'h2', 'h2', 'h3', 'h3', 'http/1.1', 'spdy/3', 'h2'];
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS; i += 1) {
      const proto = protocols[i % protocols.length] ?? 'h2';
      ingestNavigationTimingStoryEvent(acc, buildNavEvent(buildNavTiming({ next_hop_protocol: proto })));
    }
    const story = finalizeNavigationTimingStory(acc);
    expect(story).toBeDefined();
    const hist = story?.next_hop_protocol_histogram;
    expect(hist).toBeDefined();
    if (hist) {
      // Sum across buckets should equal the observation count.
      const total = hist.h2 + hist.h3 + hist['http/1.1'] + hist.other;
      expect(total).toBe(SIGNAL_MIN_RACE_OBSERVATIONS);
      expect(hist.h2).toBeGreaterThan(0);
      expect(hist.h3).toBeGreaterThan(0);
      expect(hist['http/1.1']).toBeGreaterThan(0);
      expect(hist.other).toBeGreaterThan(0); // 'spdy/3' falls into 'other'
    }
  });

  it('provenance roll-up: each share has its own observed-denominator', () => {
    const acc = createNavigationTimingStoryAccumulator();
    // 30 events. All have early_hints_present recorded (10 true / 20 false).
    // 20 have activation_adjusted=true, 10 have it=null (signal absent).
    // Result: early_hints_share_pct = 33 (10/30); activation share = 100 (20/20).
    for (let i = 0; i < 30; i += 1) {
      const block = buildNavTiming({
        provenance: {
          early_hints_present: i < 10,
          activation_adjusted: i < 20 ? true : null,
          timing_redacted_suspected: false,
          delivery_type: null,
          response_status: 200
        }
      });
      ingestNavigationTimingStoryEvent(acc, buildNavEvent(block));
    }
    const story = finalizeNavigationTimingStory(acc);
    expect(story).toBeDefined();
    expect(story?.provenance_roll_up.early_hints_share_pct).toBe(33);
    expect(story?.provenance_roll_up.activation_adjusted_share_pct).toBe(100);
    expect(story?.provenance_roll_up.timing_redacted_suspected_share_pct).toBe(0);
  });

  it('skips events without a navigation_timing block', () => {
    const acc = createNavigationTimingStoryAccumulator();
    ingestNavigationTimingStoryEvent(acc, buildNavEvent(null));
    expect(acc.observationsWithBlock).toBe(0);
  });

  it('dominant_ttfb_subpart returns null when all buckets summed to 0', () => {
    const acc = createNavigationTimingStoryAccumulator();
    for (let i = 0; i < SIGNAL_MIN_RACE_OBSERVATIONS; i += 1) {
      ingestNavigationTimingStoryEvent(
        acc,
        buildNavEvent(
          buildNavTiming({
            dns_ms: 0,
            tcp_ms: 0,
            tls_ms: 0,
            redirect_ms: 0,
            request_to_first_byte_ms: 0,
            response_download_ms: 0
          })
        )
      );
    }
    const story = finalizeNavigationTimingStory(acc);
    expect(story?.dominant_ttfb_subpart).toBeNull();
    expect(story?.dominant_ttfb_subpart_strict_observations).toBe(SIGNAL_MIN_RACE_OBSERVATIONS);
  });
});
