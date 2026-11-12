// The sound board: every sound and piece of music in the game on one page,
// each with a play button, for the owner to listen to before any of it is
// wired into the game. Built by sounds.mjs from the game's own list
// (src/audio/sounds.ts) and played through the game's own recipes
// (src/audio/synth.ts), so what is heard here is what the game will play.

import { SOUNDS, STEP_VOICE, gainOf, type SoundDef, type SoundName } from '../../src/audio/sounds';
import { evenOut, renderSynth } from '../../src/audio/synth';

interface Extra { label: string; what: string; file: string; credit: string; loop: boolean; level: number }
interface Board { credits: Record<string, string>; extras: Extra[] }

const board = (await (await fetch('media/board.json')).json()) as Board;
const list = SOUNDS as Record<SoundName, SoundDef>;

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
const buffers = new Map<string, AudioBuffer>();
const turn = new Map<string, number>();

const bytesOf = async (file: string): Promise<ArrayBuffer> => {
  const text = await (await fetch(`media/${file}.txt`)).text();
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

/** A recorded file, decoded. Short ones are brought to the common loudness, as the game does. */
const fileBuffer = async (file: string, even: boolean): Promise<AudioBuffer> => {
  const had = buffers.get(file);
  if (had) return had;
  const buffer = await ctx!.decodeAudioData(await bytesOf(file));
  if (even) for (let c = 0; c < buffer.numberOfChannels; c++) evenOut(buffer.getChannelData(c), buffer.sampleRate);
  buffers.set(file, buffer);
  return buffer;
};

const synthBuffer = async (name: Parameters<typeof renderSynth>[0]): Promise<AudioBuffer> => {
  const key = `synth:${name}`;
  const had = buffers.get(key);
  if (had) return had;
  const buffer = await renderSynth(name);
  buffers.set(key, buffer);
  return buffer;
};

const start = async (): Promise<AudioContext> => {
  if (!ctx) {
    const Maker = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Maker();
    // The same safety net the game has: anything that adds up too loud is held down.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 1.5;
    master.connect(limiter).connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
  }
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
};

interface Voice { level: number; rate: number; soften: number }
const PLAIN: Voice = { level: 0, rate: 1, soften: 0 };
const playing = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

/** The music dips while a cue plays, so the cue stays clear. */
const dip = (seconds: number): void => {
  const now = ctx!.currentTime;
  musicBus.gain.cancelScheduledValues(now);
  musicBus.gain.setTargetAtTime(0.45, now, 0.03);
  musicBus.gain.setTargetAtTime(1, now + seconds + 0.1, 0.25);
};

const play = async (key: string, def: Pick<SoundDef, 'source' | 'bus' | 'level' | 'loop' | 'vary'>, voice: Voice, button: HTMLButtonElement): Promise<void> => {
  const audio = await start();
  const going = playing.get(key);
  if (going) {
    going.gain.gain.setTargetAtTime(0, audio.currentTime, 0.08);
    going.source.stop(audio.currentTime + 0.4);
    playing.delete(key);
    button.classList.remove('on');
    return;
  }
  let buffer: AudioBuffer;
  if ('synth' in def.source) {
    buffer = await synthBuffer(def.source.synth);
  } else {
    const n = turn.get(key) ?? 0;
    turn.set(key, n + 1);
    buffer = await fileBuffer(def.source.files[n % def.source.files.length]!, def.bus !== 'music');
  }
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.loop = def.loop ?? false;
  source.playbackRate.value = voice.rate * (1 + (Math.random() * 2 - 1) * (def.vary ?? 0));
  const gain = audio.createGain();
  gain.gain.value = gainOf(def.level + voice.level);
  let node: AudioNode = source;
  if (voice.soften) {
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = voice.soften;
    node = source.connect(filter);
  }
  node.connect(gain).connect(def.bus === 'music' ? musicBus : master);
  if (def.bus === 'cue' && !def.loop) dip(buffer.duration);
  source.start();
  if (def.loop || buffer.duration > 2) {
    playing.set(key, { source, gain });
    button.classList.add('on');
    source.onended = () => {
      if (playing.get(key)?.source === source) playing.delete(key);
      button.classList.remove('on');
    };
  }
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

const creditOf = (source: SoundDef['source']): string =>
  'synth' in source ? 'Made in code for this game (Web Audio). No file.' : board.credits[source.files[0]!] ?? '';

const row = (key: string, label: string, what: string, credit: string, def: Pick<SoundDef, 'source' | 'bus' | 'level' | 'loop' | 'vary'>, voice: Voice): HTMLElement => {
  const item = el('div', 'sound');
  const button = el('button', 'play');
  button.type = 'button';
  button.id = `play-${key}`;
  button.setAttribute('aria-label', `Play ${label}`);
  button.append(el('span', 'tri'));
  button.addEventListener('click', () => {
    play(key, def, voice, button).catch((error: unknown) => {
      status.textContent = `That sound could not be played: ${String(error)}`;
    });
  });
  const text = el('div', 'about');
  const title = el('h3', '', label);
  if (def.loop) title.append(el('span', 'tag', 'press again to stop'));
  text.append(title, el('p', 'what', what), el('p', 'credit', credit));
  item.append(button, text);
  return item;
};

const status = document.getElementById('status')!;
const groups = document.getElementById('groups')!;
const ORDER: SoundDef['group'][] = ['Footsteps', 'Hero', 'Enemies', 'World', 'Menu', 'Music'];
const NOTE: Partial<Record<SoundDef['group'], string>> = {
  Footsteps: "Each press plays the next recording, a little higher or lower each time. Caputo's are the same steps made quieter, lighter and softer.",
  Enemies: 'In the game these fade with distance. Here they play at their closest.',
  Music: 'Start the grove music, then play other sounds over it to hear how they sit together. It dips a little under a warning, a hit or a checkpoint.',
};
for (const group of ORDER) {
  const section = el('section', 'group');
  section.append(el('h2', '', group));
  if (NOTE[group]) section.append(el('p', 'note', NOTE[group]));
  for (const [name, def] of Object.entries(list) as [SoundName, SoundDef][]) {
    if (def.group !== group) continue;
    if (group === 'Footsteps') {
      section.append(row(`${name}-yaarbro`, `Yaarbro: ${def.label.toLowerCase()}`, def.what, creditOf(def.source), def, STEP_VOICE.yaarbro));
      section.append(row(`${name}-caputo`, `Caputo: ${def.label.toLowerCase()}`, def.what, creditOf(def.source), def, STEP_VOICE.caputo));
    } else {
      section.append(row(name, def.label, def.what, creditOf(def.source), def, PLAIN));
    }
  }
  groups.append(section);
}
if (board.extras.length) {
  const section = el('section', 'group');
  section.append(el('h2', '', 'Other choices'));
  section.append(el('p', 'note', 'Not picked, but ready if you like one better. Say its name and it replaces the pick above.'));
  for (const extra of board.extras) {
    section.append(row(`extra-${extra.file}`, extra.label, extra.what, extra.credit, { source: { files: [extra.file] }, bus: extra.file.endsWith('.mp3') ? 'music' : 'effect', level: extra.level, loop: extra.loop }, PLAIN));
  }
  groups.append(section);
}
status.textContent = 'Press any play button. The first press takes a moment while the sounds are made ready.';

// For measuring loudness from a test browser (see sounds.mjs).
(window as unknown as { soundBoard: unknown }).soundBoard = {
  names: Object.keys(list),
  async samples(name: SoundName): Promise<{ rate: number; data: number[] }> {
    await start();
    const def = list[name];
    const buffer = 'synth' in def.source ? await synthBuffer(def.source.synth) : await fileBuffer(def.source.files[0]!, def.bus !== 'music');
    return { rate: buffer.sampleRate, data: Array.from(buffer.getChannelData(0)) };
  },
};
