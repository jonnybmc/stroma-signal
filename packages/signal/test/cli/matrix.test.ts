import { describe, expect, it } from 'vitest';

import { findSnippet, SNIPPET_MATRIX, SUPPORTED_FRAMEWORKS_IN_MATRIX } from '../../src/cli/snippets/matrix.js';
import { renderSnippet } from '../../src/cli/snippets/render-snippet.js';
import type { SinkChoice } from '../../src/cli/snippets/types.js';

const SINKS: readonly SinkChoice[] = ['dataLayer', 'beacon', 'callback'];

describe('snippet matrix', () => {
  it('contains 12 frameworks × 3 sinks = 36 entries', () => {
    expect(SUPPORTED_FRAMEWORKS_IN_MATRIX).toHaveLength(12);
    expect(SNIPPET_MATRIX).toHaveLength(36);
  });

  it('every (framework × sink) combination has exactly ONE entry', () => {
    for (const framework of SUPPORTED_FRAMEWORKS_IN_MATRIX) {
      for (const sink of SINKS) {
        const matches = SNIPPET_MATRIX.filter((s) => s.framework === framework && s.sink === sink);
        expect(matches, `${framework} × ${sink}`).toHaveLength(1);
      }
    }
  });

  it('every entry carries non-empty verified metadata', () => {
    for (const spec of SNIPPET_MATRIX) {
      expect(spec.verified.against_version, `${spec.framework} × ${spec.sink}`).toBeTruthy();
      expect(spec.verified.last_verified_at, `${spec.framework} × ${spec.sink}`).toBeTruthy();
      expect(spec.verified.upstream_doc_url, `${spec.framework} × ${spec.sink}`).toMatch(/^https?:\/\//);
    }
  });

  it('every entry has at least one file', () => {
    for (const spec of SNIPPET_MATRIX) {
      expect(spec.files.length, `${spec.framework} × ${spec.sink}`).toBeGreaterThan(0);
    }
  });

  it('every file has a non-empty body', () => {
    for (const spec of SNIPPET_MATRIX) {
      for (const file of spec.files) {
        expect(file.body.length, `${spec.framework} × ${spec.sink} : ${file.path}`).toBeGreaterThan(0);
      }
    }
  });

  it('findSnippet returns the matching entry', () => {
    const entry = findSnippet('next-app-router', 'dataLayer');
    expect(entry?.framework).toBe('next-app-router');
    expect(entry?.sink).toBe('dataLayer');
  });

  it('findSnippet returns null for unknown framework', () => {
    expect(findSnippet('unknown', 'dataLayer')).toBeNull();
  });
});

describe('placeholder consistency across matrix', () => {
  it('every entry uses {{SAMPLE_RATE}} placeholder somewhere', () => {
    for (const spec of SNIPPET_MATRIX) {
      const fullBody = spec.files.map((f) => f.body).join('\n');
      expect(fullBody, `${spec.framework} × ${spec.sink}`).toContain('{{SAMPLE_RATE}}');
    }
  });

  it('only beacon-sink entries reference {{BEACON_ENDPOINT}}', () => {
    for (const spec of SNIPPET_MATRIX) {
      const fullBody = spec.files.map((f) => f.body).join('\n');
      const hasBeacon = fullBody.includes('{{BEACON_ENDPOINT}}');
      if (spec.sink === 'beacon') {
        expect(hasBeacon, `${spec.framework} beacon must reference {{BEACON_ENDPOINT}}`).toBe(true);
      } else {
        expect(hasBeacon, `${spec.framework} ${spec.sink} must NOT reference {{BEACON_ENDPOINT}}`).toBe(false);
      }
    }
  });

  it('every body has zero unknown {{TOKEN}} placeholders', () => {
    const KNOWN = new Set(['{{SAMPLE_RATE}}', '{{BEACON_ENDPOINT}}']);
    for (const spec of SNIPPET_MATRIX) {
      for (const file of spec.files) {
        const placeholders = file.body.match(/\{\{[A-Z_]+\}\}/g) ?? [];
        const unknown = placeholders.filter((p) => !KNOWN.has(p));
        expect(unknown, `${spec.framework} × ${spec.sink} : ${file.path}`).toEqual([]);
      }
    }
  });
});

describe('Next App Router uses Client Component pattern (NOT side-effect import)', () => {
  it.each(SINKS)('next-app-router × %s renders SignalClient.tsx', (sink) => {
    const spec = findSnippet('next-app-router', sink);
    expect(spec).toBeDefined();
    const clientFile = spec!.files.find((f) => f.path === 'app/SignalClient.tsx');
    expect(clientFile).toBeDefined();
    expect(clientFile!.body).toContain(`'use client'`);
    expect(clientFile!.body).toContain('useEffect');
    expect(clientFile!.body).toContain('export function SignalClient()');
  });

  it.each(SINKS)('next-app-router × %s instructs to render <SignalClient /> in layout', (sink) => {
    const spec = findSnippet('next-app-router', sink);
    const layoutFile = spec!.files.find((f) => f.path === 'app/layout.tsx');
    expect(layoutFile).toBeDefined();
    expect(layoutFile!.body).toContain('<SignalClient />');
  });
});

describe('SvelteKit recipe uses Svelte 5 runes', () => {
  it.each(SINKS)('sveltekit × %s uses $props and $effect', (sink) => {
    const spec = findSnippet('sveltekit', sink);
    expect(spec).toBeDefined();
    const layoutFile = spec!.files.find((f) => f.path === 'src/routes/+layout.svelte');
    expect(layoutFile).toBeDefined();
    expect(layoutFile!.body).toContain('$props()');
    expect(layoutFile!.body).toContain('$effect(');
    // Should NOT contain Svelte 4 reactive syntax.
    expect(layoutFile!.body).not.toMatch(/\$:\s/);
  });
});

describe('React Router v7 vs Remix v2 are split correctly', () => {
  it('react-router-v7 uses HydratedRouter from react-router/dom', () => {
    const spec = findSnippet('react-router-v7', 'dataLayer');
    const entry = spec!.files.find((f) => f.path === 'app/entry.client.tsx');
    expect(entry!.body).toContain('HydratedRouter');
    expect(entry!.body).toContain(`from 'react-router/dom'`);
  });

  it('remix-v2 uses RemixBrowser from @remix-run/react', () => {
    const spec = findSnippet('remix-v2', 'dataLayer');
    const entry = spec!.files.find((f) => f.path === 'app/entry.client.tsx');
    expect(entry!.body).toContain('RemixBrowser');
    expect(entry!.body).toContain(`from '@remix-run/react'`);
  });
});

describe('rendered snippets per (framework × sink) — snapshot stability', () => {
  for (const framework of SUPPORTED_FRAMEWORKS_IN_MATRIX) {
    for (const sink of SINKS) {
      it(`renders ${framework} × ${sink} with sampleRate=1.0 (+ beaconEndpoint when needed)`, () => {
        const spec = findSnippet(framework, sink)!;
        const inputs = sink === 'beacon' ? { sampleRate: 1.0, beaconEndpoint: '/rum/signal' } : { sampleRate: 1.0 };
        const rendered = renderSnippet(spec, inputs);
        // Substitution happened.
        for (const file of rendered.files) {
          expect(file.body, `${framework} × ${sink} : ${file.path}`).not.toContain('{{');
          expect(file.body, `${framework} × ${sink} : ${file.path}`).not.toContain('}}');
        }
        // Snapshot the assembled output for review.
        expect(rendered).toMatchSnapshot();
      });
    }
  }
});
