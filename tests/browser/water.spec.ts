import { expect, test, type Page } from '@playwright/test';
import { frames, open, play } from './helpers';

// How water looks, in the Sandbox's pool: it is drawn, a hero dropping in
// throws up droplets and rings, and underwater the picture takes on the
// underwater look, which goes again at the surface. How swimming plays is
// checked by swim.spec.ts and tests/swim.test.ts.

interface WaterInfo {
  pools: number;
  drops: number;
  rings: number;
  underwater: number;
}

const water = (page: Page): Promise<WaterInfo | null> =>
  page.evaluate(() => (window as unknown as { __grove: { water: WaterInfo | null } }).__grove.water);

/** Puts the hero `up` metres over the pool's surface, a few metres in, falling. */
const overPool = (page: Page, up: number, fall = 0): Promise<void> =>
  page.evaluate(
    ([height, speed]) => {
      const { game } = (window as unknown as { __grove: { game: any } }).__grove;
      const pool = game.level.water[0];
      Object.assign(game, { x: 0, z: pool.maxZ - 4, y: pool.surface + height, vx: 0, vy: -speed, vz: 0, grounded: false, groundId: null });
    },
    [up, fall] as const,
  );

test('the pool is drawn, a hero dropping in splashes, and underwater the picture changes until the swimmer is back up', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'easy');
  expect((await water(page))?.pools).toBe(1);
  expect((await water(page))?.underwater).toBe(0);
  // Dropped in from a height: droplets and rings.
  await overPool(page, 3, 6);
  await expect.poll(async () => (await water(page))!.drops).toBeGreaterThan(5);
  expect((await water(page))!.rings).toBeGreaterThan(0);
  // Under: the picture takes on the underwater look.
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const pool = game.level.water[0];
    Object.assign(game, { y: pool.floor + 0.3, vy: 0 });
  });
  await expect.poll(async () => (await water(page))!.underwater).toBeGreaterThan(0.9);
  // Back up at the surface (the swimmer drifts up on its own), the look goes.
  await expect.poll(async () => (await water(page))!.underwater, { timeout: 60_000 }).toBe(0);
  await frames(page, 2);
  expect(problems).toEqual([]);
});

test('a level with no water draws none', async ({ page }) => {
  const problems = await open(page);
  await play(page, 'Caputo', 'easy');
  expect(await water(page)).toBeNull();
  expect(problems).toEqual([]);
});
