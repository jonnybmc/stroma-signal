import type { SignalContext } from '@stroma-labs/signal-contracts';

export function readSignalContext(): SignalContext {
  const connection = (
    globalThis.navigator as
      | (Navigator & {
          connection?: {
            effectiveType?: string;
            downlink?: number;
            rtt?: number;
            saveData?: boolean;
            type?: string;
          };
        })
      | undefined
  )?.connection;

  // Background-tab loads have fundamentally different vitals distributions
  // (throttled timers, deferred paint, deprioritized network). Aggregation
  // pre-filters on this flag so the narrated numbers describe foreground
  // user experience, not backgrounded prefetch / keepalive traffic.
  const visibilityHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

  return {
    effective_type: connection?.effectiveType ?? null,
    downlink_mbps: typeof connection?.downlink === 'number' ? connection.downlink : null,
    rtt_ms: typeof connection?.rtt === 'number' ? connection.rtt : null,
    save_data: typeof connection?.saveData === 'boolean' ? connection.saveData : null,
    connection_type: connection?.type ?? null,
    visibility_hidden_at_load: visibilityHidden
  };
}
