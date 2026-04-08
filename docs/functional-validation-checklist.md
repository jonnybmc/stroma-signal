# Signal Functional Validation Checklist

Use this checklist to close Gates 1-3 before any full report-design work.

## Gate 1: Local and Browser Truth

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Pass criteria:

- Chromium, Firefox, and WebKit pass the proof-of-life suite.
- One flush produces exactly one collector payload.
- The latest `dataLayer` event is `perf_tier_report`.
- Preview URLs include the contract fallback fields:
  - `ct`
  - `rm`
  - `rr`
  - `ruc`
  - `rcc` when a comparable metric exists
- Multi-page spike navigation preserves collector truth and does not drop URL params.

Manual Safari gate:

- Follow [safari-manual-checklist.md](./safari-manual-checklist.md).
- Treat any Chromium-only metric nullability drift as a blocker.

## Gate 2: GA4 and BigQuery Truth

Use the local spike lab for this gate. Set `VITE_SIGNAL_GA4_MEASUREMENT_ID` to your dev GA4 stream so the harness can boot a spike-lab-only live `gtag` transport while keeping the local collector and public `dataLayer` views available.

Literal pass criteria:

1. `perf_tier_report` lands in GA4 for the dev stream.
2. The same event lands in the linked BigQuery export.
3. [ga4-bigquery-url-builder.sql](./ga4-bigquery-url-builder.sql) runs without schema edits beyond project/table substitution.
4. The generated report URL renders and matches fixture semantics for:
   - `comparison_tier`
   - `race_metric`
   - `race_fallback_reason`
   - coverage values
   - unclassified and reuse shares

Blockers:

- event-name drift
- missing/null field drift
- URL params missing required fallback fields
- aggregate semantics differ from fixtures

Recommended sequence:

1. Start `pnpm dev:spike`.
2. Open the spike lab locally and flush one page load.
3. Confirm the spike-lab GA4 status reads as ready.
4. Verify `perf_tier_report` in GA4 Realtime or DebugView.
5. Wait for BigQuery export and run the GA4 SQL template.
6. Open the generated report URL and compare it to fixture semantics.

## Gate 3: Warehouse Parity and Transport Survival

Run the normalized path with [normalized-bigquery-url-builder.sql](./normalized-bigquery-url-builder.sql).

Pass criteria:

- The normalized query produces the same aggregate meaning as the GA4 query for equivalent data.
- Builder-generated URLs preserve query params end to end.
- Shared fixtures continue to pass contract, GA4, SQL-template, and report decode tests together.

## Exit Rule

Do not start the design-spec report implementation until one warehouse-derived URL matches fixture semantics exactly.
