export type {
  SignalAggregateV1,
  SignalComparisonTier,
  SignalDeviceTier,
  SignalEventV1,
  SignalInpAttribution,
  SignalInteractionType,
  SignalLcpAttribution,
  SignalLcpElementType,
  SignalLoadState,
  SignalNetTcpSource,
  SignalNavigationType,
  SignalNetworkTier,
  SignalNetworkTierThresholds,
  SignalRaceMetric,
  SignalReportUrlResult,
  SignalSink,
  SignalWarehouseRowV1
} from '@stroma-labs/signal-contracts';
export {
  SIGNAL_BUILDER_BASE_URL,
  SIGNAL_EVENT_VERSION,
  SIGNAL_GA4_EVENT_NAME,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_BASE_URL
} from '@stroma-labs/signal-contracts';

export { createBeaconSink } from './sinks/beacon.js';
export { createCallbackSink } from './sinks/callback.js';
export { destroy, init } from './core/runtime.js';
export type { BeaconSinkOptions } from './sinks/beacon.js';
export type { CallbackSinkOptions } from './sinks/callback.js';
export type { SignalInitConfig, SignalRuntimeController } from './core/runtime.js';
