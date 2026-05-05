// Top-level routing tests. Exercises the build artifact (dist/cli.mjs)
// to catch routing-layer regressions that the unit tests of run() can't
// see — specifically the `signal init` (no other flags) path that was
// silently shortcircuiting to printUsage instead of running the wizard.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = join(here, '..', '..', 'dist', 'cli.mjs');
const PKG_JSON = join(here, '..', '..', 'package.json');
const FIXTURE_NEXT = join(here, 'fixtures', 'next-app-router');

function runCli(
  args: readonly string[],
  opts: { cwd?: string } = {}
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync('node', [CLI_BIN, ...args], {
    cwd: opts.cwd ?? process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, STROMA_TELEMETRY: '0' }
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('CLI entry routing (dist/cli.mjs)', () => {
  // Skip these tests when the built CLI doesn't exist (e.g. running
  // tests before `pnpm build`). Local + CI both build before running
  // unit tests so this rarely fires.
  const cliExists = existsSync(CLI_BIN);

  if (!cliExists) {
    it.skip('dist/cli.mjs not built — skipping entry-routing tests', () => {});
    return;
  }

  it('bare `signal` (no args) prints usage', () => {
    const { status, stdout } = runCli([]);
    expect(status).toBe(0);
    expect(stdout).toContain('Stroma Signal CLI · signal init');
    expect(stdout).toContain('Usage:');
  });

  it('`signal --help` prints usage', () => {
    const { status, stdout } = runCli(['--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('Usage:');
  });

  it('`signal --version` prints version, NOT usage', () => {
    const { status, stdout } = runCli(['--version']);
    expect(status).toBe(0);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+/);
    expect(stdout).not.toContain('Usage:');
  });

  // B2 invariant: the CLI's --version output must match
  // packages/signal/package.json's version field. They cannot disagree
  // because both read from the same package.json (CLI via build-time
  // json import, this test via fs read).
  it('`signal --version` output equals packages/signal/package.json version (B2)', () => {
    const { stdout } = runCli(['--version']);
    const cliVersion = stdout.trim();
    const pkgVersion = (JSON.parse(readFileSync(PKG_JSON, 'utf8')) as { version: string }).version;
    expect(cliVersion).toBe(pkgVersion);
  });

  // M7: --no-clipboard removed for v1 (clipboard deferred to v0.2).
  // Reserved for re-introduction when clipboard ships, at which point
  // this test must be updated as a deliberate design decision.
  it('`signal --no-clipboard` is unrecognised in v1 (M7: deferred to v0.2)', () => {
    const { status, stderr } = runCli(['--no-clipboard']);
    expect(status).toBe(2);
    expect(stderr).toContain('Unknown argument: --no-clipboard');
  });

  // Regression test for the bug the user reported: bare `signal init`
  // was hitting the help-on-empty-args path because args.slice(1)
  // produced [] and the routing checked args.length === 0. Should
  // now RUN the wizard.
  it('REGRESSION: `signal init` (no other flags) RUNS the wizard, NOT prints help', () => {
    // --no-install is required so the wizard doesn't auto-install
    // @stroma-labs/signal into the fixture directory (Pattern 2 default
    // behaviour). Tests must opt out explicitly when they don't want
    // the side effect on the fixture.
    const { status, stdout, stderr } = runCli(['init', '--no-telemetry', '--no-install'], { cwd: FIXTURE_NEXT });
    // Combined output (pretty mode goes to stdout in non-json mode).
    const combined = stdout + stderr;
    // Wizard panel chrome should appear; usage should NOT.
    expect(status).toBe(0);
    expect(combined).toContain('Stroma Signal · signal init'); // intro panel title
    expect(combined).toContain('Detected'); // detection panel
    expect(combined).not.toContain('Options:'); // help block heading
  });

  it('`signal init --help` still prints help (explicit help wins over wizard)', () => {
    const { status, stdout } = runCli(['init', '--help']);
    expect(status).toBe(0);
    expect(stdout).toContain('Usage:');
  });

  it('`signal init --yes --json --skip-install-check` outputs JSON, not help', () => {
    const { status, stdout } = runCli([
      'init',
      '--yes',
      '--json',
      '--no-telemetry',
      '--skip-install-check',
      '--framework',
      'vanilla',
      '--sink',
      'dataLayer'
    ]);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.framework).toBe('vanilla');
    expect(parsed.outcome).toBe('completed');
  });

  it('unknown argument returns exit 2 + prints usage to stderr', () => {
    const { status, stderr } = runCli(['init', '--bogus-flag']);
    expect(status).toBe(2);
    expect(stderr).toContain('Unknown argument: --bogus-flag');
  });
});
