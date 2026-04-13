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
    expect(viewModel.offer_cards.map((card) => card.title)).toEqual(['Run a deeper scan', 'Talk to the team']);
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
    const cellKeys = cells.map((cell) => cell.key);
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

      // Evidence rail rendered
      expect(html).toContain('sr-evidence-rail');
      expect(html).toContain('sr-evidence-pill');

      // Credibility strip rendered
      expect(html).toContain('sr-credibility-strip');
      expect(html).toContain('classified');
      expect(html).toContain('conn reuse');

      // Footer present
      expect(html).toContain('data-role="persistent-footer"');

      // Mood attribute set
      expect(html).toMatch(/data-mood="(urgent|sober|affirming)"/);
    }
  });
});
