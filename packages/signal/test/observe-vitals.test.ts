import { afterEach, describe, expect, it, vi } from 'vitest';

import { observeVitals } from '../src/core/observe-vitals.js';

type ObserverCallback = (entries: PerformanceEntry[]) => void;

interface ObserverRegistration {
  callback: ObserverCallback;
  pending: PerformanceEntry[];
}

const registrations = new Map<string, ObserverRegistration[]>();

class MockPerformanceObserver {
  static supportedEntryTypes = ['event', 'largest-contentful-paint', 'layout-shift', 'paint'];

  private callback: ObserverCallback;
  private registration: ObserverRegistration | null = null;

  constructor(callback: (list: PerformanceObserverEntryList) => void) {
    this.callback = (entries) =>
      callback({
        getEntries: () => entries
      } as PerformanceObserverEntryList);
  }

  observe(options?: PerformanceObserverInit): void {
    const type = options?.type;
    if (!type) return;

    this.registration = {
      callback: this.callback,
      pending: []
    };
    const current = registrations.get(type) ?? [];
    current.push(this.registration);
    registrations.set(type, current);
  }

  takeRecords(): PerformanceEntry[] {
    return this.registration?.pending.splice(0) ?? [];
  }

  disconnect(): void {}
}

function emitEntries(type: string, entries: PerformanceEntry[]): void {
  for (const registration of registrations.get(type) ?? []) {
    registration.callback(entries);
  }
}

function queueEntries(type: string, entries: PerformanceEntry[]): void {
  for (const registration of registrations.get(type) ?? []) {
    registration.pending.push(...entries);
  }
}

function setupObserverTest(options?: {
  readyState?: DocumentReadyState;
  navigation?: Partial<PerformanceNavigationTiming>;
}) {
  vi.stubGlobal('PerformanceObserver', MockPerformanceObserver as unknown as typeof PerformanceObserver);
  vi.stubGlobal('document', {
    readyState: options?.readyState ?? 'complete'
  } as Document);
  vi.stubGlobal('location', {
    origin: 'https://example.co.za',
    protocol: 'https:',
    host: 'example.co.za',
    href: 'https://example.co.za/pricing',
    pathname: '/pricing'
  } as Location);
  vi.stubGlobal('performance', {
    getEntriesByType: (type: string) =>
      type === 'navigation'
        ? [
            {
              startTime: 0,
              activationStart: 0,
              responseStart: 180,
              requestStart: 120,
              ...(options?.navigation ?? {})
            }
          ]
        : []
  } as Performance);
}

afterEach(() => {
  registrations.clear();
  vi.unstubAllGlobals();
});

describe('observeVitals', () => {
  it('computes INP from the p98 of grouped interaction durations', () => {
    setupObserverTest();

    const observer = observeVitals();
    emitEntries('event', [
      { duration: 40, interactionId: 101 } as PerformanceEntry,
      { duration: 120, interactionId: 101 } as PerformanceEntry,
      { duration: 80, interactionId: 202 } as PerformanceEntry
    ]);

    expect(observer.snapshot().inp_ms).toBe(120);
  });

  it('reports TTFB from navigation start instead of request start', () => {
    setupObserverTest({
      navigation: {
        startTime: 0,
        activationStart: 0,
        responseStart: 180,
        requestStart: 120
      }
    });

    const observer = observeVitals();

    expect(observer.snapshot().ttfb_ms).toBe(180);
  });

  it('captures LCP attribution with load state and sanitized resource context', () => {
    setupObserverTest({
      readyState: 'interactive'
    });

    const observer = observeVitals();
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_400,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/assets/hero.webp?cache=1#top'
      } as PerformanceEntry
    ]);

    expect(observer.snapshot().lcp_attribution).toEqual({
      load_state: 'interactive',
      target: 'img',
      element_type: 'image',
      resource_url: '/assets/hero.webp'
    });
  });

  it('drains pending observer records before building the vitals snapshot', () => {
    setupObserverTest();

    const observer = observeVitals();
    queueEntries('largest-contentful-paint', [
      {
        startTime: 3_100,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/assets/hero.webp?cache=1'
      } as PerformanceEntry
    ]);

    expect(observer.snapshot()).toMatchObject({
      lcp_ms: 3_100,
      lcp_attribution: {
        target: 'img',
        resource_url: '/assets/hero.webp'
      }
    });
  });

  it('uses the custom generateTarget hook safely for LCP and INP attribution', () => {
    setupObserverTest();

    const observer = observeVitals({
      generateTarget(element) {
        return element?.tagName?.toLowerCase() === 'button' ? 'primary-cta' : 'hero-media';
      }
    });

    emitEntries('largest-contentful-paint', [
      {
        startTime: 1_500,
        element: { tagName: 'IMG' },
        url: 'https://cdn.example.net/hero.webp?token=abc'
      } as PerformanceEntry
    ]);
    emitEntries('event', [
      {
        duration: 240,
        interactionId: 99,
        startTime: 3_500,
        processingStart: 3_540,
        processingEnd: 3_660,
        name: 'click',
        target: { tagName: 'BUTTON' }
      } as PerformanceEntry
    ]);

    const snapshot = observer.snapshot();

    expect(snapshot.lcp_attribution?.target).toBe('hero-media');
    expect(snapshot.lcp_attribution?.resource_url).toBe('https://cdn.example.net/hero.webp');
    expect(snapshot.inp_attribution?.interaction_target).toBe('primary-cta');
  });

  it('keeps INP attribution aligned with the same grouped interaction that produced inp_ms', () => {
    setupObserverTest({
      readyState: 'loading'
    });

    const observer = observeVitals();
    emitEntries('event', [
      {
        duration: 160,
        interactionId: 101,
        startTime: 2_100,
        processingStart: 2_120,
        processingEnd: 2_200,
        name: 'keydown',
        target: { tagName: 'INPUT' }
      } as PerformanceEntry,
      {
        duration: 240,
        interactionId: 202,
        startTime: 3_500,
        processingStart: 3_540,
        processingEnd: 3_660,
        name: 'pointerdown',
        target: { tagName: 'BUTTON' }
      } as PerformanceEntry
    ]);

    expect(observer.snapshot()).toMatchObject({
      inp_ms: 240,
      inp_attribution: {
        load_state: 'loading',
        interaction_target: 'button',
        interaction_type: 'pointer',
        interaction_time_ms: 3_500,
        input_delay_ms: 40,
        processing_duration_ms: 120,
        presentation_delay_ms: 80
      }
    });
  });
});
