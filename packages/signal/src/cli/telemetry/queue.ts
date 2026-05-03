// Telemetry transport — queue + flush before exit.
//
// Original plan called for floating fetches; that's unreliable on Node
// (process can exit before promise resolves). Replaced with a small
// queue + await flush() at every command exit path.
//
// When telemetry is disabled, enqueue() is a HARD no-op — zero
// allocations, zero side effects. NO requests leave the machine.
// (P2-12 invariant.)

import type { SignalInstallEventV1 } from '@stroma-labs/signal-contracts';

import { SIGNAL_INSTALL_INGEST_URL_DEFAULT } from '@stroma-labs/signal-contracts';

export interface TelemetryQueueOptions {
  enabled: boolean;
  endpoint?: string;
  /** Per-event timeout (ms). Default 1500. Hard cap so a flaky
   *  network never wedges the CLI for longer than this. */
  perEventTimeoutMs?: number;
  /** Optional fetch override for tests. */
  fetch?: typeof globalThis.fetch;
  /** Optional logger for --verbose mode. */
  logger?: (msg: string) => void;
}

export interface FlushOptions {
  /** Total flush timeout (ms) — caps how long flush() can block on
   *  exit. Default 1500. */
  timeoutMs?: number;
}

export class TelemetryQueue {
  private pending: Promise<void>[] = [];
  private readonly enabled: boolean;
  private readonly endpoint: string;
  private readonly perEventTimeoutMs: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly logger: ((msg: string) => void) | undefined;

  constructor(options: TelemetryQueueOptions) {
    this.enabled = options.enabled;
    this.endpoint = options.endpoint ?? SIGNAL_INSTALL_INGEST_URL_DEFAULT;
    this.perEventTimeoutMs = options.perEventTimeoutMs ?? 1500;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.logger = options.logger;
  }

  /** Hard no-op when disabled. */
  enqueue(event: SignalInstallEventV1): void {
    if (!this.enabled) return;
    const promise = this.send(event).catch((err) => {
      // Silent failure — telemetry never blocks or surfaces user-facing
      // errors. Verbose log only.
      this.logger?.(`telemetry: send failed (silent): ${err instanceof Error ? err.message : String(err)}`);
    });
    this.pending.push(promise);
  }

  /** Awaits all pending requests OR timeoutMs, whichever comes first.
   *  Returns the count of requests that flushed cleanly. */
  async flush(options: FlushOptions = {}): Promise<{ flushed: number; pending: number }> {
    if (!this.enabled || this.pending.length === 0) {
      return { flushed: 0, pending: 0 };
    }
    const totalTimeoutMs = options.timeoutMs ?? 1500;
    const before = this.pending.length;
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, totalTimeoutMs));
    await Promise.race([Promise.allSettled(this.pending), timeoutPromise]);
    const flushed = this.pending.length;
    this.logger?.(`telemetry: flushed ${flushed}/${before} pending events within ${totalTimeoutMs}ms`);
    this.pending = [];
    return { flushed, pending: 0 };
  }

  private async send(event: SignalInstallEventV1): Promise<void> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.perEventTimeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
        signal: ac.signal
      });
      this.logger?.(`telemetry: ${event.event_kind} → HTTP ${response.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
