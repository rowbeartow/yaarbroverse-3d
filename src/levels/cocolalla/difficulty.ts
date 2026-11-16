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
   * THE SHORE PATH (section 1): boulders in a line along the south shore,
   * from the pebble beach to a grassy point. A missed hop lands in the lake.
   * The same boulders, climbing, cross the cove in section 3 until the rope
   * swings are built.
   *   boulderCount    how many on the shore path.
   *   boulderRadius   how big each top is, from its middle to its edge.
   *   boulderGap      the open water between one and the next, and either end.
   */
  boulderCount: number;
  boulderRadius: number;
  boulderGap: number;
  /**
   * THE CROCODILE CROSSING (section 2): how far it is up the east channel
   * from the grassy point to the rock island. The long swim of section 5
   * comes back the same distance, so this also sets how long that is.
   */
  crossing: number;
  /**
   * THE SUNKEN LOGS (section 4): logs and boulders in turn, from the headland
   * to the gravel bar, with a zigzag of three boulders after the second log.
   * The bar is too high to climb onto from the water, so a missed jump means
   * swimming back to a log and going on from there.
   *   logCount    how many logs (three at least).
   *   logWidth    how wide each log is. Wider is easier to stay on.
   *   logGap      the open water between one piece and the next, and before the bar.
   */
  logCount: number;
  logWidth: number;
  logGap: number;
  /** THE ROCK TUNNEL (section 6): how long the way under the rocky point is. The only way on is to dive through it. */
  tunnelLength: number;
  /**
   * CATTAIL COVE and THE OLD PIER (sections 7 and 8): posts that climb out of
   * the water to the pier's landing; the boardwalk runs from there out to the
   * fishing dock. The low posts can be climbed onto from the water; the
   * landing, the boardwalk and the dock cannot.
   *   postCount    how many.
   *   postRadius   how big each top is.
   *   postGap      the open water between one and the next, and before the landing.
   *   postRise     how much higher each is than the one before, and the landing than the last.
   */
  postCount: number;
  postRadius: number;
  postGap: number;
  postRise: number;
  /**
   * THE CROCODILES, in the long swim (The Open Water, section 5). The
   * owner's rules: on Easy every one can be avoided without diving or precise
   * timing, and Normal and Hard make them a real threat.
   *   crocCount    how many.
   *   crocAside    how far to the side of the way down the lake each waits
   *                (they take turns, west then east). On Easy far enough that
   *                a hero swimming straight down never comes into its water.
   *   crocPatch    how far either side of where it waits its water reaches:
   *                a hero in that water is stalked.
   *   crocSpeed    how fast it swims after a hero. A hero swims 3.6 at the surface.
   *   crocReach    how far its lunge carries.
   *   crocWarning  times how long its tell lasts (0.9 s): its eyes sinking and the wake.
   *   crocRest     times how long it rests after a lunge (1.6 s): the opening to get past.
   *   crocHits     strikes that beat it.
   *   crocLine     whether a line shows where it will lunge, through its tell. Easy only, as with every enemy.
   */
  crocCount: number;
  crocAside: number;
  crocPatch: number;
  crocSpeed: number;
  crocReach: number;
  crocWarning: number;
  crocRest: number;
  crocHits: number;
  crocLine: boolean;
  /** Which banks are checkpoints, counted along the route: 1 the grassy point, 2 the rock island, 3 the headland, 4 the gravel bar, 5 the reed bar, 6 the cove's beach. The beach always is. */
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
    crossing: 28,
    logCount: 3, logWidth: 2.4, logGap: 1,
    tunnelLength: 4,
    postCount: 4, postRadius: 1, postGap: 0.9, postRise: 0.5,
    crocCount: 1, crocAside: 9, crocPatch: 4, crocSpeed: 1.5, crocReach: 3.5, crocWarning: 2, crocRest: 1.6, crocHits: 1, crocLine: true,
    checkpoints: [1, 2, 3, 4, 5, 6],
    hearts: 5, protection: 1.5, knockback: 0.5, coyoteTime: 0.2, ledgeHelp: 0.5,
  },
  normal: {
    boulderCount: 6, boulderRadius: 1.2, boulderGap: 1.8,
    crossing: 36,
    logCount: 3, logWidth: 1.6, logGap: 2,
    tunnelLength: 6,
    postCount: 5, postRadius: 0.75, postGap: 1.6, postRise: 0.6,
    crocCount: 1, crocAside: 0, crocPatch: 9, crocSpeed: 2.4, crocReach: 4.5, crocWarning: 1, crocRest: 1, crocHits: 1, crocLine: false,
    checkpoints: [1, 2, 3, 4, 5, 6],
    breath: 16,
    hearts: 3, protection: 1, knockback: 1.2, coyoteTime: 0.12, ledgeHelp: 0.3,
  },
  hard: {
    boulderCount: 7, boulderRadius: 0.85, boulderGap: 2.6,
    crossing: 42,
    logCount: 4, logWidth: 1, logGap: 2.8,
    tunnelLength: 9,
    postCount: 6, postRadius: 0.55, postGap: 2.3, postRise: 0.6,
    crocCount: 2, crocAside: 3, crocPatch: 10, crocSpeed: 2.9, crocReach: 5.5, crocWarning: 0.7, crocRest: 0.75, crocHits: 2, crocLine: false,
    checkpoints: [2, 4, 6],
    breath: 11,
    hearts: 2, protection: 0.6, knockback: 2, coyoteTime: 0.06, ledgeHelp: 0.15,
  },
};

export const LAKE_BLURB: Record<Difficulty, string> = {
  easy: 'Big boulders, short swims, all the breath you need',
  normal: 'The lake as it comes',
  hard: 'Narrow logs, long swims, a long dive',
};
