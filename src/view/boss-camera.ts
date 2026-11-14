// The camera in a boss fight. The game's camera sits close behind the hero and
// looks ahead, which hides anything behind the hero. In a fight that would
// hide the boss half the time, so while a fight is on the camera pulls back
// and up, and looks at a point between the hero and the middle of the arena:
// the whole arena, the boss and the hero stay in the picture. It still looks
// the same way, so "up" on the stick is still "away". No 3D code here.

import type { BossSpot } from '../game/boss';

/** How much further back and higher the camera sits in a fight, as a multiple of its usual place. */
export const FIGHT_CAMERA = { back: 1.6, up: 1.7, towardArena: 0.55, easeIn: 1.6, easeOut: 1.2 };

/**
 * Where the camera should follow, and how far it pulls out, for a fight that
 * is `share` of the way in (0 not fighting, 1 fully in).
 */
export const fightView = (
  share: number,
  hero: { x: number; z: number },
  spot: BossSpot | undefined,
): { x: number; z: number; back: number; up: number } => {
  if (!spot || share <= 0) return { x: hero.x, z: hero.z, back: 1, up: 1 };
  const middleX = (spot.arena.minX + spot.arena.maxX) / 2;
  const middleZ = (spot.patch.minZ + spot.patch.maxZ) / 2;
  const pull = FIGHT_CAMERA.towardArena * share;
  return {
    x: hero.x + (middleX - hero.x) * pull,
    z: hero.z + (middleZ - hero.z) * pull,
    back: 1 + (FIGHT_CAMERA.back - 1) * share,
    up: 1 + (FIGHT_CAMERA.up - 1) * share,
  };
};
