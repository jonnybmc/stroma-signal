import { describe, expect, it } from 'vitest';

import {
  affirmingAggregateFixture,
  emptyFunnelAggregateFixture,
  formatSignalSummary,
  fullDepthAggregateFixture,
  noHardwareBlockAggregateFixture,
  strongLcpCoverageAggregateFixture,
  zeroClassifiedAggregateFixture
} from '../src/index.js';

describe('formatSignalSummary', () => {
  it('renders strong LCP coverage fixture with tier distribution and race', () => {
    const output = formatSignalSummary(strongLcpCoverageAggregateFixture);
    expect(output).toContain('Signal Report');
    expect(output).toContain('example.co.za');
    expect(output).toContain('Urban');
    expect(output).toContain('Constrained');
    expect(output).toContain('LCP');
    expect(output).toContain('Wait delta');
    expect(output).toContain('Poor session share');
  });

  it('renders affirming fixture with low gap', () => {
    const output = formatSignalSummary(affirmingAggregateFixture);
    expect(output).toContain('Signal Report');
    expect(output).toContain('Moderate');
  });

  it('handles zero-classified aggregate', () => {
    const output = formatSignalSummary(zeroClassifiedAggregateFixture);
    expect(output).toContain('No comparable race available');
  });

  it('handles legacy aggregate without experience funnel', () => {
    const output = formatSignalSummary(emptyFunnelAggregateFixture);
    expect(output).toContain('Legacy aggregate');
    expect(output).toContain('Regenerate URL');
  });

  it('handles aggregate without hardware blocks gracefully', () => {
    const output = formatSignalSummary(noHardwareBlockAggregateFixture);
    expect(output).toContain('Signal Report');
    expect(output).toContain('Network tiers');
    expect(output).toContain('Device tiers');
  });

  it('renders full depth fixture with all sections', () => {
    const output = formatSignalSummary(fullDepthAggregateFixture);
    expect(output).toContain('Form factor');
    expect(output).toContain('Mobile');
    expect(output).toContain('Experience funnel');
    expect(output).toContain('Coverage');
  });

  it('includes warnings when present', () => {
    const output = formatSignalSummary(zeroClassifiedAggregateFixture);
    if (zeroClassifiedAggregateFixture.warnings.length > 0) {
      expect(output).toContain('Warnings');
    }
  });

  it('renders LCP story and INP story sections when present on the aggregate', () => {
    const enriched = {
      ...strongLcpCoverageAggregateFixture,
      lcp_story: {
        dominant_subpart: 'element_render_delay' as const,
        dominant_subpart_share_pct: 74,
        dominant_culprit_kind: 'hero_image' as const,
        subpart_distribution_pct: {
          ttfb: 8,
          resource_load_delay: 6,
          resource_load_time: 12,
          element_render_delay: 74
        }
      },
      inp_story: {
        dominant_phase: 'processing' as const,
        dominant_phase_share_pct: 62,
        phase_distribution_pct: {
          input_delay: 14,
          processing: 62,
          presentation: 24
        }
      }
    };

    const output = formatSignalSummary(enriched);

    expect(output).toContain('LCP story');
    expect(output).toContain('Render delay');
    expect(output).toContain('Hero image');
    expect(output).toContain('INP story');
    expect(output).toContain('Processing');
  });

  it('omits LCP story and INP story sections when absent on the aggregate', () => {
    const output = formatSignalSummary(strongLcpCoverageAggregateFixture);

    expect(output).not.toContain('LCP story');
    expect(output).not.toContain('INP story');
    expect(output).not.toContain('Third-party');
  });

  it('renders Third-party section when third_party_story is present', () => {
    const enriched = {
      ...strongLcpCoverageAggregateFixture,
      third_party_story: {
        median_share_pct: 32,
        dominant_tier: 'moderate' as const,
        dominant_tier_share_pct: 58,
        median_origin_count: 6
      }
    };

    const output = formatSignalSummary(enriched);

    expect(output).toContain('Third-party');
    expect(output).toContain('Moderate');
    expect(output).toContain('32%');
  });

  it('renders Audience context section when context_story carries narratable values', () => {
    const enriched = {
      ...strongLcpCoverageAggregateFixture,
      context_story: {
        save_data_share_pct: 18,
        median_rtt_ms: 180,
        cellular_share_pct: 42,
        effective_type_dominant: '3g' as const
      }
    };

    const output = formatSignalSummary(enriched);

    expect(output).toContain('Audience context');
    expect(output).toContain('18%');
    expect(output).toContain('180ms');
    expect(output).toContain('3G dominant');
  });

  it('omits Audience context section when context_story has no narratable values', () => {
    const enriched = {
      ...strongLcpCoverageAggregateFixture,
      context_story: {
        save_data_share_pct: 0,
        median_rtt_ms: null,
        cellular_share_pct: 0,
        effective_type_dominant: 'unknown' as const
      }
    };

    const output = formatSignalSummary(enriched);

    expect(output).not.toContain('Audience context');
  });
});
