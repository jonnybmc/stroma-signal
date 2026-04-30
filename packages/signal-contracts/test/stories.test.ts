import { describe, expect, it } from 'vitest';
import type { SignalEventV1 } from '../src/index.js';
import { chromeColdNavFixture, classifyThirdPartyShareTier, SIGNAL_MIN_RACE_OBSERVATIONS } from '../src/index.js';
// Story accumulators are deliberately internal — not part of the public
// barrel. Reach in directly so the unit-test surface matches the
// internal-module contract rather than expanding the public API.
import {
  createInpStoryAccumulator,
  createLcpStoryAccumulator,
  createLoafStoryAccumulator,
  createThirdPartyStoryAccumulator,
  finalizeContextStory,
  finalizeInpStory,
  finalizeLcpStory,
  finalizeLoafStory,
  finalizeThirdPartyStory,
  ingestInpStoryEvent,
  ingestLcpStoryEvent,
  ingestLoafStoryEvent,
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
