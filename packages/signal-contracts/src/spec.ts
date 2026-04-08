import type { SignalAggregationSpecV1 } from './types.js';
import { SIGNAL_MIN_LCP_COVERAGE, SIGNAL_MIN_RACE_OBSERVATIONS, SIGNAL_PREVIEW_MINIMUM_SAMPLE } from './types.js';

export const SIGNAL_AGGREGATION_SPEC_V1: SignalAggregationSpecV1 = {
  previewMinimumSample: SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  minRaceObservations: SIGNAL_MIN_RACE_OBSERVATIONS,
  minLcpCoverage: SIGNAL_MIN_LCP_COVERAGE
};
