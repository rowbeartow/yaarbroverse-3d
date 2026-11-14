// THE SANDBOX: every Easy, Normal and Hard number for this level.
//
// The sandbox is a tiny level for development only. It proves that a level is
// a recipe: a folder with these numbers, a layout and an entry, and nothing
// else. Players never see it; it opens only with `?level=sandbox`.
//
// Sizes and distances are in metres, times in seconds.

import type { BossNumbers } from '../../game/boss';
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
  /** Seconds a hero can stay underwater in the pool. Left out, breath never runs out (Easy, by the owner's rule). */
  breath?: number;
  /**
   * The practice boss at the end: a big marmot that proves the boss system.
   * Every number of a boss is here (`BossNumbers` in src/game/boss.ts says
   * what each does). Easy can be beaten by jumping on it at any time; on
   * Normal and Hard only a hit while it rests counts.
   */
  boss: BossNumbers;
}

/** The practice boss uses one acorn, then adds a charge when half its health is gone. */
const STAGES: BossNumbers['stages'] = [
  { from: 1, attacks: ['throw'] },
  { from: 0.5, attacks: ['charge', 'throw'] },
];

export const SANDBOX_DIFFICULTY: Record<Difficulty, SandboxNumbers> = {
  easy: {
    logWidth: 2.6, logGap: 1, mushroomRadius: 1.5, hearts: 5, protection: 1.5, knockback: 0.5, coyoteTime: 0.2, ledgeHelp: 0.5,
    boss: { health: 3, guarded: false, pause: 1.6, walkSpeed: 1.2, warning: 1.2, chargeWarning: 1.4, rest: 2.6, acorns: 1, spread: 0, acornSpeed: 6, chargeSpeed: 7, stages: STAGES, aimLine: true },
  },
  normal: {
    logWidth: 1.6, logGap: 2.2, mushroomRadius: 1.15, hearts: 3, protection: 1, knockback: 1.2, coyoteTime: 0.12, ledgeHelp: 0.3, breath: 14,
    boss: { health: 4, guarded: true, pause: 1.1, walkSpeed: 1.8, warning: 0.8, chargeWarning: 1, rest: 2, acorns: 3, spread: 16, acornSpeed: 8, chargeSpeed: 10, stages: STAGES, aimLine: false },
  },
  hard: {
    logWidth: 1, logGap: 3.4, mushroomRadius: 0.8, hearts: 2, protection: 0.6, knockback: 2, coyoteTime: 0.06, ledgeHelp: 0.15, breath: 9,
    boss: { health: 5, guarded: true, pause: 0.7, walkSpeed: 2.4, warning: 0.5, chargeWarning: 0.7, rest: 1.6, acorns: 5, spread: 14, acornSpeed: 10, chargeSpeed: 13, stages: STAGES, aimLine: false },
  },
};

export const SANDBOX_BLURB: Record<Difficulty, string> = {
  easy: 'Wide logs, a short hop',
  normal: 'The sandbox as it comes',
  hard: 'Thin logs, a long jump',
};
