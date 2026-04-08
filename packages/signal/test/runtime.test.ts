import type { SignalSink } from '@stroma-labs/signal-contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transitionSignalLifecycle } from '../src/core/state-machine.js';
import { destroy, init } from '../src/index.js';

type Listener = {
  callback: (event: Event | PageTransitionEvent) => void;
  once: boolean;
};

class MockEventTarget {
  private listeners = new Map<string, Listener[]>();

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    const listener: Listener = {
      callback: typeof callback === 'function' ? callback : (event) => callback.handleEvent(event),
      once: typeof options === 'object' && options?.once === true
    };
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  removeEventListener(type: string, callback: EventListenerOrEventListenerObject): void {
    const current = this.listeners.get(type) ?? [];
    const normalized =
      typeof callback === 'function' ? callback : (event: Event | PageTransitionEvent) => callback.handleEvent(event);

    this.listeners.set(
      type,
      current.filter((listener) => listener.callback !== normalized)
    );
  }

  dispatch(type: string, event: Event | PageTransitionEvent): void {
    const current = [...(this.listeners.get(type) ?? [])];
    for (const listener of current) {
      listener.callback(event);
      if (listener.once) {
        this.listeners.set(
          type,
          (this.listeners.get(type) ?? []).filter((entry) => entry !== listener)
        );
      }
    }
  }
}

class MockDocument extends MockEventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  referrer = 'https://www.google.com/';
  prerendering = false;
}

function setupGlobals(options?: { prerendering?: boolean; navigation?: Partial<PerformanceNavigationTiming> }) {
  const documentTarget = new MockDocument();
  const windowTarget = new MockEventTarget();

  if (options?.prerendering) {
    documentTarget.prerendering = true;
  }

  const navigation: PerformanceNavigationTiming = {
    connectStart: 20,
    secureConnectionStart: 40,
    connectEnd: 80,
    workerStart: 0,
    responseStart: 180,
    requestStart: 120,
    type: 'navigate'
  } as PerformanceNavigationTiming;

  Object.assign(navigation, options?.navigation);

  class MockPerformanceObserver {
    static supportedEntryTypes: string[] = [];

    observe(): void {}

    disconnect(): void {}
  }

  vi.stubGlobal('document', documentTarget as unknown as Document);
  vi.stubGlobal('location', {
    origin: 'https://example.co.za',
    protocol: 'https:',
    host: 'example.co.za',
    href: 'https://example.co.za/pricing',
    pathname: '/pricing'
  } as Location);
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36',
    hardwareConcurrency: 8,
    deviceMemory: 4,
    connection: {
      effectiveType: '4g',
      downlink: 3.4,
      rtt: 120,
      saveData: false,
      type: 'cellular'
    },
    sendBeacon: vi.fn(() => true)
  } as Navigator);
  vi.stubGlobal('screen', {
    width: 1280,
    height: 720
  } as Screen);
  vi.stubGlobal('performance', {
    getEntriesByType: (type: string) => (type === 'navigation' ? [navigation] : [])
  } as Performance);
  vi.stubGlobal('PerformanceObserver', MockPerformanceObserver as unknown as typeof PerformanceObserver);
  vi.stubGlobal('addEventListener', windowTarget.addEventListener.bind(windowTarget));
  vi.stubGlobal('removeEventListener', windowTarget.removeEventListener.bind(windowTarget));

  return {
    documentTarget,
    windowTarget
  };
}

function createSink() {
  return {
    id: 'test-sink',
    handle: vi.fn()
  } satisfies SignalSink;
}

afterEach(() => {
  destroy();
  vi.unstubAllGlobals();
});

describe('signal lifecycle state machine', () => {
  it('moves from booting to observing on start', () => {
    expect(transitionSignalLifecycle('booting', 'start')).toBe('observing');
  });

  it('prevents double flush by staying finalizing until flush resolution', () => {
    expect(transitionSignalLifecycle('finalizing', 'pagehide')).toBe('finalizing');
    expect(transitionSignalLifecycle('finalizing', 'flush_success')).toBe('flushed');
  });

  it('creates a new observing phase after bfcache restore', () => {
    expect(transitionSignalLifecycle('sealed', 'bfcache_restore')).toBe('observing');
  });
});

describe('signal runtime integration', () => {
  it('strips query strings and hashes from document.referrer before emitting', () => {
    const { documentTarget } = setupGlobals();
    documentTarget.referrer = 'https://www.google.com/search?q=signal#debug';
    const sink = createSink();
    const controller = init({ sinks: [sink], packageVersion: 'test' });

    controller.flushNow();

    expect(sink.handle).toHaveBeenCalledTimes(1);
    expect(sink.handle.mock.calls[0]?.[0].ref).toBe('https://www.google.com/search');
  });

  it('returns the same controller for duplicate init and only emits once', () => {
    setupGlobals();
    const sink = createSink();

    const first = init({ sinks: [sink], packageVersion: 'test' });
    const second = init({ sinks: [sink], packageVersion: 'test' });

    expect(second).toBe(first);
    expect(first.getState()).toBe('observing');
    expect(first.isSampledOut()).toBe(false);

    first.flushNow();
    second.flushNow();

    expect(sink.handle).toHaveBeenCalledTimes(1);
    expect(sink.handle.mock.calls[0]?.[0].meta.browser).toBe('chrome');
    expect(sink.handle.mock.calls[0]?.[0].meta.navigation_type).toBe('navigate');
  });

  it('maps reload navigations onto the normalized navigation_type field', () => {
    setupGlobals({
      navigation: {
        type: 'reload'
      }
    });
    const sink = createSink();
    const controller = init({ sinks: [sink], packageVersion: 'test' });

    controller.flushNow();

    expect(sink.handle).toHaveBeenCalledTimes(1);
    expect(sink.handle.mock.calls[0]?.[0].meta.nav_type).toBe('reload');
    expect(sink.handle.mock.calls[0]?.[0].meta.navigation_type).toBe('reload');
  });

  it('dedupes visibilitychange and pagehide into one finalized event', () => {
    const { documentTarget, windowTarget } = setupGlobals();
    const sink = createSink();
    const controller = init({ sinks: [sink], packageVersion: 'test' });

    documentTarget.visibilityState = 'hidden';
    documentTarget.dispatch('visibilitychange', new Event('visibilitychange'));
    windowTarget.dispatch('pagehide', { persisted: false } as PageTransitionEvent);

    expect(sink.handle).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toBe('flushed');
  });

  it('waits for prerender activation before observing and flushing', () => {
    const { documentTarget } = setupGlobals({ prerendering: true });
    const sink = createSink();
    const controller = init({ sinks: [sink], packageVersion: 'test' });

    expect(controller.getState()).toBe('booting');

    controller.flushNow();
    expect(sink.handle).not.toHaveBeenCalled();

    documentTarget.prerendering = false;
    documentTarget.dispatch('prerenderingchange', new Event('prerenderingchange'));
    expect(controller.getState()).toBe('observing');

    controller.flushNow();
    expect(sink.handle).toHaveBeenCalledTimes(1);
    expect(sink.handle.mock.calls[0]?.[0].meta.navigation_type).toBe('prerender');
  });

  it('starts a fresh navigation instance after a bfcache restore', () => {
    const { windowTarget } = setupGlobals();
    const sink = createSink();
    const controller = init({ sinks: [sink], packageVersion: 'test' });

    controller.flushNow();
    const firstEventId = sink.handle.mock.calls[0]?.[0].event_id;

    windowTarget.dispatch('pageshow', { persisted: true } as PageTransitionEvent);
    expect(controller.getState()).toBe('observing');

    controller.flushNow();
    const secondEventId = sink.handle.mock.calls[1]?.[0].event_id;

    expect(sink.handle).toHaveBeenCalledTimes(2);
    expect(secondEventId).not.toBe(firstEventId);
    expect(sink.handle.mock.calls[1]?.[0].meta.navigation_type).toBe('restore');
  });

  it('keeps runtime internals in sync with the active closure state and event id', () => {
    setupGlobals();
    const sink = createSink();
    const controller = init({ sinks: [sink], packageVersion: 'test' });
    const internals = (globalThis as Record<PropertyKey, unknown>)[Symbol.for('stroma.signal.runtime')] as {
      state: string;
      eventId: string;
    };

    expect(internals.state).toBe('observing');
    expect(internals.eventId).toBe(controller.getEventId());

    controller.flushNow();

    expect(internals.state).toBe('flushed');
    expect(internals.eventId).toBe(controller.getEventId());
  });

  it('catches rejected async sink handlers without surfacing an unhandled failure', async () => {
    setupGlobals();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sink: SignalSink = {
      id: 'async-sink',
      handle: vi.fn(async () => {
        throw new Error('async sink failure');
      })
    };

    const controller = init({ sinks: [sink], packageVersion: 'test' });
    controller.flushNow();
    await Promise.resolve();

    expect(sink.handle).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[signal] sink failed', 'async-sink', expect.any(Error));
  });

  it('exposes sampled-out sessions explicitly to consumers', () => {
    setupGlobals();

    const controller = init({ sinks: [createSink()], sampleRate: 0, packageVersion: 'test' });

    expect(controller.isSampledOut()).toBe(true);
    expect(controller.getEventId()).toBe('sampled_out');
    expect(controller.getState()).toBe('sealed');
  });
});
