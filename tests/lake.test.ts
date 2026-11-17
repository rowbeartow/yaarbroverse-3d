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
import { HEROES, STEP, type HeroName } from '../src/game/hero';
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
      // The owner asked for about 20% leftward movement and a third camera turn. Since 2026-11-16 the third turn is
      // the Shore Path's, looking east along the boulders, kept off every precise section.
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
  const swing = (difficulty: Difficulty, ropeId: string, wait: number, steer: boolean, hero: HeroName = 'Yaarbro'): string => {
    const level = buildLake(difficulty);
    const from = byId(level, level.route[level.route.indexOf(ropeId) - 1]);
    const game = new Game(level, difficulty, hero);
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
  const lands = (difficulty: Difficulty, ropeId: string, steer: boolean, hero: HeroName = 'Yaarbro'): boolean[] => {
    const to = buildLake(difficulty).ropes!.find((r) => r.id === ropeId)!.to;
    return WAITS.map((wait) => swing(difficulty, ropeId, wait, steer, hero) === to);
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
    for (const hero of HEROES) {
      for (const ropeId of ['rope-1', 'rope-2']) for (const steer of [false, true]) expect(lands('easy', ropeId, steer, hero).every(Boolean), `${hero} ${ropeId} steer ${steer}`).toBe(true);
    }
  });

  it('on Normal, letting go anywhere on the way forward gets there, and at the back of the swing does not', () => {
    expect(buildLake('normal').ropeHelp).toBe(false);
    for (const hero of HEROES) {
      for (const ropeId of ['rope-1', 'rope-2']) {
        const steering = lands('normal', ropeId, true, hero);
        // The first seven tenths of a second are the way forward.
        expect(steering.slice(1, 8).every(Boolean), `${hero} ${ropeId}`).toBe(true);
        // Around half a swing later the rope is at the back.
        expect(steering.slice(13, 18).some(Boolean), `${hero} ${ropeId}`).toBe(false);
      }
    }
  });

  it('the two heroes have about as many good moments to let go: hanging by the hands or by the teeth makes no rope harder', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      for (const ropeId of ['rope-1', 'rope-2']) {
        const [yaarbro, caputo] = HEROES.map((hero) => lands(difficulty, ropeId, true, hero).filter(Boolean).length);
        expect(Math.abs(yaarbro - caputo), `${difficulty} ${ropeId}: ${yaarbro} and ${caputo}`).toBeLessThanOrEqual(2);
      }
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
  it('wait in the long swim, the Open Water, on every difficulty, and on Normal and Hard one more under the sunken logs', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const crocs = (level.enemies ?? []).filter((each) => each.kind === 'crocodile');
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
      for (const croc of game.enemies) if (croc.kind === 'crocodile') expect(croc.phase).toBe('concealed');
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

  it('on Hard (and Normal) the one under the sunken logs leaves a hero on the logs alone, and comes for one who falls in', () => {
    const level = buildLake('hard');
    const game = new Game(level, 'hard', 'Yaarbro');
    const croc = game.enemies.find((each) => each.spot.id === 'croc-logs')!;
    const log = byId(level, 'log-2');
    // On a boulder between the logs, which never sinks.
    const rock = byId(level, 'step-1');
    Object.assign(game, { x: rock.x, z: rock.z, y: rock.top, grounded: true, groundId: 'step-1', vx: 0, vy: 0, vz: 0 });
    for (let i = 0; i < 5 / STEP; i += 1) game.step(IDLE);
    expect(game.groundId).toBe('step-1');
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
    expect(buildLake('normal').enemies!.some((each) => each.id === 'croc-logs')).toBe(true);
    expect(buildLake('easy').enemies!.some((each) => each.id === 'croc-logs')).toBe(false);
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

describe('the logs and posts that sink', () => {
  const standOn = (difficulty: 'easy' | 'normal' | 'hard', id: string, seconds: number): Game => {
    const level = buildLake(difficulty);
    const game = new Game(level, difficulty, 'Yaarbro');
    const s = game.level.solids.find((each) => each.id === id)!;
    Object.assign(game, { x: s.x, z: s.z, y: s.top, grounded: true, groundId: id, vx: 0, vy: 0, vz: 0 });
    for (let i = 0; i < seconds / STEP; i += 1) {
      // Nothing else in the lake matters here.
      game.protectedFor = 10;
      game.step(IDLE);
    }
    return game;
  };

  it.each(['log-1', 'post-1'])('on Easy %s only bobs under a hero, and holds', (id) => {
    const game = standOn('easy', id, 20);
    expect(game.groundId).toBe(id);
    expect(game.swimming).toBe(false);
  });

  it.each([
    ['normal', 'log-1'],
    ['hard', 'log-1'],
    ['normal', 'post-1'],
    ['hard', 'post-1'],
    ['hard', 'post-6'],
  ] as const)('on %s a hero who waits on %s goes down with it and swims: no fall, no heart lost', (difficulty, id) => {
    const game = standOn(difficulty, id, 6);
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
    expect(game.heartsLost).toBe(0);
  });

  it.each(DIFFICULTIES)('on %s every log and post sinks or bobs, sooner on Hard, and no boulder between them does', (difficulty) => {
    const level = buildLake(difficulty);
    const pieces = level.solids.filter((s) => /^(log|post)-\d+$/.test(s.id));
    expect(pieces.length).toBeGreaterThan(6);
    for (const piece of pieces) expect(piece.motion).toMatchObject({ kind: 'sink', sinks: difficulty !== 'easy' });
    for (const rock of level.solids.filter((s) => /^step-\d+$/.test(s.id))) expect(rock.motion).toBeUndefined();
    // Every one of them stands in deep water, so going down with one is a swim.
    for (const piece of pieces) expect(level.water!.some((w) => piece.x > w.minX && piece.x < w.maxX && piece.z > w.minZ && piece.z < w.maxZ)).toBe(true);
  });

  it('gives less warning on Hard than on Normal', () => {
    const tell = (difficulty: 'normal' | 'hard', id: string): number => (buildLake(difficulty).solids.find((s) => s.id === id)!.motion as { tell: number }).tell;
    expect(tell('hard', 'log-1')).toBeLessThan(tell('normal', 'log-1'));
    expect(tell('hard', 'post-1')).toBeLessThan(tell('normal', 'post-1'));
  });
});

describe('the scouts and the mosquito', () => {
  const count = (difficulty: Difficulty, kind: string): number => buildLake(difficulty).enemies!.filter((each) => each.kind === kind).length;

  it('are as many as the plan says: 3, 8 and 12 enemies in all', () => {
    expect(DIFFICULTIES.map((d) => count(d, 'marmot'))).toEqual([1, 2, 3]);
    expect(DIFFICULTIES.map((d) => count(d, 'mosquito'))).toEqual([0, 2, 3]);
    expect(DIFFICULTIES.map((d) => count(d, 'crocodile'))).toEqual([2, 4, 6]);
  });

  it.each(DIFFICULTIES)('on %s each has wide, solid ground to itself: no jump, swing or sinking piece is in its patch', (difficulty) => {
    const level = buildLake(difficulty);
    // The mosquitoes over the Open Water are over open water; theirs is the next test.
    for (const spot of level.enemies!.filter((each) => each.kind !== 'crocodile' && !each.id.startsWith('mosquito-open'))) {
      const ground = level.solids.find((s) => spot.x > s.x - s.halfX && spot.x < s.x + s.halfX && spot.z > s.z - s.halfZ && spot.z < s.z + s.halfZ && !s.motion)!;
      expect(ground, spot.id).toBeDefined();
      // Wide and flat: at least 5 m each way.
      expect(Math.min(ground.halfX, ground.halfZ) * 2, spot.id).toBeGreaterThanOrEqual(5);
      // Its patch lies wholly on that one piece of ground.
      expect(spot.arena.minX).toBeGreaterThanOrEqual(ground.x - ground.halfX);
      expect(spot.arena.maxX).toBeLessThanOrEqual(ground.x + ground.halfX);
      expect(spot.arena.minZ).toBeGreaterThanOrEqual(ground.z - ground.halfZ);
      expect(spot.arena.maxZ).toBeLessThanOrEqual(ground.z + ground.halfZ);
    }
  });

  it('the scout on the grassy point keeps to its own end: a hero stepping onto the first crocodile is outside what it notices', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const level = buildLake(difficulty);
      const scout = level.enemies!.find((each) => each.id === 'scout-point')!;
      const first = level.solids.find((s) => s.id === 'stone-1')!;
      expect(scout.arena.minX - (scout.notice ?? 0)).toBeGreaterThan(first.x + first.halfX + 1);
    }
    expect(buildLake('easy').enemies!.some((each) => each.id === 'scout-point')).toBe(false);
  });

  it.each(DIFFICULTIES.flatMap((d) => HEROES.map((h) => [d, h] as const)))('on %s the bot, as %s, finishes with no heart lost and beats the dock\'s scouts on the way to the leaf', (difficulty, hero) => {
    const level = buildLake(difficulty);
    const game = new Game(level, difficulty, hero);
    const bot = new Bot(level);
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) game.step(bot.input(game));
    expect(game.complete).toBe(true);
    expect(game.heartsLost).toBe(0);
    expect(game.falls).toBe(0);
  });
});

describe('the Open Water, rebuilt', () => {
  const open = (level: Level): NonNullable<Level['water']>[number] => level.water!.find((w) => w.id === 'open-water')!;
  const booms = (level: Level, n: number): Solid[] => level.solids.filter((s) => s.id.startsWith(`boom-${n}-`));

  it.each(DIFFICULTIES)('on %s two booms lie right across it, each with one gap, at opposite ends', (difficulty) => {
    const level = buildLake(difficulty);
    const pool = open(level);
    const gap = LAKE_DIFFICULTY[difficulty].boomGap;
    const first = booms(level, 1);
    const second = booms(level, 2);
    const west = (list: Solid[]): number => Math.min(...list.map((s) => s.x - s.halfX));
    const east = (list: Solid[]): number => Math.max(...list.map((s) => s.x + s.halfX));
    expect(west(first)).toBeCloseTo(pool.minX, 5);
    // Where the wooded island stands in the pool's east side, the water ends at its west face.
    const wooded = byId(level, 'wooded-island');
    const shore = (z: number): number => (z > wooded.z - wooded.halfZ && z < wooded.z + wooded.halfZ ? Math.min(pool.maxX, wooded.x - wooded.halfX) : pool.maxX);
    expect(east(first)).toBeCloseTo(shore(first[0].z) - gap, 5);
    // The gap is open water: no solid stands in it.
    const gapX = shore(first[0].z) - gap / 2;
    expect(level.solids.filter((s) => !s.id.startsWith('boom-') && Math.abs(gapX - s.x) < s.halfX && Math.abs(first[0].z - s.z) < s.halfZ && s.top > -1).map((s) => s.id)).toEqual([]);
    expect(west(second)).toBeCloseTo(pool.minX + gap, 5);
    expect(east(second)).toBeCloseTo(shore(second[0].z), 5);
    for (const piece of [...first, ...second]) {
      // Nobody climbs onto one from the water, and there is room to swim under it.
      expect(piece.noClimb).toBe(true);
      expect(passageNear([piece], pool, piece.x, piece.z)).toBe(true);
    }
  });

  it('a swimmer at the surface cannot get through a boom, and gets past by diving under it', () => {
    const level = buildLake('normal');
    const boom = booms(level, 1)[1];
    const swimAt = (dive: boolean): Game => {
      const game = new Game(level, 'normal', 'Yaarbro');
      Object.assign(game, { x: boom.x, z: boom.z - 3, y: -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'open-water' });
      for (let i = 0; i < 4 / STEP; i += 1) {
        game.protectedFor = 10;
        // Toward the camera, which is the way the swim goes. Diving: down for the first second and a half.
        game.step({ ...IDLE, moveZ: 1, move: dive && i < 1.5 / STEP });
      }
      return game;
    };
    expect(swimAt(false).z).toBeLessThan(boom.z);
    expect(swimAt(true).z).toBeGreaterThan(boom.z + 1);
  });

  it('weed slows a swimmer at the surface, and not one underwater', () => {
    const level = buildLake('normal');
    const bed = open(level).weeds![0];
    const speed = (under: boolean, inBed: boolean): number => {
      const game = new Game(level, 'normal', 'Yaarbro');
      const x = inBed ? (bed.minX + bed.maxX) / 2 : bed.maxX + 3;
      Object.assign(game, { x, z: (bed.minZ + bed.maxZ) / 2, y: under ? -2.5 : -SWIM.float, grounded: false, groundId: null, swimming: true, waterId: 'open-water', under });
      for (let i = 0; i < 0.4 / STEP; i += 1) {
        game.protectedFor = 10;
        game.step({ ...IDLE, moveX: -0.0001, moveZ: 0, move: under });
      }
      for (let i = 0; i < 0.8 / STEP; i += 1) {
        game.protectedFor = 10;
        game.step({ ...IDLE, moveX: 1, move: under });
      }
      return Math.hypot(game.vx, game.vz);
    };
    expect(open(level).weeds).toHaveLength(2);
    expect(speed(false, true)).toBeCloseTo(SWIM.surfaceSpeed * SWIM.weedSlow, 1);
    expect(speed(false, false)).toBeCloseTo(SWIM.surfaceSpeed, 1);
    expect(speed(true, true)).toBeGreaterThan(SWIM.surfaceSpeed);
  });

  it('has a rest rock half way: a checkpoint on Easy, a rock on Normal, none on Hard', () => {
    expect(byId(buildLake('easy'), 'rest-rock').safe).toBe(true);
    expect(byId(buildLake('normal'), 'rest-rock').safe).toBe(false);
    expect(buildLake('hard').solids.some((s) => s.id === 'rest-rock')).toBe(false);
    // Low enough to climb onto from the water.
    expect(byId(buildLake('easy'), 'rest-rock').top - LAKE_SHAPE.surface).toBeLessThanOrEqual(SWIM.climbHeight);
  });

  it('keeps its mosquitoes off the way in: none notices a hero until past the first boom', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const level = buildLake(difficulty);
      const boom = booms(level, 1)[0];
      const over = level.enemies!.filter((each) => each.id.startsWith('mosquito-open'));
      expect(over.length).toBe(LAKE_DIFFICULTY[difficulty].openMosquitoes);
      for (const spot of over) expect(spot.arena.minZ).toBeGreaterThan(boom.z);
    }
  });

  it('on Easy the gaps are clear of crocodiles: each waits further from both gaps than its water reaches', () => {
    const level = buildLake('easy');
    const pool = open(level);
    const gap = LAKE_DIFFICULTY.easy.boomGap;
    const gaps = [
      { x: Math.max(...booms(level, 1).map((s) => s.x + s.halfX)) + gap / 2, z: booms(level, 1)[0].z },
      { x: pool.minX + gap / 2, z: booms(level, 2)[0].z },
    ];
    for (const croc of level.enemies!.filter((each) => each.kind === 'crocodile')) {
      for (const g of gaps) {
        const outside = Math.max(croc.arena.minX - g.x, g.x - croc.arena.maxX, croc.arena.minZ - g.z, g.z - croc.arena.maxZ);
        expect(outside, `${croc.id} and the gap at ${g.x.toFixed(0)}, ${g.z.toFixed(0)}`).toBeGreaterThan(1);
      }
    }
  });
});

describe('what there is to collect on the lake', () => {
  it.each(DIFFICULTIES)('on %s there are trails through every section and three hidden leaves, the same three on every difficulty', (difficulty) => {
    const level = buildLake(difficulty);
    const pickups = level.pickups!;
    expect(pickups.filter((p) => p.kind === 'leaf').map((p) => p.id).sort()).toEqual(['leaf-logs', 'leaf-open', 'leaf-tunnel']);
    const berries = pickups.filter((p) => p.kind === 'berry').length;
    expect(berries).toBeGreaterThanOrEqual(50);
    expect(berries).toBeLessThanOrEqual(70);
    for (const start of ['shore-', 'croc-', 'swing-', 'log-', 'gap-', 'under-', 'dive-', 'post-', 'pier-']) expect(pickups.some((p) => p.id.startsWith(start)), start).toBe(true);
  });

  it.each(DIFFICULTIES)('on %s every pickup is somewhere a hero can be: over footing, on a swing, or in a pool with a way out', (difficulty) => {
    const level = buildLake(difficulty);
    for (const p of level.pickups!) {
      if (p.id.startsWith('swing-')) continue;
      const footing = level.solids.find((s) => p.y > s.top && p.y - s.top < 2.2 && Math.abs(p.x - s.x) <= s.halfX + 0.5 && Math.abs(p.z - s.z) <= s.halfZ + 0.5);
      const pool = level.water!.find((w) => p.x > w.minX && p.x < w.maxX && p.z > w.minZ && p.z < w.maxZ && p.y < w.surface && p.y > w.floor + 0.3);
      expect(footing ?? pool, p.id).toBeDefined();
      if (!footing && pool) {
        // Its pool has a shore or a low piece to climb out onto.
        const wayOut = level.solids.some((s) => !s.noClimb && s.motion?.kind !== 'float' && s.top - pool.surface <= SWIM.climbHeight && s.top - pool.surface > -0.2 && s.x + s.halfX > pool.minX && s.x - s.halfX < pool.maxX && s.z + s.halfZ > pool.minZ && s.z - s.halfZ < pool.maxZ);
        expect(wayOut, `${p.id} in ${pool.id}`).toBe(true);
      }
    }
  });

  const cases = DIFFICULTIES.flatMap((d) => HEROES.map((h) => [d, h] as const));
  /** Swims toward each waypoint in turn, at its depth, and returns the game when the last is reached (or after 30 s). */
  const swimVia = (game: Game, points: Array<{ x: number; z: number; y: number }>): void => {
    let next = 0;
    for (let i = 0; i < 30 / STEP && next < points.length; i += 1) {
      const to = points[next];
      const middle = game.y + game.bodyHeight / 2;
      const dx = to.x - game.x;
      const dz = to.z - game.z;
      const far = Math.hypot(dx, dz);
      if (far < 0.5 && Math.abs(middle - to.y) < 0.6) {
        next += 1;
        continue;
      }
      // Crocodiles are for the swimmer to dodge; here only the way and the breath are in question.
      game.protectedFor = 10;
      game.step({ moveX: far > 0.2 ? dx / far : 0, moveZ: far > 0.2 ? dz / far : 0, move: middle > to.y + 0.2, jump: middle < to.y - 0.3 });
    }
    expect(next, 'waypoints reached').toBe(points.length);
  };
  const inWater = (game: Game, waterId: string, x: number, z: number): void => {
    Object.assign(game, { x, z, y: -SWIM.float, vx: 0, vy: 0, vz: 0, grounded: false, groundId: null, swimming: true, waterId, under: false });
  };

  it.each(cases)('on %s as %s the leaf on the tipping log is a jump from the zigzag\'s corner boulder and a walk to its far end', (difficulty, hero) => {
    const level = buildLake(difficulty);
    const game = new Game(level, difficulty, hero);
    const corner = byId(level, 'step-3');
    Object.assign(game, { x: corner.x, z: corner.z, y: corner.top, grounded: true, groundId: 'step-3', vx: 0, vy: 0, vz: 0 });
    for (let i = 0; i < 8 / STEP && !game.collected.has('leaf-logs'); i += 1) {
      game.protectedFor = 10;
      const atEdge = game.groundId === 'step-3' && game.z < corner.z - corner.halfZ + 0.45;
      game.step({ moveX: 0, moveZ: -1, jump: atEdge });
    }
    expect(game.collected.has('leaf-logs')).toBe(true);
    expect(game.falls).toBe(0);
  });

  it.each(cases)('on %s as %s the leaf in the Open Water is a dive from the surface over it, with breath to spare', (difficulty, hero) => {
    const level = buildLake(difficulty);
    const game = new Game(level, difficulty, hero);
    const leaf = level.pickups!.find((p) => p.id === 'leaf-open')!;
    inWater(game, 'open-water', leaf.x, leaf.z - 0.5);
    swimVia(game, [{ x: leaf.x, z: leaf.z, y: leaf.y + 0.3 }]);
    expect(game.collected.has('leaf-open')).toBe(true);
    if (Number.isFinite(game.maxBreath)) expect(game.breath).toBeGreaterThan(game.maxBreath / 2);
    // On Easy it lies outside every crocodile's water: no crocodile has to be woken to take it.
    if (difficulty === 'easy') {
      for (const croc of level.enemies!.filter((each) => each.kind === 'crocodile')) {
        expect(leaf.x < croc.arena.minX || leaf.x > croc.arena.maxX || leaf.z < croc.arena.minZ || leaf.z > croc.arena.maxZ, croc.id).toBe(true);
      }
    }
  });

  it.each(cases)('on %s as %s the leaf behind the dive is reached from the tunnel\'s mouth, and the swimmer gets out the far side on one breath', (difficulty, hero) => {
    const level = buildLake(difficulty);
    const game = new Game(level, difficulty, hero);
    const leaf = level.pickups!.find((p) => p.id === 'leaf-tunnel')!;
    const rock = byId(level, 'rock-tunnel');
    const under = LAKE_SHAPE.tunnelRoof - 0.6;
    inWater(game, 'tunnel-water', rock.x + rock.halfX + 2, rock.z);
    swimVia(game, [
      { x: rock.x + rock.halfX + 0.8, z: rock.z, y: under },
      { x: rock.x, z: rock.z, y: under },
      { x: leaf.x, z: leaf.z - 0.3, y: leaf.y + 0.4 },
    ]);
    expect(game.collected.has('leaf-tunnel')).toBe(true);
    swimVia(game, [
      { x: rock.x, z: rock.z, y: under },
      { x: rock.x - rock.halfX - 1.5, z: rock.z, y: under },
    ]);
    // Up for air beyond the rock: never out of breath on the way.
    for (let i = 0; i < 3 / STEP; i += 1) game.step({ ...IDLE, jump: true });
    expect(game.under).toBe(false);
    expect(game.heartsLost).toBe(0);
    expect(game.x).toBeLessThan(rock.x - rock.halfX);
  });
});
