// Section `cover` (Act 00) — editorial masthead.
// Origin hero, sessions counter, classified-share, three KPI cards,
// audience tier preview strip. Sets up the rest of the narrative.

import { renderHeroValue, renderReveal, renderTerm } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import type { ReportViewModel } from '../report-view-model.js';

const TIER_COLOR_VAR: Record<string, string> = {
  urban: 'var(--tier-urban)',
  moderate: 'var(--tier-moderate)',
  constrained_moderate: 'var(--tier-cmoderate)',
  constrained: 'var(--tier-constrained)',
  unknown: 'var(--tier-unknown)'
};

function tierStripSegment(t: { key: string; label: string; share: number }): string {
  const color = TIER_COLOR_VAR[t.key] ?? 'var(--tier-unknown)';
  return `
    <div
      style="flex:${t.share};background:${color};display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(0,0,0,0.18);"
      title="${escapeHtml(t.label)} · ${Math.round(t.share * 100)}%"
    >
      <span class="mono" style="font-size:13px;color:#fff;font-weight:700;letter-spacing:0.02em;text-shadow:0 1px 2px rgba(0,0,0,0.45);">${Math.round(
        t.share * 100
      )}%</span>
    </div>
  `;
}

function tierLegendItem(t: { key: string; label: string }): string {
  const color = TIER_COLOR_VAR[t.key] ?? 'var(--tier-unknown)';
  return `
    <div class="row" style="display:flex;gap:6px;align-items:center;">
      <span style="width:8px;height:8px;background:${color};border-radius:2px;"></span>
      <span class="mono" style="color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.08em;font-size:10px;">${escapeHtml(
        t.label
      )}</span>
    </div>
  `;
}

export function renderCoverSection(vm: ReportViewModel): string {
  const tiers = vm.act1_tiers.map((t) => ({
    key: t.key,
    label: t.label,
    share: t.share / 100
  }));
  const slowerThanUrbanShare = 1 - (vm.act1_tiers.find((t) => t.key === 'urban')?.share ?? 0) / 100;

  return `
    <section id="cover" class="section" data-tone="paper" style="padding-block:0;">
      <div class="section-inner" style="gap:var(--stack-2xl);">
        <div class="act-intro">
          <div class="act-intro-stack">
            ${renderReveal(
              `<div class="act-intro-eyebrow" style="display:inline-flex;padding:6px 14px;border:1px solid var(--line-strong);border-radius:999px;background:color-mix(in oklab, var(--bg-2) 50%, transparent);width:fit-content;">
                <span class="dot"></span>
                ${escapeHtml(vm.hero_kicker)}
              </div>`
            )}
            ${renderReveal(
              `<h1 class="display" style="margin:0;font-size:clamp(56px,8vw + 16px,132px);font-weight:400;letter-spacing:-0.045em;line-height:0.94;">${escapeHtml(
                vm.hero_title
              )}</h1>`,
              { delay: 120 }
            )}
            ${renderReveal(
              `<div class="mono" style="font-size:13px;color:var(--ink-mute);">
                ${renderHeroValue(String(vm.sample_size), { countTo: true, delayMs: 400 })} sessions measured over <span style="color:var(--ink);">${vm.period_days} day${vm.period_days === 1 ? '' : 's'}</span> · ${Math.round(
                  vm.credibility_strip.classified_share
                )}% ${renderTerm('classified')}
              </div>`,
              { delay: 240 }
            )}
            ${renderReveal(`<p class="act-intro-lede" style="max-width:52ch;">${escapeHtml(vm.hero_lede)}</p>`, {
              delay: 360
            })}
          </div>
        </div>

        <div class="block" style="gap:var(--stack-md);">
          ${renderReveal(
            `<div class="block-header">
              <div class="section-eyebrow">At a glance</div>
              <p class="section-lede">${escapeHtml(vm.editorial.cover_at_a_glance_lede)}</p>
            </div>`
          )}
          <div class="grid-3">
            ${renderReveal(
              `<div class="figure">
                <div class="figure-eyebrow" style="color:var(--accent);">The headline</div>
                <div class="figure-stat">${renderHeroValue(`${Math.round(slowerThanUrbanShare * 100)}%`, {
                  countTo: true,
                  delayMs: 150,
                  durationMs: 900
                })}</div>
                <div class="figure-cap">${escapeHtml(vm.editorial.cover_headline_card_caption)}</div>
              </div>`,
              { as: 'card', delay: 80 }
            )}
            ${renderReveal(
              `<div class="figure">
                <div class="figure-eyebrow">The audience</div>
                <div class="figure-stat" style="color:var(--ink);">${renderHeroValue(String(vm.sample_size), {
                  countTo: true,
                  delayMs: 250,
                  durationMs: 900
                })}</div>
                <div class="figure-cap">real sessions measured · ${Math.round(vm.credibility_strip.classified_share)}% ${renderTerm(
                  'classified'
                )} into a tier</div>
              </div>`,
              { as: 'card', delay: 180 }
            )}
            ${renderReveal(
              `<div class="figure">
                <div class="figure-eyebrow">The window</div>
                <div class="figure-stat" style="color:var(--ink);">${vm.period_days}d</div>
                <div class="figure-cap">measured · refreshed ${
                  vm.freshness_known
                    ? escapeHtml(new Date(vm.generated_at).toISOString().slice(0, 10))
                    : 'date not provided'
                }</div>
              </div>`,
              { as: 'card', delay: 280 }
            )}
          </div>
        </div>

        ${renderReveal(
          `<div>
            <div class="section-eyebrow" style="margin-bottom:12px;">How the audience splits, at a glance</div>
            <div style="display:flex;height:36px;border-radius:var(--r-2);overflow:hidden;border:1px solid var(--line);">
              ${tiers.map(tierStripSegment).join('')}
            </div>
            <div style="display:flex;margin-top:10px;gap:16px;flex-wrap:wrap;font-size:10px;">
              ${tiers.map(tierLegendItem).join('')}
            </div>
          </div>`
        )}
      </div>
      <div style="height:var(--section-py);"></div>
    </section>
  `.trim();
}
