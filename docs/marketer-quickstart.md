# Marketer Quickstart: GTM To Shareable Signal URL

<img src="./images/signal-stroma-logo.png" alt="Signal by Stroma logo" width="320" />

This is the fastest launch path for a GTM/GA4-led team.

If you are looking for the production operating model after rows land in BigQuery, pair this with [production-report-automation.md](./production-report-automation.md).

The hosted Tier Report is the shareable proof artifact at the end of this flow. It is not a diagnostic, attribution, or commercial modelling artifact.

## Outcome

By the end of this flow you should have:

- `perf_tier_report` appearing in GTM Preview
- `perf_tier_report` appearing in GA4 DebugView
- BigQuery rows landing
- a final hosted `signal_report_url` with a documented manual or scheduled refresh path
- a persistent-footer form-factor strip in the hosted report showing your mobile / tablet / desktop split (requires the `DLV - device_screen_w` variable from [gtm-recipe.md](./gtm-recipe.md))

## Who Does What

- engineering deploys Signal with the public dataLayer sink
- martech configures GTM and the GA4 event forwarding
- analytics or ops saves the query and decides whether it runs manually or on a schedule

## Plain-English Terms

- validation query: a diagnostic query that answers, "are rows landing at all?"
- URL-builder query: the query that returns the final hosted `signal_report_url`
- saved query: a query stored in BigQuery for reuse; it does not refresh anything by itself
- scheduled query: a BigQuery job that reruns a saved query on a cadence you choose
- `signal_report_url`: the hosted `/r?...` link that becomes the shareable internal artifact

## 1. Deploy Signal

Ask your implementation team to deploy the Signal runtime with the public dataLayer sink:

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

Signal does not need your GTM container ID and does not load GTM or GA4 for you.
The GTM/GA4 path intentionally sends a compact subset. If you need the full warehouse schema, use the endpoint or callback path instead.

For the canonical v0.1 package contract, see [public-api-v0.1.md](./public-api-v0.1.md).

## 2. Configure GTM

Use these two assets together:

- [gtm-recipe.md](./gtm-recipe.md)
- [gtm-workspace-template.json](./gtm-workspace-template.json)

The GTM setup must include:

- the `perf_tier_report` custom event trigger
- the required Data Layer variables
- the GA4 event tag
- the exact parameter mapping expected by the SQL templates

## 3. Verify GTM And GA4

In GTM Preview:

1. Load a page with Signal deployed.
2. Trigger a flush or leave the page naturally.
3. Confirm a `perf_tier_report` event appears.
4. Confirm the GA4 event tag fires.

In GA4 DebugView:

1. Open the linked GA4 property.
2. Confirm `perf_tier_report` appears.
3. Open the event and verify key params like `event_id`, `net_tier`, `device_tier`, `fcp_ms`, and `ttfb_ms`.

If anything fails here, use [launch-troubleshooting.md](./launch-troubleshooting.md).

## 4. Verify BigQuery Rows Land

Run the validation query in [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql).

This answers the simple question:

> Are `perf_tier_report` rows landing in BigQuery?

Do not move to the URL-builder query until this query returns rows.
This validation step shows raw exported rows, including `navigation_type = restore` and `navigation_type = prerender` when they occur.

Once this succeeds, switch to [production-report-automation.md](./production-report-automation.md) to choose the production refresh pattern and the place where the latest URL will live.

## 5. Save Or Schedule The Final URL Query

Once rows are landing, save the query in [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) using the setup guide in [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md).

That query excludes `navigation_type = restore` and `navigation_type = prerender` by default so the hosted report stays tied to normal load performance.

That query should return a single field:

- `signal_report_url`

Important:

- a saved query gives you a reusable query definition
- a scheduled query is what creates automatic refresh

## 6. Open And Share The URL

Open the generated `signal_report_url`.

That hosted `/r?...` URL is the launch artifact. It is the measured proof layer your team can share internally after enough real traffic has accumulated.

## 7. If SQL Is Blocked

Use [https://signal.stroma.design/build](https://signal.stroma.design/build) or the local `/build` route to:

- paste a `SignalAggregateV1` object and generate a URL
- or paste a final hosted report URL and validate the decoded summary

This is the QA and fallback path, not the primary warehouse automation path.
