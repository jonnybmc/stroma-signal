import { asPercent } from '../stats.js';
import type { SignalEventV1, SignalLcpCulpritKind, SignalLcpStory, SignalLcpSubpart } from '../types.js';
import { SIGNAL_MIN_RACE_OBSERVATIONS } from '../types.js';

const LCP_SUBPARTS = [
  'ttfb',
  'resource_load_delay',
  'resource_load_time',
  'element_render_delay'
] as const satisfies readonly SignalLcpSubpart[];

const ZERO_LCP_CULPRIT_COUNTS: Record<SignalLcpCulpritKind, number> = {
  hero_image: 0,
  headline_text: 0,
  banner_image: 0,
  product_image: 0,
  video_poster: 0,
  unknown: 0
};

export interface LcpStoryAccumulator {
  observations: number;
  subpartSums: Record<SignalLcpSubpart, number>;
  culpritCounts: Record<SignalLcpCulpritKind, number>;
  culpritObservations: number;
}

export function createLcpStoryAccumulator(): LcpStoryAccumulator {
  return {
    observations: 0,
    subpartSums: {
      ttfb: 0,
      resource_load_delay: 0,
      resource_load_time: 0,
      element_render_delay: 0
    },
    culpritCounts: { ...ZERO_LCP_CULPRIT_COUNTS },
    culpritObservations: 0
  };
}

export function ingestLcpStoryEvent(acc: LcpStoryAccumulator, event: SignalEventV1): void {
  const culprit = event.vitals.lcp_attribution?.culprit_kind;
  if (culprit && culprit in acc.culpritCounts) {
    acc.culpritCounts[culprit] += 1;
    acc.culpritObservations += 1;
  }

  const breakdown = event.vitals.lcp_breakdown;
  const ttfb = event.vitals.ttfb_ms;
  if (!breakdown || ttfb == null) return;
  const { resource_load_delay_ms, resource_load_time_ms, element_render_delay_ms } = breakdown;
  if (resource_load_delay_ms == null || resource_load_time_ms == null || element_render_delay_ms == null) return;

  acc.observations += 1;
  acc.subpartSums.ttfb += ttfb;
  acc.subpartSums.resource_load_delay += resource_load_delay_ms;
  acc.subpartSums.resource_load_time += resource_load_time_ms;
  acc.subpartSums.element_render_delay += element_render_delay_ms;
}

export function finalizeLcpStory(acc: LcpStoryAccumulator): SignalLcpStory | undefined {
  if (acc.observations < SIGNAL_MIN_RACE_OBSERVATIONS) return undefined;

  const total =
    acc.subpartSums.ttfb +
    acc.subpartSums.resource_load_delay +
    acc.subpartSums.resource_load_time +
    acc.subpartSums.element_render_delay;
  if (total <= 0) return undefined;

  const distribution = {
    ttfb: asPercent(acc.subpartSums.ttfb, total),
    resource_load_delay: asPercent(acc.subpartSums.resource_load_delay, total),
    resource_load_time: asPercent(acc.subpartSums.resource_load_time, total),
    element_render_delay: asPercent(acc.subpartSums.element_render_delay, total)
  };

  let dominantSubpart: SignalLcpSubpart = LCP_SUBPARTS[0];
  let dominantShare = distribution[LCP_SUBPARTS[0]];
  for (const subpart of LCP_SUBPARTS) {
    if (distribution[subpart] > dominantShare) {
      dominantSubpart = subpart;
      dominantShare = distribution[subpart];
    }
  }

  let dominantCulprit: SignalLcpCulpritKind | null = null;
  let dominantCulpritCount = 0;
  for (const kind of Object.keys(acc.culpritCounts) as SignalLcpCulpritKind[]) {
    if (acc.culpritCounts[kind] > dominantCulpritCount) {
      dominantCulprit = kind;
      dominantCulpritCount = acc.culpritCounts[kind];
    }
  }

  return {
    dominant_subpart: dominantShare > 0 ? dominantSubpart : null,
    dominant_subpart_share_pct: dominantShare > 0 ? dominantShare : null,
    dominant_culprit_kind: dominantCulprit,
    subpart_distribution_pct: distribution
  };
}
