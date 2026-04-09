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
  'device_screen_w',
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

interface GtmWorkspaceTemplate {
  requiredDataLayerVariables: Array<{ dataLayerName: string }>;
  recommendedDataLayerVariables: Array<{ dataLayerName: string }>;
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

  it('keeps the GTM workspace template aligned with the GA4-safe allowlist', () => {
    const template = readDocJson<GtmWorkspaceTemplate>('gtm-workspace-template.json');
    const requiredVariableNames = template.requiredDataLayerVariables.map((variable) => variable.dataLayerName).sort();
    const recommendedVariableNames = template.recommendedDataLayerVariables
      .map((variable) => variable.dataLayerName)
      .sort();
    const eventParameterNames = template.ga4EventTag.parameters.map((parameter) => parameter.name).sort();
    const templateFieldNames = new Set([...requiredVariableNames, ...recommendedVariableNames, ...eventParameterNames]);

    expect(requiredVariableNames).toEqual(ga4SafeFieldNames);
    expect(eventParameterNames).toEqual(ga4SafeFieldNames);
    expect(recommendedVariableNames).toEqual([]);

    for (const fieldName of removedWarehouseOnlyFields) {
      expect(templateFieldNames.has(fieldName)).toBe(false);
    }
  });
});
