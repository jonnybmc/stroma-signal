import {
  decodeSignalReportUrl,
  encodeSignalReportUrl,
  explainSignalAggregateIssues,
  type SignalAggregateV1,
  signalReportScenarioFixtures
} from '@stroma-labs/signal-contracts';

import './shared.css';
import { renderAggregateSummary } from './builder-summary';
import { renderIssueList, renderLinkedMessage } from './render-utils';

type BuilderMode = 'aggregate' | 'report_url';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app root');

function renderErrors(target: HTMLElement, issues: string[]): void {
  renderIssueList(target, issues);
}

function parseAggregateInput(value: string): { aggregate: SignalAggregateV1 | null; issues: string[] } {
  try {
    const parsed = JSON.parse(value) as unknown;
    const issues = explainSignalAggregateIssues(parsed);
    if (issues.length > 0) {
      return { aggregate: null, issues };
    }

    return { aggregate: parsed as SignalAggregateV1, issues: [] };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown JSON parse failure.';
    return {
      aggregate: null,
      issues: ['Malformed JSON. Check quotes, commas, and braces before generating the URL.', message]
    };
  }
}

function parseReportUrlInput(value: string): {
  aggregate: SignalAggregateV1 | null;
  issues: string[];
  url: string | null;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      aggregate: null,
      url: null,
      issues: ['Paste a hosted Signal report URL before validating it.']
    };
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    }
    if (!(url.pathname === '/r' || url.pathname === '/r/')) {
      throw new Error(`Expected the hosted report route at "/r". Received "${url.pathname || '/'}".`);
    }
    const aggregate = decodeSignalReportUrl(url);
    return { aggregate, issues: [], url: url.toString() };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Unknown URL parse failure.';
    return {
      aggregate: null,
      url: null,
      issues: ['Could not decode that report URL. Paste the full hosted `/r?...` URL and try again.', message]
    };
  }
}

app.className = 'app-shell';
app.innerHTML = `
  <section class="builder-card">
    <p class="eyebrow">Signal by Stroma</p>
    <h1 class="headline">Zero-code report builder</h1>
    <p class="lede">
      Use this launch companion to either turn a warehouse aggregate into a shareable report URL or validate a generated report URL before sharing it.
    </p>
  </section>

  <section class="builder-grid builder-layout">
    <article class="panel builder-panel">
      <div class="builder-toggle" role="tablist" aria-label="Builder mode">
        <button class="builder-mode active" id="mode-aggregate" data-mode="aggregate" type="button">Aggregate JSON</button>
        <button class="builder-mode" id="mode-report-url" data-mode="report_url" type="button">Report URL</button>
      </div>

      <div class="builder-field">
        <label class="label" for="fixture-select">Scenario fixture</label>
        <select id="fixture-select"></select>
        <p id="fixture-description" class="subtle"></p>
      </div>

      <div class="builder-field" id="aggregate-field">
        <label class="label" for="aggregate-input">Aggregate JSON</label>
        <textarea id="aggregate-input" spellcheck="false"></textarea>
      </div>

      <div class="builder-field is-hidden" id="report-url-field">
        <label class="label" for="report-url-input">Hosted report URL</label>
        <textarea id="report-url-input" class="single-line-input" spellcheck="false" placeholder="https://signal.stroma.design/r?rv=1&..."></textarea>
        <p class="subtle">Paste a full hosted Signal report URL to validate and decode it.</p>
      </div>

      <div class="builder-actions">
        <button class="secondary" id="load-fixture" type="button">Load selected fixture</button>
        <button class="secondary" id="format-json" type="button">Format JSON</button>
        <button class="primary" id="generate-url" type="button">Generate report URL</button>
        <button class="primary is-hidden" id="validate-url" type="button">Validate report URL</button>
        <button class="secondary" id="copy-url" type="button" disabled>Copy URL</button>
      </div>

      <div class="status-stack">
        <div id="builder-error" class="error"></div>
        <p id="builder-success" class="success"></p>
      </div>
    </article>

    <article class="panel builder-panel">
      <p class="label">Decoded summary</p>
      <p class="subtle">This preview shows what the hosted report route will decode from the generated or pasted URL.</p>
      <div id="builder-summary" class="summary-root">
        <p class="summary-empty">Generate or validate a URL to preview the decoded summary.</p>
      </div>
    </article>
  </section>
`;

const input = document.querySelector<HTMLTextAreaElement>('#aggregate-input');
const reportUrlInput = document.querySelector<HTMLTextAreaElement>('#report-url-input');
const error = document.querySelector<HTMLElement>('#builder-error');
const success = document.querySelector<HTMLElement>('#builder-success');
const summary = document.querySelector<HTMLElement>('#builder-summary');
const fixtureSelect = document.querySelector<HTMLSelectElement>('#fixture-select');
const fixtureDescription = document.querySelector<HTMLElement>('#fixture-description');
const copyButton = document.querySelector<HTMLButtonElement>('#copy-url');
const aggregateField = document.querySelector<HTMLElement>('#aggregate-field');
const reportUrlField = document.querySelector<HTMLElement>('#report-url-field');
const formatButton = document.querySelector<HTMLButtonElement>('#format-json');
const loadFixtureButton = document.querySelector<HTMLButtonElement>('#load-fixture');
const generateButton = document.querySelector<HTMLButtonElement>('#generate-url');
const validateButton = document.querySelector<HTMLButtonElement>('#validate-url');
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.builder-mode'));

if (
  !input ||
  !reportUrlInput ||
  !error ||
  !success ||
  !summary ||
  !fixtureSelect ||
  !fixtureDescription ||
  !copyButton ||
  !aggregateField ||
  !reportUrlField ||
  !formatButton ||
  !loadFixtureButton ||
  !generateButton ||
  !validateButton
) {
  throw new Error('Missing builder controls');
}

let latestUrl = '';
let _mode: BuilderMode = 'aggregate';

for (const fixture of signalReportScenarioFixtures) {
  const option = document.createElement('option');
  option.value = fixture.id;
  option.textContent = fixture.label;
  fixtureSelect.append(option);
}

function setMode(nextMode: BuilderMode): void {
  _mode = nextMode;
  const aggregateActive = nextMode === 'aggregate';
  aggregateField.classList.toggle('is-hidden', !aggregateActive);
  reportUrlField.classList.toggle('is-hidden', aggregateActive);
  formatButton.classList.toggle('is-hidden', !aggregateActive);
  loadFixtureButton.classList.toggle('is-hidden', !aggregateActive);
  generateButton.classList.toggle('is-hidden', !aggregateActive);
  validateButton.classList.toggle('is-hidden', aggregateActive);

  for (const button of modeButtons) {
    button.classList.toggle('active', button.dataset.mode === nextMode);
    button.setAttribute('aria-selected', String(button.dataset.mode === nextMode));
  }

  latestUrl = '';
  copyButton.disabled = true;
  success.textContent = '';
  renderErrors(error, []);
  summary.innerHTML = '<p class="summary-empty">Generate or validate a URL to preview the decoded summary.</p>';
}

function loadFixture(id: string): void {
  const fixture = signalReportScenarioFixtures.find((entry) => entry.id === id) ?? signalReportScenarioFixtures[0];
  input.value = JSON.stringify(fixture.aggregate, null, 2);
  reportUrlInput.value = encodeSignalReportUrl(fixture.aggregate, `${location.origin}/r`).url;
  fixtureSelect.value = fixture.id;
  fixtureDescription.textContent = fixture.description;
  latestUrl = '';
  copyButton.disabled = true;
  success.textContent = '';
  renderErrors(error, []);
  summary.innerHTML = renderAggregateSummary(fixture.aggregate);
}

loadFixture('full-depth');
setMode('aggregate');

fixtureSelect.addEventListener('change', () => {
  loadFixture(fixtureSelect.value);
});

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    setMode((button.dataset.mode as BuilderMode) ?? 'aggregate');
  });
}

loadFixtureButton.addEventListener('click', () => {
  loadFixture(fixtureSelect.value);
});

formatButton.addEventListener('click', () => {
  const { aggregate, issues } = parseAggregateInput(input.value);
  if (!aggregate) {
    renderErrors(error, issues);
    success.textContent = '';
    return;
  }

  input.value = JSON.stringify(aggregate, null, 2);
  renderErrors(error, []);
  success.textContent = 'JSON formatted successfully.';
});

generateButton.addEventListener('click', () => {
  const { aggregate, issues } = parseAggregateInput(input.value);
  if (!aggregate) {
    latestUrl = '';
    copyButton.disabled = true;
    success.textContent = '';
    summary.innerHTML = '<p class="summary-empty">Fix the validation issues to preview the decoded summary.</p>';
    renderErrors(error, issues);
    return;
  }

  renderErrors(error, []);
  const encoded = encodeSignalReportUrl(aggregate, `${location.origin}/r`);
  const decoded = decodeSignalReportUrl(encoded.url);
  latestUrl = encoded.url;
  reportUrlInput.value = encoded.url;
  copyButton.disabled = false;
  renderLinkedMessage(success, 'Generated URL', encoded.url);
  summary.innerHTML = renderAggregateSummary(decoded);
});

validateButton.addEventListener('click', () => {
  const { aggregate, issues, url } = parseReportUrlInput(reportUrlInput.value);
  if (!aggregate || !url) {
    latestUrl = '';
    copyButton.disabled = true;
    success.textContent = '';
    summary.innerHTML = '<p class="summary-empty">Paste a valid report URL to preview the decoded summary.</p>';
    renderErrors(error, issues);
    return;
  }

  renderErrors(error, []);
  latestUrl = url;
  copyButton.disabled = false;
  renderLinkedMessage(success, 'Validated URL', url);
  summary.innerHTML = renderAggregateSummary(aggregate);
});

copyButton.addEventListener('click', async () => {
  if (!latestUrl) return;
  try {
    await navigator.clipboard.writeText(latestUrl);
    renderLinkedMessage(success, 'Copied URL', latestUrl);
  } catch {
    renderErrors(error, ['Could not copy the URL automatically. Select it from the link and copy it manually.']);
  }
});
