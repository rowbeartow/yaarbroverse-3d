// Makes the actual noise, with Web Audio. This is the game's `Speaker` (see
// mix.ts, which decides what may play and when).
//
// The files are fetched as soon as the page opens, but nothing can be decoded
// or played until the player taps or presses a key: browsers, Safari above
// all, only let sound start from inside a tap or a key press. `wake()` is
// called from every one of those, so sound also comes back after Safari has
// put it to sleep (a phone call, another tab).
//
// How it is mixed:
//   cues (warnings, hits, checkpoints)  loudest; the music dips under them
//   effects (jump, land, bounce)        under the cues
//   footsteps                           under the effects
//   music                               under everything
// Everything then passes one limiter, so sounds that pile up are held down
// and nothing is ever startling.

import type { PlayOptions, Speaker } from './mix';
import { SOUNDS, STEP_VOICE, gainOf, type SoundDef, type SoundName } from './sounds';
import { evenOut, renderSynth } from './synth';

declare const __BUILD_ID__: string;

const LIST = SOUNDS as Record<SoundName, SoundDef>;
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
  private readonly bytes = new Map<string, ArrayBuffer>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private fetched: Promise<void> | null = null;
  private ready = false;

  private master!: GainNode;
  private musicBus!: GainNode;
  /** Dips the music under a cue. */
  private dip!: GainNode;
  /** Takes the music away for a tune. */
  private makeWay!: GainNode;

  private muted = false;
  private wantedMusic: SoundName | null = null;
  private music: Running | null = null;
  private tune: AudioBufferSourceNode | null = null;
  private readonly wantedLoops = new Map<SoundName, number>();
  private readonly loops = new Map<SoundName, Running>();
  private readonly turn = new Map<SoundName, number>();
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
      this.build(this.ctx);
      void this.decode(this.ctx);
    }
    if (this.ctx.state !== 'running' && !document.hidden) void this.ctx.resume().catch(() => {});
  }

  private build(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    // Everything is lifted a little before the limiter, so quiet devices are loud enough.
    const lift = ctx.createGain();
    lift.gain.value = 1.5;
    this.master.connect(lift).connect(limiter);
    this.musicBus = ctx.createGain();
    this.dip = ctx.createGain();
    this.makeWay = ctx.createGain();
    this.musicBus.connect(this.dip).connect(this.makeWay).connect(this.master);
  }

  private decodeOne(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
    // The older form with callbacks: every Safari has it.
    return new Promise((resolve, reject) => {
      const answer = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
      answer?.catch?.(() => {});
    });
  }

  private async decode(ctx: AudioContext): Promise<void> {
    await this.preload();
    const jobs: Promise<void>[] = [];
    for (const def of Object.values(LIST)) {
      if ('synth' in def.source) {
        const name = def.source.synth;
        jobs.push(
          renderSynth(name)
            .then((buffer) => void this.buffers.set(`synth:${name}`, buffer))
            .catch((error: unknown) => void this.problems.push(`${name} could not be made: ${String(error)}`)),
        );
        continue;
      }
      for (const file of def.source.files) {
        const data = this.bytes.get(file);
        if (!data || this.buffers.has(file)) continue;
        // Short sounds are brought to one common loudness. Music was evened when its file was made.
        const even = def.bus !== 'music';
        jobs.push(
          this.decodeOne(ctx, data.slice(0))
            .then((buffer) => {
              if (even) for (let c = 0; c < buffer.numberOfChannels; c++) evenOut(buffer.getChannelData(c), buffer.sampleRate);
              this.buffers.set(file, buffer);
            })
            .catch((error: unknown) => void this.problems.push(`${file} could not be read: ${String(error)}`)),
        );
      }
    }
    await Promise.all(jobs);
    this.bytes.clear();
    this.ready = true;
    // Whatever was asked for while the sounds were being made ready starts now.
    this.startMusic();
    for (const [name, volume] of this.wantedLoops) this.applyLoop(name, volume);
  }

  private bufferOf(name: SoundName): AudioBuffer | undefined {
    const { source } = LIST[name];
    if ('synth' in source) return this.buffers.get(`synth:${source.synth}`);
    const n = this.turn.get(name) ?? 0;
    this.turn.set(name, n + 1);
    return this.buffers.get(source.files[n % source.files.length]!);
  }

  play(name: SoundName, options: PlayOptions): void {
    const ctx = this.ctx;
    if (!ctx || !this.ready || ctx.state !== 'running') return;
    const def = LIST[name];
    const buffer = this.bufferOf(name);
    if (!buffer) return;
    const voice = options.voice ? STEP_VOICE[options.voice] : STEP_VOICE.yaarbro;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = voice.rate * (1 + (Math.random() * 2 - 1) * (def.vary ?? 0));
    const gain = ctx.createGain();
    gain.gain.value = gainOf(def.level + voice.level) * (options.volume ?? 1);
    let node: AudioNode = source;
    if (voice.soften) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = voice.soften;
      node = source.connect(filter);
    }
    node.connect(gain).connect(this.master);
    if (def.bus === 'cue') {
      // The music steps back for as long as the cue lasts, then comes forward again.
      const now = ctx.currentTime;
      this.dip.gain.cancelScheduledValues(now);
      this.dip.gain.setTargetAtTime(0.4, now, 0.03);
      this.dip.gain.setTargetAtTime(1, now + buffer.duration + 0.1, 0.25);
    }
    source.start();
    this.played.push(name);
    if (this.played.length > 60) this.played.shift();
  }

  setLoop(name: SoundName, volume: number): void {
    this.wantedLoops.set(name, volume);
    if (this.ready) this.applyLoop(name, volume);
  }

  private applyLoop(name: SoundName, volume: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
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
      const buffer = this.bufferOf(name);
      if (!buffer) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(this.master);
      source.start();
      running = { source, gain };
      this.loops.set(name, running);
    }
    running.gain.gain.setTargetAtTime(gainOf(LIST[name].level) * volume, now, 0.08);
  }

  setMusic(name: SoundName | null): void {
    this.wantedMusic = name;
    if (this.ready) this.startMusic();
  }

  private startMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (this.music) {
      this.music.gain.gain.setTargetAtTime(0, now, 0.3);
      this.music.source.stop(now + 2);
      this.music = null;
    }
    const name = this.wantedMusic;
    const buffer = name ? this.bufferOf(name) : undefined;
    if (!name || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // An MP3 has a moment of silence at each end. Looping between the first and
    // last sounding moments keeps the join from being a gap.
    const [from, to] = soundingPart(buffer);
    source.loopStart = from;
    source.loopEnd = to;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(gainOf(LIST[name].level), now, 0.8);
    source.connect(gain).connect(this.musicBus);
    source.start(0, from);
    this.music = { source, gain };
  }

  playTune(name: SoundName | null): void {
    const ctx = this.ctx;
    if (!ctx || !this.ready) return;
    const now = ctx.currentTime;
    if (this.tune) {
      try {
        this.tune.stop();
      } catch {
        // Already over.
      }
      this.tune = null;
    }
    this.makeWay.gain.cancelScheduledValues(now);
    if (!name || ctx.state !== 'running') {
      this.makeWay.gain.setTargetAtTime(1, now, 0.4);
      return;
    }
    const buffer = this.bufferOf(name);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainOf(LIST[name].level);
    source.connect(gain).connect(this.master);
    // The grove music makes way, and drifts back in when the tune is over.
    this.makeWay.gain.setTargetAtTime(0, now, 0.15);
    this.makeWay.gain.setTargetAtTime(1, now + buffer.duration, 1.2);
    source.start();
    this.tune = source;
    this.played.push(name);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
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

/** The seconds at which a buffer first and last makes a sound. */
const soundingPart = (buffer: AudioBuffer): [number, number] => {
  const data = buffer.getChannelData(0);
  const quiet = 0.002;
  let first = 0;
  while (first < data.length && Math.abs(data[first]!) < quiet) first += 1;
  let last = data.length - 1;
  while (last > first && Math.abs(data[last]!) < quiet) last -= 1;
  if (last - first < buffer.sampleRate) return [0, buffer.duration];
  return [first / buffer.sampleRate, (last + 1) / buffer.sampleRate];
};
