// The monster pike of Cocolalla Lake (src/game/pike.ts): hooked from the
// jetty as a tug of war, then fought in the water from a floating log. The
// level cannot end until it is beaten, and the regen rule applies.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, type Difficulty } from '../src/game/difficulty';
import { MONSTER_ID, monsterOf, newFishing, setMonster, stepFishing, type FishingEvent, type FishingInput, type FishingSpot, type FishingState, type MonsterNumbers } from '../src/game/fishing';
import { Game, IDLE, type GameEvent, type Input } from '../src/game/game';
import { HEROES, MOVE, STEP, type HeroName } from '../src/game/hero';
import { PIKE, linePips, newPike, pikeOpen, stepPike, strikePike, type Pike, type PikeHero } from '../src/game/pike';
import { SWIM } from '../src/game/swim';
import { LAKE_DIFFICULTY } from '../src/levels/cocolalla/difficulty';
import { buildLake } from '../src/levels/cocolalla/layout';
import { Bot } from './helpers/bot';

// The bot plays the fight in many of these, so this file is a bot run: its tests have the long time limit in tests/bot-runs.ts.

const EACH = DIFFICULTIES.flatMap((difficulty) => HEROES.map((hero) => [difficulty, hero] as const));

/** A game on the lake with the hero on the pier's landing, and the bot to play it. */
const atPier = (difficulty: Difficulty, hero: HeroName = 'Yaarbro'): { game: Game; bot: Bot } => {
  const game = new Game(buildLake(difficulty), difficulty, hero);
  game.startOn('landing');
  return { game, bot: new Bot() };
};

/** Plays with the bot until an event passes `until`, or the seconds run out. Returns every event on the way. */
const botUntil = (game: Game, bot: Bot, until: (event: GameEvent) => boolean, seconds = 200): GameEvent[] => {
  const all: GameEvent[] = [];
  for (let i = 0; i < seconds / STEP && !game.complete; i += 1) {
    game.step(bot.input(game));
    all.push(...game.events);
    if (game.events.some(until)) break;
  }
  return all;
};
const pikeDid = (what: string) => (event: GameEvent): boolean => event.type === 'pike' && event.what === what;
const pikeBegan = (phase: string) => (event: GameEvent): boolean => event.type === 'pike' && event.what === 'phase' && event.phase === phase;
const play = (game: Game, input: Input, seconds: number): GameEvent[] => {
  const all: GameEvent[] = [];
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(input);
    all.push(...game.events);
  }
  return all;
};

describe('the monster pike on the lake', () => {
  it.each(DIFFICULTIES)('on %s it circles inside the water a cast can reach, and the floating log lies clear of every cast', (difficulty) => {
    const level = buildLake(difficulty);
    const spot = level.fishing!;
    const pike = level.pike!;
    const pool = level.water!.find((w) => w.id === pike.water)!;
    // Every point of its circle can be cast at.
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const x = pike.home.x + Math.sin(a) * pike.circle;
      const z = pike.home.z + Math.cos(a) * pike.circle;
      const out = (x - spot.x) * spot.ahead.x + (z - spot.z) * spot.ahead.z;
      const across = (x - spot.x) * -spot.ahead.z + (z - spot.z) * spot.ahead.x;
      expect(out).toBeGreaterThan(spot.near);
      expect(out).toBeLessThan(spot.far);
      expect(Math.abs(across)).toBeLessThan(spot.halfWidth);
    }
    const log = level.solids.find((s) => s.id === pike.log)!;
    // In the pike's pool, low enough to climb onto, long enough to step clear of a snap, and outside the cast water.
    expect(log.x - log.halfX).toBeGreaterThan(pool.minX);
    expect(log.z - log.halfZ).toBeGreaterThan(pool.minZ);
    expect(log.top - pool.surface).toBeLessThanOrEqual(SWIM.climbHeight);
    expect(log.top - pool.surface).toBeGreaterThan(SWIM.shoreHeight);
    expect(Math.max(log.halfX, log.halfZ) * 2).toBeGreaterThan(2 * (pike.numbers.snapReach + 1) + 1.6);
    const nearestAcross = Math.min(Math.abs(log.x - log.halfX - spot.x), Math.abs(log.x + log.halfX - spot.x));
    expect(nearestAcross).toBeGreaterThan(spot.halfWidth + 1);
    // It is off the route, and nothing but the pike is in that water.
    expect(level.route).not.toContain(log.id);
    expect((level.enemies ?? []).filter((enemy) => enemy.kind !== 'marmot' && enemy.arena.minX < pool.maxX && enemy.arena.maxX > pool.minX && enemy.arena.minZ < pool.maxZ && enemy.arena.maxZ > pool.minZ)).toEqual([]);
    // The fight's doorstep is a checkpoint on every difficulty.
    expect(level.solids.find((s) => s.id === 'landing')!.safe).toBe(true);
  });

  it('Easy needs no precise timing, and each difficulty is harder than the last', () => {
    const { easy, normal, hard } = LAKE_DIFFICULTY;
    expect(easy.fishing.snap).toBe(Infinity);
    expect(easy.fishing.biteWindow).toBe(Infinity);
    expect(easy.pike.guarded).toBe(false);
    expect(easy.pike.aimLine).toBe(true);
    expect(easy.pike.snapTell).toBeGreaterThanOrEqual(2);
    expect(easy.pike.rest).toBeGreaterThanOrEqual(4);
    expect(easy.pike.run).toBe(0);
    for (const [gentle, tough] of [[easy, normal], [normal, hard]] as const) {
      expect(tough.pike.health).toBeGreaterThan(gentle.pike.health);
      expect(tough.pike.snapTell).toBeLessThan(gentle.pike.snapTell);
      expect(tough.pike.rest).toBeLessThan(gentle.pike.rest);
      expect(tough.pike.chargeSpeed).toBeGreaterThan(gentle.pike.chargeSpeed);
      expect(tough.pike.snapReach).toBeGreaterThan(gentle.pike.snapReach);
    }
    expect(hard.pike.guarded).toBe(true);
    // Half its pips go on the line.
    for (const difficulty of DIFFICULTIES) expect(linePips(LAKE_DIFFICULTY[difficulty].pike)).toBe(LAKE_DIFFICULTY[difficulty].pike.health / 2);
  });
});

describe('the tug of war', () => {
  const NOTHING: FishingInput = { button: false, jump: false, across: 0 };
  const BUTTON: FishingInput = { ...NOTHING, button: true };
  const numbersOn = (difficulty: Difficulty): MonsterNumbers => {
    const n = LAKE_DIFFICULTY[difficulty].pike;
    return { pips: linePips(n), pull: n.pull, calm: n.calm, thrash: n.thrash, run: n.run, heavy: n.heavy };
  };
  /** The monster hooked, 16 m out, on a difficulty. */
  const hooked = (difficulty: Difficulty): { state: FishingState; spot: FishingSpot } => {
    const spot = buildLake(difficulty).fishing!;
    const state = newFishing(spot);
    setMonster(state, numbersOn(difficulty), 16, 0);
    // The lure is put on its nose by hand, and it takes it.
    Object.assign(state, { phase: 'wait', out: 16, across: 0, timer: 0 });
    let events: FishingEvent[] = [];
    for (let i = 0; i < 5 / STEP && state.phase !== 'bite'; i += 1) events = stepFishing(state, spot, NOTHING, true, STEP);
    expect(events.some((event) => event.what === 'nibble')).toBe(false);
    expect(state.taker).toBe(MONSTER_ID);
    stepFishing(state, spot, BUTTON, true, STEP);
    expect(state.phase).toBe('hooked');
    return { state, spot };
  };
  /** Plays the line with `choose` deciding the button each step, until something in `stop` happens. */
  const pull = (state: FishingState, spot: FishingSpot, choose: () => boolean, stop: Array<FishingEvent['what']>, seconds = 120): FishingEvent[] => {
    const all: FishingEvent[] = [];
    for (let i = 0; i < seconds / STEP; i += 1) {
      const events = stepFishing(state, spot, choose() ? BUTTON : NOTHING, true, STEP);
      all.push(...events);
      if (events.some((event) => stop.includes(event.what))) break;
    }
    return all;
  };

  it('takes the lure before any other fish, with no nibble, and is never landed', () => {
    const { state, spot } = hooked('normal');
    const events = pull(state, spot, () => state.fight !== 'thrash', ['dragged', 'landed', 'snapped']);
    expect(events.some((event) => event.what === 'landed')).toBe(false);
    expect(events[events.length - 1]).toEqual({ what: 'dragged' });
  });

  it('tiring: reeling while it is calm wins line, and every stretch of line won takes a pip', () => {
    const { state, spot } = hooked('normal');
    const start = state.line;
    const events = pull(state, spot, () => state.fight !== 'thrash', ['pip']);
    expect(events[events.length - 1]).toEqual({ what: 'pip', left: numbersOn('normal').pips - 1 });
    expect(start - state.line).toBeGreaterThan(1.5);
    // It is heavy: the line comes in slower than an ordinary fish's.
    expect(numbersOn('normal').heavy).toBeLessThan(1);
  });

  it('thrashing: it warns, then thrashes; a line let run gives line back and holds', () => {
    const { state, spot } = hooked('normal');
    const events = pull(state, spot, () => state.fight !== 'thrash', ['thrash']);
    expect(events.map((event) => event.what)).toContain('tell');
    const before = state.line;
    pull(state, spot, () => false, ['calm']);
    expect(state.line).toBeGreaterThan(before);
    expect(state.strain).toBe(0);
    expect(state.phase).toBe('hooked');
  });

  it.each(['normal', 'hard'] as const)('on %s the line snaps when it is reeled through the thrashes', (difficulty) => {
    const { state, spot } = hooked(difficulty);
    const events = pull(state, spot, () => true, ['snapped', 'dragged']);
    expect(events[events.length - 1]).toEqual({ what: 'snapped' });
    // It is still in the water, to be cast at again.
    expect(monsterOf(state)?.mood).toBe('idle');
  });

  it('on Easy the line cannot snap: holding the button the whole time brings it in', () => {
    const { state, spot } = hooked('easy');
    const events = pull(state, spot, () => true, ['snapped', 'dragged']);
    expect(events[events.length - 1]).toEqual({ what: 'dragged' });
    expect(events.filter((event) => event.what === 'pip')).toHaveLength(numbersOn('easy').pips);
  });

  it.each(DIFFICULTIES)('on %s it lasts a good few seconds, and takes exactly half the pips', (difficulty) => {
    const { state, spot } = hooked(difficulty);
    let steps = 0;
    const events = pull(state, spot, () => ((steps += 1), state.fight !== 'thrash'), ['dragged']);
    expect(events.filter((event) => event.what === 'pip')).toHaveLength(LAKE_DIFFICULTY[difficulty].pike.health / 2);
    expect(steps * STEP).toBeGreaterThan(5);
    expect(steps * STEP).toBeLessThan(60);
  });
});

describe('hooked from the jetty', () => {
  it('a cast at its shadow hooks it, and the dock\'s scouts run off', () => {
    const { game, bot } = atPier('hard');
    expect(game.enemies.filter((enemy) => enemy.spot.id.startsWith('scout-dock')).length).toBe(2);
    botUntil(game, bot, pikeDid('hooked'));
    expect(game.pike!.phase).toBe('hooked');
    expect(game.fishing!.taker).toBe(MONSTER_ID);
    for (const enemy of game.enemies) if (enemy.spot.id.startsWith('scout-dock')) expect(enemy.phase).toBe('defeated');
  });

  it('a snapped line lets it go at full health, and it can be hooked again', () => {
    const { game, bot } = atPier('normal');
    botUntil(game, bot, pikeDid('hit'));
    expect(game.pike!.health).toBe(LAKE_DIFFICULTY.normal.pike.health - 1);
    // Reel through everything until the line goes.
    const events = play(game, { ...IDLE, move: true }, 30);
    expect(events.some((event) => event.type === 'fishing' && event.what === 'snapped')).toBe(true);
    expect(events).toContainEqual({ type: 'pike', id: 'monster-pike', what: 'away' });
    expect(events).toContainEqual({ type: 'pike', id: 'monster-pike', what: 'reset', healed: true });
    expect(game.pike!.phase).toBe('lurking');
    expect(game.pike!.health).toBe(LAKE_DIFFICULTY.normal.pike.health);
    botUntil(game, bot, pikeDid('hooked'));
    expect(game.pike!.phase).toBe('hooked');
  });

  it.each(EACH)('on %s as %s, half its pips gone, it drags the hero off the jetty into the lake', (difficulty, hero) => {
    const { game, bot } = atPier(difficulty, hero);
    botUntil(game, bot, pikeDid('dragged'));
    expect(game.pike!.phase).toBe('dragging');
    expect(game.pike!.health).toBe(LAKE_DIFFICULTY[difficulty].pike.health / 2);
    expect(game.fishing!.phase).toBe('off');
    // Whatever the stick says, the hero goes in, clear of the jetty and short of the pike's log.
    const events = play(game, { moveX: 0, moveZ: 1, jump: true }, 1.5);
    expect(events.some((event) => event.type === 'splash')).toBe(true);
    expect(game.swimming).toBe(true);
    expect(game.waterId).toBe(game.level.pike!.water);
    expect(game.heartsLost).toBe(0);
    const spot = game.level.fishing!;
    expect(spot.z - game.z).toBeGreaterThan(4);
  });
});

describe('the water half', () => {
  /** The pike and a hero for its own rules, with nothing else about. */
  const alone = (difficulty: Difficulty): { pike: Pike; log: { x: number; z: number; halfX: number; halfZ: number }; hero: PikeHero; top: number } => {
    const level = buildLake(difficulty);
    const pike = newPike(level.pike!);
    pike.phase = 'circling';
    const log = level.solids.find((s) => s.id === level.pike!.log)!;
    return { pike, log, top: log.top, hero: { x: log.x, y: log.top, z: log.z, vx: 0, vy: 0, vz: 0, bodyHeight: MOVE.bodyHeight, striking: false, pouncing: 0 } };
  };
  const stepUntil = (pike: Pike, step: () => ReturnType<typeof stepPike>, phase: string, seconds = 30): ReturnType<typeof stepPike>[] => {
    const all = [];
    for (let i = 0; i < seconds / STEP; i += 1) {
      const outcome = step();
      all.push(outcome);
      if (outcome.entered.includes(phase as Pike['phase'])) break;
    }
    expect(pike.phase).toBe(phase);
    return all;
  };

  it.each(DIFFICULTIES)('on %s it circles its log, then charges a swimmer along a fixed line, after a warning', (difficulty) => {
    const { pike, log, hero } = alone(difficulty);
    const n = pike.spot.numbers;
    // A swimmer in the open, who does not move.
    Object.assign(hero, { x: pike.spot.home.x, z: pike.spot.home.z + pike.spot.circle + 6, y: pike.spot.surface - SWIM.float });
    const step = () => stepPike(pike, hero, 'water', log, MOVE.bodyRadius, hero.y, true, STEP);
    let waited = 0;
    stepUntil(pike, () => ((waited += STEP), step()), 'charge-tell');
    expect(waited).toBeGreaterThan(n.wait - 0.1);
    // While it circles it keeps to its circle.
    expect(Math.hypot(pike.x - pike.spot.home.x, pike.z - pike.spot.home.z)).toBeLessThan(pike.spot.circle + 1);
    const aimed = { ...pike.target };
    let told = 0;
    stepUntil(pike, () => ((told += STEP), step()), 'charge');
    expect(told).toBeCloseTo(n.chargeTell, 1);
    expect(pike.target).toEqual(aimed);
    // It comes straight through where the swimmer is, and that hurts.
    const charge = stepUntil(pike, step, 'circling');
    expect(charge.some((outcome) => outcome.hurt)).toBe(true);
  });

  it('a swimmer who gets out of the line of a charge is not touched', () => {
    const { pike, log, hero } = alone('hard');
    Object.assign(hero, { x: pike.spot.home.x, z: pike.spot.home.z + pike.spot.circle + 6, y: pike.spot.surface - SWIM.float });
    const step = () => stepPike(pike, hero, 'water', log, MOVE.bodyRadius, hero.y, true, STEP);
    stepUntil(pike, step, 'charge-tell');
    // Sideways off the line, as fast as a hero swims, for as long as the warning lasts.
    const lx = pike.target.x - pike.from.x;
    const lz = pike.target.z - pike.from.z;
    const length = Math.hypot(lx, lz);
    const charge = stepUntil(pike, () => {
      hero.x += (lz / length) * SWIM.surfaceSpeed * STEP;
      hero.z += (-lx / length) * SWIM.surfaceSpeed * STEP;
      return step();
    }, 'circling');
    expect(charge.some((outcome) => outcome.hurt)).toBe(false);
  });

  it.each(DIFFICULTIES)('on %s it comes up beside the log with its jaws open, snaps at where the hero stood, and then lies spent', (difficulty) => {
    const { pike, log, hero } = alone(difficulty);
    const n = pike.spot.numbers;
    const step = () => stepPike(pike, hero, 'log', log, MOVE.bodyRadius, hero.y, true, STEP);
    stepUntil(pike, step, 'gape');
    // Right beside the log, level with the hero, on the side its own log lies.
    expect(Math.abs(pike.z - hero.z)).toBeLessThan(0.1);
    expect(Math.abs(pike.x - log.x) - log.halfX).toBeCloseTo(PIKE.beside, 1);
    expect(Math.sign(pike.x - log.x)).toBe(Math.sign(pike.spot.home.x - log.x));
    expect(pike.target).toMatchObject({ x: hero.x, z: hero.z });
    let told = 0;
    const tell = stepUntil(pike, () => ((told += STEP), step()), 'snap');
    expect(told).toBeCloseTo(n.snapTell, 1);
    // A hero who stood still is bitten.
    expect(tell[tell.length - 1].hurt).toBeDefined();
    let spent = 0;
    stepUntil(pike, () => ((spent += STEP), step()), 'circling');
    expect(spent).toBeCloseTo(PIKE.snap + n.rest, 1);
  });

  it.each(DIFFICULTIES)('on %s a hero who steps along the log, clear of where the jaws are aimed, is not bitten', (difficulty) => {
    const { pike, log, hero } = alone(difficulty);
    const n = pike.spot.numbers;
    const step = () => stepPike(pike, hero, 'log', log, MOVE.bodyRadius, hero.y, true, STEP);
    stepUntil(pike, step, 'gape');
    // At a walk, along the log, for no longer than the warning lasts.
    const clear = n.snapReach + 0.3;
    expect(clear / MOVE.walkSpeed).toBeLessThan(n.snapTell * 0.75);
    const tell = stepUntil(pike, () => {
      if (Math.abs(hero.z - pike.target.z) < clear) hero.z += MOVE.walkSpeed * STEP;
      return step();
    }, 'snap');
    expect(tell.some((outcome) => outcome.hurt)).toBe(false);
    expect(hero.z).toBeLessThan(log.z + log.halfZ);
  });

  it('a hit counts while it lies spent; on Easy and Normal from the moment its jaws open; on Hard not before', () => {
    for (const difficulty of DIFFICULTIES) {
      const { pike, log, hero } = alone(difficulty);
      const step = () => stepPike(pike, hero, 'log', log, MOVE.bodyRadius, hero.y, false, STEP);
      stepUntil(pike, step, 'gape');
      expect(pikeOpen(pike), difficulty).toBe(difficulty !== 'hard');
      stepUntil(pike, step, 'rest');
      expect(pikeOpen(pike), difficulty).toBe(true);
      stepUntil(pike, step, 'circling');
      expect(pikeOpen(pike), difficulty).toBe(false);
      expect(strikePike(pike, 1, 0)).toBeNull();
    }
  });

  it.each(['stomp', 'roll', 'pounce'] as const)('a %s on it while it lies spent takes a pip and staggers it', (how) => {
    const { pike, log, hero } = alone('hard');
    const idle = () => stepPike(pike, hero, 'log', log, MOVE.bodyRadius, hero.y, false, STEP);
    stepUntil(pike, idle, 'rest');
    const before = pike.health;
    // Onto it: from above, or into its side with the hero's own move.
    Object.assign(hero, { x: pike.x - (how === 'stomp' ? 0 : PIKE.radius), z: pike.z, vx: how === 'stomp' ? 0 : 9 });
    if (how === 'stomp') Object.assign(hero, { y: pike.y + PIKE.halfHeight - 0.02, vy: -6 });
    else Object.assign(hero, { y: pike.y, striking: true, pouncing: how === 'pounce' ? 0.1 : 0 });
    const outcome = stepPike(pike, hero, 'away', log, MOVE.bodyRadius, how === 'stomp' ? pike.y + PIKE.halfHeight + 0.2 : hero.y, false, STEP);
    expect(outcome.struck).toBe(how);
    expect(pike.health).toBe(before - 1);
    expect(pike.phase).toBe('stagger');
    // And it cannot be hit again until it has been round and come up once more.
    expect(strikePike(pike, 1, 0)).toBeNull();
  });

  it('on Hard a landing on it while its jaws are open bounces off', () => {
    const { pike, log, hero } = alone('hard');
    stepUntil(pike, () => stepPike(pike, hero, 'log', log, MOVE.bodyRadius, hero.y, false, STEP), 'gape');
    const before = pike.health;
    Object.assign(hero, { x: pike.x, z: pike.z, y: pike.y + PIKE.halfHeight - 0.02, vy: -6 });
    const outcome = stepPike(pike, hero, 'away', log, MOVE.bodyRadius, pike.y + PIKE.halfHeight + 0.2, false, STEP);
    expect(outcome.blocked).toBe(true);
    expect(pike.health).toBe(before);
  });

  it('it leaves alone a hero who has climbed out somewhere else, or is far from its log', () => {
    const { pike, log, hero } = alone('hard');
    const far = [];
    for (let i = 0; i < 20 / STEP; i += 1) far.push(...stepPike(pike, hero, 'away', log, MOVE.bodyRadius, hero.y, true, STEP).entered);
    expect(far).toEqual([]);
    Object.assign(hero, { x: pike.spot.home.x + PIKE.range + 3, z: pike.spot.home.z });
    for (let i = 0; i < 20 / STEP; i += 1) far.push(...stepPike(pike, hero, 'water', log, MOVE.bodyRadius, hero.y, true, STEP).entered);
    expect(far).toEqual([]);
  });
});

describe('the regen rule, and the end of the level', () => {
  it.each(DIFFICULTIES)('on %s a hero sent back to the checkpoint finds it circling its log at full health, to be hooked again', (difficulty) => {
    const { game, bot } = atPier(difficulty);
    botUntil(game, bot, pikeBegan('stagger'));
    expect(game.pike!.health).toBeLessThan(LAKE_DIFFICULTY[difficulty].pike.health / 2);
    // Every heart goes.
    const events: GameEvent[] = [];
    for (let i = 0; i < 60 / STEP && !events.some((event) => event.type === 'restored'); i += 1) {
      game.protectedFor = 0;
      game.hurt(game.x + 1, game.z);
      game.step(IDLE);
      events.push(...game.events);
    }
    expect(events).toContainEqual({ type: 'pike', id: 'monster-pike', what: 'reset', healed: true });
    expect(game.safe.id).toBe('landing');
    expect(game.pike!.phase).toBe('lurking');
    expect(game.pike!.health).toBe(LAKE_DIFFICULTY[difficulty].pike.health);
    // And the whole fight is there to be won again, from the cast.
    const again = botUntil(game, bot, pikeDid('beaten'));
    expect(again.some(pikeDid('hooked'))).toBe(true);
    expect(again.some(pikeDid('dragged'))).toBe(true);
    expect(game.pike!.phase).toBe('beaten');
  });

  it.each(EACH)('on %s as %s the bot beats it in its first fight with no heart lost, and only then can the leaf be taken', (difficulty, hero) => {
    const { game, bot } = atPier(difficulty, hero);
    const events: GameEvent[] = [];
    let openBefore = false;
    for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
      if (game.pike!.phase !== 'beaten' && game.goalOpen) openBefore = true;
      game.step(bot.input(game));
      events.push(...game.events);
    }
    expect(game.complete).toBe(true);
    expect(openBefore).toBe(false);
    expect(game.heartsLost).toBe(0);
    expect(game.pike!.fights).toBe(1);
    expect(game.summary().beaten).toBeGreaterThanOrEqual(1);
    const order = events.filter((event) => event.type === 'pike' || event.type === 'goal').map((event) => (event.type === 'goal' ? 'goal' : event.what));
    expect(order.indexOf('hooked')).toBeLessThan(order.indexOf('dragged'));
    expect(order.indexOf('dragged')).toBeLessThan(order.indexOf('beaten'));
    expect(order.indexOf('beaten')).toBeLessThan(order.indexOf('goal'));
    // Half its pips went on the line and half to hits in the water.
    const hits = events.filter((event): event is Extract<GameEvent, { type: 'pike'; what: 'hit' }> => event.type === 'pike' && event.what === 'hit');
    const half = LAKE_DIFFICULTY[difficulty].pike.health / 2;
    expect(hits.filter((event) => event.how === 'line')).toHaveLength(half);
    expect(hits.filter((event) => event.how !== 'line')).toHaveLength(half);
  });

  it('nothing a hero does before it is beaten ends the level: not the dock, not the leaf\'s place, not the water', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const game = new Game(level, difficulty, 'Caputo');
      game.startOn('dock');
      // Jumping about where the leaf will hang.
      for (let i = 0; i < 12 / STEP; i += 1) {
        const dx = level.leaf.x - game.x;
        const dz = level.leaf.z - game.z;
        const far = Math.hypot(dx, dz) || 1;
        game.step({ moveX: far > 0.3 ? dx / far : 0, moveZ: far > 0.3 ? dz / far : 0, jump: i % 50 < 25 });
      }
      expect(Math.hypot(level.leaf.x - game.x, level.leaf.z - game.z)).toBeLessThan(1.5);
      expect(game.complete).toBe(false);
      // Off the dock into the pike's water with the pike unhooked: it takes no notice, and nothing ends.
      const before = game.pike!.phase;
      play(game, { moveX: 0, moveZ: -1, jump: false }, 6);
      expect(game.swimming).toBe(true);
      play(game, IDLE, 10);
      expect(game.pike!.phase).toBe(before);
      expect(game.complete).toBe(false);
    }
  });
});

describe('the fight\'s water has a way out', () => {
  it.each(EACH)('on %s as %s a hero in the water half swims under the dock to its steps and climbs out, within 26 m', (difficulty, hero) => {
    const { game, bot } = atPier(difficulty, hero);
    botUntil(game, bot, pikeDid('dragged'));
    play(game, IDLE, 1.5);
    expect(game.swimming).toBe(true);
    const level = game.level;
    const step = level.solids.find((s) => s.id === 'dock-step-1')!;
    expect(Math.hypot(step.x - game.x, step.z - game.z)).toBeLessThan(26);
    // A plain swimmer who knows nothing of the fight: straight for the lowest step, Jump when beside it.
    let pressed = false;
    for (let i = 0; i < 40 / STEP && !(game.grounded && !game.swimming); i += 1) {
      const dx = step.x - game.x;
      const dz = step.z - game.z;
      const far = Math.hypot(dx, dz) || 1;
      pressed = far < step.halfX + 1.2 ? !pressed : false;
      game.step({ moveX: dx / far, moveZ: dz / far, jump: pressed });
    }
    expect(game.grounded).toBe(true);
    // Out onto the steps; or, bitten down to no hearts on the way, back on the checkpoint. Never left in the water.
    expect(['dock-step-1', 'landing']).toContain(game.groundId);
    // From the steps it is ordinary jumps up to the dock.
    const steps = level.solids.filter((s) => s.id.startsWith('dock-step-')).sort((a, b) => a.top - b.top);
    const dock = level.solids.find((s) => s.id === 'dock')!;
    expect(steps[0].top - level.pike!.surface).toBeLessThanOrEqual(SWIM.climbHeight);
    [...steps.slice(1), dock].forEach((next, i) => expect(next.top - steps[i].top).toBeLessThan(1.4));
  });
});
