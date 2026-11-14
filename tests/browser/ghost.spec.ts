import { expect, test, type Page } from '@playwright/test';
import { frames, open, pickPlayer, play, skipBoss, snapshot, standOn } from './helpers';

// The ghost in a real browser, on the tiny development level: the whole flow
// from "Who's playing?" to the end card, a new best, and the ghost appearing
// on the next run. The names are made up.

interface GhostInfo {
  shown: boolean;
  x: number;
  y: number;
  z: number;
  seconds: number;
}

const ghost = (page: Page): Promise<GhostInfo | null> =>
  page.evaluate(() => (window as unknown as { __grove: { ghost: GhostInfo | null } }).__grove.ghost);

const toggle = (page: Page) => page.locator('.area.picked .ghost-toggle input');

/** Walks from the start of the last bank to the leaf, and waits for the end card. */
const finish = async (page: Page): Promise<void> => {
  await skipBoss(page);
  await standOn(page, 'bank-end', 3);
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('ArrowUp');
};

test('from Who’s playing? to the end card, a new best, and the ghost on the next run', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await expect(page.locator('#player-name')).toHaveText('Pip');

  // The ghost is on for Normal and there is nothing to race yet.
  await page.locator('[data-difficulty="normal"]').click();
  await expect(toggle(page)).toBeChecked();
  await expect(page.locator('.area.picked .ghost-toggle small')).toHaveText('Finish a run this way first, then race it.');

  // The first run: no ghost. It ends with a new best.
  await play(page, 'Yaarbro', 'normal');
  expect(await ghost(page)).toBeNull();
  await finish(page);
  await expect(page.locator('#end-new')).toHaveText('First finish! That is the time to beat.');
  await expect(page.locator('#end-time-best')).toHaveText('New best!');
  const firstRun = (await snapshot(page)).seconds;
  await page.locator('#again').click();
  await expect(page.locator('.area.picked .ghost-toggle small')).toHaveText('A see-through copy of your best run runs beside you.');

  // The next run: the ghost is there, and its run is the one just saved. (That
  // run was set down on the last bank by this check, so its ghost is soon far
  // ahead; a ghost starting where the hero starts is checked by the rule tests.)
  await play(page, 'Yaarbro', 'normal');
  await expect.poll(async () => (await ghost(page))?.shown).toBe(true);
  expect((await ghost(page))!.seconds).toBeCloseTo(firstRun, 1);

  // It runs on the game's clock: paused, it waits.
  await page.locator('#pause').click();
  await frames(page, 3);
  const held = (await ghost(page))!;
  await frames(page, 6);
  expect(await ghost(page)).toEqual(held);
  await page.locator('#resume').click();

  // It is a picture only: it stands where the hero stands and nothing happens to the hero.
  const before = await snapshot(page);
  await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(before.seconds + 0.3);
  expect(await snapshot(page)).toMatchObject({ x: before.x, z: before.z, falls: 0, groundId: 'bank-start' });

  // It ends at the leaf and stays there.
  await expect.poll(async () => (await snapshot(page)).seconds, { timeout: 60_000 }).toBeGreaterThan(firstRun + 0.2);
  const leaf = await page.evaluate(() => (window as unknown as { __grove: { game: { level: { leaf: { x: number; z: number } } } } }).__grove.game.level.leaf);
  const resting = (await ghost(page))!;
  expect(Math.hypot(resting.x - leaf.x, resting.z - leaf.z)).toBeLessThan(1.5);
  expect((await snapshot(page)).complete).toBe(false);

  // No sound came from it: only what the hero and the buttons did.
  const played = await page.evaluate(() => (window as unknown as { __grove: { sound: { played: string[]; problems: string[] } } }).__grove.sound);
  expect(played.problems).toEqual([]);
  expect(problems).toEqual([]);
});

test('the ghost is off on Easy and on for Normal and Hard, and the switch on the card is remembered', async ({ page }) => {
  await open(page, 'level=sandbox');
  await page.locator('[data-difficulty="easy"]').click();
  await expect(toggle(page)).not.toBeChecked();
  await page.locator('[data-difficulty="hard"]').click();
  await expect(toggle(page)).toBeChecked();

  // A best run on Easy, then another run: no ghost, because it is off there.
  await play(page, 'Yaarbro', 'easy');
  await finish(page);
  await page.locator('#again').click();
  await play(page, 'Yaarbro', 'easy');
  await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(0.2);
  expect(await ghost(page)).toBeNull();
  await page.locator('#pause').click();
  await page.locator('#quit').click();

  // Switched on for Easy on the card: the ghost is there, and the choice is kept for the next visit.
  await toggle(page).check();
  await expect(page.locator('.area.picked .ghost-toggle small')).toHaveText('A see-through copy of your best run runs beside you.');
  await play(page, 'Yaarbro', 'easy');
  await expect.poll(async () => (await ghost(page))?.shown).toBe(true);
  await page.reload();
  await pickPlayer(page, 'Pip');
  await expect(toggle(page)).toBeChecked();
  // The other hero has no best run yet, and another player has the usual.
  await page.locator('[data-hero="Caputo"]').click();
  await expect(page.locator('.area.picked .ghost-toggle small')).toHaveText('Finish a run this way first, then race it.');
  await page.locator('#switch-player').click();
  await pickPlayer(page, 'Moss');
  await page.locator('[data-difficulty="easy"]').click();
  await expect(toggle(page)).not.toBeChecked();
});

test('only a better time replaces the ghost, and a damaged ghost is no ghost', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'normal');
  await finish(page);
  const best = (await snapshot(page)).seconds;
  await page.locator('#again').click();

  // A slower run: the ghost stays the first run's.
  await play(page, 'Yaarbro', 'normal');
  await page.evaluate(() => ((window as unknown as { __grove: { game: { seconds: number } } }).__grove.game.seconds = 200));
  await finish(page);
  await expect(page.locator('#end-new')).toBeHidden();
  await page.locator('#again').click();
  await play(page, 'Yaarbro', 'normal');
  await expect.poll(async () => (await ghost(page))?.shown).toBe(true);
  expect((await ghost(page))!.seconds).toBeCloseTo(best, 1);
  await page.locator('#pause').click();
  await page.locator('#quit').click();

  // Ghosts are kept in the browser's database, not in local storage.
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('yaarbroverse-3d:ghost:')).length)).toBe(0);
  // Spoil the saved ghost: the next run simply has none, and the best time is still there.
  const spoiled = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const opening = indexedDB.open('yaarbroverse-3d');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const shelf = opening.result.transaction('ghosts', 'readwrite').objectStore('ghosts');
          const keys = shelf.getAllKeys();
          keys.onsuccess = () => {
            for (const key of keys.result) shelf.put('{"v":1,"d":"@@@"', key);
            shelf.transaction.oncomplete = () => {
              opening.result.close();
              resolve(keys.result.length);
            };
          };
        };
      }),
  );
  expect(spoiled).toBeGreaterThan(0);
  await page.reload();
  await pickPlayer(page, 'Pip');
  await expect(page.locator('.area.picked .ghost-toggle small')).toHaveText('Finish a run this way first, then race it.');
  await expect(page.locator('.area[data-level="sandbox"] .mark[data-mark="normal"]')).toHaveAttribute('data-finished', 'true');
  await play(page, 'Yaarbro', 'normal');
  await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(0.2);
  expect(await ghost(page)).toBeNull();
  expect(problems).toEqual([]);
});

test('a ghost saved in local storage by an earlier version is carried over into the database', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await page.locator('[data-difficulty="normal"]').click();
  await play(page, 'Yaarbro', 'normal');
  await finish(page);
  await page.locator('#again').click();

  // Put the saved ghost back where an earlier version kept it: in local storage, and not in the database.
  const moved = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const opening = indexedDB.open('yaarbroverse-3d');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
          const shelf = opening.result.transaction('ghosts', 'readwrite').objectStore('ghosts');
          const keys = shelf.getAllKeys();
          const values = shelf.getAll();
          values.onsuccess = () => {
            keys.result.forEach((key, i) => localStorage.setItem(String(key), values.result[i] as string));
            shelf.clear();
            shelf.transaction.oncomplete = () => {
              opening.result.close();
              resolve(keys.result.length);
            };
          };
        };
      }),
  );
  expect(moved).toBe(1);

  await page.reload();
  await pickPlayer(page, 'Pip');
  await page.locator('[data-difficulty="normal"]').click();
  // The ghost is there to race, and local storage no longer holds it.
  await expect(page.locator('.area.picked .ghost-toggle small')).toHaveText('A see-through copy of your best run runs beside you.');
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('yaarbroverse-3d:ghost:')).length)).toBe(0);
  await play(page, 'Yaarbro', 'normal');
  await expect.poll(async () => (await ghost(page))?.shown).toBe(true);
  expect(problems).toEqual([]);
});
