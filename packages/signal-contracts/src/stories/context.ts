import { asPercent } from '../stats.js';
import type { SignalContextStory, SignalEffectiveTypeDominant, SignalNetworkSignals } from '../types.js';

// Act 1 context story — surfaces four already-captured signals
// (save-data share, median RTT, cellular share, dominant effective_type)
// as narrative audience reality. Does not gate on SIGNAL_MIN_RACE_OBSERVATIONS
// because it piggybacks on the same per-session context already used to
// compute `network_signals`; the view-model layer applies the narrate/omit
// thresholds per field (see SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT and
// SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT). Returns undefined only when the
// sample carried zero contributing rows — below that every downstream
// omission is enforced by line-level nullability, not block-level absence.
export interface ContextStoryInput {
  total: number;
  saveDataCount: number;
  cellularCount: number;
  rttMedianMs: number | null;
  effectiveTypeCounters: SignalNetworkSignals['effective_type_hist'];
}

export function finalizeContextStory(input: ContextStoryInput): SignalContextStory | undefined {
  if (input.total <= 0) return undefined;

  const { effectiveTypeCounters } = input;
  const effectiveKeys: SignalEffectiveTypeDominant[] = ['4g', '3g', '2g', 'slow-2g', 'unknown'];
  const counterByKey: Record<SignalEffectiveTypeDominant, number> = {
    '4g': effectiveTypeCounters['4g'],
    '3g': effectiveTypeCounters['3g'],
    '2g': effectiveTypeCounters['2g'],
    'slow-2g': effectiveTypeCounters.slow_2g,
    unknown: effectiveTypeCounters.unknown
  };

  let dominantEffective: SignalEffectiveTypeDominant | null = null;
  let dominantCount = 0;
  for (const key of effectiveKeys) {
    if (counterByKey[key] > dominantCount) {
      dominantEffective = key;
      dominantCount = counterByKey[key];
    }
  }

  return {
    save_data_share_pct: asPercent(input.saveDataCount, input.total),
    median_rtt_ms: input.rttMedianMs,
    cellular_share_pct: asPercent(input.cellularCount, input.total),
    effective_type_dominant: dominantEffective
  };
}
