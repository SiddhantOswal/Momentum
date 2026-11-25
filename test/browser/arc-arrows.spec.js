import { expect, test } from '@playwright/test';

test('all four direction arrows use the bundled Inter face', async ({ page }) => {
  await page.goto('/app/#/home');
  const arrows = ['←', '↑', '→', '↓'];
  await page.locator('main').evaluate((main, characters) => {
    characters.forEach((character, index) => {
      const span = document.createElement('span');
      span.id = 'arrow-' + index;
      span.className = 'figure';
      span.textContent = character;
      main.append(span);
    });
    return document.fonts.ready;
  }, arrows);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  for (const [index, arrow] of arrows.entries()) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#arrow-' + index });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    expect.soft(fonts, arrow).toEqual([
      expect.objectContaining({ familyName: 'Inter', glyphCount: 1, isCustomFont: true }),
    ]);
  }
  await cdp.detach();
});
