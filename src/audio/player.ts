// Makes the actual noise, with Web Audio. This is the game's `Speaker` (see
// mix.ts, which decides what may play and when). How the sounds are wired
// together and how loud each group is lives in graph.ts and sounds.ts.
//
// The files are fetched as soon as the page opens, but nothing can be decoded
// or played until the player taps or presses a key: browsers, Safari above
// all, only let sound start from inside a tap or a key press. `wake()` is
// called from every one of those, so sound also comes back after Safari has
// put it to sleep (a phone call, another tab).

import { LIST, Turns, buildMix, loadBuffers, startMusic, strike, type Buffers, type MixGraph } from './graph';
import type { PlayOptions, Speaker } from './mix';
import { gainOf, type SoundName } from './sounds';

declare const __BUILD_ID__: string;

const address = (file: string): string => `${import.meta.env.BASE_URL}media/audio/${file}?v=${__BUILD_ID__}`;

/** What the browser checks can see of the sound. */
export interface PlayerInfo {
  /** 'none' until the first tap or key press, then the browser's own word: 'running', 'suspended'… */
  state: string;
  /** True once every sound is decoded and can play. */
  ready: boolean;
  /** How loud everything is let through: 1, or 0 when muted. */
  volume: number;
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
  private buffers: Buffers = new Map();
  private turns = new Turns(this.buffers);
  private fetched: Promise<void> | null = null;
  private ready = false;

  private muted = false;
  private wantedMusic: SoundName | null = null;
  private music: Running | null = null;
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

  /** Fetches every sound file. Safe to call before any tap: nothing is played or decoded. */
  preload(): Promise<void> {
    this.fetched ??= (async () => {
      const files = new Set<string>();
      for (const def of Object.values(LIST)) if ('files' in def.source) for (const file of def.source.files) files.add(file);
      await Promise.all(
        [...files].map(async (file) => {
          try {
            const response = await fetch(address(file));
            if (!response.ok) throw new Error(String(response.status));
            this.bytes.set(file, await response.arrayBuffer());
          } catch (error) {
            this.problems.push(`${file} did not arrive: ${String(error)}`);
          }
        }),
      );
    })();
    return this.fetched;
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
      this.graph.gate.gain.value = this.muted ? 0 : 1;
      void this.decode(this.ctx);
    }
    if (this.ctx.state !== 'running' && !document.hidden) void this.ctx.resume().catch(() => {});
  }

  private async decode(ctx: AudioContext): Promise<void> {
    await this.preload();
    this.buffers = await loadBuffers(ctx, (file) => this.bytes.get(file), this.problems);
    this.turns = new Turns(this.buffers);
    this.bytes.clear();
    this.ready = true;
    // Whatever was asked for while the sounds were being made ready starts now.
    this.beginMusic();
    for (const [name, volume] of this.wantedLoops) this.applyLoop(name, volume);
  }

  play(name: SoundName, options: PlayOptions): void {
    const { ctx, graph } = this;
    if (!ctx || !graph || !this.ready || ctx.state !== 'running') return;
    if (strike(graph, this.turns, name, options) <= 0) return;
    this.played.push(name);
    if (this.played.length > 60) this.played.shift();
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
    }
    const name = this.wantedMusic;
    const buffer = name ? this.turns.next(name) : undefined;
    if (!name || !buffer) return;
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
      volume: this.muted ? 0 : 1,
      music: this.music ? this.wantedMusic : null,
      loops: [...this.loops.keys()],
      played: [...this.played],
      problems: [...this.problems],
    };
  }
}
