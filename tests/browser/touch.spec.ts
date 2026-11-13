import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { address, expectAtRest, open, pickPlayer, play, skipBoss, snapshot, standOn } from './helpers';

// Touch play, as on the iPad held sideways.
test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

type Point = { x: number; y: number; id: number };
type Fingers = { send: (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Point[]) => Promise<void> };

/**
 * Fingers on the screen. Each call lists the fingers that just came down
 * (touchStart, alongside any already down), moved (touchMove) or lifted (touchEnd).
 *
 * Chromium: real touches, sent through the browser's own input path.
 *
 * WebKit: the test tools can tap but cannot hold a finger down or drag one, so
 * held and dragged fingers are touch pointer events handed to whatever page
 * element is under the finger. That checks the game's touch handling in
 * Safari's engine and that nothing covers the controls. Taps on buttons
 * (Play, Pause, Keep playing) are real taps in both browsers.
 */
const fingers = async (page: Page, browserName: string): Promise<Fingers> => {
  if (browserName === 'chromium') {
    const session: CDPSession = await page.context().newCDPSession(page);
    return {
      send: async (type, points) => {
        await session.send('Input.dispatchTouchEvent', {
          type,
          touchPoints: points.map((point) => ({ ...point, radiusX: 12, radiusY: 12, force: 1 })),
        });
      },
    };
  }
  return {
    send: async (type, points) => {
      await page.evaluate(
        ([kind, list]) => {
          const page = window as unknown as { __fingers?: Map<number, Element> };
          // A finger keeps talking to the element it first touched, as real touches do.
          const down = (page.__fingers ??= new Map<number, Element>());
          for (const point of list) {
            const held = down.get(point.id);
            const name = kind === 'touchEnd' ? 'pointerup' : held ? 'pointermove' : 'pointerdown';
            const target = held ?? document.elementFromPoint(point.x, point.y);
            if (!target) throw new Error(`Nothing under the finger at ${point.x}, ${point.y}`);
            if (name === 'pointerdown') down.set(point.id, target);
            if (name === 'pointerup') down.delete(point.id);
            target.dispatchEvent(
              new PointerEvent(name, {
                pointerId: point.id + 100,
                pointerType: 'touch',
                isPrimary: down.size <= 1,
                clientX: point.x,
                clientY: point.y,
                width: 24,
                height: 24,
                pressure: name === 'pointerup' ? 0 : 1,
                bubbles: true,
                cancelable: true,
                composed: true,
              }),
            );
          }
        },
        [type, points] as const,
      );
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

test('dragging the left thumb walks the hero that way', async ({ page, browserName }) => {
  await open(page);
  await play(page);
  const touch = await fingers(page, browserName);
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

  await expectAtRest(page);
});

test('pressing the right side jumps, while the left thumb keeps walking', async ({ page, browserName }) => {
  await open(page);
  await play(page);
  const touch = await fingers(page, browserName);
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
  await expectAtRest(page);
});

test('a thumb on the stick walks the hero to the golden leaf, and the end card shows', async ({ page, browserName }) => {
  await open(page);
  await play(page, 'Yaarbro', 'easy');
  // Start at the near end of the last bough (the whole route is played by the
  // rule tests), then walk the rest by thumb: the leaf is straight ahead.
  // The marmot chief stands between the hero and the leaf: count it as beaten here (boss.spec.ts fights it).
  await skipBoss(page);
  await standOn(page, 'bough', 2);
  const touch = await fingers(page, browserName);
  await touch.send('touchStart', [{ x: 200, y: 600, id: 1 }]);
  await touch.send('touchMove', [{ x: 200, y: 500, id: 1 }]);
  await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
  await touch.send('touchEnd', [{ x: 200, y: 500, id: 1 }]);

  await expect(page.locator('#end-title')).toHaveText('You found the golden leaf!');
  await expect(page.locator('#end-hero')).toHaveText('Yaarbro');
  await expect(page.locator('#end-difficulty')).toHaveText('Easy');
  await expect(page.locator('#touch')).toBeHidden();
  await page.locator('#again').tap();
  await expect(page.locator('#start')).toBeVisible();
  expect(await snapshot(page)).toMatchObject({ mode: 'start', complete: false });
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
  await page.goto(address());
  // The card covers "Who's playing?" too: nothing under it can be tapped.
  await expect(page.locator('#rotate')).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('#rotate')).toBeHidden();
  await pickPlayer(page);
  await expect(page.locator('#play')).toBeVisible();
});
