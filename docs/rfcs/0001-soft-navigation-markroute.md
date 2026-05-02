# RFC 0001 — Soft-navigation support: `markRoute()` API for SPAs

| Field | Value |
|---|---|
| **Status** | Draft (no implementation commitment yet) |
| **Target version** | `v0.2` (post-`0.1.0` GA) |
| **Author** | TBD — owner-of-record TBD when discussion converges |
| **Discussion** | Comment on this file in a PR, or open an issue tagged `rfc:0001` |
| **Supersedes** | Nothing |
| **Last updated** | 2026-05-02 |

This RFC is a **draft**. Nothing here is committed. Numbers, field names, and the API shape are placeholders to ground discussion. Push back on anything.

---

## Problem statement

Signal v0.1 fires **one `SignalEventV1` per real document navigation** (browser tab visibility-hidden / pagehide). Documented in [spa-ssr-caveats.md](../spa-ssr-caveats.md) and [operator-expectations.md](../operator-expectations.md).

This is the right call for substrate-true measurements (TCP-handshake tier, Navigation Timing breakdown, network conditions at first byte) — those fields **literally don't update** on a soft client-side route change. A `history.pushState()` call doesn't trigger a new HTTP request, so DNS / TCP / TLS / response timings have no new values to report.

**The gap**: SPA-heavy operators (React Router / Vue Router / SvelteKit client nav / Next.js soft nav) get the initial entry covered, then miss everything else the user does in-app. For a long-session SPA where one `entry → 30 in-app routes → exit` is typical, Signal captures one event when an MPA equivalent would capture 31.

The fields that **could** update meaningfully on a soft nav:
- INP (interaction phase + duration on the new "page")
- CLS (layout shifts on the new "page")
- LCP (largest paint of the new view, if the SPA framework reports it via `loaf`-equivalent observers)
- LoAF (worst frame on the new view)
- Visibility / focus state at the time of nav
- Time spent on the previous "page" before the route change
- Counters of interactions / scroll depth on the previous "page"

The fields that **cannot** meaningfully update:
- All `vitals.navigation_timing.*` (no new HTTP request)
- All `network_*` (substrate hasn't changed within a session)
- All `device_*` (hardware hasn't changed)
- `meta.browser`, `meta.pkg_version` (no change)

## Goals

1. Give SPA operators per-route INP / CLS / LCP-equivalent signals **without lying about per-route TTFB / LCP that structurally don't apply**
2. Preserve the substrate-true positioning of the v0.1 event — soft-nav events explicitly carry a different `navigation_kind` so consumers can filter
3. Stay opt-in — operators that don't want soft-nav events can ignore the API; default behavior unchanged
4. Survive the SDK budget — must add < 1 KB gzipped to the base bundle, ideally less
5. Preserve URL codec budget — soft-nav events are warehouse-only by default; no impact on the `/r` URL contract

## Non-goals

- Auto-detecting route changes via `MutationObserver` / `History.pushState` patching. Too magical, too framework-specific, too prone to false positives. Operators call `markRoute()` explicitly from their router middleware.
- Synthetically constructing fake `vitals.navigation_timing` values for a soft nav. The whole point of Signal's positioning is "we don't fabricate substrate".
- Full-fidelity per-route LCP for SPAs. SPA frameworks are responsible for hooking their own paint observers. We surface what the browser exposes via the existing PerformanceObserver, no more.

## Proposed API (placeholder shape — push back welcome)

```ts
import { init, markRoute } from '@stroma-labs/signal';

const controller = init({
  sinks: [...],
  // Optional — when set, soft-nav events are subject to the same sample-rate decision
  // as initial events. Default: inherit from the parent (initial) event's decision.
  softNavSampleRate: 0.5,
});

// Called from your router middleware on every route change:
markRoute('/products/123');
// or with explicit options:
markRoute('/products/123', {
  // Tag the previous route so the warehouse can compute "from → to" sequences
  fromRoute: '/products',
  // Optional: signal the operator-defined nav kind (e.g., back, forward, push, replace)
  navigationKind: 'soft_push',
});
```

Behaviour on `markRoute()`:
1. Flush any pending counters from the previous route (INP / CLS accumulated since last navigation)
2. Emit a `SignalEventV1` with `meta.navigation_type: 'soft'` and `meta.parent_event_id` = the initial event's id
3. Reset INP / CLS / interaction-counter accumulators for the new route
4. **Do NOT** re-observe `vitals.navigation_timing` — that block on soft-nav events is `null`

## Schema deltas (proposed)

### New `meta.navigation_type` enum value

Currently `meta.navigation_type` is one of: `'navigate' | 'reload' | 'back_forward' | 'prerender'`. Add:
- `'soft'` — soft client-side route change (only set on events emitted via `markRoute()`)

### New `meta.parent_event_id` (optional)

```ts
parent_event_id?: string;  // event_id of the initial-load event for this session
```

Lets the warehouse join soft-nav events to their substrate-true parent — operator gets per-route INP / CLS while still being able to compute substrate metrics from the parent.

### New `meta.from_route` / `meta.to_route` (optional)

```ts
from_route?: string;  // operator-supplied — the route the user came from
to_route?: string;    // operator-supplied — the route they navigated to
```

Lets the warehouse compute route-flow sequences. Operator-supplied because the SDK has no opinion about route naming — `/products/[id]` vs `/products/123` is the operator's call.

### `vitals.navigation_timing` on soft-nav events

Always `null` on `meta.navigation_type === 'soft'` events. Documented as "soft nav doesn't trigger an HTTP request, so substrate timings don't apply".

### Aggregation impact

`SignalAggregateV1` would gain optional fields for soft-nav rollups:
- `soft_nav_per_session_p75: number | null` — how deeply users navigate in-app
- `soft_nav_inp_per_route_top: { route, p75_inp_ms }[] | null` — slowest interactive routes

These are warehouse-only; the URL codec stays unchanged so existing `/r` URLs decode without modification.

## Framework integration sketches

How operators wire this in. Worked examples for each go in `framework-recipes.md` once the API ships.

### React Router v6+

```ts
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { markRoute } from '@stroma-labs/signal';

function SignalRouteTracker() {
  const location = useLocation();
  useEffect(() => {
    markRoute(location.pathname);
  }, [location.pathname]);
  return null;
}

// Wrap your app: <BrowserRouter><SignalRouteTracker />...</BrowserRouter>
```

### Next.js App Router

```ts
'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { markRoute } from '@stroma-labs/signal';

export function SignalRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    markRoute(pathname);
  }, [pathname]);
  return null;
}
```

### Vue Router

```ts
import { markRoute } from '@stroma-labs/signal';

router.afterEach((to, from) => {
  markRoute(to.path, { fromRoute: from.path, navigationKind: 'soft_push' });
});
```

### SvelteKit

```ts
import { afterNavigate } from '$app/navigation';
import { markRoute } from '@stroma-labs/signal';

afterNavigate(({ to, from }) => {
  if (to?.url.pathname) markRoute(to.url.pathname, { fromRoute: from?.url.pathname });
});
```

## Open questions / unresolved tradeoffs

1. **Should `markRoute()` debounce?** A user clicking "next" three times in 200 ms shouldn't emit three events. Default debounce of 100 ms? Configurable? Or leave it to the operator to guard?

2. **`fromRoute` / `toRoute` PII risk.** Operators might pass full URLs including query strings (`/checkout?email=user@example.com`). The SDK should `cleanRoute()` — strip query strings? Strip `[id]`-shaped path segments? Or just document that operator is responsible?

3. **What happens on `markRoute()` before `init()`?** Buffer + flush on init? Throw? Silently ignore? Lean toward silently ignore + log warn via the runtime logger.

4. **Bfcache restore vs `markRoute()`**. v0.1 already detects bfcache via `pageshow.persisted` and emits a fresh real-load event. Should `markRoute()` also be called automatically on bfcache restore, or is that the operator's responsibility? (Lean: SDK handles bfcache as today; `markRoute()` is for soft nav only.)

5. **GA4 lane impact.** Soft-nav events would push toward the 25-param cap and the 10M-event/month sampling threshold faster. Do we ship a separate `dataLayer` event name for soft nav (`perf_tier_soft_nav`)? Or share `perf_tier_report` with `meta.navigation_type` distinguishing? (Lean: separate event name — operators can choose to wire only initial-load events into GA4 and send soft-nav events to their warehouse via the beacon path.)

6. **Sample-rate composition.** If initial event is sampled (1.0) and `softNavSampleRate` is 0.5, the operator wants 100% of initial events + 50% of soft-nav events. But what if operator wants the opposite? Document the multiplicative model clearly: `effective_emit = sample_rate × softNavSampleRate` (where `sample_rate` already gated entry).

7. **Bundle budget.** v0.2 starts at the 6,656-byte ceiling we just bumped to. `markRoute()` + the soft-nav event-emit path could add 400-800 bytes. Realistic ceiling for v0.2 is probably 7,168 (7 KB). Worth a separate budget bump RFC.

## Decision matrix (placeholder — fill in once discussion converges)

| Decision | Option A | Option B | Lean |
|---|---|---|---|
| `markRoute()` debounce | Default 100ms | Operator-controlled | TBD |
| Route-string sanitisation | SDK strips query/UUIDs | Operator-responsible | TBD |
| Soft-nav GA4 event name | Same as initial | Separate name | TBD |
| Bfcache + `markRoute()` | SDK auto-calls | Operator calls | TBD |
| Aggregation fields | Add to URL codec | Warehouse-only | Warehouse-only (URL stays small) |

## Implementation phases (placeholder)

If this RFC lands as accepted:

1. **Phase 1** — Add `markRoute()` + `meta.navigation_type: 'soft'` enum value + `meta.parent_event_id`. No GA4-lane changes. Operators using the beacon sink get soft-nav events in their warehouse.
2. **Phase 2** — Add framework recipes to `framework-recipes.md`. Worked examples for the five major frameworks.
3. **Phase 3** — Add aggregation rollups (`soft_nav_per_session_p75`, etc.) + a small section in the hosted `/r` report (if and only if the deferred decision lands as "show in /r"). Warehouse-side first, /r second.

Each phase is a separate PR. Phase 1 is the smallest unit that delivers value to operators.

## What this RFC does NOT decide

- The hosted `/r` report's UX for soft-nav data. Separate question; covered in a follow-up RFC if Phase 3 lands.
- Whether soft-nav events are URL-encoded for `/r` or stay warehouse-only. Lean toward warehouse-only to preserve URL codec budget.
- Pricing or product-tier implications. The free SDK + free hosted `/r` posture is unchanged. Soft-nav telemetry that lands in the operator's own warehouse stays free at the SDK level.

---

## How to comment on this RFC

- **Push back on the API shape**: comment on a PR that touches this file, or open an issue tagged `rfc:0001`
- **Add a use case**: edit the "Open questions" section with your scenario + propose what should happen
- **Take ownership**: change the "Author" line at the top from "TBD" to your name and start driving consensus

This is a deliberately under-specified document. The point is to surface the question and the tradeoff space — not to legislate the answer. Comment, push back, fill in the gaps.
