import { expect, type Page } from '@playwright/test';

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

/** Opens the game and collects anything the browser complains about. */
export const open = async (page: Page): Promise<string[]> => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  await page.goto('/');
  await expect(page.locator('#start')).toBeVisible();
  return problems;
};

export const play = async (page: Page, hero = 'Yaarbro', difficulty = 'normal'): Promise<void> => {
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
