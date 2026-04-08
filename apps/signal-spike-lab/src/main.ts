import { createBeaconSink, init } from '@stroma-labs/signal';
import { createDataLayerSink } from '@stroma-labs/signal/ga4';
import { createPreviewCollector } from '@stroma-labs/signal/report';

import { bootstrapSpikeLabGa4, createSpikeLabGa4Sink, type Ga4BootstrapState } from './ga4-helper';
import './styles.css';

declare global {
  interface Window {
    __STROMA_SIGNAL__?: {
      previewUrl: string;
      ga4State?: Ga4BootstrapState;
    };
    dataLayer?: Array<Record<string, unknown> | unknown[]>;
    gtag?: (...args: unknown[]) => void;
  }
}

const reportBaseUrl = import.meta.env.VITE_SIGNAL_REPORT_BASE_URL ?? 'http://localhost:4174/r';
const measurementId = import.meta.env.VITE_SIGNAL_GA4_MEASUREMENT_ID ?? '';

const previewCollector = createPreviewCollector({
  reportBaseUrl
});

const isAutomation = globalThis.navigator?.webdriver === true;
let ga4State: Ga4BootstrapState = 'disabled';

function setGa4State(nextState: Ga4BootstrapState): void {
  ga4State = nextState;
  window.__STROMA_SIGNAL__ = {
    ...(window.__STROMA_SIGNAL__ ?? { previewUrl: previewCollector.getReportUrl().url }),
    ga4State: nextState
  };
  refreshGa4Meta();
}

const previewLink = document.querySelector<HTMLAnchorElement>('#preview-link');
const previewMeta = document.querySelector<HTMLElement>('#preview-meta');
const collectorMeta = document.querySelector<HTMLElement>('#collector-meta');
const collectorJson = document.querySelector<HTMLElement>('#collector-json');
const ga4Meta = document.querySelector<HTMLElement>('#ga4-meta');
const datalayerMeta = document.querySelector<HTMLElement>('#datalayer-meta');
const datalayerJson = document.querySelector<HTMLElement>('#datalayer-json');
const measurementIdNode = document.querySelector<HTMLElement>('#measurement-id');

if (measurementIdNode) measurementIdNode.textContent = measurementId;

function refreshGa4Meta(): void {
  if (!ga4Meta) return;

  switch (ga4State) {
    case 'ready':
      ga4Meta.textContent = `Live gtag transport ready for ${measurementId}. Verify perf_tier_report in GA4 DebugView.`;
      break;
    case 'loading':
      ga4Meta.textContent = `Booting live gtag transport for ${measurementId}.`;
      break;
    case 'skipped':
      ga4Meta.textContent = `Live GA4 transport is skipped under browser automation. Local collector and dataLayer validation remain active.`;
      break;
    case 'error':
      ga4Meta.textContent = `Could not load gtag.js for ${measurementId}. Check network access before using this harness for Gate 2.`;
      break;
    default:
      ga4Meta.textContent = 'Live GA4 transport is disabled. Set VITE_SIGNAL_GA4_MEASUREMENT_ID to enable Gate 2 validation.';
  }
}

bootstrapSpikeLabGa4(measurementId, isAutomation, setGa4State);

const controller = init({
  sinks: [
    createBeaconSink({ endpoint: '/collect' }),
    createSpikeLabGa4Sink(),
    createDataLayerSink(),
    previewCollector
  ],
  packageVersion: '0.1.0'
});

window.__STROMA_SIGNAL__ = {
  previewUrl: previewCollector.getReportUrl().url,
  ga4State
};

async function refreshCollector(): Promise<void> {
  const response = await fetch('/api/events');
  const payload = await response.json() as { events: Array<Record<string, unknown>> };
  const [latest] = payload.events;

  if (collectorMeta) {
    collectorMeta.textContent = latest
      ? `Collector has ${payload.events.length} captured payload${payload.events.length === 1 ? '' : 's'}.`
      : 'No collector payload received yet.';
  }

  if (collectorJson) {
    collectorJson.textContent = latest
      ? JSON.stringify(latest, null, 2)
      : 'No events captured yet.';
  }
}

function refreshPreview(): void {
  const report = previewCollector.getReportUrl();
  window.__STROMA_SIGNAL__ = {
    ...(window.__STROMA_SIGNAL__ ?? {}),
    previewUrl: report.url,
    ga4State
  };
  if (previewLink) {
    previewLink.href = report.url;
    previewLink.textContent = report.url;
  }
  if (previewMeta) {
    previewMeta.textContent = `sample=${report.sampleSize} mode=${report.mode} warnings=${report.warnings.length}`;
  }
}

function refreshDataLayer(): void {
  const entries = window.dataLayer ?? [];
  const latest = [...entries].reverse().find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' &&
      entry !== null &&
      !Array.isArray(entry) &&
      'event' in entry
  );
  if (datalayerMeta) {
    datalayerMeta.textContent = latest
      ? `dataLayer entries=${entries.length} latest event=${String(latest.event)}`
      : 'dataLayer events will appear after flush.';
  }
  if (datalayerJson) {
    datalayerJson.textContent = latest
      ? JSON.stringify(latest, null, 2)
      : 'No dataLayer pushes captured yet.';
  }
}

document.querySelector<HTMLButtonElement>('#flush-now')?.addEventListener('click', () => {
  controller.flushNow();
  refreshPreview();
  refreshDataLayer();
  void refreshCollector();
});

document.querySelector<HTMLButtonElement>('#reset-events')?.addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' });
  previewCollector.reset();
  refreshPreview();
  refreshDataLayer();
  await refreshCollector();
});

refreshGa4Meta();
refreshPreview();
refreshDataLayer();
void refreshCollector();
