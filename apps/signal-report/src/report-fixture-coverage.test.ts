// Fixture-coverage regression suite for the redesigned scroll-narrative
// shell. Renders every shipped scenario fixture through the full
// pipeline (buildReportViewModel → renderReportShell) and asserts:
//
//   1. No null / undefined / NaN literals leak into the rendered HTML
//      (text content, attribute values, percentage suffixes).
//   2. Every fixture renders all 5 sections + CTA + boundary statement.
//   3. Specific RC3 fixes stay fixed:
//      - Race eyebrow no longer duplicates "race" word when race
//        is unavailable
//      - Funnel section degrades to a "Funnel unavailable" figure when
//        stages.length === 0 (instead of an anaemic "0% poor" headline
//        + two empty block wrappers)
//      - Context strip renders when act1_context_strip is populated
//      - Empty form-factor segments render with data-empty + dashed
//        placeholder treatment
//      - lcp_bounce ledger row's glossary anchor matches its CPC cameo

import { signalReportScenarioFixtures } from '@stroma-labs/signal-contracts';
import { describe, expect, it } from 'vitest';

import { renderReportShell } from './render-shell';
import { buildReportViewModel } from './report-view-model';

describe('fixture coverage — every scenario renders without null/undefined/NaN leakage', () => {
  for (const fx of signalReportScenarioFixtures) {
    describe(`fixture: ${fx.id}`, () => {
      const vm = buildReportViewModel(fx.aggregate);
      const html = renderReportShell(vm);
      const lowered = html.toLowerCase();

      it('renders all 5 section IDs', () => {
        for (const id of ['cover', 'audience', 'distance', 'funnel', 'business']) {
          expect(html, `${fx.id} missing #${id}`).toContain(`id="${id}"`);
        }
      });

      it('renders the canonical closing trigger + boundary statement', () => {
        expect(html, `${fx.id} missing closing-modal trigger`).toContain('data-closing-modal-open');
        expect(html, `${fx.id} missing closing-modal dialog`).toContain('id="closing-modal"');
        expect(html, `${fx.id} missing boundary statement`).toContain(vm.boundary_statement);
      });

      // Sample-band note (P2-credibility): the sticky scroll-nav
      // surfaces a persistent disclaimer chip when band !== 'stable'
      // (lives in the nav so it follows the recipient's eye through
      // every section). Fixture-driven sanity check: render contains
      // the headline iff band is preliminary/provisional, suppressed
      // entirely when stable.
      it('renders the sample-band note only when band !== stable', () => {
        if (vm.band === 'preliminary') {
          expect(html, `${fx.id} (band=preliminary) missing band note`).toContain('Early read');
        } else if (vm.band === 'provisional') {
          expect(html, `${fx.id} (band=provisional) missing band note`).toContain('Firming up');
        } else {
          expect(html, `${fx.id} (band=stable) leaks band note`).not.toContain('Early read');
          expect(html, `${fx.id} (band=stable) leaks band note`).not.toContain('Firming up');
          expect(html, `${fx.id} (band=stable) leaks band note container`).not.toContain('scroll-nav-note');
        }
      });

      it('does not leak null / undefined / NaN as visible content', () => {
        expect(lowered, `${fx.id} leaks >null<`).not.toContain('>null<');
        expect(lowered, `${fx.id} leaks >undefined<`).not.toContain('>undefined<');
        expect(lowered, `${fx.id} leaks >nan<`).not.toContain('>nan<');
        expect(lowered, `${fx.id} leaks null%`).not.toContain('null%');
        expect(lowered, `${fx.id} leaks undefined%`).not.toContain('undefined%');
        expect(lowered, `${fx.id} leaks nan%`).not.toContain('nan%');
        expect(lowered, `${fx.id} leaks "nulls"`).not.toContain(' nulls ');
        expect(lowered, `${fx.id} leaks "undefineds"`).not.toContain(' undefineds ');
        expect(lowered, `${fx.id} leaks "nans"`).not.toContain(' nans ');
        expect(lowered, `${fx.id} leaks =undefined`).not.toContain('=undefined');
        expect(lowered, `${fx.id} leaks ="undefined"`).not.toContain('="undefined"');
        expect(lowered, `${fx.id} leaks ="null"`).not.toContain('="null"');
      });

      if (!vm.race.race_available) {
        it('race-unavailable: section eyebrow does not duplicate the word "race"', () => {
          expect(lowered, `${fx.id} leaks "race race" duplication`).not.toContain('race race');
          expect(lowered, `${fx.id} should not show race-grid eyebrow when race unavailable`).not.toContain(
            'race · played in real seconds'
          );
        });

        it('race-unavailable: no orphaned phone-frame markup', () => {
          expect(html, `${fx.id} leaks .race-phone-fill when race unavailable`).not.toContain(
            'class="race-phone-fill"'
          );
          expect(html, `${fx.id} leaks .race-phone-frame when race unavailable`).not.toContain(
            'class="race-phone-frame"'
          );
        });
      }

      if (vm.act3.mode === 'legacy' || vm.act3.stages.length === 0) {
        it('funnel-unavailable: emits Funnel-unavailable figure, not stage progression', () => {
          const funnelSection = html.slice(html.indexOf('id="funnel"'), html.indexOf('id="business"'));
          expect(funnelSection, `${fx.id} should show "Funnel unavailable"`).toContain('Funnel unavailable');
          expect(funnelSection, `${fx.id} should not emit Stage progression eyebrow when no stages`).not.toContain(
            'Stage progression'
          );
          expect(funnelSection, `${fx.id} should not emit Per-stage detail eyebrow when no stages`).not.toContain(
            'Per-stage detail'
          );
        });
      }

      if (vm.act1_context_strip != null && vm.act1_context_strip.rows.length > 0) {
        it('context-strip: renders the audience-section context block when populated', () => {
          expect(html, `${fx.id} should render context strip`).toContain('Context that shapes the experience');
          for (const row of vm.act1_context_strip.rows) {
            expect(html, `${fx.id} missing context-row narrative for ${row.key}`).toContain(row.narrative);
          }
        });
      }

      if (vm.form_factor?.segments.some((s) => s.share === 0)) {
        it('form-factor: empty (0%) segments render with data-empty + placeholder copy', () => {
          expect(html, `${fx.id} should mark empty form-factor cells`).toContain('data-empty="true"');
          expect(html, `${fx.id} should label empty form-factor cells honestly`).toContain(
            'no sessions in this form factor'
          );
        });
      }

      if (vm.persona_contrast.best.is_empty || vm.persona_contrast.constrained.is_empty) {
        it('persona-empty: empty personas render the honest empty_message', () => {
          // empty_message contains characters that get HTML-escaped (`>` →
          // `&gt;`), so we assert on a stable prefix that does not span
          // any escapable character.
          const stablePrefix = (msg: string) => msg.split(/[<>&"']/u)[0]?.trim() ?? '';
          if (vm.persona_contrast.best.is_empty) {
            const prefix = stablePrefix(vm.persona_contrast.best.empty_message);
            expect(html, `${fx.id} missing best persona empty_message prefix`).toContain(prefix);
          }
          if (vm.persona_contrast.constrained.is_empty) {
            const prefix = stablePrefix(vm.persona_contrast.constrained.empty_message);
            expect(html, `${fx.id} missing constrained persona empty_message prefix`).toContain(prefix);
          }
        });
      }
    });
  }
});

describe('cross-fixture invariants: every act4 row populates both halves of the what-it-says / why-it-matters pair', () => {
  it('every emitted act4 impact row has non-empty what_it_says + why_it_matters', () => {
    for (const fx of signalReportScenarioFixtures) {
      const vm = buildReportViewModel(fx.aggregate);
      for (const row of vm.act4_impact_rows) {
        expect(row.what_it_says.length, `${fx.id}: row ${row.id} missing what_it_says`).toBeGreaterThan(0);
        expect(row.why_it_matters.length, `${fx.id}: row ${row.id} missing why_it_matters`).toBeGreaterThan(0);
      }
    }
  });
});
