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
// evidence; above it the share is large enough that the "drop conversion"
// sentence meets the reader's own observation. Calibration choice (not an
// empirical CWV threshold).
const ACT4_INP_GATE_POOR_SHARE_PCT = 25;
// Act 4 `network_reach` row emission gate. A combined constrained /
// constrained_moderate share of 30% is the point where "a real share"
// stops being a hedge and starts being load-bearing for the
// network_reach KPI claim. Calibration choice.
const ACT4_NETWORK_GATE_CONSTRAINED_PCT = 30;
// Tone escalation for the `script_roas` row when LoAF worst-frame p75
// crosses into territory that will feel like a stall on mid-tier
// devices. 150ms is 3× the W3C long-frame floor and the point above
// which qualitative session logs commonly report "the page froze".
const ACT4_LOAF_ALERT_MS = 150;

function wrapKpiCameo(sentence: string, kpiCameo: string): string {
  return sentence.replace(kpiCameo, `<em class="sr-italic-serif">${kpiCameo}</em>`);
}

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
// 15% ≈ a minority large enough to own a named KPI story.
function toneFromPoorShare(share: number): ReportAct4ImpactTone {
  if (share >= 50) return 'alert';
  if (share >= 15) return 'watch';
  return 'steady';
}

// Presentation-calibration tone bands for the `network_reach` row.
// Operates on the combined constrained + constrained_moderate share.
// 50% ≈ the urban assumption is strictly wrong; 30% ≈ load-bearing
// enough to name the audience-reach KPI claim.
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

function buildLcpBounceRow(race: ReportRaceViewModel): ReportAct4ImpactRow | null {
  if (!race.race_available || race.wait_delta_ms == null || !race.wait_delta_seconds) return null;
  return {
    id: 'lcp_bounce',
    metric_value: race.wait_delta_seconds,
    metric_label: `LCP wait delta · ${race.comparison_label} vs urban`,
    kpi_label: 'Bounce Rate · Ad Quality Score',
    impact_sentence_html: wrapKpiCameo(
      'Google and Meta raise CPC on slow landing pages. You pay more for clicks that never become sessions.',
      'CPC'
    ),
    tone: toneFromWaitDeltaMs(race.wait_delta_ms)
  };
}

function buildInpConversionRow(act3: ReportAct3ViewModel): ReportAct4ImpactRow | null {
  if (act3.poor_session_share == null || act3.poor_session_share < ACT4_INP_GATE_POOR_SHARE_PCT) return null;
  const phase = act3.inp_story?.dominant_phase;
  return {
    id: 'inp_conversion',
    metric_value: `${act3.poor_session_share}%`,
    metric_label: phase
      ? `Sessions past the poor-performance threshold · dominant phase ${phase.replace('_', ' ')}`
      : 'Sessions past the poor-performance threshold',
    kpi_label: 'Conversion Rate · Cost Per Acquisition',
    impact_sentence_html: wrapKpiCameo(
      'Mushy buttons at the point of intent drop conversion. Same ad spend, fewer leads, inflated CPA.',
      'CPA'
    ),
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
  let tone: ReportAct4ImpactTone;
  if (thirdPartyHits && thirdParty != null && thirdParty.median_share_pct != null) {
    metricValue = `${thirdParty.median_share_pct}%`;
    metricLabel = 'Third-party script share (median origin)';
    tone = thirdParty.dominant_tier === 'heavy' ? 'alert' : 'watch';
  } else if (loafHits && loaf != null && loaf.worst_frame_ms_p75 != null) {
    metricValue = `${Math.round(loaf.worst_frame_ms_p75)}ms`;
    metricLabel = 'LoAF worst-frame p75';
    tone = loaf.worst_frame_ms_p75 >= ACT4_LOAF_ALERT_MS ? 'alert' : 'watch';
  } else {
    // Defensive: if third-party fired without a share number, emit the
    // row with a descriptive label but no metric value so the ledger
    // row reads honestly instead of "undefined%".
    metricValue = thirdParty?.dominant_tier === 'heavy' ? 'Heavy' : 'Moderate';
    metricLabel = 'Third-party script load tier';
    tone = thirdParty?.dominant_tier === 'heavy' ? 'alert' : 'watch';
  }

  return {
    id: 'script_roas',
    metric_value: metricValue,
    metric_label: metricLabel,
    kpi_label: 'Mobile ROAS · Audience Reach',
    impact_sentence_html: wrapKpiCameo(
      'Mobile-first audiences cannot interact with a script-heavy page. Top-of-funnel reach without bottom-of-funnel ROAS.',
      'ROAS'
    ),
    tone
  };
}

function buildNetworkReachRow(aggregate: SignalAggregateV1): ReportAct4ImpactRow | null {
  const constrainedShare =
    aggregate.network_distribution.constrained_moderate + aggregate.network_distribution.constrained;
  if (constrainedShare < ACT4_NETWORK_GATE_CONSTRAINED_PCT) return null;
  return {
    id: 'network_reach',
    metric_value: `${constrainedShare}%`,
    metric_label: 'Audience on constrained or worse networks',
    kpi_label: 'Audience Reach · Campaign Efficiency',
    impact_sentence_html: wrapKpiCameo(
      'A real share of your audience lives on constrained networks. Campaigns calibrated for urban speed leak Campaign Efficiency here.',
      'Campaign Efficiency'
    ),
    tone: toneFromConstrainedShare(constrainedShare)
  };
}

// Deduced narrative bridges. Every `metric_value` / `metric_label`
// reads from a real measured field on `aggregate`, `race`, or `act3`.
// The `impact_sentence_html` strings are author-written prose tying
// those measured numbers to the stakeholder's KPI vocabulary
// (CPC, CPA, ROAS, Campaign Efficiency). No numeric claim originates
// in these sentences — they are editorial commentary on numbers the
// reader has already seen earlier in the deck.
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
