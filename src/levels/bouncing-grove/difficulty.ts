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
  /**
   * Hearts a hero starts with. Something that hurts takes one. Running out
   * returns the hero to the last safe bank with all of them again. A fall
   * costs no heart. These are Caputo Mountain's numbers.
   */
  hearts: number;
  /**
   * Times how long a hero is protected after being hurt (1.3 seconds) and
   * after going back to a safe bank with no hearts left (1.5 seconds).
   * These too are Caputo Mountain's numbers.
   */
  protection: number;
  /**
   * How far a hit throws a hero, in metres, measured on level ground. Caputo
   * Mountain's throw is about 2 metres, which is Hard's. On footing as narrow
   * as a bough, a long throw turns one mistake into two: the heart, then a
   * fall. So Easy's is short enough that a hit on a bough rarely means a
   * fall too, and Normal's is in between.
   */
  knockback: number;
  /**
   * The enemies: the marmot scout and the giant mosquito. Each warns before
   * it attacks and rests after. These three stretch that timing. Easy's are
   * Caputo Mountain's numbers.
   *   enemyWarning   times how long a warning lasts (0.8 seconds). Longer is easier.
   *                  The warning is the tell: it stays on every difficulty, long
   *                  on Easy, noticeably shorter on Normal and brief on Hard.
   *   enemySpeed     times how fast enemies move, acorns fly and mosquitoes dive.
   *   enemyRest      times how long an enemy rests after attacking (1.35 seconds),
   *                  which is the opening to strike it or get past. Longer is easier.
   */
  enemyWarning: number;
  enemySpeed: number;
  enemyRest: number;
  /**
   * The marmot scouts on the move. On Easy both are 0: a scout hides where
   * it is, shuffles to keep its distance and only throws. Speeds are metres a
   * second; a hero walks at 6, so keep the chase under that.
   *   scoutPatrol   how fast a scout walks its beat across its bank, in plain
   *                 view, while no hero is about.
   *   scoutChase    how fast it comes after a hero it has spotted on its bank.
   *                 It stops to throw from a few metres off, runs straight at
   *                 a hero who is close, and gives up when the hero leaves.
   */
  scoutPatrol: number;
  scoutChase: number;
  /**
   * The giant mosquito over the high boughs.
   *   mosquitoFollow   how fast it keeps up with a hero under it, in metres a
   *                    second. Under 6 a running hero leaves it behind.
   *   mosquitoHover    how far above the middle of the hero it hovers. At 2.2
   *                    a full jump under it touches it; above about 3.3 it
   *                    does not, which a mosquito that keeps up needs to be fair.
   *   mosquitoPause    times how long it gets ready before a dive and rests
   *                    after one. Smaller means it dives more often.
   */
  mosquitoFollow: number;
  mosquitoHover: number;
  mosquitoPause: number;
  /**
   * Whether a line is drawn showing where an enemy's attack will go (the
   * scout's throw, the mosquito's dive) while its warning lasts. Easy only.
   * On Normal and Hard the warning is what the enemy does (the scout rears
   * up with the acorn over its shoulder, the mosquito tips nose-down with
   * its legs drawn up) and its warning sound, with nothing drawn.
   */
  enemyAimLine: boolean;
  /**
   * How many hits it takes to beat each enemy: a roll faster than a walk, a
   * pounce, or a landing on top. A hit shows as a flash and a short shove.
   * An enemy that is hurt but not beaten is at full health again whenever
   * the hero is sent back to a safe bank.
   */
  scoutHealth: number;
  mosquitoHealth: number;
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
    hearts: 5,
    protection: 1.5,
    knockback: 0.5,
    enemyWarning: 1.5,
    enemySpeed: 0.7,
    enemyRest: 1.4,
    scoutPatrol: 0,
    scoutChase: 0,
    mosquitoFollow: 1.47,
    mosquitoHover: 2.2,
    mosquitoPause: 1,
    enemyAimLine: true,
    scoutHealth: 1,
    mosquitoHealth: 1,
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
    hearts: 3,
    protection: 1,
    knockback: 1.2,
    enemyWarning: 0.7,
    enemySpeed: 1,
    enemyRest: 1,
    scoutPatrol: 1.6,
    scoutChase: 3.4,
    mosquitoFollow: 5,
    mosquitoHover: 3.4,
    mosquitoPause: 0.6,
    enemyAimLine: false,
    scoutHealth: 1,
    mosquitoHealth: 1,
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
    hearts: 2,
    protection: 0.6,
    knockback: 2,
    enemyWarning: 0.45,
    enemySpeed: 1.3,
    enemyRest: 0.7,
    scoutPatrol: 2.2,
    scoutChase: 4.6,
    mosquitoFollow: 6.5,
    mosquitoHover: 3.4,
    mosquitoPause: 0.45,
    enemyAimLine: false,
    scoutHealth: 2,
    mosquitoHealth: 1,
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
