// Editorial copy registry — picks per-section headline / lede / framing
// strings keyed on (mood × data shape). Replaces the static strings
// scattered across the section renderers so the artifact never asserts
// a story the data does not support.
//
// Discipline (per /r boundary memos):
// - Body copy stays diagnostic; headlines never prescribe.
// - When data is absent (race unavailable, funnel legacy, persona empty),
//   copy degrades honestly rather than asserting a measurement we did
//   not make.
// - Mood (urgent / sober / affirming) shifts tone within an honest frame.

import type { SignalRaceMetric, SignalReportInteractionIntentPillId } from '@stroma-labs/signal-contracts';

import type {
  ReportAct3ViewModel,
  ReportContextStripViewModel,
  ReportMoodTier,
  ReportPersonaContrast,
  ReportRaceViewModel
} from '../../report-view-model.js';

export type WaitDeltaBand = 'none' | 'contained' | 'visible' | 'severe';

export interface EditorialDataShape {
  mood: ReportMoodTier;
  /** Tiers with >=5% share, EXCLUDING the unknown tier. Drives the
   * audience headline ("three audiences" / "two audiences" / "every
   * session in same band" / "could not sort"). */
  classified_tier_count: 0 | 1 | 2 | 3 | 4;
  /** True when the unknown tier alone carries >=50% of measured sessions. */
  unknown_tier_dominant: boolean;
  classified_share_pct: number;
  race_available: boolean;
  race_metric: SignalRaceMetric;
  wait_delta_band: WaitDeltaBand;
  comparison_label: string;
  best_persona_empty: boolean;
  constrained_persona_empty: boolean;
  context_strip_signals: string[];
  funnel_mode: ReportAct3ViewModel['mode'];
  funnel_active_stage_count: number;
  funnel_first_stage_label: string | null;
  has_ledger: boolean;
  shape_proven: boolean;
}

/** One radio option in the closing modal's "What would help?" question.
 *  Each maps 1:1 to an existing intent event kind; "something_else"
 *  expands to a sub-pill multiselect inside the modal. */
export interface ReportClosingModalChoice {
  value: 'pi_early_access' | 'rapid_fix' | 'monitoring' | 'something_else';
  /** Short imperative label rendered alongside the radio. */
  label: string;
  /** 1-line explanatory body rendered as muted copy beneath the label. */
  body: string;
}

/** Editorial copy for the closing-section modal. Drives a single
 *  trigger button + a native <dialog> with progressive-disclosure form.
 *  Replaces the prior three-card + freeform-multiselect layout. */
export interface ReportClosingModal {
  trigger_label: string;
  title: string;
  lede: string;
  choice_legend: string;
  choices: ReportClosingModalChoice[];
  cadence_legend: string;
  cadence_options: { value: 'weekly' | 'monthly'; label: string }[];
  pills_legend: string;
  freeform_label: string;
  freeform_placeholder: string;
  email_label: string;
  email_placeholder: string;
  /** Helper caption shown beneath the email input. Email is optional
   *  on every path — the caption tells the user what skipping it means
   *  so they don't assume it's silently required. */
  email_caption: string;
  submit_label: string;
  confirmation_text: string;
  dismiss_label: string;
}

/** One pill in the freeform-demand sub-multiselect inside the modal
 *  (revealed when the user picks "Something else"). */
export interface ReportClosingPill {
  pill_id: SignalReportInteractionIntentPillId;
  label: string;
  /** When true, checking the pill reveals a short freeform text field
   *  (capped 200 chars). Only true for `something_else`. */
  collects_freeform_text: boolean;
}

export interface ReportEditorialCopy {
  // Cover
  cover_at_a_glance_lede: string;
  cover_headline_card_caption: string;

  // Audience
  audience_headline_html: string;
  audience_lede_html: string;
  audience_persona_section_eyebrow: string;
  audience_persona_section_lede: string;
  audience_context_strip_lede: string;

  // Distance
  distance_headline_html: string;
  distance_lede_html: string;
  distance_paid_media_eyebrow: string;
  distance_paid_media_unavailable_message: string | null;

  // Funnel
  funnel_eyebrow: string;
  funnel_headline_html: string;
  funnel_lede_html: string | null;
  funnel_headline_figure_cap: string;

  // Business
  business_headline_html: string;
  /** Act 4 lede — mood-aware. Was previously identical for urgent and
   *  sober (mood wiring decorative); now urgent / sober / affirming
   *  carry distinct register so the lede honestly previews the
   *  severity of the rows below. */
  act4_lede: string;
  business_section_eyebrow: string;
  /** Truth-boundary disclosure rendered ONCE beneath the section eyebrow,
   *  before the impact rows. Names what /r measures and what it does
   *  not (revenue, CPA movement, campaign impact). Lives here so row-
   *  level copy can proceed with confident observation without
   *  re-apologising for the artifact's scope. HTML, not plain text —
   *  may carry inline emphasis. */
  business_section_boundary_lede: string;
  /** Role-flavored question rendered between the boundary statement and
   *  the modal trigger button. Pre-segments the modal's three meaningful
   *  choices (campaign exposure / page diagnosis / measurement over
   *  time) without naming a product. HTML — may carry inline emphasis. */
  business_role_question_html: string;
  business_aside_lede_html: string;
  business_what_this_enables: string[];

  /** Boundary-statement-anchored bridge sentence rendered above the
   *  closing modal trigger. Question-led ("What would help most from
   *  here?"), not packaging-led. Single source of truth for the
   *  truth-boundary language; no near-paraphrase elsewhere. */
  business_closing_bridge_html: string;
  /** Closing-section modal copy — trigger label + dialog interior. */
  business_closing_modal: ReportClosingModal;
  /** Sub-pills revealed inside the modal when "Something else" is
   *  picked. Each carries an `intent_pill_id` for `intent_freeform`. */
  business_closing_pills: ReportClosingPill[];
}

export function bandWaitDelta(deltaMs: number | null): WaitDeltaBand {
  if (deltaMs == null) return 'none';
  if (deltaMs < 900) return 'contained';
  if (deltaMs < 2200) return 'visible';
  return 'severe';
}

export function buildEditorialCopy(
  shape: EditorialDataShape,
  race: ReportRaceViewModel,
  // act3 reserved for future per-stage / per-mode copy variants the
  // current pickers don't yet need; keep on the signature so adding
  // them later doesn't churn every call site.
  _act3: ReportAct3ViewModel,
  personaContrast: ReportPersonaContrast,
  contextStrip: ReportContextStripViewModel | null,
  dominantCulpritKind: string | null
): ReportEditorialCopy {
  return {
    cover_at_a_glance_lede: pickCoverAtAGlanceLede(shape),
    cover_headline_card_caption: pickCoverHeadlineCardCaption(shape),

    audience_headline_html: pickAudienceHeadline(shape),
    audience_lede_html: pickAudienceLede(shape),
    audience_persona_section_eyebrow: pickPersonaSectionEyebrow(personaContrast),
    audience_persona_section_lede: pickPersonaSectionLede(personaContrast),
    audience_context_strip_lede: pickContextStripLede(contextStrip),

    distance_headline_html: pickDistanceHeadline(shape, race),
    distance_lede_html: pickDistanceLede(shape, race),
    distance_paid_media_eyebrow: shape.race_available
      ? 'For paid media · what this delta costs you'
      : 'For paid media · what the gap will cost once defensible',
    distance_paid_media_unavailable_message: shape.race_available
      ? null
      : 'The race needs more comparable cohort data than this window holds. The Paid-Media impact below is the shape we expect once that coverage clears.',

    funnel_eyebrow: pickFunnelEyebrow(shape),
    funnel_headline_html: pickFunnelHeadline(shape),
    funnel_lede_html: pickFunnelLede(shape),
    funnel_headline_figure_cap: pickFunnelHeadlineFigureCap(shape),

    business_headline_html: pickBusinessHeadline(shape),
    act4_lede: pickAct4Lede(shape),
    business_section_eyebrow: 'What this evidence can tell you',
    business_section_boundary_lede:
      'This report measures post-click experience pressure. It does not measure revenue loss, CPA movement, or campaign impact. Read these signals as evidence of where performance may be distorting outcomes — not proof of commercial loss.',
    business_role_question_html:
      'The useful next question depends on your role: <em class="sr-italic-serif">campaign exposure</em>, <em class="sr-italic-serif">page diagnosis</em>, or <em class="sr-italic-serif">measurement over time</em>.',
    business_aside_lede_html: pickBusinessAsideLede(shape),
    business_what_this_enables: pickWhatThisEnables(shape, dominantCulpritKind),

    business_closing_bridge_html: pickClosingBridge(),
    business_closing_modal: pickClosingModal(shape),
    business_closing_pills: pickClosingPills()
  };
}

// ─── Cover ─────────────────────────────────────────────────────────────

function pickCoverAtAGlanceLede(shape: EditorialDataShape): string {
  if (shape.mood === 'affirming') {
    return 'Three numbers — and the gap is more contained than the headline implies.';
  }
  if (!shape.race_available && shape.classified_share_pct < 50) {
    return 'Three framing numbers. Volume and coverage matter most here — the race needs a richer sample to defend.';
  }
  if (!shape.race_available) {
    return 'Three framing numbers. The race needs more comparable cohort data than this window holds.';
  }
  return 'The three numbers that frame the entire report.';
}

function pickCoverHeadlineCardCaption(shape: EditorialDataShape): string {
  if (shape.unknown_tier_dominant || shape.classified_tier_count === 0) {
    return 'of your traffic could not be classified into a network tier. There is no urban baseline in this sample.';
  }
  if (shape.classified_share_pct < 50) {
    return 'of your traffic loads slower than your urban baseline — within the share we could classify.';
  }
  return 'of your traffic loads slower than your urban baseline.';
}

// ─── Audience ──────────────────────────────────────────────────────────

function pickAudienceHeadline(shape: EditorialDataShape): string {
  if (shape.unknown_tier_dominant && shape.classified_tier_count === 0) {
    return `<h2 class="section-title">We couldn't sort this audience into network tiers — but the <span class="brand-text">device and connection signals</span> still show meaningful spread.</h2>`;
  }
  if (shape.classified_tier_count === 0) {
    return `<h2 class="section-title">We couldn't sort this audience into network tiers — but the <span class="brand-text">device and connection signals</span> still show meaningful spread.</h2>`;
  }
  if (shape.classified_tier_count === 1) {
    return `<h2 class="section-title">Every session here lives in the same network band — but the <span class="brand-text">device and connection signals</span> still tell different stories.</h2>`;
  }
  if (shape.classified_tier_count === 2) {
    return `<h2 class="section-title">Your traffic isn't one user. It's <span class="brand-text">two distinct audiences</span> experiencing the same campaign differently.</h2>`;
  }
  if (shape.classified_tier_count === 3) {
    return `<h2 class="section-title">Your traffic isn't one user. It's <span class="brand-text">three different audiences</span> sharing the same campaign.</h2>`;
  }
  return `<h2 class="section-title">Your traffic isn't one user. It's <span class="brand-text">four different audiences</span> sharing the same campaign.</h2>`;
}

function pickAudienceLede(shape: EditorialDataShape): string {
  if (shape.classified_tier_count === 0) {
    return 'Every session here is a real person. The classifier could not place them into a network tier (typically Safari or privacy-mode reused connections), so the spread shows in the device and form-factor signals instead.';
  }
  if (shape.mood === 'affirming') {
    return 'Every session here is a real person. Each cohort sits in the tier its infrastructure put it in — and the experience holds together across more of them than the average implies.';
  }
  return 'Every session here is a real person. Each cohort sits in the tier its infrastructure put it in. Same campaign. Different experience.';
}

function pickPersonaSectionEyebrow(personas: ReportPersonaContrast): string {
  if (personas.best.is_empty && personas.constrained.is_empty) {
    return 'Cohort coverage in this window';
  }
  if (personas.best.is_empty || personas.constrained.is_empty) {
    return 'Cohort coverage in this window';
  }
  return 'Two cohorts, side by side';
}

function pickPersonaSectionLede(personas: ReportPersonaContrast): string {
  if (personas.best.is_empty && personas.constrained.is_empty) {
    return 'Neither end of the network spread appeared cleanly in this measurement window. The audience landed in the middle bands and the unclassified column.';
  }
  if (personas.best.is_empty) {
    return 'No best-connected cohort appeared in this window. We have a confident profile for the constrained side; the urban side is absent.';
  }
  if (personas.constrained.is_empty) {
    return 'No constrained cohort appeared in this window. We have a confident profile for the best-connected side; the constrained side is absent.';
  }
  return 'The most-connected and most-constrained personas in this measurement window.';
}

function pickContextStripLede(strip: ReportContextStripViewModel | null): string {
  if (!strip || strip.rows.length === 0) {
    return '';
  }
  const labels = strip.rows.map((r) => r.label.toLowerCase());
  if (labels.length === 1) {
    return `Measured environment signal that shapes the experience: ${labels[0]}.`;
  }
  if (labels.length === 2) {
    return `Measured environment signals that shape the experience: ${labels[0]} and ${labels[1]}.`;
  }
  const lead = labels.slice(0, -1).join(', ');
  const last = labels[labels.length - 1];
  return `Measured environment signals that shape the experience: ${lead}, and ${last}.`;
}

// ─── Distance ──────────────────────────────────────────────────────────

function pickDistanceHeadline(shape: EditorialDataShape, race: ReportRaceViewModel): string {
  if (!shape.race_available) {
    return `<h2 class="section-title">The race is <span class="brand-text">not yet defensible.</span> Coverage tells us more than the gap can right now.</h2>`;
  }
  const label = race.comparison_label;
  if (shape.race_metric === 'ttfb') {
    return `<h2 class="section-title">Urban gets a server reply. <span class="brand-text">${escapeForHtml(label)} is still waiting on first byte.</span></h2>`;
  }
  if (shape.race_metric === 'fcp') {
    return `<h2 class="section-title">Urban paints first content. <span class="brand-text">${escapeForHtml(label)} is still on a blank screen.</span></h2>`;
  }
  // metric === 'lcp'
  if (shape.wait_delta_band === 'contained') {
    return `<h2 class="section-title">Urban finishes loading. <span class="brand-text">${escapeForHtml(label)} catches up</span> — but the gap is contained.</h2>`;
  }
  return `<h2 class="section-title">Urban finishes loading. <span class="brand-text">${escapeForHtml(label)} is still mid-paint.</span></h2>`;
}

function pickDistanceLede(shape: EditorialDataShape, race: ReportRaceViewModel): string {
  if (!shape.race_available) {
    return 'The race needs more comparable cohort data than this window holds. The diagnosis below is what we can defend right now: coverage shape, persona spread, and the funnel where data permits.';
  }
  const metricName = race.metric_label;
  if (shape.wait_delta_band === 'contained') {
    return `Same campaign. Two phones. Both ${metricName} times play in real time. The space between them is small here — but it is still a measurable, repeatable gap.`;
  }
  if (shape.race_metric === 'ttfb') {
    return `Same campaign. Two server replies. Both ${metricName} times play in real time. The space between them is what your origin / edge stack is quietly costing you per click.`;
  }
  if (shape.race_metric === 'fcp') {
    return `Same campaign. Two phones. Both ${metricName} times play in real time. The space between them is the silence between the click and the first paint.`;
  }
  return `Same campaign. Two phones. Both ${metricName} times play in real time. The space between them is what your bid auctions are quietly pricing in.`;
}

// ─── Funnel ────────────────────────────────────────────────────────────

function pickFunnelEyebrow(shape: EditorialDataShape): string {
  if (shape.funnel_mode === 'legacy' || shape.funnel_active_stage_count === 0) {
    return 'Act 03 · Funnel coverage';
  }
  if (shape.funnel_active_stage_count === 1) {
    return 'Act 03 · The one defensible stage';
  }
  if (shape.funnel_active_stage_count === 2) {
    return 'Act 03 · Where the measured stages slip';
  }
  if (shape.mood === 'affirming') {
    return 'Act 03 · Where the page mostly holds';
  }
  return 'Act 03 · Where the page becomes too late';
}

function pickFunnelHeadline(shape: EditorialDataShape): string {
  if (shape.funnel_mode === 'legacy' || shape.funnel_active_stage_count === 0) {
    return `<h2 class="section-title">The performance funnel for this report is <span class="brand-text">unavailable.</span></h2>`;
  }
  // Stage count trumps mood — a 1-stage funnel cannot honestly use
  // the 3-stage "mostly holds — and where it slips" framing.
  if (shape.funnel_active_stage_count === 1) {
    return `<h2 class="section-title">Where the <span class="brand-text">one stage we can defend</span> starts to slip.</h2>`;
  }
  if (shape.funnel_active_stage_count === 2) {
    return `<h2 class="section-title">Where the <span class="brand-text">measured stages</span> start to slip.</h2>`;
  }
  // 3-stage funnel — mood softens the framing.
  if (shape.mood === 'affirming') {
    return `<h2 class="section-title">Where the page <span class="brand-text">mostly holds</span> — and where it slips.</h2>`;
  }
  return `<h2 class="section-title">Where the page <span class="brand-text">becomes too late.</span></h2>`;
}

function pickFunnelLede(shape: EditorialDataShape): string | null {
  if (shape.funnel_mode === 'legacy' || shape.funnel_active_stage_count === 0) {
    return null;
  }
  if (shape.funnel_active_stage_count === 1) {
    const stage = shape.funnel_first_stage_label ?? 'the first measured stage';
    return `Coverage was thin enough that only ${stage} clears the defensibility bar. The cliff at ${stage.toLowerCase()} is real; downstream stages are not measured here.`;
  }
  if (shape.funnel_active_stage_count === 2) {
    return 'Sessions cross into poor performance territory at the stages we can defend — first paint and main-content paint. Interaction-ready coverage was too thin to include here.';
  }
  // 3-stage funnel — mood shapes the framing.
  if (shape.mood === 'affirming') {
    return 'Most sessions stay safe through paint, hero content, and first interaction — but a measurable minority does not. Each stage tells you where that minority leaks out.';
  }
  if (shape.mood === 'sober') {
    return 'Sessions cross into poor performance territory at paint, at hero content, and at first interaction. The leak is real but uneven, stage to stage.';
  }
  return 'A meaningful share of your sessions cross into poor performance at paint, at hero content, and at first interaction. The leak compounds across stages before the page has caught up.';
}

function pickFunnelHeadlineFigureCap(shape: EditorialDataShape): string {
  if (shape.funnel_active_stage_count === 1) {
    const stage = shape.funnel_first_stage_label ?? 'the only defensible stage';
    return `of measured sessions cross into poor performance at ${stage.toLowerCase()}.`;
  }
  return 'of measured sessions cross into poor performance on at least one stage.';
}

// ─── Business ──────────────────────────────────────────────────────────

function pickBusinessHeadline(shape: EditorialDataShape): string {
  if (!shape.has_ledger) {
    return `<h2 class="section-title">Where the evidence lands in <span class="brand-text">the KPIs you're accountable for.</span></h2>`;
  }
  if (shape.mood === 'affirming') {
    return `<h2 class="section-title">Even at this calmer scale, every number above lands on a <span class="brand-text">KPI you're accountable for.</span></h2>`;
  }
  return `<h2 class="section-title">Every number above lands on a <span class="brand-text">KPI you're accountable for.</span></h2>`;
}

function pickAct4Lede(shape: EditorialDataShape): string {
  if (shape.mood === 'affirming') {
    return 'The gap is restrained, but every number above still meets a KPI someone on your team is accountable for. This is where it shows up.';
  }
  if (shape.mood === 'sober') {
    return 'The gap here is real but moderate. Every number above still lands on a KPI someone on your team is accountable for — read this section as where it falls, not as a verdict on cause.';
  }
  return 'Every number above meets a KPI someone on your team is accountable for. This is where the measured gap shows up in the business.';
}

function pickBusinessAsideLede(shape: EditorialDataShape): string {
  if (!shape.shape_proven) {
    return 'This report shows what the data could and could not say. Root cause, business exposure in your own currency, and a fix order need a richer sample to defend.';
  }
  return 'This report proves the <em>shape</em> of the gap. Root cause, business exposure in your own currency, and a fix order are the next read.';
}

function pickWhatThisEnables(shape: EditorialDataShape, dominantCulpritKind: string | null): string[] {
  const bullets: string[] = ['Bring this report into the next QBR or sprint review.'];

  if (shape.race_available && shape.wait_delta_band !== 'none') {
    bullets.push('Pair tier evidence with a landing-page audit before the next paid-media review.');
  }

  // "Reshape" framing per actionability discipline — never "exclude" the cohort.
  if (shape.classified_tier_count >= 2 && !shape.constrained_persona_empty) {
    bullets.push('Reshape the constrained-cohort landing path — a lighter route, not an excluded audience.');
  }

  // Re-test framing depends on the dominant LCP culprit, when known.
  if (dominantCulpritKind === 'hero_image') {
    bullets.push('Re-test Quality Score after a hero-image fix.');
  } else if (dominantCulpritKind === 'background_image') {
    bullets.push('Re-test Quality Score after a background-image / above-the-fold weight pass.');
  } else if (dominantCulpritKind === 'icon') {
    bullets.push('Re-test Quality Score after a font / icon-stack pass.');
  } else if (shape.race_available && shape.race_metric === 'lcp') {
    bullets.push('Re-test Quality Score after a render-budget pass on the landing template.');
  } else if (shape.race_available && shape.race_metric === 'ttfb') {
    bullets.push('Re-test Quality Score after a server / edge-cache pass.');
  }

  return bullets;
}

// ─── Closing-section bridge + cards + pills ───────────────────────────

function pickClosingBridge(): string {
  // The closing bridge USED to append "What would help most from here?"
  // to the boundary statement, but the modal's trigger button + dialog
  // title both ask the same question — three near-identical
  // restatements in one section. Empty bridge keeps the boundary
  // statement clean as the truth-frame; the trigger button below it IS
  // the question.
  return '';
}

function pickClosingModal(shape: EditorialDataShape): ReportClosingModal {
  // Choice bodies tonally extend the bridge question "What would help
  // most from here?" — read as natural answers a thoughtful operator
  // would give themselves. Imperative declarative, no questions, no
  // celebration register, no exclusion / "upgrade to" / "premium" copy
  // (render-honesty enforced).
  const piBody =
    shape.mood === 'affirming'
      ? 'A campaign-attribution layer would map specific ad campaigns to the gap surfaced here. Not built yet — collecting interest first.'
      : 'This report shows the gap; it does not tell you which campaigns or audiences are most exposed to it. We are collecting interest in a campaign-attribution layer that would.';
  const rapidBody = shape.has_ledger
    ? 'A short, prioritised fix list for the highest-pressure page surfaced above. Booked through stroma.design.'
    : 'A short, prioritised fix list for a single high-value page. Booked through stroma.design.';

  return {
    trigger_label: 'What would help next?',
    title: 'What would help next?',
    lede: 'Tell us what would actually help — we use this to prioritise what we build next.',
    choice_legend: 'Pick one:',
    choices: [
      {
        value: 'pi_early_access',
        label: 'Show me which campaigns this affects',
        body: piBody
      },
      {
        value: 'rapid_fix',
        label: 'Get a fix list for this page',
        body: rapidBody
      },
      {
        value: 'monitoring',
        label: 'Run this report on a schedule',
        body: 'Re-running the BigQuery query by hand is fine for a one-off, less fine as a regular read. Scheduled delivery weekly or monthly as the data refreshes.'
      },
      {
        value: 'something_else',
        label: 'Something else',
        body: 'Pick any of the options that apply, or describe what would help.'
      }
    ],
    cadence_legend: 'How often?',
    cadence_options: [
      { value: 'weekly', label: 'weekly' },
      { value: 'monthly', label: 'monthly' }
    ],
    pills_legend: 'Which kinds?',
    freeform_label: 'tell us more',
    freeform_placeholder: 'What would actually help? (200 chars max)',
    email_label: 'your email — optional',
    email_placeholder: 'you@company.com',
    email_caption: 'if you want us to follow up directly',
    submit_label: 'send',
    confirmation_text: '✓ noted — we will be in touch',
    dismiss_label: 'close'
  };
}

function pickClosingPills(): ReportClosingPill[] {
  return [
    { pill_id: 'multi_page', label: 'same report for another page on this domain', collects_freeform_text: false },
    { pill_id: 'multi_client_portfolio', label: 'multi-client / portfolio rollout', collects_freeform_text: false },
    {
      pill_id: 'competitor_context',
      label: 'competitor / market context for this report',
      collects_freeform_text: false
    },
    { pill_id: 'something_else', label: 'something else', collects_freeform_text: true }
  ];
}

// ─── Helpers ───────────────────────────────────────────────────────────

function escapeForHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
