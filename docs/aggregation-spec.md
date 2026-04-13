# Signal Aggregation Spec

## Production Truth

Production truth comes from analytics-derived aggregation. Browser preview is non-authoritative and exists only for sanity-checking.

The Tier Report is not a diagnostic, attribution, or commercial modelling artifact. The aggregate should power a measured proof layer, not imply deeper certainty than the data supports.

For the canonical production artifact generated from the provided warehouse SQL, `period_days = 7` means the last 7 complete calendar days, excluding the current in-progress day.

## Required Aggregate Fields

`SignalAggregateV1` must include:

- network tier distribution
- device tier distribution
- sample size
- period days
- urban vs comparison-tier p75 values
- network coverage
- unclassified network share
- connection reuse share
- LCP coverage
- `comparison_tier`
- `race_metric`
- `race_fallback_reason`
- additive `experience_funnel` stage summaries for Act 3
- additive `device_hardware`, `network_signals`, and `environment` blocks (iteration 6)
- report version `rv=1`

## Actionable Signal Blocks (Iteration 6)

The aggregator preserves histograms and quartiles of the signals the SDK already captures per session. Every field has to pass the usefulness filter — it must unlock a concrete product-team decision, not duplicate data the team already has from GA / APM, and not be derivable at runtime. "Because we can" is not a reason.

### `device_hardware` (additive)

- `cores_hist` — `hardwareConcurrency` distribution across six buckets (`1`, `2`, `4`, `6`, `8`, `12_plus`). Universal capture, drives the JS-bundle-budget decision.
- `memory_gb_hist` — `navigator.deviceMemory` distribution across six buckets (`0_5`, `1`, `2`, `4`, `8_plus`, `unknown`). Chromium-only; Safari and Firefox sessions land in `unknown`. Drives the memory-budget decision.
- `memory_coverage` — percent of sessions where `deviceMemory` was exposed. Used to render an honest caveat alongside the histogram.

### `network_signals` (additive)

- `effective_type_hist` — `navigator.connection.effectiveType` distribution across five buckets (`slow_2g`, `2g`, `3g`, `4g`, `unknown`). Chromium-only; Safari and Firefox sessions land in `unknown`. Drives adaptive-loading decisions.
- `effective_type_coverage` — percent of sessions where `navigator.connection` was available. Used to caveat the histogram honestly.
- `save_data_share` — percent of sessions with `navigator.connection.saveData === true`. Drives the Save-Data HTTP header honour decision.
- `downlink_mbps` — quartile triple `{p25, p50, p75}` from `navigator.connection.downlink`. `null` when sample is below 20 or the API was unavailable. Drives the page-weight budget decision.
- `rtt_ms` — quartile triple from `navigator.connection.rtt`. Same null rules. Drives the request-consolidation decision.

### `environment` (additive)

- `browser_hist` — user-agent-derived browser distribution across five buckets (`chrome`, `safari`, `firefox`, `edge`, `other`). Drives the testing-matrix priority decision.

### Deliberately excluded

The following fields were considered and **cut** because they fail the usefulness filter:

- Viewport width / height — product teams already run media queries against `window.innerWidth` at CSS time. Aggregate viewport is redundant.
- Device pixel ratio — already solved at HTML time via `<img srcset>` and CSS `image-set()`. One-time sanity check at most.
- `navigator.maxTouchPoints` — product teams already know their mobile / desktop split from standard analytics.
- `navigator.connection.type` (wifi / cellular) — redundant with `effective_type`.
- TCP handshake quartiles — already abstracted into `net_tier`.
- `nav_type` histogram — interesting but does not unlock a specific product action.

If a future iteration wants to add any of these back, it must first name the concrete product-team decision the field unlocks, prove the decision isn't already actionable from existing analytics, and prove it isn't derivable at runtime.

### Backward compatibility

All three blocks are additive. `rv=1` URLs without these blocks decode cleanly and return `undefined` for the missing fields — the report surfaces the fields only when they are present.

## Comparison Tier

The comparison tier is the highest-share non-urban classified tier. If no non-urban tier has observations, `comparison_tier = "none"`.

## Act 2 Metric Fallback

The report renderer must not choose the race metric. The aggregate chooses it.

1. Use `lcp` only if both urban and comparison cohorts have at least 25 observations and at least 50% LCP coverage.
2. Else use `fcp` if both cohorts have at least 25 observations and non-zero FCP coverage.
3. Else use `ttfb` if both cohorts have at least 25 observations and non-zero TTFB coverage.
4. Else set `race_metric = "none"` and render an insufficient-data state.

All labels in Act 2 must explicitly name the selected metric.

## Act 3 Experience Funnel

The aggregate owns Act 3 stage activation. The renderer must not invent stages.

The additive `experience_funnel` block carries:

- `active_stages`
- `measured_session_coverage`
- `poor_session_share`
- per-stage thresholds
- per-tier stage coverage and poor-share summaries

Stage thresholds:

1. `fcp` poor threshold: `> 3000ms`
2. `lcp` poor threshold: `> 4000ms`
3. `inp` poor threshold: `> 500ms`

Stage activation rules:

1. `fcp` is active whenever the aggregate has reportable classified sample.
2. `lcp` is active only when there are at least 25 measured classified observations and at least 50% classified coverage.
3. `inp` is active only when there are at least 25 measured classified observations and at least 50% classified coverage.

`poor_session_share` must be computed from measured threshold crossings only. It is not a commercial or conversion model.

The aggregate may also drive presentation mood indirectly through measured outputs such as race gap and poor-session share, but that remains a renderer concern. The aggregate should expose truth, not a branded emotional state.

The hosted report may become more atmospheric or more restrained depending on the measured story, but the same evidence layer must remain obvious in every case:

- sample size
- observation window
- comparison tier
- race metric and fallback reason
- threshold basis
- poor-session share
- coverage honesty

When the hosted report compresses race coverage honesty into a single compact footer number, it must stay conservative:

- if a race exists, use the weaker of urban vs comparison selected-metric coverage
- if no race exists, label the compact footer as aggregate-wide `lcp coverage`

## Proxy / CDN Truth Boundary

Network classification reflects the effective path to the serving edge or proxy in many real deployments. It is operationally useful, but should not be framed as pure last-mile truth.

## Related documentation

- [Signal Technical Reference](./signal-technical-reference.md) — full field definitions, browser support, and classification thresholds
- [Public API v0.1](./public-api-v0.1.md) — canonical package contract and frozen field names
- [Warehouse Schema](./warehouse-schema.md) — recommended table structure for non-GA4 collection
- [Tier Report Design Spec](./tier-report-design-spec.md) — canonical presentation and product boundary for the hosted report
