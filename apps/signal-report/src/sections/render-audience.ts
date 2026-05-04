// Section `audience` (Act 01) — population shape.
// Network spread table, device spread table, persona-pair (best vs
// constrained), form-factor triplet.

import {
  formatDeviceSignature,
  formatNetworkBand,
  type SignalDeviceTier,
  type SignalNetworkTier
} from '@stroma-labs/signal-contracts';

import { renderHeroValue, renderReveal } from '../render-helpers.js';
import { escapeHtml } from '../render-utils.js';
import { renderIcon } from '../report-icons.js';
import type { ReportPersonaProfile, ReportViewModel } from '../report-view-model.js';

const NETWORK_TIER_KEYS: ReadonlySet<string> = new Set(['urban', 'moderate', 'constrained_moderate', 'constrained']);
const DEVICE_TIER_KEYS: ReadonlySet<string> = new Set(['high', 'mid', 'low']);

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
      const sharePct = Math.round(t.share);
      const sessions = Math.round((t.share / 100) * vm.sample_size);
      return `
        <tr>
          <td class="td-name" data-label="Tier"><span class="rule" style="background:${color};"></span><span class="label">${escapeHtml(
            t.label
          )}</span></td>
          <td class="td-criteria mono" data-label="Criteria">${escapeHtml(criteriaForTier(t.key))}</td>
          <td class="td-sessions" data-label="Sessions">${sessions}</td>
          <td class="td-share" data-label="Share">
            <span class="td-share-track">
              <span class="td-share-fill" style="width:${sharePct}%;background:${color};"></span>
            </span>
            <span class="td-share-value">${sharePct}%</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Tier</th>
          <th scope="col" class="th-criteria">Criteria</th>
          <th scope="col">Sessions</th>
          <th scope="col" class="th-share">Share</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function criteriaForTier(key: string): string {
  if (NETWORK_TIER_KEYS.has(key)) return formatNetworkBand(key as SignalNetworkTier);
  return 'Not classifiable';
}

function renderDeviceTable(vm: ReportViewModel): string {
  const rows = vm.act1_device_tiers
    .map((d) => {
      const sharePct = Math.round(d.share);
      const sessions = Math.round((d.share / 100) * vm.sample_size);
      // Devices don't carry a project-semantic colour the way network tiers do.
      // Use --ink-soft for the bar so the visual still reads but stays neutral
      // — the categorical signal here is the row label, not a hue.
      return `
        <tr>
          <td class="td-name" data-label="Device"><span class="rule" style="background:var(--ink-faint);"></span><span class="label">${escapeHtml(
            d.label
          )}</span></td>
          <td class="td-criteria mono" data-label="Criteria">${escapeHtml(deviceCriteriaFor(d.key))}</td>
          <td class="td-sessions" data-label="Sessions">${sessions}</td>
          <td class="td-share" data-label="Share">
            <span class="td-share-track">
              <span class="td-share-fill" style="width:${sharePct}%;background:var(--ink-soft);"></span>
            </span>
            <span class="td-share-value">${sharePct}%</span>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <table class="data-table">
      <thead>
        <tr>
          <th scope="col">Device</th>
          <th scope="col" class="th-criteria">Criteria</th>
          <th scope="col">Sessions</th>
          <th scope="col" class="th-share">Share</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function deviceCriteriaFor(key: string): string {
  if (DEVICE_TIER_KEYS.has(key)) return formatDeviceSignature(key as SignalDeviceTier);
  return '';
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
    ['Network', escapeHtml(persona.network_criteria)],
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
      ${renderReveal(`<h3 class="section-eyebrow">Form factor</h3>`)}
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
          <h3 class="section-eyebrow">Context that shapes the experience</h3>
          <p class="section-lede">${escapeHtml(vm.editorial.audience_context_strip_lede)}</p>
        </div>`
      )}
      ${renderReveal(`<div class="figure" style="padding:var(--stack-md) var(--stack-md) calc(var(--stack-md) - 1px);">${rows}</div>`)}
    </div>
  `;
}

export function renderAudienceSection(vm: ReportViewModel): string {
  return `
    <section id="audience" class="section" data-tone="cream" aria-labelledby="audience-eyebrow">
      <div class="section-inner">
        <div class="act-intro">
          <div class="act-intro-stack">
            ${renderReveal(`<div id="audience-eyebrow" class="act-intro-eyebrow"><span class="dot"></span>Act 01 · Audience shape</div>`)}
            ${renderReveal(vm.editorial.audience_headline_html, { delay: 120 })}
            ${renderReveal(`<p class="act-intro-lede">${vm.editorial.audience_lede_html}</p>`, { delay: 240 })}
          </div>
        </div>

        <div class="block">
          ${renderReveal(
            `<h3 class="section-eyebrow with-icon">${renderIcon('wifi', 'sr-eyebrow-icon')} <span>Network spread</span></h3>`
          )}
          ${renderReveal(renderTierTable(vm))}
        </div>

        <div class="block">
          ${renderReveal(
            `<h3 class="section-eyebrow with-icon">${renderIcon('monitorSmartphone', 'sr-eyebrow-icon')} <span>Device spread</span></h3>`
          )}
          ${renderReveal(renderDeviceTable(vm))}
        </div>

        <div class="block">
          ${renderReveal(
            `<div class="block-header">
              <h3 class="section-eyebrow">${escapeHtml(vm.editorial.audience_persona_section_eyebrow)}</h3>
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
