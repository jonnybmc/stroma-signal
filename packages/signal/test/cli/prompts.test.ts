import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { configureColor, stripAnsi } from '../../src/cli/ui/ansi.js';
import { confirm, input, select } from '../../src/cli/ui/prompts.js';

// Helper — drives an interactive prompt by feeding canned answers
// through a PassThrough on stdin while capturing stdout output.
function makeStreams(answers: string[]): {
  input: PassThrough;
  output: PassThrough;
  captured: () => string;
} {
  const inputStream = new PassThrough();
  const outputStream = new PassThrough();
  const chunks: Buffer[] = [];
  outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
  // Feed answers as separate writes (each terminated with \n) so
  // readline's line-buffered question() resolves them in order.
  // We write them on next tick after the prompt has subscribed.
  setImmediate(() => {
    for (const a of answers) inputStream.write(`${a}\n`);
    inputStream.end();
  });
  return {
    input: inputStream,
    output: outputStream,
    captured: () => Buffer.concat(chunks).toString('utf8')
  };
}

describe('prompts (interactive mode injected)', () => {
  beforeEach(() => {
    configureColor(false);
  });
  afterEach(() => {
    configureColor(true);
  });

  describe('confirm', () => {
    it('returns true when user types y', async () => {
      const s = makeStreams(['y']);
      const result = await confirm('Continue?', { input: s.input, output: s.output, isInteractive: () => true });
      expect(result).toBe(true);
    });

    it('returns false when user types n', async () => {
      const s = makeStreams(['n']);
      const result = await confirm('Continue?', { input: s.input, output: s.output, isInteractive: () => true });
      expect(result).toBe(false);
    });

    it('returns defaultYes=true on empty input', async () => {
      const s = makeStreams(['']);
      const result = await confirm('Continue?', {
        defaultYes: true,
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      expect(result).toBe(true);
    });

    it('returns defaultYes=false on empty input', async () => {
      const s = makeStreams(['']);
      const result = await confirm('Continue?', {
        defaultYes: false,
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      expect(result).toBe(false);
    });

    it('returns default on unknown response (no infinite re-prompt)', async () => {
      const s = makeStreams(['maybe']);
      const result = await confirm('Continue?', {
        defaultYes: true,
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      expect(result).toBe(true);
    });

    it('returns default immediately when non-interactive (no stream wait)', async () => {
      const result = await confirm('Continue?', { defaultYes: true, isInteractive: () => false });
      expect(result).toBe(true);
    });
  });

  describe('input', () => {
    it('returns trimmed user response', async () => {
      const s = makeStreams(['  hello world  ']);
      const result = await input('Name?', { input: s.input, output: s.output, isInteractive: () => true });
      expect(result).toBe('hello world');
    });

    it('returns defaultValue on empty input', async () => {
      const s = makeStreams(['']);
      const result = await input('Sample rate?', {
        defaultValue: '1.0',
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      expect(result).toBe('1.0');
    });

    it('returns defaultValue immediately when non-interactive', async () => {
      const result = await input('Sample rate?', { defaultValue: '1.0', isInteractive: () => false });
      expect(result).toBe('1.0');
    });
  });

  describe('select', () => {
    const choices = [
      { value: 'dataLayer', label: 'GA4 / dataLayer' },
      { value: 'beacon', label: 'Own warehouse (beacon)' },
      { value: 'callback', label: 'Custom callback' }
    ] as const;

    it('returns the choice at the typed 1-based index', async () => {
      const s = makeStreams(['2']);
      const result = await select('Sink?', choices, { input: s.input, output: s.output, isInteractive: () => true });
      expect(result).toBe('beacon');
    });

    it('returns default index choice on empty input', async () => {
      const s = makeStreams(['']);
      const result = await select('Sink?', choices, {
        defaultIndex: 0,
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      expect(result).toBe('dataLayer');
    });

    it('substring-matches the choice value', async () => {
      const s = makeStreams(['beacon']);
      const result = await select('Sink?', choices, { input: s.input, output: s.output, isInteractive: () => true });
      expect(result).toBe('beacon');
    });

    it('substring-matches the choice label (case-insensitive)', async () => {
      const s = makeStreams(['CALLBACK']);
      const result = await select('Sink?', choices, { input: s.input, output: s.output, isInteractive: () => true });
      expect(result).toBe('callback');
    });

    it('returns default on unknown response (no infinite re-prompt)', async () => {
      const s = makeStreams(['xyz']);
      const result = await select('Sink?', choices, {
        defaultIndex: 1,
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      expect(result).toBe('beacon');
    });

    it('returns default index value immediately when non-interactive', async () => {
      const result = await select('Sink?', choices, { defaultIndex: 2, isInteractive: () => false });
      expect(result).toBe('callback');
    });

    it('renders all choices with markers + 1-based numbering', async () => {
      const s = makeStreams(['']);
      await select('Sink?', choices, {
        defaultIndex: 0,
        input: s.input,
        output: s.output,
        isInteractive: () => true
      });
      const captured = stripAnsi(s.captured());
      expect(captured).toContain('1. GA4 / dataLayer');
      expect(captured).toContain('2. Own warehouse');
      expect(captured).toContain('3. Custom callback');
    });

    it('throws on empty choices array', async () => {
      // Type-cast forces the runtime check at the function entry to fire.
      const empty = [] as Array<{ value: string; label: string }>;
      await expect(select('Sink?', empty, { isInteractive: () => false })).rejects.toThrow(/at least one choice/);
    });
  });
});
