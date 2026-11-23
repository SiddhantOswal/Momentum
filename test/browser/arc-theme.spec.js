import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const reference = readFileSync(new URL('../../docs/arc/design/source/html/light/Main.html', import.meta.url), 'utf8');

const insights = readFileSync(new URL('../../docs/arc/design/source/html/light/Insights.html', import.meta.url), 'utf8');

function referenceColors(selector, source = reference) {
  const block = source.split(selector + '{')[1].split('}')[0];
  return Object.fromEntries([...block.matchAll(/(--[\w]+):([^;]+)/g)].map(([, name, value]) => [name, value]));
}

async function expectTokens(locator, tokens) {
  const actual = await locator.evaluate((element, names) => {
    const styles = getComputedStyle(element);
    return Object.fromEntries(names.map(name => [name, styles.getPropertyValue(name).trim()]));
  }, Object.keys(tokens));
  expect(actual).toEqual(tokens);
}

for (const theme of ['dark', 'light']) {
  test(`/app uses the approved ${theme} tokens with a ${theme} system preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/app/');

    const root = page.locator('html');
    await expect(root).toHaveCSS('color-scheme', theme);
    await expectTokens(root, {
      ...referenceColors(theme === 'light' ? '.m.lt' : '.m'),
      '--arc-font-body': "'Inter', system-ui, sans-serif",
      '--arc-font-display': "'Inter Tight', 'Inter', sans-serif",
      '--arc-text-body': '15px',
      '--arc-leading-body': '1.4',
      '--arc-font-medium': '500',
      '--arc-font-semibold': '600',
      '--arc-font-bold': '700',
      '--arc-text-page-title': '28px',
      '--arc-leading-page-title': '34px',
      '--arc-text-card-title': '17px',
      '--arc-leading-card-title': '24px',
      '--arc-text-key-value': '24px',
      '--arc-leading-key-value': '28px',
      '--arc-text-action': '16px',
      '--arc-sidebar-width': '232px',
      '--arc-topbar-height': '56px',
      '--arc-content-padding': '24px',
      '--arc-grid-column': '82px',
      '--arc-grid-gap': '16px',
      '--arc-card-padding': '20px',
      '--arc-radius-card': '12px',
      '--arc-radius-control': '10px',
      '--arc-radius-chip': '6px',
      '--arc-accent-ink': '#18110E',
    });

    const interLoaded = await page.evaluate(async () => {
      const faces = await Promise.all([
        document.fonts.load('400 15px Inter', 'Momentum ₹'),
        document.fonts.load('600 24px "Inter Tight"', 'Momentum ₹'),
      ]);
      return faces.every(group => group.length && group.every(face => face.status === 'loaded'));
    });
    expect(interLoaded).toBe(true);

    await page.locator('body').evaluate(body => {
      for (const className of ['arc-kraft', 'arc-glass', 'arc-machine']) {
        const element = document.createElement('div');
        element.className = className;
        body.append(element);
      }
    });
    await expectTokens(page.locator('.arc-kraft'), referenceColors('.m .kr,.m.lt .kr'));
    await expectTokens(page.locator('.arc-machine'), referenceColors(theme === 'light' ? '.m.lt .mo' : '.mo', insights));
    if (theme === 'light') {
      await expectTokens(page.locator('.arc-glass'), referenceColors('.m.lt .gl'));
    }
  });
}

test('/app follows system changes until a choice, then switches in place and remembers it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/app/#/defects');

  const root = page.locator('html');
  const heading = page.getByRole('heading', { name: 'Defects', exact: true });
  await expect(heading).toBeVisible();
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveCSS('color-scheme', 'dark');
  const toggle = page.getByRole('button', { name: 'Switch to light theme' });
  await toggle.focus();
  await toggle.press('Space');
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeFocused();
  await expect(heading).toBeVisible();
  await expect(page).toHaveURL(/#\/defects$/);

  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveCSS('color-scheme', 'light');
  await page.reload();
  await expect(root).toHaveCSS('color-scheme', 'light');
});

test('/app matches the approved title styles and numeric arrow font', async ({ page }) => {
  await page.goto('/app/#/floor');

  const pageTitle = page.getByRole('heading', { level: 1, name: 'Floor' });
  const cardTitle = page.getByRole('heading', { level: 2, name: /Scrap rate by month/ });
  const displayFont = '"Inter Tight", Inter, sans-serif';
  const titleStyles = {
    fontFamily: displayFont,
    fontWeight: '600',
    fontFeatureSettings: 'normal',
    fontVariationSettings: 'normal',
    fontOpticalSizing: 'auto',
    fontVariantNumeric: 'normal',
  };
  const readStyles = (locator, keys) => locator.evaluate((node, properties) => {
    const style = getComputedStyle(node);
    return Object.fromEntries(properties.map(key => [key, style[key]]));
  }, keys);

  await page.locator('main').evaluate(main => {
    for (const id of ['app-arrow', 'reference-arrow']) {
      const arrow = document.createElement('span');
      arrow.id = id;
      arrow.textContent = '→';
      if (id === 'app-arrow') arrow.className = 'figure';
      else arrow.style.cssText = `font:600 22px/28px 'Inter Tight', 'Inter', sans-serif;
        font-variant-numeric:tabular-nums;font-feature-settings:'tnum'`;
      main.append(arrow);
    }
    return document.fonts.ready;
  });

  const arrow = page.locator('#app-arrow');
  const arrowKeys = [...Object.keys(titleStyles), 'letterSpacing'];
  const referenceArrow = page.locator('#reference-arrow');
  await expect.soft(await readStyles(arrow, arrowKeys)).toEqual(await readStyles(referenceArrow, arrowKeys));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  async function glyphFont(selector) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return fonts;
  }
  const referenceGlyph = await glyphFont('#reference-arrow');
  expect(referenceGlyph).toEqual([expect.objectContaining({ glyphCount: 1, isCustomFont: false })]);
  expect(await glyphFont('#app-arrow')).toEqual(referenceGlyph);

  const headingKeys = [...Object.keys(titleStyles), 'fontSize', 'lineHeight', 'letterSpacing'];
  expect.soft(await readStyles(pageTitle, headingKeys)).toEqual({
    ...titleStyles, fontSize: '28px', lineHeight: '34px', letterSpacing: '-0.4px',
  });
  expect(await readStyles(cardTitle, headingKeys)).toEqual({
    ...titleStyles, fontSize: '17px', lineHeight: '24px', letterSpacing: '-0.1px',
  });
});
