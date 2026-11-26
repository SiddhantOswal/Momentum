import { expect, test } from '@playwright/test';
import { FINGERPRINT, fillSettings, mockNewLot, reachConditions } from './new-lot-mock.js';

const plan = async (page) => {
  await fillSettings(page);
  await page.getByRole('button', { name: 'Plan this lot' }).click();
};

test('the order step reads a sample and keeps Confirm off until every check is ticked', async ({ page }) => {
  const seen = await mockNewLot(page);
  await page.goto('/app/#/new-lot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('New lot');
  await expect(page.locator('.sidebar .nav-item[aria-current="page"]')).toHaveText('New Lot');
  await expect(page.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
  await page.getByRole('button', { name: 'PO1 Single line' }).click();
  await expect(page.getByText('Draft, not confirmed')).toBeVisible();
  expect(seen.extract).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
  await page.getByLabel('The source line is the one you want').check();
  await page.getByLabel('The quantity matches the order').check();
  await expect(page.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
  await page.getByLabel('The catalog item is the right box').check();
  await expect(page.getByRole('button', { name: 'Confirm order' })).toBeEnabled();
});

test('a failed read shows the error and no order values', async ({ page }) => {
  await mockNewLot(page, { failExtract: true });
  await page.goto('/app/#/new-lot');
  await page.getByRole('button', { name: 'PO1 Single line' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'The order could not be read.' })).toBeVisible();
  await expect(page.getByText('PKBX0041')).toHaveCount(0);
});

test('the conditions step counts confirmed fields and blocks planning until all twelve are set', async ({ page }) => {
  await mockNewLot(page);
  await reachConditions(page);
  await expect(page.getByText('Confirm all 12 fields to continue. 5 of 12 done.')).toBeVisible();
  await expect(page.getByText('7 fields left to confirm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan this lot' })).toBeDisabled();
  await fillSettings(page);
  await expect(page.getByRole('button', { name: 'Plan this lot' })).toBeEnabled();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Draft, not confirmed')).toBeVisible();
});

test('planning sends the confirmed order, conditions and settings with an idempotency key', async ({ page }) => {
  const seen = await mockNewLot(page);
  await reachConditions(page);
  await plan(page);
  await expect(page.getByText('3 of 7 settings change')).toBeVisible();
  expect(seen.plan).toHaveLength(1);
  const body = seen.plan[0].body;
  for (const part of ['confirmedItemCode', 'PKBX0041', 'confirmedQuantity', '1300', 'conditionsConfirmed', 'rollTempC', 'ambientRhPct']) expect(body).toContain(part);
  expect(seen.plan[0].key).toMatch(/[0-9a-f-]{36}/);
  await expect(page.getByText('Model estimate').first()).toBeVisible();
  await expect(page.locator('.nl-figure')).toContainText('100.4');
  await expect(page.locator('.nl-figure')).toContainText('83.0');
});

test('a failed plan shows the server message and no result', async ({ page }) => {
  await mockNewLot(page, { failPlan: true });
  await reachConditions(page);
  await plan(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Planning failed. Nothing was saved.' })).toBeVisible();
  await expect(page.getByText('3 of 7 settings change')).toHaveCount(0);
});

test('approval needs the checkbox, sends the fingerprint and offers the PDF afterwards', async ({ page }) => {
  const seen = await mockNewLot(page);
  await reachConditions(page);
  await plan(page);
  await page.getByRole('button', { name: /Review job card/ }).click();
  await expect(page.getByText('Draft saved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Rev 1 is stored and read back.')).toBeVisible();
  const approve = page.getByRole('button', { name: 'Approve Rev 1' });
  await expect(approve).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(page.getByRole('link', { name: 'Open job card (PDF)' })).toHaveAttribute('href', '/jobs/JOB-TEST-1/card.pdf');
  expect(seen.approve).toEqual([{ reviewConfirmed: true, revisionFingerprint: FINGERPRINT }]);
  await expect(page.getByText('Demo session, simulated').first()).toBeVisible();
});

test('approval is not offered by keyboard before the checkbox is ticked', async ({ page }) => {
  await mockNewLot(page);
  await reachConditions(page);
  await plan(page);
  await page.getByRole('button', { name: /Review job card/ }).click();
  const checkbox = page.getByRole('checkbox');
  await checkbox.focus();
  await page.keyboard.press('Space');
  await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Approve Rev 1' })).toBeEnabled();
});

test('a missing explanation holds approval and offers retry, continue and hold', async ({ page }) => {
  await mockNewLot(page, { explanation: '' });
  await reachConditions(page);
  await plan(page);
  await expect(page.getByText('The explanation is not available.')).toBeVisible();
  await expect(page.getByText('Explanation did not finish')).toBeVisible();
  await page.getByRole('button', { name: 'Retry explanation' }).click();
  await expect(page.getByText('Retrying the explanation alone is not connected yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue with saved numbers' }).click();
  await expect(page.getByText('Approval is held while the explanation is missing.').first()).toBeVisible();
  await page.getByRole('button', { name: /Review job card/ }).click();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Approve Rev 1' })).toBeDisabled();
});

test('a replaced revision blocks approval and plans again from the conditions step', async ({ page }) => {
  const seen = await mockNewLot(page, { stale: true });
  await reachConditions(page);
  await plan(page);
  await page.getByRole('button', { name: /Review job card/ }).click();
  await expect(page.getByText('An input changed after Rev 1 was prepared.')).toBeVisible();
  await expect(page.getByText('Replaced, read only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve Rev 1' })).toBeDisabled();
  await expect(page.getByText('Off. Rev 1 is replaced and cannot be approved.')).toBeVisible();
  expect(seen.approve).toHaveLength(0);
  await page.getByRole('button', { name: /Plan this lot again/ }).click();
  await expect(page.getByText('Planned machine settings')).toBeVisible();
  await page.getByRole('button', { name: /Plan this lot/ }).click();
  await expect.poll(() => seen.conditions.length).toBe(1);
  expect(seen.conditions[0].conditions.map((entry) => entry.field)).toContain('paperMoisturePct');
});

test('text is identical in both themes and the page does not scroll sideways', async ({ page }) => {
  await mockNewLot(page);
  await page.goto('/app/#/new-lot');
  await page.getByRole('button', { name: 'PO1 Single line' }).click();
  await expect(page.getByText('Draft, not confirmed')).toBeVisible();
  const read = () => page.locator('.main').innerText();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const dark = await read();
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  expect(await read()).toBe(dark);
  for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth), `${width}x${height}`).toBe(true);
  }
});
