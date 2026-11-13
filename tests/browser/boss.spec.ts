import { expect, test, type Page } from '@playwright/test';
import { frames, open, play, snapshot, standOn } from './helpers';

// A boss in a browser: the practice boss of the development level. Its rules
// are checked by tests/boss.test.ts, and the bot fights it start to finish
// there. These check what only a browser shows: it is drawn, its health bar,
// its music taking over, the leaf kept back, and the victory.

interface BossState {
  phase: string;
  health: number;
  fights: number;
  clip: string;
  visible: boolean;
  flashing: boolean;
  aimLine: boolean;
}

const boss = (page: Page): Promise<BossState> =>
  page.evaluate(() => {
    const grove = (window as unknown as { __grove: { game: { boss: { phase: string; health: number; fights: number } }; boss: { clip: string; visible: boolean; flashing: boolean; aimLine: boolean } } }).__grove;
    return { phase: grove.game.boss.phase, health: grove.game.boss.health, fights: grove.game.boss.fights, ...grove.boss };
  });
const music = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as { __grove: { music: string | null } }).__grove.music);
const leafShown = (page: Page): Promise<boolean> => page.evaluate(() => (window as unknown as { __grove: { leafShown: boolean } }).__grove.leafShown);

/** Holds the boss resting, and drops the hero onto it. */
const hit = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    Object.assign(game.boss, { phase: 'rest', timer: 0, attack: 'throw' });
    Object.assign(game, { x: game.boss.x, z: game.boss.z, y: game.boss.y + 2.4, vx: 0, vy: -3, vz: 0, grounded: false, protectedFor: 5 });
  });

test('the fight begins when the hero steps into the arena: the boss is drawn, its health bar comes up and its music takes over', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'normal');
  await frames(page, 2);
  await expect(page.locator('#boss')).toBeHidden();
  expect(await music(page)).toBe('groveMusic');
  expect(await leafShown(page)).toBe(false);
  await standOn(page, 'arena', 5);
  await expect.poll(async () => (await boss(page)).phase, { timeout: 30_000 }).not.toBe('waiting');
  await expect(page.locator('#boss')).toBeVisible();
  await expect(page.locator('#boss-name')).toHaveText('Practice boss');
  await expect(page.locator('#boss-health span.full')).toHaveCount(4);
  await expect(page.locator('#message')).toContainText('Practice boss!');
  expect(await music(page)).toBe('bossMusic');
  expect((await boss(page)).visible).toBe(true);
  expect(problems).toEqual([]);
});

test('a hit shows on the boss and on its bar, and a fall puts it back to full health', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Caputo', 'normal');
  await standOn(page, 'arena', 5);
  await expect.poll(async () => (await boss(page)).phase, { timeout: 30_000 }).toBe('idle');
  await hit(page);
  await expect.poll(async () => (await boss(page)).health, { timeout: 30_000 }).toBe(3);
  await expect(page.locator('#boss-health span.full')).toHaveCount(3);
  await expect(page.locator('#message')).toContainText('Practice boss hit! 3 more to go.');
  expect((await boss(page)).flashing).toBe(true);
  // Off the side of the arena.
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    Object.assign(game, { x: 30, vx: 0, vz: 0, protectedFor: 0 });
  });
  await expect.poll(async () => (await snapshot(page)).falls, { timeout: 60_000 }).toBe(1);
  expect((await boss(page)).health).toBe(4);
  expect((await snapshot(page)).groundId).toBe('arena');
  await expect(page.locator('#message')).toContainText('back to full strength', { timeout: 30_000 });
  // The hero is back on the doorstep, outside the fight. Stepping in again starts it over.
  expect((await boss(page)).phase).toBe('waiting');
  await expect.poll(async () => (await snapshot(page)).grounded, { timeout: 30_000 }).toBe(true);
  await standOn(page, 'arena', 5);
  await expect.poll(async () => (await boss(page)).fights, { timeout: 60_000 }).toBe(2);
  expect(problems).toEqual([]);
});

test('beating the boss: the bar empties, the level’s music comes back, the leaf appears and can be taken', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'easy');
  await standOn(page, 'arena', 5);
  await expect.poll(async () => (await boss(page)).phase, { timeout: 30_000 }).toBe('idle');
  for (const left of [2, 1, 0]) {
    await hit(page);
    await expect.poll(async () => (await boss(page)).health, { timeout: 30_000 }).toBe(left);
  }
  await expect(page.locator('#message')).toContainText('Practice boss is beaten!');
  expect((await boss(page)).phase).toBe('defeated');
  expect(await music(page)).toBe('groveMusic');
  await expect.poll(() => leafShown(page)).toBe(true);
  await expect(page.locator('#boss')).toBeHidden({ timeout: 60_000 });
  await standOn(page, 'bank-end', 3);
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    Object.assign(game, { z: game.level.leaf.z, y: game.level.leaf.y - 1 });
  });
  await expect(page.locator('#end')).toBeVisible({ timeout: 30_000 });
  expect(problems).toEqual([]);
});

test('the leaf cannot be taken while the boss stands', async ({ page }) => {
  await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'easy');
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    Object.assign(game, { x: game.level.leaf.x, z: game.level.leaf.z, y: game.level.leaf.y - 1, vx: 0, vy: 0, vz: 0 });
  });
  await frames(page, 6);
  expect((await snapshot(page)).complete).toBe(false);
});
