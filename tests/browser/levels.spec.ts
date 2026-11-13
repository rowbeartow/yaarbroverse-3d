import { expect, test } from '@playwright/test';
import { open, play, snapshot, standOn } from './helpers';

const levelId = (page: import('@playwright/test').Page): Promise<string> =>
  page.evaluate(() => (window as unknown as { __grove: { level: string } }).__grove.level);

test.describe('the level list', () => {
  test('players get the Bouncing Grove, and nothing on the page names the sandbox', async ({ page }) => {
    await open(page);
    expect(await levelId(page)).toBe('bouncing-grove');
    await expect(page.locator('.area')).toHaveCount(1);
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
    await standOn(page, 'bank-end', 3);
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.up('ArrowUp');
    await expect(page.locator('#end-level')).toHaveText('The Sandbox');
    expect((await snapshot(page)).complete).toBe(true);
    expect(problems).toEqual([]);
  });

  test('a level name the game does not know gets the Bouncing Grove', async ({ page }) => {
    await open(page, 'level=nowhere');
    expect(await levelId(page)).toBe('bouncing-grove');
  });
});
