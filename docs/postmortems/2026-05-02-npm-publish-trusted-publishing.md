# Post-mortem — `v0.1.0-rc.3` npm publish failures (2026-05-02)

## Summary

Publishing `v0.1.0-rc.3` to npm via Trusted Publishing failed on three consecutive workflow runs over ~2 hours. Each failure surfaced as a generic `npm 404 Not Found` against `@stroma-labs%2fsignal`, which is the misleading fallback npm emits when OIDC auth silently fails and the request degrades to anonymous. Root cause was a single mismatch (Node 22 → npm 10.x → no OIDC support); we found it on attempt four after adding diagnostic logging that should have been present from the start.

## Timeline

- **Attempt 1** (workflow as merged for rc.3): `pnpm publish` → 404. We had switched from the `NPM_TOKEN`-authenticated rc.2 path to Trusted Publishing without verifying the version requirement.
- **Attempt 2** (PR #48): added `npm install -g npm@latest` thinking the bundled npm was old. The in-place global install corrupted npm's own deps on the hosted runner — `MODULE_NOT_FOUND: promise-retry`. Run died before reaching publish.
- **Attempt 3** (PR #49): swapped `pnpm publish` → `npm publish` (correct: pnpm's publish wrapper does NOT request the npm-audience OIDC token), added `workflow_dispatch` for retries. Still failed with the same 404 because npm 10.x still didn't support OIDC.
- **Attempt 4** (PR #51): switched Node 22 → Node 24 (bundled npm 11.x), added `Print runtime versions` + `Print OIDC token claims` + `npm publish --loglevel=verbose`. Published successfully.

## Root cause

npm Trusted Publishing requires npm CLI **>=11.5.1** ([npm docs](https://docs.npmjs.com/trusted-publishers)). Node 22 LTS ships with npm 10.x bundled; it has no OIDC publish-auth code path at all. When OIDC is configured server-side (TP policy on npmjs.com) but the client can't satisfy it, the npm CLI silently falls back to anonymous publish — which 404s on a private/scoped package because the registry won't disclose existence to anonymous callers. The 404 is structurally indistinguishable from "package doesn't exist", which sent us chasing a registration / scope / access-public symptom instead of the auth root cause.

The rc.2 release worked because it used `NPM_TOKEN`, which has no version requirement. The migration to TP for rc.3 introduced a hidden tooling requirement we didn't check.

## What we did wrong

1. **Patched without diagnosing.** Three workflow runs were burned on speculative fixes. The first two changed code without ever capturing what was actually happening on the runner — what npm version was running, what OIDC token (if any) was being sent, what the registry was actually responding with. Fix-and-see is not a diagnostic strategy.
2. **Didn't verify tooling prerequisites before swapping auth modes.** Moving from token auth to TP is a meaningful change in CI; it warranted a 2-minute check of npm's own docs for version requirements before merging. We assumed bundled npm was "fine".
3. **Trusted the error message at face value.** A 404 on a publish endpoint that worked one RC ago is almost never a missing-package issue — it's an auth issue. Treating it as a literal 404 sent us down the wrong path.
4. **Argued with the user's memory of rc.2.** When the user recalled that rc.2 used `NPM_TOKEN`, the response questioned that recollection instead of checking git history. Git history confirmed the user.

## What we changed

- Node 24 in publish workflow (bundled npm 11.x).
- `npm publish` directly (not `pnpm publish`) — the pnpm wrapper omits the npm-audience OIDC token request.
- `--loglevel=verbose` retained on `npm publish` while diagnostics in place; drop in cleanup PR once a few green runs accumulate.
- Diagnostic steps (`Print runtime versions`, `Print OIDC token claims`) retained as comments-with-code in the workflow for now — first thing to re-enable on any future publish anomaly. See `.github/workflows/publish.yml`.

## Prevention

1. **CI failure protocol — diagnostics first, code second.** When a CI step fails with an error that doesn't immediately point at a code change, the next workflow run must add logging — not a speculative fix. One slow diagnostic run beats three fast guess-runs.
2. **Tooling-prerequisites comment block in workflows.** Any workflow that depends on a minimum version of a runtime / CLI for a critical capability (OIDC auth, provenance, etc.) gets a comment naming the version requirement and the doc link, next to the version-pin line. Already added for npm 11.5.1+ in `.github/workflows/publish.yml`.
3. **Treat misleading status codes as a signal.** When an HTTP status reads literally but doesn't match the operation's history, suspect the upstream auth/handshake degraded to a fallback path. Document the known fallback patterns (npm OIDC → anonymous → 404 is now one).
4. **Per-RC dry-run on PR.** Future improvement: a `npm publish --dry-run` step on PRs that touch package metadata or the publish workflow itself, so auth-mode regressions surface before tagging a release.
