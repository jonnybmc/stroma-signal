# BigQuery Saved Query Setup

The launch automation output is a final hosted `signal_report_url`, not raw aggregate JSON.

## GA4 Path

Use these two SQL files in order:

1. [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql)
2. [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql)

Save the second query in BigQuery as something like:

- `Signal - Final Report URL`

Recommended query description:

> Generates the final hosted Signal report URL from exported `perf_tier_report` rows.

## Normalized Warehouse Path

Use these two SQL files in order:

1. [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql)
2. [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql)

Save the second query as something like:

- `Signal - Final Report URL (Normalized Warehouse)`

## Minimal Setup Rules

- Replace only the project / dataset / table placeholders.
- Keep the event name frozen as `perf_tier_report` in the GA4 path.
- Do not rename canonical fields if you want the templates to keep working.

## Expected Output

The saved URL-builder query should return one column:

- `signal_report_url`

Open that URL directly. That hosted `/r?...` link is the launch artifact to share internally.
