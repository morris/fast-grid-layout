import { expect, test } from '@playwright/test';
import './coverage.js';
import { useTestServer } from './useTestServer.js';

test.describe('docs', () => {
  const getBaseURL = useTestServer(test);

  test('work', async ({ page }) => {
    const url = getBaseURL();

    await page.goto(url);

    await expect(page.locator('.fast-grid-layout > .item')).toHaveCount(10);
  });
});
