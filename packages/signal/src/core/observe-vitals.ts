import type {
  SignalInpAttribution,
  SignalInpPhase,
  SignalInteractionType,
  SignalLcpAttribution,
  SignalLcpBreakdown,
  SignalLcpCulpritKind,
  SignalLcpElementType,
  SignalLoadState,
  SignalVitals
} from '@stroma-labs/signal-contracts';

// Culprit-kind regex patterns — compiled once at module load (§9a.3).
const LCP_HERO_URL_PATTERN = /(hero|banner|splash|cover)/i;
const LCP_PRODUCT_URL_PATTERN = /(product|sku|gallery|pdp)/i;
const LCP_VIDEO_URL_PATTERN = /(poster|video|thumb(?:nail)?)/i;
const LCP_BANNER_TARGET_PATTERN = /banner/i;

// INP interactionRecords Map cap (§2.3). Unbounded map on long-lived SPA
// sessions was a memory regression risk for customer apps; capping at 100
// with lowest-duration eviction preserves the p98 INP selection.
const INP_INTERACTION_RECORDS_CAP = 100;

export interface ObserveVitalsOptions {
  generateTarget?: (element: Element | null) => string | null;
}

interface RawPaintDebugEntry {
  entry_type: 'paint';
  name: string;
  start_time_ms: number;
}

interface RawLcpDebugEntry {
  entry_type: 'largest-contentful-paint';
  start_time_ms: number;
  url: string | null;
  element_tag: string | null;
}

interface VitalObserverDebugSnapshot {
  rawFcpEntry: RawPaintDebugEntry | null;
  rawLcpEntry: RawLcpDebugEntry | null;
}

export interface VitalObserverController {
  disconnect: () => void;
  snapshot: () => SignalVitals;
  debugSnapshot: () => VitalObserverDebugSnapshot;
}

interface InpInteractionRecord {
  duration: number;
  attribution: SignalInpAttribution;
}

type LargestContentfulPaintEntry = PerformanceEntry & {
  startTime: number;
  element?: Element | null;
  url?: string;
  loadTime?: number;
};

type LayoutShiftEntry = PerformanceEntry & {
  hadRecentInput?: boolean;
  value?: number;
};

type PaintEntry = PerformanceEntry & {
  name: string;
  startTime: number;
};

type EventTimingEntry = PerformanceEntry & {
  duration?: number;
  interactionId?: number;
  startTime?: number;
  processingStart?: number;
  processingEnd?: number;
  name?: string;
  target?: Element | null;
};

interface ObservedPerformanceStream {
  observer: PerformanceObserver;
  handle: (entry: PerformanceEntry) => void;
}

function percentileIndex(length: number, ratio: number): number {
  return Math.max(0, Math.ceil(length * ratio) - 1);
}

function pickInpRecord(records: readonly InpInteractionRecord[]): InpInteractionRecord | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort((left, right) => left.duration - right.duration);
  const index = percentileIndex(sorted.length, 0.98);
  return sorted[index] ?? sorted[sorted.length - 1] ?? null;
}

function readLoadState(): SignalLoadState {
  switch (globalThis.document?.readyState) {
    case 'loading':
      return 'loading';
    case 'interactive':
      return 'interactive';
    default:
      return 'complete';
  }
}

function defaultGenerateTarget(element: Element | null): string | null {
  return element?.tagName?.toLowerCase() ?? null;
}

function readCurrentOrigin(): string | null {
  if (typeof globalThis.location?.origin === 'string' && globalThis.location.origin.length > 0) {
    return globalThis.location.origin;
  }
  if (
    typeof globalThis.location?.protocol === 'string' &&
    typeof globalThis.location?.host === 'string' &&
    globalThis.location.protocol.length > 0 &&
    globalThis.location.host.length > 0
  ) {
    return `${globalThis.location.protocol}//${globalThis.location.host}`;
  }
  return null;
}

function sanitizeResourceUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  try {
    const origin = readCurrentOrigin();
    const base =
      typeof globalThis.location?.href === 'string' && globalThis.location.href.length > 0
        ? globalThis.location.href
        : (origin ?? 'https://signal.invalid/');
    const parsed = new URL(rawUrl, base);
    const sameOrigin = origin
      ? parsed.origin === origin
      : typeof globalThis.location?.host === 'string' && parsed.host === globalThis.location.host;

    if (sameOrigin) {
      return parsed.pathname || '/';
    }

    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split('#', 1)[0]?.split('?', 1)[0] ?? rawUrl;
  }
}

function inferLcpElementType(element: Element | null, resourceUrl: string | null): SignalLcpElementType | null {
  const tagName = element?.tagName?.toLowerCase();
  if (tagName === 'img' || tagName === 'image' || tagName === 'svg' || resourceUrl) return 'image';
  if (tagName) return 'text';
  return null;
}

function inferInteractionType(name: string | undefined): SignalInteractionType | null {
  if (!name) return null;
  const normalized = name.toLowerCase();
  if (
    normalized.includes('pointer') ||
    normalized.includes('mouse') ||
    normalized.includes('click') ||
    normalized.includes('touch')
  ) {
    return 'pointer';
  }
  if (normalized.includes('key')) return 'keyboard';
  return null;
}

function roundPositive(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function classifyLcpCulprit(
  elementType: SignalLcpElementType | null,
  resourceUrl: string | null,
  target: string | null
): SignalLcpCulpritKind {
  if (elementType === 'text') return 'headline_text';
  if (elementType === 'image') {
    if (resourceUrl) {
      if (LCP_HERO_URL_PATTERN.test(resourceUrl)) return 'hero_image';
      if (LCP_PRODUCT_URL_PATTERN.test(resourceUrl)) return 'product_image';
      if (LCP_VIDEO_URL_PATTERN.test(resourceUrl)) return 'video_poster';
    }
    if (target && LCP_BANNER_TARGET_PATTERN.test(target)) return 'banner_image';
    return 'hero_image';
  }
  return 'unknown';
}

// Tiebreak order: processing > input_delay > presentation — most actionable first.
function deriveInpDominantPhase(
  inputDelayMs: number | null,
  processingDurationMs: number | null,
  presentationDelayMs: number | null
): SignalInpPhase | null {
  if (inputDelayMs == null && processingDurationMs == null && presentationDelayMs == null) {
    return null;
  }
  const processing = processingDurationMs ?? -1;
  const inputDelay = inputDelayMs ?? -1;
  const presentation = presentationDelayMs ?? -1;
  if (processing >= inputDelay && processing >= presentation) return 'processing';
  if (inputDelay >= presentation) return 'input_delay';
  return 'presentation';
}

// All-or-nothing per §2.1. Any missing input → whole breakdown is null.
function deriveLcpBreakdown(
  rawStartTime: number | undefined,
  rawLoadTime: number | undefined,
  rawUrl: string | undefined,
  elementType: SignalLcpElementType | null,
  navResponseStart: number,
  resourceEntries: readonly PerformanceResourceTiming[]
): SignalLcpBreakdown | null {
  if (rawStartTime == null || !Number.isFinite(rawStartTime)) return null;
  if (!Number.isFinite(navResponseStart) || navResponseStart <= 0) return null;

  if (elementType === 'text') {
    return {
      resource_load_delay_ms: 0,
      resource_load_time_ms: 0,
      element_render_delay_ms: Math.max(0, Math.round(rawStartTime - navResponseStart))
    };
  }

  if (elementType === 'image') {
    if (!rawUrl || rawLoadTime == null || !Number.isFinite(rawLoadTime) || rawLoadTime <= 0) return null;
    const match = resourceEntries.find((entry) => entry.name === rawUrl);
    if (!match) return null;
    if (
      !Number.isFinite(match.requestStart) ||
      !Number.isFinite(match.responseEnd) ||
      match.requestStart <= 0 ||
      match.responseEnd <= 0
    ) {
      return null;
    }
    return {
      resource_load_delay_ms: Math.max(0, Math.round(match.requestStart - navResponseStart)),
      resource_load_time_ms: Math.max(0, Math.round(match.responseEnd - match.requestStart)),
      element_render_delay_ms: Math.max(0, Math.round(rawStartTime - rawLoadTime))
    };
  }

  return null;
}

function createInpAttribution(
  entry: EventTimingEntry,
  generateTarget: (element: Element | null) => string | null
): SignalInpAttribution {
  const startTime = entry.startTime ?? 0;
  const processingStart = entry.processingStart;
  const processingEnd = entry.processingEnd;
  const duration = entry.duration ?? 0;
  const inputDelay = processingStart != null ? processingStart - startTime : undefined;
  const processingDuration =
    processingStart != null && processingEnd != null ? processingEnd - processingStart : undefined;
  const presentationDelay = processingEnd != null ? duration - (processingEnd - startTime) : undefined;
  const inputDelayMs = roundPositive(inputDelay);
  const processingDurationMs = roundPositive(processingDuration);
  const presentationDelayMs = roundPositive(presentationDelay);

  return {
    load_state: readLoadState(),
    interaction_target: generateTarget(entry.target ?? null),
    interaction_type: inferInteractionType(entry.name),
    interaction_time_ms: roundPositive(startTime),
    input_delay_ms: inputDelayMs,
    processing_duration_ms: processingDurationMs,
    presentation_delay_ms: presentationDelayMs,
    dominant_phase: deriveInpDominantPhase(inputDelayMs, processingDurationMs, presentationDelayMs)
  };
}

export function observeVitals(options: ObserveVitalsOptions = {}): VitalObserverController {
  const generateTarget = options.generateTarget ?? defaultGenerateTarget;
  let largestContentfulPaint: number | null = null;
  let lcpAttribution: SignalLcpAttribution | undefined;
  let lcpRawStartTime: number | undefined;
  let lcpRawLoadTime: number | undefined;
  let lcpRawUrl: string | undefined;
  let lcpElementType: SignalLcpElementType | null = null;
  let cumulativeLayoutShift = 0;
  const interactionRecords = new Map<number, InpInteractionRecord>();
  let firstContentfulPaint: number | null = null;
  let rawFcpEntry: RawPaintDebugEntry | null = null;
  let rawLcpEntry: RawLcpDebugEntry | null = null;

  const observers: ObservedPerformanceStream[] = [];

  const handleLcpEntry = (entry: PerformanceEntry): void => {
    const lcpEntry = entry as LargestContentfulPaintEntry;
    largestContentfulPaint = Math.round(lcpEntry.startTime);
    lcpRawStartTime = lcpEntry.startTime;
    lcpRawLoadTime = lcpEntry.loadTime;
    lcpRawUrl = lcpEntry.url;
    rawLcpEntry = {
      entry_type: 'largest-contentful-paint',
      start_time_ms: Math.round(lcpEntry.startTime),
      url: lcpEntry.url ?? null,
      element_tag: lcpEntry.element?.tagName?.toLowerCase() ?? null
    };
    const resourceUrl = sanitizeResourceUrl(lcpEntry.url);
    const elementType = inferLcpElementType(lcpEntry.element ?? null, resourceUrl);
    const target = generateTarget(lcpEntry.element ?? null);
    lcpElementType = elementType;
    lcpAttribution = {
      load_state: readLoadState(),
      target,
      element_type: elementType,
      resource_url: resourceUrl,
      culprit_kind: classifyLcpCulprit(elementType, resourceUrl, target)
    };
  };

  const handleLayoutShiftEntry = (entry: PerformanceEntry): void => {
    const layoutShift = entry as LayoutShiftEntry;
    if (!layoutShift.hadRecentInput) {
      cumulativeLayoutShift += layoutShift.value ?? 0;
    }
  };

  const handlePaintEntry = (entry: PerformanceEntry): void => {
    const paintEntry = entry as PaintEntry;
    if (paintEntry.name === 'first-contentful-paint') {
      firstContentfulPaint = Math.round(paintEntry.startTime);
      rawFcpEntry = {
        entry_type: 'paint',
        name: paintEntry.name,
        start_time_ms: Math.round(paintEntry.startTime)
      };
    }
  };

  const handleEventTimingEntry = (entry: PerformanceEntry): void => {
    const eventEntry = entry as EventTimingEntry;
    const duration = eventEntry.duration ?? null;
    const interactionId = eventEntry.interactionId ?? 0;
    if (duration == null || !Number.isFinite(duration) || interactionId <= 0) return;

    const current = interactionRecords.get(interactionId);
    if (current) {
      if (duration <= current.duration) return;
      interactionRecords.set(interactionId, {
        duration,
        attribution: createInpAttribution(eventEntry, generateTarget)
      });
      return;
    }

    if (interactionRecords.size >= INP_INTERACTION_RECORDS_CAP) {
      let evictKey: number | null = null;
      let evictDuration = Number.POSITIVE_INFINITY;
      for (const [key, record] of interactionRecords) {
        if (record.duration < evictDuration) {
          evictDuration = record.duration;
          evictKey = key;
        }
      }
      if (duration <= evictDuration) return;
      if (evictKey != null) interactionRecords.delete(evictKey);
    }

    interactionRecords.set(interactionId, {
      duration,
      attribution: createInpAttribution(eventEntry, generateTarget)
    });
  };

  const drainPendingRecords = (): void => {
    for (const { observer, handle } of observers) {
      const records = typeof observer.takeRecords === 'function' ? observer.takeRecords() : [];
      for (const entry of records) handle(entry);
    }
  };

  const createObserver = (
    type: string,
    callback: (entry: PerformanceEntry) => void,
    options?: PerformanceObserverInit
  ): void => {
    if (typeof PerformanceObserver === 'undefined') return;
    if (!(PerformanceObserver as typeof PerformanceObserver).supportedEntryTypes?.includes(type)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) callback(entry);
    });
    observer.observe(options ?? { type, buffered: true });
    observers.push({ observer, handle: callback });
  };

  createObserver('largest-contentful-paint', handleLcpEntry, { type: 'largest-contentful-paint', buffered: true });

  createObserver('layout-shift', handleLayoutShiftEntry, { type: 'layout-shift', buffered: true });

  createObserver('paint', handlePaintEntry, { type: 'paint', buffered: true });

  createObserver('event', handleEventTimingEntry, {
    type: 'event',
    buffered: true,
    durationThreshold: 40
  } as PerformanceObserverInit);

  return {
    disconnect() {
      for (const { observer } of observers) observer.disconnect();
    },
    snapshot() {
      drainPendingRecords();
      const navigation = globalThis.performance?.getEntriesByType?.('navigation')?.[0] as
        | (PerformanceNavigationTiming & { activationStart?: number })
        | undefined;
      const navigationStart = navigation
        ? navigation.activationStart != null && navigation.activationStart > 0
          ? navigation.activationStart
          : (navigation.startTime ?? 0)
        : 0;
      const ttfb =
        navigation && navigation.responseStart > 0 ? Math.round(navigation.responseStart - navigationStart) : null;
      const inpRecord = pickInpRecord([...interactionRecords.values()]);
      const resourceEntries =
        (globalThis.performance?.getEntriesByType?.('resource') as PerformanceResourceTiming[] | undefined) ?? [];
      const lcpBreakdown =
        largestContentfulPaint != null
          ? deriveLcpBreakdown(
              lcpRawStartTime,
              lcpRawLoadTime,
              lcpRawUrl,
              lcpElementType,
              navigation?.responseStart ?? 0,
              resourceEntries
            )
          : null;

      return {
        lcp_ms: largestContentfulPaint,
        cls: cumulativeLayoutShift > 0 ? Number(cumulativeLayoutShift.toFixed(3)) : null,
        inp_ms: inpRecord ? Math.round(inpRecord.duration) : null,
        fcp_ms: firstContentfulPaint,
        ttfb_ms: ttfb,
        lcp_attribution: largestContentfulPaint != null ? lcpAttribution : undefined,
        inp_attribution: inpRecord?.attribution,
        lcp_breakdown: lcpBreakdown
      };
    },
    debugSnapshot() {
      drainPendingRecords();
      return {
        rawFcpEntry,
        rawLcpEntry
      };
    }
  };
}
