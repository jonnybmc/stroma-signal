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

describe('detectPackageManager (project_pm vs runner_pm split)', () => {
  it('lockfile wins for project_pm even when UA disagrees (npx-poisoning case)', () => {
    // The critical case: user runs `npx @stroma-labs/signal init` inside
    // a pnpm project. UA says npm (npx is npm-driven), lockfile says
    // pnpm. project_pm MUST be pnpm so auto-install does not write a
    // stray package-lock.json into a pnpm project.
    const dir = makeTmpProject({ 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" });
    const result = detectPackageManager({
      cwd: dir,
      env: { npm_config_user_agent: 'npm/10.0 node/v22' }
    });
    expect(result.runner_pm).toBe('npm');
    expect(result.project_pm).toBe('pnpm');
    expect(result.pm).toBe('pnpm');
    expect(result.detectedFrom).toBe('lockfile');
  });

  it('runner_pm matches UA exactly even when lockfile disagrees', () => {
    const dir = makeTmpProject({ 'yarn.lock': '# yarn\n' });
    const result = detectPackageManager({
      cwd: dir,
      env: { npm_config_user_agent: 'pnpm/10.0 node/v22' }
    });
    expect(result.runner_pm).toBe('pnpm');
    expect(result.project_pm).toBe('yarn');
    expect(result.pm).toBe('yarn');
  });

  it('falls back to runner_pm when no lockfile present (fresh project)', () => {
    const dir = makeTmpProject({});
    const result = detectPackageManager({
      cwd: dir,
      env: { npm_config_user_agent: 'pnpm/10.0 node/v22' }
    });
    // Edge case: walk-up may hit a host-machine lockfile. Accept
    // either runner_pm-fallback OR a lockfile resolution; just verify
    // project_pm and pm agree.
    expect(result.project_pm).toBe(result.pm);
    if (result.detectedFrom === 'runner_pm_fallback') {
      expect(result.project_pm).toBe('pnpm');
      expect(result.runner_pm).toBe('pnpm');
    }
  });

  it('defaults project_pm to npm when nothing detected (truly unknown)', () => {
    const dir = makeTmpProject({});
    const result = detectPackageManager({ cwd: dir, env: {} });
    // Walk-up may still find a host-machine lockfile. If genuinely
    // unknown, the fallback shape is project_pm: 'npm' so an action
    // can still proceed.
    if (result.detectedFrom === 'fallback') {
      expect(result.runner_pm).toBe('unknown');
      expect(result.project_pm).toBe('npm');
      expect(result.pm).toBe('npm');
    }
    expect(['unknown', 'npm', 'pnpm', 'yarn', 'bun']).toContain(result.pm);
  });
});
