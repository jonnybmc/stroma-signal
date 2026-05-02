import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

const FRESH_GA_TS = 1_776_072_000_000;

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
  // RC3 redesign — semantic section IDs replace the slide-deck data-act
  // attributes. Cover hero now carries the origin in an h1.display.
  await expect(page.locator('#cover h1')).toContainText('localhost:4173');
  await expect(page.locator('#funnel')).toBeVisible();
  await expect(page.locator('#business')).toContainText('Rapid Fix Plan');
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

test('strong fixture renders all five sections of the scroll narrative', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'strong-lcp');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const href = await page.locator('#builder-success a').getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.goto(href);

  // RC3 — five semantic sections in vertical scroll order.
  for (const id of ['cover', 'audience', 'distance', 'funnel', 'business']) {
    await expect(page.locator(`section#${id}`)).toBeAttached();
  }
  // Closing section names the canonical CTA.
  await expect(page.locator('#business')).toContainText('Rapid Fix Plan');
  // Funnel section names the third-stage label so the redesign keeps the
  // FCP/LCP/INP progression visible.
  await expect(page.locator('#funnel')).toContainText('Interaction becomes ready');
});

test('low INP fixture renders the funnel section with FCP and LCP stages', async ({ page }) => {
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
  const funnel = page.locator('#funnel');
  await expect(funnel).toContainText('First content appears');
  await expect(funnel).toContainText('Main content becomes visible');
});

test('scroll-spy nav advances as the user scrolls between sections', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'strong-lcp');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const href = await page.locator('#builder-success a').getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(href);

  // Initial state — cover link is active.
  await expect(page.locator('a[data-spy-link="cover"]')).toHaveAttribute('data-active', 'true');

  // Scroll into the audience section; spy active state advances.
  await page.locator('#audience').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(page.locator('a[data-spy-link="audience"]')).toHaveAttribute('data-active', 'true');

  // Scroll into business section.
  await page.locator('#business').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(page.locator('a[data-spy-link="business"]')).toHaveAttribute('data-active', 'true');
});

test('affirming fixture keeps the same five-section structure', async ({ page }) => {
  await page.goto('http://localhost:4174/build/');
  await page.selectOption('#fixture-select', 'affirming-balance');
  await page.getByRole('button', { name: 'Load selected fixture' }).click();
  await page.getByRole('button', { name: 'Generate report URL' }).click();

  const href = await page.locator('#builder-success a').getAttribute('href');
  expect(href).toBeTruthy();
  if (!href) throw new Error('Expected generated href to be present.');

  await page.goto(href);

  for (const id of ['cover', 'audience', 'distance', 'funnel', 'business']) {
    await expect(page.locator(`section#${id}`)).toBeAttached();
  }
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

  // RC3 — hero lives in the cover section h1; XSS attempts must render
  // as escaped text, never as parsed HTML elements.
  await expect(page.locator('#cover h1')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#cover img')).toHaveCount(0);
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

test('fresh reports surface the generated date in the footer meta strip', async ({ page }) => {
  await page.goto(
    `http://localhost:4174/r?mode=preview&d=test.local&nt=50,30,15,5,0&dt=34,33,33&lu=0&lt=0&fu=0&ft=0&tu=0&tt=0&ulc=0&ufc=0&utc=0&clc=0&cfc=0&ctc=0&s=50&p=7&nc=100&nu=0&nr=10&lc=61&ct=none&rm=none&rr=insufficient_comparable_data&ga=${FRESH_GA_TS}`
  );

  // RC3 — generation date now lives in the .scroll-footer rather than a
  // dedicated credibility-strip block.
  const footer = page.locator('.scroll-footer');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('generated');
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
