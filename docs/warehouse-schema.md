# Signal Warehouse Schema

Recommended flat warehouse row shape for non-GA4 collection.

## Example row

One realistic row from a Chromium browser on a moderate network, mid-tier device. Many fields are nullable in practice — Safari/Firefox events have `lcp_ms`, `cls`, `inp_ms` and the `lcp_breakdown_*` fields all null; reused connections have `net_tcp_ms` and `navigation_timing_tcp_ms` null.

```
schema_version              = 1
event_id                    = "01JFGH8K2WXP3M9R5T6V7Y8Z2A"
observed_at                 = 2026-05-07T14:23:45.145Z
host                        = "example.com"
path                        = "/pricing"
referrer                    = "https://www.google.com/"
net_tier                    = "moderate"
net_tcp_ms                  = 84
net_tcp_source              = "nav_timing_tcp_isolated"
device_tier                 = "mid"
device_cores                = 8
device_memory_gb            = 8.0
device_screen_w             = 1440
device_screen_h             = 900
lcp_ms                      = 2140
cls                         = 0.04
inp_ms                      = 96
fcp_ms                      = 1180
ttfb_ms                     = 320
effective_type              = "4g"
downlink_mbps               = 10.0
rtt_ms                      = 50
save_data                   = false
connection_type             = "wifi"
browser                     = "chrome"
navigation_type             = "navigate"
lcp_load_state              = "complete"
lcp_target                  = "img.hero"
lcp_element_type            = "image"
lcp_resource_url            = "https://cdn.example.com/hero.jpg"
lcp_attribution_culprit_kind = "hero_image"
inp_load_state              = "complete"
interaction_target          = "button.cta"
interaction_type            = "pointer"
interaction_time_ms         = 4250
input_delay_ms              = 8
processing_duration_ms      = 64
presentation_delay_ms       = 24
inp_attribution_dominant_phase = "processing"
third_party_pre_lcp_script_share_pct = 32
third_party_origin_count    = 4
loaf_dominant_cause         = "script"
context_visibility_hidden_at_load = false
navigation_timing_next_hop_protocol = "h2"
navigation_timing_activation_adjusted_ttfb_ms = 320
-- ...remaining navigation_timing_* and lcp_breakdown_* columns
```

## Column reference

| Column | Type | Notes |
| --- | --- | --- |
| `schema_version` | INT64 | Currently `1` |
| `event_id` | STRING | Ephemeral once-only delivery identifier. Use as the dedupe / idempotency key. |
| `observed_at` | TIMESTAMP | Event observation time |
| `host` | STRING | Domain/host name |
| `path` | STRING | Path and query if retained. Apply your retention policy if the query string may carry sensitive business context. |
| `referrer` | STRING | Nullable |
| `net_tier` | STRING | Nullable: `urban`, `moderate`, `constrained_moderate`, `constrained`; null for non-load-shaped `restore`/`prerender` rows |
| `net_tcp_ms` | INT64 | Nullable and null for non-load-shaped `restore`/`prerender` rows |
| `net_tcp_source` | STRING | One of: `nav_timing_tcp_isolated`, `nav_timing_full`, `unavailable_reused`, `unavailable_sw`, `unavailable_tls_coalesced`, `unavailable_missing_timing` |
| `device_tier` | STRING | `low`, `mid`, `high` |
| `device_cores` | INT64 | Browser logical cores |
| `device_memory_gb` | FLOAT64 | Nullable |
| `device_screen_w` | INT64 | CSS pixels. Feeds the aggregate-time form-factor split (<768 mobile, 768–1279 tablet, ≥1280 desktop). |
| `device_screen_h` | INT64 | CSS pixels |
| `lcp_ms` | INT64 | Nullable outside Chromium and null for non-load-shaped `restore`/`prerender` rows |
| `cls` | FLOAT64 | Nullable outside Chromium |
| `inp_ms` | INT64 | Nullable outside Chromium |
| `fcp_ms` | INT64 | Nullable and null for non-load-shaped `restore`/`prerender` rows |
| `ttfb_ms` | INT64 | Nullable and null for non-load-shaped `restore`/`prerender` rows |
| `effective_type` | STRING | Nullable |
| `downlink_mbps` | FLOAT64 | Nullable |
| `rtt_ms` | INT64 | Nullable |
| `save_data` | BOOL | Nullable |
| `connection_type` | STRING | Nullable |
| `browser` | STRING | Lowercase family name |
| `navigation_type` | STRING | Nullable normalized value: `navigate`, `reload`, `back-forward`, `prerender`, `restore`. |
| `lcp_load_state` | STRING | Nullable: `loading`, `interactive`, `complete` |
| `lcp_target` | STRING | Nullable safe label from `generateTarget()` or default tag name |
| `lcp_element_type` | STRING | Nullable: `image` or `text` |
| `lcp_resource_url` | STRING | Nullable sanitized URL hint with query/hash stripped. Retain only as long as your privacy policy allows. |
| `inp_load_state` | STRING | Nullable: `loading`, `interactive`, `complete` |
| `interaction_target` | STRING | Nullable safe label from `generateTarget()` or default tag name |
| `interaction_type` | STRING | Nullable: `pointer` or `keyboard` |
| `interaction_time_ms` | INT64 | Nullable interaction start time |
| `input_delay_ms` | INT64 | Nullable INP timing split |
| `processing_duration_ms` | INT64 | Nullable INP timing split |
| `presentation_delay_ms` | INT64 | Nullable INP timing split |
| `lcp_breakdown_resource_load_delay_ms` | INT64 | Nullable Chromium-only LCP subpart (all-or-nothing — see collector contract) |
| `lcp_breakdown_resource_load_time_ms` | INT64 | Nullable Chromium-only LCP subpart (all-or-nothing) |
| `lcp_breakdown_element_render_delay_ms` | INT64 | Nullable Chromium-only LCP subpart (all-or-nothing) |
| `lcp_attribution_culprit_kind` | STRING | Nullable enum: `hero_image`, `headline_text`, `banner_image`, `product_image`, `video_poster`, `unknown` |
| `inp_attribution_dominant_phase` | STRING | Nullable enum: `input_delay`, `processing`, `presentation` |
| `third_party_pre_lcp_script_share_pct` | INT64 | Nullable 0–100 share of off-domain script weight before LCP |
| `third_party_origin_count` | INT64 | Nullable count of distinct off-domain script origins before LCP (hidden when below privacy mask of 3) |
| `loaf_dominant_cause` | STRING | Nullable enum (Chromium 123+): `script`, `layout`, `style`, `paint`. Null when LoAF is unsupported, no frames fired, or substage inputs were absent. |
| `context_visibility_hidden_at_load` | BOOL | `true` when `document.visibilityState === 'hidden'` at event creation. Default report aggregation pre-filters rows where this is `true` (background-tab loads) before computing sample size, percentiles, or shares. |
| `navigation_timing_dns_ms` | INT64 | Nullable. DNS lookup duration (`domainLookupEnd − domainLookupStart`). Null on reused connections; `0` valid when DNS is cached. |
| `navigation_timing_tcp_ms` | INT64 | Nullable. TCP handshake duration (`connectEnd − connectStart`). Null on reused / coalesced connections. |
| `navigation_timing_tls_ms` | INT64 | Nullable. TLS handshake isolated from TCP (`connectEnd − secureConnectionStart`). Null on TLS-coalesced or non-HTTPS. |
| `navigation_timing_redirect_ms` | INT64 | Nullable. Redirect duration (`redirectEnd − redirectStart`). `0` is meaningful (no redirect occurred). |
| `navigation_timing_service_worker_ms` | INT64 | Nullable. Service-worker time (`fetchStart − workerStart`) when SW intercepted; null otherwise. |
| `navigation_timing_request_to_first_byte_ms` | INT64 | Nullable. `responseStart − requestStart`. May be early-hints time per 2026 ResourceTiming semantics — see `request_to_final_headers_ms` for the clean anchor. |
| `navigation_timing_request_to_final_headers_ms` | INT64 | Nullable. `finalResponseHeadersStart − requestStart`. Time to actual HTML response headers (post-103). Null when `finalResponseHeadersStart` not exposed. |
| `navigation_timing_response_download_ms` | INT64 | Nullable. Response body transfer duration (`responseEnd − responseStart`). |
| `navigation_timing_interim_to_final_response_ms` | INT64 | Nullable. `finalResponseHeadersStart − firstInterimResponseStart` when both exposed. Captures the gap between 103 Early Hints and final HTML. |
| `navigation_timing_nav_ttfb_ms` | INT64 | Nullable. Raw nav TTFB (`responseStart − startTime`). Includes redirects + connect + request-response. |
| `navigation_timing_connection_ttfb_ms` | INT64 | Nullable. `responseStart − domainLookupStart`. Excludes redirect; isolates connect-through-response. |
| `navigation_timing_activation_adjusted_ttfb_ms` | INT64 | Nullable. User-visible TTFB on prerendered pages (`Math.max(0, responseStart − activationStart)`). Clamped to ≥ 0 because response can precede activation. |
| `navigation_timing_first_interim_response_start_ms` | INT64 | Nullable. Raw `firstInterimResponseStart` anchor (ms relative to nav start). Null when no 1xx interim response or API not exposed. |
| `navigation_timing_final_response_headers_start_ms` | INT64 | Nullable. Raw `finalResponseHeadersStart` anchor (ms relative to nav start). Null when API not exposed. |
| `navigation_timing_next_hop_protocol` | STRING | Nullable. Protocol negotiated (e.g. `h2`, `h3`, `http/1.1`). |
| `navigation_timing_transfer_size` | INT64 | Nullable. Total bytes transferred including headers. |
| `navigation_timing_encoded_body_size` | INT64 | Nullable. Body size in bytes as transmitted (post-encoding). |
| `navigation_timing_decoded_body_size` | INT64 | Nullable. Body size in bytes after decoding. 2026 ResourceTiming editor's draft; gated on browser availability. |
| `navigation_timing_content_encoding` | STRING | Nullable. Content-Encoding header value (e.g. `gzip`, `br`). 2026 editor's draft; experimental. |
| `navigation_timing_provenance_early_hints_present` | BOOL | Nullable. `true` when `firstInterimResponseStart > 0` (1xx interim response observed); `false` when `finalResponseHeadersStart > 0` and no interim; `null` when neither field exposed. |
| `navigation_timing_provenance_activation_adjusted` | BOOL | Nullable. `true` when `activationStart > 0` (prerender → user-visible baseline used); `false` on regular navigation; `null` when `activationStart` API not exposed. |
| `navigation_timing_provenance_timing_redacted_suspected` | BOOL | Nullable. `true` only when MULTIPLE timing fields are zero in a pattern consistent with TAO masking; `false` when comparable fields populated normally; `null` when underlying signals unavailable. |
| `navigation_timing_provenance_delivery_type` | STRING | Nullable. ResourceTiming editor's draft (e.g. `cache`, `navigational-prefetch`). |
| `navigation_timing_provenance_response_status` | INT64 | Nullable. HTTP status code if exposed by `responseStatus`. |

Do not rename the canonical metric fields if you want to keep the provided aggregation and URL-builder templates usable as-is.

Notes:

- Default Signal URL-builder templates exclude `navigation_type = restore`, `navigation_type = prerender`, and `context_visibility_hidden_at_load = true` before computing coverage and percentiles. The excluded background-tab count is preserved separately via the `rs` (raw pre-filter sample size) and `xb` (excluded background sessions) report-URL params so the credibility strip can narrate the exclusion transparently. Invariant: `raw_sample_size === sample_size + excluded_background_sessions`.
- Every URL-builder template emits a `b=<band>` parameter (`preliminary` | `provisional` | `stable`) computed inline from `sample_size` (thresholds: 100, 500). The hosted `/r` cover renders a confidence-band note above the masthead when `b !== stable` so a thin report can't masquerade as a stable read. Pre-band URLs (older snapshots) still decode cleanly — the codec back-fills the band from `s=` (sample_size) when `b=` is absent.
- Treat target/resource fields as diagnostic hints, not stable identifiers.
- Keep raw event-table access limited to the smallest group that needs it; the table can contain operationally sensitive path/referrer/resource context even though Signal is not a user-identity system.
- Apply warehouse retention and deletion policies intentionally, especially for `path`, `referrer`, `lcp_resource_url`, `lcp_target`, and `interaction_target`.
- If you materialize the latest `signal_report_url` into a current-state table, keep that table read-limited by default and publish outward only on purpose.

See also: [Collector Contract](./collector-contract.md) for endpoint requirements, [Aggregation Spec](./aggregation-spec.md) for how warehouse rows feed report generation.
