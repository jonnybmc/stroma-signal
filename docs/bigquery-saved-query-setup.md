# BigQuery Saved Query Setup

The launch automation output is a final hosted `signal_report_url`, not raw aggregate JSON.

Use this doc as the BigQuery reference for naming, placeholder replacement, and expected output.

If you want the recommended production operating model, use [production-report-automation.md](./production-report-automation.md).

## Terms

- saved query: a query definition stored in BigQuery for reuse
- scheduled query: a BigQuery job that reruns a query on a cadence you choose
- `signal_report_url`: the single column the URL-builder query returns. Its value is one of three states depending on sample size — see "Expected Output" below.

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

- **Validation queries** — replace only the project / dataset placeholders. They do not filter by host.
- **URL-builder queries** — replace project / dataset placeholders **and** the `'your-domain.com'` host literal (in BOTH the WHERE clause and the COALESCE fallback in the `counts` CTE — one find-and-replace covers both).
- Keep the event name frozen as `perf_tier_report` in the GA4 path.
- Do not rename canonical fields if you want the templates to keep working.
- Use the validation query first if you want to inspect raw restore/prerender rows; the URL-builder query filters them out by default.
- Decide explicitly whether this is:
  - a reusable manual saved query
  - or a scheduled production refresh job

## Expected Output

The saved URL-builder query always returns exactly one row, one column (`signal_report_url`). The cell value is one of three states, depending on how much real-user traffic accumulated in the 7-day window:

1. **Production URL** — `https://signal.stroma.design/r?rv=1&mode=production&...`. Emitted only when `sample_size >= 100` (the documented `SIGNAL_PREVIEW_MINIMUM_SAMPLE`). Open it directly; this is the launch artifact to share internally.
2. **`SAMPLE_BELOW_RECOMMENDED_MINIMUM: captured N events ...`** — emitted when 1–99 events landed in the window. Below the 100-event threshold, percentile distributions are noisy and tier shares are unreliable, so the SQL withholds the URL and returns an actionable diagnostic instead. Wait for traffic to accumulate; re-run.
3. **`NO_EVENTS_IN_WINDOW: ...`** — emitted when zero events matched the host + window filters. The diagnostic names the three things to check: validation query result, host literal match, daily-export latency.

For the full operator-facing decision tree on each state, see [marketer-quickstart.md §7](./marketer-quickstart.md) and [launch-troubleshooting.md](./launch-troubleshooting.md). Downstream consumers (scheduled-query persistence, dashboards, Slack notifications) should branch on the literal cell prefix — anything starting with `https://signal.stroma.design/r?` is a shareable URL; anything else is an actionable diagnostic message that should be surfaced to the operator.
