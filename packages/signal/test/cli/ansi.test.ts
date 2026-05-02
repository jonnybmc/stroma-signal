import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { c, configureColor, isColorEnabled, stripAnsi } from '../../src/cli/ui/ansi.js';

describe('ANSI color helpers', () => {
  beforeEach(() => {
    configureColor(true);
  });
  afterEach(() => {
    configureColor(true);
  });

  describe('color enabled', () => {
    it('wraps text with the SGR escape + reset', () => {
      const wrapped = c.bold('hello');
      expect(wrapped).toContain('hello');
      expect(wrapped.startsWith('[')).toBe(true);
      expect(wrapped.endsWith('[0m')).toBe(true);
    });

    it('emits the basic 8-color codes', () => {
      expect(c.red('x')).toContain('[31m');
      expect(c.green('x')).toContain('[32m');
      expect(c.yellow('x')).toContain('[33m');
      expect(c.blue('x')).toContain('[34m');
      expect(c.cyan('x')).toContain('[36m');
      expect(c.gray('x')).toContain('[90m');
    });

    it('emits brand olive as a 24-bit RGB sequence (#556700)', () => {
      const out = c.brand('signal');
      expect(out).toContain('[38;2;85;103;0m');
      expect(out).toContain('signal');
    });

    it('isColorEnabled() reflects configureColor()', () => {
      expect(isColorEnabled()).toBe(true);
      configureColor(false);
      expect(isColorEnabled()).toBe(false);
    });
  });

  describe('color disabled', () => {
    beforeEach(() => {
      configureColor(false);
    });

    it('returns plain text for every wrapper', () => {
      expect(c.bold('hello')).toBe('hello');
      expect(c.red('hello')).toBe('hello');
      expect(c.brand('signal')).toBe('signal');
      expect(c.dim('faded')).toBe('faded');
    });
  });
});

describe('stripAnsi', () => {
  it('removes color escapes and returns plain text', () => {
    const styled = `${c.red('error')} ${c.bold('happened')} at ${c.brand('init')}`;
    const plain = stripAnsi(styled);
    expect(plain).toBe('error happened at init');
  });

  it('is a no-op on already-plain text', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });
});
