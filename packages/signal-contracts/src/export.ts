import { toSignalWarehouseRow } from './ga4.js';
import type { SignalAggregateV1, SignalEventV1, SignalWarehouseRowV1 } from './types.js';

export function exportSignalEventsToJSON(events: readonly SignalEventV1[]): string {
  return JSON.stringify(events, null, 2);
}

export function exportSignalAggregateToJSON(aggregate: SignalAggregateV1): string {
  return JSON.stringify(aggregate, null, 2);
}

const WAREHOUSE_COLUMNS: ReadonlyArray<keyof SignalWarehouseRowV1> = [
  'schema_version',
  'event_id',
  'observed_at',
  'host',
  'path',
  'referrer',
  'net_tier',
  'net_tcp_ms',
  'net_tcp_source',
  'device_tier',
  'device_cores',
  'device_memory_gb',
  'device_screen_w',
  'device_screen_h',
  'lcp_ms',
  'cls',
  'inp_ms',
  'fcp_ms',
  'ttfb_ms',
  'effective_type',
  'downlink_mbps',
  'rtt_ms',
  'save_data',
  'connection_type',
  'browser',
  'nav_type',
  'navigation_type',
  'lcp_load_state',
  'lcp_target',
  'lcp_element_type',
  'lcp_resource_url',
  'inp_load_state',
  'interaction_target',
  'interaction_type',
  'interaction_time_ms',
  'input_delay_ms',
  'processing_duration_ms',
  'presentation_delay_ms',
  'lcp_breakdown_resource_load_delay_ms',
  'lcp_breakdown_resource_load_time_ms',
  'lcp_breakdown_element_render_delay_ms',
  'lcp_attribution_culprit_kind',
  'inp_attribution_dominant_phase'
];

function escapeCsvCell(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || /^[=+\-@\t\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function exportSignalEventsToCSV(events: readonly SignalEventV1[]): string {
  const header = WAREHOUSE_COLUMNS.join(',');
  const rows = events.map((event) => {
    const row = toSignalWarehouseRow(event);
    return WAREHOUSE_COLUMNS.map((col) => escapeCsvCell(row[col])).join(',');
  });
  return [header, ...rows].join('\n');
}
