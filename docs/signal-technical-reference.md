# Signal Technical Reference

This document is the companion to [Why Signal Exists](./why-signal.md). It covers the field-level detail, browser support boundaries, classification logic, aggregation rules, and architectural specifics that technical readers need for implementation and evaluation.

---

## Event Schema: SignalEventV1

Each page load produces a single JSON event with the following structure.

### Core identity

| Field | Type | Description |
|---|---|---|
| `v` | `1` | Schema version. Always `1` in current release. |
| `event_id` | `string` | Per-page-load identifier for deduplication and warehouse joins. Not a user identifier. |
| `ts` | `number` | Unix timestamp (milliseconds) when the event was finalized. |
| `host` | `string` | Origin hostname. |
| `url` | `string` | Page path. |
| `ref` | `string \| null` | Referrer origin + path (query and hash stripped for privacy). |

### Network classification

| Field | Type | Description |
|---|---|---|
| `net_tier` | `'urban' \| 'moderate' \| 'constrained_moderate' \| 'constrained' \| null` | TCP-based network quality tier. Null when measurement is unavailable. |
| `net_tcp_ms` | `number \| null` | Measured TCP handshake time in milliseconds. |
| `net_tcp_source` | `string` | How TCP time was derived. See [TCP source values](#tcp-source-values). |

### Device classification

| Field | Type | Description |
|---|---|---|
| `device_tier` | `'low' \| 'mid' \| 'high'` | Composite device capability tier. |
| `device_cores` | `number` | Logical CPU cores (`navigator.hardwareConcurrency`). Universal browser support. |
| `device_memory_gb` | `number \| null` | Approximate RAM in GB. **Chromium-only.** Null on Safari and Firefox. |
| `device_screen_w` | `number` | Screen width in CSS pixels. |
| `device_screen_h` | `number` | Screen height in CSS pixels. |

### Vitals

| Field | Type | Browser support | Description |
|---|---|---|---|
| `lcp_ms` | `number \| null` | Chromium-only | Largest Contentful Paint in ms. |
| `cls` | `number \| null` | Chromium-only | Cumulative Layout Shift (session window). |
| `inp_ms` | `number \| null` | Chromium-only | Interaction to Next Paint in ms. |
| `fcp_ms` | `number \| null` | Universal | First Contentful Paint in ms. |
| `ttfb_ms` | `number \| null` | Universal | Time to First Byte in ms. |

**Important:** LCP, CLS, and INP are not available in Safari or Firefox. These fields will be null for a meaningful share of mobile traffic, particularly in markets with significant iPhone usage. FCP and TTFB are universally available and always populated. Signal never fabricates a metric that was not measured.

### Optional attribution

These fields enrich the core vitals with diagnostic context when the browser supports it. All are nullable and optional.

**LCP attribution:**

| Field | Type | Description |
|---|---|---|
| `lcp_attribution.load_state` | `'loading' \| 'interactive' \| 'complete'` | Page load state when LCP occurred. |
| `lcp_attribution.target` | `string \| null` | Human-readable LCP element description. |
| `lcp_attribution.element_type` | `'image' \| 'text' \| null` | LCP element category. |
| `lcp_attribution.resource_url` | `string \| null` | Normalized resource URL (sanitized, no signed CDN URLs or sensitive query strings). |

**INP attribution:**

| Field | Type | Description |
|---|---|---|
| `inp_attribution.load_state` | `'loading' \| 'interactive' \| 'complete'` | Page load state when interaction occurred. |
| `inp_attribution.interaction_target` | `string \| null` | Human-readable interaction element description. |
| `inp_attribution.interaction_type` | `'pointer' \| 'keyboard' \| null` | Interaction modality. |
| `inp_attribution.interaction_time_ms` | `number \| null` | Relative timing within page lifecycle. |
| `inp_attribution.input_delay_ms` | `number \| null` | Time waiting before handler execution. Chromium-only. |
| `inp_attribution.processing_duration_ms` | `number \| null` | Time in handler execution. Chromium-only. |
| `inp_attribution.presentation_delay_ms` | `number \| null` | Time waiting for next paint. Chromium-only. |

### Connection context (supplementary, non-classifying)

These signals are collected for cross-reference but do not feed tier classification.

| Field | Type | Browser support | Description |
|---|---|---|---|
| `context.effective_type` | `string \| null` | Chromium-only | Chrome's estimated connection type (`slow-2g`, `2g`, `3g`, `4g`). |
| `context.downlink_mbps` | `number \| null` | Chromium-only | Estimated bandwidth in Mbps. Smoothed. |
| `context.rtt_ms` | `number \| null` | Chromium-only | Estimated round-trip time. Smoothed. Often diverges from TCP connect time. |
| `context.save_data` | `boolean \| null` | Chromium-only | Whether the user has requested reduced data usage. |
| `context.connection_type` | `string \| null` | Chromium Android only | Physical connection type: wifi, cellular, ethernet. Very limited availability. |

### Metadata

| Field | Type | Description |
|---|---|---|
| `meta.pkg_version` | `string` | Signal package version. |
| `meta.browser` | `string` | Browser family. |
| `meta.navigation_type` | `'navigate' \| 'reload' \| 'back-forward' \| 'prerender' \| 'restore'` | Normalized navigation semantics. Replaces the legacy `meta.nav_type` field (removed in 0.1.x). |

---

## Network Tier Classification

### Method

Signal uses the TCP handshake time from the Navigation Timing API (`PerformanceNavigationTiming`). For HTTPS origins, it isolates the TCP component by subtracting TLS negotiation:

```
tcp_connect_ms = secureConnectionStart - connectStart
```

This measures the actual round-trip time between the user's device and the server or CDN edge node.

### Thresholds

| Tier | TCP connect time | Typical conditions |
|---|---|---|
| `urban` | < 50 ms | Fibre, strong 4G/5G, low-latency urban mobile. |
| `moderate` | 50–150 ms (inclusive) | Suburban 4G, moderate congestion. |
| `constrained_moderate` | 151–400 ms (inclusive) | Congested 4G, weak signal, high-density peri-urban areas. |
| `constrained` | > 400 ms | 3G fallback, extreme congestion, satellite backhaul, rural edge. |

Default thresholds are calibrated against Opensignal network quality reports and CrUX BigQuery RTT distributions. They are configuration-overridable to match the network conditions of any market.

### TCP Source Values

The `net_tcp_source` field documents how the TCP measurement was derived and whether tier classification was possible.

| Value | Meaning | Tier assigned? |
|---|---|---|
| `nav_timing_tcp_isolated` | HTTPS origin, TCP isolated from TLS via `secureConnectionStart`. | Yes |
| `nav_timing_full` | HTTP origin, full `connectEnd - connectStart`. | Yes |
| `unavailable_reused` | Connection reused (HTTP/2 multiplexing, preconnect). `connectEnd - connectStart <= 0`. | No (`net_tier: null`) |
| `unavailable_sw` | Service Worker handled the request (`workerStart > 0`). Timing reflects cache, not network. | No |
| `unavailable_tls_coalesced` | TLS 1.3 0-RTT resumption. Cannot isolate TCP from TLS. | No |
| `unavailable_missing_timing` | No navigation timing entry available (e.g. restore/prerender navigations). | No |

Connection reuse affects an estimated 20-40% of page loads on sites using HTTP/2 with preconnect. These events are preserved in raw data with `net_tier: null` and contribute to the `unclassified_network_share` coverage metric.

---

## Device Tier Classification

The device tier uses a composite scoring model:

| Signal | Source | Availability |
|---|---|---|
| CPU cores | `navigator.hardwareConcurrency` | Universal |
| RAM | `navigator.deviceMemory` | **Chromium-only** (Chrome, Edge, Samsung Internet, Opera). Not available on Safari or Firefox. |
| Screen width | `screen.width` | Universal |

When `deviceMemory` is unavailable (Safari, Firefox), the classifier uses a conservative fallback based on core count and screen dimensions. This is a degraded-precision estimate, not a false confidence. Globally, Chromium-based browsers account for the majority of mobile sessions, so the full signal is typically available for most of the traffic that matters.

---

## Navigation Type Normalization

Signal normalizes the browser's navigation context into five semantic types:

| Type | Meaning |
|---|---|
| `navigate` | Standard navigation (link click, URL bar entry). |
| `reload` | Page reload. |
| `back-forward` | Back/forward navigation from browser history. |
| `prerender` | Page was prerendered before activation. |
| `restore` | Page restored from back-forward cache (bfcache). |

**Exclusion rule:** `restore` and `prerender` events are preserved in raw data and warehouse rows, but the default aggregation logic excludes them from report math. Paint metrics on restored pages reflect cache performance, not load performance, and including them would inflate the report's quality assessment.

---

## GA4 Compact Subset

The GA4 dataLayer sink pushes a flattened `perf_tier_report` event with a compact subset of the full schema. This path is designed for GTM forwarding, GA4 DebugView, and BigQuery export. The subset stays within GA4's standard event parameter limits.

The GA4 compact subset includes 24 fields: `event_id`, `host`, `url`, `net_tier`, `net_tcp_ms`, `net_tcp_source`, `device_tier`, `device_screen_w`, `lcp_ms`, `fcp_ms`, `ttfb_ms`, `browser`, `navigation_type`, `lcp_load_state`, `lcp_element_type`, `inp_load_state`, `interaction_type`, `input_delay_ms`, `processing_duration_ms`, `presentation_delay_ms`, `lcp_culprit_kind`, `lcp_dominant_subpart`, `inp_dominant_phase`, `third_party_weight_tier` — plus the `event` name itself for 25 total, exactly at GA4's custom-parameter ceiling. The legacy `nav_type` parameter has been removed in 0.1.x; use `navigation_type` (identical semantics, wider coverage).

`device_screen_w` unlocks the aggregate-time form-factor split (mobile / tablet / desktop) that the hosted report surfaces in the persistent footer. Breakpoints and rationale in [aggregation-spec.md](./aggregation-spec.md).

Fields deliberately excluded from the GA4 path (warehouse-only): `v`, `ts`, `ref`, `device_cores`, `device_memory_gb`, `device_screen_h`, `cls`, `inp_ms`, `effective_type`, `downlink_mbps`, `rtt_ms`, `save_data`, `connection_type`, `pkg_version`, `lcp_target`, `lcp_resource_url`, `interaction_target`, `interaction_time_ms`.

The full warehouse path (beacon or callback sink) carries the complete `SignalEventV1` including all attribution fields and diagnostic context that the GA4 path omits.

For the canonical field list and recommended custom dimension mappings, see [Public API v0.1](./public-api-v0.1.md).

---

## Aggregation and Coverage

### Aggregate structure

The aggregation layer produces a `SignalAggregateV1` containing:

- **Network distribution:** percentage breakdown across urban, moderate, constrained_moderate, constrained, and unknown (unclassified).
- **Device distribution:** percentage breakdown across low, mid, and high.
- **Comparison tier:** the highest-proportion non-urban tier, automatically selected as the comparison baseline.
- **Per-tier metric summaries:** p75 values for LCP, FCP, and TTFB for both urban and comparison tiers, with per-metric observation counts and coverage percentages. INP uses the 98th percentile (p98) of per-interaction durations, consistent with the CrUX/web-vitals methodology for responsiveness.
- **Measured experience funnel:** an additive `experience_funnel` block for the hosted Tier Report. It carries active stages, measured session coverage, poor-session share, stage thresholds, and per-tier stage summaries for FCP, LCP, and INP when coverage is defensible.
- **Actionable signal blocks** (iteration 6, additive): `device_hardware`, `network_signals`, and `environment` — see below.

### Actionable signal blocks (iteration 6)

Each block preserves signals the SDK already captures per session but the aggregator previously collapsed. Every field has to pass the usefulness filter — it unlocks a concrete product-team decision, isn't redundant with existing analytics, and isn't derivable at CSS / runtime.

**`device_hardware`** (universal cores, Chromium-only memory)

| Field | Source | Buckets / shape | Decision it unlocks |
|---|---|---|---|
| `cores_hist` | `navigator.hardwareConcurrency` | `1 / 2 / 4 / 6 / 8 / 12_plus` | JS-bundle budget: tighten critical path for the low-core share |
| `memory_gb_hist` | `navigator.deviceMemory` | `0_5 / 1 / 2 / 4 / 8_plus / unknown` | Memory budget: audit in-memory caches, leak-profile budget devices |
| `memory_coverage` | derived | percent of sessions with `deviceMemory` exposed | Renders the "Chromium · N% coverage" caveat honestly |

**`network_signals`** (Chromium-only Network Information API; Safari / Firefox land in `unknown`)

| Field | Source | Shape | Decision it unlocks |
|---|---|---|---|
| `effective_type_hist` | `navigator.connection.effectiveType` | `slow_2g / 2g / 3g / 4g / unknown` | Adaptive loading: defer non-critical resources, lower-res srcset |
| `effective_type_coverage` | derived | percent | Coverage caveat for the histogram |
| `save_data_share` | `navigator.connection.saveData` | percent | Honour the Save-Data HTTP header; serve lighter variants |
| `downlink_mbps` | `navigator.connection.downlink` | `{p25, p50, p75}` or `null` | Page-weight budget for the critical path |
| `rtt_ms` | `navigator.connection.rtt` | `{p25, p50, p75}` or `null` | Request consolidation: collapse origins, use Early Hints |

Quartile blocks return `null` when the underlying sample is below 20 — the report surfaces a "not enough data to defend" caveat instead of a noisy made-up number.

**`environment`**

| Field | Source | Shape | Decision it unlocks |
|---|---|---|---|
| `browser_hist` | `navigator.userAgent` parsed | `chrome / safari / firefox / edge / other` | Testing matrix priority: webkit smoke coverage in proportion to real audience share |

**Deliberately excluded** — viewport, device pixel ratio, touch points, `connection.type`, TCP quartiles, navigation-type histogram. Each was interrogated against the usefulness filter and cut.

All three blocks are additive and backward-compatible. `rv=1` URLs without these fields decode cleanly; the report surfaces the blocks only when present.

### Coverage honesty

The aggregate explicitly tracks:

| Coverage metric | What it measures |
|---|---|
| `network_coverage` | Proportion of events with a valid network tier classification. |
| `unclassified_network_share` | Proportion of events where TCP measurement was unavailable. |
| `connection_reuse_share` | Proportion of events with reused connections specifically. |
| `lcp_coverage` | Proportion of events with an LCP measurement (Chromium-only). |
| `selected_metric_urban_coverage` | Coverage of the selected race metric in the urban tier. |
| `selected_metric_comparison_coverage` | Coverage of the selected race metric in the comparison tier. |

If the hosted report compresses that race coverage honesty into one footer value, it should use the weaker of the two selected-metric tier coverages so the artifact never overstates confidence.

### Race metric fallback cascade

The aggregation selects the best available metric for the performance comparison ("race") between tiers:

1. **LCP** if both tiers have >= 25 observations AND >= 50% LCP coverage.
2. **FCP** if both tiers have >= 25 FCP observations but LCP coverage is insufficient. Reason: `lcp_coverage_below_threshold`.
3. **TTFB** if both tiers have >= 25 TTFB observations but FCP is unavailable. Reason: `fcp_unavailable`.
4. **None** if no metric has sufficient coverage. Reason: `insufficient_comparable_data`.

This cascade ensures the report never presents a comparison that lacks statistical backing. The fallback reason is included in the aggregate and displayed in the report.

### Act 3 thresholds and activation

The hosted Tier Report uses the additive `experience_funnel` block to render Act 3 as a measured experience funnel, not a revenue model.

Thresholds:

- FCP poor: `> 3000ms`
- LCP poor: `> 4000ms`
- INP poor: `> 500ms`

Activation:

- `fcp` is active whenever there is reportable classified sample
- `lcp` activates only when measured classified LCP coverage is defensible
- `inp` activates only when measured classified INP coverage is defensible

If the funnel block is absent because an older `rv=1` URL predates this additive contract, the report shell falls back to a reduced legacy Act 3 state instead of fabricating data.

For the full aggregation specification including comparison tier selection logic, see [Aggregation Spec](./aggregation-spec.md).

---

## Report URL

The report URL encodes the full aggregate into URL parameters and points to the hosted report shell at `https://signal.stroma.design/r`. The report page is a static HTML file served from Cloudflare Pages. It parses URL parameters, computes the visualization, and renders entirely client-side. No API calls. No server-side processing. No data logging.

Two generation paths:

| Path | Source | Typical use |
|---|---|---|
| **Preview** | In-browser `getReportUrl()` from the preview collector | Developer testing, stakeholder demos. Single-session data. Carries `mode=preview` flag. |
| **Production** | BigQuery URL builder SQL query against GA4 export | Site-level aggregate from real traffic. Canonical automation window: the last 7 complete calendar days, excluding the current day. |

The preview minimum sample threshold is 100 classified page loads. Below this, the URL is still generated but the report displays a coverage warning.

Teams can still run longer exploratory windows manually, but the shipped production SQL templates and the canonical `p=7` artifact are aligned to 7 complete days, not a today-inclusive rolling slice.

The Tier Report is not a diagnostic, attribution, or commercial modelling artifact. It is the measured proof layer that visualises audience shape, experience gap, and poor-performance progression.

---

## Package Modules

| Module | Import path | Contents | Approximate size |
|---|---|---|---|
| **Base** | `@stroma-labs/signal` | Tier classification, vitals capture, beacon and callback sinks | < 4 KB gzipped |
| **GA4 helper** | `@stroma-labs/signal/ga4` | dataLayer sink, GA4 event formatting | ~0.5 KB |
| **Report builder** | `@stroma-labs/signal/report` | In-memory aggregation, `getReportUrl()`, URL encoding | ~1 KB |

Tree-shaking ensures unused modules are excluded from production builds. A minimal installation importing only the base package stays under 4 KB.

---

## Local Development Tools

The repository includes development harnesses that are not part of the published npm package:

- **Spike lab** (`apps/signal-spike-lab`): proof-of-life harness for local validation. Provides a UI for triggering manual flushes, inspecting dataLayer events, viewing collector payloads, and testing GA4 transport.
- **Report shell** (hosted at `/r`): the hosted report visualization that consumes report URLs.
- **Builder** (hosted at `/build`): zero-code builder and validator for report URLs.

These tools support contributors and maintainers but are not required for package adoption.

The canonical presentation-layer source of truth for the hosted report lives in [Tier Report Design Spec](./tier-report-design-spec.md).
