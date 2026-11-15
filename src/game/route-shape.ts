// THE ROUTE RULE: routes turn. A level winds, switches back and opens out, so
// a hero moves left, right and toward the camera, not only away from it, and
// the camera turns to follow the route (the owner's rule, 2026-11-15, in
// docs/decisions.md). This file measures a level against that rule, and
// tests/route-shape.test.ts holds every level to it.
//
// How it is measured. The route is drawn from above as a line: the start,
// then each solid of `route` in order, then the goal. Small wiggles (boulders
// set a little left and right of a straight line) are smoothed away, so only
// real changes of direction count. Each straight stretch of that line is then
// sorted by which way it runs on the screen, given which way the camera faces
// there: away from the camera, left, right, or back toward it. A turn is
// counted each time the route has swung 45 degrees from the way it ran at the
// turn before, so a long curve counts as well as a sharp corner.
//
// No browser or 3D code here.

import type { Level, Solid } from './level';

/**
 * Which way the camera faces, in degrees, seen from above. 0 looks along -z
 * (the way every level starts out), 90 looks along +x (to the right of that),
 * 180 looks back along +z, and 270 (or -90) looks along -x.
 */
export type Facing = number;

export interface RouteShape {
  /** How long the route is, seen from above, in metres. */
  length: number;
  /** The share of that length (0 to 1) that runs each way on the screen. The four add up to 1. */
  away: number;
  left: number;
  right: number;
  toward: number;
  /** Times the route swings 45 degrees or more, and how many there are for each 100 metres of route. */
  turns: number;
  turnsPer100: number;
  /** How many times the camera turns to a new facing along the way. */
  cameraTurns: number;
  /** The line itself after smoothing, for drawing a map of it: each corner, and the camera's facing on the stretch that begins there. */
  line: { x: number; z: number; facing: Facing }[];
}

/** What every level's route has to manage. Shares are of the route's length, from 0 to 1. */
export const ROUTE_RULE = {
  /** No more than this much of the route may run away from the camera. */
  mostAway: 0.6,
  /** At least this much must run to the left on the screen, and this much to the right. */
  leastEachSide: 0.1,
  /** At least this much must come back toward the camera. */
  leastToward: 0.08,
  /** At least this many turns of 45 degrees or more for each 100 metres. */
  leastTurnsPer100: 2,
  /** The camera must turn to a new facing at least this many times. */
  leastCameraTurns: 2,
} as const;

/** Wiggles smaller than this, in metres, are smoothed out of the line before it is measured. */
const SMOOTH = 1.5;
/** A change of direction of at least this many degrees is a turn. */
const TURN = 45;
/** Camera facings closer together than this many degrees count as the same facing. */
const SAME_FACING = 20;

interface Point {
  x: number;
  z: number;
  facing: Facing;
}

/** An angle brought into -180 to 180. */
const wrap = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** The direction of travel from a to b, in the same degrees as a facing. */
const heading = (a: Point, b: Point): number => (Math.atan2(b.x - a.x, -(b.z - a.z)) * 180) / Math.PI;

/** The spot on a solid nearest to where the run comes from: its middle for a round one, the nearest place a hero's feet fit for a box. */
const stepOnto = (s: Solid, from: { x: number; z: number }): { x: number; z: number } => {
  if (s.shape === 'round') return { x: s.x, z: s.z };
  const inX = Math.max(0, s.halfX - 0.5);
  const inZ = Math.max(0, s.halfZ - 0.5);
  return { x: Math.max(s.x - inX, Math.min(s.x + inX, from.x)), z: Math.max(s.z - inZ, Math.min(s.z + inZ, from.z)) };
};

/** Which corners to keep: those that stand at least SMOOTH from the straight line between the corners kept either side. */
const corners = (points: Point[]): number[] => {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const split = (first: number, last: number): void => {
    const a = points[first];
    const b = points[last];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    let worst = -1;
    let far = SMOOTH;
    for (let i = first + 1; i < last; i += 1) {
      const p = points[i];
      const off = length < 1e-9 ? Math.hypot(p.x - a.x, p.z - a.z) : Math.abs((b.x - a.x) * (a.z - p.z) - (a.x - p.x) * (b.z - a.z)) / length;
      if (off > far) {
        far = off;
        worst = i;
      }
    }
    if (worst < 0) return;
    keep[worst] = true;
    split(first, worst);
    split(worst, last);
  };
  if (points.length > 2) split(0, points.length - 1);
  return points.map((_, i) => i).filter((i) => keep[i]);
};

/** Measures a level's route. Which way the camera faces comes from the level's sections (`facing`); 0 where none is given. */
export const routeShape = (level: Level): RouteShape => {
  const byId = new Map(level.solids.map((s) => [s.id, s]));
  const facingOf = new Map<string, Facing>();
  for (const section of level.sections ?? []) for (const id of section.solids) facingOf.set(id, section.facing ?? 0);

  const raw: Point[] = [{ x: level.spawn.x, z: level.spawn.z, facing: facingOf.get(level.route[0]) ?? 0 }];
  for (const id of level.route) {
    const solid = byId.get(id);
    // A pool's id stands for the swim between the solids either side of it.
    if (!solid) continue;
    const from = raw[raw.length - 1];
    const at = stepOnto(solid, from);
    // Two solids that touch can give the same spot twice: once is enough.
    if (Math.hypot(at.x - from.x, at.z - from.z) < 1e-6) continue;
    raw.push({ ...at, facing: facingOf.get(id) ?? from.facing });
  }
  const end = raw[raw.length - 1];
  if (Math.hypot(level.leaf.x - end.x, level.leaf.z - end.z) > 1e-6) raw.push({ x: level.leaf.x, z: level.leaf.z, facing: end.facing });

  const kept = corners(raw);
  const shares = { away: 0, left: 0, right: 0, toward: 0 };
  let length = 0;
  let turns = 0;
  let cameraTurns = 0;
  // A turn is counted when the route has swung 45 degrees from the way it ran
  // at the turn before, so a long curve counts as well as a sharp corner.
  let since: number | null = null;
  let facingBefore: Facing | null = null;
  const line: RouteShape['line'] = [];
  for (let k = 0; k + 1 < kept.length; k += 1) {
    const a = raw[kept[k]];
    const b = raw[kept[k + 1]];
    const way = heading(a, b);
    if (since === null) since = way;
    else if (Math.abs(wrap(way - since)) >= TURN) {
      turns += 1;
      since = way;
    }
    // Each piece of the route along this stretch counts under the camera's
    // facing on the solid it leads to: the camera turns as the hero sets out for it.
    for (let i = kept[k]; i < kept[k + 1]; i += 1) {
      const facing = raw[i + 1].facing;
      const run = Math.hypot(raw[i + 1].x - raw[i].x, raw[i + 1].z - raw[i].z);
      const onScreen = wrap(way - facing);
      if (Math.abs(onScreen) <= 45) shares.away += run;
      else if (Math.abs(onScreen) >= 135) shares.toward += run;
      else if (onScreen > 0) shares.right += run;
      else shares.left += run;
      length += run;
      if (facingBefore !== null && Math.abs(wrap(facing - facingBefore)) >= SAME_FACING) cameraTurns += 1;
      facingBefore = facing;
    }
    line.push({ x: a.x, z: a.z, facing: raw[kept[k] + 1].facing });
  }
  const last = raw[kept[kept.length - 1]];
  line.push({ x: last.x, z: last.z, facing: last.facing });
  const share = (metres: number): number => (length > 0 ? metres / length : 0);
  return {
    length,
    away: share(shares.away),
    left: share(shares.left),
    right: share(shares.right),
    toward: share(shares.toward),
    turns,
    turnsPer100: length > 0 ? (turns * 100) / length : 0,
    cameraTurns,
    line,
  };
};

/** Where a route falls short of the rule, in plain words. Empty when it meets it. */
export const routeFaults = (shape: RouteShape): string[] => {
  const percent = (share: number): string => `${Math.round(share * 100)}%`;
  const faults: string[] = [];
  if (shape.away > ROUTE_RULE.mostAway) faults.push(`${percent(shape.away)} of it runs away from the camera (at most ${percent(ROUTE_RULE.mostAway)})`);
  if (shape.left < ROUTE_RULE.leastEachSide) faults.push(`${percent(shape.left)} of it runs left (at least ${percent(ROUTE_RULE.leastEachSide)})`);
  if (shape.right < ROUTE_RULE.leastEachSide) faults.push(`${percent(shape.right)} of it runs right (at least ${percent(ROUTE_RULE.leastEachSide)})`);
  if (shape.toward < ROUTE_RULE.leastToward) faults.push(`${percent(shape.toward)} of it comes back toward the camera (at least ${percent(ROUTE_RULE.leastToward)})`);
  if (shape.turnsPer100 < ROUTE_RULE.leastTurnsPer100) faults.push(`${shape.turnsPer100.toFixed(1)} turns for each 100 m (at least ${ROUTE_RULE.leastTurnsPer100})`);
  if (shape.cameraTurns < ROUTE_RULE.leastCameraTurns) faults.push(`the camera turns ${shape.cameraTurns} times (at least ${ROUTE_RULE.leastCameraTurns})`);
  return faults;
};
