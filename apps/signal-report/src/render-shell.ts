// Outer shell for the scroll-narrative report: top scroll-spy nav, ordered
// section composition, footer meta strip, reading-progress hairline.

import { escapeHtml } from './render-utils.js';
import { REPORT_BRAND } from './report-brand.js';
import type { ReportViewModel } from './report-view-model.js';
import { renderAudienceSection } from './sections/render-audience.js';
import { renderBusinessSection } from './sections/render-business.js';
import { renderCoverSection } from './sections/render-cover.js';
import { renderDistanceSection } from './sections/render-distance.js';
import { renderFunnelSection } from './sections/render-funnel.js';

export const SECTION_ORDER = [
  { id: 'cover', num: '00', label: 'Cover' },
  { id: 'audience', num: '01', label: 'Audience' },
  { id: 'distance', num: '02', label: 'Distance' },
  { id: 'funnel', num: '03', label: 'Funnel' },
  { id: 'business', num: '04', label: 'Business' }
] as const;

export type SectionId = (typeof SECTION_ORDER)[number]['id'];

/** Persistent disclaimer shown in the sticky nav when the underlying
 *  sample hasn't crossed the stable threshold. Lives in the nav (not
 *  the cover) so it stays visible as the recipient scrolls every
 *  section — the truth-boundary signal on a thin report should follow
 *  the eye, not sit only on the masthead.
 *
 *  Returns '' when band === 'stable' so the nav stays clean for
 *  reports with sufficient evidence. */
function renderSampleBandNote(vm: ReportViewModel): string {
  if (vm.band === 'stable') return '';
  const headline = vm.band === 'preliminary' ? 'Preliminary read' : 'Provisional read';
  const sessions = `${vm.sample_size.toLocaleString('en-US')} session${vm.sample_size === 1 ? '' : 's'}`;
  const guidance =
    vm.band === 'preliminary'
      ? `${headline} · sample of ${sessions}. Ranges and percentiles stabilise around 100+ events; consider waiting for more traffic before sharing externally.`
      : `${headline} · sample of ${sessions}. Direction is reliable but tier-level percentiles continue to firm up past 500 events.`;
  return `
    <div
      class="scroll-nav-note"
      role="note"
      aria-label="Sample-confidence note: ${escapeHtml(guidance)}"
      title="${escapeHtml(guidance)}"
    >
      <span class="scroll-nav-note-dot" aria-hidden="true"></span>
      <span class="scroll-nav-note-label">${escapeHtml(headline)} · ${escapeHtml(sessions)}</span>
    </div>
  `;
}

function renderTopNav(viewModel: ReportViewModel): string {
  const items = SECTION_ORDER.map(
    (s) => `
      <a href="#${s.id}" data-spy-link="${s.id}" data-active="${s.id === 'cover' ? 'true' : 'false'}">
        <span class="toc-num">${s.num}</span>
        <span>${escapeHtml(s.label)}</span>
      </a>`
  ).join('');

  return `
    <nav class="scroll-nav" aria-label="Sections">
      <a href="#cover" class="scroll-nav-brand" aria-label="Signal by Stroma — return to cover">
        <img class="scroll-nav-brand-logo" src="${REPORT_BRAND.wordmarkUrl}" alt="${escapeHtml(REPORT_BRAND.alt)}" />
        <span class="scroll-nav-brand-by">by Stroma</span>
      </a>
      ${renderSampleBandNote(viewModel)}
      <div class="scroll-nav-toc">${items}</div>
    </nav>
  `.trim();
}

function renderFooter(viewModel: ReportViewModel): string {
  const generated = viewModel.freshness_known
    ? new Date(viewModel.generated_at).toISOString().slice(0, 10)
    : 'date not provided';
  return `
    <footer class="scroll-footer">
      <div class="scroll-footer-meta">generated ${escapeHtml(generated)} · ${viewModel.sample_size} sessions · ${viewModel.period_days} day window</div>
      <button class="scroll-footer-copy" data-role="share-copy" data-default-label="copy link" type="button" aria-live="polite">copy link</button>
    </footer>
  `.trim();
}

export function renderReportShell(viewModel: ReportViewModel): string {
  return `
    <div class="scroll-report" data-theme="light">
      ${renderTopNav(viewModel)}
      <main>
        ${renderCoverSection(viewModel)}
        ${renderAudienceSection(viewModel)}
        ${renderDistanceSection(viewModel)}
        ${renderFunnelSection(viewModel)}
        ${renderBusinessSection(viewModel)}
      </main>
      ${renderFooter(viewModel)}
      <div class="scroll-progress" aria-hidden="true">
        <div class="scroll-progress-fill"></div>
      </div>
    </div>
  `.trim();
}
