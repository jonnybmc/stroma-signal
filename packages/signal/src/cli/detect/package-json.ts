// Safe package.json reader. Walks up from the target CWD looking for the
// nearest package.json (handles monorepos where the user runs from a
// subdirectory). Returns null if no package.json is found anywhere up
// the tree — caller falls back to vanilla framework detection per the
// "missing package.json should be friendly fallback, not error"
// invariant from P1-12.
//
// Also detects monorepo workspace markers (pnpm-workspace.yaml,
// lerna.json, nx.json, turbo.json, OR a `workspaces` field in the root
// package.json) and returns the workspace-root path separately so the
// detection layer can surface "in apps/web · monorepo" style context.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

export interface PackageJsonShape {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: unknown;
  packageManager?: string;
}

export interface PackageJsonReadResult {
  /** Absolute path to the package.json that was loaded, or null when
   *  no package.json was found walking up from cwd. */
  path: string | null;
  /** The directory containing that package.json (CWD candidate). */
  dir: string | null;
  /** Parsed package.json contents — null when no file was found OR when
   *  the file existed but was unparseable JSON. */
  pkg: PackageJsonShape | null;
  /** True when we encountered a corrupt package.json (vs. simply not
   *  found). Lets the caller emit a friendly error. */
  corrupt: boolean;
}

const WORKSPACE_MARKERS = ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json'] as const;

export interface MonorepoInfo {
  isMonorepo: boolean;
  workspaceRoot: string | null;
  /** Reason we believe this is a monorepo. */
  detectedFrom: string | null;
}

/** Walk up from `start` looking for the first directory containing a
 *  package.json. Returns null when we reach the filesystem root without
 *  finding one. */
export function findNearestPackageJson(start: string): string | null {
  let current = start;
  const root = parse(current).root;
  while (true) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // Inaccessible — keep walking.
      }
    }
    if (current === root) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function readPackageJson(cwd: string): PackageJsonReadResult {
  const path = findNearestPackageJson(cwd);
  if (!path) {
    return { path: null, dir: null, pkg: null, corrupt: false };
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { path, dir: dirname(path), pkg: null, corrupt: true };
  }
  let parsed: PackageJsonShape;
  try {
    parsed = JSON.parse(raw) as PackageJsonShape;
  } catch {
    return { path, dir: dirname(path), pkg: null, corrupt: true };
  }
  return { path, dir: dirname(path), pkg: parsed, corrupt: false };
}

/** Detect monorepo by walking up from `cwd` looking for workspace markers
 *  OR a root package.json with a `workspaces` field. Returns the
 *  workspace root path (the dir holding the marker) when found. */
export function detectMonorepo(cwd: string): MonorepoInfo {
  let current = cwd;
  const root = parse(current).root;
  while (true) {
    for (const marker of WORKSPACE_MARKERS) {
      if (existsSync(join(current, marker))) {
        return { isMonorepo: true, workspaceRoot: current, detectedFrom: marker };
      }
    }
    // Check for `workspaces` field in package.json at this level.
    const pkgPath = join(current, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJsonShape;
        if (pkg.workspaces !== undefined) {
          return {
            isMonorepo: true,
            workspaceRoot: current,
            detectedFrom: 'package.json#workspaces'
          };
        }
      } catch {
        // Corrupt or unreadable — keep walking.
      }
    }
    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return { isMonorepo: false, workspaceRoot: null, detectedFrom: null };
}

/** All deps merged across dependencies + devDependencies + peerDeps —
 *  for "is this dep present" checks we don't care which bucket. */
export function mergedDeps(pkg: PackageJsonShape): Record<string, string> {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {})
  };
}
