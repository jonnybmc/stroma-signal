import type {
  SignalDeviceTier,
  SignalEventV1,
  SignalNavigationType,
  SignalNetworkTierThresholds,
  SignalSink
} from '@stroma-labs/signal-contracts';
import { SIGNAL_EVENT_VERSION } from '@stroma-labs/signal-contracts';

import { detectBrowser } from './browser.js';
import { classifyDevice } from './classify-device.js';
import { classifyNetwork, DEFAULT_NETWORK_THRESHOLDS, getNavigationEntry } from './classify-network.js';
import { readSignalContext } from './context.js';
import { createEventId } from './create-event-id.js';
import { observeVitals } from './observe-vitals.js';
import { transitionSignalLifecycle, type SignalLifecycleState } from './state-machine.js';

const RUNTIME_KEY = Symbol.for('stroma.signal.runtime');

export interface SignalInitConfig {
  sinks: SignalSink[];
  sampleRate?: number;
  networkTierThresholds?: SignalNetworkTierThresholds;
  deviceTierOverride?: (cores: number, memory: number | null, screenWidth: number) => SignalDeviceTier;
  generateTarget?: (element: Element | null) => string | null;
  debug?: boolean;
  packageVersion?: string;
}

export interface SignalRuntimeController {
  destroy: () => void;
  flushNow: () => void;
  getState: () => SignalLifecycleState;
  getEventId: () => string;
  isSampledOut: () => boolean;
}

interface RuntimeInternals {
  state: SignalLifecycleState;
  eventId: string;
  teardown: () => void;
  controller: SignalRuntimeController;
}

function readPageUrl(): string {
  return globalThis.location?.pathname ?? '/';
}

function readReferrer(): string | null {
  const referrer = globalThis.document?.referrer;
  if (!referrer) return null;

  try {
    const parsed = new URL(referrer);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return referrer.split('#', 1)[0]?.split('?', 1)[0] ?? referrer;
  }
}

function emitToSinks(sinks: SignalSink[], event: SignalEventV1): void {
  for (const sink of sinks) {
    try {
      Promise.resolve(sink.handle(event)).catch((error) => {
        console.warn('[signal] sink failed', sink.id, error);
      });
    } catch (error) {
      console.warn('[signal] sink failed', sink.id, error);
    }
  }
}

function mapNavigationType(rawType: string | undefined): SignalNavigationType {
  switch (rawType) {
    case 'reload':
      return 'reload';
    case 'back_forward':
      return 'back-forward';
    default:
      return 'navigate';
  }
}

function createRuntime(config: SignalInitConfig): RuntimeInternals {
  let state: SignalLifecycleState = 'booting';
  let eventId = createEventId();
  const startedPrerendered = Boolean(
    (globalThis.document as Document & { prerendering?: boolean } | undefined)?.prerendering
  );
  let navigationType: SignalNavigationType = startedPrerendered ? 'prerender' : 'navigate';
  let vitalObserver = observeVitals({ generateTarget: config.generateTarget });

  const finalize = (): void => {
    if (state !== 'observing') return;
    state = transitionSignalLifecycle(state, 'page_hidden');
    const navigation = getNavigationEntry();
    const thresholds = config.networkTierThresholds ?? DEFAULT_NETWORK_THRESHOLDS;
    const network = classifyNetwork(navigation, thresholds);
    const device = classifyDevice(config.deviceTierOverride);
    const event: SignalEventV1 = {
      v: SIGNAL_EVENT_VERSION,
      event_id: eventId,
      ts: Date.now(),
      host: globalThis.location?.host ?? 'unknown.local',
      url: readPageUrl(),
      ref: readReferrer(),
      net_tier: network.net_tier,
      net_tcp_ms: network.net_tcp_ms,
      net_tcp_source: network.net_tcp_source,
      device_tier: device.device_tier,
      device_cores: device.device_cores,
      device_memory_gb: device.device_memory_gb,
      device_screen_w: device.device_screen_w,
      device_screen_h: device.device_screen_h,
      vitals: vitalObserver.snapshot(),
      context: readSignalContext(),
      meta: {
        pkg_version: config.packageVersion ?? '0.1.0',
        browser: detectBrowser(),
        nav_type: navigation?.type ?? 'navigate',
        navigation_type: navigationType
      }
    };
    vitalObserver.disconnect();
    try {
      emitToSinks(config.sinks, event);
      state = transitionSignalLifecycle(state, 'flush_success');
    } catch (error) {
      console.warn('[signal] emitToSinks failed unexpectedly', error);
      state = transitionSignalLifecycle(state, 'flush_error');
    }
  };

  const onVisibilityChange = (): void => {
    if (globalThis.document?.visibilityState === 'hidden') finalize();
  };

  const onPageHide = (): void => finalize();

  const onPageShow = (event: PageTransitionEvent): void => {
    if (!event.persisted || state !== 'flushed') return;
    state = transitionSignalLifecycle(state, 'bfcache_restore');
    eventId = createEventId();
    navigationType = 'restore';
    vitalObserver = observeVitals({ generateTarget: config.generateTarget });
  };

  const startObserving = (): void => {
    if (state !== 'booting') return;
    if (!startedPrerendered) {
      navigationType = mapNavigationType(getNavigationEntry()?.type);
    }
    state = transitionSignalLifecycle(state, 'start');
  };

  if (startedPrerendered) {
    globalThis.document?.addEventListener('prerenderingchange', startObserving, { once: true });
  } else {
    startObserving();
  }

  globalThis.document?.addEventListener('visibilitychange', onVisibilityChange);
  globalThis.addEventListener?.('pagehide', onPageHide);
  globalThis.addEventListener?.('pageshow', onPageShow);

  const teardown = (): void => {
    globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
    globalThis.removeEventListener?.('pagehide', onPageHide);
    globalThis.removeEventListener?.('pageshow', onPageShow);
    vitalObserver.disconnect();
    state = transitionSignalLifecycle(state, 'destroy');
  };

  const controller: SignalRuntimeController = {
    destroy() {
      teardown();
      delete (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY];
    },
    flushNow() {
      finalize();
    },
    getState() {
      return state;
    },
    getEventId() {
      return eventId;
    },
    isSampledOut() {
      return false;
    }
  };

  return {
    get state() {
      return state;
    },
    get eventId() {
      return eventId;
    },
    teardown,
    controller
  };
}

function shouldSample(sampleRate: number | undefined): boolean {
  if (sampleRate == null) return true;
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  return Math.random() < sampleRate;
}

export function init(config: SignalInitConfig): SignalRuntimeController {
  const existing = (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY] as RuntimeInternals | undefined;
  if (existing) return existing.controller;

  if (!shouldSample(config.sampleRate)) {
    const controller: SignalRuntimeController = {
      destroy() {},
      flushNow() {},
      getState() {
        return 'sealed';
      },
      getEventId() {
        return 'sampled_out';
      },
      isSampledOut() {
        return true;
      }
    };
    (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY] = {
      state: 'sealed',
      eventId: 'sampled_out',
      teardown() {},
      controller
    } satisfies RuntimeInternals;
    return controller;
  }

  const runtime = createRuntime(config);
  (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY] = runtime;
  return runtime.controller;
}

export function destroy(): void {
  const existing = (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY] as RuntimeInternals | undefined;
  existing?.controller.destroy();
}
