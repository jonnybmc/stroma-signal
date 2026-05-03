// Section `distance` (Act 02) — the measured race.
// Race lanes (urban vs comparison_tier with wait-delta counter), LCP
// subparts breakdown, Paid-Media impact ledger anchored to glossary.

import { renderHeroValue, renderReveal, renderTerm } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import type { ReportLcpSubpartRow, ReportRaceViewModel, ReportViewModel } from '../report-view-model.js';

function renderRacePhone(tone: 'cyan' | 'accent', label: string, finalSeconds: string, durationMs: number): string {
  return `
    <div class="race-phone" data-tone="${tone}" style="--race-duration:${durationMs}ms;">
      <div class="race-phone-label">${escapeHtml(label)}</div>
      <div class="race-phone-frame">
        <div class="race-phone-notch"></div>
        <div class="race-phone-fill"></div>
        <div class="race-phone-wireframe">
          <div class="race-phone-wf-hero"></div>
          <div class="race-phone-wf-line"></div>
          <div class="race-phone-wf-line race-phone-wf-line-medium"></div>
          <div class="race-phone-wf-line race-phone-wf-line-long"></div>
          <div class="race-phone-wf-button"></div>
        </div>
      </div>
      <div class="race-phone-time">${renderHeroValue(finalSeconds)}</div>
    </div>
  `;
}

function renderRaceCenter(deltaMs: number | null, deltaLabel: string, urbanMs: number, comparisonMs: number): string {
  if (deltaMs == null) {
    return `
      <div class="race-center" style="text-align:center;">
        <div class="eyebrow">Wait delta</div>
        <div class="race-center-counter" style="color:var(--ink-mute);">n/a</div>
      </div>
    `;
  }
  const deltaSeconds = (deltaMs / 1000).toFixed(1);
  // Counter starts AFTER urban completes and runs UNTIL comparison completes —
  // the visible tween is the felt wait gap between the two phones.
  const counterDelayMs = urbanMs + 100;
  const counterDurationMs = Math.max(400, comparisonMs - urbanMs);
  return `
    <div class="race-center" style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:var(--stack-xs);">
      <div class="eyebrow">Wait delta</div>
      <div class="race-center-counter">${renderHeroValue(`${deltaSeconds}s`, {
        countTo: true,
        delayMs: counterDelayMs,
        durationMs: counterDurationMs
      })}</div>
      <div class="mono" style="font-size:11px;color:var(--ink-mute);max-width:240px;text-wrap:pretty;line-height:1.5;">${escapeHtml(
        deltaLabel
      )}</div>
    </div>
  `;
}

function renderRaceBlock(race: ReportRaceViewModel): string {
  if (!race.race_available) {
    return `
      <div class="figure">
        <div class="figure-eyebrow">${escapeHtml(race.fallback_label)}</div>
        <p class="section-lede">${escapeHtml(race.race_story)}</p>
      </div>
    `;
  }

  const urbanMs = race.urban_ms ?? 0;
  const comparisonMs = race.comparison_ms ?? 0;
  const urbanSeconds = `${(urbanMs / 1000).toFixed(1)}s`;
  const comparisonSeconds = `${(comparisonMs / 1000).toFixed(1)}s`;

  return `
    <div class="figure" style="padding:clamp(24px,3vw,40px);">
      <div class="race-grid">
        ${renderRacePhone('cyan', `Urban · ${race.metric_label} p75`, urbanSeconds, urbanMs)}
        ${renderRaceCenter(
          race.wait_delta_ms,
          `${escapeHtml(race.comparison_label)} users wait this much longer than urban, every visit.`,
          urbanMs,
          comparisonMs
        )}
        ${renderRacePhone(
          'accent',
          `${race.comparison_label} · ${race.metric_label} p75`,
          comparisonSeconds,
          comparisonMs
        )}
      </div>
    </div>
  `;
}

function renderLcpSubparts(rows: ReportLcpSubpartRow[]): string {
  if (rows.length === 0) return '';
  const total = rows.reduce((sum, r) => sum + r.share, 0) || 1;
  const colorByKey: Record<string, string> = {
    ttfb: '#a09c95',
    resource_load_delay: '#807870',
    resource_load_time: 'var(--accent)',
    element_render_delay: 'var(--red)'
  };

  const bar = rows
    .map((r) => `<div style="flex:${r.share / total};background:${colorByKey[r.key] ?? 'var(--ink-mute)'};"></div>`)
    .join('');

  const cells = rows
    .map((r) => {
      const isRender = r.key === 'element_render_delay';
      const isTtfb = r.key === 'ttfb';
      const color = colorByKey[r.key] ?? 'var(--ink-mute)';
      const labelHtml = isTtfb
        ? renderTerm('ttfb', r.label)
        : isRender
          ? renderTerm('renderdelay', r.label)
          : escapeHtml(r.label);
      return `
        <div>
          <div class="mono" style="font-size:clamp(20px,1.5vw + 10px,28px);color:${color};font-family:var(--font-display);line-height:1;font-weight:500;">${Math.round(
            (r.share / total) * 100
          )}%</div>
          <div class="eyebrow" style="margin-top:4px;font-size:10px;">${labelHtml}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="figure">
      <div class="figure-eyebrow">Where the gap lives · LCP subparts</div>
      <div style="display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--bg-3);margin-top:16px;">${bar}</div>
      <div style="display:grid;grid-template-columns:repeat(${rows.length},1fr);gap:8px;margin-top:18px;">${cells}</div>
    </div>
  `;
}

function renderPaidMediaImpact(vm: ReportViewModel): string {
  // Educational consequence cells — pull from race wait-delta + LCP story
  // dominant subpart. Pure presentation; no commercial modelling.
  // Magnitudes are banded by wait_delta to avoid alarmist phrasing on
  // contained datasets and underclaim on severe ones.
  const race = vm.race;
  const eyebrow = vm.editorial.distance_paid_media_eyebrow;

  if (!race.race_available) {
    // Honest fallback — no delta to cost. We render the editorial
    // explanation instead of a fabricated impact ledger.
    return `
      <div class="figure">
        <div class="figure-eyebrow">${escapeHtml(eyebrow)}</div>
        <p class="section-lede" style="margin-top:var(--stack-sm);">${escapeHtml(
          vm.editorial.distance_paid_media_unavailable_message ?? ''
        )}</p>
      </div>
    `;
  }

  const cells: Array<{ label: string; value: string; term: string | null }> = [];
  const deltaMs = race.wait_delta_ms ?? 0;

  // Three bands — contained / visible / severe. The labels stay diagnostic;
  // the magnitudes scale with the measured delta rather than asserting a
  // single industry headline regardless of severity.
  if (deltaMs < 900) {
    cells.push({ label: 'Quality Score impact', value: 'sub-tier', term: 'qs' });
    cells.push({ label: 'CPC pressure (Google)', value: 'negligible at this delta', term: 'cpc' });
    cells.push({ label: 'Mobile bounce per +1s of delta', value: '+12%', term: null });
  } else if (deltaMs < 2200) {
    cells.push({ label: 'Quality Score impact', value: '−1 tier', term: 'qs' });
    cells.push({ label: 'CPC pressure (Google)', value: '+8 to +14%', term: 'cpc' });
    cells.push({ label: 'Mobile bounce per +1s of delta', value: '+24%', term: null });
  } else {
    cells.push({ label: 'Quality Score impact', value: '−1 to −2 tiers', term: 'qs' });
    cells.push({ label: 'CPC pressure (Google)', value: '+12 to +20%', term: 'cpc' });
    cells.push({ label: 'Mobile bounce per +1s of delta', value: '+32%', term: null });
  }

  if (race.lcp_story?.dominant_subpart === 'element_render_delay') {
    cells.push({ label: 'Render-delay dominance', value: 'script-bound', term: 'renderdelay' });
  }

  const rows = cells
    .map((c, i, arr) => {
      const isLast = i === arr.length - 1;
      const labelHtml = c.term ? renderTerm(c.term as Parameters<typeof renderTerm>[0], c.label) : escapeHtml(c.label);
      return `
        <div class="row-between" style="padding:12px 0;${isLast ? '' : 'border-bottom:1px solid var(--line);'}">
          <span style="font-size:13px;color:var(--ink-soft);">${labelHtml}</span>
          <span class="mono" style="color:var(--accent);">${escapeHtml(c.value)}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="figure">
      <div class="figure-eyebrow">${escapeHtml(eyebrow)}</div>
      <div style="margin-top:8px;">${rows}</div>
    </div>
  `;
}

export function renderDistanceSection(vm: ReportViewModel): string {
  const race = vm.race;
  return `
    <section id="distance" class="section" data-tone="paper" aria-labelledby="distance-eyebrow">
      <div class="section-inner">
        <div class="act-intro">
          <div class="act-intro-stack">
            ${renderReveal(`<div id="distance-eyebrow" class="act-intro-eyebrow"><span class="dot"></span>Act 02 · Temporal comparison</div>`)}
            ${renderReveal(vm.editorial.distance_headline_html, { delay: 120 })}
            ${renderReveal(`<p class="act-intro-lede">${escapeHtml(vm.editorial.distance_lede_html)}</p>`, {
              delay: 240
            })}
          </div>
        </div>

        <div class="block">
          ${
            race.race_available
              ? renderReveal(
                  `<div class="block-header">
                    <div class="row-between" style="flex-wrap:wrap;gap:12px;">
                      <h3 class="section-eyebrow">${escapeHtml(race.metric_label)} race · played in real seconds</h3>
                      <div class="mono" style="font-size:11px;color:var(--ink-mute);">${renderTerm('p75')} · ${
                        race.urban_coverage != null ? `${Math.round(race.urban_coverage)}%` : 'n/a'
                      } / ${
                        race.comparison_coverage != null ? `${Math.round(race.comparison_coverage)}%` : 'n/a'
                      } measured</div>
                    </div>
                  </div>`
                )
              : ''
          }
          ${renderReveal(renderRaceBlock(race))}
        </div>

        <div class="grid-2">
          ${race.lcp_story ? renderReveal(renderLcpSubparts(race.lcp_story.rows), { as: 'card' }) : ''}
          ${renderReveal(renderPaidMediaImpact(vm), { as: 'card', delay: 100 })}
        </div>
      </div>
    </section>
  `.trim();
}
