// Cocolalla Lake as reshaped in milestone nine: its sections and which way
// the camera faces in each, how long a perfect run takes, what each
// difficulty changes, and the lake's own rules: a missed jump lands in the
// water, the high banks cannot be climbed onto from it, nobody swims past a
// section, and the rocky point can only be passed underwater. Times come from the bot, which plays by the
// same rules a player does. `LAKE_TIMES=1 npx vitest run tests/lake.test.ts
// --silent=false` prints when a perfect run reaches the end of each section.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { HEROES, STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { SWIM, passageNear } from '../src/game/swim';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { routeFaults, routeShape } from '../src/game/route-shape';
import { LAKE_CAMERA, LAKE_SHAPE, buildLake } from '../src/levels/cocolalla/layout';
import { cameraFor } from '../src/view/route-camera';
import { Bot } from './helpers/bot';

const byId = (level: Level, id: string): Solid => {
  const found = level.solids.find((s) => s.id === id);
  if (!found) throw new Error(`No solid called ${id}`);
  return found;
};

/** A clean run by the bot: the time each solid was first stood on, the longest stretch underwater, and the finish time. */
const cleanRun = (difficulty: Difficulty, hero: (typeof HEROES)[number] = 'Yaarbro') => {
  const level = buildLake(difficulty);
  const game = new Game(level, difficulty, hero);
  const bot = new Bot(level);
  const reached = new Map<string, number>([[level.route[0], 0]]);
  let under = 0;
  let longestUnder = 0;
  for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
    game.step(bot.input(game));
    for (const id of [game.groundId, game.waterId]) if (id && !reached.has(id)) reached.set(id, game.seconds);
    under = game.under ? under + STEP : 0;
    longestUnder = Math.max(longestUnder, under);
  }
  expect(game.complete).toBe(true);
  expect(game.falls).toBe(0);
  return { level, reached, seconds: game.seconds, longestUnder };
};

/** How long a perfect run of the whole lake should take on each difficulty, in seconds. */
const RUN_TIME: Record<Difficulty, [number, number]> = {
  easy: [45, 75],
  normal: [55, 90],
  hard: [65, 110],
};

describe('the eight sections', () => {
  it('are the ones in the route plan, on every difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      expect((buildLake(difficulty).sections ?? []).map((s) => s.name)).toEqual([
        'The Shore Path',
        'The Crocodile Crossing',
        'The Swinging Pines',
        'The Sunken Logs',
        'The Open Water',
        'The Rock Tunnel',
        'Cattail Cove',
        'The Old Pier',
      ]);
    }
  });

  it('the route winds: it meets the route rule with room to spare, and about a fifth of it runs left', () => {
    for (const difficulty of DIFFICULTIES) {
      const shape = routeShape(buildLake(difficulty));
      expect(routeFaults(shape), difficulty).toEqual([]);
      // The owner asked for about 20% leftward movement and a third camera turn.
      expect(shape.left, difficulty).toBeGreaterThan(0.18);
      expect(shape.cameraTurns, difficulty).toBeGreaterThanOrEqual(3);
      expect(shape.away, difficulty).toBeLessThan(0.45);
    }
  });

  it('the camera looks north along the shore, up the channel for the crossing, west through the tunnel and up the cove, and north again on the pier', () => {
    const level = buildLake('normal');
    const facing = (id: string): number => cameraFor(level, id).facing;
    expect(facing('beach')).toBe(LAKE_CAMERA.shore);
    // It turns on the bank a section ends on, before the hero sets out.
    expect(facing('point')).toBe(LAKE_CAMERA.crossing);
    expect(facing('island')).toBe(LAKE_CAMERA.pines);
    expect(facing('headland')).toBe(LAKE_CAMERA.logs);
    expect(cameraFor(level, 'gravel-bar')).toEqual({ facing: LAKE_CAMERA.open, pull: LAKE_CAMERA.openPull });
    expect(facing('reed-bar')).toBe(LAKE_CAMERA.tunnel);
    expect(facing('cove-beach')).toBe(LAKE_CAMERA.cove);
    expect(facing('post-1')).toBe(LAKE_CAMERA.cove);
    expect(facing('landing')).toBe(LAKE_CAMERA.pier);
    expect(facing('dock')).toBe(LAKE_CAMERA.pier);
    // Never south: the mountains are to the north.
    for (const section of level.sections ?? []) expect(Math.abs((((section.facing ?? 0) + 180) % 360) - 180), section.name).toBeLessThanOrEqual(90);
  });
});

describe.each(DIFFICULTIES)('the lake on %s', (difficulty) => {
  const { level, reached, seconds, longestUnder } = cleanRun(difficulty);
  const sections = level.sections ?? [];

  if (process.env.LAKE_TIMES) {
    const ends = sections.map((s) => `${s.name} ${(reached.get(s.solids[s.solids.length - 1]) ?? seconds).toFixed(1)}`);
    console.log(`${difficulty}: ${ends.join(', ')}; leaf ${seconds.toFixed(1)} s; longest underwater ${longestUnder.toFixed(1)} s`);
  }

  it('a perfect run takes about as long as planned', () => {
    expect(seconds).toBeGreaterThan(RUN_TIME[difficulty][0]);
    expect(seconds).toBeLessThan(RUN_TIME[difficulty][1]);
  });

  it('every section is a few seconds long, and none takes over the run (a swim with crocodiles to get past may take longer)', () => {
    let last = 0;
    for (const section of sections) {
      const end = reached.get(section.solids[section.solids.length - 1]) ?? seconds;
      expect(end - last, section.name).toBeGreaterThan(3);
      expect(end - last, section.name).toBeLessThan(30);
      last = end;
    }
  });

  it('the dive through the rocky point is well under half the breath there is', () => {
    expect(longestUnder).toBeGreaterThan(0.5);
    if (level.breath !== undefined) expect(longestUnder).toBeLessThan(level.breath / 2);
    else expect(difficulty).toBe('easy');
  });

  it('the rocky point runs right across its water, too high to climb onto, with the only way past under its middle', () => {
    const pool = (level.water ?? []).find((w) => w.id === 'tunnel-water')!;
    const parts = ['rock-north', 'rock-tunnel', 'rock-south'].map((id) => byId(level, id));
    expect(Math.min(...parts.map((s) => s.z - s.halfZ))).toBeLessThanOrEqual(pool.minZ);
    expect(Math.max(...parts.map((s) => s.z + s.halfZ))).toBeGreaterThanOrEqual(pool.maxZ);
    for (const s of parts) expect(s.top - pool.surface).toBeGreaterThan(SWIM.climbHeight);
    const tunnel = byId(level, 'rock-tunnel');
    expect(tunnel.bottom - pool.floor).toBeGreaterThan(1);
    expect(passageNear(level.solids, pool, tunnel.x + tunnel.halfX + 1.5, tunnel.z)).toBe(true);
    // Well past where a running jump in from the reed bar lands.
    const bar = byId(level, 'reed-bar');
    expect(bar.x - bar.halfX - (tunnel.x + tunnel.halfX)).toBeGreaterThan(8);
  });

  it('the high banks cannot be climbed onto from the water, the shores and the low pieces can, and nobody can get onto the wooded island', () => {
    for (const id of ['island', 'headland', 'gravel-bar', 'landing', 'boardwalk', 'dock']) expect(byId(level, id).top - LAKE_SHAPE.surface, id).toBeGreaterThan(SWIM.climbHeight);
    for (const id of ['point', 'mid-rock', 'island-step', 'stack', 'reed-bar', 'cove-beach', 'post-1', 'log-1']) expect(byId(level, id).top - LAKE_SHAPE.surface, id).toBeLessThanOrEqual(SWIM.climbHeight);
    // The wooded island stands more than a full jump (2 m) over the highest place beside it.
    const wooded = byId(level, 'wooded-island');
    expect(level.route).not.toContain('wooded-island');
    expect(wooded.top - byId(level, 'headland').top).toBeGreaterThan(2.4);
  });

  it('nobody swims past a section: a solid stands across every place the route passes from one pool to the next', () => {
    const pools = level.water ?? [];
    const poolOf = (x: number, z: number) => pools.find((w) => x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ);
    // No two pools overlap.
    for (const a of pools) for (const b of pools) if (a !== b) expect(a.minX < b.maxX - 1e-6 && b.minX < a.maxX - 1e-6 && a.minZ < b.maxZ - 1e-6 && b.minZ < a.maxZ - 1e-6, `${a.id} and ${b.id}`).toBe(false);
    // The bank each stretch of water ends on reaches into the next stretch's water.
    const reaches = (id: string, poolId: string): boolean => {
      const s = byId(level, id);
      const w = pools.find((p) => p.id === poolId)!;
      return s.x - s.halfX < w.maxX && s.x + s.halfX > w.minX && s.z - s.halfZ < w.maxZ && s.z + s.halfZ > w.minZ;
    };
    for (const [bank, from, to] of [
      ['point', 'shore-water', 'channel-water'],
      ['island', 'channel-water', 'cove-water'],
      ['headland', 'cove-water', 'logs-water'],
      ['gravel-bar', 'logs-water', 'open-water'],
      ['reed-bar', 'open-water', 'tunnel-water'],
    ] as const) {
      expect(reaches(bank, from) || bank === 'point', `${bank} in ${from}`).toBe(true);
      expect(reaches(bank, to), `${bank} in ${to}`).toBe(true);
    }
    // Every solid of the route stands in a pool or on its edge, so a missed jump is a swim.
    for (const id of level.route) {
      const s = level.solids.find((solid) => solid.id === id);
      if (!s) continue;
      const near = [[s.x, s.z], [s.x - s.halfX - 0.5, s.z], [s.x + s.halfX + 0.5, s.z], [s.x, s.z - s.halfZ - 0.5], [s.x, s.z + s.halfZ + 0.5]];
      expect(near.some(([x, z]) => poolOf(x, z) !== undefined), id).toBe(true);
    }
  });

  it('a missed jump lands in the lake, never a fall, and the hero climbs back out to go on', () => {
    const game = new Game(level, difficulty, 'Caputo');
    const bot = new Bot(level);
    for (let i = 0; i < 300 / STEP && game.groundId !== 'log-1'; i += 1) game.step(bot.input(game));
    expect(game.groundId).toBe('log-1');
    // Walk off the side of the log.
    for (let i = 0; i < 5 / STEP && !game.swimming; i += 1) game.step({ ...IDLE, moveZ: -1 });
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
    // The bot swims back, climbs out (onto the island or a log) and finishes.
    let climbedOnto: string | null = null;
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
      const wasSwimming = game.swimming || game.climbing > 0;
      game.step(bot.input(game));
      if (wasSwimming && climbedOnto === null && game.grounded) climbedOnto = game.groundId;
    }
    expect(climbedOnto).toMatch(/^(log-|step-)/);
    expect(game.complete).toBe(true);
    expect(game.falls).toBe(0);
  });
});

describe('the rope swings', () => {
  /** Jumps for the rope from the bank before it, holds on for `wait` seconds, lets go, and says what the hero came down on. */
  const swing = (difficulty: Difficulty, ropeId: string, wait: number, steer: boolean): string => {
    const level = buildLake(difficulty);
    const from = byId(level, level.route[level.route.indexOf(ropeId) - 1]);
    const game = new Game(level, difficulty, 'Yaarbro');
    Object.assign(game, { x: from.x - from.halfX + 2.5, z: from.z, y: from.top, groundId: from.id, grounded: true });
    for (let i = 0; i < 4 / STEP && !game.swinging; i += 1) game.step({ ...IDLE, moveX: -1, jump: game.x < from.x - from.halfX + 0.6 });
    expect(game.ropeId, `${difficulty} ${ropeId}`).toBe(ropeId);
    game.step(IDLE);
    for (let i = 0; i < wait / STEP; i += 1) game.step(IDLE);
    game.step({ ...IDLE, jump: true });
    for (let i = 0; i < 6 / STEP; i += 1) {
      game.step(steer ? { ...IDLE, moveX: -1 } : IDLE);
      if (game.grounded) return game.groundId ?? 'ground';
      if (game.swimming) return 'water';
    }
    return 'air';
  };
  /** One swing out and back takes about three seconds. */
  const WAITS = Array.from({ length: 31 }, (_, i) => i * 0.1);
  const lands = (difficulty: Difficulty, ropeId: string, steer: boolean): boolean[] => {
    const to = buildLake(difficulty).ropes!.find((r) => r.id === ropeId)!.to;
    return WAITS.map((wait) => swing(difficulty, ropeId, wait, steer) === to);
  };

  it('two ropes cross the cove, to the rock stack and then up to the headland, and a jump from the bank before each reaches it', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      expect((level.ropes ?? []).map((r) => [r.id, r.to])).toEqual([['rope-1', 'stack'], ['rope-2', 'headland']]);
      const at = level.route.indexOf('island');
      expect(level.route.slice(at, at + 5)).toEqual(['island', 'rope-1', 'stack', 'rope-2', 'headland']);
      // Both carry the hero west: left on the screen, with the camera looking north.
      for (const rope of level.ropes ?? []) expect(rope.ahead).toEqual({ x: -1, z: 0 });
    }
  });

  it('on Easy, letting go at any point in the swing lands safely (the owner\'s rule)', () => {
    expect(buildLake('easy').ropeHelp).toBe(true);
    for (const ropeId of ['rope-1', 'rope-2']) for (const steer of [false, true]) expect(lands('easy', ropeId, steer).every(Boolean), `${ropeId} steer ${steer}`).toBe(true);
  });

  it('on Normal, letting go anywhere on the way forward gets there, and at the back of the swing does not', () => {
    expect(buildLake('normal').ropeHelp).toBe(false);
    for (const ropeId of ['rope-1', 'rope-2']) {
      const steering = lands('normal', ropeId, true);
      // The first seven tenths of a second are the way forward.
      expect(steering.slice(1, 8).every(Boolean), ropeId).toBe(true);
      // Around half a swing later the rope is at the back.
      expect(steering.slice(13, 18).some(Boolean), ropeId).toBe(false);
    }
  });

  it('on Hard there is less to land on: fewer moments work than on Normal, but a good one still does with no steering', () => {
    for (const ropeId of ['rope-1', 'rope-2']) {
      const count = (difficulty: Difficulty): number => [...lands(difficulty, ropeId, false), ...lands(difficulty, ropeId, true)].filter(Boolean).length;
      expect(count('hard'), ropeId).toBeLessThan(count('normal'));
      expect(lands('hard', ropeId, false).some(Boolean), ropeId).toBe(true);
    }
  });

  it('a miss lands in the cove, never a fall, and the hero can climb back by the rock island\'s low step or onto the stack', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const level = buildLake(difficulty);
      const pool = level.water!.find((w) => w.id === 'cove-water')!;
      for (const rope of level.ropes ?? []) expect(rope.x > pool.minX && rope.x < pool.maxX && rope.z > pool.minZ && rope.z < pool.maxZ, rope.id).toBe(true);
      for (const id of ['island-step', 'stack']) expect(byId(level, id).top - LAKE_SHAPE.surface, id).toBeLessThanOrEqual(SWIM.climbHeight);
      // Holding on for half a swing and letting go at the back drops the hero short.
      expect(['water', 'island']).toContain(swing(difficulty, 'rope-1', 1.5, false));
    }
  });
});

describe('the crocodiles', () => {
  it('wait in the long swim, the Open Water, on every difficulty, and on Hard one more under the sunken logs', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const crocs = level.enemies ?? [];
      const numbers = LAKE_DIFFICULTY[difficulty];
      expect(crocs.length).toBe(numbers.crocCount + (numbers.crocUnderLogs ? 1 : 0));
      for (const croc of crocs) {
        expect(croc.kind).toBe('crocodile');
        const pool = level.water!.find((w) => croc.z >= w.minZ && croc.z <= w.maxZ && croc.x >= w.minX && croc.x <= w.maxX)!;
        expect(pool.id).toBe(croc.id === 'croc-logs' ? 'logs-water' : 'open-water');
        // Its whole water is inside the open water.
        expect(croc.arena.minX).toBeGreaterThanOrEqual(pool.minX);
        expect(croc.arena.maxX).toBeLessThanOrEqual(pool.maxX);
        expect(croc.arena.minZ).toBeGreaterThanOrEqual(pool.minZ);
        expect(croc.arena.maxZ).toBeLessThanOrEqual(pool.maxZ);
      }
    }
  });

  it('on Easy keep to the side: the bot, swimming straight down the lake, never wakes one', () => {
    const level = buildLake('easy');
    const game = new Game(level, 'easy', 'Caputo');
    const bot = new Bot(level);
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
      game.step(bot.input(game));
      for (const croc of game.enemies) expect(croc.phase).toBe('concealed');
    }
    expect(game.complete).toBe(true);
    expect(game.heartsLost).toBe(0);
  });

  it('on Normal and Hard they hunt: the whole of the open water is theirs, and they come after a swimmer from the moment they are in', () => {
    expect(DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d].crocHunt)).toEqual([false, true, true]);
    for (const difficulty of ['normal', 'hard'] as const) {
      const level = buildLake(difficulty);
      const pool = level.water!.find((w) => w.id === 'open-water')!;
      const hunters = level.enemies!.filter((croc) => croc.id.startsWith('croc-open'));
      for (const croc of hunters) {
        // Its water is the open water, shore to shore, less a metre or two at the edges.
        expect(croc.arena.maxX - croc.arena.minX, croc.id).toBeGreaterThan(18);
        expect(croc.arena.minZ, croc.id).toBeLessThan(pool.minZ + 2);
        expect(croc.arena.maxZ, croc.id).toBeGreaterThan(-10);
      }
      // A swimmer who only treads water where they went in is come for: each crocodile leaves home and closes in.
      const game = new Game(level, difficulty, 'Yaarbro');
      const bar = byId(level, 'gravel-bar');
      Object.assign(game, { x: bar.x - bar.halfX - 1.5, z: bar.z, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'open-water' });
      const far = (croc: (typeof game.enemies)[number]): number => Math.hypot(croc.x - game.x, croc.z - game.z);
      const crocs = game.enemies.filter((croc) => croc.spot.id.startsWith('croc-open'));
      const before = crocs.map(far);
      game.step(IDLE);
      for (const croc of crocs) expect(croc.phase, `${difficulty} ${croc.spot.id}`).toBe('idle');
      for (let i = 0; i < 4 / STEP; i += 1) {
        game.protectedFor = 10;
        game.step(IDLE);
      }
      crocs.forEach((croc, i) => expect(before[i] - far(croc), `${difficulty} ${croc.spot.id}`).toBeGreaterThan(8));
    }
  });

  it('on Hard the one under the sunken logs leaves a hero on the logs alone, and comes for one who falls in', () => {
    const level = buildLake('hard');
    const game = new Game(level, 'hard', 'Yaarbro');
    const croc = game.enemies.find((each) => each.spot.id === 'croc-logs')!;
    const log = byId(level, 'log-2');
    Object.assign(game, { x: log.x, z: log.z, y: log.top, grounded: true, groundId: 'log-2', vx: 0, vy: 0, vz: 0 });
    for (let i = 0; i < 5 / STEP; i += 1) game.step(IDLE);
    expect(croc.phase).toBe('concealed');
    // Off the side of the log, into the water.
    Object.assign(game, { x: log.x, z: log.z - 2.5, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'logs-water' });
    game.step(IDLE);
    expect(croc.phase).toBe('idle');
    const before = Math.hypot(croc.x - game.x, croc.z - game.z);
    for (let i = 0; i < 2 / STEP; i += 1) {
      game.protectedFor = 10;
      game.step(IDLE);
    }
    expect(Math.hypot(croc.x - game.x, croc.z - game.z)).toBeLessThan(before - 3);
    expect(buildLake('normal').enemies!.some((each) => each.id === 'croc-logs')).toBe(false);
  });

  it('on Easy they do not hunt: a swimmer treading water where they went in is left alone', () => {
    const level = buildLake('easy');
    const game = new Game(level, 'easy', 'Yaarbro');
    const bar = byId(level, 'gravel-bar');
    Object.assign(game, { x: bar.x - bar.halfX - 1.5, z: bar.z, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'open-water' });
    for (let i = 0; i < 6 / STEP; i += 1) game.step(IDLE);
    for (const croc of game.enemies) expect(croc.phase).toBe('concealed');
    expect(game.heartsLost).toBe(0);
  });

  it('a hunting crocodile takes up the hunt again after a lunge, and goes home when the swimmer is out of the water', () => {
    const level = buildLake('normal');
    const game = new Game(level, 'normal', 'Yaarbro');
    const bar = byId(level, 'gravel-bar');
    Object.assign(game, { x: bar.x - bar.halfX - 6, z: bar.z + 6, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'open-water' });
    const croc = game.enemies[0];
    const phases: string[] = [];
    for (let i = 0; i < 30 / STEP && phases.filter((p) => p === 'attack').length < 2; i += 1) {
      game.protectedFor = 10;
      game.step(IDLE);
      for (const event of game.events) if (event.type === 'enemy') phases.push(event.phase);
    }
    // Lunge, rest, hunt, and lunge again.
    expect(phases.filter((p) => p === 'attack').length).toBe(2);
    expect(phases.join(' ')).toContain('attack rest idle warning attack');
    // Out on the reed bar, it gives up and goes home to lie low.
    const reeds = byId(level, 'reed-bar');
    Object.assign(game, { x: reeds.x, z: reeds.z, y: reeds.top, grounded: true, groundId: 'reed-bar', swimming: false, waterId: null, vx: 0, vy: 0, vz: 0 });
    for (let i = 0; i < 60 / STEP && croc.phase !== 'concealed'; i += 1) game.step(IDLE);
    expect(croc.phase).toBe('concealed');
    expect(Math.hypot(croc.x - croc.spot.x, croc.z - croc.spot.z)).toBeLessThan(0.1);
  });

  it('on Hard they head for where the swimmer is going, to cut them off; on Normal they lead a little; on Easy not at all', () => {
    const [e, n, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d]);
    expect(e.crocLead).toBe(0);
    expect(n.crocLead).toBeGreaterThan(0);
    expect(h.crocLead).toBeGreaterThan(n.crocLead);
    expect(buildLake('hard').enemyTuning?.crocLead).toBe(h.crocLead);
  });

  it('on Normal and Hard every one in the open water wakes, and the bot still gets past each with no heart lost', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      for (const hero of HEROES) {
        const level = buildLake(difficulty);
        const game = new Game(level, difficulty, hero);
        const bot = new Bot(level);
        const woke = new Set<string>();
        let lunges = 0;
        for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
          game.step(bot.input(game));
          for (const croc of game.enemies) if (croc.phase !== 'concealed') woke.add(croc.spot.id);
          lunges += game.events.filter((e) => e.type === 'enemy' && e.phase === 'attack').length;
        }
        expect(game.complete, `${difficulty} ${hero}`).toBe(true);
        // The one under the logs on Hard only wakes for a hero who falls in there.
        expect([...woke].sort(), `${difficulty} ${hero}`).toEqual(level.enemies!.map((croc) => croc.id).filter((id) => id !== 'croc-logs').sort());
        expect(lunges, `${difficulty} ${hero}`).toBeGreaterThan(0);
        expect(game.heartsLost, `${difficulty} ${hero}`).toBe(0);
      }
    }
    // Four whole runs, each looking ahead around every crocodile.
  }, 120_000);

  it('get faster, reach further and give a shorter tell from Easy to Hard, and only Easy shows where one will lunge', () => {
    const [e, n, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d]);
    for (const key of ['crocSpeed', 'crocReach'] as const) {
      expect(e[key], key).toBeLessThan(n[key]);
      expect(n[key], key).toBeLessThan(h[key]);
    }
    for (const key of ['crocWarning', 'crocRest'] as const) {
      expect(e[key], key).toBeGreaterThan(n[key]);
      expect(n[key], key).toBeGreaterThan(h[key]);
    }
    expect([e.crocLine, n.crocLine, h.crocLine]).toEqual([true, false, false]);
    // A crocodile never out-swims a hero at the surface.
    expect(h.crocSpeed).toBeLessThan(3.6);
  });
});

describe('what each difficulty changes', () => {
  it('Easy never runs out of breath; Hard has less of it than Normal and a longer dive', () => {
    expect(LAKE_DIFFICULTY.easy.breath).toBeUndefined();
    expect(LAKE_DIFFICULTY.hard.breath!).toBeLessThan(LAKE_DIFFICULTY.normal.breath!);
    expect(LAKE_DIFFICULTY.easy.tunnelLength).toBeLessThan(LAKE_DIFFICULTY.normal.tunnelLength);
    expect(LAKE_DIFFICULTY.normal.tunnelLength).toBeLessThan(LAKE_DIFFICULTY.hard.tunnelLength);
  });

  it('the swims, the gaps and the footing all get harder from Easy to Hard', () => {
    const [e, n, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d]);
    for (const key of ['crossing', 'boulderGap', 'logGap', 'postGap'] as const) {
      expect(e[key], key).toBeLessThan(n[key]);
      expect(n[key], key).toBeLessThan(h[key]);
    }
    for (const key of ['boulderRadius', 'logWidth', 'postRadius', 'hearts'] as const) {
      expect(e[key], key).toBeGreaterThan(n[key]);
      expect(n[key], key).toBeGreaterThan(h[key]);
    }
  });

  it('the open water is wide enough to swim round a crocodile, and its swim is longer the harder it gets', () => {
    const lengths = DIFFICULTIES.map((difficulty) => {
      const level = buildLake(difficulty);
      const pool = level.water!.find((w) => w.id === 'open-water')!;
      expect(pool.maxX - pool.minX, difficulty).toBeGreaterThan(24);
      const bar = level.solids.find((s) => s.id === 'gravel-bar')!;
      const reeds = level.solids.find((s) => s.id === 'reed-bar')!;
      return reeds.z - reeds.halfZ - (bar.z + bar.halfZ);
    });
    expect(lengths[0]).toBeGreaterThan(20);
    expect(lengths[0]).toBeLessThan(lengths[1]);
    expect(lengths[1]).toBeLessThan(lengths[2]);
  });
});
