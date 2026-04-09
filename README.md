<img src="./docs/images/signal-stroma-logo.png" alt="Signal by Stroma logo" width="360" />

[![CI](https://github.com/jonathanbooysen/stroma-signal/actions/workflows/ci.yml/badge.svg)](https://github.com/jonathanbooysen/stroma-signal/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@stroma-labs/signal)](https://www.npmjs.com/package/@stroma-labs/signal)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@stroma-labs/signal)](https://bundlephobia.com/package/@stroma-labs/signal)

Native-first browser instrumentation for measuring real-user network, device, and performance tiers without forcing teams into a single analytics stack.

## Install

```bash
pnpm add @stroma-labs/signal
```

`@stroma-labs/signal` is published as an ESM-only package.

Signal is event-first and analytics-agnostic. Pick the sink that matches your environment.

## Choose Your Role

### I need the shareable report URL

Use this if: you own launch, martech, analytics, or product ops and want the shortest path from installed Signal to an always-current hosted report URL.

Start here:

- [marketer quickstart](./docs/marketer-quickstart.md)
- [production report automation](./docs/production-report-automation.md)

### I need to implement Signal

Use this if: you are the engineer wiring Signal into app code, GTM, or a warehouse flow.

Start here:

- [choose your setup](./docs/client-integrations.md)
- [framework recipes](./docs/framework-recipes.md)

## What Signal Automates

Signal automates browser-side collection and gives you canonical SQL templates for the final hosted report URL.

Your team still configures the warehouse refresh once:

- GTM / GA4 or your own collector must land rows in BigQuery
- your team saves or schedules the provided URL-builder query
- the final artifact is a hosted `signal_report_url` that you can share internally

Signal does not create BigQuery scheduled queries, persistence tables, or dashboards for you in v0.1.

## Choose Your Setup

### I already have GTM / GA4

Use this if: your site already uses GTM and you want Signal to emit a compact GA4-safe subset into `window.dataLayer`.

Exact import:

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';
```

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

Success check: `perf_tier_report` appears in GTM Preview, then in GA4 DebugView.

Next doc: [marketer quickstart](./docs/marketer-quickstart.md)

### I want to send to my own endpoint

Use this if: you already have a collector or backend endpoint and want warehouse truth without GTM.

Exact import:

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';
```

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/rum/signal' })]
});
```

Success check: one request lands at your collector and the payload contains `event_id`.

Next doc: [collector contract](./docs/collector-contract.md)

### I want full control in app code

Use this if: you already have an internal analytics wrapper or want to decide in app code what happens to each canonical event.

Exact import:

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';
```

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';

init({
  sinks: [
    createCallbackSink({
      onReport(event) {
        console.log(event.event_id);
      }
    })
  ]
});
```

Success check: your callback fires once and exposes the canonical event object.

Next doc: [warehouse schema](./docs/warehouse-schema.md)

## First 5 Minutes

1. Choose your integration mode.
2. Paste the matching snippet into app code.
3. Verify one event locally.
4. Verify GTM / GA4 or endpoint landing.
5. Generate the first report URL.

## Report URL Paths

- GTM / GA4 path: validate rows with [ga4-bigquery-validation.sql](./docs/ga4-bigquery-validation.sql), then generate the hosted report with [ga4-bigquery-url-builder.sql](./docs/ga4-bigquery-url-builder.sql).
- Own endpoint and full-control paths: validate rows with [normalized-bigquery-validation.sql](./docs/normalized-bigquery-validation.sql), then generate the hosted report with [normalized-bigquery-url-builder.sql](./docs/normalized-bigquery-url-builder.sql).
- [`/build`](http://signal.stroma.design/build) stays the QA and fallback path, not the primary launch automation flow.

If you want the plain-English production operating model for the BigQuery step, use [production report automation](./docs/production-report-automation.md).

The validation queries show raw rows, including `navigation_type = restore` and `navigation_type = prerender`. The URL-builder queries exclude those non-load-shaped rows by default so shared reports stay tied to normal load performance.

## Framework Recipes

Signal is framework-agnostic. These recipes cover where to initialise, SSR guards, and duplicate-init safety for each environment:

- [Vanilla / React / Next.js / Vue / Nuxt / Angular / Svelte / SvelteKit](./docs/framework-recipes.md)
- [SPA and SSR caveats](./docs/spa-ssr-caveats.md)

## Deeper Docs

- [choose your setup](./docs/client-integrations.md)
- [public API freeze (v0.1)](./docs/public-api-v0.1.md)
- [marketer quickstart](./docs/marketer-quickstart.md)
- [production report automation](./docs/production-report-automation.md)
- [GTM recipe](./docs/gtm-recipe.md)
- [collector contract](./docs/collector-contract.md)
- [warehouse schema](./docs/warehouse-schema.md)
- [BigQuery saved query setup](./docs/bigquery-saved-query-setup.md)
- [launch troubleshooting](./docs/launch-troubleshooting.md)

## Additional Diagnostics

Signal also emits additive, capability-gated diagnostics for richer warehouse analysis:

- `meta.navigation_type` for normalized navigation lifecycle analysis
- `vitals.lcp_attribution` for load-state, target, and resource context
- `vitals.inp_attribution` for load-state and interaction timing splits

These fields stay optional and nullable, and the launch report schema remains unchanged.

`restore` and `prerender` events are preserved in raw runtime and warehouse data, but the default report SQL excludes them from paint and network percentile calculations in v0.1.

## Launch Automation Pack

For v0.1 launch, the primary automation path is:

- Signal deployed with automatic collection
- client-owned warehouse receives rows
- a BigQuery URL-builder query returns a final hosted `signal_report_url`
- the user team decides whether that query is rerun manually or on a schedule
- that URL is the shareable internal asset

Start here:

- [marketer quickstart](./docs/marketer-quickstart.md)
- [production report automation](./docs/production-report-automation.md)
- [GTM workspace template](./docs/gtm-workspace-template.json)
- [BigQuery saved query setup](./docs/bigquery-saved-query-setup.md)
- [launch troubleshooting](./docs/launch-troubleshooting.md)

## Workspace Layout

- `packages/signal-contracts`
  - canonical `SignalEventV1`, `SignalAggregateV1`, URL codec, aggregation rules, fixtures
- `packages/signal`
  - published package `@stroma-labs/signal`
  - subpath exports `./ga4` and `./report`
- `apps/signal-spike-lab`
  - local proof-of-life harness with a collector endpoint
- `apps/signal-report`
  - static report shell at `/r` and zero-code builder at `/build`

## Local Development

```bash
pnpm install
pnpm test:unit
pnpm build
```

Run the proof-of-life apps in separate terminals:

```bash
pnpm dev:report
pnpm dev:spike
```

By default the spike lab assumes the report shell is available at `http://localhost:4174/r`.
If you set `VITE_SIGNAL_GA4_MEASUREMENT_ID`, the spike lab will also boot a spike-lab-only live GA4 transport outside browser automation, so the same local harness can validate:

- callback/runtime truth
- beacon/local collector landing
- `dataLayer` flattening
- real `gtag` delivery into your dev GA4 property

During Playwright runs, the live GA4 transport is intentionally skipped so browser tests stay deterministic.
The local spike lab enables `debug: true` so the browser console shows raw FCP/LCP observations, the flush reason, and the final payload before sink emission.

## v0.1 Scope

- one published package: `@stroma-labs/signal`
- dataLayer/GTM integration via `@stroma-labs/signal/ga4`
- preview/report builder via `@stroma-labs/signal/report`
- production truth from analytics-derived aggregation
- preview explicitly limited to sanity-check use
- report hostname standardized to `https://signal.stroma.design`

## Release Boundary

The v0.1 release boundary is:

- one canonical public package contract
- one verified GTM / GA4 launch pack
- one proven GA4 -> BigQuery -> hosted report URL path
- one published npm package and tagged GitHub release

Until the warehouse-derived report URL matches fixture semantics exactly, the repo should be treated as release-candidate software rather than a fully closed 0.1 release.

The release-facing launch docs are a coordinated public surface and should stay aligned:

- `README.md`
- `docs/marketer-quickstart.md`
- `docs/production-report-automation.md`
- `docs/bigquery-saved-query-setup.md`
