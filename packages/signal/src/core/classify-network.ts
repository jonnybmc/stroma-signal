import type {
  SignalNetTcpSource,
  SignalNetworkTier,
  SignalNetworkTierThresholds
} from '@stroma-labs/signal-contracts';

export interface NetworkSnapshot {
  net_tier: SignalNetworkTier | null;
  net_tcp_ms: number | null;
  net_tcp_source: SignalNetTcpSource;
}

export const DEFAULT_NETWORK_THRESHOLDS: SignalNetworkTierThresholds = {
  urban: 50,
  moderate: 150,
  constrained_moderate: 400
};

function classifyTier(
  tcpMs: number,
  thresholds: SignalNetworkTierThresholds
): SignalNetworkTier {
  if (tcpMs < thresholds.urban) return 'urban';
  if (tcpMs <= thresholds.moderate) return 'moderate';
  if (tcpMs <= thresholds.constrained_moderate) return 'constrained_moderate';
  return 'constrained';
}

export function getNavigationEntry(): PerformanceNavigationTiming | null {
  const entries = globalThis.performance?.getEntriesByType?.('navigation') ?? [];
  return (entries[0] as PerformanceNavigationTiming | undefined) ?? null;
}

export function classifyNetwork(
  navigation: PerformanceNavigationTiming | null,
  thresholds: SignalNetworkTierThresholds
): NetworkSnapshot {
  if (!navigation) {
    return {
      net_tier: null,
      net_tcp_ms: null,
      net_tcp_source: 'unavailable_missing_timing'
    };
  }

  if (navigation.workerStart > 0) {
    return {
      net_tier: null,
      net_tcp_ms: null,
      net_tcp_source: 'unavailable_sw'
    };
  }

  const connectMs = navigation.connectEnd - navigation.connectStart;
  if (connectMs <= 0) {
    return {
      net_tier: null,
      net_tcp_ms: null,
      net_tcp_source: 'unavailable_reused'
    };
  }

  if (navigation.secureConnectionStart > 0) {
    if (navigation.secureConnectionStart === navigation.connectStart) {
      return {
        net_tier: null,
        net_tcp_ms: null,
        net_tcp_source: 'unavailable_tls_coalesced'
      };
    }

    const tcpMs = Math.round(navigation.secureConnectionStart - navigation.connectStart);
    return {
      net_tier: classifyTier(tcpMs, thresholds),
      net_tcp_ms: tcpMs,
      net_tcp_source: 'nav_timing_tcp_isolated'
    };
  }

  const tcpMs = Math.round(connectMs);
  return {
    net_tier: classifyTier(tcpMs, thresholds),
    net_tcp_ms: tcpMs,
    net_tcp_source: 'nav_timing_full'
  };
}
