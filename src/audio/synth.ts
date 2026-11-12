// The sounds that are made in code, with Web Audio, instead of being recorded.
// Only the giant mosquito's three are: no recording of a mosquito that could
// be used was found, and a whine is the one sound a made tone does well. The
// owner found the other made sounds read as beeps beside the recordings, so
// they were replaced with recordings (see docs/decisions.md).
//
// Each one is a small recipe: a tone and a little filtered hiss, shaped so it
// starts and ends gently. Nothing here is loud, sharp or sudden: the players
// are kids.
//
// A recipe is drawn once, off screen, into a buffer (`renderSynth`), and the
// buffer is then played like any recorded sound. Drawing all of them takes a
// few hundredths of a second.
//
// To change how one sounds, change its numbers here, then rebuild the sound
// board (`node tools/preview/sounds.mjs`, see the top of that file) and listen.

/** Samples a second for everything made here. */
export const SYNTH_RATE = 44100;

type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square';

interface Tone {
  wave?: Wave;
  /** Pitch at the start and at the end, in hertz. */
  from: number;
  to?: number;
  /** When it starts, and how long it lasts, in seconds. */
  at?: number;
  for: number;
  /** How loud at its loudest (1 is full). */
  level?: number;
  /** Seconds to fade in. Never under 4 thousandths, so nothing clicks. */
  attack?: number;
  /** Fades out over its whole length when true (a struck sound), or holds and fades at the end. */
  struck?: boolean;
  /** A wobble in pitch: how many a second, and how many hertz either way at the start and end. */
  wobble?: { rate: number; depth: number; depthEnd?: number };
  /** Takes the edge off: nothing above this pitch gets through. */
  soften?: number;
}

/** One second of hiss, the same every time so the sounds never change between visits. */
const hiss = (ctx: BaseAudioContext, seconds: number): AudioBuffer => {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  return buffer;
};

const envelope = (gain: AudioParam, at: number, length: number, level: number, attack: number, struck: boolean): void => {
  const rise = Math.max(0.004, Math.min(attack, length / 2));
  gain.setValueAtTime(0.0001, at);
  gain.exponentialRampToValueAtTime(level, at + rise);
  if (struck) {
    gain.exponentialRampToValueAtTime(0.0001, at + length);
  } else {
    const release = Math.min(0.06, length / 3);
    gain.setValueAtTime(level, at + length - release);
    gain.exponentialRampToValueAtTime(0.0001, at + length);
  }
};

const tone = (ctx: BaseAudioContext, out: AudioNode, t: Tone): void => {
  const at = t.at ?? 0;
  const osc = ctx.createOscillator();
  osc.type = t.wave ?? 'sine';
  osc.frequency.setValueAtTime(t.from, at);
  if (t.to !== undefined && t.to !== t.from) osc.frequency.exponentialRampToValueAtTime(t.to, at + t.for);
  if (t.wobble) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = t.wobble.rate;
    depth.gain.setValueAtTime(t.wobble.depth, at);
    depth.gain.linearRampToValueAtTime(t.wobble.depthEnd ?? t.wobble.depth, at + t.for);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at);
    lfo.stop(at + t.for + 0.02);
  }
  const gain = ctx.createGain();
  envelope(gain.gain, at, t.for, t.level ?? 0.5, t.attack ?? 0.008, t.struck ?? true);
  let node: AudioNode = osc;
  if (t.soften) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = t.soften;
    node = osc.connect(filter);
  }
  node.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + t.for + 0.02);
};

interface Breath {
  at?: number;
  for: number;
  level?: number;
  attack?: number;
  struck?: boolean;
  /** `low` keeps only what is under the pitch; `band` keeps what is around it. */
  kind: 'low' | 'band';
  from: number;
  to?: number;
  /** How narrow a band is. */
  q?: number;
}

/** Filtered hiss: wind, a whoosh, the soft part of a thump. */
const breath = (ctx: BaseAudioContext, out: AudioNode, b: Breath): void => {
  const at = b.at ?? 0;
  const source = ctx.createBufferSource();
  source.buffer = hiss(ctx, 1);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = b.kind === 'low' ? 'lowpass' : 'bandpass';
  filter.Q.value = b.q ?? 1;
  filter.frequency.setValueAtTime(b.from, at);
  if (b.to !== undefined) filter.frequency.exponentialRampToValueAtTime(b.to, at + b.for);
  const gain = ctx.createGain();
  envelope(gain.gain, at, b.for, b.level ?? 0.4, b.attack ?? 0.01, b.struck ?? true);
  source.connect(filter).connect(gain).connect(out);
  source.start(at);
  source.stop(at + b.for + 0.02);
};

export interface Recipe {
  /** Seconds of sound. A loop is exactly this long. */
  length: number;
  /** A loop is played round and round for as long as something lasts (a roll, a hover). */
  loop?: boolean;
  draw: (ctx: BaseAudioContext, out: AudioNode) => void;
}

/**
 * A wobble or flutter inside a loop has to fit a whole number of times into
 * it, or the join can be heard. Every rate in a loop below is a whole number
 * and every loop is one second long.
 */
export const RECIPES = {
  /** The giant mosquito hovering: a thin steady whine, round and round while it is about. */
  mosquitoHover: {
    length: 1,
    loop: true,
    draw: (ctx, out) => {
      const flutter = ctx.createGain();
      flutter.gain.value = 0.6;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 26;
      depth.gain.value = 0.3;
      lfo.connect(depth).connect(flutter.gain);
      lfo.start(0);
      flutter.connect(out);
      tone(ctx, flutter, { wave: 'sawtooth', from: 236, for: 2.1, level: 0.4, struck: false, soften: 950, wobble: { rate: 3, depth: 6 } });
    },
  },
  /** The mosquito's warning: the whine climbs and quickens before it dives. */
  mosquitoTell: {
    length: 0.6,
    draw: (ctx, out) => {
      const flutter = ctx.createGain();
      flutter.gain.value = 0.65;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.setValueAtTime(26, 0);
      lfo.frequency.linearRampToValueAtTime(46, 0.55);
      depth.gain.value = 0.3;
      lfo.connect(depth).connect(flutter.gain);
      lfo.start(0);
      lfo.stop(0.62);
      flutter.connect(out);
      tone(ctx, flutter, { wave: 'sawtooth', from: 236, to: 370, for: 0.56, level: 0.5, attack: 0.08, struck: false, soften: 1300 });
    },
  },
  /** The mosquito dives: the whine swoops down past you. */
  mosquitoDive: {
    length: 0.42,
    draw: (ctx, out) => {
      tone(ctx, out, { wave: 'sawtooth', from: 430, to: 150, for: 0.38, level: 0.45, attack: 0.03, soften: 1100, wobble: { rate: 40, depth: 10 } });
      breath(ctx, out, { kind: 'band', from: 1200, to: 450, for: 0.3, level: 0.18, attack: 0.04, q: 1.6 });
    },
  },
} satisfies Record<string, Recipe>;

export type SynthName = keyof typeof RECIPES;

/** How loud every made sound is brought to, measured over its loudest part. 1 is full. */
const TARGET = 0.1;

/**
 * Brings a sound to the common loudness: finds the loudest fifth of a second
 * in it and scales the whole sound so that part sits at `TARGET`. Every made
 * sound goes through this, so none jumps out; how loud each is against the
 * others is then set on purpose in `sounds.ts`. Short recordings go through it too.
 */
export const evenOut = (data: Float32Array, rate: number): void => {
  const window = Math.min(data.length, Math.round(rate * 0.2));
  let sum = 0;
  let loudest = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i]! * data[i]!;
    if (i >= window) sum -= data[i - window]! * data[i - window]!;
    if (i >= window - 1) loudest = Math.max(loudest, sum / window);
  }
  const level = Math.sqrt(loudest);
  if (level < 1e-6) return;
  let scale = TARGET / level;
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]!));
  // Never louder than nine tenths of full, whatever the sum says.
  scale = Math.min(scale, 0.9 / peak);
  for (let i = 0; i < data.length; i++) data[i] = data[i]! * scale;
};

type OfflineMaker = new (channels: number, length: number, rate: number) => OfflineAudioContext;

/** Draws one made sound into a buffer, evened out and ready to play. */
export const renderSynth = async (name: SynthName): Promise<AudioBuffer> => {
  const recipe: Recipe = RECIPES[name];
  const scope = globalThis as unknown as { OfflineAudioContext?: OfflineMaker; webkitOfflineAudioContext?: OfflineMaker };
  const Offline = scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext;
  if (!Offline) throw new Error('This browser cannot draw sounds.');
  const length = Math.round(recipe.length * SYNTH_RATE);
  // A loop is drawn twice over and its second half kept, so it starts as it ends.
  const ctx = new Offline(1, recipe.loop ? length * 2 : length, SYNTH_RATE);
  recipe.draw(ctx, ctx.destination);
  const drawn = await ctx.startRendering();
  const data = new Float32Array(length);
  data.set(drawn.getChannelData(0).subarray(recipe.loop ? length : 0, recipe.loop ? length * 2 : length));
  if (!recipe.loop) {
    // The last hundredth of a second fades to nothing, so a sound never ends on a click.
    const fade = Math.round(SYNTH_RATE * 0.01);
    for (let i = 0; i < fade; i++) data[length - 1 - i] = data[length - 1 - i]! * (i / fade);
  }
  evenOut(data, SYNTH_RATE);
  const buffer = ctx.createBuffer(1, length, SYNTH_RATE);
  buffer.getChannelData(0).set(data);
  return buffer;
};
