import { expect, test, type Page } from '@playwright/test';
import { frames, open, play, snapshot, standOn } from './helpers';

// The camera that follows the route, on Cocolalla Lake: it turns where the
// route does, and the stick follows it, so "up" is always away from the
// camera. The rules of it are checked without a browser by
// tests/route-camera.test.ts; these check the picture and the keys.

/** Which way the camera faces now, in degrees from -180 to 180 (0 looks north along -z, -90 west). */
const facing = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const degrees = (window as unknown as { __grove: { facing: number } }).__grove.facing;
    return ((((degrees + 180) % 360) + 360) % 360) - 180;
  });

/** Waits until the camera has come round to within a few degrees of `wanted`. */
const settled = async (page: Page, wanted: number): Promise<void> => {
  await expect.poll(async () => Math.abs((await facing(page)) - wanted), { timeout: 40_000 }).toBeLessThan(4);
};

test('the camera turns to follow the lake: north along the shore, up the channel, west through the tunnel, north again on the pier', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'easy');
  expect(Math.abs(await facing(page))).toBeLessThan(1);
  // It turns on the bank a section ends on, before the hero sets out.
  await standOn(page, 'point');
  await settled(page, -30);
  await standOn(page, 'island');
  await settled(page, 0);
  await standOn(page, 'reed-bar');
  await settled(page, -90);
  await standOn(page, 'landing');
  await settled(page, 0);
  expect(problems).toEqual([]);
});

test('up on the keys is away from the camera, whichever way it faces', async ({ page }) => {
  await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'easy');
  // On the beach the camera looks north: up walks north, toward the water.
  let before = await snapshot(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).z, { timeout: 20_000 }).toBeLessThan(before.z - 1);
  await page.keyboard.up('ArrowUp');
  expect(Math.abs((await snapshot(page)).x - before.x)).toBeLessThan(0.5);

  // On the cove's beach it looks west: the same key walks west, and right walks north.
  await standOn(page, 'cove-beach');
  await settled(page, -90);
  await frames(page, 2);
  before = await snapshot(page);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).x, { timeout: 20_000 }).toBeLessThan(before.x - 1);
  await page.keyboard.up('ArrowUp');
  expect(Math.abs((await snapshot(page)).z - before.z)).toBeLessThan(0.6);
  await standOn(page, 'cove-beach');
  await frames(page, 2);
  before = await snapshot(page);
  await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await snapshot(page)).z, { timeout: 20_000 }).toBeLessThan(before.z - 1);
  await page.keyboard.up('ArrowRight');
});

test('the Bouncing Grove keeps its camera looking straight up the route', async ({ page }) => {
  await open(page);
  await play(page, 'Yaarbro', 'easy');
  await standOn(page, 'bank-2');
  await frames(page, 6);
  expect(await facing(page)).toBe(0);
});

test('the rope swings are drawn over the cove, and a hero who jumps at one takes hold and swings', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'easy');
  const ropes = (): Promise<{ id: string; angle: number }[]> => page.evaluate(() => (window as unknown as { __grove: { ropes: { id: string; angle: number }[] } }).__grove.ropes);
  expect((await ropes()).map((rope) => rope.id)).toEqual(['rope-1', 'rope-2']);
  // Stand at the rock island's west edge. The camera looks north there, so the rope is to the left.
  await standOn(page, 'island');
  await settled(page, 0);
  // In the air within reach of the rope, as at the top of a jump from the island's edge: the hero takes hold with no button.
  // (The run-up and the jump are played by the rule tests; timed key presses are unreliable on a slow machine.)
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean; groundId: string | null; level: { ropes: { id: string; x: number; y: number; z: number; length: number }[] } } } }).__grove;
    const rope = game.level.ropes[0];
    Object.assign(game, { x: rope.x + 0.6, y: rope.y - rope.length - 1.2, z: rope.z, vx: -4, vy: 2, vz: 0, grounded: false, groundId: null });
  });
  const swinging = (): Promise<string | null> => page.evaluate(() => (window as unknown as { __grove: { game: { ropeId: string | null } } }).__grove.game.ropeId);
  await expect.poll(swinging, { timeout: 30_000 }).toBe('rope-1');
  // It swings: the rope leaves the straight-down it hung at.
  await expect.poll(async () => Math.abs((await ropes())[0].angle), { timeout: 20_000 }).toBeGreaterThan(0.3);
  // Letting go on Easy lands on the rock stack, wherever in the swing it is.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snapshot(page)).groundId, { timeout: 30_000 }).toBe('stack');
  expect(problems).toEqual([]);
});

test('the crocodile stepping stones lie low until a hero is near, then come up to be stood on', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'easy');
  const stones = (): Promise<{ id: string; phase: string; y: number }[]> => page.evaluate(() => (window as unknown as { __grove: { stones: { id: string; phase: string; y: number }[] } }).__grove.stones);
  // From the beach they are far off: every one lies low.
  const far = await stones();
  expect(far.length).toBeGreaterThanOrEqual(6);
  expect(far.every((stone) => stone.phase === 'gone')).toBe(true);
  const low = far[0].y;
  // On the grassy point the first of the row is near: it comes up, and its back is higher than it lay.
  await standOn(page, 'point');
  await expect.poll(async () => (await stones())[0].phase, { timeout: 30_000 }).toBe('rest');
  expect((await stones())[0].y).toBeGreaterThan(low + 0.5);
  // Standing on it: on Easy it holds, and the hero stays on its back.
  await standOn(page, 'stone-1');
  await frames(page, 12);
  expect((await snapshot(page)).groundId).toBe('stone-1');
  expect(problems).toEqual([]);
});
