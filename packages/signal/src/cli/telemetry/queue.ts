// Telemetry transport — queue + flush before exit.
//
// Original plan called for floating fetches; that's unreliable on Node
// (process can exit before promise resolves). Replaced with a small
// queue + await flush() at every command exit path.
//
// When telemetry is disabled, enqueue() is a HARD no-op — zero
// allocations, zero side effects. NO requests leave the machine.
// (P2-12 invariant.)

import type { SignalInstallEventV1 } from '@stroma-labs/signal-contracts/install-event';

import { SIGNAL_INSTALL_INGEST_URL_DEFAULT } from '@stroma-labs/signal-contracts/install-event';

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

interface PendingTracker {
  /** The actual send promise (settles on success OR catch). Assigned
   *  immediately after construction so the tracker can self-reference
   *  in its `.finally()` to flip `settled`. */
  promise: Promise<void>;
  /** Set true when `promise` settles (success OR caught failure).
   *  Read AFTER the flush race resolves to count actual settlements
   *  vs items that timed out. */
  settled: boolean;
}

export class TelemetryQueue {
  private pending: PendingTracker[] = [];
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
    const tracker: PendingTracker = { settled: false, promise: undefined as unknown as Promise<void> };
    tracker.promise = this.send(event)
      .catch((err) => {
        // Silent failure — telemetry never blocks or surfaces user-facing
        // errors. Verbose log only.
        this.logger?.(`telemetry: send failed (silent): ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        tracker.settled = true;
      });
    this.pending.push(tracker);
  }

  /** Awaits all pending requests OR timeoutMs, whichever comes first.
   *  Returns the actually-settled count vs the not-yet-settled (which
   *  the flush gave up on because the total timeout fired first). */
  async flush(options: FlushOptions = {}): Promise<{ flushed: number; pending: number }> {
    if (!this.enabled || this.pending.length === 0) {
      return { flushed: 0, pending: 0 };
    }
    const totalTimeoutMs = options.timeoutMs ?? 1500;
    const total = this.pending.length;
    const allSettled = Promise.allSettled(this.pending.map((t) => t.promise));
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, totalTimeoutMs));
    await Promise.race([allSettled, timeoutPromise]);
    // Count what ACTUALLY settled — not what was pending when we
    // started. A timeout that fires before half the items resolve
    // should report (settled, total - settled), not (total, 0).
    const flushed = this.pending.filter((t) => t.settled).length;
    const remaining = total - flushed;
    this.logger?.(`telemetry: flushed ${flushed}/${total} pending events within ${totalTimeoutMs}ms`);
    this.pending = [];
    return { flushed, pending: remaining };
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
