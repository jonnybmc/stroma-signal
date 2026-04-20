# First Successful Report

The shortest linear path from install to a shareable hosted report URL. Follow it top-to-bottom once; revisit individual links only if a step fails.

If you already know which role you are and prefer the role-specific walkthrough, use [marketer-quickstart.md](./marketer-quickstart.md) or [client-integrations.md](./client-integrations.md) instead.

## What you end up with

A `signal_report_url` of the form `https://signal.stroma.design/r?...` that you can share internally as a point-in-time proof of the audience and experience-gap shape.

## 1. Install the package

```bash
pnpm add @stroma-labs/signal
```

The package is ESM-only and has no runtime dependencies. Published subpaths are listed in [public-api-v0.1.md](./public-api-v0.1.md).

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

Paste the URL into a browser. You should land on the hosted four-act artifact at `signal.stroma.design/r?...`:

1. Act 1 — who your users are (network and device shape)
2. Act 2 — how far apart their experiences are
3. Act 3 — where performance crosses poor thresholds
4. Act 4 — what this costs the business (KPI impact ledger) and the handoff to deeper work

If the URL renders as "Invalid report URL", the aggregate failed guard validation. Open the same URL at `/build` instead (change `/r?` to `/build?`) — the builder surfaces the specific guard issue.

## 7. Optional — schedule the refresh

The saved URL-builder query does not refresh on its own. To keep a single always-current `signal_report_url`, convert it to a BigQuery scheduled query using [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md) and the canonical operating model in [production-report-automation.md](./production-report-automation.md).

Canonical refresh cadence is daily, at a time after your analytics export has completed for the previous day.

If you are preparing the package for live release rather than just proving the pipeline once, finish with [release-deployment-checklist.md](./release-deployment-checklist.md).

## What this path does not include

- AI summaries, root-cause analysis, or remediation prescriptions. The Tier Report is the measured proof layer, not a diagnostic artifact.
- Campaign, channel, or business-context enrichment. That lives above Signal.
- Soft-navigation / SPA route-change events. Signal emits one event per real page load in v0.1.

See [public-api-v0.1.md](./public-api-v0.1.md) for the full v0.1 scope boundary.
