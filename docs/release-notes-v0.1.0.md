# Release Notes: v0.1.0

## Signal by Stroma

First public release of `@stroma-labs/signal`.

## What ships

- One published package: `@stroma-labs/signal`
- Public subpath exports:
  - `@stroma-labs/signal/ga4`
  - `@stroma-labs/signal/report`
- Native-first event collection with one finalized event per navigation
- Analytics-agnostic sinks:
  - `createDataLayerSink()`
  - `createBeaconSink()`
  - `createCallbackSink()`
- Preview collector and hosted report URL builder flow
- GTM/GA4-first launch pack
- Zero-code `/build` fallback and QA surface

## v0.1 diagnostic enrichments

This release adds additive, capability-gated diagnostics without changing the launch report schema:

- `meta.navigation_type`
- `vitals.lcp_attribution`
- `vitals.inp_attribution`
- `generateTarget()` hook

GA4 receives only the compact diagnostic subset needed for GTM/GA4 launch flows. High-cardinality target/resource strings remain out of the GA4 path in v0.1.

## What stays intentionally out of scope

- direct `gtag` loading in the public package
- session persistence
- SPA soft-navigation support
- Stroma-hosted raw-data ingestion
- benchmark automation
- Act 3 automation
- full design-spec report experience

## Launch default

The primary launch path is:

1. Deploy Signal with automatic collection
2. Forward `perf_tier_report` through GTM / GA4
3. Confirm rows land in BigQuery
4. Run the saved query that returns a final hosted `/r?...` URL
5. Share that URL internally

## Notes for integrators

- `perf_tier_report` is the frozen event name for v0.1
- `meta.nav_type` remains for backward compatibility
- prefer `meta.navigation_type` in new warehouse analysis
- the hosted report is currently a functional shell and QA surface, not yet the full design-spec visual experience
