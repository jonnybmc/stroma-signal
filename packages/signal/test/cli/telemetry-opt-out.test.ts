import { describe, expect, it } from 'vitest';

import { resolveOptOut } from '../../src/cli/telemetry/opt-out.js';
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
    expect(result).toEqual({ enabled: false, reason: 'flag' });
  });

  it('2. STROMA_TELEMETRY=0 disables when no flag', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { STROMA_TELEMETRY: '0' }
    });
    expect(result).toEqual({ enabled: false, reason: 'env_stroma_telemetry' });
  });

  it('STROMA_TELEMETRY=false also disables', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { STROMA_TELEMETRY: 'false' }
    });
    expect(result.enabled).toBe(false);
  });

  it('3. DO_NOT_TRACK=1 disables (industry-standard signal)', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { DO_NOT_TRACK: '1' }
    });
    expect(result).toEqual({ enabled: false, reason: 'env_do_not_track' });
  });

  it('DO_NOT_TRACK=true also disables', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: { DO_NOT_TRACK: 'true' }
    });
    expect(result.enabled).toBe(false);
  });

  it('4. Non-TTY (CI=true) disables silently', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty({ isCi: true })
    });
    expect(result).toEqual({ enabled: false, reason: 'non_tty_or_ci' });
  });

  it('non-TTY stdout disables', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty({ isStdoutTty: false })
    });
    expect(result).toEqual({ enabled: false, reason: 'non_tty_or_ci' });
  });

  it('non-TTY stdin disables (piped input)', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty({ isStdinTty: false })
    });
    expect(result).toEqual({ enabled: false, reason: 'non_tty_or_ci' });
  });

  it('5. Persisted config file: explicitly disabled', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => ({
        schema_version: 1,
        telemetry: false,
        last_disclosure_version: '2026-05-03',
        decided_at: '2026-05-03T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ enabled: false, reason: 'persisted_config' });
  });

  it('5. Persisted config file: explicitly enabled', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => ({
        schema_version: 1,
        telemetry: true,
        last_disclosure_version: '2026-05-03',
        decided_at: '2026-05-03T00:00:00.000Z'
      })
    });
    expect(result).toEqual({ enabled: true, reason: 'persisted_config' });
  });

  it('6. Default ON for first-ever interactive run', () => {
    const result = resolveOptOut({
      noTelemetryFlag: false,
      ttyEnv: makeTty(),
      env: {},
      configReader: () => null
    });
    expect(result).toEqual({ enabled: true, reason: 'default_on' });
  });
});
