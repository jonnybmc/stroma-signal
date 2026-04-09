# Signal Collector Contract

`@stroma-labs/signal` is analytics-agnostic. The direct beacon path posts the canonical `SignalEventV1` payload to a customer-owned endpoint. The endpoint should:

- accept `POST` requests with `application/json`
- respond quickly with `204 No Content` or `200 OK`
- avoid blocking on downstream warehouse writes
- store the payload without renaming the canonical fields

Recommended behavior:

1. Receive the event from `createBeaconSink({ endpoint })`
2. Validate that the payload has `v = 1`
3. Write the flattened row to a warehouse table shaped like `SignalWarehouseRowV1`
4. Aggregate warehouse data into `SignalAggregateV1`, excluding `navigation_type = restore` and `navigation_type = prerender` from default load-shaped report math
5. Generate the final report URL via `SignalReportUrlV1`

Event payloads may now include additive diagnostic context:

- `meta.navigation_type` for normalized navigation semantics
- `vitals.lcp_attribution` for LCP load state, target, and resource hints
- `vitals.inp_attribution` for load state, interaction type, and timing split hints

These fields are optional, nullable, and capability-gated. Unsupported browsers should continue to store null or absent values without backfilling.

`restore` and `prerender` lifecycle rows should stay queryable in raw warehouse data even though the default report aggregation excludes them.

This endpoint should be same-origin where possible to minimize CSP and ad-blocker friction.

For the recommended warehouse table structure, see [Warehouse Schema](./warehouse-schema.md). For aggregation rules and report generation, see [Aggregation Spec](./aggregation-spec.md).
