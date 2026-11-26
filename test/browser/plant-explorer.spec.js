import { expect, test } from '@playwright/test';

const stages = ['Unwind', 'Corrugate', 'Glue', 'Dry', 'Cut'];
const viewports = [[1440, 900], [1280, 800], [1024, 768], [390, 844]];

test('Plant Explorer opens on the glue stage with the reference run labelled', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plant Explorer');
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Plant Explorer');
  await expect(page.getByText('Illustrative line, not a live view')).toBeVisible();
  await expect(page.getByText('Stage 3 of 5, glue')).toBeVisible();
  await expect(page.getByRole('button', { name: /Glue/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Glue, stage 3' })).toBeVisible();
  await expect(page.getByText('Model estimate')).toBeVisible();
  await expect(page.getByText('Reference lot PKBX0041, awaiting sign-off.')).toBeVisible();
});

test('the retired October figures and unsupported claims are absent', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  const text = await page.locator('main, .main').first().innerText();
  for (const retired of ['86%', '35 s', '0.078', 'humid days', 'pass level', 'confirmed']) {
    expect(text, retired).not.toContain(retired);
  }
  await expect(page.getByText('42% humidity')).toBeVisible();
  await expect(page.getByText('45 s', { exact: true })).toBeVisible();
});

test('choosing another stage moves the selection and shows no invented values', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  await page.getByRole('button', { name: /Dry/ }).click();
  await expect(page.getByRole('button', { name: /Dry/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Glue/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Stage 4 of 5, dry')).toBeVisible();
  await expect(page.getByText('No reference values for this stage.')).toBeVisible();
  await expect(page.getByText('Gum viscosity')).toHaveCount(0);
  await expect(page.locator('.px-marker-selected')).toHaveText('4');
});

test('the stage buttons work from the keyboard', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  await page.getByRole('button', { name: /Cut/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Stage 5 of 5, cut')).toBeVisible();
});

test('Compare HIGH and MEDIUM says it is not connected instead of inventing a comparison', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  await expect(page.getByText('Comparison is not connected yet.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Compare HIGH and MEDIUM' }).click();
  await expect(page.getByText('Comparison is not connected yet.')).toBeVisible();
});

test('Open Insights goes to the Insights route', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  await page.getByRole('link', { name: 'Open Insights' }).click();
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('Insights');
});

test('both themes keep the same text and the glass readouts keep light-on-dark text', async ({ page }) => {
  await page.goto('/app/#/plant-explorer');
  const read = () => page.locator('.px-grid').innerText();
  await page.evaluate(() => localStorage.setItem('momentum-theme', 'dark'));
  await page.reload();
  const dark = await read();
  await page.getByRole('button', { name: 'Light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await read()).toBe(dark);
  const readoutColour = await page.locator('.px-readout-label').first().evaluate(node => getComputedStyle(node).color);
  expect(readoutColour).toBe('rgb(195, 203, 211)');
});

for (const [width, height] of viewports) {
  test(`Plant Explorer has no sideways scroll or clipped stage buttons at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/app/#/plant-explorer');
    const measurements = await page.evaluate(() => ({
      sidewaysScroll: document.scrollingElement.scrollWidth > window.innerWidth,
      tabs: [...document.querySelectorAll('.px-tab')].map(tab => ({ label: tab.textContent.trim(), clipped: tab.scrollWidth > tab.clientWidth })),
      headClipped: (() => { const head = document.querySelector('.px-stage-head'); return head.scrollWidth > head.clientWidth; })(),
    }));
    expect(measurements.sidewaysScroll).toBe(false);
    expect(measurements.headClipped).toBe(false);
    expect(measurements.tabs.map(tab => tab.label.replace(/^\d/, ''))).toEqual(stages);
    for (const tab of measurements.tabs) expect(tab.clipped, tab.label).toBe(false);
  });
}
