// COCOLALLA LAKE: where everything is. Builds the level from the numbers in
// difficulty.ts. No drawing here; src/view/ turns this into shapes.
//
// The lake as reshaped in milestone nine (the owner's OK, 2026-11-16): the
// route winds round a wooded island and across the water, and the camera
// turns to follow it. Seen from above, north (-z) at the top:
//
//   1. The Shore Path: down the pebble beach, then boulder hops east along
//      the south shore to a grassy point. On screen: right.
//   2. The Crocodile Crossing: north up the east channel to a rock island.
//      (A plain swim until the crocodile stepping stones are built.) Away.
//   3. The Swinging Pines: west across a cove to a ledge on the island's
//      headland. (Boulder hops until the rope swings are built.) Left.
//   4. The Sunken Logs: logs and boulders west along the island's north
//      shore, with a zigzag out into the channel, to a gravel bar too high
//      to climb onto from the water. Left.
//   5. The Open Water: a long swim south down the middle of the lake, back
//      toward the camera, to a reed bar. The crocodiles' water.
//   6. The Rock Tunnel: west, with a dive through the passage under the
//      rocky point, to a small beach in the west cove. The camera turns west. Away.
//   7. Cattail Cove: old pier posts north up the west shore to the pier's
//      landing. Right.
//   8. The Old Pier: the boardwalk east out over the lake to the fishing
//      dock and the golden leaf. The camera turns north again. Right.
//      (The monster pike fight goes on the dock in a later milestone.)
//
// The water is seven pools, each a box. The sides of a pool hold a swimmer
// in, and a solid stands across every place where the route passes from one
// pool to the next, so nobody swims past a section: the scenery floats a log
// boom along every open pool edge. Three pools are swum across on the route;
// the others are only where a missed jump lands.
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
  beach: 'Hop along the boulders to the grassy point.',
  point: 'Swim up the channel to the rock island.',
  island: 'Hop across the cove, up to the ledge.',
  headland: 'Jump along the logs. Fall in, and swim back to one.',
  'gravel-bar': 'Swim down the lake to the reed bar. Mind the crocodiles: when eyes sink, swim out of the way or dive!',
  'reed-bar': 'Swim to the rocks and dive through the gap.',
  'cove-beach': 'Up the posts to the old pier!',
  landing: 'Along the boardwalk to the fishing dock!',
};

export const LAKE_GOAL_LINE = 'A golden leaf, at the end of the dock!';

/** Fixed sizes that do not change with difficulty. */
export const LAKE_SHAPE = {
  /** The lake's water: its surface and its floor. */
  surface: 0,
  floor: -4,
  /** Where the south shore's waterline is (z), and how far west of the beach the first pool reaches. */
  shoreZ: 5,
  westOfBeach: 3,
  /** The pebble beach at the start: from x 0 to this, and from the shore out to this z. */
  beachLength: 14,
  beachOut: -1,
  /** Shores walked out on from the water stand this high. */
  shoreTop: 0.3,
  /** The line the shore path's boulders follow (z), how far north and south of it they sit in turn, and their tops. */
  pathZ: -3,
  boulderSide: 0.6,
  boulderTop: 0.6,
  /** The grassy point: how long it is east to west, and half its width. */
  pointLength: 8,
  pointHalfWidth: 4,
  /** The east channel: how wide it is, from the wooded island's east face to the east shore. */
  channelWidth: 20,
  /** The rock island at the top of the east channel: half its size each way. */
  islandHalfX: 4.5,
  islandHalfZ: 4,
  /** The wooded island: its south face (z), how far its north face lies south of the line the logs follow, and how high it stands (too high to jump onto from anywhere). */
  woodedSouth: -10,
  woodedBack: 10,
  woodedTop: 5.2,
  /** The north channel: how far north of the logs' line the swimming stops. */
  northReach: 14,
  /** The cove's hops up to the headland: how much higher each boulder is than the last. (Until the rope swings are built.) */
  hopRise: 0.5,
  /** The headland's ledge: half its length east to west, how far north of the logs' line it reaches, and how high it stands (too high to climb onto). */
  headlandHalfX: 4.5,
  headlandNorth: 5,
  headlandTop: 2.6,
  /** The sunken logs: how long each is, its top, and how thick. The boulders between them are higher. */
  logLength: 5,
  logTop: 0.5,
  logThickness: 1,
  stepBoulderTop: 0.9,
  stepBoulderRadius: 1.1,
  /** The zigzag in the logs: which way its boulders run from the line, as a step of length 1 (west and north, then west and south). */
  zigWest: 0.57,
  zigNorth: 0.82,
  /** The gravel bar: too high to climb onto from the water. Half its width east to west. */
  gravelBarTop: 1.6,
  gravelBarHalfX: 4,
  /** The reed bar at the end of the long swim: how far west of the gravel bar its middle is, its middle (z), and half its size. */
  reedBarWest: 22,
  reedBarZ: -4,
  reedBarHalfX: 5,
  reedBarHalfZ: 3,
  /**
   * The rocky point: how far past the reed bar it begins (well past where a
   * running jump into the water lands, so a dive is needed), how far north it
   * runs from the shore, how high its top stands (too high to climb onto),
   * how low the passage's roof comes, and half the passage's width.
   */
  pointAhead: 9.5,
  rockNorth: -15,
  rockTop: 1.7,
  tunnelRoof: -1.9,
  tunnelHalfWidth: 3,
  /** The swim from the far side of the rocky point to the cove's beach, and half the beach's size. */
  afterTunnel: 6,
  coveBeachHalfX: 4,
  coveBeachHalfZ: 5,
  /** The old pier: the first post's top, how far east and west the posts sit in turn, the landing's half size, and the boardwalk's half width and length, and the dock's. */
  firstPostTop: 0.6,
  postSide: 0.5,
  landingHalf: 2.6,
  boardwalkHalfWidth: 1.2,
  boardwalkLength: 16,
  dockHalfWidth: 4,
  dockLength: 6,
  fallY: -6,
  depth: -40,
} as const;

/** Which way the camera faces through each section, in degrees seen from above (0 looks north, 270 west), and where it sits further back. */
export const LAKE_CAMERA = {
  shore: 0,
  /** Turned a little to look up the channel from over the water, not from over the island. */
  crossing: 330,
  pines: 0,
  logs: 0,
  /** The swim comes back toward the camera: it sits further back and higher, so the water ahead shows. */
  open: 0,
  openPull: 1.4,
  tunnel: 270,
  cove: 270,
  pier: 0,
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
  const section = (name: string, facing: number, pull?: number): void => {
    sections.push(pull === undefined ? { name, solids: [], facing } : { name, solids: [], facing, pull });
  };
  const add = (solid: Solid, onRoute = true): Solid => {
    solids.push(solid);
    if (onRoute) {
      route.push(solid.id);
      sections[sections.length - 1].solids.push(solid.id);
    }
    return solid;
  };
  /** A box from x `west` to `east` and z `north` to `south` (north is the smaller z). */
  const box = (id: string, kind: Solid['kind'], west: number, east: number, north: number, south: number, top: number, bottom: number = shape.depth, extra: Partial<Solid> = {}, onRoute = true): Solid =>
    add({ id, kind, shape: 'box', x: (west + east) / 2, z: (north + south) / 2, halfX: (east - west) / 2, halfZ: (south - north) / 2, top, bottom, ...extra }, onRoute);
  const round = (id: string, kind: Solid['kind'], x: number, z: number, radius: number, top: number): Solid =>
    add({ id, kind, shape: 'round', x, z, halfX: radius, halfZ: radius, top, bottom: shape.depth });
  const pool = (id: string, west: number, east: number, north: number, south: number): void => {
    water.push({ id, minX: west, maxX: east, minZ: north, maxZ: south, surface: shape.surface, floor: shape.floor });
  };
  /** Bank number `number` (the beach is 0) is a checkpoint on this difficulty. */
  const safe = (number: number): boolean => number === 0 || n.checkpoints.includes(number);

  // 1. THE SHORE PATH: east along the south shore.
  section('The Shore Path', LAKE_CAMERA.shore);
  box('beach', 'bank', 0, shape.beachLength, shape.beachOut, shape.shoreZ + 2, shape.shoreTop, shape.depth, { safe: true });
  let x = shape.beachLength;
  for (let i = 0; i < n.boulderCount; i += 1) {
    x += n.boulderGap + n.boulderRadius;
    round(`boulder-${i + 1}`, 'boulder', x, shape.pathZ + (i % 2 === 0 ? -shape.boulderSide : shape.boulderSide), n.boulderRadius, shape.boulderTop);
    x += n.boulderRadius;
  }
  x += n.boulderGap;
  // The point's west edge is where the shore's water ends and the east channel's begins.
  const channelWest = x;
  box('point', 'bank', channelWest, channelWest + shape.pointLength, shape.pathZ - shape.pointHalfWidth, shape.pathZ + shape.pointHalfWidth, shape.shoreTop, shape.depth, { safe: safe(1) });
  const channelEast = channelWest + shape.channelWidth;

  // 2. THE CROCODILE CROSSING: north up the east channel. A plain swim until the stepping stones are built.
  section('The Crocodile Crossing', LAKE_CAMERA.crossing);
  route.push('channel-water');
  /** The line the rock island, the cove's hops and the sunken logs lie along (z). */
  const lineZ = shape.pathZ - shape.pointHalfWidth - n.crossing - shape.islandHalfZ;
  const northEdge = lineZ - shape.northReach;
  // The rock island stands across the corner where the east channel meets the north one.
  box('island', 'bank', channelWest - shape.islandHalfX, channelWest + shape.islandHalfX, lineZ - shape.islandHalfZ, lineZ + shape.islandHalfZ, shape.shoreTop, shape.depth, { safe: safe(2) });

  // 3. THE SWINGING PINES: west across the cove, up to the headland's ledge. Boulder hops until the rope swings are built.
  section('The Swinging Pines', LAKE_CAMERA.pines);
  x = channelWest - shape.islandHalfX;
  const hops = Math.ceil((shape.headlandTop - shape.shoreTop) / shape.hopRise) - 1;
  for (let i = 0; i < hops; i += 1) {
    x -= n.boulderGap + n.boulderRadius;
    round(`hop-${i + 1}`, 'boulder', x, lineZ + (i % 2 === 0 ? shape.boulderSide : -shape.boulderSide), n.boulderRadius, shape.shoreTop + shape.hopRise * (i + 1));
    x -= n.boulderRadius;
  }
  x -= n.boulderGap;
  const woodedNorth = lineZ + shape.woodedBack;
  // The headland reaches from the wooded island out past the logs' line; its middle parts the cove's water from the logs'.
  const headlandX = x - shape.headlandHalfX;
  box('headland', 'crag', x - shape.headlandHalfX * 2, x, lineZ - shape.headlandNorth, woodedNorth, shape.headlandTop, shape.depth, { safe: safe(3) });
  // Behind the ledge the island's bank is a rock face, so the ledge reads as the end of the way, not a path inland.
  box('headland-back', 'crag', x - shape.headlandHalfX * 2 - 1, x + 1, woodedNorth, woodedNorth + 4, shape.woodedTop + 0.4, shape.depth, {}, false);
  x -= shape.headlandHalfX * 2;

  // 4. THE SUNKEN LOGS: west along the island's north shore, with a zigzag out into the channel.
  section('The Sunken Logs', LAKE_CAMERA.logs);
  const step = (id: string, at: number, z: number): Solid => round(id, 'boulder', at, z, shape.stepBoulderRadius, shape.stepBoulderTop);
  let steps = 0;
  for (let i = 0; i < n.logCount; i += 1) {
    x -= n.logGap;
    box(`log-${i + 1}`, 'log', x - shape.logLength, x, lineZ - n.logWidth / 2, lineZ + n.logWidth / 2, shape.logTop, shape.logTop - shape.logThickness);
    x -= shape.logLength;
    if (i === n.logCount - 1) break;
    if (i === 1) {
      // The zigzag: boulders out to the north-west and back, each a jump from the last.
      const reach = n.logGap + shape.stepBoulderRadius;
      const stride = n.logGap + shape.stepBoulderRadius * 2;
      let zx = x - reach * shape.zigWest;
      let zz = lineZ - reach * shape.zigNorth;
      step(`step-${(steps += 1)}`, zx, zz);
      zx -= stride * shape.zigWest;
      zz -= stride * shape.zigNorth;
      step(`step-${(steps += 1)}`, zx, zz);
      zx -= stride * shape.zigWest;
      zz += stride * shape.zigNorth;
      step(`step-${(steps += 1)}`, zx, zz);
      // The next log's near end is one more such jump on, back on the line.
      x = zx - reach * shape.zigWest + n.logGap;
    } else {
      x -= n.logGap + shape.stepBoulderRadius;
      step(`step-${(steps += 1)}`, x, lineZ);
      x -= shape.stepBoulderRadius;
    }
  }
  x -= n.logGap;
  // The gravel bar closes the north channel's west end; its middle parts the logs' water from the open water.
  const barX = x - shape.gravelBarHalfX;
  box('gravel-bar', 'bank', x - shape.gravelBarHalfX * 2, x, northEdge, woodedNorth, shape.gravelBarTop, shape.depth, { safe: safe(4) });
  const woodedWest = x - shape.gravelBarHalfX * 2;
  // The wooded island the route goes round. Scenery to the eye, a wall to a hero: nobody stands on it.
  box('wooded-island', 'island', woodedWest, channelWest, woodedNorth, shape.woodedSouth, shape.woodedTop, shape.depth, {}, false);

  // 5. THE OPEN WATER: south down the middle of the lake, back toward the camera.
  section('The Open Water', LAKE_CAMERA.open, LAKE_CAMERA.openPull);
  route.push('open-water');
  const reedX = woodedWest - shape.reedBarWest;
  box('reed-bar', 'bank', reedX - shape.reedBarHalfX, reedX + shape.reedBarHalfX, shape.reedBarZ - shape.reedBarHalfZ, shape.reedBarZ + shape.reedBarHalfZ, shape.shoreTop, shape.depth, { safe: safe(5) });
  // The way a swimmer takes: off the bar's west side where the logs come in, to the reed bar's north-east corner.
  const openSwim = { x0: woodedWest - 1, z0: lineZ, x1: reedX + shape.reedBarHalfX - 1, z1: shape.reedBarZ - shape.reedBarHalfZ };

  // 6. THE ROCK TUNNEL: west, under the rocky point that runs out from the south shore.
  section('The Rock Tunnel', LAKE_CAMERA.tunnel);
  route.push('tunnel-water');
  x = reedX - shape.reedBarHalfX - shape.pointAhead;
  const rockEast = x;
  const rockWest = x - n.tunnelLength;
  const tunnelNorth = shape.reedBarZ - shape.tunnelHalfWidth;
  const tunnelSouth = shape.reedBarZ + shape.tunnelHalfWidth;
  box('rock-north', 'crag', rockWest, rockEast, shape.rockNorth, tunnelNorth, shape.rockTop, shape.depth, {}, false);
  box('rock-tunnel', 'arch', rockWest, rockEast, tunnelNorth, tunnelSouth, shape.rockTop, shape.tunnelRoof, {}, false);
  box('rock-south', 'crag', rockWest, rockEast, tunnelSouth, shape.shoreZ + 2, shape.rockTop, shape.depth, {}, false);
  x = rockWest - shape.afterTunnel;
  const coveX = x - shape.coveBeachHalfX;
  box('cove-beach', 'bank', x - shape.coveBeachHalfX * 2, x, shape.reedBarZ - shape.coveBeachHalfZ, shape.reedBarZ + shape.coveBeachHalfZ, shape.shoreTop, shape.depth, { safe: safe(6) });
  const westEdge = x - shape.coveBeachHalfX * 2 - 2;

  // 7. CATTAIL COVE: the old pier's posts, north up the west shore to the pier's landing.
  section('Cattail Cove', LAKE_CAMERA.cove);
  let z = shape.reedBarZ - shape.coveBeachHalfZ;
  let postTop = shape.firstPostTop;
  for (let i = 0; i < n.postCount; i += 1) {
    z -= n.postGap + n.postRadius;
    round(`post-${i + 1}`, 'stump', coveX + (i % 2 === 0 ? 0 : shape.postSide), z, n.postRadius, postTop);
    z -= n.postRadius;
    if (i < n.postCount - 1) postTop += n.postRise;
  }
  z -= n.postGap;
  const deck = postTop + n.postRise;
  // A square landing where the pier turns: room to stand while the camera comes round.
  box('landing', 'deck', coveX - shape.landingHalf, coveX + shape.landingHalf, z - shape.landingHalf * 2, z, deck, deck - 0.4);
  const pierZ = z - shape.landingHalf;

  // 8. THE OLD PIER: the boardwalk east out over the lake, and the fishing dock.
  section('The Old Pier', LAKE_CAMERA.pier);
  x = coveX + shape.landingHalf;
  box('boardwalk', 'deck', x, x + shape.boardwalkLength, pierZ - shape.boardwalkHalfWidth, pierZ + shape.boardwalkHalfWidth, deck, deck - 0.4);
  x += shape.boardwalkLength;
  box('dock', 'deck', x, x + shape.dockLength, pierZ - shape.dockHalfWidth, pierZ + shape.dockHalfWidth, deck, deck - 0.4);
  x += shape.dockLength;

  // The water. Each pool's edge that is not shore or rock is where a log boom floats.
  pool('shore-water', -shape.westOfBeach, channelWest, shape.woodedSouth, shape.shoreZ);
  pool('channel-water', channelWest, channelEast, northEdge, shape.shoreZ);
  pool('cove-water', headlandX, channelWest, northEdge, woodedNorth);
  pool('logs-water', barX, headlandX, northEdge, woodedNorth);
  pool('open-water', reedX, barX, northEdge, shape.shoreZ);
  pool('tunnel-water', westEdge, reedX, shape.rockNorth, shape.shoreZ);
  pool('pier-water', westEdge, reedX, northEdge, shape.rockNorth);

  // The crocodiles: spread along the long swim, each `crocAside` to the side of the way down, taking turns west and east.
  const enemies: EnemySpot[] = [];
  const swimLength = Math.hypot(openSwim.x1 - openSwim.x0, openSwim.z1 - openSwim.z0);
  const along = { x: (openSwim.x1 - openSwim.x0) / swimLength, z: (openSwim.z1 - openSwim.z0) / swimLength };
  for (let i = 0; i < n.crocCount; i += 1) {
    const share = (i + 1) / (n.crocCount + 1);
    const side = i % 2 === 0 ? 1 : -1;
    // West and a little north of the way down is open lake; east of it is the wooded island.
    const cx = Math.max(reedX + 2, Math.min(woodedWest - 2, openSwim.x0 + (openSwim.x1 - openSwim.x0) * share - along.z * side * n.crocAside));
    const cz = Math.max(northEdge + 2, openSwim.z0 + (openSwim.z1 - openSwim.z0) * share + along.x * side * n.crocAside);
    // Its water reaches this far up and down the lake from where it waits: never the whole swim, so on Easy it can be passed wide.
    const half = Math.min(swimLength / (2 * n.crocCount), n.crocPatch * 1.5);
    enemies.push({
      id: `croc-open-${i + 1}`,
      kind: 'crocodile',
      x: cx,
      y: shape.surface - CROC.lurkDepth,
      z: cz,
      // Its water: inside the open water, clear of the bars at either end.
      arena: {
        minX: Math.max(reedX + 1, cx - n.crocPatch),
        maxX: Math.min(woodedWest - 1, cx + n.crocPatch),
        minZ: Math.max(northEdge + 1, cz - half),
        maxZ: Math.min(openSwim.z1 - 2, cz + half),
      },
      surface: shape.surface,
      floor: shape.floor,
    });
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
    spawn: { x: shape.beachLength / 2, y: shape.shoreTop, z: shape.shoreZ - 1 },
    leaf: { x: x - 1.5, y: deck + 1.3, z: pierZ, radius: 0.7 },
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
