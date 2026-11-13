// Sound, without a browser: nothing plays before the first tap or key press,
// mute works and is remembered, and what the rules report turns into the
// right sounds. A stand-in speaker writes down what it is asked to do.

import { describe, expect, it } from 'vitest';
import { GameSounds, FAR, NEAR, byDistance } from '../src/audio/game-sounds';
import { MUTE_KEY, Sound, type Memory, type PlayOptions, type Speaker } from '../src/audio/mix';
import type { SoundName } from '../src/audio/sounds';
import { Game } from '../src/game/game';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { JUMP, RIGHT, hold, solid, yard } from './helpers/yard';

class Notebook implements Speaker {
  woken = 0;
  played: { name: SoundName; options: PlayOptions }[] = [];
  loops = new Map<SoundName, number>();
  music: SoundName | null = null;
  tunes: (SoundName | null)[] = [];
  muted: boolean | null = null;
  /** Everything it was asked to do that would reach the speakers. */
  calls = 0;
  wake(): void {
    this.woken += 1;
  }
  play(name: SoundName, options: PlayOptions): void {
    this.calls += 1;
    this.played.push({ name, options });
  }
  setLoop(name: SoundName, volume: number): void {
    this.calls += 1;
    this.loops.set(name, volume);
  }
  setMusic(name: SoundName | null): void {
    this.calls += 1;
    this.music = name;
  }
  playTune(name: SoundName | null): void {
    this.calls += 1;
    this.tunes.push(name);
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
  names(): SoundName[] {
    return this.played.map((entry) => entry.name);
  }
}

const shelf = (): Memory & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
};

describe('before the first tap or key press', () => {
  it('plays nothing at all, whatever is asked for', () => {
    const speaker = new Notebook();
    const sound = new Sound(speaker, shelf());
    sound.setMusic('groveMusic');
    sound.play('bounce');
    sound.play('button');
    sound.playTune('leafTune');
    sound.setLoop('roll', 1);
    sound.setMuted(true);
    sound.setMuted(false);
    expect(sound.unlocked).toBe(false);
    expect(speaker.calls).toBe(0);
    expect(speaker.woken).toBe(0);
    expect(speaker.muted).toBeNull();
  });

  it('a whole game played before it makes no sound', () => {
    const speaker = new Notebook();
    const sounds = new GameSounds(new Sound(speaker, shelf()));
    const game = new Game(yard(), 'normal', 'Yaarbro');
    for (const input of [RIGHT, JUMP, RIGHT]) {
      hold(game, input, 0.5, () => sounds.step(game));
    }
    expect(speaker.calls).toBe(0);
  });

  it('the first tap starts the music that was waiting, and sounds play from then on', () => {
    const speaker = new Notebook();
    const sound = new Sound(speaker, shelf());
    sound.setMusic('groveMusic');
    sound.setLoop('mosquitoHover', 0.5);
    sound.unlock();
    expect(sound.unlocked).toBe(true);
    expect(speaker.woken).toBe(1);
    expect(speaker.music).toBe('groveMusic');
    expect(speaker.loops.get('mosquitoHover')).toBe(0.5);
    sound.play('bounce');
    expect(speaker.names()).toEqual(['bounce']);
  });

  it('later taps wake the speaker again without starting the music twice', () => {
    const speaker = new Notebook();
    const sound = new Sound(speaker, shelf());
    sound.setMusic('groveMusic');
    sound.unlock();
    const calls = speaker.calls;
    sound.unlock();
    sound.unlock();
    expect(speaker.woken).toBe(3);
    expect(speaker.calls).toBe(calls);
  });
});

describe('mute', () => {
  it('starts with sound on', () => {
    expect(new Sound(new Notebook(), shelf()).muted).toBe(false);
  });

  it('silences single sounds and tunes, and tells the speaker', () => {
    const speaker = new Notebook();
    const sound = new Sound(speaker, shelf());
    sound.unlock();
    sound.toggleMute();
    expect(sound.muted).toBe(true);
    expect(speaker.muted).toBe(true);
    sound.play('bounce');
    sound.playTune('leafTune');
    expect(speaker.played).toEqual([]);
    expect(speaker.tunes).toEqual([]);
    sound.toggleMute();
    expect(speaker.muted).toBe(false);
    sound.play('bounce');
    expect(speaker.names()).toEqual(['bounce']);
  });

  it('keeps the music going underneath, so it is there when sound comes back', () => {
    const speaker = new Notebook();
    const sound = new Sound(speaker, shelf());
    sound.setMusic('groveMusic');
    sound.unlock();
    sound.setMuted(true);
    expect(speaker.music).toBe('groveMusic');
  });

  it('is remembered between visits', () => {
    const memory = shelf();
    const first = new Sound(new Notebook(), memory);
    first.setMuted(true);
    expect(memory.items.get(MUTE_KEY)).toBe('yes');
    const speaker = new Notebook();
    const second = new Sound(speaker, memory);
    expect(second.muted).toBe(true);
    second.unlock();
    expect(speaker.muted).toBe(true);
    second.play('bounce');
    expect(speaker.played).toEqual([]);
    second.setMuted(false);
    expect(new Sound(new Notebook(), memory).muted).toBe(false);
  });

  it('can be set before the first tap, and is remembered then too', () => {
    const memory = shelf();
    const speaker = new Notebook();
    const sound = new Sound(speaker, memory);
    sound.toggleMute();
    expect(speaker.calls).toBe(0);
    expect(memory.items.get(MUTE_KEY)).toBe('yes');
    sound.unlock();
    expect(speaker.muted).toBe(true);
  });

  it('tells the page, so the button can show it', () => {
    const sound = new Sound(new Notebook(), shelf());
    const seen: boolean[] = [];
    sound.onMute = (muted) => seen.push(muted);
    sound.toggleMute();
    sound.toggleMute();
    expect(seen).toEqual([true, false]);
  });

  it('still works when the browser will not store anything', () => {
    const broken: Memory = {
      getItem: () => {
        throw new Error('no storage');
      },
      setItem: () => {
        throw new Error('no storage');
      },
    };
    const speaker = new Notebook();
    const sound = new Sound(speaker, broken);
    expect(sound.muted).toBe(false);
    sound.unlock();
    sound.setMuted(true);
    expect(sound.muted).toBe(true);
    expect(speaker.muted).toBe(true);
    expect(new Sound(new Notebook(), null).muted).toBe(false);
  });
});

describe('distance', () => {
  it('is full close by, fades steadily, and is gone out of earshot', () => {
    expect(byDistance(0)).toBe(1);
    expect(byDistance(NEAR)).toBe(1);
    expect(byDistance(FAR)).toBe(0);
    expect(byDistance(FAR + 30)).toBe(0);
    let before = 1;
    for (let metres = NEAR; metres <= FAR; metres += 0.5) {
      const now = byDistance(metres);
      expect(now).toBeLessThanOrEqual(before);
      before = now;
    }
  });

  it('carries past the edge of the screen: still a quarter as loud at 30 metres', () => {
    expect(byDistance(30)).toBeGreaterThan(0.25);
    expect(byDistance(15)).toBeGreaterThan(0.45);
  });
});

const listening = (game: Game): { speaker: Notebook; sound: Sound; sounds: GameSounds; run: (input: Parameters<typeof hold>[1], seconds: number) => void } => {
  const speaker = new Notebook();
  const sound = new Sound(speaker, shelf());
  sound.unlock();
  const sounds = new GameSounds(sound);
  return { speaker, sound, sounds, run: (input, seconds) => hold(game, input, seconds, () => sounds.step(game)) };
};

describe('what the game sounds like', () => {
  it('a jump is a quiet push-off and a landing a soft double step, both in the sound of the surface', () => {
    const idle = { moveX: 0, moveZ: 0, jump: false };
    for (const [kind, push, land] of [['bank', 'pushMoss', 'landMoss'], ['log', 'pushWood', 'landWood'], ['stump', 'pushWood', 'landWood']] as const) {
      const level = yard();
      for (const piece of level.solids) piece.kind = kind;
      const game = new Game(level, 'normal', 'Yaarbro');
      const { speaker, run } = listening(game);
      run(idle, 0.1);
      run(JUMP, 0.1);
      expect(speaker.names(), kind).toContain(push);
      run(idle, 2);
      expect(speaker.names(), kind).toContain(land);
    }
  });

  it("Caputo's jump and landing are in his softer voice", () => {
    const game = new Game(yard(), 'normal', 'Caputo');
    const { speaker, run } = listening(game);
    run(JUMP, 0.1);
    run({ moveX: 0, moveZ: 0, jump: false }, 2);
    const heard = speaker.played.filter((entry) => entry.name.startsWith('push') || entry.name.startsWith('land'));
    expect(heard.length).toBe(2);
    expect(heard.every((entry) => entry.options.voice === 'caputo')).toBe(true);
  });

  it('footsteps on moss for a bank and on wood for a log, a stride apart', () => {
    const level = yard([solid('floor', 40, 0, 40, 5, 0)], { spawn: { x: 2, y: 0, z: 0 } });
    level.solids[0]!.kind = 'bank';
    const game = new Game(level, 'normal', 'Yaarbro');
    const { speaker, run } = listening(game);
    run(RIGHT, 2);
    const steps = speaker.played.filter((entry) => entry.name === 'stepMoss');
    expect(speaker.names()).not.toContain('landMoss');
    // About 12 metres at walking speed, a step every metre and a quarter.
    expect(steps.length).toBeGreaterThanOrEqual(8);
    expect(steps.length).toBeLessThanOrEqual(10);
    expect(steps.every((entry) => entry.options.voice === 'yaarbro')).toBe(true);

    level.solids[0]!.kind = 'log';
    speaker.played = [];
    run(RIGHT, 1);
    expect(speaker.names()).toContain('stepWood');
    expect(speaker.names()).not.toContain('stepMoss');
  });

  it('Caputo steps more often, in his own softer voice', () => {
    const level = () => yard([solid('floor', 40, 0, 40, 5, 0)], { spawn: { x: 2, y: 0, z: 0 } });
    const cat = new Game(level(), 'normal', 'Caputo');
    const dwarf = new Game(level(), 'normal', 'Yaarbro');
    const a = listening(cat);
    const b = listening(dwarf);
    a.run(RIGHT, 2);
    b.run(RIGHT, 2);
    const catSteps = a.speaker.played.filter((entry) => entry.name.startsWith('step'));
    expect(catSteps.length).toBeGreaterThan(b.speaker.played.filter((entry) => entry.name.startsWith('step')).length);
    expect(catSteps.every((entry) => entry.options.voice === 'caputo')).toBe(true);
  });

  it('standing still makes no footsteps', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    const { speaker, run } = listening(game);
    run({ moveX: 0, moveZ: 0, jump: false }, 2);
    expect(speaker.played).toEqual([]);
  });

  it("Yaarbro's roll rumbles while he rolls, with no footsteps, and stops when he stops", () => {
    const level = yard([solid('floor', 40, 0, 40, 5, 0)], { spawn: { x: 2, y: 0, z: 0 } });
    const game = new Game(level, 'normal', 'Yaarbro');
    const { speaker, run } = listening(game);
    run({ ...RIGHT, move: true }, 1);
    expect(speaker.loops.get('roll')).toBeGreaterThan(0.5);
    expect(speaker.names().filter((name) => name.startsWith('step'))).toEqual([]);
    run({ moveX: 0, moveZ: 0, jump: false }, 0.2);
    expect(speaker.loops.get('roll')).toBe(0);
  });

  it("Caputo's pounce", () => {
    const game = new Game(yard(), 'normal', 'Caputo');
    const { speaker, run } = listening(game);
    run({ ...RIGHT, move: true }, 0.1);
    expect(speaker.names()).toContain('pounce');
  });

  it('a hit, and running out of hearts', () => {
    const game = new Game(yard(), 'hard', 'Yaarbro');
    const { speaker, run } = listening(game);
    const hearts = game.hearts;
    for (let lost = 1; lost <= hearts; lost++) {
      game.protectedFor = 0;
      game.hurt(game.x + 1, game.z);
      run({ moveX: 0, moveZ: 0, jump: false }, 0.05);
    }
    const names = speaker.names();
    expect(names.filter((name) => name === 'hit').length).toBe(hearts - 1);
    expect(names.filter((name) => name === 'heartsOut').length).toBe(1);
  });

  it('starting again quiets what lasts and cuts a tune short', () => {
    const game = new Game(yard(), 'normal', 'Yaarbro');
    const { speaker, sound, sounds } = listening(game);
    sound.setLoop('roll', 1);
    sounds.reset();
    expect(speaker.loops.get('roll')).toBe(0);
    expect(speaker.tunes).toEqual([null]);
  });
});

describe('in the grove', () => {
  const grove = (hero: 'Yaarbro' | 'Caputo' = 'Yaarbro') => new Game(buildGrove('normal'), 'normal', hero);

  it('a bounce off a mushroom, a checkpoint, and the golden leaf tune', () => {
    const game = grove();
    const { speaker, run } = listening(game);
    const idle = { moveX: 0, moveZ: 0, jump: false };
    const mushroom = game.level.solids.find((s) => s.kind === 'mushroom')!;
    game.x = mushroom.x;
    game.z = mushroom.z;
    game.y = mushroom.top + 1;
    game.grounded = false;
    run(idle, 0.6);
    expect(speaker.names()).toContain('bounce');

    const bank = game.level.solids.filter((s) => s.safe)[1]!;
    game.x = bank.x;
    game.z = bank.z;
    game.y = bank.top + 0.5;
    game.vx = 0;
    game.vy = 0;
    game.vz = 0;
    game.grounded = false;
    run(idle, 0.6);
    expect(speaker.names()).toContain('checkpoint');

    // The leaf is out of reach until the marmot chief is beaten.
    game.x = game.level.leaf.x;
    game.y = game.level.leaf.y;
    game.z = game.level.leaf.z;
    run(idle, 0.1);
    expect(game.complete).toBe(false);
    Object.assign(game.boss!, { phase: 'defeated', health: 0 });
    game.x = game.level.leaf.x;
    game.y = game.level.leaf.y;
    game.z = game.level.leaf.z;
    run(idle, 0.1);
    expect(game.complete).toBe(true);
    expect(speaker.tunes).toEqual(['leafTune']);
  });

  it('a fall off the route', () => {
    const game = grove();
    const { speaker, run } = listening(game);
    game.x += 30;
    game.grounded = false;
    run({ moveX: 0, moveZ: 0, jump: false }, 4);
    expect(speaker.names()).toContain('fall');
  });

  it("each enemy's warning and attack are heard, quieter from further off", () => {
    const game = grove();
    const { speaker, sounds } = listening(game);
    const marmot = game.enemies.find((enemy) => enemy.kind === 'marmot')!;
    const mosquito = game.enemies.find((enemy) => enemy.kind === 'mosquito')!;
    const hear = (enemy: typeof marmot, phase: 'warning' | 'attack', metres: number) => {
      game.x = enemy.x + metres;
      game.y = enemy.y;
      game.z = enemy.z;
      game.events = [{ type: 'enemy', id: enemy.spot.id, kind: enemy.kind, phase }];
      speaker.played = [];
      sounds.step(game);
      return speaker.played.filter((entry) => !entry.name.startsWith('step'))[0];
    };
    expect(hear(marmot, 'warning', 3)).toEqual({ name: 'marmotTell', options: { volume: 1 } });
    expect(hear(marmot, 'attack', 3)?.name).toBe('marmotThrow');
    expect(hear(mosquito, 'warning', 3)?.name).toBe('mosquitoTell');
    expect(hear(mosquito, 'attack', 3)?.name).toBe('mosquitoDive');
    const far = hear(marmot, 'warning', 25);
    expect(far?.name).toBe('marmotTell');
    expect(far?.options.volume).toBeGreaterThan(0.2);
    expect(far?.options.volume).toBeLessThan(0.5);
    // Out of earshot there is nothing to hear.
    expect(hear(marmot, 'warning', FAR + 5)).toBeUndefined();
  });

  it("the mosquito's whine grows as the hero comes near, before it is on screen, and stops when it is beaten", () => {
    const game = grove();
    const { speaker, sounds } = listening(game);
    const mosquito = game.enemies.find((enemy) => enemy.kind === 'mosquito')!;
    const whineAt = (metres: number): number => {
      game.x = mosquito.x;
      game.y = mosquito.y;
      game.z = mosquito.z + metres;
      game.events = [];
      sounds.step(game);
      return speaker.loops.get('mosquitoHover') ?? 0;
    };
    expect(whineAt(80)).toBe(0);
    const far = whineAt(35);
    const near = whineAt(10);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
    expect(whineAt(2)).toBe(1);
    mosquito.phase = 'defeated';
    expect(whineAt(2)).toBe(0);
  });

  it('landing on an enemy', () => {
    const game = grove();
    const { speaker, sounds } = listening(game);
    game.events = [{ type: 'strike', id: 'x', kind: 'marmot', how: 'stomp', left: 1 }];
    sounds.step(game);
    expect(speaker.names()).toContain('strike');
  });

  it('a boss: its warning, its throw, its charge, a hit, a landing that bounces off, and being beaten', () => {
    const game = grove();
    const { speaker, sounds } = listening(game);
    const heard = (event: (typeof game.events)[number]): string[] => {
      const before = speaker.names().length;
      game.events = [event];
      sounds.step(game);
      return speaker.names().slice(before);
    };
    const id = 'marmot-chief';
    expect(heard({ type: 'boss', id, what: 'phase', phase: 'warning', attack: 'throw' })).toEqual(['marmotTell']);
    expect(heard({ type: 'boss', id, what: 'phase', phase: 'attack', attack: 'throw' })).toEqual(['marmotThrow']);
    expect(heard({ type: 'boss', id, what: 'phase', phase: 'attack', attack: 'charge' })).toEqual(['pounce']);
    expect(heard({ type: 'boss', id, what: 'hit', how: 'stomp', left: 3 })).toEqual(['strike']);
    expect(heard({ type: 'boss', id, what: 'blocked' })).toEqual(['bounce']);
    expect(heard({ type: 'boss', id, what: 'beaten' })).toEqual(['bossBeaten']);
    // Resting and going back on watch make no sound.
    expect(heard({ type: 'boss', id, what: 'phase', phase: 'rest', attack: 'throw' })).toEqual([]);
    expect(heard({ type: 'boss', id, what: 'phase', phase: 'idle', attack: null })).toEqual([]);
  });

  it('a sidekick its boss has not called makes no whine', () => {
    const game = grove();
    const { speaker, sounds } = listening(game);
    const sidekick = game.enemies.find((enemy) => enemy.spot.sidekickOf)!;
    expect(sidekick.dormant).toBe(true);
    for (const enemy of game.enemies) if (enemy !== sidekick) enemy.phase = 'defeated';
    Object.assign(game, { x: sidekick.x, z: sidekick.z + 2 });
    game.events = [];
    sounds.step(game);
    expect(speaker.loops.get('mosquitoHover') ?? 0).toBe(0);
    sidekick.dormant = false;
    sounds.step(game);
    expect(speaker.loops.get('mosquitoHover')).toBeGreaterThan(0);
  });
});
