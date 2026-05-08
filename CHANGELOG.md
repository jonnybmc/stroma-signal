# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

While the SDK is pre-1.0 every release — including `-rc.N` pre-releases — publishes to the npm `latest` dist-tag, so `npm install @stroma-labs/signal` (no version specifier) resolves to the current rc. The `next`-vs-`latest` split returns once `1.0.0` ships.

```
pnpm add @stroma-labs/signal                 # current pre-1.0 rc (latest)
pnpm add @stroma-labs/signal@0.1.0-rc.4      # exact rc.4 pin
```

Bump the exact pin example whenever a new `-rc.N` is cut so onboarders default to the freshest pinned snapshot.

## [Unreleased]

### Fixed — URL-builder queries parse against BigQuery (rc.2-rc.4 latent regression)

`docs/ga4-bigquery-url-builder.sql` and `docs/normalized-bigquery-url-builder.sql` no longer fail with `Aggregate function ARRAY_AGG not allowed in UNNEST` when run against real BigQuery. The broken `top_path` correlated subquery is replaced with an exact scalar subquery using deterministic alphabetical tie-breaking; same nullability contract; same emitted `&v=<path>` URL segment.

### Fixed — URL-builder no longer returns NULL signal_report_url on empty data

`COALESCE(ANY_VALUE(host), 'your-domain.com')` in the `counts` CTE prevents BigQuery's strict-NULL `CONCAT()` from poisoning the entire URL when `source_events` has zero rows (RC day-one operators with no captured events; operators who pasted a host that doesn't match real traffic). The URL still renders with `&s=0&b=preliminary&...`, which the `/r` cover handles via the existing sample-band banner.

### Added — Regex tests + RELEASE-GATE manual dry-run for SQL templates

Three new regex tests in `packages/signal-contracts/test/sql-templates.test.ts` lock in the parse-clean shape: forbid `UNNEST(ARRAY_AGG(...))`, require the exact `top_path` shape, and require the `COALESCE(ANY_VALUE(host), ...)` empty-data fallback. `packages/signal/RELEASE-GATE.md` adds a manual `bq query --dry_run` pre-publish gate covering all four customer-facing SQL templates so future RC cuts cannot ship a parse-broken query the way rc.2-rc.4 did.

### Changed — Doc clarifications across the BigQuery launch path

- **Two-`host` model spelled out.** `marketer-quickstart.md` §6 and the URL-builder SQL headers now decompose the published URL: `signal.stroma.design/r/` is the renderer (always Stroma), `&d=<your-host>` is the subject (the domain the report is about).
- **Placeholder guidance corrected.** `marketer-quickstart.md` §5 no longer claims the validation SQL needs three substitutions (it needs two). `bigquery-saved-query-setup.md` and `first-successful-report.md` updated in lockstep to reflect that validation = project + dataset, URL-builder = project + dataset + host. Validation SQL headers now point operators at the `host` column as the no-guessing source for the URL-builder filter.
- **`events_*` named as a wildcard, not a placeholder.** A callout in `marketer-quickstart.md` §6 spells out that replacing `events_*` with a concrete table name breaks the `_TABLE_SUFFIX` filter.
- **Host-mismatch troubleshooting moved.** The "host filter mismatch" decision tree is now in `launch-troubleshooting.md` under the URL-builder section, not under validation troubleshooting (validation has no host filter).

### Fixed — Doc-drift sweep across public BigQuery surface

- `public-api-v0.1.md` no longer contradicts itself on `device_screen_w` — the field is GA4-eligible and feeds the form-factor split; removed from the warehouse-only list.
- `ga4-bigquery-url-builder.sql` updated to "GA4 24-field event param map" (was stale "21-field"; the map has been 24 fields + the event name = 25 since iteration-6).
- `gtm-recipe.md` clarifies that the warehouse-only fields are excluded to avoid exceeding GA4's 25-param cap, not to "preserve headroom" — the GA4 subset is exactly at the cap.
- `operator-expectations.md` cost examples re-based to the canonical 7-day production window (was incorrectly stated as 30 days; the SQL, technical reference, and automation doc all say 7 complete days).
- `operator-expectations.md` browser-support matrix aligned with `signal-technical-reference.md` — LCP / CLS / INP are Chromium-only; FCP and TTFB are universal. The previous claim that all CWV are supported on Safari 16+ / Firefox was wrong.

## [0.1.0-rc.4] - 2026-05-08

### Changed — Pre-1.0 dist-tag policy: rc lands on `latest`

While the SDK is pre-1.0 every release publishes to the npm `latest` dist-tag rather than `next`. `npm install @stroma-labs/signal` (no version specifier) now resolves to the current rc directly; the npmjs.com package page shows it as the headline version. The previous `latest`-stable / `next`-prerelease split returns once `1.0.0` ships.

### Added — Social share card on `/r`

Hosted Tier Reports shared via LinkedIn, Twitter, and Slack now render with a Signal · Stroma brand card. `og:*` and `twitter:*` meta tags added to the `/r` route; description copy stays observational ("See where your real users actually load — network and device tiers behind a single page.") to respect the artifact's editorial discipline. `og:url` is intentionally per-share — the crawler honours the URL it landed on.

### Changed — Onboarding-experience hardening across public docs

A 9-doc pass that closes the launch-experience gaps a first-time integrator would hit. No SDK behaviour change; pure docs and one tooling fix.

- **`marketer-quickstart.md`** — adds a §4 "Link GA4 to BigQuery" walkthrough (the missing prerequisite step the prior quickstart silently assumed); a 24-hour first-export wait callout (closing the #1 false-broken support pattern); a placeholder reference table enumerating the three SQL substitutions (`your-project`, `analytics_XXXXXXXX`, `your-domain.com`) so non-engineers can self-serve; an explicit zero-rows decision tree under §5; a click-by-click GTM Preview + GA4 DebugView walkthrough under §3 with concrete success criteria per UI; a sample-size band sharing-guidance table under §7 (preliminary / provisional / stable thresholds aligned to the SQL CASE in `ga4-bigquery-url-builder.sql`); a clarification that `signal_report_url` is opened by clicking the URL string inside BigQuery's result cell.
- **`gtm-recipe.md`** — expands the GA4 custom definitions section from 17 lines into a structured walkthrough with a top-of-section "skip if you only want `/r`" callout, a "when to do this" / "what `/r` already gives you" split, the GA4 → Admin → Custom definitions UI path, recommended dimension and metric tables, an explicit "intentionally skip" list (`event_id` / `host` / `url` / `net_tcp_source`), and a 24-48 hour latency note for standard-report population.
- **`launch-troubleshooting.md`** — new "Signal Params Land But I Cannot Filter By Them In Standard GA4 Reports" entry catching the post-install confusion where data flows but native GA4 dashboards look empty for Signal dimensions.
- **`first-successful-report.md`** — concrete per-sink verification walkthroughs: DevTools Network filter and expected payload shape for the beacon path; `console.log` instrumentation pattern for the callback path; `window.signalRuntime` undefined-check; common-failure-mode triage (CORS, auth middleware blocking unauthenticated POSTs, sample-rate gating).
- **`collector-contract.md`** — full example `SignalEventV1` POST payload covering every nested block (`vitals.lcp_attribution`, `vitals.inp_attribution`, `vitals.lcp_breakdown`, `vitals.third_party`, `vitals.loaf`, `vitals.navigation_timing.provenance`, `context`, `meta`); expected response status (`204` preferred); typical payload-size range with a hard-reject guidance for malformed oversized bodies; explicit "never reject because nullable fields are absent" note (Safari/Firefox parity).
- **`warehouse-schema.md`** — realistic example row at the top showing ~50 of the 73 columns with concrete values; explicit Safari/Firefox null-pattern note for `lcp_ms` / `cls` / `inp_ms` / `lcp_breakdown_*` so analysts don't write false-positive data-quality alerts; restructured into "Example row" + "Column reference" headings.
- **`production-report-automation.md`** — example BigQuery DDL for the recommended `signal_report_urls_current` table (with `CLUSTER BY host`); a complete `MERGE` template wrapping the URL-builder query body for scheduled-query use; history-vs-current-state tradeoff guidance; specific schedule-time recommendation for post-export windows.
- **`public-api-v0.1.md`** + **`client-integrations.md`** — cross-references pointing at the canonical "GA4 custom definitions (optional)" section, plus an explicit note that the narrower "commonly useful" list is a reading aid and the gtm-recipe section is the source of truth for the registration set.
- **`README.md`** + **`docs/why-signal.md`** — language polish: tag-agnostic version line in README (no more hardcoded rc-number drift), undefined "substrate" jargon replaced with plainer language on first-encounter surfaces, "Long Animation Frame story" → "Long Animation Frame attribution" for parallelism, marketing-speak triple-noun phrasing tightened, un-contextualized geographic qualifier removed from the action-vocabulary section. Distinctive voice preserved; jargon-without-definition removed.

Tooling:

- **`scripts/pack-and-test-cli.mjs`** — yarn invocation now passes `--silent` so the wizard's stdout JSON output isn't polluted by yarn's "Done in Xs" trailer when the pack-and-test script runs against a yarn-managed test fixture.

### Changed — `signal init` Pattern 2 redesign (one-shot install + snippet)

The wizard now auto-installs `@stroma-labs/signal` as a project dep and prints the framework-correct snippet in **one wizard run** — no more "Step 0: install + re-run" friction. Snippets stay print-only (the wizard never writes source files); only `package.json` + `node_modules` are mutated, via the project's package manager, in the resolved package directory.

Six launch-grade safeguards baked into the redesign:

- **Project-PM detection split (B1)** — `detectPackageManager` now returns BOTH `runner_pm` (UA-based, telemetry-only) AND `project_pm` (lockfile-based, drives all install actions). Under `npx ...`, the user-agent says `npm` regardless of project — without this split, a user running the wizard in a pnpm/yarn/bun project would have gotten a stray `package-lock.json`. Lockfile wins for actions; UA is informational only.
- **Pinned exact-version install (H3)** — install spec is `@stroma-labs/signal@${CLI_VERSION}`, not unpinned. Locks the wizard's snippets to the exact runtime version installed; no rc-skew nightmares.
- **Spawn cwd is `pkgResult.dir` (H2)** — install runs in the resolved package root (via `readPackageJson`'s walk-up), NOT `args.cwd`. Critical in monorepos and nested `src/` layouts.
- **`installed_signal_version` re-read after install (M1)** — telemetry + JSON output reflect the on-disk version after install completes, not the pre-install null.
- **`package_install_failed` error category (H1)** — new top-level enum value end-to-end (`signal-contracts` + snapshot-engine validator + Turso CHECK constraint + stats). Spawn failures now categorise actionably instead of falling into `'unknown'`.
- **Additive snapshot-engine migration (B3)** — `auto_installed` column added to `install_events` via an additive `ALTER TABLE` wrapped in duplicate-column-tolerance, so existing prod DBs (where the `CREATE TABLE IF NOT EXISTS` short-circuits) actually pick up the new column.

New flag + JSON shape changes:

- **`--no-install`** — opt out of auto-install. Wizard prints the install command at the top of the snippet output instead. CI / inspection contexts.
- **`--skip-install-check`** is now a deprecated alias of `--no-install`. Emits a stderr deprecation warning when used directly. Removed in the next rc.
- **JSON output**: `step_zero_install_command` deprecated → renamed to `install_command`. Old field retained as alias for one rc cycle. Two new fields: `auto_installed: boolean` and `installed_signal_version: string | null` (re-read after install).
- **Telemetry**: `SignalInstallEventV1` gains optional `auto_installed: boolean` (cross-repo lockstep with snapshot-engine `feature/signal-install-telemetry@e898803`).

What did NOT change:

- The wizard still ONLY prints snippets — it never creates or modifies source files (`SignalClient.tsx`, `layout.tsx`, etc.). The "wizard prints, never writes" discipline applies to source code; `package.json`/`node_modules` mutations are a different category that every modern scaffolder handles transparently.
- Wire format compatible with rc.4 — the new `auto_installed` field is optional everywhere; legacy clients without it continue to work.

Tests: 3637 → 3656 (+19 new across `init-command.test.ts`, `package-manager.test.ts`, new `run-install.test.ts`, contracts `install-event.test.ts`, contracts wire-format-drift fixtures, snapshot-engine validators / repository / new migrations test).

### Changed — Pre-launch fix pass for the `signal init` wizard (PR #53 review remediation)

A 14-finding technical review of the wizard branch surfaced privacy-promise, packaging, and telemetry-honesty issues that would not have made the launch bar. This pass closes them as a single shippable PR; details by severity:

- **Telemetry default-on without first-run disclosure (B1)** — the wizard now refuses to enqueue any event until the user has answered the disclosure prompt. `resolveOptOut` returns a discriminated union (`disabled` / `enabled` / `needs_disclosure`). `needs_disclosure` triggers a panel + `confirm()` prompt; the answer is persisted via `writeDisclosureConfig` keyed on a new `DISCLOSURE_VERSION` constant so a future material copy change re-prompts everyone with prior consent. **Ctrl-C at the disclosure prompt exits 130 with ZERO telemetry — consent never happened.** Network-isolation gate now enforces this invariant.
- **CLI version drift (B2)** — `cli/util/version.ts` is the single source. `--version`, telemetry `cli_version`, and the vanilla CDN snippet pinning all read from the same constant (build-time JSON import of `package.json`). New `check:exports` assertion fails the release if `cli.mjs --version` does not equal `packages/signal/package.json` `version`.
- **Build-hang DoD (B3)** — release is blocked until `pnpm --filter @stroma-labs/signal build` exits in under 60 seconds in a fresh shell AND fresh CI run. `process.exit()` in the rollup config is last resort only — a masked exit hides the underlying plugin bug.
- **Stage-tracked abort/error telemetry (H1)** — `WizardStage` enum (9 values: `disclosure`/`detection`/`framework_prompt`/`sink_prompt`/`sample_rate_prompt`/`snippet_render`/`output`/`telemetry_flush`/`unknown`) updated at every phase boundary. New `AbortError` sentinel; wizard catch maps stage → `error_category` and emits `install_aborted` (exit 130) or `install_error` (exit 1) with the partial state the user reached. `install_error` `error_category` enum extended with `prompt_failed` + `output_failed`.
- **Install rate-limit math (H2, snapshot-engine)** — `/api/v1/install` per-IP window bumped from 60/h → 1000/h. The original 60/h ceiling silently throttled even a 5-dev NAT'd team (≈80 events/h); 1000/h covers a 50-dev team while keeping the abuse ceiling low (~333 valid attempts before throttle).
- **CLI fixture bundling (H3)** — `@stroma-labs/signal-contracts` adds `./install-event` subpath export with mirrored `tsconfig.base.json` paths. CLI imports from the narrow subpath, NOT the root. `check:exports` adds a < 100 KB bundle-size assertion + a fixture-marker scan that rejects `previewAggregateFixture` / `affirmingAggregateFixture` / etc. in `dist/cli.mjs`. Result: bundle drops from 80 KB → 44 KB.
- **`--yes` ambiguous detection (M1)** — emits a stderr warning when multiple high-confidence framework candidates are auto-resolved under `--yes`, naming the picked candidate + the alternates + the fix (`--framework <id>`). CI/docs pipelines now have a visible signal.
- **Invalid sample-rate feedback (M2)** — interactive sample-rate inputs that fail `Number.parseFloat` validation now print `(invalid sample rate "<x>" — using <default>)` to stderr instead of silently dropping.
- **`installed_signal_version` (M3)** — new `cli/detect/installed-version.ts` walks up from cwd reading `node_modules/@stroma-labs/signal/package.json` for the actually-installed version. Telemetry now reports the resolved version, not the dep-spec range.
- **Honest flush count (M4)** — `TelemetryQueue.flush()` tracks per-promise settlement and reports `{ flushed: actuallySettled, pending: timedOut }` instead of the misleading `pending.length-before` it used to log.
- **Network-isolation teardown (M5)** — `afterAll` guarded against partial `beforeAll` (port-bind failure surfaces a clear message rather than cascading "cannot read property of undefined").
- **Recipe sweep doc references (M6)** — `RECIPE-CURRENCY-SWEEP.md` no longer references the never-implemented `generate:recipes-doc` script (replaced with manual instructions). New `pnpm test:cli:snippet-compile` script wraps the existing vitest invocation.
- **Removed `--no-clipboard` for v1 (M7)** — clipboard is deferred to v0.2; the flag's continued presence in help/parsing implied clipboard existed. Reserved for re-introduction when clipboard ships.
- **Vanilla CDN pinning (L1)** — `matrix.ts` vanilla `<script type="module">` snippets pin to `https://esm.sh/@stroma-labs/signal@${CLI_VERSION}` instead of the unpinned `@latest`. Snapshot tests regenerated.
- **Manual fresh-project release-gate (item A condition)** — `RELEASE-GATE.md` adds a per-framework smoke checklist (Next App Router, React Router v7, Remix v2, SvelteKit on Svelte 5 runes, vanilla) that must be ticked before any tagged release. SvelteKit specifically because parser-level validation cannot catch framework API drift.

Tests: 2552 → 2578 (+26 new across `disclosure-flow.test.ts`, `installed-version.test.ts`, `telemetry-queue.test.ts`, `init-command.test.ts`, `entry-routing.test.ts`, `network-isolation.test.ts`).

### Added — `signal init` install wizard + install telemetry feature

- **New CLI: `signal init` — `npx @stroma-labs/signal init`** detects your framework from `package.json`, asks a small set of questions (sink, sample rate, optional beacon endpoint), and prints the framework-correct snippet ready to paste. Surfaces a Step 0 install panel with the right package-manager command (`pnpm add` / `npm install` / `yarn add` / `bun add`) when `@stroma-labs/signal` isn't yet a project dependency. Hand-rolled UI primitives — zero new runtime dependencies on the published `@stroma-labs/signal` package. Bin field added; shebang preserved through Rollup + terser.
- **12 framework × 3 sink = 36 snippet matrix entries**, all verified May 2026 against current upstream docs:
  * Next.js App Router (Client Component composition pattern, NOT side-effect import)
  * Next.js Pages Router (`typeof window` guard)
  * React Router v7 framework mode (`entry.client.tsx` with `HydratedRouter`)
  * Remix v2 (`entry.client.tsx` with `RemixBrowser`)
  * Nuxt (`.client.ts` plugin)
  * SvelteKit (Svelte 5 runes — `$props` + `$effect`)
  * Plain Vue / Plain Svelte / Plain React (Vite entry side-effect import)
  * Angular standalone (`bootstrapApplication`) + Angular NgModule (legacy)
  * Vanilla (`<script type="module">` with esm.sh CDN)
- **Non-interactive mode**: every interactive prompt has a flag equivalent (`--framework`, `--sink`, `--sample-rate`, `--beacon-endpoint`, `--cwd`, `--yes`, `--json`, `--no-telemetry`, `--verbose`, `--skip-install-check`). `--json` mode outputs a single line of JSON to stdout (chrome to stderr) for CI / docs-screenshot pipelines.
- **Anonymous install telemetry** to `https://api.stroma.design/api/v1/install` — opt-out by default with a prominent first-run disclosure. Captures: framework + version, sink choice, sample rate, package manager, Node version, OS family, CLI version. NEVER captures: project name, file paths, file contents, free text, emails, hostnames, full user-agent string. Disable via `--no-telemetry`, `STROMA_TELEMETRY=0`, `DO_NOT_TRACK=1` (industry standard), or run in CI / non-TTY environment (auto-disabled silently). Network-isolation test gates the zero-requests-when-disabled invariant.
- **Recipe currency discipline**: per-recipe `verified_against_version` + `last_verified_at` + `upstream_doc_url` metadata in `packages/signal/src/cli/snippets/recipe-currency-data.json`. Quarterly sweep checklist documented in `packages/signal/src/cli/RECIPE-CURRENCY-SWEEP.md` — runs every Feb / May / Aug / Nov + within 2 weeks of any tracked framework's major release + when snapshot-engine telemetry's `recipe_currency_pressure` for any framework exceeds 5%.
- **`SignalInstallEventV1` contract** in `@stroma-labs/signal-contracts` with full validator + 12 cross-repo wire-format drift fixtures.
- Snapshot-engine companion: new `src/features/install/` encapsulated module mirrors the existing intent module (deletion-test discipline preserved), `POST /api/v1/install` + `GET /api/v1/install/stats`, dedicated `install_events` Turso table with per-phase timestamps + idempotent retry via `last_event_id`, zod `.strict()` mode, 4 KB body cap, NO User-Agent header capture.
- Existing intent module: removed dead `weekly_inbox` value from the `pill_id` CHECK constraint (pre-existing drift between migration text and validator/contract enums); added migration-validator alignment test that catches future drift in either direction.

### Added — Sample-confidence band on `/r` cover (premature-pull guard)

A first-time installer who runs the BigQuery URL-builder query at N=12 events generates a thin report and, if shared externally, burns trust before the data is meaningful. Three additions close the gap without ever blocking the operator from querying their warehouse:

- **Wizard outro (Task A):** the `signal init` next-steps panel now includes a "Wait ~5–7 days of real traffic before running the BigQuery URL-builder for a representative report" bullet, linking to `first-successful-report.md §8` for the rubric. Sets the right expectation at the moment of install — the cheapest gate.
- **Contract + SQL + codec (Task C):** new `SignalAggregateV1.band` field — `'preliminary'` (sample < 100), `'provisional'` (100–499), `'stable'` (≥ 500). Threshold lives in ONE place: `SIGNAL_SAMPLE_BAND_PROVISIONAL_THRESHOLD` + `SIGNAL_SAMPLE_BAND_STABLE_THRESHOLD` in `signal-contracts/src/types.ts`, with the SQL `URL_builder` templates computing the same value via inline CASE so warehouse-only paths agree without round-tripping through TS. New `b=<band>` URL parameter; codec back-fills from `s=` (sample_size) for older URLs.
- **`/r` cover banner (Task B):** when `vm.band !== 'stable'`, the cover renders a brand-olive note above the masthead — "Preliminary read — sample of N sessions. Ranges and percentiles stabilise around 100+ events..." (or the provisional variant). Suppressed entirely when stable. Banner is a self-honesty signal in the artifact recipients see — not a gate on the operator's BigQuery query.

Test coverage: `deriveSampleBand` boundary tests at 0/99/100/499/500/10k; codec round-trip + back-fill paths; per-fixture banner-render assertion in `report-fixture-coverage.test.ts` (every fixture gets the right banner rendered or suppressed based on its sample size). Total tests: 2552 (was 2529; +23 new).

### Notes

- Wizard adds zero runtime dependencies to the published `@stroma-labs/signal` package — both `check-release-readiness.mjs` invariants stay intact (no `dependencies` block, no bundled deps in the packed artifact).
- `dist/cli.mjs` bundles `@stroma-labs/signal-contracts` validators inline (workspace-private package; would otherwise leak at consumer install time).
- ~72 KB minified CLI bundle; runtime SDK (`dist/index.mjs`) size unchanged at ≤ 6,656 bytes gzipped.

## [0.1.0-rc.3] - 2026-05-02

### Added (RC3 — Closing-section needs-inquiry router + intent-capture telemetry)

- `/r` closing section reframed from a single CTA card into a co-equal three-card needs-inquiry router + five-pill freeform demand-signal row, anchored on the boundary statement. Editorial register: question-led card titles, mono text-link CTAs, no accent backgrounds, no button chrome, no celebration confirmations. Visual register reads as a continuation of body content, not a sales footer. Pricing posture: every CTA is FREE at the click — pricing decisions get made post-demand-signal.
- Three intent-capture cards: (1) campaign-attribution-layer early access with optional email follow-up, (2) **Rapid Fix Plan** (logs intent then redirects to `stroma.design/book?service=rapid-fix`), (3) **Scheduled monitoring** with optional email + cadence (weekly/daily) follow-up.
- Five freeform pills capture demand we haven't yet productized: weekly inbox digest, multi-page report, multi-client portfolio rollout, competitor / market context, and "something else" (expands to a 200-char freeform field).
- New `SignalReportInteractionKind` values: `intent_pi_early_access`, `intent_rapid_fix`, `intent_monitoring`, `intent_freeform`. Plus optional payload fields `intent_capture_id`, `intent_stage` (initial / followup), `intent_email`, `intent_cadence` (weekly / daily), `intent_pill_id`, `intent_freeform_text` on `SignalReportInteractionV1`.
- New `SIGNAL_REPORT_INTERACTION_INGEST_URL_DEFAULT = 'https://api.stroma.design/api/v1/intent'` — canonical full URL for cross-origin sendBeacon delivery to the snapshot-engine's encapsulated `intent` feature module.
- Client-side telemetry via `apps/signal-report/src/intent-telemetry.ts` — uses `navigator.sendBeacon()` (avoids CORS preflight, survives navigation, critical for the Rapid Fix click which redirects after queueing). Stable client-generated `intent_capture_id` lets the server UPSERT initial-click + follow-up-email events into ONE demand-signal row.
- New `report-render-honesty.test.ts` guards scoped to the business section: 15 sales-register tokens (`unlock`, `upgrade to`, `pro`, `premium`, `transform`, `revolutionize`, `costing you r`, etc.) + 11 celebration tokens (`thanks!`, `you're in!`, `welcome!`, `choose your`, `three paths`, etc.) mechanically blocked across all 19 fixtures.
- New `intent-wire-format-fixtures.json` cross-repo drift detection — 10 representative payloads parsed by both the signal-contracts validator AND the stroma-snapshot-engine zod validator. CI fails on either side if the wire format drifts.

### Changed (RC3 — Tier Report `/r` visual + editorial refactor)

- **Layout**: `/r` rewrites the four-act horizontal slide deck as a five-section vertical scroll narrative (`cover` · `audience` · `distance` · `funnel` · `business`). New top scroll-spy nav, smooth-scroll TOC anchors, and a bottom reading-progress hairline. Section IDs are semantic (no more `data-act="N"` chrome).
- **Theme**: light default (warm cream paper aesthetic) with full dark parity via `[data-theme="dark"]`. Drops the prior data-driven mood/accent/density CSS variation system — one canonical accent (warm amber) carries every report; `mood_tier` stays on the view-model for editorial copy template selection only.
- **Typography**: Signifier pairing — Fraunces (display, serif wedge) + Schibsted Grotesk (sans) + JetBrains Mono (mono). Loaded via Google Fonts CSS2 import.
- **Editorial register**: tailored to the Paid-Media / PPC specialist and CMO. Glossary tooltips translate every Web-Vital into Paid-Media language with a "what this means for your KPIs" line keyed to CPC / Quality Score / ROAS / CAC / CPA. Body copy stays diagnostic; headlines never prescribe.
- `tier-report-design-spec.md` rewritten end-to-end for the new structure + register; `tier-report-design-spec-alignment.test.ts` updated in lockstep (64 tests covering section IDs, mood enum, funnel stages, thresholds, CTA name, theme posture, typography, layout model).
- BigQuery URL-builder SQL recipes (GTM and normalized warehouse paths) re-aligned with the canonical aggregator's bucketing, tie-break, and rollup logic. Existing decoded URLs keep behaving identically; future generations match authored-side numbers byte-for-byte.

### Added

- `vitals.navigation_timing` block on `SignalEventV1` — decomposes the full PerformanceNavigationTiming entry into named subparts (DNS / TCP / TLS / redirect / SW / request-to-first-byte / request-to-final-headers / response-download / interim-to-final-response), three named TTFB definitions (`nav_ttfb_ms`, `connection_ttfb_ms`, `activation_adjusted_ttfb_ms` clamped ≥ 0 for prerender), raw anchor timestamps for 103 Early Hints awareness (`first_interim_response_start_ms`, `final_response_headers_start_ms`), protocol + payload metadata (`next_hop_protocol`, `transfer_size`, `encoded_body_size`, `decoded_body_size`, `content_encoding`), and a `provenance` sub-block (`early_hints_present`, `activation_adjusted`, `timing_redacted_suspected`, `delivery_type`, `response_status`). Per-subpart `null` vs `0` discipline preserved (cached DNS, reused connection, no redirect = meaningful zeros). The block is preserved across prerender so backend timing visibility survives.
- `SignalNavigationTimingStory` aggregate block — per-subpart quartile summary with observation counts (so quartile honesty survives reused-connection bias on DNS/TCP/TLS), strict-denominator dominant TTFB subpart (only events where every comparable subpart is non-null contribute), `next_hop_protocol_histogram`, and `provenance_roll_up` (each share with its own observed-denominator).
- 24 new warehouse columns mirroring the breakdown — warehouse-only; the GA4 lane is unchanged at 24 fields.
- `apps/signal-report/src/glossary.ts` — typed glossary (14 keys: lcp / fcp / inp / ttfb / p75 / cohort / qs / roas / cac / cpc / cpa / poor / classified / renderdelay) used by `renderTerm()` for KPI-translation tooltips.
- `apps/signal-report/src/render-helpers.ts` — vanilla-TS Reveal / HeroValue / Term builders + boot helpers (`bootRevealObserver`, `bootCounterTweens`, `bootGlossaryPopovers`, `bootScrollSpy`, `bootReadingProgress`, `bootSmoothAnchors`).
- `apps/signal-report/src/sections/render-{cover,audience,distance,funnel,business}.ts` + `render-shell.ts` — one file per section + the outer scroll-narrative shell.
- `apps/signal-report/src/report-render-honesty.test.ts` — replaces the prior motion-payload guard. 399 generated tests across every fixture covering whole-doc forbidden tokens (revenue/monthly exposure/commercial diagnosis/asv/mts/zar + bid-down vocabulary) and headline+lede prescription verbs (recommend / you should / optimize / we suggest / the fix is / exclude / avoid).
- `ReportPersonaProfile.save_data_share` (number) — surfaces the per-tier Data Saver share so the renderer can claim "X% of this cohort is on save-data" instead of a binary flag. Sourced from existing `network_summary.save_data_share`; no warehouse schema change.
- `ReportAct4ImpactRow.glossary_key` (optional `'qs' | 'cpc' | 'cpa' | 'roas' | 'cohort'`) — anchors KPI-ledger rows to the right glossary tooltip term.
- `SignalRuntimeLogger` interface and four optional `SignalInitConfig` dependency-injection points (`clock`, `random`, `eventIdFactory`, `logger`). Defaults preserve current behavior; supply your own to make event timestamps, ids, and sample-rate gating deterministic, or to forward runtime warnings + debug info into your observability stack without monkeypatching `console`.
- `DEFAULT_NETWORK_THRESHOLDS` and `DEFAULT_DEVICE_SCORE_BOUNDARIES` exported from `@stroma-labs/signal-contracts` as the canonical numbers behind the network and device classifiers. Previously SDK-internal; promoting them to the contract package means the SDK and downstream renderers / docs derive the same boundaries from one source.
- `SignalDeviceScoreBoundaries` interface companion to the new `DEFAULT_DEVICE_SCORE_BOUNDARIES` constant.
- `formatNetworkBand(tier)` and `formatDeviceSignature(tier)` helpers for deriving the human-readable boundary copy (e.g. `< 50 ms TCP`, `6+ cores · 4+ GB · 1280px+`) from the canonical thresholds. Both accept an optional override block for custom calibration.

### Removed

- Documentation framing of `net_tier` softened to acknowledge it as "connection-setup tier when isolatable" rather than overclaiming as "network speed cohort." `net_tier` field name + behavior unchanged; consumers see no breaking change. The richer subpart picture lives in the new `vitals.navigation_timing` block.
- Canvas particle system (`apps/signal-report/src/report-motion.ts`, ~1400 lines) and its phase-orchestration scaffolding. Particles deferred indefinitely from RC3.
- Legacy markup builder (`apps/signal-report/src/report-markup.ts`, ~1450 lines) and the immersive CSS layer (`report-immersive.css`, ~4300 lines). Replaced by per-section render functions + lean tokens-v2 / scroll CSS.
- Mood-, accent-, and density-driven CSS variation system. The view-model still computes `mood_tier` to inform editorial copy template selection, but no longer drives visuals.

### Fixed

- `destroy()` on the sealed (sampled-out) runtime controller now releases the global singleton, so a subsequent `init()` spins up a fresh runtime. Previously a no-op that left the sampled-out shape pinned in `globalThis` for the page lifetime.

### Note (Navigation Timing)

- `SignalNetTcpSource` union UNCHANGED. The new navigation-timing provenance flags live on `vitals.navigation_timing.provenance.*` because they are independent telemetry-quality flags, not TCP-classifier source values.

### Added (RC3 — Brand surfaces, palette anchor, persona-card paid-media qualifiers)

- New `--brand: #556700` token (Signal logo olive) plus `--brand-soft` (10% alpha tint) and `--brand-strong` (#3d4a00) for emphasis. New `.brand-text` utility uses `var(--brand)` as a solid color (replaces the prior `.duotone-text` accent→cyan gradient — off-brand against the warm-cream paper surface). Used for all editorial headline highlights inside `<h2>` titles.
- Signal logo refresh: `docs/images/signal-stroma-logo.png` now contains the new 108×34 green-square mark (was the prior wave-motif lockup). Used in the sticky top nav of `/r` alongside a mono-small "by Stroma" sub-text, and in `README.md` + 4 public-facing docs (`why-signal.md`, `client-integrations.md`, `production-report-automation.md`, `marketer-quickstart.md`) — same brand mark across every surface for consistency. The prior wave-motif file is preserved as `signal-stroma-logo_1.png` for any future use.
- New `bootShareCopy()` in `render-helpers.ts` — restores the "copy report link" affordance in the footer (incidentally lost in the RC3 vertical-scroll rewrite). Uses `navigator.clipboard.writeText(window.location.href)` → flips label to "✓ copied" → reverts after 2s. Mono small text-link, no button chrome — matches the RC3 visual restraint discipline.
- New persona-card paid-media qualifier system in `apps/signal-report/src/view-model/builders/persona-paid-media-notes.ts`. Pure functions (`effectiveTypeNote`, `bandwidthNote`, `rttNote`, `coresNote`, `memoryNote`) take the canonical bucket key / numeric value the persona builder already has and return a 2–5 word qualifier framed for the Paid-Media operator. Five new optional fields on `ReportPersonaProfile` (`effective_type_note`, `downlink_note`, `rtt_note`, `cores_note`, `memory_note`) — renderer composes "value · qualifier" via a small helper, with the qualifier toned to `--ink-mute`.
- `formatNetworkBand(tier)` enriched: leads with a plain-English real-world equivalent then trails with the threshold (e.g. `fast 4G / fibre · < 50 ms TCP` instead of bare `< 50 ms TCP`). Same `--bar-scale` derivation drives the network-spread tier tables AND the persona-card NETWORK row, single source of truth.
- New `<h3>` semantic level for sub-section headings (Network spread / Device spread / Form factor / At a glance / Stage progression / Per-stage detail / Context that shapes the experience / persona section eyebrow / metric race header / business section eyebrow). Eleven sites converted from `<div class="section-eyebrow">` to `<h3 class="section-eyebrow">` to give screen readers proper sub-section navigation.
- New `aria-labelledby` on each `<section>` pointing to either `cover-heading` (cover only — the page's single `<h1>`) or `{section}-eyebrow` (the stable "Act 0X · …" label on the four other sections). Section landmarks now announce a meaningful name when AT users navigate by landmark.
- New `role="status"` on the closing-card and multiselect-form confirmation slots — when state flips to "logged" via `intent-telemetry.ts`, the `✓ noted — we will be in touch` text is announced via the implicit `aria-live="polite"` + `aria-atomic="true"` semantics. `aria-live="polite"` also added to the share-copy footer button so the "✓ copied" text-content change announces.
- New `<table>` semantic for the network-spread + device-spread tier tables in Act 01 — `<thead>` + `<tbody>` + `<tr>` + `<th scope="col">` + `<td>` with `display: grid` on the table + `display: contents` on table parts. Native tabular semantics for screen readers + grid layout for visual control. AT users can navigate cells via Cmd+Option+Arrow with proper header announcement.
- New `font-variant-numeric: tabular-nums` on `.hero-value-num` and `.hero-value-unit` — counter tweens (`bootCounterTweens` writes `.textContent` 40+ times during the 720ms count-up) no longer shift sibling text width. Estimated CLS −0.04 to −0.08 on slow networks where RAF frames batch unevenly.
- New `<link rel="preload" as="style">` for the Google Fonts CSS request in `r/index.html` — boosts the request to "Highest" priority. Fraunces (the LCP candidate for the hero `<h1>`) starts downloading sooner. Estimated −100 to −200 ms LCP on 4G p75 globally.
- New `inputmode="email"` on the closing-card email input + explicit `id` / `for` association between the `<label>` and the input (belt-and-braces alongside the existing implicit-wrap label semantics) for AT compatibility + mobile-keyboard layout hints.
- New `Content-Security-Policy` + `Referrer-Policy` meta tags on `r/index.html`. CSP blocks framing (`frame-ancestors 'none'`), restricts XHR/fetch/sendBeacon to self + `https://api.stroma.design` (the snapshot-engine intent endpoint), and restricts form submissions to self + `https://www.stroma.design` (the Rapid Fix booking redirect). Defense-in-depth on top of the consistent `escapeHtml` discipline at every template-literal interpolation.

### Changed (RC3 — Iterative editorial polish, plain-English copy, brand cohesion)

- PI-card body rewritten in plain operator vocabulary — dropped "substrate" / "join" / "campaign-side question" SQL/engineering jargon in favour of the same problem→solution→status pattern the Monitoring card uses ("This report shows the gap, but it does not tell you which specific campaigns or audiences are most exposed to it. We are working on a separate tool that links this report to your ad-platform data. Not built yet — collecting interest first."). PI + Monitoring CTAs unified to "Keep me posted" (was "Tell me when it ships"). Confirmation copy "✓ noted — we will be in touch" (was "✓ thanks — we will let you know when it ships"). Removes the "Signal as freemium teaser" frame for npm-discovered SDK readers who have no Stroma brand context.
- AI-cadence sweep across the editorial registry — removed rule-of-three "first…again…and finally" + "stage by stage" closer + double-em-dash parentheticals + appended "and where a deeper engagement starts" salesy tails. Em-dashes preserved only where they carry actual rhetorical weight (single "however" pivots in headlines, definitional expansions in glossary).
- `weekly_inbox` pill removed from the closing-section multiselect dropdown — duplicated the Monitoring card's demand signal at lower fidelity (no email, no cadence). `pill_id 'weekly_inbox'` removed from the `IntentPillId` union, the zod validator, and the cross-repo drift fixtures. The SQL CHECK constraint in snapshot-engine keeps `weekly_inbox` as a permissive dead value (SQLite ALTER doesn't drop CHECK; rebuilding the table for one removed enum value isn't worth the migration risk).
- Network-spread + Device-spread tables in Act 01 now use the canonical `formatNetworkBand()` / `formatDeviceSignature()` helpers — replaces local hardcoded `criteriaForTier()` / `deviceCriteriaFor()` functions that had silently drifted in punctuation (`< 50ms TCP` no-space vs the helper's `< 50 ms TCP` with-space).
- Top sticky nav simplified — dropped the `/ r /` route-jargon span and the `{domain}` mute text. Logo + the contextual cover h1 establish scope; in-nav domain was redundant chrome.
- Footer collapsed to a flex `space-between` — meta strip ("generated DATE · N sessions · D day window") flush left at the section-padding edge, "copy link" button flush right. The Signal logo no longer renders in the footer (sticky header carries the brand persistently). Mobile (<640px) stacks vertically center-aligned.
- Cover scroll-cue (animated "scroll" hairline below the hero) removed — the full-viewport cover height + the natural scroll affordance of a long-form report makes the prompt unnecessary. `.section-inner > .act-intro + *` margin compensation tightened from `-0.5 * --stack-xl` → `-1 * --stack-xl` so the next block lands closer to the centered hero.
- Closing-card titles + small_note hedges trimmed — small_note set to null on all three cards (the card titles + bodies + CTAs already carry their own honesty, footnote hedges read as redundant disclaimers).
- Persona-card NETWORK row no longer wraps in the constrained-cohort variant — dropped the redundant tier-name prefix (already visible in the persona-card header + the Network Spread table at the top of the section), keeping just `{qualifier} · {threshold}` which is unambiguous on its own.

### Fixed (RC3 — A11y, perf, contrast, layout)

- Editorial section headlines demoted from `<h1>` to `<h2 class="section-title">` so the cover hero is the only `<h1>` on the page (was 5 h1s — one per section). Honesty test still scans `<h2 class="section-title">` headlines for forbidden tokens. CSS `.act-intro h1` selector extended to `.act-intro h1, .act-intro h2` so the demoted h2s preserve the large display styling.
- `bootScrollSpy` no longer attaches a scroll/resize fallback listener when `IntersectionObserver` is available — the manual `probe()` was running `getBoundingClientRect()` on every section every scroll event in parallel with the observer (300 forced layout recalcs/sec). Modern browsers always have the observer; the fallback now only attaches for browsers without it (effectively zero in 2026).
- `bootReadingProgress` caches `scrollHeight - innerHeight` once per resize instead of recomputing per scroll-RAF — `scrollHeight` is layout-reading; reading it 60×/sec forced synchronous layout whenever DOM was dirty (reveal animations, glossary popovers, intent-card flips).
- Funnel bar fill animates `transform: scaleX()` (compositor-only) instead of `width:` (layout-triggering) — preserves the visual exactly while shaving ~80–120 ms render cost per funnel reveal on slow Android. `--bar-w` (percentage) → `--bar-scale` (unitless 0–1) in the funnel renderer to match scaleX's expected unit. `prefers-reduced-motion` disables the bar transition.
- `--ink-faint` (#b3ad9e ≈ 2:1 contrast on cream — fails WCAG AA hard) swapped to `--ink-mute` at three live text sites (TOC numerals "00 01 02 03 04" in sticky nav, funnel stage prefix numerals, closing-card-note rule). `--ink-faint` token comment updated to flag decorative-only constraint so future contributors don't reach for it as a text color.
- `prefers-reduced-motion` now also disables the `.scroll-progress-fill` transition.
- Persona-card paid-media row composition (`composeRowValue`) wraps the qualifier in a `<span class="row-note">` toned to `--ink-mute` so the technical value reads first.
- Lint blockers cleared for CI: `useLiteralKeys` (12 dataset bracket-key access sites in `intent-telemetry.ts` + 1 in `render-helpers.ts`), `noNonNullAssertion` (rand[6]/rand[8] in the crypto.randomUUID fallback rewritten with `?? 0`), unused `viewModel` parameter on `renderTopNav` removed.

### Note (RC3 follow-up)

- `SignalAggregateV1` contract unchanged. URL codec unchanged. Warehouse schema unchanged. All RC3 follow-up work is presentation-layer + a11y + perf + brand surface — every numeric value still traces to a canonical aggregate field.
- `intent-capture` feature module on `stroma-snapshot-engine` is deployed and live at `https://api.stroma.design/api/v1/intent` (POST, sendBeacon-friendly) + `/api/v1/intent/stats` (GET, Bearer-token gated). Per-IP rate limit of 30 req/hr on POST via the existing Upstash Ratelimit middleware (separate `intent_rl` Redis prefix from scan).
- Security audit (a11y + semantic HTML + perf + XSS data-flow review) found zero exploitable XSS — `escapeHtml` consistently applied at every template-literal interpolation, codec input is whitelist-validated, no `innerHTML` with unsanitized data. CSP meta tag added as defense-in-depth.

## [0.1.0-rc.2] - 2026-04-30

First publishable release candidate. Package contents identical to
`0.1.0-rc.1` (which did not reach the registry).

### Added

- `init()` runtime with automatic page-lifecycle collection
- `createBeaconSink()` for sending events via `sendBeacon` / `fetch` fallback
- `createCallbackSink()` for custom in-app handling
- `createDataLayerSink()` via `@stroma-labs/signal/ga4` for GTM / GA4 integration
- `createPreviewCollector()` via `@stroma-labs/signal/report` for local preview URLs
- `@stroma-labs/signal/summary` helper surface for plain-text summaries plus JSON/CSV export
- Device tier classification (cores, memory, screen width)
- Network tier classification (TCP round-trip from Navigation Timing)
- Web Vitals observation (LCP, INP, CLS) with attribution
- Chromium LCP subpart breakdown (`resource_load_delay_ms`, `resource_load_time_ms`, `element_render_delay_ms`) with all-or-nothing null discipline
- Chromium LCP culprit-kind classifier (`hero_image`, `headline_text`, `banner_image`, `product_image`, `video_poster`, `unknown`) on sanitized resource hints
- Chromium INP dominant-phase attribution (`input_delay`, `processing`, `presentation`) with deterministic tiebreak ordering
- Third-party pre-LCP script weight capture (`pre_lcp_script_share_pct`, `origin_count`) with eTLD+1 first-party classification, optional `firstPartyOriginsAllowlist` init hook, and privacy mask hiding origin counts below 3
- GA4 enum summaries: `lcp_culprit_kind`, `lcp_dominant_subpart`, `inp_dominant_phase`, `third_party_weight_tier`
- Aggregate stories surfaced in the hosted report: Act 2 LCP subpart narrative + micro-chart, Act 2 third-party pre-race headline (with positive narration when zero off-domain weight), Act 3 INP-phase inline caption
- Warehouse columns for LCP breakdown, culprit kind, INP phase, third-party share/origin count
- Chromium 123+ Long Animation Frame capture (`vitals.loaf.worst_duration_ms`, `dominant_cause`, `script_origin_count`) using `PerformanceObserver('long-animation-frame')`; retains only the worst-duration frame per session (running max) for bounded memory
- Aggregate `loaf_story` with dominant-cause share, p75 worst-frame duration, and observation-threshold gating (25 observations minimum, 35% dominance hedge)
- Act 3 inline LoAF narrative line beneath the INP funnel caption — never claimed when the INP funnel stage itself could not be defended
- Warehouse column `loaf_dominant_cause` (CSV column 45, positional lock: immediately before `context_visibility_hidden_at_load`)
- Background-tab visibility filter: `context.visibility_hidden_at_load` captured per event; default aggregation pre-filters background-tab loads from every percentile, share, and accumulator
- `coverage.raw_sample_size` and `coverage.excluded_background_sessions` preserved so the report credibility strip can narrate the exclusion transparently (invariant: `raw_sample_size === sample_size + excluded_background_sessions`)
- Marginal-coverage warning (`coverage_marginal`) emitted when the LCP cohort lands within 10% / 10 observations of the ship thresholds; credibility strip renders *"coverage at the defensible edge"* so readers temper their read
- Report URL byte budget assertions in `encodeSignalReportUrl`: soft limit (2048 bytes) pushes `signal_report_url_exceeds_soft_limit` warning; hard limit (4096 bytes) throws
- Named constants for threshold tuning: `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT`, `SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS`, `SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT`, `SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES`, `SIGNAL_REPORT_URL_HARD_LIMIT_BYTES`
- Warehouse column `context_visibility_hidden_at_load` (CSV column 46)
- Back/forward cache restore and prerender-aware lifecycle
- Sample rate support
- Frozen data contracts (`SignalEventV1`, `SignalAggregateV1`)
- URL codec for hosted report state
- GA4 event flattening
- Aggregation rules with percentile bucketing
- Hosted report shell and zero-code builder app
- Proof-of-life spike lab with local collector
- Playwright E2E tests across Chromium, Firefox, and WebKit
- Bundle size budgets, import boundary checks, and export validation

### Changed

- release metadata and docs now align to the canonical `jonnybmc/stroma-signal` repository
- npm packaging excludes sourcemaps while keeping local build sourcemaps enabled
- contributor installs now fail fast on unsupported Node versions via root `engine-strict=true`
- Act 2 race-bar motion no longer animates when `urban_ms` or `comparison_ms` is null — static render replaces the hardcoded `2100ms`/`3400ms` fallback so viewers cannot infer magnitude from decorative motion
- Default report math now also excludes `context.visibility_hidden_at_load = true` rows alongside the existing `navigation_type = restore` / `navigation_type = prerender` filter; both BigQuery URL-builder recipes updated (the normalized recipe emits `rs`/`xb` params; the GA4 recipe documents the asymmetry — visibility is warehouse-only)

### Removed

- **Breaking:** `meta.nav_type` has been dropped from `SignalEventV1`, the GA4 flatten (`nav_type` param), the normalized warehouse row (`nav_type` column), the GTM recipe / workspace template, and the BigQuery SQL recipes. Use `meta.navigation_type` — identical semantics, wider browser coverage (includes `prerender` and `restore`, which the legacy field could not represent). Consumers pinned to the old column must migrate the warehouse SELECT list, any GA4 custom-definition mappings, and any DLV references before upgrading to 0.1.x.

### Security

- strengthened collector and warehouse guidance around validation, dedupe, rate limiting, privacy retention, and access control
