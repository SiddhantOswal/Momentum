import { expect, test } from '@playwright/test';

const photos = Array.from({ length: 10 }, (_, i) => ({ id: `photo-${String(i + 1).padStart(2, '0')}`, label: `Approved photo ${i + 1}` }));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
  await page.route('**/evidence/approved-photos', (route) => json(route, { ok: true, photos }));
});

test('the page opens on photo 1 with nothing diagnosed and no accuracy figure', async ({ page }) => {
  await page.goto('/app/#/photo-diagnosis');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Photo diagnosis');
  await expect(page.getByText('Approved photo 1 of 10')).toBeVisible();
  await expect(page.getByText('Not run yet')).toBeVisible();
  await expect(page.getByText('The photo image is not connected.')).toBeVisible();
  await expect(page.getByText('7 of 10')).toHaveCount(0);
  await expect(page.getByText('No stored accuracy run for the ten photos.')).toBeVisible();
});

test('Run diagnosis posts the selected photo id and shows the label as a model estimate', async ({ page }) => {
  let body;
  await page.route('**/evidence/classify-photo', (route) => {
    body = route.request().postDataJSON();
    return json(route, { ok: true, source: 'vertex-gemini', photoId: body.photoId, label: 'DELAM', classifiedAt: '2026-10-15T00:00:00Z' });
  });
  await page.goto('/app/#/photo-diagnosis');
  await page.getByRole('button', { name: 'Approved photo 3' }).click();
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await expect(page.getByText('Delamination')).toBeVisible();
  await expect(page.getByText('Model estimate')).toBeVisible();
  expect(body).toEqual({ photoId: 'photo-03' });
});

test('Other photo moves to the next approved photo and clears the result', async ({ page }) => {
  await page.route('**/evidence/classify-photo', (route) => json(route, { ok: true, source: 'vertex-gemini', photoId: 'photo-01', label: 'WARP' }));
  await page.goto('/app/#/photo-diagnosis');
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await expect(page.getByText('Warp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Other photo' }).click();
  await expect(page.getByText('Approved photo 2 of 10')).toBeVisible();
  await expect(page.getByText('Not run yet')).toBeVisible();
});

test('a failed classification shows the error and no label', async ({ page }) => {
  await page.route('**/evidence/classify-photo', (route) => json(route, { ok: false, error: { message: 'The photo model is unavailable.' } }, 503));
  await page.goto('/app/#/photo-diagnosis');
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await expect(page.getByText('The diagnosis did not run.')).toBeVisible();
  await expect(page.getByText('The photo model is unavailable.')).toBeVisible();
});

test('a response with the wrong label or photo is rejected, not rendered', async ({ page }) => {
  await page.route('**/evidence/classify-photo', (route) => json(route, { ok: true, source: 'vertex-gemini', photoId: 'photo-01', label: '<img src=x onerror=alert(1)>' }));
  await page.goto('/app/#/photo-diagnosis');
  await page.getByRole('button', { name: 'Run diagnosis' }).click();
  await expect(page.getByText('The diagnosis did not run.')).toBeVisible();
  await expect(page.locator('main img')).toHaveCount(0);
});

test('an unavailable photo list disables the controls', async ({ page }) => {
  await page.unroute('**/evidence/approved-photos');
  await page.route('**/evidence/approved-photos', (route) => route.abort());
  await page.goto('/app/#/photo-diagnosis');
  await expect(page.getByText('The approved photo set is unavailable.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run diagnosis' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Other photo' })).toBeDisabled();
});
