// The monster pike (src/game/pike.ts, and the monster in src/game/fishing.ts):
// hooked from the lake's jetty, a tug of war, then fought in the water from a
// floating log. The level cannot end until it is beaten.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty';
import { monsterOf } from '../src/game/fishing';
import { Game, IDLE, type GameEvent, type Input } from '../src/game/game';
import { MOVE, STEP, type HeroName } from '../src/game/hero';
import { PIKE, pikeDangerous, pikeFighting, pikeOpen, type PikePhase } from '../src/game/pike';
import { SWIM } from '../src/game/swim';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { buildLake } from '../src/levels/cocolalla/layout';
import { Bot, playWithBot } from './helpers/bot';
import { PikePlan, wayBack } from './helpers/pike-plan';
import { escapeFrom, exitsOf } from './helpers/water-exit';

const HEROES: HeroName[] = ['Yaarbro', 'Caputo'];

/** A game on the lake with the hero on the jetty and the dock's scouts out of it: they are not this file's business. */
const onJetty = (difficulty: Difficulty, hero: HeroName = 'Yaarbro'): Game => {
  const game = new Game(buildLake(difficulty), difficulty, hero);
  // The dock is the checkpoint; the fishing spot is on the jetty beside it.
  game.startOn('dock');
  const spot = game.level.fishing!;
  Object.assign(game, { x: spot.x, z: spot.z, groundId: spot.solid });
  for (const enemy of game.enemies) Object.assign(enemy, { phase: 'defeated', timer: 99 });
  return game;
};

/** Plays with a chooser until `done`, for at most `seconds`. Returns every event on the way. */
const play = (game: Game, choose: (game: Game) => Input, done: (game: Game) => boolean, seconds = 120): GameEvent[] => {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds / STEP && !done(game); i += 1) {
    game.step(choose(game));
    events.push(...game.events);
  }
  return events;
};

/** Fishes with the pike plan until the pike is in a phase. */
const until = (game: Game, phase: PikePhase, seconds = 120): GameEvent[] => {
  const plan = new PikePlan(true);
  return play(game, (g) => plan.input(g) ?? IDLE, (g) => g.pike!.phase === phase, seconds);
};

/** Puts the hero on the middle of the floating log, standing still. */
const standOnLog = (game: Game, along = 0): void => {
  const log = game.level.solids.find((s) => s.id === game.level.pike!.log)!;
  Object.assign(game, { x: log.x, y: log.top, z: log.z + along, vx: 0, vy: 0, vz: 0, grounded: true, groundId: log.id, swimming: false, waterId: null, under: false, protectedFor: 0 });
};

describe('the monster pike in the lake', () => {
  it.each(DIFFICULTIES)('on %s it has more pips than the difficulty before, and the tug of war takes half of them', (difficulty) => {
    const n = LAKE_DIFFICULTY[difficulty];
    expect(n.monster.pips * 2).toBe(n.pike.health);
    const [e, m, h] = DIFFICULTIES.map((d) => LAKE_DIFFICULTY[d].pike);
    expect(e.health).toBeLessThan(m.health);
    expect(m.health).toBeLessThan(h.health);
    // Easy's tells and its opening are the longest, and only Easy draws where an attack will go.
    for (const key of ['chargeWarning', 'snapWarning', 'rest'] as const) {
      expect(e[key], key).toBeGreaterThan(m[key]);
      expect(m[key], key).toBeGreaterThan(h[key]);
    }
    expect([e.aimLine, m.aimLine, h.aimLine]).toEqual([true, false, false]);
  });

  it.each(DIFFICULTIES)('on %s its shadow swims a circle inside the fishing water, and the floating log lies outside it', (difficulty) => {
    const level = buildLake(difficulty);
    const spot = level.fishing!;
    const m = spot.numbers.monster!;
    expect(m.home.out - m.circle).toBeGreaterThan(spot.near);
    expect(m.home.out + m.circle).toBeLessThan(spot.far);
    expect(Math.abs(m.home.across) + m.circle).toBeLessThanOrEqual(spot.halfWidth);
    // Hooked anywhere on its circle, there is line to reel in before it drags.
    expect(Math.hypot(m.home.out, m.home.across) - m.circle - m.dragAt).toBeGreaterThan(3);
    const log = level.solids.find((s) => s.id === level.pike!.log)!;
    expect(Math.abs(log.x - spot.x) - log.halfX).toBeGreaterThan(spot.halfWidth);
    // The log can be climbed onto from the water, is longer than a snap reaches, and floats in the pike's own pool.
    const pool = level.water!.find((w) => w.id === level.pike!.water)!;
    expect(log.top - pool.surface).toBeLessThanOrEqual(SWIM.climbHeight);
    expect(log.halfZ * 2).toBeGreaterThanOrEqual(6);
    expect(log.x - log.halfX).toBeGreaterThan(pool.minX);
    expect(log.z - log.halfZ).toBeGreaterThan(pool.minZ);
    // The drag puts the hero in open water in that pool, a short swim from the log.
    const { landAt } = level.pike!;
    expect(level.solids.some((s) => Math.abs(landAt.x - s.x) < s.halfX + 0.6 && Math.abs(landAt.z - s.z) < s.halfZ + 0.6 && s.bottom < 1)).toBe(false);
    expect(Math.hypot(landAt.x - log.x, Math.max(0, Math.abs(landAt.z - log.z) - log.halfZ))).toBeLessThan(8);
  });
});

describe('the tug of war', () => {
  it.each(DIFFICULTIES)('on %s a cast at the big shadow hooks it, and the fight begins', (difficulty) => {
    const game = onJetty(difficulty);
    expect(game.pike!.phase).toBe('lurking');
    expect(pikeFighting(game.pike!)).toBe(false);
    const events = until(game, 'hooked');
    expect(game.pike!.phase).toBe('hooked');
    expect(events).toContainEqual({ type: 'boss', id: 'monster-pike', what: 'begin' });
    expect(events.some((event) => event.type === 'fishing' && event.what === 'hooked' && event.monster)).toBe(true);
    expect(game.pike!.health).toBe(game.level.pike!.numbers.health);
    // Its shadow is where the hooked monster is.
    const monster = monsterOf(game.fishing!)!;
    expect(monster.mood).toBe('hooked');
  });

  it.each(DIFFICULTIES)('on %s reeling while it tires takes its pips one by one, and with half gone it drags the hero into the lake', (difficulty) => {
    const game = onJetty(difficulty);
    const events = until(game, 'dragging');
    const n = game.level.pike!.numbers;
    const pips = events.filter((event) => event.type === 'boss' && event.what === 'hit').map((event) => (event.type === 'boss' && event.what === 'hit' ? [event.how, event.left] : []));
    expect(pips).toEqual(Array.from({ length: n.health / 2 }, (_, i) => ['reel', n.health - 1 - i]));
    expect(game.pike!.health).toBe(n.health / 2);
    expect(events).toContainEqual({ type: 'pike', id: 'monster-pike', what: 'dragged' });
    // The monster is out of the fishing water, the line is in, and the hero is in the air on the way to the water.
    expect(monsterOf(game.fishing!)).toBeNull();
    expect(game.fishing!.phase).toBe('off');
    expect(game.grounded).toBe(false);
    expect(game.dragging).toBe(true);
    const drag = play(game, () => ({ moveX: 1, moveZ: 1, jump: true }), (g) => g.swimming, 4);
    expect(game.swimming).toBe(true);
    expect(game.waterId).toBe(game.level.pike!.water);
    // The stick cannot spoil the throw: it comes down where the drag aims, and nothing hurts on the way.
    const { landAt } = game.level.pike!;
    expect(Math.hypot(game.x - landAt.x, game.z - landAt.z)).toBeLessThan(1.5);
    expect(drag.some((event) => event.type === 'hurt')).toBe(false);
    expect(game.complete).toBe(false);
  });

  it('on Easy it needs no timing: the button held from the bite to the drag never snaps the line', () => {
    const game = onJetty('easy');
    until(game, 'hooked');
    const events = play(game, () => ({ ...IDLE, move: true }), (g) => g.pike!.phase === 'dragging', 60);
    expect(game.pike!.phase).toBe('dragging');
    expect(events.some((event) => event.type === 'fishing' && (event.what === 'snapped' || event.what === 'away'))).toBe(false);
  });

  it.each(['normal', 'hard'] as const)('on %s it thrashes: reeling through a thrash strains the line, and letting it run eases it', (difficulty) => {
    const game = onJetty(difficulty);
    until(game, 'hooked');
    const state = game.fishing!;
    play(game, () => ({ ...IDLE, move: true }), () => state.fight === 'thrash', 30);
    expect(state.fight).toBe('thrash');
    const line = state.line;
    game.step({ ...IDLE, move: true });
    game.step({ ...IDLE, move: true });
    expect(state.strain).toBeGreaterThan(0);
    const strained = state.strain;
    for (let i = 0; i < 6; i += 1) game.step(IDLE);
    expect(state.strain).toBeLessThan(strained);
    // Let run, it takes line back.
    expect(state.line).toBeGreaterThan(line);
    expect(game.pike!.phase).toBe('hooked');
  });

  it.each(['normal', 'hard'] as const)('on %s a line reeled through its thrashes snaps: it is off the hook with every pip back, and has to be hooked again', (difficulty) => {
    const game = onJetty(difficulty);
    until(game, 'hooked');
    const n = game.level.pike!.numbers;
    // Reel well in first, so there are pips to lose, then never let go.
    const plan = new PikePlan(true);
    play(game, (g) => plan.input(g) ?? IDLE, (g) => g.pike!.health < n.health, 60);
    expect(game.pike!.health).toBe(n.health - 1);
    const events = play(game, () => ({ ...IDLE, move: true }), (g) => g.pike!.phase !== 'hooked', 60);
    expect(events.some((event) => event.type === 'fishing' && event.what === 'snapped')).toBe(true);
    expect(events).toContainEqual({ type: 'boss', id: 'monster-pike', what: 'reset', healed: true });
    expect(game.pike!.phase).toBe('lurking');
    expect(game.pike!.health).toBe(n.health);
    expect(game.hearts).toBe(game.level.hearts);
    // It is still in the fishing water, and can be hooked again.
    expect(monsterOf(game.fishing!)).not.toBeNull();
    until(game, 'hooked', 60);
    expect(game.pike!.phase).toBe('hooked');
    expect(game.pike!.fights).toBe(2);
  });

  it('walking off the spot with it on the line lets it go, with every pip back', () => {
    const game = onJetty('normal');
    const n = game.level.pike!.numbers;
    const plan = new PikePlan(true);
    play(game, (g) => plan.input(g) ?? IDLE, (g) => g.pike!.health < n.health, 60);
    // A hit from anything drops the line.
    game.hurt(game.x, game.z + 1);
    play(game, () => IDLE, () => false, 1);
    expect(game.pike!.phase).toBe('lurking');
    expect(game.pike!.health).toBe(n.health);
  });
});

describe('the water half', () => {
  /** A game with the pike circling and the hero in its water where the drag put them. */
  const inWater = (difficulty: Difficulty, hero: HeroName = 'Yaarbro'): Game => {
    const game = onJetty(difficulty, hero);
    until(game, 'circling');
    expect(game.pike!.phase).toBe('circling');
    return game;
  };

  it.each(DIFFICULTIES)('on %s it circles under the water first, and gives time to reach the log', (difficulty) => {
    const game = inWater(difficulty);
    const pike = game.pike!;
    expect(pike.wait).toBeGreaterThanOrEqual(PIKE.firstPause);
    expect(pikeOpen(pike)).toBe(false);
    expect(pikeDangerous(pike)).toBe(false);
    for (let i = 0; i < 1 / STEP; i += 1) game.step(IDLE);
    expect(pike.y).toBeLessThan(game.level.pike!.surface - 0.8);
    const { home, circle } = game.level.pike!;
    expect(Math.abs(Math.hypot(pike.x - home.x, pike.z - home.z) - circle)).toBeLessThan(circle);
  });

  it.each(DIFFICULTIES)('on %s it charges a swimmer along a line fixed at its tell: only the rush hurts, and swimming out of the line is enough', (difficulty) => {
    const n = LAKE_DIFFICULTY[difficulty].pike;
    // A swimmer who stays where they are is hit by the rush, not by the tell.
    const still = inWater(difficulty);
    const told = play(still, () => IDLE, (g) => g.pike!.phase === 'chargeTell', 30);
    expect(still.pike!.phase).toBe('chargeTell');
    expect(told.some((event) => event.type === 'hurt')).toBe(false);
    const aim = { from: { ...still.pike!.from }, target: { ...still.pike!.target } };
    expect(Math.hypot(aim.target.x - aim.from.x, aim.target.z - aim.from.z)).toBeCloseTo(n.chargeReach, 3);
    const tell = play(still, () => IDLE, (g) => g.pike!.phase === 'charge', 10);
    expect(tell.some((event) => event.type === 'hurt')).toBe(false);
    expect(still.pike!.timer).toBeLessThan(STEP * 2);
    const rush = play(still, () => IDLE, (g) => g.pike!.phase !== 'charge', 10);
    expect(rush.filter((event) => event.type === 'hurt')).toHaveLength(1);
    // The rush went exactly where it was aimed.
    expect(still.pike!.target.x).toBeCloseTo(aim.target.x, 6);
    expect(still.pike!.target.z).toBeCloseTo(aim.target.z, 6);

    // A swimmer who swims straight out of the line from the moment of the tell is not touched.
    const moving = inWater(difficulty);
    play(moving, () => IDLE, (g) => g.pike!.phase === 'chargeTell', 30);
    const pike = moving.pike!;
    const lx = pike.target.x - pike.from.x;
    const lz = pike.target.z - pike.from.z;
    const length = Math.hypot(lx, lz);
    const away = play(moving, () => ({ moveX: lz / length, moveZ: -lx / length, jump: false }), (g) => g.pike!.phase === 'circling', 20);
    expect(away.some((event) => event.type === 'hurt')).toBe(false);
  });

  it.each(DIFFICULTIES)('on %s it snaps at a hero on the log: jaws up off one end, then up the log to where the hero stood, never the far part', (difficulty) => {
    const game = inWater(difficulty);
    const level = game.level;
    const log = level.solids.find((s) => s.id === level.pike!.log)!;
    standOnLog(game, 1);
    const coming = play(game, (g) => (standOnLog(g, 1), IDLE), (g) => g.pike!.phase === 'snapTell', 40);
    expect(game.pike!.phase).toBe('snapTell');
    expect(coming.some((event) => event.type === 'hurt')).toBe(false);
    const pike = game.pike!;
    // It came up off the end nearer the hero (the hero stands toward +z), on the log's line.
    expect(pike.z).toBeGreaterThan(log.z + log.halfZ);
    expect(pike.x).toBeCloseTo(log.x, 3);
    // Aimed past where the hero stands, and no further than its reach up the log.
    expect(pike.target.z).toBeLessThan(log.z + 1);
    expect(pike.target.z).toBeGreaterThanOrEqual(log.z + log.halfZ - log.halfZ * 2 * PIKE.snapShare - 1e-6);
    // The far part of the log is out of its reach whatever the hero does.
    const safeFrom = log.z + log.halfZ - log.halfZ * 2 * PIKE.snapShare - PIKE.radius - MOVE.bodyRadius;
    expect(safeFrom - (log.z - log.halfZ)).toBeGreaterThan(1);

    // The tell itself never hurts, however close the hero stands.
    const tell = play(game, (g) => (standOnLog(g, 1), IDLE), (g) => g.pike!.phase === 'snap', 10);
    expect(tell.some((event) => event.type === 'hurt')).toBe(false);
    // A hero who stays is bitten by the throw.
    const snap = play(game, () => IDLE, (g) => g.pike!.phase !== 'snap', 5);
    expect(snap.filter((event) => event.type === 'hurt')).toHaveLength(1);
  });

  it.each(DIFFICULTIES)('on %s walking down the log during the tell is enough, and then it lies spent with its head on the log: the opening', (difficulty) => {
    const game = inWater(difficulty);
    const log = game.level.solids.find((s) => s.id === game.level.pike!.log)!;
    standOnLog(game, 1);
    play(game, (g) => (standOnLog(g, 1), IDLE), (g) => g.pike!.phase === 'snapTell', 40);
    // Walk (never jump, never roll) down the log, away from the jaws.
    const walk = play(game, (g) => ({ moveX: 0, moveZ: g.z > log.z - log.halfZ + 0.6 ? -1 : 0, jump: false }), (g) => g.pike!.phase === 'rest', 10);
    expect(game.pike!.phase).toBe('rest');
    expect(walk.some((event) => event.type === 'hurt')).toBe(false);
    expect(game.groundId).toBe(log.id);
    expect(pikeOpen(game.pike!)).toBe(true);
    // Its head lies on the log, and touching it now does not hurt.
    expect(Math.abs(game.pike!.x - log.x)).toBeLessThan(0.01);
    expect(Math.abs(game.pike!.z - log.z)).toBeLessThan(log.halfZ);
    const touch = play(game, (g) => ({ moveX: 0, moveZ: Math.sign(g.pike!.z - g.z), jump: false }), (g) => g.pike!.phase !== 'rest', 10);
    expect(touch.some((event) => event.type === 'hurt' || (event.type === 'boss' && event.what === 'hit'))).toBe(false);
    // Left alone, it slips back and circles again.
    expect(game.pike!.phase).toBe('circling');
  });

  const spent = (difficulty: Difficulty, hero: HeroName): Game => {
    const game = inWater(difficulty, hero);
    const log = game.level.solids.find((s) => s.id === game.level.pike!.log)!;
    standOnLog(game, 1);
    play(game, (g) => (standOnLog(g, 1), IDLE), (g) => g.pike!.phase === 'snapTell', 40);
    play(game, (g) => ({ moveX: 0, moveZ: g.z > log.z - log.halfZ + 0.6 ? -1 : 0, jump: false }), (g) => g.pike!.phase === 'rest', 10);
    expect(game.pike!.phase).toBe('rest');
    return game;
  };

  it.each(HEROES)('landing on its head while it lies spent takes a pip, as %s', (hero) => {
    const game = spent('easy', hero);
    const before = game.pike!.health;
    const plan = new PikePlan(true);
    const events = play(game, (g) => plan.input(g) ?? IDLE, (g) => g.pike!.health < before, 6);
    expect(game.pike!.health).toBe(before - 1);
    expect(events).toContainEqual({ type: 'boss', id: 'monster-pike', what: 'hit', how: 'stomp', left: before - 1 });
    expect(game.pike!.phase).toBe('stagger');
    // Thrown up off it, and nothing hurts for a moment.
    expect(game.vy).toBeGreaterThan(0);
    expect(game.protectedFor).toBeGreaterThan(0);
    play(game, () => IDLE, (g) => g.pike!.phase !== 'stagger', 3);
    expect(game.pike!.phase).toBe('circling');
  });

  it('Yaarbro’s roll into its head takes a pip, and so does Caputo’s pounce', () => {
    for (const hero of HEROES) {
      const game = spent('easy', hero);
      const before = game.pike!.health;
      const events = play(game, (g) => ({ moveX: 0, moveZ: Math.sign(g.pike!.z - g.z), jump: false, move: Math.abs(g.pike!.z - g.z) < (hero === 'Caputo' ? 2.2 : 99) }), (g) => g.pike!.health < before, 6);
      expect(game.pike!.health, hero).toBe(before - 1);
      const hit = events.find((event) => event.type === 'boss' && event.what === 'hit');
      expect(hit, hero).toMatchObject({ how: hero === 'Yaarbro' ? 'roll' : 'pounce' });
    }
  });

  it('it cannot be struck while it circles, shows its jaws or charges: only while it lies spent', () => {
    const game = inWater('easy');
    const pike = game.pike!;
    const before = pike.health;
    // Dropped onto it from above, as it circles under the water.
    const drop = (): void => void Object.assign(game, { x: pike.x, y: pike.y + 2.5, z: pike.z, vx: 0, vy: -3, vz: 0, grounded: false, groundId: null, swimming: false, waterId: null });
    drop();
    play(game, () => IDLE, (g) => g.swimming, 3);
    expect(pike.health).toBe(before);
    // And onto its jaws while they are up off the end of the log.
    standOnLog(game, 1);
    play(game, (g) => (standOnLog(g, 1), IDLE), (g) => g.pike!.phase === 'snapTell', 40);
    drop();
    for (let i = 0; i < 20 && pike.phase === 'snapTell'; i += 1) game.step(IDLE);
    expect(pike.health).toBe(before);
  });

  it.each(DIFFICULTIES)('on %s the older player’s rule: sent back to the dock, the pike is at full health in the fishing water and the fight starts over', (difficulty) => {
    const game = inWater(difficulty);
    const n = game.level.pike!.numbers;
    expect(game.pike!.health).toBe(n.health / 2);
    // Out of hearts in its water.
    const events: GameEvent[] = [];
    for (let i = 0; i < 60 / STEP && !events.some((event) => event.type === 'restored'); i += 1) {
      game.protectedFor = 0;
      game.hurt(game.x + 1, game.z);
      game.step(IDLE);
      events.push(...game.events);
    }
    expect(events).toContainEqual({ type: 'boss', id: 'monster-pike', what: 'reset', healed: true });
    expect(game.groundId).toBe('dock');
    expect(game.hearts).toBe(game.level.hearts);
    expect(game.pike!.phase).toBe('lurking');
    expect(game.pike!.health).toBe(n.health);
    expect(monsterOf(game.fishing!)).not.toBeNull();
    expect(game.complete).toBe(false);
  });
});

describe('the level ends only after the pike is beaten', () => {
  /** Stands the hero in the golden leaf, and steps. */
  const touchLeaf = (game: Game): void => {
    const { leaf } = game.level;
    Object.assign(game, { x: leaf.x, y: leaf.y - MOVE.bodyHeight / 2, z: leaf.z, vx: 0, vy: 0, vz: 0, grounded: false, groundId: null, swimming: false, waterId: null });
    game.step(IDLE);
  };

  it.each(DIFFICULTIES)('on %s the golden leaf cannot be taken while it lurks, is on the line, or is being fought', (difficulty) => {
    const phases: PikePhase[] = ['lurking', 'hooked', 'dragging', 'circling'];
    for (const phase of phases) {
      const game = onJetty(difficulty);
      if (phase !== 'lurking') until(game, phase);
      expect(game.pike!.phase).toBe(phase);
      expect(game.goalOpen).toBe(false);
      touchLeaf(game);
      expect(game.complete, phase).toBe(false);
    }
    // And through every phase of the water fight the goal stays shut.
    const game = onJetty(difficulty);
    until(game, 'circling');
    const seen = new Set<PikePhase>();
    for (let i = 0; i < 40 / STEP; i += 1) {
      standOnLog(game, 1);
      game.protectedFor = 1;
      game.step(IDLE);
      seen.add(game.pike!.phase);
      expect(game.goalOpen).toBe(false);
      expect(game.complete).toBe(false);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['circling', 'closing', 'snapTell', 'snap', 'rest']));
  });

  it.each(DIFFICULTIES)('on %s, beaten, it sinks, and then the golden leaf ends the level', (difficulty) => {
    const game = onJetty(difficulty);
    const events = until(game, 'defeated', 200);
    expect(game.pike!.phase).toBe('defeated');
    expect(events).toContainEqual({ type: 'boss', id: 'monster-pike', what: 'beaten' });
    expect(game.goalOpen).toBe(true);
    expect(game.complete).toBe(false);
    const y = game.pike!.y;
    for (let i = 0; i < 1 / STEP; i += 1) game.step(IDLE);
    expect(game.pike!.y).toBeLessThan(y);
    touchLeaf(game);
    expect(game.complete).toBe(true);
    expect(game.summary().beaten).toBeGreaterThanOrEqual(1);
  });

  it.each(DIFFICULTIES.flatMap((difficulty) => HEROES.map((hero) => [difficulty, hero] as const)))('on %s the bot, as %s, hooks it, wins the tug of war, beats it from the log and gets back to the leaf, with no heart lost', (difficulty, hero) => {
    const game = new Game(buildLake(difficulty), difficulty, hero);
    game.startOn('dock');
    const bot = new Bot();
    const events = play(game, (g) => bot.input(g), (g) => g.complete, 300);
    expect(game.complete).toBe(true);
    expect(game.heartsLost).toBe(0);
    expect(game.pike!.phase).toBe('defeated');
    expect(game.pike!.fights).toBe(1);
    const hits = events.filter((event) => event.type === 'boss' && event.what === 'hit');
    expect(hits).toHaveLength(game.level.pike!.numbers.health);
  });

  it.each(DIFFICULTIES)('on %s the whole lake, from the beach: the bot finishes, and the pike is why it could', (difficulty) => {
    const game = playWithBot(new Game(buildLake(difficulty), difficulty, 'Yaarbro'), 300);
    expect(game.complete).toBe(true);
    expect(game.pike!.phase).toBe('defeated');
  });
});

describe('the pike’s water is no trap', () => {
  it.each(DIFFICULTIES)('on %s a hero dropped where the drag lands, or anywhere round the log, gets out; and the way back to the dock is there', (difficulty) => {
    const level = buildLake(difficulty);
    const spot = level.pike!;
    const pool = level.water!.find((w) => w.id === spot.water)!;
    const log = level.solids.find((s) => s.id === spot.log)!;
    // The log is one of the pool's ways out, with plenty of edge to come up to.
    expect(exitsOf(level, pool).map((s) => s.id)).toContain(log.id);
    const points = [spot.landAt, spot.home, { x: log.x - 3, z: log.z }, { x: log.x + 3, z: log.z }, { x: log.x, z: log.z - log.halfZ - 3 }, { x: log.x, z: log.z + log.halfZ + 3 }];
    for (const hero of HEROES) for (const at of points) expect(escapeFrom(level, difficulty, hero, at), `${hero} at ${at.x.toFixed(1)}, ${at.z.toFixed(1)}`).not.toBeNull();
    // After the fight: out of the pool and up to the end of the route by ordinary hops.
    const back = wayBack(level)!;
    expect(back[0]).toBe(pool.id);
    expect(back[back.length - 1]).toBe(level.route[level.route.length - 1]);
    const first = level.solids.find((s) => s.id === back[1])!;
    expect(first.top - pool.surface).toBeLessThanOrEqual(SWIM.climbHeight);
    for (let i = 2; i < back.length; i += 1) {
      const from = level.solids.find((s) => s.id === back[i - 1])!;
      const to = level.solids.find((s) => s.id === back[i])!;
      expect(to.top - from.top, `${from.id} to ${to.id}`).toBeLessThanOrEqual(1.4);
    }
  });

  it.each(DIFFICULTIES)('on %s, in the middle of the fight, a swimmer can still get onto the log with the pike after them', (difficulty) => {
    for (const hero of HEROES) {
      const game = onJetty(difficulty, hero);
      until(game, 'circling');
      // Hold the hero in the water until the pike has begun a charge, then let the bot swim for the log.
      play(game, () => IDLE, (g) => g.pike!.phase === 'chargeTell', 30);
      const plan = new PikePlan(true);
      const events = play(game, (g) => plan.input(g) ?? IDLE, (g) => g.grounded && g.groundId === g.level.pike!.log, 30);
      expect(game.groundId, hero).toBe(game.level.pike!.log);
      expect(events.some((event) => event.type === 'hurt'), hero).toBe(false);
    }
  });
});
