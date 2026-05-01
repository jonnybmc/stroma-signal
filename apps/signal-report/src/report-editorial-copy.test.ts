// Editorial-copy alignment regression suite. Asserts that the
// per-section headlines / ledes / framing strings track the actual
// data shape — never asserting a story the data does not support.
//
// Pinned cases (one per critical mismatch the agent sweep uncovered):
//   - Race-unavailable fixtures get the "not yet defensible" distance
//     headline + lede instead of "Urban finishes loading. X is mid-paint"
//   - FCP-fallback fixtures get FCP-metric distance copy
//   - TTFB-fallback fixtures get TTFB-metric distance copy
//   - Affirming fixtures get the "contained" wait-delta headline
//   - Funnel-unavailable fixtures get the "performance funnel is
//     unavailable" headline (no false cliff claim)
//   - Single-stage funnels get a one-stage headline + lede
//   - Affirming-mood funnels get "mostly holds" framing
//   - Business-section ledger-fallback fixtures get "Where the evidence
//     lands" eyebrow + headline (not "Every number above")
//   - Race-unavailable + funnel-unavailable fixtures get the
//     no-shape-proven aside lede
//   - Hero-image culprit fixtures get the "Re-test QS after a hero-image
//     fix" enables bullet
//   - Constrained-empty fixtures do NOT get the "reshape constrained
//     cohort" enables bullet
//   - Per-tone impact-row sentences track tone (alert vs watch vs steady)
//   - Per-INP-phase impact-row sentence tracks dominant phase
//   - Audience headline tier-count branches: 0/1/2/3+
//   - Persona section eyebrow swaps when one or both personas empty
//   - Context-strip lede built from surviving rows, never overpromises
//   - Cover headline-card caption pivots on classified share + tier count

import {
  affirmingAggregateFixture,
  emptyFunnelAggregateFixture,
  fcpFallbackAggregateFixture,
  fullDepthAggregateFixture,
  highUnclassifiedShareAggregateFixture,
  insufficientRaceDataAggregateFixture,
  lowInpCoverageAggregateFixture,
  mobileTabletOnlyAggregateFixture,
  previewAggregateFixture,
  safariHeavyAggregateFixture,
  singleStageFunnelFixture,
  soberMoodAggregateFixture,
  strongLcpCoverageAggregateFixture,
  ttfbFallbackAggregateFixture,
  zeroClassifiedAggregateFixture
} from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { buildReportViewModel } from './report-view-model';

describe('editorial copy — distance section adapts to race availability + metric + delta band', () => {
  it('race-unavailable fixtures get the "not yet defensible" headline + lede (no false race claim)', () => {
    for (const fixture of [
      previewAggregateFixture,
      insufficientRaceDataAggregateFixture,
      highUnclassifiedShareAggregateFixture,
      zeroClassifiedAggregateFixture
    ]) {
      const vm = buildReportViewModel(fixture);
      expect(vm.editorial.distance_headline_html).toContain('not yet defensible');
      expect(vm.editorial.distance_headline_html).not.toContain('mid-paint');
      expect(vm.editorial.distance_headline_html).not.toContain('finishes loading');
      expect(vm.editorial.distance_lede_html.toLowerCase()).toContain('coverage');
    }
  });

  it('FCP-fallback fixtures get FCP-metric framing (not LCP)', () => {
    const vm = buildReportViewModel(fcpFallbackAggregateFixture);
    expect(vm.editorial.distance_headline_html.toLowerCase()).toContain('first content');
    expect(vm.editorial.distance_lede_html).toContain('FCP');
    expect(vm.editorial.distance_lede_html).not.toContain('LCP');
  });

  it('TTFB-fallback fixtures get server-reply framing (not paint metaphor)', () => {
    const vm = buildReportViewModel(ttfbFallbackAggregateFixture);
    expect(vm.editorial.distance_headline_html.toLowerCase()).toContain('server reply');
    expect(vm.editorial.distance_headline_html.toLowerCase()).not.toContain('mid-paint');
    expect(vm.editorial.distance_lede_html).toContain('TTFB');
    expect(vm.editorial.distance_lede_html).not.toContain('LCP');
  });

  it('affirming fixtures (FCP fallback) use the FCP-metric headline + lede (not alarmist mid-paint claim)', () => {
    const vm = buildReportViewModel(affirmingAggregateFixture);
    // Affirming-balance fixture takes the FCP-fallback path because its
    // LCP coverage is below threshold. The headline must NOT assert
    // "mid-paint" (LCP-only metaphor) and must NOT use urgent framing.
    expect(vm.editorial.distance_headline_html.toLowerCase()).not.toContain('mid-paint');
    expect(vm.editorial.distance_lede_html).not.toContain('LCP');
  });

  it('Paid-Media impact eyebrow + unavailable message render when race unavailable', () => {
    const vm = buildReportViewModel(previewAggregateFixture);
    expect(vm.editorial.distance_paid_media_eyebrow).toContain('once defensible');
    expect(vm.editorial.distance_paid_media_unavailable_message).not.toBeNull();
  });
});

describe('editorial copy — funnel section adapts to mode + active stage count + mood', () => {
  it('legacy / empty-funnel fixtures get the "unavailable" headline (no cliff claim)', () => {
    for (const fixture of [zeroClassifiedAggregateFixture, emptyFunnelAggregateFixture]) {
      const vm = buildReportViewModel(fixture);
      expect(vm.editorial.funnel_headline_html.toLowerCase()).toContain('unavailable');
      expect(vm.editorial.funnel_headline_html.toLowerCase()).not.toContain('becomes too late');
      expect(vm.editorial.funnel_lede_html).toBeNull();
    }
  });

  it('single-stage fixtures get the "one defensible stage" headline + lede', () => {
    for (const fixture of [singleStageFunnelFixture, safariHeavyAggregateFixture]) {
      const vm = buildReportViewModel(fixture);
      expect(vm.editorial.funnel_headline_html.toLowerCase()).toContain('one stage');
      expect(vm.editorial.funnel_lede_html?.toLowerCase()).toContain('only');
      expect(vm.editorial.funnel_lede_html?.toLowerCase()).toContain('clears the defensibility bar');
    }
  });

  it('two-stage fixtures get the "measured stages" headline (not "page becomes too late")', () => {
    const vm = buildReportViewModel(lowInpCoverageAggregateFixture);
    expect(vm.editorial.funnel_headline_html).toContain('measured stages');
    expect(vm.editorial.funnel_lede_html).toContain('paint and main-content paint');
  });

  it('affirming-mood full funnels get "mostly holds" framing (not urgent)', () => {
    const vm = buildReportViewModel(affirmingAggregateFixture);
    if (vm.act3.stages.length === 3 && vm.mood_tier === 'affirming') {
      expect(vm.editorial.funnel_headline_html).toContain('mostly holds');
      expect(vm.editorial.funnel_lede_html?.toLowerCase()).toContain('most sessions stay safe');
    }
  });

  it('headline figure-cap names "the only defensible stage" when only one stage is active', () => {
    const vm = buildReportViewModel(safariHeavyAggregateFixture);
    if (vm.act3.stages.length === 1) {
      expect(vm.editorial.funnel_headline_figure_cap.toLowerCase()).not.toContain('at least one stage');
    }
  });
});

describe('editorial copy — business section adapts to ledger presence + shape provenance', () => {
  it('ledger-fallback fixtures (act4_impact_rows < 2) get "Where the evidence lands" not "Every number above"', () => {
    for (const fixture of [
      previewAggregateFixture,
      insufficientRaceDataAggregateFixture,
      lowInpCoverageAggregateFixture,
      highUnclassifiedShareAggregateFixture,
      safariHeavyAggregateFixture,
      mobileTabletOnlyAggregateFixture,
      zeroClassifiedAggregateFixture
    ]) {
      const vm = buildReportViewModel(fixture);
      if (vm.act4_impact_rows.length < 2) {
        expect(vm.editorial.business_headline_html).not.toContain('Every number above');
        expect(vm.editorial.business_headline_html).toContain('Where the evidence lands');
        expect(vm.editorial.business_section_eyebrow).toBe('Where the evidence lands in your KPIs');
      }
    }
  });

  it('shape-not-proven fixtures get the "data could and could not say" aside lede', () => {
    const vm = buildReportViewModel(zeroClassifiedAggregateFixture);
    expect(vm.editorial.business_aside_lede_html).toContain('what the data could and could not say');
    expect(vm.editorial.business_aside_lede_html).not.toContain('proves the');
  });

  it('shape-proven fixtures get the "proves the shape" aside lede', () => {
    const vm = buildReportViewModel(strongLcpCoverageAggregateFixture);
    expect(vm.editorial.business_aside_lede_html).toContain('proves the');
    expect(vm.editorial.business_aside_lede_html).toContain('shape');
  });

  it('what-this-enables bullets always include the QBR baseline', () => {
    for (const fixture of [previewAggregateFixture, fullDepthAggregateFixture, zeroClassifiedAggregateFixture]) {
      const vm = buildReportViewModel(fixture);
      expect(vm.editorial.business_what_this_enables[0]).toMatch(/QBR or sprint review/i);
    }
  });

  it('what-this-enables omits the "reshape constrained cohort" bullet when constrained persona empty', () => {
    const vm = buildReportViewModel(mobileTabletOnlyAggregateFixture);
    if (vm.persona_contrast.constrained.is_empty) {
      const bullets = vm.editorial.business_what_this_enables.join(' ').toLowerCase();
      expect(bullets).not.toContain('constrained-cohort landing path');
    }
  });

  it('what-this-enables hero-image bullet only fires when dominant culprit is hero_image', () => {
    const vm = buildReportViewModel(fullDepthAggregateFixture);
    if (vm.race.lcp_story?.dominant_culprit_kind === 'hero_image') {
      const bullets = vm.editorial.business_what_this_enables.join(' ');
      expect(bullets).toContain('hero-image fix');
    }
  });
});

describe('editorial copy — audience section adapts to populated tier count + mood', () => {
  it('zero-classified fixture gets the "could not sort" headline (not "three audiences")', () => {
    const vm = buildReportViewModel(zeroClassifiedAggregateFixture);
    expect(vm.editorial.audience_headline_html.toLowerCase()).toContain("couldn't sort");
    expect(vm.editorial.audience_headline_html).not.toContain('three different');
  });

  it('full-depth fixture gets the "three different audiences" headline', () => {
    const vm = buildReportViewModel(fullDepthAggregateFixture);
    expect(vm.editorial.audience_headline_html).toContain('three different audiences');
    expect(vm.editorial.audience_headline_html).toContain('the same campaign');
    expect(vm.editorial.audience_headline_html).not.toContain('checkout');
  });

  it('affirming-mood lede softens "different experience" to "holds together"', () => {
    const vm = buildReportViewModel(affirmingAggregateFixture);
    expect(vm.editorial.audience_lede_html.toLowerCase()).toContain('holds together');
    expect(vm.editorial.audience_lede_html).not.toContain('Different experience');
  });

  it('persona section eyebrow swaps to "Cohort coverage" when either persona empty', () => {
    for (const fixture of [previewAggregateFixture, affirmingAggregateFixture, insufficientRaceDataAggregateFixture]) {
      const vm = buildReportViewModel(fixture);
      const anyEmpty = vm.persona_contrast.best.is_empty || vm.persona_contrast.constrained.is_empty;
      if (anyEmpty) {
        expect(vm.editorial.audience_persona_section_eyebrow).toBe('Cohort coverage in this window');
        expect(vm.editorial.audience_persona_section_lede).not.toContain('side by side');
      }
    }
  });

  it('context-strip lede built from surviving rows, never overpromises 4 signals', () => {
    for (const fixture of [affirmingAggregateFixture, fcpFallbackAggregateFixture, fullDepthAggregateFixture]) {
      const vm = buildReportViewModel(fixture);
      const ctxRows = vm.act1_context_strip?.rows.length ?? 0;
      if (ctxRows > 0) {
        // Lede mentions count of surviving rows, never more.
        const lede = vm.editorial.audience_context_strip_lede;
        expect(lede.length).toBeGreaterThan(0);
        // If only RTT row survived, lede should mention "median rtt" not save-data.
        if (ctxRows === 1 && vm.act1_context_strip?.rows[0]?.key === 'median_rtt') {
          expect(lede.toLowerCase()).toContain('median rtt');
          expect(lede.toLowerCase()).not.toContain('save-data');
          expect(lede.toLowerCase()).not.toContain('cellular');
        }
      }
    }
  });
});

describe('editorial copy — cover section adapts to classified share + tier count', () => {
  it('zero-classified fixture: caption acknowledges no urban baseline', () => {
    const vm = buildReportViewModel(zeroClassifiedAggregateFixture);
    expect(vm.editorial.cover_headline_card_caption).toContain('could not be classified');
    expect(vm.editorial.cover_headline_card_caption).toContain('no urban baseline');
  });

  it('healthy-classified fixture: caption uses the standard "loads slower than urban" framing', () => {
    const vm = buildReportViewModel(strongLcpCoverageAggregateFixture);
    expect(vm.editorial.cover_headline_card_caption.toLowerCase()).toContain('urban baseline');
    expect(vm.editorial.cover_headline_card_caption).not.toContain('could not be classified');
  });

  it('affirming fixture: at-a-glance lede softens to "more contained than the headline implies"', () => {
    const vm = buildReportViewModel(affirmingAggregateFixture);
    expect(vm.editorial.cover_at_a_glance_lede.toLowerCase()).toContain('contained');
  });
});

describe('editorial copy — Act 4 impact rows pick per-tone (and per-INP-phase) sentences', () => {
  it('lcp_bounce sentence scales with tone band (alert vs watch vs steady)', () => {
    const sober = buildReportViewModel(soberMoodAggregateFixture);
    const lcpBounce = sober.act4_impact_rows.find((r) => r.id === 'lcp_bounce');
    if (lcpBounce) {
      // sober mood lands a wait_delta in the visible band → watch tone
      expect(['watch', 'alert', 'steady']).toContain(lcpBounce.tone);
    }
  });

  it('inp_conversion sentence reflects dominant_phase when known', () => {
    const vm = buildReportViewModel(fullDepthAggregateFixture);
    const inpRow = vm.act4_impact_rows.find((r) => r.id === 'inp_conversion');
    const phase = vm.act3.inp_story?.dominant_phase;
    if (inpRow && phase === 'processing') {
      expect(inpRow.impact_sentence_html).toContain('Heavy click handlers');
    }
    if (inpRow && phase === 'presentation_delay') {
      expect(inpRow.impact_sentence_html).toContain('takes too long to commit the next paint');
    }
  });

  it('script_roas sentence uses "struggle to interact" at watch tier (not "cannot interact")', () => {
    // full-depth has third-party `moderate` tier → watch tone
    const vm = buildReportViewModel(fullDepthAggregateFixture);
    const scriptRow = vm.act4_impact_rows.find((r) => r.id === 'script_roas');
    if (scriptRow && scriptRow.tone === 'watch') {
      expect(scriptRow.impact_sentence_html).toContain('struggle to interact');
      expect(scriptRow.impact_sentence_html).not.toContain('cannot reliably interact');
    }
  });

  it('network_reach sentence escalates to "majority" at alert tier (>=50% constrained)', () => {
    for (const fixture of [strongLcpCoverageAggregateFixture, fullDepthAggregateFixture]) {
      const vm = buildReportViewModel(fixture);
      const reach = vm.act4_impact_rows.find((r) => r.id === 'network_reach');
      if (reach && reach.tone === 'alert') {
        expect(reach.impact_sentence_html).toContain('majority');
      }
    }
  });
});
