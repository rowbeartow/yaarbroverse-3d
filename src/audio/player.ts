// Makes the actual noise, with Web Audio. This is the game's `Speaker` (see
// mix.ts, which decides what may play and when). How the sounds are wired
// together and how loud each group is lives in graph.ts and sounds.ts.
//
// The shared files are fetched as soon as the page opens, and a level's own
// (its music, its enemies' sounds) when that level is picked: `setLevel`.
// Another level's are let go then, so only one level's music is ever held.
// Nothing can be decoded or played until the player taps or presses a key:
// browsers, Safari above all, only let sound start from inside a tap or a key
// press. `wake()` is called from every one of those, so sound also comes back
// after Safari has put it to sleep (a phone call, another tab).

import { LIST, Turns, buildMix, loadBuffers, setUnderwater, startMusic, strike, type Buffers, type MixGraph } from './graph';
import type { PlayOptions, Speaker } from './mix';
import { gainOf, soundFiles, type SoundName } from './sounds';

declare const __BUILD_ID__: string;

const address = (file: string): string => `${import.meta.env.BASE_URL}media/audio/${file}?v=${__BUILD_ID__}`;

/** What the browser checks can see of the sound. */
export interface PlayerInfo {
  /** 'none' until the first tap or key press, then the browser's own word: 'running', 'suspended'… */
  state: string;
  /** True once the shared sounds and those of the level that is up are decoded and can play. */
  ready: boolean;
  /** The level whose own sounds are held, by its id. */
  level: string | null;
  /** How many recorded files have been fetched on this visit, and their size in bytes. */
  fetched: { files: number; bytes: number };
  /** How loud everything is let through: 1, or 0 when muted. */
  volume: number;
  /** True while everything is muffled, the hero's head being underwater. */
  underwater: boolean;
  music: SoundName | null;
  loops: SoundName[];
  /** The last sounds played, oldest first. */
  played: SoundName[];
  /** Anything that went wrong fetching or decoding. Sound failing never stops the game. */
  problems: string[];
}

interface Running {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class Player implements Speaker {
  private ctx: AudioContext | null = null;
  private graph: MixGraph | null = null;
  private readonly bytes = new Map<string, ArrayBuffer>();
  private readonly buffers: Buffers = new Map();
  private readonly turns = new Turns(this.buffers);
  /** The level whose own sounds are wanted, and the one job at a time that brings sounds in. */
  private level: string | null = null;
  private work: Promise<void> = Promise.resolve();
  private synthsMade = false;
  private ready = false;
  private readonly fetched = { files: 0, bytes: 0 };

  private muted = false;
  private underwater = false;
  private wantedMusic: SoundName | null = null;
  private music: Running | null = null;
  /** The music that is sounding now, which may not yet be the music wanted. */
  private playing: SoundName | null = null;
  private tune: AudioBufferSourceNode | null = null;
  private readonly wantedLoops = new Map<SoundName, number>();
  private readonly loops = new Map<SoundName, Running>();
  private readonly played: SoundName[] = [];
  private readonly problems: string[] = [];

  constructor() {
    // A hidden page makes no sound, and Safari wants the sound asleep while it is hidden.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => {});
      else void this.ctx.resume().catch(() => {});
    });
  }

  /** Fetches the shared sound files. Safe to call before any tap: nothing is played or decoded. */
  preload(): Promise<void> {
    return this.bring();
  }

  /** The level that is up: fetches its own sounds and lets another level's go. Safe before any tap. */
  setLevel(levelId: string): void {
    if (this.level === levelId) return;
    this.level = levelId;
    this.ready = false;
    void this.bring();
  }

  /** Brings in whatever is wanted now and is not here yet, one job after another so two never overlap. */
  private bring(): Promise<void> {
    this.work = this.work.then(() => this.sync()).catch((error: unknown) => void this.problems.push(`Sound could not be made ready: ${String(error)}`));
    return this.work;
  }

  private async sync(): Promise<void> {
    const level = this.level;
    const wanted = new Set([...soundFiles(null), ...(level ? soundFiles(level) : [])]);
    // Another level's sounds are let go. Music that is still fading out keeps its own hold on what it plays.
    for (const file of [...this.buffers.keys()]) if (!file.startsWith('synth:') && !wanted.has(file)) this.buffers.delete(file);
    for (const file of [...this.bytes.keys()]) if (!wanted.has(file)) this.bytes.delete(file);
    await Promise.all(
      [...wanted]
        .filter((file) => !this.buffers.has(file) && !this.bytes.has(file))
        .map(async (file) => {
          try {
            const response = await fetch(address(file));
            if (!response.ok) throw new Error(String(response.status));
            const data = await response.arrayBuffer();
            this.bytes.set(file, data);
            this.fetched.files += 1;
            this.fetched.bytes += data.byteLength;
          } catch (error) {
            this.problems.push(`${file} did not arrive: ${String(error)}`);
          }
        }),
    );
    const ctx = this.ctx;
    // Before the first tap there is nothing to decode with: the bytes wait.
    if (!ctx) return;
    const files = new Set(this.bytes.keys());
    const made = await loadBuffers(ctx, (file) => this.bytes.get(file), this.problems, { files, synths: !this.synthsMade });
    this.synthsMade = true;
    for (const [key, buffer] of made) this.buffers.set(key, buffer);
    for (const file of files) this.bytes.delete(file);
    // The player may have picked another level meanwhile: the job queued behind this one finishes that.
    if (this.level !== level) return;
    this.ready = true;
    // Whatever was asked for while the sounds were being made ready starts now.
    if (this.playing !== this.wantedMusic) this.beginMusic();
    for (const [name, volume] of this.wantedLoops) this.applyLoop(name, volume);
  }

  wake(): void {
    if (!this.ctx) {
      const scope = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Maker = scope.AudioContext ?? scope.webkitAudioContext;
      if (!Maker) {
        this.problems.push('This browser has no Web Audio.');
        return;
      }
      try {
        this.ctx = new Maker();
      } catch (error) {
        this.problems.push(`Sound could not start: ${String(error)}`);
        return;
      }
      this.graph = buildMix(this.ctx);
      if (this.underwater) setUnderwater(this.graph, true);
      this.graph.gate.gain.value = this.muted ? 0 : 1;
      void this.bring();
    }
    if (this.ctx.state !== 'running' && !document.hidden) void this.ctx.resume().catch(() => {});
  }

  play(name: SoundName, options: PlayOptions): void {
    const { ctx, graph } = this;
    if (!ctx || !graph || !this.ready || ctx.state !== 'running') return;
    if (strike(graph, this.turns, name, options) <= 0) return;
    this.played.push(name);
    if (this.played.length > 60) this.played.shift();
  }

  /** Underwater: muffle everything (see MUFFLE in graph.ts). Remembered until sound can play. */
  setUnderwater(under: boolean): void {
    this.underwater = under;
    if (this.graph) setUnderwater(this.graph, under);
  }

  setLoop(name: SoundName, volume: number): void {
    this.wantedLoops.set(name, volume);
    if (this.ready) this.applyLoop(name, volume);
  }

  private applyLoop(name: SoundName, volume: number): void {
    const { ctx, graph } = this;
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    let running = this.loops.get(name);
    if (volume <= 0) {
      if (!running) return;
      running.gain.gain.setTargetAtTime(0, now, 0.06);
      running.source.stop(now + 0.4);
      this.loops.delete(name);
      return;
    }
    if (!running) {
      const buffer = this.turns.next(name);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(graph.groups[LIST[name].mix]);
      source.start();
      running = { source, gain };
      this.loops.set(name, running);
    }
    running.gain.gain.setTargetAtTime(gainOf(LIST[name].level) * volume, now, 0.08);
  }

  setMusic(name: SoundName | null): void {
    this.wantedMusic = name;
    if (this.ready) this.beginMusic();
  }

  private beginMusic(): void {
    const { ctx, graph } = this;
    if (!ctx || !graph) return;
    const now = ctx.currentTime;
    if (this.music) {
      this.music.gain.gain.setTargetAtTime(0, now, 0.3);
      this.music.source.stop(now + 2);
      this.music = null;
      this.playing = null;
    }
    const name = this.wantedMusic;
    // A level's music may still be on its way: it begins when it is here.
    const buffer = name ? this.turns.next(name) : undefined;
    if (!name || !buffer) return;
    this.playing = name;
    // It comes in slowly, over a couple of seconds, so the first tap is not answered with a wall of sound.
    this.music = startMusic(graph, buffer, name, now, 1.2);
  }

  playTune(name: SoundName | null): void {
    const { ctx, graph } = this;
    if (!ctx || !graph || !this.ready) return;
    const now = ctx.currentTime;
    if (this.tune) {
      try {
        this.tune.stop();
      } catch {
        // Already over.
      }
      this.tune = null;
    }
    graph.makeWay.gain.cancelScheduledValues(now);
    if (!name || ctx.state !== 'running') {
      graph.makeWay.gain.setTargetAtTime(1, now, 0.4);
      return;
    }
    const buffer = this.turns.next(name);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainOf(LIST[name].level), now + 0.05);
    // The tune plays at the music's volume but not through the part that makes way for it.
    const through = ctx.createGain();
    through.gain.value = graph.groups.music.gain.value;
    source.connect(gain).connect(through).connect(graph.master);
    // The grove music makes way, and drifts back in when the tune is over.
    graph.makeWay.gain.setTargetAtTime(0, now, 0.15);
    graph.makeWay.gain.setTargetAtTime(1, now + buffer.duration, 1.2);
    source.start();
    this.tune = source;
    this.played.push(name);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.graph) return;
    this.graph.gate.gain.cancelScheduledValues(this.ctx.currentTime);
    this.graph.gate.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  info(): PlayerInfo {
    return {
      state: this.ctx?.state ?? 'none',
      ready: this.ready,
      level: this.level,
      fetched: { ...this.fetched },
      volume: this.muted ? 0 : 1,
      underwater: this.underwater,
      music: this.music ? this.playing : null,
      loops: [...this.loops.keys()],
      played: [...this.played],
      problems: [...this.problems],
    };
  }
}
