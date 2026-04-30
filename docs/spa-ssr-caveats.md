# SPA and SSR Caveats

Signal is a browser-only package that collects one performance event per real page load. This page documents what that means for single-page apps and server-rendered frameworks.

## SSR: client-only boundary required

Signal reads browser APIs (`navigator`, `document`, `performance`). It must not run during server-side rendering.

| Framework | Client-only mechanism |
|---|---|
| Next.js (App Router) | `'use client'` directive |
| Next.js (Pages Router) | `typeof window !== 'undefined'` check |
| Remix / React Router v7 | `useEffect` + dynamic `import()` |
| Nuxt 3 | `.client.ts` plugin suffix |
| Angular Universal | `isPlatformBrowser(platformId)` |
| SvelteKit | `import { browser } from '$app/environment'` |
| Plain Vite / static | No guard needed — always in the browser |

Worked examples for each framework are in [framework-recipes.md](./framework-recipes.md).

Importing the package on the server is safe — module evaluation does not touch browser APIs. But calling `init()` from a code path that the server bundle reaches will attach lifecycle listeners to a `globalThis.document` that is `undefined` on Node, leaving you with a runtime that captures nothing and a global singleton that lingers across requests. Signal does not include a server-side polyfill; the client-only guard above is the supported pattern.

## SPA: one event per real navigation

In v0.1, Signal fires **one `SignalEventV1` per real page load** — when the page becomes hidden (`visibilitychange` or `pagehide`).

This means:

- **MPA (multi-page app):** Every page navigation is a real load. Each produces one event. Fully supported.
- **SPA with hard navigations:** If your SPA uses full page reloads between routes (common with SSR frameworks in some configs), each reload produces one event. Fully supported.
- **SPA with client-side routing:** Only the initial page load produces an event. Subsequent in-app navigations (e.g., React Router, Vue Router, SvelteKit client nav) do **not** produce additional events.

This is intentional. Soft navigation support is not first-class in v0.1. The performance data collected (Web Vitals, network tier, device tier) reflects the initial page load, which is the most meaningful measurement for tier classification.

## Duplicate init is safe

Signal stores its runtime under a `Symbol.for('stroma.signal.runtime')` global singleton. If `init()` is called more than once — by React Strict Mode, hot module replacement, or multiple entry points — the second call returns the existing controller without creating a new runtime.

You do not need:
- A `useRef` guard
- A `hasInitialised` flag
- A `once()` wrapper

Just call `init()`. It is idempotent.

## Back/forward cache

Signal detects `pageshow` events with `event.persisted === true` (back/forward cache restores). On a bfcache restore, Signal resets the event ID and re-observes vitals, producing a fresh raw event for the restored page view.

That restore event is preserved in raw data but treated as non-load-shaped by default:

- `meta.navigation_type` is `restore`
- load-shaped timing fields are emitted as `null`: `lcp_ms`, `fcp_ms`, `ttfb_ms`, `net_tier`, `net_tcp_ms`
- attribution / breakdown / third-party blocks are also nulled: `lcp_attribution`, `lcp_breakdown`, `third_party`
- `net_tcp_source` is forced to `unavailable_missing_timing`
- the default report SQL excludes restore rows from coverage and percentile calculations

This works automatically across all frameworks.

## Prerendered pages

Signal detects pages that start in a prerendered state (Speculation Rules API). It defers observation until `prerenderingchange` fires, then begins normal collection.

Prerender navigations are also preserved as raw lifecycle rows but treated as non-load-shaped by default:

- `meta.navigation_type` is `prerender`
- load-shaped timing fields are emitted as `null`: `lcp_ms`, `fcp_ms`, `ttfb_ms`, `net_tier`, `net_tcp_ms`
- attribution / breakdown / third-party blocks are also nulled: `lcp_attribution`, `lcp_breakdown`, `third_party`
- `net_tcp_source` is forced to `unavailable_missing_timing`
- the default report SQL excludes prerender rows from coverage and percentile calculations

No framework-specific handling needed.

## What about `destroy()`?

In most apps, you do not need to call `destroy()`. Signal is designed to live for the lifetime of the page.

If you are building a micro-frontend or test harness where you need to tear down the runtime, call `destroy()` to remove all listeners:

```ts
import { destroy } from '@stroma-labs/signal';

destroy();
```
