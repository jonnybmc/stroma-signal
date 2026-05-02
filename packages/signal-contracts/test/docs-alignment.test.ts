import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_MIN_LCP_COVERAGE,
  SIGNAL_MIN_RACE_OBSERVATIONS
} from '../src/index.js';

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

  describe('canonical package name consistency (legacy-name guard)', () => {
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

// ----------------------------------------------------------------------
// Sweep B — code-snippet validity. Every TypeScript / JavaScript snippet
// in a doc must use real public exports. A snippet that imports a
// renamed or non-existent function is exactly the kind of friction that
// burns an integrator's first hour with the SDK.
// ----------------------------------------------------------------------

// Public export surface per subpath. Sourced from packages/signal/src/.
// Update these sets when the public API changes; any drift in a doc
// snippet against this set will fail the test below.
const PUBLIC_EXPORTS: Record<string, ReadonlySet<string>> = {
  '@stroma-labs/signal': new Set([
    // Functions
    'init',
    'destroy',
    'createBeaconSink',
    'createCallbackSink',
    // Constants re-exported from contracts
    'SIGNAL_BUILDER_BASE_URL',
    'SIGNAL_EVENT_VERSION',
    'SIGNAL_GA4_EVENT_NAME',
    'SIGNAL_PREVIEW_MINIMUM_SAMPLE',
    'SIGNAL_REPORT_BASE_URL',
    // Types
    'SignalAggregateV1',
    'SignalComparisonTier',
    'SignalDeviceTier',
    'SignalEventV1',
    'SignalInpAttribution',
    'SignalInteractionType',
    'SignalLcpAttribution',
    'SignalLcpElementType',
    'SignalLoadState',
    'SignalNavigationType',
    'SignalNetTcpSource',
    'SignalNetworkTier',
    'SignalNetworkTierThresholds',
    'SignalRaceMetric',
    'SignalReportUrlResult',
    'SignalSink',
    'SignalWarehouseRowV1',
    'SignalInitConfig',
    'SignalRuntimeController',
    'SignalRuntimeLogger',
    'BeaconSinkOptions',
    'CallbackSinkOptions'
  ]),
  '@stroma-labs/signal/ga4': new Set(['createDataLayerSink', 'DataLayerSinkOptions']),
  '@stroma-labs/signal/report': new Set(['createPreviewCollector', 'PreviewCollectorOptions', 'PreviewCollector']),
  '@stroma-labs/signal/summary': new Set([
    'exportSignalAggregateToJSON',
    'exportSignalEventsToCSV',
    'exportSignalEventsToJSON',
    'formatSignalSummary'
  ])
};

// Match fenced code blocks with a TypeScript-family language tag.
const TS_CODE_BLOCK_PATTERN = /```(?:ts|tsx|typescript|js|jsx|javascript)\n([\s\S]*?)```/g;
// Match `import { A, B as C, type D } from 'X'` — handles `type` modifier
// on individual specifiers and renamed-imports (`A as B`).
const IMPORT_PATTERN = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

interface ParsedImport {
  source: string;
  named: string[];
}

function extractImports(snippet: string): ParsedImport[] {
  const imports: ParsedImport[] = [];
  for (const match of snippet.matchAll(IMPORT_PATTERN)) {
    const inside = match[1];
    const source = match[2];
    const named = inside
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
      .map((token) => {
        // Strip leading `type` modifier on individual specifier.
        const stripped = token.replace(/^type\s+/, '');
        // Handle `A as B` — the original export name is on the left.
        const asMatch = stripped.match(/^(\w+)\s+as\s+\w+$/);
        return asMatch ? asMatch[1] : stripped;
      });
    imports.push({ source, named });
  }
  return imports;
}

describe('docs alignment — sweep B (code-snippet validity)', () => {
  describe('every TypeScript import in doc snippets resolves to a real public export', () => {
    for (const docName of TARGET_DOCS) {
      it(`${docName} TS code-block imports use real exports`, () => {
        const doc = readDoc(docName);
        const codeBlocks = [...doc.matchAll(TS_CODE_BLOCK_PATTERN)].map((match) => match[1]);
        const violations: string[] = [];

        for (const block of codeBlocks) {
          const imports = extractImports(block);
          for (const { source, named } of imports) {
            // Only audit @stroma-labs/signal imports; third-party imports
            // (e.g. React, vite-plugin) are out of scope.
            if (!source.startsWith('@stroma-labs/signal')) continue;

            const exportSet = PUBLIC_EXPORTS[source];
            if (!exportSet) {
              violations.push(`unknown subpath: '${source}'`);
              continue;
            }
            for (const name of named) {
              if (!exportSet.has(name)) {
                violations.push(`'${name}' not exported from '${source}'`);
              }
            }
          }
        }

        expect(violations, `Drift in docs/${docName} snippets: ${violations.join(' | ')}`).toEqual([]);
      });
    }
  });

  describe('npm/pnpm install commands reference the canonical package', () => {
    // Catches install snippets like `npm install @stroma/signal` (wrong
    // scope) or stale package names. The canonical install paths are:
    //   pnpm add @stroma-labs/signal[@next]
    //   npm install @stroma-labs/signal[@next]
    //   yarn add @stroma-labs/signal[@next]
    const INSTALL_LINE_PATTERN = /(?:pnpm add|npm install|yarn add)\s+(@?[\w@/.-]+)/g;

    for (const docName of TARGET_DOCS) {
      it(`${docName} install commands use @stroma-labs/signal (with optional @next or version)`, () => {
        const doc = readDoc(docName);
        const matches = [...doc.matchAll(INSTALL_LINE_PATTERN)];
        const wrong: string[] = [];
        for (const match of matches) {
          const target = match[1];
          // Strip any version / dist-tag suffix so we compare the bare
          // package name. Acceptable: '@stroma-labs/signal',
          // '@stroma-labs/signal@next', '@stroma-labs/signal@0.1.0-rc.3'.
          const bareName = target.split('@').slice(0, 2).join('@'); // keeps the leading @scope/name
          if (bareName !== '@stroma-labs/signal') {
            wrong.push(target);
          }
        }
        expect(wrong, `Non-canonical install targets in docs/${docName}: ${wrong.join(', ')}`).toEqual([]);
      });
    }
  });
});

// ----------------------------------------------------------------------
// Sweep C — semantic alignment. Numbers, enum values, and behaviour
// claims in the docs must match the canonical implementation. The
// previous sweeps catch lexical drift; this catches "the doc says
// FCP poor is > 3000ms" against the actual SIGNAL_FUNNEL_FCP_POOR_THRESHOLD.
// ----------------------------------------------------------------------

const NETWORK_TIERS = ['urban', 'moderate', 'constrained_moderate', 'constrained'] as const;
const DEVICE_TIERS = ['low', 'mid', 'high'] as const;
const RACE_FALLBACK_REASONS = [
  'lcp_coverage_below_threshold',
  'fcp_unavailable',
  'insufficient_comparable_data'
] as const;

// Field names that have been renamed or dropped. If a doc mentions any
// of these as a backticked field reference, that's stale documentation.
// `nav_type` is the canonical example — replaced by `navigation_type`.
// New stale names get added here as the contract evolves.
const STALE_FIELD_NAMES = ['nav_type'];

describe('docs alignment — sweep C (semantic alignment)', () => {
  describe('poor-performance thresholds match canonical constants', () => {
    // Where a doc cites a poor-performance threshold inline (e.g. "FCP
    // poor: > 3000ms"), the number must match the SIGNAL_FUNNEL_*_THRESHOLD
    // constant. Catches drift like "FCP poor at 2500ms" written against an
    // older threshold.
    const THRESHOLD_PATTERNS: Array<{ label: string; pattern: RegExp; canonical: number }> = [
      {
        label: 'FCP poor threshold',
        pattern: /FCP\s*(?:poor|>\s*|threshold[^:]*:\s*)[^\n]{0,40}?(\d{3,5})\s*ms/i,
        canonical: SIGNAL_FUNNEL_FCP_POOR_THRESHOLD
      },
      {
        label: 'LCP poor threshold',
        pattern: /LCP\s*(?:poor|>\s*|threshold[^:]*:\s*)[^\n]{0,40}?(\d{3,5})\s*ms/i,
        canonical: SIGNAL_FUNNEL_LCP_POOR_THRESHOLD
      },
      {
        label: 'INP poor threshold',
        pattern: /INP\s*(?:poor|>\s*|threshold[^:]*:\s*)[^\n]{0,40}?(\d{3,4})\s*ms/i,
        canonical: SIGNAL_FUNNEL_INP_POOR_THRESHOLD
      }
    ];

    for (const docName of TARGET_DOCS) {
      it(`${docName} cites FCP / LCP / INP poor thresholds correctly when they appear`, () => {
        const doc = readDoc(docName);
        const drift: string[] = [];
        for (const { label, pattern, canonical } of THRESHOLD_PATTERNS) {
          for (const match of doc.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
            const value = Number(match[1]);
            if (value !== canonical) {
              drift.push(`${label}: doc says ${value}ms, canonical is ${canonical}ms`);
            }
          }
        }
        expect(drift, `Threshold drift in docs/${docName}: ${drift.join(' | ')}`).toEqual([]);
      });
    }
  });

  describe('coverage / observation thresholds match canonical constants', () => {
    for (const docName of TARGET_DOCS) {
      it(`${docName} cites the LCP coverage and race observation minimums correctly when they appear`, () => {
        const doc = readDoc(docName);
        const drift: string[] = [];

        // "LCP coverage" cited as a percentage. SIGNAL_MIN_LCP_COVERAGE = 50.
        // Be lenient about phrasing: "LCP coverage <= 50%", "below 50% LCP coverage", etc.
        for (const match of doc.matchAll(/LCP coverage[^.\n]{0,40}?(\d{1,3})\s*%/gi)) {
          const value = Number(match[1]);
          if (value !== SIGNAL_MIN_LCP_COVERAGE) {
            drift.push(`LCP coverage threshold: doc says ${value}%, canonical is ${SIGNAL_MIN_LCP_COVERAGE}%`);
          }
        }

        // Per-tier minimum observations for a defensible race. Canonical 25.
        // Match patterns like "minimum 25 observations", "at least 25 observations",
        // "25-observation floor", etc. — but don't match arbitrary "25" mentions.
        for (const match of doc.matchAll(
          /(?:minimum|at least|>=)\s*(\d{2,3})\s+(?:observations?|race observations?)/gi
        )) {
          const value = Number(match[1]);
          if (value !== SIGNAL_MIN_RACE_OBSERVATIONS) {
            drift.push(`Race observations minimum: doc says ${value}, canonical is ${SIGNAL_MIN_RACE_OBSERVATIONS}`);
          }
        }

        expect(drift, `Threshold drift in docs/${docName}: ${drift.join(' | ')}`).toEqual([]);
      });
    }
  });

  describe('network and device tier names match the canonical unions', () => {
    // Where a doc enumerates the tier values, every named tier must be
    // in the canonical union. Catches drift like "constrained_high"
    // (never existed) or "moderate_constrained" (transposed words).
    const NETWORK_TIER_SET = new Set<string>(NETWORK_TIERS);
    const DEVICE_TIER_SET = new Set<string>(DEVICE_TIERS);

    // Conservative: match phrases that look like tier enumerations, e.g.
    // "urban, moderate, constrained_moderate, constrained" or
    // "high / mid / low". Inline backticked single-tier mentions like
    // `urban` are noise; we look for the multi-value enumeration shape.
    const NETWORK_ENUM_PATTERN =
      /\b(urban|moderate|constrained_moderate|constrained|constrained_high|moderate_constrained)\b\s*[,/|]\s*\b(urban|moderate|constrained_moderate|constrained|constrained_high|moderate_constrained)\b/gi;
    const DEVICE_ENUM_PATTERN = /\b(low|mid|high|medium)\b\s*[,/|]\s*\b(low|mid|high|medium)\b/gi;

    for (const docName of TARGET_DOCS) {
      it(`${docName} uses canonical tier names if it enumerates them`, () => {
        const doc = readDoc(docName);
        const drift: string[] = [];

        for (const match of doc.matchAll(NETWORK_ENUM_PATTERN)) {
          for (let i = 1; i <= 2; i++) {
            const value = match[i].toLowerCase();
            if (!NETWORK_TIER_SET.has(value)) {
              drift.push(`network tier "${value}" is not canonical (allowed: ${[...NETWORK_TIERS].join(', ')})`);
            }
          }
        }

        for (const match of doc.matchAll(DEVICE_ENUM_PATTERN)) {
          for (let i = 1; i <= 2; i++) {
            const value = match[i].toLowerCase();
            if (!DEVICE_TIER_SET.has(value)) {
              drift.push(`device tier "${value}" is not canonical (allowed: ${[...DEVICE_TIERS].join(', ')})`);
            }
          }
        }

        // De-dupe before assertion so a repeated enumeration doesn't spam the message.
        expect([...new Set(drift)], `Tier-name drift in docs/${docName}: ${drift.join(' | ')}`).toEqual([]);
      });
    }
  });

  describe('race fallback reason taxonomy matches the canonical union', () => {
    // The race fallback reason union is closed: lcp_coverage_below_threshold,
    // fcp_unavailable, insufficient_comparable_data. Where a doc mentions
    // a fallback reason as a backticked enum value, it must be in the
    // canonical set.
    const REASON_SET = new Set<string>(RACE_FALLBACK_REASONS);
    // Match `\`some_snake_case_value\`` that LOOKS like a fallback reason.
    // Heuristic: contains any of the canonical substrings. Reduces false
    // positives from unrelated snake_case identifiers.
    const REASON_HEURISTIC = /`(\w*(?:lcp|fcp|ttfb|coverage|fallback|comparable|insufficient)\w*)`/gi;

    for (const docName of TARGET_DOCS) {
      it(`${docName} uses canonical race fallback reason names`, () => {
        const doc = readDoc(docName);
        const drift: string[] = [];
        for (const match of doc.matchAll(REASON_HEURISTIC)) {
          const value = match[1];
          // Only complain if the value LOOKS like a fallback-reason identifier
          // (snake_case that ends with the typical suffixes) but isn't canonical.
          if (/^[a-z_]+_(?:threshold|unavailable|data)$/.test(value) && !REASON_SET.has(value)) {
            drift.push(
              `fallback reason "${value}" is not canonical (allowed: ${[...RACE_FALLBACK_REASONS].join(', ')})`
            );
          }
        }
        expect(drift, `Fallback-reason drift in docs/${docName}: ${drift.join(' | ')}`).toEqual([]);
      });
    }
  });

  describe('stale field-name guard', () => {
    // Explicit allowlist of field names that have been renamed or dropped.
    // Any backticked occurrence of one of these in a doc is stale.
    for (const docName of TARGET_DOCS) {
      it(`${docName} does not reference renamed/dropped field names`, () => {
        const doc = readDoc(docName);
        const hits: string[] = [];
        for (const stale of STALE_FIELD_NAMES) {
          // Match as a backticked identifier: `nav_type`, `meta.nav_type`,
          // `\`nav_type\` was`. Don't match substrings of unrelated words.
          const pattern = new RegExp(`\`(?:[a-z_.]*\\.)?${stale}\``, 'g');
          if (pattern.test(doc)) {
            hits.push(stale);
          }
        }
        expect(hits, `Stale field references in docs/${docName}: ${hits.join(', ')}`).toEqual([]);
      });
    }
  });

  describe('GA4 dist-tag guidance is consistent', () => {
    // The README and CHANGELOG both establish that pre-release versions
    // publish to the `next` dist-tag. Docs that show install commands
    // should either use `@next` explicitly OR not pin a tag (interpreted
    // as `latest`, which is what casual `npm install` resolves to). The
    // wrong shape is `@beta` / `@rc` / `@experimental` — none are real
    // dist-tags for this package.
    const FORBIDDEN_DIST_TAGS = ['@beta', '@rc', '@experimental', '@canary', '@preview'];

    for (const docName of TARGET_DOCS) {
      it(`${docName} only uses real dist-tags (next or unpinned) in install commands`, () => {
        const doc = readDoc(docName);
        const hits: string[] = [];
        for (const tag of FORBIDDEN_DIST_TAGS) {
          // Match `@stroma-labs/signal@beta` etc. specifically.
          const pattern = new RegExp(`@stroma-labs/signal${tag.replace('@', '@')}\\b`);
          if (pattern.test(doc)) {
            hits.push(`${tag} is not a real dist-tag for @stroma-labs/signal`);
          }
        }
        expect(hits, `Wrong dist-tag in docs/${docName}: ${hits.join(' | ')}`).toEqual([]);
      });
    }
  });
});
