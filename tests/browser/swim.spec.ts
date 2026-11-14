import { expect, test, type Page } from '@playwright/test';
import { frames, open, play } from './helpers';

// Swimming in the Sandbox's pool: the move button dives (X on the keyboard,
// the round button on touch), and the breath bar shows while breath runs down
// on Normal and never on Easy. The rules of swimming are checked by
// tests/swim.test.ts; these check the buttons and the screen reach them.

interface SwimState {
  swimming: boolean;
  under: boolean;
  breath: number;
  hearts: number;
}

const state = (page: Page): Promise<SwimState> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: SwimState } }).__grove;
    return { swimming: game.swimming, under: game.under, breath: game.breath, hearts: game.hearts };
  });

/** Drops the hero into the pool, a few metres short of the arch, and waits until it floats. */
const intoPool = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const pool = game.level.water[0];
    game.x = 0;
    game.z = pool.maxZ - 4;
    game.y = pool.surface - 0.6;
    game.vx = 0;
    game.vy = 0;
    game.vz = 0;
    game.grounded = false;
    game.groundId = null;
  });
  await expect.poll(async () => (await state(page)).swimming).toBe(true);
};

/** Presses or lifts a touch pointer on the round move button. */
const finger = (page: Page, kind: 'pointerdown' | 'pointerup'): Promise<void> =>
  page.evaluate((name) => {
    const element = document.querySelector('#move-button')!;
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    element.dispatchEvent(
      new PointerEvent(name, { pointerId: 78, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: name === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }),
    );
  }, kind);

const dive = async (page: Page, hasTouch: boolean, down: boolean): Promise<void> => {
  if (hasTouch) await finger(page, down ? 'pointerdown' : 'pointerup');
  else if (down) await page.keyboard.down('x');
  else await page.keyboard.up('x');
};

test('on Normal the move button dives, the breath bar runs down underwater, and letting go brings the swimmer back up', async ({ page, hasTouch }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Caputo', 'normal');
  await intoPool(page);
  await expect(page.locator('#breath')).toBeHidden();
  await dive(page, Boolean(hasTouch), true);
  await expect.poll(async () => (await state(page)).under).toBe(true);
  await expect(page.locator('#breath')).toBeVisible();
  const full = (await state(page)).breath;
  await expect.poll(async () => (await state(page)).breath).toBeLessThan(full - 0.3);
  await dive(page, Boolean(hasTouch), false);
  // Let go, and the swimmer drifts back up and breath fills again.
  await expect.poll(async () => (await state(page)).under, { timeout: 60_000 }).toBe(false);
  await expect(page.locator('#breath')).toBeHidden({ timeout: 60_000 });
  expect(problems).toEqual([]);
});

test('on Easy breath never runs out, so there is no breath bar', async ({ page, hasTouch }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'easy');
  await intoPool(page);
  await dive(page, Boolean(hasTouch), true);
  await expect.poll(async () => (await state(page)).under).toBe(true);
  await frames(page, 10);
  await expect(page.locator('#breath')).toBeHidden();
  expect((await state(page)).hearts).toBe(5);
  await dive(page, Boolean(hasTouch), false);
  expect(problems).toEqual([]);
});
