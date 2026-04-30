import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  chromeColdNavFixture,
  prerenderLifecycleFixture,
  restoreLifecycleFixture,
  toSignalWarehouseRow
} from '../src/index.js';
import type { SignalEventV1 } from '../src/types.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../');
const docPath = path.join(repoRoot, 'docs/warehouse-schema.md');

interface DocColumnRow {
  column: string;
  type: string;
  notes: string;
}

// Parse the single column table in warehouse-schema.md. Returns one row per
// data line. The doc has exactly one markdown table — a header row, the
// `| --- |` separator, then one row per warehouse column.
function parseWarehouseColumnTable(doc: string): DocColumnRow[] {
  const lines = doc.split('\n');
  const rows: DocColumnRow[] = [];
  let inTable = false;
  let sawSeparator = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('| Column ')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (trimmed.startsWith('| ---')) {
      sawSeparator = true;
      continue;
    }
    if (sawSeparator && !trimmed.startsWith('|')) {
      // Table ended.
      break;
    }
    if (!sawSeparator) continue;
    // Split on `|`, trim, drop empty leading/trailing cells.
    const cells = trimmed.split('|').map((cell) => cell.trim());
    // Cells: ['', column, type, notes, ''] with leading/trailing pipes.
    const meaningful = cells.filter((_, idx) => idx !== 0 && idx !== cells.length - 1);
    if (meaningful.length < 3) continue;
    const [columnRaw, type, ...rest] = meaningful;
    // Strip surrounding backticks from the column-name cell.
    const column = columnRaw.replace(/^`/, '').replace(/`$/, '');
    rows.push({ column, type, notes: rest.join(' | ') });
  }
  return rows;
}

// Build a maximally enriched event so optional warehouse columns
// (lcp_breakdown, third_party, loaf, culprit_kind, dominant_phase,
// visibility_hidden_at_load) all materialize on the row. Every field
// the warehouse contract can carry is present on this fixture.
function buildEnrichedEvent(): SignalEventV1 {
  const baseLcp = chromeColdNavFixture.vitals.lcp_attribution;
  const baseInp = chromeColdNavFixture.vitals.inp_attribution;
  if (!baseLcp || !baseInp) {
    throw new Error('chromeColdNavFixture must populate both attribution blocks');
  }
  return {
    ...chromeColdNavFixture,
    event_id: 'evt_enriched',
    vitals: {
      ...chromeColdNavFixture.vitals,
      lcp_attribution: { ...baseLcp, culprit_kind: 'hero_image' },
      inp_attribution: { ...baseInp, dominant_phase: 'processing' },
      lcp_breakdown: {
        resource_load_delay_ms: 240,
        resource_load_time_ms: 6_180,
        element_render_delay_ms: 1_320
      },
      third_party: {
        pre_lcp_script_share_pct: 38,
        origin_count: 7
      },
      loaf: {
        worst_duration_ms: 240,
        dominant_cause: 'script',
        script_origin_count: 3
      }
    },
    context: {
      ...chromeColdNavFixture.context,
      visibility_hidden_at_load: false
    }
  };
}

const ALLOWED_BIGQUERY_TYPES = new Set(['INT64', 'STRING', 'FLOAT64', 'BOOL', 'TIMESTAMP']);

// Inline-enumerated columns: where the doc spells out the allowed values
// in the Notes cell, those values must match the canonical TypeScript
// union exactly. Drift in either direction (missing canonical value, or
// stale doc-only value) fails the test.
const ENUMERATED_COLUMNS: Array<{ column: string; canonical: readonly string[] }> = [
  { column: 'net_tier', canonical: ['urban', 'moderate', 'constrained_moderate', 'constrained'] },
  {
    column: 'net_tcp_source',
    canonical: [
      'nav_timing_tcp_isolated',
      'nav_timing_full',
      'unavailable_reused',
      'unavailable_sw',
      'unavailable_tls_coalesced',
      'unavailable_missing_timing'
    ]
  },
  { column: 'device_tier', canonical: ['low', 'mid', 'high'] },
  { column: 'navigation_type', canonical: ['navigate', 'reload', 'back-forward', 'prerender', 'restore'] },
  { column: 'lcp_load_state', canonical: ['loading', 'interactive', 'complete'] },
  { column: 'lcp_element_type', canonical: ['image', 'text'] },
  { column: 'inp_load_state', canonical: ['loading', 'interactive', 'complete'] },
  { column: 'interaction_type', canonical: ['pointer', 'keyboard'] },
  {
    column: 'lcp_attribution_culprit_kind',
    canonical: ['hero_image', 'headline_text', 'banner_image', 'product_image', 'video_poster', 'unknown']
  },
  { column: 'inp_attribution_dominant_phase', canonical: ['input_delay', 'processing', 'presentation'] },
  { column: 'loaf_dominant_cause', canonical: ['script', 'layout', 'style', 'paint'] }
];

// Union of every canonical enum value across all enumerated columns.
// Used by the stale-value guard so cross-references — e.g. the `net_tier`
// row backticking `restore` / `prerender` to point at the navigation_type
// gating that nulls the column — are not mis-flagged as drift.
const ALL_CANONICAL_VALUES = new Set<string>(ENUMERATED_COLUMNS.flatMap(({ canonical }) => canonical));

describe('warehouse-schema.md alignment with toSignalWarehouseRow + canonical types', () => {
  const doc = fs.readFileSync(docPath, 'utf8');
  const docRows = parseWarehouseColumnTable(doc);
  const docColumns = new Set(docRows.map((row) => row.column));

  it('parses a non-trivial column table from the doc', () => {
    // Sanity guard so a future doc rewrite that drops the table doesn't
    // cause the rest of the suite to silently pass.
    expect(docRows.length).toBeGreaterThan(40);
    expect(docColumns.has('event_id')).toBe(true);
    expect(docColumns.has('context_visibility_hidden_at_load')).toBe(true);
  });

  it('every column documented in warehouse-schema.md is emitted by toSignalWarehouseRow', () => {
    const enriched = buildEnrichedEvent();
    const emittedKeys = new Set(Object.keys(toSignalWarehouseRow(enriched)));
    const docOnly: string[] = [];
    for (const column of docColumns) {
      if (!emittedKeys.has(column)) docOnly.push(column);
    }
    expect(docOnly, `Doc lists columns that toSignalWarehouseRow does not emit: ${docOnly.join(', ')}`).toEqual([]);
  });

  it('every column emitted by toSignalWarehouseRow is documented in warehouse-schema.md', () => {
    const enriched = buildEnrichedEvent();
    const emittedKeys = Object.keys(toSignalWarehouseRow(enriched));
    const undocumented = emittedKeys.filter((key) => !docColumns.has(key));
    expect(undocumented, `toSignalWarehouseRow emits columns not in the doc table: ${undocumented.join(', ')}`).toEqual(
      []
    );
  });

  it('every column has a recognized BigQuery scalar type', () => {
    const wrong: string[] = [];
    for (const row of docRows) {
      if (!ALLOWED_BIGQUERY_TYPES.has(row.type)) {
        wrong.push(`${row.column} → "${row.type}"`);
      }
    }
    expect(
      wrong,
      `Columns with unrecognized BigQuery type (allowed: ${[...ALLOWED_BIGQUERY_TYPES].join(', ')}): ${wrong.join(', ')}`
    ).toEqual([]);
  });

  describe('inline enumerated values match the canonical TypeScript unions', () => {
    for (const { column, canonical } of ENUMERATED_COLUMNS) {
      it(`${column} notes enumerate exactly the canonical union`, () => {
        const row = docRows.find((r) => r.column === column);
        if (!row) throw new Error(`Column ${column} missing from doc table`);
        const notes = row.notes;
        const missingFromDoc = canonical.filter((value) => !notes.includes(`\`${value}\``));
        expect(
          missingFromDoc,
          `${column} notes missing canonical values (must appear backticked): ${missingFromDoc.join(', ')}`
        ).toEqual([]);

        // Stale value guard: any backticked snake_case identifier in the
        // notes that LOOKS like an enum value but isn't in ANY canonical
        // union is drift. The cross-union allowlist lets the `net_tier`
        // row reference `restore` / `prerender` (canonical navigation_type
        // values) without false positives.
        const backtickedTokens = [...notes.matchAll(/`([a-z][a-z0-9_-]{2,})`/g)].map((m) => m[1]);
        const stale = backtickedTokens.filter((token) => !ALL_CANONICAL_VALUES.has(token));
        expect(
          stale,
          `${column} notes contain backticked values not in any canonical union: ${stale.join(', ')}`
        ).toEqual([]);
      });
    }
  });

  describe('load-scoped vitals null on restore/prerender events', () => {
    // The doc claims `net_tier`, `net_tcp_ms`, `lcp_ms`, `fcp_ms`, `ttfb_ms`
    // are null for non-load-shaped restore/prerender rows. Prove the
    // claim end-to-end through the warehouse contract using the
    // restore/prerender fixtures (which mirror what the SDK runtime
    // produces — see packages/signal/src/core/runtime.ts).
    const LOAD_SCOPED_NULL_COLUMNS = ['net_tier', 'net_tcp_ms', 'lcp_ms', 'fcp_ms', 'ttfb_ms'] as const;

    it('restore lifecycle event nulls load-scoped vitals columns', () => {
      const row = toSignalWarehouseRow(restoreLifecycleFixture);
      for (const column of LOAD_SCOPED_NULL_COLUMNS) {
        expect(row[column], `${column} must be null on restore`).toBeNull();
      }
      expect(row.navigation_type).toBe('restore');
    });

    it('prerender lifecycle event nulls load-scoped vitals columns', () => {
      const row = toSignalWarehouseRow(prerenderLifecycleFixture);
      for (const column of LOAD_SCOPED_NULL_COLUMNS) {
        expect(row[column], `${column} must be null on prerender`).toBeNull();
      }
      expect(row.navigation_type).toBe('prerender');
    });
  });
});
