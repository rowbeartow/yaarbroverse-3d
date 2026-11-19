import { expect, test, type Page } from '@playwright/test';
import { frames, open, play, standOn } from './helpers';

// Fishing in a real browser: the spot on the lake's jetty, the button that
// says what it does, and a whole catch on Easy, where nothing needs timing.
// The rules themselves (casting, bites, reeling, the line snapping) are played
// by tests/fishing.test.ts; here it is the drawing, the page and the controls.

interface Fishing {
  fish: number;
  ring: boolean;
  bobber: boolean;
  line: boolean;
  mark: boolean;
  thrashing: boolean;
  phase: string;
  catches: number;
}
const fishing = (page: Page): Promise<Fishing> => page.evaluate(() => (window as unknown as { __grove: { fishing: Fishing } }).__grove.fishing);

/** Stands the hero on the jetty, with the dock's enemies out of the way: they are not what this checks. */
const onJetty = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { enemies: Array<{ phase: string; timer: number }> } } }).__grove;
    for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
  });
  await standOn(page, 'jetty', -0.6);
  await frames(page, 3);
};

/** Holds or lets go of the round touch button, the way a finger does (see touch.spec.ts for why it is done by hand). */
const finger = (page: Page, name: 'pointerdown' | 'pointerup'): Promise<void> =>
  page.evaluate((kind) => {
    const button = document.querySelector('#move-button')!;
    const box = button.getBoundingClientRect();
    button.dispatchEvent(
      new PointerEvent(kind, { pointerId: 81, pointerType: 'touch', isPrimary: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2, pressure: kind === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true, composed: true }),
    );
  }, name);

test('the jetty has a marked spot, with every fish in the water in front of it', async ({ page }) => {
  const problems = await open(page, 'level=cocolalla');
  await play(page, 'Yaarbro', 'normal');
  await onJetty(page);
  await expect.poll(async () => (await fishing(page)).mark).toBe(true);
  const state = await fishing(page);
  expect(state.fish).toBe(8);
  expect([state.phase, state.ring, state.bobber, state.line]).toEqual(['off', false, false, false]);
  await expect(page.locator('#message')).toContainText('to fish');
  expect(problems).toEqual([]);
});

test.describe('on the keyboard', () => {
  test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

  test('X held slides the ring out, letting go casts, and on Easy holding it again lands a fish', async ({ page }) => {
    const problems = await open(page, 'level=cocolalla');
    await play(page, 'Yaarbro', 'easy');
    await onJetty(page);
    await page.keyboard.down('KeyX');
    await expect.poll(async () => (await fishing(page)).phase).toBe('aim');
    expect((await fishing(page)).ring).toBe(true);
    await page.keyboard.up('KeyX');
    await expect.poll(async () => (await fishing(page)).bobber, { timeout: 30_000 }).toBe(true);
    expect((await fishing(page)).line).toBe(true);
    // On Easy the fish hooks itself and the line cannot snap: hold X until it is landed.
    await expect.poll(async () => (await fishing(page)).phase, { timeout: 60_000 }).toBe('bite');
    await page.keyboard.down('KeyX');
    await expect.poll(async () => (await fishing(page)).phase, { timeout: 30_000 }).toBe('hooked');
    await expect(page.locator('#line')).toBeVisible();
    await expect.poll(async () => (await fishing(page)).catches, { timeout: 120_000 }).toBe(1);
    await page.keyboard.up('KeyX');
    await expect(page.locator('#message')).toContainText(' cm.');
    await expect(page.locator('#line')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('Jump winds the line in, and the hero is free to walk off the jetty', async ({ page }) => {
    const problems = await open(page, 'level=cocolalla');
    await play(page, 'Caputo', 'normal');
    await onJetty(page);
    await page.keyboard.down('KeyX');
    await expect.poll(async () => (await fishing(page)).phase).toBe('aim');
    await page.keyboard.press('Space');
    await page.keyboard.up('KeyX');
    await expect.poll(async () => (await fishing(page)).phase).toBe('off');
    expect((await fishing(page)).mark).toBe(true);
    expect(problems).toEqual([]);
  });
});

test.describe('by touch', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

  test('the round button says Fish on the spot, Cast while the ring is out, and is the hero’s own move off it', async ({ page }) => {
    const problems = await open(page, 'level=cocolalla');
    await play(page, 'Caputo', 'easy');
    const button = page.locator('#move-button');
    await expect(button).toHaveText('Pounce');
    await onJetty(page);
    await expect(button).toHaveText('Fish');
    await finger(page, 'pointerdown');
    await expect(button).toHaveText('Cast');
    expect((await fishing(page)).ring).toBe(true);
    await finger(page, 'pointerup');
    await expect(button).toHaveText('Wait');
    await expect.poll(async () => (await fishing(page)).bobber, { timeout: 30_000 }).toBe(true);
    // Back on the dock it is Caputo's pounce again.
    await standOn(page, 'dock');
    await expect(button).toHaveText('Pounce');
    expect((await fishing(page)).phase).toBe('off');
    expect(problems).toEqual([]);
  });
});
