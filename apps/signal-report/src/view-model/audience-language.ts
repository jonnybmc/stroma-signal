// Operator-language equivalents for the network/device tier criteria
// strings shown in the Audience section. The contracts package's
// `formatNetworkBand()` / `formatDeviceSignature()` helpers stay as
// the canonical technical descriptors (used by CLI / internal
// tooling); the report uses these friendlier versions so a paid-media
// / CMO / CRO reader gets an immediate mental anchor without parsing
// "≥ 400 ms TCP" or "≤2 cores · ≤1 GB · <768px".
//
// The technical specifics (TCP-handshake bands, cores/GB/px breakpoints)
// remain available to a curious downstream-engineering reader via the
// glossary tooltips and the `cohort` / `poor` / metric tooltips on the
// section.

import type { SignalDeviceTier, SignalNetworkTier } from '@stroma-labs/signal-contracts';

/**
 * Operator-friendly band descriptor for a network tier. Reads as a
 * mental anchor a paid-media / growth lead can place against their own
 * audience experience.
 */
export function networkBandForOperator(tier: SignalNetworkTier): string {
  switch (tier) {
    case 'urban':
      return 'Fast connection — fibre, cable, strong wifi';
    case 'moderate':
      return 'Stable connection — typical 4G, busy office wifi';
    case 'constrained_moderate':
      return 'Slower / fringe — weak 4G or fast 3G';
    case 'constrained':
      return 'Very slow — 3G / 2G or weak signal';
  }
}

/**
 * Operator-friendly device-class descriptor. Names the kind of device
 * the tier maps to, not the underlying CPU/memory/screen specs.
 */
export function deviceSignatureForOperator(tier: SignalDeviceTier): string {
  switch (tier) {
    case 'high':
      return 'High-end desktop, laptop, or flagship phone';
    case 'mid':
      return 'Mid-range laptop, tablet, or mid-tier phone';
    case 'low':
      return 'Budget phone, older laptop, or smaller screen';
  }
}
