<img src="./docs/images/signal-stroma-logo.png" alt="Signal" width="220" />

[![CI](https://github.com/jonnybmc/stroma-signal/actions/workflows/ci.yml/badge.svg)](https://github.com/jonnybmc/stroma-signal/actions/workflows/ci.yml)
[![npm @next](https://img.shields.io/npm/v/@stroma-labs/signal/next?label=npm%20%40next)](https://www.npmjs.com/package/@stroma-labs/signal)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> 🧪 **Release Candidate** — `0.1.0-rc.3` on the `next` dist-tag. The `0.x` line is pre-stable; the API can change before `1.0`.

**Other RUM tools tell you what your average user experiences. Signal tells you _who_ is getting which experience — and lets you act on it.**

A small browser library that classifies every page load by the user's real network and device conditions, captures Web Vitals against those conditions, and delivers the data to your own analytics. Field evidence per session, not lab averages or coarse vendor buckets.

## Why Signal

| You're already using…                  | What it gives you                                | What it doesn't tell you                                                       |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| **GA4 / GTM**                          | Event capture, attribution, funnels              | Whether the user was on fibre or a congested 4G tower (both report as "4g")    |
| **Lighthouse**                         | Lab Web Vitals on a single test device            | What real users on real networks actually feel                                 |
| **CrUX**                               | Aggregated Chrome field data                      | Per-session detail, attribution, your own segmentation                         |
| **Datadog RUM / NewRelic / SpeedCurve** | Dashboards, alerting, vendor opinions             | Honest segmentation by real network tier; you also pay enterprise pricing      |
| **Signal**                             | Real-user network + device tier + Navigation Timing breakdown per page load, joined to your own warehouse, in a ~6 KB SDK | A dashboard (we don't ship one — you bring your own analytics)                 |

Signal sits one layer beneath every option above: it produces the per-session evidence the others can't or won't capture, and you wire it into whatever you already use.

## What Signal adds beyond GA4

GA4 is comprehensive on conversions, sessions, and attribution. It's deliberately thin on **what your users were experiencing when they got there** — and that's the gap Signal fills. You install Signal alongside GA4 (they don't conflict); each does what it's good at.

| The question your operator is asking | **GA4 alone** | **GA4 + Signal** |
|---|---|---|
| Which network were users actually on? | `effective_type` — a browser hint that bins both fibre and a congested 4G tower as `4g` | TCP-handshake substrate tier (urban / moderate / constrained moderate / constrained) — measured per session, not guessed |
| Why was the page slow? | LCP / INP scores | LCP element + render-delay phase, INP interaction-phase breakdown, third-party scripts that loaded before paint |
| Per-session detail? | Free tier samples after 10M events / month | Every event, joined to your existing warehouse, no sampling |
| Long Animation Frame story? | Not captured | Chromium 123+ worst-frame duration + dominant cause (script / layout / style / paint) |
| Navigation Timing decomposition? | Not captured | Per-subpart DNS / TCP / TLS / request / response / SW timings, three TTFB definitions (raw, connection, activation-adjusted), Early-Hints provenance |
| Where does the raw data live? | Google's warehouse, GA4 schema | Your warehouse, your schema — joinable to spend, conversions, anything else you already have |

Signal is the substrate evidence layer underneath whatever you already use. GA4 keeps doing what it does; Signal answers the questions GA4 was never designed to.

## Install

```bash
pnpm add @stroma-labs/signal@next
```

ESM-only. Works in any modern browser. Zero runtime dependencies.

> 📋 **Before you install**, read [operator-expectations.md](./docs/operator-expectations.md) — capture model (SPA/MPA), GA4 quotas, BigQuery costs, browser support, privacy posture. One page. The honest "what am I signing up for" answer.

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

- **Network tier** — `urban`, `moderate`, `constrained_moderate`, `constrained` from the TCP-handshake span exposed by Navigation Timing (a useful diagnostic slice — not a complete network-speed cohort; see [Navigation Timing breakdown](./docs/signal-technical-reference.md#navigation-timing-breakdown) for the richer picture)
- **Device tier** — `low`, `mid`, `high` from real hardware signals
- **Web Vitals** — LCP, INP, CLS, FCP, TTFB with attribution (which element was slow, which interaction phase dominated, which third-party scripts loaded before paint)
- **Navigation Timing breakdown** — DNS / TCP / TLS / request / response / redirect / SW subparts, three named TTFB definitions (raw, connection, activation-adjusted-and-clamped), `next_hop_protocol`, transfer + body sizes, plus an Early-Hints-aware provenance sub-block. Warehouse-only.
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
- [Operator expectations](./docs/operator-expectations.md) — capture model, quotas, costs, privacy. **Read first.**
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
