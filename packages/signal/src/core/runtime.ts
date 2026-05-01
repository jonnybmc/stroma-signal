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
import { deriveNavigationTiming, observeVitals } from './observe-vitals.js';
import { type SignalLifecycleState, transitionSignalLifecycle } from './state-machine.js';

const RUNTIME_KEY = Symbol.for('stroma.signal.runtime');
const EMPTY_VITALS = {
  lcp_ms: null,
  cls: null,
  inp_ms: null,
  fcp_ms: null,
  ttfb_ms: null
} satisfies SignalEventV1['vitals'];

export interface SignalRuntimeLogger {
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
}

export interface SignalInitConfig {
  sinks: SignalSink[];
  sampleRate?: number;
  networkTierThresholds?: SignalNetworkTierThresholds;
  deviceTierOverride?: (cores: number, memory: number | null, screenWidth: number) => SignalDeviceTier;
  generateTarget?: (element: Element | null) => string | null;
  // Opt-in first-party aliasing for customers with exotic infrastructure
  // whose CDN origins can't be captured by strict-host + eTLD+1 matching.
  firstPartyOriginsAllowlist?: readonly string[];
  debug?: boolean;
  packageVersion?: string;
  // Effect injection points. All optional; defaults preserve current
  // production behavior. Inject in tests / wrappers to make event
  // timestamps, ids, and sampling deterministic, and to route runtime
  // warnings into your own observability without monkeypatching the
  // global console.
  clock?: () => number;
  random?: () => number;
  eventIdFactory?: () => string;
  logger?: SignalRuntimeLogger;
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

type FinalizeReason = 'manual' | 'visibilitychange' | 'pagehide';

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

function emitToSinks(sinks: SignalSink[], event: SignalEventV1, logger: SignalRuntimeLogger): void {
  for (const sink of sinks) {
    try {
      Promise.resolve(sink.handle(event)).catch((error) => {
        logger.warn('[signal] sink failed', sink.id, error);
      });
    } catch (error) {
      logger.warn('[signal] sink failed', sink.id, error);
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

function isLoadShapedNavigationType(navigationType: SignalNavigationType): boolean {
  return navigationType !== 'restore' && navigationType !== 'prerender';
}

function createLoadScopedVitals(
  vitals: SignalEventV1['vitals'],
  navigationType: SignalNavigationType
): SignalEventV1['vitals'] {
  if (isLoadShapedNavigationType(navigationType)) return vitals;

  // Restore / prerender: load-shaped vitals (paint, interaction, third
  // party) are nulled because the timing reflects cache or
  // pre-activation state, not the user-visible load. The
  // `navigation_timing` block is intentionally PRESERVED so backend
  // visibility survives — the activation_adjusted_ttfb_ms field
  // carries the user-visible interpretation, and the raw subparts
  // remain available for debugging.
  return {
    ...vitals,
    lcp_ms: null,
    fcp_ms: null,
    ttfb_ms: null,
    lcp_attribution: undefined,
    lcp_breakdown: null,
    third_party: null
  };
}

function createLoadScopedNetwork(
  event: Pick<SignalEventV1, 'net_tier' | 'net_tcp_ms' | 'net_tcp_source'>,
  navigationType: SignalNavigationType
): Pick<SignalEventV1, 'net_tier' | 'net_tcp_ms' | 'net_tcp_source'> {
  if (isLoadShapedNavigationType(navigationType)) return event;

  return {
    net_tier: null,
    net_tcp_ms: null,
    net_tcp_source: 'unavailable_missing_timing'
  };
}

function createRuntime(config: SignalInitConfig): RuntimeInternals {
  const clock = config.clock ?? Date.now;
  const eventIdFactory = config.eventIdFactory ?? createEventId;
  const logger: SignalRuntimeLogger = config.logger ?? console;
  let state: SignalLifecycleState = 'booting';
  let eventId = eventIdFactory();
  const startedPrerendered = Boolean(
    (globalThis.document as (Document & { prerendering?: boolean }) | undefined)?.prerendering
  );
  let navigationType: SignalNavigationType = startedPrerendered ? 'prerender' : 'navigate';
  let vitalObserver: ReturnType<typeof observeVitals> | null = null;

  const startVitalObserver = (): void => {
    vitalObserver?.disconnect();
    vitalObserver = observeVitals({
      generateTarget: config.generateTarget,
      firstPartyOriginsAllowlist: config.firstPartyOriginsAllowlist
    });
  };

  const logDebugPayload = (reason: FinalizeReason, vitals: SignalEventV1['vitals'], event: SignalEventV1): void => {
    if (!config.debug) return;
    const debugSnapshot = vitalObserver?.debugSnapshot();

    logger.info('[signal] finalize', {
      reason,
      navigation_type: navigationType,
      raw_fcp_entry: debugSnapshot?.rawFcpEntry ?? null,
      raw_lcp_entry: debugSnapshot?.rawLcpEntry ?? null,
      vitals,
      event
    });
  };

  const finalize = (reason: FinalizeReason): void => {
    if (state !== 'observing') return;
    state = transitionSignalLifecycle(state, 'page_hidden');
    const navigation = getNavigationEntry();
    const thresholds = config.networkTierThresholds ?? DEFAULT_NETWORK_THRESHOLDS;
    const network = createLoadScopedNetwork(classifyNetwork(navigation, thresholds), navigationType);
    const device = classifyDevice(config.deviceTierOverride);
    const baseVitals = vitalObserver?.snapshot() ?? { ...EMPTY_VITALS };
    // navigation_timing is preserved across the load-scoped null pass
    // (see createLoadScopedVitals comment) so backend timing visibility
    // survives prerender and bfcache restore.
    const navigation_timing = deriveNavigationTiming(navigation);
    const vitals = createLoadScopedVitals({ ...baseVitals, navigation_timing }, navigationType);
    const event: SignalEventV1 = {
      v: SIGNAL_EVENT_VERSION,
      event_id: eventId,
      ts: clock(),
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
      vitals,
      context: readSignalContext(),
      meta: {
        pkg_version: config.packageVersion ?? '0.1.0',
        browser: detectBrowser(),
        navigation_type: navigationType
      }
    };
    logDebugPayload(reason, vitals, event);
    vitalObserver?.disconnect();
    vitalObserver = null;
    try {
      emitToSinks(config.sinks, event, logger);
      state = transitionSignalLifecycle(state, 'flush_success');
    } catch (error) {
      logger.warn('[signal] emitToSinks failed unexpectedly', error);
      state = transitionSignalLifecycle(state, 'flush_error');
    }
  };

  const onVisibilityChange = (): void => {
    if (globalThis.document?.visibilityState === 'hidden') finalize('visibilitychange');
  };

  const onPageHide = (): void => finalize('pagehide');

  const onPageShow = (event: PageTransitionEvent): void => {
    if (!event.persisted || state !== 'flushed') return;
    state = transitionSignalLifecycle(state, 'bfcache_restore');
    eventId = eventIdFactory();
    navigationType = 'restore';
    startVitalObserver();
  };

  const startObserving = (): void => {
    if (state !== 'booting') return;
    if (!startedPrerendered) {
      navigationType = mapNavigationType(getNavigationEntry()?.type);
    }
    state = transitionSignalLifecycle(state, 'start');
    startVitalObserver();
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
    globalThis.document?.removeEventListener('prerenderingchange', startObserving);
    globalThis.document?.removeEventListener('visibilitychange', onVisibilityChange);
    globalThis.removeEventListener?.('pagehide', onPageHide);
    globalThis.removeEventListener?.('pageshow', onPageShow);
    vitalObserver?.disconnect();
    vitalObserver = null;
    state = transitionSignalLifecycle(state, 'destroy');
  };

  const controller: SignalRuntimeController = {
    destroy() {
      teardown();
      delete (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY];
    },
    flushNow() {
      finalize('manual');
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

function shouldSample(sampleRate: number | undefined, random: () => number): boolean {
  if (sampleRate == null) return true;
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;
  return random() < sampleRate;
}

/**
 * Initialises the Signal runtime, attaching page-lifecycle listeners that
 * automatically collect a {@link SignalEventV1} and flush it to the
 * configured sinks when the page becomes hidden.
 *
 * Calling `init` more than once returns the existing controller without
 * creating a second runtime.
 *
 * @param config - Sinks, sample rate, and optional overrides.
 * @returns A controller for inspecting state or tearing down the runtime.
 */
export function init(config: SignalInitConfig): SignalRuntimeController {
  const existing = (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY] as RuntimeInternals | undefined;
  if (existing) return existing.controller;

  const random = config.random ?? Math.random;
  if (!shouldSample(config.sampleRate, random)) {
    const controller: SignalRuntimeController = {
      destroy() {
        // Mirror the live-controller cleanup: drop the singleton so a
        // subsequent init() can spin up a fresh runtime. Without this,
        // the sealed controller leaks across init/destroy cycles and
        // poisons every later init() call into returning the sealed
        // shape.
        delete (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY];
      },
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

/**
 * Tears down the current Signal runtime, removing all event listeners.
 * Safe to call even if no runtime has been initialised.
 */
export function destroy(): void {
  const existing = (globalThis as Record<PropertyKey, unknown>)[RUNTIME_KEY] as RuntimeInternals | undefined;
  existing?.controller.destroy();
}
