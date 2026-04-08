# Contributing to Signal by Stroma

Thanks for your interest in contributing! This guide covers the basics.

## Getting Started

```bash
git clone https://github.com/jonathanbooysen/stroma-signal.git
cd stroma-signal
pnpm install
pnpm test
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
pnpm test          # Unit tests (Vitest)
pnpm test:e2e      # E2E tests (Playwright, requires build first)
pnpm typecheck     # Full workspace type check
```

## Before Submitting a PR

1. `pnpm ci` must pass (typecheck + test + build + release checks)
2. Bundle size budgets must not be exceeded
3. Import boundaries must be respected (core cannot import optional subpaths)
4. All export entry points must resolve correctly

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
