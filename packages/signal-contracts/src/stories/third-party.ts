import { asPercent, median } from '../stats.js';
import type { SignalEventV1, SignalThirdPartyStory, SignalThirdPartyTier } from '../types.js';
import { SIGNAL_MIN_RACE_OBSERVATIONS } from '../types.js';

// Third-party pre-paint script weight story. Tier assignment mirrors the
// capture-side bucketing so aggregation and GA4 label the same span of
// shares the same way.
const THIRD_PARTY_TIERS = ['none', 'light', 'moderate', 'heavy'] as const satisfies readonly SignalThirdPartyTier[];
const ZERO_THIRD_PARTY_TIER_COUNTS: Record<SignalThirdPartyTier, number> = {
  none: 0,
  light: 0,
  moderate: 0,
  heavy: 0
};

export function classifyThirdPartyShareTier(share: number | null | undefined): SignalThirdPartyTier | null {
  if (share == null || Number.isNaN(share) || share < 0) return null;
  if (share === 0) return 'none';
  if (share <= 15) return 'light';
  if (share <= 40) return 'moderate';
  return 'heavy';
}

export interface ThirdPartyStoryAccumulator {
  shareSamples: number[];
  originSamples: number[];
  tierCounts: Record<SignalThirdPartyTier, number>;
  observations: number;
}

export function createThirdPartyStoryAccumulator(): ThirdPartyStoryAccumulator {
  return {
    shareSamples: [],
    originSamples: [],
    tierCounts: { ...ZERO_THIRD_PARTY_TIER_COUNTS },
    observations: 0
  };
}

export function ingestThirdPartyStoryEvent(acc: ThirdPartyStoryAccumulator, event: SignalEventV1): void {
  const tp = event.vitals.third_party;
  if (!tp) return;
  const share = tp.pre_lcp_script_share_pct;
  if (share == null) return;
  const tier = classifyThirdPartyShareTier(share);
  if (tier == null) return;

  acc.observations += 1;
  acc.shareSamples.push(share);
  acc.tierCounts[tier] += 1;
  if (tp.origin_count != null && tp.origin_count >= 0) {
    acc.originSamples.push(tp.origin_count);
  }
}

export function finalizeThirdPartyStory(acc: ThirdPartyStoryAccumulator): SignalThirdPartyStory | undefined {
  if (acc.observations < SIGNAL_MIN_RACE_OBSERVATIONS) return undefined;

  let dominantTier: SignalThirdPartyTier = THIRD_PARTY_TIERS[0];
  let dominantCount = acc.tierCounts[THIRD_PARTY_TIERS[0]];
  for (const tier of THIRD_PARTY_TIERS) {
    if (acc.tierCounts[tier] > dominantCount) {
      dominantTier = tier;
      dominantCount = acc.tierCounts[tier];
    }
  }

  return {
    median_share_pct: median(acc.shareSamples),
    dominant_tier: dominantCount > 0 ? dominantTier : null,
    dominant_tier_share_pct: asPercent(dominantCount, acc.observations),
    median_origin_count: median(acc.originSamples)
  };
}
