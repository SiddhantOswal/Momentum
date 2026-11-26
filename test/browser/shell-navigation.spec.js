import { expect, test } from '@playwright/test';

const sidebar = ['Home', 'New Lot', 'Plant Explorer', 'Preparation Flow', 'Insights', 'Photo Diagnosis', 'Planning'];
const viewports = [[1440, 900], [1280, 800], [1024, 768]];

test('the sidebar lists the approved destinations once, in the approved order', async ({ page }) => {
  await page.goto('/app/#/home');
  const labels = await page.locator('.sidebar .nav-item').allTextContents();
  expect(labels.map(label => label.trim())).toEqual(sidebar);
  await expect(page.locator('.sidebar .nav-group')).toHaveText('Future');
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveCount(1);
});

for (const [alias, label] of [
  ['floor', 'Home'], ['lots', 'New Lot'], ['impact', 'Insights'], ['models', 'Insights'], ['defects', 'Photo Diagnosis'],
  ['screen-order-input', 'New Lot'], ['screen-defect-check', 'Photo Diagnosis'], ['screen-impact', 'Insights'],
]) {
  test(`the earlier address #/${alias} lands on ${label} without adding a sidebar entry`, async ({ page }) => {
    await page.goto('/app/#/' + alias);
    await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText(label);
    await expect(page.locator('.sidebar .nav-item')).toHaveCount(sidebar.length);
    await expect(page).not.toHaveURL(new RegExp(`#/${alias}$`));
  });
}

for (const [width, height] of viewports) {
  test(`the shell keeps one-line labels and no sideways scroll at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/app/#/preparation-flow');
    const measurements = await page.evaluate(() => ({
      sidebarWidth: document.querySelector('.sidebar').getBoundingClientRect().width,
      items: [...document.querySelectorAll('.sidebar .nav-item')].map(item => ({
        label: item.textContent.trim(), height: item.getBoundingClientRect().height, clipped: item.scrollWidth > item.clientWidth,
      })),
      sidewaysScroll: document.scrollingElement.scrollWidth > window.innerWidth,
    }));
    expect(measurements.sidebarWidth).toBe(232);
    for (const item of measurements.items) {
      expect(item.height, item.label).toBe(44);
      expect(item.clipped, item.label).toBe(false);
    }
    expect(measurements.sidewaysScroll).toBe(false);
  });
}

test('the breadcrumb and page title follow the approved wording', async ({ page }) => {
  await page.goto('/app/#/preparation-flow');
  await expect(page.locator('.breadcrumb')).toHaveText('Plant / Preparation flow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Preparation flow');
});
