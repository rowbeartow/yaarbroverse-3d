import { expect, test } from '@playwright/test';
import { expectAtRest, open, play, snapshot } from './helpers';

// Keyboard play, as on the Mac.
test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

test('arrow keys and W A S D walk the hero, and letting go stops it', async ({ page }) => {
  await open(page);
  await play(page);
  const start = await snapshot(page);

  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).z).toBeLessThan(start.z - 1);
  await page.keyboard.up('ArrowUp');

  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(start.x + 0.5);
  await page.keyboard.up('KeyD');

  await expectAtRest(page);
});

test('Space jumps', async ({ page }) => {
  await open(page);
  await play(page);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await snapshot(page)).y, { intervals: [30] }).toBeGreaterThan(0.5);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await snapshot(page)).grounded).toBe(true);
  expect((await snapshot(page)).y).toBe(0);
});

test('Escape pauses and resumes', async ({ page }) => {
  await open(page);
  await play(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#paused')).toBeVisible();
  expect((await snapshot(page)).mode).toBe('paused');
  await page.keyboard.press('Escape');
  await expect(page.locator('#paused')).toBeHidden();
  expect((await snapshot(page)).mode).toBe('playing');
});

test('the start screen can be used with the keyboard alone', async ({ page }) => {
  await open(page);
  await expect(page.locator('#play')).toBeFocused();
  await page.locator('[data-difficulty="normal"]').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-difficulty="hard"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-difficulty="hard"]')).toBeFocused();
  await page.locator('#play').focus();
  await page.keyboard.press('Enter');
  expect(await snapshot(page)).toMatchObject({ mode: 'playing', difficulty: 'hard' });
});

test('no touch controls or turn-sideways card on a computer, even in a tall window', async ({ page }) => {
  await open(page);
  await play(page);
  await expect(page.locator('#touch')).toBeHidden();
  await page.setViewportSize({ width: 500, height: 800 });
  await expect(page.locator('#rotate')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(0.2);
});
