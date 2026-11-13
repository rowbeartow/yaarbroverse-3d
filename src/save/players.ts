// The players on this device and what each has done: a typed name, a colour,
// the hero and difficulty they last chose, and their best run of each level.
// Kept in the browser's storage on this device and nowhere else: nothing here
// is logged, sent anywhere or written into the repo.
//
// Reading and writing never throw. Saved data that is missing, damaged or from
// something else is dropped piece by piece, and the game carries on with what
// is left (or with nobody, as on a first visit). No browser code here: tests
// hand it a pretend storage.

import { isDifficulty, type Difficulty } from '../game/difficulty';
import { isHeroName, type HeroName } from '../game/hero';

/** The part of the browser's storage this needs. `window.localStorage` fits. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PLAYERS_KEY = 'yaarbroverse-3d:players';
/** Where the hero and difficulty were kept before there were players. A first player starts from it. */
const OLD_CHOICE_KEY = 'yaarbroverse-3d:choice';

export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 12;

/** The colours a player can pick. The label is read out by screen readers. */
export const COLOURS = [
  { id: 'moss', label: 'Green', hex: '#4f9d4a' },
  { id: 'berry', label: 'Red', hex: '#d1495b' },
  { id: 'sky', label: 'Blue', hex: '#3f8fd8' },
  { id: 'sun', label: 'Yellow', hex: '#f2c14e' },
  { id: 'plum', label: 'Purple', hex: '#8e5bb5' },
  { id: 'ember', label: 'Orange', hex: '#f08a3c' },
] as const;
export type ColourId = (typeof COLOURS)[number]['id'];
export const isColour = (value: unknown): value is ColourId => COLOURS.some((colour) => colour.id === value);
export const colourHex = (id: ColourId): string => COLOURS.find((colour) => colour.id === id)!.hex;

/**
 * A player's best for one level, hero and difficulty. The two are kept
 * separately: the best time may come from one run and the fewest falls from another.
 */
export interface Best {
  /** The shortest time to the golden leaf, in seconds. */
  seconds: number;
  /** The fewest falls in a run that reached the golden leaf. */
  falls: number;
}

/** Bests by level id, then hero, then difficulty. Only runs that reached the leaf are here. */
export type Bests = Record<string, Partial<Record<HeroName, Partial<Record<Difficulty, Best>>>>>;

export interface Player {
  /** Made up when the player is added. Never shown. */
  id: string;
  name: string;
  colour: ColourId;
  /** The hero and difficulty this player last chose. */
  hero: HeroName;
  difficulty: Difficulty;
  bests: Bests;
}

/** A finished run, as far as saving cares. */
export interface Run {
  levelId: string;
  hero: HeroName;
  difficulty: Difficulty;
  seconds: number;
  falls: number;
  /** True only when the golden leaf was reached. Nothing else is saved. */
  complete: boolean;
}

/** What saving a run changed. */
export interface Outcome {
  /** False when the run did not count (the leaf was not reached, or the player is gone). */
  counted: boolean;
  /** The first time this player finished this level with this hero on this difficulty. */
  first: boolean;
  /** A time better than the one saved before (or the first). */
  bestTime: boolean;
  /** Fewer falls than saved before (or the first). */
  fewestFalls: boolean;
  /** What is saved now. Null when nothing is. */
  best: Best | null;
  /** What was saved before this run. Null when nothing was. */
  before: Best | null;
}

/** A name as it will be kept: no odd spacing, no control characters, 12 characters at most. Empty when nothing is left. */
export const cleanName = (typed: unknown): string => {
  if (typeof typed !== 'string') return '';
  const tidy = typed
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(tidy).slice(0, MAX_NAME_LENGTH).join('').trim();
};

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const ID = /^[a-z0-9-]{1,40}$/;

/** Keeps whatever in saved bests is sound and drops the rest. */
const cleanBests = (saved: unknown): Bests => {
  const bests: Bests = {};
  if (!isRecord(saved)) return bests;
  for (const [levelId, heroes] of Object.entries(saved)) {
    if (!ID.test(levelId) || !isRecord(heroes)) continue;
    for (const [hero, difficulties] of Object.entries(heroes)) {
      if (!isHeroName(hero) || !isRecord(difficulties)) continue;
      for (const [difficulty, best] of Object.entries(difficulties)) {
        if (!isDifficulty(difficulty) || !isRecord(best)) continue;
        // A time of nothing at all is not a run.
        if (!isCount(best.seconds) || best.seconds <= 0 || !isCount(best.falls)) continue;
        ((bests[levelId] ??= {})[hero] ??= {})[difficulty] = { seconds: best.seconds, falls: Math.floor(best.falls) };
      }
    }
  }
  return bests;
};

const cleanPlayer = (saved: unknown): Player | null => {
  if (!isRecord(saved)) return null;
  const name = cleanName(saved.name);
  if (typeof saved.id !== 'string' || !ID.test(saved.id) || !name) return null;
  return {
    id: saved.id,
    name,
    colour: isColour(saved.colour) ? saved.colour : COLOURS[0].id,
    hero: isHeroName(saved.hero) ? saved.hero : 'Yaarbro',
    difficulty: isDifficulty(saved.difficulty) ? saved.difficulty : 'normal',
    bests: cleanBests(saved.bests),
  };
};

export class Players {
  private players: Player[] = [];
  private lastId: string | null = null;

  /** `storage` is null when the browser has none to give (private windows): everything works, and is forgotten when the page closes. */
  constructor(private readonly storage: StorageLike | null) {
    this.load();
  }

  private read(key: string): unknown {
    try {
      const text = this.storage?.getItem(key);
      return typeof text === 'string' ? JSON.parse(text) : null;
    } catch {
      // Blocked storage, or text that is not what was saved: the same as nothing saved.
      return null;
    }
  }

  private load(): void {
    const saved = this.read(PLAYERS_KEY);
    if (!isRecord(saved) || !Array.isArray(saved.players)) return;
    for (const entry of saved.players) {
      const player = cleanPlayer(entry);
      if (!player || this.players.length >= MAX_PLAYERS || this.players.some((other) => other.id === player.id)) continue;
      this.players.push(player);
    }
    this.lastId = this.players.some((player) => player.id === saved.last) ? (saved.last as string) : null;
  }

  private save(): void {
    try {
      this.storage?.setItem(PLAYERS_KEY, JSON.stringify({ version: 1, players: this.players, last: this.lastId }));
    } catch {
      // Storage is full or blocked. The game goes on; this visit's progress is kept only until the page closes.
    }
  }

  /** Everyone on this device, in the order they were added. */
  list(): readonly Player[] {
    return this.players;
  }

  get(id: string | null): Player | null {
    return this.players.find((player) => player.id === id) ?? null;
  }

  /** Who played last on this device, if they are still here. */
  get last(): Player | null {
    return this.get(this.lastId);
  }

  get full(): boolean {
    return this.players.length >= MAX_PLAYERS;
  }

  /** Adds a player. Null when the name is empty or there are already four. */
  add(name: string, colour: ColourId): Player | null {
    const kept = cleanName(name);
    if (!kept || this.full || !isColour(colour)) return null;
    // A first player starts from the hero and difficulty this device chose before there were players.
    const old = this.players.length === 0 ? this.read(OLD_CHOICE_KEY) : null;
    const before = isRecord(old) ? old : {};
    let id = '';
    do id = `p-${Math.floor(Math.random() * 36 ** 6).toString(36)}`;
    while (this.get(id));
    const player: Player = {
      id,
      name: kept,
      colour,
      hero: isHeroName(before.hero) ? before.hero : 'Yaarbro',
      difficulty: isDifficulty(before.difficulty) ? before.difficulty : 'normal',
      bests: {},
    };
    this.players.push(player);
    this.save();
    return player;
  }

  /** Notes who is playing now, so they are first in line next visit. */
  choose(id: string): Player | null {
    const player = this.get(id);
    if (!player) return null;
    this.lastId = id;
    this.save();
    return player;
  }

  /** Remembers the hero and difficulty a player picked. */
  setChoice(id: string, hero: HeroName, difficulty: Difficulty): void {
    const player = this.get(id);
    if (!player || !isHeroName(hero) || !isDifficulty(difficulty)) return;
    player.hero = hero;
    player.difficulty = difficulty;
    this.save();
  }

  /** Wipes one player's progress. Their name, colour and last choices stay. For a parent, behind a confirmation. */
  resetProgress(id: string): boolean {
    const player = this.get(id);
    if (!player) return false;
    player.bests = {};
    this.save();
    return true;
  }

  /** Takes a player off this device, progress and all. For a parent, behind a confirmation. */
  remove(id: string): boolean {
    const before = this.players.length;
    this.players = this.players.filter((player) => player.id !== id);
    if (this.lastId === id) this.lastId = null;
    if (this.players.length === before) return false;
    this.save();
    return true;
  }

  /**
   * Saves a run for a player. Only a run that reached the golden leaf counts.
   * The best time and the fewest falls are each kept if this run beat them.
   */
  finish(id: string, run: Run): Outcome {
    const player = this.get(id);
    const sound = ID.test(run.levelId) && isHeroName(run.hero) && isDifficulty(run.difficulty) && isCount(run.seconds) && run.seconds > 0 && isCount(run.falls);
    if (!player || !run.complete || !sound) return { counted: false, first: false, bestTime: false, fewestFalls: false, best: null, before: null };
    const slot = ((player.bests[run.levelId] ??= {})[run.hero] ??= {});
    const before = slot[run.difficulty] ?? null;
    const bestTime = !before || run.seconds < before.seconds;
    const fewestFalls = !before || run.falls < before.falls;
    const best: Best = {
      seconds: bestTime ? run.seconds : before.seconds,
      falls: fewestFalls ? Math.floor(run.falls) : before.falls,
    };
    slot[run.difficulty] = best;
    if (bestTime || fewestFalls) this.save();
    return { counted: true, first: !before, bestTime, fewestFalls, best, before: before ? { ...before } : null };
  }
}

/** A player's best for one level, hero and difficulty, or null when they have not finished it that way. */
export const bestFor = (player: Player, levelId: string, hero: HeroName, difficulty: Difficulty): Best | null =>
  player.bests[levelId]?.[hero]?.[difficulty] ?? null;

/** Whether a player has finished a level on a difficulty, as either hero. */
export const hasFinished = (player: Player, levelId: string, difficulty: Difficulty): boolean =>
  Object.values(player.bests[levelId] ?? {}).some((difficulties) => difficulties?.[difficulty] !== undefined);

/** A player's best time for a level on a difficulty, as either hero. Null when not finished. */
export const bestTime = (player: Player, levelId: string, difficulty: Difficulty): number | null => {
  const times = Object.values(player.bests[levelId] ?? {})
    .map((difficulties) => difficulties?.[difficulty]?.seconds)
    .filter((seconds): seconds is number => seconds !== undefined);
  return times.length ? Math.min(...times) : null;
};

/** What a level's card shows for a player: for each difficulty, whether it is finished and the best time (as either hero). */
export const progressOn = (player: Player, levelId: string): Record<Difficulty, { finished: boolean; seconds: number | null }> => {
  const on = (difficulty: Difficulty): { finished: boolean; seconds: number | null } => ({
    finished: hasFinished(player, levelId, difficulty),
    seconds: bestTime(player, levelId, difficulty),
  });
  return { easy: on('easy'), normal: on('normal'), hard: on('hard') };
};
