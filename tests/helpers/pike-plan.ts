// The test bot's way with the monster pike (src/game/pike.ts). It does what a
// careful player does, reading only what a player can see:
//
//   - On the dock it walks to the fishing spot, casts at the big shadow, hooks
//     it, reels while it tires and lets the line run while it thrashes.
//   - Dragged into the lake, it swims for the floating log, out of the line of
//     a charge, and climbs on.
//   - On the log it waits a little off the middle. When the jaws come up at
//     one end it runs down the log past where they will land; when the pike
//     lies spent it runs back and jumps on its head. Walk and jump alone.
//
// Once the pike is beaten the bot itself finds the way back to the dock
// (`wayBack`, used by bot.ts).

import { onSpot } from '../../src/game/fishing';
import { IDLE, type Game, type Input } from '../../src/game/game';
import { MOVE, STEP } from '../../src/game/hero';
import type { Level, Solid } from '../../src/game/level';
import { PIKE, pikeInWater } from '../../src/game/pike';
import { SWIM } from '../../src/game/swim';

const edgeDistance = (s: Solid, x: number, z: number): number =>
  s.shape === 'round' ? Math.max(Math.hypot(x - s.x, z - s.z) - s.halfX, 0) : Math.hypot(Math.max(Math.abs(x - s.x) - s.halfX, 0), Math.max(Math.abs(z - s.z) - s.halfZ, 0));

/** The stick pushed toward a point, easing off close to it. */
const toward = (game: Game, x: number, z: number, ease = 0.6): { moveX: number; moveZ: number; far: number } => {
  const dx = x - game.x;
  const dz = z - game.z;
  const far = Math.hypot(dx, dz);
  const push = Math.min(far / ease, 1);
  return { moveX: far > 1e-6 ? (dx / far) * push : 0, moveZ: far > 1e-6 ? (dz / far) * push : 0, far };
};

export class PikePlan {
  /** Fishing: presses must be fresh, and how long the line has waited with the monster not coming. */
  private up = true;
  private idle = 0;
  /** In the water: whether Jump was pressed on the last step (a climb needs a fresh press). */
  private pressed = false;
  /** On the log: in the air on the way to its head, and whether Jump is still held. */
  private leaping = false;
  private holdingJump = false;

  /** This step's input while the pike is the bot's business, or null when it is not (not there yet, or beaten). */
  input(game: Game): Input | null {
    const { pike, level, fishing } = game;
    const spot = level.fishing;
    if (!pike || !level.pike || !spot || !fishing || pike.phase === 'defeated') return null;
    if (pike.phase === 'lurking' || pike.phase === 'hooked') return this.fish(game);
    if (pike.phase === 'dragging' && !game.swimming) return IDLE;
    if (!pikeInWater(pike)) return null;
    const log = level.solids.find((s) => s.id === level.pike!.log)!;
    if (game.climbing > 0) return IDLE;
    if (game.swimming) return this.swim(game, log);
    return this.onLog(game, log);
  }

  /** The tug of war: to the spot, a cast at the big shadow, the hook, and the reel. */
  private fish(game: Game): Input | null {
    const level = game.level;
    const spot = level.fishing!;
    const state = game.fishing!;
    const busy = state.phase !== 'off';
    const last = level.route[level.route.length - 1];
    if (!busy && game.groundId !== last && game.groundId !== spot.solid) return null;
    if (!busy && !onSpot(spot, game.groundId, game.x, game.z)) {
      // Walk to the spot, well inside it.
      const go = toward(game, spot.x, spot.z, 1);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
    }
    if (!busy && Math.hypot(game.vx, game.vz) > 0.3) return IDLE;
    const press = (): Input => {
      const move = this.up;
      this.up = !move;
      return { ...IDLE, move };
    };
    const hold = (extra: Partial<Input> = {}): Input => {
      this.up = false;
      return { ...IDLE, move: true, ...extra };
    };
    const rest = (extra: Partial<Input> = {}): Input => {
      this.up = true;
      return { ...IDLE, ...extra };
    };
    const monster = state.fish.find((fish) => fish.monster);
    switch (state.phase) {
      case 'off':
        this.idle = 0;
        return press();
      case 'aim': {
        if (!monster || monster.mood !== 'idle') return hold();
        const n = spot.numbers;
        // Where it will be when the lure lands: it swims on the way it is heading.
        const speed = n.monster?.cruise ?? 0;
        const ahead = n.castHelp ? 0 : 0.55;
        const out = monster.out + Math.cos(monster.heading) * speed * ahead;
        const across = monster.across + Math.sin(monster.heading) * speed * ahead;
        const side = across - state.across;
        const stick = Math.abs(side) > 0.15 ? Math.sign(side) : 0;
        const steer = { moveX: -spot.ahead.z * stick, moveZ: spot.ahead.x * stick };
        // With help the cast goes to it from anywhere near; without, the ring has to be on it.
        const within = n.castHelp ? 2.5 : Math.min(0.8, n.notice * 0.5);
        const near = Math.abs(state.out - out) <= Math.max(within, n.sweep * STEP) && Math.abs(side) < within;
        return near ? rest() : hold(steer);
      }
      case 'wait': {
        const taker = state.fish.find((fish) => fish.id === state.taker);
        this.idle = taker ? 0 : this.idle + STEP;
        // Nothing is coming, or the wrong fish is: wind in and cast again.
        if (this.idle > 2.5 || (taker && !taker.monster)) return rest({ jump: true });
        return rest();
      }
      case 'bite':
        return press();
      case 'hooked':
        return state.fight === 'thrash' ? rest() : hold();
      default:
        return rest();
    }
  }

  /** In the pike's water: out of the line of a charge, then to the log and up onto it. */
  private swim(game: Game, log: Solid): Input {
    const pike = game.pike!;
    if (pike.phase === 'chargeTell' || pike.phase === 'charge') {
      const lx = pike.target.x - pike.from.x;
      const lz = pike.target.z - pike.from.z;
      const length = Math.hypot(lx, lz) || 1;
      const side = ((game.x - pike.from.x) * lz - (game.z - pike.from.z) * lx) / length;
      const along = ((game.x - pike.from.x) * lx + (game.z - pike.from.z) * lz) / length;
      if (Math.abs(side) < PIKE.radius + MOVE.bodyRadius + 1.6 && along > -2 && along < length + 2) {
        // Straight out of the line, to the side the swimmer is already on (or the log's side, when right on it).
        const sign = Math.abs(side) > 0.2 ? Math.sign(side) : Math.sign((log.x - game.x) * lz - (log.z - game.z) * lx) || 1;
        this.pressed = false;
        return { moveX: (lz / length) * sign, moveZ: (-lx / length) * sign, jump: false };
      }
    }
    const aim = { x: Math.max(log.x - log.halfX, Math.min(log.x + log.halfX, game.x)), z: Math.max(log.z - log.halfZ + 0.6, Math.min(log.z + log.halfZ - 0.6, game.z)) };
    const go = toward(game, aim.x, aim.z, 0.2);
    if (!game.under && edgeDistance(log, game.x, game.z) < SWIM.radius + SWIM.climbReach - 0.1) {
      this.pressed = !this.pressed;
      return { moveX: go.moveX, moveZ: go.moveZ, jump: this.pressed };
    }
    this.pressed = false;
    return { moveX: go.moveX, moveZ: go.moveZ, jump: game.under };
  }

  /** On the log, or in the air over it. */
  private onLog(game: Game, log: Solid): Input {
    const pike = game.pike!;
    const alongZ = log.halfZ >= log.halfX;
    const half = alongZ ? log.halfZ : log.halfX;
    const at = (u: number): { x: number; z: number } => (alongZ ? { x: log.x, z: log.z + u } : { x: log.x + u, z: log.z });
    const u = alongZ ? game.z - log.z : game.x - log.x;
    if (game.grounded) this.leaping = false;
    if (!game.grounded && game.vy <= 0) this.holdingJump = false;
    if (game.events.some((event) => event.type === 'boss' && event.what === 'hit')) {
      this.leaping = false;
      this.holdingJump = false;
    }

    // Standing somewhere else (the dock, a step): into the water, toward the log.
    if (game.grounded && game.groundId !== log.id) {
      const go = toward(game, log.x, log.z, 0.2);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
    }

    if (pike.phase === 'snapTell' || pike.phase === 'snap') {
      // Down the log, past where its head will land.
      const dx = pike.target.x - pike.from.x;
      const dz = pike.target.z - pike.from.z;
      const length = Math.hypot(dx, dz) || 1;
      const clear = PIKE.radius + MOVE.bodyRadius + 0.9;
      const lands = alongZ ? pike.target.z - log.z : pike.target.x - log.x;
      const way = Math.sign(alongZ ? dz / length : dx / length) || 1;
      const safe = Math.max(-(half - 0.45), Math.min(half - 0.45, lands + way * clear));
      const go = toward(game, at(safe).x, at(safe).z, 0.5);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
    }

    if (pike.phase === 'rest' || this.leaping) {
      // Spent, its head on the log: run at it and come down on top.
      const dx = pike.x - game.x;
      const dz = pike.z - game.z;
      const distance = Math.hypot(dx, dz) || 1e-6;
      const left = game.level.pike!.numbers.rest - pike.timer;
      const needed = Math.max(distance - 2.4, 0) / MOVE.walkSpeed + 0.55;
      if (this.leaping || left > needed) {
        const closing = (game.vx * dx + game.vz * dz) / distance;
        if (game.grounded && distance < 2.6 && (closing > 2.5 || distance < 1.9)) {
          this.holdingJump = true;
          this.leaping = true;
        }
        const push = this.leaping ? Math.min(distance / 0.5, 1) : 1;
        return { moveX: (dx / distance) * push, moveZ: (dz / distance) * push, jump: this.holdingJump };
      }
    }

    // Otherwise wait a little off the middle, on the side the bot is already on: whichever end it comes up at, there is log to run down.
    const wait = (u >= 0 ? 1 : -1) * Math.min(1, half * 0.3);
    const go = toward(game, at(wait).x, at(wait).z, 0.8);
    return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
  }
}

/**
 * After the pike: the way from its water back to the end of the route. The
 * pool's id, then the solids to climb out onto and hop up, ending on the
 * route's last solid: the fewest hops there are. Null when there is none.
 */
export const wayBack = (level: Level): string[] | null => {
  const spot = level.pike;
  const pool = level.water?.find((w) => w.id === spot?.water);
  const goal = level.route[level.route.length - 1];
  if (!spot || !pool) return null;
  const inPool = (s: Solid): boolean => s.x + s.halfX > pool.minX && s.x - s.halfX < pool.maxX && s.z + s.halfZ > pool.minZ && s.z - s.halfZ < pool.maxZ;
  const solids = level.solids.filter((s) => !s.gone && !s.noClimb && !s.bounce && !s.motion && s.id !== spot.log && inPool(s));
  const gap = (a: Solid, b: Solid): number => Math.hypot(Math.max(Math.abs(a.x - b.x) - a.halfX - b.halfX, 0), Math.max(Math.abs(a.z - b.z) - a.halfZ - b.halfZ, 0));
  const hops = (a: Solid, b: Solid): boolean => gap(a, b) <= 0.6 && b.top - a.top <= 1.6;
  let best: string[] | null = null;
  for (const start of solids) {
    if (start.top - pool.surface > SWIM.climbHeight || start.top < pool.surface - 0.2) continue;
    // The fewest hops from this way out to the goal.
    const from = new Map<string, string | null>([[start.id, null]]);
    const queue = [start];
    while (queue.length > 0) {
      const here = queue.shift()!;
      if (here.id === goal) break;
      for (const next of solids) {
        if (from.has(next.id) || !hops(here, next)) continue;
        from.set(next.id, here.id);
        queue.push(next);
      }
    }
    if (!from.has(goal)) continue;
    const path: string[] = [];
    for (let id: string | null = goal; id; id = from.get(id) ?? null) path.unshift(id);
    if (!best || path.length < best.length) best = path;
  }
  return best ? [pool.id, ...best] : null;
};
