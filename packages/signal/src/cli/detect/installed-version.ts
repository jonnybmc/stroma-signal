// Read the actually-installed @stroma-labs/signal version from
// node_modules — distinct from the dependency SPEC in package.json
// (which gives e.g. `^0.1.0-rc.3`, not the resolved version on disk).
//
// Used by telemetry's `installed_signal_version` field so the snapshot
// engine sees the real installed version, not the spec range. Falls
// back to null when the package isn't installed yet (Step 0 path) so
// the caller can substitute the dep-spec or null.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MAX_WALK_DEPTH = 8;

/**
 * Walk up from `cwd` looking for `node_modules/@stroma-labs/signal/package.json`.
 * Matches the walk-up semantics of `readPackageJson` in `detect/package-json.ts`
 * so a workspace root with hoisted node_modules is found from a nested
 * package directory.
 *
 * Returns the resolved `version` string if found; null otherwise.
 */
export function readInstalledSignalVersion(cwd: string): string | null {
  let current = cwd;
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth += 1) {
    const candidate = join(current, 'node_modules', '@stroma-labs', 'signal', 'package.json');
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw) as { version?: unknown };
        if (typeof parsed.version === 'string' && parsed.version.length > 0) {
          return parsed.version;
        }
        return null;
      } catch {
        return null;
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}
