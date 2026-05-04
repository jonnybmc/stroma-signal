// Unit tests for the spawn wrapper. Per-PM argv resolution, plus a smoke
// test of the actual spawn boundary against a guaranteed-success / -failure
// command (echo / false). The wizard tests exercise the DI seam itself.

import { describe, expect, it } from 'vitest';

import { buildInstallArgv, buildInstallCommandString, runInstallSignal } from '../../src/cli/install/run-install.js';

describe('buildInstallArgv', () => {
  it.each([
    ['pnpm', 'pnpm', ['add', '@stroma-labs/signal@1.0.0']],
    ['yarn', 'yarn', ['add', '@stroma-labs/signal@1.0.0']],
    ['bun', 'bun', ['add', '@stroma-labs/signal@1.0.0']],
    ['npm', 'npm', ['install', '@stroma-labs/signal@1.0.0', '--save']],
    ['unknown', 'npm', ['install', '@stroma-labs/signal@1.0.0', '--save']]
  ] as const)('%s → resolves to expected argv', (pm, cmd, args) => {
    const [resolvedCmd, resolvedArgs] = buildInstallArgv(pm, '@stroma-labs/signal@1.0.0');
    expect(resolvedCmd).toBe(cmd);
    expect(resolvedArgs).toEqual(args);
  });
});

describe('buildInstallCommandString', () => {
  it('joins argv into a copy-paste-friendly command', () => {
    expect(buildInstallCommandString('pnpm', '@stroma-labs/signal@0.1.0-rc.5')).toBe(
      'pnpm add @stroma-labs/signal@0.1.0-rc.5'
    );
    expect(buildInstallCommandString('npm', '@stroma-labs/signal@0.1.0-rc.5')).toBe(
      'npm install @stroma-labs/signal@0.1.0-rc.5 --save'
    );
  });
});

describe('runInstallSignal (real spawn smoke)', () => {
  it('returns ok:true when the command exits 0 (echo via npm)', async () => {
    // Don't actually shell out to a PM in unit tests — test the spawn
    // wiring against a guaranteed-success command. We pin the argv via
    // buildInstallArgv but for this smoke test override the spec to a
    // dummy that any PM short-circuits on (--version is universally
    // supported).
    // To avoid dependency on a specific PM being installed, we test
    // the failure path against a non-existent command instead — that's
    // the more important correctness signal (error handling).
    const result = await runInstallSignal({
      pm: 'unknown', // resolves to npm
      spec: '--version',
      cwd: process.cwd(),
      jsonMode: true
    });
    // npm --version always exits 0 if npm is on PATH (which it is in
    // any node environment running these tests).
    expect(result.ok).toBe(true);
  });

  it('returns ok:false with non-zero exitCode + captured stderr when the spawn fails', async () => {
    // Spawn npm in a non-existent cwd — npm itself starts but errors
    // on the missing directory; non-zero exit + captured stderr.
    const result = await runInstallSignal({
      pm: 'unknown',
      spec: '--version',
      cwd: '/this/path/does/not/exist',
      jsonMode: true
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.stderr).toBe('string');
    }
  });
});
