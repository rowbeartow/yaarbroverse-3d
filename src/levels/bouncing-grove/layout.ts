// THE BOUNCING GROVE: where everything is. Builds the level from the numbers
// in difficulty.ts. No drawing here; src/view/ turns this into shapes.
//
// The run, start to goal:
//   mossy bank, a fallen log with a break in it, mossy bank, tree stumps that
//   climb, mossy bank with a mushroom, a high log, mushrooms over open air,
//   then the big bough where the golden leaf is tucked in the canopy.

import type { Difficulty } from '../../game/difficulty';
import type { Level, Solid } from '../../game/level';
import { GROVE_DIFFICULTY, type GroveNumbers } from './difficulty';

export const GROVE_NAME = 'The Bouncing Grove';

/** Short prompts, each shown the first time the hero stands on that part of the grove. */
export const GROVE_HINTS: Record<string, string> = {
  'log-1': 'Mind the break in the log. Run and jump!',
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
  secondLogLength: 6,
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
  const add = (solid: Solid): Solid => {
    solids.push(solid);
    route.push(solid.id);
    return solid;
  };

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

  // 1. The first mossy bank. Always safe.
  let at = shape.startBankLength / 2;
  box('bank-start', 'bank', -at, at, 0, shape.bankHalfWidth + 0.5, 0, shape.depth, { safe: true });

  // 2. A fallen log with a break in it.
  box('log-1', 'log', at, at + shape.firstLogLength, 0, n.logWidth / 2, 0, -shape.logThickness);
  at += shape.firstLogLength + n.logGap;
  box('log-2', 'log', at, at + shape.secondLogLength, 0, n.logWidth / 2, 0, -shape.logThickness);
  at += shape.secondLogLength;

  // 3. A mossy bank to rest on.
  box('bank-1', 'bank', at, at + shape.restBankLength, 0, shape.bankHalfWidth, 0, shape.depth, {
    safe: n.safeBanks >= 2,
  });
  at += shape.restBankLength;

  // 4. Tree stumps, stepping left and right and climbing.
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

  // 5. The second mossy bank, level with the last stump, with a mushroom on it.
  const bank2 = box('bank-2', 'bank', at, at + shape.restBankLength, 0, shape.bankHalfWidth, top, shape.depth, {
    safe: n.safeBanks >= 3,
  });
  at += shape.restBankLength;
  let capTop = bank2.top + shape.mushroomCapHeight;
  round('mushroom-1', 'mushroom', at - 1.8, 0, n.mushroomRadius, capTop, bank2.top, {
    bounce: shape.mushroomBounce,
  });

  // 6. A high log, reached by bouncing.
  at += 0.6;
  const highTop = capTop + shape.highLogRise;
  box('high-log', 'log', at, at + shape.highLogLength, 0, n.logWidth / 2 + 0.2, highTop, highTop - shape.logThickness);
  at += shape.highLogLength;

  // 7. Mushrooms over open air, a little below the high log.
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

  // 8. The big bough in the canopy, and the golden leaf.
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
    hints: GROVE_HINTS,
    goalLine: GROVE_GOAL_LINE,
  };
}
