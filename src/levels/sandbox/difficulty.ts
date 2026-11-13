// THE SANDBOX: every Easy, Normal and Hard number for this level.
//
// The sandbox is a tiny level for development only. It proves that a level is
// a recipe: a folder with these numbers, a layout and an entry, and nothing
// else. Players never see it; it opens only with `?level=sandbox`.
//
// Sizes and distances are in metres, times in seconds.

import type { Difficulty } from '../../game/difficulty';

export interface SandboxNumbers {
  /** How wide the two logs are. */
  logWidth: number;
  /** The break between the two logs. */
  logGap: number;
  /** How big the mushroom cap is, from its middle to its edge. */
  mushroomRadius: number;
  /** Hearts a hero starts with. */
  hearts: number;
  /** Times how long a hero is protected after being hurt. */
  protection: number;
  /** How far a hit throws a hero. */
  knockback: number;
  /** After walking off an edge, Jump still works for this long. */
  coyoteTime: number;
  /** Feet this far below a ledge still get lifted onto it. */
  ledgeHelp: number;
}

export const SANDBOX_DIFFICULTY: Record<Difficulty, SandboxNumbers> = {
  easy: { logWidth: 2.6, logGap: 1, mushroomRadius: 1.5, hearts: 5, protection: 1.5, knockback: 0.5, coyoteTime: 0.2, ledgeHelp: 0.5 },
  normal: { logWidth: 1.6, logGap: 2.2, mushroomRadius: 1.15, hearts: 3, protection: 1, knockback: 1.2, coyoteTime: 0.12, ledgeHelp: 0.3 },
  hard: { logWidth: 1, logGap: 3.4, mushroomRadius: 0.8, hearts: 2, protection: 0.6, knockback: 2, coyoteTime: 0.06, ledgeHelp: 0.15 },
};

export const SANDBOX_BLURB: Record<Difficulty, string> = {
  easy: 'Wide logs, a short hop',
  normal: 'The sandbox as it comes',
  hard: 'Thin logs, a long jump',
};
