# Production Report Automation

<img src="./images/signal-stroma-logo.png" alt="Signal by Stroma logo" width="320" />

Use this when Signal is already landing rows in BigQuery and your team wants an always-updated hosted `signal_report_url` with as little manual work as possible.

This is an operating recommendation for v0.1. Signal gives you the event payloads and the canonical SQL templates. Your team configures the warehouse refresh once.

The hosted Tier Report is not a diagnostic, attribution, or commercial modelling artifact. It is the measured proof layer generated from the aggregate your warehouse produces.

## What Is Automatic Already

- Signal collects browser-side data automatically once deployed.
- GTM / GA4 or your own collector can land canonical rows in BigQuery.
- The repo provides validation queries and URL-builder queries for both the GA4 path and the normalized warehouse path.
- The final output is a hosted `signal_report_url`, not raw aggregate JSON.

What is not automatic in v0.1:

- creating a BigQuery scheduled query
- creating a table that stores the latest URL
- deciding how often the report refreshes
- deciding where the final URL is surfaced to your team

## What You Configure Once

Choose the matching query pair:

- GTM / GA4 path:
  - [ga4-bigquery-validation.sql](./ga4-bigquery-validation.sql)
  - [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql)
- Normalized warehouse path:
  - [normalized-bigquery-validation.sql](./normalized-bigquery-validation.sql)
  - [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql)

Then do this once:

1. Run the validation query and confirm rows are landing.
2. Save the URL-builder query.
3. Decide whether the URL should refresh manually or on a schedule.
4. Decide where the latest URL should live for the rest of the team.

If you are still in the GTM/GA4 onboarding stage, start with [marketer-quickstart.md](./marketer-quickstart.md).

## Recommended Production Setup

Recommended pattern for most teams:

1. Keep the validation query as a manual diagnostic query.
2. Save the URL-builder query as the canonical report-generation query.
3. Create a BigQuery scheduled query that runs on a predictable cadence.
4. Write the latest result into a tiny current-state table that the rest of the team can read.

Recommended cadence:

- daily refresh for the shareable internal report
- optional intraday refresh only if the team needs a same-day preview of launch movement

Canonical production window for the shipped `/r` artifact:

- last 7 complete calendar days
- exclude the current in-progress day
- keep `p=7` aligned with that exact warehouse slice

Why this is the default:

- the validation query stays available for debugging
- the URL-builder query stays the single source of truth
- the latest URL is easy to surface in dashboards, internal tools, or team workflows

## Recommended Persistence Table

Recommended table name:

- `signal_report_urls_current`

Recommended columns:

- `host`
- `window_start`
- `window_end`
- `sample_size`
- `signal_report_url`
- `updated_at`

What each field is for:

- `host`: the site or domain the report is for
- `window_start`: the beginning of the reporting window used to build the URL
- `window_end`: the end of the reporting window used to build the URL
- `sample_size`: the sample size behind the generated report
- `signal_report_url`: the hosted `/r?...` URL to share internally
- `updated_at`: when the current row was last refreshed

This table is intentionally small. It is not your raw event table and not your aggregate warehouse model. It is just the handoff layer for the latest shareable report URL.

For the canonical daily artifact, `window_start` and `window_end` should bracket the last 7 complete days, not a today-inclusive rolling slice.

## Daily Vs Intraday

Use daily when:

- the URL is the canonical report shared with stakeholders
- you want stable reporting windows
- your team does not need near-real-time launch monitoring

Use intraday when:

- the team wants a current-state preview during rollout
- you are validating early collection before the daily job is trusted
- you are comfortable treating the intraday URL as provisional

Recommended rule:

- daily is the canonical production artifact
- intraday is optional and operational
- the canonical daily artifact uses the last 7 complete days and excludes today

## Where The Final URL Lives

The final `signal_report_url` can be surfaced anywhere your team already works, for example:

- a BigQuery result table
- an internal dashboard or analyst workbook
- a Looker Studio data source
- a Slack handoff or email workflow
- a CMS or internal launch checklist field

The important part is consistency:

- one canonical current URL
- one agreed refresh cadence
- one owner for the scheduled query

## Alternatives And Escape Hatches

Lighter alternative for early-stage or low-volume teams:

- save the URL-builder query
- run it manually when needed
- copy the latest `signal_report_url` into the team workflow

This is acceptable for v0.1 if:

- the team is still proving the pipeline
- daily automation is not worth the setup yet
- one operator owns the rerun step

Use the manual path only if everyone understands that a saved query does not refresh by itself. Automatic refresh starts only when your team creates a scheduled query or another warehouse job around it.

If the refresh path fails later, use [launch-troubleshooting.md](./launch-troubleshooting.md) and [bigquery-saved-query-setup.md](./bigquery-saved-query-setup.md).
