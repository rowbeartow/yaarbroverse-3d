// THE BOUNCING GROVE: where everything is. Builds the level from the numbers
// in difficulty.ts. No drawing here; src/view/ turns this into shapes.
//
// The run, start to goal, in sections that each end on a mossy bank:
//   1. The Broken Logs: fallen logs end to end, with a break between each pair.
//   2. The Stump Steps: tree stumps that climb, left and right, to a clearing.
//   3. The Ravine: root shelves step down and to the right, a low log with a
//      break crosses the bottom, root shelves climb out.
//   4. The Mushroom Springs: a mushroom, a high log, mushrooms over open air,
//      up to a mossy ledge.
//   5. The High Boughs: narrow boughs that turn left twice, with a gap at the corners.
//   6. The Climb: a mushroom, a high log, tall snags, mushrooms over open air,
//      then the big bough where the golden leaf is tucked in the canopy.

import type { Difficulty } from '../../game/difficulty';
import type { EnemySpot } from '../../game/enemy';
import type { Level, Section, Solid } from '../../game/level';
import { GROVE_DIFFICULTY, type GroveNumbers } from './difficulty';

export const GROVE_NAME = 'The Bouncing Grove';

/** Short prompts, each shown the first time the hero stands on that part of the grove. */
export const GROVE_HINTS: Record<string, string> = {
  'log-1': 'Mind the breaks in the log. Hop the small one, then run and jump!',
  'bank-1': 'Hop from stump to stump.',
  'bank-2': 'Step down the roots into the ravine.',
  'bank-3': 'Jump onto the mushroom and bounce up high.',
  'high-log': 'Bounce across the mushrooms.',
  'bank-4': 'Follow the boughs. They turn!',
  'bank-5': 'One more climb. The golden leaf is close.',
};

export const GROVE_GOAL_LINE = 'A golden leaf, tucked in the canopy!';

/** Fixed sizes that do not change with difficulty. */
export const GROVE_SHAPE = {
  bankHalfWidth: 3.5,
  startBankLength: 10,
  restBankLength: 6,
  firstLogLength: 7,
  logLength: 6,
  /** The clearing at the top of the stumps: wider and longer than a resting bank. */
  clearingHalfWidth: 5,
  clearingLength: 12,
  /** Root shelves: where the first one sits, and how far right each next one steps on the way down. */
  firstShelfSide: 2,
  shelfSideStep: 3,
  ravineLogLength: 5,
  /** The mossy ledge at the top of the mushrooms. */
  ledgeLength: 7,
  /** The high boughs: how long the ones running forward are, and the two lying across. */
  boughForward: 9,
  boughAcross: 10,
  boughAcrossShort: 8,
  logThickness: 1,
  /**
   * The enemies. The first scout waits to the left of the way through the
   * clearing, in its far half. The second waits to the left on the bank at the
   * foot of the last climb. Neither leaves its bank, and each stays this far
   * in from the edge.
   */
  scoutAside: 2.8,
  scoutAhead: 1.5,
  footScoutAside: 2.5,
  footScoutAhead: 0,
  scoutInset: 0.7,
  /** The mosquito: how far above the boughs it waits, how far to each side of them it flies, and its lowest and highest. */
  mosquitoHover: 3.6,
  mosquitoMargin: 1.2,
  mosquitoFloor: 0.8,
  mosquitoCeiling: 5,
  /** How far stumps and chained mushrooms sit left and right of the middle. */
  stumpSideStep: 1.3,
  mushroomSideStep: 0.9,
  /** Mushroom cap height above what it grows from, and its launch speed. */
  mushroomCapHeight: 1,
  mushroomBounce: 15,
  /** How far above a mushroom cap the next ledge is. */
  highLogRise: 2.4,
  highLogLength: 5,
  boughRise: 2.6,
  boughHalfWidth: 2.5,
  boughLength: 6,
  /** Mist level, and the height below which a hero has fallen. */
  mistY: -7,
  fallY: -6,
  depth: -40,
} as const;

/**
 * Builds the grove for one difficulty. `numbers` is only passed by tests that
 * try out other values; the game always uses the ones in difficulty.ts.
 */
export function buildGrove(
  difficulty: Difficulty,
  numbers: GroveNumbers = GROVE_DIFFICULTY[difficulty],
): Level {
  const n = numbers;
  const shape = GROVE_SHAPE;
  const solids: Solid[] = [];
  const route: string[] = [];
  const sections: Section[] = [];
  const section = (name: string): void => {
    sections.push({ name, solids: [] });
  };
  const add = (solid: Solid): Solid => {
    solids.push(solid);
    route.push(solid.id);
    sections[sections.length - 1].solids.push(solid.id);
    return solid;
  };
  /** Bank number `number` (the first bank is 0) is a checkpoint on this difficulty. */
  const safe = (number: number): boolean => number === 0 || n.checkpoints.includes(number);

  // `forward` counts metres travelled away from the camera. In the world that
  // is the -z direction, so a box from forward a to b sits at z = -(a + b) / 2.
  const box = (
    id: string,
    kind: Solid['kind'],
    from: number,
    to: number,
    x: number,
    halfX: number,
    top: number,
    bottom: number,
    extra: Partial<Solid> = {},
  ): Solid =>
    add({
      id,
      kind,
      shape: 'box',
      x,
      z: -(from + to) / 2,
      halfX,
      halfZ: (to - from) / 2,
      top,
      bottom,
      ...extra,
    });
  const round = (
    id: string,
    kind: Solid['kind'],
    forward: number,
    x: number,
    radius: number,
    top: number,
    bottom: number,
    extra: Partial<Solid> = {},
  ): Solid =>
    add({ id, kind, shape: 'round', x, z: -forward, halfX: radius, halfZ: radius, top, bottom, ...extra });

  // ---- Section 1: The Broken Logs ----
  section('The Broken Logs');
  // The first mossy bank. Always safe.
  let at = shape.startBankLength / 2;
  box('bank-start', 'bank', -at, at, 0, shape.bankHalfWidth + 0.5, 0, shape.depth, { safe: safe(0) });

  // Fallen logs end to end. The first break is a short hop; the rest are real jumps.
  for (let i = 0; i < n.logCount; i += 1) {
    if (i > 0) at += i === 1 ? n.firstLogGap : n.logGap;
    const length = i === 0 ? shape.firstLogLength : shape.logLength;
    box(`log-${i + 1}`, 'log', at, at + length, 0, n.logWidth / 2, 0, -shape.logThickness);
    at += length;
  }

  // A mossy bank to rest on.
  box('bank-1', 'bank', at, at + shape.restBankLength, 0, shape.bankHalfWidth, 0, shape.depth, { safe: safe(1) });
  at += shape.restBankLength;

  // ---- Section 2: The Stump Steps ----
  section('The Stump Steps');
  // Tree stumps, stepping left and right and climbing.
  let top = 0;
  let stumpX = -shape.stumpSideStep;
  let stumpAt = at + n.stumpGap + n.stumpRadius;
  for (let i = 0; i < n.stumpCount; i += 1) {
    if (i > 0) {
      const nextX = -stumpX;
      const between = 2 * n.stumpRadius + n.stumpGap;
      stumpAt += Math.sqrt(Math.max(between * between - (nextX - stumpX) ** 2, 0));
      stumpX = nextX;
    }
    top += n.stumpRise;
    round(`stump-${i + 1}`, 'stump', stumpAt, stumpX, n.stumpRadius, top, shape.depth);
  }
  at = stumpAt + n.stumpRadius + n.stumpGap;

  // The clearing, level with the last stump.
  box('bank-2', 'bank', at, at + shape.clearingLength, 0, shape.clearingHalfWidth, top, shape.depth, {
    safe: safe(2),
  });
  at += shape.clearingLength;

  // ---- Section 3: The Ravine ----
  section('The Ravine');
  // Root shelves step down into the ravine, each one further to the right.
  const shelfHalf = n.shelfSize / 2;
  let side = shape.firstShelfSide - shape.shelfSideStep;
  for (let i = 0; i < n.shelfCount; i += 1) {
    at += n.shelfGap;
    top -= n.shelfStep;
    side += shape.shelfSideStep;
    box(`shelf-down-${i + 1}`, 'shelf', at, at + n.shelfSize, side, shelfHalf, top, shape.depth);
    at += n.shelfSize;
  }
  // From here on the route runs `side` metres to the right of where it started.

  // Along the bottom: a low log with a break in it, starting from the last shelf.
  box('ravine-log-1', 'log', at, at + shape.logLength, side, n.logWidth / 2, top, top - shape.logThickness);
  at += shape.logLength + n.logGap;
  box('ravine-log-2', 'log', at, at + shape.ravineLogLength, side, n.logWidth / 2, top, top - shape.logThickness);
  at += shape.ravineLogLength;

  // Root shelves climb out the far side, straight ahead, to a bank level with the clearing.
  for (let i = 0; i < n.shelfCount - 1; i += 1) {
    at += n.shelfGap;
    top += n.shelfStep;
    box(`shelf-up-${i + 1}`, 'shelf', at, at + n.shelfSize, side, shelfHalf, top, shape.depth);
    at += n.shelfSize;
  }
  at += n.shelfGap;
  top += n.shelfStep;
  const bank3 = box('bank-3', 'bank', at, at + shape.restBankLength, side, shape.bankHalfWidth, top, shape.depth, {
    safe: safe(3),
  });
  at += shape.restBankLength;

  // ---- Section 4: The Mushroom Springs ----
  section('The Mushroom Springs');
  // A mushroom at the far end of the bank.
  let capTop = bank3.top + shape.mushroomCapHeight;
  round('mushroom-1', 'mushroom', at - 1.8, side, n.mushroomRadius, capTop, bank3.top, {
    bounce: shape.mushroomBounce,
  });

  // A high log, reached by bouncing.
  at += 0.6;
  const highTop = capTop + shape.highLogRise;
  box('high-log', 'log', at, at + shape.highLogLength, side, n.logWidth / 2 + 0.2, highTop, highTop - shape.logThickness);
  at += shape.highLogLength;

  // Mushrooms over open air, a little below the high log, stepping left and right.
  capTop = highTop - 0.6;
  let mushroomX = side;
  let mushroomAt = at + n.mushroomGap + n.mushroomRadius;
  for (let i = 0; i < n.mushroomChain; i += 1) {
    if (i > 0) {
      const nextX = mushroomX === side ? side + shape.mushroomSideStep : 2 * side - mushroomX;
      const between = 2 * n.mushroomRadius + n.mushroomGap;
      mushroomAt += Math.sqrt(Math.max(between * between - (nextX - mushroomX) ** 2, 0));
      mushroomX = nextX;
    }
    round(`mushroom-${i + 2}`, 'mushroom', mushroomAt, mushroomX, n.mushroomRadius, capTop, shape.depth, {
      bounce: shape.mushroomBounce,
    });
  }
  at = mushroomAt + n.mushroomRadius + n.mushroomGap;

  // A mossy ledge high up, reached by the last bounce.
  top = capTop + shape.boughRise;
  box('bank-4', 'bank', at, at + shape.ledgeLength, side, shape.bankHalfWidth, top, shape.depth, { safe: safe(4) });
  at += shape.ledgeLength;

  // ---- Section 5: The High Boughs ----
  section('The High Boughs');
  // Five narrow boughs, level with the ledge, that turn left twice: forward,
  // across to the left, forward, across again, forward. At each corner the next
  // bough starts either straight ahead of this one's end (a jump away from the
  // camera) or beside it (a jump across the screen). A corner with no gap is
  // joined: the boughs touch.
  const boughHalf = n.boughWidth / 2;
  const boughBottom = top - shape.logThickness;
  const cornerGap = (corner: number): number => (corner < n.boughGapCount ? n.boughGap : 0);
  // Bough 1 runs forward from the ledge.
  box('bough-1', 'bough', at, at + shape.boughForward, side, boughHalf, top, boughBottom);
  at += shape.boughForward;
  // Bough 2 lies across, ahead of the end of bough 1, and runs to the left.
  at += cornerGap(0);
  let rightEnd = side + boughHalf;
  let leftEnd = rightEnd - shape.boughAcross;
  box('bough-2', 'bough', at, at + n.boughWidth, (leftEnd + rightEnd) / 2, shape.boughAcross / 2, top, boughBottom);
  // Bough 3 starts beside the left end of bough 2 and runs forward.
  side = leftEnd - cornerGap(1) - boughHalf;
  box('bough-3', 'bough', at, at + shape.boughForward, side, boughHalf, top, boughBottom);
  at += shape.boughForward;
  // Bough 4 lies across, ahead of the end of bough 3.
  at += cornerGap(2);
  rightEnd = side + boughHalf;
  leftEnd = rightEnd - shape.boughAcrossShort;
  box('bough-4', 'bough', at, at + n.boughWidth, (leftEnd + rightEnd) / 2, shape.boughAcrossShort / 2, top, boughBottom);
  // Bough 5 starts beside the left end of bough 4 and runs forward to a bank.
  side = leftEnd - cornerGap(3) - boughHalf;
  box('bough-5', 'bough', at, at + shape.boughForward, side, boughHalf, top, boughBottom);
  at += shape.boughForward;
  const bank5 = box('bank-5', 'bank', at, at + shape.restBankLength, side, shape.bankHalfWidth, top, shape.depth, {
    safe: safe(5),
  });
  at += shape.restBankLength;

  // ---- Section 6: The Climb ----
  section('The Climb');
  // A mushroom at the far end of the bank, and a high log reached by bouncing.
  capTop = bank5.top + shape.mushroomCapHeight;
  round('climb-mushroom-1', 'mushroom', at - 1.8, side, n.mushroomRadius, capTop, bank5.top, {
    bounce: shape.mushroomBounce,
  });
  at += 0.6;
  top = capTop + shape.highLogRise;
  box('climb-log', 'log', at, at + shape.highLogLength, side, n.logWidth / 2 + 0.2, top, top - shape.logThickness);
  at += shape.highLogLength;

  // Tall snags, stepping left and right and climbing, like the stumps but high up.
  let snagX = side - shape.stumpSideStep;
  let snagAt = at + n.stumpGap + n.stumpRadius;
  for (let i = 0; i < n.snagCount; i += 1) {
    if (i > 0) {
      const nextX = 2 * side - snagX;
      const between = 2 * n.stumpRadius + n.stumpGap;
      snagAt += Math.sqrt(Math.max(between * between - (nextX - snagX) ** 2, 0));
      snagX = nextX;
    }
    top += n.stumpRise;
    round(`snag-${i + 1}`, 'stump', snagAt, snagX, n.stumpRadius, top, shape.depth);
  }

  // Mushrooms over open air, a little below the last snag.
  capTop = top - 0.6;
  mushroomX = side;
  mushroomAt = snagAt + n.stumpRadius + n.mushroomGap + n.mushroomRadius;
  for (let i = 0; i < n.climbMushrooms; i += 1) {
    if (i > 0) {
      const nextX = mushroomX === side ? side + shape.mushroomSideStep : 2 * side - mushroomX;
      const between = 2 * n.mushroomRadius + n.mushroomGap;
      mushroomAt += Math.sqrt(Math.max(between * between - (nextX - mushroomX) ** 2, 0));
      mushroomX = nextX;
    }
    round(`climb-mushroom-${i + 2}`, 'mushroom', mushroomAt, mushroomX, n.mushroomRadius, capTop, shape.depth, {
      bounce: shape.mushroomBounce,
    });
  }
  at = mushroomAt + n.mushroomRadius + n.mushroomGap;

  // The big bough of the great cedar, and the golden leaf.
  const boughTop = capTop + shape.boughRise;
  box('bough', 'bough', at, at + shape.boughLength, mushroomX, shape.boughHalfWidth, boughTop, boughTop - 1.2);
  const leafX = mushroomX;

  // ---- The enemies ----
  // Only where the route left room for them (see docs/decisions.md): the
  // clearing after the stumps, the air over the later high boughs, and the
  // bank at the foot of the last climb. None in a section of diagonal jumps.
  const byId = (id: string): Solid => solids.find((s) => s.id === id) as Solid;
  const patch = (bank: Solid, inset: number): EnemySpot['arena'] => ({
    minX: bank.x - bank.halfX + inset,
    maxX: bank.x + bank.halfX - inset,
    minZ: bank.z - bank.halfZ + inset,
    maxZ: bank.z + bank.halfZ - inset,
  });
  const clearing = byId('bank-2');
  const foot = byId('bank-5');
  const [third, fifth] = [byId('bough-3'), byId('bough-5')];
  const enemies: EnemySpot[] = [
    // A marmot scout in the clearing, off to the left of the way through.
    {
      id: 'scout-clearing',
      kind: 'marmot',
      x: clearing.x - shape.scoutAside,
      y: clearing.top,
      z: clearing.z - shape.scoutAhead,
      arena: patch(clearing, shape.scoutInset),
      notice: shape.scoutInset,
    },
    // A giant mosquito over the last three high boughs, past the corner that has a gap on every difficulty.
    {
      id: 'mosquito-boughs',
      kind: 'mosquito',
      x: (third.x + fifth.x) / 2,
      y: third.top + shape.mosquitoHover,
      z: (third.z + fifth.z) / 2,
      arena: {
        minX: fifth.x - shape.mosquitoMargin,
        maxX: third.x + shape.mosquitoMargin,
        minZ: fifth.z - fifth.halfZ,
        maxZ: third.z + third.halfZ,
      },
      floor: third.top + shape.mosquitoFloor,
      ceiling: third.top + shape.mosquitoCeiling,
    },
    // A second scout on the bank at the foot of the last climb.
    {
      id: 'scout-climb',
      kind: 'marmot',
      x: foot.x - shape.footScoutAside,
      y: foot.top,
      z: foot.z - shape.footScoutAhead,
      arena: patch(foot, shape.scoutInset),
      notice: shape.scoutInset,
    },
  ];

  return {
    name: GROVE_NAME,
    solids,
    enemies,
    enemyTuning: { warning: n.enemyWarning, speed: n.enemySpeed, rest: n.enemyRest },
    spawn: { x: 0, y: 0, z: 0 },
    leaf: { x: leafX, y: boughTop + 1.3, z: -(at + shape.boughLength - 1.6), radius: 0.7 },
    fallY: shape.fallY,
    coyoteTime: n.coyoteTime,
    ledgeHelp: n.ledgeHelp,
    hearts: n.hearts,
    protection: n.protection,
    knockback: n.knockback,
    route,
    sections,
    hints: GROVE_HINTS,
    goalLine: GROVE_GOAL_LINE,
  };
}
