import type {
  SignalAggregateV1,
  SignalContextStory,
  SignalEffectiveTypeDominant,
  SignalExperienceStage,
  SignalInpPhase,
  SignalInpStory,
  SignalLcpCulpritKind,
  SignalLcpStory,
  SignalLcpSubpart,
  SignalLoafCause,
  SignalLoafStory,
  SignalNetworkTier,
  SignalRaceFallbackReason,
  SignalRaceMetric,
  SignalThirdPartyStory,
  SignalThirdPartyTier
} from '@stroma-labs/signal-contracts';
import {
  DEFAULT_NETWORK_THRESHOLDS,
  formatDeviceSignature,
  SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT,
  SIGNAL_FRESHNESS_UNKNOWN_WARNING,
  SIGNAL_FUNNEL_FCP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_INP_POOR_THRESHOLD,
  SIGNAL_FUNNEL_LCP_POOR_THRESHOLD,
  SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT
} from '@stroma-labs/signal-contracts';

import { networkBandForOperator } from './view-model/audience-language.js';
import { buildAct4ImpactRows } from './view-model/builders/act4-impact.js';
import { bandWaitDelta, buildEditorialCopy, type ReportEditorialCopy } from './view-model/builders/editorial-copy.js';
import {
  bandwidthNote,
  coresNote,
  effectiveTypeNote,
  memoryNote,
  rttNote
} from './view-model/builders/persona-paid-media-notes.js';

export type {
  ReportClosingModal,
  ReportClosingModalChoice,
  ReportClosingPill,
  ReportEditorialCopy
} from './view-model/builders/editorial-copy.js';

// Dominance share threshold below which the LCP / INP story narratives
// fall back to hedged copy instead of claiming a single dominant cause.
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

// LCP subpart row rendered in the Act 2 "Where the gap lives" anatomy
// band. `is_dominant` flags the row that owns the dominant share so the
// renderer can tint its segment without recomputing argmax. `plain` is a
// short verb phrase aimed at the non-technical CMO/Growth reader — pairs
// with the technical `label` so the legend says both what the subpart
// measures and what it physically represents in the paint pipeline.
export interface ReportLcpSubpartRow {
  key: SignalLcpSubpart;
  label: string;
  plain: string;
  share: number;
  is_dominant: boolean;
}

// Act 2 LCP story — data for the "Where the gap lives" anatomy band.
// `narrative` carries only the mechanism sentence (subpart clause);
// `culprit_clause` is separated so the band can render it as a distinct,
// muted trailing line rather than as an appended second sentence.
// `is_hedged` is true when no single subpart carries enough share for a
// confident claim — when hedged, the narrative becomes the honest
// "spread across multiple phases" line and the band omits both the
// accent-coloured dominant segment and the culprit clause.
export interface ReportLcpStoryViewModel {
  narrative: string;
  culprit_clause: string | null;
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

// Act 3 LoAF story — second-layer interaction diagnosis attached to the
// INP funnel node when the aggregate carries a LoAF block. Chromium 123+
// only; Safari / Firefox / older Chromium cohorts cleanly omit the line.
// Runs against the same hedged-dominance gate as INP so we never narrate
// a single-cause claim the data can't back.
export interface ReportLoafStoryViewModel {
  narrative: string;
  is_hedged: boolean;
  dominant_cause: SignalLoafCause | null;
  worst_frame_ms_p75: number | null;
}

// Act 1 context lines — editorial narration of already-captured
// audience signals (save-data, median RTT, cellular share, dominant
// effective_type). Each field renders as its own inline strip row and
// every row carries a `tooltip` string translating the technical
// number into the "what it means for you" read for non-technical
// buyers. Any row can be null independently — the strip surfaces only
// the ones that crossed their narration threshold, and the whole block
// hides when nothing meaningful survived.
export interface ReportContextStripRow {
  key: 'save_data' | 'median_rtt' | 'cellular' | 'effective_type';
  label: string;
  narrative: string;
  tooltip: string;
}

export interface ReportContextStripViewModel {
  rows: ReportContextStripRow[];
}

// Act 2 third-party pre-race headline — sits *above* the race gauge as a
// pre-framing line. Names the external cause ("off-domain script weight
// before first paint") that the race subsequently quantifies. 0% is
// narrated positively ("served entirely from your own origins") — absence
// of third-party is a feature, not missing data.
export interface ReportThirdPartyStoryViewModel {
  narrative: string;
  dominant_tier: SignalThirdPartyTier;
  median_share_pct: number | null;
  median_origin_count: number | null;
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
  third_party_story: ReportThirdPartyStoryViewModel | null;
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
  loaf_story: ReportLoafStoryViewModel | null;
}

export interface ReportCredibilityStripViewModel {
  sample_size: number;
  period_days: number;
  classified_share: number;
  connection_reuse_share: number;
  metric_coverage: number;
  metric_coverage_label: string;
  // Count of background-tab loads dropped before accumulation.
  // Null when the aggregate pre-dates the visibility filter or no
  // sessions were excluded — the markup hides the segment in both cases
  // so silence stays the correct signal.
  excluded_background_sessions: number | null;
  // True when the LCP race cohort lands within the slack threshold of
  // the ship gates. The credibility strip appends a tone-tempered
  // note, and view-model copy swaps to lighter phrasing for Act 3.
  coverage_marginal: boolean;
}

// Form-factor visualization — mobile / tablet / desktop audience split,
// surfaced inside Act 1 below the persona grid. Null when
// form_factor_distribution is absent on the aggregate. Segments are
// magnitude-first sorted (dominant form factor reads first) and
// zero-share buckets filtered.
export interface ReportFormFactorViewModel {
  segments: Array<{ label: string; share: number }>;
}

export interface ReportPersonaProfile {
  label: string;
  share: number;
  tone: 'steady' | 'alert';
  network_tier: string;
  network_criteria: string;
  effective_type: string | null;
  effective_type_note: string | null;
  downlink_label: string | null;
  downlink_note: string | null;
  rtt_label: string | null;
  rtt_note: string | null;
  cores_label: string;
  cores_note: string | null;
  memory_label: string;
  memory_note: string | null;
  browser: string | null;
  save_data: boolean;
  // Share of sessions in this persona's tier that browse with Data Saver
  // enabled. Surfaced for the redesigned persona card so the renderer
  // can claim "X% of this cohort is on save-data" instead of a binary
  // flag. Sourced from `network_summary.save_data_share`.
  save_data_share: number;
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
  /** Sample-confidence band sourced from `aggregate.band` (deterministic
   *  function of sample_size; see deriveSampleBand in
   *  signal-contracts/aggregation.ts). Drives the cover's preliminary-
   *  read banner — 'preliminary'/'provisional' surfaces a banner;
   *  'stable' suppresses it. */
  band: SignalAggregateV1['band'];
  mood_tier: ReportMoodTier;
  mood_label: string;
  hero_kicker: string;
  hero_title: string;
  hero_lede: string;
  boundary_statement: string;
  credibility_strip: ReportCredibilityStripViewModel;
  form_factor: ReportFormFactorViewModel | null;
  act1_tiers: ReportTierVisual[];
  act1_device_tiers: ReportDeviceTierVisual[];
  persona_contrast: ReportPersonaContrast;
  // Null when the aggregate carried no context_story or none of the
  // rows crossed their narration threshold — renderer hides the strip.
  act1_context_strip: ReportContextStripViewModel | null;
  race: ReportRaceViewModel;
  act3: ReportAct3ViewModel;
  act4_summary_points: string[];
  // Evidence ledger — Act 4 translation of the proven technical findings
  // into a "what it says / why it matters" pair per row. Each row is
  // emitted only when the underlying aggregate evidence is present. When
  // fewer than 2 rows qualify the renderer falls back to the flat
  // `act4_summary_points` bullets so we never ship an anaemic 1-row ledger.
  // The boundary disclosure ("does not measure revenue / CPA / campaign
  // impact") lives ONCE in the section-lede above the rows
  // (vm.editorial.business_section_boundary_lede); row-level copy never
  // re-apologises — proceeds with confident observation about what the
  // data IS showing.
  act4_impact_rows: ReportAct4ImpactRow[];
  // Editorial copy registry — per-section headlines, ledes, and framing
  // strings keyed on (mood × data shape). Renderers consume these
  // verbatim so the artifact never asserts a story the data does not
  // support. See `view-model/builders/editorial-copy.ts`.
  editorial: ReportEditorialCopy;
}

export type ReportAct4ImpactRowId = 'lcp_bounce' | 'inp_conversion' | 'script_roas' | 'network_reach';

export type ReportAct4ImpactTone = 'alert' | 'watch' | 'steady';

export interface ReportAct4ImpactRow {
  id: ReportAct4ImpactRowId;
  metric_value: string;
  metric_label: string;
  /** Descriptive restatement of the measured fact — observation only,
   *  never inference. Renders under a "WHAT IT SAYS" eyebrow. */
  what_it_says: string;
  /** Directional implication of the measured fact, mechanistically
   *  tied to user behaviour. NEVER asserts a commercial figure or
   *  uses self-deprecating hedges ("the report doesn't see X").
   *  Tone-aware (varies across alert / watch / steady). Renders
   *  under a "WHY IT MATTERS" eyebrow. */
  why_it_matters: string;
  tone: ReportAct4ImpactTone;
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

// Splits a pre-formatted measurement (e.g. "4.2s", "2100ms", "45%", "3K")
// into its numeric body and trailing unit characters. "n/a" / "—" / empty
// return no unit. Used by the legacy splitValueUnit helper kept for
// downstream callers; the new render-helpers.renderHeroValue performs the
// same split inline.
const VALUE_UNIT_SPLITTER = /^(-?\d+(?:[.,]\d+)?)(ms|s|%|K|M|B)$/;
export function splitValueUnit(text: string): { value: string; unit: string } {
  const match = VALUE_UNIT_SPLITTER.exec(text.trim());
  if (!match) return { value: text, unit: '' };
  const [, value, unit] = match;
  return { value: value ?? text, unit: unit ?? '' };
}

export function selectMotionMode(prefersReducedMotion: boolean): ReportMotionMode {
  return prefersReducedMotion ? 'reduced' : 'full';
}

function asDurationLabel(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
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
// Narrative-tone descriptions of the canonical device signatures. The
// tier boundaries themselves come from `formatDeviceSignature()` —
// `signatureFor()` rewrites them into Act 1's editorial voice without
// hand-curating new cutoff numbers.
function signatureFor(key: ReportDeviceTierKey): string {
  // Examples (with default boundaries):
  //   high → "6+ cores · 4+ GB · 1280px+"
  //   mid  → "4–6 cores · 2–4 GB · 768px+"
  //   low  → "≤2 cores · ≤1 GB · <768px"
  // Re-shape into prose by replacing the compact glyphs with editorial
  // wording while keeping every number the helper produced.
  return formatDeviceSignature(key)
    .replace('cores', 'CPU cores')
    .replace(' · ', ', ')
    .replace(' · ', ', ')
    .replace(/(\d+px\+)/, '$1 screens')
    .replace(/<(\d+px)/, '<$1 screens')
    .replace(/(\d+\+ GB|≤\d+ GB|\d+–\d+ GB)/, '$1 RAM where measurable');
}

function buildDeviceNarrative(key: ReportDeviceTierKey, share: number): string {
  if (share === 0) {
    return 'No sessions in this device class were observed in this sample.';
  }
  const signature = signatureFor(key);
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

// Short technical labels for the LCP subpart legend. Kept terse so a
// four-column legend fits a single row of the anatomy band without
// wrapping at 1440px.
const LCP_SUBPART_SHORT_LABELS: Record<SignalLcpSubpart, string> = {
  ttfb: 'TTFB',
  resource_load_delay: 'Load delay',
  resource_load_time: 'Load time',
  element_render_delay: 'Render delay'
};

// Plain-language verb phrases paired with each subpart label in the
// anatomy-band legend. Target reader is the non-technical CMO / Growth
// Head who recognises "TTFB" as jargon but instinctively maps
// "server replies" to something they can brief their engineering lead
// on. Each phrase names what physically happens in the paint pipeline;
// no metrics, no thresholds, no prescriptions.
const LCP_SUBPART_PLAIN_DESCRIPTORS: Record<SignalLcpSubpart, string> = {
  ttfb: 'server replies',
  resource_load_delay: 'finding the hero',
  resource_load_time: 'downloading the hero',
  element_render_delay: 'painting the hero'
};

// Narrative copy per dominant subpart. of the enrichment
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

const LOAF_CAUSE_NARRATIVES: Record<SignalLoafCause, string> = {
  script: 'The slowest frame is dominated by script execution.',
  layout: 'Layout work, not script, is what stalls the slowest frame.',
  style: 'Style recalculation is what stalls the slowest frame.',
  paint: 'Paint work stalls the slowest frame.'
};

const LCP_HEDGED_NARRATIVE = 'Paint delay is spread across multiple phases — no single cause dominates.';
const INP_HEDGED_NARRATIVE = 'Interaction lag is spread across multiple phases — no single cause dominates.';
const LOAF_HEDGED_NARRATIVE = 'The slowest frame is spread across multiple causes — no single driver dominates.';

// Third-party pre-race headlines. `none` is narrated *positively* —
// absence of third-party weight is a feature of the page, not missing
// data. `heavy` / `moderate` / `light` read as honest observations of an
// external cause the race subsequently quantifies.
const THIRD_PARTY_TIER_NARRATIVES: Record<SignalThirdPartyTier, (sharePct: number | null) => string> = {
  heavy: (share) =>
    share != null
      ? `${share}% of the pre-paint script weight comes from off-domain tags.`
      : 'Off-domain scripts dominate the pre-paint window.',
  moderate: (share) =>
    share != null
      ? `${share}% of the pre-paint script weight is third-party.`
      : 'Third-party scripts carry meaningful weight before first paint.',
  light: () => 'Third-party script weight is modest before first paint.',
  none: () => 'The pre-paint is served entirely from your own origins.'
};

// Act 1 context strip tooltips — paired with each narrated row. The
// narrative line names the number; the tooltip translates the number
// into the "what this means for you" read that non-technical buyers
// (CRO / paid media / SEO / product) can act on. Kept intentionally
// short so they fit inside the slide's 100vh envelope without wrapping.
const CONTEXT_TOOLTIPS = {
  save_data:
    'These users have told their browser to minimise data use. Heavy pages, autoplay video, and preloaded assets will feel punishing to them — test the experience you ship with Save-Data on.',
  median_rtt:
    'Round-trip time is how long one request takes to reach your server and back. Every request the page needs compounds this delay, so a high median explains sluggish perceived loading even on fast links.',
  cellular:
    'A meaningful share of this audience is on a mobile network. Mobile links lose bandwidth and gain latency under load, so mobile-heavy cohorts amplify any page weight or redirect cost.',
  effective_type:
    "Effective connection type is the browser's own read of perceived network speed. When the dominant bucket drops below 4G, expect visible lag on hero media, fonts, and anything that blocks first paint."
} satisfies Record<ReportContextStripRow['key'], string>;

// Effective-type narration. Only 3g / 2g / slow-2g trigger a line —
// a 4g-dominant cohort reads as unremarkable baseline and renders as
// silence. Unknown-dominant cohorts (Safari / Firefox without the
// NetworkInformation API) likewise omit — we do not narrate absence of
// data as absence of quality.
const EFFECTIVE_TYPE_NARRATIVES: Partial<Record<SignalEffectiveTypeDominant, string>> = {
  '3g': 'The dominant connection reported by this audience is 3G.',
  '2g': 'The dominant connection reported by this audience is 2G.',
  'slow-2g': 'The dominant connection reported by this audience is slow-2G.'
};

// Builds the Act 1 context strip. Each field applies its own gate:
//  - save_data: SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT (sub-1% is
//    rounding noise, not audience reality).
//  - median_rtt: only narrate when the aggregate has a non-null median
//    (quartiles() returns null below QUARTILE_MIN_SAMPLE).
//  - cellular: SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT (below 10% is
//    not surprising enough to frame editorially).
//  - effective_type: only 3g / 2g / slow-2g dominant cohorts trigger
//    the micro-fact; 4g / unknown fall through.
// When no rows survive the gates, returns null so the renderer hides
// the whole block.
function buildContextStripViewModel(story: SignalContextStory | undefined): ReportContextStripViewModel | null {
  if (!story) return null;

  const rows: ReportContextStripRow[] = [];

  if (story.save_data_share_pct != null && story.save_data_share_pct >= SIGNAL_SAVE_DATA_NARRATE_THRESHOLD_PCT) {
    rows.push({
      key: 'save_data',
      label: 'Save-Data',
      narrative: `${story.save_data_share_pct}% of this audience browses with Data Saver on.`,
      tooltip: CONTEXT_TOOLTIPS.save_data
    });
  }

  if (story.median_rtt_ms != null) {
    rows.push({
      key: 'median_rtt',
      label: 'Median RTT',
      narrative: `Median round-trip time is ${story.median_rtt_ms} milliseconds.`,
      tooltip: CONTEXT_TOOLTIPS.median_rtt
    });
  }

  if (story.cellular_share_pct != null && story.cellular_share_pct >= SIGNAL_CELLULAR_NARRATE_THRESHOLD_PCT) {
    rows.push({
      key: 'cellular',
      label: 'Cellular share',
      narrative: `${story.cellular_share_pct}% of measured sessions are on cellular networks.`,
      tooltip: CONTEXT_TOOLTIPS.cellular
    });
  }

  if (story.effective_type_dominant && EFFECTIVE_TYPE_NARRATIVES[story.effective_type_dominant]) {
    rows.push({
      key: 'effective_type',
      label: 'Connection class',
      narrative: EFFECTIVE_TYPE_NARRATIVES[story.effective_type_dominant] as string,
      tooltip: CONTEXT_TOOLTIPS.effective_type
    });
  }

  if (rows.length === 0) return null;
  return { rows };
}

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

  // Narrative + culprit are carried as separate fields so the anatomy
  // band can render the mechanism sentence as the lede and the culprit
  // (e.g. "Usually a hero image.") as a muted trailing line, rather than
  // running them together as a single compound sentence. When hedged,
  // the fixed "spread across multiple phases" line owns the whole lede
  // and the culprit is dropped entirely — we don't narrate a single
  // cause we can't back.
  const narrative = isHedged || !dominantSubpart ? LCP_HEDGED_NARRATIVE : LCP_SUBPART_NARRATIVES[dominantSubpart];
  const culpritClause = culprit ? LCP_CULPRIT_CLAUSES[culprit] : null;

  const rows: ReportLcpSubpartRow[] = (
    ['ttfb', 'resource_load_delay', 'resource_load_time', 'element_render_delay'] as const
  ).map((key) => ({
    key,
    label: LCP_SUBPART_SHORT_LABELS[key],
    plain: LCP_SUBPART_PLAIN_DESCRIPTORS[key],
    share: distribution[key],
    is_dominant: dominantSubpart === key
  }));

  return {
    narrative,
    culprit_clause: culpritClause,
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

function buildLoafStoryViewModel(story: SignalLoafStory | undefined): ReportLoafStoryViewModel | null {
  if (!story) return null;

  const isHedged =
    story.dominant_cause == null ||
    story.dominant_cause_share_pct == null ||
    story.dominant_cause_share_pct < SIGNAL_STORY_HEDGED_THRESHOLD_PCT;

  const dominantCause = isHedged ? null : story.dominant_cause;
  const narrative = isHedged || !dominantCause ? LOAF_HEDGED_NARRATIVE : LOAF_CAUSE_NARRATIVES[dominantCause];

  return {
    narrative,
    is_hedged: isHedged,
    dominant_cause: dominantCause,
    worst_frame_ms_p75: story.worst_frame_ms_p75
  };
}

function buildThirdPartyStoryViewModel(
  story: SignalThirdPartyStory | undefined
): ReportThirdPartyStoryViewModel | null {
  if (!story) return null;
  const tier = story.dominant_tier;
  if (!tier) return null;

  const share = story.median_share_pct;
  const originCount = story.median_origin_count;
  const narrative = THIRD_PARTY_TIER_NARRATIVES[tier](share);

  return {
    narrative,
    dominant_tier: tier,
    median_share_pct: share,
    median_origin_count: originCount
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
    lcp_story: buildLcpStoryViewModel(aggregate.lcp_story),
    third_party_story: buildThirdPartyStoryViewModel(aggregate.third_party_story)
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
      ? 'A meaningful share of measured classified sessions crosses poor-performance thresholds at first paint, at main content, and at interaction-ready.'
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
  // inline line.
  const inpStage = funnel?.active_stages.includes('inp') ? aggregate.inp_story : undefined;
  const inpStory = buildInpStoryViewModel(inpStage);
  // LoAF story sits alongside the INP phase line when both are present.
  // Gated on the INP funnel stage for the same reason as the INP story —
  // a LoAF diagnosis without a defensible interaction-ready funnel stage
  // would narrate frame-level jank the funnel itself can't anchor.
  const loafSource = funnel?.active_stages.includes('inp') ? aggregate.loaf_story : undefined;
  const loafStory = buildLoafStoryViewModel(loafSource);

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
      inp_story: null,
      loaf_story: null
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
      inp_story: null,
      loaf_story: null
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
    inp_story: inpStory,
    loaf_story: loafStory
  };
}

// Editorial framings keyed off a measured `mood_tier` (itself derived
// from real aggregate shares via `selectMoodTier`). The strings below
// are author-written prose, not fabricated metrics — every number the
// reader sees is rendered from view-model fields elsewhere. These
// strings only provide the connective tissue between them, conditioned
// on a three-way mood bucket the data has already chosen.
function buildHeroCopy(
  aggregate: SignalAggregateV1,
  mood: ReportMoodTier
): Pick<ReportViewModel, 'hero_kicker' | 'hero_title' | 'hero_lede'> {
  const title = aggregate.domain;

  if (mood === 'urgent') {
    return {
      hero_kicker: 'Measured proof from real traffic',
      hero_title: title,
      hero_lede:
        'A real share of the traffic you send here lands in a slower world. This report turns that hidden post-click reality into something visible, temporal, and difficult to dismiss.'
    };
  }

  if (mood === 'affirming') {
    return {
      hero_kicker: 'Measured proof from real traffic',
      hero_title: title,
      hero_lede:
        'The measured story is more controlled here. Traffic still lands into different conditions across tiers, but most sessions stay on the safer side of the thresholds that matter.'
    };
  }

  return {
    hero_kicker: 'Measured proof from real traffic',
    hero_title: title,
    hero_lede:
      'The post-click reality is real, but it sits in the middle ground: meaningful enough to feel, not yet severe enough to scream. That still deserves attention.'
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
  const excludedBackgroundSessions =
    typeof coverage.excluded_background_sessions === 'number' && coverage.excluded_background_sessions > 0
      ? coverage.excluded_background_sessions
      : null;
  const coverageMarginal = aggregate.warnings.includes('coverage_marginal');
  return {
    sample_size: aggregate.sample_size,
    period_days: aggregate.period_days,
    classified_share: classifiedShare,
    connection_reuse_share: connectionReuseShare,
    metric_coverage: metricCoverage,
    metric_coverage_label: raceMetric === 'none' ? 'lcp coverage' : `${race.metric_label} coverage`.toLowerCase(),
    excluded_background_sessions: excludedBackgroundSessions,
    coverage_marginal: coverageMarginal
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

  const bestCoresKey = hasHardwareCoresSignal && hw ? dominantBucket(hw.cores_hist, '4') : null;
  const bestCores = bestCoresKey ? (CORES_LABEL[bestCoresKey] ?? '—') : '—';
  const bestMemoryKey = hasHardwareMemorySignal && hw ? dominantBucket(hw.memory_gb_hist, 'unknown') : null;
  const bestMemory = bestMemoryKey ? (MEMORY_LABEL[bestMemoryKey] ?? '—') : '—';
  const bestEffectiveKey = hasNetworkEffectiveSignal && ns ? dominantBucket(ns.effective_type_hist, 'unknown') : null;
  const bestEffective = bestEffectiveKey ? (EFFECTIVE_TYPE_LABEL[bestEffectiveKey] ?? null) : null;
  const bestDownlinkMbps = ns?.downlink_mbps ? ns.downlink_mbps.p75 : null;
  const bestDownlink = bestDownlinkMbps != null ? `${bestDownlinkMbps} Mbps` : null;
  const bestRttMs = ns?.rtt_ms ? ns.rtt_ms.p25 : null;
  const bestRtt = bestRttMs != null ? `${bestRttMs} ms` : null;
  const bestBrowser = hasEnvironmentBrowserSignal && env ? dominantBucket(env.browser_hist, 'other') : null;

  const constrainedCoresKey =
    hasHardwareCoresSignal && hw
      ? hw.cores_hist['1'] + hw.cores_hist['2'] > 0
        ? hw.cores_hist['1'] >= hw.cores_hist['2']
          ? '1'
          : '2'
        : dominantBucket(hw.cores_hist, '2')
      : null;
  const constrainedCores = constrainedCoresKey ? (CORES_LABEL[constrainedCoresKey] ?? '—') : '—';
  const constrainedMemoryKey =
    hasHardwareMemorySignal && hw
      ? hw.memory_gb_hist['0_5'] + hw.memory_gb_hist['1'] + hw.memory_gb_hist['2'] > 0
        ? '2'
        : dominantBucket(hw.memory_gb_hist, 'unknown')
      : null;
  const constrainedMemory = constrainedMemoryKey ? (MEMORY_LABEL[constrainedMemoryKey] ?? '—') : '—';
  const constrainedEffectiveKey =
    hasNetworkEffectiveSignal && ns
      ? ns.effective_type_hist['3g'] + ns.effective_type_hist['2g'] + ns.effective_type_hist.slow_2g > 0
        ? ns.effective_type_hist['3g'] > 0
          ? '3g'
          : '2g'
        : dominantBucket(ns.effective_type_hist, 'unknown')
      : null;
  const constrainedEffective = constrainedEffectiveKey ? (EFFECTIVE_TYPE_LABEL[constrainedEffectiveKey] ?? null) : null;
  const constrainedDownlinkMbps = ns?.downlink_mbps ? ns.downlink_mbps.p25 : null;
  const constrainedDownlink = constrainedDownlinkMbps != null ? `${constrainedDownlinkMbps} Mbps` : null;
  const constrainedRttMs = ns?.rtt_ms ? ns.rtt_ms.p75 : null;
  const constrainedRtt = constrainedRttMs != null ? `${constrainedRttMs} ms` : null;

  return {
    best: {
      label: urbanShare > 0 ? 'Your best-connected' : 'No best-connected cohort',
      share: urbanShare,
      tone: 'steady',
      network_tier: TIER_LABELS.urban,
      network_criteria: networkBandForOperator('urban'),
      effective_type: bestEffective !== 'Unknown' ? bestEffective : null,
      effective_type_note: bestEffectiveKey ? effectiveTypeNote(bestEffectiveKey) : null,
      downlink_label: bestDownlink,
      downlink_note: bandwidthNote(bestDownlinkMbps),
      rtt_label: bestRtt,
      rtt_note: rttNote(bestRttMs),
      cores_label: bestCores,
      cores_note: bestCoresKey ? coresNote(bestCoresKey) : null,
      memory_label: bestMemory,
      memory_note: bestMemoryKey ? memoryNote(bestMemoryKey) : null,
      browser: bestBrowser ? bestBrowser.charAt(0).toUpperCase() + bestBrowser.slice(1) : null,
      save_data: false,
      save_data_share: 0,
      is_empty: urbanShare === 0,
      empty_message: `No sessions in this window landed in the best-connected tier (${networkBandForOperator('urban')}). Every measured session sits in a more constrained network band.`
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
      network_criteria:
        nd.constrained >= nd.constrained_moderate
          ? networkBandForOperator('constrained')
          : networkBandForOperator('constrained_moderate'),
      effective_type: constrainedEffective !== 'Unknown' ? constrainedEffective : null,
      effective_type_note: constrainedEffectiveKey ? effectiveTypeNote(constrainedEffectiveKey) : null,
      downlink_label: constrainedDownlink,
      downlink_note: bandwidthNote(constrainedDownlinkMbps),
      rtt_label: constrainedRtt,
      rtt_note: rttNote(constrainedRttMs),
      cores_label: constrainedCores,
      cores_note: constrainedCoresKey ? coresNote(constrainedCoresKey) : null,
      memory_label: constrainedMemory,
      memory_note: constrainedMemoryKey ? memoryNote(constrainedMemoryKey) : null,
      browser: bestBrowser ? bestBrowser.charAt(0).toUpperCase() + bestBrowser.slice(1) : null,
      save_data: (ns?.save_data_share ?? 0) > 0,
      save_data_share: ns?.save_data_share ?? 0,
      is_empty: constrainedShare === 0,
      empty_message: `No sessions in this window fell into the constrained tiers (> ${DEFAULT_NETWORK_THRESHOLDS.moderate} ms TCP). The full audience lives in better-connected bands.`
    }
  };
}

export function buildReportViewModel(aggregate: SignalAggregateV1): ReportViewModel {
  const race = buildRaceViewModel(aggregate);
  const preliminaryAct3 = buildAct3ViewModel(aggregate, 'sober');
  const mood = selectMoodTier(race, preliminaryAct3);
  const act3 = buildAct3ViewModel(aggregate, mood);
  const heroCopy = buildHeroCopy(aggregate, mood);
  const personaContrast = buildPersonaContrast(aggregate);
  const contextStrip = buildContextStripViewModel(aggregate.context_story);
  const tiers = buildAct1Tiers(aggregate);
  const deviceTiers = buildAct1DeviceTiers(aggregate);
  const impactRows = buildAct4ImpactRows(aggregate, race, act3);

  // Classified tiers (>=5% share, EXCLUDING unknown). Headline copy
  // variants pivot on this count so single-band fixtures do not assert
  // "three audiences" when only one tier is populated. The unknown tier
  // gets its own dedicated branch via `unknown_tier_dominant`.
  const classifiedTierCount = Math.min(4, tiers.filter((t) => t.key !== 'unknown' && t.share >= 5).length) as
    | 0
    | 1
    | 2
    | 3
    | 4;
  const unknownTier = tiers.find((t) => t.key === 'unknown');
  const unknownTierDominant = (unknownTier?.share ?? 0) >= 50;

  const editorial = buildEditorialCopy(
    {
      mood,
      classified_tier_count: classifiedTierCount,
      unknown_tier_dominant: unknownTierDominant,
      classified_share_pct: Math.round(aggregate.coverage.classified_share),
      race_available: race.race_available,
      race_metric: race.metric,
      wait_delta_band: bandWaitDelta(race.wait_delta_ms),
      comparison_label: race.comparison_label,
      best_persona_empty: personaContrast.best.is_empty,
      constrained_persona_empty: personaContrast.constrained.is_empty,
      context_strip_signals: contextStrip?.rows.map((r) => r.label) ?? [],
      funnel_mode: act3.mode,
      funnel_active_stage_count: act3.stages.length,
      funnel_first_stage_label: act3.stages[0]?.label ?? null,
      has_ledger: impactRows.length >= 2,
      shape_proven: race.race_available || act3.stages.length >= 2
    },
    race,
    act3,
    personaContrast,
    contextStrip
  );

  return {
    domain: aggregate.domain,
    sample_size: aggregate.sample_size,
    period_days: aggregate.period_days,
    generated_at: aggregate.generated_at,
    freshness_known: !aggregate.warnings.includes(SIGNAL_FRESHNESS_UNKNOWN_WARNING),
    warnings: aggregate.warnings,
    mode: aggregate.mode,
    band: aggregate.band,
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
    credibility_strip: buildCredibilityStrip(aggregate, race),
    form_factor: buildFormFactor(aggregate),
    act1_tiers: tiers,
    act1_device_tiers: deviceTiers,
    persona_contrast: personaContrast,
    act1_context_strip: contextStrip,
    race,
    act3,
    act4_summary_points: buildAct4SummaryPoints(aggregate, race, act3),
    act4_impact_rows: impactRows,
    editorial
  };
}
