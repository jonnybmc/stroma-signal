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
  'bid lower'
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
