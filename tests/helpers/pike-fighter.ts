// How the test bot fights a monster pike (src/game/pike.ts), the way a careful
// player would, on walk, jump and the fishing button alone:
//   - on the dock it walks to the fishing spot and casts onto the pike's circle,
//     a little ahead of its shadow, winds in if anything else takes the lure,
//     hooks the bite, reels while the pike tires and lets the line run while it
//     thrashes;
//   - dragged in, it swims for the floating log and climbs onto it, getting out
//     of the line of a charge on the way;
//   - on the log it steps clear of where the jaws are aimed, and jumps onto the
//     pike when a hit would count;
//   - with the pike beaten it swims to the nearest way out that leads back to
//     the route (the dock's steps) and climbs back up.
// It reads the game as it is and keeps only what a player keeps in their head.

import { IDLE, type Game, type Input } from '../../src/game/game';
import { MONSTER_ID } from '../../src/game/fishing';
import { MOVE, STEP } from '../../src/game/hero';
import { topAt, type Solid } from '../../src/game/level';
import { PIKE, pikeFighting, pikeOpen } from '../../src/game/pike';
import { SWIM } from '../../src/game/swim';

/** What the bot keeps between steps while it deals with a pike. Plain values, so a copy of the bot copies it. */
export interface PikeFighter {
  /** True once the bot has taken the pike on: it then sees it through to standing on the route again. */
  engaged: boolean;
  /** Presses must be fresh: the fishing button, and Jump, were up on the step before. */
  buttonUp: boolean;
  jumpUp: boolean;
  /** Seconds the line has waited with nothing coming. */
  idle: number;
  /** Holding Jump on the way up in a leap at the pike. */
  leaping: boolean;
  holdingJump: boolean;
  /** The step, or the route's last solid, the bot is hopping up to. */
  leapTo: string | null;
}

export const newPikeFighter = (): PikeFighter => ({ engaged: false, buttonUp: true, jumpUp: true, idle: 0, leaping: false, holdingJump: false, leapTo: null });

const edgeDistance = (s: Solid, x: number, z: number): number =>
  s.shape === 'round' ? Math.max(Math.hypot(x - s.x, z - s.z) - s.halfX, 0) : Math.hypot(Math.max(Math.abs(x - s.x) - s.halfX, 0), Math.max(Math.abs(z - s.z) - s.halfZ, 0));

const inside = (s: Solid, x: number, z: number, inset: number): { x: number; z: number } => ({
  x: Math.max(s.x - s.halfX + Math.min(inset, s.halfX * 0.8), Math.min(s.x + s.halfX - Math.min(inset, s.halfX * 0.8), x)),
  z: Math.max(s.z - s.halfZ + Math.min(inset, s.halfZ * 0.8), Math.min(s.z + s.halfZ - Math.min(inset, s.halfZ * 0.8), z)),
});

const toward = (game: Game, x: number, z: number, ease = 1.2): { moveX: number; moveZ: number; far: number } => {
  const dx = x - game.x;
  const dz = z - game.z;
  const far = Math.hypot(dx, dz);
  const push = Math.min(far / ease, 1);
  return { moveX: far > 1e-6 ? (dx / far) * push : 0, moveZ: far > 1e-6 ? (dz / far) * push : 0, far };
};

/** The solids that lead from the water back up to the last solid of the route, lowest first: the dock's steps. */
const wayUp = (game: Game): Solid[] => {
  const { level } = game;
  const last = level.solids.find((s) => s.id === level.route[level.route.length - 1]);
  const pool = level.water?.find((w) => w.id === level.pike?.water);
  if (!last || !pool) return [];
  // Anything off the route that stands in the pike's pool beside the last solid, between the water and its top.
  const steps = level.solids.filter(
    (s) => !level.route.includes(s.id) && s.id !== level.pike?.log && s.id !== level.fishing?.solid && s.top < last.top - 0.05 && s.top > pool.surface && edgeDistance(last, s.x, s.z) < s.halfX + s.halfZ + 0.5,
  );
  return steps.sort((a, b) => a.top - b.top);
};

/** True when the bot should deal with the pike on this step rather than follow the route. */
export const pikeWants = (state: PikeFighter, game: Game): boolean => {
  const { pike, level } = game;
  if (!pike || !level.fishing) return false;
  const last = level.route[level.route.length - 1];
  if (pike.phase === 'beaten') {
    // Seen through: back on the route, the bot carries on to the leaf.
    if (state.engaged && game.grounded && game.groundId === last) state.engaged = false;
    return state.engaged;
  }
  if (pikeFighting(pike)) state.engaged = true;
  // Not hooked yet: it is the bot's business only while it stands on the dock or the jetty.
  else state.engaged = game.grounded && (game.groundId === last || game.groundId === level.fishing.solid);
  return state.engaged;
};

export const pikeInput = (state: PikeFighter, game: Game): Input => {
  const { level } = game;
  const pike = game.pike!;
  const spot = level.fishing!;
  const fishing = game.fishing!;
  const log = level.solids.find((s) => s.id === pike.spot.log)!;
  const n = pike.spot.numbers;
  const jump = (want: boolean): boolean => {
    const press = want && state.jumpUp;
    state.jumpUp = !want;
    return press;
  };
  if (game.climbing > 0) return IDLE;

  // BEATEN: out of the water by the steps, and up them to the route.
  if (pike.phase === 'beaten') {
    const steps = wayUp(game);
    const last = level.solids.find((s) => s.id === level.route[level.route.length - 1])!;
    if (game.swimming) {
      const step = steps[0] ?? last;
      const aim = inside(step, game.x, game.z, 0.5);
      const go = toward(game, aim.x, aim.z, 0.3);
      const beside = edgeDistance(step, game.x, game.z) < SWIM.radius + SWIM.climbReach - 0.1;
      return { moveX: go.moveX, moveZ: go.moveZ, jump: beside ? jump(true) : (jump(false), game.under) };
    }
    if (!game.grounded) {
      // In the air (a rebound, or a hop up a step): steer for the next thing to stand on.
      const index = steps.findIndex((s) => s.id === state.leapTo);
      const next = index >= 0 ? steps[index] : state.leapTo === last.id ? last : null;
      if (game.vy <= 0) state.holdingJump = false;
      if (!next) return { ...IDLE, jump: state.holdingJump };
      const aim = inside(next, game.x, game.z, 0.6);
      const go = toward(game, aim.x, aim.z);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: state.holdingJump };
    }
    const here = steps.findIndex((s) => s.id === game.groundId);
    if (here < 0) {
      // On the floating log, or anywhere else: into the water toward the steps.
      const step = steps[0] ?? last;
      const go = toward(game, step.x, step.z);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
    }
    const next = steps[here + 1] ?? last;
    const aim = inside(next, game.x, game.z, 0.6);
    const go = toward(game, aim.x, aim.z);
    const close = edgeDistance(next, game.x, game.z) < 1.2;
    if (close && topAt(next, aim.x, aim.z) > game.y + level.ledgeHelp) {
      state.holdingJump = true;
      state.leapTo = next.id;
    }
    return { moveX: go.moveX, moveZ: go.moveZ, jump: state.holdingJump };
  }

  // THE WATER HALF.
  if (pike.phase !== 'lurking' && pike.phase !== 'hooked') {
    state.buttonUp = true;
    if (game.swimming) {
      state.leaping = false;
      state.holdingJump = false;
      const aim = inside(log, game.x, game.z, 0.6);
      let go = toward(game, aim.x, aim.z, 0.3);
      // A charge is coming down a fixed line: get out of it, to the log's side if that is clear.
      if (pike.phase === 'charge-tell' || pike.phase === 'charge') {
        const lx = pike.target.x - pike.from.x;
        const lz = pike.target.z - pike.from.z;
        const length = Math.hypot(lx, lz) || 1;
        const side = ((game.x - pike.from.x) * lz - (game.z - pike.from.z) * lx) / length;
        const lane = PIKE.radius + MOVE.bodyRadius + 0.9;
        if (Math.abs(side) < lane) {
          const way = side >= 0 ? 1 : -1;
          go = { moveX: (lz / length) * way, moveZ: (-lx / length) * way, far: go.far };
        }
      }
      const beside = edgeDistance(log, game.x, game.z) < SWIM.radius + SWIM.climbReach - 0.1;
      return { moveX: go.moveX, moveZ: go.moveZ, jump: beside ? jump(true) : (jump(false), game.under) };
    }
    const dx = pike.x - game.x;
    const dz = pike.z - game.z;
    const distance = Math.hypot(dx, dz) || 1e-6;
    if (!game.grounded) {
      // In the air: on the way down onto the pike, or coming back off it to the log.
      if (game.vy <= 0) state.holdingJump = false;
      if (game.events.some((event) => event.type === 'pike' && (event.what === 'hit' || event.what === 'blocked'))) state.leaping = false;
      if (state.leaping && pikeOpen(pike)) {
        const push = Math.min(distance / 0.6, 1);
        return { moveX: (dx / distance) * push, moveZ: (dz / distance) * push, jump: state.holdingJump };
      }
      const aim = inside(log, game.x, game.z, 0.7);
      const go = toward(game, aim.x, aim.z);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: state.holdingJump };
    }
    state.leaping = false;
    if (game.groundId !== log.id) {
      // Somewhere else (the dock's steps after a throw): back into the water and to the log.
      const go = toward(game, log.x, log.z);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
    }
    // On the log. Open to a hit, with time to get there: run at it and jump.
    const timeLeft = pike.phase === 'rest' ? n.rest - pike.timer : Infinity;
    if (pikeOpen(pike) && timeLeft > 0.9) {
      if (distance < 3.6) {
        state.leaping = true;
        state.holdingJump = true;
      }
      return { moveX: dx / distance, moveZ: dz / distance, jump: state.holdingJump };
    }
    // Jaws open and not to be hit yet: step along the log, clear of where they are aimed.
    const longZ = log.halfZ >= log.halfX;
    const along = (value: { x: number; z: number }): number => (longZ ? value.z : value.x);
    const middle = longZ ? log.z : log.x;
    const half = (longZ ? log.halfZ : log.halfX) - 0.8;
    if (pike.phase === 'gape' || pike.phase === 'snap' || pike.phase === 'rising') {
      const aimed = pike.phase === 'rising' ? along(game) : along(pike.target);
      const clear = n.snapReach + 1;
      // Whichever end of the log has room.
      const up = aimed + clear <= middle + half;
      const down = aimed - clear >= middle - half;
      const want = pike.phase === 'rising' ? along(game) : up && (!down || along(game) >= aimed) ? aimed + clear : aimed - clear;
      const at = longZ ? { x: log.x, z: want } : { x: want, z: log.z };
      const go = toward(game, at.x, at.z, 0.5);
      return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
    }
    // Otherwise wait in the middle of the log.
    const go = toward(game, log.x, log.z, 0.8);
    return { moveX: go.far > 0.3 ? go.moveX : 0, moveZ: go.far > 0.3 ? go.moveZ : 0, jump: false };
  }

  // FISHING FOR IT. First to the spot: along the dock to where the jetty leaves it, then out.
  if (!game.grounded) return IDLE;
  const onSpot = game.groundId === spot.solid && Math.hypot(game.x - spot.x, game.z - spot.z) <= spot.radius * 0.5;
  if (fishing.phase === 'off' && !onSpot) {
    const jetty = level.solids.find((s) => s.id === spot.solid)!;
    const lined = game.groundId === spot.solid || Math.abs((game.x - spot.x) * spot.ahead.z - (game.z - spot.z) * spot.ahead.x) < Math.min(jetty.halfX, jetty.halfZ) * 0.5;
    // The foot of the jetty: straight back from the spot, just onto the ground behind it.
    const back = (longWay: number): { x: number; z: number } => ({ x: spot.x - spot.ahead.x * longWay, z: spot.z - spot.ahead.z * longWay });
    const reach = Math.abs(spot.ahead.z) > 0.5 ? jetty.halfZ * 2 : jetty.halfX * 2;
    const aim = lined ? { x: spot.x, z: spot.z } : back(reach + 0.6);
    const go = toward(game, aim.x, aim.z, lined ? 1.2 : 0.4);
    state.buttonUp = true;
    return { moveX: go.moveX, moveZ: go.moveZ, jump: false };
  }
  const press = (): Input => {
    const move = state.buttonUp;
    state.buttonUp = !move;
    return { ...IDLE, move };
  };
  const hold = (extra: Partial<Input> = {}): Input => {
    state.buttonUp = false;
    return { ...IDLE, move: true, ...extra };
  };
  const rest = (extra: Partial<Input> = {}): Input => {
    state.buttonUp = true;
    return { ...IDLE, ...extra };
  };
  switch (fishing.phase) {
    case 'off':
      state.idle = 0;
      return pike.sulk > 0 ? rest() : press();
    case 'aim': {
      // A little ahead of the shadow on its circle: it swims onto the lure.
      const here = Math.atan2(pike.x - pike.spot.home.x, pike.z - pike.spot.home.z) + 0.75;
      const x = pike.spot.home.x + Math.sin(here) * pike.spot.circle;
      const z = pike.spot.home.z + Math.cos(here) * pike.spot.circle;
      const out = (x - spot.x) * spot.ahead.x + (z - spot.z) * spot.ahead.z;
      const across = (x - spot.x) * -spot.ahead.z + (z - spot.z) * spot.ahead.x;
      const side = across - fishing.across;
      const stick = Math.abs(side) > 0.15 ? Math.sign(side) : 0;
      const steer = { moveX: -spot.ahead.z * stick, moveZ: spot.ahead.x * stick };
      const near = Math.abs(fishing.out - out) <= Math.max(0.5, spot.numbers.sweep * STEP * 1.5) && Math.abs(side) < 0.5;
      return near ? rest() : hold(steer);
    }
    case 'wait': {
      const taker = fishing.taker;
      state.idle = taker === MONSTER_ID ? 0 : state.idle + STEP;
      // Something else has the lure, or the pike has gone by: wind in and cast again.
      if ((taker !== null && taker !== MONSTER_ID) || state.idle > 4) return rest({ jump: true });
      return rest();
    }
    case 'bite':
      return fishing.taker === MONSTER_ID ? press() : rest({ jump: spot.numbers.biteWindow === Infinity });
    case 'hooked':
      return fishing.fight === 'thrash' ? rest() : hold();
    default:
      return rest();
  }
};
