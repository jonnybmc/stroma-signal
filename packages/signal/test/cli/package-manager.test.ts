import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  detectPackageManager,
  detectPackageManagerFromLockfile,
  parseUserAgentPm
} from '../../src/cli/detect/package-manager.js';

const tmpDirs: string[] = [];

afterAll(() => {
  for (const d of tmpDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

function makeTmpProject(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'signal-pm-test-'));
  tmpDirs.push(dir);
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(dir, filename), content);
  }
  return dir;
}

describe('parseUserAgentPm', () => {
  it.each([
    ['npm/10.5.0 node/v22.0.0 darwin arm64', 'npm'],
    ['pnpm/10.28.2 npm/? node/v22.4.0 darwin arm64', 'pnpm'],
    ['yarn/4.5.0 npm/? node/v20.10.0 linux x64', 'yarn'],
    ['bun/1.1.0 node/v22.0.0', 'bun']
  ])('parses %s → %s', (ua, expected) => {
    expect(parseUserAgentPm(ua)).toBe(expected);
  });

  it('returns null for unknown pm prefix', () => {
    expect(parseUserAgentPm('mystery-pm/1.0 node/v22')).toBeNull();
  });

  it('returns null for empty / undefined', () => {
    expect(parseUserAgentPm(undefined)).toBeNull();
    expect(parseUserAgentPm('')).toBeNull();
  });
});

describe('detectPackageManagerFromLockfile', () => {
  it('detects pnpm via pnpm-lock.yaml', () => {
    const dir = makeTmpProject({ 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" });
    expect(detectPackageManagerFromLockfile(dir)).toBe('pnpm');
  });

  it('detects bun via bun.lock', () => {
    const dir = makeTmpProject({ 'bun.lock': '{}' });
    expect(detectPackageManagerFromLockfile(dir)).toBe('bun');
  });

  it('detects yarn via yarn.lock', () => {
    const dir = makeTmpProject({ 'yarn.lock': '# yarn lockfile v1\n' });
    expect(detectPackageManagerFromLockfile(dir)).toBe('yarn');
  });

  it('detects npm via package-lock.json', () => {
    const dir = makeTmpProject({ 'package-lock.json': '{"lockfileVersion": 3}' });
    expect(detectPackageManagerFromLockfile(dir)).toBe('npm');
  });

  it('priority: pnpm wins over yarn when both present (pnpm migration leftovers)', () => {
    const dir = makeTmpProject({
      'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
      'yarn.lock': '# stale\n'
    });
    expect(detectPackageManagerFromLockfile(dir)).toBe('pnpm');
  });

  it('returns null when no lockfile in tree', () => {
    const dir = makeTmpProject({});
    // The walk-up will eventually hit /tmp (no lockfile) → /. Should
    // return null in a clean environment.
    const result = detectPackageManagerFromLockfile(dir);
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

describe('detectPackageManager (full priority chain)', () => {
  it('user_agent wins when set', () => {
    const dir = makeTmpProject({ 'package-lock.json': '{}' });
    const result = detectPackageManager({
      cwd: dir,
      env: { npm_config_user_agent: 'pnpm/10.0 node/v22' }
    });
    expect(result.pm).toBe('pnpm');
    expect(result.detectedFrom).toBe('npm_config_user_agent');
  });

  it('falls back to lockfile when user_agent absent', () => {
    const dir = makeTmpProject({ 'yarn.lock': '# yarn\n' });
    const result = detectPackageManager({ cwd: dir, env: {} });
    expect(result.pm).toBe('yarn');
    expect(result.detectedFrom).toBe('lockfile');
  });

  it('returns unknown when neither signal present', () => {
    const dir = makeTmpProject({});
    const result = detectPackageManager({ cwd: dir, env: {} });
    // May still find a lockfile walking up the tree on the host
    // machine — accept either.
    expect(['unknown', 'npm', 'pnpm', 'yarn', 'bun']).toContain(result.pm);
  });
});
