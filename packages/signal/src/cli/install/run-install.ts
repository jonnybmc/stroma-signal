// Spawn wrapper for the project package manager's "add this dep" command.
//
// Why a dedicated module:
//   - Keeps the wizard's run() function free of child_process boilerplate.
//   - DI-injectable via RunDeps so tests can swap a fake without
//     vi.mock'ing node:child_process.
//   - Single source of truth for the per-PM argv (used by both the
//     spawn path and the --no-install prelude that prints the same
//     command for the user to run by hand).

import { type SpawnOptions, spawn } from 'node:child_process';

import type { PackageManager } from '../detect/package-manager.js';

export interface RunInstallOptions {
  /** Project package manager (NEVER runner_pm under npx). */
  pm: PackageManager;
  /** Pinned spec, e.g. `@stroma-labs/signal@0.1.0-rc.5`. Always pinned
   *  to the running CLI version so the wizard's snippets cannot drift
   *  from the runtime SDK that gets installed. */
  spec: string;
  /** Directory containing the target package.json. MUST be the
   *  resolved package dir (pkgResult.dir from readPackageJson), NOT
   *  args.cwd — they differ in monorepos and nested src/ layouts. */
  cwd: string;
  /** When true, the PM's stdout/stderr are CAPTURED to a buffer
   *  (returned only on failure) so the wizard's --json mode can keep
   *  its stdout pure JSON. When false, PM output is streamed through
   *  via stdio:'inherit' so the user sees the install transparently. */
  jsonMode: boolean;
}

export type RunInstallResult = { ok: true } | { ok: false; exitCode: number; stderr: string };

/** Maximum captured stderr the wizard will surface in failure JSON.
 *  Prevents log floods from a runaway PM filling the response body. */
export const RUN_INSTALL_STDERR_CAP_BYTES = 4 * 1024;

/** Per-PM argv for "add this package as a dependency". `unknown`
 *  defaults to npm — the most-permissive choice that won't conflict
 *  with another PM's lockfile (because there isn't one). */
export function buildInstallArgv(pm: PackageManager, spec: string): [string, string[]] {
  switch (pm) {
    case 'pnpm':
      return ['pnpm', ['add', spec]];
    case 'yarn':
      return ['yarn', ['add', spec]];
    case 'bun':
      return ['bun', ['add', spec]];
    default:
      // npm + unknown
      return ['npm', ['install', spec, '--save']];
  }
}

/** Pretty-printable form of the same argv (for --no-install prelude
 *  + manual-fallback messaging on install failure). */
export function buildInstallCommandString(pm: PackageManager, spec: string): string {
  const [cmd, args] = buildInstallArgv(pm, spec);
  return [cmd, ...args].join(' ');
}

export async function runInstallSignal(opts: RunInstallOptions): Promise<RunInstallResult> {
  const [command, args] = buildInstallArgv(opts.pm, opts.spec);
  const spawnOptions: SpawnOptions = {
    cwd: opts.cwd,
    // jsonMode → capture; pretty mode → stream. shell:false so we don't
    // pay a shell-parse round-trip + reduce injection surface.
    stdio: opts.jsonMode ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    shell: false
  };

  return await new Promise<RunInstallResult>((resolve) => {
    const child = spawn(command, args, spawnOptions);
    let stderrBuf = '';

    if (opts.jsonMode && child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        if (stderrBuf.length < RUN_INSTALL_STDERR_CAP_BYTES) {
          stderrBuf += chunk;
          if (stderrBuf.length > RUN_INSTALL_STDERR_CAP_BYTES) {
            stderrBuf = stderrBuf.slice(0, RUN_INSTALL_STDERR_CAP_BYTES);
          }
        }
      });
    }

    child.on('error', (err) => {
      // ENOENT = the PM binary isn't on PATH. Surface as a real
      // failure with the system error message.
      resolve({ ok: false, exitCode: -1, stderr: err.message });
    });

    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, exitCode: code ?? -1, stderr: stderrBuf });
    });
  });
}
