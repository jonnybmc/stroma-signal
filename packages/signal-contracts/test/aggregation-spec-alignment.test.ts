import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { classifyThirdPartyShareTier } from '../src/aggregation.js';
import {
  SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT,
  SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS,
  SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT,
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_MIN_LCP_COVERAGE,
  SIGNAL_MIN_RACE_OBSERVATIONS,
  SIGNAL_PREVIEW_MINIMUM_SAMPLE,
  SIGNAL_REPORT_URL_HARD_LIMIT_BYTES,
  SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES,
  SIGNAL_REPORT_URL_SOFT_LIMIT_WARNING,
  SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT
} from '../src/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../');
const docPath = path.join(repoRoot, 'docs/aggregation-spec.md');

const doc = fs.readFileSync(docPath, 'utf8');

// Every field on `SignalAggregateV1` (required + optional). The doc must
// reference each one by name so a future field add lands in both the
// type and the spec. Fields are listed as the doc would back-tick them.
const AGGREGATE_FIELDS = [
  'v',
  'rv',
  'mode',
  'generated_at',
  'domain',
  'sample_size',
  'classified_sample_size',
  'period_days',
  'network_distribution',
  'device_distribution',
  'comparison_tier',
  'race_metric',
  'race_fallback_reason',
  'coverage',
  'top_page_path',
  'warnings',
  'experience_funnel',
  'device_hardware',
  'network_signals',
  'environment',
  'form_factor_distribution',
  'lcp_story',
  'inp_story',
  'third_party_story',
  'loaf_story',
  'context_story',
  'navigation_timing_story'
] as const;

// Coverage subfields that the aggregator emits inside the `coverage` block.
const COVERAGE_SUBFIELDS = [
  'network_coverage',
  'unclassified_network_share',
  'connection_reuse_share',
  'lcp_coverage',
  'selected_metric_urban_coverage',
  'selected_metric_comparison_coverage',
  'raw_sample_size',
  'excluded_background_sessions'
] as const;

// Threshold constants the doc cites by name. Each (constant, expectedValue)
// must appear in the doc with the right number — drift in either direction
// fails fast.
const THRESHOLD_CONSTANTS: Array<{ name: string; value: number }> = [
  { name: 'SIGNAL_FUNNEL_FCP_POOR_THRESHOLD', value: SIGNAL_FUNNEL_FCP_POOR_THRESHOLD },
  { name: 'SIGNAL_FUNNEL_LCP_POOR_THRESHOLD', value: SIGNAL_FUNNEL_LCP_POOR_THRESHOLD },
  { name: 'SIGNAL_FUNNEL_INP_POOR_THRESHOLD', value: SIGNAL_FUNNEL_INP_POOR_THRESHOLD },
  { name: 'SIGNAL_MIN_LCP_COVERAGE', value: SIGNAL_MIN_LCP_COVERAGE },
  { name: 'SIGNAL_MIN_RACE_OBSERVATIONS', value: SIGNAL_MIN_RACE_OBSERVATIONS },
  { name: 'SIGNAL_PREVIEW_MINIMUM_SAMPLE', value: SIGNAL_PREVIEW_MINIMUM_SAMPLE },
  { name: 'SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT', value: SIGNAL_COVERAGE_MARGINAL_THRESHOLD_PCT },
  { name: 'SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS', value: SIGNAL_COVERAGE_MARGINAL_THRESHOLD_OBS },
  { name: 'SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT', value: SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT },
  { name: 'SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT', value: SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT },
  { name: 'SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES', value: SIGNAL_REPORT_URL_SOFT_LIMIT_BYTES },
  { name: 'SIGNAL_REPORT_URL_HARD_LIMIT_BYTES', value: SIGNAL_REPORT_URL_HARD_LIMIT_BYTES }
];

// Bucket boundaries the doc claims for the actionable signal blocks.
// Every bucket must appear backticked in the doc.
const CORES_BUCKETS = ['1', '2', '4', '6', '8', '12_plus'];
const MEMORY_BUCKETS = ['0_5', '1', '2', '4', '8_plus', 'unknown'];
const EFFECTIVE_TYPE_BUCKETS = ['slow_2g', '2g', '3g', '4g', 'unknown'];
const BROWSER_BUCKETS = ['chrome', 'safari', 'firefox', 'edge', 'other'];

// Race metric fallback reasons (closed union from SignalRaceFallbackReason).
const RACE_FALLBACK_REASONS = ['lcp_coverage_below_threshold', 'fcp_unavailable', 'insufficient_comparable_data'];

// Warning strings the aggregator can push onto `warnings[]`. The doc
// must enumerate them so renderers know what to handle.
const WARNING_STRINGS = [
  'Sample size below the recommended preview threshold.',
  'Act 2 cannot render a comparable race with the current data.',
  'coverage_marginal',
  SIGNAL_REPORT_URL_SOFT_LIMIT_WARNING
];

describe('aggregation-spec.md alignment with aggregation.ts + canonical types', () => {
  describe('every SignalAggregateV1 field is named in the spec', () => {
    for (const field of AGGREGATE_FIELDS) {
      it(`spec references \`${field}\``, () => {
        expect(doc).toContain(`\`${field}\``);
      });
    }
  });

  describe('every coverage subfield is named in the spec', () => {
    for (const field of COVERAGE_SUBFIELDS) {
      it(`spec references \`${field}\``, () => {
        expect(doc).toContain(`\`${field}\``);
      });
    }
  });

  describe('threshold constants cited in the spec match canonical values', () => {
    for (const { name, value } of THRESHOLD_CONSTANTS) {
      it(`\`${name}\` is cited with value ${value}`, () => {
        // Match `NAME = value` or `NAME` followed within ~80 chars by the value.
        const namePattern = new RegExp(`\`${name}\`\\s*=\\s*\`?${value}\`?`);
        const looseMatch = new RegExp(`${name}[^\\n]{0,80}\\b${value}\\b`);
        const matched = namePattern.test(doc) || looseMatch.test(doc);
        expect(matched, `${name} not found near value ${value} in spec`).toBe(true);
      });
    }
  });

  describe('actionable signal bucket boundaries match aggregation.ts', () => {
    it('cores_hist buckets match coresBucket()', () => {
      for (const bucket of CORES_BUCKETS) {
        expect(doc).toContain(`\`${bucket}\``);
      }
    });

    it('memory_gb_hist buckets match memoryBucket()', () => {
      for (const bucket of MEMORY_BUCKETS) {
        expect(doc).toContain(`\`${bucket}\``);
      }
    });

    it('effective_type_hist buckets match effectiveTypeBucket()', () => {
      for (const bucket of EFFECTIVE_TYPE_BUCKETS) {
        expect(doc).toContain(`\`${bucket}\``);
      }
    });

    it('browser_hist buckets match browserBucket()', () => {
      for (const bucket of BROWSER_BUCKETS) {
        expect(doc).toContain(`\`${bucket}\``);
      }
    });
  });

  describe('form-factor breakpoints match aggregation.ts', () => {
    it('mobile breakpoint is `device_screen_w < 768`', () => {
      expect(doc).toContain('device_screen_w < 768');
    });
    it('tablet range names 768 and 1280', () => {
      // Doc renders this as "768 ≤ device_screen_w < 1280" — accept either glyph.
      const has = /768\s*[≤<=]\s*device_screen_w\s*<\s*1280/.test(doc);
      expect(has, 'tablet breakpoint shape `768 ≤ device_screen_w < 1280` missing').toBe(true);
    });
    it('desktop breakpoint is `device_screen_w ≥ 1280`', () => {
      const has = /device_screen_w\s*[≥>=]\s*1280/.test(doc);
      expect(has, 'desktop breakpoint shape `device_screen_w ≥ 1280` missing').toBe(true);
    });
  });

  describe('race metric fallback reasons match SignalRaceFallbackReason union', () => {
    for (const reason of RACE_FALLBACK_REASONS) {
      it(`spec names "${reason}"`, () => {
        // Accept either standalone backticked (`reason`) or single-quoted
        // inside a backticked compound expression (`x = 'reason'`).
        const matched = doc.includes(`\`${reason}\``) || doc.includes(`'${reason}'`);
        expect(matched, `${reason} not found in spec (backticked or single-quoted)`).toBe(true);
      });
    }
  });

  describe('warnings enumeration matches deriveSignalAggregateWarnings + downstream', () => {
    for (const warning of WARNING_STRINGS) {
      it(`spec lists warning "${warning}"`, () => {
        expect(doc).toContain(warning);
      });
    }
  });

  describe('third-party share tier classification matches classifyThirdPartyShareTier', () => {
    // The spec table claims:
    //   share === 0   → 'none'
    //   0 < x <= 15   → 'light'
    //   15 < x <= 40  → 'moderate'
    //   x > 40        → 'heavy'
    // Verify behavior end-to-end against the canonical classifier so the
    // table can never silently drift from the code.
    const cases: Array<{ share: number | null; tier: 'none' | 'light' | 'moderate' | 'heavy' | null }> = [
      { share: 0, tier: 'none' },
      { share: 0.5, tier: 'light' },
      { share: 15, tier: 'light' },
      { share: 15.001, tier: 'moderate' },
      { share: 40, tier: 'moderate' },
      { share: 40.001, tier: 'heavy' },
      { share: 99, tier: 'heavy' },
      { share: -1, tier: null },
      { share: null, tier: null }
    ];
    for (const { share, tier } of cases) {
      it(`share=${share} classifies as ${tier}`, () => {
        expect(classifyThirdPartyShareTier(share)).toBe(tier);
      });
    }

    it('tier names from the spec table are present', () => {
      for (const tier of ['none', 'light', 'moderate', 'heavy']) {
        expect(doc).toContain(`\`${tier}\``);
      }
    });
  });

  describe('LoAF substage formulas match the spec', () => {
    // The spec claims the four substage budgets as:
    //   script_time = Σ scripts[].duration
    //   layout_time = styleAndLayoutDuration − forcedStyleAndLayoutDuration
    //   style_time  = forcedStyleAndLayoutDuration
    //   paint_time  = duration − (renderStart − startTime) when renderStart > 0
    // Lock the four shorthand identities into the doc as a regression guard.
    it('cites `Σ scripts[].duration` for script_time', () => {
      expect(doc).toMatch(/Σ\s*scripts\[\]\.duration/);
    });
    it('cites `styleAndLayoutDuration − forcedStyleAndLayoutDuration` for layout_time', () => {
      expect(doc).toContain('styleAndLayoutDuration − forcedStyleAndLayoutDuration');
    });
    it('cites `forcedStyleAndLayoutDuration` for style_time', () => {
      expect(doc).toContain('forcedStyleAndLayoutDuration');
    });
  });

  describe('background-tab visibility filter invariant is documented', () => {
    it('spec quotes the invariant `raw_sample_size === sample_size + excluded_background_sessions`', () => {
      expect(doc).toContain('raw_sample_size === sample_size + excluded_background_sessions');
    });
    it('spec states the mismatch throws', () => {
      // Tolerate phrasing like "throws", "throw an error", "throws fast".
      expect(doc.toLowerCase()).toContain('mismatch throws');
    });
  });

  describe('Act 3 stage activation thresholds match resolveActiveStages', () => {
    it('LCP activates at >= 25 measured classified obs and >= 50% coverage', () => {
      const lcpRule = /lcp[^\n]*at least\s*25[^\n]*at least\s*50%/i;
      expect(doc, 'LCP activation rule shape missing').toMatch(lcpRule);
    });
    it('INP activates at >= 25 measured classified obs and >= 50% coverage', () => {
      const inpRule = /inp[^\n]*at least\s*25[^\n]*at least\s*50%/i;
      expect(doc, 'INP activation rule shape missing').toMatch(inpRule);
    });
  });
});
