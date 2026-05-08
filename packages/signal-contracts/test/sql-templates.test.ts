import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { SIGNAL_GA4_FIELD_MAP_V1 } from '../src/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(currentDir, '../../../docs');
const ga4SafeFieldNames = Object.keys(SIGNAL_GA4_FIELD_MAP_V1.fields).sort();
const removedWarehouseOnlyFields = [
  'v',
  'ts',
  'ref',
  'device_cores',
  'device_memory_gb',
  // device_screen_w is now GA4-compact-eligible — it feeds form_factor_distribution
  // on both GA4 and normalized paths.
  'device_screen_h',
  'cls',
  'inp_ms',
  'effective_type',
  'downlink_mbps',
  'rtt_ms',
  'save_data',
  'connection_type',
  'pkg_version',
  'lcp_target',
  'lcp_resource_url',
  'interaction_target',
  'interaction_time_ms'
];

function readSqlTemplate(fileName: string): string {
  return fs.readFileSync(path.join(docsDir, fileName), 'utf8');
}

function readDocJson<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(path.join(docsDir, fileName), 'utf8')) as T;
}

function extractEventParamKeys(sql: string): string[] {
  return [...sql.matchAll(/WHERE key = '([^']+)'/g)].map((match) => match[1]);
}

function expectSharedUrlContract(sql: string): void {
  expect(sql).toContain('https://signal.stroma.design/r?rv=1&mode=production');
  expect(sql).toContain("'&ct='");
  expect(sql).toContain("'&rm='");
  expect(sql).toContain("'&rr='");
  expect(sql).toContain("'&ruc='");
  expect(sql).toContain("'&rcc='");
  expect(sql).toContain("'&es='");
  expect(sql).toContain("'&ec='");
  expect(sql).toContain("'&ep='");
  expect(sql).toContain("'&fpt=3000&lpt=4000&ipt=500'");
  expect(sql).toContain("'&fcs='");
  expect(sql).toContain("'&fps='");
  expect(sql).toContain("'&lcs='");
  expect(sql).toContain("'&lps='");
  expect(sql).toContain("'&ics='");
  expect(sql).toContain("'&ips='");
  expect(sql).toContain("'&ff='");
  expect(sql).toContain("'&ulc='");
  expect(sql).toContain("'&ufc='");
  expect(sql).toContain("'&utc='");
  expect(sql).toContain("'&clc='");
  expect(sql).toContain("'&cfc='");
  expect(sql).toContain("'&ctc='");
  // Sample-confidence band — every URL builder must emit this so the
  // /r cover can render the preliminary/provisional banner without
  // recomputing thresholds. See SIGNAL_SAMPLE_BAND_* in types.ts.
  expect(sql).toContain("'&b='");
  expect(sql).toContain('report_band');
  expect(sql).toContain("WHEN COUNT(*) < 100 THEN 'preliminary'");
  expect(sql).toContain("WHEN COUNT(*) < 500 THEN 'provisional'");
  expect(sql).toContain('comparison_tier');
  expect(sql).toContain('selected_metric_urban_coverage');
  expect(sql).toContain('selected_metric_comparison_coverage');
  expect(sql).toContain('urban_fcp_coverage');
  expect(sql).toContain('urban_ttfb_coverage');
  expect(sql).toContain('comparison_fcp_coverage');
  expect(sql).toContain('comparison_ttfb_coverage');
  expect(sql).toContain('race_metric');
  expect(sql).toContain('race_fallback_reason');
  expect(sql).toContain('urban_lcp_observations >= 25');
  expect(sql).toContain('comparison_lcp_observations >= 25');
  expect(sql).toContain('urban_lcp_coverage >= 50');
  expect(sql).toContain('comparison_lcp_coverage >= 50');
  expect(sql).toContain("NOT IN ('restore', 'prerender')");
}

function expectCanonicalSevenCompleteDayWindow(sql: string): void {
  expect(sql).toContain('DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)');
  expect(sql).toContain('DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)');
  expect(sql).not.toMatch(/AND\s+(FORMAT_DATE\('%Y%m%d',\s*)?CURRENT_DATE\(\)/);
}

interface GtmWorkspaceTemplate {
  dataLayerVariables: Array<{ dataLayerName: string; required: boolean }>;
  ga4EventTag: {
    parameters: Array<{ name: string; variable: string }>;
  };
}

describe('bigquery sql templates', () => {
  it('keeps the ga4 query aligned with the canonical event and report contract', () => {
    const sql = readSqlTemplate('ga4-bigquery-url-builder.sql');

    expect(sql).toContain("WHERE event_name = 'perf_tier_report'");
    expectSharedUrlContract(sql);
  });

  it('keeps the normalized warehouse query aligned with the report contract', () => {
    const sql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    expect(sql).not.toContain("WHERE event_name = 'perf_tier_report'");
    expectSharedUrlContract(sql);
  });

  it('only references GA4-safe event params in the GA4 SQL templates', () => {
    const referencedKeys = [
      ...extractEventParamKeys(readSqlTemplate('ga4-bigquery-validation.sql')),
      ...extractEventParamKeys(readSqlTemplate('ga4-bigquery-url-builder.sql'))
    ];

    for (const key of referencedKeys) {
      expect(ga4SafeFieldNames).toContain(key);
    }
  });

  it('extracts every GA4-safe event param across validation + URL-builder queries', () => {
    // Completeness check — the prior test asserted `extracted ⊆ safe`, which
    // allowed safe-listed fields to be silently omitted from both SQL files
    // (e.g. net_tcp_ms was configured in GTM but never pulled from
    // event_params, producing silent data loss). This asserts the full set
    // of safe fields is reachable across the two GA4 SQL templates combined.
    const referencedKeys = new Set([
      ...extractEventParamKeys(readSqlTemplate('ga4-bigquery-validation.sql')),
      ...extractEventParamKeys(readSqlTemplate('ga4-bigquery-url-builder.sql'))
    ]);

    for (const safeField of ga4SafeFieldNames) {
      expect(
        referencedKeys.has(safeField),
        `Expected GA4-safe field "${safeField}" to be extracted via WHERE key = '${safeField}' in either the validation or URL-builder SQL; neither file references it. This field will be silently lost in BigQuery aggregation even though GA4 receives it.`
      ).toBe(true);
    }
  });

  it('derives INP totals from the GA4 split timing params instead of relying on inp_ms', () => {
    const sql = readSqlTemplate('ga4-bigquery-url-builder.sql');

    expect(sql).toContain("WHERE key = 'input_delay_ms'");
    expect(sql).toContain("WHERE key = 'processing_duration_ms'");
    expect(sql).toContain("WHERE key = 'presentation_delay_ms'");
    expect(sql).not.toContain("WHERE key = 'inp_ms'");
  });

  it('does not reference warehouse-only columns in the GA4 source_events CTE', () => {
    const sql = readSqlTemplate('ga4-bigquery-url-builder.sql');
    const sourceEventsCte = sql.split('source_events AS')[1]?.split('),')[0] ?? '';

    // These iteration-6 fields are warehouse-only and must not appear as
    // selected columns in the GA4 source_events CTE.
    for (const field of [
      'device_cores',
      'device_memory_gb',
      'effective_type',
      'downlink_mbps',
      'rtt_ms',
      'save_data'
    ]) {
      // Check they don't appear as standalone column references in source_events
      // (they may appear in comments, which is fine)
      const lines = sourceEventsCte.split('\n').filter((line) => !line.trim().startsWith('--'));
      const uncommented = lines.join('\n');
      expect(uncommented).not.toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it('filters to a single host domain in both SQL builders', () => {
    const ga4Sql = readSqlTemplate('ga4-bigquery-url-builder.sql');
    const normalizedSql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    // Both should have a WHERE host filter to prevent multi-site mixing
    expect(ga4Sql).toContain("= 'your-domain.com'");
    expect(normalizedSql).toContain("= 'your-domain.com'");
  });

  it('deduplicates events by event_id in both SQL builders', () => {
    const ga4Sql = readSqlTemplate('ga4-bigquery-url-builder.sql');
    const normalizedSql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    expect(ga4Sql).toContain('event_id');
    expect(ga4Sql).toContain('ROW_NUMBER()');
    expect(normalizedSql).toContain('event_id');
    expect(normalizedSql).toContain('ROW_NUMBER()');
  });

  it('computes top_path from most-frequent path and strips query strings', () => {
    const ga4Sql = readSqlTemplate('ga4-bigquery-url-builder.sql');
    const normalizedSql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    // Both should strip query strings to prevent &v= injection
    expect(ga4Sql).toContain("SPLIT(url, '?')");
    expect(normalizedSql).toContain("SPLIT(url, '?')");

    // Neither should use ORDER BY observed_at DESC (most-recent) for top_path
    expect(ga4Sql).not.toMatch(/ARRAY_AGG\(url ORDER BY observed_at DESC/);
    expect(normalizedSql).not.toMatch(/ARRAY_AGG\(url ORDER BY observed_at DESC/);
  });

  it('does not contain ARRAY_AGG inside UNNEST (BigQuery rejects this pattern)', () => {
    // BigQuery rejects `UNNEST(ARRAY_AGG(...))` inside an aggregate-context
    // query with "Aggregate function ARRAY_AGG not allowed in UNNEST". This
    // bug was latent across rc.2-rc.4 because tests are regex-only and never
    // execute SQL. This test forbids the specific shape; the dry-run gate in
    // RELEASE-GATE.md is the authoritative parse check.
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);
      expect(
        sql,
        `${fileName}: aggregate inside UNNEST inside aggregate context. BigQuery rejects this with "Aggregate function ARRAY_AGG not allowed in UNNEST".`
      ).not.toMatch(/UNNEST\s*\(\s*ARRAY_AGG/i);
    }
  });

  it('uses an exact scalar subquery for top_path with deterministic tie-breaking', () => {
    // The replacement for the ARRAY_AGG-in-UNNEST bug uses a scalar subquery
    // with explicit GROUP BY + ORDER BY path_count DESC, path ASC + LIMIT 1.
    // The alphabetical tie-break makes reruns at the same cardinality
    // produce identical URLs — important for scheduled-query stability.
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);
      expect(sql).toMatch(/SELECT\s+SPLIT\(url,\s*'\?'\)\[OFFSET\(0\)\]\s+AS\s+path/);
      expect(sql).toMatch(/ORDER BY path_count DESC,\s*path ASC/);
    }
  });

  it('funnel_rollup CTE has GROUP BY on funnel_activation carry-through columns', () => {
    // funnel_rollup cross-joins source_events (many rows) with
    // funnel_activation (1 row). The SELECT mixes COUNTIF aggregates
    // with references to classified_sample_size / include_lcp /
    // include_inp — BigQuery requires GROUP BY on those columns or
    // ANY_VALUE wrapping. Without it, BigQuery rejects the query at
    // execution time with "SELECT list expression references column X
    // which is neither grouped nor aggregated". Regex tests cannot
    // catch this kind of semantic-against-real-BQ mismatch in general,
    // but we can lock in the specific GROUP BY clause that fixes it.
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);
      // Match "funnel_rollup AS (" through to the matching ")," (or ");" for the GA4 file's terminal comma).
      const block = sql.match(/funnel_rollup AS \(([\s\S]*?)\n\)[,;]?/)?.[1] ?? '';
      expect(
        block,
        `${fileName}: funnel_rollup must contain GROUP BY classified_sample_size, include_lcp, include_inp.`
      ).toMatch(/GROUP BY classified_sample_size,\s*include_lcp,\s*include_inp/);
    }
  });

  it('does not collide CTE names with column names in scalar subqueries', () => {
    // BigQuery rejects `(SELECT col FROM col)` when the inner `col` is
    // both a CTE name AND a column name in that CTE — the parser
    // resolves the inner reference to the table struct, not the column,
    // and the comparison fails with "No matching signature for operator =
    // for argument types: STRING, STRUCT<col STRING>". Forbid the
    // exact `(SELECT X FROM X)` shape so the comparison_tier-style trap
    // can't recur in a future CTE. See the rename to *_lookup in both
    // URL builders.
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);
      expect(
        sql,
        `${fileName}: scalar subquery (SELECT X FROM X) collides X-as-column with X-as-CTE. BigQuery rejects this with "No matching signature for operator =". Rename the CTE to <name>_lookup or qualify the column reference.`
      ).not.toMatch(/\(\s*SELECT\s+(\w+)\s+FROM\s+\1\s*\)/);
    }
  });

  it('emits a literal-fallback host so empty-data still produces a complete URL', () => {
    // Without COALESCE, ANY_VALUE(host) returns NULL on empty source_events,
    // and BigQuery's CONCAT() returns NULL if any argument is NULL — which
    // poisons the entire signal_report_url. The literal fallback ensures
    // empty-data still emits a usable URL with the operator's subject host.
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);
      expect(
        sql,
        `${fileName}: empty source_events would otherwise return ANY_VALUE(host) = NULL, poisoning the whole CONCAT URL. COALESCE fallback is required.`
      ).toMatch(/COALESCE\(\s*ANY_VALUE\(host\)\s*,/);
    }
  });

  it('conditionally omits nsl and nsr params when quartiles are unavailable in the normalized builder', () => {
    const sql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    // The nsl and nsr params must be entirely omitted (including the key)
    // when quartiles are NULL, not emitted as empty values.
    // Correct pattern: IF(dq IS NULL, '', CONCAT('&nsl=', ...))
    // Wrong pattern:   '&nsl=', IF(dq IS NULL, '', ...)
    expect(sql).toContain("CONCAT('&nsl='");
    expect(sql).toContain("CONCAT('&nsr='");
    // Verify the key is inside the IF, not outside
    expect(sql).not.toMatch(/'&nsl=',\s*IF/);
    expect(sql).not.toMatch(/'&nsr=',\s*IF/);
  });

  it('emits &ga= for freshness tracking in both SQL builders', () => {
    const ga4Sql = readSqlTemplate('ga4-bigquery-url-builder.sql');
    const normalizedSql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    expect(ga4Sql).toContain("'&ga='");
    expect(ga4Sql).toContain('UNIX_MILLIS(CURRENT_TIMESTAMP())');
    expect(normalizedSql).toContain("'&ga='");
    expect(normalizedSql).toContain('UNIX_MILLIS(CURRENT_TIMESTAMP())');
  });

  it('keeps both production URL builders on the last 7 complete calendar days', () => {
    expectCanonicalSevenCompleteDayWindow(readSqlTemplate('ga4-bigquery-url-builder.sql'));
    expectCanonicalSevenCompleteDayWindow(readSqlTemplate('normalized-bigquery-url-builder.sql'));
  });

  it('keeps both validation queries on the last 7 complete calendar days', () => {
    expectCanonicalSevenCompleteDayWindow(readSqlTemplate('ga4-bigquery-validation.sql'));
    expectCanonicalSevenCompleteDayWindow(readSqlTemplate('normalized-bigquery-validation.sql'));
  });

  it('orders the race metric CASE branches correctly: lcp → fcp → ttfb → none', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // Extract the race_choice CASE for race_metric
      const raceMetricCase = sql.match(/CASE[\s\S]*?END AS race_metric/)?.[0] ?? '';
      expect(raceMetricCase).toBeTruthy();

      // LCP branch must come first (checks both observations AND coverage)
      const lcpPos = raceMetricCase.indexOf("THEN 'lcp'");
      const fcpPos = raceMetricCase.indexOf("THEN 'fcp'");
      const ttfbPos = raceMetricCase.indexOf("THEN 'ttfb'");
      const nonePos = raceMetricCase.indexOf("ELSE 'none'");

      expect(lcpPos).toBeGreaterThan(-1);
      expect(fcpPos).toBeGreaterThan(lcpPos);
      expect(ttfbPos).toBeGreaterThan(fcpPos);
      expect(nonePos).toBeGreaterThan(ttfbPos);

      // LCP branch requires coverage check (50%); FCP/TTFB do not
      const lcpBranch = raceMetricCase.slice(0, fcpPos);
      expect(lcpBranch).toContain('urban_lcp_coverage >= 50');
      expect(lcpBranch).toContain('comparison_lcp_coverage >= 50');
    }
  });

  it('enforces observation AND coverage thresholds in funnel activation for both builders', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // LCP stage requires both ≥25 observations AND ≥50% coverage
      expect(sql).toContain('lcp_stage_observations >= 25');
      expect(sql).toMatch(/lcp_stage_observations >= 25[\s\S]*?>=\s*50\s+AS include_lcp/);

      // INP stage requires the same
      expect(sql).toContain('inp_stage_observations >= 25');
      expect(sql).toMatch(/inp_stage_observations >= 25[\s\S]*?>=\s*50\s+AS include_inp/);
    }
  });

  it('applies poor thresholds consistently in both URL params and SQL calculations', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // URL param string
      expect(sql).toContain("'&fpt=3000&lpt=4000&ipt=500'");

      // SQL calculation sections must use the same values
      expect(sql).toContain('fcp_ms > 3000');
      expect(sql).toContain('lcp_ms > 4000');
      expect(sql).toContain('inp_ms > 500');
    }
  });

  it('uses correct APPROX_QUANTILES configuration for p75 vitals', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // p75 vitals: 100 quantile buckets, IGNORE NULLS, OFFSET(75)
      // Count occurrences of the pattern: ", 100 IGNORE NULLS)[OFFSET(75)]"
      const quantileMatches = sql.match(/,\s*100\s+IGNORE NULLS\)\[OFFSET\(75\)\]/g) ?? [];
      // Should have 6 p75 quantile calls (lu, lt, fu, ft, tu, tt)
      expect(quantileMatches.length).toBe(6);

      // Verify all use APPROX_QUANTILES (not PERCENTILE_CONT or similar)
      expect(sql).toContain('APPROX_QUANTILES');
    }
  });

  it('guards APPROX_QUANTILES against empty-array crashes when all values are NULL', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // Each quantile access must be guarded by a COUNTIF check to prevent
      // INDEX_OUT_OF_BOUNDS on empty arrays when all inputs are NULL.
      const guardPattern = /IF\(COUNTIF\(.*IS NOT NULL\)\s*>\s*0,\s*APPROX_QUANTILES/g;
      const guardMatches = sql.match(guardPattern) ?? [];
      // 6 guarded quantile calls (lu, lt, fu, ft, tu, tt)
      expect(guardMatches.length).toBe(6);
    }
  });

  it('uses deterministic tie-breaking in comparison tier selection that matches aggregation.ts', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // Tie-break order: moderate (1) > constrained_moderate (2) > constrained (3),
      // mirroring CLASSIFIED_TIERS insertion order in aggregation.ts.
      expect(sql).toContain('ORDER BY tier_count DESC, tier_priority ASC');
      expect(sql).toContain("'moderate' AS tier, 1 AS tier_priority");
      expect(sql).toContain("'constrained_moderate' AS tier, 2 AS tier_priority");
      expect(sql).toContain("'constrained' AS tier, 3 AS tier_priority");
    }
  });

  it('uses correct quartile configuration in normalized builder only', () => {
    const normalizedSql = readSqlTemplate('normalized-bigquery-url-builder.sql');
    const ga4Sql = readSqlTemplate('ga4-bigquery-url-builder.sql');

    // Normalized: 4-bucket quartiles for downlink/rtt with 20-sample minimum
    expect(normalizedSql).toContain('APPROX_QUANTILES(downlink_mbps, 4 IGNORE NULLS)');
    expect(normalizedSql).toContain('APPROX_QUANTILES(rtt_ms, 4 IGNORE NULLS)');
    expect(normalizedSql).toContain('>= 20');

    // GA4: no quartile computation
    expect(ga4Sql).not.toContain('APPROX_QUANTILES(downlink_mbps');
    expect(ga4Sql).not.toContain('APPROX_QUANTILES(rtt_ms');
  });

  it('emits iteration-6 URL params only in normalized builder, not GA4', () => {
    const ga4Sql = readSqlTemplate('ga4-bigquery-url-builder.sql');
    const normalizedSql = readSqlTemplate('normalized-bigquery-url-builder.sql');

    const iteration6Params = ["'&dhc='", "'&dhm='", "'&dhv='", "'&nse='", "'&nsv='", "'&nsd='", "'&eb='"];

    for (const param of iteration6Params) {
      expect(normalizedSql).toContain(param);
      expect(ga4Sql).not.toContain(param);
    }
  });

  it('applies COALESCE navigation type filter in both builders', () => {
    for (const fileName of ['ga4-bigquery-url-builder.sql', 'normalized-bigquery-url-builder.sql']) {
      const sql = readSqlTemplate(fileName);

      // Must COALESCE to 'navigate' before NOT IN check to prevent NULL bypass
      expect(sql).toMatch(/COALESCE\(.*navigation_type.*'navigate'\)/);
    }
  });

  it('keeps the GTM workspace template aligned with the GA4-safe allowlist', () => {
    const template = readDocJson<GtmWorkspaceTemplate>('gtm-workspace-template.json');
    const variableNames = template.dataLayerVariables.map((variable) => variable.dataLayerName).sort();
    const eventParameterNames = template.ga4EventTag.parameters.map((parameter) => parameter.name).sort();
    const templateFieldNames = new Set([...variableNames, ...eventParameterNames]);

    // Every GA4-safe field must appear as a DLV and a GA4 event param.
    expect(variableNames).toEqual(ga4SafeFieldNames);
    expect(eventParameterNames).toEqual(ga4SafeFieldNames);

    // Required-vs-optional split must match what the URL builder needs.
    // Required = the URL builder aggregates against this field; optional =
    // diagnostic / filter-default-friendly.
    const requiredFields = new Set(
      template.dataLayerVariables.filter((variable) => variable.required).map((variable) => variable.dataLayerName)
    );
    const expectedRequired = new Set([
      'event_id',
      'host',
      'url',
      'net_tier',
      'net_tcp_source',
      'device_tier',
      'device_screen_w',
      'lcp_ms',
      'fcp_ms',
      'ttfb_ms',
      'input_delay_ms',
      'processing_duration_ms',
      'presentation_delay_ms'
    ]);
    expect(requiredFields).toEqual(expectedRequired);

    // Warehouse-only fields must not leak into the GTM template.
    for (const fieldName of removedWarehouseOnlyFields) {
      expect(templateFieldNames.has(fieldName)).toBe(false);
    }
  });

  it('keeps the GA4-safe field list in public-api-v0.1.md aligned with flattenSignalEventForGa4()', () => {
    const doc = fs.readFileSync(path.join(docsDir, 'public-api-v0.1.md'), 'utf8');
    // Slice between "### GA4-safe subset" and the next blank line followed by
    // a non-bullet paragraph (the explanatory line after the bullet list).
    const start = doc.indexOf('### GA4-safe subset');
    if (start === -1) {
      throw new Error('Expected "### GA4-safe subset" heading in public-api-v0.1.md');
    }
    const after = doc.slice(start);
    // Bullet block is contiguous lines starting with `- \``. Stop at the
    // first non-bullet, non-blank line.
    const lines = after.split('\n');
    const bullets: string[] = [];
    let inBlock = false;
    for (const line of lines) {
      const match = line.match(/^- `([a-z_]+)`$/);
      if (match) {
        bullets.push(match[1]);
        inBlock = true;
      } else if (inBlock && line.trim() !== '') {
        break;
      }
    }
    expect(bullets.sort()).toEqual(ga4SafeFieldNames);
  });

  it('keeps the GA4-safe field list in signal-technical-reference.md aligned with flattenSignalEventForGa4()', () => {
    const doc = fs.readFileSync(path.join(docsDir, 'signal-technical-reference.md'), 'utf8');
    // The doc lists fields inline as backticked names. Restrict to the
    // single sentence that opens "The GA4 compact subset includes ... fields:".
    const match = doc.match(/The GA4 compact subset includes \d+ fields: ([^.]+\.)/);
    if (!match) {
      throw new Error('Expected "The GA4 compact subset includes N fields:" sentence in signal-technical-reference.md');
    }
    // Strip the trailing "plus the `event` name itself for 25 total" clause —
    // `event` is the event_name, not a field in the safe-field map.
    const fieldList = [...match[1].matchAll(/`([a-z_]+)`/g)]
      .map((m) => m[1])
      .filter((name) => name !== 'event')
      .sort();

    expect(fieldList).toEqual(ga4SafeFieldNames);
  });
});
