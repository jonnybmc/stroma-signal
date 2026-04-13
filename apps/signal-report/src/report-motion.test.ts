import {
  affirmingAggregateFixture,
  lowInpCoverageAggregateFixture,
  strongLcpCoverageAggregateFixture
} from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { clampSlideIndex, computePhaseForSlide, DECK_TOTAL_SLIDES } from './report-motion';
import { buildReportViewModel, extractMotionPayload } from './report-view-model';

describe('extractMotionPayload', () => {
  it('carries every tier share and particle budget the canvas needs', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const payload = extractMotionPayload(viewModel);

    expect(payload.act1.tiers).toHaveLength(viewModel.act1_tiers.length);
    for (const tier of payload.act1.tiers) {
      const source = viewModel.act1_tiers.find((entry) => entry.key === tier.key);
      expect(source).toBeDefined();
      expect(tier.share).toBe(source?.share);
      expect(tier.particleCount).toBe(source?.particleCount);
    }
  });

  it('mirrors the mood tier so particle intensity stays in sync with copy tone', () => {
    const urgent = extractMotionPayload(buildReportViewModel(strongLcpCoverageAggregateFixture));
    const affirming = extractMotionPayload(buildReportViewModel(affirmingAggregateFixture));

    expect(urgent.mood).toBe('urgent');
    expect(affirming.mood).toBe('affirming');
  });

  it('passes the race timings the Act 2 motion needs, honouring availability', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const payload = extractMotionPayload(viewModel);

    expect(payload.act2.available).toBe(viewModel.race.race_available);
    expect(payload.act2.urban_ms).toBe(viewModel.race.urban_ms);
    expect(payload.act2.comparison_ms).toBe(viewModel.race.comparison_ms);
    expect(payload.act2.wait_delta_ms).toBe(viewModel.race.wait_delta_ms);
  });

  it('passes every active Act 3 stage with its weighted poor share and scene budgets', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const payload = extractMotionPayload(viewModel);

    expect(payload.act3.mode).toBe(viewModel.act3.mode);
    expect(payload.act3.poor_session_share).toBe(viewModel.act3.poor_session_share);
    expect(payload.act3.stages.map((stage) => stage.key)).toEqual(viewModel.act3.stages.map((stage) => stage.key));
    for (const stage of payload.act3.stages) {
      const source = viewModel.act3.stages.find((entry) => entry.key === stage.key);
      expect(source).toBeDefined();
      expect(stage.weighted_poor_share).toBe(source?.weighted_poor_share);
      expect(stage.flow_body_count).toBe(source?.flow_body_count);
      expect(stage.drop_body_count).toBe(source?.drop_body_count);
    }
  });

  it('reduces the Act 3 payload honestly when coverage forces a reduced funnel', () => {
    const viewModel = buildReportViewModel(lowInpCoverageAggregateFixture);
    const payload = extractMotionPayload(viewModel);

    expect(payload.act3.mode).toBe('reduced');
    expect(payload.act3.stages.every((stage) => stage.key !== 'inp')).toBe(true);
  });

  it('never leaks forbidden commercial fields into the motion payload', () => {
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const payload = extractMotionPayload(viewModel);
    const serialized = JSON.stringify(payload).toLowerCase();

    for (const forbidden of ['revenue', 'exposure', 'monthly', 'asv', 'mts', 'zar']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('maps each deck slide index to the right particle phase', () => {
    expect(computePhaseForSlide(0)).toBe('reveal');
    expect(computePhaseForSlide(1)).toBe('cluster-hold');
    expect(computePhaseForSlide(2)).toBe('race');
    expect(computePhaseForSlide(3)).toBe('funnel');
    expect(computePhaseForSlide(4)).toBe('horizon');
  });

  it('clamps out-of-range slide indices so URL hash tampering cannot crash the deck', () => {
    expect(clampSlideIndex(-1)).toBe(0);
    expect(clampSlideIndex(0)).toBe(0);
    expect(clampSlideIndex(DECK_TOTAL_SLIDES - 1)).toBe(DECK_TOTAL_SLIDES - 1);
    expect(clampSlideIndex(DECK_TOTAL_SLIDES)).toBe(DECK_TOTAL_SLIDES - 1);
    expect(clampSlideIndex(99)).toBe(DECK_TOTAL_SLIDES - 1);
    expect(clampSlideIndex(Number.NaN)).toBe(0);
    expect(clampSlideIndex(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampSlideIndex(2.8)).toBe(2);
  });

  it('clamps phase mapping when given invalid indices so reveal is always the fallback', () => {
    expect(computePhaseForSlide(-5)).toBe('reveal');
    expect(computePhaseForSlide(99)).toBe('horizon');
    expect(computePhaseForSlide(Number.NaN)).toBe('reveal');
  });

  it('keeps device tier segmentation out of the motion payload (network axis only)', () => {
    // Device segmentation is a static Act 1 legend — the canvas particle
    // system encodes network tier only. Guarding here prevents future
    // accidental leakage that would force the particle layer into a
    // second color/shape axis without a deliberate spec.
    const viewModel = buildReportViewModel(strongLcpCoverageAggregateFixture);
    const payload = extractMotionPayload(viewModel);
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toMatch(/device/i);
    expect(serialized).not.toMatch(/\b(high|mid|low)\b/);
  });
});
