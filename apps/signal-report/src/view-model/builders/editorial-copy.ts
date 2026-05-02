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

import type {
  SignalRaceMetric,
  SignalReportInteractionIntentKind,
  SignalReportInteractionIntentPillId
} from '@stroma-labs/signal-contracts';

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

/** One of the three closing-section cards. Each card is a needs-inquiry
 * (question-led title, empathetic body) — never a packaged offer. CTA
 * label reads as a quiet text-link, never a button. Visual restraint
 * lives in the renderer; the editorial register lives here. */
export interface ReportClosingCard {
  id: 'pi_early_access' | 'rapid_fix' | 'monitoring';
  /** SignalReportInteractionKind value emitted to the snapshot-engine
   * `/api/v1/intent` endpoint when the CTA is clicked. */
  intent_kind: SignalReportInteractionIntentKind;
  eyebrow: string;
  /** Question-led title. e.g. "Wondering which campaigns are exposed?" */
  title: string;
  /** 1-2 sentence empathetic body. Mood + shape aware. */
  body: string;
  cta_label: string;
  /** When set, the card click POSTs the intent then redirects here.
   *  When null, the click logs intent + transforms in place to ✓ noted. */
  cta_href: string | null;
  /** When true, card transforms to reveal an optional inline email
   *  field after the initial click logs anonymously. */
  collects_email: boolean;
  /** Monitoring card only — reveals a Weekly / Daily selector. */
  collects_cadence: boolean;
  /** Optional honesty footnote shown beneath the CTA. */
  small_note: string | null;
}

/** One pill in the freeform-demand row beneath the cards. Single-line
 *  mono-small text, NOT a button. */
export interface ReportClosingPill {
  pill_id: SignalReportInteractionIntentPillId;
  label: string;
  /** When true, clicking expands the pill into a short freeform text
   *  field (capped 200 chars). Only true for `something_else`. */
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
  business_section_eyebrow: string;
  business_aside_lede_html: string;
  business_what_this_enables: string[];

  /** Boundary-statement-anchored bridge sentence rendered above the
   *  closing-card row. Question-led ("What would help most from here?"),
   *  not packaging-led ("Choose your next step"). */
  business_closing_bridge_html: string;
  /** Three co-equal cards. Visual primary is conveyed by the editorial
   *  bridge above, never by card weight. */
  business_closing_cards: ReportClosingCard[];
  /** Lead-in label for the freeform pill row. */
  business_closing_pill_lead_in: string;
  /** Five inline pills capturing demand we haven't yet productized. */
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
    business_section_eyebrow: shape.has_ledger
      ? 'Where the numbers land in your KPIs'
      : 'Where the evidence lands in your KPIs',
    business_aside_lede_html: pickBusinessAsideLede(shape),
    business_what_this_enables: pickWhatThisEnables(shape, dominantCulpritKind),

    business_closing_bridge_html: pickClosingBridge(),
    business_closing_cards: pickClosingCards(shape),
    business_closing_pill_lead_in: 'Or tell us what would actually help —',
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
    return `<h1>We couldn't sort this audience into network tiers — but the <span class="duotone-text">device and connection signals</span> still show meaningful spread.</h1>`;
  }
  if (shape.classified_tier_count === 0) {
    return `<h1>We couldn't sort this audience into network tiers — but the <span class="duotone-text">device and connection signals</span> still show meaningful spread.</h1>`;
  }
  if (shape.classified_tier_count === 1) {
    return `<h1>Every session here lives in the same network band — but the <span class="duotone-text">device and connection signals</span> still tell different stories.</h1>`;
  }
  if (shape.classified_tier_count === 2) {
    return `<h1>Your traffic isn't one user. It's <span class="duotone-text">two distinct audiences</span> experiencing the same campaign differently.</h1>`;
  }
  return `<h1>Your traffic isn't one user. It's <span class="duotone-text">three different audiences</span> sharing the same campaign.</h1>`;
}

function pickAudienceLede(shape: EditorialDataShape): string {
  if (shape.classified_tier_count === 0) {
    return 'Every session here is a real person. The classifier could not place them into a network tier — typically Safari / privacy-mode reused connections — so the spread shows in the device and form-factor signals instead.';
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
    return `<h1>The race is <span class="duotone-text">not yet defensible.</span> Coverage tells us more than the gap can right now.</h1>`;
  }
  const label = race.comparison_label;
  if (shape.race_metric === 'ttfb') {
    return `<h1>Urban gets a server reply. <span class="duotone-text">${escapeForHtml(label)} is still waiting on first byte.</span></h1>`;
  }
  if (shape.race_metric === 'fcp') {
    return `<h1>Urban paints first content. <span class="duotone-text">${escapeForHtml(label)} is still on a blank screen.</span></h1>`;
  }
  // metric === 'lcp'
  if (shape.wait_delta_band === 'contained') {
    return `<h1>Urban finishes loading. <span class="duotone-text">${escapeForHtml(label)} catches up</span> — but the gap is contained.</h1>`;
  }
  return `<h1>Urban finishes loading. <span class="duotone-text">${escapeForHtml(label)} is still mid-paint.</span></h1>`;
}

function pickDistanceLede(shape: EditorialDataShape, race: ReportRaceViewModel): string {
  if (!shape.race_available) {
    return 'The race needs more comparable cohort data than this window holds. The diagnosis below is what we can defend right now — coverage shape, persona spread, and the funnel where data permits.';
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
    return `<h1>The performance funnel for this report is <span class="duotone-text">unavailable.</span></h1>`;
  }
  // Stage count trumps mood — a 1-stage funnel cannot honestly use
  // the 3-stage "mostly holds — and where it slips" framing.
  if (shape.funnel_active_stage_count === 1) {
    return `<h1>Where the <span class="duotone-text">one stage we can defend</span> starts to slip.</h1>`;
  }
  if (shape.funnel_active_stage_count === 2) {
    return `<h1>Where the <span class="duotone-text">measured stages</span> start to slip.</h1>`;
  }
  // 3-stage funnel — mood softens the framing.
  if (shape.mood === 'affirming') {
    return `<h1>Where the page <span class="duotone-text">mostly holds</span> — and where it slips.</h1>`;
  }
  return `<h1>Where the page <span class="duotone-text">becomes too late.</span></h1>`;
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
  return 'A meaningful share of your sessions cross into poor performance territory — first at the moment of paint, again at hero content, and finally at first interaction. Stage by stage, intent leaks out before the page has caught up.';
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
    return `<h1>Where the evidence lands in <span class="duotone-text">the KPIs you're accountable for.</span></h1>`;
  }
  if (shape.mood === 'affirming') {
    return `<h1>Even at this calmer scale, every number above lands on a <span class="duotone-text">KPI you're accountable for.</span></h1>`;
  }
  return `<h1>Every number above lands on a <span class="duotone-text">KPI you're accountable for.</span></h1>`;
}

function pickBusinessAsideLede(shape: EditorialDataShape): string {
  if (!shape.shape_proven) {
    return 'This report shows what the data could and could not say. The next read — root cause, business exposure in your own currency, fix order — needs a richer sample, and is where a deeper engagement starts.';
  }
  return 'This report proves the <em>shape</em> of the gap. Root cause, business exposure in your own currency, and fix order are the next read — and where a deeper engagement starts.';
}

function pickWhatThisEnables(shape: EditorialDataShape, dominantCulpritKind: string | null): string[] {
  const bullets: string[] = ['Bring this report into the next QBR or sprint review.'];

  if (shape.race_available && shape.wait_delta_band !== 'none') {
    bullets.push('Pair tier evidence with a landing-page audit before the next paid-media review.');
  }

  // "Reshape" framing per actionability discipline — never "exclude" the cohort.
  if (shape.populated_tier_count >= 2 && !shape.constrained_persona_empty) {
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
  // The closing bridge is JUST the needs-inquiry question. The renderer
  // composes it with the canonical `vm.boundary_statement` verbatim so
  // the artifact has ONE source of truth for the truth-boundary
  // language (no duplicate near-paraphrase between bridge + footer).
  return '<strong>What would help most from here?</strong>';
}

function pickClosingCards(shape: EditorialDataShape): ReportClosingCard[] {
  return [pickPiCard(shape), pickRapidFixCard(shape), pickMonitoringCard()];
}

function pickPiCard(shape: EditorialDataShape): ReportClosingCard {
  // Card titles tonally extend the bridge question "What would help most
  // from here?" — read as natural answers a thoughtful operator would
  // give themselves. Imperative declarative, no questions.
  const body =
    shape.mood === 'affirming'
      ? 'If you ever want to see which campaigns are exposed to this gap, the campaign-attribution layer will join substrate to spend and conversions. We will let you know when early access opens.'
      : 'Substrate × spend × conversions joins are coming as a paid layer — early access opens to a small cohort first. We will let you know when you can connect this report to your campaign data.';

  return {
    id: 'pi_early_access',
    intent_kind: 'intent_pi_early_access',
    eyebrow: 'Campaign-attribution layer',
    title: 'See which campaigns this affects.',
    body,
    cta_label: 'Tell me when it ships',
    cta_href: null,
    collects_email: true,
    collects_cadence: false,
    small_note: 'Currently a small cohort. No availability promised.'
  };
}

function pickRapidFixCard(shape: EditorialDataShape): ReportClosingCard {
  // Body softens when the report shows little measured pressure — the
  // offer still applies but the framing shouldn't read as if the page
  // is on fire when it isn't.
  const body = shape.has_ledger
    ? 'If a single high-value page is dragging the funnel above and you want a short, ship-ready fix order, this traces the cause and returns it. Booked through stroma.design.'
    : 'If you have a single high-value page where you want a short, ship-ready fix order — this traces the cause and returns it. Booked through stroma.design.';

  return {
    id: 'rapid_fix',
    intent_kind: 'intent_rapid_fix',
    eyebrow: 'Rapid Fix Plan',
    title: 'Get a fix list for this page.',
    body,
    cta_label: 'Get a fix plan',
    cta_href: 'https://www.stroma.design/book?service=rapid-fix',
    collects_email: false,
    collects_cadence: false,
    small_note: 'Project-scoped. Booked, not bought.'
  };
}

function pickMonitoringCard(): ReportClosingCard {
  return {
    id: 'monitoring',
    intent_kind: 'intent_monitoring',
    eyebrow: 'Automated monitoring',
    title: 'Run this report on a schedule.',
    body: 'Re-running the BigQuery query and regenerating the URL by hand is fine for a one-off — less fine as a regular read. Scheduled monitoring would deliver this same report weekly or monthly as the data refreshes. We are collecting interest before we build it.',
    cta_label: 'Tell me when it ships',
    cta_href: null,
    collects_email: true,
    collects_cadence: true,
    small_note: 'Not yet shipped — collecting demand first.'
  };
}

function pickClosingPills(): ReportClosingPill[] {
  return [
    { pill_id: 'weekly_inbox', label: 'weekly inbox digest of this domain', collects_freeform_text: false },
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
