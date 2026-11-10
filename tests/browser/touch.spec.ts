import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { open, play, snapshot } from './helpers';

// Touch play, as on the iPad held sideways.
test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

/** Real finger touches, sent through the browser's own input path. */
const fingers = async (page: Page): Promise<{ send: (type: string, points: Array<{ x: number; y: number; id: number }>) => Promise<void> }> => {
  const session: CDPSession = await page.context().newCDPSession(page);
  return {
    send: async (type, points) => {
      await session.send('Input.dispatchTouchEvent', {
        type: type as 'touchStart',
        touchPoints: points.map((point) => ({ ...point, radiusX: 12, radiusY: 12, force: 1 })),
      });
    },
  };
};

test('shows the stick and the Jump button while playing', async ({ page }) => {
  await open(page);
  await expect(page.locator('#touch')).toBeHidden();
  await play(page);
  await expect(page.locator('#stick-base')).toBeVisible();
  await expect(page.locator('#jump-button')).toBeVisible();
  await expect(page.locator('#controls-note')).toContainText('thumb');
});

test('dragging the left thumb walks the hero that way', async ({ page }) => {
  await open(page);
  await play(page);
  const touch = await fingers(page);
  const start = await snapshot(page);

  // Thumb down on the left side, dragged up: walk away from the camera.
  await touch.send('touchStart', [{ x: 200, y: 600, id: 1 }]);
  await touch.send('touchMove', [{ x: 200, y: 500, id: 1 }]);
  await expect.poll(async () => (await snapshot(page)).z).toBeLessThan(start.z - 1);
  // Slide the same thumb to the right: walk right.
  const turned = await snapshot(page);
  await touch.send('touchMove', [{ x: 320, y: 600, id: 1 }]);
  await expect.poll(async () => (await snapshot(page)).x).toBeGreaterThan(turned.x + 0.5);
  await touch.send('touchEnd', [{ x: 320, y: 600, id: 1 }]);

  await page.waitForTimeout(600);
  const resting = await snapshot(page);
  await page.waitForTimeout(400);
  expect((await snapshot(page)).x).toBe(resting.x);
});

test('pressing the right side jumps, while the left thumb keeps walking', async ({ page }) => {
  await open(page);
  await play(page);
  const touch = await fingers(page);
  const start = await snapshot(page);

  await touch.send('touchStart', [{ x: 200, y: 600, id: 1 }]);
  await touch.send('touchMove', [{ x: 200, y: 520, id: 1 }]);
  // A second finger comes down on the right while the first stays put.
  await touch.send('touchStart', [
    { x: 200, y: 520, id: 1 },
    { x: 880, y: 600, id: 2 },
  ]);
  await expect(page.locator('#jump-zone')).toHaveClass(/down/);
  await expect.poll(async () => (await snapshot(page)).y, { intervals: [30] }).toBeGreaterThan(0.5);
  // Lift only the jumping finger: the hero lands and keeps walking.
  await touch.send('touchEnd', [{ x: 880, y: 600, id: 2 }]);
  await expect(page.locator('#jump-zone')).not.toHaveClass(/down/);
  await expect.poll(async () => (await snapshot(page)).grounded).toBe(true);
  const landed = await snapshot(page);
  expect(landed.z).toBeLessThan(start.z - 1);
  await expect.poll(async () => (await snapshot(page)).z).toBeLessThan(landed.z - 0.5);
  // Lift the walking thumb: the hero stops.
  await touch.send('touchEnd', [{ x: 200, y: 520, id: 1 }]);
  await page.waitForTimeout(600);
  const resting = await snapshot(page);
  await page.waitForTimeout(400);
  expect((await snapshot(page)).z).toBe(resting.z);
});

test('the Pause button works by touch', async ({ page }) => {
  await open(page);
  await play(page);
  await page.locator('#pause').tap();
  await expect(page.locator('#paused')).toBeVisible();
  await page.locator('#resume').tap();
  await expect(page.locator('#paused')).toBeHidden();
  expect((await snapshot(page)).mode).toBe('playing');
});

test('held upright: shows "Turn sideways" and holds the game until it is turned', async ({ page }) => {
  await open(page);
  await expect(page.locator('#rotate')).toBeHidden();
  await play(page);

  // Upright. A device that is turned sideways while its screen is locked
  // upright looks exactly like this to the page, so it gets the same card.
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator('#rotate')).toBeVisible();
  await expect(page.locator('#rotate h1')).toHaveText('Turn sideways to play');
  await expect(page.locator('#rotate-lock')).toContainText('locked upright');
  const held = (await snapshot(page)).seconds;
  await page.waitForTimeout(500);
  expect((await snapshot(page)).seconds).toBe(held);

  // Sideways again: the card goes and the game carries on by itself.
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('#rotate')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(held);
});

test('held upright at the start screen: the card covers it', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await open(page);
  await expect(page.locator('#rotate')).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('#rotate')).toBeHidden();
  await expect(page.locator('#play')).toBeVisible();
});
