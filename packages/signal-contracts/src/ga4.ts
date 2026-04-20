import { classifyThirdPartyShareTier } from './aggregation.js';
import type {
  SignalEventV1,
  SignalGa4FieldMapV1,
  SignalLcpSubpart,
  SignalThirdPartyTier,
  SignalWarehouseRowV1
} from './types.js';
import { SIGNAL_EVENT_VERSION, SIGNAL_GA4_EVENT_NAME } from './types.js';

const SIGNAL_GA4_SAFE_FIELDS_V1: SignalGa4FieldMapV1['fields'] = {
  event_id: 'event_id',
  host: 'host',
  url: 'url',
  net_tier: 'net_tier',
  net_tcp_ms: 'net_tcp_ms',
  net_tcp_source: 'net_tcp_source',
  device_tier: 'device_tier',
  device_screen_w: 'device_screen_w',
  lcp_ms: 'lcp_ms',
  fcp_ms: 'fcp_ms',
  ttfb_ms: 'ttfb_ms',
  browser: 'browser',
  navigation_type: 'navigation_type',
  lcp_load_state: 'lcp_load_state',
  lcp_element_type: 'lcp_element_type',
  inp_load_state: 'inp_load_state',
  interaction_type: 'interaction_type',
  input_delay_ms: 'input_delay_ms',
  processing_duration_ms: 'processing_duration_ms',
  presentation_delay_ms: 'presentation_delay_ms',
  lcp_culprit_kind: 'lcp_culprit_kind',
  lcp_dominant_subpart: 'lcp_dominant_subpart',
  inp_dominant_phase: 'inp_dominant_phase',
  third_party_weight_tier: 'third_party_weight_tier'
};

// Per-event third-party pre-LCP script weight tier (§2.4 of the enrichment
// plan). Null when no LCP anchor is present (Safari/Firefox) or no scripts
// loaded pre-paint. Keeps the GA4 row compact — full share % lives in the
// warehouse column, the GA4 param carries the narratable bucket only.
export function deriveThirdPartyWeightTier(event: SignalEventV1): SignalThirdPartyTier | null {
  return classifyThirdPartyShareTier(event.vitals.third_party?.pre_lcp_script_share_pct ?? null);
}

// Per-event dominant LCP subpart (argmax of ttfb + 3-field breakdown).
// Null when the breakdown or ttfb anchor is missing — keeps GA4 payloads
// honest rather than inventing a winner from partial data.
export function deriveLcpDominantSubpart(event: SignalEventV1): SignalLcpSubpart | null {
  const breakdown = event.vitals.lcp_breakdown;
  const ttfb = event.vitals.ttfb_ms;
  if (!breakdown || ttfb == null) return null;
  const { resource_load_delay_ms, resource_load_time_ms, element_render_delay_ms } = breakdown;
  if (resource_load_delay_ms == null || resource_load_time_ms == null || element_render_delay_ms == null) {
    return null;
  }
  const candidates: Array<[SignalLcpSubpart, number]> = [
    ['ttfb', ttfb],
    ['resource_load_delay', resource_load_delay_ms],
    ['resource_load_time', resource_load_time_ms],
    ['element_render_delay', element_render_delay_ms]
  ];
  return candidates.reduce((best, current) => (current[1] > best[1] ? current : best))[0];
}

export const SIGNAL_GA4_FIELD_MAP_V1: SignalGa4FieldMapV1 = {
  eventName: SIGNAL_GA4_EVENT_NAME,
  fields: SIGNAL_GA4_SAFE_FIELDS_V1
};

// `lcp_target` and `interaction_target` (CSS-selector strings from LCP /
// INP attribution) and `interaction_time_ms` are deliberately excluded
// from the GA4 compact subset to preserve 4 slots of headroom against
// GA4's 25-custom-parameter-per-event cap. They're carried in the
// normalized warehouse path (`toSignalWarehouseRow`) below and remain
// available via the beacon / callback sinks. Form-factor is derived from
// `device_screen_w` at aggregation time, so the attribution targets
// aren't needed in the GA4 report-URL path.
export function flattenSignalEventForGa4(event: SignalEventV1): Record<string, string | number | boolean | null> {
  return {
    event: SIGNAL_GA4_EVENT_NAME,
    event_id: event.event_id,
    host: event.host,
    url: event.url,
    net_tier: event.net_tier,
    net_tcp_ms: event.net_tcp_ms,
    net_tcp_source: event.net_tcp_source,
    device_tier: event.device_tier,
    device_screen_w: event.device_screen_w,
    lcp_ms: event.vitals.lcp_ms,
    fcp_ms: event.vitals.fcp_ms,
    ttfb_ms: event.vitals.ttfb_ms,
    browser: event.meta.browser,
    navigation_type: event.meta.navigation_type ?? null,
    lcp_load_state: event.vitals.lcp_attribution?.load_state ?? null,
    lcp_element_type: event.vitals.lcp_attribution?.element_type ?? null,
    inp_load_state: event.vitals.inp_attribution?.load_state ?? null,
    interaction_type: event.vitals.inp_attribution?.interaction_type ?? null,
    input_delay_ms: event.vitals.inp_attribution?.input_delay_ms ?? null,
    processing_duration_ms: event.vitals.inp_attribution?.processing_duration_ms ?? null,
    presentation_delay_ms: event.vitals.inp_attribution?.presentation_delay_ms ?? null,
    lcp_culprit_kind: event.vitals.lcp_attribution?.culprit_kind ?? null,
    lcp_dominant_subpart: deriveLcpDominantSubpart(event),
    inp_dominant_phase: event.vitals.inp_attribution?.dominant_phase ?? null,
    third_party_weight_tier: deriveThirdPartyWeightTier(event)
  };
}

export function toSignalWarehouseRow(event: SignalEventV1): SignalWarehouseRowV1 {
  return {
    schema_version: SIGNAL_EVENT_VERSION,
    event_id: event.event_id,
    observed_at: new Date(event.ts).toISOString(),
    host: event.host,
    path: event.url,
    referrer: event.ref,
    net_tier: event.net_tier,
    net_tcp_ms: event.net_tcp_ms,
    net_tcp_source: event.net_tcp_source,
    device_tier: event.device_tier,
    device_cores: event.device_cores,
    device_memory_gb: event.device_memory_gb,
    device_screen_w: event.device_screen_w,
    device_screen_h: event.device_screen_h,
    lcp_ms: event.vitals.lcp_ms,
    cls: event.vitals.cls,
    inp_ms: event.vitals.inp_ms,
    fcp_ms: event.vitals.fcp_ms,
    ttfb_ms: event.vitals.ttfb_ms,
    effective_type: event.context.effective_type,
    downlink_mbps: event.context.downlink_mbps,
    rtt_ms: event.context.rtt_ms,
    save_data: event.context.save_data,
    connection_type: event.context.connection_type,
    browser: event.meta.browser,
    navigation_type: event.meta.navigation_type ?? null,
    lcp_load_state: event.vitals.lcp_attribution?.load_state ?? null,
    lcp_target: event.vitals.lcp_attribution?.target ?? null,
    lcp_element_type: event.vitals.lcp_attribution?.element_type ?? null,
    lcp_resource_url: event.vitals.lcp_attribution?.resource_url ?? null,
    inp_load_state: event.vitals.inp_attribution?.load_state ?? null,
    interaction_target: event.vitals.inp_attribution?.interaction_target ?? null,
    interaction_type: event.vitals.inp_attribution?.interaction_type ?? null,
    interaction_time_ms: event.vitals.inp_attribution?.interaction_time_ms ?? null,
    input_delay_ms: event.vitals.inp_attribution?.input_delay_ms ?? null,
    processing_duration_ms: event.vitals.inp_attribution?.processing_duration_ms ?? null,
    presentation_delay_ms: event.vitals.inp_attribution?.presentation_delay_ms ?? null,
    lcp_breakdown_resource_load_delay_ms: event.vitals.lcp_breakdown?.resource_load_delay_ms ?? null,
    lcp_breakdown_resource_load_time_ms: event.vitals.lcp_breakdown?.resource_load_time_ms ?? null,
    lcp_breakdown_element_render_delay_ms: event.vitals.lcp_breakdown?.element_render_delay_ms ?? null,
    lcp_attribution_culprit_kind: event.vitals.lcp_attribution?.culprit_kind ?? null,
    inp_attribution_dominant_phase: event.vitals.inp_attribution?.dominant_phase ?? null,
    third_party_pre_lcp_script_share_pct: event.vitals.third_party?.pre_lcp_script_share_pct ?? null,
    third_party_origin_count: event.vitals.third_party?.origin_count ?? null,
    loaf_dominant_cause: event.vitals.loaf?.dominant_cause ?? null,
    context_visibility_hidden_at_load: event.context.visibility_hidden_at_load ?? null
  };
}
