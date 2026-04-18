import type {
  SignalAggregateV1,
  SignalExperienceStage,
  SignalInpPhase,
  SignalInpStory,
  SignalLcpCulpritKind,
  SignalLcpStory,
  SignalLcpSubpart,
  SignalNetworkTier,
  SignalRaceFallbackReason,
  SignalRaceMetric
} from '@stroma-labs/signal-contracts';
import {
  SIGNAL_FRESHNESS_UNKNOWN_WARNING,
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD
} from '@stroma-labs/signal-contracts';

// Dominance share threshold below which the LCP / INP story narratives
// fall back to hedged copy instead of claiming a single dominant cause.
// Kept as a named constant per plan §10.7 so future buyer-research feedback
// can tune the aggressiveness of single-cause claims in one place.
export const SIGNAL_STORY_HEDGED_THRESHOLD_PCT = 35;

export type ReportMotionMode = 'full' | 'reduced';
export type ReportAct3Mode = 'full' | 'reduced' | 'legacy';
export type ReportMoodTier = 'urgent' | 'sober' | 'affirming';
export type ReportTierKey = SignalNetworkTier | 'unknown';

export const REPORT_SCENE_BUDGETS = {
  act1ParticleBudget: 84,
  act3FlowBodyBudget: 18,
  act3DropBodyBudget: 12
} as const;

export interface ReportEvidenceItem {
  label: string;
  value: string;
  tone: 'neutral' | 'steady' | 'watch' | 'alert';
}

export interface ReportTierVisual {
  key: ReportTierKey;
  label: string;
  share: number;
  particleCount: number;
  narrative: string;
}

export type ReportDeviceTierKey = 'high' | 'mid' | 'low';

export interface ReportDeviceTierVisual {
  key: ReportDeviceTierKey;
  label: string;
  narrative: string;
  share: number;
}

// LCP subpart row in the compact 4-row micro-chart that sits below the
// wait-delta aside in Act 2. `is_dominant` flags the row that owns the
// dominant share so the renderer can tint it with the mood accent without
// recomputing argmax.
export interface ReportLcpSubpartRow {
  key: SignalLcpSubpart;
  label: string;
  share: number;
  is_dominant: boolean;
}

// Act 2 LCP story — inline narrative under the wait-delta aside plus a
// 4-row micro-chart of the subpart distribution. `is_hedged` is true when
// no single subpart carries enough share to make a confident single-cause
// claim (see SIGNAL_STORY_HEDGED_THRESHOLD_PCT). When hedged, the
// narrative falls back to the honest "spread across multiple phases"
// line and the chart omits the dominant-row tint.
export interface ReportLcpStoryViewModel {
  narrative: string;
  is_hedged: boolean;
  dominant_subpart: SignalLcpSubpart | null;
  dominant_culprit_kind: SignalLcpCulpritKind | null;
  rows: ReportLcpSubpartRow[];
}

// Act 3 INP story — inline line inside the INP funnel node. No new card;
// the narrative sits under the existing `sr-funnel-node-threshold` line.
// `is_hedged` uses the same threshold rule as the LCP story.
export interface ReportInpStoryViewModel {
  narrative: string;
  is_hedged: boolean;
  dominant_phase: SignalInpPhase | null;
}

export interface ReportRaceViewModel {
  metric: SignalRaceMetric;
  metric_label: string;
  race_available: boolean;
  fallback_label: string;
  fallback_reason: SignalRaceFallbackReason | null;
  urban_ms: number | null;
  comparison_ms: number | null;
  comparison_label: string;
  comparison_tier: SignalNetworkTier | 'unknown';
  wait_delta_ms: number | null;
  wait_delta_seconds: string;
  urban_coverage: number | null;
  comparison_coverage: number | null;
  schematic_path_hint: string | null;
  race_story: string;
  lcp_story: ReportLcpStoryViewModel | null;
}

export interface ReportStageEvidenceChip {
  key: SignalNetworkTier;
  label: string;
  coverage: number;
  poor_share: number;
  tone: 'steady' | 'watch' | 'alert';
}

export interface ReportExperienceStageViewModel {
  key: SignalExperienceStage;
  label: string;
  threshold_label: string;
  descriptor: string;
  weighted_poor_share: number;
  flow_body_count: number;
  drop_body_count: number;
  chips: ReportStageEvidenceChip[];
}

export interface ReportAct3ViewModel {
  mode: ReportAct3Mode;
  active_stage_keys: SignalExperienceStage[];
  measured_session_coverage: number | null;
  poor_session_share: number | null;
  threshold_basis: string;
  narrative_line: string;
  stages: ReportExperienceStageViewModel[];
  legacy_message: string | null;
  inp_story: ReportInpStoryViewModel | null;
}

export interface ReportCredibilityStripViewModel {
  sample_size: number;
  period_days: number;
  classified_share: number;
  connection_reuse_share: number;
  metric_coverage: number;
  metric_coverage_label: string;
}

// Form-factor visualization — mobile / tablet / desktop audience split,
// surfaced inside Act 1 below the persona grid. Null when
// form_factor_distribution is absent on the aggregate. Segments are
// magnitude-first sorted (dominant form factor reads first) and
// zero-share buckets filtered.
export interface ReportFormFactorViewModel {
  segments: Array<{ label: string; share: number }>;
}

export type SignalTone = 'alert' | 'watch' | 'steady' | 'neutral';

export interface ReportSignalBucket {
  label: string;
  share: number;
  tone: SignalTone;
}

/**
 * A single actionable signal cell on the Actionable signals slide. Each
 * cell names the product-team decision it unlocks so the report is
 * self-documenting about WHY the signal matters, not just what it is.
 *
 * When `buckets` is populated the renderer draws a horizontal stacked bar
 * with proportional segments. When absent it falls back to a flat mono
 * text value (used for quartile signals like downlink / RTT).
 */
export interface ReportSignalCell {
  key: string;
  label: string;
  value: string;
  decision: string;
  coverage_caveat: string | null;
  buckets: ReportSignalBucket[] | null;
}

export interface ReportActionableSignalsViewModel {
  cells: ReportSignalCell[];
}

export interface ReportPersonaProfile {
  label: string;
  share: number;
  tone: 'steady' | 'alert';
  network_tier: string;
  network_criteria: string;
  effective_type: string | null;
  downlink_label: string | null;
  rtt_label: string | null;
  cores_label: string;
  memory_label: string;
  browser: string | null;
  save_data: boolean;
  // When true, the cohort this persona represents is absent from the
  // measured window (0% share). Renderer shows a stripped empty-state
  // card instead of fabricated detail rows. empty_message carries the
  // honest explanation of what's absent and why the card is muted.
  is_empty: boolean;
  empty_message: string;
}

export interface ReportPersonaContrast {
  best: ReportPersonaProfile;
  constrained: ReportPersonaProfile;
}

export interface ReportViewModel {
  domain: string;
  sample_size: number;
  period_days: number;
  generated_at: number;
  freshness_known: boolean;
  warnings: string[];
  mode: SignalAggregateV1['mode'];
  mood_tier: ReportMoodTier;
  mood_label: string;
  hero_kicker: string;
  hero_title: string;
  hero_lede: string;
  boundary_statement: string;
  evidence_items: ReportEvidenceItem[];
  credibility_strip: ReportCredibilityStripViewModel;
  form_factor: ReportFormFactorViewModel | null;
  act1_intro: string;
  act1_tiers: ReportTierVisual[];
  act1_device_tiers: ReportDeviceTierVisual[];
  persona_contrast: ReportPersonaContrast;
  actionable_signals: ReportActionableSignalsViewModel;
  race: ReportRaceViewModel;
  act3: ReportAct3ViewModel;
  act4_lede: string;
  act4_summary_points: string[];
  offer_cards: Array<{ title: string; body: string; href: string; cta: string }>;
}

const BOUNDARY_STATEMENT =
  'This report proves the existence and shape of the experience gap. It does not explain root cause, quantify business exposure, or prescribe remediation.';

const TIER_LABELS: Record<ReportTierKey, string> = {
  urban: 'Urban',
  moderate: 'Moderate',
  constrained_moderate: 'Constrained moderate',
  constrained: 'Constrained',
  unknown: 'Unknown'
};

const STAGE_LABELS: Record<SignalExperienceStage, string> = {
  fcp: 'First content appears',
  lcp: 'Main content becomes visible',
  inp: 'Interaction becomes ready'
};

function metricValue(
  metric: SignalRaceMetric,
  scope: { lcp_ms: number | null; fcp_ms: number | null; ttfb_ms: number | null }
): number | null {
  switch (metric) {
    case 'lcp':
      return scope.lcp_ms;
    case 'fcp':
      return scope.fcp_ms;
    case 'ttfb':
      return scope.ttfb_ms;
    default:
      return null;
  }
}

export function humanizeToken(value: string): string {
  return value.replaceAll('_', ' ');
}

export function formatMetricDuration(value: number | null): string {
  if (value == null) return 'n/a';
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

export function selectMotionMode(prefersReducedMotion: boolean): ReportMotionMode {
  return prefersReducedMotion ? 'reduced' : 'full';
}

function asDurationLabel(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function asPercentLabel(value: number | null): string {
  return value == null ? 'n/a' : `${value}%`;
}

function particleCountForShare(share: number): number {
  if (share <= 0) return 0;
  return Math.max(1, Math.round((share / 100) * REPORT_SCENE_BUDGETS.act1ParticleBudget));
}

function buildTierNarrative(key: ReportTierKey, share: number): string {
  if (key === 'unknown') {
    return share > 0
      ? 'Some traffic cannot be confidently classified, so the report keeps that uncertainty in view.'
      : 'No unclassified traffic materially changes this view.';
  }

  if (share >= 40) {
    return 'This is not a fringe condition. It shapes a large share of the audience reality.';
  }

  if (share >= 20) {
    return 'This condition is large enough to materially influence what the average experience hides.';
  }

  return 'This tier matters less in volume, but it still contributes to the real-world spread of the experience.';
}

const DEVICE_TIER_LABELS: Record<ReportDeviceTierKey, string> = {
  high: 'High-end',
  mid: 'Mid-range',
  low: 'Budget'
};

// Device signatures come directly from the classification thresholds in
// packages/signal/src/core/classify-device.ts. Surfacing them in the Act 1
// narrative lets a reader see what the tier actually MEANS in hardware terms
// rather than reading atmospheric marketing copy.
const DEVICE_SIGNATURE: Record<ReportDeviceTierKey, string> = {
  high: '6+ CPU cores, 1280px+ screens, 4+ GB RAM where measurable',
  mid: '4–6 CPU cores, 768–1280px screens, 2–4 GB RAM where measurable',
  low: '≤2 CPU cores, <768px screens, ≤2 GB RAM where measurable'
};

function buildDeviceNarrative(key: ReportDeviceTierKey, share: number): string {
  if (share === 0) {
    return 'No sessions in this device class were observed in this sample.';
  }
  const signature = DEVICE_SIGNATURE[key];
  if (share >= 50) {
    return `The dominant hardware reality of your audience. Sessions on ${signature}.`;
  }
  if (share >= 20) {
    return `A material share of your audience ships into this hardware class. Sessions on ${signature}.`;
  }
  return `A measurable minority of your audience on ${signature}.`;
}

function buildAct1DeviceTiers(aggregate: SignalAggregateV1): ReportDeviceTierVisual[] {
  const order: ReportDeviceTierKey[] = ['high', 'mid', 'low'];
  return order.map((key) => {
    const share = aggregate.device_distribution[key];
    return {
      key,
      label: DEVICE_TIER_LABELS[key],
      narrative: buildDeviceNarrative(key, share),
      share
    };
  });
}

function buildAct1Tiers(aggregate: SignalAggregateV1): ReportTierVisual[] {
  return [
    { key: 'urban', label: TIER_LABELS.urban, share: aggregate.network_distribution.urban },
    { key: 'moderate', label: TIER_LABELS.moderate, share: aggregate.network_distribution.moderate },
    {
      key: 'constrained_moderate',
      label: TIER_LABELS.constrained_moderate,
      share: aggregate.network_distribution.constrained_moderate
    },
    { key: 'constrained', label: TIER_LABELS.constrained, share: aggregate.network_distribution.constrained },
    { key: 'unknown', label: TIER_LABELS.unknown, share: aggregate.network_distribution.unknown }
  ].map((tier) => ({
    ...tier,
    particleCount: particleCountForShare(tier.share),
    narrative: buildTierNarrative(tier.key, tier.share)
  }));
}

// Short labels for the 4-bar LCP subpart chart. Kept terse so each row
// comfortably fits the 80px-tall compact chart that sits beside the
// wait-delta hero number without competing for visual weight.
const LCP_SUBPART_SHORT_LABELS: Record<SignalLcpSubpart, string> = {
  ttfb: 'TTFB',
  resource_load_delay: 'Load delay',
  resource_load_time: 'Load time',
  element_render_delay: 'Render delay'
};

// Narrative copy per dominant subpart. Matches §3.4 of the enrichment
// plan — honest, temporal, measured, no prescription. Each sentence names
// what is happening, not what to fix.
const LCP_SUBPART_NARRATIVES: Record<SignalLcpSubpart, string> = {
  element_render_delay:
    'The bytes arrive in time, but render is blocked afterwards. Element render delay dominates the largest paint.',
  resource_load_delay:
    'The largest element is discovered too late. Most of the paint delay comes from waiting to start loading the hero resource.',
  resource_load_time: 'The largest element is discovered and ready — it just takes too long to travel the wire.',
  ttfb: "The server's first byte lands slowly. The hero can't load until the document starts."
};

// Culprit-clause copy appended after the subpart narrative when the
// aggregate carries a confident culprit kind. `unknown` is deliberately
// absent — the clause is omitted entirely when the classifier falls
// through, rather than narrating a guess.
const LCP_CULPRIT_CLAUSES: Record<Exclude<SignalLcpCulpritKind, 'unknown'>, string> = {
  hero_image: 'Usually a hero image.',
  headline_text: 'Usually the headline text.',
  banner_image: 'Usually a banner image.',
  product_image: 'Usually a product image.',
  video_poster: 'Usually a video poster.'
};

const INP_PHASE_NARRATIVES: Record<SignalInpPhase, string> = {
  processing: 'Interaction lag is dominated by handler work after the click.',
  input_delay: 'The page is busy before clicks can start — input waits on other work.',
  presentation: 'Handlers finish fast, but visual completion lags.'
};

const LCP_HEDGED_NARRATIVE = 'Paint delay is spread across multiple phases — no single cause dominates.';
const INP_HEDGED_NARRATIVE = 'Interaction lag is spread across multiple phases — no single cause dominates.';

function buildLcpStoryViewModel(story: SignalLcpStory | undefined): ReportLcpStoryViewModel | null {
  if (!story) return null;
  if (!story.subpart_distribution_pct) return null;

  const distribution = story.subpart_distribution_pct;
  const isHedged =
    story.dominant_subpart == null ||
    story.dominant_subpart_share_pct == null ||
    story.dominant_subpart_share_pct < SIGNAL_STORY_HEDGED_THRESHOLD_PCT;

  const dominantSubpart = isHedged ? null : story.dominant_subpart;
  const culprit =
    isHedged || !story.dominant_culprit_kind || story.dominant_culprit_kind === 'unknown'
      ? null
      : story.dominant_culprit_kind;

  // Narrative composition: subpart clause + optional culprit clause.
  // When hedged, the fixed "spread across multiple phases" line owns the
  // whole narrative so we never imply a single-cause claim we can't back.
  let narrative: string;
  if (isHedged || !dominantSubpart) {
    narrative = LCP_HEDGED_NARRATIVE;
  } else {
    narrative = LCP_SUBPART_NARRATIVES[dominantSubpart];
    if (culprit) {
      narrative = `${narrative} ${LCP_CULPRIT_CLAUSES[culprit]}`;
    }
  }

  const rows: ReportLcpSubpartRow[] = (
    ['ttfb', 'resource_load_delay', 'resource_load_time', 'element_render_delay'] as const
  ).map((key) => ({
    key,
    label: LCP_SUBPART_SHORT_LABELS[key],
    share: distribution[key],
    is_dominant: dominantSubpart === key
  }));

  return {
    narrative,
    is_hedged: isHedged,
    dominant_subpart: dominantSubpart,
    dominant_culprit_kind: culprit,
    rows
  };
}

function buildInpStoryViewModel(story: SignalInpStory | undefined): ReportInpStoryViewModel | null {
  if (!story) return null;

  const isHedged =
    story.dominant_phase == null ||
    story.dominant_phase_share_pct == null ||
    story.dominant_phase_share_pct < SIGNAL_STORY_HEDGED_THRESHOLD_PCT;

  const dominantPhase = isHedged ? null : story.dominant_phase;
  const narrative = isHedged || !dominantPhase ? INP_HEDGED_NARRATIVE : INP_PHASE_NARRATIVES[dominantPhase];

  return {
    narrative,
    is_hedged: isHedged,
    dominant_phase: dominantPhase
  };
}

function buildRaceStory(comparisonLabel: string, waitDeltaMs: number | null, metric: SignalRaceMetric): string {
  if (metric === 'none' || waitDeltaMs == null) {
    return 'The current sample does not yet support a defensible race, so the report keeps the comparison honest instead of inventing certainty.';
  }

  if (waitDeltaMs >= 2_200) {
    return `${comparisonLabel} users remain in the wait while urban users are already past the reassuring moment.`;
  }

  if (waitDeltaMs >= 1_000) {
    return `${comparisonLabel} users still feel a visible lag after urban users are effectively through the gate.`;
  }

  return `${comparisonLabel} users are still slower, but the wait remains comparatively contained in the measured sample.`;
}

function buildRaceViewModel(aggregate: SignalAggregateV1): ReportRaceViewModel {
  const metric = aggregate.race_metric;
  const urbanMs = metric === 'none' ? null : metricValue(metric, aggregate.vitals.urban);
  const comparisonMs = metric === 'none' ? null : metricValue(metric, aggregate.vitals.comparison);
  const waitDeltaMs = urbanMs == null || comparisonMs == null ? null : Math.max(0, comparisonMs - urbanMs);
  const comparisonLabel = TIER_LABELS[aggregate.comparison_tier] ?? humanizeToken(aggregate.comparison_tier);

  return {
    metric,
    metric_label: metric === 'none' ? 'No comparable race yet' : metric.toUpperCase(),
    race_available: metric !== 'none',
    fallback_label:
      aggregate.race_fallback_reason == null
        ? 'Primary comparison metric selected from measured coverage.'
        : humanizeToken(aggregate.race_fallback_reason),
    fallback_reason: aggregate.race_fallback_reason,
    urban_ms: urbanMs,
    comparison_ms: comparisonMs,
    comparison_label: comparisonLabel,
    comparison_tier: aggregate.comparison_tier,
    wait_delta_ms: waitDeltaMs,
    wait_delta_seconds: waitDeltaMs == null ? 'n/a' : `${(waitDeltaMs / 1000).toFixed(1)}s`,
    urban_coverage: aggregate.coverage.selected_metric_urban_coverage,
    comparison_coverage: aggregate.coverage.selected_metric_comparison_coverage,
    schematic_path_hint: aggregate.top_page_path,
    race_story: buildRaceStory(comparisonLabel, waitDeltaMs, metric),
    lcp_story: buildLcpStoryViewModel(aggregate.lcp_story)
  };
}

function chipToneForPoorShare(poorShare: number): 'steady' | 'watch' | 'alert' {
  if (poorShare >= 50) return 'alert';
  if (poorShare >= 15) return 'watch';
  return 'steady';
}

function thresholdForStage(stage: SignalExperienceStage): number {
  switch (stage) {
    case 'fcp':
      return SIGNAL_FUNNEL_FCP_POOR_THRESHOLD;
    case 'lcp':
      return SIGNAL_FUNNEL_LCP_POOR_THRESHOLD;
    case 'inp':
      return SIGNAL_FUNNEL_INP_POOR_THRESHOLD;
  }
}

function thresholdBasis(activeStages: SignalExperienceStage[], isLegacy: boolean): string {
  if (isLegacy) return 'Legacy report link';
  if (activeStages.length === 0) return 'No defensible funnel in this sample';
  return activeStages.map((stage) => `${stage.toUpperCase()} ${asDurationLabel(thresholdForStage(stage))}`).join(' • ');
}

function weightedPoorShareForStage(aggregate: SignalAggregateV1, stage: SignalExperienceStage): number {
  const funnel = aggregate.experience_funnel;
  if (!funnel) return 0;

  const shares = (['urban', 'moderate', 'constrained_moderate', 'constrained'] as SignalNetworkTier[]).map((tier) => ({
    share: aggregate.network_distribution[tier],
    poorShare: funnel.stages[stage]?.tiers[tier]?.poor_share ?? 0
  }));
  const totalShare = shares.reduce((sum, item) => sum + item.share, 0);
  if (totalShare <= 0) return 0;

  const weightedTotal = shares.reduce((sum, item) => sum + item.share * item.poorShare, 0);
  return Math.round(weightedTotal / totalShare);
}

function descriptorForStage(stage: SignalExperienceStage, weightedPoorShare: number, mood: ReportMoodTier): string {
  if (stage === 'fcp') {
    if (weightedPoorShare >= 40) {
      return 'A meaningful share of classified sessions crosses the first-paint poor-performance threshold in the measured sample.';
    }
    return mood === 'affirming'
      ? 'Most classified sessions stay on the measured-safe side of the first-paint threshold in this sample.'
      : 'Some classified sessions cross the first-paint poor-performance threshold, but the majority stay on the measured-safe side.';
  }

  if (stage === 'lcp') {
    if (weightedPoorShare >= 35) {
      return 'A meaningful share of classified sessions crosses the main-content poor-performance threshold in the measured sample.';
    }
    return mood === 'affirming'
      ? 'Most classified sessions stay on the measured-safe side of the main-content threshold in this sample.'
      : 'Some classified sessions cross the main-content poor-performance threshold, but the stage still holds for the majority.';
  }

  if (weightedPoorShare >= 25) {
    return 'A meaningful share of classified sessions crosses the interaction-ready poor-performance threshold in the measured sample.';
  }

  return mood === 'affirming'
    ? 'Most classified sessions stay on the measured-safe side of the interaction-ready threshold in this sample.'
    : 'Some classified sessions cross the interaction-ready poor-performance threshold, but the majority stay on the measured-safe side.';
}

function flowBodyCount(weightedPoorShare: number): number {
  return Math.max(10, Math.min(REPORT_SCENE_BUDGETS.act3FlowBodyBudget, 10 + Math.round(weightedPoorShare / 10)));
}

function dropBodyCount(weightedPoorShare: number): number {
  return Math.max(
    weightedPoorShare === 0 ? 0 : 1,
    Math.min(
      REPORT_SCENE_BUDGETS.act3DropBodyBudget,
      Math.round((weightedPoorShare / 100) * REPORT_SCENE_BUDGETS.act3DropBodyBudget)
    )
  );
}

function buildExperienceStages(aggregate: SignalAggregateV1, mood: ReportMoodTier): ReportExperienceStageViewModel[] {
  const funnel = aggregate.experience_funnel;
  if (!funnel) return [];

  return funnel.active_stages.map((stage) => {
    const weightedPoorShare = weightedPoorShareForStage(aggregate, stage);

    return {
      key: stage,
      label: STAGE_LABELS[stage],
      threshold_label: `Poor at > ${asDurationLabel(funnel.stages[stage]?.poor_threshold_ms ?? 0)}`,
      descriptor: descriptorForStage(stage, weightedPoorShare, mood),
      weighted_poor_share: weightedPoorShare,
      flow_body_count: flowBodyCount(weightedPoorShare),
      drop_body_count: dropBodyCount(weightedPoorShare),
      chips: (['urban', 'moderate', 'constrained_moderate', 'constrained'] as SignalNetworkTier[]).map((tier) => ({
        key: tier,
        label: TIER_LABELS[tier],
        coverage: funnel.stages[stage]?.tiers[tier]?.coverage ?? 0,
        poor_share: funnel.stages[stage]?.tiers[tier]?.poor_share ?? 0,
        tone: chipToneForPoorShare(funnel.stages[stage]?.tiers[tier]?.poor_share ?? 0)
      }))
    };
  });
}

function selectMoodTier(race: ReportRaceViewModel, act3: ReportAct3ViewModel): ReportMoodTier {
  const poorShare = act3.poor_session_share ?? 0;
  const waitDeltaMs = race.wait_delta_ms ?? 0;

  if (poorShare >= 35 || waitDeltaMs >= 2_200) {
    return 'urgent';
  }

  if (race.race_available && poorShare <= 12 && waitDeltaMs <= 900) {
    return 'affirming';
  }

  return 'sober';
}

function buildAct3Narrative(activeStages: SignalExperienceStage[], mood: ReportMoodTier): string {
  if (activeStages.length === 0) {
    return 'This link predates the measured experience funnel and stays in a reduced legacy state until it is regenerated.';
  }

  if (mood === 'urgent') {
    return activeStages.length >= 3
      ? 'A meaningful share of measured classified sessions crosses poor-performance thresholds at first paint, at main content, and at interaction-ready — stage by stage.'
      : 'A meaningful share of measured classified sessions crosses poor-performance thresholds at first paint and at main content before coverage thins out.';
  }

  if (mood === 'affirming') {
    return activeStages.length >= 3
      ? 'The cliff still exists, but most measured classified sessions stay on the measured-safe side of every threshold we track.'
      : 'The cliff still exists, but most measured classified sessions stay on the measured-safe side of the thresholds we can defend.';
  }

  return activeStages.length >= 3
    ? 'The experience stays mostly controlled, but enough measured classified sessions cross poor-performance thresholds across the measured stages to keep the gap real.'
    : 'The experience stays mostly controlled, but a measurable share of classified sessions still crosses a poor-performance threshold in the stages we can defend.';
}

function buildAct3ViewModel(aggregate: SignalAggregateV1, moodHint: ReportMoodTier = 'sober'): ReportAct3ViewModel {
  const funnel = aggregate.experience_funnel;
  // INP story is tied to the INP funnel node. Only surface the story
  // when the funnel has an active INP stage — otherwise we would be
  // claiming a phase diagnosis for a stage the funnel itself could not
  // defend. Legacy / reduced / coverage-thin funnels cleanly omit the
  // inline line (§4.1 of the enrichment plan).
  const inpStage = funnel?.active_stages.includes('inp') ? aggregate.inp_story : undefined;
  const inpStory = buildInpStoryViewModel(inpStage);

  if (!funnel) {
    return {
      mode: 'legacy',
      active_stage_keys: [],
      measured_session_coverage: null,
      poor_session_share: null,
      threshold_basis: thresholdBasis([], true),
      narrative_line:
        'This report link predates the measured experience funnel. Regenerate it to see the new performance-cliff layer.',
      stages: [],
      legacy_message:
        'Acts 1 and 2 remain trustworthy, but this URL was generated before the measured funnel block existed.',
      inp_story: null
    };
  }

  if (funnel.active_stages.length === 0) {
    return {
      mode: 'reduced',
      active_stage_keys: [],
      measured_session_coverage: null,
      poor_session_share: null,
      threshold_basis: thresholdBasis([], false),
      narrative_line:
        'The current sample does not contain enough classified and measured sessions to build a defensible performance funnel.',
      stages: [],
      legacy_message: null,
      inp_story: null
    };
  }

  return {
    mode: funnel.active_stages.length >= 3 ? 'full' : 'reduced',
    active_stage_keys: funnel.active_stages,
    measured_session_coverage: funnel.measured_session_coverage,
    poor_session_share: funnel.poor_session_share,
    threshold_basis: thresholdBasis(funnel.active_stages, false),
    narrative_line: buildAct3Narrative(funnel.active_stages, moodHint),
    stages: buildExperienceStages(aggregate, moodHint),
    legacy_message: null,
    inp_story: inpStory
  };
}

function buildEvidenceItems(
  aggregate: SignalAggregateV1,
  race: ReportRaceViewModel,
  act3: ReportAct3ViewModel,
  mood: ReportMoodTier
): ReportEvidenceItem[] {
  return [
    { label: 'Sample', value: `${aggregate.sample_size} sessions`, tone: 'neutral' },
    { label: 'Window', value: `${aggregate.period_days} days`, tone: 'neutral' },
    {
      label: 'Comparison tier',
      value: race.race_available ? race.comparison_label : 'No race yet',
      tone: mood === 'urgent' ? 'alert' : 'neutral'
    },
    {
      label: 'Race metric',
      value: race.metric === 'none' ? 'Awaiting comparable data' : race.metric_label,
      tone: race.metric === 'none' ? 'watch' : 'steady'
    },
    {
      label: 'Fallback honesty',
      value: race.fallback_label,
      tone: race.metric === 'none' ? 'watch' : 'neutral'
    },
    {
      label: 'Threshold basis',
      value: act3.threshold_basis,
      tone: 'neutral'
    },
    {
      label: 'Poor-session share',
      value:
        act3.active_stage_keys.length === 0 && act3.mode !== 'legacy'
          ? 'Unavailable'
          : asPercentLabel(act3.poor_session_share),
      tone:
        act3.active_stage_keys.length === 0
          ? 'neutral'
          : (act3.poor_session_share ?? 0) >= 35
            ? 'alert'
            : (act3.poor_session_share ?? 0) >= 12
              ? 'watch'
              : 'steady'
    },
    {
      label: 'Measured funnel coverage',
      value:
        act3.active_stage_keys.length === 0 && act3.mode !== 'legacy'
          ? 'Unavailable'
          : asPercentLabel(act3.measured_session_coverage),
      tone:
        act3.active_stage_keys.length === 0
          ? 'neutral'
          : (act3.measured_session_coverage ?? 0) >= 75
            ? 'steady'
            : 'watch'
    }
  ];
}

function buildHeroCopy(
  aggregate: SignalAggregateV1,
  mood: ReportMoodTier
): Pick<ReportViewModel, 'hero_kicker' | 'hero_title' | 'hero_lede' | 'act1_intro' | 'act4_lede'> {
  const title = aggregate.domain;

  if (mood === 'urgent') {
    return {
      hero_kicker: 'Measured proof from real traffic',
      hero_title: title,
      hero_lede:
        'A real share of the traffic you send here lands in a slower world. This report turns that hidden post-click reality into something visible, temporal, and difficult to dismiss.',
      act1_intro:
        'These are not average users. They are materially different infrastructure realities that a real share of your traffic already lands on.',
      act4_lede: 'The gap is proven. What follows is root cause, cost, and fix order.'
    };
  }

  if (mood === 'affirming') {
    return {
      hero_kicker: 'Measured proof from real traffic',
      hero_title: title,
      hero_lede:
        'The measured story is more controlled here. Traffic still lands into different conditions across tiers, but most sessions stay on the safer side of the thresholds that matter.',
      act1_intro:
        'Your traffic still lands into different conditions. The difference is that this report shows the experience holding together across more of them.',
      act4_lede: 'The gap is restrained, but it exists. What follows is why it holds and where it could weaken.'
    };
  }

  return {
    hero_kicker: 'Measured proof from real traffic',
    hero_title: title,
    hero_lede:
      'The post-click reality is real, but it sits in the middle ground: meaningful enough to feel, not yet severe enough to scream. That still deserves attention.',
    act1_intro:
      'These clusters show the real conditions your traffic lands on, not the calmer average implied by a single lab run.',
    act4_lede: 'The gap is measurable. What follows is cause, cost, and fix order.'
  };
}

function buildAct4SummaryPoints(
  aggregate: SignalAggregateV1,
  race: ReportRaceViewModel,
  act3: ReportAct3ViewModel
): string[] {
  const constrained = aggregate.network_distribution.constrained_moderate + aggregate.network_distribution.constrained;
  const points = [
    `${aggregate.network_distribution.urban}% urban, ${constrained}% constrained or worse.`,
    race.race_available
      ? `${race.comparison_label} users wait ${race.wait_delta_seconds} longer than urban on ${race.metric_label}.`
      : 'Not enough data for a statistically defensible race comparison.'
  ];

  if (act3.poor_session_share != null) {
    points.push(`${act3.poor_session_share}% of classified sessions crossed a poor-performance threshold.`);
  }

  return points;
}

function buildOfferCards(): Array<{ title: string; body: string; href: string; cta: string }> {
  return [
    {
      title: 'Rapid Fix Plan',
      body: 'Trace the proven gap to the landing pages and routes causing the most drag, and get the sequenced fixes that close it fastest.',
      href: 'https://www.stroma.design/rapid-fix-plan',
      cta: 'Commission a plan'
    },
    {
      title: 'Performance Intelligence',
      body: 'Join measured user, device, and network conditions to GA4, Google Ads, Search Console, and warehouse context — see which campaigns, landing pages, and audience segments are most exposed.',
      href: 'https://www.stroma.design/performance-intelligence',
      cta: 'Explore the service'
    }
  ];
}

export interface ReportMotionPayload {
  mood: ReportMoodTier;
  act1: {
    tiers: Array<{ key: ReportTierKey; share: number; particleCount: number }>;
  };
  act2: {
    available: boolean;
    urban_ms: number | null;
    comparison_ms: number | null;
    wait_delta_ms: number | null;
  };
  act3: {
    mode: ReportAct3Mode;
    poor_session_share: number | null;
    stages: Array<{
      key: SignalExperienceStage;
      weighted_poor_share: number;
      flow_body_count: number;
      drop_body_count: number;
    }>;
  };
}

export function extractMotionPayload(viewModel: ReportViewModel): ReportMotionPayload {
  return {
    mood: viewModel.mood_tier,
    act1: {
      tiers: viewModel.act1_tiers.map((tier) => ({
        key: tier.key,
        share: tier.share,
        particleCount: tier.particleCount
      }))
    },
    act2: {
      available: viewModel.race.race_available,
      urban_ms: viewModel.race.urban_ms,
      comparison_ms: viewModel.race.comparison_ms,
      wait_delta_ms: viewModel.race.wait_delta_ms
    },
    act3: {
      mode: viewModel.act3.mode,
      poor_session_share: viewModel.act3.poor_session_share,
      stages: viewModel.act3.stages.map((stage) => ({
        key: stage.key,
        weighted_poor_share: stage.weighted_poor_share,
        flow_body_count: stage.flow_body_count,
        drop_body_count: stage.drop_body_count
      }))
    }
  };
}

function buildCredibilityStrip(
  aggregate: SignalAggregateV1,
  race: ReportRaceViewModel
): ReportCredibilityStripViewModel {
  const coverage = aggregate.coverage;
  const classifiedShare = Math.round(Math.max(0, Math.min(100, 100 - coverage.unclassified_network_share)));
  const connectionReuseShare = Math.round(Math.max(0, Math.min(100, coverage.connection_reuse_share)));
  const raceMetric = aggregate.race_metric;
  const conservativeRaceCoverage =
    raceMetric === 'none'
      ? coverage.lcp_coverage
      : Math.min(
          coverage.selected_metric_urban_coverage ??
            (raceMetric === 'lcp'
              ? aggregate.vitals.urban.lcp_coverage
              : raceMetric === 'fcp'
                ? aggregate.vitals.urban.fcp_coverage
                : aggregate.vitals.urban.ttfb_coverage),
          coverage.selected_metric_comparison_coverage ??
            (raceMetric === 'lcp'
              ? aggregate.vitals.comparison.lcp_coverage
              : raceMetric === 'fcp'
                ? aggregate.vitals.comparison.fcp_coverage
                : aggregate.vitals.comparison.ttfb_coverage)
        );
  const rawMetricCoverage = conservativeRaceCoverage;
  const metricCoverage = Math.round(Math.max(0, Math.min(100, rawMetricCoverage)));
  return {
    sample_size: aggregate.sample_size,
    period_days: aggregate.period_days,
    classified_share: classifiedShare,
    connection_reuse_share: connectionReuseShare,
    metric_coverage: metricCoverage,
    metric_coverage_label: raceMetric === 'none' ? 'lcp coverage' : `${race.metric_label} coverage`.toLowerCase()
  };
}

/**
 * Form-factor visualization for Act 1. Always emits all three form factors
 * (mobile / tablet / desktop) so the card's three-column layout rhythm
 * stays consistent across scenarios — zero-share buckets render as
 * muted "0%" placeholder columns rather than being filtered out.
 * Segments are sorted magnitude-first so the dominant reads first and
 * zero-share columns naturally land at the end.
 *
 * Returns null when the aggregate carries no form_factor_distribution
 * (legacy decoded URLs, or consumers without the GA4 DLV wired) OR when
 * every form factor is zero (degenerate / no valid rows aggregated).
 */
function buildFormFactor(aggregate: SignalAggregateV1): ReportFormFactorViewModel | null {
  const ff = aggregate.form_factor_distribution;
  if (!ff) return null;
  const segments = [
    { label: 'Mobile', share: ff.mobile },
    { label: 'Tablet', share: ff.tablet },
    { label: 'Desktop', share: ff.desktop }
  ].sort((a, b) => b.share - a.share);
  if (segments.every((segment) => segment.share === 0)) return null;
  return { segments };
}

/**
 * Format a histogram record into the "label: pct · label: pct" compact line
 * used inside signal cell values. Zero-share buckets are filtered out.
 */
function formatHistogramLine(
  entries: ReadonlyArray<{ label: string; share: number }>,
  { separator = ' · ' }: { separator?: string } = {}
): string {
  const filtered = entries.filter((entry) => entry.share > 0);
  if (filtered.length === 0) return '—';
  return filtered.map((entry) => `${entry.label} ${entry.share}%`).join(separator);
}

function filterBuckets(
  entries: ReadonlyArray<{ label: string; share: number; tone: SignalTone }>
): ReportSignalBucket[] {
  return entries.filter((entry) => entry.share > 0);
}

function dominantBucket<K extends string>(hist: Record<K, number>, fallback: K): K {
  let best: K = fallback;
  let bestVal = -1;
  for (const key of Object.keys(hist) as K[]) {
    if (hist[key] > bestVal) {
      bestVal = hist[key];
      best = key;
    }
  }
  return best;
}

/**
 * Detect histograms where every bucket is zero — `dominantBucket` would
 * otherwise return the hardcoded `fallback` key and a downstream label
 * lookup would confidently display a fabricated value (e.g. "4 cores")
 * for an audience with no measured hardware. Callers use this to skip
 * the label lookup and render a literal "—" instead.
 */
function histogramHasAnyObservations<K extends string>(hist: Record<K, number>): boolean {
  for (const key of Object.keys(hist) as K[]) {
    if (hist[key] > 0) return true;
  }
  return false;
}

const CORES_LABEL: Record<string, string> = {
  '1': '1 core',
  '2': '2 cores',
  '4': '4 cores',
  '6': '6 cores',
  '8': '8 cores',
  '12_plus': '12+ cores'
};

const MEMORY_LABEL: Record<string, string> = {
  '0_5': '0.5 GB',
  '1': '1 GB',
  '2': '2 GB',
  '4': '4 GB',
  '8_plus': '8+ GB',
  unknown: 'Unknown'
};

const EFFECTIVE_TYPE_LABEL: Record<string, string> = {
  slow_2g: 'slow-2G',
  '2g': '2G',
  '3g': '3G',
  '4g': '4G',
  unknown: 'Unknown'
};

function buildPersonaContrast(aggregate: SignalAggregateV1): ReportPersonaContrast {
  const nd = aggregate.network_distribution;
  const urbanShare = nd.urban;
  const constrainedShare = nd.constrained_moderate + nd.constrained;
  const hw = aggregate.device_hardware;
  const ns = aggregate.network_signals;
  const env = aggregate.environment;

  // Hardware / network / environment labels. Guarded by both block-presence
  // (hw / ns / env truthy) AND histogram-has-observations — otherwise
  // dominantBucket() would silently fall back to a hardcoded key and render
  // a fabricated label (e.g. "4 cores") for a cohort with no measured
  // hardware.
  const hasHardwareCoresSignal = hw != null && histogramHasAnyObservations(hw.cores_hist);
  const hasHardwareMemorySignal = hw != null && histogramHasAnyObservations(hw.memory_gb_hist);
  const hasNetworkEffectiveSignal = ns != null && histogramHasAnyObservations(ns.effective_type_hist);
  const hasEnvironmentBrowserSignal = env != null && histogramHasAnyObservations(env.browser_hist);

  const bestCores = hasHardwareCoresSignal && hw ? (CORES_LABEL[dominantBucket(hw.cores_hist, '4')] ?? '—') : '—';
  const bestMemory =
    hasHardwareMemorySignal && hw ? (MEMORY_LABEL[dominantBucket(hw.memory_gb_hist, 'unknown')] ?? '—') : '—';
  const bestEffective =
    hasNetworkEffectiveSignal && ns
      ? (EFFECTIVE_TYPE_LABEL[dominantBucket(ns.effective_type_hist, 'unknown')] ?? null)
      : null;
  const bestDownlink = ns?.downlink_mbps ? `${ns.downlink_mbps.p75} Mbps` : null;
  const bestRtt = ns?.rtt_ms ? `${ns.rtt_ms.p25} ms` : null;
  const bestBrowser = hasEnvironmentBrowserSignal && env ? dominantBucket(env.browser_hist, 'other') : null;

  const constrainedCores =
    hasHardwareCoresSignal && hw
      ? (CORES_LABEL[
          hw.cores_hist['1'] + hw.cores_hist['2'] > 0
            ? hw.cores_hist['1'] >= hw.cores_hist['2']
              ? '1'
              : '2'
            : dominantBucket(hw.cores_hist, '2')
        ] ?? '—')
      : '—';
  const constrainedMemory =
    hasHardwareMemorySignal && hw
      ? (MEMORY_LABEL[
          hw.memory_gb_hist['0_5'] + hw.memory_gb_hist['1'] + hw.memory_gb_hist['2'] > 0
            ? '2'
            : dominantBucket(hw.memory_gb_hist, 'unknown')
        ] ?? '—')
      : '—';
  const constrainedEffective =
    hasNetworkEffectiveSignal && ns
      ? (EFFECTIVE_TYPE_LABEL[
          ns.effective_type_hist['3g'] + ns.effective_type_hist['2g'] + ns.effective_type_hist.slow_2g > 0
            ? ns.effective_type_hist['3g'] > 0
              ? '3g'
              : '2g'
            : dominantBucket(ns.effective_type_hist, 'unknown')
        ] ?? null)
      : null;
  const constrainedDownlink = ns?.downlink_mbps ? `${ns.downlink_mbps.p25} Mbps` : null;
  const constrainedRtt = ns?.rtt_ms ? `${ns.rtt_ms.p75} ms` : null;

  return {
    best: {
      label: urbanShare > 0 ? 'Your best-connected' : 'No best-connected cohort',
      share: urbanShare,
      tone: 'steady',
      network_tier: TIER_LABELS.urban,
      network_criteria: '< 50 ms TCP',
      effective_type: bestEffective !== 'Unknown' ? bestEffective : null,
      downlink_label: bestDownlink,
      rtt_label: bestRtt,
      cores_label: bestCores,
      memory_label: bestMemory,
      browser: bestBrowser ? bestBrowser.charAt(0).toUpperCase() + bestBrowser.slice(1) : null,
      save_data: false,
      is_empty: urbanShare === 0,
      empty_message:
        'No sessions in this window met the urban tier threshold (< 50 ms TCP). Every measured session lives outside the best-connected band.'
    },
    constrained: {
      label: constrainedShare > 0 ? 'Your most constrained' : 'No constrained cohort',
      share: constrainedShare,
      tone: 'alert',
      network_tier:
        constrainedShare > 0
          ? nd.constrained >= nd.constrained_moderate
            ? TIER_LABELS.constrained
            : TIER_LABELS.constrained_moderate
          : TIER_LABELS.constrained,
      network_criteria: nd.constrained >= nd.constrained_moderate ? '≥ 400 ms TCP' : '150–400 ms TCP',
      effective_type: constrainedEffective !== 'Unknown' ? constrainedEffective : null,
      downlink_label: constrainedDownlink,
      rtt_label: constrainedRtt,
      cores_label: constrainedCores,
      memory_label: constrainedMemory,
      browser: bestBrowser ? bestBrowser.charAt(0).toUpperCase() + bestBrowser.slice(1) : null,
      save_data: (ns?.save_data_share ?? 0) > 0,
      is_empty: constrainedShare === 0,
      empty_message:
        'No sessions in this window fell into the constrained tiers (> 150 ms TCP). The full audience lives in better-connected bands.'
    }
  };
}

function buildActionableSignals(aggregate: SignalAggregateV1): ReportActionableSignalsViewModel {
  const cells: ReportSignalCell[] = [];
  const formFactor = aggregate.form_factor_distribution;
  const hardware = aggregate.device_hardware;
  const network = aggregate.network_signals;
  const environment = aggregate.environment;

  // Form-factor cell leads the Actionable Signals section when present —
  // it is the single most buyer-legible signal in the section for paid-media
  // / CRO / SEO operators, mapping directly to Google's mobile-page-experience
  // scoring. Buckets are sorted magnitude-first so the dominant form factor
  // reads first regardless of what the real distribution looks like.
  if (formFactor) {
    const formFactorBuckets = filterBuckets(
      [
        { label: 'Mobile', share: formFactor.mobile, tone: 'neutral' as SignalTone },
        { label: 'Tablet', share: formFactor.tablet, tone: 'neutral' as SignalTone },
        { label: 'Desktop', share: formFactor.desktop, tone: 'neutral' as SignalTone }
      ].sort((a, b) => b.share - a.share)
    );
    cells.push({
      key: 'form-factor',
      label: 'Form factor',
      value: formatHistogramLine(formFactorBuckets),
      decision:
        "Informs Google's mobile-page-experience and mobile-usability scoring. A mobile-heavy share with a weak mobile-tier experience is where paid-media ROI typically leaks.",
      coverage_caveat: null,
      buckets: formFactorBuckets
    });
  }

  if (hardware) {
    const cores = hardware.cores_hist;
    const coresBuckets = filterBuckets([
      { label: '≤2', share: cores['1'] + cores['2'], tone: 'alert' },
      { label: '4', share: cores['4'], tone: 'watch' },
      { label: '6', share: cores['6'], tone: 'neutral' },
      { label: '8', share: cores['8'], tone: 'steady' },
      { label: '12+', share: cores['12_plus'], tone: 'steady' }
    ]);
    cells.push({
      key: 'js-budget',
      label: 'CPU cores',
      value: formatHistogramLine(coresBuckets),
      decision: 'These signals suggest your current page assumptions may not hold for lower-capability devices.',
      coverage_caveat: null,
      buckets: coresBuckets
    });

    const memory = hardware.memory_gb_hist;
    const memoryCoverageCaveat =
      hardware.memory_coverage < 100 ? `Chromium · ${hardware.memory_coverage}% coverage` : null;
    const memoryBuckets = filterBuckets([
      { label: '≤2 GB', share: memory['0_5'] + memory['1'] + memory['2'], tone: 'alert' },
      { label: '4 GB', share: memory['4'], tone: 'watch' },
      { label: '8+ GB', share: memory['8_plus'], tone: 'steady' },
      { label: 'Unknown', share: memory.unknown, tone: 'neutral' }
    ]);
    cells.push({
      key: 'memory-budget',
      label: 'Memory',
      value: formatHistogramLine(memoryBuckets),
      decision: 'Memory constraints at this share may increase the risk of tab eviction and out-of-memory pressure.',
      coverage_caveat: memoryCoverageCaveat,
      buckets: memoryBuckets
    });
  }

  if (network) {
    const effectiveCoverageCaveat =
      network.effective_type_coverage < 100 ? `Chromium · ${network.effective_type_coverage}% coverage` : null;
    const effectiveBuckets = filterBuckets([
      { label: '4G', share: network.effective_type_hist['4g'], tone: 'steady' },
      { label: '3G', share: network.effective_type_hist['3g'], tone: 'watch' },
      { label: '2G', share: network.effective_type_hist['2g'], tone: 'alert' },
      { label: 'slow-2G', share: network.effective_type_hist.slow_2g, tone: 'alert' },
      { label: 'Unknown', share: network.effective_type_hist.unknown, tone: 'neutral' }
    ]);
    cells.push({
      key: 'adaptive-loading',
      label: 'Effective type',
      value: formatHistogramLine(effectiveBuckets),
      decision: 'A meaningful share of sessions arrive on constrained connection types where heavy assets weigh more.',
      coverage_caveat: effectiveCoverageCaveat,
      buckets: effectiveBuckets
    });

    if (network.downlink_mbps) {
      const dl = network.downlink_mbps;
      cells.push({
        key: 'page-weight-budget',
        label: 'Downlink (Mbps)',
        value: `${dl.p25} / ${dl.p50} / ${dl.p75} Mbps`,
        decision: 'Downlink distribution shows where page-weight assumptions start to break down.',
        coverage_caveat: effectiveCoverageCaveat,
        buckets: [
          { label: `p25 · ${dl.p25}`, share: 33, tone: 'alert' as SignalTone },
          { label: `p50 · ${dl.p50}`, share: 34, tone: 'watch' as SignalTone },
          { label: `p75 · ${dl.p75}`, share: 33, tone: 'steady' as SignalTone }
        ]
      });
    }

    if (network.rtt_ms) {
      const rtt = network.rtt_ms;
      cells.push({
        key: 'request-consolidation',
        label: 'RTT (ms)',
        value: `${rtt.p25} / ${rtt.p50} / ${rtt.p75} ms`,
        decision: 'Round-trip latency at the slow end indicates where request overhead compounds.',
        coverage_caveat: effectiveCoverageCaveat,
        buckets: [
          { label: `p25 · ${rtt.p25}`, share: 33, tone: 'steady' as SignalTone },
          { label: `p50 · ${rtt.p50}`, share: 34, tone: 'watch' as SignalTone },
          { label: `p75 · ${rtt.p75}`, share: 33, tone: 'alert' as SignalTone }
        ]
      });
    }

    if (network.save_data_share > 0) {
      const saveDataBuckets = filterBuckets([
        { label: 'Save-Data on', share: network.save_data_share, tone: 'watch' },
        { label: 'Off', share: 100 - network.save_data_share, tone: 'neutral' }
      ]);
      cells.push({
        key: 'save-data',
        label: 'Save-Data',
        value: `${network.save_data_share}% of sessions`,
        decision: 'A measurable share of sessions explicitly signals a preference for lighter delivery.',
        coverage_caveat: null,
        buckets: saveDataBuckets
      });
    }
  }

  if (environment) {
    const browsers = environment.browser_hist;
    const browserBuckets = filterBuckets([
      { label: 'Chrome', share: browsers.chrome, tone: 'steady' },
      { label: 'Safari', share: browsers.safari, tone: 'neutral' },
      { label: 'Firefox', share: browsers.firefox, tone: 'neutral' },
      { label: 'Edge', share: browsers.edge, tone: 'neutral' },
      { label: 'Other', share: browsers.other, tone: 'neutral' }
    ]);
    cells.push({
      key: 'testing-matrix',
      label: 'Browser',
      value: formatHistogramLine(browserBuckets),
      decision: 'Browser distribution shows where cross-platform assumptions may diverge from real audience.',
      coverage_caveat: null,
      buckets: browserBuckets
    });
  }

  return { cells };
}

export function buildReportViewModel(aggregate: SignalAggregateV1): ReportViewModel {
  const race = buildRaceViewModel(aggregate);
  const preliminaryAct3 = buildAct3ViewModel(aggregate, 'sober');
  const mood = selectMoodTier(race, preliminaryAct3);
  const act3 = buildAct3ViewModel(aggregate, mood);
  const heroCopy = buildHeroCopy(aggregate, mood);

  return {
    domain: aggregate.domain,
    sample_size: aggregate.sample_size,
    period_days: aggregate.period_days,
    generated_at: aggregate.generated_at,
    freshness_known: !aggregate.warnings.includes(SIGNAL_FRESHNESS_UNKNOWN_WARNING),
    warnings: aggregate.warnings,
    mode: aggregate.mode,
    mood_tier: mood,
    mood_label:
      mood === 'urgent'
        ? 'Urgent measured gap'
        : mood === 'affirming'
          ? 'Affirming measured control'
          : 'Sober measured signal',
    hero_kicker: heroCopy.hero_kicker,
    hero_title: heroCopy.hero_title,
    hero_lede: heroCopy.hero_lede,
    boundary_statement: BOUNDARY_STATEMENT,
    evidence_items: buildEvidenceItems(aggregate, race, act3, mood),
    credibility_strip: buildCredibilityStrip(aggregate, race),
    form_factor: buildFormFactor(aggregate),
    act1_intro: heroCopy.act1_intro,
    act1_tiers: buildAct1Tiers(aggregate),
    act1_device_tiers: buildAct1DeviceTiers(aggregate),
    persona_contrast: buildPersonaContrast(aggregate),
    actionable_signals: buildActionableSignals(aggregate),
    race,
    act3,
    act4_lede: heroCopy.act4_lede,
    act4_summary_points: buildAct4SummaryPoints(aggregate, race, act3),
    offer_cards: buildOfferCards()
  };
}
