import type { SignalAggregateV1 } from '@stroma-labs/signal-contracts';

// Type-only imports — the act4-impact module is consumed by
// report-view-model.ts; using `import type` keeps the cycle type-only
// so runtime initialisation order is unaffected. When the broader
// view-model split lands, these types can move into a colocated
// types.ts module.
import type {
  ReportAct3ViewModel,
  ReportAct4ImpactRow,
  ReportAct4ImpactTone,
  ReportRaceViewModel
} from '../../report-view-model.js';

// Act 4 impact-row calibration constants. Each one is a presentation
// gate — they do NOT correspond to any CWV / web-vitals threshold.
// Tune them here, not inline at the call site.

// W3C LoAF defines long animation frames as ≥50ms; the `script_roas` row
// fires when the measured worst-frame p75 crosses this line.
const ACT4_LOAF_LONG_FRAME_MS = 50;
// Minimum ledger length before we commit to the ledger treatment. Below
// this the renderer falls back to the flat `act4_summary_points` so we
// never ship a single-row impact panel that reads thinner than the
// bullets it replaced.
const ACT4_IMPACT_MIN_ROWS = 2;
// Act 4 `inp_conversion` row emission gate. Below ~25% poor-session share
// the INP impact narrative reads as alarmist next to Act 3's own funnel
// evidence; above it the share is large enough that the evidence
// concentrates as a pattern rather than a single mechanism.
const ACT4_INP_GATE_POOR_SHARE_PCT = 25;
// Act 4 `network_reach` row emission gate. A combined constrained /
// constrained_moderate share of 30% is the point where "a real share"
// stops being a hedge and starts being load-bearing.
const ACT4_NETWORK_GATE_CONSTRAINED_PCT = 30;
// Tone escalation for the `script_roas` row when LoAF worst-frame p75
// crosses into territory that will feel like a stall on mid-tier
// devices. 150ms is 3× the W3C long-frame floor and the point above
// which qualitative session logs commonly report "the page froze".
const ACT4_LOAF_ALERT_MS = 150;

// Presentation-calibration tone bands for the `lcp_bounce` row. Not CWV
// thresholds — the CWV LCP "poor" line is 4000ms absolute; these bands
// operate on the wait-*delta* between comparison and urban cohorts.
// 1500ms delta ≈ the point where the gap feels categorical in
// moderated testing; 800ms ≈ perceptible but not categorical.
function toneFromWaitDeltaMs(deltaMs: number | null): ReportAct4ImpactTone {
  if (deltaMs == null) return 'steady';
  if (deltaMs >= 1500) return 'alert';
  if (deltaMs >= 800) return 'watch';
  return 'steady';
}

// Presentation-calibration tone bands for the `inp_conversion` row.
// Operates on the share of sessions whose slowest measured phase
// crosses a CWV poor threshold (FCP / LCP / INP). 50% ≈ majority-bad;
// 15% ≈ a minority large enough to own a named impact story.
function toneFromPoorShare(share: number): ReportAct4ImpactTone {
  if (share >= 50) return 'alert';
  if (share >= 15) return 'watch';
  return 'steady';
}

// Presentation-calibration tone bands for the `network_reach` row.
// Operates on the combined constrained + constrained_moderate share.
// 50% ≈ the urban assumption is strictly wrong; 30% ≈ load-bearing
// enough to name as a cohort divergence.
function toneFromConstrainedShare(share: number): ReportAct4ImpactTone {
  if (share >= 50) return 'alert';
  if (share >= 30) return 'watch';
  return 'steady';
}

// Per-row builders. Each returns one row or null; the orchestrator
// filters nulls and applies the minimum-row gate. Splitting the row
// emission per concern means a future tweak to one row touches one
// function instead of scrolling through a 100-line imperative push
// loop.
//
// Tonal discipline (see `feedback_no_self_deprecation_in_artifacts`):
// the boundary disclosure ("does not measure revenue / CPA / campaign
// impact") lives ONCE in the section-lede above these rows. Row-level
// copy never re-apologises — proceeds with confident observation about
// what the data IS showing, mechanistically tied to user behaviour.

const LCP_BOUNCE_WHY_MATTERS: Record<ReportAct4ImpactTone, string> = {
  alert:
    'The same page is reaching different cohorts at different times — the cleanest measured gap in the report. At this delta, landing-page experience scoring is the kind of signal platforms factor into auction weighting.',
  watch:
    'The same page is reaching different cohorts at different times. The gap is large enough to register against the assumption that all traffic experiences the page identically.',
  steady:
    'A measurable but modest difference between cohorts. The page is broadly arriving at similar times across audiences.'
};

function buildLcpBounceRow(race: ReportRaceViewModel): ReportAct4ImpactRow | null {
  if (!race.race_available || race.wait_delta_ms == null || !race.wait_delta_seconds) return null;
  const tone = toneFromWaitDeltaMs(race.wait_delta_ms);
  return {
    id: 'lcp_bounce',
    metric_value: race.wait_delta_seconds,
    metric_label: `LCP wait delta · ${race.comparison_label} vs urban`,
    what_it_says: `${race.comparison_label} users waited ${race.wait_delta_seconds} longer than urban users for the main page experience to arrive.`,
    why_it_matters: LCP_BOUNCE_WHY_MATTERS[tone],
    tone
  };
}

// Per-phase INP-conversion "why it matters" sentences. Each names the
// mechanism the dominant phase implies, then describes the user-
// behaviour consequence. No conversion / CPA claims; the principal
// operator translates user-behaviour to KPI themselves.
function pickInpWhyItMatters(phase: 'input_delay' | 'processing' | 'presentation_delay' | null): string {
  if (phase === 'processing') {
    return 'The largest delay appears in click-handler execution. The page accepts the click; the next paint takes long enough that interaction stalls at the moment of intent.';
  }
  if (phase === 'presentation_delay') {
    return 'The largest delay appears between click and the next paint. The page is acting, but slowly enough that a share of users disengage before the action registers visually.';
  }
  if (phase === 'input_delay') {
    return "The largest delay appears between input and the page's first response. Buttons feel mushy at the moment of intent — the friction is real even when the page completes the action moments later.";
  }
  // No dominant phase confidently named — fall back to a non-mechanism
  // framing that still earns the row's space.
  return 'Interaction-poor sessions concentrate enough to read as a pattern, even when no single mechanism dominates the cause.';
}

function buildInpConversionRow(act3: ReportAct3ViewModel): ReportAct4ImpactRow | null {
  if (act3.poor_session_share == null || act3.poor_session_share < ACT4_INP_GATE_POOR_SHARE_PCT) return null;
  const phase = act3.inp_story?.dominant_phase ?? null;
  const phaseSuffix = phase ? ` (longest delay: ${phase.replace('_', ' ')})` : '';
  return {
    id: 'inp_conversion',
    metric_value: `${act3.poor_session_share}%`,
    metric_label: phase
      ? `Sessions past the slow-experience threshold · longest delay ${phase.replace('_', ' ')}`
      : 'Sessions past the slow-experience threshold',
    what_it_says: `${act3.poor_session_share}% of measured sessions crossed a poor-performance threshold${phaseSuffix}.`,
    why_it_matters: pickInpWhyItMatters(phase),
    tone: toneFromPoorShare(act3.poor_session_share)
  };
}

function buildScriptRoasRow(race: ReportRaceViewModel, act3: ReportAct3ViewModel): ReportAct4ImpactRow | null {
  const thirdParty = race.third_party_story;
  const loaf = act3.loaf_story;
  const thirdPartyHits =
    thirdParty != null && (thirdParty.dominant_tier === 'moderate' || thirdParty.dominant_tier === 'heavy');
  const loafHits =
    loaf != null && loaf.worst_frame_ms_p75 != null && loaf.worst_frame_ms_p75 >= ACT4_LOAF_LONG_FRAME_MS;
  if (!thirdPartyHits && !loafHits) return null;

  let metricValue: string;
  let metricLabel: string;
  let whatItSays: string;
  let tone: ReportAct4ImpactTone;
  if (thirdPartyHits && thirdParty != null && thirdParty.median_share_pct != null) {
    metricValue = `${thirdParty.median_share_pct}%`;
    metricLabel = 'Third-party script share (typical page on this domain)';
    whatItSays = `Third-party scripts make up ${thirdParty.median_share_pct}% of the script weight loading before the main image or text appears, on the typical page sampled.`;
    tone = thirdParty.dominant_tier === 'heavy' ? 'alert' : 'watch';
  } else if (loafHits && loaf != null && loaf.worst_frame_ms_p75 != null) {
    metricValue = `${Math.round(loaf.worst_frame_ms_p75)}ms`;
    metricLabel = 'Frame stall · slowest quarter of measurements';
    whatItSays = `On the slowest quarter of measurements, animation frames take ${Math.round(loaf.worst_frame_ms_p75)}ms to render — long enough that interaction with the page feels stalled.`;
    tone = loaf.worst_frame_ms_p75 >= ACT4_LOAF_ALERT_MS ? 'alert' : 'watch';
  } else {
    // Defensive: if third-party fired without a share number, emit the
    // row with a descriptive label but no metric value so the ledger
    // row reads honestly instead of "undefined%".
    metricValue = thirdParty?.dominant_tier === 'heavy' ? 'Heavy' : 'Moderate';
    metricLabel = 'Third-party script load tier';
    whatItSays = `Third-party script load is in the ${metricValue.toLowerCase()} tier on the measured pages.`;
    tone = thirdParty?.dominant_tier === 'heavy' ? 'alert' : 'watch';
  }

  // "Stall in the moments after" is correct only at heavy / loaf-alert.
  // At watch tier (moderate third-party share, sub-150ms LoAF) it's
  // hyperbole — drag is real but doesn't categorically stall.
  const whyItMatters =
    tone === 'alert'
      ? 'On script-heavy pages, mobile-first audiences experience the worst of this — the top of the experience funnel arrives, but interactions stall in the moments after.'
      : 'Script weight at this level reads as drag at the moment of interaction — perceptible on mid-tier devices, particularly on weaker network paths.';

  return {
    id: 'script_roas',
    metric_value: metricValue,
    metric_label: metricLabel,
    what_it_says: whatItSays,
    why_it_matters: whyItMatters,
    tone
  };
}

function buildNetworkReachRow(aggregate: SignalAggregateV1): ReportAct4ImpactRow | null {
  const constrainedShare =
    aggregate.network_distribution.constrained_moderate + aggregate.network_distribution.constrained;
  if (constrainedShare < ACT4_NETWORK_GATE_CONSTRAINED_PCT) return null;
  const tone = toneFromConstrainedShare(constrainedShare);
  // At alert tier (>=50%) "majority" earns its weight; at watch tier
  // (>=30%) "real share" stays accurate.
  const whyItMatters =
    tone === 'alert'
      ? 'Decisions calibrated for urban-speed conditions miss the experience a majority of the audience actually gets.'
      : "If teams only judge the page from fast office networks, they'll miss the experience a real share of the audience gets.";
  return {
    id: 'network_reach',
    metric_value: `${constrainedShare}%`,
    metric_label: 'Audience on constrained or worse networks',
    what_it_says: `${constrainedShare}% of the audience arrived in constrained or weaker network conditions.`,
    why_it_matters: whyItMatters,
    tone
  };
}

// Orchestrator. Every `metric_value` / `metric_label` / `what_it_says`
// reads from a real measured field on `aggregate`, `race`, or `act3`.
// `why_it_matters` is editorial commentary on those measured numbers,
// disciplined to user-behaviour observation (never commercial-figure
// assertion). The boundary disclosure lives ONCE in the section-lede
// above these rows — see editorial-copy.ts business_section_boundary_lede.
export function buildAct4ImpactRows(
  aggregate: SignalAggregateV1,
  race: ReportRaceViewModel,
  act3: ReportAct3ViewModel
): ReportAct4ImpactRow[] {
  const rows = [
    buildLcpBounceRow(race),
    buildInpConversionRow(act3),
    buildScriptRoasRow(race, act3),
    buildNetworkReachRow(aggregate)
  ].filter((row): row is ReportAct4ImpactRow => row !== null);

  if (rows.length < ACT4_IMPACT_MIN_ROWS) return [];
  return rows;
}
