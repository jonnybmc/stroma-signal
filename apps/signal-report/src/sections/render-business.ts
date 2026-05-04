// Section `business` (Act 04) — KPI ledger + needs-inquiry closing.
// Translates measured findings into the reader's KPI vocabulary, then
// hands off through a single discreet trigger that opens a modal with
// progressive disclosure. Diagnostic-only — no prescription, no
// exclusion language, no sales register.
//
// Visual register discipline (load-bearing, see plan file):
// - Closing trigger is a single text-link button, NOT a styled CTA card.
// - The boundary statement above the trigger stays — it's the truth
//   frame for the whole report, not a sales bridge.
// - Modal interior uses native form chrome with light styling; no
//   marketing-style "card" treatment per option.
// - Confirmation copy stays in observation register (✓ noted, not
//   Thanks! / You're in!).

import { renderHeroValue, renderReveal } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import type { ReportAct4ImpactRow, ReportViewModel } from '../report-view-model.js';

function renderImpactRow(row: ReportAct4ImpactRow): string {
  // Two-paragraph layout: WHAT IT SAYS (descriptive observation) +
  // WHY IT MATTERS (directional implication, no commercial figures).
  // Eyebrows are mono-uppercase to make the structural distinction
  // visible — the boundary discipline reads off the markup.
  return `
    <div class="figure impact-row">
      <div>
        <div class="figure-stat" style="font-size:clamp(32px,3vw + 12px,48px);">${renderHeroValue(row.metric_value)}</div>
        <div class="figure-eyebrow" style="margin-top:6px;text-transform:none;letter-spacing:0.04em;">${escapeHtml(
          row.metric_label
        )}</div>
      </div>
      <div class="impact-row-prose">
        <div class="impact-row-pair">
          <div class="impact-row-eyebrow">What it says</div>
          <p class="impact-row-body">${escapeHtml(row.what_it_says)}</p>
        </div>
        <div class="impact-row-pair">
          <div class="impact-row-eyebrow">Why it matters</div>
          <p class="impact-row-body">${escapeHtml(row.why_it_matters)}</p>
        </div>
      </div>
    </div>
  `;
}

function renderSummaryFallback(points: string[]): string {
  if (points.length === 0) return '';
  return `
    <div class="figure">
      <div class="figure-eyebrow">Where this evidence lands</div>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:var(--ink-soft);line-height:1.6;">
        ${points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderClosingTrigger(vm: ReportViewModel): string {
  // Closing-router stack:
  //   1. Boundary statement — the report-level truth frame.
  //   2. Role-flavored question — pre-segments the modal's three
  //      meaningful choices (campaign exposure / page diagnosis /
  //      measurement over time) without naming a product.
  //   3. Single discreet trigger button — opens the dialog.
  // No card chrome, no per-option visual weight — restraint is the point.
  const modal = vm.editorial.business_closing_modal;
  const bridgeSuffix = vm.editorial.business_closing_bridge_html ? ` ${vm.editorial.business_closing_bridge_html}` : '';
  return `
    <div class="closing-router">
      ${renderReveal(`<p class="closing-bridge">${escapeHtml(vm.boundary_statement)}${bridgeSuffix}</p>`)}
      ${renderReveal(`<p class="closing-role-question">${vm.editorial.business_role_question_html}</p>`, { delay: 60 })}
      ${renderReveal(
        `<button type="button" class="closing-trigger" data-closing-modal-open aria-haspopup="dialog" aria-controls="closing-modal">${escapeHtml(modal.trigger_label)} →</button>`,
        { delay: 120 }
      )}
      ${renderClosingModal(vm)}
    </div>
  `;
}

function renderClosingModal(vm: ReportViewModel): string {
  // Native <dialog> element. Browser handles backdrop, ESC-to-close,
  // focus trap, and scroll lock — zero JS for those concerns.
  // Progressive disclosure happens via CSS attribute matching on
  // [data-choice] and [data-pill-something-else] — the JS handler
  // only flips those attributes on radio/checkbox change.
  const modal = vm.editorial.business_closing_modal;
  const pills = vm.editorial.business_closing_pills;

  // `required` on the first radio enforces "must pick one" via native
  // browser validation (radio groups inherit required from any input).
  // No JS for this guard — the browser blocks submit + focuses the
  // group with a built-in tooltip on submit attempt.
  const choices = modal.choices
    .map(
      (choice, i) => `
        <label class="closing-modal-choice-row">
          <input type="radio" name="choice" value="${choice.value}"${i === 0 ? ' required' : ''}>
          <span class="closing-modal-choice-text">
            <span class="closing-modal-choice-label">${escapeHtml(choice.label)}</span>
            <span class="closing-modal-choice-body">${escapeHtml(choice.body)}</span>
          </span>
        </label>
      `
    )
    .join('');

  const cadence = modal.cadence_options
    .map(
      (opt, i) => `
        <label><input type="radio" name="cadence" value="${opt.value}"${i === 0 ? ' checked' : ''}> ${escapeHtml(opt.label)}</label>
      `
    )
    .join('');

  const pillOptions = pills
    .map(
      (pill) => `
        <label class="closing-modal-pill-row">
          <input
            type="checkbox"
            name="pill"
            value="${pill.pill_id}"
            ${pill.collects_freeform_text ? 'data-collects-freeform-text="true"' : ''}
          >
          <span>${escapeHtml(pill.label)}</span>
        </label>
      `
    )
    .join('');

  return `
    <dialog
      id="closing-modal"
      class="closing-modal"
      data-choice=""
      data-pill-something-else=""
      aria-labelledby="closing-modal-title"
    >
      <form class="closing-modal-form" data-closing-modal-form>
        <header class="closing-modal-header">
          <h2 id="closing-modal-title" class="closing-modal-title">${escapeHtml(modal.title)}</h2>
          <p class="closing-modal-lede">${escapeHtml(modal.lede)}</p>
          <button
            type="button"
            class="closing-modal-dismiss"
            data-closing-modal-dismiss
            aria-label="${escapeHtml(modal.dismiss_label)}"
          >×</button>
        </header>

        <fieldset class="closing-modal-choice">
          <legend>${escapeHtml(modal.choice_legend)}</legend>
          ${choices}
        </fieldset>

        <fieldset class="closing-modal-cadence" data-when-choice="monitoring">
          <legend>${escapeHtml(modal.cadence_legend)}</legend>
          ${cadence}
        </fieldset>

        <fieldset class="closing-modal-pills" data-when-choice="something_else">
          <legend>${escapeHtml(modal.pills_legend)}</legend>
          ${pillOptions}
        </fieldset>

        <label class="closing-modal-freeform" data-when-choice="something_else" data-when-pill="something_else">
          <span>${escapeHtml(modal.freeform_label)}</span>
          <textarea
            name="freeform_text"
            maxlength="200"
            rows="2"
            placeholder="${escapeHtml(modal.freeform_placeholder)}"
          ></textarea>
        </label>

        <label class="closing-modal-email" data-when-choice="pi_early_access rapid_fix monitoring something_else">
          <span class="closing-modal-email-label">${escapeHtml(modal.email_label)}</span>
          <input
            type="email"
            name="email"
            maxlength="254"
            autocomplete="email"
            inputmode="email"
            placeholder="${escapeHtml(modal.email_placeholder)}"
            aria-describedby="closing-modal-email-caption"
          >
          <span
            id="closing-modal-email-caption"
            class="closing-modal-email-caption"
          >${escapeHtml(modal.email_caption)}</span>
        </label>

        <div class="closing-modal-actions">
          <button type="submit" class="closing-modal-submit" data-closing-modal-submit>${escapeHtml(modal.submit_label)}</button>
        </div>

        <p class="closing-modal-confirmation" role="status" hidden data-closing-modal-confirmation>
          ${escapeHtml(modal.confirmation_text)}
        </p>
      </form>
    </dialog>
  `;
}

export function renderBusinessSection(vm: ReportViewModel): string {
  const useLedger = vm.act4_impact_rows.length >= 2;

  return `
    <section id="business" class="section" data-tone="paper" aria-labelledby="business-eyebrow">
      <div class="section-inner">
        <div class="act-intro">
          <div class="act-intro-stack">
            ${renderReveal(`<div id="business-eyebrow" class="act-intro-eyebrow"><span class="dot"></span>Act 04 · KPI translation</div>`)}
            ${renderReveal(vm.editorial.business_headline_html, { delay: 120 })}
            ${renderReveal(`<p class="act-intro-lede">${escapeHtml(vm.editorial.act4_lede)}</p>`, { delay: 240 })}
          </div>
        </div>

        <div class="block">
          ${renderReveal(
            `<div class="section-eyebrow-stack">
              <h3 class="section-eyebrow">${escapeHtml(vm.editorial.business_section_eyebrow)}</h3>
              <p class="section-boundary-lede">${vm.editorial.business_section_boundary_lede}</p>
            </div>`
          )}
          ${
            useLedger
              ? vm.act4_impact_rows
                  .map((row, i) => renderReveal(renderImpactRow(row), { as: 'card', delay: i * 80 }))
                  .join('')
              : renderReveal(renderSummaryFallback(vm.act4_summary_points))
          }
        </div>

        ${renderClosingTrigger(vm)}
      </div>
    </section>
  `.trim();
}
