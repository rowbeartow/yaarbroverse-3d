// COCOLALLA LAKE: where everything is. Builds the level from the numbers in
// difficulty.ts. No drawing here; src/view/ turns this into shapes.
//
// The lake as reshaped in milestone nine (the owner's OK, 2026-11-16): the
// route winds round a wooded island and across the water, and the camera
// turns to follow it. Seen from above, north (-z) at the top:
//
//   1. The Shore Path: down the pebble beach, then boulder hops east along
//      the south shore to a grassy point. The camera looks east along them. Away.
//   2. The Crocodile Crossing: north up the east channel on the backs of
//      crocodiles that surface as the hero comes, with a rock half way, to a
//      rock island. Away.
//   3. The Swinging Pines: two rope swings west across a cove, to a rock
//      stack and then up to a ledge on the island's headland. Left.
//   4. The Sunken Logs: logs and boulders west along the island's north
//      shore, with a zigzag out into the channel, to a gravel bar too high
//      to climb onto from the water. Left.
//   5. The Open Water: a long swim south down the middle of the lake, back
//      toward the camera, to a reed bar. The crocodiles' water: on Normal and
//      Hard they hunt a swimmer anywhere in it.
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
// boom along every open pool edge. Two pools are swum across on the route;
// the others are only where a missed jump lands.
//
// Heights: the lake's surface is at 0. A shore no higher than 0.35 is walked
// out on from the water; anything up to 1.35 is climbed onto; higher than
// that can only be jumped onto.

import { COLLECT, type Pickup } from '../../game/collect';
import { CROC } from '../../game/crocodile';
import type { Difficulty } from '../../game/difficulty';
import type { EnemySpot } from '../../game/enemy';
import type { Level, Section, Solid } from '../../game/level';
import type { Rope } from '../../game/rope';
import type { Water } from '../../game/swim';
import { LAKE_DIFFICULTY, type LakeNumbers } from './difficulty';

export const LAKE_NAME = 'Cocolalla Lake';

/** Short prompts, each shown the first time the hero stands on that part of the lake. */
export const LAKE_HINTS: Record<string, string> = {
  beach: 'Hop along the boulders to the grassy point.',
  point: 'Watch the crocodiles come up one after another, and step as each one rises!',
  'mid-rock': 'Half way. On you go!',
  island: 'Jump at the rope and swing across. Press Jump to let go!',
  stack: 'Swing again, and let go near the top to reach the ledge.',
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
  /** The rock island at the top of the east channel: half its size each way, how high it stands (too high to climb onto from the water), and how far its low step reaches out on the cove side. */
  islandHalfX: 4.5,
  islandHalfZ: 4,
  islandTop: 1.6,
  stepOut: 2.4,
  /**
   * The crocodile stepping stones: how far in from the channel's west side
   * their line runs, how far left and right of it they lie in turn, half the
   * size of a back (along the crocodile, and across it: the footing is the
   * whole crocodile as drawn, head to tail, and src/view/croc-stones.ts
   * draws it to this size), how high a back
   * floats, how near a hero must come to a row's first crocodile to wake the
   * row, and how long one takes to come up.
   */
  crossIn: 3.2,
  stoneSide: 0.5,
  stoneHalfX: 2.3,
  stoneHalfZ: 0.75,
  stoneTop: 0.4,
  /** How deep a crocodile's body reaches under its back: shallow enough to swim under. */
  stoneThickness: 0.55,
  stoneWake: 9,
  stoneRise: 0.45,
  /** How far a back dips under a hero's weight. */
  stoneDip: 0.12,
  /** The rock half way across, where a hero who fell in can climb out and go on. */
  midRockRadius: 1.6,
  /** The wooded island: its south face (z), how far its north face lies south of the line the logs follow, and how high it stands (too high to jump onto from anywhere). */
  woodedSouth: -10,
  woodedBack: 10,
  woodedTop: 5.2,
  /** The north channel: how far north of the logs' line the swimming stops. */
  northReach: 14,
  /**
   * The rope swings across the cove: how long each rope is, how far past the
   * edge before it it hangs, how high its end hangs over that edge's top (a
   * jump reaches it), and how far north of the line the snag that holds it stands.
   */
  ropeLength: 7,
  ropeOut: 3,
  ropeAbove: 2.3,
  snagBack: 3,
  /** The rock stack between the two ropes: how far past the first rope its middle is, and its top (it can be climbed onto from the water). */
  stackAhead: 6.5,
  stackTop: 1.2,
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
  /** East along the boulders, so up on the keys runs along them. It turns north on the grassy point, a roomy bank, never on a boulder or a crocodile (the owner's word, 2026-11-16). */
  shore: 90,
  /**
   * Straight up the rows of crocodiles, so up on the keys runs along them. A
   * precise stretch lines the camera up with the way across: a keyboard has
   * only eight directions (the owner's rule, 2026-11-16).
   */
  crossing: 0,
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

  // 2. THE CROCODILE CROSSING: north up the east channel on the backs of crocodiles, with a rock half way.
  section('The Crocodile Crossing', LAKE_CAMERA.crossing);
  /** The line the rock island, the cove's ropes and the sunken logs lie along (z). */
  const lineZ = shape.pathZ - shape.pointHalfWidth - n.crossing - shape.islandHalfZ;
  const northEdge = lineZ - shape.northReach;
  const crossX = channelWest + shape.crossIn;
  {
    // As many crocodiles as fit the crossing at about `stoneGap` apart, in two rows with the rock between.
    const from = shape.pathZ - shape.pointHalfWidth;
    const span = n.crossing - shape.midRockRadius * 2;
    const count = Math.max(2, Math.floor((span - n.stoneGap) / (shape.stoneHalfZ * 2 + n.stoneGap)));
    const gap = (span - count * shape.stoneHalfZ * 2) / (count + 2);
    const first = Math.ceil(count / 2);
    let z = from;
    /** The first crocodile of the row being laid, and how far along its row this one is. */
    let row = { x: 0, z: 0 };
    let rowFirst = '';
    let along = 0;
    for (let i = 0; i < count; i += 1) {
      if (i === first) {
        z -= gap + shape.midRockRadius;
        round('mid-rock', 'boulder', crossX, z, shape.midRockRadius, shape.boulderTop);
        z -= shape.midRockRadius;
      }
      z -= gap + shape.stoneHalfZ;
      const x = crossX + (i % 2 === 0 ? -shape.stoneSide : shape.stoneSide);
      if (i === 0 || i === first) {
        row = { x, z };
        rowFirst = `stone-${i + 1}`;
        along = 0;
      }
      add({
        id: `stone-${i + 1}`, kind: 'log', shape: 'box', x, z, halfX: shape.stoneHalfX, halfZ: shape.stoneHalfZ,
        top: shape.stoneTop, bottom: shape.stoneTop - shape.stoneThickness,
        motion: {
          kind: 'float', wake: shape.stoneWake, from: row, delay: along * n.stoneStagger, rise: shape.stoneRise,
          up: n.stoneUp, period: n.stonePeriod ?? Infinity, tell: n.stoneTell, dip: shape.stoneDip, snap: n.stoneSnap ?? Infinity,
          ...(n.stoneWait ? { waitFor: rowFirst } : {}),
        },
      });
      along += 1;
      z -= shape.stoneHalfZ;
    }
  }
  // The rock island stands across the corner where the east channel meets the north one, too high to climb onto from the water:
  // the way onto it is the last crocodile's back.
  box('island', 'bank', channelWest - shape.islandHalfX, channelWest + shape.islandHalfX, lineZ - shape.islandHalfZ, lineZ + shape.islandHalfZ, shape.islandTop, shape.depth, { safe: safe(2) });
  // A low step on its cove side, clear of the run-up to the rope: the way back up for a hero who misses a swing.
  box('island-step', 'bank', channelWest - shape.islandHalfX - shape.stepOut, channelWest - shape.islandHalfX, lineZ + 1.2, lineZ + shape.islandHalfZ, shape.shoreTop, shape.depth, {}, false);

  // 3. THE SWINGING PINES: west across the cove on two ropes, to a rock stack and then up to the headland's ledge.
  section('The Swinging Pines', LAKE_CAMERA.pines);
  x = channelWest - shape.islandHalfX;
  const ropes: Rope[] = [];
  /** Hangs a rope `ropeOut` past the edge at `x`, its end a jump's height over a bank whose top is `top`. */
  const rope = (id: string, top: number, to: string): number => {
    const at = x - shape.ropeOut;
    ropes.push({ id, x: at, y: top + shape.ropeAbove + shape.ropeLength, z: lineZ, length: shape.ropeLength, ahead: { x: -1, z: 0 }, to, foot: { x: at + 0.6, z: lineZ - shape.snagBack } });
    route.push(id);
    return at;
  };
  x = rope('rope-1', shape.islandTop, 'stack') - shape.stackAhead;
  round('stack', 'boulder', x, lineZ, n.stackRadius, shape.stackTop);
  x -= n.stackRadius;
  x = rope('rope-2', shape.stackTop, 'headland') - n.ledgeAhead;
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
    // Its water reaches this far up and down the lake from where it waits. One that hunts has all the open water;
    // one that does not never has the whole swim, so on Easy it can be passed wide.
    const half = n.crocHunt ? swimLength : Math.min(swimLength / (2 * n.crocCount), n.crocPatch * 1.5);
    enemies.push({
      id: `croc-open-${i + 1}`,
      kind: 'crocodile',
      x: cx,
      y: shape.surface - CROC.lurkDepth,
      z: cz,
      // Its water: inside the open water, clear of the bars at either end.
      arena: {
        minX: Math.max(reedX + 1, cx - (n.crocHunt ? swimLength : n.crocPatch)),
        maxX: Math.min(woodedWest - 1, cx + (n.crocHunt ? swimLength : n.crocPatch)),
        minZ: Math.max(northEdge + 1, cz - half),
        maxZ: Math.min(openSwim.z1 - 2, cz + half),
      },
      surface: shape.surface,
      floor: shape.floor,
    });
  }

  // On Hard one more waits under the sunken logs, for anyone who falls in: it hunts all of the logs' water.
  if (n.crocUnderLogs) {
    const cx = (barX + headlandX) / 2;
    enemies.push({
      id: 'croc-logs',
      kind: 'crocodile',
      x: cx,
      y: shape.surface - CROC.lurkDepth,
      z: lineZ + 4,
      arena: { minX: barX + 1, maxX: headlandX - 1, minZ: northEdge + 1, maxZ: woodedNorth - 1 },
      // It leaves a hero on the logs alone.
      swimmersOnly: true,
      surface: shape.surface,
      floor: shape.floor,
    });
  }

  // To collect. So far one trail: a huckleberry over each boulder of the Shore Path, which shows the way along them.
  // (The rest of the lake's trails and its hidden leaves are laid once its new pieces are in.)
  const byId = new Map(solids.map((s) => [s.id, s]));
  const pickups: Pickup[] = sections[0].solids
    .slice(1, -1)
    .map((id) => byId.get(id)!)
    .map((s, index) => ({ id: `shore-${index + 1}`, kind: 'berry' as const, x: s.x, y: s.top + COLLECT.hang, z: s.z }));

  return {
    name: LAKE_NAME,
    pickups,
    enemies,
    enemyTuning: {
      warning: n.crocWarning,
      speed: 1,
      rest: n.crocRest,
      aimLine: n.crocLine,
      crocSpeed: n.crocSpeed,
      crocReach: n.crocReach,
      crocHits: n.crocHits,
      crocLead: n.crocLead,
    },
    solids,
    spawn: { x: shape.beachLength / 2, y: shape.shoreTop, z: shape.shoreZ - 1 },
    leaf: { x: x - 1.5, y: deck + 1.3, z: pierZ, radius: 0.7 },
    water,
    ropes,
    ropeHelp: n.ropeHelp,
    jumpAssist: n.jumpAssist,
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
