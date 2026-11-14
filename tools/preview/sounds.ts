// The sound board: every sound and piece of music in the game on one page,
// each with a play button, for the owner to listen to before any of it is
// wired into the game. Built by sounds.mjs from the game's own list
// (src/audio/sounds.ts) and played through the game's own recipes
// (src/audio/synth.ts), so what is heard here is what the game will play.

import { LIST, Turns, buildMix, loadBuffers, strike, type Buffers, type MixGraph } from '../../src/audio/graph';
import { VOICE, gainOf, type Group, type SoundDef, type SoundName } from '../../src/audio/sounds';
import { evenOut } from '../../src/audio/synth';

interface Extra { label: string; what: string; file: string; credit: string; loop: boolean; level: number; mix?: 'cue' | 'action' | 'step' | 'menu' | 'music' }
interface Board { credits: Record<string, string>; extras: Extra[]; extrasTitle?: string; extrasNote?: string }

const board = (await (await fetch('media/board.json')).json()) as Board;
const list = LIST;

let ctx: AudioContext | null = null;
let graph: MixGraph;
let buffers: Buffers;
let turns: Turns;
const problems: string[] = [];

const bytesOf = async (file: string): Promise<ArrayBuffer> => {
  const text = await (await fetch(`media/${file}.txt`)).text();
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

/** The game's own wiring and levels (src/audio/graph.ts), so this page sounds as the game does. */
const start = async (): Promise<AudioContext> => {
  if (!ctx) {
    const Maker = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Maker();
    graph = buildMix(ctx);
    buffers = await loadBuffers(ctx, bytesOf, problems);
    turns = new Turns(buffers);
  }
  if (ctx.state !== 'running') await ctx.resume();
  return ctx;
};

/** A sound that is not in the game: one of the other choices. */
const extraBuffer = async (file: string, even: boolean): Promise<AudioBuffer> => {
  const had = buffers.get(file);
  if (had) return had;
  const buffer = await ctx!.decodeAudioData(await bytesOf(file));
  if (even) for (let c = 0; c < buffer.numberOfChannels; c++) evenOut(buffer.getChannelData(c), buffer.sampleRate);
  buffers.set(file, buffer);
  return buffer;
};

type Voice = keyof typeof VOICE;
/** What a row plays: a sound from the game's list, or another choice with its own file. */
type Item = { name: SoundName } | { file: string; mix: Group; level: number; loop: boolean };
const playing = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();

const play = async (key: string, item: Item, voice: Voice, button: HTMLButtonElement): Promise<void> => {
  const audio = await start();
  const going = playing.get(key);
  if (going) {
    going.gain.gain.setTargetAtTime(0, audio.currentTime, 0.08);
    going.source.stop(audio.currentTime + 0.4);
    playing.delete(key);
    button.classList.remove('on');
    return;
  }
  const def = 'name' in item ? list[item.name] : null;
  const loop = def ? def.loop ?? false : (item as { loop: boolean }).loop;
  const long = def ? def.mix === 'music' : true;
  if (def && 'name' in item && !loop && !long) {
    // A single sound, played exactly as the game plays it.
    strike(graph, turns, item.name, { voice });
    return;
  }
  const buffer = 'name' in item ? turns.next(item.name) : await extraBuffer(item.file, item.mix !== 'music');
  if (!buffer) return;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.loop = loop;
  const gain = audio.createGain();
  gain.gain.value = gainOf(def ? def.level : (item as { level: number }).level);
  source.connect(gain).connect(graph.groups[def ? def.mix : (item as { mix: Group }).mix]);
  source.start();
  playing.set(key, { source, gain });
  button.classList.add('on');
  source.onended = () => {
    if (playing.get(key)?.source === source) playing.delete(key);
    button.classList.remove('on');
  };
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};

const creditOf = (source: SoundDef['source']): string =>
  'synth' in source ? 'Made in code for this game (Web Audio). No file.' : board.credits[source.files[0]!] ?? '';

const row = (key: string, label: string, what: string, credit: string, what_: Item, voice: Voice, loops: boolean): HTMLElement => {
  const item = el('div', 'sound');
  const button = el('button', 'play');
  button.type = 'button';
  button.id = `play-${key}`;
  button.setAttribute('aria-label', `Play ${label}`);
  button.append(el('span', 'tri'));
  button.addEventListener('click', () => {
    play(key, what_, voice, button).catch((error: unknown) => {
      status.textContent = `That sound could not be played: ${String(error)}`;
    });
  });
  const text = el('div', 'about');
  const title = el('h3', '', label);
  if (loops) title.append(el('span', 'tag', 'press again to stop'));
  text.append(title, el('p', 'what', what), el('p', 'credit', credit));
  item.append(button, text);
  return item;
};

const status = document.getElementById('status')!;
const groups = document.getElementById('groups')!;
const ORDER: SoundDef['group'][] = ['Footsteps', 'Hero', 'Water', 'Enemies', 'World', 'Menu', 'Music'];
const NOTE: Partial<Record<SoundDef['group'], string>> = {
  Footsteps: "Each press plays the next recording, a little higher or lower each time. Caputo's are the same steps made quieter, lighter and softer.",
  Enemies: 'In the game these fade with distance. Here they play at their closest.',
  Music: 'Start the grove music, then play other sounds over it. For setting how loud each group is, use the mixer page.',
};
for (const group of ORDER) {
  const section = el('section', 'group');
  section.append(el('h2', '', group));
  if (NOTE[group]) section.append(el('p', 'note', NOTE[group]));
  for (const [name, def] of Object.entries(list) as [SoundName, SoundDef][]) {
    if (def.group !== group) continue;
    if (group === 'Footsteps') {
      section.append(row(`${name}-yaarbro`, `Yaarbro: ${def.label.toLowerCase()}`, def.what, creditOf(def.source), { name }, 'yaarbro', false));
      section.append(row(`${name}-caputo`, `Caputo: ${def.label.toLowerCase()}`, def.what, creditOf(def.source), { name }, 'caputo', false));
    } else {
      section.append(row(name, def.label, def.what, creditOf(def.source), { name }, 'yaarbro', Boolean(def.loop) || def.mix === 'music'));
    }
  }
  groups.append(section);
}
if (board.extras.length) {
  const section = el('section', 'group');
  section.append(el('h2', '', board.extrasTitle ?? 'Other choices'));
  section.append(el('p', 'note', board.extrasNote ?? 'Not picked, but ready if you like one better. Say its name and it replaces the pick above.'));
  for (const extra of board.extras) {
    section.append(row(`extra-${extra.file}`, extra.label, extra.what, extra.credit, { file: extra.file, mix: extra.mix ?? (extra.file.endsWith('.mp3') ? 'music' : 'action'), level: extra.level, loop: extra.loop }, 'yaarbro', true));
  }
  groups.append(section);
}
status.textContent = 'Press any play button. The first press takes a moment while the sounds are made ready.';

// For measuring loudness from a test browser (see sounds.mjs).
(window as unknown as { soundBoard: unknown }).soundBoard = {
  names: Object.keys(list),
  async samples(name: SoundName): Promise<{ rate: number; data: number[] }> {
    await start();
    const buffer = turns.next(name)!;
    return { rate: buffer.sampleRate, data: Array.from(buffer.getChannelData(0)) };
  },
};
