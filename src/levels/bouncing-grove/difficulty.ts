// THE BOUNCING GROVE: every Easy, Normal and Hard number for this level.
//
// This is the only file to change when the level is too easy or too hard.
// Sizes and distances are in metres, times in seconds. For scale: a hero is
// about 0.8 m wide, a running jump carries about 5 m on flat ground, and a full
// jump rises about 2 m.
//
// After changing a number, run `npm test`. The tests play the whole level on
// all three difficulties and fail if a change makes one impossible to finish.

import type { Difficulty } from '../../game/difficulty';

export interface GroveNumbers {
  /** How wide the fallen logs are. Wider is easier to stay on. */
  logWidth: number;
  /** How many logs lie end to end at the start. There is a break between each pair. */
  logCount: number;
  /** The first break: a short hop, so the first jump of the level is a gentle one. */
  firstLogGap: number;
  /** Every break after the first. */
  logGap: number;
  /** How many tree stumps to hop across. */
  stumpCount: number;
  /** How big each stump top is, measured from its middle to its edge. */
  stumpRadius: number;
  /** The open air between one stump and the next. */
  stumpGap: number;
  /** How much higher each stump is than the one before it. */
  stumpRise: number;
  /** How many root shelves step down into the ravine. One fewer climb out the far side. */
  shelfCount: number;
  /** How big each root shelf is, side to side and front to back. */
  shelfSize: number;
  /** The open air between one shelf and the next, measured along the route. */
  shelfGap: number;
  /** How much lower (going down) or higher (climbing out) each shelf is than the one before. */
  shelfStep: number;
  /** How big each mushroom cap is, measured from its middle to its edge. */
  mushroomRadius: number;
  /** The open air on each side of the mushrooms near the end. */
  mushroomGap: number;
  /** How many mushrooms in a row you bounce across to reach the high ledge. */
  mushroomChain: number;
  /** How wide the high boughs are. */
  boughWidth: number;
  /** The open air at a corner of the high boughs, where one bough ends and the next begins. */
  boughGap: number;
  /** How many of the four corners have a gap. At the others the boughs touch. */
  boughGapCount: number;
  /** How many tall snags to hop across on the last climb. */
  snagCount: number;
  /** How many mushrooms in a row you bounce across to reach the bough with the leaf. */
  climbMushrooms: number;
  /**
   * Which mossy banks are checkpoints, counting the banks after the first one
   * (which is always safe). A fall returns you to the last safe bank you stood
   * on. A bank left out of the list is bare stone.
   */
  checkpoints: readonly number[];
  /** After walking off an edge, Jump still works for this long. */
  coyoteTime: number;
  /** Feet this far below a ledge still get lifted onto it. */
  ledgeHelp: number;
}

export const GROVE_DIFFICULTY: Record<Difficulty, GroveNumbers> = {
  easy: {
    logWidth: 2.6,
    logCount: 3,
    firstLogGap: 0.8,
    logGap: 1.4,
    stumpCount: 4,
    stumpRadius: 1.5,
    stumpGap: 1.2,
    stumpRise: 0.25,
    shelfCount: 2,
    shelfSize: 3.2,
    shelfGap: 0.4,
    shelfStep: 0.4,
    mushroomRadius: 1.5,
    mushroomGap: 0.8,
    mushroomChain: 1,
    boughWidth: 2.4,
    boughGap: 1.2,
    boughGapCount: 1,
    snagCount: 2,
    climbMushrooms: 1,
    checkpoints: [1, 2, 3, 4, 5],
    coyoteTime: 0.2,
    ledgeHelp: 0.5,
  },
  normal: {
    logWidth: 1.6,
    logCount: 5,
    firstLogGap: 1.2,
    logGap: 2.4,
    stumpCount: 7,
    stumpRadius: 1.1,
    stumpGap: 2.0,
    stumpRise: 0.4,
    shelfCount: 3,
    shelfSize: 2.6,
    shelfGap: 1.6,
    shelfStep: 0.8,
    mushroomRadius: 1.15,
    mushroomGap: 1.6,
    mushroomChain: 4,
    boughWidth: 1.6,
    boughGap: 2.0,
    boughGapCount: 4,
    snagCount: 4,
    climbMushrooms: 3,
    checkpoints: [1, 2, 3, 4, 5],
    coyoteTime: 0.12,
    ledgeHelp: 0.3,
  },
  hard: {
    logWidth: 1.0,
    logCount: 6,
    firstLogGap: 1.8,
    logGap: 3.6,
    stumpCount: 8,
    stumpRadius: 0.75,
    stumpGap: 3.0,
    stumpRise: 0.5,
    shelfCount: 3,
    shelfSize: 1.8,
    shelfGap: 2.6,
    shelfStep: 1.2,
    mushroomRadius: 0.8,
    mushroomGap: 2.6,
    mushroomChain: 5,
    boughWidth: 1.0,
    boughGap: 3.0,
    boughGapCount: 4,
    snagCount: 5,
    climbMushrooms: 4,
    checkpoints: [2, 4],
    coyoteTime: 0.06,
    ledgeHelp: 0.15,
  },
};

/** One short line per difficulty for the start screen. */
export const GROVE_BLURB: Record<Difficulty, string> = {
  easy: 'Wide logs, short hops, every mossy bank is safe',
  normal: 'The grove as it comes',
  hard: 'Thin logs, long jumps, few safe banks',
};
