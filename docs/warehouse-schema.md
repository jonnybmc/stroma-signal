# Signal Warehouse Schema

Recommended flat warehouse row shape for non-GA4 collection:

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
| `net_tcp_source` | STRING | Includes unavailable reasons |
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
| `navigation_type` | STRING | Nullable normalized value: `navigate`, `reload`, `back-forward`, `prerender`, `restore`. Replaces the legacy `nav_type` column (removed in 0.1.x). |
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

Do not rename the canonical metric fields if you want to keep the provided aggregation and URL-builder templates usable as-is.

Notes:

- The legacy `nav_type` column has been removed in 0.1.x. Consumers that pinned to it should switch to `navigation_type` (identical semantics, wider coverage).
- Default Signal URL-builder templates exclude `navigation_type = restore`, `navigation_type = prerender`, and `context_visibility_hidden_at_load = true` before computing coverage and percentiles. The excluded background-tab count is preserved separately via the `rs` (raw pre-filter sample size) and `xb` (excluded background sessions) report-URL params so the credibility strip can narrate the exclusion transparently. Invariant: `raw_sample_size === sample_size + excluded_background_sessions`.
- Treat target/resource fields as diagnostic hints, not stable identifiers.
- Keep raw event-table access limited to the smallest group that needs it; the table can contain operationally sensitive path/referrer/resource context even though Signal is not a user-identity system.
- Apply warehouse retention and deletion policies intentionally, especially for `path`, `referrer`, `lcp_resource_url`, `lcp_target`, and `interaction_target`.
- If you materialize the latest `signal_report_url` into a current-state table, keep that table read-limited by default and publish outward only on purpose.

See also: [Collector Contract](./collector-contract.md) for endpoint requirements, [Aggregation Spec](./aggregation-spec.md) for how warehouse rows feed report generation.
