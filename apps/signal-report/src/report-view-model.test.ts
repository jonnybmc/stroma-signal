import {
  affirmingAggregateFixture,
  decodeSignalReportUrl,
  fcpFallbackAggregateFixture,
  highUnclassifiedShareAggregateFixture,
  lowInpCoverageAggregateFixture,
  signalReportScenarioFixtures,
  singleStageFunnelFixture,
  soberMoodAggregateFixture,
  strongLcpCoverageAggregateFixture
} from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { renderReportMarkup } from './report-markup';
import { buildReportViewModel, REPORT_SCENE_BUDGETS, selectMotionMode } from './report-view-model';

describe('report view model', () => {
  it('builds a full three-stage Act 3 view model when coverage is strong', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);

    expect(viewModel.act3.mode).toBe('full');
    expect(viewModel.act3.active_stage_keys).toEqual(['fcp', 'lcp', 'inp']);
    expect(viewModel.act3.stages.map((stage) => stage.key)).toEqual(['fcp', 'lcp', 'inp']);
    expect(viewModel.mood_tier).toBe('urgent');
    expect(viewModel.offer_cards.map((card) => card.title)).toEqual(['Rapid Fix Plan', 'Performance Intelligence']);
  });

  it('drops to a reduced measured funnel when INP coverage is too weak', () => {
    const viewModel = buildReportViewModel(lowInpCoverageAggregateFixture);

    expect(viewModel.act3.mode).toBe('reduced');
    expect(viewModel.act3.active_stage_keys).toEqual(['fcp', 'lcp']);
    expect(viewModel.act3.narrative_line).toContain('cliff still exists');
    expect(['sober', 'affirming']).toContain(viewModel.mood_tier);
  });

  it('uses a calmer affirming mood when the measured gap remains restrained', () => {
    const viewModel = buildReportViewModel(affirmingAggregateFixture);

    expect(viewModel.mood_tier).toBe('affirming');
    expect(viewModel.hero_lede).toContain('more controlled');
    expect(viewModel.act3.poor_session_share).toBeLessThanOrEqual(12);
  });

  it('keeps older rv=1 urls in a safe legacy Act 3 state', () => {
    const legacyAggregate = decodeSignalReportUrl(
      'https://signal.stroma.design/r?mode=production&d=example.co.za&nt=25,25,25,25,0&dt=34,33,33&lu=2100&lt=4200&fu=1100&ft=1900&tu=220&tt=380&ulc=100&ufc=100&utc=100&clc=100&cfc=100&ctc=100&s=100&p=7&nc=100&nu=0&nr=0&lc=100&ct=moderate&rm=lcp'
    );
    const viewModel = buildReportViewModel(legacyAggregate);

    expect(viewModel.act3.mode).toBe('legacy');
    expect(viewModel.act3.legacy_message).toContain('generated before the measured funnel block existed');
  });

  it('selects deterministic reduced-motion state', () => {
    expect(selectMotionMode(true)).toBe('reduced');
    expect(selectMotionMode(false)).toBe('full');
  });

  it('surfaces device tier distribution ordered high, mid, low from the aggregate', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const deviceTiers = viewModel.act1_device_tiers;

    expect(deviceTiers).toHaveLength(3);
    expect(deviceTiers.map((entry) => entry.key)).toEqual(['high', 'mid', 'low']);
    expect(deviceTiers[0].share).toBe(strongLcpCoverageAggregateFixture.device_distribution.high);
    expect(deviceTiers[1].share).toBe(strongLcpCoverageAggregateFixture.device_distribution.mid);
    expect(deviceTiers[2].share).toBe(strongLcpCoverageAggregateFixture.device_distribution.low);
    for (const entry of deviceTiers) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.narrative.length).toBeGreaterThan(0);
    }
  });

  it('generates share-driven device narratives that cite real hardware thresholds', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const materialDevices = viewModel.act1_device_tiers.filter((d) => d.share > 0);
    for (const device of materialDevices) {
      // Every material device narrative should reference a hardware signature
      // pulled from the classification thresholds (cores / RAM / screen).
      expect(device.narrative).toMatch(/CPU cores|screens|RAM/);
      // And should not fall back to the legacy atmospheric copy
      expect(device.narrative).not.toMatch(/Flagship|Mainstream|Low-core/);
    }
    // Zero-share device classes get a flat "no sessions observed" line
    const empties = viewModel.act1_device_tiers.filter((d) => d.share === 0);
    for (const device of empties) {
      expect(device.narrative).toMatch(/No sessions/);
    }
  });

  it('builds actionable signal cells each naming the product-team decision they unlock', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const cells = viewModel.actionable_signals.cells;

    expect(cells.length).toBeGreaterThan(0);
    // Every cell carries a concrete product-team decision string — no cell
    // is allowed to leak through without naming the action it unlocks.
    for (const cell of cells) {
      expect(cell.decision.length).toBeGreaterThan(10);
      expect(cell.label.length).toBeGreaterThan(0);
      expect(cell.value.length).toBeGreaterThan(0);
    }
    // CPU cores and Browser cells are always present because the underlying
    // fields are universally captured (hardwareConcurrency + UA parsing).
    // Form-factor cell leads when present — derived from device_screen_w
    // which is universally captured on every event.
    const cellKeys = cells.map((cell) => cell.key);
    expect(cellKeys).toContain('form-factor');
    expect(cellKeys[0]).toBe('form-factor');
    expect(cellKeys).toContain('js-budget');
    expect(cellKeys).toContain('testing-matrix');
  });

  it('builds the persistent credibility strip with all five measured fields', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const strip = viewModel.credibility_strip;

    expect(strip.sample_size).toBe(strongLcpCoverageAggregateFixture.sample_size);
    expect(strip.period_days).toBe(strongLcpCoverageAggregateFixture.period_days);
    expect(typeof strip.classified_share).toBe('number');
    expect(strip.classified_share).toBeGreaterThanOrEqual(0);
    expect(strip.classified_share).toBeLessThanOrEqual(100);
    expect(typeof strip.connection_reuse_share).toBe('number');
    expect(strip.connection_reuse_share).toBeGreaterThanOrEqual(0);
    expect(strip.connection_reuse_share).toBeLessThanOrEqual(100);
    expect(typeof strip.metric_coverage).toBe('number');
    expect(strip.metric_coverage).toBeGreaterThanOrEqual(0);
    expect(strip.metric_coverage).toBeLessThanOrEqual(100);
    expect(strip.metric_coverage_label).toMatch(/coverage$/i);
  });

  it('surfaces excluded_background_sessions on the credibility strip when aggregation drops sessions', () => {
    const withExclusions = {
      ...strongLcpCoverageAggregateFixture,
      coverage: {
        ...strongLcpCoverageAggregateFixture.coverage,
        raw_sample_size: strongLcpCoverageAggregateFixture.sample_size + 31,
        excluded_background_sessions: 31
      }
    };
    const viewModel = buildReportViewModel(withExclusions);
    expect(viewModel.credibility_strip.excluded_background_sessions).toBe(31);
  });

  it('omits excluded_background_sessions when the aggregate reports zero exclusions', () => {
    const withoutExclusions = {
      ...strongLcpCoverageAggregateFixture,
      coverage: {
        ...strongLcpCoverageAggregateFixture.coverage,
        raw_sample_size: strongLcpCoverageAggregateFixture.sample_size,
        excluded_background_sessions: 0
      }
    };
    const viewModel = buildReportViewModel(withoutExclusions);
    expect(viewModel.credibility_strip.excluded_background_sessions).toBeNull();
  });

  it('flags coverage_marginal on the credibility strip when the aggregate warning fires', () => {
    const marginal = {
      ...strongLcpCoverageAggregateFixture,
      warnings: [...strongLcpCoverageAggregateFixture.warnings, 'coverage_marginal']
    };
    const viewModel = buildReportViewModel(marginal);
    expect(viewModel.credibility_strip.coverage_marginal).toBe(true);
  });

  it('leaves coverage_marginal false when the warning is absent', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    expect(viewModel.credibility_strip.coverage_marginal).toBe(false);
  });

  it('keeps scene budgets within the intended DOM envelope', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const act1Bodies = viewModel.act1_tiers.reduce((sum, tier) => sum + tier.particleCount, 0);

    expect(act1Bodies).toBeLessThanOrEqual(REPORT_SCENE_BUDGETS.act1ParticleBudget + 5);
    for (const stage of viewModel.act3.stages) {
      expect(stage.flow_body_count).toBeLessThanOrEqual(REPORT_SCENE_BUDGETS.act3FlowBodyBudget);
      expect(stage.drop_body_count).toBeLessThanOrEqual(REPORT_SCENE_BUDGETS.act3DropBodyBudget);
    }
  });

  it('selects sober mood for moderate gaps', () => {
    const viewModel = buildReportViewModel(soberMoodAggregateFixture);
    expect(viewModel.mood_tier).toBe('sober');
  });

  it('renders a single-stage funnel without crash or NaN', () => {
    const viewModel = buildReportViewModel(singleStageFunnelFixture);
    expect(viewModel.act3.mode).toBe('reduced');
    expect(viewModel.act3.active_stage_keys).toEqual(['fcp']);
    expect(viewModel.act3.stages.length).toBe(1);
    expect(viewModel.act3.stages[0]?.key).toBe('fcp');
    expect(Number.isFinite(viewModel.act3.stages[0]?.weighted_poor_share)).toBe(true);
  });

  it('computes credibility strip correctly for high-unclassified traffic', () => {
    const viewModel = buildReportViewModel(highUnclassifiedShareAggregateFixture);
    // ~36% of traffic is classified (40 classified out of 112 total)
    expect(viewModel.credibility_strip.classified_share).toBeGreaterThan(0);
    expect(viewModel.credibility_strip.classified_share).toBeLessThan(100);
  });

  it('does not crash when optional blocks are undefined after codec decode', () => {
    // Simulate a legacy codec-decoded aggregate with no device/network/environment blocks
    const legacyUrl =
      'https://signal.stroma.design/r?rv=1&mode=preview&d=test.local&nt=50,30,15,5,0&dt=20,50,30&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp';
    const decoded = decodeSignalReportUrl(legacyUrl);

    expect(decoded.device_hardware).toBeUndefined();
    expect(decoded.network_signals).toBeUndefined();
    expect(decoded.environment).toBeUndefined();

    const viewModel = buildReportViewModel(decoded);
    // Persona contrast should produce safe fallback labels, not crash
    expect(viewModel.persona_contrast.best.cores_label).toBe('—');
    expect(viewModel.persona_contrast.best.memory_label).toBe('—');
    expect(viewModel.persona_contrast.best.browser).toBeNull();
  });

  it('produces no NaN or undefined strings in act4 summary points across all fixtures', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const viewModel = buildReportViewModel(fixture.aggregate);
      for (const point of viewModel.act4_summary_points) {
        expect(point).not.toContain('NaN');
        expect(point).not.toContain('undefined');
      }
    }
  });

  it('builds evidence items with all required provenance fields', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const labels = viewModel.evidence_items.map((item) => item.label);

    expect(labels).toContain('Sample');
    expect(labels).toContain('Window');
    expect(labels).toContain('Comparison tier');
    expect(labels).toContain('Race metric');
    expect(labels).toContain('Fallback honesty');
    expect(labels).toContain('Threshold basis');
    expect(labels).toContain('Poor-session share');
    expect(labels).toContain('Measured funnel coverage');

    for (const item of viewModel.evidence_items) {
      expect(item.value).not.toBe('');
      expect(item.value).not.toContain('undefined');
      expect(item.value).not.toContain('NaN');
      expect(['neutral', 'steady', 'watch', 'alert']).toContain(item.tone);
    }
  });

  it('builds credibility strip with non-zero values for production fixtures', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const strip = viewModel.credibility_strip;

    expect(strip.sample_size).toBeGreaterThan(0);
    expect(strip.period_days).toBeGreaterThan(0);
    expect(strip.classified_share).toBeGreaterThan(0);
    expect(strip.metric_coverage).toBeGreaterThan(0);
    expect(strip.metric_coverage_label).toBeTruthy();
  });

  it('uses the correct metric coverage on FCP fallback reports', () => {
    const viewModel = buildReportViewModel(fcpFallbackAggregateFixture);
    const strip = viewModel.credibility_strip;

    // On FCP fallback, metric_coverage_label should say "fcp coverage"
    // and the value should reflect FCP coverage, not LCP coverage
    expect(strip.metric_coverage_label).toContain('fcp');
    // FCP coverage should be high (these fixtures have near-100% FCP coverage)
    expect(strip.metric_coverage).toBeGreaterThan(50);
  });

  it('uses the weaker measured side for compact race coverage', () => {
    const viewModel = buildReportViewModel({
      ...fcpFallbackAggregateFixture,
      coverage: {
        ...fcpFallbackAggregateFixture.coverage,
        selected_metric_urban_coverage: 92,
        selected_metric_comparison_coverage: 41
      }
    });

    expect(viewModel.credibility_strip.metric_coverage_label).toContain('fcp');
    expect(viewModel.credibility_strip.metric_coverage).toBe(41);
  });

  it('uses lcp coverage labeling when no comparable race is available', () => {
    const viewModel = buildReportViewModel({
      ...strongLcpCoverageAggregateFixture,
      comparison_tier: 'none',
      race_metric: 'none',
      race_fallback_reason: 'insufficient_comparable_data',
      coverage: {
        ...strongLcpCoverageAggregateFixture.coverage,
        lcp_coverage: 61,
        selected_metric_urban_coverage: null,
        selected_metric_comparison_coverage: null
      }
    });

    expect(viewModel.credibility_strip.metric_coverage_label).toBe('lcp coverage');
    expect(viewModel.credibility_strip.metric_coverage).toBe(61);
  });

  it('distinguishes empty-funnel from legacy in Act 3', () => {
    // Legacy: no experience_funnel at all (decoded from old URL without es param)
    const legacyUrl =
      'https://signal.stroma.design/r?rv=1&mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp';
    const legacyDecoded = decodeSignalReportUrl(legacyUrl);
    const legacyVm = buildReportViewModel(legacyDecoded);
    expect(legacyVm.act3.mode).toBe('legacy');
    expect(legacyVm.act3.threshold_basis).toContain('Legacy');

    // Empty funnel: experience_funnel exists but active_stages is empty
    // (fresh URL with es= param but no classified data)
    const emptyFunnelUrl =
      'https://signal.stroma.design/r?rv=1&mode=preview&d=test.local&nt=0,0,0,0,100&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=0&nu=100&nr=0&lc=0&ct=none&rm=none&es=&ec=0&ep=0&fpt=3000&lpt=4000&ipt=500&fcs=0,0,0,0&fps=0,0,0,0&lcs=0,0,0,0&lps=0,0,0,0&ics=0,0,0,0&ips=0,0,0,0';
    const emptyDecoded = decodeSignalReportUrl(emptyFunnelUrl);
    const emptyVm = buildReportViewModel(emptyDecoded);
    expect(emptyVm.act3.mode).toBe('reduced');
    expect(emptyVm.act3.threshold_basis).not.toContain('Legacy');
    expect(emptyVm.act3.threshold_basis).toContain('No defensible funnel');
  });

  it('surfaces warnings from the aggregate in the view model', () => {
    const legacyUrl =
      'https://signal.stroma.design/r?rv=1&mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp';
    const decoded = decodeSignalReportUrl(legacyUrl);
    const viewModel = buildReportViewModel(decoded);

    // Legacy URL without ga= should carry the freshness warning through
    expect(viewModel.warnings.length).toBeGreaterThan(0);
    expect(viewModel.warnings.some((warning) => warning.includes('freshness'))).toBe(true);
  });

  it('keeps freshness known when ga exists alongside non-freshness warnings', () => {
    const decoded = decodeSignalReportUrl(
      'https://signal.stroma.design/r?rv=1&mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=none&rm=none&rr=insufficient_comparable_data&ga=1776072000000'
    );
    const viewModel = buildReportViewModel(decoded);

    expect(viewModel.freshness_known).toBe(true);
    expect(viewModel.generated_at).toBe(1776072000000);
    expect(viewModel.warnings).toContain('Sample size below the recommended preview threshold.');
    expect(viewModel.warnings).toContain('Act 2 cannot render a comparable race with the current data.');
  });

  it('builds a complete view model from every scenario fixture without crash or NaN', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const viewModel = buildReportViewModel(fixture.aggregate);

      // No NaN in any numeric field
      expect(Number.isFinite(viewModel.sample_size)).toBe(true);
      expect(Number.isFinite(viewModel.period_days)).toBe(true);
      expect(Number.isFinite(viewModel.generated_at)).toBe(true);
      expect(Number.isFinite(viewModel.credibility_strip.classified_share)).toBe(true);
      expect(Number.isFinite(viewModel.credibility_strip.connection_reuse_share)).toBe(true);
      expect(Number.isFinite(viewModel.credibility_strip.metric_coverage)).toBe(true);

      // No undefined strings in text fields
      expect(viewModel.domain).not.toContain('undefined');
      expect(viewModel.hero_lede).not.toContain('undefined');
      expect(viewModel.act1_intro).not.toContain('undefined');
      expect(viewModel.act3.narrative_line).not.toContain('undefined');
      expect(viewModel.act3.threshold_basis).not.toContain('undefined');

      // Evidence items all valid
      for (const item of viewModel.evidence_items) {
        expect(item.value).not.toBe('');
        expect(item.value).not.toContain('NaN');
        expect(item.value).not.toContain('undefined');
      }

      // Act 4 summary points clean
      for (const point of viewModel.act4_summary_points) {
        expect(point).not.toContain('NaN');
        expect(point).not.toContain('undefined');
      }

      // Mood tier is valid
      expect(['urgent', 'sober', 'affirming']).toContain(viewModel.mood_tier);
    }
  });

  it('renders full markup from every fixture without NaN, undefined, or broken structure', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const viewModel = buildReportViewModel(fixture.aggregate);
      const html = renderReportMarkup(viewModel, 'full');

      // No bad string literals in rendered output
      expect(html).not.toContain('>NaN<');
      expect(html).not.toContain('>undefined<');
      expect(html).not.toContain('>null<');

      // All 4 acts present
      expect(html).toContain('data-act="1"');
      expect(html).toContain('data-act="2"');
      expect(html).toContain('data-act="3"');
      expect(html).toContain('data-act="4"');

      // Landing section present
      expect(html).toContain('data-role="landing"');

      // Credibility strip rendered (single provenance surface for the landing)
      expect(html).toContain('sr-credibility-strip');
      expect(html).toContain('classified');
      expect(html).toContain('conn reuse');

      // Footer present
      expect(html).toContain('data-role="persistent-footer"');

      // Mood attribute set
      expect(html).toMatch(/data-mood="(urgent|sober|affirming)"/);
    }
  });

  describe('round 1 enrichment stories', () => {
    const confidentLcpStoryAggregate = {
      ...strongLcpCoverageAggregateFixture,
      lcp_story: {
        dominant_subpart: 'element_render_delay',
        dominant_subpart_share_pct: 52,
        dominant_culprit_kind: 'hero_image',
        subpart_distribution_pct: {
          ttfb: 18,
          resource_load_delay: 12,
          resource_load_time: 18,
          element_render_delay: 52
        }
      }
    } as const;

    const hedgedLcpStoryAggregate = {
      ...strongLcpCoverageAggregateFixture,
      lcp_story: {
        dominant_subpart: 'ttfb',
        dominant_subpart_share_pct: 28,
        dominant_culprit_kind: 'hero_image',
        subpart_distribution_pct: {
          ttfb: 28,
          resource_load_delay: 24,
          resource_load_time: 26,
          element_render_delay: 22
        }
      }
    } as const;

    const unknownCulpritAggregate = {
      ...strongLcpCoverageAggregateFixture,
      lcp_story: {
        dominant_subpart: 'resource_load_time',
        dominant_subpart_share_pct: 48,
        dominant_culprit_kind: 'unknown',
        subpart_distribution_pct: {
          ttfb: 18,
          resource_load_delay: 14,
          resource_load_time: 48,
          element_render_delay: 20
        }
      }
    } as const;

    const confidentInpStoryAggregate = {
      ...strongLcpCoverageAggregateFixture,
      inp_story: {
        dominant_phase: 'processing',
        dominant_phase_share_pct: 61,
        phase_distribution_pct: {
          input_delay: 18,
          processing: 61,
          presentation: 21
        }
      }
    } as const;

    const hedgedInpStoryAggregate = {
      ...strongLcpCoverageAggregateFixture,
      inp_story: {
        dominant_phase: 'processing',
        dominant_phase_share_pct: 32,
        phase_distribution_pct: {
          input_delay: 34,
          processing: 32,
          presentation: 34
        }
      }
    } as const;

    it('builds a confident LCP story view-model with dominant row tinted and culprit clause appended', () => {
      const viewModel = buildReportViewModel(confidentLcpStoryAggregate);
      const story = viewModel.race.lcp_story;

      expect(story).not.toBeNull();
      expect(story?.is_hedged).toBe(false);
      expect(story?.dominant_subpart).toBe('element_render_delay');
      expect(story?.dominant_culprit_kind).toBe('hero_image');
      expect(story?.narrative).toContain('Element render delay dominates');
      expect(story?.narrative).toContain('Usually a hero image.');
      expect(story?.rows).toHaveLength(4);
      const dominant = story?.rows.find((row) => row.is_dominant);
      expect(dominant?.key).toBe('element_render_delay');
      expect(dominant?.share).toBe(52);
      expect(story?.rows.filter((row) => row.is_dominant)).toHaveLength(1);
    });

    it('falls back to the hedged narrative when no subpart clears the dominance threshold', () => {
      const viewModel = buildReportViewModel(hedgedLcpStoryAggregate);
      const story = viewModel.race.lcp_story;

      expect(story?.is_hedged).toBe(true);
      expect(story?.dominant_subpart).toBeNull();
      expect(story?.dominant_culprit_kind).toBeNull();
      expect(story?.narrative).toBe('Paint delay is spread across multiple phases — no single cause dominates.');
      expect(story?.rows.every((row) => row.is_dominant === false)).toBe(true);
    });

    it('omits the culprit clause when the classifier returns unknown', () => {
      const viewModel = buildReportViewModel(unknownCulpritAggregate);
      const story = viewModel.race.lcp_story;

      expect(story?.is_hedged).toBe(false);
      expect(story?.dominant_subpart).toBe('resource_load_time');
      expect(story?.dominant_culprit_kind).toBeNull();
      expect(story?.narrative).toContain('takes too long to travel the wire');
      expect(story?.narrative).not.toMatch(/Usually a|Usually the/);
    });

    it('returns race.lcp_story === null when the aggregate carries no lcp_story (Safari/FF/legacy)', () => {
      const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
      expect(viewModel.race.lcp_story).toBeNull();
    });

    it('builds a confident INP story view-model gated on the INP funnel stage being active', () => {
      const viewModel = buildReportViewModel(confidentInpStoryAggregate);
      const story = viewModel.act3.inp_story;

      expect(viewModel.act3.active_stage_keys).toContain('inp');
      expect(story).not.toBeNull();
      expect(story?.is_hedged).toBe(false);
      expect(story?.dominant_phase).toBe('processing');
      expect(story?.narrative).toContain('handler work after the click');
    });

    it('falls back to the hedged INP narrative when no phase clears the dominance threshold', () => {
      const viewModel = buildReportViewModel(hedgedInpStoryAggregate);
      const story = viewModel.act3.inp_story;

      expect(story?.is_hedged).toBe(true);
      expect(story?.dominant_phase).toBeNull();
      expect(story?.narrative).toBe('Interaction lag is spread across multiple phases — no single cause dominates.');
    });

    it('returns act3.inp_story === null when the INP funnel stage is not active (coverage-thin)', () => {
      const viewModel = buildReportViewModel({
        ...lowInpCoverageAggregateFixture,
        inp_story: {
          dominant_phase: 'processing',
          dominant_phase_share_pct: 61,
          phase_distribution_pct: {
            input_delay: 18,
            processing: 61,
            presentation: 21
          }
        }
      });

      expect(viewModel.act3.active_stage_keys).not.toContain('inp');
      expect(viewModel.act3.inp_story).toBeNull();
    });

    it('returns act3.inp_story === null on legacy aggregates that have no experience funnel', () => {
      const legacyAggregate = decodeSignalReportUrl(
        'https://signal.stroma.design/r?mode=production&d=example.co.za&nt=25,25,25,25,0&dt=34,33,33&lu=2100&lt=4200&fu=1100&ft=1900&tu=220&tt=380&ulc=100&ufc=100&utc=100&clc=100&cfc=100&ctc=100&s=100&p=7&nc=100&nu=0&nr=0&lc=100&ct=moderate&rm=lcp'
      );
      const viewModel = buildReportViewModel(legacyAggregate);

      expect(viewModel.act3.mode).toBe('legacy');
      expect(viewModel.act3.inp_story).toBeNull();
    });

    it('renders the Act 2 LCP narrative + micro-chart and the Act 3 INP caption in the markup', () => {
      const aggregate = {
        ...confidentLcpStoryAggregate,
        inp_story: confidentInpStoryAggregate.inp_story
      };
      const viewModel = buildReportViewModel(aggregate);
      const html = renderReportMarkup(viewModel, 'full');

      expect(html).toContain('sr-lcp-story');
      expect(html).toContain('Element render delay dominates');
      expect(html).toContain('Usually a hero image.');
      expect(html).toContain('data-dominant-subpart="element_render_delay"');
      expect(html).toContain('data-subpart="element_render_delay"');
      expect(html).toContain('data-hedged="false"');

      expect(html).toContain('sr-funnel-node-story');
      expect(html).toContain('handler work after the click');
    });

    it('omits the Act 2 LCP story block entirely when race.lcp_story is null', () => {
      const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
      const html = renderReportMarkup(viewModel, 'full');

      expect(viewModel.race.lcp_story).toBeNull();
      expect(html).not.toContain('sr-lcp-story');
    });

    it('omits the Act 3 INP caption when act3.inp_story is null', () => {
      const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
      const html = renderReportMarkup(viewModel, 'full');

      expect(viewModel.act3.inp_story).toBeNull();
      expect(html).not.toContain('sr-funnel-node-story');
    });

    it('builds a heavy third-party pre-race headline with median share in the copy', () => {
      const aggregate = {
        ...strongLcpCoverageAggregateFixture,
        third_party_story: {
          median_share_pct: 38,
          dominant_tier: 'heavy' as const,
          dominant_tier_share_pct: 54,
          median_origin_count: 8
        }
      };
      const viewModel = buildReportViewModel(aggregate);
      const story = viewModel.race.third_party_story;

      expect(story).not.toBeNull();
      expect(story?.dominant_tier).toBe('heavy');
      expect(story?.median_share_pct).toBe(38);
      expect(story?.median_origin_count).toBe(8);
      expect(story?.narrative).toContain('38%');
      expect(story?.narrative).toContain('off-domain tags');
    });

    it('narrates a none-tier third-party story positively (absence is a feature)', () => {
      const aggregate = {
        ...strongLcpCoverageAggregateFixture,
        third_party_story: {
          median_share_pct: 0,
          dominant_tier: 'none' as const,
          dominant_tier_share_pct: 82,
          median_origin_count: null
        }
      };
      const viewModel = buildReportViewModel(aggregate);
      const story = viewModel.race.third_party_story;

      expect(story?.dominant_tier).toBe('none');
      expect(story?.narrative).toBe('The pre-paint is served entirely from your own origins.');
      expect(story?.median_origin_count).toBeNull();
    });

    it('uses the light and moderate tier copy without naming a percent when tier is the dominant fact', () => {
      const lightAggregate = {
        ...strongLcpCoverageAggregateFixture,
        third_party_story: {
          median_share_pct: 8,
          dominant_tier: 'light' as const,
          dominant_tier_share_pct: 71,
          median_origin_count: 4
        }
      };
      const moderateAggregate = {
        ...strongLcpCoverageAggregateFixture,
        third_party_story: {
          median_share_pct: 22,
          dominant_tier: 'moderate' as const,
          dominant_tier_share_pct: 63,
          median_origin_count: 5
        }
      };

      const lightStory = buildReportViewModel(lightAggregate).race.third_party_story;
      const moderateStory = buildReportViewModel(moderateAggregate).race.third_party_story;

      expect(lightStory?.narrative).toBe('Third-party script weight is modest before first paint.');
      expect(moderateStory?.narrative).toContain('22%');
      expect(moderateStory?.narrative).toContain('third-party');
    });

    it('returns race.third_party_story === null when the aggregate carries no third_party_story', () => {
      const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
      expect(viewModel.race.third_party_story).toBeNull();
    });

    it('renders the third-party pre-race headline before the race grid with tier data-attr', () => {
      const aggregate = {
        ...strongLcpCoverageAggregateFixture,
        third_party_story: {
          median_share_pct: 38,
          dominant_tier: 'heavy' as const,
          dominant_tier_share_pct: 54,
          median_origin_count: 8
        }
      };
      const viewModel = buildReportViewModel(aggregate);
      const html = renderReportMarkup(viewModel, 'full');

      expect(html).toContain('sr-third-party-headline');
      expect(html).toContain('data-third-party-tier="heavy"');
      expect(html).toContain('38%');
      expect(html).toContain('8 off-domain origins');

      // Pre-race positioning: headline must appear before the sr-race grid in source order.
      const headlineIndex = html.indexOf('sr-third-party-headline');
      const raceIndex = html.indexOf('class="sr-race"');
      expect(headlineIndex).toBeGreaterThan(-1);
      expect(raceIndex).toBeGreaterThan(-1);
      expect(headlineIndex).toBeLessThan(raceIndex);
    });

    it('omits the third-party headline entirely when race.third_party_story is null', () => {
      const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
      const html = renderReportMarkup(viewModel, 'full');

      expect(viewModel.race.third_party_story).toBeNull();
      expect(html).not.toContain('sr-third-party-headline');
    });

    it('hides the origin count from the headline when median_origin_count is null (privacy mask)', () => {
      const aggregate = {
        ...strongLcpCoverageAggregateFixture,
        third_party_story: {
          median_share_pct: 24,
          dominant_tier: 'moderate' as const,
          dominant_tier_share_pct: 58,
          median_origin_count: null
        }
      };
      const viewModel = buildReportViewModel(aggregate);
      const html = renderReportMarkup(viewModel, 'full');

      expect(html).toContain('sr-third-party-headline');
      expect(html).not.toContain('off-domain origins');
    });
  });
});
