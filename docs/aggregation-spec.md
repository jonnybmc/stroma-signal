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
- additive `form_factor_distribution` (mobile / tablet / desktop shares) derived from `device_screen_w`
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

### `form_factor_distribution` (additive)

Mobile / tablet / desktop split derived from `device_screen_w` at aggregation time. Universal capture (every event carries `device_screen_w`) so no coverage caveat is needed — unlike the Chromium-only blocks above.

Breakpoints:

- **Mobile** — `device_screen_w < 768`
- **Tablet** — `768 ≤ device_screen_w < 1280`
- **Desktop** — `device_screen_w ≥ 1280`

Rationale for these thresholds:

- `< 768` catches every phone in portrait and landscape (iPhones up to 430, Androids up to ~410, foldables up to ~540 landscape).
- `768–1279` catches iPads in portrait (744 / 768 / 834 / 1024) and iPad Pro 11" portrait (1024). It also catches a small fraction of laptops in split-screen or small-window usage — acceptable noise.
- `≥ 1280` catches every mainstream laptop (13"+) and desktop, and iPad Pro 12.9" in landscape (1366). The iPad Pro landscape case is the only meaningful mis-bucket — low enough frequency to accept.

The aggregator skips rows where `device_screen_w ≤ 0` (defensive — the SDK always writes a value). When no rows contribute, the field remains `undefined` rather than emitting a zero-sum triple, so legacy URLs decode cleanly.

Drives the Google mobile-page-experience decision: the single most buyer-legible signal on the landing for paid-media / CRO / SEO operators. Surfaces as a dedicated strip in the persistent footer (above the credibility strip) rather than nested in the Actionable Signals section.

### Deliberately excluded

The following fields were considered and **cut** because they fail the usefulness filter:

- Viewport width / height — product teams already run media queries against `window.innerWidth` at CSS time. Aggregate viewport is redundant.
- Device pixel ratio — already solved at HTML time via `<img srcset>` and CSS `image-set()`. One-time sanity check at most.
- `navigator.userAgentData.mobile` — Chromium-only boolean. Would give a slightly more accurate form-factor signal on Chromium (catches iPad Pro 12.9" landscape) but at the cost of an additional SDK capture field. Rejected for 0.1 because `device_screen_w` is universal and gives a strong-enough signal; the edge cases are below the noise floor.
- `navigator.connection.type` (wifi / cellular) — redundant with `effective_type`.
- TCP handshake quartiles — already abstracted into `net_tier`.
- Navigation-type histogram — interesting but does not unlock a specific product action. (`meta.nav_type` was removed in 0.1.x; `meta.navigation_type` remains for per-event filtering but is not aggregated.)

If a future iteration wants to add any of these back, it must first name the concrete product-team decision the field unlocks, prove the decision isn't already actionable from existing analytics, and prove it isn't derivable at runtime.

### Backward compatibility

All three blocks are additive. `rv=1` URLs without these blocks decode cleanly and return `undefined` for the missing fields — the report surfaces the fields only when they are present.

## Background-Tab Visibility Filter (PR-6)

Events where `context.visibility_hidden_at_load === true` are pre-filtered before any accumulator runs. Background-tab loads produce non-user-facing vitals (deprioritized throttling, long `hidden → visible` gaps, missing LCP) that would drag every percentile and share downward if included.

**Denominator semantics (locked).** Every post-filter metric — `sample_size`, `coverage.*`, all percentiles, funnel shares, race observations, and the credibility strip number — is computed against the *post-filter* cohort. The pre-filter count is preserved separately:

- `coverage.raw_sample_size` — total observed rows before the visibility filter
- `coverage.excluded_background_sessions` — rows dropped by the filter

Invariant (asserted at aggregation time): `raw_sample_size === sample_size + excluded_background_sessions`. A mismatch throws — denominator drift is a bug, not a silent degradation.

When `excluded_background_sessions > 0`, the report credibility strip appends a transparent segment (e.g. *"· 187 background-tab loads excluded"*). When zero, silence is the correct signal — no segment is rendered.

## Marginal-Coverage Warning (PR-6)

When the LCP cohort lands within a small margin of the ship thresholds — `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT = 10` (i.e. 50% ≤ `lcp_coverage` < 60%) or `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS = 10` (i.e. 25 ≤ `lcp_observations` < 35) — aggregation appends a `coverage_marginal` warning. The report credibility strip renders *"coverage at the defensible edge"* so readers can temper their read rather than being handed a falsely confident narrative. Pure additive signal — no aggregate math changes.

## Save-Data Narration Threshold (PR-6)

`SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT = 1` controls when the Data Saver line is rendered in Act 1. Shares below 1% round to 0% and the line is omitted entirely — zero users on Data Saver is not an interesting story. The constant lives in `packages/signal-contracts/src/types.ts` and is imported wherever the narration gate applies.

## Report URL Byte Budget (PR-6)

`encodeSignalReportUrl` asserts the encoded URL size to prevent silent transport failures:

- Soft limit: `SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES = 2048`. Breach pushes `signal_report_url_exceeds_soft_limit:<bytes>` onto the returned `warnings[]` array; the URL still emits.
- Hard limit: `SIGNAL_REPORT_URL_HARD_LIMIT_BYTES = 4096`. Breach throws — emitting a truncated or corrupted URL is strictly worse than failing loudly.

Size is measured via `TextEncoder` (browser) or `Buffer.byteLength` (Node) for UTF-8 byte accuracy. The budget exists because enriching the aggregate with many optional story blocks could push structurally-valid payloads past common URL-length limits.

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
