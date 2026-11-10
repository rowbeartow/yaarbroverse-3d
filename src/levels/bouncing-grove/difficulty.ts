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
  /** The break in the first log that you jump across. */
  logGap: number;
  /** How many tree stumps to hop across. */
  stumpCount: number;
  /** How big each stump top is, measured from its middle to its edge. */
  stumpRadius: number;
  /** The open air between one stump and the next. */
  stumpGap: number;
  /** How much higher each stump is than the one before it. */
  stumpRise: number;
  /** How big each mushroom cap is, measured from its middle to its edge. */
  mushroomRadius: number;
  /** The open air on each side of the mushrooms near the end. */
  mushroomGap: number;
  /** How many mushrooms in a row you bounce across to reach the leaf (1 to 3). */
  mushroomChain: number;
  /**
   * How many of the three mossy banks are safe. A fall returns you to the last
   * safe bank you stood on. 3 means every bank; 1 means only the first.
   */
  safeBanks: number;
  /** After walking off an edge, Jump still works for this long. */
  coyoteTime: number;
  /** Feet this far below a ledge still get lifted onto it. */
  ledgeHelp: number;
}

export const GROVE_DIFFICULTY: Record<Difficulty, GroveNumbers> = {
  easy: {
    logWidth: 2.6,
    logGap: 1.4,
    stumpCount: 3,
    stumpRadius: 1.5,
    stumpGap: 1.2,
    stumpRise: 0.25,
    mushroomRadius: 1.5,
    mushroomGap: 0.8,
    mushroomChain: 1,
    safeBanks: 3,
    coyoteTime: 0.2,
    ledgeHelp: 0.5,
  },
  normal: {
    logWidth: 1.6,
    logGap: 2.4,
    stumpCount: 4,
    stumpRadius: 1.1,
    stumpGap: 2.0,
    stumpRise: 0.4,
    mushroomRadius: 1.15,
    mushroomGap: 1.6,
    mushroomChain: 2,
    safeBanks: 3,
    coyoteTime: 0.12,
    ledgeHelp: 0.3,
  },
  hard: {
    logWidth: 1.0,
    logGap: 3.6,
    stumpCount: 5,
    stumpRadius: 0.75,
    stumpGap: 3.0,
    stumpRise: 0.5,
    mushroomRadius: 0.8,
    mushroomGap: 2.6,
    mushroomChain: 3,
    safeBanks: 1,
    coyoteTime: 0.06,
    ledgeHelp: 0.15,
  },
};

/** One short line per difficulty for the start screen. */
export const GROVE_BLURB: Record<Difficulty, string> = {
  easy: 'Wide logs, short hops, every mossy bank is safe',
  normal: 'The grove as it comes',
  hard: 'Thin logs, long jumps, only the first bank is safe',
};
