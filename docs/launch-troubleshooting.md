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

## A Specific Param Is Missing In GA4

Check:

- the param is part of Signal's compact GA4 subset and not a warehouse-only field
- the GTM Event tag maps that Data Layer Variable into the GA4 tag
- the GA4 property is not exceeding its standard event parameter cap through extra custom mappings
- you are not expecting a BigQuery-only field to appear in GA4 DebugView or GA4 UI reports

Use [gtm-recipe.md](./gtm-recipe.md) and [public-api-v0.1.md](./public-api-v0.1.md) as the source of truth for the supported compact subset.

## BigQuery Rows Are Not Landing

Run [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql).

Check:

- the GA4 property is linked to BigQuery
- the dataset/project reference in the SQL is correct
- enough time has passed for export latency
- the event name remains exactly `perf_tier_report`
- `navigation_type` values look plausible in the validation output

Do not debug the full URL-builder query until this validation query returns rows.

## The URL-Builder Query Returns No Result

Check:

- the validation query returns rows
- the time window in the URL-builder query includes the exported events
- the project, dataset, and property placeholders were replaced correctly
- the event parameters still match the canonical field names
- the available rows are not only `navigation_type = restore` or `navigation_type = prerender`

If rows are landing but the URL-builder query returns nothing, compare the landed params against [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql).

## The Report URL Is No Longer Refreshing

Check:

- the scheduled query is still enabled and succeeding
- the scheduled query is using the intended time window
- source rows are still landing in the underlying BigQuery table
- the derived current-URL table is still being updated
- the latest `signal_report_url` row has a recent `updated_at` value

If the URL only refreshes when someone reruns the query manually, you likely still have a saved query but not a scheduled query. Use [production-report-automation.md](./production-report-automation.md) and [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md) to restore the intended production path.

## Paint Metrics Look Wrong Even Though Transport Works

If GTM, GA4, and BigQuery all look healthy but `fcp_ms` or `lcp_ms` still look suspicious:

- enable `debug: true` locally
- compare the raw FCP and LCP observer output
- compare the flush reason (`manual`, `visibilitychange`, or `pagehide`)
- compare the final payload before it reaches the sink

The local spike lab enables this debug logging by default. For the full list of vitals fields and their browser support boundaries, see the [Signal Technical Reference](./signal-technical-reference.md).

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
