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
import type {
  ReportAct4ImpactRow,
  ReportClosingCard,
  ReportClosingPill,
  ReportViewModel
} from '../report-view-model.js';

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
  // The whole card is interactive (clicking the body or the CTA fires
  // intent telemetry via the boot helper). Data attributes carry every
  // hint the boot helper needs to construct the wire payload + manage
  // the in-place transform without a framework runtime.
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
          ? `<a class="closing-card-cta" href="${escapeHtml(card.cta_href)}" data-closing-cta>${escapeHtml(card.cta_label)} →</a>`
          : `<button type="button" class="closing-card-cta" data-closing-cta>${escapeHtml(card.cta_label)}</button>`
      }
      ${card.small_note ? `<p class="closing-card-note">${escapeHtml(card.small_note)}</p>` : ''}
      <!-- Confirmation slot — replaces the CTA + note when state flips to "logged" -->
      <div class="closing-card-confirmation" hidden>
        <p class="closing-card-confirmation-text" data-closing-confirmation-text>✓ noted</p>
        ${
          card.collects_email || card.collects_cadence
            ? `
              <div class="closing-card-followup" data-closing-followup>
                ${
                  card.collects_cadence
                    ? `
                      <fieldset class="closing-card-cadence" data-closing-cadence>
                        <legend>Cadence</legend>
                        <label><input type="radio" name="cadence-${card.id}" value="weekly" checked> weekly</label>
                        <label><input type="radio" name="cadence-${card.id}" value="daily"> daily</label>
                      </fieldset>
                    `
                    : ''
                }
                ${
                  card.collects_email
                    ? `
                      <label class="closing-card-email-label">
                        <span>email when it ships</span>
                        <input type="email" data-closing-email placeholder="you@company.com" autocomplete="email" maxlength="254">
                      </label>
                    `
                    : ''
                }
                <button type="button" class="closing-card-followup-send" data-closing-followup-send>send</button>
              </div>
            `
            : ''
        }
      </div>
    </div>
  `;
}

function renderClosingPill(pill: ReportClosingPill): string {
  return `
    <button
      type="button"
      class="closing-pill"
      data-closing-pill="${pill.pill_id}"
      data-collects-freeform-text="${pill.collects_freeform_text ? 'true' : 'false'}"
      data-state="idle"
    >${escapeHtml(pill.label)}</button>
  `;
}

function renderClosingRouter(vm: ReportViewModel): string {
  const pills = vm.editorial.business_closing_pills.map(renderClosingPill).join('');

  return `
    <div class="closing-router">
      ${renderReveal(`<p class="closing-bridge">${vm.editorial.business_closing_bridge_html}</p>`)}
      <div class="closing-card-grid">
        ${vm.editorial.business_closing_cards
          .map((card, i) => renderReveal(renderClosingCard(card), { delay: i * 80 }))
          .join('')}
      </div>
      ${renderReveal(
        `<div class="closing-pill-row">
          <span class="closing-pill-lead-in">${escapeHtml(vm.editorial.business_closing_pill_lead_in)}</span>
          ${pills}
        </div>`,
        { delay: 240 }
      )}
    </div>
  `;
}

export function renderBusinessSection(vm: ReportViewModel): string {
  const useLedger = vm.act4_impact_rows.length >= 2;

  return `
    <section id="business" class="section" data-tone="paper">
      <div class="section-inner">
        <div class="act-intro" style="padding-block:0;">
          <div class="act-intro-stack">
            ${renderReveal(`<div class="act-intro-eyebrow"><span class="dot"></span>Act 04 · KPI translation</div>`)}
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

        ${renderReveal(
          `<div style="margin-top:var(--stack-xl);padding-top:var(--stack-md);border-top:1px solid var(--line);">
            <p class="muted" style="font-size:11px;text-align:center;font-family:var(--font-mono);letter-spacing:0.06em;">${escapeHtml(
              vm.boundary_statement
            )}</p>
          </div>`
        )}
      </div>
    </section>
  `.trim();
}
