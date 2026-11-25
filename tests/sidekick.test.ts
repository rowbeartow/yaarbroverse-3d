// The heroes' second move (src/game/sidekick.ts): Walblum's karate kick for
// Yaarbro and the Claw Slash for Caputo. The owner's rules: on its own
// button; the hero does not aim; it goes to the nearest enemy in front and
// hits it; it cannot be sent again until it is back; a hit counts on every
// enemy and boss; and Caputo's is exactly as useful as Yaarbro's.

import { describe, expect, it } from 'vitest';
import { bossOpen } from '../src/game/boss';
import { CROC } from '../src/game/crocodile';
import type { EnemySpot } from '../src/game/enemy';
import { Game, IDLE, type GameEvent, type Input } from '../src/game/game';
import { HEROES, STEP, type HeroName } from '../src/game/hero';
import type { Level } from '../src/game/level';
import { SIDEKICK } from '../src/game/sidekick';
import { buildSandbox } from '../src/levels/sandbox/layout';
import { solid, yard } from './helpers/yard';

const ALLY: Partial<Input> = { ally: true };
const patch = { minX: -9, maxX: 9, minZ: -4.5, maxZ: 4.5 };
/** The hero stands at the middle of the yard facing -z (away from the camera): enemies at -z are in front. */
const scout = (over: Partial<EnemySpot> = {}): EnemySpot => ({ id: 'scout', kind: 'marmot', x: 0, y: 0, z: -4, arena: patch, ...over });
const mosquito = (over: Partial<EnemySpot> = {}): EnemySpot => ({ id: 'mosquito', kind: 'mosquito', x: 0, y: 3, z: -4, arena: patch, ...over });

const yardWith = (enemies: EnemySpot[], over: Partial<Level> = {}): Level => yard([], { enemies, enemyTuning: { warning: 1, speed: 1, rest: 1, scoutHits: 1, mosquitoHits: 1, crocHits: 1 }, ...over });

const make = (level: Level, hero: HeroName, ally = true): Game => {
  const game = new Game(level, 'normal', hero, { ally });
  game.facing = Math.PI;
  return game;
};

/** Steps the game with an input for some seconds and returns every event. */
const run = (game: Game, input: Partial<Input>, seconds: number): GameEvent[] => {
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    game.step({ ...IDLE, ...input });
    events.push(...game.events);
  }
  return events;
};

/** One press of the button, then the stick and buttons let go until it is back (or 4 s pass). */
const send = (game: Game): GameEvent[] => {
  const events = run(game, ALLY, STEP);
  for (let i = 0; i < 4 / STEP && game.sidekick!.phase !== 'ready'; i += 1) {
    game.step(IDLE);
    events.push(...game.events);
  }
  return events;
};

const ally = (events: GameEvent[]): string[] => events.filter((event) => event.type === 'ally').map((event) => (event.type === 'ally' ? event.what : ''));

describe.each(HEROES)('the second move, as %s', (hero) => {
  it('hits a marmot scout in front of the hero, without aiming, and comes back', () => {
    const game = make(yardWith([scout({ x: 2.5 })]), hero);
    const events = send(game);
    expect(ally(events)).toEqual(['sent', 'hit', 'back']);
    expect(events.some((event) => event.type === 'strike' && event.id === 'scout' && event.how === 'ally')).toBe(true);
    expect(game.enemies[0].phase).toBe('defeated');
    expect(game.beaten).toBe(1);
    expect(game.hearts).toBe(3);
  });

  it('hits a giant mosquito hovering overhead', () => {
    const game = make(yardWith([mosquito()]), hero);
    send(game);
    expect(game.enemies[0].phase).toBe('defeated');
  });

  it('hits a crocodile in the water from the bank', () => {
    const level = yardWith([{ id: 'croc', kind: 'crocodile', x: 0, y: -0.3 - CROC.lurkDepth, z: -9, arena: { minX: -9, maxX: 9, minZ: -14, maxZ: -6 }, surface: -0.3, floor: -4 }], {
      water: [{ id: 'pool', minX: -10, maxX: 10, minZ: -15, maxZ: -5, surface: -0.3, floor: -4 }],
    });
    const game = make(level, hero);
    send(game);
    expect(game.enemies[0].phase).toBe('defeated');
  });

  it('takes one strike at a time from an enemy that needs two, and cannot be sent again until it is back', () => {
    const level = yardWith([scout()]);
    level.enemyTuning = { ...level.enemyTuning!, scoutHits: 2 };
    const game = make(level, hero);
    // Held down the whole time: it goes once, and a second press while it is out does nothing.
    const first = run(game, ALLY, SIDEKICK.windup + 0.1);
    expect(game.sidekick!.phase).toBe('out');
    first.push(...run(game, {}, STEP), ...run(game, ALLY, STEP));
    expect(ally(first)).toEqual(['sent']);
    expect(game.sidekick!.sent).toBe(1);
    send(game);
    expect(game.enemies[0].hits).toBe(1);
    // The enemy flashes for a moment after a strike; once it is over the next one beats it.
    run(game, {}, 0.5);
    game.facing = Math.atan2(game.enemies[0].x - game.x, game.enemies[0].z - game.z);
    send(game);
    expect(game.enemies[0].phase).toBe('defeated');
  });

  it('goes for the nearest of two, and ignores one behind the hero', () => {
    const game = make(yardWith([scout({ id: 'far', x: -3, z: -4.4 }), scout({ id: 'near', x: 1, z: -2.5 }), scout({ id: 'behind', z: 3 })]), hero);
    const events = send(game);
    expect(events.find((event) => event.type === 'ally' && event.what === 'sent')).toMatchObject({ target: 'near' });
    expect(game.enemies.map((enemy) => enemy.phase === 'defeated')).toEqual([false, true, false]);
  });

  it('with nothing to hit, flies out and comes back', () => {
    const game = make(yardWith([scout({ z: 4 })]), hero);
    const events = send(game);
    expect(ally(events)).toEqual(['sent', 'missed', 'back']);
    expect(game.sidekick!.phase).toBe('ready');
  });

  it('is not there in a game made without it', () => {
    const game = make(yardWith([scout()]), hero, false);
    expect(game.sidekick).toBeNull();
    const events = run(game, ALLY, 1.5);
    expect(ally(events)).toEqual([]);
    expect(game.enemies[0].hits).toBe(1);
  });

  it('is not sent from the water', () => {
    const level = yardWith([scout()], { water: [{ id: 'pool', minX: 10, maxX: 20, minZ: -5, maxZ: 5, surface: -0.3, floor: -4 }] });
    level.solids.push(solid('far', 25, 0, 5, 5, 0));
    const game = make(level, hero);
    run(game, { moveX: 1 }, 2.5);
    expect(game.swimming).toBe(true);
    expect(ally(run(game, ALLY, 0.5))).toEqual([]);
  });

  it.each(['easy', 'normal', 'hard'] as const)('beats the sandbox practice boss on %s with nothing else', (difficulty) => {
    const level = buildSandbox(difficulty);
    const game = new Game(level, difficulty, hero, { ally: true });
    game.startOn('arena');
    const boss = game.boss!;
    const full = boss.health;
    const arena = level.solids.find((each) => each.id === 'arena')!;
    // Walk in to start the fight, then stand off from it, facing it, and send the move whenever a hit would count.
    for (let i = 0; i < 300 / STEP && boss.phase !== 'defeated'; i += 1) {
      const dx = boss.x - game.x;
      const dz = boss.z - game.z;
      const far = Math.hypot(dx, dz) || 1;
      const home = { x: arena.x - game.x, z: arena.z + 3 - game.z };
      const input: Input = { ...IDLE };
      if (boss.phase === 'waiting') input.moveZ = -1;
      else if (Math.hypot(home.x, home.z) > 5) {
        // Knocked toward the edge: back to the middle.
        const length = Math.hypot(home.x, home.z);
        input.moveX = home.x / length;
        input.moveZ = home.z / length;
      } else {
        // A slow step toward it keeps the hero facing it; a step back when it is close.
        const toward = far < 3 ? -1 : 0.1;
        input.moveX = (dx / far) * toward;
        input.moveZ = (dz / far) * toward;
        input.ally = toward > 0 && bossOpen(boss) && i % 2 === 0;
      }
      game.step(input);
      // The test is of the move, not of dodging: nothing hurts the hero.
      game.protectedFor = 1;
    }
    expect(boss.phase).toBe('defeated');
    expect(full).toBeGreaterThan(2);
    expect(game.movesUsed).toBe(0);
    expect(game.goalOpen).toBe(true);
  });

  it('bounces off a boss on its guard and takes nothing from it', () => {
    const level = buildSandbox('normal');
    const game = new Game(level, 'normal', hero, { ally: true });
    game.startOn('arena');
    const boss = game.boss!;
    for (let i = 0; i < 20 / STEP && boss.phase !== 'idle'; i += 1) game.step({ ...IDLE, moveZ: boss.phase === 'waiting' ? -1 : 0 });
    expect(boss.phase).toBe('idle');
    game.facing = Math.atan2(boss.x - game.x, boss.z - game.z);
    const events: GameEvent[] = [];
    game.step({ ...IDLE, ally: true });
    for (let i = 0; i < 1 / STEP && !events.some((event) => event.type === 'ally' && event.what !== 'sent'); i += 1) {
      game.step(IDLE);
      events.push(...game.events);
    }
    expect(ally(events)).toContain('blocked');
    expect(boss.health).toBe(level.boss!.numbers.health);
  });
});

describe('the two heroes are even', () => {
  it('Walblum and the claw marks fly the same course in the same time', () => {
    const course = (hero: HeroName): Array<[string, number, number]> => {
      const game = make(yardWith([scout({ x: 3, z: -4 })]), hero);
      const steps: Array<[string, number, number]> = [];
      game.step({ ...IDLE, ally: true });
      for (let i = 0; i < 3 / STEP; i += 1) {
        game.step(IDLE);
        steps.push([game.sidekick!.phase, Math.round(game.sidekick!.x * 1000), Math.round(game.sidekick!.z * 1000)]);
      }
      return steps;
    };
    expect(course('Caputo')).toEqual(course('Yaarbro'));
  });

  it('it is back within a second and a half of a hit at full range', () => {
    const game = make(yardWith([scout({ z: -4.4, x: 8 })]), 'Yaarbro');
    game.facing = Math.atan2(8, -4.4);
    const before = game.seconds;
    const events = send(game);
    expect(ally(events)).toContain('hit');
    expect(game.seconds - before).toBeLessThan(1.5);
  });
});
