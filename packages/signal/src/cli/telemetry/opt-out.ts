// Telemetry opt-out resolution. Returns a discriminated union so the
// wizard can branch on `kind` instead of inferring intent from a flat
// `enabled: boolean`. Eight inputs collapse into three result kinds:
//
//   disabled         — no prompt, no telemetry. Hard no-op everywhere.
//   enabled          — no prompt, telemetry flows.
//   needs_disclosure — render the disclosure panel + prompt BEFORE any
//                      enqueue. Two sub-reasons: 'first_run' (no
//                      persisted config) and 'stale_disclosure'
//                      (persisted consent under an older disclosure
//                      version — re-prompt to confirm under current
//                      capture/never-capture lists).
//
// State table (priority top→bottom, first match wins):
//
//   --no-telemetry flag                            → disabled / flag
//   STROMA_TELEMETRY=0                             → disabled / env_stroma_telemetry
//   DO_NOT_TRACK=1                                 → disabled / env_do_not_track
//   Non-TTY / CI                                   → disabled / non_tty_or_ci
//   Persisted telemetry: false                     → disabled / persisted_config
//   Persisted telemetry: true + version current    → enabled  / persisted_config
//   Persisted telemetry: true + version stale      → needs_disclosure / stale_disclosure
//   No persisted config                            → needs_disclosure / first_run
//
// P2-12 invariant: when telemetry is disabled, ZERO requests leave the
// machine. The wizard constructs the queue with `enabled: false` and
// every enqueue() is a hard no-op.
//
// `needs_disclosure` invariant: the wizard MUST NOT construct the
// queue (and MUST NOT enqueue any event) until the user has answered
// the disclosure prompt. If the user aborts at the prompt, ZERO
// events are emitted — consent never happened.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { TtyEnv } from '../util/tty.js';

export type TelemetryOptOutReason =
  | 'flag'
  | 'env_stroma_telemetry'
  | 'env_do_not_track'
  | 'non_tty_or_ci'
  | 'persisted_config';

export type DisclosureNeedReason = 'first_run' | 'stale_disclosure';

export type TelemetryDecision =
  | { kind: 'disabled'; reason: TelemetryOptOutReason }
  | { kind: 'enabled'; reason: TelemetryOptOutReason }
  | { kind: 'needs_disclosure'; reason: DisclosureNeedReason };

export interface DisclosureConfig {
  schema_version: number;
  telemetry: boolean;
  last_disclosure_version: string;
  decided_at: string;
}

const DISCLOSURE_SCHEMA_VERSION = 1;

/**
 * Current disclosure version. Bump this whenever the capture /
 * never-capture lists change OR the disclosure panel copy materially
 * shifts. A bump triggers a re-prompt for everyone with persisted
 * consent under the prior version. Format: 'YYYY-MM-DD' so version
 * comparison is a simple string equality (no semver math needed).
 */
export const DISCLOSURE_VERSION = '2026-05-02';

/** Resolve XDG-aware config file path with platform-specific fallback. */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32' && env.APPDATA) {
    return join(env.APPDATA, 'stroma', 'cli-config.json');
  }
  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, 'stroma', 'cli-config.json');
  }
  const home = homedir();
  // Linux convention: ~/.config/stroma/cli-config.json
  // Fallback (~/.stroma/cli-config.json) preserved when ~/.config doesn't exist.
  const xdgDefault = join(home, '.config', 'stroma', 'cli-config.json');
  return xdgDefault;
}

export function readDisclosureConfig(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): DisclosureConfig | null {
  const path = resolveConfigPath(env, platform);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DisclosureConfig>;
    if (typeof parsed.schema_version !== 'number') return null;
    if (typeof parsed.telemetry !== 'boolean') return null;
    return {
      schema_version: parsed.schema_version,
      telemetry: parsed.telemetry,
      last_disclosure_version: parsed.last_disclosure_version ?? '',
      decided_at: parsed.decided_at ?? ''
    };
  } catch {
    // Corrupt config — treat as if no config (re-prompt as first_run).
    return null;
  }
}

export function writeDisclosureConfig(
  decision: { telemetry: boolean; disclosure_version: string },
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): void {
  const path = resolveConfigPath(env, platform);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const config: DisclosureConfig = {
    schema_version: DISCLOSURE_SCHEMA_VERSION,
    telemetry: decision.telemetry,
    last_disclosure_version: decision.disclosure_version,
    decided_at: new Date().toISOString()
  };
  writeFileSync(path, JSON.stringify(config, null, 2));
}

export interface ResolveOptOutDeps {
  noTelemetryFlag: boolean;
  ttyEnv: TtyEnv;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  /** Optional override for tests — skips file I/O. */
  configReader?: () => DisclosureConfig | null;
  /** Optional override for tests — defaults to the module-level
   *  DISCLOSURE_VERSION constant. */
  currentDisclosureVersion?: string;
}

export function resolveOptOut(deps: ResolveOptOutDeps): TelemetryDecision {
  const env = deps.env ?? process.env;
  const platform = deps.platform ?? process.platform;
  const currentVersion = deps.currentDisclosureVersion ?? DISCLOSURE_VERSION;

  // 1. Explicit flag.
  if (deps.noTelemetryFlag) return { kind: 'disabled', reason: 'flag' };

  // 2. STROMA_TELEMETRY env.
  if (env.STROMA_TELEMETRY === '0' || env.STROMA_TELEMETRY === 'false') {
    return { kind: 'disabled', reason: 'env_stroma_telemetry' };
  }

  // 3. DO_NOT_TRACK industry-standard signal.
  if (env.DO_NOT_TRACK === '1' || env.DO_NOT_TRACK === 'true') {
    return { kind: 'disabled', reason: 'env_do_not_track' };
  }

  // 4. Non-TTY / CI auto-disable. A CI runner cannot meaningfully
  //    consent to a prompt that won't render, so we silently disable.
  if (deps.ttyEnv.isCi || !deps.ttyEnv.isStdoutTty || !deps.ttyEnv.isStdinTty) {
    return { kind: 'disabled', reason: 'non_tty_or_ci' };
  }

  // 5. Persisted config.
  const reader = deps.configReader ?? (() => readDisclosureConfig(env, platform));
  const config = reader();
  if (config) {
    if (!config.telemetry) {
      return { kind: 'disabled', reason: 'persisted_config' };
    }
    // Persisted enabled — but only honour without re-prompt when the
    // disclosure version is current. A version bump means the
    // capture/never-capture lists have changed since the user last
    // consented, so we re-prompt.
    if (config.last_disclosure_version === currentVersion) {
      return { kind: 'enabled', reason: 'persisted_config' };
    }
    return { kind: 'needs_disclosure', reason: 'stale_disclosure' };
  }

  // 6. No persisted config — first-ever interactive run. The wizard
  //    must render the disclosure panel + prompt before constructing
  //    the queue. Aborting at the prompt emits zero telemetry.
  return { kind: 'needs_disclosure', reason: 'first_run' };
}
