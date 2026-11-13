// A simple player for the tests. It looks at the game the way a player would
// (where am I, what is the next thing to stand on) and decides which way to push
// the stick and when to press Jump. It follows the level's route, so the same
// bot plays any level built from solids.

import type { Enemy } from '../../src/game/enemy';
import { Game, type Input } from '../../src/game/game';
import { MOVE, STEP } from '../../src/game/hero';
import { surfaceBelow, type Level, type Solid } from '../../src/game/level';

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

  constructor(private readonly level: Level) {}

  /** Decides this step's input from what the game looks like right now. */
  input(game: Game): Input {
    const { level } = this;
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
      const edgeAhead = !groundAhead || groundAhead.top < game.y - 0.05;
      // Jump at a step too high to walk up, once close to it.
      const tooHighToStep = next !== undefined && next.top > game.y + level.ledgeHelp;
      const closeToStep = next !== undefined && distanceToEdge(next, game.x, game.z) < 1.3;
      // Never while still running to a corner: the turn comes first.
      pressJump = easing && (edgeAhead || (tooHighToStep && closeToStep));
    }
    // Hold Jump all the way up for a full jump, then let go.
    if (pressJump) this.holdingJump = true;
    else if (game.vy <= 0) this.holdingJump = false;

    return { moveX, moveZ, jump: this.holdingJump };
  }
}

/** Plays the level with the bot until the leaf is reached or time runs out. */
export const playWithBot = (game: Game, maxSeconds = 120): Game => {
  const bot = new Bot(game.level);
  for (let i = 0; i < maxSeconds / STEP && !game.complete; i += 1) game.step(bot.input(game));
  return game;
};
