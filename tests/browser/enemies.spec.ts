import { expect, test, type Page } from '@playwright/test';
import { frames, open, play, snapshot, standOn } from './helpers';

// The enemies in the level: they show up, they hurt, and each hero's move
// beats them from the keyboard and from the touch button. Their rules are
// checked by tests/enemies.test.ts; these check them in a browser.

interface EnemyState {
  phase: string;
  hits: number;
  clip: string;
  visible: boolean;
  aimLine: boolean;
  flashing: boolean;
}

const enemy = (page: Page, index: number): Promise<EnemyState> =>
  page.evaluate((i) => {
    const grove = (window as unknown as { __grove: { game: { enemies: Array<{ phase: string; hits: number }> }; enemies: Array<{ clip: string; visible: boolean; aimLine: boolean; flashing: boolean }> } }).__grove;
    return { phase: grove.game.enemies[i].phase, hits: grove.game.enemies[i].hits, ...grove.enemies[i] };
  }, index);

const heartsLost = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __grove: { game: { heartsLost: number } } }).__grove.game.heartsLost);

/**
 * Stands the hero in the clearing with the scout resting a little way straight
 * ahead, where it cannot hop away and touching it does not hurt.
 */
const faceRestingScout = (page: Page, ahead: number): Promise<void> =>
  page.evaluate((gap) => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const bank = game.level.solids.find((s: { id: string }) => s.id === 'bank-2');
    Object.assign(game, { x: bank.x, y: bank.top, z: bank.z + 4, vx: 0, vy: 0, vz: 0, facing: Math.PI, grounded: true });
    Object.assign(game.enemies[0], { x: bank.x, z: bank.z + 4 - gap, phase: 'rest', timer: -60 });
  }, ahead);

test('the marmot scout spots a hero in the clearing, and standing still there costs a heart', async ({ page }) => {
  const problems = await open(page);
  await play(page, 'Yaarbro', 'normal');
  expect((await enemy(page, 0)).visible).toBe(false);
  await standOn(page, 'bank-2', 4);
  await expect.poll(async () => (await enemy(page, 0)).visible).toBe(true);
  await expect(page.locator('#message')).toContainText('marmot scout has spotted you');
  // It warns, with the acorn raised, then throws at where the hero stands.
  await expect.poll(async () => (await enemy(page, 0)).clip, { timeout: 30_000, intervals: [50] }).toBe('warning');
  await expect.poll(() => heartsLost(page), { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#hearts svg.lost')).not.toHaveCount(0);
  expect(problems).toEqual([]);
});

test('on Easy the marmot scout comes out of hiding in the clearing', async ({ page }) => {
  const problems = await open(page);
  await play(page, 'Caputo', 'easy');
  expect((await enemy(page, 0)).phase).toBe('concealed');
  await standOn(page, 'bank-2', 4);
  await expect.poll(async () => (await enemy(page, 0)).visible).toBe(true);
  await expect(page.locator('#message')).toContainText('A rustle in the roots');
  expect(problems).toEqual([]);
});

test('on Hard the marmot scout walks its beat in plain view, and comes after a hero in the clearing', async ({ page }) => {
  const problems = await open(page);
  await play(page, 'Yaarbro', 'hard');
  await expect.poll(async () => (await enemy(page, 0)).phase).toBe('patrol');
  // Stand at the near end of the clearing, as far from the scout as the bank allows.
  await standOn(page, 'bank-2', 5);
  await expect.poll(async () => (await enemy(page, 0)).visible).toBe(true);
  const gap = (): Promise<number> =>
    page.evaluate(() => {
      const { game } = (window as unknown as { __grove: { game: { x: number; z: number; enemies: Array<{ x: number; z: number }> } } }).__grove;
      return Math.hypot(game.enemies[0].x - game.x, game.enemies[0].z - game.z);
    });
  const first = await gap();
  // It closes on the hero, walking: the game's own state says so, not the clock.
  await expect.poll(gap, { timeout: 30_000 }).toBeLessThan(first - 1);
  await expect.poll(async () => (await enemy(page, 0)).clip, { timeout: 30_000, intervals: [50] }).toMatch(/walk|warning/);
  expect(problems).toEqual([]);
});

/** Holds the scout in its warning, aimed at the hero, and says whether the aim line is drawn. */
const lineWhileWarning = async (page: Page): Promise<EnemyState> => {
  await standOn(page, 'bank-2', 4);
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const scout = game.enemies[0];
    Object.assign(scout, { phase: 'warning', timer: -60, grace: 0, from: { x: scout.x, y: scout.y + 1.3, z: scout.z }, target: { x: game.x, y: game.y + 0.8, z: game.z } });
  });
  await expect.poll(async () => (await enemy(page, 0)).clip, { intervals: [50] }).toBe('warning');
  await frames(page, 3);
  return enemy(page, 0);
};

test('on Easy a line shows where the scout will throw', async ({ page }) => {
  await open(page);
  await play(page, 'Yaarbro', 'easy');
  expect((await lineWhileWarning(page)).aimLine).toBe(true);
});

for (const difficulty of ['normal', 'hard']) {
  test(`on ${difficulty} nothing is drawn: the warning is the scout rearing up`, async ({ page }) => {
    const problems = await open(page);
    await play(page, 'Yaarbro', difficulty);
    const state = await lineWhileWarning(page);
    expect([state.aimLine, state.clip, state.visible]).toEqual([false, 'warning', true]);
    expect(problems).toEqual([]);
  });
}

test('the giant mosquito hovers over the high boughs', async ({ page }) => {
  const problems = await open(page);
  await play(page, 'Caputo', 'easy');
  await standOn(page, 'bough-4');
  await expect.poll(async () => (await enemy(page, 1)).visible).toBe(true);
  await expect.poll(async () => ['hover', 'warning', 'dive', 'winded'].includes((await enemy(page, 1)).clip)).toBe(true);
  expect(problems).toEqual([]);
});

test.describe('on the keyboard', () => {
  test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

  test('Yaarbro’s roll, held on X, strikes the scout', async ({ page }) => {
    await open(page);
    await play(page, 'Yaarbro', 'normal');
    await faceRestingScout(page, 6);
    await page.keyboard.down('KeyX');
    // On Normal one hit beats a scout.
    await expect.poll(async () => (await enemy(page, 0)).hits, { timeout: 30_000 }).toBe(0);
    await page.keyboard.up('KeyX');
    await expect(page.locator('#message')).toContainText('Marmot sent packing');
    expect(await heartsLost(page)).toBe(0);
  });
});

test.describe('by touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

  test('Caputo’s pounce, from the touch button, strikes the scout', async ({ page }) => {
    await open(page);
    await play(page, 'Caputo', 'normal');
    await faceRestingScout(page, 2.2);
    await page.evaluate(() => {
      const button = document.querySelector('#move-button')!;
      const box = button.getBoundingClientRect();
      for (const name of ['pointerdown', 'pointerup']) {
        button.dispatchEvent(
          new PointerEvent(name, { pointerId: 78, pointerType: 'touch', isPrimary: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, pressure: name === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }),
        );
      }
    });
    await expect.poll(async () => (await enemy(page, 0)).hits, { timeout: 30_000 }).toBe(0);
    await expect(page.locator('#message')).toContainText('Marmot sent packing');
    expect(await heartsLost(page)).toBe(0);
  });
});

test('on Hard a scout takes two hits: the first shows as a flash, and a fall undoes it', async ({ page }) => {
  const problems = await open(page);
  await play(page, 'Yaarbro', 'hard');
  await standOn(page, 'bank-2', 4);
  await frames(page, 2);
  // Come down on the scout while it rests.
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const bank = game.level.solids.find((s: { id: string }) => s.id === 'bank-2');
    Object.assign(game.enemies[0], { x: bank.x, z: bank.z, phase: 'rest', timer: -60, grace: 0 });
    Object.assign(game, { x: bank.x, z: bank.z, y: bank.top + 2, vx: 0, vy: -3, vz: 0, grounded: false });
  });
  await expect.poll(async () => (await enemy(page, 0)).hits, { timeout: 30_000 }).toBe(1);
  await expect(page.locator('#message')).toContainText('Marmot hit! 1 more to go.');
  expect((await enemy(page, 0)).flashing).toBe(true);
  // Off the side of the clearing: back to the safe bank, and the scout is whole again.
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: any } }).__grove;
    const bank = game.level.solids.find((s: { id: string }) => s.id === 'bank-2');
    Object.assign(game, { x: bank.x + bank.halfX + 3, vx: 0, vz: 0 });
  });
  await expect.poll(async () => (await snapshot(page)).falls, { timeout: 60_000 }).toBe(1);
  expect((await enemy(page, 0)).hits).toBe(2);
  await expect(page.locator('#message')).toContainText('back to full strength', { timeout: 30_000 });
  expect(problems).toEqual([]);
});
