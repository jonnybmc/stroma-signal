import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../');
const docsDir = path.join(repoRoot, 'docs');

// The 12 docs surfaced under the README's "Where to go next" section. These
// are the docs pilots and developers land on first, so drift here costs
// real onboarding friction. Keep this list synchronised with the README.
const TARGET_DOCS = [
  'marketer-quickstart.md',
  'production-report-automation.md',
  'launch-troubleshooting.md',
  'client-integrations.md',
  'framework-recipes.md',
  'spa-ssr-caveats.md',
  'gtm-recipe.md',
  'public-api-v0.1.md',
  'signal-technical-reference.md',
  'aggregation-spec.md',
  'tier-report-design-spec.md',
  'why-signal.md'
] as const;

function readDoc(fileName: string): string {
  return fs.readFileSync(path.join(docsDir, fileName), 'utf8');
}

// Markdown link shape: [label](./target) or [label](../target).
// Excludes absolute URLs (http://, https://) and anchor-only links (#section).
const RELATIVE_MD_LINK_PATTERN = /\]\((\.{1,2}\/[^)#]+)(?:#[^)]*)?\)/g;

function extractRelativeLinks(doc: string): string[] {
  return [...doc.matchAll(RELATIVE_MD_LINK_PATTERN)].map((match) => match[1]);
}

describe('docs alignment — sweep A (mechanical drift)', () => {
  describe('relative links resolve to real files', () => {
    for (const docName of TARGET_DOCS) {
      it(`every ./*.md, ./*.sql, ./*.json link in ${docName} resolves`, () => {
        const doc = readDoc(docName);
        const links = extractRelativeLinks(doc);
        const broken: string[] = [];
        for (const link of links) {
          const absolute = path.resolve(docsDir, link);
          if (!fs.existsSync(absolute)) {
            broken.push(link);
          }
        }
        expect(broken, `Broken relative links in docs/${docName}: ${broken.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('no retrospective narration markers', () => {
    // Retrospective markers explain "what used to be wrong" or reference
    // internal planning artifacts. They don't help anyone reading today.
    // Patterns: PR-N, Iteration N, §N.X plan-doc references, version
    // markers that frame fields as "removed in 0.1.x".
    const RETROSPECTIVE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
      { name: 'PR-N marker', pattern: /\bPR-\d+\b/ },
      { name: 'Iteration N marker', pattern: /\bIteration \d+\b/ },
      { name: 'plan-doc § reference', pattern: /§\d+(\.\d+)?/ },
      { name: 'removed in 0.1.x retrospective', pattern: /removed in 0\.1\.x/i },
      { name: '0.1.x scaffolding marker', pattern: /0\.1\.x scaffolding/i },
      { name: 'Free-tier 0.1.x prefix', pattern: /Free-tier 0\.1\.x/ }
    ];

    for (const docName of TARGET_DOCS) {
      it(`${docName} has no retrospective narration markers`, () => {
        const doc = readDoc(docName);
        const hits: string[] = [];
        for (const { name, pattern } of RETROSPECTIVE_PATTERNS) {
          const match = doc.match(pattern);
          if (match) hits.push(`${name}: "${match[0]}"`);
        }
        expect(hits, `Retrospective markers in docs/${docName}: ${hits.join(' | ')}`).toEqual([]);
      });
    }
  });

  describe('brand naming consistency', () => {
    // The product is "Signal". The wordmark and stroma.design site carry
    // the company identity. Inline "Signal by Stroma" / "Stroma Signal"
    // compounds product + company in the product name and is forbidden.
    const FORBIDDEN_BRAND_FORMS = ['Signal by Stroma', 'Stroma Signal'];

    for (const docName of TARGET_DOCS) {
      it(`${docName} uses "Signal" as the product name (no compound forms)`, () => {
        const doc = readDoc(docName);
        const hits = FORBIDDEN_BRAND_FORMS.filter((form) => doc.includes(form));
        expect(hits, `Forbidden brand compounds in docs/${docName}: ${hits.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('no paid-tier (Performance Intelligence) leakage', () => {
    // These docs are public-tree. They must not name the paid product or
    // any of its schema-specific terms — those live in the private
    // companion repo only. Paid-product naming on the rendered /r artifact
    // (Act 4 offer card) was deliberately replaced with a single optional
    // Rapid Fix Plan CTA; docs should match that boundary.
    const FORBIDDEN_PI_TERMS = [
      'Performance Intelligence',
      'account_actions',
      'conversion_reconciliation',
      'substrate_attributable_zar',
      'rand_at_stake',
      '@stroma-labs/signal-pi'
    ];

    for (const docName of TARGET_DOCS) {
      it(`${docName} has no paid-tier (PI) terms`, () => {
        const doc = readDoc(docName);
        const hits = FORBIDDEN_PI_TERMS.filter((term) => doc.includes(term));
        expect(hits, `Paid-tier leakage in docs/${docName}: ${hits.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('canonical event name consistency', () => {
    // `perf_tier_report` is the frozen event name. Anywhere a doc names
    // the GTM/GA4 event, it must be exactly this string. Catches drift
    // like `perf_report` / `signal_report` / capitalisation slips.
    const EVENT_NAME = 'perf_tier_report';
    // Docs that meaningfully discuss the GTM/GA4 event.
    const DOCS_THAT_MENTION_THE_EVENT = [
      'marketer-quickstart.md',
      'gtm-recipe.md',
      'public-api-v0.1.md',
      'signal-technical-reference.md',
      'client-integrations.md'
    ];

    for (const docName of DOCS_THAT_MENTION_THE_EVENT) {
      it(`${docName} uses the canonical "${EVENT_NAME}" event name`, () => {
        const doc = readDoc(docName);
        expect(doc, `${docName} should reference ${EVENT_NAME}`).toContain(EVENT_NAME);
        // Catch near-miss spellings.
        const nearMisses = [/\bperf_report\b/, /\bsignal_report\b/, /\btier_report\b/, /\bperf_tier\b(?!_report)/];
        const hits = nearMisses.filter((p) => p.test(doc)).map((p) => p.source);
        expect(hits, `Near-miss event-name spellings in docs/${docName}: ${hits.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('canonical package name consistency', () => {
    // `@stroma-labs/signal` is the published npm package. Subpaths are
    // `/ga4`, `/report`, `/summary`. Catches drift like `@stroma/signal`
    // or `@stroma-labs/signal-sdk`.
    const CANONICAL_PACKAGE_PATTERNS = [
      /@stroma-labs\/signal\b/,
      /@stroma-labs\/signal\/ga4\b/,
      /@stroma-labs\/signal\/report\b/,
      /@stroma-labs\/signal\/summary\b/
    ];
    const FORBIDDEN_PACKAGE_PATTERNS = [
      { pattern: /@stroma\/signal\b/, name: '@stroma/signal (wrong scope)' },
      { pattern: /@stroma-labs\/signal-sdk\b/, name: '@stroma-labs/signal-sdk (legacy name)' },
      { pattern: /@stroma\/perf-tiers\b/, name: '@stroma/perf-tiers (legacy name)' }
    ];

    for (const docName of TARGET_DOCS) {
      it(`${docName} uses canonical package paths only`, () => {
        const doc = readDoc(docName);
        const forbiddenHits = FORBIDDEN_PACKAGE_PATTERNS.filter(({ pattern }) => pattern.test(doc)).map(
          ({ name }) => name
        );
        expect(forbiddenHits, `Forbidden package names in docs/${docName}: ${forbiddenHits.join(', ')}`).toEqual([]);
        // If the doc references any signal package import, it should match
        // one of the canonical patterns.
        const hasAnyImport = /@stroma-labs\/signal/.test(doc);
        if (hasAnyImport) {
          const hasCanonical = CANONICAL_PACKAGE_PATTERNS.some((pattern) => pattern.test(doc));
          expect(hasCanonical, `${docName} references @stroma-labs/signal but no canonical subpath matches`).toBe(true);
        }
      });
    }
  });
});
