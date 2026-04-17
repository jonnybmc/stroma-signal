# Framework Recipes

Copy-paste installation snippets for common environments.

Signal is framework-agnostic. These are installation notes, not framework integrations. Each recipe answers:

- Where to initialise
- How to guard against SSR
- How to avoid duplicate init
- Which sink to use

For Safari-specific validation after installation, see [Safari Manual Checklist](./safari-manual-checklist.md). For SPA and SSR lifecycle caveats, see [SPA / SSR Caveats](./spa-ssr-caveats.md).

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

```ts
// app/signal.ts
'use client';

import { init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';

init({
  sinks: [createDataLayerSink()]
});
```

```tsx
// app/layout.tsx
import './signal';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
```

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

### Remix / React Router v7

Remix renders on both server and client. Signal must only run in the browser.

```tsx
// app/root.tsx
import { useEffect } from 'react';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';

export default function App() {
  useEffect(() => {
    import('@stroma-labs/signal').then(({ init }) =>
      import('@stroma-labs/signal/ga4').then(({ createDataLayerSink }) => {
        init({ sinks: [createDataLayerSink()] });
      })
    );
  }, []);

  return (
    <html lang="en">
      <head><Meta /><Links /></head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

`useEffect` only runs in the browser, which keeps Signal out of the server bundle. Dynamic `import()` inside the effect ensures the package is client-only even if the bundler would otherwise inline it.

### React notes

- **React Strict Mode** calls effects twice in development. This does not matter — `init()` is idempotent. The second call returns the existing controller.
- **SSR (Next.js):** Signal touches browser APIs (`navigator`, `document`). The `'use client'` directive or `typeof window` guard keeps it out of server rendering.
- **SSR (Remix):** Use `useEffect` + dynamic `import()` as above. Do not import `@stroma-labs/signal` at module scope in any file that the server bundle sees.
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

### SvelteKit

Initialise in the root layout, guarded by `browser`:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { browser } from '$app/environment';

  if (browser) {
    import('@stroma-labs/signal').then(({ init }) => {
      import('@stroma-labs/signal/ga4').then(({ createDataLayerSink }) => {
        init({
          sinks: [createDataLayerSink()]
        });
      });
    });
  }
</script>

<slot />
```

Or with a top-level await approach:

```ts
// src/lib/signal.ts
import { browser } from '$app/environment';

if (browser) {
  const { init } = await import('@stroma-labs/signal');
  const { createDataLayerSink } = await import('@stroma-labs/signal/ga4');
  init({
    sinks: [createDataLayerSink()]
  });
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import '$lib/signal';
</script>

<slot />
```

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
