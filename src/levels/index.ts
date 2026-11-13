// THE LEVEL LIST: every level in the game, in the order players see them.
//
// To add a level, make its folder, export its entry from `level.ts` there and
// add it to `LEVELS` below. `docs/adding-a-level.md` has every step. The rule
// tests (`tests/levels.test.ts`) and the bot then run over it automatically.

import type { LevelEntry } from './entry';
import { BOUNCING_GROVE } from './bouncing-grove/level';
import { SANDBOX } from './sandbox/level';

export type { LevelEntry, SceneryName } from './entry';

export const LEVELS: readonly LevelEntry[] = [BOUNCING_GROVE, SANDBOX];

/** The levels players are shown. Development levels are left out. */
export const listedLevels = (): LevelEntry[] => LEVELS.filter((level) => !level.devOnly);

export const findLevel = (id: unknown): LevelEntry | null => LEVELS.find((level) => level.id === id) ?? null;

/**
 * The level asked for on the address (`?level=sandbox`), or null when the
 * address names none or one that does not exist. This is the only way into a
 * development level.
 */
export const levelFromAddress = (search: string): LevelEntry | null =>
  findLevel(new URLSearchParams(search).get('level'));

/**
 * The cards on the level picker for this address: the levels players are
 * shown, plus a development level when the address names one.
 */
export const shownLevels = (search: string): LevelEntry[] => {
  const asked = levelFromAddress(search);
  return asked?.devOnly ? [...listedLevels(), asked] : listedLevels();
};
