// Outer shell for the scroll-narrative report: top scroll-spy nav, ordered
// section composition, footer meta strip, reading-progress hairline.

import { escapeHtml } from './render-utils.js';
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
      <a href="#cover" data-spy-link="cover" class="scroll-nav-brand">
        <span class="brand-dot"></span>
        <span>signal / r /</span>
        <span class="brand-mute">${escapeHtml(viewModel.domain)}</span>
      </a>
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
      <div>signal · r · ${escapeHtml(viewModel.domain)}</div>
      <div>generated ${escapeHtml(generated)} · ${viewModel.sample_size} sessions · ${viewModel.period_days} day window</div>
      <div>stroma · post-click telemetry</div>
      <button class="scroll-footer-copy" data-role="share-copy" data-default-label="copy link" type="button">copy link</button>
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
