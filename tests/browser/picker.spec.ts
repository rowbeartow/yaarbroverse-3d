import { expect, test, type Page } from '@playwright/test';
import { open, pickPlayer, play, snapshot, standOn } from './helpers';

// The level picker: a card for each area, showing the current player's
// finished difficulties and best times. The names are made up.

const mark = (page: Page, level: string, difficulty: string) =>
  page.locator(`.area[data-level="${level}"] .mark[data-mark="${difficulty}"]`);

const finishSandbox = async (page: Page, difficulty: string): Promise<void> => {
  await play(page, 'Yaarbro', difficulty);
  await standOn(page, 'bank-end', 3);
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('ArrowUp');
  await page.locator('#again').click();
  await expect(page.locator('#start')).toBeVisible();
};

test('the start screen shows the grove as a card, picked, with nothing finished for a new player', async ({ page }) => {
  const problems = await open(page);
  await expect(page.locator('#start-title')).toHaveText('Where to?');
  await expect(page.locator('.area')).toHaveCount(1);
  const card = page.locator('.area[data-level="bouncing-grove"]');
  await expect(card.locator('.area-pick')).toHaveAttribute('aria-checked', 'true');
  await expect(card.locator('.area-name')).toHaveText('The Bouncing Grove');
  await expect(card.locator('.area-lead')).toHaveText('Find the golden leaf, tucked in the canopy.');
  // The card's picture arrives and is a real picture.
  await expect.poll(() => card.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(100);
  for (const difficulty of ['easy', 'normal', 'hard']) {
    await expect(mark(page, 'bouncing-grove', difficulty)).toHaveAttribute('data-finished', 'false');
    await expect(mark(page, 'bouncing-grove', difficulty).locator('.mark-time')).toHaveText('Not yet');
  }
  // Nothing is locked: Play works for every difficulty.
  for (const difficulty of ['easy', 'normal', 'hard']) {
    await page.locator(`[data-difficulty="${difficulty}"]`).click();
    await expect(page.locator('#play')).toBeEnabled();
  }
  expect(problems).toEqual([]);
});

test('a card marks each finished difficulty with the best time, for the player who did it', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  // The development level is a card only because the address names it.
  await expect(page.locator('.area')).toHaveCount(2);
  await expect(page.locator('.area[data-level="sandbox"] .area-pick')).toHaveAttribute('aria-checked', 'true');

  await finishSandbox(page, 'easy');
  await expect(mark(page, 'sandbox', 'easy')).toHaveAttribute('data-finished', 'true');
  await expect(mark(page, 'sandbox', 'easy').locator('.mark-time')).toHaveText(/^\d+:\d\d\.\d$/);
  await expect(mark(page, 'sandbox', 'easy')).toHaveAttribute('aria-label', /^Easy: finished, best time \d+:\d\d\.\d$/);
  await expect(mark(page, 'sandbox', 'normal')).toHaveAttribute('data-finished', 'false');
  await expect(mark(page, 'sandbox', 'hard')).toHaveAttribute('aria-label', 'Hard: not finished yet');
  // The other area's card is untouched.
  await expect(mark(page, 'bouncing-grove', 'easy')).toHaveAttribute('data-finished', 'false');

  await finishSandbox(page, 'hard');
  await expect(mark(page, 'sandbox', 'hard')).toHaveAttribute('data-finished', 'true');

  // A second player sees their own card: nothing finished.
  await page.locator('#switch-player').click();
  await pickPlayer(page, 'Moss');
  for (const difficulty of ['easy', 'normal', 'hard']) await expect(mark(page, 'sandbox', difficulty)).toHaveAttribute('data-finished', 'false');

  // And the first player's marks are there on the next visit.
  await page.reload();
  await pickPlayer(page, 'Pip');
  await expect(mark(page, 'sandbox', 'easy')).toHaveAttribute('data-finished', 'true');
  await expect(mark(page, 'sandbox', 'normal')).toHaveAttribute('data-finished', 'false');
  await expect(mark(page, 'sandbox', 'hard')).toHaveAttribute('data-finished', 'true');
  expect(problems).toEqual([]);
});

test('picking another card builds that area, and Play starts it', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  const level = (): Promise<string> => page.evaluate(() => (window as unknown as { __grove: { level: string } }).__grove.level);
  expect(await level()).toBe('sandbox');
  await page.locator('.area[data-level="bouncing-grove"] .area-pick').click();
  await expect(page.locator('.area[data-level="bouncing-grove"] .area-pick')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.area[data-level="sandbox"] .area-pick')).toHaveAttribute('aria-checked', 'false');
  expect(await level()).toBe('bouncing-grove');
  // The difficulty lines are the picked area's own.
  await expect(page.locator('[data-difficulty="normal"] small')).toHaveText('The grove as it comes');
  await play(page);
  await expect(page.locator('#place')).toHaveText('The Bouncing Grove · Normal');
  expect((await snapshot(page)).groundId).toBe('bank-start');
  expect(problems).toEqual([]);
});
