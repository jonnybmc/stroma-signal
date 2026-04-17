import type { SignalAggregateV1, SignalRaceFallbackReason } from '@stroma-labs/signal-contracts';

import { escapeHtml } from './render-utils';
import { buildReportViewModel, humanizeToken } from './report-view-model';

const RACE_FALLBACK_REASON_COPY: Record<SignalRaceFallbackReason, string> = {
  lcp_coverage_below_threshold: 'LCP coverage was too thin to race on. The report falls back to FCP or TTFB for Act 2.',
  fcp_unavailable: 'FCP was missing for a required cohort. The report falls back to TTFB or drops the race.',
  insufficient_comparable_data:
    'No comparable cohort had enough sessions to stage a defensible race. Act 2 is presented without a winner.'
};

const ACT3_MODE_COPY: Record<'full' | 'reduced' | 'legacy', string> = {
  full: 'All three stages (FCP, LCP, INP) meet coverage. Act 3 renders the full measured funnel.',
  reduced:
    'One stage (usually INP) has too little coverage to be defensible. Act 3 renders the defensible stages only and says so.',
  legacy:
    'This aggregate pre-dates the measured funnel. Act 3 renders the legacy narrative link rather than a stage waterfall.'
};

export function renderAggregateSummary(aggregate: SignalAggregateV1): string {
  const viewModel = buildReportViewModel(aggregate);
  const warningMarkup =
    aggregate.warnings.length === 0
      ? '<p class="summary-empty">No warnings in this aggregate.</p>'
      : `<ul class="summary-list">${aggregate.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>`;

  return `
    <div class="summary-grid">
      <article class="summary-card">
        <p class="label">Domain</p>
        <p class="summary-value">${escapeHtml(aggregate.domain)}</p>
      </article>
      <article class="summary-card">
        <p class="label">Mode</p>
        <p class="summary-value">${escapeHtml(aggregate.mode)}</p>
      </article>
      <article class="summary-card">
        <p class="label">Sample</p>
        <p class="summary-value">${aggregate.sample_size}</p>
      </article>
      <article class="summary-card">
        <p class="label">Comparison tier</p>
        <p class="summary-value">${escapeHtml(humanizeToken(aggregate.comparison_tier))}</p>
      </article>
      <article class="summary-card">
        <p class="label">Race metric</p>
        <p class="summary-value">${escapeHtml(aggregate.race_metric === 'none' ? 'no race' : aggregate.race_metric.toUpperCase())}</p>
      </article>
      <article class="summary-card">
        <p class="label">Report mood</p>
        <p class="summary-value">${escapeHtml(viewModel.mood_tier)}</p>
      </article>
      <article class="summary-card">
        <p class="label">Fallback</p>
        <p class="summary-value">${escapeHtml(aggregate.race_fallback_reason ? humanizeToken(aggregate.race_fallback_reason) : 'none')}</p>
        ${
          aggregate.race_fallback_reason
            ? `<p class="summary-reason">${escapeHtml(RACE_FALLBACK_REASON_COPY[aggregate.race_fallback_reason])}</p>`
            : ''
        }
      </article>
      <article class="summary-card">
        <p class="label">Act 3 stages</p>
        <p class="summary-value">${escapeHtml(viewModel.act3.mode === 'legacy' ? 'legacy link' : viewModel.act3.active_stage_keys.length === 0 ? 'no defensible funnel' : viewModel.act3.active_stage_keys.map((stage) => stage.toUpperCase()).join(' → '))}</p>
        <p class="summary-reason">${escapeHtml(ACT3_MODE_COPY[viewModel.act3.mode])}</p>
      </article>
    </div>
    <div class="summary-section">
      <p class="label">Coverage honesty</p>
      <ul class="summary-list">
        <li>Network coverage: ${aggregate.coverage.network_coverage}%</li>
        <li>Unclassified share: ${aggregate.coverage.unclassified_network_share}%</li>
        <li>Connection reuse share: ${aggregate.coverage.connection_reuse_share}%</li>
        <li>LCP coverage: ${aggregate.coverage.lcp_coverage}%</li>
        <li>Selected urban coverage: ${aggregate.coverage.selected_metric_urban_coverage ?? 'n/a'}${aggregate.coverage.selected_metric_urban_coverage == null ? '' : '%'}</li>
        <li>Selected comparison coverage: ${aggregate.coverage.selected_metric_comparison_coverage ?? 'n/a'}${aggregate.coverage.selected_metric_comparison_coverage == null ? '' : '%'}</li>
        <li>Measured funnel coverage: ${viewModel.act3.mode === 'legacy' ? 'legacy' : viewModel.act3.active_stage_keys.length === 0 ? 'unavailable' : `${viewModel.act3.measured_session_coverage}%`}</li>
      </ul>
    </div>
    <div class="summary-section">
      <p class="label">Round-trip vitals and funnel</p>
      <ul class="summary-list">
        <li>Urban: LCP ${aggregate.vitals.urban.lcp_ms ?? 'n/a'} / FCP ${aggregate.vitals.urban.fcp_ms ?? 'n/a'} / TTFB ${aggregate.vitals.urban.ttfb_ms ?? 'n/a'}</li>
        <li>${escapeHtml(humanizeToken(aggregate.comparison_tier))}: LCP ${aggregate.vitals.comparison.lcp_ms ?? 'n/a'} / FCP ${aggregate.vitals.comparison.fcp_ms ?? 'n/a'} / TTFB ${aggregate.vitals.comparison.ttfb_ms ?? 'n/a'}</li>
        <li>Poor-session share: ${viewModel.act3.mode === 'legacy' ? 'legacy' : viewModel.act3.active_stage_keys.length === 0 ? 'unavailable' : `${viewModel.act3.poor_session_share}%`}</li>
        <li>Top page path: ${escapeHtml(aggregate.top_page_path ?? 'n/a')}</li>
      </ul>
    </div>
    <div class="summary-section">
      <p class="label">Artifact boundary</p>
      <ul class="summary-list">
        <li>${escapeHtml(viewModel.boundary_statement)}</li>
      </ul>
    </div>
    <div class="summary-section">
      <p class="label">Warnings</p>
      ${warningMarkup}
    </div>
  `;
}
