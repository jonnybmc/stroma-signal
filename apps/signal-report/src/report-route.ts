import { decodeSignalReportUrl, encodeSignalReportUrl, previewAggregateFixture } from '@stroma-labs/signal-contracts';

import './shared.css';
import { escapeHtml } from './render-utils';

function metricValue(
  metric: 'lcp' | 'fcp' | 'ttfb' | 'none',
  scope: { lcp_ms: number | null; fcp_ms: number | null; ttfb_ms: number | null }
): number | null {
  switch (metric) {
    case 'lcp':
      return scope.lcp_ms;
    case 'fcp':
      return scope.fcp_ms;
    case 'ttfb':
      return scope.ttfb_ms;
    default:
      return null;
  }
}

function humanizeTier(value: string): string {
  return value.replaceAll('_', ' ');
}

function barWidth(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(8, Math.round((value / max) * 100));
}

const previewUrl = encodeSignalReportUrl(previewAggregateFixture, `${location.origin}/r`).url;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root');

function renderInvalidReportState(message: string): void {
  app.className = 'app-shell';
  app.innerHTML = `
    <section class="builder-card">
      <p class="eyebrow">Signal by Stroma</p>
      <h1 class="headline">Invalid report URL</h1>
      <p class="lede">
        This report link could not be decoded safely. Use the builder to validate the URL or open a known-good fixture.
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
        <a class="button-link primary" href="${previewUrl}">Open fixture /r</a>
      </div>
    </section>
  `;
}

let aggregate = previewAggregateFixture;
let decodeFailed = false;
try {
  aggregate = location.search ? decodeSignalReportUrl(location.href) : previewAggregateFixture;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown report decode failure.';
  renderInvalidReportState(message);
  decodeFailed = true;
}

if (decodeFailed) {
  // An invalid state was already rendered.
} else {
  const raceMetric = aggregate.race_metric;
  const urbanMetric = raceMetric === 'none' ? null : metricValue(raceMetric, aggregate.vitals.urban);
  const comparisonMetric = raceMetric === 'none' ? null : metricValue(raceMetric, aggregate.vitals.comparison);
  const maxMetric = Math.max(urbanMetric ?? 0, comparisonMetric ?? 0);

  app.className = 'app-shell';
  app.innerHTML = `
  <section class="hero">
    <p class="eyebrow">Signal by Stroma</p>
    <h1 class="headline">${escapeHtml(aggregate.domain)}</h1>
    <p class="lede">
      Acts 1 and 2 foundation: measured tier distribution, visible coverage honesty, and a deterministic comparison metric selected by the aggregate contract.
    </p>
    <div class="meta-row">
      <div class="meta-pill"><span class="label">Sample</span><span class="meta-value">${aggregate.sample_size}</span></div>
      <div class="meta-pill"><span class="label">Period</span><span class="meta-value">${aggregate.period_days}d</span></div>
      <div class="meta-pill"><span class="label">Mode</span><span class="meta-value">${escapeHtml(aggregate.mode)}</span></div>
      <div class="meta-pill"><span class="label">Race</span><span class="meta-value">${escapeHtml(aggregate.race_metric)}</span></div>
    </div>
    <div class="meta-row">
      <div class="subtle">Network coverage ${aggregate.coverage.network_coverage}%</div>
      <div class="subtle">Unclassified ${aggregate.coverage.unclassified_network_share}%</div>
      <div class="subtle">Reuse share ${aggregate.coverage.connection_reuse_share}%</div>
      <div class="subtle">LCP coverage ${aggregate.coverage.lcp_coverage}%</div>
    </div>
  </section>

  <section class="panel">
    <p class="eyebrow">Act 1</p>
    <h2>Who are your users?</h2>
    <div class="tier-grid">
      ${[
        ['urban', aggregate.network_distribution.urban],
        ['moderate', aggregate.network_distribution.moderate],
        ['constrained_moderate', aggregate.network_distribution.constrained_moderate],
        ['constrained', aggregate.network_distribution.constrained],
        ['unknown', aggregate.network_distribution.unknown]
      ]
        .map(
          ([tier, value]) => `
        <article class="tier-card" data-tier="${tier}">
          <p class="label">${humanizeTier(String(tier))}</p>
          <div class="metric-value">${value}%</div>
          <div class="tier-bar" data-tier="${tier}">
            <span style="width:${value}%"></span>
          </div>
        </article>
      `
        )
        .join('')}
    </div>
  </section>

  <section class="race">
    <p class="eyebrow">Act 2</p>
    <h2>What do they experience?</h2>
    ${
      raceMetric === 'none'
        ? `<p class="lede">Insufficient comparable data for an animated race. Fallback reason: ${escapeHtml(aggregate.race_fallback_reason ?? 'unknown')}.</p>`
        : `<p class="lede">The race is using <strong>${escapeHtml(raceMetric.toUpperCase())}</strong>. All labels below explicitly reflect that selected metric.</p>`
    }
    <div class="race-grid">
      <article class="race-track">
        <p class="label">Urban</p>
        <div class="metric-value">${urbanMetric ?? 'n/a'}${urbanMetric == null ? '' : 'ms'}</div>
        <div class="subtle">Coverage ${aggregate.coverage.selected_metric_urban_coverage ?? 0}%</div>
        <div class="race-bar" data-tone="urban"><span style="width:${urbanMetric == null ? 0 : barWidth(urbanMetric, maxMetric)}%"></span></div>
      </article>
      <article class="race-track">
        <p class="label">${escapeHtml(humanizeTier(aggregate.comparison_tier))}</p>
        <div class="metric-value">${comparisonMetric ?? 'n/a'}${comparisonMetric == null ? '' : 'ms'}</div>
        <div class="subtle">Coverage ${aggregate.coverage.selected_metric_comparison_coverage ?? 0}%</div>
        <div class="race-bar" data-tone="comparison"><span style="width:${comparisonMetric == null ? 0 : barWidth(comparisonMetric, maxMetric)}%"></span></div>
      </article>
    </div>
    <p class="subtle">Proxy/CDN note: this reflects the effective path to the serving edge or proxy in many cases, not pure last-mile truth.</p>
  </section>

  <section class="panel">
    <p class="eyebrow">Builder shortcut</p>
    <p class="lede">Need a local example? Open the builder or preview shell with fixture data.</p>
    <div class="builder-actions">
      <a class="button-link primary" href="${location.origin}/build/">Open /build</a>
      <a class="button-link primary" href="${previewUrl}">Open fixture /r</a>
    </div>
  </section>
`;
}
