import { asPercent } from '../stats.js';
import type { SignalEventV1, SignalInpPhase, SignalInpStory } from '../types.js';
import { SIGNAL_MIN_RACE_OBSERVATIONS } from '../types.js';

const INP_PHASES = ['input_delay', 'processing', 'presentation'] as const satisfies readonly SignalInpPhase[];

export interface InpStoryAccumulator {
  observations: number;
  phaseCounts: Record<SignalInpPhase, number>;
}

export function createInpStoryAccumulator(): InpStoryAccumulator {
  return {
    observations: 0,
    phaseCounts: { input_delay: 0, processing: 0, presentation: 0 }
  };
}

export function ingestInpStoryEvent(acc: InpStoryAccumulator, event: SignalEventV1): void {
  const phase = event.vitals.inp_attribution?.dominant_phase;
  if (!phase) return;
  acc.phaseCounts[phase] += 1;
  acc.observations += 1;
}

export function finalizeInpStory(acc: InpStoryAccumulator): SignalInpStory | undefined {
  if (acc.observations < SIGNAL_MIN_RACE_OBSERVATIONS) return undefined;

  const distribution = {
    input_delay: asPercent(acc.phaseCounts.input_delay, acc.observations),
    processing: asPercent(acc.phaseCounts.processing, acc.observations),
    presentation: asPercent(acc.phaseCounts.presentation, acc.observations)
  };

  let dominantPhase: SignalInpPhase = INP_PHASES[0];
  let dominantShare = distribution[INP_PHASES[0]];
  for (const phase of INP_PHASES) {
    if (distribution[phase] > dominantShare) {
      dominantPhase = phase;
      dominantShare = distribution[phase];
    }
  }

  return {
    dominant_phase: dominantShare > 0 ? dominantPhase : null,
    dominant_phase_share_pct: dominantShare > 0 ? dominantShare : null,
    phase_distribution_pct: distribution
  };
}
