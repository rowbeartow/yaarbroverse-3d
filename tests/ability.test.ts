// The new button (src/game/ability.ts): Walblum's karate kick for Yaarbro and
// Claw Slash for Caputo. One set of rules for both, so neither hero is the
// weaker one; a hit counts on every enemy and boss, the monster pike included.

import { describe, expect, it } from 'vitest';
import { ABILITY, ABILITY_STRIKE, newAbility, pickTarget, stepAbility, type AbilityEvent, type AbilityHero, type AbilityTarget } from '../src/game/ability';
import { newBoss, strikeBoss } from '../src/game/boss';
import { Game, IDLE, type GameEvent, type Input } from '../src/game/game';
import { HEROES, STEP, type HeroName } from '../src/game/hero';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { buildLake } from '../src/levels/cocolalla/layout';
import { buildSandbox } from '../src/levels/sandbox/layout';

const HERO: AbilityHero = { x: 0, y: 0, z: 0, facing: 0, vx: 0, vz: 0 };
const target = (key: string, x: number, z: number, y = 1): AbilityTarget => ({ key, x, y, z, radius: 0.5 });
const ATTACK: Input = { ...IDLE, attack: true };

/** Steps the button alone until it is ready again, with one press at the start. */
const fly = (hero: AbilityHero, targets: AbilityTarget[]): { events: AbilityEvent[]; seconds: number } => {
  const state = newAbility();
  const events: AbilityEvent[] = [];
  let steps = 0;
  do {
    events.push(...stepAbility(state, hero, steps === 0, targets, STEP));
    steps += 1;
  } while (state.phase !== 'ready' && steps < 600);
  return { events, seconds: steps * STEP };
};

describe('what the button is sent at', () => {
  it('the nearest enemy in front of the hero, and nothing behind or out of range', () => {
    // Facing 0 faces +z.
    expect(pickTarget(HERO, [target('far', 0, 8), target('near', 1, 4)])?.key).toBe('near');
    expect(pickTarget(HERO, [target('behind', 0, -5)])).toBeNull();
    expect(pickTarget(HERO, [target('too-far', 0, ABILITY.range + 2)])).toBeNull();
    // Well off to the side is not in front; a little off is.
    expect(pickTarget(HERO, [target('side', 6, 0.5)])).toBeNull();
    expect(pickTarget(HERO, [target('ahead', 3, 4)])?.key).toBe('ahead');
    // Right beside the hero counts whichever way they face.
    expect(pickTarget(HERO, [target('beside', 0, -1.5)])?.key).toBe('beside');
    // Overhead, as a mosquito is.
    expect(pickTarget(HERO, [target('above', 0, 3, 4)])?.key).toBe('above');
  });

  it('it flies to its target, strikes once, and comes back before it can be sent again', () => {
    const { events, seconds } = fly(HERO, [target('scout', 0, 6)]);
    expect(events.map((event) => event.what)).toEqual(['launch', 'reach', 'back']);
    expect(events[1]).toEqual({ what: 'reach', target: 'scout' });
    // Out at 22 m a second and back at 17: under a second for a target 6 m off.
    expect(seconds).toBeGreaterThan(0.4);
    expect(seconds).toBeLessThan(1);
  });

  it('with nothing in front it flies a little way and comes back', () => {
    const { events } = fly(HERO, []);
    expect(events.map((event) => event.what)).toEqual(['launch', 'miss', 'back']);
    expect(events[0]).toEqual({ what: 'launch', target: null });
  });

  it('it follows a target that moves, and comes back to a hero who runs', () => {
    const state = newAbility();
    const moving = target('runner', 0, 6);
    const hero = { ...HERO, vx: 6 };
    const events: AbilityEvent[] = [];
    for (let i = 0; i < 300 && (i === 0 || state.phase !== 'ready'); i += 1) {
      moving.x += 4 * STEP;
      hero.x += 6 * STEP;
      events.push(...stepAbility(state, hero, i === 0, [moving], STEP));
    }
    expect(events.map((event) => event.what)).toEqual(['launch', 'reach', 'back']);
  });
});

/** A game with the hero put beside an enemy of a kind, facing it, with the button. */
const beside = (hero: HeroName, kind: 'marmot' | 'mosquito' | 'crocodile'): { game: Game; id: string } => {
  const level = kind === 'crocodile' ? buildLake('hard') : buildGrove('hard');
  const game = new Game(level, 'hard', hero, { ability: true });
  const enemy = game.enemies.find((each) => each.kind === kind && each.spot.sidekickOf === undefined)!;
  // In plain view, as it is once it has noticed a hero, with nothing else about.
  for (const other of game.enemies) if (other !== enemy) other.phase = 'defeated';
  enemy.phase = 'rest';
  // The hero stands on the spawn bank; the enemy is put a few metres in front, at the height it keeps.
  const ground = level.solids.find((each) => Math.abs(each.x - level.spawn.x) <= each.halfX && Math.abs(each.z - level.spawn.z) <= each.halfZ && Math.abs(each.top - level.spawn.y) < 0.01)!;
  const from = { x: level.spawn.x, z: level.spawn.z };
  Object.assign(enemy, { x: from.x, z: from.z - 4.5, y: kind === 'marmot' ? ground.top : kind === 'mosquito' ? ground.top + 3 : ground.top - 0.4 });
  // That place is its home and its patch from now on, so it stays there.
  enemy.spot = { ...enemy.spot, x: enemy.x, y: enemy.y, z: enemy.z, arena: { minX: enemy.x - 3, maxX: enemy.x + 3, minZ: enemy.z - 3, maxZ: enemy.z + 3 }, beat: undefined };
  Object.assign(game, { x: from.x, y: ground.top, z: from.z, grounded: true, groundId: ground.id, facing: Math.atan2(enemy.x - from.x, enemy.z - from.z) });
  return { game, id: enemy.spot.id };
};
const press = (game: Game, seconds = 1.5): GameEvent[] => {
  const all: GameEvent[] = [];
  for (let i = 0; i < seconds / STEP; i += 1) {
    game.step(i < 3 ? ATTACK : IDLE);
    all.push(...game.events);
  }
  return all;
};

describe('in the game', () => {
  it('a hero who has not won the button has none', () => {
    const game = new Game(buildGrove('easy'), 'easy', 'Yaarbro');
    expect(game.ability).toBeNull();
    expect(press(game).filter((event) => event.type === 'ability')).toEqual([]);
  });

  it.each(HEROES.flatMap((hero) => (['marmot', 'mosquito', 'crocodile'] as const).map((kind) => [hero, kind] as const)))('%s strikes a %s with it, as a landing on top would', (hero, kind) => {
    const { game, id } = beside(hero, kind);
    const enemy = game.enemies.find((each) => each.spot.id === id)!;
    const before = enemy.hits;
    const events = press(game);
    const strike = events.find((event) => event.type === 'strike');
    expect(strike).toMatchObject({ type: 'strike', id, how: ABILITY_STRIKE[hero], left: before - 1 });
    expect(enemy.hits).toBe(before - 1);
    expect(game.heartsLost).toBe(0);
  });

  it('Claw Slash is exactly as quick and reaches exactly as far as Walblum: neither hero is the weaker one', () => {
    const timeline = (hero: HeroName): string[] => {
      const { game } = beside(hero, 'marmot');
      const out: string[] = [];
      for (let i = 0; i < 120; i += 1) {
        game.step(i < 3 ? ATTACK : IDLE);
        for (const event of game.events) if (event.type === 'ability') out.push(`${i} ${event.what}`);
      }
      return out;
    };
    expect(timeline('Caputo')).toEqual(timeline('Yaarbro'));
    expect(timeline('Yaarbro').map((line) => line.split(' ')[1])).toEqual(['launch', 'reach', 'back']);
  });

  it('it cannot be sent again until it is back, and beats a two-hit scout in two sends', () => {
    const { game, id } = beside('Yaarbro', 'marmot');
    const enemy = game.enemies.find((each) => each.spot.id === id)!;
    expect(enemy.hits).toBe(2);
    // Held down, and mashed: one send for each time it is back and the button is pressed afresh.
    for (let i = 0; i < 20; i += 1) game.step(i % 2 === 0 ? ATTACK : IDLE);
    expect(game.ability!.used).toBe(1);
    for (let i = 0; i < 4 / STEP && enemy.phase !== 'defeated'; i += 1) {
      enemy.phase = 'rest';
      game.step(i % 8 < 4 ? ATTACK : IDLE);
    }
    expect(enemy.phase).toBe('defeated');
    expect(game.ability!.used).toBe(2);
    expect(game.beaten).toBe(1);
  });

  it('it is not sent while swimming, or while fishing', () => {
    const game = new Game(buildLake('easy'), 'easy', 'Yaarbro', { ability: true });
    game.startOn('jetty');
    // Fishing: the line is out.
    for (let i = 0; i < 30; i += 1) game.step({ ...IDLE, move: true });
    expect(game.fishing!.phase).not.toBe('off');
    for (let i = 0; i < 10; i += 1) game.step({ ...IDLE, move: true, attack: i % 2 === 0 });
    expect(game.ability!.used).toBe(0);
    // Swimming.
    const wet = new Game(buildLake('easy'), 'easy', 'Caputo', { ability: true });
    for (let i = 0; i < 5 / STEP && !wet.swimming; i += 1) wet.step({ moveX: 0, moveZ: -1, jump: false });
    expect(wet.swimming).toBe(true);
    for (let i = 0; i < 10; i += 1) wet.step({ ...IDLE, attack: i % 2 === 0 });
    expect(wet.ability!.used).toBe(0);
  });
});

describe('against a boss and the monster pike', () => {
  it('a boss: it counts while the boss is open to a hit, and is shrugged off while it is guarded', () => {
    for (const difficulty of ['easy', 'hard'] as const) {
      const spot = buildSandbox(difficulty).boss!;
      const boss = newBoss(spot);
      // Before the fight, and in its moments of show: nothing.
      expect(strikeBoss(boss, 0, 1)).toBe('blocked');
      boss.phase = 'rest';
      expect(strikeBoss(boss, 0, 1)).toBe('struck');
      expect(boss.health).toBe(spot.numbers.health - 1);
      expect(boss.phase).toBe('stagger');
      expect(strikeBoss(boss, 0, 1)).toBe('blocked');
      boss.phase = 'idle';
      expect(strikeBoss(boss, 0, 1)).toBe(spot.numbers.guarded ? 'blocked' : 'struck');
    }
  });

  it.each(HEROES)('%s beats the practice boss with the button alone, from a distance', (hero) => {
    const level = buildSandbox('normal');
    const game = new Game(level, 'normal', hero, { ability: true });
    const spot = level.boss!;
    Object.assign(game, { x: (spot.arena.minX + spot.arena.maxX) / 2, y: spot.y, z: spot.arena.maxZ - 0.5, grounded: true, facing: Math.PI });
    const under = level.solids.find((s) => s.safe && Math.abs(s.x - game.x) <= s.halfX && Math.abs(s.z - game.z) <= s.halfZ);
    game.groundId = under?.id ?? null;
    const hits: GameEvent[] = [];
    for (let i = 0; i < 120 / STEP && game.boss!.phase !== 'defeated'; i += 1) {
      // Keep facing it and keep pressing; nothing can hurt, so this is the button alone.
      game.protectedFor = 1;
      game.facing = Math.atan2(game.boss!.x - game.x, game.boss!.z - game.z);
      game.step({ ...IDLE, attack: i % 6 < 3 });
      hits.push(...game.events.filter((event) => event.type === 'boss' && event.what === 'hit'));
    }
    expect(game.boss!.phase).toBe('defeated');
    expect(hits).toHaveLength(spot.numbers.health);
    expect(hits.every((event) => event.type === 'boss' && event.what === 'hit' && event.how === ABILITY_STRIKE[hero])).toBe(true);
    expect(game.goalOpen).toBe(true);
  });

  it.each(HEROES)('%s hits the monster pike with it from the floating log, while a hit counts', (hero) => {
    const level = buildLake('hard');
    const game = new Game(level, 'hard', hero, { ability: true });
    const pike = game.pike!;
    const log = level.solids.find((s) => s.id === pike.spot.log)!;
    Object.assign(game, { x: log.x, y: log.top, z: log.z, grounded: true, groundId: log.id });
    // The water half, with the pike up beside the log.
    Object.assign(pike, { phase: 'gape', timer: 0, health: 4, x: log.x + log.halfX + 1.5, z: log.z, y: pike.spot.surface, target: { x: log.x, y: log.top, z: log.z + 3 } });
    game.facing = Math.PI / 2;
    // Hard: jaws open, a hit does not count yet.
    let events = press(game, 0.5);
    expect(events).toContainEqual({ type: 'pike', id: pike.spot.id, what: 'blocked' });
    expect(pike.health).toBe(4);
    // Spent at the surface: it counts.
    Object.assign(pike, { phase: 'rest', timer: 0 });
    events = press(game, 0.6);
    expect(events).toContainEqual({ type: 'pike', id: pike.spot.id, what: 'hit', how: ABILITY_STRIKE[hero], left: 3 });
    expect(pike.phase).toBe('stagger');
    // Under the water it cannot be reached at all.
    Object.assign(pike, { phase: 'circling', timer: 0 });
    events = press(game, 1.2);
    expect(events.filter((event) => event.type === 'ability').map((event) => event.type === 'ability' && event.what)).toEqual(['launch', 'miss', 'back']);
    expect(pike.health).toBe(3);
  });
});
