import { expect, test } from '@playwright/test';
import { open, play } from './helpers';

// The controls, shown before a run on the picked level card and on the pause
// screen: the keys at Mac size, where to touch on a touch screen, with the
// hero's own move by name and diving. What each row says is checked by
// tests/controls-help.test.ts.

test('the picked level card shows the controls before a run, and follows the hero picked', async ({ page, hasTouch }) => {
  const problems = await open(page);
  const card = page.locator('.area.picked .area-controls');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-input', hasTouch ? 'touch' : 'keyboard');
  await page.locator('[data-hero="Yaarbro"]').click();
  await expect(card).toContainText(hasTouch ? 'Round button' : 'X or Shift');
  await expect(card).toContainText('Roll');
  await expect(card).toContainText('Dive');
  await expect(card).toContainText('Move');
  await expect(card).toContainText('Jump');
  await page.locator('[data-hero="Caputo"]').click();
  await expect(card).toContainText('Pounce');
  await expect(card).not.toContainText('Roll');
  expect(problems).toEqual([]);
});

test('the pause screen shows the same controls', async ({ page, hasTouch }) => {
  const problems = await open(page);
  await play(page, 'Caputo', 'normal');
  await page.locator('#pause').click();
  const panel = page.locator('#paused-controls');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(hasTouch ? 'Drag on the left' : 'Arrows or W A S D');
  await expect(panel).toContainText('Pounce');
  await expect(panel).toContainText('Dive');
  expect(problems).toEqual([]);
});
