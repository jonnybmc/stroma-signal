# SPA and SSR Caveats

Signal is a browser-only package that collects one performance event per real page load. This page documents what that means for single-page apps and server-rendered frameworks.

## SSR: client-only boundary required

Signal reads browser APIs (`navigator`, `document`, `performance`). It must not run during server-side rendering.

| Framework | Client-only mechanism |
|---|---|
| Next.js (App Router) | `'use client'` directive |
| Next.js (Pages Router) | `typeof window !== 'undefined'` check |
| Nuxt 3 | `.client.ts` plugin suffix |
| Angular Universal | `isPlatformBrowser(platformId)` |
| SvelteKit | `import { browser } from '$app/environment'` |
| Plain Vite / static | No guard needed — always in the browser |

If you forget the guard, the import will throw during SSR. Signal does not include a server-side no-op — it is designed to fail fast rather than silently run in the wrong environment.

## SPA: one event per real navigation

In v0.1, Signal fires **one `SignalEventV1` per real page load** — when the page becomes hidden (`visibilitychange` or `pagehide`).

This means:

- **MPA (multi-page app):** Every page navigation is a real load. Each produces one event. Fully supported.
- **SPA with hard navigations:** If your SPA uses full page reloads between routes (common with SSR frameworks in some configs), each reload produces one event. Fully supported.
- **SPA with client-side routing:** Only the initial page load produces an event. Subsequent in-app navigations (e.g., React Router, Vue Router, SvelteKit client nav) do **not** produce additional events.

This is intentional. Soft navigation support is not first-class in v0.1. The performance data collected (Web Vitals, network tier, device tier) reflects the initial page load, which is the most meaningful measurement for tier classification.

## Duplicate init is safe

Signal uses a `Symbol.for` global singleton. If `init()` is called more than once — by React Strict Mode, hot module replacement, or multiple entry points — the second call returns the existing controller without creating a new runtime.

You do not need:
- A `useRef` guard
- A `hasInitialised` flag
- A `once()` wrapper

Just call `init()`. It is idempotent.

## Back/forward cache

Signal detects `pageshow` events with `event.persisted === true` (back/forward cache restores). On a bfcache restore, Signal resets the event ID and re-observes vitals, producing a fresh event for the restored page view.

This works automatically across all frameworks.

## Prerendered pages

Signal detects pages that start in a prerendered state (Speculation Rules API). It defers observation until `prerenderingchange` fires, then begins normal collection.

No framework-specific handling needed.

## What about `destroy()`?

In most apps, you do not need to call `destroy()`. Signal is designed to live for the lifetime of the page.

If you are building a micro-frontend or test harness where you need to tear down the runtime, call `destroy()` to remove all listeners:

```ts
import { destroy } from '@stroma-labs/signal';

destroy();
```
