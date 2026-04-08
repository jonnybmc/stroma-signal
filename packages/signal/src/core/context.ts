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

  return {
    effective_type: connection?.effectiveType ?? null,
    downlink_mbps: typeof connection?.downlink === 'number' ? connection.downlink : null,
    rtt_ms: typeof connection?.rtt === 'number' ? connection.rtt : null,
    save_data: typeof connection?.saveData === 'boolean' ? connection.saveData : null,
    connection_type: connection?.type ?? null
  };
}
