# Signal Collector Contract

`@stroma-labs/signal` is analytics-agnostic. The direct beacon path posts the canonical `SignalEventV1` payload to a customer-owned endpoint. The endpoint should:

- accept `POST` requests with `application/json`
- respond quickly with `204 No Content` or `200 OK`
- avoid blocking on downstream warehouse writes
- store the payload without renaming the canonical fields
- validate the incoming shape before persistence
- treat `event_id` as the idempotency key for dedupe / replay protection
- prefer same-origin delivery, or use a tightly-scoped CORS policy if cross-origin is unavoidable
- apply rate limiting or equivalent abuse controls because the browser beacon is unauthenticated by design

Recommended behavior:

1. Receive the event from `createBeaconSink({ endpoint })`
2. Validate that the payload has `v = 1` and matches the canonical field names
3. Reject malformed or oversized payloads before they reach your warehouse
4. Acknowledge quickly, then hand off persistence asynchronously where possible
5. Write the flattened row to a warehouse table shaped like `SignalWarehouseRowV1`, deduping on `event_id`
6. Aggregate warehouse data into `SignalAggregateV1`, excluding `navigation_type = restore` and `navigation_type = prerender` from default load-shaped report math
7. Generate the final report URL via `SignalReportUrlV1`

Event payloads may now include additive diagnostic context:

- `meta.navigation_type` for normalized navigation semantics
- `vitals.lcp_attribution` for LCP load state, target, and resource hints
- `vitals.inp_attribution` for load state, interaction type, and timing split hints

These fields are optional, nullable, and capability-gated. Unsupported browsers should continue to store null or absent values without backfilling.

`restore` and `prerender` lifecycle rows should stay queryable in raw warehouse data even though the default report aggregation excludes them.

This endpoint should be same-origin where possible to minimize CSP and ad-blocker friction.

Operational expectations:

- keep the accepted origin list narrow if you must allow cross-origin requests
- allow only `POST` with `application/json` on the collector route
- apply retention rules for `url`, `ref`, `lcp_resource_url`, and attribution targets based on your org's privacy policy
- avoid joining Signal rows to user identifiers unless your governance model explicitly allows it
- keep the persisted current-report-URL surface private by default; it is an internal artifact, not a public endpoint

For the recommended warehouse table structure, see [Warehouse Schema](./warehouse-schema.md). For aggregation rules and report generation, see [Aggregation Spec](./aggregation-spec.md).
