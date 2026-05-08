# Release Gate — `signal init` wizard

Pre-publish checklist for any release that touches the `signal init` CLI.
Runs once per `-rc.N` cut + once before the `0.x.0` GA. Blocks `npm publish`.

## Automated gates (CI-runnable)

Each must pass before the release tag is cut.

```bash
pnpm test:unit            # full unit suite (incl. snippet-compile + network-isolation)
pnpm build                # SDK + CLI bundles, all check:* invariants
pnpm test:cli:pack        # pack-and-test against npm + pnpm + yarn + bun
```

The `test:cli:pack` script (`scripts/pack-and-test-cli.mjs`) builds the
SDK, runs `pnpm pack`, and for each available package manager:

1. Installs the packed `.tgz` into a fresh tmp project.
2. Verifies `@stroma-labs/signal-contracts` did NOT leak into `node_modules`
   (proves the workspace-private bundle-inline guard).
3. Verifies `dist/cli.mjs` retained its `#!/usr/bin/env node` shebang.
4. Runs the wizard with `--framework vanilla --sink dataLayer
   --no-telemetry --yes --json --skip-install-check` and asserts exit 0
   + valid JSON output.

Package managers that aren't installed locally are skipped (the script
soft-fails). On CI every PM should be available.

## Manual gate — fresh-project smoke matrix (per-framework, launch-fix item A)

Parser-level snippet validation cannot catch framework API drift (e.g.
SvelteKit 5 runes shifting against the matrix entry, Remix v2 entry
conventions changing). This per-framework matrix MUST be ticked before
any tagged release. Each row is a fresh-project install, wizard run,
boot, and event-fires-in-the-target-sink check.

- [ ] **Next.js App Router** — `npx create-next-app@latest` (App Router) → `signal init` → `pnpm dev` boots → page loads with snippet → `dataLayer.find(e => e.event === 'perf_tier_report')` returns event.
- [ ] **React Router v7 (framework mode)** — fresh `react-router` v7 framework-mode app → `signal init` → boot → emit.
- [ ] **Remix v2** — fresh Remix v2 app → `signal init` → boot → emit.
- [ ] **SvelteKit (Svelte 5 runes)** — fresh SvelteKit app on Svelte 5 → `signal init` → boot → emit. **Most-likely-to-drift** (runes API stable but tooling shifts); always run a fresh install, never assume the prior dry-run still applies.
- [ ] **Vanilla** — plain HTML page with `<script type="module">` from the wizard's snippet → load → emit.

Failure on any row blocks the release. Open an issue, fix the matrix
entry + recipe, re-run the matching row from a fresh project.

## Manual gate — live fresh-user dry run (P2-14)

Required for any RC bump that ships a wizard change. Catches end-to-end
regressions no automated test will hit.

1. **Fresh environment**: a clean container (Docker / GH Codespaces) or
   a machine with no Stroma-related state, no XDG config under
   `~/.config/stroma/`, no installed Stroma packages.
2. **Create a fresh Next.js project**:
   ```bash
   pnpm create next-app@latest dry-run-app --yes
   cd dry-run-app
   ```
3. **Run the wizard against the published RC**:
   ```bash
   npx @stroma-labs/signal@<RC_VERSION> init
   ```
4. **Verify Step 0 install panel appears** — since `@stroma-labs/signal`
   isn't yet a dep of the new app, the wizard should surface a Step 0
   panel with `pnpm add @stroma-labs/signal` (or the right pkg-mgr
   command).
5. **Follow Step 0**:
   ```bash
   pnpm add @stroma-labs/signal
   ```
6. **Re-run the wizard** — it should detect Next App Router with HIGH
   confidence and skip the Step 0 panel this time.
7. **Generate snippets, paste them in** — copy `app/SignalClient.tsx`
   and the modify-instruction for `app/layout.tsx`.
8. **Build the app**:
   ```bash
   pnpm build
   ```
   Assert `pnpm build` succeeds with zero TypeScript errors.
9. **Run the dev server + verify the dataLayer event fires**:
   ```bash
   pnpm dev
   # In a browser: navigate to localhost:3000, then to another route,
   # then close the tab.
   # Open browser DevTools → Console:
   ```
   ```js
   window.dataLayer.find(e => e.event === 'perf_tier_report')
   ```
   Should return a `perf_tier_report` event with the Signal payload.

## What to do when the gate fails

- **`test:unit` regression**: fix the test, do not skip. The unit suite
  is the foundation; broken tests = broken contract.
- **`test:cli:pack` failure under one pm**: usually a real bug in the
  packed artifact. Common causes: missing `dist/cli.mjs` from `files`,
  shebang stripped by terser, signal-contracts leak (Rollup external
  config drift). Fix at the source — never patch the gate to look the
  other way.
- **Manual dry-run failure**: open an issue, root-cause, fix, re-run
  the entire dry-run from step 1 (NOT just the failing step). End-to-end
  tests are end-to-end for a reason.

## After publish

- Run the live dry-run AGAIN against the freshly-published `@latest` to
  confirm the published artifact behaves identically to the pre-publish
  `pnpm pack` artifact. (Pre-1.0 the rc IS the `@latest` tag — see the
  publish workflow's `Resolve npm dist-tag` step.)
- If anything diverges, immediately deprecate the just-published version
  via `npm deprecate @stroma-labs/signal@<version> "Withdrawn — see <issue>"`.

## Future work

- **OS matrix CI** (P2-11): currently `test:cli:pack` runs on the
  developer's local OS only. Future GitHub Actions workflow should add
  `os: [ubuntu-latest, macos-latest, windows-latest]` × `node: [18, 20,
  22]` for a 9-cell matrix. Deferred to keep the publish workflow
  stable post-OIDC fix; will land in a separate PR.
- **Update-checking in the wizard**: `signal init` could check for a
  newer `@stroma-labs/signal` version via the registry and surface
  "0.2.0 is available, run `pnpm update`" as a passive note. Adds a
  network call at first interactive run; defer until install-volume
  justifies it.
