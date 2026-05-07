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
7. Generate the final report URL by calling `encodeSignalReportUrl(aggregate)` (returns a `SignalReportUrlResult`)

Event payloads may now include additive diagnostic context:

- `meta.navigation_type` for normalized navigation semantics
- `vitals.lcp_attribution` for LCP load state, target, and resource hints
- `vitals.inp_attribution` for load state, interaction type, and timing split hints
- `vitals.loaf` — Long Animation Frame attribution (Chromium 123+). `worst_duration_ms` records the most severe frame observed in the session; `dominant_cause` tags whether the frame was stalled by `script`, `layout`, `style`, or `paint`; `script_origin_count` is the number of distinct hosts executing script during that frame. Null on browsers without `PerformanceObserver` `long-animation-frame` support or on sessions with no LoAF entries.
- `context.visibility_hidden_at_load` — `true` when `document.visibilityState === 'hidden'` at event creation; `false` otherwise. Default report aggregation pre-filters `visibility_hidden_at_load = true` rows to exclude background-tab loads from every accumulator, percentile, and share

These fields are optional, nullable, and capability-gated. Unsupported browsers should continue to store null or absent values without backfilling.

`restore`, `prerender`, and background-tab (`context.visibility_hidden_at_load = true`) rows should stay queryable in raw warehouse data even though the default report aggregation excludes them.

This endpoint should be same-origin where possible to minimize CSP and ad-blocker friction.

Operational expectations:

- keep the accepted origin list narrow if you must allow cross-origin requests
- allow only `POST` with `application/json` on the collector route
- apply retention rules for `url`, `ref`, `lcp_resource_url`, and attribution targets based on your org's privacy policy
- avoid joining Signal rows to user identifiers unless your governance model explicitly allows it
- keep the persisted current-report-URL surface private by default; it is an internal artifact, not a public endpoint

## Example payload

A representative `POST` body your endpoint should accept. Field nullability follows the canonical `SignalEventV1` contract — never reject a payload just because nullable fields are absent or `null`. Real captures will include null values (e.g., `lcp_ms` is null outside Chromium; `net_tcp_ms` is null on reused connections).

```json
{
  "v": 1,
  "event_id": "01JFGH8K2WXP3M9R5T6V7Y8Z2A",
  "ts": 1746628823145,
  "host": "example.com",
  "url": "/pricing",
  "ref": "https://www.google.com/",
  "net_tier": "moderate",
  "net_tcp_ms": 84,
  "net_tcp_source": "nav_timing_tcp_isolated",
  "device_tier": "mid",
  "device_cores": 8,
  "device_memory_gb": 8,
  "device_screen_w": 1440,
  "device_screen_h": 900,
  "vitals": {
    "lcp_ms": 2140,
    "fcp_ms": 1180,
    "ttfb_ms": 320,
    "cls": 0.04,
    "inp_ms": 96,
    "lcp_attribution": {
      "load_state": "complete",
      "element_type": "image",
      "culprit_kind": "hero_image",
      "target": "img.hero",
      "resource_url": "https://cdn.example.com/hero.jpg"
    },
    "inp_attribution": {
      "load_state": "complete",
      "interaction_type": "pointer",
      "interaction_target": "button.cta",
      "input_delay_ms": 8,
      "processing_duration_ms": 64,
      "presentation_delay_ms": 24,
      "dominant_phase": "processing"
    },
    "lcp_breakdown": {
      "resource_load_delay_ms": 180,
      "resource_load_time_ms": 240,
      "element_render_delay_ms": 60
    },
    "third_party": {
      "pre_lcp_script_share_pct": 32,
      "origin_count": 4
    },
    "loaf": {
      "worst_duration_ms": 142,
      "dominant_cause": "script",
      "script_origin_count": 2
    },
    "navigation_timing": {
      "dns_ms": 4,
      "tcp_ms": 84,
      "tls_ms": 56,
      "redirect_ms": 0,
      "next_hop_protocol": "h2",
      "transfer_size": 18420,
      "encoded_body_size": 17680,
      "decoded_body_size": 62140,
      "activation_adjusted_ttfb_ms": 320,
      "provenance": {
        "early_hints_present": false,
        "activation_adjusted": false,
        "timing_redacted_suspected": false
      }
    }
  },
  "context": {
    "effective_type": "4g",
    "downlink_mbps": 10.0,
    "rtt_ms": 50,
    "save_data": false,
    "connection_type": "wifi",
    "visibility_hidden_at_load": false
  },
  "meta": {
    "pkg_version": "0.1.0",
    "browser": "chrome",
    "navigation_type": "navigate"
  }
}
```

**Expected response:** `HTTP 204 No Content` (preferred — zero-byte body) or `HTTP 200 OK`. The browser does not retry on failure (`sendBeacon` is fire-and-forget), so any non-2xx response means the event is lost. Acknowledge before persistence to keep the round-trip fast.

**Payload size:** typically 1.2-2.5KB depending on attribution density and URL length. Reject anything over ~16KB as malformed — the canonical event has hard upper bounds on every string field.

For the recommended warehouse table structure, see [Warehouse Schema](./warehouse-schema.md). For aggregation rules and report generation, see [Aggregation Spec](./aggregation-spec.md).
