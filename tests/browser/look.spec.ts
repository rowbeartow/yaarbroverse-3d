import { expect, test } from '@playwright/test';
import { address, frames, open, play, ready, snapshot, watch } from './helpers';

// The look: loading, the frame counter, quality tiers, the full lighting, and
// hero models. These run in every browser project.

interface Stats {
  framesPerSecond: number;
  tier: string;
  automatic: boolean;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
}

const stats = (page: import('@playwright/test').Page): Promise<Stats | null> =>
  page.evaluate(() => (window as unknown as { __grove: { stats: Stats | null } }).__grove.stats);

interface HeroInfo {
  model: string;
  clips: string[];
  clock: number;
}

const hero = (page: import('@playwright/test').Page): Promise<HeroInfo | null> =>
  page.evaluate(() => (window as unknown as { __grove: { hero: HeroInfo | null } }).__grove.hero);

test.describe('loading', () => {
  test('the start screen is up before the 3D files arrive, with a progress bar', async ({ page }) => {
    // Hold one file back, so there is time to look at the page while it loads.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/media/hdri/**', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(address());

    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('h1#start-title')).toHaveText('The Bouncing Grove');
    await expect(page.locator('#loading')).toBeVisible();
    await expect(page.locator('#loading-text')).toContainText('Loading the grove');
    await expect(page.locator('#play')).toBeDisabled();
    // Everything but the held file arrives, so the bar moves but cannot finish.
    await expect.poll(async () => Number(await page.locator('#loading-bar').getAttribute('value'))).toBeGreaterThan(20);
    expect(Number(await page.locator('#loading-bar').getAttribute('value'))).toBeLessThan(100);
    // The choices already work while it loads.
    await page.locator('[data-difficulty="easy"]').click();
    await expect(page.locator('[data-difficulty="easy"]')).toHaveAttribute('aria-checked', 'true');

    release();
    await ready(page);
    await expect(page.locator('#loading')).toBeHidden();
    await page.locator('#play').click();
    expect(await snapshot(page)).toMatchObject({ mode: 'playing', difficulty: 'easy' });
  });

  test('a file that never arrives shows a plain message with a way to try again', async ({ page }) => {
    await page.route('**/media/textures/**', (route) => route.abort());
    await page.goto(address());
    await expect(page.locator('#failed')).toBeVisible();
    await expect(page.locator('#failed h1')).toHaveText('The grove did not finish loading');
    await expect(page.locator('#start')).toBeHidden();

    await page.unroute('**/media/textures/**');
    await page.locator('#reload').click();
    await ready(page);
    await expect(page.locator('#failed')).toBeHidden();
  });
});

test.describe('frame counter and quality', () => {
  test('the frame counter shows when the address ends in ?fps, and not otherwise', async ({ page }) => {
    await open(page);
    await frames(page, 3);
    await expect(page.locator('#fps')).toBeHidden();

    await open(page, 'fps');
    await expect(page.locator('#fps')).toBeVisible();
    await expect(page.locator('#fps')).toHaveText(/^\d+ fps · (high|medium|low|minimal)( \(fixed\))? · \d\.\d\dx · \d+ draws · \d+k triangles$/);
  });

  test('a quality tier can be fixed in the address', async ({ page }) => {
    await open(page, 'quality=minimal');
    expect(await stats(page)).toMatchObject({ tier: 'minimal', automatic: false });
  });

  test('left alone, the game settles on a tier this machine can hold', async ({ page }) => {
    // A small window, because the tiers above the lowest take seconds a frame
    // on a machine with no graphics card, and WebKit starts on one of them.
    await page.setViewportSize({ width: 480, height: 360 });
    const problems = watch(page);
    await page.goto('/');
    await ready(page, 120_000);
    expect((await stats(page))?.automatic).toBe(true);
    // No graphics card here, so the only tier that holds is the lowest.
    await expect.poll(async () => (await stats(page))?.tier, { timeout: 150_000, intervals: [1000] }).toBe('minimal');
    await frames(page, 3);
    expect(problems).toEqual([]);
  });
});

test.describe('full lighting', () => {
  // The tier an iPad starts on: forest light, sun shadows and the glow pass.
  // The other checks run on the lowest tier, which has none of these, so this
  // is where they are proven to work in each browser.
  for (const tier of ['medium', 'high']) {
    test(`draws at ${tier} quality without errors`, async ({ page, hasTouch }) => {
      // High is where a computer starts and medium where an iPad starts, so
      // high is checked on the Mac-sized screen only. It is the slowest check.
      test.skip(tier === 'high' && Boolean(hasTouch), 'High quality is checked on the Mac-sized screen');
      test.setTimeout(240_000);
      await page.setViewportSize({ width: 480, height: 360 });
      const problems = await open(page, `quality=${tier}`);
      await play(page);
      await frames(page, 3);
      expect(await stats(page)).toMatchObject({ tier, automatic: false });
      // A flat, empty picture compresses to almost nothing; a lit forest does not.
      await page.locator('#hud').evaluate((element) => ((element as HTMLElement).hidden = true));
      await expect.poll(async () => (await page.screenshot({ timeout: 60_000 })).byteLength, { timeout: 120_000 }).toBeGreaterThan(30_000);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('hero models', () => {
  // The loader and animation player, checked against the stand-in model.
  test('a model hero loads, shows on the start screen, and its animation advances', async ({ page }) => {
    const problems = await open(page, 'standin');
    for (const name of ['Yaarbro', 'Caputo']) {
      await expect(page.locator(`[data-hero="${name}"] img`)).toHaveAttribute('src', /^data:image\/png/);
    }
    await play(page);
    const start = await hero(page);
    expect(start?.model).toBe('standin.glb');
    expect(start?.clips).toEqual(expect.arrayContaining(['Idle', 'Walking', 'Running', 'Jump']));

    // Standing still, the idle clip plays on.
    await expect.poll(async () => (await hero(page))?.clock ?? 0).toBeGreaterThan((start?.clock ?? 0) + 0.3);
    // Walking and jumping keep it going, and the rules still move the hero.
    const before = await snapshot(page);
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).z).toBeLessThan(before.z - 1);
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).y, { intervals: [30] }).toBeGreaterThan(0.3);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowUp');
    const walked = await hero(page);
    expect(walked?.clock ?? 0).toBeGreaterThan((start?.clock ?? 0) + 0.5);
    expect(problems).toEqual([]);
  });

  test('Yaarbro is drawn from his own model, and it moves when he stands, runs and jumps', async ({ page }) => {
    const problems = await open(page);
    await expect(page.locator('[data-hero="Yaarbro"] img')).toHaveAttribute('src', /^data:image\/png/);
    await play(page, 'Yaarbro');
    const start = await hero(page);
    expect(start?.model).toBe('yaarbro.glb');
    // One clip from each of his Meshy files (tools/yaarbro.guide.json).
    expect(start?.clips.slice().sort()).toEqual(['idle', 'jump', 'landing', 'roll', 'run', 'walk']);

    await expect.poll(async () => (await hero(page))?.clock ?? 0).toBeGreaterThan((start?.clock ?? 0) + 0.3);
    const before = await snapshot(page);
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).z).toBeLessThan(before.z - 1);
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).y, { intervals: [30] }).toBeGreaterThan(0.3);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowUp');
    expect((await hero(page))?.clock ?? 0).toBeGreaterThan((start?.clock ?? 0) + 0.5);
    expect(problems).toEqual([]);
  });

  test('Caputo is drawn from his own model, with a clip for standing, walking, running and each part of a jump', async ({ page }) => {
    const problems = await open(page);
    await expect(page.locator('[data-hero="Caputo"] img')).toHaveAttribute('src', /^data:image\/png/);
    await play(page, 'Caputo');
    const start = await hero(page);
    expect(start?.model).toBe('caputo.glb');
    // The clips the rig script writes (tools/rig-quadruped.py).
    expect(start?.clips.slice().sort()).toEqual(['falling', 'idle', 'jump', 'landing', 'pounce', 'run', 'trot', 'walk']);

    await expect.poll(async () => (await hero(page))?.clock ?? 0).toBeGreaterThan((start?.clock ?? 0) + 0.3);
    const before = await snapshot(page);
    await page.keyboard.down('ArrowUp');
    await expect.poll(async () => (await snapshot(page)).z).toBeLessThan(before.z - 1);
    await page.keyboard.down('Space');
    await expect.poll(async () => (await snapshot(page)).y, { intervals: [30] }).toBeGreaterThan(0.3);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowUp');
    expect((await hero(page))?.clock ?? 0).toBeGreaterThan((start?.clock ?? 0) + 0.5);
    expect(problems).toEqual([]);
  });
});
