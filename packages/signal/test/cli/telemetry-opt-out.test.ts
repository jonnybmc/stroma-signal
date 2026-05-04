import { describe, expect, it } from 'vitest';

import { DISCLOSURE_VERSION, resolveOptOut } from '../../src/cli/telemetry/opt-out.js';
import type { TtyEnv } from '../../src/cli/util/tty.js';

function makeTty(over: Partial<TtyEnv> = {}): TtyEnv {
  return {
    isStdoutTty: true,
    isStdinTty: true,
    isCi: false,
    noColor: false,
    forceColor: false,
    ...over
  };
}

describe('resolveOptOut — priority chain (first match wins)', () => {
  it('1. --no-telemetry flag wins over everything', () => {
    const result = resolveOptOut({
      noTelemetryFlag: true,
      ttyEnv: makeTty(),
      env: { STROMA_TELEMETRY: '1', DO_NOT_TRACK: '0' }
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'flag' });
  });

  it('2. STROMA_TELEMETRY=0 disables when no flag', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { STROMA_TELEMETRY: '0' }
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'env_stroma_telemetry' });
  });

  it('STROMA_TELEMETRY=false also disables', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { STROMA_TELEMETRY: 'false' }
    });
    expect(result.kind).toBe('disabled');
  });

  it('3. DO_NOT_TRACK=1 disables (industry-standard signal)', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { DO_NOT_TRACK: '1' }
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'env_do_not_track' });
  });

  it('DO_NOT_TRACK=true also disables', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { DO_NOT_TRACK: 'true' }
    });
    expect(result.kind).toBe('disabled');
  });

  it('4. Non-TTY (CI=true) disables silently', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty({ isCi: true })
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'non_tty_or_ci' });
  });

  it('non-TTY stdout disables', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty({ isStdoutTty: false })
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'non_tty_or_ci' });
  });

  it('non-TTY stdin disables (piped input)', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty({ isStdinTty: false })
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'non_tty_or_ci' });
  });

  it('5. Persisted config file: explicitly disabled', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => ({
        schema_version: 1,
        telemetry: false,
        last_disclosure_version: DISCLOSURE_VERSION,
        decided_at: '2026-05-03T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'persisted_config' });
  });

  it('5. Persisted config file: explicitly enabled with current disclosure version', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => ({
        schema_version: 1,
        telemetry: true,
        last_disclosure_version: DISCLOSURE_VERSION,
        decided_at: '2026-05-03T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ kind: 'enabled', reason: 'persisted_config' });
  });

  it('5. Persisted enabled with STALE disclosure version → needs_disclosure / stale_disclosure', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => ({
        schema_version: 1,
        telemetry: true,
        last_disclosure_version: '2024-01-01',
        decided_at: '2024-01-01T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ kind: 'needs_disclosure', reason: 'stale_disclosure' });
  });

  it('5. Persisted DISABLED with stale disclosure version stays disabled (opt-out is sticky across version bumps)', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => ({
        schema_version: 1,
        telemetry: false,
        last_disclosure_version: '2024-01-01',
        decided_at: '2024-01-01T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ kind: 'disabled', reason: 'persisted_config' });
  });

  it('6. No persisted config → needs_disclosure / first_run', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => null
    });
    expect(result).toEqual({ kind: 'needs_disclosure', reason: 'first_run' });
  });

  it('Test override of currentDisclosureVersion behaves correctly (matched → enabled)', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      currentDisclosureVersion: '2030-01-01',
      configReader: () => ({
        schema_version: 1,
        telemetry: true,
        last_disclosure_version: '2030-01-01',
        decided_at: '2030-01-01T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ kind: 'enabled', reason: 'persisted_config' });
  });
});
