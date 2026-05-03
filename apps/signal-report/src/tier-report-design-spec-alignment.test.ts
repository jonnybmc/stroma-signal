import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  affirmingAggregateFixture,
  emptyFunnelAggregateFixture,
  lowInpCoverageAggregateFixture,
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_REPORT_BASE_URL,
  SIGNAL_REPORT_VERSION,
  strongLcpCoverageAggregateFixture
} from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { buildReportViewModel } from './report-view-model';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');
const docPath = path.join(repoRoot, 'docs/tier-report-design-spec.md');

const doc = fs.readFileSync(docPath, 'utf8');

describe('tier-report-design-spec.md alignment with report-view-model + canonical contracts', () => {
  describe('Section structure: doc names every section the renderer ships', () => {
    // Semantic section IDs adopted in the RC3 redesign. Doc references
    // both the section ID (`cover`) and the act numbering (`Act 00`)
    // so external links and TOC chrome stay in sync.
    for (const section of ['cover', 'audience', 'distance', 'funnel', 'business']) {
      it(`spec contains section id \`${section}\``, () => {
        expect(doc).toContain(`\`${section}\``);
      });
    }
    for (const act of ['Act 00', 'Act 01', 'Act 02', 'Act 03', 'Act 04']) {
      it(`spec contains "${act}" header / reference`, () => {
        expect(doc).toContain(act);
      });
    }
  });

  describe('Mood tiers: doc enumerates the canonical ReportMoodTier union', () => {
    for (const mood of ['urgent', 'sober', 'affirming']) {
      it(`spec backticks mood value \`${mood}\``, () => {
        expect(doc).toContain(`\`${mood}\``);
      });
    }

    it('renderer emits one of the three canonical moods on the strong fixture', () => {
      const vm = buildReportViewModel(strongLcpCoverageAggregateFixture);
      expect(['urgent', 'sober', 'affirming']).toContain(vm.mood_tier);
    });

    it('renderer emits an affirming mood on the affirming fixture', () => {
      const vm = buildReportViewModel(affirmingAggregateFixture);
      expect(vm.mood_tier).toBe('affirming');
    });
  });

  describe('Funnel stages match SignalExperienceStage union', () => {
    for (const stage of ['fcp', 'lcp', 'inp']) {
      it(`spec backticks stage \`${stage}\``, () => {
        expect(doc).toContain(`\`${stage}\``);
      });
    }
  });

  describe('Poor-performance thresholds match canonical constants', () => {
    it(`spec cites FCP poor threshold ${SIGNAL_FUNNEL_FCP_POOR_THRESHOLD}ms`, () => {
      expect(doc).toMatch(new RegExp(`FCP poor[^\\n]*${SIGNAL_FUNNEL_FCP_POOR_THRESHOLD}ms`));
    });
    it(`spec cites LCP poor threshold ${SIGNAL_FUNNEL_LCP_POOR_THRESHOLD}ms`, () => {
      expect(doc).toMatch(new RegExp(`LCP poor[^\\n]*${SIGNAL_FUNNEL_LCP_POOR_THRESHOLD}ms`));
    });
    it(`spec cites INP poor threshold ${SIGNAL_FUNNEL_INP_POOR_THRESHOLD}ms`, () => {
      expect(doc).toMatch(new RegExp(`INP poor[^\\n]*${SIGNAL_FUNNEL_INP_POOR_THRESHOLD}ms`));
    });
  });

  describe('CTA boundary: Rapid Fix Plan is named in both doc and renderer', () => {
    const CTA_NAME = 'Rapid Fix Plan';

    it(`spec names "${CTA_NAME}" as the single closing-section CTA`, () => {
      expect(doc).toContain(CTA_NAME);
    });

    it('renderer emits exactly one offer card titled with the canonical CTA name', () => {
      const vm = buildReportViewModel(strongLcpCoverageAggregateFixture);
      expect(vm.offer_cards).toHaveLength(1);
      const offer = vm.offer_cards[0];
      expect(offer).toBeDefined();
      expect(offer?.title).toBe(CTA_NAME);
    });
  });

  describe('Required Data Capabilities reference the canonical contract', () => {
    const REQUIRED_FIELDS = [
      'comparison_tier',
      'race_metric',
      'race_fallback_reason',
      'experience_funnel',
      'active_stages',
      'measured_session_coverage',
      'poor_session_share'
    ];
    for (const field of REQUIRED_FIELDS) {
      it(`spec backticks required-data field \`${field}\``, () => {
        expect(doc).toContain(`\`${field}\``);
      });
    }
  });

  describe('Hosted route + canonical package + report version match constants', () => {
    it('spec references the hosted report route from SIGNAL_REPORT_BASE_URL', () => {
      expect(doc).toContain(SIGNAL_REPORT_BASE_URL);
    });

    it('spec names the canonical package @stroma-labs/signal', () => {
      expect(doc).toContain('@stroma-labs/signal');
    });

    it(`spec references the additive rv=${SIGNAL_REPORT_VERSION} contract`, () => {
      expect(doc).toContain(`rv=${SIGNAL_REPORT_VERSION}`);
    });
  });

  describe('Truth boundary: forbidden surfaces named in spec line up with the render-honesty guard', () => {
    const FORBIDDEN_PHRASES = [
      'revenue estimates',
      'monthly exposure',
      'vendor attribution',
      'root-cause ranking',
      'sprint plans',
      'commercial diagnosis'
    ];
    for (const phrase of FORBIDDEN_PHRASES) {
      it(`spec lists "${phrase}" in the truth-boundary section`, () => {
        expect(doc).toContain(phrase);
      });
    }

    // RC3 addition — prescription verbs + bid-down language are forbidden
    // in headlines and ledes; the spec must enumerate them so the
    // render-honesty test has a doc anchor to point readers at.
    const FORBIDDEN_HEADLINE_TOKENS = [
      'recommend',
      'optimize',
      'you should',
      'we suggest',
      'the fix is',
      'bid down',
      'lower CPC ceilings',
      'lower bids',
      'exclude',
      'avoid'
    ];
    for (const token of FORBIDDEN_HEADLINE_TOKENS) {
      it(`spec lists forbidden headline token \`${token}\``, () => {
        expect(doc).toContain(token);
      });
    }
  });

  describe('Reduced + legacy funnel modes match ReportAct3Mode union', () => {
    it('low-INP fixture forces a reduced funnel mode', () => {
      const vm = buildReportViewModel(lowInpCoverageAggregateFixture);
      expect(vm.act3.mode).toBe('reduced');
    });

    it('empty-funnel fixture forces a legacy funnel mode', () => {
      const vm = buildReportViewModel(emptyFunnelAggregateFixture);
      expect(vm.act3.mode).toBe('legacy');
    });

    it('spec describes both reduced and legacy fallback states', () => {
      expect(doc).toContain('Reduced measured funnel');
      expect(doc).toContain('Legacy URL state');
    });
  });

  describe('Race-metric vocabulary matches the design-spec presentation contract', () => {
    for (const metric of ['lcp', 'fcp']) {
      it(`spec backticks presentation metric \`${metric}\``, () => {
        expect(doc).toContain(`\`${metric}\``);
      });
    }
  });

  describe('Layout model: vertical scroll narrative replaces the horizontal slide deck', () => {
    it('spec describes the vertical scroll narrative layout', () => {
      expect(doc).toMatch(/vertical scroll narrative/i);
    });
    it('spec describes the scroll-spy table of contents', () => {
      expect(doc).toMatch(/scroll-spy/i);
    });
    it('spec describes the reading-progress hairline', () => {
      expect(doc).toMatch(/reading-progress hairline/i);
    });
  });

  describe('Theme: light default + dark parity, single canonical accent', () => {
    it('spec names light as the default theme', () => {
      expect(doc).toMatch(/light default/i);
    });
    it('spec names dark parity via [data-theme="dark"]', () => {
      expect(doc).toContain('[data-theme="dark"]');
    });
    it('spec rejects data-driven mood/accent/density CSS variation', () => {
      expect(doc).toMatch(/no data-driven mood\/accent\/density CSS variation/i);
    });
  });

  describe('Typography: Instrument pairing (Space Grotesk + Inter Tight + Instrument Serif)', () => {
    for (const family of ['Space Grotesk', 'Inter Tight', 'Instrument Serif']) {
      it(`spec names canonical font family "${family}"`, () => {
        expect(doc).toContain(family);
      });
    }
  });

  describe('Particles deferred indefinitely from RC3', () => {
    it('spec names canvas particles as deferred', () => {
      expect(doc).toMatch(/canvas particle effects \(deferred/i);
    });
  });
});
