import { aggregateSignalEvents } from '../aggregation.js';
import type { SignalAggregateV1, SignalEventV1, SignalNetTcpSource } from '../types.js';

export const chromeColdNavFixture: SignalEventV1 = {
  v: 1,
  event_id: 'evt_chrome_cold_nav',
  ts: Date.UTC(2026, 3, 8, 10, 0, 0),
  host: 'example.co.za',
  url: '/personal-loans',
  ref: 'https://www.google.com/',
  net_tier: 'constrained_moderate',
  net_tcp_ms: 247,
  net_tcp_source: 'nav_timing_tcp_isolated',
  device_tier: 'low',
  device_cores: 4,
  device_memory_gb: 2,
  device_screen_w: 390,
  device_screen_h: 844,
  vitals: {
    lcp_ms: 8742,
    cls: 0.17,
    inp_ms: 340,
    fcp_ms: 3012,
    ttfb_ms: 813,
    lcp_attribution: {
      load_state: 'complete',
      target: 'img',
      element_type: 'image',
      resource_url: '/assets/hero.webp'
    },
    inp_attribution: {
      load_state: 'interactive',
      interaction_target: 'button',
      interaction_type: 'pointer',
      interaction_time_ms: 5_230,
      input_delay_ms: 42,
      processing_duration_ms: 180,
      presentation_delay_ms: 118
    }
  },
  context: {
    effective_type: '4g',
    downlink_mbps: 2.3,
    rtt_ms: 200,
    save_data: false,
    connection_type: 'cellular'
  },
  meta: {
    pkg_version: '0.1.0',
    browser: 'chrome',
    nav_type: 'navigate',
    navigation_type: 'navigate'
  }
};

export const safariFallbackFixture: SignalEventV1 = {
  ...chromeColdNavFixture,
  event_id: 'evt_safari',
  ts: Date.UTC(2026, 3, 8, 10, 5, 0),
  net_tier: 'moderate',
  net_tcp_ms: 88,
  device_memory_gb: null,
  vitals: {
    lcp_ms: null,
    cls: null,
    inp_ms: null,
    fcp_ms: 1740,
    ttfb_ms: 420
  },
  context: {
    effective_type: null,
    downlink_mbps: null,
    rtt_ms: null,
    save_data: null,
    connection_type: null
  },
  meta: {
    pkg_version: '0.1.0',
    browser: 'safari',
    nav_type: 'navigate',
    navigation_type: 'navigate'
  }
};

export const reusedConnectionFixture: SignalEventV1 = {
  ...chromeColdNavFixture,
  event_id: 'evt_reused',
  ts: Date.UTC(2026, 3, 8, 10, 10, 0),
  net_tier: null,
  net_tcp_ms: null,
  net_tcp_source: 'unavailable_reused',
  vitals: {
    lcp_ms: 5120,
    cls: 0.05,
    inp_ms: 180,
    fcp_ms: 1400,
    ttfb_ms: 240,
    lcp_attribution: {
      load_state: 'complete',
      target: 'img',
      element_type: 'image',
      resource_url: '/assets/reused-hero.webp'
    },
    inp_attribution: {
      load_state: 'interactive',
      interaction_target: 'button',
      interaction_type: 'pointer',
      interaction_time_ms: 4_410,
      input_delay_ms: 24,
      processing_duration_ms: 96,
      presentation_delay_ms: 60
    }
  }
};

export const serviceWorkerFixture: SignalEventV1 = {
  ...chromeColdNavFixture,
  event_id: 'evt_sw',
  ts: Date.UTC(2026, 3, 8, 10, 15, 0),
  net_tier: null,
  net_tcp_ms: null,
  net_tcp_source: 'unavailable_sw'
};

export const tlsCoalescedFixture: SignalEventV1 = {
  ...chromeColdNavFixture,
  event_id: 'evt_tls',
  ts: Date.UTC(2026, 3, 8, 10, 20, 0),
  net_tier: null,
  net_tcp_ms: null,
  net_tcp_source: 'unavailable_tls_coalesced'
};

export const restoreLifecycleFixture: SignalEventV1 = {
  ...chromeColdNavFixture,
  event_id: 'evt_restore',
  ts: Date.UTC(2026, 3, 8, 10, 30, 0),
  net_tier: null,
  net_tcp_ms: null,
  net_tcp_source: 'unavailable_missing_timing',
  vitals: {
    lcp_ms: null,
    cls: 0.02,
    inp_ms: 120,
    fcp_ms: null,
    ttfb_ms: null,
    inp_attribution: {
      load_state: 'complete',
      interaction_target: 'button',
      interaction_type: 'pointer',
      interaction_time_ms: 740,
      input_delay_ms: 18,
      processing_duration_ms: 54,
      presentation_delay_ms: 48
    }
  },
  meta: {
    ...chromeColdNavFixture.meta,
    nav_type: 'back_forward',
    navigation_type: 'restore'
  }
};

export const prerenderLifecycleFixture: SignalEventV1 = {
  ...chromeColdNavFixture,
  event_id: 'evt_prerender',
  ts: Date.UTC(2026, 3, 8, 10, 35, 0),
  net_tier: null,
  net_tcp_ms: null,
  net_tcp_source: 'unavailable_missing_timing',
  vitals: {
    lcp_ms: null,
    cls: 0.01,
    inp_ms: null,
    fcp_ms: null,
    ttfb_ms: null
  },
  meta: {
    ...chromeColdNavFixture.meta,
    nav_type: 'navigate',
    navigation_type: 'prerender'
  }
};

function createFixtureEvent(event_id: string, ts: number, overrides: Partial<SignalEventV1> = {}): SignalEventV1 {
  const {
    event_id: _overrideEventId,
    ts: _overrideTs,
    v: _overrideVersion,
    vitals: vitalsOverrides,
    context: contextOverrides,
    meta: metaOverrides,
    ...restOverrides
  } = overrides;

  return {
    ...chromeColdNavFixture,
    event_id,
    ts,
    vitals: {
      ...chromeColdNavFixture.vitals,
      ...vitalsOverrides,
      lcp_attribution:
        vitalsOverrides?.lcp_attribution === undefined
          ? chromeColdNavFixture.vitals.lcp_attribution
            ? { ...chromeColdNavFixture.vitals.lcp_attribution }
            : undefined
          : vitalsOverrides.lcp_attribution == null
            ? undefined
            : { ...vitalsOverrides.lcp_attribution },
      inp_attribution:
        vitalsOverrides?.inp_attribution === undefined
          ? chromeColdNavFixture.vitals.inp_attribution
            ? { ...chromeColdNavFixture.vitals.inp_attribution }
            : undefined
          : vitalsOverrides.inp_attribution == null
            ? undefined
            : { ...vitalsOverrides.inp_attribution }
    },
    context: {
      ...chromeColdNavFixture.context,
      ...contextOverrides
    },
    meta: {
      ...chromeColdNavFixture.meta,
      ...metaOverrides
    },
    ...restOverrides
  };
}

interface SeriesOptions {
  prefix: string;
  tier: SignalEventV1['net_tier'];
  count: number;
  startTs: number;
  path: string;
  browser?: 'chrome' | 'safari' | 'firefox';
  // Iteration 6 — let each series override the hardware + connection signals
  // so strong / affirming fixtures can show honestly varied histograms on the
  // Act 1 "Actionable signals" strip instead of every row reading 100% one.
  deviceTier?: 'high' | 'mid' | 'low';
  deviceCores?: number;
  deviceMemoryGb?: number | null;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g' | null;
  downlinkMbps?: number | null;
  rttMs?: number | null;
  saveData?: boolean | null;
  lcpCoverage?: number;
  fcpCoverage?: number;
  ttfbCoverage?: number;
  inpCoverage?: number;
  netTcpSource?: SignalNetTcpSource;
  lcpBase?: number;
  lcpStep?: number;
  fcpBase?: number;
  fcpStep?: number;
  ttfbBase?: number;
  ttfbStep?: number;
  inpBase?: number;
  inpStep?: number;
  clsBase?: number;
  clsStep?: number;
}

function createSeries(options: SeriesOptions): SignalEventV1[] {
  const browser = options.browser ?? 'chrome';
  const lcpCoverage = options.lcpCoverage ?? 1;
  const fcpCoverage = options.fcpCoverage ?? 1;
  const ttfbCoverage = options.ttfbCoverage ?? 1;
  const inpCoverage = options.inpCoverage ?? 1;
  const lcpBase = options.lcpBase ?? 2_200;
  const lcpStep = options.lcpStep ?? 14;
  const fcpBase = options.fcpBase ?? 980;
  const fcpStep = options.fcpStep ?? 9;
  const ttfbBase = options.ttfbBase ?? 210;
  const ttfbStep = options.ttfbStep ?? 7;
  const inpBase = options.inpBase ?? 110;
  const inpStep = options.inpStep ?? 12;
  const clsBase = options.clsBase ?? 0.03;
  const clsStep = options.clsStep ?? 0.0008;

  const deviceTier = options.deviceTier ?? 'low';
  const deviceCores = options.deviceCores ?? 4;
  const effectiveType = options.effectiveType ?? '4g';
  const downlinkMbps = options.downlinkMbps ?? 2.3;
  const rttMs = options.rttMs ?? 200;
  const saveData = options.saveData ?? false;

  return Array.from({ length: options.count }, (_, index) => {
    const lcpEnabled = index < Math.round(options.count * lcpCoverage);
    const fcpEnabled = index < Math.round(options.count * fcpCoverage);
    const ttfbEnabled = index < Math.round(options.count * ttfbCoverage);
    const inpEnabled = index < Math.round(options.count * inpCoverage);
    const isSafari = browser === 'safari';

    // Safari / Firefox fall through to null on Chromium-only APIs. Chromium
    // series can override memory explicitly via options.deviceMemoryGb;
    // defaulting it at 2 keeps backward-compatible fixture behaviour.
    const deviceMemoryGb = isSafari ? null : (options.deviceMemoryGb ?? 2);

    return createFixtureEvent(`${options.prefix}_${index}`, options.startTs + index * 1_000, {
      url: options.path,
      net_tier: options.tier,
      net_tcp_source: options.netTcpSource ?? (options.tier == null ? 'unavailable_reused' : 'nav_timing_tcp_isolated'),
      device_tier: deviceTier,
      device_cores: deviceCores,
      device_memory_gb: deviceMemoryGb,
      vitals: {
        lcp_ms: isSafari || !lcpEnabled ? null : lcpBase + index * lcpStep,
        cls: isSafari ? null : Number((clsBase + index * clsStep).toFixed(3)),
        inp_ms: isSafari || !inpEnabled ? null : inpBase + (index % 8) * inpStep,
        fcp_ms: fcpEnabled ? fcpBase + index * fcpStep : null,
        ttfb_ms: ttfbEnabled ? ttfbBase + (index % 11) * ttfbStep : null
      },
      context: isSafari
        ? {
            effective_type: null,
            downlink_mbps: null,
            rtt_ms: null,
            save_data: null,
            connection_type: null
          }
        : {
            effective_type: effectiveType,
            downlink_mbps: downlinkMbps,
            rtt_ms: rttMs,
            save_data: saveData,
            connection_type: 'cellular'
          },
      meta: {
        browser,
        nav_type: 'navigate',
        navigation_type: 'navigate',
        pkg_version: '0.1.0'
      }
    });
  });
}

export const previewAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [chromeColdNavFixture, safariFallbackFixture, reusedConnectionFixture, serviceWorkerFixture, tlsCoalescedFixture],
  'preview',
  Date.UTC(2026, 3, 8, 10, 25, 0)
);

export const mixedLifecycleAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [chromeColdNavFixture, restoreLifecycleFixture, prerenderLifecycleFixture],
  'preview',
  Date.UTC(2026, 3, 8, 10, 40, 0)
);

export const strongLcpCoverageAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'strong_urban',
      tier: 'urban',
      count: 62,
      startTs: Date.UTC(2026, 3, 9, 8, 0, 0),
      path: '/landing',
      // Urban audience: high-end Chromium devices, fast 4G, no Save-Data
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      effectiveType: '4g',
      downlinkMbps: 12.4,
      rttMs: 40,
      saveData: false,
      lcpBase: 1_620,
      lcpStep: 18,
      fcpBase: 840,
      fcpStep: 9,
      ttfbBase: 170,
      ttfbStep: 5,
      inpBase: 120,
      inpStep: 11
    }),
    ...createSeries({
      prefix: 'strong_constrained',
      tier: 'constrained',
      count: 41,
      startTs: Date.UTC(2026, 3, 9, 9, 0, 0),
      path: '/pricing',
      // Constrained audience: budget Chromium devices, throttled 3G,
      // Save-Data on, noticeably worse hardware across the board.
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 2,
      deviceMemoryGb: 2,
      effectiveType: '3g',
      downlinkMbps: 1.4,
      rttMs: 380,
      saveData: true,
      lcpBase: 5_260,
      lcpStep: 28,
      fcpBase: 3_180,
      fcpStep: 22,
      ttfbBase: 430,
      ttfbStep: 11,
      inpBase: 660,
      inpStep: 20
    })
  ],
  'production',
  Date.UTC(2026, 3, 9, 10, 30, 0)
);

export const affirmingAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'affirming_urban',
      tier: 'urban',
      count: 58,
      startTs: Date.UTC(2026, 3, 9, 11, 0, 0),
      path: '/landing',
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      effectiveType: '4g',
      downlinkMbps: 14.2,
      rttMs: 35,
      lcpBase: 1_520,
      lcpStep: 12,
      fcpBase: 760,
      fcpStep: 8,
      ttfbBase: 160,
      ttfbStep: 5,
      inpBase: 100,
      inpStep: 8
    }),
    ...createSeries({
      prefix: 'affirming_moderate',
      tier: 'moderate',
      count: 34,
      startTs: Date.UTC(2026, 3, 9, 12, 0, 0),
      path: '/landing',
      browser: 'safari',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      effectiveType: '4g',
      downlinkMbps: 6.2,
      rttMs: 120,
      lcpBase: 2_080,
      lcpStep: 13,
      fcpBase: 980,
      fcpStep: 8,
      ttfbBase: 195,
      ttfbStep: 6,
      inpBase: 128,
      inpStep: 9
    })
  ],
  'production',
  Date.UTC(2026, 3, 9, 13, 30, 0)
);

export const fcpFallbackAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'fcp_urban',
      tier: 'urban',
      count: 55,
      startTs: Date.UTC(2026, 3, 10, 8, 0, 0),
      path: '/home',
      lcpCoverage: 0.32
    }),
    ...createSeries({
      prefix: 'fcp_constrained_moderate',
      tier: 'constrained_moderate',
      count: 38,
      startTs: Date.UTC(2026, 3, 10, 9, 0, 0),
      path: '/offers',
      lcpCoverage: 0.21
    })
  ],
  'production',
  Date.UTC(2026, 3, 10, 10, 30, 0)
);

export const ttfbFallbackAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'ttfb_urban',
      tier: 'urban',
      count: 58,
      startTs: Date.UTC(2026, 3, 11, 8, 0, 0),
      path: '/home',
      lcpCoverage: 0,
      fcpCoverage: 0
    }),
    ...createSeries({
      prefix: 'ttfb_constrained',
      tier: 'constrained',
      count: 36,
      startTs: Date.UTC(2026, 3, 11, 9, 0, 0),
      path: '/apply',
      lcpCoverage: 0,
      fcpCoverage: 0
    })
  ],
  'production',
  Date.UTC(2026, 3, 11, 10, 30, 0)
);

export const insufficientRaceDataAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'insufficient_urban',
      tier: 'urban',
      count: 18,
      startTs: Date.UTC(2026, 3, 12, 8, 0, 0),
      path: '/blog'
    }),
    ...createSeries({
      prefix: 'insufficient_unknown',
      tier: null,
      count: 12,
      startTs: Date.UTC(2026, 3, 12, 8, 45, 0),
      path: '/blog',
      netTcpSource: 'unavailable_reused'
    })
  ],
  'preview',
  Date.UTC(2026, 3, 12, 9, 30, 0)
);

export const highUnclassifiedShareAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'high_unknown',
      tier: null,
      count: 72,
      startTs: Date.UTC(2026, 3, 13, 8, 0, 0),
      path: '/deals',
      netTcpSource: 'unavailable_reused'
    }),
    ...createSeries({
      prefix: 'high_urban',
      tier: 'urban',
      count: 26,
      startTs: Date.UTC(2026, 3, 13, 9, 0, 0),
      path: '/deals'
    }),
    ...createSeries({
      prefix: 'high_moderate',
      tier: 'moderate',
      count: 14,
      startTs: Date.UTC(2026, 3, 13, 10, 0, 0),
      path: '/pricing'
    })
  ],
  'production',
  Date.UTC(2026, 3, 13, 11, 30, 0)
);

export const safariHeavyAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'safari_urban',
      tier: 'urban',
      count: 48,
      startTs: Date.UTC(2026, 3, 14, 8, 0, 0),
      path: '/landing',
      browser: 'safari',
      lcpCoverage: 0
    }),
    ...createSeries({
      prefix: 'safari_moderate',
      tier: 'moderate',
      count: 34,
      startTs: Date.UTC(2026, 3, 14, 9, 0, 0),
      path: '/offers',
      browser: 'safari',
      lcpCoverage: 0
    }),
    ...createSeries({
      prefix: 'safari_chrome_support',
      tier: 'moderate',
      count: 12,
      startTs: Date.UTC(2026, 3, 14, 10, 0, 0),
      path: '/offers',
      browser: 'chrome',
      lcpCoverage: 1
    })
  ],
  'production',
  Date.UTC(2026, 3, 14, 11, 30, 0)
);

export const lowInpCoverageAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'low_inp_urban',
      tier: 'urban',
      count: 64,
      startTs: Date.UTC(2026, 3, 15, 8, 0, 0),
      path: '/upgrade',
      inpCoverage: 0.34
    }),
    ...createSeries({
      prefix: 'low_inp_moderate',
      tier: 'moderate',
      count: 42,
      startTs: Date.UTC(2026, 3, 15, 9, 0, 0),
      path: '/upgrade',
      inpCoverage: 0.29
    })
  ],
  'production',
  Date.UTC(2026, 3, 15, 10, 30, 0)
);

/* --------------------------------------------------------------------------
 * Full-depth fixture: exercises every report feature path at once.
 *
 * 4 network tiers (urban, moderate, constrained_moderate, constrained)
 * 3 device tiers (high, mid, low)
 * Mixed browsers (Chrome, Safari, Firefox)
 * Varied hardware (cores: 2–12, memory: 1–8 GB)
 * Mixed network conditions (4g, 3g, 2g, Save-Data on/off)
 * Strong LCP + FCP + INP coverage → full 3-stage experience funnel
 * Enough observations per cohort for race + quartile math
 * Multiple page paths for top_page_path selection
 * All thresholds crossed in constrained tiers → urgent mood
 * -------------------------------------------------------------------------- */
export const fullDepthAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    // Urban — high-end Chrome, fast 4G, 8-core / 8 GB
    ...createSeries({
      prefix: 'full_urban_chrome',
      tier: 'urban',
      count: 48,
      startTs: Date.UTC(2026, 3, 16, 8, 0, 0),
      path: '/personal-loans',
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      effectiveType: '4g',
      downlinkMbps: 15.2,
      rttMs: 28,
      saveData: false,
      lcpBase: 1_480,
      lcpStep: 14,
      fcpBase: 720,
      fcpStep: 7,
      ttfbBase: 145,
      ttfbStep: 4,
      inpBase: 85,
      inpStep: 8
    }),
    // Urban — Safari slice (no LCP/CLS/INP, but contributes FCP/TTFB)
    ...createSeries({
      prefix: 'full_urban_safari',
      tier: 'urban',
      count: 18,
      startTs: Date.UTC(2026, 3, 16, 8, 30, 0),
      path: '/personal-loans',
      browser: 'safari',
      deviceTier: 'high',
      deviceCores: 6,
      fcpBase: 680,
      fcpStep: 6,
      ttfbBase: 130,
      ttfbStep: 3
    }),
    // Moderate — mid-tier Chrome, decent 4G, 6-core / 4 GB
    ...createSeries({
      prefix: 'full_moderate_chrome',
      tier: 'moderate',
      count: 36,
      startTs: Date.UTC(2026, 3, 16, 9, 0, 0),
      path: '/personal-loans',
      browser: 'chrome',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      effectiveType: '4g',
      downlinkMbps: 6.8,
      rttMs: 95,
      saveData: false,
      lcpBase: 2_680,
      lcpStep: 20,
      fcpBase: 1_340,
      fcpStep: 12,
      ttfbBase: 260,
      ttfbStep: 8,
      inpBase: 180,
      inpStep: 14
    }),
    // Moderate — Firefox slice
    ...createSeries({
      prefix: 'full_moderate_firefox',
      tier: 'moderate',
      count: 14,
      startTs: Date.UTC(2026, 3, 16, 9, 30, 0),
      path: '/credit-cards',
      browser: 'firefox',
      deviceTier: 'mid',
      deviceCores: 4,
      deviceMemoryGb: 4,
      effectiveType: null,
      downlinkMbps: null,
      rttMs: null,
      saveData: null,
      lcpBase: 2_920,
      lcpStep: 18,
      fcpBase: 1_480,
      fcpStep: 11,
      ttfbBase: 290,
      ttfbStep: 9,
      inpBase: 210,
      inpStep: 16
    }),
    // Constrained moderate — budget Chrome, 3G, 4-core / 2 GB, some Save-Data
    ...createSeries({
      prefix: 'full_cm_chrome',
      tier: 'constrained_moderate',
      count: 30,
      startTs: Date.UTC(2026, 3, 16, 10, 0, 0),
      path: '/personal-loans',
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 4,
      deviceMemoryGb: 2,
      effectiveType: '3g',
      downlinkMbps: 1.8,
      rttMs: 310,
      saveData: true,
      lcpBase: 4_520,
      lcpStep: 26,
      fcpBase: 2_680,
      fcpStep: 18,
      ttfbBase: 380,
      ttfbStep: 10,
      inpBase: 420,
      inpStep: 18
    }),
    // Constrained — severely budget Chrome, 2G-3G, 2-core / 1 GB
    ...createSeries({
      prefix: 'full_constrained_chrome',
      tier: 'constrained',
      count: 26,
      startTs: Date.UTC(2026, 3, 16, 11, 0, 0),
      path: '/personal-loans',
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 2,
      deviceMemoryGb: 1,
      effectiveType: '2g',
      downlinkMbps: 0.4,
      rttMs: 620,
      saveData: true,
      lcpBase: 6_800,
      lcpStep: 34,
      fcpBase: 3_840,
      fcpStep: 28,
      ttfbBase: 560,
      ttfbStep: 14,
      inpBase: 740,
      inpStep: 24
    }),
    // A handful of unclassified (reused connections) to populate that coverage field
    ...createSeries({
      prefix: 'full_unclassified',
      tier: null,
      count: 8,
      startTs: Date.UTC(2026, 3, 16, 11, 30, 0),
      path: '/credit-cards',
      browser: 'chrome',
      netTcpSource: 'unavailable_reused',
      deviceTier: 'mid',
      deviceCores: 4,
      deviceMemoryGb: 4,
      lcpBase: 3_100,
      lcpStep: 20,
      fcpBase: 1_600,
      fcpStep: 14,
      ttfbBase: 300,
      ttfbStep: 8,
      inpBase: 240,
      inpStep: 12
    })
  ],
  'production',
  Date.UTC(2026, 3, 16, 12, 30, 0)
);

/* --------------------------------------------------------------------------
 * Sober mood fixture: gap is real but moderate — poorShare 15–25%,
 * waitDelta 1000–1800 ms. Not urgent, not affirming.
 * -------------------------------------------------------------------------- */
export const soberMoodAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'sober_urban',
      tier: 'urban',
      count: 52,
      startTs: Date.UTC(2026, 3, 17, 8, 0, 0),
      path: '/landing',
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      effectiveType: '4g',
      downlinkMbps: 11.0,
      rttMs: 45,
      lcpBase: 1_800,
      lcpStep: 16,
      fcpBase: 880,
      fcpStep: 8,
      ttfbBase: 190,
      ttfbStep: 5,
      inpBase: 105,
      inpStep: 10
    }),
    ...createSeries({
      prefix: 'sober_constrained_moderate',
      tier: 'constrained_moderate',
      count: 38,
      startTs: Date.UTC(2026, 3, 17, 9, 0, 0),
      path: '/landing',
      browser: 'chrome',
      deviceTier: 'mid',
      deviceCores: 4,
      deviceMemoryGb: 4,
      effectiveType: '4g',
      downlinkMbps: 4.2,
      rttMs: 160,
      // Moderate degradation — LCP hovers around threshold, not deeply past it
      lcpBase: 3_200,
      lcpStep: 18,
      fcpBase: 1_800,
      fcpStep: 14,
      ttfbBase: 310,
      ttfbStep: 8,
      inpBase: 220,
      inpStep: 14
    })
  ],
  'production',
  Date.UTC(2026, 3, 17, 10, 30, 0)
);

/* --------------------------------------------------------------------------
 * Single-stage funnel: only FCP has enough coverage. LCP and INP are both
 * below the 25-observation or 50%-coverage thresholds.
 * -------------------------------------------------------------------------- */
export const singleStageFunnelFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'single_urban',
      tier: 'urban',
      count: 44,
      startTs: Date.UTC(2026, 3, 18, 8, 0, 0),
      path: '/home',
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      effectiveType: '4g',
      downlinkMbps: 10.0,
      rttMs: 50,
      lcpCoverage: 0.15,
      inpCoverage: 0.1,
      lcpBase: 1_900,
      lcpStep: 14,
      fcpBase: 820,
      fcpStep: 7,
      ttfbBase: 180,
      ttfbStep: 5,
      inpBase: 110,
      inpStep: 9
    }),
    ...createSeries({
      prefix: 'single_constrained',
      tier: 'constrained',
      count: 32,
      startTs: Date.UTC(2026, 3, 18, 9, 0, 0),
      path: '/home',
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 2,
      deviceMemoryGb: 2,
      effectiveType: '3g',
      downlinkMbps: 1.2,
      rttMs: 400,
      lcpCoverage: 0.12,
      inpCoverage: 0.08,
      lcpBase: 5_800,
      lcpStep: 30,
      fcpBase: 3_400,
      fcpStep: 24,
      ttfbBase: 480,
      ttfbStep: 12,
      inpBase: 680,
      inpStep: 22
    })
  ],
  'production',
  Date.UTC(2026, 3, 18, 10, 30, 0)
);

export interface SignalReportScenarioFixture {
  id: string;
  label: string;
  description: string;
  aggregate: SignalAggregateV1;
}

export const signalReportScenarioFixtures: SignalReportScenarioFixture[] = [
  {
    id: 'preview',
    label: 'Preview sanity check',
    description: 'Small preview-mode aggregate with an insufficient race and mixed classified coverage.',
    aggregate: previewAggregateFixture
  },
  {
    id: 'mixed-lifecycle',
    label: 'Mixed lifecycle traffic',
    description: 'Restore and prerender events stay in raw data but are excluded from default load-shaped reporting.',
    aggregate: mixedLifecycleAggregateFixture
  },
  {
    id: 'strong-lcp',
    label: 'Urgent three-stage funnel',
    description:
      'Production aggregate with a severe urban-versus-constrained gap and enough coverage to render the full performance cliff.',
    aggregate: strongLcpCoverageAggregateFixture
  },
  {
    id: 'affirming-balance',
    label: 'Affirming control case',
    description: 'Production aggregate with full measured coverage and a comparatively restrained gap.',
    aggregate: affirmingAggregateFixture
  },
  {
    id: 'fcp-fallback',
    label: 'FCP fallback',
    description: 'LCP coverage is too weak, so the report must fall back to FCP.',
    aggregate: fcpFallbackAggregateFixture
  },
  {
    id: 'ttfb-fallback',
    label: 'TTFB fallback',
    description: 'LCP and FCP are unavailable, so the race must use TTFB.',
    aggregate: ttfbFallbackAggregateFixture
  },
  {
    id: 'insufficient-race',
    label: 'Insufficient race data',
    description: 'There is not enough comparable cohort data for Act 2 to render a race.',
    aggregate: insufficientRaceDataAggregateFixture
  },
  {
    id: 'low-inp-coverage',
    label: 'Low INP coverage',
    description: 'LCP is strong enough, but INP coverage is too weak for the third funnel stage.',
    aggregate: lowInpCoverageAggregateFixture
  },
  {
    id: 'high-unclassified',
    label: 'High unclassified share',
    description: 'A large share of sessions could not be classified into a network tier.',
    aggregate: highUnclassifiedShareAggregateFixture
  },
  {
    id: 'safari-heavy',
    label: 'Safari-heavy traffic',
    description: 'Safari-heavy traffic suppresses Chromium-only vitals and pushes the race toward fallback metrics.',
    aggregate: safariHeavyAggregateFixture
  },
  {
    id: 'full-depth',
    label: 'Full depth (all features)',
    description:
      'All 4 network tiers, 3 device tiers, mixed browsers, varied hardware, full 3-stage funnel, Save-Data mix, quartile-ready sample sizes. Exercises every report feature path.',
    aggregate: fullDepthAggregateFixture
  },
  {
    id: 'sober-mood',
    label: 'Sober mood (middle ground)',
    description:
      'Moderate gap — poor-session share 15–25%, wait delta 1–1.8s. Not urgent, not affirming. Exercises the sober mood path.',
    aggregate: soberMoodAggregateFixture
  },
  {
    id: 'single-stage-funnel',
    label: 'Single-stage funnel (FCP only)',
    description: 'LCP and INP coverage both below thresholds. Only FCP stage is active in the experience funnel.',
    aggregate: singleStageFunnelFixture
  }
];
