import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEVICE_SCORE_BOUNDARIES,
  DEFAULT_NETWORK_THRESHOLDS,
  formatDeviceSignature,
  formatNetworkBand,
  type SignalDeviceScoreBoundaries,
  type SignalDeviceTier,
  type SignalNetworkTier,
  type SignalNetworkTierThresholds
} from '../src/index.js';

describe('DEFAULT_NETWORK_THRESHOLDS canonical values', () => {
  it('preserves the 50 / 150 / 400 ms TCP boundary trio the SDK has shipped since 0.1', () => {
    // Pin the three numbers explicitly so a tuning change has to update
    // both the constant and this assertion. Downstream report copy and
    // every doc that cites these numbers is derived from this constant —
    // an unintended edit would silently move the band labels.
    expect(DEFAULT_NETWORK_THRESHOLDS.urban).toBe(50);
    expect(DEFAULT_NETWORK_THRESHOLDS.moderate).toBe(150);
    expect(DEFAULT_NETWORK_THRESHOLDS.constrained_moderate).toBe(400);
  });
});

describe('formatNetworkBand', () => {
  const allTiers: SignalNetworkTier[] = ['urban', 'moderate', 'constrained_moderate', 'constrained'];

  it.each(allTiers)('returns a non-empty string with the "ms TCP" suffix for %s', (tier) => {
    const band = formatNetworkBand(tier);
    expect(band).toMatch(/ms TCP$/);
    expect(band.length).toBeGreaterThan(0);
  });

  it('uses canonical glyphs (`<`, `≥`, en-dash) so report copy stays typographically consistent', () => {
    expect(formatNetworkBand('urban')).toBe('< 50 ms TCP');
    expect(formatNetworkBand('moderate')).toBe('50–150 ms TCP');
    expect(formatNetworkBand('constrained_moderate')).toBe('150–400 ms TCP');
    expect(formatNetworkBand('constrained')).toBe('≥ 400 ms TCP');
  });

  it('reflects custom thresholds when supplied explicitly', () => {
    const tighter: SignalNetworkTierThresholds = { urban: 30, moderate: 100, constrained_moderate: 300 };
    expect(formatNetworkBand('urban', tighter)).toBe('< 30 ms TCP');
    expect(formatNetworkBand('moderate', tighter)).toBe('30–100 ms TCP');
    expect(formatNetworkBand('constrained_moderate', tighter)).toBe('100–300 ms TCP');
    expect(formatNetworkBand('constrained', tighter)).toBe('≥ 300 ms TCP');
  });
});

describe('DEFAULT_DEVICE_SCORE_BOUNDARIES canonical values', () => {
  it('preserves the SDK score-staircase numbers the device classifier has shipped since 0.1', () => {
    expect(DEFAULT_DEVICE_SCORE_BOUNDARIES.cores).toEqual({ low: 2, mid: 4, high: 6 });
    expect(DEFAULT_DEVICE_SCORE_BOUNDARIES.memory_gb).toEqual({ low: 1, mid: 2, high: 4 });
    expect(DEFAULT_DEVICE_SCORE_BOUNDARIES.screen_w).toEqual({ mobile: 480, tablet: 768, desktop: 1280 });
  });
});

describe('formatDeviceSignature', () => {
  const allTiers: SignalDeviceTier[] = ['low', 'mid', 'high'];

  it.each(allTiers)('returns a non-empty signature for %s', (tier) => {
    const signature = formatDeviceSignature(tier);
    expect(signature.length).toBeGreaterThan(0);
    expect(signature).toContain('cores');
    expect(signature).toContain('GB');
    expect(signature).toContain('px');
  });

  it('emits the canonical signatures using DEFAULT_DEVICE_SCORE_BOUNDARIES', () => {
    expect(formatDeviceSignature('high')).toBe('6+ cores · 4+ GB · 1280px+');
    expect(formatDeviceSignature('mid')).toBe('4–6 cores · 2–4 GB · 768px+');
    expect(formatDeviceSignature('low')).toBe('≤2 cores · ≤1 GB · <768px');
  });

  it('reflects custom score boundaries when supplied explicitly', () => {
    const lifted: SignalDeviceScoreBoundaries = {
      cores: { low: 4, mid: 6, high: 8 },
      memory_gb: { low: 2, mid: 4, high: 8 },
      screen_w: { mobile: 600, tablet: 900, desktop: 1440 }
    };
    expect(formatDeviceSignature('high', lifted)).toBe('8+ cores · 8+ GB · 1440px+');
    expect(formatDeviceSignature('mid', lifted)).toBe('6–8 cores · 4–8 GB · 900px+');
    expect(formatDeviceSignature('low', lifted)).toBe('≤4 cores · ≤2 GB · <900px');
  });
});

describe('canonical-thresholds drift guard for downstream call sites', () => {
  // If a downstream renderer ever drifts away from the helper output
  // (e.g. someone hand-edits the report-markup or report-view-model
  // copy and forgets to import the helper), this test pins the exact
  // strings each helper produces so reviewers see the diff in one
  // place rather than chasing it across the codebase.
  it('every classified network tier produces a stable signature string', () => {
    expect(formatNetworkBand('urban')).toBe('< 50 ms TCP');
    expect(formatNetworkBand('moderate')).toBe('50–150 ms TCP');
    expect(formatNetworkBand('constrained_moderate')).toBe('150–400 ms TCP');
    expect(formatNetworkBand('constrained')).toBe('≥ 400 ms TCP');
  });

  it('every device tier produces a stable signature string', () => {
    expect(formatDeviceSignature('high')).toBe('6+ cores · 4+ GB · 1280px+');
    expect(formatDeviceSignature('mid')).toBe('4–6 cores · 2–4 GB · 768px+');
    expect(formatDeviceSignature('low')).toBe('≤2 cores · ≤1 GB · <768px');
  });
});
