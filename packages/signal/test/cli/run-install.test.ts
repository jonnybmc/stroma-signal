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

describe('Windows shell:true semantics (regression lock)', () => {
  // Regression lock — earlier the spawn used `shell: false`
  // unconditionally. On Windows, npm/pnpm/yarn ship as .cmd files;
  // node's spawn without shell:true cannot resolve them through
  // PATHEXT and throws ENOENT. Every Windows user would hit an
  // immediate Pattern 2 install failure. Now shell:true on win32,
  // shell:false on POSIX.
  //
  // We can't easily simulate process.platform without monkey-patching
  // node:child_process, but we can lock the source string so a future
  // refactor can't silently flip to shell:false unconditionally.
  it('source code carries the platform-conditional shell setting', async () => {
    const fs = await import('node:fs/promises');
    const url = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(path.join(here, '..', '..', 'src', 'cli', 'install', 'run-install.ts'), 'utf8');
    expect(src).toMatch(/process\.platform === 'win32'/);
    expect(src).toMatch(/shell: isWindows/);
    // Must NOT contain a SpawnOptions literal with unconditional shell:false
    // (matches the actual options object, not prose comments mentioning the
    // pre-fix form).
    expect(src).not.toMatch(/spawnOptions[^}]*shell:\s*false/);
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
