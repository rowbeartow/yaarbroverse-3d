// COCOLALLA LAKE: every Easy, Normal and Hard number for this level.
//
// This is the only file to change when the lake is too easy or too hard.
// Sizes and distances are in metres, times in seconds. For scale: a hero is
// about 0.8 m wide, a running jump carries about 5 m on flat ground, a full
// jump rises about 2 m, a swimmer makes 3.6 m a second at the surface and 4.2
// underwater, and a hero climbs out onto anything up to 1.35 m above the water.
//
// After changing a number, run `npm test`. The tests play the whole lake on
// all three difficulties as each hero and fail if a change makes it impossible.

import type { Difficulty } from '../../game/difficulty';

export interface LakeNumbers {
  /**
   * THE SHORE PATH (section 1): boulders in a line across the shallows, from
   * the pebble beach to a grassy point. A missed hop lands in the lake.
   *   boulderCount    how many.
   *   boulderRadius   how big each top is, from its middle to its edge.
   *   boulderGap      the open water between one and the next, and either end.
   */
  boulderCount: number;
  boulderRadius: number;
  boulderGap: number;
  /** THE REED SHALLOWS (section 2): how far it is to swim from the grassy point to the rock island. A crocodile stretch. */
  reedSwim: number;
  /**
   * THE SUNKEN LOGS (section 3): logs and boulders in turn, from the rock
   * island to the gravel bar. The bar is too high to climb onto from the
   * water, so a missed jump means swimming back to a log and going on from there.
   *   logCount    how many logs (a boulder follows each).
   *   logWidth    how wide each log is. Wider is easier to stay on.
   *   logGap      the open water between one piece and the next, and before the bar.
   */
  logCount: number;
  logWidth: number;
  logGap: number;
  /** THE ROCK TUNNEL (section 4): how long the way under the rocky point is, front to back. The only way on is to dive through it. */
  tunnelLength: number;
  /** CATTAIL COVE (section 5): how far it is to swim from the reed bar to the first post of the old pier. A crocodile stretch. */
  coveSwim: number;
  /**
   * THE OLD PIER (section 6): posts that climb out of the water to the
   * boardwalk, which runs out to the fishing dock. The low posts can be
   * climbed onto from the water; the boardwalk and the dock cannot.
   *   postCount    how many.
   *   postRadius   how big each top is.
   *   postGap      the open water between one and the next, and before the boardwalk.
   *   postRise     how much higher each is than the one before, and the boardwalk than the last.
   */
  postCount: number;
  postRadius: number;
  postGap: number;
  postRise: number;
  /** Which banks are checkpoints, counted along the route: 1 the grassy point, 2 the rock island, 3 the gravel bar, 4 the reed bar. The beach always is. */
  checkpoints: number[];
  /** Seconds a hero can stay underwater. Left out, breath never runs out (Easy, by the owner's rule). */
  breath?: number;
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

export const LAKE_DIFFICULTY: Record<Difficulty, LakeNumbers> = {
  easy: {
    boulderCount: 5, boulderRadius: 1.6, boulderGap: 0.9,
    reedSwim: 34,
    logCount: 3, logWidth: 2.4, logGap: 1,
    tunnelLength: 4,
    coveSwim: 34,
    postCount: 4, postRadius: 1, postGap: 0.9, postRise: 0.5,
    checkpoints: [1, 2, 3, 4],
    hearts: 5, protection: 1.5, knockback: 0.5, coyoteTime: 0.2, ledgeHelp: 0.5,
  },
  normal: {
    boulderCount: 6, boulderRadius: 1.2, boulderGap: 1.8,
    reedSwim: 46,
    logCount: 3, logWidth: 1.6, logGap: 2,
    tunnelLength: 6,
    coveSwim: 48,
    postCount: 5, postRadius: 0.75, postGap: 1.6, postRise: 0.6,
    checkpoints: [1, 2, 3, 4],
    breath: 16,
    hearts: 3, protection: 1, knockback: 1.2, coyoteTime: 0.12, ledgeHelp: 0.3,
  },
  hard: {
    boulderCount: 7, boulderRadius: 0.85, boulderGap: 2.6,
    reedSwim: 52,
    logCount: 4, logWidth: 1, logGap: 2.8,
    tunnelLength: 9,
    coveSwim: 54,
    postCount: 6, postRadius: 0.55, postGap: 2.3, postRise: 0.6,
    checkpoints: [2, 4],
    breath: 11,
    hearts: 2, protection: 0.6, knockback: 2, coyoteTime: 0.06, ledgeHelp: 0.15,
  },
};

export const LAKE_BLURB: Record<Difficulty, string> = {
  easy: 'Big boulders, short swims, all the breath you need',
  normal: 'The lake as it comes',
  hard: 'Narrow logs, long swims, a long dive',
};
