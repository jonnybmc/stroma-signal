// Detect the user's package manager. Used to:
//   1. Generate the correct Step 0 install command in the wizard
//      (e.g. `pnpm add @stroma-labs/signal` vs `npm install ...`)
//   2. Stamp the install_event telemetry with the detected pkg-mgr so
//      the framework-prioritisation review can weight by pm distribution
//
// Detection priority:
//   1. npm_config_user_agent env var (set by all four pkg-mgrs when they
//      invoke npx — most reliable signal)
//   2. Lockfile presence (walks up to handle monorepo cases): pnpm-lock
//      → bun.lock → yarn.lock → package-lock.json
//   3. 'unknown' if nothing matches

import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export interface PackageManagerDetection {
  pm: PackageManager;
  /** Explanation of which signal won — useful for --verbose output. */
  detectedFrom: 'npm_config_user_agent' | 'lockfile' | 'fallback';
}

const LOCKFILE_TO_PM: Array<readonly [string, PackageManager]> = [
  // Order matters — first match wins. pnpm-lock.yaml is checked before
  // yarn.lock because pnpm projects sometimes have a stale yarn.lock
  // from migration but the active pm is pnpm.
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm']
];

export function parseUserAgentPm(ua: string | undefined): PackageManager | null {
  if (!ua) return null;
  // Format: "<pm>/<version> npm/<v> node/<v> ..." (all four pkg-mgrs use
  // this convention when invoking npx).
  const first = ua.split(' ')[0] ?? '';
  const name = first.split('/')[0]?.toLowerCase();
  if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') return name;
  return null;
}

export function detectPackageManagerFromLockfile(startDir: string): PackageManager | null {
  let current = startDir;
  const root = parse(current).root;
  while (true) {
    for (const [lockfile, pm] of LOCKFILE_TO_PM) {
      if (existsSync(join(current, lockfile))) return pm;
    }
    if (current === root) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function detectPackageManager(opts: { cwd: string; env?: NodeJS.ProcessEnv }): PackageManagerDetection {
  const env = opts.env ?? process.env;
  const fromUa = parseUserAgentPm(env.npm_config_user_agent);
  if (fromUa) return { pm: fromUa, detectedFrom: 'npm_config_user_agent' };

  const fromLock = detectPackageManagerFromLockfile(opts.cwd);
  if (fromLock) return { pm: fromLock, detectedFrom: 'lockfile' };

  return { pm: 'unknown', detectedFrom: 'fallback' };
}
