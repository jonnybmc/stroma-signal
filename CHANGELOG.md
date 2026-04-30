# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-release identifiers (e.g. `-rc.N`) are published to the npm `next`
dist-tag. The `latest` dist-tag is reserved for stable releases. To
install a pre-release: `pnpm add @stroma-labs/signal@next` (or pin to
the exact version, e.g. `@stroma-labs/signal@0.1.0-rc.1`).

## [0.1.0-rc.1] - 2026-04-30

First public release candidate. Published for pilot testing — feature-
complete for the v0.1 scope, expected to graduate to `0.1.0` once
warehouse-derived report URLs are validated against fixture semantics
end-to-end on a live deployment.

### Added

- `init()` runtime with automatic page-lifecycle collection
- `createBeaconSink()` for sending events via `sendBeacon` / `fetch` fallback
- `createCallbackSink()` for custom in-app handling
- `createDataLayerSink()` via `@stroma-labs/signal/ga4` for GTM / GA4 integration
- `createPreviewCollector()` via `@stroma-labs/signal/report` for local preview URLs
- `@stroma-labs/signal/summary` helper surface for plain-text summaries plus JSON/CSV export
- Device tier classification (cores, memory, screen width)
- Network tier classification (TCP round-trip from Navigation Timing)
- Web Vitals observation (LCP, INP, CLS) with attribution
- Chromium LCP subpart breakdown (`resource_load_delay_ms`, `resource_load_time_ms`, `element_render_delay_ms`) with all-or-nothing null discipline
- Chromium LCP culprit-kind classifier (`hero_image`, `headline_text`, `banner_image`, `product_image`, `video_poster`, `unknown`) on sanitized resource hints
- Chromium INP dominant-phase attribution (`input_delay`, `processing`, `presentation`) with deterministic tiebreak ordering
- Third-party pre-LCP script weight capture (`pre_lcp_script_share_pct`, `origin_count`) with eTLD+1 first-party classification, optional `firstPartyOriginsAllowlist` init hook, and privacy mask hiding origin counts below 3
- GA4 enum summaries: `lcp_culprit_kind`, `lcp_dominant_subpart`, `inp_dominant_phase`, `third_party_weight_tier`
- Aggregate stories surfaced in the hosted report: Act 2 LCP subpart narrative + micro-chart, Act 2 third-party pre-race headline (with positive narration when zero off-domain weight), Act 3 INP-phase inline caption
- Warehouse columns for LCP breakdown, culprit kind, INP phase, third-party share/origin count
- Chromium 123+ Long Animation Frame capture (`vitals.loaf.worst_duration_ms`, `dominant_cause`, `script_origin_count`) using `PerformanceObserver('long-animation-frame')`; retains only the worst-duration frame per session (running max) for bounded memory
- Aggregate `loaf_story` with dominant-cause share, p75 worst-frame duration, and observation-threshold gating (25 observations minimum, 35% dominance hedge)
- Act 3 inline LoAF narrative line beneath the INP funnel caption — never claimed when the INP funnel stage itself could not be defended
- Warehouse column `loaf_dominant_cause` (CSV column 45, positional lock: immediately before `context_visibility_hidden_at_load`)
- Background-tab visibility filter: `context.visibility_hidden_at_load` captured per event; default aggregation pre-filters background-tab loads from every percentile, share, and accumulator
- `coverage.raw_sample_size` and `coverage.excluded_background_sessions` preserved so the report credibility strip can narrate the exclusion transparently (invariant: `raw_sample_size === sample_size + excluded_background_sessions`)
- Marginal-coverage warning (`coverage_marginal`) emitted when the LCP cohort lands within 10% / 10 observations of the ship thresholds; credibility strip renders *"coverage at the defensible edge"* so readers temper their read
- Report URL byte budget assertions in `encodeSignalReportUrl`: soft limit (2048 bytes) pushes `signal_report_url_exceeds_soft_limit` warning; hard limit (4096 bytes) throws
- Named constants for threshold tuning: `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT`, `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS`, `SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT`, `SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES`, `SIGNAL_REPORT_URL_HARD_LIMIT_BYTES`
- Warehouse column `context_visibility_hidden_at_load` (CSV column 46)
- Back/forward cache restore and prerender-aware lifecycle
- Sample rate support
- Frozen data contracts (`SignalEventV1`, `SignalAggregateV1`)
- URL codec for hosted report state
- GA4 event flattening
- Aggregation rules with percentile bucketing
- Hosted report shell and zero-code builder app
- Proof-of-life spike lab with local collector
- Playwright E2E tests across Chromium, Firefox, and WebKit
- Bundle size budgets, import boundary checks, and export validation

### Changed

- release metadata and docs now align to the canonical `jonnybmc/stroma-signal` repository
- npm packaging excludes sourcemaps while keeping local build sourcemaps enabled
- contributor installs now fail fast on unsupported Node versions via root `engine-strict=true`
- Act 2 race-bar motion no longer animates when `urban_ms` or `comparison_ms` is null — static render replaces the hardcoded `2100ms`/`3400ms` fallback so viewers cannot infer magnitude from decorative motion
- Default report math now also excludes `context.visibility_hidden_at_load = true` rows alongside the existing `navigation_type = restore` / `navigation_type = prerender` filter; both BigQuery URL-builder recipes updated (the normalized recipe emits `rs`/`xb` params; the GA4 recipe documents the asymmetry — visibility is warehouse-only)

### Removed

- **Breaking:** `meta.nav_type` has been dropped from `SignalEventV1`, the GA4 flatten (`nav_type` param), the normalized warehouse row (`nav_type` column), the GTM recipe / workspace template, and the BigQuery SQL recipes. Use `meta.navigation_type` — identical semantics, wider browser coverage (includes `prerender` and `restore`, which the legacy field could not represent). Consumers pinned to the old column must migrate the warehouse SELECT list, any GA4 custom-definition mappings, and any DLV references before upgrading to 0.1.x.

### Security

- strengthened collector and warehouse guidance around validation, dedupe, rate limiting, privacy retention, and access control
