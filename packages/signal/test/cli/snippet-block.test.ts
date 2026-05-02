import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureColor, stripAnsi } from '../../src/cli/ui/ansi.js';
import { snippetBlock } from '../../src/cli/ui/snippet-block.js';

describe('snippetBlock', () => {
  beforeEach(() => {
    configureColor(false);
  });
  afterEach(() => {
    configureColor(true);
  });

  it('frames body between horizontal rules of default width 60', () => {
    const out = snippetBlock('init({ sinks: [createDataLayerSink()] });');
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^─{60}$/);
    expect(lines[1]).toBe('init({ sinks: [createDataLayerSink()] });');
    expect(lines[2]).toMatch(/^─{60}$/);
  });

  it('honours custom rule width', () => {
    const out = snippetBlock('hello', { ruleWidth: 10 });
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/^─{10}$/);
    expect(lines[2]).toMatch(/^─{10}$/);
  });

  it('emits caption above the top rule when provided', () => {
    const out = snippetBlock('body', { caption: 'app/SignalClient.tsx' });
    const lines = out.split('\n');
    expect(lines[0]).toBe('app/SignalClient.tsx');
    expect(lines[1]).toMatch(/^─{60}$/);
    expect(lines[2]).toBe('body');
    expect(lines[3]).toMatch(/^─{60}$/);
  });

  it('preserves multi-line bodies in order', () => {
    const out = snippetBlock(`'use client';\n\nimport { useEffect } from 'react';`);
    const lines = out.split('\n');
    expect(lines[1]).toBe(`'use client';`);
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe(`import { useEffect } from 'react';`);
  });

  describe('syntax highlighting (color enabled)', () => {
    beforeEach(() => {
      configureColor(true);
    });

    it('marks `use client` directive with brand color', () => {
      const out = snippetBlock(`'use client';`);
      // STRING_RE wraps the whole 'use client' in dim after USE_DIRECTIVE_RE
      // wraps the inner directive in brand — both sequences should appear.
      expect(out).toContain('[38;2;85;103;0m'); // brand olive opening sequence
      expect(out).toContain('use client');
    });

    it('marks string literals as dim', () => {
      const out = snippetBlock(`const path = '/api/v1';`);
      const visibleLine = stripAnsi(out.split('\n')[1] ?? '');
      expect(visibleLine).toBe(`const path = '/api/v1';`);
      expect(out).toContain('[2m'); // dim escape applied somewhere
    });

    it('marks line comments as dim', () => {
      const out = snippetBlock(`init({}); // initialise`);
      expect(out).toContain('[2m// initialise');
    });

    it('raw mode skips highlighting', () => {
      const out = snippetBlock(`'use client';`, { raw: true });
      // No SGR escape applied to the body in raw mode (rules are still colored).
      expect(out.split('\n')[1]).toBe(`'use client';`);
      expect(out.split('\n')[1]).not.toContain('[');
    });
  });
});
