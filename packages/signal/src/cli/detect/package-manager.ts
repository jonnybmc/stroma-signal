// Detect the user's package manager.
//
// Two distinct concepts are returned, and the difference matters:
//
//   - runner_pm: the PM that INVOKED the CLI (read from
//     `npm_config_user_agent`). Useful for telemetry only — it tells us
//     whether the user typed `npx`, `pnpm dlx`, `yarn dlx`, or `bunx`.
//   - project_pm: the PM that OWNS the project's lockfile. This is the
//     ONLY safe signal for actions that touch the project (auto-install
//     of @stroma-labs/signal): writing a `package-lock.json` to a pnpm
//     project would corrupt its lockfile contract.
//
// Why split: under `npx ...`, npm sets the user-agent to `npm/...`
// regardless of the project's actual PM. Trusting UA for install
// actions in a pnpm/yarn/bun project would create stray lockfiles.

import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export interface PackageManagerDetection {
  /** PM that invoked the CLI (UA-based). Telemetry-only. */
  runner_pm: PackageManager;
  /** PM that owns the project's lockfile. SAFE for actions that mutate
   *  package.json / node_modules. Falls back to runner_pm when no
   *  lockfile is detected, then 'npm' if that's also unknown — the
   *  most-permissive default that won't conflict with any other PM's
   *  lockfile because none exists. */
  project_pm: PackageManager;
  /** Convenience alias of project_pm — what every action site should
   *  use. Kept on the type so callers don't accidentally read runner_pm
   *  thinking it's safe for installs. */
  pm: PackageManager;
  /** Which signal resolved project_pm. */
  detectedFrom: 'lockfile' | 'runner_pm_fallback' | 'fallback';
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
  const runner_pm = parseUserAgentPm(env.npm_config_user_agent) ?? 'unknown';

  const fromLock = detectPackageManagerFromLockfile(opts.cwd);
  if (fromLock) {
    return { runner_pm, project_pm: fromLock, pm: fromLock, detectedFrom: 'lockfile' };
  }

  // No lockfile — the project hasn't picked a PM yet (fresh `npm init`
  // / `pnpm init` with no install yet). Trust the runner_pm here
  // because there's no lockfile to corrupt; the user is implicitly
  // choosing the runner for their first install.
  if (runner_pm !== 'unknown') {
    return { runner_pm, project_pm: runner_pm, pm: runner_pm, detectedFrom: 'runner_pm_fallback' };
  }

  // Truly unknown — neither UA nor lockfile gave a signal. Default to
  // npm for action; warn at the call site.
  return { runner_pm: 'unknown', project_pm: 'npm', pm: 'npm', detectedFrom: 'fallback' };
}
