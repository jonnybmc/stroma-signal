import { describe, expect, it } from 'vitest';

import { isInteractive, readTtyEnv, shouldUseColor } from '../../src/cli/util/tty.js';

function fakeEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return overrides as NodeJS.ProcessEnv;
}

describe('readTtyEnv', () => {
  it('reads stdout/stdin TTY status from injected streams', () => {
    const env = readTtyEnv(fakeEnv(), { isTTY: true }, { isTTY: false });
    expect(env.isStdoutTty).toBe(true);
    expect(env.isStdinTty).toBe(false);
  });

  it('detects CI=true and CI=1', () => {
    expect(readTtyEnv(fakeEnv({ CI: 'true' })).isCi).toBe(true);
    expect(readTtyEnv(fakeEnv({ CI: '1' })).isCi).toBe(true);
    expect(readTtyEnv(fakeEnv({ CI: 'false' })).isCi).toBe(false);
    expect(readTtyEnv(fakeEnv({})).isCi).toBe(false);
  });

  it('detects NO_COLOR (any non-empty string)', () => {
    expect(readTtyEnv(fakeEnv({ NO_COLOR: '1' })).noColor).toBe(true);
    expect(readTtyEnv(fakeEnv({ NO_COLOR: 'yes' })).noColor).toBe(true);
    expect(readTtyEnv(fakeEnv({ NO_COLOR: '' })).noColor).toBe(false);
    expect(readTtyEnv(fakeEnv({})).noColor).toBe(false);
  });

  it('detects FORCE_COLOR levels 1/2/3', () => {
    expect(readTtyEnv(fakeEnv({ FORCE_COLOR: '1' })).forceColor).toBe(true);
    expect(readTtyEnv(fakeEnv({ FORCE_COLOR: '2' })).forceColor).toBe(true);
    expect(readTtyEnv(fakeEnv({ FORCE_COLOR: '3' })).forceColor).toBe(true);
    expect(readTtyEnv(fakeEnv({ FORCE_COLOR: '0' })).forceColor).toBe(false);
    expect(readTtyEnv(fakeEnv({})).forceColor).toBe(false);
  });
});

describe('isInteractive', () => {
  it('returns true when both TTYs and not CI', () => {
    expect(isInteractive(readTtyEnv(fakeEnv({}), { isTTY: true }, { isTTY: true }))).toBe(true);
  });

  it('returns false when CI is set, even with TTYs', () => {
    expect(isInteractive(readTtyEnv(fakeEnv({ CI: 'true' }), { isTTY: true }, { isTTY: true }))).toBe(false);
  });

  it('returns false when stdout is not a TTY', () => {
    expect(isInteractive(readTtyEnv(fakeEnv({}), { isTTY: false }, { isTTY: true }))).toBe(false);
  });

  it('returns false when stdin is not a TTY (e.g. piped input)', () => {
    expect(isInteractive(readTtyEnv(fakeEnv({}), { isTTY: true }, { isTTY: false }))).toBe(false);
  });
});

describe('shouldUseColor', () => {
  it('FORCE_COLOR overrides everything (even non-TTY)', () => {
    expect(shouldUseColor(readTtyEnv(fakeEnv({ FORCE_COLOR: '1', NO_COLOR: '1' }), { isTTY: false }))).toBe(true);
  });

  it('NO_COLOR disables when FORCE_COLOR is not set', () => {
    expect(shouldUseColor(readTtyEnv(fakeEnv({ NO_COLOR: '1' }), { isTTY: true }))).toBe(false);
  });

  it('non-TTY stdout disables color (no FORCE_COLOR override)', () => {
    expect(shouldUseColor(readTtyEnv(fakeEnv({}), { isTTY: false }))).toBe(false);
  });

  it('TTY stdout enables color by default', () => {
    expect(shouldUseColor(readTtyEnv(fakeEnv({}), { isTTY: true }))).toBe(true);
  });
});
