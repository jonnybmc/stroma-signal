// Disclosure-flow integration tests (B1 launch-fix).
//
// `resolveOptOut` is exhaustively unit-tested in `telemetry-opt-out.test.ts`.
// This file covers the wizard-side wiring: when the resolver returns
// `needs_disclosure`, the wizard must prompt BEFORE constructing the
// queue, persist the user's answer (so subsequent runs don't re-prompt),
// and emit ZERO telemetry when the user aborts at the prompt.

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { run } from '../../src/cli/commands/init.js';
import { DISCLOSURE_VERSION } from '../../src/cli/telemetry/opt-out.js';
import { AbortError } from '../../src/cli/ui/prompts.js';

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'signal-disclosure-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: { '@stroma-labs/signal': '^0.1.0' } })
  );
  return dir;
}

function captureWrite(): { stream: { write: (s: string) => void }; captured: () => string } {
  let buf = '';
  return {
    stream: {
      write: (s: string): void => {
        buf += s;
      }
    },
    captured: () => buf
  };
}

describe('disclosure flow — needs_disclosure renders panel + persists answer', () => {
  it('first_run + Yes consent → persists with current DISCLOSURE_VERSION + telemetry: true', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    let persisted: { telemetry: boolean; disclosure_version: string } | undefined;
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'first_run' },
        disclosurePromptOverride: async () => true,
        writeDisclosureConfigOverride: (decision) => {
          persisted = decision;
        },
        // Point telemetry at a no-op fetch so the post-consent enqueues
        // don't touch the network.
        fetch: async () => new Response(null, { status: 201 })
      }
    );
    expect(result.exitCode).toBe(0);
    expect(persisted).toEqual({ telemetry: true, disclosure_version: DISCLOSURE_VERSION });
    // Disclosure panel rendered before the wizard's regular chrome.
    const combined = stdout.captured() + stderr.captured();
    expect(combined).toContain('Anonymous install telemetry');
  });

  it('first_run + No consent → persists with telemetry: false and zero telemetry', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    let persisted: { telemetry: boolean; disclosure_version: string } | undefined;
    let fetchCount = 0;
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'first_run' },
        disclosurePromptOverride: async () => false,
        writeDisclosureConfigOverride: (decision) => {
          persisted = decision;
        },
        fetch: async () => {
          fetchCount += 1;
          return new Response(null, { status: 201 });
        }
      }
    );
    expect(result.exitCode).toBe(0);
    expect(persisted).toEqual({ telemetry: false, disclosure_version: DISCLOSURE_VERSION });
    expect(fetchCount).toBe(0);
  });

  it('first_run + Ctrl-C → exit 130, NO write, NO telemetry (ZERO consent)', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    let writeCalls = 0;
    let fetchCalls = 0;
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'first_run' },
        disclosurePromptOverride: async () => {
          throw new AbortError();
        },
        writeDisclosureConfigOverride: () => {
          writeCalls += 1;
        },
        fetch: async () => {
          fetchCalls += 1;
          return new Response(null, { status: 201 });
        }
      }
    );
    expect(result.exitCode).toBe(130);
    expect(writeCalls).toBe(0);
    expect(fetchCalls).toBe(0);
  });

  it('stale_disclosure (re-prompt) renders the "updated" headline copy, not the first-run copy', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'stale_disclosure' },
        disclosurePromptOverride: async () => true,
        writeDisclosureConfigOverride: () => {},
        fetch: async () => new Response(null, { status: 201 })
      }
    );
    const combined = stdout.captured() + stderr.captured();
    expect(combined).toContain('Telemetry disclosure updated');
    expect(combined).not.toContain('first-run consent');
  });

  it('non-interactive + needs_disclosure → silently disabled (never re-prompts in CI)', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    let writeCalls = 0;
    let fetchCalls = 0;
    let promptCalls = 0;
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => false,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'first_run' },
        disclosurePromptOverride: async () => {
          promptCalls += 1;
          return true;
        },
        writeDisclosureConfigOverride: () => {
          writeCalls += 1;
        },
        fetch: async () => {
          fetchCalls += 1;
          return new Response(null, { status: 201 });
        }
      }
    );
    expect(result.exitCode).toBe(0);
    expect(promptCalls).toBe(0); // never prompted
    expect(writeCalls).toBe(0); // nothing persisted
    expect(fetchCalls).toBe(0); // belt-and-suspenders disabled
  });

  it('disabled decision skips the disclosure flow entirely', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    let promptCalls = 0;
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'disabled', reason: 'flag' },
        disclosurePromptOverride: async () => {
          promptCalls += 1;
          return true;
        },
        writeDisclosureConfigOverride: () => {},
        fetch: async () => new Response(null, { status: 201 })
      }
    );
    expect(promptCalls).toBe(0);
    const combined = stdout.captured() + stderr.captured();
    expect(combined).not.toContain('Anonymous install telemetry');
    expect(combined).not.toContain('Telemetry disclosure updated');
  });

  it('enabled decision skips the disclosure flow entirely', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    let promptCalls = 0;
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'enabled', reason: 'persisted_config' },
        disclosurePromptOverride: async () => {
          promptCalls += 1;
          return true;
        },
        writeDisclosureConfigOverride: () => {},
        fetch: async () => new Response(null, { status: 201 })
      }
    );
    expect(promptCalls).toBe(0);
    const combined = stdout.captured() + stderr.captured();
    expect(combined).not.toContain('Anonymous install telemetry');
  });

  it('writeDisclosureConfig failure does not crash the wizard (non-fatal)', async () => {
    const dir = makeTmpProject();
    const stdout = captureWrite();
    const stderr = captureWrite();
    const result = await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: stdout.stream,
        stderr: stderr.stream,
        isInteractive: () => true,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'first_run' },
        disclosurePromptOverride: async () => true,
        writeDisclosureConfigOverride: () => {
          throw new Error('disk full');
        },
        fetch: async () => new Response(null, { status: 201 })
      }
    );
    expect(result.exitCode).toBe(0);
  });
});
