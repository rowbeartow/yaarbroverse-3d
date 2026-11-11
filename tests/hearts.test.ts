// Hearts: what being hurt costs, what protects a hero afterwards, and what
// happens when the last heart goes. These are Caputo Mountain's rules.

import { describe, expect, it } from 'vitest';
import { Game, IDLE } from '../src/game/game';
import { DIFFICULTIES } from '../src/game/difficulty';
import { HEROES, MOVE, STEP } from '../src/game/hero';
import { GROVE_DIFFICULTY } from '../src/levels/bouncing-grove/difficulty';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { Bot } from './helpers/bot';
import { RIGHT, hold, solid, start, yard } from './helpers/yard';

const types = (game: Game): string[] => game.events.map((event) => event.type);

describe('being hurt', () => {
  it('starts with the level’s hearts and none lost', () => {
    const game = start(yard([], { hearts: 4 }));
    expect(game.hearts).toBe(4);
    expect(game.heartsLost).toBe(0);
    expect(game.summary().heartsLost).toBe(0);
  });

  it('costs one heart, and says so in the next step’s events', () => {
    const game = start();
    expect(game.hurt(1, 0)).toBe(true);
    expect(game.hearts).toBe(2);
    expect(game.heartsLost).toBe(1);
    hold(game, {}, STEP);
    expect(game.events).toContainEqual({ type: 'hurt', left: 2 });
  });

  it('knocks the hero up and away from what hurt it', () => {
    const fromRight = start();
    fromRight.hurt(1, 0);
    hold(fromRight, {}, 0.1);
    expect(fromRight.x).toBeLessThan(-0.2);
    expect(fromRight.y).toBeGreaterThan(0.2);
    const fromBehind = start();
    fromBehind.hurt(0, 2);
    hold(fromBehind, {}, 0.1);
    expect(fromBehind.z).toBeLessThan(-0.2);
    expect(Math.abs(fromBehind.x)).toBeLessThan(1e-6);
  });

  it('takes the controls for a moment, then gives them back', () => {
    const game = start();
    game.hurt(1, 0);
    // Pushing toward what hurt it does nothing at first: it is still thrown the other way.
    hold(game, RIGHT, MOVE.hurtLock - STEP);
    expect(game.vx).toBeLessThan(0);
    hold(game, RIGHT, 0.6);
    expect(game.vx).toBeGreaterThan(0);
  });

  it('protects the hero for a while afterwards, and not for ever', () => {
    const game = start();
    game.hurt(1, 0);
    hold(game, {}, MOVE.hurtProtection - 0.1);
    expect(game.hurt(1, 0)).toBe(false);
    expect(game.hearts).toBe(2);
    hold(game, {}, 0.2);
    expect(game.protectedFor).toBe(0);
    expect(game.hurt(1, 0)).toBe(true);
    expect(game.hearts).toBe(1);
  });

  it('protects for longer or shorter as the level’s difficulty says', () => {
    const gentle = start(yard([], { protection: 1.5 }));
    gentle.hurt(1, 0);
    expect(gentle.protectedFor).toBeCloseTo(MOVE.hurtProtection * 1.5, 5);
    const harsh = start(yard([], { protection: 0.6 }));
    harsh.hurt(1, 0);
    expect(harsh.protectedFor).toBeCloseTo(MOVE.hurtProtection * 0.6, 5);
  });

  it('does nothing once the leaf has been reached', () => {
    const game = start(yard([], { leaf: { x: 0, y: 0.8, z: 0, radius: 0.7 } }));
    hold(game, {}, STEP);
    expect(game.complete).toBe(true);
    expect(game.hurt(1, 0)).toBe(false);
    expect(game.hearts).toBe(3);
  });
});

describe('a fall', () => {
  it('costs no heart: the hero is back on the safe bank with the hearts it had', () => {
    const game = start();
    game.hurt(-1, 0);
    hold(game, RIGHT, 5);
    expect(game.falls).toBe(1);
    expect(game.hearts).toBe(2);
    expect(game.heartsLost).toBe(1);
  });
});

describe('running out of hearts', () => {
  /** A floor with a second safe bank to the right, 8 m along, level with it. */
  const twoBanks = () => yard([solid('far', 14, 0, 4, 5, 0, { safe: true })], { hearts: 2 });

  it('returns the hero to the last safe bank it stood on, with every heart again', () => {
    const game = start(twoBanks());
    hold(game, RIGHT, 2.2);
    expect(game.safe.id).toBe('far');
    // Hurt from the near side each time, so the throw keeps it on the far bank.
    game.hurt(game.x - 1, 0);
    hold(game, {}, MOVE.hurtProtection + 0.1);
    expect(game.safe.id).toBe('far');
    game.hurt(game.x - 1, 0);
    expect(game.hearts).toBe(0);
    let restored = false;
    for (let i = 0; i < 120 && !restored; i += 1) {
      hold(game, RIGHT, STEP);
      restored = types(game).includes('restored');
    }
    expect(restored).toBe(true);
    expect(game.hearts).toBe(2);
    expect(game.heartsLost).toBe(2);
    expect([game.x, game.y, game.z]).toEqual([14, 0, 0]);
    expect(game.grounded).toBe(true);
    // It is not a fall, and is not counted as one.
    expect(game.falls).toBe(0);
  });

  it('waits a moment first, with the buttons doing nothing', () => {
    const game = start(yard([], { hearts: 1 }));
    game.hurt(1, 0);
    hold(game, RIGHT, MOVE.faintPause - 2 * STEP);
    expect(game.hearts).toBe(0);
    expect(game.vx).toBeLessThanOrEqual(0);
    hold(game, RIGHT, 3 * STEP);
    expect(game.hearts).toBe(1);
  });

  it('protects the hero for a moment once it is back', () => {
    const game = start(yard([], { hearts: 1, protection: 1.5 }));
    game.hurt(1, 0);
    hold(game, {}, MOVE.faintPause + STEP);
    expect(game.hearts).toBe(1);
    expect(game.protectedFor).toBeCloseTo(MOVE.returnProtection * 1.5, 1);
    expect(game.hurt(1, 0)).toBe(false);
  });

  it('ends on the safe bank with every heart even when the last hit knocks the hero off an edge', () => {
    const game = start(yard([], { hearts: 1, spawn: { x: 9.9, y: 0, z: 0 } }));
    game.hurt(game.x - 1, 0);
    hold(game, {}, 0.2);
    expect(game.x).toBeGreaterThan(10.3);
    hold(game, {}, 4);
    expect(game.hearts).toBe(1);
    expect(game.heartsLost).toBe(1);
    expect([game.x, game.y]).toEqual([9.9, 0]);
    expect(game.grounded).toBe(true);
  });
});

describe('hearts in the grove', () => {
  it('follows Caputo Mountain: 5 on Easy, 3 on Normal, 2 on Hard', () => {
    expect(DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty].hearts)).toEqual([5, 3, 2]);
    expect(DIFFICULTIES.map((difficulty) => GROVE_DIFFICULTY[difficulty].protection)).toEqual([1.5, 1, 0.6]);
  });

  it.each(DIFFICULTIES)('on %s the level uses the numbers from the difficulty file', (difficulty) => {
    const level = buildGrove(difficulty);
    expect(level.hearts).toBe(GROVE_DIFFICULTY[difficulty].hearts);
    expect(level.protection).toBe(GROVE_DIFFICULTY[difficulty].protection);
    for (const hero of HEROES) expect(new Game(level, difficulty, hero).hearts).toBe(level.hearts);
  });

  it.each(DIFFICULTIES)('on %s, losing every heart in any section returns the hero to the last safe bank before it', (difficulty) => {
    // The same bank a fall there returns to, so on Hard the cost is the one
    // tests/sections.test.ts measures: never more than about 30 seconds of a perfect run.
    const level = buildGrove(difficulty);
    const byId = (id: string) => level.solids.find((s) => s.id === id)!;
    let lastSafe = level.route[0];
    for (const section of level.sections ?? []) {
      const from = section.solids.find((id) => byId(id).kind !== 'bank' && !byId(id).bounce);
      if (from) {
        const game = new Game(level, difficulty, 'Caputo');
        const bot = new Bot(level);
        for (let i = 0; i < 300 / STEP && game.groundId !== from; i += 1) game.step(bot.input(game));
        expect(game.groundId).toBe(from);
        let restored = false;
        for (let i = 0; i < 60 / STEP && !restored; i += 1) {
          // Something beside the hero keeps hurting it whenever it can be hurt.
          game.hurt(game.x + 0.5, game.z);
          game.step(IDLE);
          restored = types(game).includes('restored');
        }
        expect(restored, `${section.name} on ${difficulty}`).toBe(true);
        expect(game.groundId, `${section.name} on ${difficulty}`).toBe(lastSafe);
        expect(game.hearts).toBe(level.hearts);
      }
      for (const id of section.solids) if (byId(id).safe) lastSafe = id;
    }
  });
});
