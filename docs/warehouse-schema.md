# Signal Warehouse Schema

Recommended flat warehouse row shape for non-GA4 collection:

| Column | Type | Notes |
| --- | --- | --- |
| `schema_version` | INT64 | Currently `1` |
| `event_id` | STRING | Ephemeral once-only delivery identifier |
| `observed_at` | TIMESTAMP | Event observation time |
| `host` | STRING | Domain/host name |
| `path` | STRING | Path and query if retained |
| `referrer` | STRING | Nullable |
| `net_tier` | STRING | Nullable: `urban`, `moderate`, `constrained_moderate`, `constrained`; null for non-load-shaped `restore`/`prerender` rows |
| `net_tcp_ms` | INT64 | Nullable and null for non-load-shaped `restore`/`prerender` rows |
| `net_tcp_source` | STRING | Includes unavailable reasons |
| `device_tier` | STRING | `low`, `mid`, `high` |
| `device_cores` | INT64 | Browser logical cores |
| `device_memory_gb` | FLOAT64 | Nullable |
| `device_screen_w` | INT64 | CSS pixels |
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
| `nav_type` | STRING | `navigate`, `reload`, `back_forward` |
| `navigation_type` | STRING | Nullable normalized value: `navigate`, `reload`, `back-forward`, `prerender`, `restore` |
| `lcp_load_state` | STRING | Nullable: `loading`, `interactive`, `complete` |
| `lcp_target` | STRING | Nullable safe label from `generateTarget()` or default tag name |
| `lcp_element_type` | STRING | Nullable: `image` or `text` |
| `lcp_resource_url` | STRING | Nullable sanitized URL hint with query/hash stripped |
| `inp_load_state` | STRING | Nullable: `loading`, `interactive`, `complete` |
| `interaction_target` | STRING | Nullable safe label from `generateTarget()` or default tag name |
| `interaction_type` | STRING | Nullable: `pointer` or `keyboard` |
| `interaction_time_ms` | INT64 | Nullable interaction start time |
| `input_delay_ms` | INT64 | Nullable INP timing split |
| `processing_duration_ms` | INT64 | Nullable INP timing split |
| `presentation_delay_ms` | INT64 | Nullable INP timing split |

Do not rename the canonical metric fields if you want to keep the provided aggregation and URL-builder templates usable as-is.

Notes:

- `nav_type` remains the legacy raw navigation timing value for backward compatibility.
- Prefer `navigation_type` in new warehouse models and analysis.
- Default Signal URL-builder templates exclude `navigation_type = restore` and `navigation_type = prerender` before computing coverage and percentiles.
- Treat target/resource fields as diagnostic hints, not stable identifiers.
