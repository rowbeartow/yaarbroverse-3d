import { expect, test, type Page } from '@playwright/test';
import { address, open, pickPlayer, play, ready, snapshot, standOn, watch } from './helpers';

// "Who's playing?", separate players, saved progress and the grown-ups' reset.
// The names are made up. What is saved is read straight from the browser's
// storage here, because no screen shows progress yet.

interface SavedPlayer {
  name: string;
  colour: string;
  hero: string;
  difficulty: string;
  bests: Record<string, Record<string, Record<string, { seconds: number; falls: number }>>>;
}

const saved = (page: Page): Promise<SavedPlayer[]> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('yaarbroverse-3d:players') ?? '{"players":[]}').players);

/** Plays the tiny development level to its end card. */
const finishSandbox = async (page: Page, hero = 'Yaarbro', difficulty = 'easy'): Promise<void> => {
  await play(page, hero, difficulty);
  await standOn(page, 'bank-end', 3);
  await page.keyboard.down('ArrowUp');
  await expect(page.locator('#end')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('ArrowUp');
};

test('a first visit asks who is playing, and a name and a colour make a player', async ({ page }) => {
  const problems = watch(page);
  await page.goto(address());
  await expect(page.locator('#who')).toBeVisible();
  await expect(page.locator('#who-title')).toHaveText('Who’s playing?');
  await expect(page.locator('#start')).toBeHidden();
  // Nobody is here yet, so the form is up, with six colours and one picked.
  await expect(page.locator('#who-form')).toBeVisible();
  await expect(page.locator('#who-back')).toBeHidden();
  await expect(page.locator('.swatch')).toHaveCount(6);
  await expect(page.locator('.swatch[aria-checked="true"]')).toHaveCount(1);

  // A name is needed.
  await page.locator('#who-done').click();
  await expect(page.locator('#who-problem')).toHaveText('Type a name first.');
  await expect(page.locator('#who')).toBeVisible();

  await page.locator('#who-name').fill('Pip the Magnificent');
  await page.locator('.swatch[data-colour="plum"]').click();
  await page.locator('#who-done').click();
  await expect(page.locator('#who')).toBeHidden();
  await expect(page.locator('#start')).toBeVisible();
  // Twelve characters at most.
  await expect(page.locator('#player-name')).toHaveText('Pip the Magn');
  expect(await saved(page)).toMatchObject([{ name: 'Pip the Magn', colour: 'plum', bests: {} }]);
  expect(problems).toEqual([]);
});

test('typing a name is not heard by the game: M does not mute', async ({ page, hasTouch }) => {
  test.skip(Boolean(hasTouch), 'Typed on the keyboard');
  await page.goto(address());
  await page.locator('#who-name').click();
  await page.keyboard.type('Mm Moss');
  await expect(page.locator('#who-name')).toHaveValue('Mm Moss');
  await expect(page.locator('#mute')).toHaveText('Sound on');
});

test('each player has their own hero, difficulty and progress, kept between visits', async ({ page }) => {
  const problems = await open(page, 'level=sandbox');
  await finishSandbox(page, 'Caputo', 'easy');
  await page.locator('#again').click();

  // A second player, from the start screen.
  await page.locator('#switch-player').click();
  await expect(page.locator('#who-players .player:not(.add)')).toHaveCount(1);
  await pickPlayer(page, 'Moss');
  await expect(page.locator('#player-name')).toHaveText('Moss');
  // Moss starts from the game's own choices, not Pip's.
  await expect(page.locator('[data-hero="Yaarbro"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-difficulty="normal"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('[data-difficulty="hard"]').click();

  await page.reload();
  await expect(page.locator('#who-players .player:not(.add)')).toHaveCount(2);
  await pickPlayer(page, 'Pip');
  await ready(page);
  await expect(page.locator('[data-hero="Caputo"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('[data-difficulty="easy"]')).toHaveAttribute('aria-checked', 'true');
  expect(await snapshot(page)).toMatchObject({ hero: 'Caputo', difficulty: 'easy' });

  const [pip, moss] = await saved(page);
  expect(pip).toMatchObject({ name: 'Pip', hero: 'Caputo', difficulty: 'easy' });
  expect(pip.bests.sandbox.Caputo.easy.seconds).toBeGreaterThan(0);
  expect(pip.bests.sandbox.Caputo.easy.falls).toBe(0);
  expect(moss).toMatchObject({ name: 'Moss', hero: 'Yaarbro', difficulty: 'hard', bests: {} });
  expect(problems).toEqual([]);
});

test('a run that stops short of the golden leaf saves nothing', async ({ page }) => {
  await open(page, 'level=sandbox');
  await play(page, 'Yaarbro', 'easy');
  await expect.poll(async () => (await snapshot(page)).seconds).toBeGreaterThan(0.2);
  await page.locator('#pause').click();
  await page.locator('#quit').click();
  await expect(page.locator('#start')).toBeVisible();
  expect((await saved(page))[0].bests).toEqual({});
});

test('a grown-up can reset a player’s progress or remove a player, each behind a confirmation', async ({ page }) => {
  await open(page, 'level=sandbox');
  await finishSandbox(page);
  await page.locator('#again').click();
  await page.locator('#switch-player').click();
  await pickPlayer(page, 'Moss');
  await page.locator('#switch-player').click();

  await page.locator('#who-manage').click();
  await expect(page.locator('#who-title')).toHaveText('For grown-ups');
  const pip = page.locator('.grown-row', { hasText: 'Pip' });

  // Saying no keeps everything.
  await pip.locator('[data-action="reset"]').click();
  await expect(page.locator('#who-confirm-text')).toContainText('Reset Pip’s progress?');
  await expect(page.locator('#who-confirm-text')).toContainText('cannot be undone');
  await page.locator('#who-confirm-no').click();
  expect((await saved(page))[0].bests.sandbox).toBeDefined();

  // Saying yes wipes the progress and keeps the player.
  await pip.locator('[data-action="reset"]').click();
  await page.locator('#who-confirm-yes').click();
  expect(await saved(page)).toMatchObject([{ name: 'Pip', bests: {} }, { name: 'Moss' }]);

  // Removing takes the player off the device, after the same kind of question.
  await pip.locator('[data-action="remove"]').click();
  await expect(page.locator('#who-confirm-text')).toContainText('Remove Pip from this device?');
  await page.locator('#who-confirm-yes').click();
  expect(await saved(page)).toMatchObject([{ name: 'Moss' }]);
  await page.locator('#who-grown-done').click();
  await expect(page.locator('#who-players .player:not(.add)')).toHaveCount(1);
  await expect(page.locator('#who-players')).not.toContainText('Pip');
});

test('there is room for four players and no more', async ({ page }) => {
  await page.goto(address());
  for (const name of ['One', 'Two', 'Three', 'Four']) {
    await pickPlayer(page, name);
    await page.locator('#switch-player').click();
  }
  await expect(page.locator('#who-players .player:not(.add)')).toHaveCount(4);
  await expect(page.locator('#who-add')).toHaveCount(0);
});

test('damaged saved data starts fresh, and the game carries on', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('damaged')) {
      sessionStorage.setItem('damaged', 'yes');
      localStorage.setItem('yaarbroverse-3d:players', '{"players":[{"id":7,"name":null},"x"],"last":{}} and then some');
      localStorage.setItem('yaarbroverse-3d:choice', '<<<');
    }
  });
  const problems = watch(page);
  await page.goto(address('level=sandbox'));
  await expect(page.locator('#who-form')).toBeVisible();
  await pickPlayer(page);
  await ready(page);
  await finishSandbox(page);
  expect((await saved(page))[0].bests.sandbox.Yaarbro.easy.falls).toBe(0);
  expect(problems).toEqual([]);
});

test('a player’s name is never sent anywhere', async ({ page }) => {
  const sent: string[] = [];
  page.on('request', (request) => sent.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
  await page.goto(address('level=sandbox'));
  await pickPlayer(page, 'Zebedee');
  await ready(page);
  await finishSandbox(page);
  expect(sent.length).toBeGreaterThan(5);
  for (const request of sent) {
    expect(request.toLowerCase()).not.toContain('zebedee');
    expect(request.startsWith('GET ')).toBe(true);
  }
  // Nor is it in the address or the page's title.
  expect(page.url().toLowerCase()).not.toContain('zebedee');
  expect((await page.title()).toLowerCase()).not.toContain('zebedee');
});
