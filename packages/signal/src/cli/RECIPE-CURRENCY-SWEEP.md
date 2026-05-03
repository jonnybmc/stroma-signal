# Framework Recipe Currency Sweep

A `signal init` install wizard that ships outdated framework patterns silently teaches every new operator the wrong install. The recipes in `docs/framework-recipes.md` (and the matrix that generates them at `packages/signal/src/cli/snippets/matrix.ts`) must be re-verified against current upstream docs on a recurring cadence + within 2 weeks of any tracked framework's major release.

This doc is the recurring sweep checklist. Each sweep produces a single PR titled `chore(docs): refresh framework recipes against <month> <year> standards` that updates `framework-recipes.md`, `docs/internal/recipe-currency-data.json`, and (if any pattern changed materially) the relevant `matrix.ts` entries + their snapshot tests.

## Cadence

- **Quarterly**: every Feb 3, May 3, Aug 3, Nov 3
- **Ad-hoc**: within 2 weeks of any tracked framework's major release
- **Triggered**: when `recipe_currency_pressure` for any framework on the snapshot-engine `/api/v1/install/stats` endpoint exceeds 0.05 (>5% of installs are running a framework version ahead of our verified-against version)

## Tracked frameworks

| Framework | Detection signal | Upstream doc URL (canonical) |
|---|---|---|
| Next.js (App Router) | `next` dep + `app/` directory | https://nextjs.org/docs/app/getting-started/server-and-client-components |
| Next.js (Pages Router) | `next` dep + `pages/` directory | https://nextjs.org/docs/pages |
| React Router v7 (framework mode) | `react-router@>=7.0.0` + `react-router.config.ts` OR `app/entry.client.tsx` | https://reactrouter.com/start/framework/route-module |
| Remix v2 | `@remix-run/react` OR `@remix-run/dev` | https://v2.remix.run/docs/file-conventions/entry.client |
| Nuxt | `nuxt` dep | https://nuxt.com/docs/guide/directory-structure/plugins |
| SvelteKit | `@sveltejs/kit` dep | https://svelte.dev/docs/svelte/v5-migration-guide |
| plain Svelte | `svelte` dep without `@sveltejs/kit` | https://svelte.dev/docs/svelte/getting-started |
| plain Vue | `vue` dep without `nuxt` | https://vuejs.org/guide/quick-start.html |
| plain React | `react` + `react-dom` deps without `next`/`@remix-run/*`/`react-router@>=7` | https://vite.dev/guide/ |
| Angular standalone | `@angular/core` + (`app.config.ts` exists OR `bootstrapApplication` in main.ts) | https://angular.dev/api/platform-browser/bootstrapApplication |
| Angular NgModule | `@angular/core` + `AppModule` in app.module.ts | https://angular.dev/reference/migrations/standalone |
| vanilla | nothing matches | https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script |

## Sweep procedure (run for every tracked framework)

1. **Fetch current canonical doc** via WebFetch — do NOT trust `recipe-currency-data.json`'s snapshot or training-cutoff knowledge. The fetch is the source of truth for that sweep cycle.
2. **Compare** the current canonical pattern against `docs/framework-recipes.md`'s recipe and `matrix.ts`'s SnippetSpec for that framework × every sink combination (3 entries per framework).
3. **Identify drift** in any of:
   - Import paths
   - Required directives (e.g. `'use client'`)
   - File-creation conventions (e.g. `entry.client.tsx`, `*.client.ts` plugin suffix)
   - Script/syntax patterns (e.g. Svelte 5 runes vs Svelte 4 reactive)
   - Required peer deps or version floors
4. **Update** `framework-recipes.md` snippets if drift is found. Update `recipe-currency-data.json` `verified_against_version` + `last_verified_at` for that recipe. Update `matrix.ts` SnippetSpec entries.
5. **Regenerate** `docs/framework-recipes.md` from the matrix. Auto-generation (`generate:recipes-doc`) is on the v0.2 plan; for now this is manual: edit the file by hand to mirror the changed `matrix.ts` snippet, keeping the per-recipe headings, "verified against" line, and the `<!-- generated -->` markers. A diff against the matrix snapshot (`packages/signal/test/cli/__snapshots__/matrix.test.ts.snap`) is the easiest way to spot what changed.
6. **Run** the snippet-compile gate (`pnpm test:cli:snippet-compile`) — the rendered snippets must parse cleanly against the per-framework parsers in `snippet-compile.test.ts`.
7. **Commit** the sweep as a single PR.

## Pre-flight checklist before opening the sweep PR

- [ ] Every tracked framework re-fetched (12 × WebFetch minimum)
- [ ] `recipe-currency-data.json` `last_full_sweep_at` updated to today's date
- [ ] `recipe-currency-data.json` `next_sweep_due` set to +3 months
- [ ] Each recipe's `last_verified_at` updated (even when no content changed — this records that we LOOKED)
- [ ] Each recipe's `verified_against_version` reflects the current upstream stable version (caret/tilde range upper bound; not lower bound — see plan's "Version detection" section for rationale)
- [ ] Snippet-compile gate green for all 36 (framework × sink) combinations
- [ ] Pack-and-test release gate green
- [ ] Snapshot-engine `recipe_currency_pressure` stat re-checked: any framework with `pressure_ratio > 0.05` was prioritised in this sweep cycle

## What "drift" looks like in practice

Examples from the May 2026 baseline sweep:

- **Next.js App Router (high drift)** — Pre-sweep recipe used a side-effect import of a `'use client'` module from `app/layout.tsx`. Verified canonical pattern is a Client Component rendered as a child boundary inside the Server Layout. Snippet was rewritten to generate `app/SignalClient.tsx` (uses `'use client'` + `useEffect`) and a one-line `<SignalClient />` render in `app/layout.tsx`.
- **SvelteKit (high drift)** — Pre-sweep `+layout.svelte` example used Svelte 4 reactive syntax (`$:` blocks). Verified canonical is Svelte 5 runes (`let { children } = $props()`, `$effect(...)`). Snippet rewritten to runes-first.
- **React Router v7 / Remix (high drift)** — Pre-sweep recipe lumped them into one section using a `useEffect` + dynamic-`import()` workaround. Verified state is two distinct projects, both using `entry.client.tsx` as canonical. Section split into "React Router v7 (framework mode)" and "Remix v2 (legacy)".
- **Angular (medium drift)** — Pre-sweep recipe listed standalone and NgModule co-equal. Standalone has been default since v17; current Angular v21 makes it the only recommended path for new projects. Section reordered: standalone primary, NgModule labeled as legacy fallback.
- **Nuxt / Vue / Vite (low drift)** — Patterns confirmed unchanged from training-cutoff baseline.

## Why this discipline is load-bearing

Without per-recipe versioning + a recurring sweep:

1. The wizard's snippets silently rot — operators who hit `npx @stroma-labs/signal init` get patterns appropriate to a framework version they're no longer running.
2. The `framework_version_ahead_of_recipe` telemetry surfaces the problem in aggregate, but doesn't fix it.
3. Operators silently lose trust ("I followed Signal's init wizard and the snippet doesn't even compile") and never come back to file an issue.

The sweep cadence converts this from invisible drift into a calendared, recurring obligation with a clear deliverable.
