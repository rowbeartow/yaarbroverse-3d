import { expect, test } from '@playwright/test';
import { open, play, skipBoss, snapshot, standOn } from './helpers';

const levelId = (page: import('@playwright/test').Page): Promise<string> =>
  page.evaluate(() => (window as unknown as { __grove: { level: string } }).__grove.level);

test.describe('the level list', () => {
  test('players get the Bouncing Grove first and Cocolalla Lake after it, and nothing on the page names the sandbox', async ({ page }) => {
    await open(page);
    expect(await levelId(page)).toBe('bouncing-grove');
    await expect(page.locator('.area')).toHaveCount(2);
    await expect(page.locator('.area .area-name')).toHaveText(['The Bouncing Grove', 'Cocolalla Lake']);
    await expect(page.locator('.area-pick[aria-checked="true"] .area-name')).toHaveText('The Bouncing Grove');
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('sandbox');
  });

  test('?level=sandbox builds the development level, which draws and plays to its end card', async ({ page }) => {
    const problems = await open(page, 'level=sandbox');
    expect(await levelId(page)).toBe('sandbox');
    await expect(page.locator('.area-pick[aria-checked="true"] .area-name')).toHaveText('The Sandbox');
    await play(page, 'Yaarbro', 'easy');
    await expect(page.locator('#place')).toHaveText('The Sandbox · Easy');
    // Stand at the near end of the last bank: the leaf is straight ahead.
    await skipBoss(page);
    await standOn(page, 'bank-end', 3);
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('#end-level')).toHaveText('The Sandbox');
    expect((await snapshot(page)).complete).toBe(true);
    expect(problems).toEqual([]);
  });

  test('?level=cocolalla builds the lake: its water and surroundings draw, and it plays to its end card', async ({ page }) => {
    const problems = await open(page, 'level=cocolalla');
    expect(await levelId(page)).toBe('cocolalla');
    await expect(page.locator('.area-pick[aria-checked="true"] .area-name')).toHaveText('Cocolalla Lake');
    await play(page, 'Caputo', 'normal');
    await expect(page.locator('#place')).toHaveText('Cocolalla Lake · Normal');
    const pools = await page.evaluate(() => (window as unknown as { __grove: { water: { pools: number } | null } }).__grove.water?.pools ?? 0);
    expect(pools).toBeGreaterThan(0);
    // Its own surroundings: the shore, and the mountains across the water.
    const named = await page.evaluate(() => {
      const view = (window as unknown as { __grove: { view: { scene: { traverse(visit: (node: { name: string }) => void): void } } } }).__grove.view;
      const names: string[] = [];
      view.scene.traverse((node) => {
        if (node.name.startsWith('lake-')) names.push(node.name);
      });
      return names.sort();
    });
    expect(named).toEqual(['lake-mountains', 'lake-shore']);
    // Stand at the near end of the last bank: the leaf is straight ahead.
    await standOn(page, 'dock', 2);
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('#end-level')).toHaveText('Cocolalla Lake');
    expect(problems).toEqual([]);
  });

  test('a level name the game does not know gets the Bouncing Grove', async ({ page }) => {
    await open(page, 'level=nowhere');
    expect(await levelId(page)).toBe('bouncing-grove');
  });
});
