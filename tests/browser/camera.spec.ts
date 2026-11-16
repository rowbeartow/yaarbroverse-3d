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
