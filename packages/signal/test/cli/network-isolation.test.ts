// Network-isolation gate (P2-12).
//
// Proves the load-bearing invariant: when telemetry is disabled by ANY
// of the opt-out paths (--no-telemetry, STROMA_TELEMETRY=0,
// DO_NOT_TRACK=1, non-TTY/CI), ZERO requests leave the machine — for
// ANY lifecycle event, including install_started.
//
// Implementation: spin up a localhost listener that records every
// connection attempt; run the full init flow against that endpoint
// with each opt-out path; assert connections === 0. Negative-control
// test: with telemetry enabled, assert at least one connection attempt
// was recorded.

import { mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { run } from '../../src/cli/commands/init.js';
import { AbortError } from '../../src/cli/ui/prompts.js';

interface ListenerHarness {
  port: number;
  url: string;
  connectionCount: () => number;
  reset: () => void;
  close: () => Promise<void>;
}

let harness: ListenerHarness | undefined;
let beforeAllError: Error | undefined;

beforeAll(async () => {
  try {
    let connections = 0;
    const server = http.createServer((req, res) => {
      connections += 1;
      // Drain the body to avoid hanging the client (the queue.send() side
      // expects the request to complete or be aborted).
      req.on('data', () => {});
      req.on('end', () => {
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address() as AddressInfo;
    harness = {
      port: addr.port,
      url: `http://127.0.0.1:${addr.port}/api/v1/install`,
      connectionCount: () => connections,
      reset: () => {
        connections = 0;
      },
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        })
    };
  } catch (err) {
    // Surface a clear message if the sandbox blocks port binds rather
    // than letting a downstream `harness.url` access throw "cannot
    // read property of undefined" with no context.
    beforeAllError =
      err instanceof Error
        ? new Error(`network-isolation harness failed to bind a localhost port: ${err.message}`)
        : new Error('network-isolation harness failed to bind a localhost port');
  }
});

afterAll(async () => {
  // Guard against partial setup — a failed beforeAll leaves harness
  // undefined. Calling .close() on undefined would mask the real error.
  if (harness) {
    await harness.close();
  }
});

function requireHarness(): ListenerHarness {
  if (beforeAllError) throw beforeAllError;
  if (!harness) throw new Error('network-isolation harness was never initialised');
  return harness;
}

function makeTmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'signal-net-isol-'));
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fixture', dependencies: { '@stroma-labs/signal': '^0.1.0' } })
  );
  return dir;
}

function captureWrite(): { stream: { write: (s: string) => void } } {
  return { stream: { write: () => {} } };
}

describe('network isolation — zero requests when telemetry disabled (P2-12)', () => {
  it('--no-telemetry → zero connections', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        verbose: false,
        skipInstallCheck: true,
        help: false,
        version: false,
        sink: 'dataLayer'
      },
      {
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        isInteractive: () => false,
        telemetryEndpoint: h.url
      }
    );
    expect(h.connectionCount()).toBe(0);
  });

  it('STROMA_TELEMETRY=0 (via decision override) → zero connections', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
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
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        isInteractive: () => false,
        telemetryEndpoint: h.url,
        telemetryDecisionOverride: { kind: 'disabled', reason: 'env_stroma_telemetry' }
      }
    );
    expect(h.connectionCount()).toBe(0);
  });

  it('DO_NOT_TRACK=1 (via decision override) → zero connections', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
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
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        isInteractive: () => false,
        telemetryEndpoint: h.url,
        telemetryDecisionOverride: { kind: 'disabled', reason: 'env_do_not_track' }
      }
    );
    expect(h.connectionCount()).toBe(0);
  });

  it('non-TTY (CI) → zero connections (auto-disabled silently)', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
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
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        isInteractive: () => false,
        telemetryEndpoint: h.url,
        telemetryDecisionOverride: { kind: 'disabled', reason: 'non_tty_or_ci' }
      }
    );
    expect(h.connectionCount()).toBe(0);
  });

  it('persisted config disabled → zero connections', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
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
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        isInteractive: () => false,
        telemetryEndpoint: h.url,
        telemetryDecisionOverride: { kind: 'disabled', reason: 'persisted_config' }
      }
    );
    expect(h.connectionCount()).toBe(0);
  });
});

describe('network isolation — disclosure abort pre-consent (B1)', () => {
  it('Ctrl-C at the disclosure prompt → exit 130, ZERO connections (consent never happened)', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
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
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        // Force the disclosure flow to run: needs_disclosure decision +
        // a real interactive shell (so the disclosure branch fires) +
        // an aborting prompt (so consent is never granted).
        isInteractive: () => true,
        telemetryEndpoint: h.url,
        telemetryDecisionOverride: { kind: 'needs_disclosure', reason: 'first_run' },
        disclosurePromptOverride: async (): Promise<boolean> => {
          throw new AbortError();
        },
        writeDisclosureConfigOverride: () => {
          throw new Error('writeDisclosureConfig must NOT be called when consent is aborted');
        }
      }
    );
    expect(result.exitCode).toBe(130);
    expect(h.connectionCount()).toBe(0);
  });
});

describe('network isolation — negative control: enabled telemetry DOES connect', () => {
  it('telemetry enabled + non-interactive → at least one connection attempt', async () => {
    const h = requireHarness();
    h.reset();
    const dir = makeTmpProject();
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
        stdout: captureWrite().stream,
        stderr: captureWrite().stream,
        isInteractive: () => false,
        telemetryEndpoint: h.url,
        telemetryDecisionOverride: { kind: 'enabled', reason: 'persisted_config' }
      }
    );
    expect(harness.connectionCount()).toBeGreaterThanOrEqual(1);
  });
});
