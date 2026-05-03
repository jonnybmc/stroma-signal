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

interface ListenerHarness {
  port: number;
  url: string;
  connectionCount: () => number;
  reset: () => void;
  close: () => Promise<void>;
}

let harness: ListenerHarness;

beforeAll(async () => {
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
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
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
});

afterAll(async () => {
  await harness.close();
});

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
    harness.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: true,
        noClipboard: true,
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
        telemetryEndpoint: harness.url
      }
    );
    expect(harness.connectionCount()).toBe(0);
  });

  it('STROMA_TELEMETRY=0 (via decision override) → zero connections', async () => {
    harness.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        noClipboard: true,
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
        telemetryEndpoint: harness.url,
        telemetryDecisionOverride: { enabled: false, reason: 'env_stroma_telemetry' }
      }
    );
    expect(harness.connectionCount()).toBe(0);
  });

  it('DO_NOT_TRACK=1 (via decision override) → zero connections', async () => {
    harness.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        noClipboard: true,
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
        telemetryEndpoint: harness.url,
        telemetryDecisionOverride: { enabled: false, reason: 'env_do_not_track' }
      }
    );
    expect(harness.connectionCount()).toBe(0);
  });

  it('non-TTY (CI) → zero connections (auto-disabled silently)', async () => {
    harness.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        noClipboard: true,
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
        telemetryEndpoint: harness.url,
        telemetryDecisionOverride: { enabled: false, reason: 'non_tty_or_ci' }
      }
    );
    expect(harness.connectionCount()).toBe(0);
  });

  it('persisted config disabled → zero connections', async () => {
    harness.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        noClipboard: true,
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
        telemetryEndpoint: harness.url,
        telemetryDecisionOverride: { enabled: false, reason: 'persisted_config' }
      }
    );
    expect(harness.connectionCount()).toBe(0);
  });
});

describe('network isolation — negative control: enabled telemetry DOES connect', () => {
  it('telemetry enabled + non-interactive → at least one connection attempt', async () => {
    harness.reset();
    const dir = makeTmpProject();
    await run(
      {
        cwd: dir,
        yes: true,
        json: true,
        noTelemetry: false,
        noClipboard: true,
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
        telemetryEndpoint: harness.url,
        telemetryDecisionOverride: { enabled: true, reason: 'default_on' }
      }
    );
    expect(harness.connectionCount()).toBeGreaterThanOrEqual(1);
  });
});
