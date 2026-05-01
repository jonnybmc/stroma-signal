// Section `business` (Act 04) — KPI ledger + Rapid Fix Plan CTA.
// Translates measured findings into the reader's KPI vocabulary.
// Diagnostic-only — no prescription, no exclusion language.

import { renderHeroValue, renderReveal, renderTerm } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import type { ReportAct4ImpactRow, ReportViewModel } from '../report-view-model.js';

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

function renderRapidFixCta(vm: ReportViewModel): string {
  const offer = vm.offer_cards[0];
  if (!offer) return '';
  return `
    <div class="cta-card">
      <div class="figure-eyebrow" style="color:var(--accent);margin-bottom:8px;">Optional · Stroma engagement</div>
      <div style="font-size:22px;font-weight:500;margin-bottom:8px;font-family:var(--font-display);letter-spacing:-0.02em;">${escapeHtml(
        offer.title
      )}</div>
      <p style="margin:0;font-size:13px;color:var(--ink-soft);line-height:1.5;text-wrap:pretty;">${escapeHtml(offer.body)}</p>
      <a href="${escapeHtml(offer.href)}" class="cta-button">
        <span>${escapeHtml(offer.cta)}</span>
        <span aria-hidden="true">→</span>
      </a>
      <div class="mono" style="font-size:9.5px;margin-top:10px;color:var(--ink-mute);letter-spacing:0.08em;">
        REPORT STANDS ON ITS OWN · CTA IS OPT-IN
      </div>
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
            ${renderReveal(
              `<h1>Every number above lands on a <span class="duotone-text">KPI you're accountable for.</span></h1>`,
              { delay: 120 }
            )}
            ${renderReveal(`<p class="act-intro-lede">${escapeHtml(vm.act4_lede)}</p>`, { delay: 240 })}
          </div>
        </div>

        <div class="business-grid">
          <div class="block">
            ${renderReveal(`<div class="section-eyebrow">Where the numbers land in your KPIs</div>`)}
            ${
              useLedger
                ? vm.act4_impact_rows
                    .map((row, i) => renderReveal(renderImpactRow(row), { as: 'card', delay: i * 80 }))
                    .join('')
                : renderReveal(renderSummaryFallback(vm.act4_summary_points))
            }
          </div>

          <aside style="display:flex;flex-direction:column;gap:20px;position:sticky;top:88px;align-self:start;">
            ${renderReveal(
              `<div>
                <div class="section-eyebrow" style="margin-bottom:8px;">If you want to go deeper</div>
                <p style="margin:0;font-size:14px;color:var(--ink-soft);line-height:1.55;text-wrap:pretty;">This report proves the <em>shape</em> of the gap. Root cause, business exposure in your own currency, and fix order are the next read — and where a deeper engagement starts.</p>
              </div>`
            )}
            ${renderReveal(renderRapidFixCta(vm), { as: 'card', delay: 120 })}
            ${renderReveal(
              `<div class="figure" style="padding:20px;">
                <div class="section-eyebrow" style="margin-bottom:10px;">What this evidence enables</div>
                <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--ink-soft);line-height:1.6;">
                  <li>Bring this report into the next QBR or sprint review.</li>
                  <li>Pair tier evidence with a landing-page audit before the next paid-media review.</li>
                  <li>Ship a lighter landing-page variant for the constrained cohort.</li>
                  <li>Re-test ${renderTerm('qs')} after a hero-image fix.</li>
                </ul>
              </div>`,
              { delay: 240 }
            )}
          </aside>
        </div>

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
