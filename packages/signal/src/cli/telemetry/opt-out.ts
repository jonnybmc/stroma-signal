// Telemetry opt-out resolution. Priority order (first match wins):
//   1. --no-telemetry flag                 → 'flag'
//   2. STROMA_TELEMETRY=0 env var          → 'env_stroma_telemetry'
//   3. DO_NOT_TRACK=1 env var              → 'env_do_not_track'
//   4. Non-TTY environment (CI / pipe)     → 'non_tty_or_ci'
//   5. Persisted config file (XDG-aware)   → 'persisted_config'
//   6. First-ever interactive run          → 'default_on'
//
// Critical invariant (P2-12): when telemetry is disabled by ANY of (1)-(5),
// ZERO requests leave the machine — including install_started. The
// emit queue is constructed with `enabled: false` and every enqueue()
// becomes a hard no-op.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { TtyEnv } from '../util/tty.js';

export type TelemetryOptOutReason =
  | 'flag'
  | 'env_stroma_telemetry'
  | 'env_do_not_track'
  | 'non_tty_or_ci'
  | 'persisted_config'
  | 'default_on';

export interface TelemetryDecision {
  enabled: boolean;
  reason: TelemetryOptOutReason;
}

export interface DisclosureConfig {
  schema_version: number;
  telemetry: boolean;
  last_disclosure_version: string;
  decided_at: string;
}

const DISCLOSURE_SCHEMA_VERSION = 1;

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
    // Corrupt config — fall through to first-run disclosure.
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
}

export function resolveOptOut(deps: ResolveOptOutDeps): TelemetryDecision {
  const env = deps.env ?? process.env;
  const platform = deps.platform ?? process.platform;

  // 1. Explicit flag.
  if (deps.noTelemetryFlag) return { enabled: false, reason: 'flag' };

  // 2. STROMA_TELEMETRY env.
  if (env.STROMA_TELEMETRY === '0' || env.STROMA_TELEMETRY === 'false') {
    return { enabled: false, reason: 'env_stroma_telemetry' };
  }

  // 3. DO_NOT_TRACK industry-standard signal.
  if (env.DO_NOT_TRACK === '1' || env.DO_NOT_TRACK === 'true') {
    return { enabled: false, reason: 'env_do_not_track' };
  }

  // 4. Non-TTY / CI auto-disable. A CI runner cannot meaningfully
  //    consent to a prompt that won't render, so we silently disable.
  if (deps.ttyEnv.isCi || !deps.ttyEnv.isStdoutTty || !deps.ttyEnv.isStdinTty) {
    return { enabled: false, reason: 'non_tty_or_ci' };
  }

  // 5. Persisted config.
  const reader = deps.configReader ?? (() => readDisclosureConfig(env, platform));
  const config = reader();
  if (config) {
    return { enabled: config.telemetry, reason: 'persisted_config' };
  }

  // 6. Default ON for first-ever interactive run. (The actual disclosure
  //    panel + persistence happens in the wizard flow before the first
  //    enqueue — see Phase D.3 wiring.)
  return { enabled: true, reason: 'default_on' };
}
