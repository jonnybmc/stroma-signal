// Cross-repo wire-format drift detection for install-event telemetry.
//
// Mirrors the intent-wire-format-drift pattern. The signal-init CLI emits
// SignalInstallEventV1 events; the stroma-snapshot-engine repo validates
// the same shape independently in its own zod schema
// (src/features/install/domain/validators.ts). To catch drift between the
// two without standing up a cross-repo TypeScript dependency, both repos
// parse the same JSON fixture file and assert it validates.
//
// The fixture file is the source of truth for the wire format. When
// either repo evolves it, BOTH repos must update their copy + their
// validator to keep this test green.
//
// Workflow when changing the wire format:
//   1. Edit `install-event-wire-format-fixtures.json` in this repo
//   2. Update `src/install-event.ts` validator to accept the new shape
//   3. Copy the updated fixtures.json to stroma-snapshot-engine/
//   4. Update the engine's zod schema to match
//   5. Both repos' CI passes → merge

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { explainInstallEventIssues, isSignalInstallEventV1 } from '../src/index.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.join(currentDir, 'install-event-wire-format-fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8')) as Array<{
  name: string;
  payload: unknown;
}>;

describe('install-event cross-repo wire-format drift fixtures', () => {
  it('the fixture file holds at least 10 representative payloads', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
  });

  for (const fixture of fixtures) {
    it(`accepts: ${fixture.name}`, () => {
      const issues = explainInstallEventIssues(fixture.payload);
      expect(issues, `signal-contracts validator rejected fixture: ${fixture.name}`).toEqual([]);
      expect(isSignalInstallEventV1(fixture.payload)).toBe(true);
    });
  }

  it('every fixture covers a distinct scenario (no duplicate names)', () => {
    const names = new Set(fixtures.map((f) => f.name));
    expect(names.size).toBe(fixtures.length);
  });

  it('coverage spans every event_kind', () => {
    const kinds = new Set(
      fixtures
        .map((f) =>
          typeof f.payload === 'object' && f.payload !== null
            ? (f.payload as Record<string, unknown>).event_kind
            : undefined
        )
        .filter((k): k is string => typeof k === 'string')
    );
    expect(kinds).toEqual(
      new Set(['install_started', 'install_framework_picked', 'install_completed', 'install_aborted', 'install_error'])
    );
  });

  it('coverage includes at least one fixture per supported framework family', () => {
    const frameworks = new Set(
      fixtures
        .map((f) =>
          typeof f.payload === 'object' && f.payload !== null
            ? (f.payload as Record<string, unknown>).framework
            : undefined
        )
        .filter((k): k is string => typeof k === 'string')
    );
    // At minimum we want detection coverage across the major families
    // so the engine's CHECK constraint enum is exercised.
    expect(frameworks.has('next-app-router')).toBe(true);
    expect(frameworks.has('react-router-v7')).toBe(true);
    expect(frameworks.has('sveltekit')).toBe(true);
    expect(frameworks.has('vanilla')).toBe(true);
  });

  it('coverage includes every sink option', () => {
    const sinks = new Set(
      fixtures
        .map((f) =>
          typeof f.payload === 'object' && f.payload !== null ? (f.payload as Record<string, unknown>).sink : undefined
        )
        .filter((k): k is string => typeof k === 'string')
    );
    expect(sinks).toEqual(new Set(['dataLayer', 'beacon', 'callback', 'undecided']));
  });

  it('coverage includes the framework_version_ahead_of_recipe positive case', () => {
    const aheadFixtures = fixtures.filter((f) => {
      if (typeof f.payload !== 'object' || f.payload === null) return false;
      return (f.payload as Record<string, unknown>).framework_version_ahead_of_recipe === true;
    });
    expect(aheadFixtures.length).toBeGreaterThanOrEqual(1);
  });
});
