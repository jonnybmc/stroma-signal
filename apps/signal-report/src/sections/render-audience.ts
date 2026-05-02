// Section `audience` (Act 01) — population shape.
// Network spread table, device spread table, persona-pair (best vs
// constrained), form-factor triplet.

import { renderHeroValue, renderReveal } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import { renderIcon } from '../report-icons.js';
import type { ReportPersonaProfile, ReportViewModel } from '../report-view-model.js';

const TIER_COLOR_VAR: Record<string, string> = {
  urban: 'var(--tier-urban)',
  moderate: 'var(--tier-moderate)',
  constrained_moderate: 'var(--tier-cmoderate)',
  constrained: 'var(--tier-constrained)',
  unknown: 'var(--tier-unknown)'
};

function renderTierTable(vm: ReportViewModel): string {
  const rows = vm.act1_tiers
    .map((t) => {
      const color = TIER_COLOR_VAR[t.key] ?? 'var(--tier-unknown)';
      return `
        <div class="td td-name"><span class="rule" style="background:${color};"></span><span class="label">${escapeHtml(
          t.label
        )}</span></div>
        <div class="td td-criteria mono">${escapeHtml(criteriaForTier(t.key))}</div>
        <div class="td td-sessions">${Math.round((t.share / 100) * vm.sample_size)}</div>
        <div class="td td-share">${Math.round(t.share)}%</div>
      `;
    })
    .join('');

  return `
    <div class="data-table">
      <div class="th">Tier</div>
      <div class="th th-criteria">Criteria</div>
      <div class="th">Sessions</div>
      <div class="th" style="text-align:right;">Share</div>
      ${rows}
    </div>
  `;
}

function criteriaForTier(key: string): string {
  switch (key) {
    case 'urban':
      return '< 50ms TCP';
    case 'moderate':
      return '50–150ms TCP';
    case 'constrained_moderate':
      return '150–400ms TCP';
    case 'constrained':
      return '≥ 400ms TCP';
    default:
      return 'Not classifiable';
  }
}

function renderDeviceTable(vm: ReportViewModel): string {
  const rows = vm.act1_device_tiers
    .map((d) => {
      return `
        <div class="td td-name"><span class="rule" style="background:var(--ink-faint);"></span><span class="label">${escapeHtml(
          d.label
        )}</span></div>
        <div class="td td-criteria mono">${escapeHtml(deviceCriteriaFor(d.key))}</div>
        <div class="td td-sessions">${Math.round((d.share / 100) * vm.sample_size)}</div>
        <div class="td td-share">${Math.round(d.share)}%</div>
      `;
    })
    .join('');

  return `
    <div class="data-table">
      <div class="th">Device</div>
      <div class="th th-criteria">Criteria</div>
      <div class="th">Sessions</div>
      <div class="th" style="text-align:right;">Share</div>
      ${rows}
    </div>
  `;
}

function deviceCriteriaFor(key: string): string {
  switch (key) {
    case 'high':
      return '6+ cores · 4+ GB · 1280px+';
    case 'mid':
      return '4–6 cores · 2–4 GB · 768px+';
    case 'low':
      return '≤ 2 cores · ≤ 1 GB · < 768px';
    default:
      return '';
  }
}

function composeRowValue(value: string, note: string | null): string {
  return note ? `${escapeHtml(value)} <span class="row-note">· ${escapeHtml(note)}</span>` : escapeHtml(value);
}

function renderPersonaCard(persona: ReportPersonaProfile, accentVar: string): string {
  if (persona.is_empty) {
    return `
      <div class="figure" style="opacity:0.7;">
        <div class="figure-eyebrow">${escapeHtml(persona.label)}</div>
        <p class="section-lede">${escapeHtml(persona.empty_message)}</p>
      </div>
    `;
  }

  const rows: Array<[string, string]> = [
    ['Network', `${escapeHtml(persona.network_tier)} · ${escapeHtml(persona.network_criteria)}`],
    persona.effective_type
      ? ['Connection class', composeRowValue(persona.effective_type, persona.effective_type_note)]
      : null,
    persona.downlink_label ? ['Bandwidth', composeRowValue(persona.downlink_label, persona.downlink_note)] : null,
    persona.rtt_label ? ['Round-trip', composeRowValue(persona.rtt_label, persona.rtt_note)] : null,
    ['CPU', composeRowValue(persona.cores_label, persona.cores_note)],
    ['Memory', composeRowValue(persona.memory_label, persona.memory_note)],
    persona.browser ? ['Browser', escapeHtml(persona.browser)] : null,
    persona.save_data && persona.save_data_share > 0
      ? ['Data Saver', `${Math.round(persona.save_data_share)}% of cohort on save-data`]
      : null
  ].filter((r): r is [string, string] => r !== null);

  return `
    <div class="figure">
      <div class="figure-eyebrow" style="color:${accentVar};">${escapeHtml(persona.label)}</div>
      <div class="figure-stat" style="color:${accentVar};">${renderHeroValue(`${Math.round(persona.share)}%`)}</div>
      <div class="figure-cap" style="margin-bottom:var(--stack-md);">of measured sessions</div>
      <div class="stack stack-xs" style="font-size:13px;color:var(--ink-soft);">
        ${rows
          .map(
            ([label, value]) => `
          <div class="row-between" style="padding:4px 0;border-bottom:1px solid var(--line);">
            <span class="eyebrow" style="font-size:10px;">${label}</span>
            <span class="mono" style="font-size:12px;color:var(--ink);">${value}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderFormFactor(vm: ReportViewModel): string {
  if (!vm.form_factor || vm.form_factor.segments.length === 0) return '';
  const total = vm.form_factor.segments.reduce((sum, s) => sum + s.share, 0);
  const segments = vm.form_factor.segments.map((s) => ({ ...s, normalized: total > 0 ? s.share / total : 0 }));

  return `
    <div class="block">
      ${renderReveal(`<div class="section-eyebrow">Form factor</div>`)}
      <div class="grid-3">
        ${segments
          .map((s, i) => {
            const pct = Math.round(s.normalized * 100);
            const isEmpty = s.normalized === 0;
            return renderReveal(
              `<div class="figure" data-empty="${isEmpty ? 'true' : 'false'}"${
                isEmpty ? ' style="opacity:0.55;border-style:dashed;background:transparent;box-shadow:none;"' : ''
              }>
                <div class="figure-eyebrow">${escapeHtml(s.label)}</div>
                <div class="figure-stat" style="color:var(${isEmpty ? '--ink-faint' : '--ink'});">${
                  isEmpty
                    ? '<span class="hero-value-num">0</span><span class="hero-value-unit">%</span>'
                    : renderHeroValue(`${pct}%`, { countTo: true, delayMs: i * 80, durationMs: 900 })
                }</div>
                <div class="figure-cap">${isEmpty ? 'no sessions in this form factor' : 'of measured sessions'}</div>
              </div>`,
              { as: 'card', delay: i * 80 }
            );
          })
          .join('')}
      </div>
    </div>
  `;
}

function renderContextStrip(vm: ReportViewModel): string {
  if (!vm.act1_context_strip || vm.act1_context_strip.rows.length === 0) return '';
  const rows = vm.act1_context_strip.rows
    .map(
      (r) => `
        <div
          class="context-row"
          style="display:grid;grid-template-columns:minmax(120px,160px) 1fr;gap:var(--stack-md);padding:var(--stack-sm) 0;border-bottom:1px solid var(--line);"
        >
          <span class="eyebrow" title="${escapeHtml(r.tooltip)}">${escapeHtml(r.label)}</span>
          <span style="font-size:14px;color:var(--ink-soft);line-height:1.5;text-wrap:pretty;">${escapeHtml(
            r.narrative
          )}</span>
        </div>
      `
    )
    .join('');

  return `
    <div class="block">
      ${renderReveal(
        `<div class="block-header">
          <div class="section-eyebrow">Context that shapes the experience</div>
          <p class="section-lede">${escapeHtml(vm.editorial.audience_context_strip_lede)}</p>
        </div>`
      )}
      ${renderReveal(`<div class="figure" style="padding:var(--stack-md) var(--stack-md) calc(var(--stack-md) - 1px);">${rows}</div>`)}
    </div>
  `;
}

export function renderAudienceSection(vm: ReportViewModel): string {
  return `
    <section id="audience" class="section" data-tone="cream">
      <div class="section-inner">
        <div class="act-intro" style="padding-block:0;">
          <div class="act-intro-stack">
            ${renderReveal(`<div class="act-intro-eyebrow"><span class="dot"></span>Act 01 · Audience shape</div>`)}
            ${renderReveal(vm.editorial.audience_headline_html, { delay: 120 })}
            ${renderReveal(`<p class="act-intro-lede">${vm.editorial.audience_lede_html}</p>`, { delay: 240 })}
          </div>
        </div>

        <div class="block">
          ${renderReveal(
            `<div class="section-eyebrow with-icon">${renderIcon('wifi', 'sr-eyebrow-icon')} <span>Network spread</span></div>`
          )}
          ${renderReveal(renderTierTable(vm))}
        </div>

        <div class="block">
          ${renderReveal(
            `<div class="section-eyebrow with-icon">${renderIcon('monitorSmartphone', 'sr-eyebrow-icon')} <span>Device spread</span></div>`
          )}
          ${renderReveal(renderDeviceTable(vm))}
        </div>

        <div class="block">
          ${renderReveal(
            `<div class="block-header">
              <div class="section-eyebrow">${escapeHtml(vm.editorial.audience_persona_section_eyebrow)}</div>
              <p class="section-lede">${escapeHtml(vm.editorial.audience_persona_section_lede)}</p>
            </div>`
          )}
          <div class="cohort-pair">
            ${renderReveal(renderPersonaCard(vm.persona_contrast.best, 'var(--cyan)'), { as: 'card', delay: 80 })}
            ${renderReveal(renderPersonaCard(vm.persona_contrast.constrained, 'var(--accent)'), { as: 'card', delay: 180 })}
          </div>
        </div>

        ${renderContextStrip(vm)}

        ${renderFormFactor(vm)}
      </div>
    </section>
  `.trim();
}
