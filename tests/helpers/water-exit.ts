// Getting out of the water, for the rule test that no stretch of water is a
// trap (tests/water-exits.test.ts). It drops a hero into a pool and plays a
// plain swimmer: it makes for the nearest thing it could climb onto or walk
// out on, dives under whatever is in the way, and climbs out. It knows
// nothing of the route, so it finds any way out there is.

import { Game, IDLE, type Input } from '../../src/game/game';
import { STEP, type HeroName } from '../../src/game/hero';
import { touchesFromAbove, type Level, type Solid } from '../../src/game/level';
import { SWIM, waterAt, type Water } from '../../src/game/swim';
import type { Difficulty } from '../../src/game/difficulty';

/** How far (x, z) is from the edge of a solid, seen from above: 0 or less is over it. */
const edgeDistance = (s: Solid, x: number, z: number): number => {
  if (s.shape === 'round') return Math.hypot(x - s.x, z - s.z) - s.halfX;
  const dx = Math.max(Math.abs(x - s.x) - s.halfX, 0);
  const dz = Math.max(Math.abs(z - s.z) - s.halfZ, 0);
  return Math.hypot(dx, dz);
};

/** A way out must show a swimmer this many metres of edge to come up to: a post that only pokes over the pool's edge is not one a player finds. */
export const EXIT_EDGE = 4;
/** In water that is not itself a swim of the route, a way out is never further than this from where a hero fell in: about seven seconds of swimming. The longest today is the swim back to the rock half way along the Crocodile Crossing. */
export const EXIT_WITHIN = 26;

/** The solids a swimmer in this pool could get out onto, as the rules have it (climbOut in src/game/swim.ts), wherever they are in the pool. */
export const exitsOf = (level: Level, pool: Water): Solid[] =>
  level.solids.filter((s) => {
    if (s.bounce || s.noClimb || s.motion?.kind === 'float') return false;
    const rise = s.top - pool.surface;
    if (rise < -0.2 || rise > SWIM.climbHeight) return false;
    // How much of its edge a swimmer in this pool can come up to: points just off the edge, in the pool's water and clear of everything else.
    const off = SWIM.radius + 0.3;
    const around: Array<{ x: number; z: number }> = [];
    const pace = 0.25;
    if (s.shape === 'round') {
      const r = s.halfX + off;
      for (let a = 0; a < Math.PI * 2; a += pace / r) around.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r });
    } else {
      for (let x = s.x - s.halfX; x <= s.x + s.halfX; x += pace) around.push({ x, z: s.z - s.halfZ - off }, { x, z: s.z + s.halfZ + off });
      for (let z = s.z - s.halfZ; z <= s.z + s.halfZ; z += pace) around.push({ x: s.x - s.halfX - off, z }, { x: s.x + s.halfX + off, z });
    }
    const open = around.filter((p) => p.x > pool.minX && p.x < pool.maxX && p.z > pool.minZ && p.z < pool.maxZ && !level.solids.some((other) => other !== s && other.bottom < pool.surface && other.top > pool.surface - 1 && touchesFromAbove(other, p.x, p.z, SWIM.radius * 0.5)));
    return open.length * pace >= EXIT_EDGE;
  });

/** Places to drop a hero in: three along each leg of the route and two metres to either side of each, wherever that is open water. */
export const dropPoints = (level: Level): Array<{ x: number; z: number; near: string }> => {
  const solids = level.route.map((id) => level.solids.find((s) => s.id === id)).filter((s): s is Solid => s !== undefined);
  const points: Array<{ x: number; z: number; near: string }> = [];
  for (let i = 0; i + 1 < solids.length; i += 1) {
    const from = solids[i];
    const to = solids[i + 1];
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
    const side = { x: -(to.z - from.z) / length, z: (to.x - from.x) / length };
    for (const share of [0.2, 0.5, 0.8]) {
      for (const off of [-2, 0, 2]) {
        const x = from.x + (to.x - from.x) * share + side.x * off;
        const z = from.z + (to.z - from.z) * share + side.z * off;
        if (!waterAt(level.water, x, z)) continue;
        // Open water only: nothing to land on here.
        if (level.solids.some((s) => touchesFromAbove(s, x, z, 0.6))) continue;
        points.push({ x, z, near: `${from.id} to ${to.id}` });
      }
    }
  }
  return points;
};

/**
 * Drops the hero into the water at a point and swims for a way out. Returns
 * the id of the solid the hero ends up standing on, or null if it is still in
 * the water after trying every way out there is. `seconds` is how long it may
 * spend on each, and `within` how far off a way out may be.
 */
export const escapeFrom = (level: Level, difficulty: Difficulty, hero: HeroName, at: { x: number; z: number }, seconds = 45, within = Infinity): string | null => {
  const game = new Game(level, difficulty, hero);
  const pool = waterAt(game.level.water, at.x, at.z);
  if (!pool) return 'not water';
  // Nothing in the water is this check's business: only the way out.
  for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
  // Already in the water, not falling toward it: a hero in the air beside a rope would take hold of the rope instead.
  Object.assign(game, { x: at.x, y: pool.surface - 0.8, z: at.z, vx: 0, vy: 0, vz: 0, grounded: false, groundId: null });
  for (let i = 0; i < 2 / STEP && !game.swimming; i += 1) game.step(IDLE);
  if (!game.swimming) return game.grounded ? game.groundId : null;
  // Breath is not what is being tested: a real player comes up for air on the way.
  const air = (): void => {
    if (Number.isFinite(game.maxBreath)) game.breath = game.maxBreath;
    game.hearts = game.level.hearts;
  };
  const byDistance = exitsOf(game.level, pool).sort((a, b) => edgeDistance(a, at.x, at.z) - edgeDistance(b, at.x, at.z));
  for (const exit of byDistance) {
    if (edgeDistance(exit, at.x, at.z) > within) break;
    let pressed = false;
    for (let i = 0; i < seconds / STEP; i += 1) {
      air();
      if (!game.swimming && game.climbing <= 0 && game.grounded) return game.groundId;
      if (!game.swimming) {
        game.step(IDLE);
        continue;
      }
      // A piece that sinks may be under just now: wait beside it for it to come back.
      const target = game.level.solids.find((s) => s.id === exit.id)!;
      const aimX = Math.max(target.x - target.halfX, Math.min(target.x + target.halfX, game.x));
      const aimZ = Math.max(target.z - target.halfZ, Math.min(target.z + target.halfZ, game.z));
      const dx = (target.shape === 'round' ? target.x : aimX) - game.x;
      const dz = (target.shape === 'round' ? target.z : aimZ) - game.z;
      const far = Math.hypot(dx, dz) || 1e-6;
      const way = { x: dx / far, z: dz / far };
      const beside = edgeDistance(target, game.x, game.z) < SWIM.radius + SWIM.climbReach - 0.1;
      const blocked = game.level.solids.some((s) => {
        if (s.gone || s === target) return false;
        const feet = game.y;
        for (let ahead = 0.4; ahead <= 2.2; ahead += 0.3) {
          if (touchesFromAbove(s, game.x + way.x * ahead, game.z + way.z * ahead, SWIM.radius) && feet < s.top && feet + game.bodyHeight > s.bottom) return true;
        }
        return false;
      });
      const overhead = game.level.solids.some((s) => !s.gone && s !== target && s.bottom > game.y && s.bottom < pool.surface + 0.5 && touchesFromAbove(s, game.x, game.z, SWIM.radius + 0.5));
      let input: Input;
      if (beside && !game.under) {
        pressed = !pressed;
        input = { moveX: way.x, moveZ: way.z, jump: pressed };
      } else if (blocked || overhead) input = { moveX: way.x, moveZ: way.z, jump: false, move: true };
      else input = { moveX: way.x, moveZ: way.z, jump: game.under };
      game.step(input);
    }
  }
  return !game.swimming && game.grounded ? game.groundId : null;
};
