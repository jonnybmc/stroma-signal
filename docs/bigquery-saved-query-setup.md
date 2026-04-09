# BigQuery Saved Query Setup

The launch automation output is a final hosted `signal_report_url`, not raw aggregate JSON.

Use this doc as the BigQuery reference for naming, placeholder replacement, and expected output.

If you want the recommended production operating model, use [production-report-automation.md](./production-report-automation.md).

## Terms

- saved query: a query definition stored in BigQuery for reuse
- scheduled query: a BigQuery job that reruns a query on a cadence you choose
- `signal_report_url`: the hosted `/r?...` URL returned by the URL-builder query

A saved query alone does not create automatic refresh.

## GA4 Path

Use these two SQL files in order:

1. [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql)
2. [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql)

Save the second query in BigQuery as something like:

- `Signal - Final Report URL`

Recommended query description:

> Generates the final hosted Signal report URL from exported `perf_tier_report` rows, excluding non-load-shaped restore/prerender lifecycle rows by default.

If you want automatic refresh, create a scheduled query around this saved query or the same SQL text.

## Normalized Warehouse Path

Use these two SQL files in order:

1. [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql)
2. [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql)

Save the second query as something like:

- `Signal - Final Report URL (Normalized Warehouse)`

If you want automatic refresh here as well, create a scheduled query around the saved URL-builder query.

## Minimal Setup Rules

- Replace only the project / dataset / table placeholders.
- Keep the event name frozen as `perf_tier_report` in the GA4 path.
- Do not rename canonical fields if you want the templates to keep working.
- Use the validation query first if you want to inspect raw restore/prerender rows; the URL-builder query filters them out by default.
- Decide explicitly whether this is:
  - a reusable manual saved query
  - or a scheduled production refresh job

## Expected Output

The saved URL-builder query should return one column:

- `signal_report_url`

Open that URL directly. That hosted `/r?...` link is the launch artifact to share internally.
