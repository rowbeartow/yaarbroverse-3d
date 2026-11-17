// A piece that sinks (the `sink` kind in src/game/moving.ts): a log over deep
// water in the test yard. The lake's own logs and posts are in tests/lake.test.ts.

import { describe, expect, it } from 'vitest';
import { Game, IDLE, type GameEvent } from '../src/game/game';
import type { Solid } from '../src/game/level';
import type { Motion } from '../src/game/moving';
import { AWAY, hold, solid, yard } from './helpers/yard';

const SINK: Extract<Motion, { kind: 'sink' }> = { kind: 'sink', tell: 1, sinks: true, bob: 0.15, depth: 1.2, down: 0.8, back: 2 };

/** A log running away from the camera off the far edge of the yard's floor (z -5 to -11), level with it, over a pool. */
const sinkYard = (motion: Partial<typeof SINK> = {}): ReturnType<typeof yard> =>
  yard([solid('sinker', 0, -8, 0.8, 3, 0, { kind: 'log', bottom: -1, motion: { ...SINK, ...motion } })], {
    route: ['floor', 'sinker'],
    water: [{ id: 'pool', minX: -10, maxX: 10, minZ: -30, maxZ: -5, surface: -0.4, floor: -5 }],
  });

const own = (game: Game): Solid => game.level.solids.find((s) => s.id === 'sinker') as Solid;

/** Walks onto the log and stands still on it, collecting what happens. */
const stepOn = (game: Game, events: GameEvent[] = []): void => {
  for (let i = 0; i < 600 && game.groundId !== 'sinker'; i += 1) {
    game.step({ ...IDLE, moveZ: -1 });
    events.push(...game.events);
  }
  expect(game.groundId).toBe('sinker');
};
const wait = (game: Game, seconds: number, events: GameEvent[] = []): void => {
  hold(game, {}, seconds, () => events.push(...game.events));
};
const pieceEvents = (events: GameEvent[]): string[] => events.flatMap((e) => (e.type === 'piece' ? [`${e.kind}:${e.what}`] : []));

describe('a sinking log', () => {
  it('lies still while nobody is on it', () => {
    const game = new Game(sinkYard(), 'normal', 'Yaarbro');
    wait(game, 5);
    expect(own(game)).toMatchObject({ top: 0, gone: false });
    expect(own(game).piece?.phase).toBe('rest');
  });

  it('settles and rocks when a hero lands on it (the tell), and only after the tell goes under', () => {
    const game = new Game(sinkYard(), 'normal', 'Yaarbro');
    const events: GameEvent[] = [];
    stepOn(game, events);
    wait(game, 0.9, events);
    expect(pieceEvents(events)).toEqual(['sink:tell']);
    expect(own(game).top).toBeCloseTo(-0.15, 2);
    expect(game.groundId).toBe('sinker');
    // The hero rides on its top as it settles.
    expect(game.y).toBeCloseTo(own(game).top, 5);
    wait(game, 0.3, events);
    expect(pieceEvents(events)).toEqual(['sink:tell', 'sink:fall']);
  });

  it('takes a hero who stays on it down into the water: a swim, never a fall', () => {
    const game = new Game(sinkYard(), 'normal', 'Yaarbro');
    stepOn(game);
    wait(game, 2.5);
    expect(own(game).gone).toBe(true);
    expect(game.swimming).toBe(true);
    expect(game.falls).toBe(0);
    expect(game.hearts).toBe(game.level.hearts);
  });

  it('gives a hero who keeps moving time to cross it', () => {
    const game = new Game(sinkYard(), 'normal', 'Yaarbro');
    stepOn(game);
    // Six metres of log at a run takes about a second: the tell.
    hold(game, AWAY, 0.8);
    expect(game.groundId).toBe('sinker');
    expect(own(game).gone).toBe(false);
  });

  it('comes back up after `back` seconds under, and can be stood on again', () => {
    const game = new Game(sinkYard(), 'normal', 'Yaarbro');
    const events: GameEvent[] = [];
    stepOn(game, events);
    wait(game, 1 + 0.8 + 0.2, events);
    expect(own(game).piece?.phase).toBe('gone');
    wait(game, 2 + 1.3, events);
    expect(pieceEvents(events)).toEqual(['sink:tell', 'sink:fall', 'sink:back']);
    expect(own(game)).toMatchObject({ gone: false });
    expect(own(game).top).toBeCloseTo(0, 5);
    expect(own(game).piece?.phase).toBe('rest');
  });

  it('on Easy (`sinks: false`) only bobs under the hero and holds for as long as they like, then bobs back up', () => {
    const game = new Game(sinkYard({ sinks: false }), 'easy', 'Yaarbro');
    const events: GameEvent[] = [];
    stepOn(game, events);
    wait(game, 20, events);
    expect(game.groundId).toBe('sinker');
    expect(own(game).top).toBeCloseTo(-0.15, 5);
    expect(pieceEvents(events)).toEqual(['sink:tell', 'sink:move']);
    // Back onto the floor: it rises again.
    hold(game, { moveZ: 1 }, 1.5);
    wait(game, 1.5);
    expect(own(game).top).toBeCloseTo(0, 5);
  });

  it('is back up after a hero is sent back to a safe bank', () => {
    const level = sinkYard();
    const game = new Game({ ...level, water: undefined }, 'normal', 'Yaarbro');
    stepOn(game);
    // With no water under it in this yard, going down with it is a fall.
    wait(game, 4);
    expect(game.falls).toBe(1);
    expect(own(game)).toMatchObject({ top: 0, gone: false });
    expect(own(game).piece?.phase).toBe('rest');
  });
});
