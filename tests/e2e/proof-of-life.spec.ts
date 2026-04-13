import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

const FRESH_GA_TS = 1_776_072_000_000;
const FRESH_GA_LABEL = new Date(FRESH_GA_TS).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

async function readCollectorEvents(request: APIRequestContext) {
  const response = await request.get('http://localhost:4173/api/events');
  return (await response.json()).events;
}

test('proof-of-life flow flushes one payload into the collector and dataLayer', async ({ page, request }) => {
  await request.post('http://localhost:4173/api/reset');
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: 'Flush this page load now' }).click();

  const dataLayerMeta = page.locator('#datalayer-meta');
  const dataLayerJson = page.locator('#datalayer-json');
  const previewLink = page.locator('#preview-link');

  await expect.poll(async () => (await readCollectorEvents(request)).length).toBe(1);
  await expect(dataLayerMeta).toContainText('event=perf_tier_report', { timeout: 5_000 });
  await expect(dataLayerJson).toContainText('"event": "perf_tier_report"');
  await expect(previewLink).toHaveAttribute('href', /http:\/\/localhost:4174\/r\?/);
  await expect(previewLink).toHaveAttribute('href', /[?&]rm=none/);
  await expect(previewLink).toHaveAttribute('href', /[?&]rr=insufficient_comparable_data/);

  const previewHref = await previewLink.getAttribute('href');
  expect(previewHref).toBeTruthy();
  if (!previewHref) throw new Error('Expected preview href to be present.');

  await page.goto(previewHref);
  await expect(page.locator('.sr-hero')).toContainText('localhost:4173');
  await expect(page.locator('.sr-act[data-act="3"]')).toContainText('Where does performance become poor?');
  await expect(page.locator('.sr-act[data-act="4"]')).toContainText('What deeper layer exists beyond this?');
  await expect(page.locator('.sr-act[data-act="4"]')).toContainText('Run a deeper scan');
});

test('multi-page spike flow preserves collector truth and preview url semantics', async ({ page, request }) => {
  await request.post('http://localhost:4173/api/reset');
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: 'Flush this page load now' }).click();
  await page.getByRole('link', { name: 'Visit second route' }).click();
  await page.getByRole('button', { name: 'Flush this page load now' }).click();

  await expect.poll(async () => (await readCollectorEvents(request)).length).toBe(2);
  const payload = (await readCollectorEvents(request)) as Array<{ url?: string }>;

  expect(payload).toHaveLength(2);
  expect(payload.map((event) => event.url).sort()).toEqual(['/', '/offers/']);

  const previewUrl = await page.evaluate(() => window.__STROMA_SIGNAL__?.previewUrl ?? '');
  expect(previewUrl).toContain('v=%2Foffers%2F');
  expect(previewUrl).toContain('rm=none');
});

test('builder-generated report urls preserve fallback params end to end', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'fcp-fallback');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const link = page.locator('#builder-success a');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /[?&]ct=constrained_moderate/);
  await expect(link).toHaveAttribute('href', /[?&]rm=fcp/);
  await expect(link).toHaveAttribute('href', /[?&]rr=lcp_coverage_below_threshold/);
  await expect(page.locator('#builder-summary')).toContainText('FCP');
  await expect(page.locator('#fixture-description')).toContainText('LCP coverage is too weak');

  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.goto(href);

  const params = new URL(page.url()).searchParams;
  expect(params.get('ct')).toBe('constrained_moderate');
  expect(params.get('rm')).toBe('fcp');
  expect(params.get('rr')).toBe('lcp_coverage_below_threshold');
});

test('builder validates a hosted report url and decodes the same semantics', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'ttfb-fallback');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const generatedLink = page.locator('#builder-success a');
  await expect(generatedLink).toBeVisible();
  const href = await generatedLink.getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill(href);
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-success')).toContainText('Validated URL');
  await expect(page.locator('#builder-summary')).toContainText('TTFB');
  await expect(page.locator('#builder-summary')).toContainText('fcp unavailable');
  await expect(page.locator('#builder-summary')).toContainText('constrained');
});

test('strong fixture renders the four-act report experience end to end', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'strong-lcp');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const href = await page.locator('#builder-success a').getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.goto(href);

  await expect(page.locator('.sr-root')).toHaveAttribute('data-mood', 'urgent');
  await expect(page.locator('.sr-act[data-act="1"]')).toContainText('Who are your users?');
  await expect(page.locator('.sr-act[data-act="2"]')).toContainText('How far apart are their experiences?');
  await expect(page.locator('.sr-act[data-act="3"]')).toContainText('Where does performance become poor?');
  await expect(page.locator('.sr-act[data-act="4"]')).toContainText('What deeper layer exists beyond this?');
  await expect(page.locator('.sr-act[data-act="4"]')).toContainText('Talk to the team');
  await expect(page.locator('.sr-act[data-act="3"]')).toContainText('Interaction becomes ready');
});

test('low INP fixture renders Act 3 with only FCP and LCP stages', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'low-inp-coverage');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const link = page.locator('#builder-success a');
  await expect(page.locator('#builder-summary')).toContainText('FCP → LCP');

  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');
  expect(new URL(href).searchParams.get('es')).toBe('fcp,lcp');

  await page.goto(href);
  const act3 = page.locator('.sr-act[data-act="3"]');
  await expect(act3).toContainText('First content appears');
  await expect(act3).toContainText('Main content becomes visible');
  // INP stage still shows as an honest inactive placeholder, not a silent
  // omission — the reader sees the full FCP/LCP/INP pipeline so reduced
  // coverage becomes a visible property.
  await expect(act3).toContainText('Interaction becomes ready');
  await expect(act3.locator('.sr-funnel-node-inactive[data-stage="inp"]')).toBeVisible();
  await expect(act3.locator('.sr-funnel-node-inactive[data-stage="inp"]')).toContainText(
    'Not enough data in this sample'
  );
});

test('keyboard navigation advances the deck through every slide and updates the hash', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'strong-lcp');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const href = await page.locator('#builder-success a').getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(href);
  // Force full motion so deck init fires (reduced motion falls back to static layout).
  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.sr-root');
    root?.setAttribute('data-motion', 'full');
  });

  const deck = page.locator('[data-role="deck"]');
  await expect(deck).toBeVisible();
  await expect(deck).toHaveAttribute('style', /--deck-current:\s*0/);

  await page.keyboard.press('ArrowRight');
  await expect(deck).toHaveAttribute('style', /--deck-current:\s*1/);

  await page.keyboard.press('ArrowRight');
  await expect(deck).toHaveAttribute('style', /--deck-current:\s*2/);

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(deck).toHaveAttribute('style', /--deck-current:\s*4/);
  await expect(page).toHaveURL(/#slide=4$/);

  // ArrowRight at the end should clamp, not overflow.
  await page.keyboard.press('ArrowRight');
  await expect(deck).toHaveAttribute('style', /--deck-current:\s*4/);

  // Home key jumps back to the landing.
  await page.keyboard.press('Home');
  await expect(deck).toHaveAttribute('style', /--deck-current:\s*0/);
});

test('affirming fixture keeps the same four-act structure with calmer measured language', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'affirming-balance');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const href = await page.locator('#builder-success a').getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.goto(href);

  await expect(page.locator('.sr-root')).toHaveAttribute('data-mood', 'affirming');
  await expect(page.locator('.sr-act[data-act="3"]')).toContainText('The cliff still exists');
  await expect(page.locator('.sr-act[data-act="4"]')).toContainText('What deeper layer exists beyond this?');
});

test('builder keeps mixed lifecycle fixtures load-shaped by default', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'mixed-lifecycle');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const link = page.locator('#builder-success a');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /[?&]s=1/);
  await expect(link).toHaveAttribute('href', /[?&]rm=none/);
  await expect(link).toHaveAttribute('href', /[?&]rr=insufficient_comparable_data/);
  await expect(page.locator('#fixture-description')).toContainText('excluded from default load-shaped reporting');
  await expect(page.locator('#builder-summary')).toContainText('Sample');
});

test('builder shows friendly validation errors for malformed aggregate input', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.locator('#aggregate-input').fill('{"not":"valid"');
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  await expect(page.locator('#builder-error')).toContainText('Malformed JSON');
  await expect(page.locator('#builder-summary')).toContainText('Fix the validation issues');
});

test('builder shows friendly validation errors for malformed report urls', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill('https://signal.stroma.design/r?rv=99');
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-error')).toContainText('Could not decode that report URL');
  await expect(page.locator('#builder-summary')).toContainText('Paste a valid report URL');
});

test('builder rejects out-of-range hosted report urls instead of previewing corrupt data', async ({ page }) => {
  const corruptUrl =
    'https://signal.stroma.design/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=140&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1776072000000';

  await page.goto('http://localhost:4174/build/');
  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill(corruptUrl);
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-error')).toContainText('Could not decode that report URL');
  await expect(page.locator('#builder-error')).toContainText('coverage.network_coverage');
  await expect(page.locator('#builder-summary')).toContainText('Paste a valid report URL');
});

test('builder rejects contradictory hosted report urls instead of previewing plausible data', async ({ page }) => {
  const contradictoryUrl =
    'https://signal.stroma.design/r?mode=preview&d=test.local&nt=25,25,25,25,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=100&p=7&nc=0&nu=100&nr=0&lc=0&ct=none&rm=none&ga=1776072000000';

  await page.goto('http://localhost:4174/build/');
  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill(contradictoryUrl);
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-error')).toContainText('Could not decode that report URL');
  await expect(page.locator('#builder-error')).toContainText('classified network_distribution share');
  await expect(page.locator('#builder-summary')).toContainText('Paste a valid report URL');
});

test('report route renders hostile domain text safely', async ({ page }) => {
  const hostileDomain = encodeURIComponent('<img src=x onerror=alert(1)>');
  await page.goto(
    `http://localhost:4174/r?mode=preview&d=${hostileDomain}&nt=25,25,25,25,0&dt=34,33,33&s=100&p=1&nc=100&nu=0&nr=0&lc=0&ct=none&rm=none`
  );

  await expect(page.locator('.sr-hero')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.sr-hero img')).toHaveCount(0);
});

test('report route shows a friendly error for malformed urls instead of crashing', async ({ page }) => {
  await page.goto('http://localhost:4174/r?nt=garbage&dt=34,33,33&ct=none&rm=none');

  await expect(page.locator('.headline')).toContainText('Invalid report URL');
  await expect(page.locator('.error')).toContainText('Invalid encoded integer tuple');
});

test('report route fails closed for out-of-range numeric coverage', async ({ page }) => {
  await page.goto(
    'http://localhost:4174/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=140&nu=0&nr=10&lc=80&ct=constrained&rm=lcp&ga=1776072000000'
  );

  await expect(page.locator('.headline')).toContainText('Invalid report URL');
  await expect(page.locator('.error')).toContainText('coverage.network_coverage');
});

test('report route fails closed for contradictory but in-range coverage states', async ({ page }) => {
  await page.goto(
    'http://localhost:4174/r?mode=preview&d=test.local&nt=25,25,25,25,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=100&p=7&nc=0&nu=100&nr=0&lc=0&ct=none&rm=none&ga=1776072000000'
  );

  await expect(page.locator('.headline')).toContainText('Invalid report URL');
  await expect(page.locator('.error')).toContainText('classified network_distribution share');
});

test('fresh reports keep the generation date visible even when other warnings exist', async ({ page }) => {
  await page.goto(
    `http://localhost:4174/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=100&nu=0&nr=10&lc=61&ct=none&rm=none&rr=insufficient_comparable_data&ga=${FRESH_GA_TS}`
  );

  await expect(page.locator('.sr-warnings')).toContainText('Sample size below the recommended preview threshold.');
  await expect(page.locator('.sr-warnings')).toContainText(
    'Act 2 cannot render a comparable race with the current data.'
  );
  await expect(page.locator('.sr-credibility-strip')).toContainText(FRESH_GA_LABEL);
});

test('legacy urls hide the generation date and show the freshness warning', async ({ page }) => {
  await page.goto(
    'http://localhost:4174/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=2000&lt=5000&fu=900&ft=2800&tu=200&tt=450&ulc=80&ufc=90&utc=95&clc=75&cfc=85&ctc=90&s=50&p=7&nc=100&nu=0&nr=10&lc=80&ct=constrained&rm=lcp'
  );

  await expect(page.locator('.sr-warnings')).toContainText('freshness tracking');
  const stripText = await page.locator('.sr-credibility-strip').innerText();
  expect(stripText).not.toMatch(/\b\d{1,2} [A-Z][a-z]{2} \d{4}\b/);
});

test('no-race reports label the compact footer honestly as lcp coverage', async ({ page }) => {
  await page.goto(
    `http://localhost:4174/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=100&nu=0&nr=10&lc=61&ct=none&rm=none&rr=insufficient_comparable_data&ga=${FRESH_GA_TS}`
  );

  await expect(page.locator('.sr-credibility-strip')).toContainText('61% lcp coverage');
});

test('empty-funnel reports stay in an insufficient-data state end to end', async ({ page }) => {
  await page.goto(
    `http://localhost:4174/r?rv=1&mode=preview&d=test.local&nt=0,0,0,0,100&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=0&nu=100&nr=0&lc=0&ct=none&rm=none&rr=insufficient_comparable_data&es=&ec=0&ep=0&fpt=3000&lpt=4000&ipt=500&fcs=0,0,0,0&fps=0,0,0,0&lcs=0,0,0,0&lps=0,0,0,0&ics=0,0,0,0&ips=0,0,0,0&ga=${FRESH_GA_TS}`
  );

  await expect(page.locator('.sr-act[data-act="3"]')).toContainText('No defensible performance funnel in this sample.');
  await expect(page.locator('.sr-act[data-act="3"]')).toContainText('Insufficient measured data');
  await expect(page.locator('.sr-evidence-rail')).toContainText('Poor-session share');
  await expect(page.locator('.sr-evidence-rail')).toContainText('Measured funnel coverage');
  await expect(page.locator('.sr-evidence-rail')).toContainText('Unavailable');
});

test('builder decodes hostile domain text safely in url-validation mode', async ({ page }) => {
  const hostileDomain = encodeURIComponent('<img src=x onerror=alert(1)>');
  const hostileUrl = `https://signal.stroma.design/r?mode=preview&d=${hostileDomain}&nt=25,25,25,25,0&dt=34,33,33&s=100&p=1&nc=100&nu=0&nr=0&lc=0&ct=none&rm=none`;

  await page.goto('http://localhost:4174/build/');
  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill(hostileUrl);
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-summary')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#builder-summary img')).toHaveCount(0);
});

test('builder rejects non-report routes in url-validation mode', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-error')).toContainText('Could not decode that report URL');
  await expect(page.locator('#builder-error')).toContainText('Unsupported URL protocol');
});
