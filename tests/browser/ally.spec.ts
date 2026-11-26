import { expect, test, type Page } from '@playwright/test';
import { open, play } from './helpers';

// The heroes' second move (Walblum's kick, the Claw Slash): the C key at Mac
// size and its own round button at iPad size reach the rules, the flier is
// drawn, and a game without the move shows no button. The move's rules are
// checked by tests/sidekick.test.ts. Until the rescue gives a player the move,
// `?ally` on the address switches it on.

interface AllyState {
  has: boolean;
  phase: string | null;
  sent: number;
  /** Strikes left on the first scout of the grove. */
  scout: number;
  scoutPhase: string;
  drawn: { flier: boolean; burst: boolean; walblum: boolean } | null;
}

const state = (page: Page): Promise<AllyState> =>
  page.evaluate(() => {
    const grove = (window as unknown as { __grove: { game: any; sidekick: AllyState['drawn'] } }).__grove;
    const { game } = grove;
    const scout = game.enemies.find((enemy: { spot: { id: string } }) => enemy.spot.id === 'scout-clearing');
    return { has: game.sidekick !== null, phase: game.sidekick?.phase ?? null, sent: game.sidekick?.sent ?? 0, scout: scout.hits, scoutPhase: scout.phase, drawn: grove.sidekick };
  });

/** Stands the hero on the scout's bank, a few metres from it, facing it, where nothing can hurt it. */
const faceScout = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const scout = game.enemies.find((enemy: { spot: { id: string } }) => enemy.spot.id === 'scout-clearing');
    const bank = game.level.solids.find((solid: { id: string }) => solid.id === 'bank-2');
    game.x = scout.x + 4;
    game.z = scout.z + 3;
    game.y = bank.top;
    game.vx = 0;
    game.vy = 0;
    game.vz = 0;
    game.facing = Math.atan2(scout.x - game.x, scout.z - game.z);
    game.protectedFor = 60;
  });

const finger = (page: Page, selector: string, kind: 'pointerdown' | 'pointerup'): Promise<void> =>
  page.evaluate(
    ([target, name]) => {
      const element = document.querySelector(target)!;
      const box = element.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const under = document.elementFromPoint(x, y);
      if (under !== element) throw new Error(`${target} is covered by ${under?.id || under?.tagName}`);
      element.dispatchEvent(
        new PointerEvent(name, { pointerId: 78, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: name === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }),
      );
    },
    [selector, kind] as const,
  );

test.describe('on the keyboard', () => {
  test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

  for (const hero of ['Yaarbro', 'Caputo']) {
    test(`pressing C sends ${hero}'s second move at the scout in front of him, and it comes back`, async ({ page }) => {
      const problems = await open(page, 'ally');
      await play(page, hero, 'easy');
      expect((await state(page)).has).toBe(true);
      await faceScout(page);
      await page.keyboard.press('KeyC');
      await expect.poll(async () => (await state(page)).sent).toBe(1);
      // One strike beats a scout on Easy.
      await expect.poll(async () => (await state(page)).scoutPhase).toBe('defeated');
      await expect.poll(async () => (await state(page)).phase).toBe('ready');
      // Walblum's own model is fetched the first time a game has the move.
      if (hero === 'Yaarbro') await expect.poll(async () => (await state(page)).drawn?.walblum).toBe(true);
      expect(problems).toEqual([]);
    });
  }

  test('a game without the move has none, and C does nothing', async ({ page }) => {
    await open(page);
    await play(page, 'Yaarbro', 'easy');
    expect((await state(page)).has).toBe(false);
    await faceScout(page);
    await page.keyboard.press('KeyC');
    await page.keyboard.press('KeyZ');
    expect((await state(page)).scout).toBeGreaterThan(0);
    await expect(page.locator('#ally-button')).toBeHidden();
  });

  test('the pause screen names the key once a player has the move', async ({ page }) => {
    await open(page, 'ally');
    await play(page, 'Caputo', 'easy');
    await page.keyboard.press('Escape');
    await expect(page.locator('#paused-controls')).toContainText('C or Z');
    await expect(page.locator('#paused-controls')).toContainText('Claw Slash');
  });
});

test.describe('by touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

  test('the second move has a round button of its own, clear of Jump and the first move', async ({ page }) => {
    await open(page, 'ally');
    await play(page, 'Yaarbro', 'easy');
    await expect(page.locator('#ally-button')).toBeVisible();
    await expect(page.locator('#ally-button')).toHaveText('Walblum');
    const ally = (await page.locator('#ally-button').boundingBox())!;
    const move = (await page.locator('#move-button').boundingBox())!;
    const jump = (await page.locator('#jump-button').boundingBox())!;
    expect(ally.width).toBeGreaterThanOrEqual(76);
    expect(ally.x + ally.width).toBeLessThanOrEqual(move.x);
    expect(ally.x + ally.width).toBeLessThanOrEqual(jump.x);
    expect(ally.x).toBeGreaterThan(page.viewportSize()!.width / 2);
  });

  test('a thumb on it sends the move, and neither jumps nor rolls', async ({ page }) => {
    await open(page, 'ally');
    await play(page, 'Caputo', 'easy');
    await expect(page.locator('#ally-button')).toHaveText('Claws');
    await faceScout(page);
    await finger(page, '#ally-button', 'pointerdown');
    await expect.poll(async () => (await state(page)).sent).toBe(1);
    await expect(page.locator('#jump-zone')).not.toHaveClass(/down/);
    await finger(page, '#ally-button', 'pointerup');
    await expect.poll(async () => (await state(page)).scoutPhase).toBe('defeated');
    const moves = await page.evaluate(() => (window as unknown as { __grove: { game: { movesUsed: number } } }).__grove.game.movesUsed);
    expect(moves).toBe(0);
  });

  test('a game without the move shows no such button', async ({ page }) => {
    await open(page);
    await play(page, 'Yaarbro', 'easy');
    await expect(page.locator('#ally-button')).toBeHidden();
  });
});
