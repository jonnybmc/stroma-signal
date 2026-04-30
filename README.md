<img src="./docs/images/signal-stroma-logo.png" alt="Signal" width="270" />

[![CI](https://github.com/jonnybmc/stroma-signal/actions/workflows/ci.yml/badge.svg)](https://github.com/jonnybmc/stroma-signal/actions/workflows/ci.yml)
[![npm @next](https://img.shields.io/npm/v/@stroma-labs/signal/next?label=npm%20%40next)](https://www.npmjs.com/package/@stroma-labs/signal)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> 🧪 **Release Candidate** — `0.1.0-rc.2` on the `next` dist-tag. The `0.x` line is pre-stable; the API can change before `1.0`.

**Other RUM tools tell you what your average user experiences. Signal tells you _who_ is getting which experience — and lets you act on it.**

A small browser library that classifies every page load by the user's real network and device conditions, captures Web Vitals against those conditions, and delivers the data to your own analytics. Field evidence per session, not lab averages or coarse vendor buckets.

## Why Signal

| You're already using…                  | What it gives you                                | What it doesn't tell you                                                       |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| **GA4 / GTM**                          | Event capture, attribution, funnels              | Whether the user was on fibre or a congested 4G tower (both report as "4g")    |
| **Lighthouse**                         | Lab Web Vitals on a single test device            | What real users on real networks actually feel                                 |
| **CrUX**                               | Aggregated Chrome field data                      | Per-session detail, attribution, your own segmentation                         |
| **Datadog RUM / NewRelic / SpeedCurve** | Dashboards, alerting, vendor opinions             | Honest segmentation by real network tier; you also pay enterprise pricing      |
| **Signal**                             | Real-user network + device tier per page load, joined to your own warehouse, in a 4 KB SDK | A dashboard (we don't ship one — you bring your own analytics)                 |

Signal sits one layer beneath every option above: it produces the per-session evidence the others can't or won't capture, and you wire it into whatever you already use.

## Install

```bash
pnpm add @stroma-labs/signal@next
```

ESM-only. Works in any modern browser. Zero runtime dependencies.

## Quickstart — pick one

### Already on GTM and GA4 (most common)

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({ sinks: [createDataLayerSink()] });
```

✅ Success: `perf_tier_report` appears in GTM Preview, then GA4 DebugView. → [Marketer quickstart](./docs/marketer-quickstart.md) for the rest of the path to a shareable report URL.

### Have your own collector / endpoint

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({ sinks: [createBeaconSink({ endpoint: '/rum/signal' })] });
```

✅ Success: one POST hits your endpoint with an `event_id`. → [Collector contract](./docs/collector-contract.md) for the schema you'll receive.

### Want app-level control

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';

init({
  sinks: [createCallbackSink({
    onReport(event) { /* your code */ }
  })]
});
```

✅ Success: your callback fires with the event object. → [Warehouse schema](./docs/warehouse-schema.md) for field definitions.

You can run several sinks at once — e.g., dataLayer for GA4 plus a beacon to your warehouse.

## What you get back

One event per page load with:

- **Network tier** — `urban`, `moderate`, `constrained_moderate`, `constrained` from the actual TCP handshake (not the coarse browser label)
- **Device tier** — `low`, `mid`, `high` from real hardware signals
- **Web Vitals** — LCP, INP, CLS, FCP, TTFB with attribution (which element was slow, which interaction phase dominated, which third-party scripts loaded before paint)
- **Long Animation Frame** story on Chromium 123+
- **Background-tab filter** so percentiles aren't poisoned by hidden-tab loads

No PII. No cookies set by us. The runtime is opinionated about what *not* to capture — see [why-signal.md](./docs/why-signal.md) for the deliberate exclusions.

## From SDK to shareable report URL

The SDK is just collection. The full path to a shareable URL:

1. **Install Signal** (above)
2. **Land events** in BigQuery via GA4 + automatic export, or in your own warehouse via the beacon
3. **Run the URL-builder query** — we ship the SQL templates ([GA4](./docs/ga4-bigquery-url-builder.sql), [normalized warehouse](./docs/normalized-bigquery-url-builder.sql))
4. **Share the resulting `signal_report_url`** — recipients see your real-user performance gap at `signal.stroma.design/r/...`, no login required

For the production operating model (manual vs scheduled refresh, where to surface the URL, what to do when rows lag), see [production-report-automation.md](./docs/production-report-automation.md).

## Where to go next

**Non-technical / launch ops:**
- [Marketer quickstart](./docs/marketer-quickstart.md) — GTM-first, plain English, end-to-end
- [Production report automation](./docs/production-report-automation.md) — keeping the URL fresh
- [Launch troubleshooting](./docs/launch-troubleshooting.md) — common gotchas

**Engineers:**
- [Setup guide](./docs/client-integrations.md) — the three paths above with detail
- [Framework recipes](./docs/framework-recipes.md) — React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit
- [SPA / SSR caveats](./docs/spa-ssr-caveats.md)
- [GTM recipe](./docs/gtm-recipe.md) + [workspace template](./docs/gtm-workspace-template.json)

**Reference / contracts:**
- [Public API (v0.1)](./docs/public-api-v0.1.md) — every export
- [Technical reference](./docs/signal-technical-reference.md) — schemas, thresholds, browser support
- [Aggregation spec](./docs/aggregation-spec.md) — how the warehouse rules work
- [Tier Report design spec](./docs/tier-report-design-spec.md) — what the hosted report shows and why
- [Why Signal exists](./docs/why-signal.md) — the philosophical bit

## Verification

Every release ships with [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements). After install:

```bash
npm audit signatures
# → "1 package has a verified attestation"
```

That confirms the tarball was built by [this repository's publish workflow](https://github.com/jonnybmc/stroma-signal/actions/workflows/publish.yml) on the exact commit referenced in the release notes.

---

## For contributors

Local development (you don't need this to use the SDK):

```bash
git clone https://github.com/jonnybmc/stroma-signal.git
cd stroma-signal
pnpm install --frozen-lockfile
pnpm test:unit       # full unit suite
pnpm dev:report      # /r and /build at localhost:4174
pnpm dev:spike       # local proof-of-life harness at localhost:4173
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for tone, commit conventions, and the public/private boundary contributors should know about.

### Workspace

| Path                          | What it is                                                       |
| ----------------------------- | ---------------------------------------------------------------- |
| `packages/signal`             | The published `@stroma-labs/signal` SDK                          |
| `packages/signal-contracts`   | Shared types, URL codec, aggregation rules, fixtures, SQL templates |
| `apps/signal-report`          | Renders the hosted Tier Report at `/r` and the zero-code builder at `/build` |
| `apps/signal-spike-lab`       | Local proof-of-life harness used for SDK validation              |

### Release process

The publish workflow runs on every GitHub Release tagged `vX.Y.Z`. Stable tags publish to `latest`; pre-release tags (`-rc.N`, `-beta.N`) publish to `next`. Auth is via [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) — no long-lived `NPM_TOKEN` required.

## License

MIT — see [LICENSE](./LICENSE).
