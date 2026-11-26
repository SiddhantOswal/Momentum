import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark']) {
  for (const width of [1440, 375]) {
    test(`Arc opens a disconnected shell in ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 1440 ? 960 : 812 });
      await page.emulateMedia({ colorScheme: theme });
      // The test server runs with Arc off, so the session read answers ARC_NOT_ENABLED.
      await page.route('**/api/arc/**', route => route.fulfill({ status: 404, json: { ok: false, error: { code: 'ARC_NOT_ENABLED', message: 'Arc is not enabled.' } } }));
      await page.goto('/app/#/home');

      const launcher = page.getByRole('button', { name: 'Open Arc by Momentum' });
      const dialog = page.getByRole('dialog', { name: 'Arc by Momentum' });
      await expect(dialog).toBeHidden();
      await expect(launcher).toBeVisible();
      await launcher.click();
      await expect(dialog).toBeVisible();
      await expect(page.locator('html')).toHaveCSS('color-scheme', theme);
      await expect(dialog).toHaveCSS('background-color', theme === 'dark' ? 'rgb(18, 21, 25)' : 'rgb(238, 240, 242)');
      const box = await dialog.boundingBox();
      expect(box).toMatchObject(width === 1440
        ? { x: 680, y: 56, width: 760, height: 904 }
        : { x: 0, y: 0, width: 375, height: 812 });

      const messages = dialog.getByRole('log', { name: 'Arc messages' });
      await expect(messages).toHaveText('Not connected');
      await expect(dialog.getByRole('textbox', { name: 'Message Arc' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Send' })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'New lot' })).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: /approve/i })).toHaveCount(0);

      const mic = dialog.getByRole('button', { name: 'Speak to Arc' });
      await expect(mic).toBeVisible();
      await expect(mic).toHaveAttribute('disabled', '');
      await expect(mic).toHaveAccessibleDescription('Voice input is unavailable.');
      await expect(mic).toMatchAriaSnapshot('- button "Speak to Arc" [disabled]');
      expect(await mic.evaluate(node => node.onclick)).toBeNull();
      expect(await mic.evaluate(node => { node.focus(); return document.activeElement === node; })).toBe(false);

      const history = dialog.getByRole('button', { name: 'Past work' });
      await history.click();
      await expect(history).toHaveAttribute('aria-pressed', 'true');
      await expect(dialog.getByRole('region', { name: 'Past work' })).toHaveText('Not connected');
      await history.click();
      await expect(messages).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(launcher).toBeFocused();
    });
  }
}

test('the shared Arc launcher opens and closes from every route in the sidebar', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Arc by Momentum' });
  const hosts = [['home', 'Home'], ['new-lot', 'New lot'], ['plant-explorer', 'Plant Explorer'], ['preparation-flow', 'Preparation flow'],
    ['insights', 'Insights'], ['photo-diagnosis', 'Photo diagnosis'], ['planning', 'Planning']];
  for (const [path, title] of hosts) {
    await page.goto('/app/#/' + path);
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    const launcher = page.getByRole('button', { name: 'Open Arc by Momentum' });
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.arc-panel-host')).toHaveText(title);
    await dialog.getByRole('button', { name: 'Close Arc', exact: true }).click();
    await expect(launcher).toBeFocused();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
  }
});
