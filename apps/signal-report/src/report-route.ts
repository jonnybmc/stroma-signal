import { decodeSignalReportUrl, type SignalAggregateV1 } from '@stroma-labs/signal-contracts';

import './shared.css';
import './report-immersive.css';
import { escapeHtml } from './render-utils';
import { renderReportMarkup } from './report-markup';
import { initReportMotion } from './report-motion';
import { buildReportViewModel, type ReportMotionMode, selectMotionMode } from './report-view-model';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root');

function renderInvalidReportState(message: string): void {
  app.className = 'app-shell';
  app.innerHTML = `
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
    const params = new URLSearchParams(location.search);
    const qaParam = params.get('qa');
    const qaMode = qaParam === '1' || qaParam === 'deterministic';
    const qaDeterministic = qaParam === 'deterministic';
    const forcedMotion = params.get('motion');
    const motionMode: ReportMotionMode = qaDeterministic
      ? 'reduced'
      : forcedMotion === 'full' || forcedMotion === 'reduced'
        ? forcedMotion
        : selectMotionMode(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const requestedScene = params.get('scene');
    const scene =
      requestedScene === 'act1' || requestedScene === 'act2' || requestedScene === 'act3' || requestedScene === 'act4'
        ? requestedScene
        : 'all';
    const viewModel = buildReportViewModel(aggregate);

    app.className = `app-shell motion-${motionMode} mood-${viewModel.mood_tier}${qaMode ? ' qa-mode' : ''}${qaDeterministic ? ' qa-deterministic' : ''} scene-${scene}`;
    app.innerHTML = renderReportMarkup(viewModel, motionMode);
    const skipOrchestration = qaMode || motionMode === 'reduced' || scene !== 'all' || forcedMotion === 'reduced';
    initReportMotion(motionMode, { skipOrchestration });

    const shareBtn = document.querySelector<HTMLButtonElement>('[data-role="share-copy"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(location.href).then(() => {
          shareBtn.textContent = 'Copied!';
          shareBtn.setAttribute('data-copied', 'true');
          setTimeout(() => {
            shareBtn.textContent = 'Copy report link';
            shareBtn.removeAttribute('data-copied');
          }, 2000);
        });
      });
    }
  }
}
