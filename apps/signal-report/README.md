# signal-report

**Hosted report shell for the public Signal Tier Report (`/r`) and the
zero-code builder (`/build`).** This app is the rendering surface for the
free `rv=1` URL contract emitted by `@stroma-labs/signal-contracts`.

`private: true`. The deployable artifact is the static build output, not an
npm package.

## What ships

- `r/index.html` + `src/report-route.ts` → the hosted Tier Report at
  `https://signal.stroma.design/r`. Decodes a `SignalAggregateV1` from the URL
  params, builds an immersive view model, and renders the four-act artifact.
- `build/index.html` + `src/build-route.ts` → the zero-code builder /
  validator. Round-trips between aggregate JSON and report URL; surfaces
  `explainSignalAggregateIssues` violations inline.
- `index.html` → the landing page that points visitors at `/r/` or `/build/`.

The `/pi` route also lives in this app today (see `src/pi-*.ts`,
`pi/index.html`). It will move to a sibling private repo (`stromalab/
stroma-signal-pi`) in Phase 0c and be served from a separate build target.
Do not add new public-facing surfaces that depend on PI; those belong in the
private repo.

## Run it

```bash
pnpm --filter signal-report dev
```

Visit the printed URL and navigate to `/r/?...` (with a real `rv=1` URL),
`/build/`, or the landing page.

## Boundary rules

- ✅ Depends on `@stroma-labs/signal-contracts` for the canonical types,
  codec, guards, and fixtures.
- ✅ Depends on `@stroma-labs/signal-pi` *only* for the `/pi` route surfaces
  (until Phase 0c moves them out).
- ❌ MUST NOT add new free-tier surfaces that import
  `@stroma-labs/signal-pi`.
- ❌ The free `/r` and `/build` routes MUST NOT contain references to
  paid-product schema (`account_actions`, `conversion_reconciliation`,
  `substrate_attributable_zar`, etc.). The render-honesty test suite
  (`report-motion.test.ts`) enforces the language boundary.

## Tests

```bash
pnpm --filter signal-report test
```

The view-model + markup tests cover the four-act structure, mood states,
mode transitions (`reduced` / `legacy`), forbidden-words discipline, and the
offer-card upsell. E2E coverage lives in `tests/e2e/proof-of-life.spec.ts`
and `tests/e2e/report-visual.spec.ts`.
