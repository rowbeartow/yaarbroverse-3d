// Rope swings (src/game/rope.ts): grabbing, swinging, letting go, the help
// Easy gives, and what knocks a hero off. A small yard with one rope over a
// gap is enough: the rules are the same in any level.

import { describe, expect, it } from 'vitest';
import { Game, IDLE, type Input } from '../src/game/game';
import { STEP } from '../src/game/hero';
import type { Level, Solid } from '../src/game/level';
import { ROPE, handOf, newRope, stepLoose, type Rope } from '../src/game/rope';

const bank = (id: string, x: number, halfX: number, top = 0): Solid => ({ id, kind: 'bank', shape: 'box', x, z: 0, halfX, halfZ: 3, top, bottom: -40, safe: id === 'start' });

/** A bank, a gap of 12 m with a rope over it, and a bank to land on. The rope carries a hero toward +x. */
const yard = (help: boolean, landingTop = 0): Level => {
  const rope: Rope = { id: 'rope', x: 3, y: 2.3 + 7, z: 0, length: 7, ahead: { x: 1, z: 0 }, to: 'far' };
  return {
    name: 'yard', solids: [bank('start', -4, 4), bank('far', 12, 4, landingTop)], spawn: { x: -2, y: 0, z: 0 }, leaf: { x: 15, y: landingTop + 1.3, z: 0, radius: 0.7 },
    fallY: -8, coyoteTime: 0.1, ledgeHelp: 0.3, hearts: 3, protection: 1, knockback: 1, ropes: [rope], ropeHelp: help, route: ['start', 'rope', 'far'],
  };
};

const RIGHT: Input = { ...IDLE, moveX: 1 };

/** Runs at the rope and jumps off the edge. Returns the game with the hero holding on. */
const takeHold = (help = false, landingTop = 0): Game => {
  const game = new Game(yard(help, landingTop), 'normal', 'Yaarbro');
  for (let i = 0; i < 4 / STEP && !game.swinging; i += 1) game.step({ ...RIGHT, jump: game.x > -0.5 });
  expect(game.swinging).not.toBeNull();
  // Let go of everything.
  game.step(IDLE);
  return game;
};

/** Lets go after `wait` seconds on the rope, then does nothing. Returns what the hero came down on. */
const letGoAfter = (game: Game, wait: number, steer: Input = IDLE): string => {
  for (let i = 0; i < wait / STEP; i += 1) game.step(IDLE);
  game.step({ ...IDLE, jump: true });
  expect(game.swinging).toBeNull();
  for (let i = 0; i < 6 / STEP; i += 1) {
    game.step(steer);
    if (game.grounded) return game.groundId ?? 'ground';
    if (game.falls > 0) return 'fell';
  }
  return 'air';
};

describe('taking hold', () => {
  it('a hero in the air within reach of the rope grabs it with no button, and the game says so', () => {
    const game = new Game(yard(false), 'normal', 'Yaarbro');
    const seen: string[] = [];
    for (let i = 0; i < 4 / STEP && !game.swinging; i += 1) {
      game.step({ ...RIGHT, jump: game.x > -0.5 });
      for (const event of game.events) if (event.type === 'rope') seen.push(event.what);
    }
    expect(game.ropeId).toBe('rope');
    expect(seen).toEqual(['grab']);
    expect(game.grounded).toBe(false);
  });

  it('a hero who walks under the rope without jumping does not reach it', () => {
    const game = new Game(yard(false), 'normal', 'Yaarbro');
    for (let i = 0; i < 0.6 / STEP; i += 1) game.step(RIGHT);
    expect(game.swinging).toBeNull();
  });

  it('holding on, the hero hangs from the end of the rope and the stick does nothing', () => {
    const game = takeHold();
    // It slides to the rope's end over the first moment: never a jump from where it took hold.
    let last = { x: game.x, y: game.y };
    for (let i = 0; i < 0.8 / STEP; i += 1) {
      game.step(IDLE);
      expect(Math.hypot(game.x - last.x, game.y - last.y)).toBeLessThan(0.45);
      last = { x: game.x, y: game.y };
    }
    for (let i = 0; i < 2 / STEP; i += 1) {
      game.step({ ...IDLE, moveX: i % 2 ? 1 : -1, moveZ: 1 });
      const hand = handOf(game.swinging!);
      expect(game.x).toBeCloseTo(hand.x, 1);
      expect(game.y).toBeCloseTo(hand.y - ROPE.hang, 1);
      expect(game.z).toBeCloseTo(0);
    }
  });
});

describe('the swing', () => {
  it('goes out and back the same width every time, for as long as the hero holds on', () => {
    const game = takeHold();
    const ends: number[] = [];
    let last = game.swinging!.angle;
    let rising = true;
    for (let i = 0; i < 12 / STEP; i += 1) {
      game.step(IDLE);
      const angle = game.swinging!.angle;
      if (rising && angle < last) ends.push(last);
      rising = angle >= last;
      last = angle;
    }
    expect(ends.length).toBeGreaterThanOrEqual(3);
    for (const end of ends) expect(end).toBeCloseTo(ROPE.swing, 1);
    // It never dips the hero into the bank it left or below where it hung at rest.
    expect(game.swinging).not.toBeNull();
  });

  it('starts forward: the first thing a swing does is carry the hero out over the gap', () => {
    const game = takeHold();
    const from = game.x;
    for (let i = 0; i < 0.5 / STEP; i += 1) game.step(IDLE);
    expect(game.x).toBeGreaterThan(from + 2);
  });

  it('a rope nobody holds swings itself still, so it hangs straight for the next hero', () => {
    const state = newRope(yard(false).ropes![0]);
    state.angle = 0.6;
    for (let i = 0; i < 10 / STEP; i += 1) stepLoose(state, STEP);
    expect(state.angle).toBe(0);
    expect(state.speed).toBe(0);
  });
});

describe('letting go', () => {
  it('Jump lets go, and the hero flies on the way the rope was going', () => {
    const game = takeHold();
    for (let i = 0; i < 0.3 / STEP; i += 1) game.step(IDLE);
    game.step({ ...IDLE, jump: true });
    expect(game.swinging).toBeNull();
    expect(game.events.some((event) => event.type === 'rope' && event.what === 'release')).toBe(true);
    expect(game.vx).toBeGreaterThan(6);
    expect(game.vy).toBeGreaterThan(0);
  });

  it('on the way forward it carries the hero across; at the back of the swing the hero only drops', () => {
    expect(letGoAfter(takeHold(), 0.35)).toBe('far');
    // Half a swing later the rope is on its way back.
    const back = takeHold();
    const landed = letGoAfter(back, 1.9);
    expect(landed).not.toBe('far');
    expect(back.x).toBeLessThan(6);
  });

  it('a rope just let go is not grabbed again on the way past', () => {
    const game = takeHold();
    for (let i = 0; i < 0.75 / STEP; i += 1) game.step(IDLE);
    // At the top of the swing: let go, and the rope's end is still right there.
    game.step({ ...IDLE, jump: true });
    for (let i = 0; i < 0.3 / STEP; i += 1) {
      game.step(IDLE);
      expect(game.swinging).toBeNull();
    }
  });

  it('a hit knocks the hero off the rope', () => {
    const game = takeHold();
    expect(game.hurt(game.x + 1, game.z)).toBe(true);
    expect(game.swinging).toBeNull();
    game.step(IDLE);
    expect(game.swinging).toBeNull();
  });

  it('a fall puts the rope back to hanging still', () => {
    const game = takeHold();
    // Let go at the very back of the swing, out over the gap's near side, and steer off into the gap.
    for (let i = 0; i < 1.5 / STEP; i += 1) game.step(IDLE);
    game.step({ ...IDLE, jump: true });
    for (let i = 0; i < 8 / STEP && game.falls === 0; i += 1) game.step({ ...IDLE, moveZ: 1 });
    expect(game.falls).toBe(1);
    expect(game.ropes[0].angle).toBe(0);
    expect(game.ropes[0].speed).toBe(0);
  });
});

describe('with help (Easy)', () => {
  it('letting go at any point in the swing lands on what the rope leads to, whatever the stick does', () => {
    for (let wait = 0.05; wait < 6.2; wait += 0.15) {
      for (const steer of [IDLE, { ...IDLE, moveX: -1 }, { ...IDLE, moveZ: 1 }]) {
        expect(letGoAfter(takeHold(true), wait, steer), `after ${wait.toFixed(2)} s`).toBe('far');
      }
    }
  });

  it('also up onto a ledge higher than the swing reaches', () => {
    for (let wait = 0.05; wait < 3.2; wait += 0.2) expect(letGoAfter(takeHold(true, 3.4), wait), `after ${wait.toFixed(2)} s`).toBe('far');
  });

  it('without help, the same let-go at the back of the swing does not get there', () => {
    expect(letGoAfter(takeHold(false), 1.9)).not.toBe('far');
  });
});
