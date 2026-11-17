// Things to collect, which any level can have: huckleberries, laid in trails
// that show the way or tempt a hero off it, and a few small golden leaves
// hidden in the hardest spots. A hero picks one up by touching it. What is
// picked up stays picked up for the rest of the run: a fall takes nothing
// away. Nothing here hurts, blocks or helps a hero, and a level's goal is
// still its big golden leaf. `docs/adding-a-level.md` says how to lay them.

import { MOVE } from './hero';

export type PickupKind = 'berry' | 'leaf';

/** One thing to collect, where it hangs. (x, y, z) is its middle. */
export interface Pickup {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
}

export const COLLECT = {
  /** How near a hero's middle must come to a pickup's middle, on top of the hero's own width. */
  reach: { berry: 0.55, leaf: 0.7 } as Record<PickupKind, number>,
  /** How high over a surface a pickup hangs when a level asks for one "on" something. */
  hang: 0.9,
};

/** How many of each kind a level has. */
export const pickupCounts = (pickups: readonly Pickup[] | undefined): Record<PickupKind, number> => {
  const counts = { berry: 0, leaf: 0 };
  for (const pickup of pickups ?? []) counts[pickup.kind] += 1;
  return counts;
};

/** True when a hero whose middle is at (x, y, z) touches the pickup. */
export const touchesPickup = (pickup: Pickup, x: number, y: number, z: number): boolean => {
  const reach = COLLECT.reach[pickup.kind] + MOVE.bodyRadius;
  return (x - pickup.x) ** 2 + (y - pickup.y) ** 2 + (z - pickup.z) ** 2 <= reach * reach;
};

/**
 * A trail of huckleberries from one point to another, `count` of them evenly
 * spaced, ends included. `arc` lifts the middle of the trail by that many
 * metres, for a trail that follows a jump or a swing.
 */
export const berryTrail = (
  id: string,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  count: number,
  arc = 0,
): Pickup[] =>
  Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    return {
      id: `${id}-${index + 1}`,
      kind: 'berry' as const,
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t + arc * 4 * t * (1 - t),
      z: from.z + (to.z - from.z) * t,
    };
  });
