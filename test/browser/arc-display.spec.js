import { expect, test } from '@playwright/test';

test('the approved Main hero title measures about 424 px', async ({ page }) => {
  await page.goto('/app/#/floor');
  const measure = await page.locator('main').evaluate(async main => {
    const title = document.createElement('h2');
    title.textContent = 'Start with a sample order.';
    title.style.cssText = `width:max-content; white-space:nowrap;
      font:var(--arc-font-semibold) var(--arc-text-hero-title)/var(--arc-leading-hero-title) var(--arc-font-display);
      letter-spacing:var(--arc-tracking-hero-title)`;
    main.append(title);
    await document.fonts.ready;
    const { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing } = getComputedStyle(title);
    return { fontFamily, fontWeight, fontSize, lineHeight, letterSpacing, width: title.getBoundingClientRect().width };
  });

  expect.soft(measure).toMatchObject({
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    fontSize: '36px',
    lineHeight: '42px',
    letterSpacing: '-0.8px',
  });
  expect.soft(measure.width).toBeGreaterThanOrEqual(420);
  expect(measure.width).toBeLessThanOrEqual(428);
});
