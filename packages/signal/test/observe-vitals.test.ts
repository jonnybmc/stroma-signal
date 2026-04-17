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
  resources?: Partial<PerformanceResourceTiming>[];
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
    getEntriesByType: (type: string) => {
      if (type === 'navigation') {
        return [
          {
            startTime: 0,
            activationStart: 0,
            responseStart: 180,
            requestStart: 120,
            ...(options?.navigation ?? {})
          }
        ];
      }
      if (type === 'resource') return options?.resources ?? [];
      return [];
    }
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
      resource_url: '/assets/hero.webp',
      culprit_kind: 'hero_image'
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

  it('classifies LCP culprit kind by element type, URL pattern, and target hints', () => {
    setupObserverTest();

    const observer = observeVitals({
      generateTarget: (element) =>
        element?.tagName?.toLowerCase() === 'img' ? 'img.site-banner' : (element?.tagName?.toLowerCase() ?? null)
    });

    // Product image URL wins over default bias
    emitEntries('largest-contentful-paint', [
      {
        startTime: 1_800,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/assets/product/sku-42.webp'
      } as PerformanceEntry
    ]);
    expect(observer.snapshot().lcp_attribution?.culprit_kind).toBe('product_image');

    // Banner target falls through when URL has no keyword match
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_000,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/assets/generic.webp'
      } as PerformanceEntry
    ]);
    expect(observer.snapshot().lcp_attribution?.culprit_kind).toBe('banner_image');

    // Text LCP → headline_text
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_200,
        element: { tagName: 'H1' },
        url: undefined
      } as unknown as PerformanceEntry
    ]);
    expect(observer.snapshot().lcp_attribution?.culprit_kind).toBe('headline_text');

    // Video poster URL → video_poster
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_400,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/media/poster-01.jpg'
      } as PerformanceEntry
    ]);
    expect(observer.snapshot().lcp_attribution?.culprit_kind).toBe('video_poster');
  });

  it('derives INP dominant phase with processing > input_delay > presentation tiebreak', () => {
    setupObserverTest();

    const observer = observeVitals();
    emitEntries('event', [
      {
        duration: 300,
        interactionId: 401,
        startTime: 1_000,
        processingStart: 1_060,
        processingEnd: 1_260,
        name: 'pointerdown',
        target: { tagName: 'BUTTON' }
      } as PerformanceEntry
    ]);

    expect(observer.snapshot().inp_attribution?.dominant_phase).toBe('processing');

    // Tiebreak: equal input_delay and processing → processing wins
    emitEntries('event', [
      {
        duration: 200,
        interactionId: 402,
        startTime: 2_000,
        processingStart: 2_050,
        processingEnd: 2_100,
        name: 'click',
        target: { tagName: 'A' }
      } as PerformanceEntry
    ]);
    expect(observer.snapshot().inp_attribution?.dominant_phase).toBe('processing');
  });

  it('caps interactionRecords at 100 and evicts the lowest-duration entry', () => {
    setupObserverTest();

    const observer = observeVitals();
    // Seed 100 low-duration interactions
    const seedEntries = Array.from({ length: 100 }, (_, i) => ({
      duration: 50 + i,
      interactionId: 1_000 + i,
      startTime: i * 10,
      processingStart: i * 10 + 5,
      processingEnd: i * 10 + 20,
      name: 'click',
      target: null
    })) as unknown as PerformanceEntry[];
    emitEntries('event', seedEntries);

    // Push 100 higher-duration interactions that should evict the lowest
    const highEntries = Array.from({ length: 100 }, (_, i) => ({
      duration: 500 + i,
      interactionId: 2_000 + i,
      startTime: 10_000 + i * 10,
      processingStart: 10_000 + i * 10 + 5,
      processingEnd: 10_000 + i * 10 + 20,
      name: 'click',
      target: null
    })) as unknown as PerformanceEntry[];
    emitEntries('event', highEntries);

    // p98 of the retained 100 must come from the high-duration cohort (>= 500)
    const snapshot = observer.snapshot();
    expect(snapshot.inp_ms).toBeGreaterThanOrEqual(500);
  });

  it('derives LCP breakdown for image LCP when matching resource timing is present', () => {
    const resourceEntry = {
      name: 'https://example.co.za/assets/hero.webp?cache=1',
      initiatorType: 'img',
      startTime: 200,
      requestStart: 250,
      responseStart: 400,
      responseEnd: 600,
      transferSize: 48_000,
      encodedBodySize: 45_000,
      duration: 400
    } as PerformanceResourceTiming;

    setupObserverTest({
      navigation: {
        startTime: 0,
        activationStart: 0,
        responseStart: 180,
        requestStart: 120
      },
      resources: [resourceEntry]
    });

    const observer = observeVitals();
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_400,
        loadTime: 2_100,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/assets/hero.webp?cache=1'
      } as PerformanceEntry
    ]);

    expect(observer.snapshot().lcp_breakdown).toEqual({
      resource_load_delay_ms: 70,
      resource_load_time_ms: 350,
      element_render_delay_ms: 300
    });
  });

  it('returns null lcp_breakdown when matching resource timing is missing (all-or-nothing)', () => {
    setupObserverTest({
      navigation: {
        startTime: 0,
        activationStart: 0,
        responseStart: 180,
        requestStart: 120
      },
      resources: []
    });

    const observer = observeVitals();
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_400,
        loadTime: 2_100,
        element: { tagName: 'IMG' },
        url: 'https://example.co.za/assets/hero.webp'
      } as PerformanceEntry
    ]);

    expect(observer.snapshot().lcp_breakdown).toBeNull();
  });

  it('derives LCP breakdown for text LCP as element_render_delay with zero resource phases', () => {
    setupObserverTest({
      navigation: {
        startTime: 0,
        activationStart: 0,
        responseStart: 180,
        requestStart: 120
      }
    });

    const observer = observeVitals();
    emitEntries('largest-contentful-paint', [
      {
        startTime: 1_500,
        element: { tagName: 'H1' },
        url: undefined
      } as unknown as PerformanceEntry
    ]);

    expect(observer.snapshot().lcp_breakdown).toEqual({
      resource_load_delay_ms: 0,
      resource_load_time_ms: 0,
      element_render_delay_ms: 1_320
    });
  });

  it('null-safes lcp_breakdown when opaque cross-origin resource lacks requestStart', () => {
    const opaqueEntry = {
      name: 'https://cdn.third.party/hero.webp',
      initiatorType: 'img',
      startTime: 200,
      requestStart: 0,
      responseStart: 0,
      responseEnd: 0,
      transferSize: 0,
      encodedBodySize: 0,
      duration: 0
    } as PerformanceResourceTiming;

    setupObserverTest({
      navigation: {
        startTime: 0,
        activationStart: 0,
        responseStart: 180,
        requestStart: 120
      },
      resources: [opaqueEntry]
    });

    const observer = observeVitals();
    emitEntries('largest-contentful-paint', [
      {
        startTime: 2_400,
        loadTime: 2_100,
        element: { tagName: 'IMG' },
        url: 'https://cdn.third.party/hero.webp'
      } as PerformanceEntry
    ]);

    expect(observer.snapshot().lcp_breakdown).toBeNull();
  });
});
