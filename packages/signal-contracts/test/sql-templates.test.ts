import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(currentDir, '../../../docs');

function readSqlTemplate(fileName: string): string {
  return fs.readFileSync(path.join(docsDir, fileName), 'utf8');
}

function expectSharedUrlContract(sql: string): void {
  expect(sql).toContain('https://signal.stroma.design/r?rv=1&mode=production');
  expect(sql).toContain("'&ct='");
  expect(sql).toContain("'&rm='");
  expect(sql).toContain("'&rr='");
  expect(sql).toContain("'&ruc='");
  expect(sql).toContain("'&rcc='");
  expect(sql).toContain("'&ulc='");
  expect(sql).toContain("'&ufc='");
  expect(sql).toContain("'&utc='");
  expect(sql).toContain("'&clc='");
  expect(sql).toContain("'&cfc='");
  expect(sql).toContain("'&ctc='");
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
});
