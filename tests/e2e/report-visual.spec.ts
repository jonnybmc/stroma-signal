import { expect, test } from '@playwright/test';
import {
  affirmingAggregateFixture,
  encodeSignalReportUrl,
  lowInpCoverageAggregateFixture,
  strongLcpCoverageAggregateFixture
} from '../../packages/signal-contracts/src/index.ts';

function buildQaUrl(aggregate: Parameters<typeof encodeSignalReportUrl>[0], scene: 'act1' | 'act2' | 'act3' | 'act4') {
  const encoded = encodeSignalReportUrl(aggregate, 'http://localhost:4174/r').url;
  const url = new URL(encoded);
  url.searchParams.set('qa', '1');
  url.searchParams.set('scene', scene);
  url.searchParams.set('motion', 'reduced');
  return url.toString();
}

test.describe('report visual regression', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Visual snapshots run in Chromium only.');
  // Visual baselines are intentionally local-only and tracked per platform
  // so contributors can refresh Darwin and Linux snapshots independently.

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
  });

  test('urgent Act 1 reveal stays immersive', async ({ page }) => {
    await page.goto(buildQaUrl(strongLcpCoverageAggregateFixture, 'act1'));
    await expect(page.locator('.sr-act[data-act="1"]')).toHaveScreenshot('report-act1-urgent.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('urgent Act 2 race keeps the temporal wait-gap scene', async ({ page }) => {
    await page.goto(buildQaUrl(strongLcpCoverageAggregateFixture, 'act2'));
    await expect(page.locator('.sr-act[data-act="2"]')).toHaveScreenshot('report-act2-urgent-race.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('urgent Act 3 renders a measured performance cliff', async ({ page }) => {
    await page.goto(buildQaUrl(strongLcpCoverageAggregateFixture, 'act3'));
    await expect(page.locator('.sr-act[data-act="3"]')).toHaveScreenshot('report-act3-urgent-cliff.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('reduced Act 3 fallback still feels intentional', async ({ page }) => {
    await page.goto(buildQaUrl(lowInpCoverageAggregateFixture, 'act3'));
    await expect(page.locator('.sr-act[data-act="3"]')).toHaveScreenshot('report-act3-reduced-fallback.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('Act 4 handoff stays premium and evidence-led', async ({ page }) => {
    await page.goto(buildQaUrl(strongLcpCoverageAggregateFixture, 'act4'));
    await expect(page.locator('.sr-act[data-act="4"]')).toHaveScreenshot('report-act4-handoff.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });

  test('affirming case keeps the same structure without forcing panic', async ({ page }) => {
    await page.goto(buildQaUrl(affirmingAggregateFixture, 'act3'));
    await expect(page.locator('.sr-act[data-act="3"]')).toHaveScreenshot('report-act3-affirming.png', {
      animations: 'disabled',
      caret: 'hide'
    });
  });
});
