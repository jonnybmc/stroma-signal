import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureColor, stripAnsi } from '../../src/cli/ui/ansi.js';
import { activePromptHeader, bullet, checkmark, cross, info, intro, outro } from '../../src/cli/ui/panels.js';

describe('panels (color disabled for snapshot stability)', () => {
  beforeEach(() => {
    configureColor(false);
  });
  afterEach(() => {
    configureColor(true);
  });

  describe('intro()', () => {
    it('renders title with start corner and bar gutter for body lines', () => {
      const out = intro('Stroma Signal', ['Add post-click instrumentation.', 'Detection in 3 questions.']);
      expect(out).toBe(
        ['┌  Stroma Signal', '│  Add post-click instrumentation.', '│  Detection in 3 questions.', '│'].join('\n')
      );
    });

    it('renders blank lines as bare bars (vertical continuity)', () => {
      const out = intro('Title', ['line one', '', 'line three']);
      const lines = out.split('\n');
      expect(lines[0]).toBe('┌  Title');
      expect(lines[1]).toBe('│  line one');
      expect(lines[2]).toBe('│');
      expect(lines[3]).toBe('│  line three');
    });
  });

  describe('outro()', () => {
    it('renders end corner with tail line and final bar', () => {
      const out = outro("You're set.", ['Wire GTM next.', 'Verify in DebugView.']);
      const lines = out.split('\n');
      expect(lines[0]).toBe('│  Wire GTM next.');
      expect(lines[1]).toBe('│  Verify in DebugView.');
      expect(lines[2]).toBe('│');
      expect(lines[3]).toBe(`└  You're set.`);
    });
  });

  describe('info()', () => {
    it('uses hollow diamond marker for detached info panels', () => {
      const out = info('Detected', ['Next.js 16.2 (App Router)']);
      const lines = out.split('\n');
      expect(lines[0]).toBe('◇  Detected');
      expect(lines[1]).toBe('│  Next.js 16.2 (App Router)');
    });
  });

  describe('activePromptHeader()', () => {
    it('uses solid diamond marker for active questions', () => {
      expect(activePromptHeader('Where should events go?')).toBe('◆  Where should events go?');
    });
  });

  describe('inline glyphs', () => {
    it('checkmark prefixes with a green check', () => {
      configureColor(true);
      expect(stripAnsi(checkmark('done'))).toBe('✓ done');
    });

    it('cross prefixes with a red cross', () => {
      configureColor(true);
      expect(stripAnsi(cross('failed'))).toBe('✗ failed');
    });

    it('bullet prefixes with a dim bullet', () => {
      configureColor(true);
      expect(stripAnsi(bullet('option'))).toBe('· option');
    });
  });
});
