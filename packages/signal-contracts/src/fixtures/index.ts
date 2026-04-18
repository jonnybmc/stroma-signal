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
  // Screen-width rotation. Events in the series get device_screen_w =
  // screenMix[index % screenMix.length]. When omitted, every event inherits
  // the root fixture's width (390 — mobile). Used by scenario fixtures to
  // produce differentiated form_factor_distribution splits for QA and demo.
  // Breakpoints for form-factor aggregation are <768 mobile, 768–1279
  // tablet, ≥1280 desktop — pick widths accordingly.
  screenMix?: number[];
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

    const screenW =
      options.screenMix && options.screenMix.length > 0
        ? options.screenMix[index % options.screenMix.length]
        : undefined;

    return createFixtureEvent(`${options.prefix}_${index}`, options.startTs + index * 1_000, {
      url: options.path,
      net_tier: options.tier,
      net_tcp_source: options.netTcpSource ?? (options.tier == null ? 'unavailable_reused' : 'nav_timing_tcp_isolated'),
      device_tier: deviceTier,
      device_cores: deviceCores,
      device_memory_gb: deviceMemoryGb,
      ...(screenW != null ? { device_screen_w: screenW } : {}),
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
      // Urban audience: high-end Chromium devices, fast 4G, no Save-Data.
      // Form-factor mix leans desktop — reflects a B2B / SaaS landing page
      // that draws office-hour traffic on laptops + some tablet + mobile.
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      screenMix: [1920, 1440, 1440, 1366, 768, 390, 390],
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
      // Form-factor mix leans heavily mobile — this cohort is on phones,
      // which is where the paid-media-ROI gap actually lives.
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 2,
      deviceMemoryGb: 2,
      screenMix: [390, 390, 390, 412, 414, 768],
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
      // Affirming/B2B pattern — desktop-dominant urban cohort on office
      // networks + some large-tablet + the usual mobile share.
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      screenMix: [1920, 1920, 1440, 1440, 1366, 1024, 390],
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
      // Moderate cohort skews mobile — the away-from-desk visitor path.
      browser: 'safari',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      screenMix: [390, 390, 414, 768, 1024],
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
      // Ecommerce / DTC / paid-media reality — heavily mobile, small
      // tablet slice, a handful of desktop from office browsing.
      screenMix: [390, 390, 412, 390, 768, 1440],
      lcpCoverage: 0.32
    }),
    ...createSeries({
      prefix: 'fcp_constrained_moderate',
      tier: 'constrained_moderate',
      count: 38,
      startTs: Date.UTC(2026, 3, 10, 9, 0, 0),
      path: '/offers',
      // Constrained cohort is almost entirely mobile.
      screenMix: [390, 412, 414, 390, 768],
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
      // Balanced mix — highlights the three-way split in the TTFB-fallback demo.
      screenMix: [390, 768, 1440, 390, 1024, 1920, 412],
      lcpCoverage: 0,
      fcpCoverage: 0
    }),
    ...createSeries({
      prefix: 'ttfb_constrained',
      tier: 'constrained',
      count: 36,
      startTs: Date.UTC(2026, 3, 11, 9, 0, 0),
      path: '/apply',
      screenMix: [390, 412, 390, 768, 1440],
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
    // Urban — high-end Chrome, fast 4G, 8-core / 8 GB.
    // Full-depth showcases the three-way form-factor split: urban cohort
    // leans desktop/laptop, with some tablet and mobile office-hour visits.
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
      screenMix: [1920, 1440, 1440, 1366, 1280, 768, 390],
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
    // Urban — Safari slice (no LCP/CLS/INP, but contributes FCP/TTFB).
    // Safari users lean iPad — tablet + large mobile.
    ...createSeries({
      prefix: 'full_urban_safari',
      tier: 'urban',
      count: 18,
      startTs: Date.UTC(2026, 3, 16, 8, 30, 0),
      path: '/personal-loans',
      browser: 'safari',
      deviceTier: 'high',
      deviceCores: 6,
      screenMix: [1024, 768, 390, 414, 1024],
      fcpBase: 680,
      fcpStep: 6,
      ttfbBase: 130,
      ttfbStep: 3
    }),
    // Moderate — mid-tier Chrome. Balanced mix.
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
      screenMix: [390, 1440, 768, 390, 1366, 414],
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
    // Moderate — Firefox slice. Mostly desktop (Firefox is rare on mobile).
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
      screenMix: [1920, 1440, 1366, 1280, 390],
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
    // Constrained moderate — budget Chrome. Mobile-dominated (constrained
    // cohorts are overwhelmingly phones).
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
      screenMix: [390, 390, 414, 412, 768],
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
    // Constrained — severely budget Chrome. Entirely mobile.
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
      screenMix: [390, 412, 414, 390, 360],
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
      // Sober / middle-ground scenario — a roughly balanced form-factor
      // split so the strip reads as three meaningful segments rather than
      // one dominant one.
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      screenMix: [1440, 390, 1920, 768, 390, 1366, 414],
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
      screenMix: [390, 768, 414, 390, 1024],
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

/* --------------------------------------------------------------------------
 * Form-factor edge-case fixtures — exercise the Act 1 form-factor empty
 * state (muted "0%" placeholder column + dashed bar). Each fixture omits
 * one form factor from the screen-width rotation so the aggregator reports
 * a genuine 0% for that bucket.
 * -------------------------------------------------------------------------- */
export const mobileDesktopOnlyAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'mdo_urban',
      tier: 'urban',
      count: 48,
      startTs: Date.UTC(2026, 3, 19, 8, 0, 0),
      path: '/landing',
      // Desktop-heavy urban cohort on laptops + mobile phones. No tablet
      // widths in the mix → aggregator reports 0% tablet and the Act 1
      // form-factor card renders the empty-state placeholder column.
      browser: 'chrome',
      deviceTier: 'high',
      deviceCores: 8,
      deviceMemoryGb: 8,
      screenMix: [1920, 1440, 1366, 1280, 390, 390],
      effectiveType: '4g',
      downlinkMbps: 12.0,
      rttMs: 45,
      lcpBase: 1_680,
      lcpStep: 14,
      fcpBase: 820,
      fcpStep: 7,
      ttfbBase: 170,
      ttfbStep: 5,
      inpBase: 100,
      inpStep: 9
    }),
    ...createSeries({
      prefix: 'mdo_constrained_moderate',
      tier: 'constrained_moderate',
      count: 32,
      startTs: Date.UTC(2026, 3, 19, 9, 0, 0),
      path: '/pricing',
      // Constrained cohort is entirely mobile phones.
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 4,
      deviceMemoryGb: 2,
      screenMix: [390, 412, 414, 390],
      effectiveType: '3g',
      downlinkMbps: 1.6,
      rttMs: 320,
      lcpBase: 4_280,
      lcpStep: 22,
      fcpBase: 2_460,
      fcpStep: 16,
      ttfbBase: 360,
      ttfbStep: 9,
      inpBase: 380,
      inpStep: 16
    })
  ],
  'production',
  Date.UTC(2026, 3, 19, 10, 30, 0)
);

export const mobileOnlyAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'mob_urban',
      tier: 'urban',
      count: 38,
      startTs: Date.UTC(2026, 3, 20, 8, 0, 0),
      path: '/landing',
      // DTC / ecommerce mobile-first pattern: every event is a phone.
      // Exercises two form-factor empty-state columns (tablet + desktop)
      // alongside a single dominant mobile column.
      browser: 'chrome',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      screenMix: [390, 412, 414, 390, 360],
      effectiveType: '4g',
      downlinkMbps: 8.0,
      rttMs: 70,
      lcpBase: 2_280,
      lcpStep: 16,
      fcpBase: 1_080,
      fcpStep: 8,
      ttfbBase: 210,
      ttfbStep: 6,
      inpBase: 160,
      inpStep: 12
    }),
    ...createSeries({
      prefix: 'mob_constrained',
      tier: 'constrained',
      count: 24,
      startTs: Date.UTC(2026, 3, 20, 9, 0, 0),
      path: '/checkout',
      browser: 'chrome',
      deviceTier: 'low',
      deviceCores: 2,
      deviceMemoryGb: 2,
      screenMix: [390, 412, 360, 414, 390],
      effectiveType: '3g',
      downlinkMbps: 1.2,
      rttMs: 380,
      lcpBase: 5_420,
      lcpStep: 26,
      fcpBase: 3_060,
      fcpStep: 20,
      ttfbBase: 420,
      ttfbStep: 10,
      inpBase: 540,
      inpStep: 18
    })
  ],
  'production',
  Date.UTC(2026, 3, 20, 10, 30, 0)
);

export const mobileTabletOnlyAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'mto_urban',
      tier: 'urban',
      count: 42,
      startTs: Date.UTC(2026, 3, 21, 8, 0, 0),
      path: '/blog',
      // Editorial / content site pattern — mobile + tablet traffic, no
      // desktop. Exercises the empty-state placeholder column for desktop
      // while keeping two populated columns.
      browser: 'safari',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      screenMix: [390, 768, 414, 1024, 390],
      effectiveType: '4g',
      downlinkMbps: 6.4,
      rttMs: 90,
      lcpBase: 2_120,
      lcpStep: 14,
      fcpBase: 960,
      fcpStep: 8,
      ttfbBase: 195,
      ttfbStep: 5,
      inpBase: 130,
      inpStep: 9
    }),
    ...createSeries({
      prefix: 'mto_moderate',
      tier: 'moderate',
      count: 28,
      startTs: Date.UTC(2026, 3, 21, 9, 0, 0),
      path: '/articles',
      browser: 'safari',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      screenMix: [768, 390, 1024, 414, 390],
      effectiveType: '4g',
      downlinkMbps: 4.8,
      rttMs: 140,
      lcpBase: 2_520,
      lcpStep: 16,
      fcpBase: 1_180,
      fcpStep: 10,
      ttfbBase: 240,
      ttfbStep: 6,
      inpBase: 180,
      inpStep: 12
    })
  ],
  'production',
  Date.UTC(2026, 3, 21, 10, 30, 0)
);

/* --------------------------------------------------------------------------
 * Edge-case fixtures — exercise the less-travelled fallback paths in the
 * report renderer so regressions on those paths become visible in /build.
 *
 * 1. Zero-classified — every session lands in the `unknown` network tier
 *    (classifier couldn't determine — typically Safari / privacy browsers).
 *    Exercises: persona empty-state on BOTH cards, Act 2 race-unavailable
 *    fallback, actionable-signals still rendering from device + environment
 *    blocks, coverage.network_coverage = 0.
 *
 * 2. Empty-funnel (legacy) — aggregate carries no experience_funnel block
 *    at all, matching legacy rv=1 URLs that pre-date the funnel contract.
 *    Exercises: Act 3 legacy-mode fallback card, act3.mode === 'legacy'.
 *
 * 3. No-hardware-block — aggregate carries no device_hardware /
 *    network_signals / environment optional blocks. Exercises: persona
 *    card hardware-absent path, actionable-signals falling back to the
 *    form-factor cell only, cores/memory label '—' fallback.
 * -------------------------------------------------------------------------- */
export const zeroClassifiedAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'zc_unknown_chrome',
      tier: null,
      count: 32,
      startTs: Date.UTC(2026, 3, 22, 8, 0, 0),
      path: '/landing',
      browser: 'chrome',
      netTcpSource: 'unavailable_reused',
      deviceTier: 'mid',
      deviceCores: 6,
      deviceMemoryGb: 4,
      screenMix: [390, 1440, 390, 768, 412, 1920],
      effectiveType: '4g',
      downlinkMbps: 8.0,
      rttMs: 80,
      lcpBase: 2_180,
      lcpStep: 14,
      fcpBase: 960,
      fcpStep: 8,
      ttfbBase: 205,
      ttfbStep: 5,
      inpBase: 140,
      inpStep: 10
    }),
    ...createSeries({
      prefix: 'zc_unknown_safari',
      tier: null,
      count: 22,
      startTs: Date.UTC(2026, 3, 22, 9, 0, 0),
      path: '/landing',
      browser: 'safari',
      netTcpSource: 'unavailable_tls_coalesced',
      deviceTier: 'mid',
      deviceCores: 6,
      screenMix: [390, 414, 1024, 390],
      lcpBase: 0,
      fcpBase: 1_120,
      fcpStep: 8,
      ttfbBase: 240,
      ttfbStep: 6
    })
  ],
  'production',
  Date.UTC(2026, 3, 22, 10, 30, 0)
);

// Legacy-style aggregate — no experience_funnel. Built from strongLcp
// (which has valid vitals + classified cohorts) and stripped of the
// funnel block via structured clone to simulate a report URL decoded from
// a pre-0.1 `rv=1` link without the `es=` param.
export const emptyFunnelAggregateFixture: SignalAggregateV1 = {
  ...strongLcpCoverageAggregateFixture,
  experience_funnel: undefined
};

// No hardware / network / environment blocks — the aggregate decodes
// cleanly but every iteration-6 optional block is absent. Mirrors a
// report URL that dropped those params (e.g. when re-encoded by an older
// codec path, or when the normalized-only blocks never made it into the
// GA4 lane).
export const noHardwareBlockAggregateFixture: SignalAggregateV1 = {
  ...strongLcpCoverageAggregateFixture,
  device_hardware: undefined,
  network_signals: undefined,
  environment: undefined
};

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
  },
  {
    id: 'form-factor-mobile-desktop-only',
    label: 'Form factor: mobile + desktop (no tablet)',
    description:
      'Audience splits between mobile and desktop with zero tablet traffic. Exercises the Act 1 form-factor empty-state placeholder column.',
    aggregate: mobileDesktopOnlyAggregateFixture
  },
  {
    id: 'form-factor-mobile-tablet-only',
    label: 'Form factor: mobile + tablet (no desktop)',
    description:
      'Editorial / content-site pattern — mobile + tablet readership with zero desktop. Exercises the form-factor empty-state for desktop.',
    aggregate: mobileTabletOnlyAggregateFixture
  },
  {
    id: 'form-factor-mobile-only',
    label: 'Form factor: mobile only',
    description:
      'DTC / ecommerce pattern with 100% mobile traffic. Exercises two empty-state placeholder columns (tablet + desktop) beside one dominant mobile column.',
    aggregate: mobileOnlyAggregateFixture
  },
  {
    id: 'zero-classified',
    label: 'Zero-classified traffic (all unknown tier)',
    description:
      'Every session landed in the unknown network tier — classifier could not determine (typically Safari / privacy browsers with reused connections). Exercises persona empty-state on both best and constrained cards, plus Act 2 race-unavailable fallback.',
    aggregate: zeroClassifiedAggregateFixture
  },
  {
    id: 'empty-funnel-legacy',
    label: 'Empty funnel (legacy rv=1)',
    description:
      'Aggregate carries no experience_funnel block — mirrors a pre-0.1 rv=1 URL that lacks the es= param. Exercises the Act 3 legacy-mode fallback card.',
    aggregate: emptyFunnelAggregateFixture
  },
  {
    id: 'no-hardware-block',
    label: 'No hardware / network / environment blocks',
    description:
      'Aggregate is missing device_hardware, network_signals, and environment. Exercises persona-card hardware-absent path, actionable-signals falling back to form-factor only, and cores/memory "—" fallback labels.',
    aggregate: noHardwareBlockAggregateFixture
  }
];
