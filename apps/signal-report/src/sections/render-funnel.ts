// Section `funnel` (Act 03) — measured experience funnel.
// Headline poor-share, three stage rows with animated bars, three detail
// cards translating each stage into KPI exposure.

import { renderHeroValue, renderReveal, renderTerm } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import type { ReportExperienceStageViewModel, ReportViewModel } from '../report-view-model.js';

const STAGE_TERM: Record<string, Parameters<typeof renderTerm>[0]> = {
  fcp: 'fcp',
  lcp: 'lcp',
  inp: 'inp'
};

function renderStageRow(stage: ReportExperienceStageViewModel, index: number): string {
  const num = String(index + 1).padStart(2, '0');
  const widthPct = Math.max(0, Math.min(100, stage.weighted_poor_share));
  return `
    <div class="block stack-sm" style="display:grid;grid-template-columns:auto 1fr auto;gap:var(--stack-md);align-items:center;">
      <div class="mono" style="font-size:13px;color:var(--ink-faint);">${num}</div>
      <div>
        <div class="row-between" style="margin-bottom:6px;">
          <span style="font-size:14px;color:var(--ink);">${renderTerm(STAGE_TERM[stage.key] ?? 'lcp', stage.label)}</span>
          <span class="mono" style="font-size:11px;color:var(--ink-mute);">${escapeHtml(stage.threshold_label)}</span>
        </div>
        <div class="funnel-bar-track" style="--bar-w:${widthPct}%;--bar-delay:${index * 120}ms;">
          <div class="funnel-bar-fill"></div>
        </div>
      </div>
      <div class="mono" style="font-size:14px;color:var(--ink);text-align:right;font-variant-numeric:tabular-nums;">${Math.round(
        stage.weighted_poor_share
      )}%</div>
    </div>
  `;
}

function renderStageDetail(stage: ReportExperienceStageViewModel, index: number): string {
  const term = STAGE_TERM[stage.key] ?? 'lcp';
  return `
    <div class="figure">
      <div class="figure-eyebrow">${renderTerm(term, stage.label)}</div>
      <div class="figure-stat">${renderHeroValue(`${Math.round(stage.weighted_poor_share)}%`, {
        countTo: true,
        delayMs: index * 120,
        durationMs: 900
      })}</div>
      <div class="figure-cap">${escapeHtml(stage.descriptor)}</div>
      ${
        stage.chips.length > 0
          ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--stack-sm);">
              ${stage.chips
                .map(
                  (chip) =>
                    `<span class="kpi-pill" style="background:color-mix(in oklab, var(--ink-mute) 12%, transparent);color:var(--ink-soft);border-color:var(--line);">${escapeHtml(
                      chip.label
                    )} · ${Math.round(chip.poor_share)}%</span>`
                )
                .join('')}
            </div>`
          : ''
      }
    </div>
  `;
}

export function renderFunnelSection(vm: ReportViewModel): string {
  const act3 = vm.act3;
  const overallPoorShare = act3.poor_session_share ?? 0;

  return `
    <section id="funnel" class="section" data-tone="cream">
      <div class="section-inner">
        <div class="act-intro" style="padding-block:0;">
          <div class="act-intro-stack">
            ${renderReveal(`<div class="act-intro-eyebrow"><span class="dot"></span>Act 03 · Where the page becomes too late</div>`)}
            ${renderReveal(`<h1>Where the page <span class="duotone-text">becomes too late.</span></h1>`, {
              delay: 120
            })}
            ${renderReveal(
              `<p class="act-intro-lede">A meaningful share of your sessions cross into ${renderTerm(
                'poor',
                'poor performance'
              )} territory — first at the moment of paint, again at hero content, and finally at first interaction. Stage by stage, intent leaks out before the page has caught up.</p>`,
              { delay: 240 }
            )}
          </div>
        </div>

        ${
          act3.mode === 'legacy'
            ? `<div class="figure"><p class="section-lede">${escapeHtml(act3.legacy_message ?? '')}</p></div>`
            : `
              <div class="block">
                ${renderReveal(
                  `<div class="figure">
                    <div class="figure-eyebrow">Headline</div>
                    <div class="figure-stat">${renderHeroValue(`${Math.round(overallPoorShare)}%`, {
                      countTo: true,
                      delayMs: 100,
                      durationMs: 900
                    })}</div>
                    <div class="figure-cap">of measured sessions cross into ${renderTerm(
                      'poor',
                      'poor performance'
                    )} on at least one stage. Threshold basis: ${escapeHtml(act3.threshold_basis)}.</div>
                  </div>`
                )}
                ${renderReveal(`<div class="section-eyebrow">Stage progression</div>`)}
                <div class="stack stack-md">${act3.stages.map((s, i) => renderReveal(renderStageRow(s, i))).join('')}</div>
              </div>

              <div class="block">
                ${renderReveal(`<div class="section-eyebrow">Per-stage detail</div>`)}
                <div class="grid-3">
                  ${act3.stages.map((s, i) => renderReveal(renderStageDetail(s, i), { as: 'card', delay: i * 80 })).join('')}
                </div>
              </div>
            `
        }
      </div>
    </section>
  `.trim();
}
