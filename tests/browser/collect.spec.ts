// Collecting, in a real browser: huckleberries are drawn, picked up by walking
// through them, counted on screen, shown on the end card and kept for the
// player on the level's card. The rules themselves are tests/collect.test.ts.

import { expect, test, type Page } from '@playwright/test';
import { open, play, snapshot, standOn } from './helpers';

const collected = (page: Page): Promise<{ berries: number; leaves: number; drawn: { berries: number; leaves: number } | null }> =>
  page.evaluate(() => {
    const grove = (window as unknown as { __grove: { game: { berries: number; leaves: number }; pickups: { berries: number; leaves: number } | null } }).__grove;
    return { berries: grove.game.berries, leaves: grove.game.leaves, drawn: grove.pickups };
  });

test.describe('collecting', () => {
  test('a level with nothing to collect shows no counter', async ({ page }) => {
    const problems = await open(page);
    await play(page);
    await expect(page.locator('#hearts')).toBeVisible();
    await expect(page.locator('#found')).toBeHidden();
    expect((await collected(page)).drawn).toBeNull();
    expect(problems).toEqual([]);
  });

  test('huckleberries are picked up by walking through them, counted, shown on the end card and kept on the level card', async ({ page }) => {
    const problems = await open(page, 'level=sandbox');
    await play(page, 'Yaarbro', 'easy');
    await expect(page.locator('#found')).toHaveAttribute('aria-label', '0 of 5 huckleberries, 0 of 1 hidden leaves');
    expect((await collected(page)).drawn).toEqual({ berries: 5, leaves: 1 });
    // Walk away from the camera, along the first log, through the start of the trail.
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await collected(page)).berries, { timeout: 60_000 }).toBeGreaterThan(0);
    await page.keyboard.up('ArrowUp');
    const { berries, drawn } = await collected(page);
    await expect(page.locator('#found-berries')).toHaveText(`${berries}/5`);
    await expect.poll(async () => (await collected(page)).drawn?.berries, { timeout: 30_000 }).toBeLessThan(5);
    expect(drawn?.leaves).toBe(1);

    // To the end: stand by the leaf. (The practice boss is in the way of walking there.)
    await page.evaluate(() => {
      const { game } = (window as unknown as { __grove: { game: { boss: { phase: string } } } }).__grove;
      game.boss.phase = 'defeated';
    });
    await standOn(page, 'bank-end', 0);
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('#end')).toBeVisible({ timeout: 60_000 });
    await page.keyboard.up('ArrowUp');
    const found = (await snapshot(page)).complete && (await collected(page)).berries;
    await expect(page.locator('#end-berries')).toHaveText(`${found} of 5`);
    await expect(page.locator('#end-berries-best')).toHaveText('Your most yet!');
    await expect(page.locator('#end-leaves')).toHaveText('0 of 1');

    // Back on the start screen, the level's card says what this player has collected on Easy.
    await page.locator('#again').click();
    await expect(page.locator('.area.picked [data-finds="easy"]')).toHaveText(`${found}/50/1`);
    await expect(page.locator('.area.picked [data-finds="normal"]')).toHaveText('0/50/1');
    expect(problems).toEqual([]);
  });

  test('Cocolalla Lake has huckleberries along its Shore Path', async ({ page }) => {
    const problems = await open(page, 'level=cocolalla');
    await play(page, 'Caputo', 'easy');
    await expect(page.locator('#found')).toBeVisible();
    const { drawn } = await collected(page);
    expect(drawn?.berries).toBeGreaterThan(2);
    expect(problems).toEqual([]);
  });
});
