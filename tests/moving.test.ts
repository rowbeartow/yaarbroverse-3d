// Pieces that move (src/game/moving.ts): each kind on its own in the test
// yard, then as the grove uses it. No screen needed.

import { Group, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GameSounds } from '../src/audio/game-sounds';
import { Sound, type Memory, type PlayOptions, type Speaker } from '../src/audio/mix';
import type { SoundName } from '../src/audio/sounds';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE, type GameEvent } from '../src/game/game';
import { MOVE, fullJumpHeight, jumpReach } from '../src/game/hero';
import { topAt, type Solid } from '../src/game/level';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { GROVE_DIFFICULTY } from '../src/levels/bouncing-grove/difficulty';
import { placeMoving } from '../src/view/scenery';
import { AWAY, LEFT, hold, solid, yard } from './helpers/yard';

/** A tipping log running away from the camera off the far edge of the yard's floor: z from -5 to -11, level with it. */
const tipLog = (over: Partial<Solid> = {}): Solid =>
  solid('tipper', 0, -8, 0.8, 3, 0, { kind: 'log', bottom: -1, motion: { kind: 'tip', tell: 0.5, dip: 1, rate: 1 }, ...over });

const tipYard = (): ReturnType<typeof yard> => yard([tipLog()], { route: ['floor', 'tipper'] });

const own = (game: Game, id = 'tipper'): Solid => game.level.solids.find((s) => s.id === id) as Solid;

/** Walks the hero away from the camera until it stands `forward` metres along the log from its middle, then stops. */
const walkTo = (game: Game, forward: number, events: GameEvent[] = []): void => {
  const log = own(game);
  for (let i = 0; i < 600 && game.z > log.z - forward + 0.05; i += 1) {
    game.step({ ...IDLE, moveZ: -0.5 });
    events.push(...game.events);
  }
  for (let i = 0; i < 30; i += 1) {
    game.step(IDLE);
    events.push(...game.events);
  }
};

describe('a tipping log', () => {
  it('lies level and still while nobody is on it', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    hold(game, {}, 3);
    expect(own(game).slopeZ ?? 0).toBe(0);
    expect(own(game).top).toBe(0);
  });

  it('creaks and wobbles when a hero lands on it (the tell), and only then tips', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    const events: GameEvent[] = [];
    walkTo(game, 2.5, events);
    const said = events.filter((e) => e.type === 'piece').map((e) => (e.type === 'piece' ? e.what : ''));
    expect(said.slice(0, 2)).toEqual(['tell', 'move']);
    // A moment after stepping on, it is still level: the tell comes first.
    const fresh = new Game(tipYard(), 'normal', 'Yaarbro');
    for (let i = 0; i < 600 && fresh.groundId !== 'tipper'; i += 1) fresh.step({ ...IDLE, moveZ: -1 });
    hold(fresh, {}, 0.4);
    expect(own(fresh).piece?.phase).toBe('tell');
    expect(own(fresh).slopeZ).toBe(0);
  });

  it('sinks under the end the hero stands on, as far as `dip` at the very end, at `rate`', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    walkTo(game, 2.9);
    const log = own(game);
    expect(log.piece?.phase).toBe('tip');
    // Not all at once: a tenth of a second later it has gone at most a tenth of a metre further.
    const before = log.piece?.dip ?? 0;
    hold(game, {}, 0.1);
    expect((log.piece?.dip ?? 0) - before).toBeLessThanOrEqual(0.1 + 1e-9);
    hold(game, {}, 2);
    const farEnd = topAt(log, log.x, log.z - log.halfZ);
    const nearEnd = topAt(log, log.x, log.z + log.halfZ);
    expect(farEnd).toBeCloseTo(-1 * Math.min(1, 2.9 / 3), 1);
    expect(nearEnd).toBeCloseTo(1 * Math.min(1, 2.9 / 3), 1);
  });

  it('hardly tips with a hero standing over its middle', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    walkTo(game, 0);
    hold(game, {}, 2);
    expect(Math.abs(own(game).piece?.dip ?? 0)).toBeLessThan(0.05);
  });

  it('carries the hero: a hero standing on it is always on its top, wherever it has tipped to', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    let checked = 0;
    for (let i = 0; i < 400; i += 1) {
      game.step({ ...IDLE, moveZ: game.z > -10.5 ? -0.4 : 0 });
      if (game.grounded && game.groundId === 'tipper') {
        expect(game.y).toBeCloseTo(topAt(own(game), game.x, game.z), 6);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(game.y).toBeLessThan(-0.7);
  });

  it('settles back level once the hero leaves it', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    walkTo(game, 2.5);
    hold(game, {}, 1.5);
    expect(Math.abs(own(game).piece?.dip ?? 0)).toBeGreaterThan(0.5);
    // Back onto the floor.
    hold(game, { moveZ: 1 }, 1.5);
    expect(game.groundId).toBe('floor');
    hold(game, {}, 3);
    expect(own(game).piece?.dip).toBe(0);
  });

  it('is level again after a fall sends the hero back to a safe bank', () => {
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    walkTo(game, 2.5);
    hold(game, {}, 1);
    hold(game, LEFT, 3);
    expect(game.falls).toBe(1);
    expect(own(game).piece?.dip).toBe(0);
    expect(own(game).slopeZ).toBe(0);
  });

  it('belongs to its own game: two games of one level never share a tipping log', () => {
    const level = tipYard();
    const tipped = new Game(level, 'normal', 'Yaarbro');
    const still = new Game(level, 'normal', 'Yaarbro');
    walkTo(tipped, 2.5);
    hold(tipped, {}, 1);
    hold(still, {}, 3);
    expect(Math.abs(own(tipped).piece?.dip ?? 0)).toBeGreaterThan(0.5);
    expect(own(still).piece?.dip).toBe(0);
    // The level as built is untouched.
    expect(level.solids.find((s) => s.id === 'tipper')?.piece).toBeUndefined();
  });

  it('creaks: its tell plays a sound', () => {
    const played: SoundName[] = [];
    const speaker: Speaker = {
      wake: () => undefined,
      play: (name: SoundName, _options: PlayOptions) => void played.push(name),
      setLoop: () => undefined,
      setMusic: () => undefined,
      playTune: () => undefined,
      setMuted: () => undefined,
    };
    const memory: Memory = { getItem: () => null, setItem: () => undefined };
    const sound = new Sound(speaker, memory);
    sound.unlock();
    const sounds = new GameSounds(sound);
    const game = new Game(tipYard(), 'normal', 'Yaarbro');
    for (let i = 0; i < 300; i += 1) {
      game.step({ ...IDLE, ...AWAY });
      sounds.step(game);
    }
    expect(played).toContain('creak');
  });

  it('is drawn where the rules put it: the drawn top runs along the rules’ top, end to end, while it tips', () => {
    const log = tipLog({ piece: undefined });
    for (const dip of [0, 0.4, -0.8, 1.2]) {
      const live: Solid = { ...log, slopeZ: dip / log.halfZ };
      const holder = new Group();
      const body = new Group();
      holder.add(body);
      const view = { solid: live, holder, body };
      placeMoving(view, 0);
      // The drawn top's two ends and middle, as the shape lays them out in the body.
      for (const along of [-log.halfZ, 0, log.halfZ]) {
        const mark = new Object3D();
        mark.position.set(0, 0, along);
        body.add(mark);
        holder.updateMatrixWorld(true);
        const at = mark.getWorldPosition(new Vector3());
        expect(at.y).toBeCloseTo(topAt(live, at.x, at.z), 6);
        // And it reaches exactly as far along the route as the rules' log does.
        expect(at.z).toBeCloseTo(log.z + along, 6);
      }
    }
  });
});

describe('the grove’s tipping logs', () => {
  it('make the next jump higher the longer a hero lingers at the end, and still reachable', () => {
    for (const difficulty of DIFFICULTIES) {
      const n = GROVE_DIFFICULTY[difficulty];
      // From the lowest the far end can go, up to the next log, across the gap.
      const climb = n.tipDip + n.tipRise;
      expect(jumpReach(climb), difficulty).toBeGreaterThan(n.tipGap + 0.5);
      expect(climb, difficulty).toBeLessThan(fullJumpHeight() - 0.2);
    }
  });

  it('need no timing on Easy: from the lowest point the next log is a small hop up and close by', () => {
    const n = GROVE_DIFFICULTY.easy;
    expect(n.tipDip + n.tipRise).toBeLessThan(fullJumpHeight() / 2);
    expect(n.tipGap).toBeLessThan(1);
    // And it sinks slowly.
    expect(n.tipRate).toBeLessThan(0.5);
  });

  it('get harder from Easy to Hard: a shorter tell, a deeper and faster dip, narrower logs, wider gaps', () => {
    const [easy, normal, hard] = DIFFICULTIES.map((d) => GROVE_DIFFICULTY[d]);
    expect(easy.tipTell).toBeGreaterThan(normal.tipTell);
    expect(normal.tipTell).toBeGreaterThan(hard.tipTell);
    for (const key of ['tipDip', 'tipRate', 'tipGap'] as const) {
      expect(easy[key]).toBeLessThan(normal[key]);
      expect(normal[key]).toBeLessThan(hard[key]);
    }
  });

  it('are where the route plan puts them: between the high log and the high ledge, with no enemy over them', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildGrove(difficulty);
      const section = (level.sections ?? []).find((s) => s.name === 'The Tipping Logs');
      expect(section?.solids).toEqual(['mushroom-1', 'high-log', ...Array.from({ length: GROVE_DIFFICULTY[difficulty].tipCount }, (_, i) => `tip-log-${i + 1}`), 'bank-4']);
      const tips = level.solids.filter((s) => s.motion?.kind === 'tip');
      const nearest = Math.max(...tips.map((s) => s.z + s.halfZ));
      const furthest = Math.min(...tips.map((s) => s.z - s.halfZ));
      for (const enemy of level.enemies ?? []) {
        expect(enemy.z > nearest + 3 || enemy.z < furthest - 3, `${enemy.id} on ${difficulty}`).toBe(true);
      }
    }
  });

  it('let the hero walk the length of one without falling, however long it stands at the far end', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildGrove(difficulty);
      const log = level.solids.find((s) => s.id === 'tip-log-1') as Solid;
      const game = new Game(level, difficulty, 'Caputo');
      // Stand on the log's near end, then walk to its far end and wait there.
      game.x = log.x;
      game.z = log.z + log.halfZ - 0.5;
      game.y = log.top;
      hold(game, { moveZ: -0.5 }, (log.halfZ * 2 - 1) / (MOVE.walkSpeed * 0.5));
      hold(game, {}, 4);
      expect(game.falls, difficulty).toBe(0);
      expect(game.groundId, difficulty).toBe('tip-log-1');
    }
  });
});
