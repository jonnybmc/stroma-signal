# Signal by Stroma

Native-first browser instrumentation for measuring real-user network, device, and performance tiers without forcing teams into a single analytics stack.

## Install

```bash
pnpm add @stroma-labs/signal
```

`@stroma-labs/signal` is published as an ESM-only package.

## Public Integration Modes

Signal is event-first and analytics-agnostic. Pick the sink that matches your environment.

### GTM / dataLayer

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

### Own endpoint

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/rum/signal' })]
});
```

### Full control in app code

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';

init({
  sinks: [
    createCallbackSink({
      onReport(event) {
        console.log(event.event_id);
      }
    })
  ],
  generateTarget(element) {
    if (!element) return null;
    if (element.tagName.toLowerCase() === 'button') return 'primary-cta';
    return element.tagName.toLowerCase();
  }
});
```

Signal also emits additive, capability-gated diagnostics for richer warehouse analysis:

- `meta.navigation_type` for normalized navigation lifecycle analysis
- `vitals.lcp_attribution` for load-state, target, and resource context
- `vitals.inp_attribution` for load-state and interaction timing splits

These fields stay optional and nullable, and the launch report schema remains unchanged.

More detail:

- [public API freeze (v0.1)](./docs/public-api-v0.1.md)
- [client integrations](./docs/client-integrations.md)
- [GTM recipe](./docs/gtm-recipe.md)
- [collector contract](./docs/collector-contract.md)
- [warehouse schema](./docs/warehouse-schema.md)

## Launch Automation Pack

For v0.1 launch, the primary automation path is:

- Signal deployed with automatic collection
- client-owned warehouse receives rows
- a saved BigQuery query returns a final hosted `signal_report_url`
- that URL is the shareable internal asset

Start here:

- [marketer quickstart](./docs/marketer-quickstart.md)
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
pnpm test
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
