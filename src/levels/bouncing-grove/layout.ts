// THE BOUNCING GROVE: where everything is. Builds the level from the numbers
// in difficulty.ts. No drawing here; src/view/ turns this into shapes.
//
// The run, start to goal, in sections that each end on a mossy bank:
//   1. The Broken Logs: fallen logs end to end, with a break between each pair.
//   2. The Stump Steps: tree stumps that climb, left and right, to a clearing.
//   Then a mushroom, a high log, mushrooms over open air, and the big bough
//   where the golden leaf is tucked in the canopy.

import type { Difficulty } from '../../game/difficulty';
import type { Level, Section, Solid } from '../../game/level';
import { GROVE_DIFFICULTY, type GroveNumbers } from './difficulty';

export const GROVE_NAME = 'The Bouncing Grove';

/** Short prompts, each shown the first time the hero stands on that part of the grove. */
export const GROVE_HINTS: Record<string, string> = {
  'log-1': 'Mind the breaks in the log. Hop the small one, then run and jump!',
  'bank-1': 'Hop from stump to stump.',
  'bank-2': 'Jump onto the mushroom and bounce up high.',
  'high-log': 'Bounce across. The golden leaf is close.',
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
  logThickness: 1,
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
  const bank2 = box('bank-2', 'bank', at, at + shape.clearingLength, 0, shape.clearingHalfWidth, top, shape.depth, {
    safe: safe(2),
  });
  at += shape.clearingLength;

  // ---- The way up to the leaf ----
  section('The Mushroom Springs');
  // A mushroom at the far end of the clearing.
  let capTop = bank2.top + shape.mushroomCapHeight;
  round('mushroom-1', 'mushroom', at - 1.8, 0, n.mushroomRadius, capTop, bank2.top, {
    bounce: shape.mushroomBounce,
  });

  // A high log, reached by bouncing.
  at += 0.6;
  const highTop = capTop + shape.highLogRise;
  box('high-log', 'log', at, at + shape.highLogLength, 0, n.logWidth / 2 + 0.2, highTop, highTop - shape.logThickness);
  at += shape.highLogLength;

  // Mushrooms over open air, a little below the high log.
  capTop = highTop - 0.6;
  let mushroomX = 0;
  let mushroomAt = at + n.mushroomGap + n.mushroomRadius;
  for (let i = 0; i < n.mushroomChain; i += 1) {
    if (i > 0) {
      const nextX = mushroomX === 0 ? shape.mushroomSideStep : -mushroomX;
      const between = 2 * n.mushroomRadius + n.mushroomGap;
      mushroomAt += Math.sqrt(Math.max(between * between - (nextX - mushroomX) ** 2, 0));
      mushroomX = nextX;
    }
    round(`mushroom-${i + 2}`, 'mushroom', mushroomAt, mushroomX, n.mushroomRadius, capTop, shape.depth, {
      bounce: shape.mushroomBounce,
    });
  }
  at = mushroomAt + n.mushroomRadius + n.mushroomGap;

  // The big bough in the canopy, and the golden leaf.
  const boughTop = capTop + shape.boughRise;
  box('bough', 'bough', at, at + shape.boughLength, mushroomX, shape.boughHalfWidth, boughTop, boughTop - 1.2);

  return {
    name: GROVE_NAME,
    solids,
    spawn: { x: 0, y: 0, z: 0 },
    leaf: { x: mushroomX, y: boughTop + 1.3, z: -(at + shape.boughLength - 1.6), radius: 0.7 },
    fallY: shape.fallY,
    coyoteTime: n.coyoteTime,
    ledgeHelp: n.ledgeHelp,
    route,
    sections,
    hints: GROVE_HINTS,
    goalLine: GROVE_GOAL_LINE,
  };
}
