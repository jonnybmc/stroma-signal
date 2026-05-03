import { describe, expect, it } from 'vitest';

import { findSnippet } from '../../src/cli/snippets/matrix.js';
import { renderSnippet, TemplatePlaceholderError } from '../../src/cli/snippets/render-snippet.js';
import type { SnippetSpec } from '../../src/cli/snippets/types.js';

describe('renderSnippet', () => {
  it('substitutes {{SAMPLE_RATE}} placeholder', () => {
    const spec = findSnippet('plain-vue', 'dataLayer')!;
    const out = renderSnippet(spec, { sampleRate: 0.5 });
    // No file body should contain the unsubstituted placeholder.
    for (const file of out.files) {
      expect(file.body).not.toContain('{{SAMPLE_RATE}}');
    }
    // The init-call file (src/signal.ts) should contain the substituted value.
    const initFile = out.files.find((f) => f.path === 'src/signal.ts');
    expect(initFile!.body).toContain('0.5');
  });

  it('substitutes {{BEACON_ENDPOINT}} only for beacon sink', () => {
    const beaconSpec = findSnippet('plain-vue', 'beacon')!;
    const out = renderSnippet(beaconSpec, { sampleRate: 1.0, beaconEndpoint: '/rum/perf' });
    const fullBody = out.files.map((f) => f.body).join('\n');
    expect(fullBody).not.toContain('{{BEACON_ENDPOINT}}');
    expect(fullBody).toContain('/rum/perf');
  });

  it('throws TemplatePlaceholderError when beacon endpoint missing for beacon sink', () => {
    const spec = findSnippet('plain-vue', 'beacon')!;
    expect(() => renderSnippet(spec, { sampleRate: 1.0 })).toThrow(TemplatePlaceholderError);
  });

  it('throws TemplatePlaceholderError on unrecognised placeholders', () => {
    const fakeSpec: SnippetSpec = {
      framework: 'vanilla',
      sink: 'dataLayer',
      files: [
        {
          path: 'index.html',
          action: 'create',
          body: 'init({ sampleRate: {{SAMPLE_RATE}}, secret: {{SECRET_KEY}} });'
        }
      ],
      notes: [],
      verified: {
        against_version: 'test',
        last_verified_at: '2026-05-03',
        upstream_doc_url: 'https://example.com'
      }
    };
    expect(() => renderSnippet(fakeSpec, { sampleRate: 1.0 })).toThrow(/SECRET_KEY/);
  });

  it('preserves file metadata (path, action, position) when rendering', () => {
    const spec = findSnippet('next-app-router', 'dataLayer')!;
    const out = renderSnippet(spec, { sampleRate: 1.0 });
    expect(out.files).toHaveLength(spec.files.length);
    for (let i = 0; i < spec.files.length; i += 1) {
      const before = spec.files[i]!;
      const after = out.files[i]!;
      expect(after.path).toBe(before.path);
      expect(after.action).toBe(before.action);
      expect(after.position).toBe(before.position);
    }
  });

  it('preserves notes + verified metadata in the rendered output', () => {
    const spec = findSnippet('sveltekit', 'dataLayer')!;
    const out = renderSnippet(spec, { sampleRate: 1.0 });
    expect(out.notes).toEqual(spec.notes);
    expect(out.verified).toEqual(spec.verified);
  });

  it('honours sample rate at the legal lower bound (just above 0)', () => {
    const spec = findSnippet('plain-react', 'dataLayer')!;
    const out = renderSnippet(spec, { sampleRate: 0.0001 });
    expect(out.files[0]!.body).toContain('0.0001');
  });
});
