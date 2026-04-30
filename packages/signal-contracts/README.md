# @stroma-labs/signal-contracts

**Internal contract layer for the Signal monorepo.** This package owns the
canonical TypeScript types, URL codec, aggregation rules, validation guards,
fixtures, and SQL templates that the public SDK (`@stroma-labs/signal`) and
the hosted apps (`apps/signal-report`, `apps/signal-spike-lab`) all build on.

It is `private: true` and not published to npm. Workspace consumers import it
via the path alias `@stroma-labs/signal-contracts`.

## Why this lives here

Splitting the contract from the SDK gives:

1. **A single source of truth for the wire format.** `SignalEventV1`,
   `SignalAggregateV1`, and the report URL codec live in one place. Both the
   browser-side instrumentation and the warehouse-side report builder import
   the same types.
2. **Independent test coverage.** Guards, codecs, aggregation, exports, and
   SQL templates are each unit-tested without booting the SDK runtime or the
   report renderer.
3. **A clean boundary against the paid product.** This package is forbidden
   from importing `@stroma-labs/signal-pi` (enforced by
   `scripts/check-boundaries.mjs`). Paid PI types live in their own package
   that imports *from* this one, never the other way around.

## What ships

- `src/types.ts` — `SignalEventV1`, `SignalAggregateV1`, network/device tier
  unions, threshold constants.
- `src/guards.ts` — `explainSignalAggregateIssues` and the type guards used by
  the `/build` validator.
- `src/report-codec.ts` — `encodeSignalReportUrl` / `decodeSignalReportUrl`
  for the additive `rv=1` URL contract (soft 2 KB / hard 4 KB).
- `src/aggregation.ts` — `aggregateSignalEvents` (browser-side preview path).
- `src/export.ts` — JSON/CSV exports for warehouse-compatible workflows.
- `src/report-interaction.ts` — `SignalReportInteractionV1` telemetry contract
  for the hosted report's view-tracking ingest endpoint.
- `src/fixtures/` — canonical aggregate fixtures used by report tests and the
  `/build` zero-code playground.
- `src/sql-templates/` — BigQuery validation and URL-builder templates.

## Boundary rules

- ✅ May depend on standard library types only (no runtime npm deps).
- ✅ May be imported by `@stroma-labs/signal`, `apps/signal-report`,
  `apps/signal-spike-lab`, and `@stroma-labs/signal-pi`.
- ❌ MUST NOT import from `@stroma-labs/signal-pi` (paid product layer).
- ❌ MUST NOT import from any `apps/*` (apps depend on packages, never the
  reverse).

## Running tests

```bash
pnpm --filter @stroma-labs/signal-contracts test
```

160+ unit tests across guards, codecs, aggregation, exports, SQL templates,
and report-interaction. Run from the repo root or the package directory.
