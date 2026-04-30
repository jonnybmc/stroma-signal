# Contributing to Signal by Stroma

Thanks for your interest in contributing! This guide covers the basics.

## Public/private boundary

Stroma's paid Performance Intelligence layer (the `/pi` artifact) lives in a separate **private** repository at `stromalab/stroma-signal-pi` and is mounted in this repo as a git submodule at `internal/`. **You do not need access to the private submodule to develop the free tier.** Without the submodule mounted, the public workspace builds the SDK, contracts, /r, and /build cleanly. Free-tier code is forbidden from importing `@stroma-labs/signal-pi`; this is enforced by `scripts/check-boundaries.mjs` on every CI run.

Files matching `pi-*.ts`, `pi-*.html`, or `pi-*.md` must not be committed to the public tree under any path other than `internal/`. The boundary script hard-fails CI on violations.

## Getting Started

Without submodule access (free-tier development):

```bash
git clone https://github.com/jonnybmc/stroma-signal.git
cd stroma-signal
pnpm install --no-frozen-lockfile  # tolerates missing PI workspace deps
pnpm test:unit                     # runs free-tier tests only
pnpm build
```

With submodule access (Stroma maintainers + paid-product collaborators):

```bash
git clone https://github.com/jonnybmc/stroma-signal.git
cd stroma-signal
git submodule update --init --recursive
pnpm install                       # respects the federated lockfile
pnpm test:unit                     # runs all 506 tests across both tiers
pnpm dev:report                                        # /r + /build on 4174
pnpm --filter @stroma-labs/signal-report-pi-app dev    # /pi on 4175
```

Requires Node >= 22 and pnpm 10.28+.
The monorepo uses Node 22 for contributors and release automation, while the published `@stroma-labs/signal` package intentionally keeps consumer support at Node >= 18.

The lockfile (`pnpm-lock.yaml`) reflects the federated state because it was last updated with the submodule mounted. Free-tier contributors should pass `--no-frozen-lockfile` to `pnpm install` until we split the lockfile. Tracked as a known papercut.

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
- `docs/release-deployment-checklist.md`

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

Open an issue at https://github.com/jonnybmc/stroma-signal/issues with:

- Steps to reproduce
- Expected vs actual behavior
- Browser and environment details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
