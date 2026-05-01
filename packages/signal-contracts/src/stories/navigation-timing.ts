import { asPercent, percentile } from '../stats.js';
import type {
  SignalEventV1,
  SignalNavigationTimingDominantSubpart,
  SignalNavigationTimingStory,
  SignalNavigationTimingSubpartSummary
} from '../types.js';
import { SIGNAL_MIN_RACE_OBSERVATIONS } from '../types.js';

// Navigation Timing story aggregator. Captures per-subpart distributions,
// computes a strict-denominator dominant TTFB subpart, builds a protocol
// histogram, and rolls up provenance flag shares. Gated on
// SIGNAL_MIN_RACE_OBSERVATIONS to avoid surfacing a subpart distribution
// from a single stray sample.
//
// Discipline (per `feedback_navigation_timing_discipline` memory):
//   - Per-subpart observation counts surface alongside quartiles
//     (rule #9: quartiles without coverage will overclaim).
//   - Dominance is computed under a strict denominator — only events
//     where every comparable subpart is non-null contribute (rule #8).

const SUBPART_KEYS = [
  'dns_ms',
  'tcp_ms',
  'tls_ms',
  'redirect_ms',
  'service_worker_ms',
  'request_to_first_byte_ms',
  'request_to_final_headers_ms',
  'response_download_ms',
  'nav_ttfb_ms',
  'connection_ttfb_ms',
  'activation_adjusted_ttfb_ms'
] as const satisfies readonly (keyof SignalNavigationTimingStory['subparts'])[];

// Subparts considered for the strict-denominator dominance computation.
// We exclude service_worker_ms (only present when SW intercepts) and
// the three TTFB roll-ups (they're computed FROM the subparts; using
// them in a "dominant subpart of TTFB" calc would be double-counting).
const DOMINANCE_SUBPARTS: ReadonlyArray<{
  key: 'dns_ms' | 'tcp_ms' | 'tls_ms' | 'redirect_ms' | 'request_to_first_byte_ms' | 'response_download_ms';
  bucket: SignalNavigationTimingDominantSubpart;
}> = [
  { key: 'dns_ms', bucket: 'dns' },
  { key: 'tcp_ms', bucket: 'tcp' },
  { key: 'tls_ms', bucket: 'tls' },
  { key: 'redirect_ms', bucket: 'redirect' },
  { key: 'request_to_first_byte_ms', bucket: 'request' },
  { key: 'response_download_ms', bucket: 'response' }
];

type ProtocolBucket = keyof SignalNavigationTimingStory['next_hop_protocol_histogram'];
const PROTOCOL_BUCKETS: ReadonlyArray<ProtocolBucket> = ['h2', 'h3', 'http/1.1', 'other'];
const ZERO_PROTOCOL_HISTOGRAM: Record<ProtocolBucket, number> = {
  h2: 0,
  h3: 0,
  'http/1.1': 0,
  other: 0
};

function toProtocolBucket(raw: string | null): ProtocolBucket {
  if (raw == null) return 'other';
  const normalized = raw.toLowerCase();
  if (normalized === 'h2' || normalized === 'h2c') return 'h2';
  if (normalized === 'h3' || normalized.startsWith('h3-')) return 'h3';
  if (normalized === 'http/1.1' || normalized === 'http/1.0' || normalized === '1.1' || normalized === '1.0') {
    return 'http/1.1';
  }
  return 'other';
}

export interface NavigationTimingStoryAccumulator {
  // Per-subpart sample arrays. Populated only when the corresponding
  // event field is non-null (independent absence — see rule #5/#9).
  subpartSamples: Record<(typeof SUBPART_KEYS)[number], number[]>;
  // Strict-denominator dominance bookkeeping: bucket → cumulative ms,
  // strict observations counter (events where every comparable subpart
  // was non-null).
  dominanceBucketSums: Record<SignalNavigationTimingDominantSubpart, number>;
  dominanceStrictObservations: number;
  // Protocol histogram counts.
  protocolHistogram: Record<ProtocolBucket, number>;
  // Provenance counters: numerator vs denominator (events where the
  // flag was non-null at all). Avoids dividing by total when the
  // signal itself was unavailable.
  provenanceCounts: {
    early_hints_present_true: number;
    early_hints_present_observed: number;
    activation_adjusted_true: number;
    activation_adjusted_observed: number;
    timing_redacted_suspected_true: number;
    timing_redacted_suspected_observed: number;
  };
  // Total events that carried any navigation_timing block (gates the
  // SIGNAL_MIN_RACE_OBSERVATIONS check).
  observationsWithBlock: number;
}

export function createNavigationTimingStoryAccumulator(): NavigationTimingStoryAccumulator {
  return {
    subpartSamples: {
      dns_ms: [],
      tcp_ms: [],
      tls_ms: [],
      redirect_ms: [],
      service_worker_ms: [],
      request_to_first_byte_ms: [],
      request_to_final_headers_ms: [],
      response_download_ms: [],
      nav_ttfb_ms: [],
      connection_ttfb_ms: [],
      activation_adjusted_ttfb_ms: []
    },
    dominanceBucketSums: { dns: 0, tcp: 0, tls: 0, redirect: 0, request: 0, response: 0 },
    dominanceStrictObservations: 0,
    protocolHistogram: { ...ZERO_PROTOCOL_HISTOGRAM },
    provenanceCounts: {
      early_hints_present_true: 0,
      early_hints_present_observed: 0,
      activation_adjusted_true: 0,
      activation_adjusted_observed: 0,
      timing_redacted_suspected_true: 0,
      timing_redacted_suspected_observed: 0
    },
    observationsWithBlock: 0
  };
}

export function ingestNavigationTimingStoryEvent(acc: NavigationTimingStoryAccumulator, event: SignalEventV1): void {
  const block = event.vitals.navigation_timing;
  if (!block) return;

  acc.observationsWithBlock += 1;

  // Per-subpart sample collection — independent of whether other
  // subparts are present. Quartile honesty depends on this.
  for (const key of SUBPART_KEYS) {
    const value = block[key];
    if (value != null && Number.isFinite(value)) {
      acc.subpartSamples[key].push(value);
    }
  }

  // Strict-denominator dominance: only events where every comparable
  // subpart is non-null contribute. Otherwise DNS-with-20-samples
  // gets unfairly compared to request-with-200-samples.
  const allDominanceFieldsPresent = DOMINANCE_SUBPARTS.every(({ key }) => {
    const v = block[key];
    return v != null && Number.isFinite(v);
  });
  if (allDominanceFieldsPresent) {
    acc.dominanceStrictObservations += 1;
    for (const { key, bucket } of DOMINANCE_SUBPARTS) {
      const v = block[key];
      if (v != null && Number.isFinite(v)) {
        acc.dominanceBucketSums[bucket] += v;
      }
    }
  }

  // Protocol histogram.
  acc.protocolHistogram[toProtocolBucket(block.next_hop_protocol)] += 1;

  // Provenance counters with separate observed-denominators per flag.
  if (block.provenance.early_hints_present !== null) {
    acc.provenanceCounts.early_hints_present_observed += 1;
    if (block.provenance.early_hints_present) acc.provenanceCounts.early_hints_present_true += 1;
  }
  if (block.provenance.activation_adjusted !== null) {
    acc.provenanceCounts.activation_adjusted_observed += 1;
    if (block.provenance.activation_adjusted) acc.provenanceCounts.activation_adjusted_true += 1;
  }
  if (block.provenance.timing_redacted_suspected !== null) {
    acc.provenanceCounts.timing_redacted_suspected_observed += 1;
    if (block.provenance.timing_redacted_suspected) acc.provenanceCounts.timing_redacted_suspected_true += 1;
  }
}

function summarizeSubpart(samples: readonly number[]): SignalNavigationTimingSubpartSummary {
  return {
    observations: samples.length,
    p25: percentile(samples, 0.25),
    p50: percentile(samples, 0.5),
    p75: percentile(samples, 0.75)
  };
}

function pickDominantBucket(
  bucketSums: Record<SignalNavigationTimingDominantSubpart, number>,
  strictObservations: number
): SignalNavigationTimingDominantSubpart | null {
  if (strictObservations === 0) return null;
  let dominantBucket: SignalNavigationTimingDominantSubpart | null = null;
  let dominantSum = -1;
  for (const bucket of Object.keys(bucketSums) as SignalNavigationTimingDominantSubpart[]) {
    if (bucketSums[bucket] > dominantSum) {
      dominantSum = bucketSums[bucket];
      dominantBucket = bucket;
    }
  }
  // All-zero case (every subpart contributed 0 ms): no honest winner.
  return dominantSum > 0 ? dominantBucket : null;
}

export function finalizeNavigationTimingStory(
  acc: NavigationTimingStoryAccumulator
): SignalNavigationTimingStory | undefined {
  if (acc.observationsWithBlock < SIGNAL_MIN_RACE_OBSERVATIONS) return undefined;

  return {
    subparts: {
      dns_ms: summarizeSubpart(acc.subpartSamples.dns_ms),
      tcp_ms: summarizeSubpart(acc.subpartSamples.tcp_ms),
      tls_ms: summarizeSubpart(acc.subpartSamples.tls_ms),
      redirect_ms: summarizeSubpart(acc.subpartSamples.redirect_ms),
      service_worker_ms: summarizeSubpart(acc.subpartSamples.service_worker_ms),
      request_to_first_byte_ms: summarizeSubpart(acc.subpartSamples.request_to_first_byte_ms),
      request_to_final_headers_ms: summarizeSubpart(acc.subpartSamples.request_to_final_headers_ms),
      response_download_ms: summarizeSubpart(acc.subpartSamples.response_download_ms),
      nav_ttfb_ms: summarizeSubpart(acc.subpartSamples.nav_ttfb_ms),
      connection_ttfb_ms: summarizeSubpart(acc.subpartSamples.connection_ttfb_ms),
      activation_adjusted_ttfb_ms: summarizeSubpart(acc.subpartSamples.activation_adjusted_ttfb_ms)
    },
    dominant_ttfb_subpart: pickDominantBucket(acc.dominanceBucketSums, acc.dominanceStrictObservations),
    dominant_ttfb_subpart_strict_observations: acc.dominanceStrictObservations,
    next_hop_protocol_histogram: PROTOCOL_BUCKETS.reduce(
      (out, bucket) => {
        out[bucket] = acc.protocolHistogram[bucket];
        return out;
      },
      { ...ZERO_PROTOCOL_HISTOGRAM }
    ),
    provenance_roll_up: {
      early_hints_share_pct: asPercent(
        acc.provenanceCounts.early_hints_present_true,
        acc.provenanceCounts.early_hints_present_observed
      ),
      activation_adjusted_share_pct: asPercent(
        acc.provenanceCounts.activation_adjusted_true,
        acc.provenanceCounts.activation_adjusted_observed
      ),
      timing_redacted_suspected_share_pct: asPercent(
        acc.provenanceCounts.timing_redacted_suspected_true,
        acc.provenanceCounts.timing_redacted_suspected_observed
      )
    }
  };
}
