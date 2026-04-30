# signal-report

**Hosted report shell for the Signal Tier Report (`/r`) and the zero-code
builder (`/build`).** This app is the rendering surface for the `rv=1` URL
contract emitted by `@stroma-labs/signal-contracts`.

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

The Tier Report is a complete, standalone artifact: a team should be able to
take it into a sprint review and act on it without further engagement.

## Run it

```bash
pnpm --filter signal-report dev
```

Visit the printed URL and navigate to `/r/?...` (with a real `rv=1` URL),
`/build/`, or the landing page.

## Boundary rules

- ✅ Depends on `@stroma-labs/signal-contracts` for the canonical types,
  codec, guards, and fixtures.
- ❌ MUST NOT import `@stroma-labs/signal-pi` (private companion package
  that lives outside the public source tree). Enforced by
  `scripts/check-boundaries.mjs`.
- ❌ The `/r` and `/build` routes MUST NOT contain references to fields that
  do not exist on `SignalAggregateV1`. The render-honesty test suite
  (`report-motion.test.ts`) enforces the language boundary against
  forbidden phrasings.

## Tests

```bash
pnpm --filter signal-report test
```

The view-model + markup tests cover the four-act structure, mood states,
mode transitions (`reduced` / `legacy`), forbidden-words discipline, and
the optional Act 4 CTA. E2E coverage lives in
`tests/e2e/proof-of-life.spec.ts` and `tests/e2e/report-visual.spec.ts`.
