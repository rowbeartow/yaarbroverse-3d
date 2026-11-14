// The part of sound that decides, with no browser code in it so the rule
// tests can run it: whether sound may play yet, whether it is muted, and what
// is remembered between visits.
//
// Browsers block sound until the player has tapped or pressed a key, so
// nothing is sent to the speakers before `unlock()`. Music and looping sounds
// asked for early are remembered and begin the moment sound is unlocked.
//
// The thing that actually makes noise is a `Speaker` (player.ts in the game, a
// stand-in in the tests).

import type { SoundName } from './sounds';

/** How one play of a sound differs from the plain sound. */
export interface PlayOptions {
  /** Louder or quieter, as a share: 1 is as listed, 0.5 is half. Used for distance. */
  volume?: number;
  /** Who makes it. Caputo's footsteps are lighter and softer; a boss's sounds are lower. */
  voice?: 'yaarbro' | 'caputo' | 'chief';
}

/** What makes the noise. Every call may be made any number of times. */
export interface Speaker {
  /** Called on a tap or a key press: the only moment a browser lets sound begin or come back. */
  wake(): void;
  play(name: SoundName, options: PlayOptions): void;
  /** A looping sound: 0 is silent and stopped. */
  setLoop(name: SoundName, volume: number): void;
  /** The music to play round and round, or null for none. */
  setMusic(name: SoundName | null): void;
  /** A tune played once. The music makes way for it and comes back after. */
  /** Null stops a tune that is playing and brings the music back. */
  playTune(name: SoundName | null): void;
  setMuted(muted: boolean): void;
  /** Underwater: everything muffled. Left out by a speaker that cannot do it. */
  setUnderwater?(under: boolean): void;
}

/** Where the mute choice is kept: the browser's own storage, or a stand-in. */
export interface Memory {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MUTE_KEY = 'yaarbroverse-3d:muted';

export class Sound {
  /** True once the player has tapped or pressed a key. */
  unlocked = false;
  muted: boolean;
  /** Called whenever mute changes, to redraw the button. */
  onMute: (muted: boolean) => void = () => {};

  private music: SoundName | null = null;
  private readonly loops = new Map<SoundName, number>();

  constructor(
    private readonly speaker: Speaker,
    private readonly memory: Memory | null,
  ) {
    this.muted = this.remembered();
  }

  private remembered(): boolean {
    try {
      return this.memory?.getItem(MUTE_KEY) === 'yes';
    } catch {
      // Storage can be switched off (private windows): start with sound on.
      return false;
    }
  }

  /** The first tap or key press. Later ones wake the speaker again, in case the browser put it to sleep. */
  unlock(): void {
    this.speaker.wake();
    if (this.unlocked) return;
    this.unlocked = true;
    this.speaker.setMuted(this.muted);
    this.speaker.setMusic(this.music);
    for (const [name, volume] of this.loops) this.speaker.setLoop(name, volume);
  }

  /** Plays a sound once. Nothing happens before the first tap or key press, or while muted. */
  play(name: SoundName, options: PlayOptions = {}): void {
    if (!this.unlocked || this.muted) return;
    if (options.volume !== undefined && options.volume <= 0) return;
    this.speaker.play(name, options);
  }

  setLoop(name: SoundName, volume: number): void {
    const level = Math.max(0, Math.min(1, volume));
    if ((this.loops.get(name) ?? 0) === level) return;
    this.loops.set(name, level);
    if (this.unlocked) this.speaker.setLoop(name, level);
  }

  /** Stops every looping sound: the game is paused, over, or starting again. */
  stopLoops(): void {
    for (const name of this.loops.keys()) this.setLoop(name, 0);
  }

  /** The music asked for now, whether or not it can be heard yet. */
  get musicName(): SoundName | null {
    return this.music;
  }

  setMusic(name: SoundName | null): void {
    if (this.music === name) return;
    this.music = name;
    if (this.unlocked) this.speaker.setMusic(name);
  }

  playTune(name: SoundName): void {
    if (!this.unlocked || this.muted) return;
    this.speaker.playTune(name);
  }

  /** Cuts a tune short: the player has moved on. */
  endTune(): void {
    if (this.unlocked) this.speaker.playTune(null);
  }

  /** True while the hero's head is underwater: the whole mix is muffled. */
  underwater = false;

  /** Muffles everything while the hero's head is underwater, and clears it at the surface. */
  setUnderwater(under: boolean): void {
    if (under === this.underwater) return;
    this.underwater = under;
    this.speaker.setUnderwater?.(under);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      this.memory?.setItem(MUTE_KEY, muted ? 'yes' : 'no');
    } catch {
      // Not remembered this time. Mute still works for this visit.
    }
    if (this.unlocked) this.speaker.setMuted(muted);
    this.onMute(muted);
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }
}
