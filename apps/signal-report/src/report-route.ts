import { decodeSignalReportUrl, type SignalAggregateV1 } from '@stroma-labs/signal-contracts';

import './shared.css';
import './report-tokens-v2.css';
import './report-scroll.css';
import { bootReport } from './render-helpers';
import { renderReportShell, SECTION_ORDER } from './render-shell';
import { escapeHtml } from './render-utils';
import { buildReportViewModel } from './report-view-model';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root');
const appRoot = app;

function renderInvalidReportState(message: string): void {
  appRoot.className = 'app-shell';
  appRoot.innerHTML = `
    <section class="builder-card">
      <p class="eyebrow">Signal</p>
      <h1 class="headline">Invalid report URL</h1>
      <p class="lede">
        This report link could not be decoded safely. Use the builder to generate or validate a report URL.
      </p>
      <div class="status-stack">
        <div class="error">
          <p class="error-heading">What went wrong</p>
          <ul class="error-list">
            <li>${escapeHtml(message)}</li>
          </ul>
        </div>
      </div>
      <div class="builder-actions">
        <a class="button-link primary" href="${location.origin}/build/">Open /build</a>
      </div>
    </section>
  `;
}

if (!location.search) {
  renderInvalidReportState('No report data in URL. Use /build to generate a report link.');
} else {
  let decodeFailed = false;
  let aggregate: SignalAggregateV1 | undefined;

  try {
    aggregate = decodeSignalReportUrl(location.href);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown report decode failure.';
    renderInvalidReportState(message);
    decodeFailed = true;
  }

  if (!decodeFailed && aggregate) {
    const viewModel = buildReportViewModel(aggregate);
    app.className = '';
    app.innerHTML = renderReportShell(viewModel);
    bootReport(SECTION_ORDER.map((s) => s.id));
  }
}
