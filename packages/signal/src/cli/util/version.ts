// Single source of truth for the CLI version. Read at build time from
// packages/signal/package.json via the @rollup/plugin-json dependency
// already wired in rollup.config.mjs's CLI target — substitutes to a
// string literal in dist/cli.mjs (no runtime fs read).
//
// Three call sites consume this constant:
//   1. cli/index.ts — `--version` output
//   2. cli/commands/init.ts — `cli_version` field on every telemetry event
//   3. cli/snippets/matrix.ts — vanilla CDN snippet pinning
//
// scripts/check-package-exports.mjs asserts that built `cli.mjs --version`
// matches `packages/signal/package.json` `.version` so CLI and package
// version can never disagree.

import pkg from '../../../package.json' with { type: 'json' };

export const CLI_VERSION: string = pkg.version;
