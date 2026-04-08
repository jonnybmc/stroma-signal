import type { APIRequestContext } from '@playwright/test';
import { expect, test } from '@playwright/test';

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

  await expect
    .poll(async () => (await readCollectorEvents(request)).length)
    .toBe(1);
  await expect(dataLayerMeta).toContainText('event=perf_tier_report', { timeout: 5_000 });
  await expect(dataLayerJson).toContainText('"event": "perf_tier_report"');
  await expect(previewLink).toHaveAttribute('href', /http:\/\/localhost:4174\/r\?/);
  await expect(previewLink).toHaveAttribute('href', /[?&]rm=none/);
  await expect(previewLink).toHaveAttribute('href', /[?&]rr=insufficient_comparable_data/);

  const previewHref = await previewLink.getAttribute('href');
  expect(previewHref).toBeTruthy();

  await page.goto(previewHref!);
  await expect(page.locator('.headline')).toContainText('localhost:4173');
});

test('multi-page spike flow preserves collector truth and preview url semantics', async ({ page, request }) => {
  await request.post('http://localhost:4173/api/reset');
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: 'Flush this page load now' }).click();
  await page.getByRole('link', { name: 'Visit second route' }).click();
  await page.getByRole('button', { name: 'Flush this page load now' }).click();

  await expect
    .poll(async () => (await readCollectorEvents(request)).length)
    .toBe(2);
  const payload = await readCollectorEvents(request) as Array<{ url?: string }>;

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

  await page.goto(href!);

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

  await page.locator('#mode-report-url').click();
  await page.locator('#report-url-input').fill(href!);
  await page.getByRole('button', { name: 'Validate report URL' }).click();

  await expect(page.locator('#builder-success')).toContainText('Validated URL');
  await expect(page.locator('#builder-summary')).toContainText('TTFB');
  await expect(page.locator('#builder-summary')).toContainText('fcp unavailable');
  await expect(page.locator('#builder-summary')).toContainText('constrained');
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

test('report route renders hostile domain text safely', async ({ page }) => {
  const hostileDomain = encodeURIComponent('<img src=x onerror=alert(1)>');
  await page.goto(`http://localhost:4174/r?mode=preview&d=${hostileDomain}&nt=25,25,25,25,0&dt=34,33,33&s=100&p=1&nc=100&nu=0&nr=0&lc=0&ct=none&rm=none`);

  await expect(page.locator('.headline')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.headline img')).toHaveCount(0);
});

test('report route shows a friendly error for malformed urls instead of crashing', async ({ page }) => {
  await page.goto('http://localhost:4174/r?nt=garbage&dt=34,33,33&ct=none&rm=none');

  await expect(page.locator('.headline')).toContainText('Invalid report URL');
  await expect(page.locator('.error')).toContainText('Invalid encoded integer tuple');
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
