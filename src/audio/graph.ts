// How the sounds are wired together, shared by the game (player.ts), the
// mixer page the owner sets levels on (tools/preview/mixer.ts) and the tool
// that measures loudness (tools/preview/mix-measure.mjs). All three run this
// same code, so what is set and measured is what the game plays.
//
// The path of every sound:
//
//   one sound  ->  its own level, with a soft start
//              ->  its group's volume (warnings and hits, jumps and landings,
//                  footsteps, menu, or music)
//              ->  the master volume
//              ->  the top end turned down (takes the edge off)
//              ->  a soft limiter (nothing ever gets past seven tenths of full)
//              ->  the speakers
//
// Music also passes two more volumes on the way: one that dips it under a
// warning, hit or checkpoint, and one that takes it away for the leaf tune.

import type { PlayOptions } from './mix';
import { MIX, SOFTEN, SOUNDS, STEP_VOICE, gainOf, type Group, type SoundDef, type SoundName } from './sounds';
import { evenOut, renderSynth, type SynthName } from './synth';

export const LIST = SOUNDS as Record<SoundName, SoundDef>;
export const GROUPS: Group[] = ['music', 'cue', 'action', 'step', 'menu'];
export type Levels = Record<Group | 'master', number>;

/** Seconds a sound takes to come in. Longer for what should stay in the background. */
const ATTACK: Record<Group, number> = { cue: 0.006, action: 0.012, step: 0.012, menu: 0.008, music: 0.02 };
/**
 * Short sounds are evened at a level low enough that none of them clips. This
 * many decibels bring the whole mix back up, so the master slider has room
 * above and below where it starts.
 */
const LIFT = 6;
/** How much quieter the made sound under a landing is than the landing, in decibels. */
const UNDER = -5;

export interface MixGraph {
  ctx: BaseAudioContext;
  groups: Record<Group, GainNode>;
  master: GainNode;
  /** Dips the music under a cue. */
  dip: GainNode;
  /** Takes the music away for a tune. */
  makeWay: GainNode;
  /** Mute: after everything else, so the mix underneath is untouched. */
  gate: GainNode;
  setLevels(levels: Levels): void;
}

export const buildMix = (ctx: BaseAudioContext, levels: Levels = MIX): MixGraph => {
  // The soft limiter. Up to a third of full it leaves sound alone; above that it
  // eases louder and louder peaks down, and nothing ever gets past seven tenths
  // of full. It is a fixed curve, so it behaves the same in every browser (the
  // browsers' own compressor adds loudness of its own accord, which a quiet mix
  // does not want).
  const limiter = ctx.createWaveShaper();
  limiter.curve = limitCurve();
  limiter.oversample = '2x';
  const gate = ctx.createGain();
  limiter.connect(gate).connect(ctx.destination);
  // A wave shaper only looks at inputs up to full, so the sound is halved on the way in to match the curve.
  const intoLimiter = ctx.createGain();
  intoLimiter.gain.value = 0.5;
  intoLimiter.connect(limiter);

  const soften = ctx.createBiquadFilter();
  soften.type = 'highshelf';
  soften.frequency.value = SOFTEN.above;
  soften.gain.value = SOFTEN.by;
  soften.connect(intoLimiter);

  const master = ctx.createGain();
  master.connect(soften);

  const dip = ctx.createGain();
  const makeWay = ctx.createGain();
  dip.connect(makeWay).connect(master);

  const groups = {} as Record<Group, GainNode>;
  for (const group of GROUPS) {
    groups[group] = ctx.createGain();
    groups[group].connect(group === 'music' ? dip : master);
  }
  const graph: MixGraph = {
    ctx,
    groups,
    master,
    dip,
    makeWay,
    gate,
    setLevels(next) {
      master.gain.value = gainOf(next.master + LIFT);
      for (const group of GROUPS) groups[group].gain.value = gainOf(next[group]);
    },
  };
  graph.setLevels(levels);
  return graph;
};

/** Where the limiter starts to act, and the most it ever lets through. 1 is full. */
export const LIMIT = { from: 0.33, ceiling: 0.7 };

const limitCurve = (): Float32Array<ArrayBuffer> => {
  const points = 2049;
  const curve = new Float32Array(points);
  const { from, ceiling } = LIMIT;
  const room = ceiling - from;
  for (let i = 0; i < points; i++) {
    // The curve is asked about inputs from -2 to 2: sounds that pile up can pass full.
    const x = ((i / (points - 1)) * 2 - 1) * 2;
    const size = Math.abs(x);
    const y = size <= from ? size : from + room * Math.tanh((size - from) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
};

/** Every sound, decoded or made, ready to play. Keys are file names, or `synth:` and a recipe's name. */
export type Buffers = Map<string, AudioBuffer>;

const decodeOne = (ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> =>
  // The older form with callbacks: every Safari has it.
  new Promise((resolve, reject) => {
    const answer = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    answer?.catch?.(() => {});
  });

/**
 * Decodes every recorded file and makes every made sound. `bytesOf` hands over
 * a file's bytes (or nothing, if it did not arrive). Short sounds are brought
 * to one common loudness; music was evened when its file was made.
 */
export const loadBuffers = async (
  ctx: BaseAudioContext,
  bytesOf: (file: string) => ArrayBuffer | undefined | Promise<ArrayBuffer | undefined>,
  problems: string[],
): Promise<Buffers> => {
  const buffers: Buffers = new Map();
  const jobs: Promise<void>[] = [];
  const synths = new Set<SynthName>();
  const files = new Map<string, boolean>();
  for (const def of Object.values(LIST)) {
    if (def.under) synths.add(def.under);
    if ('synth' in def.source) synths.add(def.source.synth);
    else for (const file of def.source.files) files.set(file, (files.get(file) ?? true) && def.mix !== 'music');
  }
  for (const name of synths) {
    jobs.push(
      renderSynth(name)
        .then((buffer) => void buffers.set(`synth:${name}`, buffer))
        .catch((error: unknown) => void problems.push(`${name} could not be made: ${String(error)}`)),
    );
  }
  for (const [file, even] of files) {
    jobs.push(
      (async () => {
        const data = await bytesOf(file);
        if (!data) return;
        try {
          const buffer = await decodeOne(ctx, data.slice(0));
          if (even) for (let c = 0; c < buffer.numberOfChannels; c++) evenOut(buffer.getChannelData(c), buffer.sampleRate);
          buffers.set(file, buffer);
        } catch (error) {
          problems.push(`${file} could not be read: ${String(error)}`);
        }
      })(),
    );
  }
  await Promise.all(jobs);
  return buffers;
};

/** Takes the recordings of a sound in turn, so repeats are not the same one twice. */
export class Turns {
  private readonly turn = new Map<SoundName, number>();
  constructor(private readonly buffers: Buffers) {}
  next(name: SoundName): AudioBuffer | undefined {
    const { source } = LIST[name];
    if ('synth' in source) return this.buffers.get(`synth:${source.synth}`);
    const n = this.turn.get(name) ?? 0;
    this.turn.set(name, n + 1);
    return this.buffers.get(source.files[n % source.files.length]!);
  }
  under(name: SynthName): AudioBuffer | undefined {
    return this.buffers.get(`synth:${name}`);
  }
}

/**
 * Plays one sound once, at `when` (in the graph's own seconds). `vary` is the
 * chance used to make each play a little higher or lower; the measuring tool
 * passes a fixed one so two measurements agree. Returns how long it lasts.
 */
export const strike = (
  graph: MixGraph,
  turns: Turns,
  name: SoundName,
  options: PlayOptions = {},
  when = graph.ctx.currentTime,
  vary: () => number = Math.random,
): number => {
  const { ctx } = graph;
  const def = LIST[name];
  const voice = options.voice ? STEP_VOICE[options.voice] : STEP_VOICE.yaarbro;
  const out = graph.groups[def.mix];
  const volume = options.volume ?? 1;
  let longest = 0;

  const one = (buffer: AudioBuffer, at: number, level: number, rate: number, soften: number): void => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    // A soft start: from nothing up to its level over a few thousandths of a second.
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + ATTACK[def.mix]);
    let node: AudioNode = source;
    if (soften) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = soften;
      node = source.connect(filter);
    }
    node.connect(gain).connect(out);
    source.start(at);
    longest = Math.max(longest, at - when + buffer.duration / rate);
  };

  const level = gainOf(def.level + voice.level) * volume;
  const rate = (): number => voice.rate * (1 + (vary() * 2 - 1) * (def.vary ?? 0));
  const first = turns.next(name);
  if (!first) return 0;
  one(first, when, level, rate(), voice.soften);
  if (def.double) {
    // The second foot: a different recording, a moment later and a little quieter.
    const second = turns.next(name);
    if (second) one(second, when + def.double, level * 0.8, rate(), voice.soften);
  }
  if (def.under) {
    const under = turns.under(def.under);
    if (under) one(under, when, level * gainOf(UNDER), 1, 0);
  }
  if (def.mix === 'cue') {
    // The music steps back for as long as the cue lasts, then comes forward again.
    graph.dip.gain.cancelScheduledValues(when);
    graph.dip.gain.setTargetAtTime(0.5, when, 0.03);
    graph.dip.gain.setTargetAtTime(1, when + longest + 0.1, 0.25);
  }
  return longest;
};

/** The seconds at which a buffer first and last makes a sound. */
export const soundingPart = (buffer: AudioBuffer): [number, number] => {
  const data = buffer.getChannelData(0);
  const quiet = 0.002;
  let first = 0;
  while (first < data.length && Math.abs(data[first]!) < quiet) first += 1;
  let last = data.length - 1;
  while (last > first && Math.abs(data[last]!) < quiet) last -= 1;
  if (last - first < buffer.sampleRate) return [0, buffer.duration];
  return [first / buffer.sampleRate, (last + 1) / buffer.sampleRate];
};

/** Starts a piece of music going round and round. Returns what is needed to stop it. */
export const startMusic = (graph: MixGraph, buffer: AudioBuffer, name: SoundName, when: number, fade: number): { source: AudioBufferSourceNode; gain: GainNode } => {
  const { ctx } = graph;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  // An MP3 has a moment of silence at each end. Looping between the first and
  // last sounding moments keeps the join from being a gap.
  const [from, to] = soundingPart(buffer);
  source.loopStart = from;
  source.loopEnd = to;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.setTargetAtTime(gainOf(LIST[name].level), when, fade);
  source.connect(gain).connect(graph.groups.music);
  source.start(when, from);
  return { source, gain };
};

/** Seconds between footsteps at a walk, as in the game: a stride of 1.25 metres at 6 metres a second. */
const PACE = 1.25 / 6;

/**
 * A short sample of play, for the mixer page and for measuring: music under
 * footsteps, a jump and a landing on moss and on wood, a mushroom bounce, a
 * marmot warning, a hit and a checkpoint. `only` leaves out the music or the
 * effects, to measure each alone; `normal` stops before the bounce, leaving
 * only what is heard nearly all the time. Returns how many seconds it lasts.
 */
export const sampleRun = (
  graph: MixGraph,
  turns: Turns,
  buffers: Buffers,
  start: number,
  { only, normal = false, vary = Math.random }: { only?: 'music' | 'effects'; normal?: boolean; vary?: () => number } = {},
): number => {
  if (only !== 'effects') {
    const music = buffers.get('grove-music.mp3');
    if (music) startMusic(graph, music, 'groveMusic', start, 0.15);
  }
  if (only === 'music') return normal ? 8.2 : 13;
  const play = (name: SoundName, at: number): void => void strike(graph, turns, name, {}, start + at, vary);
  const walk = (name: SoundName, from: number, steps: number): number => {
    for (let i = 0; i < steps; i++) play(name, from + i * PACE);
    return from + steps * PACE;
  };
  let t = walk('stepMoss', 1, 7);
  play('pushMoss', t);
  play('landMoss', t + 0.65);
  t = walk('stepMoss', t + 0.9, 4);
  t = walk('stepWood', t + 0.25, 6);
  play('pushWood', t);
  play('landWood', t + 0.65);
  t = walk('stepWood', t + 0.9, 5);
  if (normal) return t + 0.4;
  play('bounce', t + 0.3);
  play('marmotTell', t + 1.4);
  play('hit', t + 2.4);
  play('checkpoint', t + 3.4);
  return t + 5.4;
};
