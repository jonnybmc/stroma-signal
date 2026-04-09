# Public API Freeze: v0.1

This document is the canonical public package contract for `@stroma-labs/signal` v0.1.

If another doc, plan, or old PRD example disagrees with this file, this file wins for the shipped npm package.

## Package Shape

- Published package: `@stroma-labs/signal`
- Public subpath exports:
  - `@stroma-labs/signal`
  - `@stroma-labs/signal/ga4`
  - `@stroma-labs/signal/report`

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

## Frozen event and integration names

- Product brand: `Signal by Stroma`
- Canonical GTM / GA4 event name: `perf_tier_report`
- Hosted report route: `https://signal.stroma.design/r`
- Hosted builder route: `https://signal.stroma.design/build`

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

The GTM / GA4 path emits only this compact diagnostic subset:

- `navigation_type`
- `lcp_load_state`
- `lcp_element_type`
- `inp_load_state`
- `interaction_type`
- `input_delay_ms`
- `processing_duration_ms`
- `presentation_delay_ms`

The GTM / GA4 path does not emit these high-cardinality fields in v0.1:

- `lcp_target`
- `lcp_resource_url`
- `interaction_target`
- `interaction_time_ms`

## Explicitly not part of v0.1

- `reportTo` runtime config
- top-level `endpoint` runtime config outside a sink
- top-level `onReport` runtime config outside a sink
- direct `gtag` loading in the public package
- session persistence
- SPA soft-navigation support
- report-schema expansion for diagnostics
