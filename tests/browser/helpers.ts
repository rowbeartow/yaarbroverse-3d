import { expect, test, type Page } from '@playwright/test';

/** What the running game looks like right now, read through the page's small test window. */
export interface Snapshot {
  mode: string;
  x: number;
  y: number;
  z: number;
  grounded: boolean;
  groundId: string | null;
  seconds: number;
  falls: number;
  complete: boolean;
  hero: string;
  difficulty: string;
}

export const snapshot = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const grove = (window as unknown as { __grove: { game: Record<string, unknown>; mode: string } }).__grove;
    const g = grove.game as unknown as Omit<Snapshot, 'mode'>;
    return {
      mode: grove.mode,
      x: g.x,
      y: g.y,
      z: g.z,
      grounded: g.grounded,
      groundId: g.groundId,
      seconds: g.seconds,
      falls: g.falls,
      complete: g.complete,
      hero: g.hero,
      difficulty: g.difficulty,
    };
  });

/**
 * The address to open. WebKit hides what kind of graphics card it has, so on
 * the test machine (which has none) the game would start on the tier for a
 * real iPad and spend a minute finding out it cannot hold it. The checks say
 * so up front instead. Chromium owns up to drawing in software, and the game
 * picks the lowest tier by itself. `look.spec.ts` checks the choosing itself.
 */
export const address = (query = ''): string => {
  const fixed = test.info().project.name === 'ipad-webkit' && !query.includes('quality=') ? 'quality=minimal' : '';
  const parts = [fixed, query].filter(Boolean).join('&');
  return parts ? `/?${parts}` : '/';
};

/** Collects anything the browser complains about from now on. */
export const watch = (page: Page): string[] => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  return problems;
};

/** Waits until the 3D picture has loaded and Play works. */
export const ready = async (page: Page, timeout = 60_000): Promise<void> => {
  await expect(page.locator('#play')).toBeEnabled({ timeout });
};

/**
 * Gets past "Who's playing?": picks the named player if they are on this
 * device, and adds them if not. The name is made up.
 */
export const pickPlayer = async (page: Page, name = 'Pip'): Promise<void> => {
  await expect(page.locator('#who')).toBeVisible();
  const tile = page.locator('#who-players .player:not(.add)', { hasText: name });
  if (await page.locator('#who-list').isVisible()) {
    if (await tile.count()) {
      await tile.first().click();
      await expect(page.locator('#start')).toBeVisible();
      return;
    }
    await page.locator('#who-add').click();
  }
  await page.locator('#who-name').fill(name);
  await page.locator('#who-done').click();
  await expect(page.locator('#start')).toBeVisible();
};

/** Opens the game, picks a player, waits until it is ready to play, and collects anything the browser complains about. */
export const open = async (page: Page, query = ''): Promise<string[]> => {
  const problems = watch(page);
  await page.goto(address(query));
  await pickPlayer(page);
  await ready(page);
  return problems;
};

/** Lets the game draw this many more frames. */
export const frames = (page: Page, count: number): Promise<void> =>
  page.evaluate(
    (wanted) =>
      new Promise<void>((done) => {
        let drawn = 0;
        const next = (): void => {
          drawn += 1;
          if (drawn > wanted) done();
          else requestAnimationFrame(next);
        };
        requestAnimationFrame(next);
      }),
    count,
  );

export const play = async (page: Page, hero = 'Yaarbro', difficulty = 'normal'): Promise<void> => {
  // After a reload, "Who's playing?" is up again.
  if (await page.locator('#who').isVisible()) await pickPlayer(page);
  await page.locator(`[data-hero="${hero}"]`).click();
  await page.locator(`[data-difficulty="${difficulty}"]`).click();
  await page.locator('#play').click();
  await expect(page.locator('#start')).toBeHidden();
  await expect.poll(async () => (await snapshot(page)).mode).toBe('playing');
};

/**
 * Stands the hero on a named part of the level. Used to check the last step of
 * a run (touching the leaf, falling from a high place) without replaying the
 * whole level through timed key presses, which is unreliable on slow machines.
 * The full level is played start to finish by the rule tests instead.
 */
export const standOn = (page: Page, solidId: string, back = 0): Promise<void> =>
  page.evaluate(
    ([id, offset]) => {
      const { game } = (window as unknown as { __grove: { game: any } }).__grove;
      const solid = game.level.solids.find((s: { id: string }) => s.id === id);
      game.x = solid.x;
      game.z = solid.z + (offset as number);
      game.y = solid.top;
      game.vx = 0;
      game.vy = 0;
      game.vz = 0;
    },
    [solidId, back] as const,
  );

/**
 * Counts the level's boss as beaten, if it has one, so a check about the end
 * of a run (the leaf, the end card, saved bests) does not have to fight it
 * first. The fight itself is played by the rule tests (tests/boss.test.ts)
 * and checked in a browser by boss.spec.ts.
 */
export const skipBoss = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const { game } = (window as unknown as { __grove: { game: { boss: { phase: string; health: number; timer: number } | null } } }).__grove;
    if (game.boss) Object.assign(game.boss, { phase: 'defeated', health: 0, timer: 10 });
  });

/**
 * Checks the hero has come to a stop and stays there. It waits on the game's
 * own speed, not on the clock: a machine that draws one frame a second takes
 * a couple of seconds to play out the slide to a halt.
 */
export const expectAtRest = async (page: Page): Promise<void> => {
  const speed = (): Promise<number> =>
    page.evaluate(() => {
      const { game } = (window as unknown as { __grove: { game: { vx: number; vy: number; vz: number } } }).__grove;
      return Math.hypot(game.vx, game.vy, game.vz);
    });
  await expect.poll(speed).toBe(0);
  const resting = await snapshot(page);
  await frames(page, 4);
  const later = await snapshot(page);
  expect([later.x, later.y, later.z]).toEqual([resting.x, resting.y, resting.z]);
};
