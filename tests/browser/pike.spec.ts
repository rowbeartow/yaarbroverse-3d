import { expect, test, type Page } from '@playwright/test';
import { frames, open, play, snapshot, standOn } from './helpers';

// The monster pike of Cocolalla Lake in a real browser: its shadow circling
// its log, hooked from the jetty with the keys on Easy, the drag into the
// lake, its health bar, a hit from the floating log, Walblum's rescue, and the
// golden leaf that only shows once the pike is beaten and Walblum waits under it. The fight's rules are played start to finish
// by the bot in tests/pike.test.ts; here it is the drawing, the page and the
// controls.

interface PikeInfo {
  visible: boolean;
  clip: string;
  shade: boolean;
  flashing: boolean;
  aim: boolean;
  long: number;
  phase: string;
  health: number;
}
type Grove = { __grove: { pike: PikeInfo; leafShown: boolean; game: any } };
const pike = (page: Page): Promise<PikeInfo> => page.evaluate(() => (window as unknown as Grove).__grove.pike);
const rescue = (page: Page): Promise<{ visible: boolean; clip: string; phase: string }> => page.evaluate(() => (window as unknown as { __grove: { rescue: { visible: boolean; clip: string; phase: string } } }).__grove.rescue);
const leafShown = (page: Page): Promise<boolean> => page.evaluate(() => (window as unknown as Grove).__grove.leafShown);
const fishingState = (page: Page): Promise<{ phase: string; out: number; across: number }> =>
  page.evaluate(() => {
    const { fishing } = (window as unknown as Grove).__grove.game;
    return { phase: fishing.phase, out: fishing.out, across: fishing.across };
  });
/** Stands the hero on the jetty's fishing spot, with the dock's scouts out of the way. */
const onJetty = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
  });
  await standOn(page, 'jetty', -0.6);
  await frames(page, 3);
};

test('its shadow circles its log, the leaf is out of sight, and standing where the leaf will hang ends nothing', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'normal');
  await onJetty(page);
  await expect.poll(async () => (await pike(page)).visible).toBe(true);
  const seen = await pike(page);
  expect(seen.phase).toBe('lurking');
  expect(seen.shade).toBe(true);
  expect(seen.health).toBe(6);
  // Walblum is out there on his log, in the middle of its circle.
  const stranded = await rescue(page);
  expect([stranded.visible, stranded.phase, stranded.clip]).toEqual([true, 'stranded', 'scared']);
  // Much bigger than the lake's other fish, the biggest of which is drawn about three metres long.
  expect(seen.long).toBeGreaterThan(3.3);
  await expect(page.locator('#boss')).toBeHidden();
  expect(await leafShown(page)).toBe(false);
  // Right where the leaf will be.
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    Object.assign(game, { x: game.level.leaf.x, z: game.level.leaf.z, y: game.level.solids.find((s: { id: string }) => s.id === 'dock').top, vx: 0, vy: 0, vz: 0 });
  });
  await page.keyboard.down('Space');
  await frames(page, 12);
  await page.keyboard.up('Space');
  expect((await snapshot(page)).mode).toBe('playing');
  await expect(page.locator('#end')).toBeHidden();
  expect(problems).toEqual([]);
});

test.describe('on the keyboard', () => {
  test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

  test('on Easy a cast at its shadow hooks it, holding the button wins the tug of war, and it drags the hero into the lake', async ({ page }) => {
    test.setTimeout(240_000);
    const problems = await open(page, 'level=cocolalla');
    await play(page, 'Yaarbro', 'easy');
    await onJetty(page);
    // Hold X: the ring slides out. Steer it a little left, over the middle of the pike's circle, and let go there.
    await page.keyboard.down('KeyX');
    await page.keyboard.down('ArrowLeft');
    await expect.poll(async () => (await fishingState(page)).across, { timeout: 30_000 }).toBeLessThan(-1.2);
    await page.keyboard.up('ArrowLeft');
    await expect.poll(async () => (await fishingState(page)).out, { timeout: 30_000 }).toBeGreaterThan(13.5);
    await page.keyboard.up('KeyX');
    await expect.poll(async () => (await fishingState(page)).phase, { timeout: 60_000 }).toBe('bite');
    // On Easy it has hooked itself: hold the button and it comes, pip by pip.
    await page.keyboard.down('KeyX');
    await expect.poll(async () => (await pike(page)).phase, { timeout: 30_000 }).toBe('hooked');
    await expect(page.locator('#boss')).toBeVisible();
    await expect(page.locator('#boss-name')).toHaveText('The Monster Pike');
    await expect(page.locator('#message')).toContainText('on the line');
    expect((await pike(page)).clip).toBe('thrash');
    await expect.poll(async () => (await pike(page)).health, { timeout: 120_000 }).toBe(2);
    // Half its pips gone: off the jetty and into the water.
    await expect(page.locator('#message')).toContainText('floating log');
    await page.keyboard.up('KeyX');
    await expect.poll(() => page.evaluate(() => (window as unknown as Grove).__grove.game.swimming), { timeout: 60_000 }).toBe(true);
    expect(await leafShown(page)).toBe(false);
    expect(problems).toEqual([]);
  });
});

test('beside the log its jaws open, a landing on it while it lies spent takes a pip, and beaten it lets the golden leaf show', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Caputo', 'easy');
  // Straight to the water half, by hand: the hero on the floating log, the pike circling with two pips left.
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
    Object.assign(game.pike, { phase: 'circling', timer: 0, waited: 0, health: 2 });
  });
  await standOn(page, 'pike-log');
  // It comes up beside the log with its jaws open; on Easy a ring shows where they are aimed.
  await expect.poll(async () => (await pike(page)).phase, { timeout: 120_000 }).toBe('gape');
  await expect.poll(async () => (await pike(page)).aim).toBe(true);
  await expect(page.locator('#boss')).toBeVisible();
  // Onto its head from above (put there by hand: the jump itself is the rule tests' business).
  const drop = (): Promise<void> =>
    page.evaluate(() => {
      const { game } = (window as unknown as Grove).__grove;
      Object.assign(game.pike, { phase: 'rest', timer: 0 });
      Object.assign(game, { x: game.pike.x, z: game.pike.z, y: game.pike.y + 1.6, vx: 0, vy: -3, vz: 0, grounded: false, groundId: null, swimming: false });
    });
  await drop();
  await expect.poll(async () => (await pike(page)).health, { timeout: 30_000 }).toBe(1);
  await expect(page.locator('#message')).toContainText('1 more to go');
  expect(await leafShown(page)).toBe(false);
  await drop();
  await expect.poll(async () => (await pike(page)).phase, { timeout: 30_000 }).toBe('beaten');
  await expect(page.locator('#message')).toContainText('is beaten');
  // Walblum, stranded on his log till now, paddles for the dock; the leaf shows only once he waits under it.
  expect(await leafShown(page)).toBe(false);
  await expect.poll(async () => (await rescue(page)).phase, { timeout: 120_000 }).toBe('waiting');
  await expect.poll(() => leafShown(page)).toBe(true);
  const waiting = await rescue(page);
  expect(waiting.visible).toBe(true);
  expect(waiting.clip).toBe('cheer');
  // Reaching him and the leaf ends the level, and the end card says who was rescued.
  await standOn(page, 'dock', 0);
  await page.keyboard.down('ArrowRight');
  await expect(page.locator('#end')).toBeVisible({ timeout: 60_000 });
  await page.keyboard.up('ArrowRight');
  await expect(page.locator('#end-rescue-box')).toBeVisible();
  await expect(page.locator('#end-rescue')).toHaveText('Walblum');
  expect(problems).toEqual([]);
});
