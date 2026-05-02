// Section `business` (Act 04) — KPI ledger + needs-inquiry closing.
// Translates measured findings into the reader's KPI vocabulary, then
// hands off through three co-equal cards anchored on the boundary
// statement. Diagnostic-only — no prescription, no exclusion language,
// no sales register.
//
// Visual register discipline (load-bearing, see plan file):
// - Closing cards use the same .figure surface as the rest of the
//   section. NO accent backgrounds. NO accent borders. NO button chrome.
// - CTAs are mono-text-link, NOT styled buttons.
// - Pill row sits at body-copy weight; pills are inline links, not
//   buttons.
// - Confirmation copy stays in observation register (✓ noted, not
//   Thanks! / You're in!).

import { renderHeroValue, renderReveal, renderTerm } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import type { ReportAct4ImpactRow, ReportClosingCard, ReportViewModel } from '../report-view-model.js';

function renderImpactRow(row: ReportAct4ImpactRow): string {
  const kpiLabels = row.kpi_label
    .split(' · ')
    .map((k) => k.trim())
    .filter(Boolean);
  return `
    <div class="figure" style="display:grid;grid-template-columns:minmax(120px,140px) 1fr;gap:24px;align-items:center;">
      <div>
        <div class="figure-stat" style="font-size:clamp(32px,3vw + 12px,48px);">${renderHeroValue(row.metric_value)}</div>
        <div class="figure-eyebrow" style="margin-top:6px;text-transform:none;letter-spacing:0.04em;">${escapeHtml(
          row.metric_label
        )}</div>
      </div>
      <div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          ${kpiLabels.map((k) => `<span class="kpi-pill">${escapeHtml(k)}</span>`).join('')}
        </div>
        <p style="margin:0;font-size:14px;color:var(--ink-soft);line-height:1.55;text-wrap:pretty;">${row.impact_sentence_html}${
          row.glossary_key ? ` ${renderTerm(row.glossary_key, '↗')}` : ''
        }</p>
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

function renderClosingCard(card: ReportClosingCard): string {
  // The whole card is interactive. Two card shapes:
  //   - cta_href set (Rapid Fix) — single text-link CTA; click logs
  //     intent then redirects to the booking page
  //   - cta_href null (PI / Monitoring) — email field (and optional
  //     cadence selector) visible from the start; click on Send
  //     submits the event with all data in one go and transforms the
  //     card to a quiet confirmation
  // No two-stage anonymous-then-followup dance — the click IS the
  // submit. Cleaner UX, less dishonest copy at the in-between step.
  const dataAttrs = [
    `data-closing-card="${card.id}"`,
    `data-intent-kind="${card.intent_kind}"`,
    `data-cta-href="${card.cta_href ? escapeHtml(card.cta_href) : ''}"`,
    `data-collects-email="${card.collects_email ? 'true' : 'false'}"`,
    `data-collects-cadence="${card.collects_cadence ? 'true' : 'false'}"`
  ].join(' ');

  return `
    <div class="closing-card" ${dataAttrs} data-state="idle">
      <div class="closing-card-eyebrow">${escapeHtml(card.eyebrow)}</div>
      <h3 class="closing-card-title">${escapeHtml(card.title)}</h3>
      <p class="closing-card-body">${escapeHtml(card.body)}</p>
      ${
        card.cta_href
          ? `
            <a class="closing-card-cta" href="${escapeHtml(card.cta_href)}" data-closing-cta>${escapeHtml(card.cta_label)} →</a>
            ${card.small_note ? `<p class="closing-card-note">${escapeHtml(card.small_note)}</p>` : ''}
          `
          : `
            <form class="closing-card-form" data-closing-form>
              ${
                card.collects_cadence
                  ? `
                    <fieldset class="closing-card-cadence" data-closing-cadence>
                      <legend>Cadence</legend>
                      <label><input type="radio" name="cadence-${card.id}" value="weekly" checked> weekly</label>
                      <label><input type="radio" name="cadence-${card.id}" value="monthly"> monthly</label>
                    </fieldset>
                  `
                  : ''
              }
              ${
                card.collects_email
                  ? `
                    <label class="closing-card-email-label" for="closing-email-${card.id}">
                      <span>your email</span>
                      <input
                        id="closing-email-${card.id}"
                        type="email"
                        data-closing-email
                        placeholder="you@company.com"
                        autocomplete="email"
                        inputmode="email"
                        maxlength="254"
                        required
                      >
                    </label>
                  `
                  : ''
              }
              <button type="submit" class="closing-card-cta" data-closing-cta>${escapeHtml(card.cta_label)}</button>
            </form>
            ${card.small_note ? `<p class="closing-card-note">${escapeHtml(card.small_note)}</p>` : ''}
          `
      }
      <!-- Confirmation slot — replaces the form + note when state flips to "logged" -->
      <div class="closing-card-confirmation" role="status" hidden>
        <p class="closing-card-confirmation-text" data-closing-confirmation-text>✓ noted — we will be in touch</p>
      </div>
    </div>
  `;
}

function renderClosingMultiselect(vm: ReportViewModel): string {
  // Native HTML disclosure (<details>) used as a clean multi-select
  // dropdown. Checkbox per option. The "something else" option reveals
  // a 200-char textarea on check (handled by intent-telemetry.ts).
  // Single Send button submits N intent events — one per checked
  // option. No JS required for the dropdown itself.
  const pills = vm.editorial.business_closing_pills;
  const options = pills
    .map(
      (pill) => `
        <label class="closing-multiselect-option">
          <input
            type="checkbox"
            name="closing-pill"
            value="${pill.pill_id}"
            data-collects-freeform-text="${pill.collects_freeform_text ? 'true' : 'false'}"
          >
          <span>${escapeHtml(pill.label)}</span>
        </label>
      `
    )
    .join('');

  return `
    <form class="closing-multiselect" data-closing-multiselect data-state="idle">
      <p class="closing-multiselect-lead-in">${escapeHtml(vm.editorial.business_closing_pill_lead_in)}</p>
      <details class="closing-multiselect-details">
        <summary class="closing-multiselect-summary">
          <span data-closing-multiselect-label>Choose any that apply</span>
          <span class="closing-multiselect-chevron" aria-hidden="true">▾</span>
        </summary>
        <div class="closing-multiselect-options">
          ${options}
        </div>
      </details>
      <label class="closing-multiselect-freeform" data-closing-multiselect-freeform hidden>
        <span>Tell us more</span>
        <textarea
          maxlength="200"
          rows="2"
          placeholder="What would actually help? (200 chars max)"
          data-closing-multiselect-freeform-text
        ></textarea>
      </label>
      <button type="submit" class="closing-card-cta closing-multiselect-send" data-closing-multiselect-send>send</button>
      <div class="closing-multiselect-confirmation" role="status" hidden>
        <p class="closing-card-confirmation-text" data-closing-multiselect-confirmation-text>✓ thanks — noted</p>
      </div>
    </form>
  `;
}

function renderClosingRouter(vm: ReportViewModel): string {
  // Bridge composes the canonical boundary statement (verbatim, single
  // source of truth) + the needs-inquiry question. Anchors the cards
  // below as the honest extension of what the report did and did not do.
  return `
    <div class="closing-router">
      ${renderReveal(
        `<p class="closing-bridge">${escapeHtml(vm.boundary_statement)} ${vm.editorial.business_closing_bridge_html}</p>`
      )}
      <div class="closing-card-grid">
        ${vm.editorial.business_closing_cards
          .map((card, i) => renderReveal(renderClosingCard(card), { delay: i * 80 }))
          .join('')}
      </div>
      ${renderReveal(renderClosingMultiselect(vm), { delay: 240 })}
    </div>
  `;
}

export function renderBusinessSection(vm: ReportViewModel): string {
  const useLedger = vm.act4_impact_rows.length >= 2;

  return `
    <section id="business" class="section" data-tone="paper" aria-labelledby="business-eyebrow">
      <div class="section-inner">
        <div class="act-intro" style="padding-block:0;">
          <div class="act-intro-stack">
            ${renderReveal(`<div id="business-eyebrow" class="act-intro-eyebrow"><span class="dot"></span>Act 04 · KPI translation</div>`)}
            ${renderReveal(vm.editorial.business_headline_html, { delay: 120 })}
            ${renderReveal(`<p class="act-intro-lede">${escapeHtml(vm.act4_lede)}</p>`, { delay: 240 })}
          </div>
        </div>

        <div class="block">
          ${renderReveal(`<div class="section-eyebrow">${escapeHtml(vm.editorial.business_section_eyebrow)}</div>`)}
          ${
            useLedger
              ? vm.act4_impact_rows
                  .map((row, i) => renderReveal(renderImpactRow(row), { as: 'card', delay: i * 80 }))
                  .join('')
              : renderReveal(renderSummaryFallback(vm.act4_summary_points))
          }
        </div>

        ${renderClosingRouter(vm)}
      </div>
    </section>
  `.trim();
}
