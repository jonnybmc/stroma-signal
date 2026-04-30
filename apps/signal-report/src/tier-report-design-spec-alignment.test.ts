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
  describe('Act structure: doc names every act the renderer ships', () => {
    for (const act of ['Act 1', 'Act 2', 'Act 3', 'Act 4']) {
      it(`spec contains "${act}" header / reference`, () => {
        expect(doc).toContain(act);
      });
    }
  });

  describe('Mood tiers: doc enumerates the canonical ReportMoodTier union', () => {
    // Canonical union from report-view-model.ts:36 — three values.
    // The doc enumerates them in the Mood System section.
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

  describe('Act 3 funnel stages match SignalExperienceStage union', () => {
    // Canonical union: 'fcp' | 'lcp' | 'inp'.
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

    it(`spec names "${CTA_NAME}" as the single Act 4 CTA`, () => {
      expect(doc).toContain(CTA_NAME);
    });

    it('renderer emits exactly one offer card titled with the canonical CTA name', () => {
      const vm = buildReportViewModel(strongLcpCoverageAggregateFixture);
      expect(vm.offer_cards).toHaveLength(1);
      expect(vm.offer_cards[0].title).toBe(CTA_NAME);
    });
  });

  describe('Required Data Capabilities reference the canonical contract', () => {
    // Doc lists fields the report depends on. They must match the
    // SignalAggregateV1 / SignalExperienceFunnel field names.
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

  describe('Truth boundary: forbidden surfaces named in spec line up with the motion-payload guard', () => {
    // The spec's "must not show" list (line 113-118) names: revenue
    // estimates, monthly exposure figures, vendor attribution, root-cause
    // ranking, sprint plans, commercial diagnosis. The motion-payload
    // guard (report-motion.test.ts:67-75) enforces a subset on the
    // serialized payload. Both must agree on the headline-forbidden
    // tokens — this test pins the doc's enumeration.
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
  });

  describe('Reduced + legacy Act 3 modes match ReportAct3Mode union', () => {
    // Doc names "reduced measured funnel" and "legacy URL state". The
    // ReportAct3Mode union has 'full' | 'reduced' | 'legacy'. Verify
    // the renderer hits 'reduced' under low-INP and 'legacy' on a
    // funnel-less fixture.
    it('low-INP fixture forces a reduced Act 3 mode', () => {
      const vm = buildReportViewModel(lowInpCoverageAggregateFixture);
      expect(vm.act3.mode).toBe('reduced');
    });

    it('empty-funnel fixture forces a legacy Act 3 mode', () => {
      const vm = buildReportViewModel(emptyFunnelAggregateFixture);
      expect(vm.act3.mode).toBe('legacy');
    });

    it('spec describes both reduced and legacy fallback states', () => {
      // Section headers under "Reduced And Legacy States".
      expect(doc).toContain('Reduced measured funnel');
      expect(doc).toContain('Legacy URL state');
    });
  });

  describe('Race-metric vocabulary matches the design-spec presentation contract', () => {
    // The design spec governs presentation, not aggregation. It names
    // the race metric and the experience-funnel stages presentationally.
    // TTFB belongs to the aggregation fallback cascade (covered by
    // aggregation-spec-alignment.test.ts), so it is intentionally absent
    // from this presentation contract. Keep the assertion narrow.
    for (const metric of ['lcp', 'fcp']) {
      it(`spec backticks presentation metric \`${metric}\``, () => {
        expect(doc).toContain(`\`${metric}\``);
      });
    }
  });

  describe('Form-factor footer placement matches the spec', () => {
    it('spec places the form-factor split in the persistent footer above the credibility strip', () => {
      // Locks in the design decision so a future markup rewrite that
      // moves form-factor into Act 1 body has to revisit this spec.
      expect(doc).toMatch(/form-factor[^\n]*persistent footer[^\n]*above the credibility strip/i);
    });
  });
});
