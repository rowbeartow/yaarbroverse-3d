// The ghost: a recording of a run replays the path it recorded, stays small,
// survives being saved and read back, is kept apart for each player, and
// changes nothing about the game it watches.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { Game, IDLE } from '../src/game/game';
import { GHOST_MAX_SAMPLES, GhostPlayer, GhostRecorder, decodeGhost, encodeGhost, type Ghost } from '../src/game/ghost';
import { HEROES, STEP } from '../src/game/hero';
import { LEVELS } from '../src/levels';
import { GHOST_PREFIX, ghostKey, loadGhost, removeGhostsOf, saveGhost, type GhostSlot } from '../src/save/ghosts';
import { PLAYERS_KEY, Players, ghostOn } from '../src/save/players';
import { Bot } from './helpers/bot';
import { FakeStorage } from './helpers/storage';
import { yard } from './helpers/yard';

interface Recorded {
  ghost: Ghost;
  /** Where the hero was after every rules step, starting with where it began. */
  path: Array<{ x: number; y: number; z: number }>;
  game: Game;
}

/** Plays a level with the bot, recording a ghost and the true path. `fallAt` walks the hero off the side once, that many seconds in. */
const record = (game: Game, fallAt = -1): Recorded => {
  const bot = new Bot(game.level);
  const recorder = new GhostRecorder(game);
  const path = [{ x: game.x, y: game.y, z: game.z }];
  let falling = false;
  for (let i = 0; i < 300 / STEP && !game.complete; i += 1) {
    if (fallAt >= 0 && game.seconds >= fallAt && game.falls === 0) falling = true;
    if (game.falls > 0) falling = false;
    game.step(falling ? { ...IDLE, moveX: -1 } : bot.input(game));
    recorder.step(game);
    path.push({ x: game.x, y: game.y, z: game.z });
  }
  expect(game.complete).toBe(true);
  return { ghost: recorder.finish(game)!, path, game };
};

const grove = LEVELS.find((level) => level.id === 'bouncing-grove')!;
const sandbox = LEVELS.find((level) => level.id === 'sandbox')!;
const slot = (over: Partial<GhostSlot> = {}): GhostSlot => ({ playerId: 'p-pip', levelId: 'bouncing-grove', hero: 'Yaarbro', difficulty: 'normal', ...over });

describe('a ghost replays the path it recorded', () => {
  it.each(LEVELS.flatMap((level) => DIFFICULTIES.map((difficulty) => [level.id, difficulty, level] as const)))('%s on %s, read back from storage', (_id, difficulty, level) => {
    const { ghost, path, game } = record(new Game(level.build(difficulty), difficulty, 'Caputo'));
    const player = new GhostPlayer(decodeGhost(encodeGhost(ghost))!);
    expect(player.seconds).toBeCloseTo(game.seconds, 6);
    let worst = 0;
    let total = 0;
    for (let step = 0; step < path.length; step += 1) {
      const pose = player.at(step * STEP);
      const off = Math.hypot(pose.x - path[step].x, pose.y - path[step].y, pose.z - path[step].z);
      worst = Math.max(worst, off);
      total += off;
    }
    // Between samples the ghost goes in a straight line, so it cuts the corner
    // where a mushroom turns a drop into a bounce. That is the most it is ever out.
    expect(worst).toBeLessThan(0.6);
    // Over the whole run it is within a couple of centimetres of where the hero really was.
    expect(total / path.length).toBeLessThan(0.03);
    // On the beat of a sample it is where the hero was, to the nearest 2 cm.
    for (let i = 0; i < ghost.samples.length - 1; i += 1) {
      const at = path[i * ghost.interval];
      const pose = player.at(i * ghost.interval * STEP);
      expect(Math.hypot(pose.x - at.x, pose.y - at.y, pose.z - at.z)).toBeLessThan(0.03);
    }
  });

  it('starts where the hero started and stops at the leaf, standing, for good', () => {
    const { ghost, path, game } = record(new Game(grove.build('normal'), 'normal', 'Yaarbro'));
    const player = new GhostPlayer(ghost);
    expect(player.at(0)).toMatchObject({ x: path[0].x, y: path[0].y, z: path[0].z, done: false });
    expect(player.at(-5)).toMatchObject({ x: path[0].x, z: path[0].z });
    const end = player.at(game.seconds + STEP);
    expect(end).toMatchObject({ x: game.x, y: game.y, z: game.z, done: true, pace: 0, rise: 0 });
    expect(player.at(game.seconds + 600)).toEqual(end);
    // Just before the end it is still moving.
    expect(player.at(game.seconds - 0.5).done).toBe(false);
  });

  it('after a fall the ghost is back on the bank at once, not gliding there through the air', () => {
    const { ghost, path, game } = record(new Game(grove.build('normal'), 'normal', 'Yaarbro'), 3);
    expect(game.falls).toBe(1);
    expect(ghost.samples.filter((sample) => sample.cut)).toHaveLength(1);
    const player = new GhostPlayer(decodeGhost(encodeGhost(ghost))!);
    // At every moment the ghost is near somewhere the hero was within a sample of then: never out in mid-air between the two places.
    for (let step = 0; step < path.length; step += 1) {
      const pose = player.at(step * STEP);
      let nearest = Infinity;
      for (let k = Math.max(0, step - ghost.interval); k <= Math.min(path.length - 1, step + ghost.interval); k += 1) {
        nearest = Math.min(nearest, Math.hypot(pose.x - path[k].x, pose.y - path[k].y, pose.z - path[k].z));
      }
      expect(nearest).toBeLessThan(0.12);
    }
  });

  it('says what the hero was doing: in the air on a jump, and how fast', () => {
    const { ghost } = record(new Game(grove.build('normal'), 'normal', 'Yaarbro'));
    const player = new GhostPlayer(ghost);
    const poses = Array.from({ length: Math.floor(player.seconds / STEP) }, (_, step) => player.at(step * STEP));
    expect(poses.some((pose) => !pose.grounded && pose.rise > 2)).toBe(true);
    expect(poses.some((pose) => !pose.grounded && pose.rise < -2)).toBe(true);
    expect(poses.some((pose) => pose.grounded && pose.pace > 0.9)).toBe(true);
    for (const pose of poses) {
      expect(pose.pace).toBeGreaterThanOrEqual(0);
      expect(pose.pace).toBeLessThanOrEqual(1);
    }
  });
});

describe('a ghost is only looked at', () => {
  it.each(HEROES)('a run plays out the same with a ghost being recorded and replayed as without, as %s', (hero) => {
    const plain = new Game(grove.build('hard'), 'hard', hero);
    const watched = new Game(grove.build('hard'), 'hard', hero);
    const old = new GhostPlayer(record(new Game(grove.build('hard'), 'hard', hero)).ghost);
    const botA = new Bot(plain.level);
    const botB = new Bot(watched.level);
    const recorder = new GhostRecorder(watched);
    for (let i = 0; i < 300 / STEP && !plain.complete; i += 1) {
      plain.step(botA.input(plain));
      watched.step(botB.input(watched));
      recorder.step(watched);
      old.at(watched.seconds);
      expect([watched.x, watched.y, watched.z, watched.hearts]).toEqual([plain.x, plain.y, plain.z, plain.hearts]);
      expect(watched.events).toEqual(plain.events);
    }
    expect(watched.summary()).toEqual(plain.summary());
    expect(watched.enemies).toEqual(plain.enemies);
  });

  it('the rules have no way to be told about a ghost', () => {
    // A Game is built from a level, a difficulty and a hero, and stepped with the player's input. Nothing else goes in.
    expect(Game.length).toBe(3);
    expect(new Game(yard(), 'normal', 'Yaarbro').step.length).toBe(1);
  });
});

describe('a ghost stays small', () => {
  it('the grove on Normal is a few thousand characters', () => {
    const { ghost } = record(new Game(grove.build('normal'), 'normal', 'Yaarbro'));
    expect(encodeGhost(ghost)!.length).toBeLessThan(12_000);
  });

  it('a run of twenty minutes is no bigger than a run of two, and still replays', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    const recorder = new GhostRecorder(game);
    const path = [{ x: game.x, z: game.z }];
    // Round and round the yard: right, away, left, toward.
    const legs = [{ moveX: 1 }, { moveZ: -1 }, { moveX: -1 }, { moveZ: 1 }];
    for (let i = 0; i < (20 * 60) / STEP; i += 1) {
      game.step({ ...IDLE, ...legs[Math.floor(i / 60) % 4] });
      recorder.step(game);
      path.push({ x: game.x, z: game.z });
    }
    const ghost = recorder.finish(game)!;
    expect(ghost.samples.length).toBeLessThanOrEqual(GHOST_MAX_SAMPLES + 1);
    expect(ghost.steps).toBe((20 * 60) / STEP);
    const text = encodeGhost(ghost)!;
    expect(text.length).toBeLessThan(13_500);
    // Four dozen of the biggest ghosts are well under a megabyte of text.
    expect(text.length * 48).toBeLessThan(700_000);
    const player = new GhostPlayer(decodeGhost(text)!);
    for (let i = 0; i < ghost.samples.length - 1; i += 1) {
      const pose = player.at(i * ghost.interval * STEP);
      const at = path[i * ghost.interval];
      expect(Math.hypot(pose.x - at.x, pose.z - at.z)).toBeLessThan(0.03);
    }
  });

  it('a run that wanders further than a sample can say is not kept', () => {
    const ghost: Ghost = {
      interval: 4,
      steps: 4,
      samples: [
        { x: 0, y: 0, z: 0, facing: 0, grounded: true, rolling: false, pouncing: false, cut: false },
        { x: 0, y: 0, z: -900, facing: 0, grounded: true, rolling: false, pouncing: false, cut: false },
      ],
    };
    expect(encodeGhost(ghost)).toBeNull();
    expect(saveGhost(new FakeStorage(), slot(), ghost)).toBe(false);
  });

  it('a run with nothing in it makes no ghost', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    expect(new GhostRecorder(game).finish(game)).toBeNull();
  });
});

describe('damaged ghosts', () => {
  const good = encodeGhost(record(new Game(sandbox.build('easy'), 'easy', 'Yaarbro')).ghost)!;

  it('a sound one reads back', () => {
    expect(decodeGhost(good)).not.toBeNull();
  });

  it.each([
    ['nothing', null],
    ['a number', 7],
    ['text that is not a ghost', 'boo'],
    ['an empty string', ''],
    ['a list', '[]'],
    ['another version', good.replace('"v":1', '"v":2')],
    ['no samples', JSON.stringify({ v: 1, i: 4, n: 10, o: [0, 0, 0], d: '' })],
    ['samples cut short', good.replace(/"d":"[^"]{40}/, '"d":"')],
    ['samples that are not base64', good.replace(/"d":"..../, '"d":"!!!!')],
    ['a start that is not three numbers', good.replace(/"o":\[[^\]]*\]/, '"o":[0,"x"]')],
    ['a step count that does not fit the samples', good.replace(/"n":\d+/, '"n":999999')],
    ['a rate of nothing', good.replace(/"i":\d+/, '"i":0')],
    ['something enormous', `{"v":1,"pad":"${'x'.repeat(50_000)}"}`],
  ])('%s is no ghost, and nothing breaks', (_what, text) => {
    expect(decodeGhost(text)).toBeNull();
    const storage = new FakeStorage();
    if (typeof text === 'string') storage.items.set(ghostKey(slot()), text);
    expect(loadGhost(storage, slot())).toBeNull();
  });

  it('storage that refuses is no ghost, and saving says it could not', () => {
    const storage = new FakeStorage();
    storage.broken = 'both';
    const ghost = decodeGhost(good)!;
    expect(loadGhost(storage, slot())).toBeNull();
    expect(saveGhost(storage, slot(), ghost)).toBe(false);
    expect(() => removeGhostsOf(storage, 'p-pip')).not.toThrow();
    expect(saveGhost(null, slot(), ghost)).toBe(false);
    expect(loadGhost(null, slot())).toBeNull();
  });

  it('a damaged ghost costs nobody their progress', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'moss')!;
    players.finish(pip.id, { levelId: 'bouncing-grove', hero: 'Yaarbro', difficulty: 'normal', seconds: 80, falls: 1, complete: true });
    storage.items.set(ghostKey(slot({ playerId: pip.id })), '{{{');
    const again = new Players(storage);
    expect(again.get(pip.id)!.bests['bouncing-grove']!.Yaarbro!.normal).toEqual({ seconds: 80, falls: 1 });
    expect(loadGhost(storage, slot({ playerId: pip.id }))).toBeNull();
  });
});

describe('ghosts are kept for each player, level, hero and difficulty', () => {
  const ghost = record(new Game(sandbox.build('easy'), 'easy', 'Yaarbro')).ghost;

  it('each has its own, and a new one takes the place of the old', () => {
    const storage = new FakeStorage();
    expect(saveGhost(storage, slot(), ghost)).toBe(true);
    expect(loadGhost(storage, slot())?.steps).toBe(ghost.steps);
    for (const other of [{ playerId: 'p-moss' }, { levelId: 'sandbox' }, { hero: 'Caputo' as const }, { difficulty: 'hard' as const }]) {
      expect(loadGhost(storage, slot(other))).toBeNull();
    }
    const longer = record(new Game(sandbox.build('hard'), 'hard', 'Yaarbro')).ghost;
    saveGhost(storage, slot(), longer);
    expect(loadGhost(storage, slot())?.steps).toBe(longer.steps);
    expect([...storage.items.keys()]).toEqual([ghostKey(slot())]);
  });

  it('resetting or removing a player takes their ghosts and leaves everyone else’s', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'moss')!;
    const moss = players.add('Moss', 'sky')!;
    saveGhost(storage, slot({ playerId: pip.id }), ghost);
    saveGhost(storage, slot({ playerId: pip.id, hero: 'Caputo' }), ghost);
    saveGhost(storage, slot({ playerId: moss.id }), ghost);
    players.resetProgress(pip.id);
    expect(loadGhost(storage, slot({ playerId: pip.id }))).toBeNull();
    expect(loadGhost(storage, slot({ playerId: pip.id, hero: 'Caputo' }))).toBeNull();
    expect(loadGhost(storage, slot({ playerId: moss.id }))).not.toBeNull();
    players.remove(moss.id);
    expect([...storage.items.keys()].filter((key) => key.startsWith(GHOST_PREFIX))).toEqual([]);
    expect(storage.items.has(PLAYERS_KEY)).toBe(true);
  });

  it('four players with a ghost for every hero and difficulty of two levels fit in well under a megabyte', () => {
    const storage = new FakeStorage();
    const big = record(new Game(grove.build('hard'), 'hard', 'Yaarbro')).ghost;
    for (const playerId of ['p-1', 'p-2', 'p-3', 'p-4']) {
      for (const levelId of ['bouncing-grove', 'another-level']) {
        for (const hero of HEROES) for (const difficulty of DIFFICULTIES) expect(saveGhost(storage, { playerId, levelId, hero, difficulty }, big)).toBe(true);
      }
    }
    expect(storage.items.size).toBe(48);
    const characters = [...storage.items.entries()].reduce((sum, [key, value]) => sum + key.length + value.length, 0);
    expect(characters).toBeLessThan(700_000);
  });
});

describe('whether the ghost is on', () => {
  it('is on for Normal and Hard and off for Easy until the player says otherwise, for each difficulty by itself', () => {
    const storage = new FakeStorage();
    const players = new Players(storage);
    const pip = players.add('Pip', 'moss')!;
    expect(DIFFICULTIES.map((difficulty) => ghostOn(pip, difficulty))).toEqual([false, true, true]);
    players.setGhost(pip.id, 'easy', true);
    players.setGhost(pip.id, 'hard', false);
    const again = new Players(storage).get(pip.id)!;
    expect(DIFFICULTIES.map((difficulty) => ghostOn(again, difficulty))).toEqual([true, true, false]);
    // Another player still has the usual.
    const moss = players.add('Moss', 'sky')!;
    expect(DIFFICULTIES.map((difficulty) => ghostOn(moss, difficulty))).toEqual([false, true, true]);
  });

  it('a damaged choice is dropped and the usual applies', () => {
    const storage = new FakeStorage();
    storage.items.set(PLAYERS_KEY, JSON.stringify({ players: [{ id: 'p-1', name: 'Pip', ghost: { easy: 'yes', hard: false, silly: true } }] }));
    const pip = new Players(storage).get('p-1')!;
    expect(pip.ghost).toEqual({ hard: false });
    expect(DIFFICULTIES.map((difficulty) => ghostOn(pip, difficulty))).toEqual([false, true, false]);
  });
});
