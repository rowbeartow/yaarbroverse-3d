import { expect, test, type Page } from '@playwright/test';
import { open, pickPlayer, play, standOn } from './helpers';

// Best times and fewest falls on the end card. The runs are of the tiny
// development level; a run's clock and fall count are set by hand where a
// check needs a slow run or one with falls. The names are made up.

/** Plays the Sandbox to its end card. `seconds` and `falls`, when given, are what the run's record will say. */
const finish = async (page: Page, hero: string, difficulty: string, set: { seconds?: number; falls?: number } = {}): Promise<void> => {
  await play(page, hero, difficulty);
  await standOn(page, 'bank-end', 3);
  await page.evaluate((wanted) => {
    const { game } = (window as unknown as { __grove: { game: { seconds: number; falls: number } } }).__grove;
    if (wanted.seconds !== undefined) game.seconds = wanted.seconds;
    if (wanted.falls !== undefined) game.falls = wanted.falls;
  }, set);
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('ArrowUp');
};

const again = async (page: Page): Promise<void> => {
  await page.locator('#again').click();
  await expect(page.locator('#start')).toBeVisible();
};

test('the end card shows the best time and fewest falls, and marks a new best clearly', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');

  // A first finish: slow, with two falls. Both are bests.
  await finish(page, 'Yaarbro', 'easy', { seconds: 300, falls: 2 });
  await expect(page.locator('#end-new')).toHaveText('First finish! That is the time to beat.');
  await expect(page.locator('#end-time-best')).toHaveText('New best!');
  await expect(page.locator('#end-falls-best')).toHaveText('New best!');
  await expect(page.locator('#end-falls')).toHaveText('2');
  await again(page);

  // Faster, with more falls: a new best time, and the fewest falls stay at 2.
  await finish(page, 'Yaarbro', 'easy', { seconds: 100, falls: 5 });
  await expect(page.locator('#end-new')).toHaveText('New best time!');
  await expect(page.locator('#end-time')).toHaveText(/^1:4\d\.\d$/);
  await expect(page.locator('#end-time-best')).toHaveText('New best!');
  await expect(page.locator('#end-time-box')).toHaveClass(/is-new/);
  await expect(page.locator('#end-falls-best')).toHaveText('Fewest 2');
  await expect(page.locator('#end-falls-box')).not.toHaveClass(/is-new/);
  await again(page);

  // Slower, with no falls: the fewest falls, and the best time stays.
  await finish(page, 'Yaarbro', 'easy', { seconds: 200, falls: 0 });
  await expect(page.locator('#end-new')).toHaveText('Your fewest falls yet!');
  await expect(page.locator('#end-time-best')).toHaveText(/^Best 1:4\d\.\d$/);
  await expect(page.locator('#end-falls-best')).toHaveText('New best!');
  await again(page);

  // Neither: no banner, and both bests shown as they stand.
  await finish(page, 'Yaarbro', 'easy', { seconds: 250, falls: 1 });
  await expect(page.locator('#end-new')).toBeHidden();
  await expect(page.locator('#end-time-best')).toHaveText(/^Best 1:4\d\.\d$/);
  await expect(page.locator('#end-falls-best')).toHaveText('Fewest 0');
  await again(page);

  // The level card shows the best time too.
  await expect(page.locator('.area[data-level="sandbox"] .mark[data-mark="easy"] .mark-time')).toHaveText(/^1:4\d\.\d$/);
  expect(problems).toEqual([]);
});

test('bests are kept apart by hero, difficulty and player, and are there on the next visit', async ({ page }) => {
  await open(page, 'level=sandbox');
  await finish(page, 'Yaarbro', 'easy', { seconds: 100 });
  await again(page);

  // The other hero, then another difficulty: each a first finish of its own.
  await finish(page, 'Caputo', 'easy', { seconds: 400 });
  await expect(page.locator('#end-new')).toHaveText('First finish! That is the time to beat.');
  await again(page);
  await finish(page, 'Yaarbro', 'hard', { seconds: 400 });
  await expect(page.locator('#end-new')).toHaveText('First finish! That is the time to beat.');
  await again(page);

  // Another player starts from nothing.
  await page.locator('#switch-player').click();
  await pickPlayer(page, 'Moss');
  await finish(page, 'Yaarbro', 'easy', { seconds: 500 });
  await expect(page.locator('#end-new')).toHaveText('First finish! That is the time to beat.');

  // After a reload the first player's best is still the one to beat.
  await page.reload();
  await pickPlayer(page, 'Pip');
  await finish(page, 'Yaarbro', 'easy', { seconds: 300 });
  await expect(page.locator('#end-new')).toBeHidden();
  await expect(page.locator('#end-time-best')).toHaveText(/^Best 1:4\d\.\d$/);
});
