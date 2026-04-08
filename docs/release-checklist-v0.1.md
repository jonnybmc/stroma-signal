# Release Checklist: v0.1

Use this before publishing the first public release of `@stroma-labs/signal`.

## 1. Contract Freeze

- [ ] [`public-api-v0.1.md`](./public-api-v0.1.md) matches the shipped package exactly
- [ ] No docs or examples still describe `reportTo`, top-level `endpoint`, or top-level `onReport`
- [ ] The canonical event name is still `perf_tier_report`
- [ ] The diagnostic enrichment cut line is still limited to the v0.1 fields

## 2. Repo Verification

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm check:release
```

Pass criteria:

- [ ] TypeScript passes across the workspace
- [ ] Unit and integration tests pass
- [ ] Build, export checks, boundaries, and budgets pass
- [ ] Release metadata verification passes

## 3. GTM / GA4 Launch Pack

- [ ] [`marketer-quickstart.md`](./marketer-quickstart.md) is copy-paste safe
- [ ] [`gtm-recipe.md`](./gtm-recipe.md) matches the current dataLayer field set
- [ ] [`gtm-workspace-template.json`](./gtm-workspace-template.json) includes the trigger, variables, tag, and mappings expected by the SQL templates
- [ ] [`ga4-bigquery-validation.sql`](./ga4-bigquery-validation.sql) still answers “are rows landing?”
- [ ] [`ga4-bigquery-url-builder.sql`](./ga4-bigquery-url-builder.sql) still generates a hosted report URL
- [ ] The same artifacts have been tested end to end by someone other than the implementer

## 4. Screenshot Pack

- [ ] GTM Preview screenshot captured
- [ ] GA4 DebugView screenshot captured
- [ ] BigQuery validation query screenshot captured
- [ ] BigQuery saved-query output screenshot captured
- [ ] Screenshot filenames and notes follow [`screenshot-capture-checklist.md`](./screenshot-capture-checklist.md)

## 5. Production-Truth Gate

- [ ] `perf_tier_report` lands in GA4
- [ ] The exported row lands in BigQuery
- [ ] The GA4 saved query returns a hosted `/r?...` URL
- [ ] That warehouse-derived URL matches fixture semantics exactly
- [ ] The normalized non-GA4 path remains consistent with the same aggregate meaning

## 6. Package and Repo Release Artifacts

- [ ] `packages/signal/package.json` metadata is correct
- [ ] The built package exports, files, and `.d.ts` outputs are valid
- [ ] `LICENSE` is present and matches package metadata
- [ ] [`release-notes-v0.1.0.md`](./release-notes-v0.1.0.md) is ready to reuse for the GitHub release
- [ ] The first git tag is prepared as `v0.1.0`
- [ ] The first npm publish target is `@stroma-labs/signal@0.1.0`

## 7. Manual Publish and Release

These steps are intentionally manual until the first release process is proven.

- [ ] Publish `@stroma-labs/signal@0.1.0` to npm
- [ ] Create git tag `v0.1.0`
- [ ] Publish the first GitHub release using the prepared release notes
- [ ] Verify the npm package page, GitHub release page, and repo links all resolve correctly

## Done Rule

v0.1 is release-ready only when the package contract is frozen, the GTM/warehouse launch pack is verified, and one warehouse-derived report URL has been proven against fixture semantics.
