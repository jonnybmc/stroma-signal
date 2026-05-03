import type { SignalInstallEventV1 } from '@stroma-labs/signal-contracts';
import { describe, expect, it, vi } from 'vitest';
import { TelemetryQueue } from '../../src/cli/telemetry/queue.js';

function makeEvent(overrides: Partial<SignalInstallEventV1> = {}): SignalInstallEventV1 {
  return {
    v: 1,
    event_kind: 'install_started',
    install_capture_id: 'cap_test',
    event_id: 'evt_test',
    ts: Date.now(),
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
    os_platform: 'darwin',
    ...overrides
  };
}

describe('TelemetryQueue — disabled mode (P2-12 zero-network invariant)', () => {
  it('enqueue is a hard no-op when disabled — fetch NEVER called', async () => {
    const fetchMock = vi.fn();
    const queue = new TelemetryQueue({ enabled: false, fetch: fetchMock as unknown as typeof globalThis.fetch });
    queue.enqueue(makeEvent());
    queue.enqueue(makeEvent({ event_kind: 'install_completed', outcome: 'completed' }));
    queue.enqueue(makeEvent({ event_kind: 'install_aborted', outcome: 'aborted' }));
    await queue.flush({ timeoutMs: 100 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flush returns { flushed: 0, pending: 0 } immediately when disabled', async () => {
    const fetchMock = vi.fn();
    const queue = new TelemetryQueue({ enabled: false, fetch: fetchMock as unknown as typeof globalThis.fetch });
    queue.enqueue(makeEvent());
    const start = Date.now();
    const result = await queue.flush({ timeoutMs: 5000 });
    const elapsed = Date.now() - start;
    expect(result).toEqual({ flushed: 0, pending: 0 });
    // Should not block on the 5-second timeout when disabled.
    expect(elapsed).toBeLessThan(50);
  });
});

describe('TelemetryQueue — enabled mode', () => {
  it('enqueue calls fetch with POST + correct body + content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    const queue = new TelemetryQueue({
      enabled: true,
      endpoint: 'http://localhost:1/install',
      fetch: fetchMock as unknown as typeof globalThis.fetch
    });
    const event = makeEvent();
    queue.enqueue(event);
    await queue.flush({ timeoutMs: 1000 });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:1/install');
    expect(opts.method).toBe('POST');
    expect(opts.headers['content-type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toMatchObject({ event_kind: 'install_started' });
  });

  it('flush awaits all pending requests', async () => {
    let resolveFn: () => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFn = () => resolve({ status: 201 } as Response);
        })
    );
    const queue = new TelemetryQueue({
      enabled: true,
      endpoint: 'http://localhost:1/install',
      fetch: fetchMock as unknown as typeof globalThis.fetch
    });
    queue.enqueue(makeEvent());
    queue.enqueue(makeEvent({ event_kind: 'install_completed', outcome: 'completed' }));
    // Resolve both in-flight fetches before flush returns.
    setTimeout(() => {
      resolveFn();
      resolveFn();
    }, 10);
    const result = await queue.flush({ timeoutMs: 500 });
    expect(result.flushed).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('flush respects timeoutMs cap when fetch hangs', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise<Response>(() => {}));
    const queue = new TelemetryQueue({
      enabled: true,
      endpoint: 'http://localhost:1/install',
      fetch: fetchMock as unknown as typeof globalThis.fetch
    });
    queue.enqueue(makeEvent());
    const start = Date.now();
    await queue.flush({ timeoutMs: 100 });
    const elapsed = Date.now() - start;
    // Should not block longer than ~timeoutMs + small overhead.
    expect(elapsed).toBeLessThan(500);
  });

  it('fetch rejection is silent (does not throw) — telemetry never crashes the wizard', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connection refused'));
    const queue = new TelemetryQueue({
      enabled: true,
      endpoint: 'http://localhost:1/install',
      fetch: fetchMock as unknown as typeof globalThis.fetch
    });
    queue.enqueue(makeEvent());
    // Should NOT throw.
    await expect(queue.flush({ timeoutMs: 500 })).resolves.toBeDefined();
  });
});

describe('TelemetryQueue — verbose logger', () => {
  it('logs send + flush messages when logger provided', async () => {
    const log: string[] = [];
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    const queue = new TelemetryQueue({
      enabled: true,
      endpoint: 'http://localhost:1/install',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      logger: (msg) => {
        log.push(msg);
      }
    });
    queue.enqueue(makeEvent());
    await queue.flush({ timeoutMs: 500 });
    // At least one log entry for the send + one for the flush.
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(log.some((m) => m.includes('install_started'))).toBe(true);
    expect(log.some((m) => m.includes('flushed'))).toBe(true);
  });

  it('does not call logger when telemetry disabled', async () => {
    const log: string[] = [];
    const fetchMock = vi.fn();
    const queue = new TelemetryQueue({
      enabled: false,
      fetch: fetchMock as unknown as typeof globalThis.fetch,
      logger: (msg) => {
        log.push(msg);
      }
    });
    queue.enqueue(makeEvent());
    await queue.flush({ timeoutMs: 100 });
    expect(log).toEqual([]);
  });
});
