// COCOLALLA LAKE: where everything is. Builds the level from the numbers in
// difficulty.ts. No drawing here; src/view/ turns this into shapes.
//
// The run, start to the fishing dock, as the owner approved it (2026-11-15):
//   1. The Shore Path: from the pebble beach, boulder hops across the
//      shallows to a grassy point.
//   2. The Reed Shallows: a swim past the reed beds to a rock island. A
//      crocodile stretch.
//   3. The Sunken Logs: logs and boulders in turn to a gravel bar too high to
//      climb onto from the water. A missed jump lands in the lake.
//   4. The Rock Tunnel: a rocky point runs right across the lake. The way on
//      is a dive through the passage under it, to a reed bar.
//   5. Cattail Cove: a long swim to the old pier. The second crocodile stretch.
//   The crocodiles' numbers (how many, where, how fast) are `croc*` in difficulty.ts.
//   6. The Old Pier: posts climb out of the water to the boardwalk, which
//      runs out to the fishing dock. The golden leaf is at the dock's end.
//      (The monster pike fight goes on the dock in milestone nine.)
//
// The lake is three pools side by side, each running the full width of the
// lake: the gravel bar and the reed bar, which also run the full width, part
// them. The sides of a pool hold a swimmer in, so the lake's edges are where
// the scenery draws the shore and the log boom.
//
// Heights: the lake's surface is at 0. A shore no higher than 0.35 is walked
// out on from the water; anything up to 1.35 is climbed onto; higher than
// that can only be jumped onto.

import { CROC } from '../../game/crocodile';
import type { Difficulty } from '../../game/difficulty';
import type { EnemySpot } from '../../game/enemy';
import type { Level, Section, Solid } from '../../game/level';
import type { Water } from '../../game/swim';
import { LAKE_DIFFICULTY, type LakeNumbers } from './difficulty';

export const LAKE_NAME = 'Cocolalla Lake';

/** Short prompts, each shown the first time the hero stands on that part of the lake. */
export const LAKE_HINTS: Record<string, string> = {
  beach: 'Hop across the boulders.',
  point: 'Swim out to the rock island. Mind the crocodile: when its eyes sink, swim out of its way or dive!',
  island: 'Jump along the logs. Fall in, and swim back to one.',
  'gravel-bar': 'Swim to the rocks and dive through the gap.',
  'reed-bar': 'Swim across the cove to the old pier. Watch for crocodiles!',
  'post-1': 'Up the posts to the fishing dock!',
};

export const LAKE_GOAL_LINE = 'A golden leaf, at the end of the dock!';

/** Fixed sizes that do not change with difficulty. */
export const LAKE_SHAPE = {
  /** The lake's water: its surface, its floor, and how far it reaches each side of the middle. */
  surface: 0,
  floor: -4,
  halfWidth: 18,
  /** The pebble beach at the start: how far behind and ahead of the start it reaches, and half its width. The lake is either side of it. */
  beachBehind: 6,
  beachAhead: 14,
  beachHalfWidth: 7,
  /** Shores walked out on from the water stand this high. */
  shoreTop: 0.3,
  /** The grassy point at the end of the shore path, and the rock island: half their width, and their length. */
  pointHalfWidth: 5,
  pointLength: 8,
  islandHalfWidth: 5,
  islandLength: 8,
  islandSide: 2,
  /** Boulder tops, and how far left and right of the middle they sit in turn. */
  boulderTop: 0.6,
  boulderSide: 0.6,
  /** The sunken logs: how long each is, its top, and how thick. The boulders between them are higher. */
  logLength: 5,
  logTop: 0.5,
  logThickness: 1,
  stepBoulderTop: 0.9,
  stepBoulderRadius: 1.1,
  /** The gravel bar: too high to climb onto from the water. How long it is. */
  gravelBarTop: 1.6,
  gravelBarLength: 6,
  /**
   * The rocky point: how far past the gravel bar it begins (well past where a
   * running jump into the water lands, so a dive is needed), how high its
   * top stands (too high to climb onto), how low the passage's roof comes,
   * and how wide the passage is.
   */
  pointAhead: 9.5,
  rockTop: 1.7,
  tunnelRoof: -1.9,
  tunnelHalfWidth: 3,
  /** The swim from the far side of the rocky point to the reed bar, and the reed bar's length. */
  afterTunnel: 6,
  reedBarLength: 5,
  /** The old pier: the first post's top, the boardwalk's half width and length, and the dock's. */
  firstPostTop: 0.6,
  postSide: 0.5,
  boardwalkHalfWidth: 1.2,
  boardwalkLength: 16,
  dockHalfWidth: 4,
  dockLength: 6,
  /** Water beyond the dock, before the far edge of the last pool. */
  pastDock: 6,
  fallY: -6,
  depth: -40,
} as const;

/**
 * Builds the lake for one difficulty. `numbers` is only passed by tests that
 * try out other values; the game always uses the ones in difficulty.ts.
 */
export function buildLake(difficulty: Difficulty, numbers: LakeNumbers = LAKE_DIFFICULTY[difficulty]): Level {
  const n = numbers;
  const shape = LAKE_SHAPE;
  const solids: Solid[] = [];
  const route: string[] = [];
  const sections: Section[] = [];
  const water: Water[] = [];
  const section = (name: string): void => {
    sections.push({ name, solids: [] });
  };
  const add = (solid: Solid, onRoute = true): Solid => {
    solids.push(solid);
    if (onRoute) {
      route.push(solid.id);
      sections[sections.length - 1].solids.push(solid.id);
    }
    return solid;
  };
  // `from` and `to` count metres travelled away from the camera, which is -z in the world.
  const box = (id: string, kind: Solid['kind'], from: number, to: number, x: number, halfX: number, top: number, bottom: number = shape.depth, extra: Partial<Solid> = {}, onRoute = true): Solid =>
    add({ id, kind, shape: 'box', x, z: -(from + to) / 2, halfX, halfZ: (to - from) / 2, top, bottom, ...extra }, onRoute);
  const round = (id: string, kind: Solid['kind'], at: number, x: number, radius: number, top: number): Solid =>
    add({ id, kind, shape: 'round', x, z: -at, halfX: radius, halfZ: radius, top, bottom: shape.depth });
  /** A pool the full width of the lake, from `from` to `to` along the route. */
  const pool = (id: string, from: number, to: number): void => {
    water.push({ id, minX: -shape.halfWidth, maxX: shape.halfWidth, minZ: -to, maxZ: -from, surface: shape.surface, floor: shape.floor });
  };
  /** Bank number `number` (the beach is 0) is a checkpoint on this difficulty. */
  const safe = (number: number): boolean => number === 0 || n.checkpoints.includes(number);

  // 1. THE SHORE PATH
  section('The Shore Path');
  box('beach', 'bank', -shape.beachBehind, shape.beachAhead, 0, shape.beachHalfWidth, shape.shoreTop, shape.depth, { safe: true });
  let at = shape.beachAhead;
  // The first pool reaches back past the beach, so stepping off either side of it is a swim.
  const firstPool = -shape.beachBehind - 4;
  for (let i = 0; i < n.boulderCount; i += 1) {
    at += n.boulderGap + n.boulderRadius;
    round(`boulder-${i + 1}`, 'boulder', at, i % 2 === 0 ? -shape.boulderSide : shape.boulderSide, n.boulderRadius, shape.boulderTop);
    at += n.boulderRadius;
  }
  at += n.boulderGap;
  box('point', 'bank', at, at + shape.pointLength, 0, shape.pointHalfWidth, shape.shoreTop, shape.depth, { safe: safe(1) });
  at += shape.pointLength;

  // 2. THE REED SHALLOWS: swim to the rock island.
  section('The Reed Shallows');
  route.push('reed-water');
  const reedSwim = { from: at, to: at + n.reedSwim, x0: 0, x1: shape.islandSide };
  at += n.reedSwim;
  box('island', 'bank', at, at + shape.islandLength, shape.islandSide, shape.islandHalfWidth, shape.shoreTop, shape.depth, { safe: safe(2) });
  at += shape.islandLength;

  // 3. THE SUNKEN LOGS: a log, a boulder, and again, up to the gravel bar.
  section('The Sunken Logs');
  for (let i = 0; i < n.logCount; i += 1) {
    at += n.logGap;
    box(`log-${i + 1}`, 'log', at, at + shape.logLength, shape.islandSide, n.logWidth / 2, shape.logTop, shape.logTop - shape.logThickness);
    at += shape.logLength + n.logGap;
    round(`step-${i + 1}`, 'boulder', at + shape.stepBoulderRadius, shape.islandSide, shape.stepBoulderRadius, shape.stepBoulderTop);
    at += shape.stepBoulderRadius * 2;
  }
  at += n.logGap;
  const gravelBar = at;
  box('gravel-bar', 'bank', at, at + shape.gravelBarLength, 0, shape.halfWidth, shape.gravelBarTop, shape.depth, { safe: safe(3) });
  pool('reed-water', firstPool, at + shape.gravelBarLength / 2);
  at += shape.gravelBarLength;

  // 4. THE ROCK TUNNEL: the rocky point runs right across the lake, with deep water under its middle.
  section('The Rock Tunnel');
  route.push('point-water');
  const secondPool = gravelBar + shape.gravelBarLength / 2;
  at += shape.pointAhead;
  const rockFrom = at;
  const rockTo = at + n.tunnelLength;
  const sideHalf = (shape.halfWidth - shape.tunnelHalfWidth) / 2;
  box('rock-left', 'crag', rockFrom, rockTo, -shape.tunnelHalfWidth - sideHalf, sideHalf, shape.rockTop, shape.depth, {}, false);
  box('rock-tunnel', 'arch', rockFrom, rockTo, 0, shape.tunnelHalfWidth, shape.rockTop, shape.tunnelRoof, {}, false);
  box('rock-right', 'crag', rockFrom, rockTo, shape.tunnelHalfWidth + sideHalf, sideHalf, shape.rockTop, shape.depth, {}, false);
  at = rockTo + shape.afterTunnel;
  const reedBar = at;
  box('reed-bar', 'bank', at, at + shape.reedBarLength, 0, shape.halfWidth, shape.shoreTop, shape.depth, { safe: safe(4) });
  pool('point-water', secondPool, at + shape.reedBarLength / 2);
  at += shape.reedBarLength;

  // 5. CATTAIL COVE: swim to the first post of the old pier.
  section('Cattail Cove');
  route.push('cove-water');
  const thirdPool = reedBar + shape.reedBarLength / 2;
  const coveSwim = { from: at, to: at + n.coveSwim, x0: 0, x1: 0 };
  at += n.coveSwim;
  let postTop = shape.firstPostTop;
  for (let i = 0; i < n.postCount; i += 1) {
    // The first post ends the cove; the rest are the start of the pier.
    if (i === 1) section('The Old Pier');
    if (i > 0) at += n.postGap;
    round(`post-${i + 1}`, 'stump', at + n.postRadius, i % 2 === 0 ? 0 : shape.postSide, n.postRadius, postTop);
    at += n.postRadius * 2;
    if (i < n.postCount - 1) postTop += n.postRise;
  }

  // 6. THE OLD PIER: the boardwalk and the fishing dock.
  at += n.postGap;
  const deck = postTop + n.postRise;
  box('boardwalk', 'deck', at, at + shape.boardwalkLength, 0, shape.boardwalkHalfWidth, deck, deck - 0.4);
  at += shape.boardwalkLength;
  box('dock', 'deck', at, at + shape.dockLength, 0, shape.dockHalfWidth, deck, deck - 0.4);
  at += shape.dockLength;
  pool('cove-water', thirdPool, at + shape.pastDock);

  // The crocodiles: spread along each long swim, taking turns right and left of the way across.
  const enemies: EnemySpot[] = [];
  for (const [name, swim] of [['reed', reedSwim], ['cove', coveSwim]] as const) {
    const length = swim.to - swim.from;
    for (let i = 0; i < n.crocCount; i += 1) {
      const along = swim.from + (length * (i + 1)) / (n.crocCount + 1);
      const share = (along - swim.from) / length;
      const side = i % 2 === 0 ? 1 : -1;
      const x = swim.x0 + (swim.x1 - swim.x0) * share + side * n.crocAside;
      // Its water: across, inside the lake; along, inside the swim, clear of the shores at either end.
      const half = length / (2 * n.crocCount);
      enemies.push({
        id: `croc-${name}-${i + 1}`,
        kind: 'crocodile',
        x,
        y: shape.surface - CROC.lurkDepth,
        z: -along,
        arena: {
          minX: Math.max(-shape.halfWidth + 1, x - n.crocPatch),
          maxX: Math.min(shape.halfWidth - 1, x + n.crocPatch),
          minZ: -Math.min(swim.to - 2, along + half),
          maxZ: -Math.max(swim.from + 2, along - half),
        },
        surface: shape.surface,
        floor: shape.floor,
      });
    }
  }

  return {
    name: LAKE_NAME,
    enemies,
    enemyTuning: {
      warning: n.crocWarning,
      speed: 1,
      rest: n.crocRest,
      aimLine: n.crocLine,
      crocSpeed: n.crocSpeed,
      crocReach: n.crocReach,
      crocHits: n.crocHits,
    },
    solids,
    spawn: { x: 0, y: shape.shoreTop, z: 0 },
    leaf: { x: 0, y: deck + 1.3, z: -(at - 1.5), radius: 0.7 },
    water,
    breath: n.breath,
    fallY: shape.fallY,
    coyoteTime: n.coyoteTime,
    ledgeHelp: n.ledgeHelp,
    hearts: n.hearts,
    protection: n.protection,
    knockback: n.knockback,
    route,
    sections,
    hints: LAKE_HINTS,
    goalLine: LAKE_GOAL_LINE,
  };
}
