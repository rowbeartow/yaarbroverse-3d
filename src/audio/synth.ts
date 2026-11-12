// The sounds that are made in code, with Web Audio, instead of being recorded.
// Each one is a small recipe: a few tones and a little filtered hiss, shaped so
// it starts and ends gently. Nothing here is loud, sharp or sudden: the
// players are kids.
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

/** A small bell: a note with two quieter notes above it, dying away. */
const bell = (ctx: BaseAudioContext, out: AudioNode, pitch: number, at: number, length: number, level = 0.4): void => {
  tone(ctx, out, { from: pitch, at, for: length, level });
  tone(ctx, out, { from: pitch * 2, at, for: length * 0.6, level: level * 0.28 });
  tone(ctx, out, { from: pitch * 3, at, for: length * 0.35, level: level * 0.1 });
};

/** Pitches of the notes used below, in hertz. */
const NOTE = {
  A3: 220.0, C4: 261.63, E4: 329.63, G4: 392.0, C5: 523.25, E5: 659.25, G5: 783.99,
  C6: 1046.5, E6: 1318.5, G6: 1567.98, C7: 2093.0,
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
  /** A quick rising "whup". */
  jump: {
    length: 0.2,
    draw: (ctx, out) => {
      tone(ctx, out, { from: 300, to: 620, for: 0.16, level: 0.5, attack: 0.01 });
      breath(ctx, out, { kind: 'band', from: 900, to: 1800, for: 0.12, level: 0.08, q: 1.5 });
    },
  },
  /** A soft low thump. */
  land: {
    length: 0.24,
    draw: (ctx, out) => {
      // Not too low: an iPad's small speakers lose anything much under 100 hertz.
      tone(ctx, out, { from: 200, to: 85, for: 0.18, level: 0.7, attack: 0.005 });
      breath(ctx, out, { kind: 'low', from: 700, to: 250, for: 0.1, level: 0.4, attack: 0.005 });
    },
  },
  /** A springy "boing": the pitch dips, springs up and wobbles as it settles. */
  bounce: {
    length: 0.5,
    draw: (ctx, out) => {
      tone(ctx, out, { wave: 'triangle', from: 190, to: 420, for: 0.46, level: 0.5, attack: 0.006, soften: 1800, wobble: { rate: 21, depth: 55, depthEnd: 4 } });
      tone(ctx, out, { from: 95, to: 210, for: 0.3, level: 0.3, attack: 0.006 });
    },
  },
  /** A footstep on a mushroom cap: a small rubbery "bup". */
  stepMushroom: {
    length: 0.12,
    draw: (ctx, out) => {
      tone(ctx, out, { wave: 'triangle', from: 230, to: 150, for: 0.1, level: 0.5, attack: 0.006, soften: 1200 });
    },
  },
  /** Yaarbro rolling: a low tumbling rumble, round and round while he rolls. */
  roll: {
    length: 1,
    loop: true,
    draw: (ctx, out) => {
      // Two seconds are drawn and the second one kept (see `renderSynth`), so the filters have settled.
      const tumble = ctx.createGain();
      tumble.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = 0.4;
      lfo.connect(depth).connect(tumble.gain);
      lfo.start(0);
      tumble.connect(out);
      breath(ctx, tumble, { kind: 'low', from: 420, for: 2.1, level: 0.9, struck: false });
      tone(ctx, tumble, { from: 110, for: 2.1, level: 0.3, struck: false, wobble: { rate: 7, depth: 12 } });
    },
  },
  /** Caputo's pounce: a short rush of air. */
  pounce: {
    length: 0.3,
    draw: (ctx, out) => {
      breath(ctx, out, { kind: 'band', from: 400, to: 1500, for: 0.26, level: 0.6, attack: 0.05, q: 1.6 });
      tone(ctx, out, { from: 380, to: 700, for: 0.2, level: 0.12, attack: 0.04 });
    },
  },
  /** The hero is hit: a soft falling "bwomp". Not a crash. */
  hit: {
    length: 0.34,
    draw: (ctx, out) => {
      tone(ctx, out, { wave: 'triangle', from: 392, to: 185, for: 0.28, level: 0.55, attack: 0.008, soften: 1300 });
      breath(ctx, out, { kind: 'low', from: 500, to: 200, for: 0.08, level: 0.2, attack: 0.005 });
    },
  },
  /** Out of hearts: three slow notes going down. Gentle, a little sad. */
  heartsOut: {
    length: 1.3,
    draw: (ctx, out) => {
      bell(ctx, out, NOTE.E4, 0, 0.45, 0.42);
      bell(ctx, out, NOTE.C4, 0.26, 0.45, 0.42);
      bell(ctx, out, NOTE.A3, 0.52, 0.75, 0.46);
    },
  },
  /** Falling: a slide down, like a slide whistle. */
  fall: {
    length: 0.7,
    draw: (ctx, out) => {
      tone(ctx, out, { from: 640, to: 170, for: 0.62, level: 0.42, attack: 0.03, struck: false, wobble: { rate: 9, depth: 8 } });
    },
  },
  /** The marmot scout's warning: two short rising whistles, as a marmot gives. */
  marmotTell: {
    length: 0.36,
    draw: (ctx, out) => {
      // Kept well under 2,000 hertz, where a pure whistle starts to pierce.
      tone(ctx, out, { from: 1100, to: 1450, for: 0.1, level: 0.36, attack: 0.015, struck: false });
      tone(ctx, out, { from: 1100, to: 1550, at: 0.16, for: 0.14, level: 0.4, attack: 0.015, struck: false });
      breath(ctx, out, { kind: 'band', from: 1300, for: 0.3, level: 0.03, q: 3, struck: false });
    },
  },
  /** The scout throws its acorn: a small "tok" and a swish. */
  marmotThrow: {
    length: 0.24,
    draw: (ctx, out) => {
      tone(ctx, out, { from: 520, to: 300, for: 0.05, level: 0.4, attack: 0.004 });
      breath(ctx, out, { kind: 'band', from: 1300, to: 450, for: 0.2, level: 0.5, attack: 0.02, q: 1.8 });
    },
  },
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
  /** Landing on an enemy, or striking it with a roll or pounce: a cartoon "bonk". */
  strike: {
    length: 0.22,
    draw: (ctx, out) => {
      tone(ctx, out, { from: 540, to: 250, for: 0.14, level: 0.6, attack: 0.004 });
      tone(ctx, out, { wave: 'triangle', from: 820, to: 760, for: 0.04, level: 0.25, attack: 0.004, soften: 2500 });
      breath(ctx, out, { kind: 'low', from: 700, to: 250, for: 0.06, level: 0.18, attack: 0.004 });
    },
  },
  /** A checkpoint: two small bells, the second higher. */
  checkpoint: {
    length: 0.9,
    draw: (ctx, out) => {
      bell(ctx, out, NOTE.C5, 0, 0.5, 0.42);
      bell(ctx, out, NOTE.G5, 0.13, 0.72, 0.42);
    },
  },
  /** A menu button: a soft tick. */
  button: {
    length: 0.08,
    draw: (ctx, out) => {
      tone(ctx, out, { from: 720, to: 620, for: 0.06, level: 0.45, attack: 0.004 });
      tone(ctx, out, { from: 1440, for: 0.03, level: 0.1, attack: 0.004 });
    },
  },
  /**
   * Finding the golden leaf: a short happy tune on small bells. It climbs the
   * notes of a bright chord, lands on the top note over a soft held chord, and
   * ends with a little sparkle.
   */
  leafTune: {
    length: 3.6,
    draw: (ctx, out) => {
      const beat = 0.15;
      const tune: [number, number, number][] = [
        [NOTE.G4, 0, 0.4], [NOTE.C5, 1, 0.4], [NOTE.E5, 2, 0.4], [NOTE.G5, 3, 0.6],
        [NOTE.E5, 5, 0.4], [NOTE.G5, 6, 0.5], [NOTE.C6, 8, 1.6],
      ];
      for (const [pitch, beats, length] of tune) bell(ctx, out, pitch, beats * beat, length, 0.36);
      const chordAt = 8 * beat;
      for (const pitch of [NOTE.C4, NOTE.E4, NOTE.G4]) {
        tone(ctx, out, { from: pitch, at: chordAt, for: 2.2, level: 0.13, attack: 0.05 });
      }
      [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C7].forEach((pitch, i) => {
        tone(ctx, out, { from: pitch, at: chordAt + 0.5 + i * 0.09, for: 0.5, level: 0.07, attack: 0.006 });
      });
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
 * others is then set on purpose in `sounds.ts`.
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
