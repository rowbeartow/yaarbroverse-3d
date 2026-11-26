import { expect, test, type Page } from '@playwright/test';
import { frames, open, play, snapshot, standOn } from './helpers';

// The monster pike in a browser. Its rules are checked by tests/pike.test.ts,
// where the bot hooks it, wins the tug of war and beats it from the log on
// every difficulty. These check what only a browser shows: it is drawn in the
// fishing water with its shadow, its health bar comes up when it is hooked,
// a hit shows, the leaf is kept back, and beating it lets the level end.

interface PikeState {
  phase: string;
  health: number;
  of: number;
  visible: boolean;
  clip: string;
  shadow: boolean;
  aimLine: boolean;
  flashing: boolean;
  length: number;
}
type Grove = { __grove: { game: any; pike: PikeState; leafShown: boolean } };
const pike = (page: Page): Promise<PikeState> => page.evaluate(() => (window as unknown as Grove).__grove.pike);
const leafShown = (page: Page): Promise<boolean> => page.evaluate(() => (window as unknown as Grove).__grove.leafShown);

/** On the jetty, with the dock's scouts out of the way: they are not what this checks. */
const onJetty = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
  });
  await standOn(page, 'jetty', -0.6);
  await frames(page, 3);
};

/** Puts the fight in its water half, as the drag leaves it, with the hero standing on the floating log and safe from harm. */
const toTheLog = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    const spot = game.level.pike;
    const log = game.level.solids.find((s: { id: string }) => s.id === spot.log);
    game.fishing.fish = game.fishing.fish.filter((fish: { monster?: boolean }) => !fish.monster);
    Object.assign(game.pike, { phase: 'circling', timer: 0, wait: 0, health: spot.numbers.health / 2 });
    Object.assign(game, { x: log.x, y: log.top, z: log.z + 1, vx: 0, vy: 0, vz: 0, grounded: true, groundId: log.id, swimming: false, waterId: null, protectedFor: 600 });
  });

test('the monster pike lurks in the fishing water: a great dark shape with its shadow, no health bar yet, and no golden leaf', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'easy');
  await onJetty(page);
  await expect.poll(async () => (await pike(page)).visible, { timeout: 30_000 }).toBe(true);
  const state = await pike(page);
  expect(state.phase).toBe('lurking');
  expect(state.shadow).toBe(true);
  expect(state.health).toBe(state.of);
  // Far longer than the biggest fish in the water is drawn.
  expect(state.length).toBeGreaterThan(6);
  await expect(page.locator('#boss')).toBeHidden();
  expect(await leafShown(page)).toBe(false);
  expect(problems).toEqual([]);
});

test('in the water half it snaps at a hero on the log and lies spent; a landing on its head shows on it and on its bar', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Caputo', 'easy');
  await onJetty(page);
  await toTheLog(page);
  await expect(page.locator('#boss')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#boss-name')).toHaveText('The Monster Pike');
  await expect(page.locator('#boss-health span')).toHaveCount(4);
  await expect(page.locator('#boss-health span.full')).toHaveCount(2);
  // Its jaws come up off the end of the log: on Easy a line shows where the snap will go.
  await expect.poll(async () => (await pike(page)).phase, { timeout: 120_000 }).toBe('snapTell');
  expect((await pike(page)).aimLine).toBe(true);
  await expect(page.locator('#message')).toContainText('jaws', { timeout: 30_000 });
  // Hold it spent, and come down on its head.
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    const log = game.level.solids.find((s: { id: string }) => s.id === game.level.pike.log);
    Object.assign(game.pike, { phase: 'rest', timer: 0, x: log.x, y: log.top + 0.4, z: log.z });
    Object.assign(game, { x: log.x, y: log.top + 2.6, z: log.z, vx: 0, vy: -3, vz: 0, grounded: false, groundId: null });
  });
  await expect.poll(async () => (await pike(page)).health, { timeout: 30_000 }).toBe(1);
  await expect(page.locator('#boss-health span.full')).toHaveCount(1);
  await expect(page.locator('#message')).toContainText('The Monster Pike hit! 1 more to go.');
  expect((await pike(page)).flashing).toBe(true);
  expect(await leafShown(page)).toBe(false);
  expect((await snapshot(page)).complete).toBe(false);
  expect(problems).toEqual([]);
});

test('beating it: the bar empties, it sinks out of sight, the leaf appears on the dock and can be taken', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'normal');
  await onJetty(page);
  await toTheLog(page);
  // Before it is beaten, standing where the leaf will be does nothing.
  await standOn(page, 'dock', 0);
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    Object.assign(game, { x: game.level.leaf.x, z: game.level.leaf.z });
  });
  await frames(page, 3);
  expect((await snapshot(page)).complete).toBe(false);
  // One pip left, spent on the log, and a landing on its head.
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    const log = game.level.solids.find((s: { id: string }) => s.id === game.level.pike.log);
    Object.assign(game.pike, { phase: 'rest', timer: 0, health: 1, x: log.x, y: log.top + 0.4, z: log.z });
    Object.assign(game, { x: log.x, y: log.top + 2.6, z: log.z, vx: 0, vy: -3, vz: 0, grounded: false, groundId: null });
  });
  await expect.poll(async () => (await pike(page)).phase, { timeout: 30_000 }).toBe('defeated');
  await expect(page.locator('#message')).toContainText('The Monster Pike is beaten!');
  await expect.poll(() => leafShown(page), { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await pike(page)).visible, { timeout: 60_000 }).toBe(false);
  await expect(page.locator('#boss')).toBeHidden({ timeout: 60_000 });
  // Back on the dock, the leaf ends the level.
  await standOn(page, 'dock', 0);
  await page.evaluate(() => {
    const { game } = (window as unknown as Grove).__grove;
    Object.assign(game, { x: game.level.leaf.x, z: game.level.leaf.z });
  });
  await expect.poll(async () => (await snapshot(page)).complete, { timeout: 60_000 }).toBe(true);
  expect(problems).toEqual([]);
});
