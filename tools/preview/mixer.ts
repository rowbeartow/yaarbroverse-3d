// The mixer page: the owner sets how loud each group of sounds is, by ear,
// and sends the numbers back. It plays the game's real sounds through the
// game's real wiring (src/audio/graph.ts), so a setting here is that setting
// in the game. Built by mixer.mjs.
//
// It also draws the sample run with no speakers at all, for
// mix-measure.mjs to measure how loud a set of levels comes out.

import { GROUPS, Turns, buildMix, loadBuffers, sampleRun, strike, type Buffers, type Levels, type MixGraph } from '../../src/audio/graph';
import { MIX, type Group } from '../../src/audio/sounds';

const NAMES: Record<Group | 'master', string> = {
  master: 'Master',
  music: 'Music',
  cue: 'Warnings and hits',
  action: 'Jumps and landings',
  step: 'Footsteps',
  menu: 'Menu',
};
/** The short names used in the line of settings. */
const SHORT: Record<Group | 'master', string> = { master: 'master', music: 'music', cue: 'warnings', action: 'jumps', step: 'footsteps', menu: 'menu' };
const HINT: Record<Group | 'master', string> = {
  master: 'Everything together. Set this last.',
  music: 'The grove music. It also dips by itself under a warning, hit or checkpoint.',
  cue: 'The marmot warning, the hit and the checkpoint in the sample. Also falls, strikes and the mosquito.',
  action: 'The jump and landing on moss and wood, and the mushroom bounce. Also the roll and the pounce.',
  step: 'Footsteps on moss and wood.',
  menu: 'Button clicks. Not in the sample: use the click button.',
};
const ORDER: (Group | 'master')[] = ['master', 'music', 'cue', 'action', 'step', 'menu'];

const bytesOf = async (file: string): Promise<ArrayBuffer> => {
  const text = await (await fetch(`media/${file}.txt`)).text();
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
};

const levels: Levels = { ...MIX };
let ctx: AudioContext | null = null;
let graph: MixGraph | null = null;
let buffers: Buffers | null = null;
const problems: string[] = [];

const loaded = async (with_: BaseAudioContext): Promise<Buffers> => {
  buffers ??= await loadBuffers(with_, bytesOf, problems);
  return buffers;
};

const status = document.getElementById('status')!;
const line = document.getElementById('line') as HTMLTextAreaElement;
const sample = document.getElementById('sample') as HTMLButtonElement;

const describe = (): string => ORDER.map((key) => `${SHORT[key]} ${levels[key]}`).join(', ');
const show = (): void => {
  line.value = describe();
  for (const key of ORDER) {
    (document.getElementById(`slider-${key}`) as HTMLInputElement).value = String(levels[key]);
    document.getElementById(`value-${key}`)!.textContent = `${levels[key]} dB`;
  }
  graph?.setLevels(levels);
};

// One slider for each group, and the master.
const sliders = document.getElementById('sliders')!;
for (const key of ORDER) {
  const row = document.createElement('div');
  row.className = key === 'master' ? 'slider master' : 'slider';
  const label = document.createElement('label');
  label.htmlFor = `slider-${key}`;
  label.textContent = NAMES[key];
  const value = document.createElement('output');
  value.id = `value-${key}`;
  value.htmlFor.add(`slider-${key}`);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = `slider-${key}`;
  input.min = '-40';
  input.max = '0';
  input.step = '1';
  input.addEventListener('input', () => {
    levels[key] = Number(input.value);
    show();
  });
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = HINT[key];
  row.append(label, value, input, hint);
  sliders.append(row);
}

let stopSample: (() => void) | null = null;

/** Starts sound (this has to come from a press) and gets every sound ready. */
const wake = async (): Promise<{ audio: AudioContext; graph: MixGraph; turns: Turns; buffers: Buffers }> => {
  if (!ctx) {
    const Maker = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Maker();
  }
  if (ctx.state !== 'running') await ctx.resume();
  const ready = await loaded(ctx);
  graph ??= buildMix(ctx, levels);
  return { audio: ctx, graph, turns: new Turns(ready), buffers: ready };
};

/** Plays the sample run round and round until stopped, so sliders can be moved while it plays. */
const playSample = async (): Promise<void> => {
  if (stopSample) {
    stopSample();
    return;
  }
  status.textContent = 'Getting the sounds ready…';
  const { audio } = await wake();
  let live = true;
  let timer = 0;
  let current: MixGraph | null = null;
  const round = (): void => {
    if (!live) return;
    // Each round gets its own wiring, so stopping it is clean: its volume is dropped and it is let go.
    current = buildMix(audio, levels);
    graph = current;
    const length = sampleRun(current, new Turns(buffers!), buffers!, audio.currentTime + 0.1);
    timer = window.setTimeout(() => {
      fade(current!);
      round();
    }, length * 1000);
  };
  const fade = (old: MixGraph): void => {
    old.gate.gain.setTargetAtTime(0, audio.currentTime, 0.05);
    window.setTimeout(() => old.gate.disconnect(), 600);
  };
  stopSample = () => {
    live = false;
    window.clearTimeout(timer);
    if (current) fade(current);
    graph = null;
    stopSample = null;
    sample.textContent = 'Play the sample run';
    sample.classList.remove('on');
    status.textContent = 'Stopped.';
  };
  sample.textContent = 'Stop';
  sample.classList.add('on');
  status.textContent = 'Playing. It repeats until you press Stop. Move the sliders while it plays.';
  round();
};

sample.addEventListener('click', () => {
  playSample().catch((error: unknown) => {
    status.textContent = `The sample could not be played: ${String(error)}`;
  });
});

document.getElementById('click')!.addEventListener('click', () => {
  void wake().then(({ graph: mix, turns }) => strike(mix, turns, 'button'));
});

document.getElementById('reset')!.addEventListener('click', () => {
  Object.assign(levels, MIX);
  show();
});

const copy = document.getElementById('copy') as HTMLButtonElement;
copy.addEventListener('click', () => {
  const done = (): void => {
    copy.textContent = 'Copied';
    window.setTimeout(() => (copy.textContent = 'Copy'), 1500);
  };
  const select = (): void => {
    line.focus();
    line.select();
    copy.textContent = 'Selected: now copy it';
  };
  try {
    navigator.clipboard.writeText(line.value).then(done, select);
  } catch {
    select();
  }
});

show();
status.textContent = 'Press "Play the sample run".';

// For mix-measure.mjs: the sample run drawn with no speakers, as numbers.
(window as unknown as { mixer: unknown }).mixer = {
  start: { ...MIX },
  async render(what: 'all' | 'music' | 'effects' | 'normal', with_: Levels = MIX): Promise<{ rate: number; left: number[]; right: number[] }> {
    const rate = 44100;
    const scratch = new OfflineAudioContext(2, 1, rate);
    const ready = await loaded(scratch);
    const seconds = what === 'normal' ? 9 : 14;
    const offline = new OfflineAudioContext(2, rate * seconds, rate);
    const mix = buildMix(offline, with_);
    // The same "chance" every time, so two measurements of the same levels agree.
    let seed = 7;
    const vary = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    sampleRun(mix, new Turns(ready), ready, 0.05, { only: what === 'music' || what === 'effects' ? what : undefined, normal: what === 'normal', vary });
    const drawn = await offline.startRendering();
    return { rate, left: Array.from(drawn.getChannelData(0)), right: Array.from(drawn.getChannelData(1)) };
  },
  groups: GROUPS,
  problems,
};
