// Every sound and piece of music in the game, in one list: what it is for,
// where it comes from (a recorded file in assets/audio/, or for the mosquito a
// recipe in synth.ts), and how loud it is against the others.
//
// The sound board the owner listens on (tools/preview/sounds.mjs) is built
// from this list, and so is the game's sound. CREDITS.md lists the source and
// license of every recorded file.

import type { SynthName } from './synth';

/**
 * Which group a sound is mixed with.
 *   cue     tells the player something (an enemy's warning, a hit, a checkpoint).
 *           Loudest, and the music dips under it.
 *   effect  what the hero does (jump, land, bounce, roll, pounce).
 *   step    footsteps. Quietest of the effects.
 *   music   sits under everything.
 */
export type Bus = 'cue' | 'effect' | 'step' | 'music';

export type Source = { synth: SynthName } | { files: string[] };

export interface SoundDef {
  /** The heading it goes under on the sound board. */
  group: 'Footsteps' | 'Hero' | 'Enemies' | 'World' | 'Menu' | 'Music';
  label: string;
  /** One line for the sound board: when it plays and what it should sound like. */
  what: string;
  source: Source;
  bus: Bus;
  /** Louder or quieter than the common loudness, in decibels. 6 is about twice as loud. */
  level: number;
  /** Plays round and round until stopped. */
  loop?: boolean;
  /** Each play is a little higher or lower, by up to this share, so repeats do not sound stamped out. */
  vary?: number;
}

export const SOUNDS = {
  stepMoss: {
    group: 'Footsteps', label: 'Step on moss', bus: 'step', level: -9, vary: 0.08,
    what: 'A soft, slightly crunchy step on a mossy bank. Four recordings, played in turn.',
    source: { files: ['step-moss-1.wav', 'step-moss-2.wav', 'step-moss-3.wav', 'step-moss-4.wav'] },
  },
  stepWood: {
    group: 'Footsteps', label: 'Step on wood', bus: 'step', level: -9, vary: 0.08,
    what: 'A dull knock on a log, stump, bough or root shelf. Three recordings, played in turn.',
    source: { files: ['step-wood-1.wav', 'step-wood-2.wav', 'step-wood-3.wav'] },
  },
  stepMushroom: {
    group: 'Footsteps', label: 'Step on a mushroom', bus: 'step', level: -9, vary: 0.1,
    what: 'A soft, damp step on a mushroom cap. A recording of a step in mud.',
    source: { files: ['step-mushroom.wav'] },
  },
  jump: {
    group: 'Hero', label: 'Jump', bus: 'effect', level: -5, vary: 0.06,
    what: 'A light swish of air as the hero leaves the ground.',
    source: { files: ['jump.wav'] },
  },
  land: {
    group: 'Hero', label: 'Landing', bus: 'effect', level: -3, vary: 0.06,
    what: 'A dull thud when the hero touches down.',
    source: { files: ['land.wav'] },
  },
  bounce: {
    group: 'Hero', label: 'Mushroom bounce', bus: 'effect', level: -2, vary: 0.05,
    what: 'A real spring twanging: a short "boing" off a mushroom.',
    source: { files: ['bounce.wav'] },
  },
  roll: {
    group: 'Hero', label: "Yaarbro's roll", bus: 'effect', level: -6, loop: true,
    what: 'A heavy ball rolling, for as long as he rolls. It fades in and out with the roll.',
    source: { files: ['roll.wav'] },
  },
  pounce: {
    group: 'Hero', label: "Caputo's pounce", bus: 'effect', level: -3, vary: 0.05,
    what: 'A heavier swish than the jump as he springs.',
    source: { files: ['pounce.wav'] },
  },
  hit: {
    group: 'Hero', label: 'The hero is hit', bus: 'cue', level: 0,
    what: 'A soft, padded thump when a heart is lost. Clear, not a crash.',
    source: { files: ['hit.wav'] },
  },
  heartsOut: {
    group: 'Hero', label: 'Out of hearts', bus: 'cue', level: 0,
    what: 'Four chime notes going down, before the hero is back on the last safe bank.',
    source: { files: ['hearts-out.wav'] },
  },
  fall: {
    group: 'Hero', label: 'Falling', bus: 'cue', level: -3,
    what: 'A second of rushing wind when the hero drops off the route.',
    source: { files: ['fall.wav'] },
  },
  marmotTell: {
    group: 'Enemies', label: "Marmot scout's warning", bus: 'cue', level: -4,
    what: 'A squeak as the scout rears up with its acorn. A squeaky toy, played a little lower.',
    source: { files: ['marmot-warning.wav'] },
  },
  marmotThrow: {
    group: 'Enemies', label: "Marmot scout's throw", bus: 'cue', level: -3,
    what: 'A quick, short swish as the acorn leaves its paw.',
    source: { files: ['marmot-throw.wav'] },
  },
  mosquitoHover: {
    group: 'Enemies', label: 'Giant mosquito hovering', bus: 'cue', level: -12, loop: true,
    what: 'A thin whine for as long as the mosquito is about, quiet far off and louder close. An extra, not on the list: it is how the mosquito is heard before it is seen. Made in code.',
    source: { synth: 'mosquitoHover' },
  },
  mosquitoTell: {
    group: 'Enemies', label: "Giant mosquito's warning", bus: 'cue', level: -1,
    what: 'The whine climbs and quickens just before it dives. Made in code.',
    source: { synth: 'mosquitoTell' },
  },
  mosquitoDive: {
    group: 'Enemies', label: "Giant mosquito's dive", bus: 'cue', level: -3,
    what: 'The whine swoops down as it dives. Made in code.',
    source: { synth: 'mosquitoDive' },
  },
  strike: {
    group: 'Enemies', label: 'Landing on an enemy', bus: 'cue', level: 0,
    what: 'A short hollow knock, a "bonk", when the hero lands on an enemy or strikes it with a roll or a pounce.',
    source: { files: ['strike.wav'] },
  },
  checkpoint: {
    group: 'World', label: 'Checkpoint', bus: 'cue', level: -1,
    what: 'Three bright chime notes on reaching a safe mossy bank.',
    source: { files: ['checkpoint.wav'] },
  },
  leafTune: {
    group: 'Music', label: 'Golden leaf tune', bus: 'music', level: -4,
    what: 'A ten-second victory fanfare in a bright key when the golden leaf is found. The grove music stops for it.',
    source: { files: ['leaf-tune.mp3'] },
  },
  button: {
    group: 'Menu', label: 'Menu button', bus: 'effect', level: -6,
    what: 'A very short soft click on every button: hero, difficulty, Play, pause, mute.',
    source: { files: ['button.wav'] },
  },
  groveMusic: {
    group: 'Music', label: 'Grove music', bus: 'music', level: -9, loop: true,
    what: 'A calm forest track, 1 minute 22 seconds, that goes round without a gap. It sits well under the effects.',
    source: { files: ['grove-music.mp3'] },
  },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

/** How each hero's footsteps differ. Caputo's are a cat's: quieter, lighter and with the edge taken off. */
export const STEP_VOICE = {
  yaarbro: { level: 0, rate: 1, soften: 0 },
  caputo: { level: -6, rate: 1.25, soften: 1500 },
} as const;

/** Decibels to the number a volume control takes. */
export const gainOf = (decibels: number): number => 10 ** (decibels / 20);
