# Contributing to Signal by Stroma

Thanks for your interest in contributing! This guide covers the basics.

## Getting Started

```bash
git clone https://github.com/jonathanbooysen/stroma-signal.git
cd stroma-signal
pnpm install
pnpm test:unit
pnpm build
```

Requires Node >= 22 and pnpm 10.28+.

## Development

Run the local apps in separate terminals:

```bash
pnpm dev:report   # Report shell at localhost:4174
pnpm dev:spike    # Spike lab at localhost:4173
```

## Testing

```bash
pnpm test:unit            # Unit tests (Vitest)
pnpm test:e2e             # Full Playwright suite across configured browsers
pnpm test:e2e:smoke       # Chromium functional smoke lane used in merge CI
pnpm test:e2e:visual      # Local Chromium visual regression checks
pnpm test:e2e:visual:update # Refresh local platform-specific visual baselines
pnpm typecheck            # Full workspace type check
```

## Before Submitting a PR

1. `pnpm ci` must pass (typecheck + test + build + release checks)
2. Bundle size budgets must not be exceeded
3. Import boundaries must be respected (core cannot import optional subpaths)
4. All export entry points must resolve correctly
5. Husky pre-commit runs `lint-staged` plus `pnpm test:unit`, so expect the full unit suite locally before each commit
6. Merge CI currently runs the Chromium-only `pnpm test:e2e:smoke` lane for functional regressions only; use `pnpm test:e2e` when you want the full browser matrix locally
7. Visual baselines are intentionally local-only and platform-specific; keep both Darwin and Linux Chromium snapshots checked in when refreshing `pnpm test:e2e:visual:update`

## Public Launch Docs

These docs are a coordinated public onboarding surface and should stay aligned when launch guidance changes:

- `packages/signal/README.md`
- `README.md`
- `docs/why-signal.md`
- `docs/tier-report-design-spec.md`
- `docs/signal-technical-reference.md`
- `docs/aggregation-spec.md`
- `docs/marketer-quickstart.md`
- `docs/production-report-automation.md`
- `docs/bigquery-saved-query-setup.md`

In particular, keep the automation boundary consistent:

- Signal automates collection
- the repo provides canonical SQL templates
- recurring refresh is warehouse-configured by the user team
- local spike-lab and report-shell tooling remain companion repo assets, not required package setup

## Code Style

- TypeScript strict mode is enforced
- ESM-only (`"type": "module"`)
- No runtime dependencies in the published package

## Commit Messages

Use clear, imperative-mood messages describing what the change does:

```
add network tier fallback for missing Navigation Timing
fix beacon sink error when sendBeacon returns false
```

## Reporting Bugs

Open an issue at https://github.com/jonathanbooysen/stroma-signal/issues with:

- Steps to reproduce
- Expected vs actual behavior
- Browser and environment details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
