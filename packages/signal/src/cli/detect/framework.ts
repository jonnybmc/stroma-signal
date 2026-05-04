// Framework detection — feeds the wizard's auto-detect step.
//
// Returns a confidence-ranked list of FrameworkCandidate. The wizard
// promotes high-confidence candidates straight to a confirm prompt;
// medium / low / multi-high triggers a select prompt with the
// candidates as choices.
//
// Detection signals per framework — sourced from the verified-current
// canonical patterns documented in
// packages/signal/src/cli/snippets/recipe-currency-data.json (Phase
// C0). Update both files in lockstep on the quarterly recipe sweep.
//
// All detection is read-only — no shell commands, no node_modules
// resolution at module load. Reads only the user's CWD package.json
// and walks the filesystem looking for disambiguating directories.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { PackageJsonShape } from './package-json.js';
import { mergedDeps } from './package-json.js';

export type FrameworkId =
  | 'next-app-router'
  | 'next-pages-router'
  | 'react-router-v7'
  | 'remix-v2'
  | 'nuxt'
  | 'sveltekit'
  | 'plain-vue'
  | 'plain-svelte'
  | 'plain-react'
  | 'angular-standalone'
  | 'angular-ngmodule'
  | 'vanilla'
  | 'unknown';

export type FrameworkConfidence = 'high' | 'medium' | 'low';

export interface FrameworkCandidate {
  id: FrameworkId;
  /** Resolved spec range from package.json (caret/tilde stripped — caller
   *  resolves to installed/lockfile in a separate step). Null when the
   *  framework lives in vanilla / no-package-json case. */
  versionSpec: string | null;
  confidence: FrameworkConfidence;
  /** Human-readable evidence trail — surfaced via --verbose. */
  detectedFrom: string[];
}

const NEXT = 'next';
const REACT = 'react';
const REACT_DOM = 'react-dom';
const REACT_ROUTER = 'react-router';
const REMIX_REACT = '@remix-run/react';
const REMIX_DEV = '@remix-run/dev';
const NUXT = 'nuxt';
const SVELTEKIT = '@sveltejs/kit';
const SVELTE = 'svelte';
const VUE = 'vue';
const ANGULAR_CORE = '@angular/core';

/** Strip caret/tilde/range to return just the lower-bound version
 *  string. Used to surface "next@16.2.4" from "^16.2.4" in evidence. */
function stripRange(spec: string): string {
  return spec.replace(/^[\^~>=<]+\s*/, '').trim();
}

/** Detect React Router v7 framework mode. Disambiguating signal:
 *  react-router.config.ts OR app/entry.client.tsx exists. */
function isReactRouterFrameworkMode(dir: string): boolean {
  return (
    existsSync(join(dir, 'react-router.config.ts')) ||
    existsSync(join(dir, 'react-router.config.js')) ||
    existsSync(join(dir, 'app', 'entry.client.tsx')) ||
    existsSync(join(dir, 'app', 'entry.client.jsx'))
  );
}

function findInDeps(deps: Record<string, string>, name: string): string | null {
  return deps[name] ?? null;
}

export function detectFrameworks(opts: { pkg: PackageJsonShape; dir: string }): FrameworkCandidate[] {
  const { pkg, dir } = opts;
  const deps = mergedDeps(pkg);
  const candidates: FrameworkCandidate[] = [];

  // Next.js — disambiguated by app/ or pages/ directory.
  const nextSpec = findInDeps(deps, NEXT);
  if (nextSpec) {
    const hasAppDir = existsSync(join(dir, 'app'));
    const hasPagesDir = existsSync(join(dir, 'pages'));
    if (hasAppDir) {
      candidates.push({
        id: 'next-app-router',
        versionSpec: stripRange(nextSpec),
        confidence: 'high',
        detectedFrom: [`next@${stripRange(nextSpec)} in deps`, 'app/ directory exists']
      });
    } else if (hasPagesDir) {
      candidates.push({
        id: 'next-pages-router',
        versionSpec: stripRange(nextSpec),
        confidence: 'high',
        detectedFrom: [`next@${stripRange(nextSpec)} in deps`, 'pages/ directory exists']
      });
    } else {
      // Both missing — likely a fresh setup without source files yet.
      // Surface BOTH as medium-confidence candidates so the user picks.
      candidates.push({
        id: 'next-app-router',
        versionSpec: stripRange(nextSpec),
        confidence: 'medium',
        detectedFrom: [`next@${stripRange(nextSpec)} in deps`, 'no app/ or pages/ directory yet']
      });
      candidates.push({
        id: 'next-pages-router',
        versionSpec: stripRange(nextSpec),
        confidence: 'medium',
        detectedFrom: [`next@${stripRange(nextSpec)} in deps`, 'no app/ or pages/ directory yet']
      });
    }
  }

  // Remix v2.
  const remixReactSpec = findInDeps(deps, REMIX_REACT);
  const remixDevSpec = findInDeps(deps, REMIX_DEV);
  if (remixReactSpec || remixDevSpec) {
    const spec = remixReactSpec ?? remixDevSpec!;
    candidates.push({
      id: 'remix-v2',
      versionSpec: stripRange(spec),
      confidence: 'high',
      detectedFrom: [`${remixReactSpec ? REMIX_REACT : REMIX_DEV}@${stripRange(spec)} in deps`]
    });
  }

  // React Router v7 framework mode.
  const reactRouterSpec = findInDeps(deps, REACT_ROUTER);
  if (reactRouterSpec) {
    const stripped = stripRange(reactRouterSpec);
    const isV7Plus = /^[7-9]\.|^1\d\./.test(stripped);
    if (isV7Plus) {
      const isFrameworkMode = isReactRouterFrameworkMode(dir);
      candidates.push({
        id: 'react-router-v7',
        versionSpec: stripped,
        confidence: isFrameworkMode ? 'high' : 'medium',
        detectedFrom: [
          `react-router@${stripped} in deps`,
          isFrameworkMode
            ? 'react-router.config.ts OR app/entry.client.tsx exists'
            : 'no react-router.config.ts or app/entry.client.tsx — could be data-mode'
        ]
      });
    }
  }

  // Nuxt.
  const nuxtSpec = findInDeps(deps, NUXT);
  if (nuxtSpec) {
    candidates.push({
      id: 'nuxt',
      versionSpec: stripRange(nuxtSpec),
      confidence: 'high',
      detectedFrom: [`nuxt@${stripRange(nuxtSpec)} in deps`]
    });
  }

  // SvelteKit (must be checked before plain-svelte).
  const sveltekitSpec = findInDeps(deps, SVELTEKIT);
  const svelteSpec = findInDeps(deps, SVELTE);
  if (sveltekitSpec) {
    candidates.push({
      id: 'sveltekit',
      versionSpec: stripRange(sveltekitSpec),
      confidence: 'high',
      detectedFrom: [`@sveltejs/kit@${stripRange(sveltekitSpec)} in deps`]
    });
  } else if (svelteSpec) {
    candidates.push({
      id: 'plain-svelte',
      versionSpec: stripRange(svelteSpec),
      confidence: 'high',
      detectedFrom: [`svelte@${stripRange(svelteSpec)} in deps`, 'no @sveltejs/kit']
    });
  }

  // Vue (must be checked AFTER nuxt — nuxt projects also have vue).
  const vueSpec = findInDeps(deps, VUE);
  if (vueSpec && !nuxtSpec) {
    candidates.push({
      id: 'plain-vue',
      versionSpec: stripRange(vueSpec),
      confidence: 'high',
      detectedFrom: [`vue@${stripRange(vueSpec)} in deps`, 'no nuxt']
    });
  }

  // Angular — disambiguated by app.config.ts (standalone) vs AppModule.
  const angularSpec = findInDeps(deps, ANGULAR_CORE);
  if (angularSpec) {
    const hasAppConfig =
      existsSync(join(dir, 'src', 'app.config.ts')) ||
      existsSync(join(dir, 'app.config.ts')) ||
      existsSync(join(dir, 'src', 'app', 'app.config.ts'));
    const hasAppModule =
      existsSync(join(dir, 'src', 'app', 'app.module.ts')) || existsSync(join(dir, 'src', 'app', 'app-module.ts'));
    if (hasAppConfig && !hasAppModule) {
      candidates.push({
        id: 'angular-standalone',
        versionSpec: stripRange(angularSpec),
        confidence: 'high',
        detectedFrom: [`@angular/core@${stripRange(angularSpec)} in deps`, 'app.config.ts present, no AppModule']
      });
    } else if (hasAppModule) {
      candidates.push({
        id: 'angular-ngmodule',
        versionSpec: stripRange(angularSpec),
        confidence: hasAppConfig ? 'medium' : 'high',
        detectedFrom: [
          `@angular/core@${stripRange(angularSpec)} in deps`,
          'AppModule present (legacy ngmodule pattern)'
        ]
      });
    } else {
      // Angular dep present but no clear marker — assume standalone (the
      // default for new Angular projects since v17).
      candidates.push({
        id: 'angular-standalone',
        versionSpec: stripRange(angularSpec),
        confidence: 'medium',
        detectedFrom: [
          `@angular/core@${stripRange(angularSpec)} in deps`,
          'no app.config.ts or AppModule — assuming standalone (default since v17)'
        ]
      });
    }
  }

  // Plain React (Vite/CRA/etc.) — only when no Next + no Remix + no
  // React Router v7 framework + no other React-aware framework matched.
  const reactSpec = findInDeps(deps, REACT);
  const reactDomSpec = findInDeps(deps, REACT_DOM);
  if (
    reactSpec &&
    reactDomSpec &&
    !nextSpec &&
    !remixReactSpec &&
    !remixDevSpec &&
    !(reactRouterSpec && /^[7-9]\.|^1\d\./.test(stripRange(reactRouterSpec)))
  ) {
    candidates.push({
      id: 'plain-react',
      versionSpec: stripRange(reactSpec),
      confidence: 'high',
      detectedFrom: [`react@${stripRange(reactSpec)} + react-dom in deps`, 'no Next/Remix/RR7']
    });
  }

  // Vanilla fallback when nothing matched.
  if (candidates.length === 0) {
    candidates.push({
      id: 'vanilla',
      versionSpec: null,
      confidence: 'low',
      detectedFrom: ['no recognised framework deps in package.json']
    });
  }

  return candidates;
}

/** Detection result when no package.json was found anywhere in the tree.
 *  Per P1-12, this is a friendly fallback — the wizard prints the
 *  vanilla snippet, never errors. */
export function vanillaCandidate(): FrameworkCandidate {
  return {
    id: 'vanilla',
    versionSpec: null,
    confidence: 'low',
    detectedFrom: ['no package.json found walking up from cwd']
  };
}
