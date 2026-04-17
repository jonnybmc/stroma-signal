# Release Deployment Checklist

Use this as the final release and launch gate for `@stroma-labs/signal` v0.1. It combines the npm-package checks, first-publish preflight, and live pipeline validation in one place.

## 1. One-Time Publish Preflight

Before the first public publish:

- confirm the `@stroma-labs` npm scope exists
- confirm the publishing account has permission to publish `@stroma-labs/signal`
- confirm the GitHub repository has the required `NPM_TOKEN` secret configured
- confirm the publish workflow still keeps `id-token: write` plus `npm publish --provenance`
- confirm the release target is the canonical repo: `jonnybmc/stroma-signal`

## 2. Repo Gates

These must all pass before tagging a release:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm check:release
pnpm test:e2e:smoke
```

Package audit:

```bash
cd packages/signal
pnpm pack --dry-run
```

Expected package outcomes:

- no `.map` files in the tarball
- no runtime `dependencies`
- no leaked `@stroma-labs/signal-contracts` import in built output
- tarball surface limited to `dist/`, `package.json`, and the package README

## 3. Release-Cut Checks

Before publishing `v0.1.0`:

- `packages/signal/package.json` version is the intended release version
- `CHANGELOG.md` moves from `Unreleased` to the actual release date on the release commit
- the Git tag matches the package version exactly, e.g. `v0.1.0`
- the GitHub Release uses that same tag
- the publish workflow runs `pnpm ci`, installs Chromium, runs `pnpm test:e2e:smoke`, runs `pnpm check:release`, and only then publishes

## 4. Live Staging Validation

Validate both supported persistence paths before calling the release deployment-ready.

### GTM / GA4 path

- deploy Signal with `createDataLayerSink()`
- confirm `perf_tier_report` appears in GTM Preview
- confirm the expected event lands in GA4 DebugView
- run `docs/ga4-bigquery-validation.sql` and confirm rows land
- run `docs/ga4-bigquery-url-builder.sql` and open the returned hosted `/r?...` URL

### Endpoint / warehouse path

- deploy Signal with `createBeaconSink()` or the callback sink path
- confirm one canonical event lands at the collector and validates correctly
- confirm dedupe/idempotency is enforced on `event_id`
- run `docs/normalized-bigquery-validation.sql` and confirm rows land
- run `docs/normalized-bigquery-url-builder.sql` and open the returned hosted `/r?...` URL

## 5. Hosted Report Validation

For the generated hosted report URL:

- `/r` renders the expected artifact without crashing
- `/build` decodes the same URL and shows the expected summary semantics
- the freshness date is present for fresh links
- legacy links show the legacy freshness warning instead of a fake date
- malformed or contradictory URLs fail closed in both `/build` and `/r`

## 6. Visual and QA Review

Run the local Chromium visual suite when UI changes are intentional:

```bash
pnpm test:e2e:visual
```

If the diffs are intentional:

```bash
pnpm test:e2e:visual:update
```

Keep the checked-in Darwin and Linux Chromium snapshots aligned with the committed UI.

## 7. Operational Controls

Before broad rollout:

- collector validation, rate limiting, and CORS policy are configured intentionally
- warehouse retention is defined for `path`, `referrer`, `lcp_resource_url`, and attribution fields
- the current-report-URL table has an explicit owner
- read/write access to the current-report-URL table is intentionally scoped
- the scheduled query cadence is agreed and monitored
