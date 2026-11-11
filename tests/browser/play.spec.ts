import { expect, test } from '@playwright/test';
import { open, play, ready, snapshot, standOn } from './helpers';

test.describe('start screen', () => {
  test('loads without errors and draws the grove', async ({ page }) => {
    const problems = await open(page);
    await expect(page.locator('h1#start-title')).toHaveText('The Bouncing Grove');
    // Both hero pictures are drawn from the 3D models.
    for (const hero of ['Yaarbro', 'Caputo']) {
      const picture = page.locator(`[data-hero="${hero}"] img`);
      await expect(picture).toHaveAttribute('src', /^data:image\/png/);
    }
    // A flat, empty picture compresses to almost nothing; a drawn forest does not.
    // WebKit can hand back a picture from before its first drawn frame, so look until it is there.
    await page.locator('#start').evaluate((element) => ((element as HTMLElement).hidden = true));
    await expect.poll(async () => (await page.screenshot()).byteLength).toBeGreaterThan(40_000);
    expect(problems).toEqual([]);
  });

  test('offers two heroes and three difficulties, one of each picked', async ({ page }) => {
    await open(page);
    await expect(page.locator('.heroes [role="radio"]')).toHaveCount(2);
    await expect(page.locator('.levels [role="radio"]')).toHaveCount(3);
    await expect(page.locator('.heroes [aria-checked="true"]')).toHaveCount(1);
    await expect(page.locator('.levels [aria-checked="true"]')).toHaveCount(1);
    for (const difficulty of ['easy', 'normal', 'hard']) {
      await expect(page.locator(`[data-difficulty="${difficulty}"] small`)).not.toBeEmpty();
    }
  });

  test('remembers the hero and difficulty on this device', async ({ page }) => {
    await open(page);
    await page.locator('[data-hero="Caputo"]').click();
    await page.locator('[data-difficulty="hard"]').click();
    await page.reload();
    await ready(page);
    await expect(page.locator('[data-hero="Caputo"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-difficulty="hard"]')).toHaveAttribute('aria-checked', 'true');
    await page.locator('#play').click();
    expect(await snapshot(page)).toMatchObject({ hero: 'Caputo', difficulty: 'hard', mode: 'playing' });
  });

  test('builds a different grove for each difficulty', async ({ page }) => {
    await open(page);
    const stumps = async (difficulty: string): Promise<number> => {
      await page.locator(`[data-difficulty="${difficulty}"]`).click();
      return page.evaluate(
        () =>
          (window as unknown as { __grove: { game: any } }).__grove.game.level.solids.filter(
            (s: { kind: string }) => s.kind === 'stump',
          ).length,
      );
    };
    // Stumps low down plus tall snags on the last climb: 4 + 2, 7 + 4 and 8 + 5.
    expect([await stumps('easy'), await stumps('normal'), await stumps('hard')]).toEqual([6, 11, 13]);
  });
});

test.describe('playing', () => {
  test('time only counts while playing, and Pause stops it', async ({ page }) => {
    await open(page);
    expect((await snapshot(page)).seconds).toBe(0);
    await play(page);
    await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(0.3);

    await page.locator('#pause').click();
    await expect(page.locator('#paused')).toBeVisible();
    const paused = (await snapshot(page)).seconds;
    await page.waitForTimeout(500);
    expect((await snapshot(page)).seconds).toBe(paused);

    await page.locator('#resume').click();
    await expect(page.locator('#paused')).toBeHidden();
    await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(paused);
  });

  test('touching the golden leaf shows the end card with the run on it', async ({ page }) => {
    await open(page);
    await play(page, 'Caputo', 'easy');
    // Stand at the near end of the last bough, then let the page run: the leaf
    // is straight ahead. The walk itself is checked in the keyboard and touch tests.
    await standOn(page, 'bough', 2);
    await page.keyboard.down('ArrowUp');
    await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.up('ArrowUp');

    await expect(page.locator('#end-title')).toHaveText('You found the golden leaf!');
    await expect(page.locator('#end-difficulty')).toHaveText('Easy');
    await expect(page.locator('#end-hero')).toHaveText('Caputo');
    await expect(page.locator('#end-time')).toHaveText(/^\d+:\d\d\.\d$/);
    await expect(page.locator('#end-falls')).toHaveText('0');
    await expect(page.locator('#end-date')).toContainText(String(new Date().getFullYear()));

    await page.locator('#again').click();
    await expect(page.locator('#start')).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ mode: 'start', complete: false, seconds: 0 });
  });

  test('a fall is counted and the hero comes back to the mossy bank', async ({ page }) => {
    await open(page);
    await play(page);
    await standOn(page, 'log-1');
    await page.evaluate(() => {
      const { game } = (window as unknown as { __grove: { game: any } }).__grove;
      game.x = 30; // Far out over the mist.
    });
    await expect.poll(async () => (await snapshot(page)).falls, { timeout: 15_000 }).toBe(1);
    await expect(page.locator('#message')).toHaveText('Back to safety…');
    await expect.poll(async () => (await snapshot(page)).groundId).toBe('bank-start');
  });
});
