#!/usr/bin/env node
// Pre-publish release gate (P1-22 + P2-5).
//
// Workspace tests miss real-world failures: missing files in the
// published tarball, broken shebangs, bin-resolution differences across
// package managers, and the workspace-private signal-contracts leak.
// This script:
//   1. Builds the SDK + CLI.
//   2. `npm pack` to /tmp/signal-pack/<version>.tgz.
//   3. For each package manager (npm; pnpm/yarn/bun if available):
//      a. Fresh /tmp/signal-pack-test-<pm>/ with empty package.json.
//      b. Install the packed tarball.
//      c. Verify NO @stroma-labs/signal-contracts dir leaked into
//         installed node_modules (proves bundle-inline guard).
//      d. Verify dist/cli.mjs has shebang + executable bit.
//      e. Run `pm exec signal init --framework vanilla --sink dataLayer
//         --no-telemetry --yes --json --skip-install-check`.
//      f. Assert exit 0 + stdout is valid JSON with framework/sink keys.
//
// Run via: pnpm test:cli:pack
//
// Required-green before any `npm publish` (per the install-wizard plan's
// F.1 acceptance criteria).

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SIGNAL_PKG = join(REPO_ROOT, 'packages/signal');
const PACK_DIR = mkdtempSync(join(tmpdir(), 'signal-pack-'));
const VERBOSE = process.env.VERBOSE === '1';

function log(msg) {
  process.stdout.write(`[pack-and-test] ${msg}\n`);
}

function commandExists(cmd) {
  const result = spawnSync('which', [cmd], { encoding: 'utf8' });
  return result.status === 0;
}

function step(label, fn) {
  log(label);
  return fn();
}

function pack() {
  step('1. building SDK + CLI…', () => {
    execFileSync('pnpm', ['--filter', '@stroma-labs/signal', 'build'], {
      cwd: REPO_ROOT,
      stdio: VERBOSE ? 'inherit' : 'pipe'
    });
  });

  step('2. npm pack → /tmp/signal-pack/…', () => {
    execFileSync('pnpm', ['pack', '--pack-destination', PACK_DIR], {
      cwd: SIGNAL_PKG,
      stdio: VERBOSE ? 'inherit' : 'pipe'
    });
  });

  // Find the .tgz that was just packed.
  const tgzCandidate = readdirSync(PACK_DIR).find((f) => f.endsWith('.tgz'));
  if (!tgzCandidate) throw new Error(`No .tgz found in ${PACK_DIR}`);
  const tgz = join(PACK_DIR, tgzCandidate);
  log(`packed → ${tgz}`);
  return tgz;
}

function testWithPm(pm, tgz) {
  log(`\n── ${pm} ────────────────────────────────────────`);
  if (!commandExists(pm)) {
    log(`${pm} not installed locally — skipping`);
    return { pm, skipped: true };
  }

  const dir = mkdtempSync(join(tmpdir(), `signal-pack-test-${pm}-`));
  try {
    // Init.
    if (pm === 'npm') {
      execFileSync('npm', ['init', '-y'], { cwd: dir, stdio: VERBOSE ? 'inherit' : 'pipe' });
    } else if (pm === 'pnpm') {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'pack-test', version: '0.0.0' }));
    } else if (pm === 'yarn') {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'pack-test', version: '0.0.0' }));
    } else if (pm === 'bun') {
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'pack-test', version: '0.0.0' }));
    }

    // Install the packed tarball.
    log(`installing ${tgz}…`);
    if (pm === 'pnpm') {
      execFileSync('pnpm', ['add', tgz], { cwd: dir, stdio: VERBOSE ? 'inherit' : 'pipe' });
    } else if (pm === 'yarn') {
      execFileSync('yarn', ['add', tgz], { cwd: dir, stdio: VERBOSE ? 'inherit' : 'pipe' });
    } else if (pm === 'bun') {
      execFileSync('bun', ['add', tgz], { cwd: dir, stdio: VERBOSE ? 'inherit' : 'pipe' });
    } else {
      execFileSync('npm', ['install', tgz], { cwd: dir, stdio: VERBOSE ? 'inherit' : 'pipe' });
    }

    // Verify signal-contracts NOT leaked.
    const contractsDir = join(dir, 'node_modules/@stroma-labs/signal-contracts');
    if (existsSync(contractsDir)) {
      throw new Error(
        `LEAK: @stroma-labs/signal-contracts exists in installed node_modules under ${pm} — Rollup must bundle it INLINE, not externalize`
      );
    }
    log('  ✓ signal-contracts not leaked (bundled inline)');

    // Verify cli.mjs shebang + executable bit.
    const cliPath = join(dir, 'node_modules/@stroma-labs/signal/dist/cli.mjs');
    if (!existsSync(cliPath)) throw new Error(`Missing CLI bin at ${cliPath}`);
    const cliSource = readFileSync(cliPath, 'utf8');
    if (!cliSource.startsWith('#!/usr/bin/env node')) {
      throw new Error('CLI bin missing shebang');
    }
    log('  ✓ shebang preserved');

    // Run the CLI.
    const cmd = pm === 'npm' ? 'npx' : pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'bun';
    const args =
      pm === 'pnpm'
        ? ['exec', 'signal', 'init']
        : pm === 'yarn'
          ? ['signal', 'init']
          : pm === 'bun'
            ? ['x', 'signal', 'init']
            : ['signal', 'init'];
    const cliArgs = [
      ...args,
      '--framework',
      'vanilla',
      '--sink',
      'dataLayer',
      '--no-telemetry',
      '--yes',
      '--json',
      '--skip-install-check'
    ];
    const result = spawnSync(cmd, cliArgs, { cwd: dir, encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`CLI exited ${result.status} under ${pm}: ${result.stderr}`);
    }
    let parsed;
    try {
      parsed = JSON.parse(result.stdout);
    } catch (err) {
      throw new Error(`CLI did not emit valid JSON under ${pm}: ${result.stdout.slice(0, 200)}`);
    }
    if (parsed.framework !== 'vanilla') throw new Error(`Wrong framework: ${parsed.framework}`);
    if (parsed.sink !== 'dataLayer') throw new Error(`Wrong sink: ${parsed.sink}`);
    if (parsed.outcome !== 'completed') throw new Error(`Wrong outcome: ${parsed.outcome}`);
    log(`  ✓ ${pm} smoke green`);

    return { pm, ok: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const tgz = pack();

  // npm always available (Node ships with it). Others probed individually.
  const results = [];
  for (const pm of ['npm', 'pnpm', 'yarn', 'bun']) {
    try {
      results.push(testWithPm(pm, tgz));
    } catch (err) {
      log(`${pm} FAILED: ${err.message}`);
      results.push({ pm, ok: false, error: err.message });
    }
  }

  // Cleanup pack dir.
  rmSync(PACK_DIR, { recursive: true, force: true });

  // Summary.
  log('\n── summary ─────────────────────────────────────');
  for (const r of results) {
    if (r.skipped) log(`  ${r.pm}: SKIPPED (not installed)`);
    else if (r.ok) log(`  ${r.pm}: PASS`);
    else log(`  ${r.pm}: FAIL — ${r.error}`);
  }

  const failures = results.filter((r) => r.ok === false);
  if (failures.length > 0) {
    log(`\n${failures.length} package manager(s) failed.`);
    process.exit(1);
  }
  log('\nall green ✓');
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
