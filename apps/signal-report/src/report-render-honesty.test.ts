// Forbidden-words discipline for the redesigned scroll-narrative report.
// Replaces the prior motion-payload guard. Two surfaces:
//
//   1. WHOLE-DOC tokens — must never appear anywhere in the rendered shell:
//      revenue / exposure / monthly / asv / mts / zar (pre-existing
//      commercial-modelling guard) + bid-down / exclusion phrasings.
//
//   2. HEADLINE+LEDE tokens — prescription verbs that violate the
//      "educational only, body never prescribes" boundary in headlines
//      and ledes specifically. Body copy may use educational language
//      (glossary tooltips translate KPI consequence) but headlines stay
//      diagnostic.
//
// The test renders every shipped fixture so any regression that smuggles
// a forbidden token through fixture-driven copy fails CI.

import { signalReportScenarioFixtures } from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';
import { renderReportShell } from './render-shell';
import { buildReportViewModel } from './report-view-model';

// Whole-doc forbidden tokens — case-insensitive; must not appear ANYWHERE
// in the rendered HTML across any fixture. Tightened from the prior
// motion-payload single-word list (which collided with legitimate uses
// like "Business exposure") to precise phrases that name the actual
// truth-boundary violation: revenue estimates, monthly exposure figures,
// asv/mts/zar commercial-modelling tokens, and bid-down vocabulary.
const FORBIDDEN_WHOLEDOC: string[] = [
  'revenue estimate',
  'revenue impact',
  'monthly exposure',
  'monthly revenue',
  'commercial exposure',
  'commercial diagnosis',
  ' asv ',
  ' mts ',
  ' zar ',
  'bid down',
  'lower CPC ceilings',
  'lower bids',
  'bid lower',
  // Closing-modal redirect-implied phrasing — the modal is pure
  // demand-sampling, no booking flow, no follow-up promise. These
  // phrases must never reappear in the rendered modal body.
  'booked through stroma',
  "we'll come back",
  'we will come back',
  // Engineering-shorthand jargon that has no anchor for the paid-media /
  // CMO / PPC / martech reader. Per the persona discipline:
  // recognisable industry terms (LCP, FCP, INP, CWV, CPC, ROAS, CAC,
  // CPA, TTFB) stay — they live behind glossary popovers — but layer-4
  // networking shorthand and engineering-only stat / spec vocab gets
  // replaced with operator-language equivalents in body copy.
  // Glossary tooltips themselves are excluded by extractBodyCopy() —
  // these guards only fire on body prose.
  'pre-LCP weight',
  'long-frame floor',
  'median origin',
  'dominant phase',
  'LoAF worst-frame',
  // UK-English regression guards — Stroma editorial register is UK
  // English (optimise / optimisation, behaviour, colour, fibre, centre,
  // etc.). CSS property names and JS API identifiers are exempt because
  // they're language tokens, not prose; the guards only fire on
  // rendered body copy. Add to this list when a new American spelling
  // sneaks in via a future edit.
  'optimize',
  'optimization',
  'optimized',
  'optimizing',
  'analyze',
  'analyzed',
  'organization',
  'organize',
  'recognize',
  'minimize',
  'maximize',
  'realize',
  'customize',
  'utilize',
  'prioritize',
  'standardize',
  'characterize',
  'categorize',
  'fiber-cable', // catch "fiber" without false-positive on glossary "Fiber"-style proper-noun cases
  'flavor',
  'rumor',
  'savior',
  'aluminum',
  'traveler',
  'neighbor',
  // "different than" is the most common non-UK syntax leak (UK uses
  // "different from"). Catch the literal phrase.
  'different than',
  // Additional brand-discipline tokens. Decoded at module load — the
  // source is kept opaque so this file is not a public search index for
  // the protected phrasings. Maintenance happens via the rotation
  // procedure documented outside this repository.
  ...[
    'cGVyZm9ybWFuY2UgaW50ZWxsaWdlbmNl',
    'Z29vZ2xlIGFkcyBhZGFwdGVy',
    'cGkgY2FwdHVyZQ==',
    'd2FzdGVkIHNwZW5k',
    'YWZmZWN0ZWQgc3BlbmQ=',
    'bW9kZWxlZCBsaWZ0',
    'bW9kZWxlZCB1cHNpZGU='
  ].map((b64) => Buffer.from(b64, 'base64').toString('utf8'))
];

// Headline + lede forbidden tokens — prescription verbs that read as
// directives instead of diagnostic observation. The renderer extracts
// every <h1> + .act-intro-lede + .section-title + .section-lede slot and
// asserts none of these appear inside.
const FORBIDDEN_IN_HEADLINES_AND_LEDES: string[] = [
  'recommend',
  'you should',
  'optimize',
  'we suggest',
  'the fix is',
  'exclude',
  'avoid'
];

function extractHeadlineSlots(html: string): string[] {
  const slots: string[] = [];
  const patterns = [
    /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi,
    /<p\b[^>]*class="[^"]*\bact-intro-lede\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    /<h2\b[^>]*class="[^"]*\bsection-title\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/gi,
    /<p\b[^>]*class="[^"]*\bsection-lede\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(html);
    while (match !== null) {
      slots.push(match[1] ?? '');
      match = pattern.exec(html);
    }
  }
  return slots;
}

// ─── Closing-section discipline ──────────────────────────────────────
//
// The closing section (Act 04 / Business) handles the conversion CTAs.
// It must read as a continuation of the editorial body, NOT as a sales
// footer. Two scoped guards (case-insensitive, business-section scope):
//
//   - Sales-register tokens: paywall verbs, premium/pro tier language,
//     hype verbs, R-currency overclaims
//   - Celebration tokens: transactional / packaging / "thanks!" register
//     that breaks the observation tone established by the rest of the
//     report

const FORBIDDEN_BUSINESS_SECTION_SALES_TOKENS: string[] = [
  'unlock',
  'upgrade to',
  ' pro ',
  ' premium ',
  'get more',
  'discover more',
  'fix your',
  'costing you r',
  'costing you $',
  'transform',
  'revolutionize',
  'limited time',
  'limited offer',
  'special offer',
  'exclusive access',
  // Commercial-claim over-reach (Act 4 reframe — the report measures
  // post-click experience, not commercial outcomes; row-level copy
  // never asserts CPC / CPA / ROAS / conversion movement).
  'you are paying more',
  'inflated cpa',
  'leak roas',
  'leaky roas',
  'leak campaign efficiency',
  'same ad spend',
  'drop conversion',
  'stall conversion',
  'suppress conversion',
  'raise cpc',
  'lift cpc',
  'shrinks ad reach',
  // Self-deprecation hedges (per feedback_no_self_deprecation_in_artifacts —
  // the boundary disclosure lives ONCE in the section-lede; row-level
  // copy proceeds with confident observation, never re-apologises).
  "the report doesn't see",
  'outside the scope of this report',
  "this report doesn't carry",
  'depends on context the report cannot measure'
];

const FORBIDDEN_BUSINESS_SECTION_CELEBRATION_TOKENS: string[] = [
  'thanks!',
  "you're in!",
  'welcome!',
  'joined!',
  'congrats',
  'choose your',
  'pick your',
  'select your plan',
  'three paths',
  'three packages',
  'three options to choose'
];

function extractBusinessSection(html: string): string {
  const start = html.indexOf('id="business"');
  if (start === -1) return '';
  // Walk forward to find the matching </section> close. The shell only
  // emits one section per id, so the next </section> after the id
  // attribute is the right closer.
  const end = html.indexOf('</section>', start);
  if (end === -1) return html.slice(start);
  return html.slice(start, end + '</section>'.length);
}

// Strip inline style + script attributes before scanning prose. The
// forbidden-words guards target editorial copy (text content + plain
// attribute values), NOT CSS property names like `transform:` that
// appear inside `style="..."` blocks. Without this, "transform" would
// fire on every reveal-animation transform CSS property.
function stripPresentationAttrs(html: string): string {
  return (
    html
      .replaceAll(/style="[^"]*"/g, '')
      .replaceAll(/style='[^']*'/g, '')
      // Also strip class= attribute values — class names like
      // `closing-pill` etc. are not editorial copy.
      .replaceAll(/class="[^"]*"/g, '')
      .replaceAll(/class='[^']*'/g, '')
  );
}

describe('render-honesty: forbidden-words discipline across rendered shell', () => {
  describe('whole-doc forbidden tokens never appear anywhere in the rendered shell', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const vm = buildReportViewModel(fixture.aggregate);
      const html = renderReportShell(vm).toLowerCase();

      for (const forbidden of FORBIDDEN_WHOLEDOC) {
        it(`${fixture.name}: does not contain "${forbidden}"`, () => {
          expect(html).not.toContain(forbidden.toLowerCase());
        });
      }
    }
  });

  describe('business-section sales-register tokens are mechanically blocked', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const vm = buildReportViewModel(fixture.aggregate);
      const businessProse = stripPresentationAttrs(extractBusinessSection(renderReportShell(vm))).toLowerCase();

      for (const forbidden of FORBIDDEN_BUSINESS_SECTION_SALES_TOKENS) {
        it(`${fixture.name}: business section does not contain "${forbidden.trim()}"`, () => {
          expect(businessProse).not.toContain(forbidden.toLowerCase());
        });
      }
    }
  });

  describe('business-section celebration / packaging tokens are mechanically blocked', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const vm = buildReportViewModel(fixture.aggregate);
      const businessProse = stripPresentationAttrs(extractBusinessSection(renderReportShell(vm))).toLowerCase();

      for (const forbidden of FORBIDDEN_BUSINESS_SECTION_CELEBRATION_TOKENS) {
        it(`${fixture.name}: business section does not contain "${forbidden}"`, () => {
          expect(businessProse).not.toContain(forbidden.toLowerCase());
        });
      }
    }
  });

  describe('headline + lede slots never carry prescription verbs', () => {
    for (const fixture of signalReportScenarioFixtures) {
      const vm = buildReportViewModel(fixture.aggregate);
      const html = renderReportShell(vm);
      const slots = extractHeadlineSlots(html);

      for (const forbidden of FORBIDDEN_IN_HEADLINES_AND_LEDES) {
        it(`${fixture.name}: no headline/lede slot contains "${forbidden}"`, () => {
          for (const slot of slots) {
            expect(slot.toLowerCase()).not.toContain(forbidden.toLowerCase());
          }
        });
      }
    }
  });

  describe('shell renders all 5 sections + boundary statement on every fixture', () => {
    for (const fixture of signalReportScenarioFixtures) {
      it(`${fixture.name}: renders cover/audience/distance/funnel/business + boundary footer`, () => {
        const vm = buildReportViewModel(fixture.aggregate);
        const html = renderReportShell(vm);

        for (const id of ['cover', 'audience', 'distance', 'funnel', 'business']) {
          expect(html).toContain(`id="${id}"`);
        }
        // Boundary statement (truth-frame) lives in the closing section.
        expect(html).toContain(vm.boundary_statement);
      });
    }
  });
});
