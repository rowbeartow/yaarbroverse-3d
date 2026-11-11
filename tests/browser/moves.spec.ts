import { expect, test, type Page } from '@playwright/test';
import { open, play } from './helpers';

// Each hero's own move: Yaarbro's roll and Caputo's pounce, from the keyboard
// at Mac size and from the touch button at iPad size. The rules of the moves
// are checked by tests/moves.test.ts; these check the buttons reach them.

interface MoveState {
  rolling: boolean;
  movesUsed: number;
  speed: number;
  walkSpeed: number;
}

const state = (page: Page): Promise<MoveState> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { rolling: boolean; movesUsed: number; vx: number; vz: number } } }).__grove;
    return { rolling: game.rolling, movesUsed: game.movesUsed, speed: Math.hypot(game.vx, game.vz), walkSpeed: 6 };
  });

/** Presses a touch pointer down on the element, or lifts it. Works the same in Chromium and WebKit. */
const finger = (page: Page, selector: string, kind: 'pointerdown' | 'pointerup'): Promise<void> =>
  page.evaluate(
    ([target, name]) => {
      const element = document.querySelector(target)!;
      const box = element.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      // The button has to be the thing under the finger: nothing may cover it.
      const under = document.elementFromPoint(x, y);
      if (under !== element) throw new Error(`${target} is covered by ${under?.id || under?.tagName}`);
      element.dispatchEvent(
        new PointerEvent(name, { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, pressure: name === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }),
      );
    },
    [selector, kind] as const,
  );

test.describe('on the keyboard', () => {
  test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

  test('holding X rolls Yaarbro, faster than he walks, and letting go stops the roll', async ({ page }) => {
    await open(page);
    await play(page, 'Yaarbro', 'easy');
    await expect(page.locator('#message')).toContainText('X or Shift to roll');
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('KeyX');
    await expect.poll(async () => (await state(page)).rolling).toBe(true);
    // The first bank is 10 m wide: a roll gets past walking speed before its edge.
    await expect.poll(async () => { const now = await state(page); return now.speed > now.walkSpeed; }).toBe(true);
    await page.keyboard.up('KeyX');
    await page.keyboard.up('ArrowRight');
    await expect.poll(async () => (await state(page)).rolling).toBe(false);
    // At least once: a roll that carries him off an edge starts again when he is back.
    expect((await state(page)).movesUsed).toBeGreaterThanOrEqual(1);
  });

  test('pressing Shift makes Caputo pounce, once for each press', async ({ page }) => {
    await open(page);
    await play(page, 'Caputo', 'easy');
    await expect(page.locator('#message')).toContainText('X or Shift to pounce');
    await page.keyboard.press('ShiftLeft');
    await expect.poll(async () => (await state(page)).movesUsed).toBe(1);
    // Wait until he has landed and stopped, then pounce again with the other key.
    await expect.poll(async () => (await state(page)).speed).toBe(0);
    await page.keyboard.press('KeyX');
    await expect.poll(async () => (await state(page)).movesUsed).toBe(2);
  });
});

test.describe('by touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

  test('the move button is named for the hero, sits above Jump, and is the smaller of the two', async ({ page }) => {
    await open(page);
    await play(page, 'Caputo', 'easy');
    await expect(page.locator('#move-button')).toHaveText('Pounce');
    const move = (await page.locator('#move-button').boundingBox())!;
    const jump = (await page.locator('#jump-button').boundingBox())!;
    expect(move.width).toBeLessThan(jump.width * 0.75);
    expect(move.width).toBeGreaterThanOrEqual(76);
    expect(move.y + move.height).toBeLessThanOrEqual(jump.y);
    // Both are on the right half, clear of the Pause button.
    const pause = (await page.locator('#pause').boundingBox())!;
    expect(move.x).toBeGreaterThan(page.viewportSize()!.width / 2);
    expect(move.y).toBeGreaterThan(pause.y + pause.height);
    await page.locator('#pause').click();
    await page.locator('#quit').click();
    await play(page, 'Yaarbro', 'easy');
    await expect(page.locator('#move-button')).toHaveText('Roll');
  });

  test('a thumb on the move button pounces Caputo, and does not jump', async ({ page }) => {
    await open(page);
    await play(page, 'Caputo', 'easy');
    await finger(page, '#move-button', 'pointerdown');
    await expect.poll(async () => (await state(page)).movesUsed).toBe(1);
    await expect(page.locator('#move-button')).toHaveClass(/down/);
    await expect(page.locator('#jump-zone')).not.toHaveClass(/down/);
    await finger(page, '#move-button', 'pointerup');
    await expect(page.locator('#move-button')).not.toHaveClass(/down/);
  });

  test('a thumb held on the move button rolls Yaarbro until it lifts', async ({ page }) => {
    await open(page);
    await play(page, 'Yaarbro', 'easy');
    await finger(page, '#move-button', 'pointerdown');
    await expect.poll(async () => (await state(page)).rolling).toBe(true);
    await finger(page, '#move-button', 'pointerup');
    await expect.poll(async () => (await state(page)).rolling).toBe(false);
    // At least once: a roll that carries him off an edge starts again when he is back.
    expect((await state(page)).movesUsed).toBeGreaterThanOrEqual(1);
  });
});
