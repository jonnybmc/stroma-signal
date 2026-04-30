import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../');
const docsDir = path.join(repoRoot, 'docs');
const docPath = path.join(docsDir, 'production-report-automation.md');

const doc = fs.readFileSync(docPath, 'utf8');

describe('production-report-automation.md alignment with the SQL templates and cross-references', () => {
  describe('referenced SQL files exist on disk', () => {
    // The doc names two paired SQL files per collection path. Each must
    // exist — drift here breaks the entire production-automation
    // onramp because the team has nowhere to copy the canonical query
    // from.
    const REFERENCED_SQL_FILES = [
      'ga4-bigquery-validation.sql',
      'ga4-bigquery-url-builder.sql',
      'normalized-bigquery-validation.sql',
      'normalized-bigquery-url-builder.sql'
    ];
    for (const fileName of REFERENCED_SQL_FILES) {
      it(`docs/${fileName} exists`, () => {
        expect(fs.existsSync(path.join(docsDir, fileName))).toBe(true);
      });

      it(`doc references docs/${fileName}`, () => {
        expect(doc).toContain(`./${fileName}`);
      });
    }
  });

  describe('cross-referenced sibling docs exist', () => {
    // Each named markdown link from this doc must resolve. Belt + braces
    // alongside the global link-resolution sweep — keeps the failure
    // mode local when one of these targets is renamed.
    const REFERENCED_DOCS = [
      'marketer-quickstart.md',
      'release-deployment-checklist.md',
      'launch-troubleshooting.md',
      'bigquery-saved-query-setup.md'
    ];
    for (const fileName of REFERENCED_DOCS) {
      it(`docs/${fileName} exists and is referenced`, () => {
        expect(fs.existsSync(path.join(docsDir, fileName))).toBe(true);
        expect(doc).toContain(`./${fileName}`);
      });
    }
  });

  describe('canonical persistence-table contract is pinned', () => {
    // The persistence table is the recommended handoff layer. Pin the
    // recommended name + the six columns so a future doc refactor can't
    // silently change the contract teams have already wired.
    const TABLE_NAME = 'signal_report_urls_current';
    const COLUMNS = ['host', 'window_start', 'window_end', 'sample_size', 'signal_report_url', 'updated_at'];

    it(`recommended table name is \`${TABLE_NAME}\``, () => {
      expect(doc).toContain(`\`${TABLE_NAME}\``);
    });

    for (const column of COLUMNS) {
      it(`recommended column \`${column}\` is named in the doc`, () => {
        expect(doc).toContain(`\`${column}\``);
      });
    }
  });

  describe('canonical 7-day window phrasing is consistent across the doc and the GA4 URL-builder SQL', () => {
    const sqlPath = path.join(docsDir, 'ga4-bigquery-url-builder.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    it('doc states the canonical window: last 7 complete calendar days, excluding the current in-progress day', () => {
      expect(doc).toContain('last 7 complete calendar days');
      expect(doc).toContain('exclude the current in-progress day');
    });

    it('doc keeps `p=7` aligned with the 7-day slice', () => {
      expect(doc).toContain('`p=7`');
    });

    it('GA4 URL builder emits `&p=7` so the warehouse slice matches the report URL parameter', () => {
      expect(sql).toContain("'&p=7'");
    });

    it('GA4 URL builder excludes the current in-progress day via DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)', () => {
      // The exclusion mechanism is the upper-bound clause that stops
      // at yesterday's events_* shard. Drift on the interval would
      // silently include partial today data and break the doc's
      // "exclude the current in-progress day" claim.
      expect(sql).toMatch(/DATE_SUB\(CURRENT_DATE\(\),\s*INTERVAL\s*1\s*DAY\)/);
    });
  });

  describe('URL builder produces every column the persistence-table claim requires from the query directly', () => {
    // The doc claims the persistence table can be populated from the
    // URL-builder query. `host`, `sample_size`, and `signal_report_url`
    // must appear as AS aliases on the final SELECT. The other columns
    // (window_start, window_end, updated_at) are wrapper-level concerns
    // that the team computes alongside, but the three SQL-sourced fields
    // must be there or the recommendation breaks at the very first step.
    const sqlPath = path.join(docsDir, 'ga4-bigquery-url-builder.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    it('URL builder selects `AS host`', () => {
      expect(sql).toMatch(/AS\s+host\b/);
    });

    it('URL builder selects `AS sample_size`', () => {
      expect(sql).toMatch(/AS\s+sample_size\b/);
    });

    it('URL builder selects `AS signal_report_url`', () => {
      expect(sql).toMatch(/AS\s+signal_report_url\b/);
    });
  });

  describe('hosted /r URL shape is referenced honestly', () => {
    it('doc references the canonical /r?... URL shape', () => {
      expect(doc).toContain('/r?...');
    });
  });

  describe('doc preserves the boundary that this is not commercial modelling', () => {
    // The Tier Report boundary is one of the project's load-bearing
    // contracts. This doc must restate it so an automation team can't
    // misread the output as a diagnostic / commercial artifact.
    it('doc names the proof-layer boundary explicitly', () => {
      expect(doc).toContain('not a diagnostic, attribution, or commercial modelling artifact');
    });
  });
});
