import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { destroy, init } from '../src/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const docPath = path.join(repoRoot, 'docs/spa-ssr-caveats.md');
const runtimePath = path.join(repoRoot, 'packages/signal/src/core/runtime.ts');

const doc = fs.readFileSync(docPath, 'utf8');
const runtimeSrc = fs.readFileSync(runtimePath, 'utf8');

describe('spa-ssr-caveats.md alignment with runtime.ts', () => {
  describe('framework guard table covers every framework with a recipe', () => {
    // Each framework named in the doc table must also have a recipe in
    // framework-recipes.md (verified separately by the link-resolution
    // test in docs-alignment.test.ts). Here we just pin the canonical
    // guard mechanism per framework so a future doc rewrite that drops
    // a framework or invents a new guard fails fast.
    const FRAMEWORK_GUARDS: Array<{ framework: string; mechanism: string }> = [
      { framework: 'Next.js (App Router)', mechanism: "`'use client'` directive" },
      { framework: 'Next.js (Pages Router)', mechanism: "`typeof window !== 'undefined'`" },
      { framework: 'Remix / React Router v7', mechanism: '`useEffect` + dynamic `import()`' },
      { framework: 'Nuxt 3', mechanism: '`.client.ts` plugin suffix' },
      { framework: 'Angular Universal', mechanism: '`isPlatformBrowser(platformId)`' },
      { framework: 'SvelteKit', mechanism: "`import { browser } from '$app/environment'`" }
    ];
    for (const { framework, mechanism } of FRAMEWORK_GUARDS) {
      it(`${framework} guard mechanism reads "${mechanism}"`, () => {
        // Both must appear in the doc; not necessarily on the same row,
        // but presence of both is a sufficient signal that the table
        // still carries the canonical guidance.
        expect(doc).toContain(framework);
        expect(doc).toContain(mechanism);
      });
    }
  });

  describe('Symbol.for singleton key matches runtime.ts', () => {
    const RUNTIME_KEY = 'stroma.signal.runtime';

    it('runtime.ts uses Symbol.for(RUNTIME_KEY)', () => {
      expect(runtimeSrc).toContain(`Symbol.for('${RUNTIME_KEY}')`);
    });

    it('doc names the canonical Symbol.for key', () => {
      expect(doc).toContain(`Symbol.for('${RUNTIME_KEY}')`);
    });

    it('init() is idempotent — second call returns the same controller', () => {
      // Doc claim: "the second call returns the existing controller
      // without creating a new runtime."
      destroy();
      const first = init({ sinks: [] });
      const second = init({ sinks: [] });
      expect(second).toBe(first);
      destroy();
    });
  });

  describe('Bfcache restore + prerender behavior matches load-scoped null contract', () => {
    // The doc enumerates the fields nulled on restore/prerender. Pin
    // each one against the runtime source so adding a new load-scoped
    // field requires updating both the runtime and the doc.
    const NULLED_VITALS_FIELDS = ['lcp_ms', 'fcp_ms', 'ttfb_ms'];
    const NULLED_NETWORK_FIELDS = ['net_tier', 'net_tcp_ms'];
    const NULLED_ATTRIBUTION_BLOCKS = ['lcp_attribution', 'lcp_breakdown', 'third_party'];

    for (const field of [...NULLED_VITALS_FIELDS, ...NULLED_NETWORK_FIELDS, ...NULLED_ATTRIBUTION_BLOCKS]) {
      it(`runtime.ts nulls \`${field}\` for non-load-shaped events`, () => {
        // Match the field name appearing inside one of the load-scoped
        // helpers as a key set to null / undefined.
        const setNullPattern = new RegExp(`${field}\\s*:\\s*(null|undefined)`);
        expect(runtimeSrc).toMatch(setNullPattern);
      });

      it(`spec lists \`${field}\` as nulled on restore/prerender`, () => {
        expect(doc).toContain(`\`${field}\``);
      });
    }

    it('runtime.ts forces net_tcp_source to unavailable_missing_timing on non-load-shaped events', () => {
      expect(runtimeSrc).toMatch(/net_tcp_source:\s*'unavailable_missing_timing'/);
    });

    it('spec calls out the unavailable_missing_timing source for restore/prerender', () => {
      expect(doc).toContain('unavailable_missing_timing');
    });
  });

  describe('Lifecycle event hooks match the hidden-page collection contract', () => {
    // Doc claim: "Signal fires one SignalEventV1 per real page load —
    // when the page becomes hidden (visibilitychange or pagehide)."
    it('runtime listens for visibilitychange and pagehide', () => {
      expect(runtimeSrc).toMatch(/addEventListener\(['"]visibilitychange['"]/);
      expect(runtimeSrc).toMatch(/addEventListener\?\.\(['"]pagehide['"]/);
    });

    it('runtime listens for pageshow with event.persisted gating for bfcache restore', () => {
      expect(runtimeSrc).toMatch(/addEventListener\?\.\(['"]pageshow['"]/);
      expect(runtimeSrc).toContain('event.persisted');
    });

    it('runtime listens for prerenderingchange when document.prerendering is true', () => {
      expect(runtimeSrc).toContain('prerenderingchange');
      expect(runtimeSrc).toContain('prerendering');
    });

    it('doc names visibilitychange and pagehide as the flush triggers', () => {
      expect(doc).toContain('visibilitychange');
      expect(doc).toContain('pagehide');
    });

    it('doc names pageshow with event.persisted as the bfcache trigger', () => {
      expect(doc).toContain('pageshow');
      expect(doc).toContain('event.persisted');
    });

    it('doc names prerenderingchange as the prerender activation trigger', () => {
      expect(doc).toContain('prerenderingchange');
    });
  });

  describe('navigation_type values match SignalNavigationType union for restore/prerender', () => {
    it('runtime sets navigationType to "restore" on bfcache pageshow', () => {
      expect(runtimeSrc).toMatch(/navigationType\s*=\s*'restore'/);
    });

    it('runtime sets navigationType to "prerender" when document.prerendering is true', () => {
      expect(runtimeSrc).toMatch(/'prerender'\s*:\s*'navigate'/);
    });

    it('doc names both `restore` and `prerender` navigation types', () => {
      expect(doc).toContain('`restore`');
      expect(doc).toContain('`prerender`');
    });
  });

  describe('destroy() escape hatch is documented', () => {
    it('doc shows the destroy() import + call', () => {
      expect(doc).toMatch(/import\s*\{\s*destroy\s*\}\s*from\s*'@stroma-labs\/signal'/);
      expect(doc).toContain('destroy()');
    });

    it('destroy() removes the singleton so a subsequent init() creates a fresh runtime', () => {
      destroy();
      const first = init({ sinks: [] });
      destroy();
      const second = init({ sinks: [] });
      expect(second).not.toBe(first);
      destroy();
    });
  });
});
