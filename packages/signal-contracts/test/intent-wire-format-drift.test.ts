// Cross-repo wire-format drift detection.
//
// The Signal client emits intent-capture events with a specific shape
// (defined in src/report-interaction.ts). The stroma-snapshot-engine
// repo validates the same shape independently in its own zod schema
// (src/features/intent/domain/validators.ts). To catch drift between
// the two without standing up a cross-repo TypeScript dependency, both
// repos parse the same JSON fixture file and assert it validates.
//
// The fixture file is the source of truth for the wire format. When
// either repo evolves it, BOTH repos must update their copy + their
// validator to keep this test green.
//
// Workflow when changing the wire format:
//   1. Edit `intent-wire-format-fixtures.json` in this repo
//   2. Update `src/report-interaction.ts` validator to accept the new shape
//   3. Copy the updated fixtures.json to stroma-snapshot-engine/
//   4. Update the engine's zod schema to match
//   5. Both repos' CI passes → merge

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { explainReportInteractionIssues, isSignalReportInteractionV1 } from '../src/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(currentDir, 'intent-wire-format-fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8')) as Array<{
  name: string;
  payload: unknown;
}>;

describe('cross-repo wire-format drift fixtures', () => {
  it('the fixture file holds at least 10 representative payloads', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  for (const fixture of fixtures) {
    it(`accepts: ${fixture.name}`, () => {
      const issues = explainReportInteractionIssues(fixture.payload);
      expect(issues, `signal-contracts validator rejected fixture: ${fixture.name}`).toEqual([]);
      expect(isSignalReportInteractionV1(fixture.payload)).toBe(true);
    });
  }

  it('every fixture covers a distinct scenario (no duplicate names)', () => {
    const names = new Set(fixtures.map((f) => f.name));
    expect(names.size).toBe(fixtures.length);
  });
});
