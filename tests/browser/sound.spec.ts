import { expect, test, type Page } from '@playwright/test';
import { address, open, play, ready, watch } from './helpers';

// Sound in a real browser: nothing before the first tap or key press, sounds
// once the game is being played, the Sound button and the M key, the mute
// being remembered, and no complaint from the browser with sound on or off.
// What each event sounds like is checked by tests/sound.test.ts. Nobody can
// hear a test browser: these check the sound is asked for and nothing breaks.

interface SoundState {
  unlocked: boolean;
  muted: boolean;
  state: string;
  ready: boolean;
  volume: number;
  music: string | null;
  loops: string[];
  played: string[];
  problems: string[];
}

const sound = (page: Page): Promise<SoundState> =>
  page.evaluate(() => (window as unknown as { __grove: { sound: SoundState } }).__grove.sound);

/** Waits until every sound is decoded and the browser is letting sound out. */
const soundIsOn = async (page: Page): Promise<void> => {
  await expect.poll(async () => (await sound(page)).ready, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => (await sound(page)).state).toBe('running');
};

/** Lifts the hero a little way up, so it drops and lands: a sound the game makes by itself. */
const drop = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { y: number; vy: number; grounded: boolean } } }).__grove;
    game.y += 1.5;
    game.vy = 0;
    game.grounded = false;
  });

test('nothing plays before the first tap or key press', async ({ page }) => {
  // "Who's playing?" is up and the files are in, and nobody has touched anything yet.
  const problems = watch(page);
  await page.goto(address());
  await expect(page.locator('#who')).toBeVisible();
  await ready(page);
  const before = await sound(page);
  expect(before.unlocked).toBe(false);
  expect(before.state).toBe('none');
  expect(before.played).toEqual([]);
  expect(before.music).toBeNull();
  await expect(page.locator('#mute')).toHaveText('Sound on');
  expect(problems).toEqual([]);
});

test('sound starts with the first tap, the music plays, and the game makes its sounds', async ({ page }) => {
  const problems = await open(page);
  await play(page);
  expect((await sound(page)).unlocked).toBe(true);
  await soundIsOn(page);
  await expect.poll(async () => (await sound(page)).music).toBe('groveMusic');
  await drop(page);
  await expect.poll(async () => (await sound(page)).played).toContain('landMoss');
  // Pausing is a button like any other: it clicks.
  await page.locator('#pause').click();
  await expect.poll(async () => (await sound(page)).played).toContain('button');
  const after = await sound(page);
  expect(after.problems).toEqual([]);
  expect(after.volume).toBe(1);
  expect(problems).toEqual([]);
});

test('the Sound button mutes and unmutes, and the game plays on without a complaint', async ({ page }) => {
  const problems = await open(page);
  await play(page);
  await soundIsOn(page);
  const button = page.locator('#mute');
  await button.click();
  await expect(button).toHaveText('Sound off');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  let now = await sound(page);
  expect(now.muted).toBe(true);
  expect(now.volume).toBe(0);
  // Muted: the game goes on, and nothing more is played.
  const heard = now.played.length;
  await drop(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __grove: { game: { grounded: boolean } } }).__grove.game.grounded)).toBe(true);
  expect((await sound(page)).played.length).toBe(heard);
  await button.click();
  await expect(button).toHaveText('Sound on');
  now = await sound(page);
  expect(now.muted).toBe(false);
  expect(now.volume).toBe(1);
  await drop(page);
  await expect.poll(async () => (await sound(page)).played.length).toBeGreaterThan(heard);
  expect((await sound(page)).problems).toEqual([]);
  expect(problems).toEqual([]);
});

test('mute is remembered between visits, and a muted visit plays through cleanly', async ({ page }) => {
  await open(page);
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveText('Sound off');

  await page.reload();
  const problems = watch(page);
  await expect(page.locator('#play')).toBeEnabled({ timeout: 60_000 });
  // Before any tap on this visit, the button already shows the remembered choice.
  await expect(page.locator('#mute')).toHaveText('Sound off');
  expect((await sound(page)).muted).toBe(true);
  expect((await sound(page)).unlocked).toBe(false);

  await play(page);
  await expect.poll(async () => (await sound(page)).ready, { timeout: 30_000 }).toBe(true);
  await drop(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __grove: { game: { grounded: boolean } } }).__grove.game.grounded)).toBe(true);
  const muted = await sound(page);
  expect(muted.volume).toBe(0);
  expect(muted.played).toEqual([]);
  expect(muted.problems).toEqual([]);
  expect(problems).toEqual([]);

  // And turning it back on is remembered too.
  await page.locator('#mute').click();
  await page.goto(address());
  await expect(page.locator('#mute')).toHaveText('Sound on');
});

test.describe('on the keyboard', () => {
  test.skip(({ hasTouch }) => Boolean(hasTouch), 'Keyboard checks run on the Mac-sized screen');

  test('a key press is enough to start sound, and Space is heard as a push-off', async ({ page }) => {
    const problems = await open(page);
    await page.keyboard.press('ArrowRight');
    expect((await sound(page)).unlocked).toBe(true);
    await page.locator('[data-hero="Yaarbro"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#play').focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __grove: { mode: string } }).__grove.mode)).toBe('playing');
    await soundIsOn(page);
    await page.keyboard.down('Space');
    await expect.poll(async () => (await sound(page)).played).toContain('pushMoss');
    await page.keyboard.up('Space');
    expect(problems).toEqual([]);
  });

  test('the M key mutes and unmutes', async ({ page }) => {
    await open(page);
    await play(page);
    await page.keyboard.press('KeyM');
    await expect(page.locator('#mute')).toHaveText('Sound off');
    expect((await sound(page)).muted).toBe(true);
    // Muting does not pause or steer the game.
    expect(await page.evaluate(() => (window as unknown as { __grove: { mode: string } }).__grove.mode)).toBe('playing');
    await page.keyboard.press('KeyM');
    await expect(page.locator('#mute')).toHaveText('Sound on');
    expect((await sound(page)).muted).toBe(false);
  });
});

test.describe('on the touch screen', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch checks run on the iPad-sized screen');

  test('a tap on the Sound button mutes, and nothing covers it while playing', async ({ page }) => {
    const problems = await open(page);
    await play(page);
    await soundIsOn(page);
    const button = page.locator('#mute');
    await button.tap();
    await expect(button).toHaveText('Sound off');
    expect((await sound(page)).volume).toBe(0);
    // The tap was for the button, not the Jump half of the screen behind it.
    expect(await page.evaluate(() => (window as unknown as { __grove: { game: { grounded: boolean } } }).__grove.game.grounded)).toBe(true);
    await button.tap();
    await expect(button).toHaveText('Sound on');
    expect(problems).toEqual([]);
  });
});
