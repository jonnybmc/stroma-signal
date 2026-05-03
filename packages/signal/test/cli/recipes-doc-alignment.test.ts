// Recipe-doc alignment gate (P1-21 — partial).
//
// The full plan called for a generator (matrix.ts → framework-
// recipes.md) with a byte-equal CI assertion. This test is the
// pragmatic v1: every framework in the SNIPPET_MATRIX must have a
// corresponding section in docs/framework-recipes.md, AND the
// recipe-currency-data.json's verified_against_version + last_verified_at
// must appear at the doc's top so reviewers can see currency at a
// glance. Catches the core risk (matrix entry without doc coverage)
// without requiring a full generator (which would need to reproduce
// every editorial nuance in the manually-curated doc — a separate
// maintenance burden).
//
// A future PR can replace this with the byte-equal generator if the
// editorial-vs-generated tension proves problematic in practice.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_FRAMEWORKS_IN_MATRIX } from '../../src/cli/snippets/matrix.js';
import { RECIPE_CURRENCY as recipeCurrency } from '../../src/cli/snippets/recipe-currency-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const RECIPES_DOC_PATH = path.resolve(here, '../../../../docs/framework-recipes.md');
const recipesDoc = fs.readFileSync(RECIPES_DOC_PATH, 'utf8');

// Map matrix framework ids to the section labels the doc uses (case-
// insensitive substring match — keeps the doc free to vary header
// phrasing while still guaranteeing every framework has coverage).
const FRAMEWORK_DOC_LABEL: Record<string, string> = {
  'next-app-router': 'Next.js App Router',
  'next-pages-router': 'Next.js Pages Router',
  'react-router-v7': 'React Router v7',
  'remix-v2': 'Remix v2',
  nuxt: 'Nuxt',
  sveltekit: 'SvelteKit',
  'plain-vue': 'Plain Vue',
  'plain-svelte': 'Plain Svelte',
  'plain-react': 'Plain React',
  'angular-standalone': 'Standalone',
  'angular-ngmodule': 'NgModule',
  vanilla: 'Vanilla'
};

describe('framework-recipes.md alignment with snippet matrix', () => {
  for (const framework of SUPPORTED_FRAMEWORKS_IN_MATRIX) {
    const label = FRAMEWORK_DOC_LABEL[framework];
    it(`docs/framework-recipes.md references ${framework} (label: "${label}")`, () => {
      expect(label, `${framework} missing from FRAMEWORK_DOC_LABEL — update this test`).toBeDefined();
      expect(
        recipesDoc.toLowerCase(),
        `docs/framework-recipes.md does not mention "${label}" — matrix entry ${framework} has no doc coverage`
      ).toContain((label ?? '').toLowerCase());
    });
  }

  it('docs/framework-recipes.md surfaces the recipe-currency last-verified date', () => {
    expect(recipesDoc).toContain(recipeCurrency.last_full_sweep_at);
  });

  it('docs/framework-recipes.md cross-references the wizard as the primary install path', () => {
    expect(recipesDoc).toMatch(/npx\s+@stroma-labs\/signal/i);
    expect(recipesDoc).toMatch(/init/);
  });

  it('docs/framework-recipes.md cross-references the recipe-currency-sweep doc', () => {
    expect(recipesDoc).toContain('RECIPE-CURRENCY-SWEEP.md');
  });

  it('docs/framework-recipes.md cites the high-drift framework upstream sources verbatim', () => {
    // The HIGH-DRIFT recipes (per Phase C0 audit) MUST cite their
    // upstream source so reviewers can verify the recipe against
    // current docs at a glance. Lower-drift recipes (Nuxt, Vue, Vite,
    // vanilla) get a softer treatment — the citation is in
    // recipe-currency-data.json but not required in the inline doc.
    const HIGH_DRIFT_HOSTNAMES = [
      'nextjs.org', // P2-4: Client Component vs side-effect import
      'reactrouter.com', // C0: distinct from Remix v2
      'svelte.dev' // C0: Svelte 5 runes vs Svelte 4 reactive
    ];
    for (const hostname of HIGH_DRIFT_HOSTNAMES) {
      expect(
        recipesDoc,
        `docs/framework-recipes.md does not reference ${hostname} (high-drift recipe missing upstream-source citation)`
      ).toContain(hostname);
    }
  });
});
