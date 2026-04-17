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
});
