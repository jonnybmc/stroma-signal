// The snippet matrix — single source of truth for every (framework × sink)
// snippet the wizard generates AND the framework-recipes.md doc surfaces.
//
// Direction of truth (P1-21): matrix.ts is canonical; docs/framework-
// recipes.md is REGENERATED from this matrix at build time via
// scripts/generate-framework-recipes-doc.mjs. The recipes-doc-generation
// alignment test asserts the committed doc matches the regenerated output
// byte-for-byte.
//
// Verification metadata (against_version + last_verified_at +
// upstream_doc_url) for each framework is sourced from
// recipe-currency-data.json so version pins live in ONE place per the
// quarterly recipe-currency sweep documented in
// packages/signal/src/cli/RECIPE-CURRENCY-SWEEP.md.

import type { FrameworkId } from '../detect/framework.js';
import { RECIPE_CURRENCY as recipeCurrency } from './recipe-currency-data.js';
import {
  BEACON_ENDPOINT_PLACEHOLDER,
  SAMPLE_RATE_PLACEHOLDER,
  type SinkChoice,
  type SnippetFile,
  type SnippetSpec
} from './types.js';

// The three sink import + init-call snippets — composed into each
// framework's per-file body.
function sinkImportLines(sink: SinkChoice): string {
  if (sink === 'dataLayer') {
    return [
      `import { init } from '@stroma-labs/signal';`,
      `import { createDataLayerSink } from '@stroma-labs/signal/ga4';`
    ].join('\n');
  }
  if (sink === 'beacon') {
    return [`import { init, createBeaconSink } from '@stroma-labs/signal';`].join('\n');
  }
  // callback
  return [`import { init, createCallbackSink } from '@stroma-labs/signal';`].join('\n');
}

function sinkDynamicImportLines(sink: SinkChoice): string {
  if (sink === 'dataLayer') {
    return [
      `      const { init } = await import('@stroma-labs/signal');`,
      `      const { createDataLayerSink } = await import('@stroma-labs/signal/ga4');`
    ].join('\n');
  }
  if (sink === 'beacon') {
    return [`      const { init, createBeaconSink } = await import('@stroma-labs/signal');`].join('\n');
  }
  return [`      const { init, createCallbackSink } = await import('@stroma-labs/signal');`].join('\n');
}

function initCallBody(sink: SinkChoice, indent = '      '): string {
  const lines: string[] = [];
  lines.push(`${indent}init({`);
  if (sink === 'dataLayer') {
    lines.push(`${indent}  sinks: [createDataLayerSink()],`);
  } else if (sink === 'beacon') {
    lines.push(`${indent}  sinks: [createBeaconSink({ endpoint: '${BEACON_ENDPOINT_PLACEHOLDER}' })],`);
  } else {
    lines.push(`${indent}  sinks: [createCallbackSink({ onReport: (event) => {`);
    lines.push(`${indent}    // Receive every SignalEventV1. Send to your collector / log / etc.`);
    lines.push(`${indent}    console.log('[signal]', event);`);
    lines.push(`${indent}  } })],`);
  }
  lines.push(`${indent}  sampleRate: ${SAMPLE_RATE_PLACEHOLDER}`);
  lines.push(`${indent}});`);
  return lines.join('\n');
}

function topLevelInitBody(sink: SinkChoice): string {
  const lines: string[] = [];
  lines.push(sinkImportLines(sink));
  lines.push('');
  if (sink === 'callback') {
    lines.push(`init({`);
    lines.push(`  sinks: [createCallbackSink({ onReport: (event) => {`);
    lines.push(`    // Receive every SignalEventV1. Send to your collector / log / etc.`);
    lines.push(`    console.log('[signal]', event);`);
    lines.push(`  } })],`);
    lines.push(`  sampleRate: ${SAMPLE_RATE_PLACEHOLDER}`);
    lines.push(`});`);
  } else if (sink === 'beacon') {
    lines.push(`init({`);
    lines.push(`  sinks: [createBeaconSink({ endpoint: '${BEACON_ENDPOINT_PLACEHOLDER}' })],`);
    lines.push(`  sampleRate: ${SAMPLE_RATE_PLACEHOLDER}`);
    lines.push(`});`);
  } else {
    lines.push(`init({`);
    lines.push(`  sinks: [createDataLayerSink()],`);
    lines.push(`  sampleRate: ${SAMPLE_RATE_PLACEHOLDER}`);
    lines.push(`});`);
  }
  return lines.join('\n');
}

// ── Per-framework file builders ────────────────────────────────────────

function nextAppRouterFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'app/SignalClient.tsx',
      action: 'create',
      body: `'use client';

import { useEffect } from 'react';

export function SignalClient() {
  useEffect(() => {
    (async () => {
${sinkDynamicImportLines(sink)}
${initCallBody(sink, '      ')}
    })();
  }, []);
  return null;
}
`
    },
    {
      path: 'app/layout.tsx',
      action: 'modify',
      position: 'inside-body',
      body: `// Add this import + render <SignalClient /> as a child of <body>:
import { SignalClient } from './SignalClient';

// Inside your RootLayout's <body>:
//   <SignalClient />
//   {children}
`
    }
  ];
}

function nextPagesRouterFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'lib/signal.ts',
      action: 'create',
      body: `${sinkImportLines(sink)}

if (typeof window !== 'undefined') {
${initCallBody(sink, '  ')}
}
`
    },
    {
      path: 'pages/_app.tsx',
      action: 'modify',
      position: 'top',
      body: `// Add this side-effect import at the top of pages/_app.tsx:
import '@/lib/signal';
`
    }
  ];
}

function reactRouterV7Files(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'app/entry.client.tsx',
      action: 'create',
      body: `import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

${sinkImportLines(sink)}

${initCallBody(sink, '')}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
`
    }
  ];
}

function remixV2Files(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'app/entry.client.tsx',
      action: 'create',
      body: `import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

${sinkImportLines(sink)}

${initCallBody(sink, '')}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
`
    }
  ];
}

function nuxtFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'plugins/signal.client.ts',
      action: 'create',
      body: `${sinkImportLines(sink)}

export default defineNuxtPlugin(() => {
${initCallBody(sink, '  ')}
});
`
    }
  ];
}

function svelteKitFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'src/routes/+layout.svelte',
      action: 'create',
      body: `<script lang="ts">
  import type { LayoutProps } from './$types';
  let { children }: LayoutProps = $props();

  $effect(() => {
    (async () => {
${sinkDynamicImportLines(sink)}
${initCallBody(sink, '      ')}
    })();
  });
</script>

{@render children?.()}
`
    }
  ];
}

function plainSvelteFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'src/signal.ts',
      action: 'create',
      body: `${topLevelInitBody(sink)}
`
    },
    {
      path: 'src/main.ts',
      action: 'modify',
      position: 'top',
      body: `// Add this side-effect import at the top of src/main.ts (before mount(...)):
import './signal';
`
    }
  ];
}

function plainVueFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'src/signal.ts',
      action: 'create',
      body: `${topLevelInitBody(sink)}
`
    },
    {
      path: 'src/main.ts',
      action: 'modify',
      position: 'top',
      body: `// Add this side-effect import at the top of src/main.ts (before createApp(...).mount(...)):
import './signal';
`
    }
  ];
}

function plainReactFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'src/signal.ts',
      action: 'create',
      body: `${topLevelInitBody(sink)}
`
    },
    {
      path: 'src/main.tsx',
      action: 'modify',
      position: 'top',
      body: `// Add this side-effect import at the top of src/main.tsx (before createRoot(...).render(...)):
import './signal';
`
    }
  ];
}

function angularStandaloneFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'src/signal.ts',
      action: 'create',
      body: `${topLevelInitBody(sink)}
`
    },
    {
      path: 'src/main.ts',
      action: 'modify',
      position: 'top',
      body: `// Add this side-effect import at the top of src/main.ts (before bootstrapApplication(...)):
import './signal';
`
    }
  ];
}

function angularNgmoduleFiles(sink: SinkChoice): SnippetFile[] {
  return [
    {
      path: 'src/signal.ts',
      action: 'create',
      body: `${topLevelInitBody(sink)}
`
    },
    {
      path: 'src/main.ts',
      action: 'modify',
      position: 'top',
      body: `// Add this side-effect import at the top of src/main.ts (before platformBrowserDynamic().bootstrapModule(...)):
import './signal';
`
    }
  ];
}

function vanillaFiles(sink: SinkChoice): SnippetFile[] {
  if (sink === 'dataLayer') {
    return [
      {
        path: 'index.html',
        action: 'modify',
        position: 'inside-body',
        body: `<!-- Add this <script type="module"> tag in your <head> or before </body>: -->
<script type="module">
  import { init } from 'https://esm.sh/@stroma-labs/signal';
  import { createDataLayerSink } from 'https://esm.sh/@stroma-labs/signal/ga4';
${initCallBody(sink, '  ')}
</script>
`
      }
    ];
  }
  if (sink === 'beacon') {
    return [
      {
        path: 'index.html',
        action: 'modify',
        position: 'inside-body',
        body: `<!-- Add this <script type="module"> tag in your <head> or before </body>: -->
<script type="module">
  import { init, createBeaconSink } from 'https://esm.sh/@stroma-labs/signal';
${initCallBody(sink, '  ')}
</script>
`
      }
    ];
  }
  return [
    {
      path: 'index.html',
      action: 'modify',
      position: 'inside-body',
      body: `<!-- Add this <script type="module"> tag in your <head> or before </body>: -->
<script type="module">
  import { init, createCallbackSink } from 'https://esm.sh/@stroma-labs/signal';
${initCallBody(sink, '  ')}
</script>
`
    }
  ];
}

const FRAMEWORK_FILE_BUILDERS: Record<Exclude<FrameworkId, 'unknown'>, (sink: SinkChoice) => SnippetFile[]> = {
  'next-app-router': nextAppRouterFiles,
  'next-pages-router': nextPagesRouterFiles,
  'react-router-v7': reactRouterV7Files,
  'remix-v2': remixV2Files,
  nuxt: nuxtFiles,
  sveltekit: svelteKitFiles,
  'plain-vue': plainVueFiles,
  'plain-svelte': plainSvelteFiles,
  'plain-react': plainReactFiles,
  'angular-standalone': angularStandaloneFiles,
  'angular-ngmodule': angularNgmoduleFiles,
  vanilla: vanillaFiles
};

function frameworkNotes(framework: Exclude<FrameworkId, 'unknown'>, sink: SinkChoice): string[] {
  const notes: string[] = [];
  if (framework === 'next-app-router') {
    notes.push(
      'Next.js canonical pattern is to render a Client Component as a child boundary inside Server Components — NOT side-effect imports of `use client` modules from layout.tsx.'
    );
    if (sink === 'dataLayer') {
      notes.push('Wire your GA4 dataLayer → GTM tag using docs/gtm-recipe.md.');
    }
  }
  if (framework === 'next-pages-router') {
    notes.push('The `typeof window !== "undefined"` guard keeps Signal out of the server bundle.');
  }
  if (framework === 'react-router-v7') {
    notes.push(
      'entry.client.tsx is exposed via `npx react-router reveal entry.client` if not already present in your project.'
    );
  }
  if (framework === 'remix-v2') {
    notes.push(
      'entry.client.tsx is exposed via `npx remix reveal entry.client` if not already present. Remix v2 is a distinct project from React Router v7.'
    );
  }
  if (framework === 'nuxt') {
    notes.push('The `.client.ts` plugin suffix isolates browser-only init from SSR.');
  }
  if (framework === 'sveltekit') {
    notes.push(
      'Uses Svelte 5 runes ($props, $effect). `$effect` does NOT run on the server, so Signal stays out of SSR.'
    );
  }
  if (framework === 'angular-ngmodule') {
    notes.push(
      'NgModule is the legacy path. Consider migrating to standalone (default since Angular v17) — Angular v21 supports both.'
    );
  }
  if (sink === 'beacon') {
    notes.push('See docs/collector-contract.md for the schema your beacon endpoint should accept.');
  }
  return notes;
}

const ALL_SINKS: SinkChoice[] = ['dataLayer', 'beacon', 'callback'];

function buildMatrix(): SnippetSpec[] {
  const entries: SnippetSpec[] = [];
  const frameworks = Object.keys(FRAMEWORK_FILE_BUILDERS) as Array<Exclude<FrameworkId, 'unknown'>>;
  for (const framework of frameworks) {
    for (const sink of ALL_SINKS) {
      const builder = FRAMEWORK_FILE_BUILDERS[framework];
      const recipe = recipeCurrency.recipes[framework];
      if (!recipe) {
        throw new Error(`Missing recipe-currency-data.json entry for framework: ${framework}`);
      }
      entries.push({
        framework,
        sink,
        files: builder(sink),
        notes: frameworkNotes(framework, sink),
        verified: {
          against_version: recipe.verified_against_version,
          last_verified_at: recipe.last_verified_at,
          upstream_doc_url: recipe.upstream_doc_url
        }
      });
    }
  }
  return entries;
}

export const SNIPPET_MATRIX: readonly SnippetSpec[] = buildMatrix();

export function findSnippet(framework: FrameworkId, sink: SinkChoice): SnippetSpec | null {
  if (framework === 'unknown') return null;
  return SNIPPET_MATRIX.find((s) => s.framework === framework && s.sink === sink) ?? null;
}

export const SUPPORTED_FRAMEWORKS_IN_MATRIX = Object.keys(FRAMEWORK_FILE_BUILDERS) as ReadonlyArray<
  Exclude<FrameworkId, 'unknown'>
>;
