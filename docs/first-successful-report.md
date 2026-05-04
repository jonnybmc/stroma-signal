# First Successful Report

The shortest linear path from install to a shareable hosted report URL. Follow it top-to-bottom once; revisit individual links only if a step fails.

If you already know which role you are and prefer the role-specific walkthrough, use [marketer-quickstart.md](./marketer-quickstart.md) or [client-integrations.md](./client-integrations.md) instead.

## What you end up with

A `signal_report_url` of the form `https://signal.stroma.design/r?...` that you can share internally as a point-in-time proof of the audience and experience-gap shape.

## 1. Install the package

One command — the wizard detects your framework, asks the configuration questions, auto-installs `@stroma-labs/signal` via your project's package manager, then prints the framework-correct snippet for you to paste (covers Next, React Router 7, Remix v2, Nuxt, SvelteKit, Vue, Vite, Angular, vanilla):

```bash
npx @stroma-labs/signal init
```

The package is ESM-only and has no runtime dependencies. Published subpaths are listed in [public-api-v0.1.md](./public-api-v0.1.md). For CI / inspection contexts where you want to skip auto-install, pass `--no-install` and the wizard prints the install command at the top of its output instead.

## 2. Choose one sink and initialise client-side

Three mutually-exclusive paths. Pick the one that matches where you want rows to land.

**GTM / GA4 path** — if you already have a GTM container and a GA4 property.

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({ sinks: [createDataLayerSink()] });
```

**Own-endpoint path** — if you already have a collector.

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({ sinks: [createBeaconSink({ endpoint: '/rum/signal' })] });
```

**Full-control path** — if an internal wrapper should decide what happens to each event.

```ts
import { init, createCallbackSink } from '@stroma-labs/signal';

init({
  sinks: [createCallbackSink({ onReport(event) { /* your code */ } })]
});
```

Signal must run in the browser, not during SSR. Framework-specific client-only init patterns are in [spa-ssr-caveats.md](./spa-ssr-caveats.md) and [framework-recipes.md](./framework-recipes.md).

## 3. Verify one real event

The check depends on your sink.

- GTM / GA4: `perf_tier_report` appears in GTM Preview, then in GA4 DebugView. Wiring reference: [gtm-recipe.md](./gtm-recipe.md) + [gtm-workspace-template.json](./gtm-workspace-template.json).
- Own endpoint: one request lands at your collector containing `event_id`. Contract: [collector-contract.md](./collector-contract.md).
- Full control: your callback fires once with the canonical event object. Reference shape: [warehouse-schema.md](./warehouse-schema.md).

If the event does not appear, stop here and work through [launch-troubleshooting.md](./launch-troubleshooting.md) before continuing.

## 4. Run the validation SQL

Confirms rows are actually landing in BigQuery before you try to build a report URL.

- GTM / GA4 path: [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql).
- Own-endpoint / full-control path: [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql).

Both queries expect you to fill in project / dataset / table / host. You can do this manually, or use `scripts/bootstrap-sql.mjs` to prompt for the four values and write ready-to-paste copies.

The validation query intentionally includes `navigation_type = restore` and `navigation_type = prerender` rows so you can see the full raw picture. The URL-builder excludes them.

## 5. Run the URL-builder SQL

Returns the final `signal_report_url` as a single column.

- GTM / GA4 path: [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql).
- Own-endpoint / full-control path: [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql).

Both production queries use the canonical window: last 7 complete days, excluding today. They exclude `restore` and `prerender` from paint and network percentile calculations so the shared report stays tied to normal load performance.

## 6. Open the report URL

Paste the URL into a browser. You should land on the hosted five-section narrative at `signal.stroma.design/r?...`:

1. Cover (Act 00) — the masthead, sample size, classified share, and the headline number
2. Audience (Act 01) — who your users are (network and device shape)
3. Distance (Act 02) — how far apart their experiences are
4. Funnel (Act 03) — where performance crosses poor thresholds
5. Business (Act 04) — where the evidence lands against the KPIs you're accountable for, then a demand-sampling modal for what would help next

If the URL renders as "Invalid report URL", the aggregate failed guard validation. Open the same URL at `/build` instead (change `/r?` to `/build?`) — the builder surfaces the specific guard issue.

## 7. Optional — schedule the refresh

The saved URL-builder query does not refresh on its own. To keep a single always-current `signal_report_url`, convert it to a BigQuery scheduled query using [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md) and the canonical operating model in [production-report-automation.md](./production-report-automation.md).

Canonical refresh cadence is daily, at a time after your analytics export has completed for the previous day.

If you are preparing the package for live release rather than just proving the pipeline once, finish with [release-deployment-checklist.md](./release-deployment-checklist.md).

## 8. First-week reality check

Once events have flowed for 5–7 days, walk this list. The point is to feel confident the data is healthy *before* you share the URL with stakeholders.

> **Sample-confidence band.** Every generated `signal_report_url` carries a `b=<band>` URL parameter — `preliminary` (sample < 100), `provisional` (100–499), or `stable` (≥ 500). The hosted `/r` cover renders a brand-olive note above the masthead when the band is **preliminary** or **provisional**, so a thin report can't masquerade as a stable read when shared externally. The thresholds live in `packages/signal-contracts/src/types.ts` (`SIGNAL_SAMPLE_BAND_PROVISIONAL_THRESHOLD` / `SIGNAL_SAMPLE_BAND_STABLE_THRESHOLD`) and the SQL URL-builders compute them inline. There is no gate stopping you from running the URL-builder query whenever you want — the band is purely an honesty signal.

| What to check | What "healthy" looks like | What to investigate if you see it |
|---|---|---|
| **Event volume** | Roughly **20–80% of your GA4 sessions count** for the same window. The exact ratio depends on your hard-nav vs soft-nav mix (see §1 of [operator-expectations.md](./operator-expectations.md)) | Below 10% → check the SDK is loaded on every entry route, not just the homepage |
| **Coverage (`classified_share`)** | **Typically > 50%**, often 70–90%. Reflects how many sessions had a measurable TCP-handshake span | Below 30% → likely heavy reused-connection traffic (HTTP/2 multiplexing, CDN preconnect) — informational, not a bug; or a Service-Worker-heavy app where `nav_timing_full` isn't isolatable. The `vitals.navigation_timing` block still populates regardless |
| **Network tier shape** | Most sites see 40–70% in `urban` + `moderate`, smaller tails in `constrained_moderate` + `constrained`. The exact split reflects your real audience | All-`urban` → check the cohort isn't your office IP range or your own CDN warmup traffic. All-`constrained` → check your test environment isn't proxying through a slow path |
| **Device tier shape** | Skewed by site type — B2B SaaS sees mostly `mid`/`high`; consumer / mobile-first sees more `low` | All one tier → small sample, give it more days. Across the spread → healthy |
| **Browser mix** | Should roughly match the browser breakdown in your GA4 reports (within a few percent) | Wildly different → SDK might be sample-rate-gated unevenly. Check `init({ sampleRate })` is what you intended |
| **TTFB shape (`vitals.ttfb_ms` p75)** | Server-rendered + CDN: **< 500 ms**. SPA on global CDN: **< 200 ms**. SSR with cold backend: 500 ms – 1.5 s | p75 > 2 s sustained → backend / origin investigation, not a Signal bug |
| **LCP shape (`vitals.lcp_ms` p75)** | Optimised site: **< 2.5 s**. Typical broad audience: **< 4 s**. Heavy media + global audience: 4 s – 6 s | p75 > 6 s sustained → real LCP problem worth a render-budget pass on the landing template; the Business section's closing modal lets you signal demand for a prioritised fix list |
| **`vitals.navigation_timing.next_hop_protocol` distribution** | Should be ~100% `h2` or `h3` if you're behind a modern CDN (Cloudflare, Fastly, CloudFront) | Material `http/1.1` → check your CDN config; HTTP/1.1 head-of-line blocking is real and measurable |
| **`vitals.lcp_attribution.culprit_kind` (Chromium audiences only)** | Mix of `headline_text`, `hero_image`, `lcp_image` is normal | Dominated by `unknown` → your LCP element is in a Shadow DOM / cross-origin iframe / something the SDK can't reach |

### When to worry

- **Event count = 0 after 24 hours of confirmed install**: SDK isn't sampled out, you've checked the sink fires (DataLayer / beacon / callback), but no rows. Likely a transport problem — see [launch-troubleshooting.md](./launch-troubleshooting.md)
- **All sessions land in one tier**: very small N, or a routing / proxy issue masking the real network conditions
- **`classified_share` drops below 10%**: something is filtering Navigation Timing — most often a Service Worker swallowing the navigation
- **Event count drops 30%+ week over week**: SDK or transport regression after a deploy; correlate with your deployment timeline

### When everything is healthy

- Open the hosted `/r` URL with one of your operators, walk it together, decide which signal you'd want to act on first
- Bookmark the URL or pin it in your team's dashboard
- Schedule the refresh ([production-report-automation.md](./production-report-automation.md)) so the shared URL stays current
- If the report shows a measurable bleed worth fixing, use the closing modal on the Business section to signal what would help most — Stroma uses those demand signals to prioritise what to build next

## What this path does not include

- AI summaries, root-cause analysis, or remediation prescriptions. The Tier Report is the measured proof layer, not a diagnostic artifact.
- Campaign, channel, or business-context enrichment. That lives above Signal.
- Soft-navigation / SPA route-change events. Signal emits one event per real page load in v0.1.

See [public-api-v0.1.md](./public-api-v0.1.md) for the full v0.1 scope boundary.
