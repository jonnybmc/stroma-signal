import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../');
const docPath = path.join(repoRoot, 'docs/signal-technical-reference.md');

// Every event-schema field path that lives on SignalEventV1 (and its
// nested attribution / breakdown / third-party / loaf / context blocks).
// Every entry must appear in signal-technical-reference.md as a backticked
// field reference. The doc is the canonical onboarding document for
// technical readers — drift here costs every integrator's first hour.
//
// Maintenance contract: when a new field is added to SignalEventV1
// (packages/signal-contracts/src/types.ts), it must be added here AND
// to the doc in the same PR. The test fails fast otherwise.
const EVENT_FIELD_PATHS = [
  // Core identity
  'v',
  'event_id',
  'ts',
  'host',
  'url',
  'ref',
  // Network classification
  'net_tier',
  'net_tcp_ms',
  'net_tcp_source',
  // Device classification
  'device_tier',
  'device_cores',
  'device_memory_gb',
  'device_screen_w',
  'device_screen_h',
  // Vitals (top-level)
  'lcp_ms',
  'cls',
  'inp_ms',
  'fcp_ms',
  'ttfb_ms',
  // LCP attribution
  'lcp_attribution.load_state',
  'lcp_attribution.target',
  'lcp_attribution.element_type',
  'lcp_attribution.resource_url',
  'lcp_attribution.culprit_kind',
  // INP attribution
  'inp_attribution.load_state',
  'inp_attribution.interaction_target',
  'inp_attribution.interaction_type',
  'inp_attribution.interaction_time_ms',
  'inp_attribution.input_delay_ms',
  'inp_attribution.processing_duration_ms',
  'inp_attribution.presentation_delay_ms',
  'inp_attribution.dominant_phase',
  // LCP breakdown
  'vitals.lcp_breakdown.resource_load_delay_ms',
  'vitals.lcp_breakdown.resource_load_time_ms',
  'vitals.lcp_breakdown.element_render_delay_ms',
  // Third-party
  'vitals.third_party.pre_lcp_script_share_pct',
  'vitals.third_party.origin_count',
  // LoAF
  'vitals.loaf.worst_duration_ms',
  'vitals.loaf.dominant_cause',
  'vitals.loaf.script_origin_count',
  // Context
  'context.effective_type',
  'context.downlink_mbps',
  'context.rtt_ms',
  'context.save_data',
  'context.connection_type',
  'context.visibility_hidden_at_load',
  // Metadata
  'meta.pkg_version',
  'meta.browser',
  'meta.navigation_type',
  // Optional warehouse-join (host-populated, opt-in)
  'ga_session_id',
  'user_pseudo_id',
  'gclid',
  'conversion_fingerprint'
] as const;

// Network tier thresholds. Mirror DEFAULT_NETWORK_THRESHOLDS in
// packages/signal/src/core/classify-network.ts and the inclusive /
// exclusive boundary semantics in classifyTier(). The doc's threshold
// table must read identically.
const NETWORK_THRESHOLD_CLAIMS = [
  { tier: 'urban', range: '< 50 ms' },
  { tier: 'moderate', range: '50–150 ms (inclusive)' },
  { tier: 'constrained_moderate', range: '151–400 ms (inclusive)' },
  { tier: 'constrained', range: '> 400 ms' }
] as const;

// GA4 compact-subset roster. Mirrors flattenSignalEventForGa4 in
// packages/signal-contracts/src/ga4.ts (exactly 24 keys plus the `event`
// name itself). Drift here = a doc that miscounts GA4's 25-param ceiling.
const GA4_COMPACT_FIELDS = [
  'event_id',
  'host',
  'url',
  'net_tier',
  'net_tcp_ms',
  'net_tcp_source',
  'device_tier',
  'device_screen_w',
  'lcp_ms',
  'fcp_ms',
  'ttfb_ms',
  'browser',
  'navigation_type',
  'lcp_load_state',
  'lcp_element_type',
  'inp_load_state',
  'interaction_type',
  'input_delay_ms',
  'processing_duration_ms',
  'presentation_delay_ms',
  'lcp_culprit_kind',
  'lcp_dominant_subpart',
  'inp_dominant_phase',
  'third_party_weight_tier'
] as const;

// Public package subpaths. Each must appear in the Package Modules table.
const PUBLIC_SUBPATHS = [
  '@stroma-labs/signal',
  '@stroma-labs/signal/ga4',
  '@stroma-labs/signal/report',
  '@stroma-labs/signal/summary'
] as const;

const doc = fs.readFileSync(docPath, 'utf8');

describe('signal-technical-reference.md alignment with SignalEventV1 + adjacent contracts', () => {
  describe('every documented event field exists in the canonical type tree', () => {
    for (const fieldPath of EVENT_FIELD_PATHS) {
      it(`doc references \`${fieldPath}\` (or a fully-qualified \`vitals.${fieldPath}\`/\`event.${fieldPath}\`)`, () => {
        // Accept either the bare field path or a `vitals.`/`event.` prefix
        // that resolves to the same leaf. Top-level vitals fields like
        // `lcp_ms` are documented unprefixed; nested ones like
        // `vitals.loaf.worst_duration_ms` are documented with the full path.
        const candidates = [
          `\`${fieldPath}\``,
          `\`vitals.${fieldPath}\``,
          `\`event.${fieldPath}\``,
          `\`signal.${fieldPath}\``
        ];
        const matched = candidates.some((candidate) => doc.includes(candidate));
        expect(matched, `\`${fieldPath}\` (or a prefixed variant) is missing from the doc`).toBe(true);
      });
    }
  });

  describe('network tier threshold table matches classifyTier semantics', () => {
    for (const { tier, range } of NETWORK_THRESHOLD_CLAIMS) {
      it(`doc lists \`${tier}\` with range "${range}"`, () => {
        // The threshold table renders one row per tier with the range cell
        // in the second column. Look for the tier and range on the same line.
        const lines = doc.split('\n');
        const matchingRow = lines.find((line) => line.includes(`\`${tier}\``) && line.includes(range));
        expect(
          matchingRow,
          `No threshold-table row found for \`${tier}\` with range "${range}". Row may be using the wrong dash glyph or boundary text.`
        ).toBeDefined();
      });
    }
  });

  describe('GA4 compact-subset roster is complete and accurately counted', () => {
    it('doc claims 24 fields plus `event` for 25 total at the GA4 ceiling', () => {
      expect(doc).toContain('24 fields');
      expect(doc).toContain('25 total');
    });

    for (const field of GA4_COMPACT_FIELDS) {
      it(`GA4 compact subset names \`${field}\``, () => {
        expect(doc).toContain(`\`${field}\``);
      });
    }

    it('GA4 compact subset roster has exactly 24 backticked fields in the inline list', () => {
      // Find the sentence: "The GA4 compact subset includes 24 fields: ... — plus the `event` name itself"
      const match = doc.match(/The GA4 compact subset includes 24 fields:([^—]+)—/);
      if (!match) throw new Error('Could not locate the GA4 compact-subset roster sentence');
      const roster = match[1];
      const backticked = [...roster.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
      expect(backticked.length, `GA4 roster sentence backticks ${backticked.length} fields, expected 24`).toBe(24);
      // Every roster entry must be in the canonical set (and vice versa).
      const expectedSet = new Set<string>(GA4_COMPACT_FIELDS);
      const docSet = new Set(backticked);
      const docOnly = [...docSet].filter((field) => !expectedSet.has(field));
      const canonicalOnly = [...expectedSet].filter((field) => !docSet.has(field));
      expect(docOnly, `GA4 roster contains non-canonical fields: ${docOnly.join(', ')}`).toEqual([]);
      expect(canonicalOnly, `GA4 roster missing canonical fields: ${canonicalOnly.join(', ')}`).toEqual([]);
    });
  });

  describe('public package subpath roster is complete', () => {
    for (const subpath of PUBLIC_SUBPATHS) {
      it(`Package Modules table lists \`${subpath}\``, () => {
        expect(doc).toContain(`\`${subpath}\``);
      });
    }
  });

  describe('TCP source values table covers the canonical SignalNetTcpSource union', () => {
    const TCP_SOURCE_VALUES = [
      'nav_timing_tcp_isolated',
      'nav_timing_full',
      'unavailable_reused',
      'unavailable_sw',
      'unavailable_tls_coalesced',
      'unavailable_missing_timing'
    ];
    for (const value of TCP_SOURCE_VALUES) {
      it(`TCP source table lists \`${value}\``, () => {
        expect(doc).toContain(`\`${value}\``);
      });
    }
  });

  describe('navigation type table covers the canonical SignalNavigationType union', () => {
    const NAVIGATION_TYPES = ['navigate', 'reload', 'back-forward', 'prerender', 'restore'];
    for (const value of NAVIGATION_TYPES) {
      it(`Navigation type table lists \`${value}\``, () => {
        expect(doc).toContain(`\`${value}\``);
      });
    }
  });
});
