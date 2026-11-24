import { expect, test } from '@playwright/test';

async function beforeReact(page) {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.route('**/app/assets/*.js', route => route.abort());
  await page.goto('/app/');
  await expect(page.locator('#root')).toBeEmpty();
  return page.locator('html');
}

test('the inline bootstrap follows a light system preference before React loads', async ({ page }) => {
  const html = await beforeReact(page);
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveCSS('color-scheme', 'light');
});

test('the inline bootstrap ignores an invalid stored theme before React loads', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('momentum-theme', 'sepia'));
  const html = await beforeReact(page);
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(html).toHaveCSS('color-scheme', 'light');
});
