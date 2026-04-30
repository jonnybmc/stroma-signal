# Public API Freeze: v0.1

This document is the canonical public package contract for `@stroma-labs/signal` v0.1.

If another doc, plan, or old PRD example disagrees with this file, this file wins for the shipped npm package.

## Package Shape

- Published package: `@stroma-labs/signal`
- Public subpath exports:
  - `@stroma-labs/signal` as the core runtime surface
  - `@stroma-labs/signal/ga4` as the GTM / GA4 integration helper
  - `@stroma-labs/signal/report` as an optional preview/report helper
  - `@stroma-labs/signal/summary` as a local summary and export helper

## Canonical Runtime API

### Main entry

```ts
import {
  init,
  destroy,
  createBeaconSink,
  createCallbackSink
} from '@stroma-labs/signal';
```

### GA4 / GTM subpath

```ts
import { createDataLayerSink } from '@stroma-labs/signal/ga4';
```

### Preview / report subpath

```ts
import { createPreviewCollector } from '@stroma-labs/signal/report';
```

This subpath is optional and not part of the minimum instrumentation path.

The `PreviewCollector` also exposes local output methods:

- `getSummary(): string | null` — returns a plain-text summary of the current aggregate, or null if no events collected
- `exportEvents(format: 'json' | 'csv'): string` — exports collected events as JSON or warehouse-compatible CSV

### Summary / export subpath

```ts
import {
  formatSignalSummary,
  exportSignalEventsToJSON,
  exportSignalEventsToCSV,
  exportSignalAggregateToJSON
} from '@stroma-labs/signal/summary';
```

This subpath provides local output utilities so the package stands alone without the hosted report:

- `formatSignalSummary(aggregate)` — returns a human-readable plain-text summary with tier distribution, race findings, experience funnel, and coverage stats
- `exportSignalEventsToJSON(events)` — JSON.stringify with 2-space indent
- `exportSignalEventsToCSV(events)` — flattened CSV matching the `SignalWarehouseRowV1` column order, with formula-injection protection
- `exportSignalAggregateToJSON(aggregate)` — aggregate as formatted JSON

This subpath is additive and does not affect the frozen v0.1 runtime surface.

## `init()` contract

```ts
init({
  sinks,
  sampleRate,
  networkTierThresholds,
  deviceTierOverride,
  generateTarget,
  debug,
  packageVersion
});
```

### Public `SignalInitConfig`

- `sinks: SignalSink[]`
- `sampleRate?: number`
- `networkTierThresholds?: SignalNetworkTierThresholds`
- `deviceTierOverride?: (cores: number, memory: number | null, screenWidth: number) => SignalDeviceTier`
- `generateTarget?: (element: Element | null) => string | null`
- `debug?: boolean` logs raw FCP/LCP observations, the flush reason, and the final payload before sink emission
- `packageVersion?: string`

## Public sinks

### `createBeaconSink({ endpoint, onError? })`

Use this when the client wants to send canonical events to a customer-owned endpoint.

### `createCallbackSink({ onReport })`

Use this when the client wants full app-level control over forwarding or enrichment.

### `createDataLayerSink({ dataLayerName?, eventName?, target? })`

Use this when the client already has GTM and wants Signal to emit `perf_tier_report` into a data layer.

Signal does not load GTM or GA4 scripts in the public package.
The data-layer payload is intentionally a compact GA4-safe subset, not the full warehouse schema.

## Frozen event and integration names

- Product brand: `Signal`
- Canonical GTM / GA4 event name: `perf_tier_report`
- Hosted report route: `https://signal.stroma.design/r`
- Hosted builder route: `https://signal.stroma.design/build`

The hosted Tier Report is a first-class companion surface, but it is not a diagnostic, attribution, or commercial modelling artifact.

The canonical production `/r` artifact shipped by the provided warehouse SQL templates uses the last 7 complete calendar days and excludes the current in-progress day.

## Diagnostics cut line for v0.1

The following additive diagnostics ship in v0.1:

- `meta.navigation_type`
- `vitals.lcp_attribution`
- `vitals.inp_attribution`
- `generateTarget()` hook

These fields are:

- optional
- nullable
- capability-gated
- not part of the frozen `SignalAggregateV1` report schema yet

`restore` and `prerender` remain valid raw `SignalEventV1` lifecycle rows in v0.1, but the provided report aggregation defaults exclude them from load-shaped paint and network reporting.

### GA4-safe subset

The GTM / GA4 path emits this compact report-and-debug subset:

- `event_id`
- `host`
- `url`
- `net_tier`
- `net_tcp_ms`
- `net_tcp_source`
- `device_tier`
- `lcp_ms`
- `fcp_ms`
- `ttfb_ms`
- `browser`
- `navigation_type`
- `lcp_load_state`
- `lcp_element_type`
- `inp_load_state`
- `interaction_type`
- `input_delay_ms`
- `processing_duration_ms`
- `presentation_delay_ms`
- `lcp_culprit_kind`
- `lcp_dominant_subpart`
- `inp_dominant_phase`
- `third_party_weight_tier`

These fields stay under the standard GA4 event parameter cap and are enough for the provided GTM recipe, GA4 BigQuery validation, and URL-builder SQL.

> **Deprecated in 0.1.x:** the legacy `nav_type` GA4 parameter has been removed. Use `navigation_type` (identical semantics, wider browser coverage).

These fields are commonly useful in GA4 custom definitions:

- `navigation_type`
- `lcp_load_state`
- `lcp_element_type`
- `inp_load_state`
- `interaction_type`
- `net_tier`
- `device_tier`
- `browser`
- `lcp_ms`
- `fcp_ms`
- `ttfb_ms`
- `input_delay_ms`
- `processing_duration_ms`
- `presentation_delay_ms`

These fields are kept mainly for DebugView or BigQuery validation and are not good default custom-definition candidates:

- `event_id`
- `host`
- `url`
- `net_tcp_ms`
- `net_tcp_source`

The GTM / GA4 path does not emit these warehouse-only fields in v0.1:

- `v`
- `ts`
- `ref`
- `device_cores`
- `device_memory_gb`
- `device_screen_w`
- `device_screen_h`
- `cls`
- `inp_ms`
- `effective_type`
- `downlink_mbps`
- `rtt_ms`
- `save_data`
- `connection_type`
- `pkg_version`

- `lcp_target`
- `lcp_resource_url`
- `interaction_target`
- `interaction_time_ms`

## Additive Report Contract

`SignalEventV1` remains unchanged in this phase.

The additive report-layer change lives in `SignalAggregateV1`, which now includes an optional `experience_funnel` block under `rv=1` for the hosted Tier Report. This block powers the measured Act 3 funnel and keeps older `rv=1` links compatible when the funnel fields are absent.

`SignalAggregateV1` also carries an additive optional `form_factor_distribution` field (mobile / tablet / desktop shares) derived from the `device_screen_w` event field at aggregation time. Emitted by both GA4 and normalized SQL paths as the `ff=` URL param. Backward-compatible: legacy decoded URLs without `ff=` leave the field undefined.

The GA4-compact safe-field subset includes `device_screen_w` — the feature that unlocks `form_factor_distribution` on the GA4 path. Total safe-field count is 21, well under GA4's 25-custom-parameter-per-event cap.

The Tier Report uses this additive report contract to show:

- who your users are
- how far apart their experiences are
- where performance crosses into poor territory using explicit thresholds

## Related documentation

- [Signal Technical Reference](./signal-technical-reference.md) — full field definitions, browser support matrices, classification logic, and aggregation rules
- [Aggregation Spec](./aggregation-spec.md) — comparison tier selection, race metric fallback cascade, and coverage honesty rules
- [Tier Report Design Spec](./tier-report-design-spec.md) — canonical product and presentation boundary for the hosted report
- [Why Signal Exists](./why-signal.md) — positioning and product context

## Explicitly not part of v0.1

- `reportTo` runtime config
- top-level `endpoint` runtime config outside a sink
- top-level `onReport` runtime config outside a sink
- direct `gtag` loading in the public package
- session persistence
- SPA soft-navigation support
- browser-event expansion for additional diagnostics beyond the current optional attribution fields
