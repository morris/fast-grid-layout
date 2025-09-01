import { expect, test } from '@playwright/test';
import './coverage.js';
import { useTestServer } from './test-util.js';

test.describe('docs', () => {
  const getBaseURL = useTestServer(test);

  test('work', async ({ page }) => {
    const url = getBaseURL();

    await page.goto(url);

    await expect(page.locator('.fast-grid-layout > .item')).toHaveCount(10);
  });

  test('move', async ({ page }) => {
    const url = getBaseURL();

    await page.goto(url);

    // TODO make this test do something useful
    //const before101 = await page.getByText('101').boundingBox();
    //const before102 = await page.getByText('102').boundingBox();

    await page.getByText('101').dragTo(page.getByText('102'));

    //const after101 = await page.getByText('101').boundingBox();
    //const after102 = await page.getByText('102').boundingBox();

    //expect(before101).not.toEqual(after101);
    //expect(before102).not.toEqual(after102);
  });
});
