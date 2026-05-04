// Unit tests for `readInstalledSignalVersion` (M3 launch-fix).
//
// The wizard's `installed_signal_version` telemetry field reports the
// actually-installed version of @stroma-labs/signal — distinct from the
// dep-spec range in package.json (which is what the original
// implementation accidentally surfaced). This helper walks up from cwd
// looking for `node_modules/@stroma-labs/signal/package.json` and
// returns its `.version` field; null when the package isn't installed.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readInstalledSignalVersion } from '../../src/cli/detect/installed-version.js';

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'signal-installed-ver-'));
}

function writeInstalledSignalPkg(rootDir: string, version: string): void {
  const target = join(rootDir, 'node_modules', '@stroma-labs', 'signal');
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'package.json'), JSON.stringify({ name: '@stroma-labs/signal', version }));
}

describe('readInstalledSignalVersion', () => {
  it('returns the resolved version when @stroma-labs/signal is in cwd/node_modules', () => {
    const dir = makeTmpDir();
    writeInstalledSignalPkg(dir, '0.1.0-rc.3');
    expect(readInstalledSignalVersion(dir)).toBe('0.1.0-rc.3');
  });

  it('walks up to a parent directory when node_modules is hoisted', () => {
    const root = makeTmpDir();
    writeInstalledSignalPkg(root, '0.2.0');
    const nested = join(root, 'apps', 'web');
    mkdirSync(nested, { recursive: true });
    expect(readInstalledSignalVersion(nested)).toBe('0.2.0');
  });

  it('returns null when @stroma-labs/signal is not installed anywhere up the tree', () => {
    const dir = makeTmpDir();
    expect(readInstalledSignalVersion(dir)).toBeNull();
  });

  it('returns null when the installed package.json is missing the version field', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'node_modules', '@stroma-labs', 'signal');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: '@stroma-labs/signal' }));
    expect(readInstalledSignalVersion(dir)).toBeNull();
  });

  it('returns null when the installed package.json is corrupt JSON', () => {
    const dir = makeTmpDir();
    const target = join(dir, 'node_modules', '@stroma-labs', 'signal');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'package.json'), '{ not valid json');
    expect(readInstalledSignalVersion(dir)).toBeNull();
  });

  it('prefers the closest node_modules when the package exists at multiple depths', () => {
    const root = makeTmpDir();
    writeInstalledSignalPkg(root, '0.1.0');
    const nested = join(root, 'apps', 'web');
    mkdirSync(nested, { recursive: true });
    writeInstalledSignalPkg(nested, '0.9.9-local');
    expect(readInstalledSignalVersion(nested)).toBe('0.9.9-local');
  });
});
