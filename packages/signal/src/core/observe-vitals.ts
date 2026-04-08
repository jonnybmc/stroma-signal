import type {
  SignalInpAttribution,
  SignalInteractionType,
  SignalLcpAttribution,
  SignalLcpElementType,
  SignalLoadState,
  SignalVitals
} from '@stroma-labs/signal-contracts';

export interface ObserveVitalsOptions {
  generateTarget?: (element: Element | null) => string | null;
}

export interface VitalObserverController {
  disconnect: () => void;
  snapshot: () => SignalVitals;
}

interface InpInteractionRecord {
  duration: number;
  attribution: SignalInpAttribution;
}

type LargestContentfulPaintEntry = PerformanceEntry & {
  startTime: number;
  element?: Element | null;
  url?: string;
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

  return {
    load_state: readLoadState(),
    interaction_target: generateTarget(entry.target ?? null),
    interaction_type: inferInteractionType(entry.name),
    interaction_time_ms: roundPositive(startTime),
    input_delay_ms: roundPositive(inputDelay),
    processing_duration_ms: roundPositive(processingDuration),
    presentation_delay_ms: roundPositive(presentationDelay)
  };
}

export function observeVitals(options: ObserveVitalsOptions = {}): VitalObserverController {
  const generateTarget = options.generateTarget ?? defaultGenerateTarget;
  let largestContentfulPaint: number | null = null;
  let lcpAttribution: SignalLcpAttribution | undefined;
  let cumulativeLayoutShift = 0;
  const interactionRecords = new Map<number, InpInteractionRecord>();
  let firstContentfulPaint: number | null = null;

  const observers: PerformanceObserver[] = [];

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
    observers.push(observer);
  };

  createObserver(
    'largest-contentful-paint',
    (entry) => {
      const lcpEntry = entry as LargestContentfulPaintEntry;
      largestContentfulPaint = Math.round(lcpEntry.startTime);
      const resourceUrl = sanitizeResourceUrl(lcpEntry.url);
      lcpAttribution = {
        load_state: readLoadState(),
        target: generateTarget(lcpEntry.element ?? null),
        element_type: inferLcpElementType(lcpEntry.element ?? null, resourceUrl),
        resource_url: resourceUrl
      };
    },
    { type: 'largest-contentful-paint', buffered: true }
  );

  createObserver(
    'layout-shift',
    (entry) => {
      const layoutShift = entry as LayoutShiftEntry;
      if (!layoutShift.hadRecentInput) {
        cumulativeLayoutShift += layoutShift.value ?? 0;
      }
    },
    { type: 'layout-shift', buffered: true }
  );

  createObserver(
    'paint',
    (entry) => {
      const paintEntry = entry as PaintEntry;
      if (paintEntry.name === 'first-contentful-paint') {
        firstContentfulPaint = Math.round(paintEntry.startTime);
      }
    },
    { type: 'paint', buffered: true }
  );

  createObserver(
    'event',
    (entry) => {
      const eventEntry = entry as EventTimingEntry;
      const duration = eventEntry.duration ?? null;
      const interactionId = eventEntry.interactionId ?? 0;
      if (duration == null || !Number.isFinite(duration) || interactionId <= 0) return;

      const current = interactionRecords.get(interactionId);
      if (!current || duration > current.duration) {
        interactionRecords.set(interactionId, {
          duration,
          attribution: createInpAttribution(eventEntry, generateTarget)
        });
      }
    },
    { type: 'event', buffered: true, durationThreshold: 40 } as PerformanceObserverInit
  );

  return {
    disconnect() {
      for (const observer of observers) observer.disconnect();
    },
    snapshot() {
      const navigation = globalThis.performance?.getEntriesByType?.('navigation')?.[0] as
        | (PerformanceNavigationTiming & { activationStart?: number })
        | undefined;
      const navigationStart = navigation
        ? navigation.activationStart && navigation.activationStart > 0
          ? navigation.activationStart
          : navigation.startTime
        : 0;
      const ttfb =
        navigation && navigation.responseStart > 0 ? Math.round(navigation.responseStart - navigationStart) : null;
      const inpRecord = pickInpRecord([...interactionRecords.values()]);

      return {
        lcp_ms: largestContentfulPaint,
        cls: cumulativeLayoutShift > 0 ? Number(cumulativeLayoutShift.toFixed(3)) : null,
        inp_ms: inpRecord ? Math.round(inpRecord.duration) : null,
        fcp_ms: firstContentfulPaint,
        ttfb_ms: ttfb,
        lcp_attribution: largestContentfulPaint != null ? lcpAttribution : undefined,
        inp_attribution: inpRecord?.attribution
      };
    }
  };
}
