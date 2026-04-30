# Signal

> 🧪 **Release Candidate** — currently published as `0.1.0-rc.2` on the `next` dist-tag.
> The `0.x` line is pre-stable; the API can change before `1.0`.
> See [CHANGELOG.md](https://github.com/jonnybmc/stroma-signal/blob/main/CHANGELOG.md) for what shipped and what closes the next version.

A small library that measures what your real users actually experience — their network speed, device capability, and how fast your pages feel — and delivers that data to your own analytics so you can answer questions like *"are mobile users in dense areas getting a fair experience?"* without guesswork.

## Install

```bash
pnpm add @stroma-labs/signal@next
```

`pnpm`, `npm`, and `yarn` all work. Signal is ESM-only.

## What ships

Four entry points — pick what you need:

| Import path                          | What it gives you                                        |
| ------------------------------------ | -------------------------------------------------------- |
| `@stroma-labs/signal`                | The runtime + sinks. **Always start here.**              |
| `@stroma-labs/signal/ga4`            | One-line GA4 / GTM integration via `dataLayer`.          |
| `@stroma-labs/signal/report`         | A preview helper for local QA without a warehouse.       |
| `@stroma-labs/signal/summary`        | Plain-text, JSON, and CSV exports for ad-hoc analysis.   |

The base runtime is under 4 KB gzipped. The helpers are optional and add roughly 0.5 KB and 1 KB respectively.

## Three ways to wire it up

Choose the path that matches your existing setup. Mix and match if you want — they're not mutually exclusive.

### 1. Already on GTM and GA4

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

A `perf_tier_report` event lands in `window.dataLayer` after each page load. Configure it as a custom event in GTM, send it to GA4, and you're done.

### 2. Have your own collector or backend

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/rum/signal' })]
});
```

Signal POSTs one event per page load to your endpoint. Use this if you want full control over storage and querying.

### 3. Want app-level control

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';

init({
  sinks: [
    createCallbackSink({
      onReport(event) {
        // do whatever you want with the event
        myAnalytics.track('page_perf', event);
      }
    })
  ]
});
```

## What you get back

One event per page load with everything we measured:

- **Network tier** — `urban`, `moderate`, `constrained_moderate`, or `constrained` based on the actual TCP handshake time, not a coarse browser label
- **Device tier** — `low`, `mid`, or `high` from real hardware signals (CPU cores, memory, screen)
- **Web Vitals** — LCP, INP, CLS, FCP, TTFB, plus rich attribution (which element was slow, which interaction phase dominated, which third-party scripts loaded before paint)
- **Long Animation Frame** story on Chromium 123+ — worst frame and dominant cause (script, layout, style, paint)
- **Background-tab filter** — events captured while the tab was hidden are tagged so they don't poison your percentiles

Zero runtime dependencies. No PII collected. No cookies set. The runtime is opinionated about what *not* to capture — see [why-signal.md](https://github.com/jonnybmc/stroma-signal/blob/main/docs/why-signal.md) for the deliberate exclusions.

## Going beyond the SDK

The SDK is just the collection layer. The full story:

1. **Install Signal** — events flow on the next page load
2. **Land them somewhere** — GA4 + BigQuery, your own warehouse, or a callback that hands them to your existing pipeline
3. **Run a URL-builder query** — Signal ships [BigQuery SQL templates](https://github.com/jonnybmc/stroma-signal/blob/main/docs/ga4-bigquery-url-builder.sql) that turn warehouse rows into a hosted report URL
4. **Share the URL** — recipients see your real-user performance gap at `signal.stroma.design/r/...`, no login required

The hosted report stops at proof. It shows who's affected, how big the gap is, and where performance becomes poor — not why or how to fix it. That keeps the artifact honest and the file size small.

## Docs

- **[Why Signal exists](https://github.com/jonnybmc/stroma-signal/blob/main/docs/why-signal.md)** — what gap it fills and what it deliberately doesn't do
- **[Marketer quickstart](https://github.com/jonnybmc/stroma-signal/blob/main/docs/marketer-quickstart.md)** — non-technical walkthrough, GTM-first
- **[Setup guide for engineers](https://github.com/jonnybmc/stroma-signal/blob/main/docs/client-integrations.md)** — the three paths above with more detail
- **[Production report automation](https://github.com/jonnybmc/stroma-signal/blob/main/docs/production-report-automation.md)** — keeping the hosted URL fresh from BigQuery
- **[Public API reference](https://github.com/jonnybmc/stroma-signal/blob/main/docs/public-api-v0.1.md)** — every export and field
- **[Technical reference](https://github.com/jonnybmc/stroma-signal/blob/main/docs/signal-technical-reference.md)** — schemas, thresholds, browser support matrix

## Verification

This package is published with [npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements). Verify after install:

```bash
npm audit signatures
# → "1 package has a verified attestation"
```

That confirms the tarball you installed was built by [this repository's publish workflow](https://github.com/jonnybmc/stroma-signal/actions/workflows/publish.yml) on the exact commit referenced in the release notes.

## License

MIT — see [LICENSE](https://github.com/jonnybmc/stroma-signal/blob/main/LICENSE).
