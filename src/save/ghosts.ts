// Where ghosts are kept: one entry in the browser's storage for each player,
// level, hero and difficulty, holding the recording of that player's best
// time. They are kept apart from the players and their bests, so a ghost that
// is damaged, or will not fit, never costs anyone their progress.
//
// Reading and writing never throw. A ghost that cannot be read is no ghost.

import type { Difficulty } from '../game/difficulty';
import { decodeGhost, encodeGhost, type Ghost } from '../game/ghost';
import type { HeroName } from '../game/hero';
import type { StorageLike } from './players';

export const GHOST_PREFIX = 'yaarbroverse-3d:ghost:';

export interface GhostSlot {
  playerId: string;
  levelId: string;
  hero: HeroName;
  difficulty: Difficulty;
}

export const ghostKey = (slot: GhostSlot): string => `${GHOST_PREFIX}${slot.playerId}:${slot.levelId}:${slot.hero}:${slot.difficulty}`;

/** Keeps a ghost, in place of the one that was there. False when it could not be kept; the old one then stays. */
export const saveGhost = (storage: StorageLike | null, slot: GhostSlot, ghost: Ghost | null): boolean => {
  try {
    const text = ghost ? encodeGhost(ghost) : null;
    if (!storage || !text) return false;
    storage.setItem(ghostKey(slot), text);
    return true;
  } catch {
    return false;
  }
};

export const loadGhost = (storage: StorageLike | null, slot: GhostSlot): Ghost | null => {
  try {
    return decodeGhost(storage?.getItem(ghostKey(slot)));
  } catch {
    return null;
  }
};

/** Removes every ghost a player has, when their progress is reset or they are taken off the device. */
export const removeGhostsOf = (storage: StorageLike | null, playerId: string): void => {
  try {
    if (!storage || typeof storage.length !== 'number' || !storage.key) return;
    const mine: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(`${GHOST_PREFIX}${playerId}:`)) mine.push(key);
    }
    for (const key of mine) storage.removeItem(key);
  } catch {
    // Blocked storage: there is nothing to remove that could be read back anyway.
  }
};
