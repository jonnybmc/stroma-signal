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
  lcpCoverage?: number;
  fcpCoverage?: number;
  ttfbCoverage?: number;
  netTcpSource?: SignalNetTcpSource;
}

function createSeries(options: SeriesOptions): SignalEventV1[] {
  const browser = options.browser ?? 'chrome';
  const lcpCoverage = options.lcpCoverage ?? 1;
  const fcpCoverage = options.fcpCoverage ?? 1;
  const ttfbCoverage = options.ttfbCoverage ?? 1;

  return Array.from({ length: options.count }, (_, index) => {
    const lcpEnabled = index < Math.round(options.count * lcpCoverage);
    const fcpEnabled = index < Math.round(options.count * fcpCoverage);
    const ttfbEnabled = index < Math.round(options.count * ttfbCoverage);
    const isSafari = browser === 'safari';

    return createFixtureEvent(`${options.prefix}_${index}`, options.startTs + index * 1_000, {
      url: options.path,
      net_tier: options.tier,
      net_tcp_source: options.netTcpSource ?? (options.tier == null ? 'unavailable_reused' : 'nav_timing_tcp_isolated'),
      vitals: {
        lcp_ms: isSafari || !lcpEnabled ? null : 2_200 + index * 14,
        cls: isSafari ? null : Number((0.03 + index * 0.0008).toFixed(3)),
        inp_ms: isSafari ? null : 110 + (index % 8) * 12,
        fcp_ms: fcpEnabled ? 980 + index * 9 : null,
        ttfb_ms: ttfbEnabled ? 210 + (index % 11) * 7 : null
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

export const strongLcpCoverageAggregateFixture: SignalAggregateV1 = aggregateSignalEvents(
  [
    ...createSeries({
      prefix: 'strong_urban',
      tier: 'urban',
      count: 62,
      startTs: Date.UTC(2026, 3, 9, 8, 0, 0),
      path: '/landing'
    }),
    ...createSeries({
      prefix: 'strong_moderate',
      tier: 'moderate',
      count: 41,
      startTs: Date.UTC(2026, 3, 9, 9, 0, 0),
      path: '/pricing'
    })
  ],
  'production',
  Date.UTC(2026, 3, 9, 10, 30, 0)
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
    id: 'strong-lcp',
    label: 'Strong LCP coverage',
    description: 'Production aggregate with strong LCP coverage across both compared cohorts.',
    aggregate: strongLcpCoverageAggregateFixture
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
  }
];
