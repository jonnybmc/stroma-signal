import { describe, expect, it } from 'vitest';

import {
  explainInstallEventIssues,
  isSignalInstallEventV1,
  SIGNAL_INSTALL_EVENT_VERSION,
  SIGNAL_INSTALL_INGEST_URL_DEFAULT,
  SIGNAL_INSTALL_MAX_LENGTH_CLI_VERSION,
  SIGNAL_INSTALL_MAX_LENGTH_FRAMEWORK_VERSION,
  SIGNAL_INSTALL_MAX_LENGTH_NODE_VERSION,
  type SignalInstallEventV1
} from '../src/index.js';

// Minimal valid base — every field present, every required-when-set field
// satisfies the constraint. Each test mutates ONE thing to assert the
// validator catches that one change.
function makeBase(): SignalInstallEventV1 {
  return {
    v: SIGNAL_INSTALL_EVENT_VERSION,
    event_kind: 'install_started',
    install_capture_id: '0123abcd-ef45-6789-abcd-ef0123456789',
    event_id: 'evt_abc123def456',
    ts: Date.UTC(2026, 4, 3, 12, 0, 0),
    cli_version: '0.1.0-rc.4',
    installed_signal_version: null,
    framework: 'unknown',
    framework_version: null,
    framework_version_source: 'unknown',
    framework_confidence: 'low',
    framework_version_ahead_of_recipe: false,
    sink: 'undecided',
    sample_rate: null,
    package_manager: 'pnpm',
    node_version: 'v22.4.0',
    os_platform: 'darwin'
  };
}

function makeFrameworkPicked(): SignalInstallEventV1 {
  return {
    ...makeBase(),
    event_kind: 'install_framework_picked',
    framework: 'next-app-router',
    framework_version: '16.2.4',
    framework_version_source: 'installed',
    framework_confidence: 'high'
  };
}

function makeCompleted(): SignalInstallEventV1 {
  return {
    ...makeFrameworkPicked(),
    event_kind: 'install_completed',
    sink: 'dataLayer',
    sample_rate: 1.0,
    outcome: 'completed'
  };
}

function makeAborted(): SignalInstallEventV1 {
  return {
    ...makeBase(),
    event_kind: 'install_aborted',
    outcome: 'aborted'
  };
}

function makeErrored(): SignalInstallEventV1 {
  return {
    ...makeBase(),
    event_kind: 'install_error',
    outcome: 'error',
    error_category: 'detection_failed'
  };
}

describe('explainInstallEventIssues', () => {
  describe('happy path', () => {
    it('accepts install_started base event', () => {
      expect(explainInstallEventIssues(makeBase())).toEqual([]);
      expect(isSignalInstallEventV1(makeBase())).toBe(true);
    });

    it('accepts install_framework_picked with high-confidence detection', () => {
      expect(explainInstallEventIssues(makeFrameworkPicked())).toEqual([]);
    });

    it('accepts install_completed with full payload', () => {
      expect(explainInstallEventIssues(makeCompleted())).toEqual([]);
    });

    it('accepts install_aborted', () => {
      expect(explainInstallEventIssues(makeAborted())).toEqual([]);
    });

    it('accepts install_error with category', () => {
      expect(explainInstallEventIssues(makeErrored())).toEqual([]);
    });

    it('accepts beacon sink with sample_rate at boundary 1.0', () => {
      const ev = { ...makeCompleted(), sink: 'beacon' as const, sample_rate: 1.0 };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('accepts the smallest legal sample_rate above 0', () => {
      const ev = { ...makeCompleted(), sample_rate: 0.0001 };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });
  });

  describe('shape rejection', () => {
    it('rejects non-object', () => {
      expect(explainInstallEventIssues(null)).toContain('Expected a JSON object matching SignalInstallEventV1.');
      expect(explainInstallEventIssues('string')).toContain('Expected a JSON object matching SignalInstallEventV1.');
      expect(explainInstallEventIssues(42)).toContain('Expected a JSON object matching SignalInstallEventV1.');
    });

    it('rejects wrong version', () => {
      const ev = { ...makeBase(), v: 2 } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "v" to be 1.');
    });
  });

  describe('event_kind validity', () => {
    it('rejects unknown event_kind', () => {
      const ev = { ...makeBase(), event_kind: 'install_paused' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "event_kind" to be a known install event kind.');
    });
  });

  describe('install_capture_id', () => {
    it('rejects empty string', () => {
      const ev = { ...makeBase(), install_capture_id: '' };
      expect(explainInstallEventIssues(ev)).toContain('Expected "install_capture_id" to be a non-empty string.');
    });

    it('rejects non-string', () => {
      const ev = { ...makeBase(), install_capture_id: 12345 } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "install_capture_id" to be a non-empty string.');
    });

    it('rejects oversized id', () => {
      const ev = { ...makeBase(), install_capture_id: 'x'.repeat(65) };
      expect(explainInstallEventIssues(ev)).toContain('Expected "install_capture_id" length ≤ 64.');
    });
  });

  describe('event_id', () => {
    it('rejects empty string', () => {
      const ev = { ...makeBase(), event_id: '' };
      expect(explainInstallEventIssues(ev)).toContain('Expected "event_id" to be a non-empty string.');
    });

    it('rejects oversized id', () => {
      const ev = { ...makeBase(), event_id: 'x'.repeat(65) };
      expect(explainInstallEventIssues(ev)).toContain('Expected "event_id" length ≤ 64.');
    });
  });

  describe('ts', () => {
    it('rejects non-finite', () => {
      const ev = { ...makeBase(), ts: Number.POSITIVE_INFINITY };
      expect(explainInstallEventIssues(ev)).toContain('Expected "ts" to be a finite number.');
    });

    it('rejects non-number', () => {
      const ev = { ...makeBase(), ts: '2026-05-03' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "ts" to be a finite number.');
    });
  });

  describe('cli_version', () => {
    it('rejects empty', () => {
      const ev = { ...makeBase(), cli_version: '' };
      expect(explainInstallEventIssues(ev)).toContain('Expected "cli_version" to be a non-empty string.');
    });

    it('rejects oversized', () => {
      const ev = { ...makeBase(), cli_version: 'x'.repeat(SIGNAL_INSTALL_MAX_LENGTH_CLI_VERSION + 1) };
      expect(explainInstallEventIssues(ev)).toContain(
        `Expected "cli_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_CLI_VERSION}.`
      );
    });
  });

  describe('installed_signal_version (nullable)', () => {
    it('accepts null', () => {
      const ev = { ...makeBase(), installed_signal_version: null };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('accepts a version string', () => {
      const ev = { ...makeBase(), installed_signal_version: '0.1.0-rc.3' };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('rejects empty string when not null', () => {
      const ev = { ...makeBase(), installed_signal_version: '' };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "installed_signal_version" to be a non-empty string or null.'
      );
    });

    it('rejects oversized', () => {
      const ev = { ...makeBase(), installed_signal_version: 'x'.repeat(33) };
      expect(explainInstallEventIssues(ev)).toContain('Expected "installed_signal_version" length ≤ 32.');
    });
  });

  describe('framework', () => {
    it('rejects unknown framework id', () => {
      const ev = { ...makeBase(), framework: 'qwik' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "framework" to be a known install framework id.');
    });

    it.each([
      'next-app-router',
      'next-pages-router',
      'react-router-v7',
      'remix-v2',
      'nuxt',
      'sveltekit',
      'plain-vue',
      'plain-svelte',
      'plain-react',
      'angular-standalone',
      'angular-ngmodule',
      'vanilla',
      'unknown'
    ] as const)('accepts %s', (framework) => {
      const ev = { ...makeBase(), framework };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });
  });

  describe('framework_version (nullable)', () => {
    it('accepts null', () => {
      const ev = { ...makeBase(), framework_version: null };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('rejects oversized', () => {
      const ev = { ...makeBase(), framework_version: 'x'.repeat(SIGNAL_INSTALL_MAX_LENGTH_FRAMEWORK_VERSION + 1) };
      expect(explainInstallEventIssues(ev)).toContain(
        `Expected "framework_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_FRAMEWORK_VERSION}.`
      );
    });
  });

  describe('framework_version_source', () => {
    it.each(['installed', 'lockfile', 'spec', 'unknown'] as const)('accepts %s', (source) => {
      const ev = { ...makeBase(), framework_version_source: source };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('rejects bogus source', () => {
      const ev = { ...makeBase(), framework_version_source: 'guessed' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "framework_version_source" to be one of: installed, lockfile, spec, unknown.'
      );
    });
  });

  describe('framework_confidence', () => {
    it.each(['high', 'medium', 'low'] as const)('accepts %s', (confidence) => {
      const ev = { ...makeBase(), framework_confidence: confidence };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('rejects bogus value', () => {
      const ev = { ...makeBase(), framework_confidence: 'maybe' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "framework_confidence" to be one of: high, medium, low.'
      );
    });
  });

  describe('framework_version_ahead_of_recipe', () => {
    it('rejects non-boolean', () => {
      const ev = { ...makeBase(), framework_version_ahead_of_recipe: 1 } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "framework_version_ahead_of_recipe" to be a boolean.');
    });
  });

  describe('sink', () => {
    it.each(['dataLayer', 'beacon', 'callback', 'undecided'] as const)('accepts %s', (sink) => {
      const ev = { ...makeBase(), sink };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('rejects bogus sink', () => {
      const ev = { ...makeBase(), sink: 'webhook' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "sink" to be one of: dataLayer, beacon, callback, undecided.'
      );
    });
  });

  describe('sample_rate (nullable, 0 < n ≤ 1)', () => {
    it('accepts null', () => {
      expect(explainInstallEventIssues({ ...makeBase(), sample_rate: null })).toEqual([]);
    });

    it('rejects 0', () => {
      const ev = { ...makeBase(), sample_rate: 0 };
      expect(explainInstallEventIssues(ev)).toContain('Expected "sample_rate" to satisfy 0 < n ≤ 1 when set.');
    });

    it('rejects negative', () => {
      const ev = { ...makeBase(), sample_rate: -0.5 };
      expect(explainInstallEventIssues(ev)).toContain('Expected "sample_rate" to satisfy 0 < n ≤ 1 when set.');
    });

    it('rejects > 1', () => {
      const ev = { ...makeBase(), sample_rate: 1.5 };
      expect(explainInstallEventIssues(ev)).toContain('Expected "sample_rate" to satisfy 0 < n ≤ 1 when set.');
    });

    it('rejects NaN', () => {
      const ev = { ...makeBase(), sample_rate: Number.NaN };
      expect(explainInstallEventIssues(ev)).toContain('Expected "sample_rate" to be a finite number or null.');
    });

    it('rejects Infinity', () => {
      const ev = { ...makeBase(), sample_rate: Number.POSITIVE_INFINITY };
      expect(explainInstallEventIssues(ev)).toContain('Expected "sample_rate" to be a finite number or null.');
    });
  });

  describe('package_manager', () => {
    it.each(['npm', 'pnpm', 'yarn', 'bun', 'unknown'] as const)('accepts %s', (pm) => {
      expect(explainInstallEventIssues({ ...makeBase(), package_manager: pm })).toEqual([]);
    });

    it('rejects bogus pm', () => {
      const ev = { ...makeBase(), package_manager: 'pip' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "package_manager" to be one of: npm, pnpm, yarn, bun, unknown.'
      );
    });
  });

  describe('node_version', () => {
    it('rejects empty', () => {
      const ev = { ...makeBase(), node_version: '' };
      expect(explainInstallEventIssues(ev)).toContain('Expected "node_version" to be a non-empty string.');
    });

    it('rejects oversized', () => {
      const ev = { ...makeBase(), node_version: 'x'.repeat(SIGNAL_INSTALL_MAX_LENGTH_NODE_VERSION + 1) };
      expect(explainInstallEventIssues(ev)).toContain(
        `Expected "node_version" length ≤ ${SIGNAL_INSTALL_MAX_LENGTH_NODE_VERSION}.`
      );
    });
  });

  describe('os_platform', () => {
    it.each(['linux', 'darwin', 'win32', 'other'] as const)('accepts %s', (os) => {
      expect(explainInstallEventIssues({ ...makeBase(), os_platform: os })).toEqual([]);
    });

    it('rejects bogus os', () => {
      const ev = { ...makeBase(), os_platform: 'aix' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "os_platform" to be one of: linux, darwin, win32, other.'
      );
    });
  });

  describe('per-kind outcome consistency', () => {
    it('rejects non-terminal kind with outcome present', () => {
      const ev = { ...makeBase(), event_kind: 'install_started' as const, outcome: 'completed' as const };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "outcome" to be absent for event_kind "install_started".'
      );
    });

    it('rejects install_completed without outcome=completed', () => {
      const ev = { ...makeBase(), event_kind: 'install_completed' as const, outcome: 'aborted' as const };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "outcome" to be "completed" for event_kind "install_completed".'
      );
    });

    it('rejects install_aborted with wrong outcome', () => {
      const ev = { ...makeBase(), event_kind: 'install_aborted' as const, outcome: 'completed' as const };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "outcome" to be "aborted" for event_kind "install_aborted".'
      );
    });

    it('rejects install_error without outcome=error', () => {
      const ev = {
        ...makeBase(),
        event_kind: 'install_error' as const,
        outcome: 'aborted' as const,
        error_category: 'unknown' as const
      };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "outcome" to be "error" for event_kind "install_error".'
      );
    });

    it('rejects install_completed missing outcome', () => {
      const ev = { ...makeBase(), event_kind: 'install_completed' as const };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "outcome" to be "completed" for event_kind "install_completed".'
      );
    });
  });

  describe('error_category gating', () => {
    it('requires error_category on install_error', () => {
      const ev = { ...makeBase(), event_kind: 'install_error' as const, outcome: 'error' as const };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "error_category" to be a known category for event_kind "install_error".'
      );
    });

    it('rejects install_error with unknown category enum', () => {
      const ev = {
        ...makeBase(),
        event_kind: 'install_error' as const,
        outcome: 'error' as const,
        error_category: 'something_else'
      } as unknown;
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "error_category" to be a known category for event_kind "install_error".'
      );
    });

    it('rejects non-error kind carrying error_category', () => {
      const ev = { ...makeBase(), event_kind: 'install_started' as const, error_category: 'unknown' as const };
      expect(explainInstallEventIssues(ev)).toContain(
        'Expected "error_category" to be absent for event_kind "install_started".'
      );
    });

    it.each([
      'detection_failed',
      'snippet_render_failed',
      'clipboard_failed',
      'telemetry_flush_failed',
      'package_install_failed',
      'unknown'
    ] as const)('accepts category %s on install_error', (cat) => {
      const ev = {
        ...makeBase(),
        event_kind: 'install_error' as const,
        outcome: 'error' as const,
        error_category: cat
      };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });
  });

  describe('auto_installed (Pattern 2 telemetry)', () => {
    it('accepts auto_installed: true on install_completed', () => {
      const ev = {
        ...makeBase(),
        event_kind: 'install_completed' as const,
        outcome: 'completed' as const,
        auto_installed: true
      };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('accepts auto_installed: false on install_completed', () => {
      const ev = {
        ...makeBase(),
        event_kind: 'install_completed' as const,
        outcome: 'completed' as const,
        auto_installed: false
      };
      expect(explainInstallEventIssues(ev)).toEqual([]);
    });

    it('accepts auto_installed absent (legacy clients)', () => {
      expect(explainInstallEventIssues(makeBase())).toEqual([]);
    });

    it('rejects non-boolean auto_installed', () => {
      const ev = { ...makeBase(), auto_installed: 'true' } as unknown;
      expect(explainInstallEventIssues(ev)).toContain('Expected "auto_installed" to be a boolean when present.');
    });
  });

  describe('issue accumulation', () => {
    it('returns multiple issues at once for multiply-broken payloads', () => {
      const ev = {
        ...makeBase(),
        v: 99,
        event_kind: 'invalid_kind',
        sample_rate: 5,
        os_platform: 'aix'
      } as unknown;
      const issues = explainInstallEventIssues(ev);
      expect(issues.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('SIGNAL_INSTALL_INGEST_URL_DEFAULT', () => {
  it('points at the production snapshot-engine endpoint', () => {
    expect(SIGNAL_INSTALL_INGEST_URL_DEFAULT).toBe('https://api.stroma.design/api/v1/install');
  });
});
