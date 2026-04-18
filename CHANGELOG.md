# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

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

### Removed

- **Breaking:** `meta.nav_type` has been dropped from `SignalEventV1`, the GA4 flatten (`nav_type` param), the normalized warehouse row (`nav_type` column), the GTM recipe / workspace template, and the BigQuery SQL recipes. Use `meta.navigation_type` — identical semantics, wider browser coverage (includes `prerender` and `restore`, which the legacy field could not represent). Consumers pinned to the old column must migrate the warehouse SELECT list, any GA4 custom-definition mappings, and any DLV references before upgrading to 0.1.x.

### Security

- strengthened collector and warehouse guidance around validation, dedupe, rate limiting, privacy retention, and access control
