# Framework Recipes

Copy-paste installation snippets for common environments.

> **Most operators should start with `npx @stroma-labs/signal init`** — the wizard detects your framework and generates the right snippet. This doc is the manual reference behind it for engineers who prefer copy-paste, and the source of truth for what the wizard generates. Last verified against current upstream docs: **2026-05-03** (see [packages/signal/src/cli/RECIPE-CURRENCY-SWEEP.md](../packages/signal/src/cli/RECIPE-CURRENCY-SWEEP.md) for the quarterly sweep schedule and [packages/signal/src/cli/snippets/recipe-currency-data.json](../packages/signal/src/cli/snippets/recipe-currency-data.json) for the per-recipe version pins).

Signal is framework-agnostic. These are installation notes, not framework integrations. Each recipe answers:

- Where to initialise
- How to guard against SSR
- How to avoid duplicate init
- Which sink to use

For SPA and SSR lifecycle caveats, see [SPA / SSR Caveats](./spa-ssr-caveats.md).

**Duplicate init is safe.** Signal uses a global singleton — calling `init()` more than once returns the existing controller. You do not need your own guard.

**Choose your sink:**

| Team setup | Sink |
|---|---|
| GTM / GA4 | `createDataLayerSink()` from `@stroma-labs/signal/ga4` |
| Own endpoint | `createBeaconSink({ endpoint })` |
| Full control | `createCallbackSink({ onReport })` |

---

## Vanilla / Static Site / Plain Script

Initialise once in your main entry file or a `<script>` tag. No framework concerns.

```ts
import { init, createBeaconSink } from '@stroma-labs/signal';

init({
  sinks: [createBeaconSink({ endpoint: '/rum/signal' })]
});
```

For GTM / GA4:

```ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

No SSR guard needed. No SPA concerns — each full page load produces one event.

---

## React / Next.js

Initialise once in your root layout or `_app.tsx`. Use a client-only boundary.

### Next.js App Router (recommended)

The canonical Next.js pattern is to compose a Client Component as a child boundary inside the Server Layout — NOT a side-effect import of a `'use client'` module. Verified against [nextjs.org App Router docs](https://nextjs.org/docs/app/getting-started/server-and-client-components) for Next 16.x (May 2026).

```tsx
// app/SignalClient.tsx
'use client';

import { useEffect } from 'react';

export function SignalClient() {
  useEffect(() => {
    (async () => {
      const { init } = await import('@stroma-labs/signal');
      const { createDataLayerSink } = await import('@stroma-labs/signal/ga4');
      init({
        sinks: [createDataLayerSink()]
      });
    })();
  }, []);
  return null;
}
```

```tsx
// app/layout.tsx
import { SignalClient } from './SignalClient';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SignalClient />
        {children}
      </body>
    </html>
  );
}
```

> **Why a Client Component, not a side-effect `'use client'` import?** Next.js's canonical guidance is to "use Client Components when you need browser-only APIs" rendered as boundaries inside Server Components. A side-effect import bypasses the Server/Client composition model and is brittle across Next 14 → 15 → 16 transitions; the rendered-component pattern survives them all. Next 16 also requires Node ≥ 20.9 — verify your environment if upgrading.

### Next.js Pages Router

```tsx
// pages/_app.tsx
import '@/lib/signal'; // side-effect import

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```

```ts
// lib/signal.ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

if (typeof window !== 'undefined') {
  init({
    sinks: [createDataLayerSink()]
  });
}
```

### Plain React (Vite, CRA, etc.)

```ts
// src/signal.ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

```tsx
// src/main.tsx
import './signal'; // side-effect import, before React renders
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

### React Router v7 (framework mode)

React Router v7 framework mode (formerly Remix v3) uses `entry.client.tsx` as its canonical browser-only entry point. Verified against [reactrouter.com framework docs](https://reactrouter.com/start/framework/route-module) for React Router 7.x (May 2026).

```tsx
// app/entry.client.tsx — exposed via `npx react-router reveal entry.client` if not present
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
```

The `entry.client.tsx` file runs only in the browser — server bundles never reach it. No `useEffect` workaround needed.

### Remix v2 (legacy)

Remix v2 is a distinct, still-maintained product alongside React Router v7. Verified against [v2.remix.run entry.client docs](https://v2.remix.run/docs/file-conventions/entry.client) (May 2026).

```tsx
// app/entry.client.tsx — exposed via `npx remix reveal entry.client` if not present
import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
```

Same browser-only-entry guarantee as React Router v7. Don't use the prior `useEffect` + dynamic-import pattern from older Signal docs — it's no longer the canonical convention for either project.

### React notes

- **React Strict Mode** calls effects twice in development. This does not matter — `init()` is idempotent. The second call returns the existing controller.
- **SSR (Next.js):** Signal touches browser APIs (`navigator`, `document`). The `'use client'` directive or `typeof window` guard keeps it out of server rendering.
- **React Router v7 framework mode + Remix v2:** Use `entry.client.tsx` as shown above. The file runs only in the browser; server bundles never reach it.
- **SPA navigations:** Signal fires one event per real page load, not per client-side route change. See [SPA/SSR caveats](./spa-ssr-caveats.md).

---

## Vue / Nuxt

### Nuxt 3

Create a client-only plugin:

```ts
// plugins/signal.client.ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

export default defineNuxtPlugin(() => {
  init({
    sinks: [createDataLayerSink()]
  });
});
```

The `.client.ts` suffix ensures Nuxt only runs this in the browser.

### Plain Vue (Vite)

```ts
// src/signal.ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

```ts
// src/main.ts
import './signal'; // side-effect import, before app mounts
import { createApp } from 'vue';
import App from './App.vue';

createApp(App).mount('#app');
```

### Vue notes

- **SSR (Nuxt):** The `.client.ts` plugin convention handles the client-only boundary. No additional guard needed.
- **SPA navigations:** Same as React — one event per real page load. See [SPA/SSR caveats](./spa-ssr-caveats.md).

---

## Angular

Initialise in `main.ts` before bootstrapping, or in a root-level service.

### Standalone (Angular 17+)

```ts
// src/signal.ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

```ts
// src/main.ts
import './signal';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent);
```

### NgModule-based

```ts
// src/main.ts
import './signal'; // same file as above
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

platformBrowserDynamic().bootstrapModule(AppModule);
```

### Angular notes

- **SSR (Angular Universal):** Wrap the init in a platform check:
  ```ts
  import { isPlatformBrowser } from '@angular/common';
  // in a service or APP_INITIALIZER:
  if (isPlatformBrowser(platformId)) {
    init({ sinks: [createDataLayerSink()] });
  }
  ```
- **Zone.js:** Signal uses standard browser event listeners. No zone-related concerns.
- **SPA navigations:** One event per real page load. See [SPA/SSR caveats](./spa-ssr-caveats.md).

---

## Svelte / SvelteKit

### SvelteKit (Svelte 5 runes)

Verified against [Svelte 5 migration guide](https://svelte.dev/docs/svelte/v5-migration-guide) (May 2026). `$effect` is the canonical browser-only side-effect rune — it does NOT run on the server, so Signal stays out of SSR.

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import type { LayoutProps } from './$types';
  let { children }: LayoutProps = $props();

  $effect(() => {
    (async () => {
      const { init } = await import('@stroma-labs/signal');
      const { createDataLayerSink } = await import('@stroma-labs/signal/ga4');
      init({
        sinks: [createDataLayerSink()]
      });
    })();
  });
</script>

{@render children?.()}
```

> **Svelte 4 fallback**: legacy projects using the `let` + `$:` reactive syntax can still guard with `import { browser } from '$app/environment'` and a top-level `if (browser) { ... }` block — the runes-mode pattern above is the new canonical for Svelte 5+ projects, but the older recipe still works.

### Plain Svelte (Vite)

```ts
// src/signal.ts
import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

```ts
// src/main.ts
import './signal';
import App from './App.svelte';

new App({ target: document.getElementById('app')! });
```

### Svelte notes

- **SSR (SvelteKit):** The `browser` check from `$app/environment` is the idiomatic client-only guard.
- **SPA navigations:** One event per real page load. See [SPA/SSR caveats](./spa-ssr-caveats.md).
