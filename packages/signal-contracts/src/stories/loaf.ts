import { asPercent, percentile } from '../stats.js';
import type { SignalEventV1, SignalLoafCause, SignalLoafStory } from '../types.js';
import { SIGNAL_MIN_RACE_OBSERVATIONS } from '../types.js';

// LoAF worst-frame story. `script | layout | style | paint` mirrors the
// capture-side attribution so aggregation and SDK label the same frames
// the same way. Gated on SIGNAL_MIN_RACE_OBSERVATIONS to avoid narrating
// a single stray long frame.
const LOAF_CAUSES = ['script', 'layout', 'style', 'paint'] as const satisfies readonly SignalLoafCause[];
const ZERO_LOAF_CAUSE_COUNTS: Record<SignalLoafCause, number> = {
  script: 0,
  layout: 0,
  style: 0,
  paint: 0
};

export interface LoafStoryAccumulator {
  observations: number;
  causeCounts: Record<SignalLoafCause, number>;
  worstDurationSamples: number[];
}

export function createLoafStoryAccumulator(): LoafStoryAccumulator {
  return {
    observations: 0,
    causeCounts: { ...ZERO_LOAF_CAUSE_COUNTS },
    worstDurationSamples: []
  };
}

export function ingestLoafStoryEvent(acc: LoafStoryAccumulator, event: SignalEventV1): void {
  const loaf = event.vitals.loaf;
  if (!loaf) return;
  const cause = loaf.dominant_cause;
  if (!cause) return;
  acc.observations += 1;
  acc.causeCounts[cause] += 1;
  if (loaf.worst_duration_ms != null && Number.isFinite(loaf.worst_duration_ms) && loaf.worst_duration_ms >= 0) {
    acc.worstDurationSamples.push(loaf.worst_duration_ms);
  }
}

export function finalizeLoafStory(acc: LoafStoryAccumulator): SignalLoafStory | undefined {
  if (acc.observations < SIGNAL_MIN_RACE_OBSERVATIONS) return undefined;

  let dominantCause: SignalLoafCause = LOAF_CAUSES[0];
  let dominantCount = acc.causeCounts[LOAF_CAUSES[0]];
  for (const cause of LOAF_CAUSES) {
    if (acc.causeCounts[cause] > dominantCount) {
      dominantCause = cause;
      dominantCount = acc.causeCounts[cause];
    }
  }

  return {
    dominant_cause: dominantCount > 0 ? dominantCause : null,
    dominant_cause_share_pct: asPercent(dominantCount, acc.observations),
    worst_frame_ms_p75: percentile(acc.worstDurationSamples, 0.75)
  };
}
