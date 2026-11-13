// The ghost: a recording of where a hero was during a run, and a player that
// gives back where it was at any moment. The game draws the player's best run
// as a see-through copy of the hero to race against.
//
// A ghost is only ever looked at. Nothing here changes the game it records,
// and the rules (game.ts) never see a ghost, so it cannot block, hit or
// trigger anything, and it makes no sound.
//
// A recording is kept small so a few dozen fit in a browser's storage: eight
// bytes a sample, at most 1,200 samples however long the run. It starts at 15
// samples a second, and each time it fills up it drops every other sample and
// carries on at half the rate. No browser code here.

import type { Game } from './game';
import { MOVE, STEP } from './hero';

/** Where the hero was, and what it was doing, at one moment of a run. */
export interface GhostSample {
  x: number;
  y: number;
  z: number;
  /** Which way it faced, as an angle seen from above. */
  facing: number;
  grounded: boolean;
  rolling: boolean;
  pouncing: boolean;
  /** The hero was put somewhere else since the sample before (a fall, or running out of hearts): do not glide between the two. */
  cut: boolean;
}

export interface Ghost {
  /** Rules steps between one sample and the next. The last sample is the end of the run, whenever that was. */
  interval: number;
  /** How many rules steps the run took. */
  steps: number;
  samples: GhostSample[];
}

/** What the ghost looks like at one moment, for drawing. */
export interface GhostPose extends GhostSample {
  /** Sideways speed as a share of walking speed, 0 to 1. */
  pace: number;
  /** Upward speed; negative when dropping. */
  rise: number;
  /** The recording is over: the ghost is standing where the run ended. */
  done: boolean;
}

export const GHOST_MAX_SAMPLES = 1200;
export const GHOST_FIRST_INTERVAL = 4;
/** Places are kept to the nearest 2 cm, measured from the first sample. */
const UNIT = 50;
const REACH = 32767;
const BYTES = 8;

/** Records a run. Call `step` after every rules step, then `finish` when the leaf is reached. */
export class GhostRecorder {
  private interval = GHOST_FIRST_INTERVAL;
  private steps = 0;
  private samples: GhostSample[] = [];
  private cut = false;

  constructor(game: Game) {
    this.samples.push(this.sample(game, false));
  }

  private sample(game: Game, cut: boolean): GhostSample {
    return { x: game.x, y: game.y, z: game.z, facing: game.facing, grounded: game.grounded, rolling: game.rolling, pouncing: game.pouncing > 0, cut };
  }

  step(game: Game): void {
    if (game.events.some((event) => event.type === 'fall' || event.type === 'restored')) this.cut = true;
    if (game.complete && game.events.every((event) => event.type !== 'goal')) return;
    this.steps += 1;
    if (this.steps % this.interval !== 0) return;
    this.samples.push(this.sample(game, this.cut));
    this.cut = false;
    if (this.samples.length >= GHOST_MAX_SAMPLES) this.thin();
  }

  /** Drops every other sample and halves the rate from here on. A dropped sample's cut passes to the one after it. */
  private thin(): void {
    const kept: GhostSample[] = [];
    for (let i = 0; i < this.samples.length; i += 2) {
      const sample = this.samples[i];
      kept.push(i > 0 && this.samples[i - 1].cut ? { ...sample, cut: true } : sample);
    }
    // An even count leaves the last sample out: the next one recorded must not glide over its cut.
    if (this.samples.length % 2 === 0 && this.samples[this.samples.length - 1].cut) this.cut = true;
    this.samples = kept;
    this.interval *= 2;
  }

  /** The finished recording, ending where the hero is now. Null for a run with nothing in it. */
  finish(game: Game): Ghost | null {
    if (this.steps === 0) return null;
    const samples = [...this.samples];
    // The end of the run is always the last sample, on the beat or not.
    if (this.steps % this.interval !== 0) samples.push(this.sample(game, this.cut));
    return { interval: this.interval, steps: this.steps, samples };
  }
}

/** Gives back where a recorded hero was at any moment of its run. */
export class GhostPlayer {
  constructor(private readonly ghost: Ghost) {}

  /** How long the recorded run took, in seconds. */
  get seconds(): number {
    return this.ghost.steps * STEP;
  }

  /** The moment of sample `i`, in rules steps. The last sample is the end of the run. */
  private stepOf(i: number): number {
    return i >= this.ghost.samples.length - 1 ? this.ghost.steps : i * this.ghost.interval;
  }

  /** Where the ghost is `seconds` into the run. Past the end it stands where the run ended. */
  at(seconds: number): GhostPose {
    const { samples, interval, steps } = this.ghost;
    const last = samples.length - 1;
    const step = Math.max(seconds, 0) / STEP;
    if (step >= steps || last === 0) return { ...samples[last], grounded: true, rolling: false, pouncing: false, cut: false, pace: 0, rise: 0, done: step >= steps };
    const i = Math.min(Math.floor(step / interval), last - 1);
    const a = samples[i];
    const b = samples[i + 1];
    const span = (this.stepOf(i + 1) - this.stepOf(i)) * STEP;
    // Across a cut the ghost waits where it was, then is at the new place.
    if (b.cut) return { ...a, pace: 0, rise: 0, done: false };
    const share = Math.min(Math.max((step - this.stepOf(i)) / (this.stepOf(i + 1) - this.stepOf(i)), 0), 1);
    let turn = b.facing - a.facing;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    return {
      x: a.x + (b.x - a.x) * share,
      y: a.y + (b.y - a.y) * share,
      z: a.z + (b.z - a.z) * share,
      facing: a.facing + turn * share,
      grounded: share < 0.5 ? a.grounded : b.grounded,
      rolling: share < 0.5 ? a.rolling : b.rolling,
      pouncing: share < 0.5 ? a.pouncing : b.pouncing,
      cut: false,
      pace: Math.min(Math.hypot(b.x - a.x, b.z - a.z) / span / MOVE.walkSpeed, 1),
      rise: (b.y - a.y) / span,
      done: false,
    };
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const toText = (bytes: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1] ?? 0;
    const c = bytes[i + 2] ?? 0;
    text += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | (b >> 4)];
    text += i + 1 < bytes.length ? ALPHABET[((b & 15) << 2) | (c >> 6)] : '=';
    text += i + 2 < bytes.length ? ALPHABET[c & 63] : '=';
  }
  return text;
};

const fromText = (text: string): Uint8Array | null => {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((text.length / 4) * 3 - padding);
  for (let i = 0, out = 0; i < text.length; i += 4) {
    const [a, b, c, d] = [0, 1, 2, 3].map((k) => Math.max(ALPHABET.indexOf(text[i + k]), 0));
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (out < bytes.length) bytes[out++] = triple >> 16;
    if (out < bytes.length) bytes[out++] = (triple >> 8) & 255;
    if (out < bytes.length) bytes[out++] = triple & 255;
  }
  return bytes;
};

/**
 * A ghost as text for the browser's storage. Null when it cannot be kept: the
 * run wandered further from its start than a sample can say (about 650 m).
 */
export const encodeGhost = (ghost: Ghost): string | null => {
  const origin = ghost.samples[0];
  if (!origin || ghost.samples.length > GHOST_MAX_SAMPLES + 1) return null;
  const bytes = new Uint8Array(ghost.samples.length * BYTES);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < ghost.samples.length; i += 1) {
    const s = ghost.samples[i];
    const place = [s.x - origin.x, s.y - origin.y, s.z - origin.z].map((metres) => Math.round(metres * UNIT));
    if (place.some((units) => !Number.isFinite(units) || Math.abs(units) > REACH)) return null;
    place.forEach((units, k) => view.setInt16(i * BYTES + k * 2, units));
    const turn = ((s.facing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    view.setUint8(i * BYTES + 6, Math.round((turn / (2 * Math.PI)) * 256) & 255);
    view.setUint8(i * BYTES + 7, (s.grounded ? 1 : 0) | (s.rolling ? 2 : 0) | (s.pouncing ? 4 : 0) | (s.cut ? 8 : 0));
  }
  return JSON.stringify({ v: 1, i: ghost.interval, n: ghost.steps, o: [origin.x, origin.y, origin.z], d: toText(bytes) });
};

/** Reads a ghost back from storage. Null for anything that is not a sound recording. */
export const decodeGhost = (text: unknown): Ghost | null => {
  try {
    if (typeof text !== 'string' || text.length > 40_000) return null;
    const saved: unknown = JSON.parse(text);
    if (typeof saved !== 'object' || saved === null) return null;
    const { v, i, n, o, d } = saved as Record<string, unknown>;
    const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
    if (v !== 1 || !whole(i) || !whole(n) || typeof d !== 'string') return null;
    if (!Array.isArray(o) || o.length !== 3 || !o.every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
    const bytes = fromText(d);
    if (!bytes || bytes.length < BYTES || bytes.length % BYTES !== 0) return null;
    const count = bytes.length / BYTES;
    // The samples must cover the run they claim, and no more.
    if (count > GHOST_MAX_SAMPLES + 1 || (count - 1) * i < n - i || (count - 2) * i >= n) return null;
    const view = new DataView(bytes.buffer);
    const samples: GhostSample[] = [];
    for (let k = 0; k < count; k += 1) {
      const flags = view.getUint8(k * BYTES + 7);
      samples.push({
        x: (o[0] as number) + view.getInt16(k * BYTES) / UNIT,
        y: (o[1] as number) + view.getInt16(k * BYTES + 2) / UNIT,
        z: (o[2] as number) + view.getInt16(k * BYTES + 4) / UNIT,
        facing: (view.getUint8(k * BYTES + 6) / 256) * 2 * Math.PI,
        grounded: (flags & 1) !== 0,
        rolling: (flags & 2) !== 0,
        pouncing: (flags & 4) !== 0,
        cut: (flags & 8) !== 0,
      });
    }
    return { interval: i, steps: n, samples };
  } catch {
    return null;
  }
};
