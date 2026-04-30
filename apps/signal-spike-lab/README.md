# signal-spike-lab

**Local proof-of-life harness for the Signal SDK.** Boots a tiny Vite page
that wires the published SDK surfaces (beacon sink, GA4 dataLayer sink,
preview collector) end-to-end so contributors and integrators can verify a
working install before touching production warehouse plumbing.

`private: true`. Not part of the npm package. This app is companion tooling
only.

## What it demonstrates

- `init()` boots the SDK with all three sink types attached.
- A beacon sink posts canonical `SignalEventV1` payloads to a local collector
  endpoint.
- The GA4 dataLayer sink flattens the same event into a `perf_tier_report`
  custom event for GTM Preview / GA4 DebugView verification.
- The preview collector buffers events in memory and renders a previewable
  report URL (without needing a warehouse).
- A local `gtag` transport (spike-lab only — *not* shipped in the public
  package) for Gate 2 GA4 acceptance tests.

## Run it

```bash
pnpm --filter signal-spike-lab dev
```

Visit the URL printed in the terminal. Click through the flush, reset, and
preview-URL controls; watch the network panel and `window.dataLayer` for
emitted events.

## Boundary rules

- ✅ Depends on `@stroma-labs/signal` and `@stroma-labs/signal-contracts`.
- ❌ MUST NOT depend on `@stroma-labs/signal-pi` (private companion
  package, lives outside the public source tree; enforced by
  `scripts/check-boundaries.mjs`).

## Not for production

This app is for SDK validation. It is not a deployable product surface, and
its `gtag` shim is not part of the public API. For real GA4 transport, use
`createDataLayerSink()` from `@stroma-labs/signal/ga4` and let GTM handle the
gtag boundary.
