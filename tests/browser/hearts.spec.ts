import { expect, test, type Page } from '@playwright/test';
import { open, play, snapshot } from './helpers';

// Hearts on screen. Nothing in the level hurts yet, so these checks hurt the
// hero through the page's small test window, the way an enemy will.

/** Hurts the hero from just to its right, if it can be hurt right now. Says whether it was. */
const hurt = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { x: number; z: number; hurt(x: number, z: number): boolean } } }).__grove;
    return game.hurt(game.x + 1, game.z);
  });

const hearts = (page: Page): Promise<{ hearts: number; lost: number; protectedFor: number }> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { hearts: number; heartsLost: number; protectedFor: number } } }).__grove;
    return { hearts: game.hearts, lost: game.heartsLost, protectedFor: game.protectedFor };
  });

test('each difficulty shows its own number of hearts, all of them full', async ({ page }) => {
  await open(page);
  for (const [difficulty, count] of [['easy', 5], ['normal', 3], ['hard', 2]] as const) {
    await play(page, 'Yaarbro', difficulty);
    await expect(page.locator('#hearts')).toBeVisible();
    await expect(page.locator('#hearts')).toHaveAttribute('aria-label', `${count} of ${count} hearts`);
    await expect(page.locator('#hearts svg.full')).toHaveCount(count);
    await expect(page.locator('#hearts svg.lost')).toHaveCount(0);
    // The row sits clear of the pause button and is big enough to count at a glance.
    const box = (await page.locator('#hearts svg').first().boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(26);
    await page.locator('#pause').click();
    await page.locator('#quit').click();
    await expect(page.locator('#start')).toBeVisible();
  }
});

test('a hit takes one heart off the screen, says so, and protects the hero for a while', async ({ page }) => {
  await open(page);
  await play(page, 'Caputo', 'normal');
  expect(await hurt(page)).toBe(true);
  await expect(page.locator('#hearts')).toHaveAttribute('aria-label', '2 of 3 hearts');
  await expect(page.locator('#hearts svg.full')).toHaveCount(2);
  await expect(page.locator('#hearts svg.lost')).toHaveCount(1);
  await expect(page.locator('#message')).toContainText('2 of 3 hearts left');
  // Straight away it cannot be hurt again.
  expect(await hurt(page)).toBe(false);
  expect((await hearts(page)).hearts).toBe(2);
});

test('losing the last heart returns the hero to the safe bank with every heart again', async ({ page }) => {
  await open(page);
  await play(page, 'Yaarbro', 'hard');
  const start = await snapshot(page);
  // Two hearts on Hard: hurt it whenever it can be hurt, until it has lost both.
  await expect.poll(async () => {
    await hurt(page);
    return (await hearts(page)).lost;
  }, { timeout: 60_000 }).toBe(2);
  // Then it is back where a fall would put it, with both hearts, and no fall is counted.
  await expect.poll(async () => (await hearts(page)).hearts, { timeout: 60_000 }).toBe(2);
  await expect(page.locator('#hearts svg.full')).toHaveCount(2);
  await expect.poll(async () => (await snapshot(page)).grounded).toBe(true);
  const back = await snapshot(page);
  expect([back.x, back.z]).toEqual([start.x, start.z]);
  expect(back.falls).toBe(0);
  await expect(page.locator('#message')).toContainText('all 2 hearts');
});
