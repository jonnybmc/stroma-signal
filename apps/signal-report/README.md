# signal-report

**Hosted report shell for the Signal Tier Report (`/r`) and the zero-code
builder (`/build`).** This app is the rendering surface for the `rv=1` URL
contract emitted by `@stroma-labs/signal-contracts`.

`private: true`. The deployable artifact is the static build output, not an
npm package.

## What ships

- `r/index.html` + `src/report-route.ts` → the hosted Tier Report at
  `https://signal.stroma.design/r`. Decodes a `SignalAggregateV1` from the URL
  params, builds the view-model, and renders a five-section vertical scroll
  narrative artifact (cover · audience · distance · funnel · business).
- `build/index.html` + `src/build-route.ts` → the zero-code builder /
  validator. Round-trips between aggregate JSON and report URL; surfaces
  `explainSignalAggregateIssues` violations inline.
- `index.html` → the landing page that points visitors at `/r/` or `/build/`.

The Tier Report is a complete, standalone artifact: a team should be able to
take it into a quarterly business review or sprint review and act on it
without further engagement.

## Architecture (RC3 redesign)

- **Layout**: vertical scroll narrative — five stacked sections with a
  scroll-spy table of contents, smooth-scroll TOC anchors, and a bottom
  reading-progress hairline.
- **Theme**: light default (warm cream paper aesthetic) with full dark
  parity via `[data-theme="dark"]`. One canonical accent (warm amber).
- **Typography**: Signifier pairing — Fraunces (display, serif wedge) +
  Schibsted Grotesk (sans) + JetBrains Mono (mono). Loaded via Google
  Fonts CSS2 import.
- **Editorial register**: tailored to the Paid-Media / PPC specialist and
  CMO. Glossary tooltips translate every Web-Vital into Paid-Media
  language (CPC / Quality Score / ROAS / CAC / CPA) with a "what this
  means for your KPIs" line. Body copy stays diagnostic; headlines never
  prescribe.
- **Render tech**: vanilla TypeScript producing escaped HTML strings.
  Boot helpers (`render-helpers.ts`) hydrate IntersectionObserver reveals,
  RAF counter tweens, glossary popovers, scroll-spy, and reading-progress
  after `innerHTML` injection. No framework runtime.
- **Motion**: deferred indefinitely from RC3. Canvas particle effects and
  the prior mood/accent/density CSS variation system removed; revisit only
  on explicit product decision.

## Run it

```bash
pnpm --filter @stroma-labs/signal-report-app dev
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
  (`report-render-honesty.test.ts`) enforces the language boundary
  against forbidden phrasings (revenue / monthly exposure / commercial
  diagnosis tokens + prescription verbs in headlines + bid-down language).

## Tests

```bash
pnpm test:unit
```

The view-model + render-honesty + spec-alignment tests cover the
five-section structure, mood-driven editorial template selection, mode
transitions (`reduced` / `legacy`), forbidden-words discipline, glossary
KPI translation, and the optional Rapid Fix Plan CTA. E2E coverage lives
in `tests/e2e/proof-of-life.spec.ts` and `tests/e2e/report-visual.spec.ts`.
