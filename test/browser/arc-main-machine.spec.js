import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const reference = readFileSync(new URL('../../docs/arc/design/source/html/light/Main.html', import.meta.url), 'utf8');

function palette(selector) {
  const block = reference.split(selector + '{')[1].split('}')[0];
  return Object.fromEntries([...block.matchAll(/(--h-[\w-]+):([^;]+)/g)].map(([, name, value]) => [name, value]));
}

test('the Main illustration has all 14 approved machine tokens in both themes', async ({ page }) => {
  const dark = palette('.h3');
  const light = { ...dark, ...palette('.m.lt .h3') };
  expect(Object.keys(dark)).toHaveLength(14);

  await page.goto('/app/#/floor');
  const illustration = page.locator('.arc-main-machine');
  await page.locator('main').evaluate(main => {
    const element = document.createElement('div');
    element.className = 'arc-main-machine';
    main.append(element);
  });

  for (const [theme, expected] of Object.entries({ dark, light })) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const actual = await illustration.evaluate((element, names) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(names.map(name => [name, style.getPropertyValue(name).trim()]));
    }, Object.keys(expected));
    expect.soft(actual, theme).toEqual(expected);
  }
});
