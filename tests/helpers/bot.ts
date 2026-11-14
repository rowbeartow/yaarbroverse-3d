// A simple player for the tests. It looks at the game the way a player would
// (where am I, what is the next thing to stand on) and decides which way to push
// the stick and when to press Jump. It follows the level's route, so the same
// bot plays any level built from solids.

import { bossDangerous, bossFighting, bossOpen, type Boss } from '../../src/game/boss';
import type { Enemy } from '../../src/game/enemy';
import { Game, type Input } from '../../src/game/game';
import { MOVE, STEP } from '../../src/game/hero';
import { surfaceBelow, topAt, type Level, type Solid } from '../../src/game/level';
import { steadyFor } from '../../src/game/moving';

/** The spot on a solid the bot heads for: its middle if round, else the nearest point well inside. */
const aimPoint = (s: Solid, x: number, z: number): { x: number; z: number } => {
  if (s.shape === 'round') return { x: s.x, z: s.z };
  const insetX = Math.min(0.7, s.halfX * 0.8);
  const insetZ = Math.min(0.7, s.halfZ * 0.8);
  return {
    x: Math.max(s.x - s.halfX + insetX, Math.min(s.x + s.halfX - insetX, x)),
    z: Math.max(s.z - s.halfZ + insetZ, Math.min(s.z + s.halfZ - insetZ, z)),
  };
};

/** Distance from a point to the edge of a solid, seen from above (0 when over it). */
const distanceToEdge = (s: Solid, x: number, z: number): number => {
  if (s.shape === 'round') return Math.max(Math.hypot(x - s.x, z - s.z) - s.halfX, 0);
  return Math.hypot(Math.max(Math.abs(x - s.x) - s.halfX, 0), Math.max(Math.abs(z - s.z) - s.halfZ, 0));
};

/** A scout this close, on the bot's own footing and able to hurt, gets jumped on. */
const STOMP_FROM = 3;

export class Bot {
  /** Position in the level's route of the solid the bot last stood or bounced on. */
  private index = 0;
  private holdingJump = false;
  /** The enemy the bot is in the air over, on its way to landing on it. */
  private stomping: Enemy | null = null;

  /** The level is read from the game on every step, so moving pieces are where they are now. */
  constructor(_level?: Level) {}

  /** Decides this step's input from what the game looks like right now. */
  input(game: Game): Input {
    // The game's own copy of the level: its moving pieces are where the rules have them now.
    const level = game.level;
    for (const event of game.events) {
      if (event.type === 'bounce') this.index = level.route.indexOf(event.solidId);
    }
    if (game.grounded && game.groundId) this.index = level.route.indexOf(game.groundId);

    // A scout coming at the bot: jump, and come down on top of it. Landing on
    // an enemy strikes it on every difficulty, so this is walk and jump alone.
    const over = (event: Game['events'][number]): boolean => event.type === 'strike' || event.type === 'hurt' || event.type === 'bounce';
    if (this.stomping && (game.grounded || game.events.some(over) || (this.stomping.phase !== 'idle' && this.stomping.phase !== 'patrol'))) this.stomping = null;
    if (!this.stomping && game.grounded) {
      this.stomping =
        game.enemies.find(
          (enemy) =>
            enemy.kind === 'marmot' &&
            (enemy.phase === 'idle' || enemy.phase === 'patrol') &&
            Math.abs(enemy.y - game.y) < 0.5 &&
            Math.hypot(enemy.x - game.x, enemy.z - game.z) < STOMP_FROM,
        ) ?? null;
      if (this.stomping) this.holdingJump = true;
    }
    if (this.stomping) {
      const dx = this.stomping.x - game.x;
      const dz = this.stomping.z - game.z;
      const distance = Math.hypot(dx, dz);
      const push = Math.min(distance / 0.6, 1);
      // Hold Jump all the way up, then let go.
      if (!game.grounded && game.vy <= 0) this.holdingJump = false;
      return { moveX: distance > 1e-6 ? (dx / distance) * push : 0, moveZ: distance > 1e-6 ? (dz / distance) * push : 0, jump: this.holdingJump };
    }

    // A boss in the way: fight it. The goal cannot be taken until it is beaten.
    const boss = game.boss;
    if (boss && boss.phase !== 'defeated') {
      const a = boss.spot.arena;
      const inside = game.x >= a.minX - 1 && game.x <= a.maxX + 1 && game.z >= a.minZ - 1 && game.z <= a.maxZ + 3 && Math.abs(game.y - boss.spot.y) < 8;
      if (inside && (bossFighting(boss) || game.grounded)) return this.fight(game, boss);
    }

    const next = level.solids.find((s) => s.id === level.route[this.index + 1]);
    let aim = next ? aimPoint(next, game.x, game.z) : { x: level.leaf.x, z: level.leaf.z };
    let easing = true;
    // Where the route turns a corner, the straight line to the next piece
    // would leave this one too soon. Run along this piece first, to the spot
    // on it nearest the next piece, and turn there.
    const here = game.grounded ? level.solids.find((s) => s.id === game.groundId) : undefined;
    if (here && here.shape === 'box' && next) {
      const insetX = Math.min(0.3, here.halfX * 0.8);
      const insetZ = Math.min(0.3, here.halfZ * 0.8);
      const corner = {
        x: Math.max(here.x - here.halfX + insetX, Math.min(here.x + here.halfX - insetX, aim.x)),
        z: Math.max(here.z - here.halfZ + insetZ, Math.min(here.z + here.halfZ - insetZ, aim.z)),
      };
      const toCorner = Math.hypot(corner.x - game.x, corner.z - game.z);
      const toAim = Math.hypot(aim.x - game.x, aim.z - game.z);
      if (toCorner > 0.6 && toAim > 1e-6) {
        const sameWay = ((corner.x - game.x) * (aim.x - game.x) + (corner.z - game.z) * (aim.z - game.z)) / (toCorner * toAim);
        // More than about 25 degrees off the straight line: it is a corner.
        if (sameWay < 0.9) {
          aim = corner;
          easing = false;
        }
      }
    }
    // A windy bough (here or next) has to be resting, level with where the bot is going, for
    // long enough to get across. Until then, wait: on the bough, or at the edge before it.
    if (game.grounded && here && next && (next.motion?.kind === 'sway' || here.motion?.kind === 'sway')) {
      const toNext = distanceToEdge(next, game.x, game.z);
      const needed = toNext / MOVE.walkSpeed + 0.2;
      const even = Math.abs(topAt(next, next.x, next.z) - game.y) <= game.level.ledgeHelp + 0.05;
      const ready = even && steadyFor(next) > needed && steadyFor(here) > needed;
      if (!ready) {
        // Just inside the edge nearest the next piece.
        const inset = here.shape === 'box' ? { x: Math.min(0.35, here.halfX * 0.8), z: Math.min(0.35, here.halfZ * 0.8) } : { x: 0, z: 0 };
        const edge =
          here.shape === 'box'
            ? {
                x: Math.max(here.x - here.halfX + inset.x, Math.min(here.x + here.halfX - inset.x, aim.x)),
                z: Math.max(here.z - here.halfZ + inset.z, Math.min(here.z + here.halfZ - inset.z, aim.z)),
              }
            : { x: here.x, z: here.z };
        const toward = { x: edge.x - game.x, z: edge.z - game.z };
        // Walk to the edge nearest the next piece and wait there.
        const far = Math.hypot(toward.x, toward.z);
        const push = far > 0.15 ? Math.min(far / 1.2, 1) : 0;
        return { moveX: far > 0 ? (toward.x / far) * push : 0, moveZ: far > 0 ? (toward.z / far) * push : 0, jump: false };
      }
    }
    const dx = aim.x - game.x;
    const dz = aim.z - game.z;
    const distance = Math.hypot(dx, dz);
    // Push the stick fully until close, then ease off so the hero does not overshoot.
    const push = easing ? Math.min(distance / 1.2, 1) : 1;
    const moveX = distance > 1e-6 ? (dx / distance) * push : 0;
    const moveZ = distance > 1e-6 ? (dz / distance) * push : 0;

    let pressJump = false;
    if (game.grounded && distance > 1e-6) {
      // Jump at an edge: the ground a short step ahead is gone.
      const aheadX = game.x + (dx / distance) * 0.35;
      const aheadZ = game.z + (dz / distance) * 0.35;
      const groundAhead = surfaceBelow(level, aheadX, aheadZ, game.y + level.ledgeHelp, MOVE.footRadius);
      // Walking down a tipping log is not an edge: only a drop onto something else, or into the air, is.
      const edgeAhead = !groundAhead || (groundAhead.id !== game.groundId && topAt(groundAhead, aheadX, aheadZ) < game.y - 0.05);
      // Jump at a step too high to walk up, once close to it.
      const tooHighToStep = next !== undefined && topAt(next, aim.x, aim.z) > game.y + level.ledgeHelp;
      const closeToStep = next !== undefined && distanceToEdge(next, game.x, game.z) < 1.3;
      // Never while still running to a corner: the turn comes first.
      pressJump = easing && (edgeAhead || (tooHighToStep && closeToStep));
    }
    // Hold Jump all the way up for a full jump, then let go.
    if (pressJump) this.holdingJump = true;
    else if (game.vy <= 0) this.holdingJump = false;

    return { moveX, moveZ, jump: this.holdingJump };
  }

  private way: Way = 1;
  /** Which side of an aimed attack the bot is getting clear to: 1, -1, or 0 when nothing is aimed. */
  private dodge = 0;
  private leaping = false;

  /**
   * Fighting a boss, the way a careful player would: keep moving round it at
   * a distance, so nothing aimed at where the hero stood can land; step out
   * of the line of a charge; and when it is open to a hit, run in and come
   * down on top of it. Walk and jump alone.
   */
  private fight(game: Game, boss: Boss): Input {
    const { spot } = boss;
    const n = spot.numbers;
    const dx = boss.x - game.x;
    const dz = boss.z - game.z;
    const distance = Math.hypot(dx, dz) || 1e-6;
    // Back on the ground, or the leap has done its work (a hit, or a bounce off its guard): the leap is over.
    if (game.grounded || game.events.some((event) => event.type === 'boss' && (event.what === 'hit' || event.what === 'blocked'))) this.leaping = false;
    if (!game.grounded && game.vy <= 0) this.holdingJump = false;

    // Open to a hit, with time to get there: go for it.
    const settled = boss.phase === 'rest' || (!n.guarded && (boss.phase === 'idle' || boss.phase === 'warning'));
    const timeLeft = boss.phase === 'rest' ? n.rest - boss.timer : Infinity;
    const timeNeeded = Math.max(distance - 3.2, 0) / MOVE.walkSpeed + 0.6;
    const going = this.leaping || (settled && bossOpen(boss) && timeLeft > timeNeeded);
    if (going) {
      // Leave the ground about three metres out, and steer to stay over it on the way down.
      // Only once it is running at the boss: a leap begun while still drifting away falls short.
      const closing = (game.vx * dx + game.vz * dz) / distance;
      if (game.grounded && distance < 3.4 && closing > 4 && (distance > 2.6 || !bossDangerous(boss))) {
        this.holdingJump = true;
        this.leaping = true;
      }
      // Too close to a boss that hurts to touch: step back to leaping distance first.
      if (!this.leaping && game.grounded && distance <= 2.6 && bossDangerous(boss)) {
        return { moveX: -dx / distance, moveZ: -dz / distance, jump: false };
      }
      const push = this.leaping ? Math.min(distance / 0.6, 1) : 1;
      return { moveX: (dx / distance) * push, moveZ: (dz / distance) * push, jump: this.holdingJump };
    }

    // Otherwise keep moving round it, about five metres off, inside the arena.
    const { arena } = spot;
    const room = { minX: arena.minX + 0.8, maxX: arena.maxX - 0.8, minZ: arena.minZ + 0.8, maxZ: arena.maxZ - 0.8 };
    const want = 5.2;
    const step = (way: Way): { x: number; z: number } => {
      // A little way round the circle, pulled in or out toward the distance wanted.
      const away = { x: -dx / distance, z: -dz / distance };
      const round = { x: -away.z * way, z: away.x * way };
      const pull = Math.max(-1, Math.min(1, (want - distance) / 1.5));
      return { x: round.x + away.x * pull, z: round.z + away.z * pull };
    };
    const blocked = (heading: { x: number; z: number }): boolean => {
      const x = game.x + heading.x * 1;
      const z = game.z + heading.z * 1;
      return x < room.minX || x > room.maxX || z < room.minZ || z > room.maxZ;
    };
    let heading = step(this.way);
    if (blocked(heading)) {
      this.way = -this.way as Way;
      heading = step(this.way);
    }
    // An attack is coming down a fixed line (a charge), or a fan either side of one (a throw):
    // get clear of it, to the side with more room, and stay clear until it is over.
    const aimed = (boss.attack === 'charge' || boss.attack === 'throw') && (boss.phase === 'warning' || boss.phase === 'attack');
    if (!aimed) this.dodge = 0;
    else {
      const lx = boss.target.x - boss.from.x;
      const lz = boss.target.z - boss.from.z;
      const length = Math.hypot(lx, lz) || 1;
      const side = ((game.x - boss.from.x) * lz - (game.z - boss.from.z) * lx) / length;
      const along = ((game.x - boss.from.x) * lx + (game.z - boss.from.z) * lz) / length;
      const fan = boss.attack === 'throw' ? Math.tan((((Math.max(1, n.acorns) - 1) / 2) * n.spread * Math.PI) / 180) * Math.max(along, 0) : 0;
      const lane = (boss.attack === 'charge' ? spot.radius : 0.3) + MOVE.bodyRadius + 1.2 + fan;
      const out = (sign: number): { x: number; z: number } => ({ x: (lz / length) * sign, z: (-lx / length) * sign });
      if (this.dodge === 0) {
        // Which side has room for the whole dodge?
        const roomFor = (sign: number): boolean => {
          const x = game.x + out(sign).x * (lane + 0.5);
          const z = game.z + out(sign).z * (lane + 0.5);
          return x >= room.minX && x <= room.maxX && z >= room.minZ && z <= room.maxZ;
        };
        const nearer = side >= 0 ? 1 : -1;
        this.dodge = roomFor(nearer) ? nearer : roomFor(-nearer) ? -nearer : nearer;
      }
      if (side * this.dodge < lane) heading = out(this.dodge);
      else {
        // Clear of it. With sidekicks about, standing still is asking for a dive: keep going,
        // further out if there is room, else along beside the line.
        const about = game.enemies.some((enemy) => enemy.spot.sidekickOf === spot.id && !enemy.dormant && enemy.phase !== 'defeated');
        const beside = { x: -lx / length, z: -lz / length };
        heading = !about ? { x: 0, z: 0 } : !blocked(out(this.dodge)) ? out(this.dodge) : !blocked(beside) ? beside : { x: -beside.x, z: -beside.z };
      }
    }
    // A sidekick has fixed its dive on a spot, or is on the way down to it: keep clear of that spot.
    for (const enemy of game.enemies) {
      if (enemy.spot.sidekickOf !== spot.id || enemy.dormant || (enemy.phase !== 'warning' && enemy.phase !== 'attack')) continue;
      const fromX = game.x - enemy.target.x;
      const fromZ = game.z - enemy.target.z;
      const off = Math.hypot(fromX, fromZ);
      if (off < 2.2) {
        const size = Math.hypot(heading.x, heading.z) || 1;
        const away = off > 0.05 ? { x: fromX / off, z: fromZ / off } : { x: heading.x / size, z: heading.z / size };
        heading = { x: heading.x / size + away.x * 1.5, z: heading.z / size + away.z * 1.5 };
      }
    }
    // A sidekick down low (resting where it dived, or just rising from there) is not to be walked into.
    for (const enemy of game.enemies) {
      if (enemy.spot.sidekickOf !== spot.id || enemy.dormant || (enemy.phase !== 'idle' && enemy.phase !== 'rest')) continue;
      if (enemy.y > game.y + MOVE.bodyHeight + 0.8) continue;
      const fromX = game.x - enemy.x;
      const fromZ = game.z - enemy.z;
      const off = Math.hypot(fromX, fromZ);
      if (off < 2.4 && off > 0.05) {
        const size = Math.hypot(heading.x, heading.z) || 1;
        heading = { x: heading.x / size + (fromX / off) * 2, z: heading.z / size + (fromZ / off) * 2 };
      }
    }
    // Never off the edge of the arena.
    const pushed = Math.hypot(heading.x, heading.z);
    if (pushed > 1) heading = { x: heading.x / pushed, z: heading.z / pushed };
    if (blocked(heading)) {
      const cx = (room.minX + room.maxX) / 2 - game.x;
      const cz = (room.minZ + room.maxZ) / 2 - game.z;
      const c = Math.hypot(cx, cz) || 1;
      heading = { x: cx / c, z: cz / c };
    }
    const size = Math.hypot(heading.x, heading.z);
    return size > 1e-6 ? { moveX: heading.x / size, moveZ: heading.z / size, jump: false } : { moveX: 0, moveZ: 0, jump: false };
  }
}

/** Which way round the boss the bot is circling: 1 or -1. */
type Way = 1 | -1;

/** Plays the level with the bot until the leaf is reached or time runs out. */
export const playWithBot = (game: Game, maxSeconds = 120): Game => {
  const bot = new Bot(game.level);
  for (let i = 0; i < maxSeconds / STEP && !game.complete; i += 1) game.step(bot.input(game));
  return game;
};
