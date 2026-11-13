// The marmot scout and the giant mosquito: what each does, what hurts a hero,
// and what each hero's move (and a landing on top) does to each of them.
// Their behaviour is Caputo Mountain's.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { ENEMY, type Enemy, type EnemyPhase, type EnemySpot } from '../src/game/enemy';
import { Game, IDLE, type Input } from '../src/game/game';
import { HEROES, MOVE, STEP, fullJumpHeight, type HeroName } from '../src/game/hero';
import { GROVE_DIFFICULTY } from '../src/levels/bouncing-grove/difficulty';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { Bot } from './helpers/bot';
import { solid, yard } from './helpers/yard';

/** A long floor (x from -10 to 80) with one enemy on it. The hero starts at x = 0. */
const WIDE = { minX: 2, maxX: 30, minZ: -4, maxZ: 4 };
const marmotAt = (x: number, z = 0): EnemySpot => ({ id: 'scout', kind: 'marmot', x, y: 0, z, arena: WIDE, notice: 0 });
const mosquitoAt = (x: number, z = 0): EnemySpot => ({ id: 'mosquito', kind: 'mosquito', x, y: 3.6, z, arena: WIDE, floor: 0.8, ceiling: 5 });
const field = (spot: EnemySpot, more: Partial<Parameters<typeof yard>[1]> = {}) =>
  yard([solid('long', 40, 0, 40, 5, 0)], { enemies: [spot], hearts: 3, ...more });
const play = (spot: EnemySpot, hero: HeroName = 'Yaarbro', more = {}): { game: Game; enemy: Enemy } => {
  const game = new Game(field(spot, more), 'normal', hero);
  return { game, enemy: game.enemies[0] };
};
const run = (game: Game, input: Partial<Input>, seconds: number): EnemyPhase[] => {
  const entered: EnemyPhase[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
    game.step({ ...IDLE, ...input });
    for (const event of game.events) if (event.type === 'enemy') entered.push(event.phase);
  }
  return entered;
};
/** Stands the hero still at a spot. */
const stand = (game: Game, x: number, z = 0): void => {
  Object.assign(game, { x, z, y: 0, vx: 0, vy: 0, vz: 0, grounded: true });
};
const RIGHT = { moveX: 1 };

describe('the marmot scout', () => {
  it('hides until a hero comes onto its patch, and leaves a hero anywhere else alone', () => {
    const { game, enemy } = play(marmotAt(12));
    run(game, {}, 3);
    expect(enemy.phase).toBe('concealed');
    stand(game, 4);
    expect(run(game, {}, STEP)).toEqual(['idle']);
  });

  it('gets ready, warns, throws, then rests, in that order and for the times in the rules', () => {
    const { game } = play(marmotAt(12));
    stand(game, 4);
    const seen: Array<[EnemyPhase, number]> = [];
    for (let i = 0; i < 6 / STEP && seen.length < 5; i += 1) {
      game.step(IDLE);
      for (const event of game.events) if (event.type === 'enemy') seen.push([event.phase, i * STEP]);
      // Step aside before the acorn lands, so the loop is seen whole.
      if (seen.length === 3 && game.z === 0) stand(game, 4, 3);
    }
    expect(seen.map(([phase]) => phase)).toEqual(['idle', 'warning', 'attack', 'rest', 'idle']);
    const at = Object.fromEntries(seen.slice(1)) as Record<string, number>;
    expect(at.warning).toBeCloseTo(ENEMY.marmotReady, 1);
    expect(at.attack - at.warning).toBeCloseTo(ENEMY.warning, 1);
    expect(seen[4][1] - at.rest).toBeCloseTo(ENEMY.rest, 1);
  });

  it('throws its acorn at where the hero stood when the warning began: standing still costs a heart', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 6);
    run(game, {}, 4);
    expect(game.hearts).toBe(2);
    expect(enemy.phase === 'rest' || enemy.phase === 'idle' || enemy.phase === 'warning').toBe(true);
  });

  it('does not follow a hero who moves after the warning began: stepping aside is enough', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 6);
    const entered = run(game, {}, ENEMY.marmotReady + 0.1);
    expect(entered).toContain('warning');
    const aim = { ...enemy.target };
    // Walk across the line of fire, not along it.
    run(game, { moveZ: 1 }, 0.5);
    run(game, {}, 3);
    expect([enemy.target.x, enemy.target.z].every(Number.isFinite)).toBe(true);
    expect(aim.x).toBeCloseTo(6, 5);
    expect(game.hearts).toBe(3);
  });

  it('shuffles toward a hero who is far off and backs away from one who is close, and never leaves its patch', () => {
    const far = play(marmotAt(12));
    stand(far.game, 4);
    run(far.game, {}, 0.4);
    expect(far.enemy.x).toBeLessThan(12);

    const close = play(marmotAt(12));
    stand(close.game, 10.5);
    run(close.game, {}, 0.4);
    expect(close.enemy.x).toBeGreaterThan(12);

    const cornered = play({ ...marmotAt(29.5) });
    stand(cornered.game, 28);
    run(cornered.game, {}, 0.45);
    expect(cornered.enemy.x).toBeLessThanOrEqual(30);
  });

  it.each([['idle', true], ['attack', true], ['warning', false], ['rest', false], ['dodge', false]] as const)(
    'touching it while it is in "%s": hurts %s',
    (phase, hurts) => {
      const { game, enemy } = play(marmotAt(12));
      stand(game, 11.5);
      Object.assign(enemy, { phase, timer: 0, from: { x: 12, y: 0, z: 0 }, target: { x: 12, y: 0, z: 0 } });
      game.step(IDLE);
      expect(game.hearts).toBe(hurts ? 2 : 3);
    },
  );

  it('cannot hurt a hero who is protected, and a beaten one hurts nobody', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 11.5);
    enemy.phase = 'idle';
    game.protectedFor = 1;
    game.step(IDLE);
    expect(game.hearts).toBe(3);
    game.protectedFor = 0;
    enemy.phase = 'defeated';
    game.step(IDLE);
    expect(game.hearts).toBe(3);
  });

  it('hops back from a hero charging it along the ground, then rests where it lands', () => {
    const { game, enemy } = play(marmotAt(16));
    stand(game, 4);
    // On watch, and not about to throw: it only dodges while it is watching.
    game.step(IDLE);
    Object.assign(enemy, { timer: -20 });
    const entered = run(game, { ...RIGHT, move: true }, 1.6);
    expect(entered).toContain('dodge-warning');
    expect(entered).toContain('dodge');
    expect(enemy.x).toBeGreaterThan(16);
    // It does not dodge a hero who only walks at it.
    const walked = play(marmotAt(16));
    stand(walked.game, 4);
    walked.game.step(IDLE);
    Object.assign(walked.enemy, { timer: -20 });
    expect(run(walked.game, RIGHT, 1.2)).not.toContain('dodge-warning');
  });
});

describe('the giant mosquito', () => {
  it('hovers above a hero on its patch, following from overhead', () => {
    const { game, enemy } = play(mosquitoAt(12));
    stand(game, 8);
    run(game, {}, 0.3);
    expect(enemy.x).toBeLessThan(12);
    expect(enemy.y).toBeGreaterThanOrEqual(game.y + MOVE.bodyHeight / 2 + ENEMY.diveAbove);
    expect(enemy.phase).toBe('idle');
  });

  it('goes home when the hero leaves its patch', () => {
    const { game, enemy } = play(mosquitoAt(12));
    stand(game, 8);
    run(game, {}, 0.3);
    stand(game, -5);
    run(game, {}, 6);
    expect([enemy.x, enemy.y, enemy.z]).toEqual([12, 3.6, 0]);
  });

  it('warns, then dives to where the hero stood, and rests there, low enough to reach', () => {
    const { game, enemy } = play(mosquitoAt(8));
    stand(game, 8);
    const seen = run(game, {}, ENEMY.mosquitoReady + 0.1);
    expect(seen).toEqual(['warning']);
    const aim = { ...enemy.target };
    expect([aim.x, aim.z]).toEqual([8, 0]);
    // The hero walks on. The dive still goes to the old spot.
    run(game, RIGHT, ENEMY.warning + ENEMY.diveTime + 0.2);
    expect(enemy.phase).toBe('rest');
    expect([enemy.x, enemy.z]).toEqual([8, 0]);
    expect(enemy.y).toBeLessThan(MOVE.bodyHeight);
    expect(game.hearts).toBe(3);
  });

  it('standing still under it costs a heart', () => {
    const { game } = play(mosquitoAt(8));
    stand(game, 8);
    run(game, {}, 3);
    expect(game.hearts).toBe(2);
  });

  it('jumping up into it while it hovers costs a heart', () => {
    const { game, enemy } = play(mosquitoAt(8));
    stand(game, 8);
    Object.assign(enemy, { x: 8, y: 2.6, phase: 'idle', timer: -5 });
    run(game, { jump: true }, 0.5);
    expect(game.hearts).toBe(2);
  });

  it('never flies outside its patch, even after a hero at its edge', () => {
    const { game, enemy } = play(mosquitoAt(28));
    stand(game, 30);
    for (let i = 0; i < 5 / STEP; i += 1) {
      game.step({ ...IDLE, ...RIGHT });
      expect(enemy.x).toBeLessThanOrEqual(30 + 1e-9);
    }
  });
});

describe('the difficulty’s timing', () => {
  const tuned = (enemyTuning: { warning: number; speed: number; rest: number }) => play(marmotAt(12), 'Yaarbro', { enemyTuning });
  const times = (game: Game): Record<string, number> => {
    const at: Record<string, number> = {};
    stand(game, 4);
    for (let i = 0; i < 10 / STEP; i += 1) {
      game.step(IDLE);
      for (const event of game.events) if (event.type === 'enemy' && !(event.phase in at)) at[event.phase] = i * STEP;
      if ('attack' in at && game.z === 0) stand(game, 4, 3);
      if (event_done(at)) break;
    }
    return at;
  };
  const event_done = (at: Record<string, number>): boolean => 'rest' in at && Object.keys(at).length >= 4 && at.idle !== undefined;

  it('a longer warning on Easy, a shorter one on Hard', () => {
    const easy = times(tuned({ warning: 1.5, speed: 1, rest: 1 }).game);
    const hard = times(tuned({ warning: 0.65, speed: 1, rest: 1 }).game);
    expect(easy.attack - easy.warning).toBeCloseTo(ENEMY.warning * 1.5, 1);
    expect(hard.attack - hard.warning).toBeCloseTo(ENEMY.warning * 0.65, 1);
  });

  it('a slower acorn on Easy, a faster one on Hard', () => {
    const easy = times(tuned({ warning: 1, speed: 0.7, rest: 1 }).game);
    const hard = times(tuned({ warning: 1, speed: 1.3, rest: 1 }).game);
    expect(easy.rest - easy.attack).toBeGreaterThan(hard.rest - hard.attack);
  });

  it('a longer rest on Easy, a shorter one on Hard', () => {
    const rested = (rest: number): number => {
      const { game, enemy } = tuned({ warning: 1, speed: 1, rest });
      stand(game, 4);
      enemy.phase = 'rest';
      enemy.timer = 0;
      let steps = 0;
      while (enemy.phase === 'rest' && steps < 600) {
        game.step(IDLE);
        steps += 1;
      }
      return steps * STEP;
    };
    expect(rested(1.4)).toBeCloseTo(ENEMY.rest * 1.4, 1);
    expect(rested(0.7)).toBeCloseTo(ENEMY.rest * 0.7, 1);
  });
});

describe('each move against each enemy', () => {
  /** Rolls Yaarbro from x = 2 at whatever is ahead. Returns the strikes that landed. */
  const strikes = (game: Game, input: Partial<Input>, seconds: number): string[] => {
    const landed: string[] = [];
    for (let i = 0; i < Math.round(seconds / STEP); i += 1) {
      game.step({ ...IDLE, ...input });
      for (const event of game.events) if (event.type === 'strike') landed.push(`${event.how}:${event.left}`);
    }
    return landed;
  };

  it('Yaarbro’s roll beats the marmot scout in two strikes, and costs him no heart', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 3);
    // It is resting: it cannot hop away, and touching it does not hurt.
    Object.assign(enemy, { phase: 'rest', timer: -20 });
    expect(strikes(game, { ...RIGHT, move: true }, 1.4)).toEqual(['roll:1']);
    expect(enemy.phase).toBe('rest');
    stand(game, enemy.x - 7);
    enemy.timer = -20;
    expect(strikes(game, { ...RIGHT, move: true }, 1.4)).toEqual(['roll:0']);
    expect(enemy.phase).toBe('defeated');
    expect(game.beaten).toBe(1);
    expect(game.hearts).toBe(3);
  });

  it('a roll that is no faster than a walk is only a touch: against a scout on watch it costs a heart', () => {
    const { game, enemy } = play(marmotAt(4.2));
    stand(game, 3.4);
    Object.assign(enemy, { phase: 'idle', timer: -20, dodgeRest: 99 });
    expect(strikes(game, { ...RIGHT, move: true }, 2 * STEP)).toEqual([]);
    expect(game.hearts).toBe(2);
  });

  it('Yaarbro’s roll beats a scout on watch too: the strike wins over the touch', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 3);
    Object.assign(enemy, { phase: 'idle', timer: -20, dodgeRest: 99 });
    expect(strikes(game, { ...RIGHT, move: true }, 1.4)).toEqual(['roll:1']);
    expect(game.hearts).toBe(3);
  });

  it('Yaarbro’s roll beats the giant mosquito in one strike, where it rests after a dive', () => {
    const { game, enemy } = play(mosquitoAt(12));
    stand(game, 3);
    Object.assign(enemy, { x: 12, y: 0.8, phase: 'rest', timer: -20 });
    expect(strikes(game, { ...RIGHT, move: true }, 1.4)).toEqual(['roll:0']);
    expect(enemy.phase).toBe('defeated');
    expect(game.hearts).toBe(3);
  });

  it('Yaarbro’s roll-jump beats the giant mosquito in the air', () => {
    const { game, enemy } = play(mosquitoAt(12));
    stand(game, 3);
    Object.assign(enemy, { x: 12.5, y: 2.4, phase: 'idle', timer: -20 });
    const landed: string[] = [];
    for (let i = 0; i < 2 / STEP && landed.length === 0; i += 1) {
      // Roll, and jump a little before reaching it.
      game.step({ ...IDLE, ...RIGHT, move: true, jump: game.x > 7.5 });
      enemy.x = 12.5;
      enemy.y = 2.4;
      for (const event of game.events) if (event.type === 'strike') landed.push(`${event.how}:${event.left}`);
    }
    expect(landed).toEqual(['roll:0']);
    expect(game.hearts).toBe(3);
  });

  it('Caputo’s pounce beats the marmot scout in two strikes, bouncing him up off it each time', () => {
    const { game, enemy } = play(marmotAt(6), 'Caputo');
    stand(game, 4);
    Object.assign(enemy, { phase: 'idle', timer: -20, dodgeRest: 99 });
    expect(strikes(game, { ...RIGHT, move: true }, 0.2)).toEqual(['pounce:1']);
    expect(game.vy).toBeGreaterThan(MOVE.jumpSpeed * 0.5);
    expect(game.pouncing).toBe(0);
    // Thrown up above it. (Coming straight back down on it would be a landing on top, which also strikes.)
    stand(game, enemy.x - 2);
    Object.assign(enemy, { phase: 'idle', timer: -20, dodgeRest: 99, flash: 0 });
    game.step(IDLE);
    expect(strikes(game, { ...RIGHT, move: true }, 0.2)).toEqual(['pounce:0']);
    expect(enemy.phase).toBe('defeated');
    expect(game.hearts).toBe(3);
  });

  it('Caputo’s pounce beats the giant mosquito in one strike, out of a jump', () => {
    const { game, enemy } = play(mosquitoAt(12), 'Caputo');
    stand(game, 10);
    Object.assign(enemy, { x: 12, y: 2.6, phase: 'idle', timer: -20 });
    const landed: string[] = [];
    for (let i = 0; i < 2 / STEP && landed.length === 0; i += 1) {
      // Jump, then pounce near the top.
      game.step({ ...IDLE, ...RIGHT, jump: true, move: game.y > 1.4 });
      enemy.x = 12;
      enemy.y = 2.6;
      for (const event of game.events) if (event.type === 'strike') landed.push(`${event.how}:${event.left}`);
    }
    expect(landed).toEqual(['pounce:0']);
    expect(enemy.phase).toBe('defeated');
    expect(game.hearts).toBe(3);
  });

  it('Caputo’s pounce beats the giant mosquito where it rests after a dive, too', () => {
    const { game, enemy } = play(mosquitoAt(12), 'Caputo');
    stand(game, 10);
    Object.assign(enemy, { x: 12, y: 0.8, phase: 'rest', timer: -20 });
    expect(strikes(game, { ...RIGHT, move: true }, 0.3)).toEqual(['pounce:0']);
  });

  it.each(HEROES)('%s landing on top of either one strikes it and bounces off', (hero) => {
    for (const spot of [marmotAt(12), mosquitoAt(12)]) {
      const { game, enemy } = play(spot, hero);
      stand(game, 12);
      Object.assign(enemy, { x: 12, y: spot.kind === 'marmot' ? 0 : 1.2, phase: 'idle', timer: -20 });
      Object.assign(game, { y: 3.5, grounded: false, vy: -2 });
      const landed = strikes(game, {}, 0.6);
      expect(landed[0]).toBe(`stomp:${spot.kind === 'marmot' ? 1 : 0}`);
      expect(game.hearts).toBe(3);
      expect(game.movesUsed).toBe(0);
    }
  });

  it('a strike protects the hero for a moment, and the enemy cannot be struck twice at once', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 3);
    Object.assign(enemy, { phase: 'rest', timer: -20 });
    strikes(game, { ...RIGHT, move: true }, 1.2);
    expect(enemy.hits).toBe(1);
    expect(enemy.flash > 0 || game.x > enemy.x + 1).toBe(true);
  });
});

describe('after a fall, or after running out of hearts', () => {
  it('an enemy that is not beaten goes back to where it began, keeping the strikes it has taken', () => {
    const { game, enemy } = play(marmotAt(12));
    stand(game, 3);
    Object.assign(enemy, { phase: 'rest', timer: -20 });
    for (let i = 0; i < 90 && enemy.hits === 2; i += 1) game.step({ ...IDLE, ...RIGHT, move: true });
    expect(enemy.hits).toBe(1);
    // Walk off the near side.
    for (let i = 0; i < 600 && game.falls === 0; i += 1) game.step({ ...IDLE, moveZ: 1 });
    expect(game.falls).toBe(1);
    expect([enemy.x, enemy.z, enemy.phase, enemy.hits]).toEqual([12, 0, 'concealed', 1]);
  });

  it('a beaten enemy stays beaten', () => {
    const { game, enemy } = play(mosquitoAt(12));
    Object.assign(enemy, { phase: 'defeated', hits: 0 });
    for (let i = 0; i < 600 && game.falls === 0; i += 1) game.step({ ...IDLE, moveZ: 1 });
    expect(enemy.phase).toBe('defeated');
  });
});

describe('a marmot scout that walks a beat and gives chase', () => {
  // Normal's numbers in the grove, near enough.
  const TOUGH = { warning: 0.7, speed: 1, rest: 1, patrolSpeed: 1.6, chaseSpeed: 3.4 };
  // Home at x = 12 on a patch from 2 to 30, so the far end of its beat is x = 20.
  const tough = (hero: HeroName = 'Yaarbro', tuning = TOUGH) => play(marmotAt(12), hero, { enemyTuning: tuning });
  /** Parks the hero well off the patch, where no enemy notices it. */
  const away = (game: Game): void => stand(game, -6);

  it('is in plain view from the start and walks back and forth across its patch, with a look about at each end', () => {
    const { game, enemy } = tough();
    away(game);
    game.step(IDLE);
    expect(enemy.phase).toBe('patrol');
    const seen: number[] = [];
    let stoodStill = 0;
    for (let i = 0; i < 20 / STEP; i += 1) {
      const before = enemy.x;
      game.step(IDLE);
      seen.push(enemy.x);
      if (enemy.x === before) stoodStill += 1;
      expect(enemy.phase).toBe('patrol');
    }
    expect(Math.min(...seen)).toBeCloseTo(12, 5);
    expect(Math.max(...seen)).toBeCloseTo(20, 5);
    // It reaches the far end, comes back, and sets off again.
    expect(seen.indexOf(20)).toBeGreaterThan(0);
    expect(seen.lastIndexOf(12)).toBeGreaterThan(seen.indexOf(20));
    expect(stoodStill * STEP).toBeGreaterThan(ENEMY.patrolPause * 2);
  });

  it('walks the beat its level gives it, when it gives one', () => {
    const { game, enemy } = play({ ...marmotAt(12), beat: { x: 12, z: 3 } }, 'Yaarbro', { enemyTuning: TOUGH });
    away(game);
    run(game, {}, 3 / TOUGH.patrolSpeed + 0.1);
    expect([enemy.x, enemy.z]).toEqual([12, 3]);
  });

  it('spots a hero on its patch, stands a beat, then comes after it', () => {
    const { game, enemy } = tough();
    stand(game, 3);
    expect(run(game, {}, STEP * 2)).toEqual(['idle']);
    const from = enemy.x;
    run(game, {}, ENEMY.marmotReady - STEP * 4);
    // The beat on the spot is its tell.
    expect(enemy.x).toBe(from);
    run(game, {}, 1);
    expect(from - enemy.x).toBeCloseTo(TOUGH.chaseSpeed * 1, 0);
  });

  it('stops a few metres off to throw, with the warning first', () => {
    const { game, enemy } = tough();
    stand(game, 3);
    const entered = run(game, {}, 3);
    expect(entered.slice(0, 3)).toEqual(['idle', 'warning', 'attack']);
    // It threw from within its range, not from where it first stood.
    expect(enemy.x - 3).toBeLessThanOrEqual(ENEMY.marmotFar + 0.1);
    expect(enemy.x - 3).toBeGreaterThanOrEqual(ENEMY.marmotNear);
  });

  it('throws from where it is, once it has chased long enough without getting near', () => {
    const { game } = play(marmotAt(29), 'Yaarbro', { enemyTuning: { ...TOUGH, chaseSpeed: 0.5 } });
    stand(game, 3);
    const seen: Array<[EnemyPhase, number]> = [];
    for (let i = 0; i < 4 / STEP; i += 1) {
      game.step(IDLE);
      for (const event of game.events) if (event.type === 'enemy') seen.push([event.phase, i * STEP]);
    }
    const warning = seen.find(([phase]) => phase === 'warning');
    expect(warning?.[1]).toBeCloseTo(ENEMY.chaseLong, 1);
  });

  it('runs straight at a hero who is close, and touching it costs a heart', () => {
    const { game, enemy } = tough();
    stand(game, 10);
    const entered = run(game, {}, 1.2);
    expect(entered).not.toContain('warning');
    expect(game.hearts).toBe(2);
    // It hurt the hero, so it rests.
    expect(enemy.phase).toBe('rest');
  });

  it('gives up when the hero leaves its patch, and goes back to its beat', () => {
    const { game, enemy } = tough();
    stand(game, 3);
    run(game, {}, 0.8);
    expect(enemy.x).toBeLessThan(12);
    away(game);
    expect(run(game, {}, STEP * 2)).toEqual(['patrol']);
    run(game, {}, 20);
    expect(enemy.phase).toBe('patrol');
    expect(enemy.x).toBeGreaterThanOrEqual(12 - 1e-9);
    expect(enemy.x).toBeLessThanOrEqual(20 + 1e-9);
    expect(enemy.z).toBe(0);
  });

  it('never leaves its patch, even after a hero just outside it', () => {
    const { game, enemy } = play({ ...marmotAt(4), notice: 3 }, 'Yaarbro', { enemyTuning: TOUGH });
    stand(game, 0);
    for (let i = 0; i < 4 / STEP; i += 1) {
      game.step(IDLE);
      expect(enemy.x).toBeGreaterThanOrEqual(2);
    }
  });

  it('on its beat it hurts to walk into, and can be landed on', () => {
    const walked = tough();
    away(walked.game);
    walked.game.step(IDLE);
    Object.assign(walked.enemy, { grace: 60 });
    stand(walked.game, 11.4);
    walked.game.step(IDLE);
    expect(walked.game.hearts).toBe(2);

    const landed = tough();
    away(landed.game);
    landed.game.step(IDLE);
    Object.assign(landed.enemy, { grace: 60, pause: 60 });
    Object.assign(landed.game, { x: 12, z: 0, y: 2, vx: 0, vy: -3, vz: 0, grounded: false });
    run(landed.game, {}, 0.4);
    expect(landed.enemy.hits).toBeLessThan(ENEMY.marmotHits);
    expect(landed.game.hearts).toBe(3);
  });

  it('a hero who keeps running is never caught: the chase is slower than a walk', () => {
    const { game } = play(marmotAt(12), 'Yaarbro', { enemyTuning: { ...TOUGH, chaseSpeed: 4.6 } });
    stand(game, 10);
    run(game, { moveX: -1 }, 0.1);
    // Run up and down the far side of the patch for a while.
    for (let lap = 0; lap < 6; lap += 1) {
      run(game, { moveZ: lap % 2 ? 1 : -1 }, 1);
    }
    expect(game.hearts).toBe(3);
  });

  it('without the two speeds it hides and holds its distance, as it always did', () => {
    const { game, enemy } = play(marmotAt(12), 'Yaarbro', { enemyTuning: { warning: 1.5, speed: 0.7, rest: 1.4, patrolSpeed: 0, chaseSpeed: 0 } });
    away(game);
    run(game, {}, 3);
    expect([enemy.phase, enemy.x]).toEqual(['concealed', 12]);
    stand(game, 10.5);
    run(game, {}, 0.4);
    expect(enemy.x).toBeGreaterThan(12);
  });
});

describe('a giant mosquito that keeps up and dives more often', () => {
  const KEEN = { warning: 0.7, speed: 1, rest: 1, followSpeed: 5, hoverAbove: 3.4, divePause: 0.6 };
  const keen = (tuning = KEEN) => play({ ...mosquitoAt(8), y: 4.6, ceiling: 6 }, 'Yaarbro', { enemyTuning: tuning });

  it('keeps up with a hero walking along under it, where the slow one is left behind', () => {
    const gap = (tuning: typeof KEEN | { warning: number; speed: number; rest: number }): number => {
      const { game, enemy } = play({ ...mosquitoAt(8), y: 4.6, ceiling: 6 }, 'Yaarbro', { enemyTuning: tuning });
      stand(game, 8);
      // Hold it on watch, so only the following is measured.
      enemy.timer = -60;
      run(game, { moveX: 0.8 }, 2.5);
      return game.x - enemy.x;
    };
    expect(gap(KEEN)).toBeLessThan(0.5);
    expect(gap({ warning: 1, speed: 1, rest: 1 })).toBeGreaterThan(4);
  });

  it('hovers high enough that a full jump under it does not touch it', () => {
    const { game, enemy } = keen();
    stand(game, 8);
    enemy.timer = -60;
    run(game, {}, 1);
    expect(enemy.y).toBeCloseTo(MOVE.bodyHeight / 2 + 3.4, 5);
    run(game, { jump: true }, 0.9);
    expect(game.hearts).toBe(3);
  });

  it('dives more often: less time getting ready and a shorter rest', () => {
    const dives = (tuning: typeof KEEN): number => {
      const { game } = keen(tuning);
      stand(game, 8);
      let count = 0;
      for (let i = 0; i < 12 / STEP; i += 1) {
        // Keep walking up and down the patch, so no dive lands.
        game.step({ ...IDLE, moveX: Math.floor(i / 150) % 2 ? -1 : 1 });
        for (const event of game.events) if (event.type === 'enemy' && event.phase === 'attack') count += 1;
      }
      return count;
    };
    expect(dives(KEEN)).toBeGreaterThan(dives({ ...KEEN, divePause: 1 }));
  });
});

describe('after a hero is sent back to a safe bank', () => {
  it('no enemy notices the hero for a moment, so nothing is on top of it before it can move', () => {
    const { game, enemy } = play({ ...marmotAt(3), notice: 3 }, 'Yaarbro', { enemyTuning: { warning: 0.45, speed: 1.3, rest: 0.7, patrolSpeed: 2.2, chaseSpeed: 4.6 } });
    // Walk off the near side: the fall returns the hero to the middle of the floor, on the scout's patch.
    for (let i = 0; i < 600 && game.falls === 0; i += 1) game.step({ ...IDLE, moveZ: 1 });
    expect(game.falls).toBe(1);
    expect(enemy.grace).toBe(ENEMY.homeGrace);
    const entered = run(game, {}, ENEMY.homeGrace - 0.1);
    expect(entered).toEqual([]);
    expect(game.hearts).toBe(3);
    expect(ENEMY.homeGrace).toBeGreaterThan(MOVE.returnPause + 0.5);
    expect(run(game, {}, 0.2)).toEqual(['idle']);
  });
});

describe('the enemies of the Bouncing Grove', () => {
  it('on Easy the scouts hide and hold their distance; on Normal and Hard they walk a beat and give chase, slower than a hero walks', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty]);
    expect([easy.scoutPatrol, easy.scoutChase]).toEqual([0, 0]);
    expect(normal.scoutPatrol).toBeGreaterThan(0);
    expect(hard.scoutPatrol).toBeGreaterThan(normal.scoutPatrol);
    expect(normal.scoutChase).toBeGreaterThan(normal.scoutPatrol);
    expect(hard.scoutChase).toBeGreaterThan(normal.scoutChase);
    expect(hard.scoutChase).toBeLessThan(MOVE.walkSpeed);
  });

  it('keeps a warning before every attack: long on Easy, noticeably shorter on Normal, brief on Hard', () => {
    const seconds = DIFFICULTIES.map((difficulty) => ENEMY.warning * GROVE_DIFFICULTY[difficulty].enemyWarning);
    expect(seconds[0]).toBeCloseTo(1.2, 5);
    expect(seconds[1]).toBeLessThan(seconds[0] * 0.6);
    expect(seconds[2]).toBeLessThan(seconds[1] * 0.75);
    // Brief, but never gone: a third of a second is about as fast as a player can answer.
    expect(seconds[2]).toBeGreaterThanOrEqual(0.33);
  });

  it('draws the line showing where an attack will go on Easy only, and aims the attack the same way without it', () => {
    expect(DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty].enemyAimLine)).toEqual([true, false, false]);
    // The rules never read it: with and without the line, the same warning, the same aim, the same throw.
    const thrown = (aimLine: boolean) => {
      const { game, enemy } = play(marmotAt(12), 'Yaarbro', { enemyTuning: { warning: 0.7, speed: 1, rest: 1, aimLine } });
      stand(game, 6);
      const entered = run(game, {}, 2.5);
      return { entered, target: enemy.target, hearts: game.hearts };
    };
    expect(thrown(false)).toEqual(thrown(true));
    expect(thrown(false).entered).toContain('warning');
  });

  it('on Easy the mosquito is as it was; on Normal and Hard it keeps up, hovers clear of a jump and dives more often', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty]);
    expect(easy.mosquitoFollow).toBeCloseTo(ENEMY.hoverSpeed * easy.enemySpeed, 5);
    expect([easy.mosquitoHover, easy.mosquitoPause]).toEqual([ENEMY.hoverAbove, 1]);
    expect(normal.mosquitoFollow).toBeGreaterThan(easy.mosquitoFollow * 2);
    expect(hard.mosquitoFollow).toBeGreaterThan(MOVE.walkSpeed);
    for (const numbers of [normal, hard]) {
      // The top of a hero at the height of a full jump stays under the mosquito's underside.
      expect(MOVE.bodyHeight / 2 + numbers.mosquitoHover - ENEMY.mosquitoHalfHeight).toBeGreaterThan(fullJumpHeight() + MOVE.bodyHeight);
    }
    expect(normal.mosquitoPause).toBeLessThan(1);
    expect(hard.mosquitoPause).toBeLessThan(normal.mosquitoPause);
  });


  it.each(DIFFICULTIES)('on %s: a scout in the clearing, a mosquito over the later high boughs, a scout at the foot of the climb', (difficulty) => {
    const level = buildGrove(difficulty);
    expect((level.enemies ?? []).map((spot) => [spot.id, spot.kind])).toEqual([
      ['scout-clearing', 'marmot'],
      ['mosquito-boughs', 'mosquito'],
      ['scout-climb', 'marmot'],
    ]);
    const numbers = GROVE_DIFFICULTY[difficulty];
    expect(level.enemyTuning).toEqual({
      warning: numbers.enemyWarning,
      speed: numbers.enemySpeed,
      rest: numbers.enemyRest,
      patrolSpeed: numbers.scoutPatrol,
      chaseSpeed: numbers.scoutChase,
      followSpeed: numbers.mosquitoFollow,
      hoverAbove: numbers.mosquitoHover,
      divePause: numbers.mosquitoPause,
      aimLine: numbers.enemyAimLine,
    });
  });

  it.each(DIFFICULTIES)('on %s: each one notices a hero only on its own footing, never in a section of diagonal jumps', (difficulty) => {
    const level = buildGrove(difficulty);
    const allowed: Record<string, string[]> = {
      'scout-clearing': ['bank-2'],
      'mosquito-boughs': ['bough-3', 'bough-4', 'bough-5'],
      // The first mushroom of the climb grows on the bank itself.
      'scout-climb': ['bank-5', 'climb-mushroom-1'],
    };
    for (const spot of level.enemies ?? []) {
      const reach = spot.notice ?? 0;
      const noticed = level.solids.filter((s) => {
        // Does any part of this solid's top lie inside the area the enemy notices?
        const overX = Math.min(s.x + s.halfX, spot.arena.maxX + reach) - Math.max(s.x - s.halfX, spot.arena.minX - reach);
        const overZ = Math.min(s.z + s.halfZ, spot.arena.maxZ + reach) - Math.max(s.z - s.halfZ, spot.arena.minZ - reach);
        return overX > 0.3 && overZ > 0.3 && Math.abs(s.top - (spot.kind === 'marmot' ? spot.y : (spot.floor ?? spot.y) - 0.8)) < ENEMY.noticeHeight;
      });
      expect(noticed.map((s) => s.id).sort(), spot.id).toEqual(allowed[spot.id].slice().sort());
      // And it starts inside its own patch.
      expect(spot.x).toBeGreaterThanOrEqual(spot.arena.minX);
      expect(spot.x).toBeLessThanOrEqual(spot.arena.maxX);
      expect(spot.z).toBeGreaterThanOrEqual(spot.arena.minZ);
      expect(spot.z).toBeLessThanOrEqual(spot.arena.maxZ);
    }
  });

  it('gives Easy the longest warnings and rests and the slowest enemies, and Hard the reverse', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty]);
    expect([easy.enemyWarning, normal.enemyWarning, hard.enemyWarning]).toEqual([1.5, 0.7, 0.45]);
    expect([easy.enemySpeed, normal.enemySpeed, hard.enemySpeed]).toEqual([0.7, 1, 1.3]);
    expect([easy.enemyRest, normal.enemyRest, hard.enemyRest]).toEqual([1.4, 1, 0.7]);
  });

  describe.each(DIFFICULTIES)('a run through the enemies on %s', (difficulty) => {
    it.each(HEROES)('%s reaches the leaf without losing a heart, though every enemy noticed the hero', (hero) => {
      const level = buildGrove(difficulty);
      const game = new Game(level, difficulty, hero);
      const bot = new Bot(level);
      const noticed = new Set<string>();
      for (let i = 0; i < 120 / STEP && !game.complete; i += 1) {
        game.step(bot.input(game));
        // A scout notices by going on watch; the mosquito is always on watch, so its first warning is the sign.
        for (const event of game.events) if (event.type === 'enemy' && (event.phase === 'idle' || event.phase === 'warning')) noticed.add(event.id);
      }
      expect(game.complete).toBe(true);
      expect(game.heartsLost).toBe(0);
      expect(game.falls).toBe(0);
      expect([...noticed].sort()).toEqual(['mosquito-boughs', 'scout-clearing', 'scout-climb']);
      // On Easy, and here on every difficulty, with walk and jump alone.
      expect(game.movesUsed).toBe(0);
    });
  });
});
