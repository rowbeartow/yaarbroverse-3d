// The camera that follows the route. Each section of a level says which way
// the camera faces through it (`facing`, in degrees seen from above: 0 looks
// along -z, 90 along +x, 180 back along +z, 270 along -x). The camera turns to
// the next section's facing when the hero stands on the last solid of the
// section before it, which is a safe place, and eases round so the picture
// never jumps. The stick follows the camera: up on the stick is always away
// from the camera, whichever way it faces. No 3D code here, so it is tested.

import type { Input } from '../game/game';
import type { Level } from '../game/level';

export const ROUTE_CAMERA = {
  /** How quickly the camera comes round to a new facing: it closes this share of what is left each second, roughly. */
  turn: 2.4,
  /** How quickly it pulls back or comes in when a section asks for a wider view. */
  pull: 1.6,
};

/** True when a level's sections say where the camera looks. A level that says nothing keeps the camera looking along -z. */
export const followsRoute = (level: Level): boolean => (level.sections ?? []).some((section) => section.facing !== undefined || section.pull !== undefined);

/** What the camera should be doing while the hero is on, or last stood on, the solid `lastSolid`. */
export const cameraFor = (level: Level, lastSolid: string | null): { facing: number; pull: number } => {
  const sections = level.sections ?? [];
  const sectionOf = (id: string): (typeof sections)[number] | undefined => sections.find((section) => section.solids.includes(id));
  const solids = new Set(level.solids.map((solid) => solid.id));
  // Only solids count: a pool's id in the route stands for a swim.
  const route = level.route.filter((id) => solids.has(id));
  const at = lastSolid === null ? -1 : route.indexOf(lastSolid);
  // A solid off the route (a fishing jetty, a rock to rest on) keeps the facing of the section it belongs to.
  if (lastSolid !== null && at < 0) {
    const own = sectionOf(lastSolid);
    if (own) return { facing: own.facing ?? 0, pull: own.pull ?? 1 };
  }
  // The camera looks the way of the solid the hero sets out for next, so it has turned before the hero leaves a bank.
  const next = route[Math.min(at + 1, route.length - 1)];
  const section = (next ? sectionOf(next) : undefined) ?? (lastSolid ? sectionOf(lastSolid) : undefined) ?? sections[0];
  return { facing: section?.facing ?? 0, pull: section?.pull ?? 1 };
};

/** True when a solid says anything about the camera: it is on the route, or in a section. Standing on any other leaves the camera as it is. */
export const placesCamera = (level: Level, id: string): boolean => level.route.includes(id) || (level.sections ?? []).some((section) => section.solids.includes(id));

/** An angle brought into -180 to 180. */
export const wrapDegrees = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;

/** The camera's facing a moment later: eased toward `target` the short way round. */
export const turnToward = (now: number, target: number, dt: number): number => {
  const left = wrapDegrees(target - now);
  if (Math.abs(left) < 0.01) return now + left;
  return now + left * (1 - Math.exp(-ROUTE_CAMERA.turn * dt));
};

/** The way a camera with this facing looks, seen from above, as a step of length 1. */
export const forwardOf = (facing: number): { x: number; z: number } => {
  const angle = (facing * Math.PI) / 180;
  return { x: Math.sin(angle), z: -Math.cos(angle) };
};

/**
 * Turns what the player asks for on the screen (left and right, away and
 * toward) into directions in the level, for a camera with this facing. With
 * the camera looking along -z nothing changes.
 */
export const stickToLevel = (input: Input, facing: number): Input => {
  if (facing === 0 || (input.moveX === 0 && input.moveZ === 0)) return input;
  const angle = (facing * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { ...input, moveX: input.moveX * cos - input.moveZ * sin, moveZ: input.moveX * sin + input.moveZ * cos };
};
