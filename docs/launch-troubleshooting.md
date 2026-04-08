# Launch Troubleshooting

Use this when the GTM-first launch path stalls between deploy, GTM, GA4, BigQuery, and the final hosted report URL.

## No `perf_tier_report` In GTM Preview

Check:

- Signal is deployed with `createDataLayerSink()`
- the page actually flushes once
- the latest `window.dataLayer` entry includes `event: 'perf_tier_report'`

If the event is missing from `dataLayer`, the issue is before GTM. Verify the runtime deployment first.

## GTM Sees The Event But The GA4 Tag Does Not Fire

Check:

- the trigger event name is exactly `perf_tier_report`
- the trigger is attached to the correct GA4 Event tag
- the tag is not limited by extra conditions
- the Data Layer variables exist and resolve correctly in GTM Preview

Use [gtm-workspace-template.json](./gtm-workspace-template.json) as the source of truth for names and mappings.

## `perf_tier_report` Missing In GA4 DebugView

Check:

- the GA4 Event tag fires in GTM Preview
- the GA4 property is the expected one
- browser privacy tooling is not blocking GA4 transport
- enough time has passed for DebugView to refresh

If the browser shows a `google-analytics.com/...collect...` request with `en=perf_tier_report`, the transport path is working and the issue is likely property/config visibility rather than Signal.

## BigQuery Rows Are Not Landing

Run [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql).

Check:

- the GA4 property is linked to BigQuery
- the dataset/project reference in the SQL is correct
- enough time has passed for export latency
- the event name remains exactly `perf_tier_report`

Do not debug the full URL-builder query until this validation query returns rows.

## The URL-Builder Query Returns No Result

Check:

- the validation query returns rows
- the time window in the URL-builder query includes the exported events
- the project, dataset, and property placeholders were replaced correctly
- the event parameters still match the canonical field names

If rows are landing but the URL-builder query returns nothing, compare the landed params against [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql).

## The Hosted Report URL Renders But Looks Wrong

Use `/build` to validate the URL directly.

Check:

- `comparison_tier`
- `race_metric`
- `race_fallback_reason`
- network coverage
- selected metric coverage
- high unclassified share

The decoded summary in `/build` should match the intended aggregate semantics before the report is shared.

## Non-GA4 Clients

If the client is using `beacon` or `callback`, switch to:

- [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql)
- [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql)

The launch sequence is the same:

- verify runtime emit
- verify rows land
- run URL-builder query
- open hosted report
