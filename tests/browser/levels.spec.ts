import { expect, test } from '@playwright/test';
import { open, play, ready, skipBoss, snapshot, standOn } from './helpers';

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
    // Its own surroundings: the shore, the mountains across the water, and the rocks and weed on the lake bed.
    const named = await page.evaluate(() => {
      const view = (window as unknown as { __grove: { view: { scene: { traverse(visit: (node: { name: string }) => void): void } } } }).__grove.view;
      const names: string[] = [];
      view.scene.traverse((node) => {
        if (node.name.startsWith('lake-')) names.push(node.name);
      });
      return names.sort();
    });
    expect(named).toEqual(['lake-bed', 'lake-boom', 'lake-island', 'lake-mountains', 'lake-shore']);
    // Stand on the fishing dock: the pier runs east, and the camera looks north there, so the leaf is to the right.
    // The dock's scout is the rule tests' business (the bot beats it there): here it is out of the way.
    await page.evaluate(() => {
      const { game } = (window as unknown as { __grove: { game: { enemies: Array<{ kind: string; phase: string }> } } }).__grove;
      for (const enemy of game.enemies) if (enemy.kind === 'marmot') enemy.phase = 'defeated';
    });
    // So is the monster pike (tests/pike.test.ts plays the fight, pike.spec.ts shows it): counted as beaten, the leaf shows.
    await skipBoss(page);
    await standOn(page, 'dock', 0);
    await expect.poll(() => page.evaluate(() => Math.abs((window as unknown as { __grove: { facing: number } }).__grove.facing)), { timeout: 30_000 }).toBeLessThan(5);
    await page.keyboard.down('ArrowRight');
    await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
    await page.keyboard.up('ArrowRight');
    await expect(page.locator('#end-level')).toHaveText('Cocolalla Lake');
    expect(problems).toEqual([]);
  });

  test('a level name the game does not know gets the Bouncing Grove', async ({ page }) => {
    await open(page, 'level=nowhere');
    expect(await levelId(page)).toBe('bouncing-grove');
  });
});

test.describe("a level's own files", () => {
  /** The media files the page has asked for so far, by file name. */
  const watchMedia = (page: import('@playwright/test').Page): Set<string> => {
    const asked = new Set<string>();
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.includes('/media/')) asked.add(path.slice(path.lastIndexOf('/') + 1));
    });
    return asked;
  };
  const soundLevel = (page: import('@playwright/test').Page): Promise<{ level: string | null; ready: boolean; music: string | null; problems: string[] }> =>
    page.evaluate(() => (window as unknown as { __grove: { sound: { level: string | null; ready: boolean; music: string | null; problems: string[] } } }).__grove.sound);

  test("arrive when the level is picked: the lake's crocodile, music and sounds are not fetched at start-up", async ({ page }) => {
    const asked = watchMedia(page);
    const problems = await open(page);
    // Start-up: the heroes, the shared sounds, and the grove's own, since the grove is up first.
    for (const file of ['yaarbro.glb', 'caputo.glb', 'marmot.glb', 'mosquito.glb', 'button.wav', 'grove-music.mp3']) expect([...asked], file).toContain(file);
    for (const file of ['crocodile.glb', 'lake-music.mp3', 'croc-bite.wav', 'lake-lapping.wav']) expect([...asked], file).not.toContain(file);

    // Picking the lake fetches its own files, and Play works again once they are here.
    await page.locator('.area[data-level="cocolalla"] .area-pick').click();
    await ready(page);
    expect(await levelId(page)).toBe('cocolalla');
    for (const file of ['crocodile.glb', 'lake-music.mp3', 'croc-bite.wav', 'lake-lapping.wav']) expect([...asked], file).toContain(file);
    await expect.poll(async () => (await soundLevel(page)).ready, { timeout: 30_000 }).toBe(true);
    expect((await soundLevel(page)).level).toBe('cocolalla');
    await expect.poll(async () => (await soundLevel(page)).music).toBe('lakeMusic');
    await play(page, 'Yaarbro', 'hard');
    // The lake's crocodiles are drawn from the model that just arrived.
    const crocodiles = await page.evaluate(() => (window as unknown as { __grove: { enemies: unknown[] } }).__grove.enemies.length);
    expect(crocodiles).toBeGreaterThan(0);

    // And back: the grove's music again, with nothing fetched twice going wrong.
    await page.keyboard.press('Escape');
    await page.locator('#quit').click();
    await page.locator('.area[data-level="bouncing-grove"] .area-pick').click();
    await ready(page);
    await expect.poll(async () => (await soundLevel(page)).music, { timeout: 30_000 }).toBe('groveMusic');
    expect((await soundLevel(page)).problems).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("opening straight onto the lake never fetches the grove's own files", async ({ page }) => {
    const asked = watchMedia(page);
    const problems = await open(page, 'level=cocolalla');
    await expect.poll(async () => (await soundLevel(page)).level).toBe('cocolalla');
    await expect.poll(() => [...asked]).toContain('lake-music.mp3');
    // The lake has scouts and mosquitoes of its own now, and its logs creak: those are its files too.
    for (const file of ['crocodile.glb', 'marmot.glb', 'mosquito-light.glb', 'creak.wav', 'yaarbro.glb', 'caputo.glb']) expect([...asked], file).toContain(file);
    // The lake draws its mosquitoes from the lighter model, and never fetches the full one.
    expect([...asked]).not.toContain('mosquito.glb');
    for (const file of ['grove-music.mp3', 'boss-music.mp3', 'moss-rustle.wav', 'gust.wav']) expect([...asked], file).not.toContain(file);
    expect(problems).toEqual([]);
  });
});
