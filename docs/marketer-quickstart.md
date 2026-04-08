# Marketer Quickstart: GTM To Shareable Signal URL

This is the fastest launch path for a GTM/GA4-led team.

## Outcome

By the end of this flow you should have:

- `perf_tier_report` appearing in GTM Preview
- `perf_tier_report` appearing in GA4 DebugView
- BigQuery rows landing
- a saved query returning a final hosted `signal_report_url`

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

## 5. Save The Final URL Query

Once rows are landing, save the query in [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) using the setup guide in [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md).

That query should return a single field:

- `signal_report_url`

## 6. Open And Share The URL

Open the generated `signal_report_url`.

That hosted `/r?...` URL is the launch artifact. It is the shareable internal sales/discovery asset.

## 7. If SQL Is Blocked

Use [http://signal.stroma.design/build](http://signal.stroma.design/build) or the local `/build` route to:

- paste a `SignalAggregateV1` object and generate a URL
- or paste a final hosted report URL and validate the decoded summary

This is the QA and fallback path, not the primary warehouse automation path.
