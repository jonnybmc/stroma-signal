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
- Device tier classification (cores, memory, screen width)
- Network tier classification (TCP round-trip from Navigation Timing)
- Web Vitals observation (LCP, INP, CLS) with attribution
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
