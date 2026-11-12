// Every sound and piece of music in the game, in one list: what it is for,
// where it comes from (a recorded file in assets/audio/, or for the mosquito a
// recipe in synth.ts), and how loud it is against the others.
//
// The sound board the owner listens on (tools/preview/sounds.mjs) is built
// from this list, and so is the game's sound. CREDITS.md lists the source and
// license of every recorded file.

import type { SynthName } from './synth';

/**
 * Which group a sound is mixed with. Each group has one volume (`MIX` below),
 * and the mixer page (tools/preview/mixer.mjs) has one slider for each.
 *   cue     warnings and hits: tells the player something (an enemy's warning,
 *           a hit, a checkpoint, a fall). The clearest, and the music dips under it.
 *   action  jumps and landings, and the rest of what the hero does (bounce, roll, pounce).
 *   step    footsteps. Well in the background.
 *   menu    button clicks. Well in the background.
 *   music   the bed under everything.
 */
export type Group = 'cue' | 'action' | 'step' | 'menu' | 'music';

/**
 * How loud each group is, and the whole game, in decibels. 0 is the common
 * loudness every short sound is brought to when it loads; minus 6 is about
 * half as loud. These are the numbers the owner sets on the mixer page.
 *
 * These are the owner's own settings, made by ear on the mixer page on
 * 2026-11-12 (his second set). They measure about -41.6 LUFS in normal play
 * (music, footsteps, jumps and landings together), with the music 4.2 decibels
 * under the effects and no peak over -19.2 dB. His ears outrank the earlier
 * aim of -23 LUFS. After changing them, measure again:
 * tools/preview/mix-measure.mjs.
 */
export const MIX: Record<Group | 'master', number> = {
  master: -8,
  music: -21,
  cue: -15,
  action: -26,
  step: -24,
  menu: -12,
};

/** Taking the edge off everything: how far the top end is turned down, and from what pitch. */
export const SOFTEN = { above: 6000, by: -9 };

export type Source = { synth: SynthName } | { files: string[] };

export interface SoundDef {
  /** The heading it goes under on the sound board. */
  group: 'Footsteps' | 'Hero' | 'Enemies' | 'World' | 'Menu' | 'Music';
  label: string;
  /** One line for the sound board: when it plays and what it should sound like. */
  what: string;
  source: Source;
  mix: Group;
  /** Louder or quieter than the rest of its group, in decibels. 6 is about twice as loud. */
  level: number;
  /** Plays round and round until stopped. */
  loop?: boolean;
  /** Each play is a little higher or lower, by up to this share, so repeats do not sound stamped out. */
  vary?: number;
  /** Played twice, this many seconds apart, the second a little quieter: two feet coming down. */
  double?: number;
  /** A made sound played quietly underneath, such as the low thump under a landing. */
  under?: SynthName;
}

export const SOUNDS = {
  stepMoss: {
    group: 'Footsteps', label: 'Step on moss', mix: 'step', level: 0, vary: 0.08,
    what: 'A soft, slightly crunchy step on a mossy bank. Four recordings, played in turn.',
    source: { files: ['step-moss-1.wav', 'step-moss-2.wav', 'step-moss-3.wav', 'step-moss-4.wav'] },
  },
  stepWood: {
    group: 'Footsteps', label: 'Step on wood', mix: 'step', level: 0, vary: 0.08,
    what: 'A dull knock on a log, stump, bough or root shelf. Three recordings, played in turn.',
    source: { files: ['step-wood-1.wav', 'step-wood-2.wav', 'step-wood-3.wav'] },
  },
  stepMushroom: {
    group: 'Footsteps', label: 'Step on a mushroom', mix: 'step', level: 0, vary: 0.1,
    what: 'A small, quick boing on a mushroom cap: the same boing as the bounce, shorter and higher.',
    source: { files: ['step-mushroom.wav'] },
  },
  pushMoss: {
    group: 'Hero', label: 'Jump from moss', mix: 'action', level: -7, vary: 0.08,
    what: 'A quiet push-off: one soft moss footstep as the hero leaves a bank. There is no separate jump sound.',
    source: { files: ['step-moss-1.wav', 'step-moss-2.wav', 'step-moss-3.wav', 'step-moss-4.wav'] },
  },
  pushWood: {
    group: 'Hero', label: 'Jump from wood', mix: 'action', level: -7, vary: 0.08,
    what: 'A quiet push-off: one soft wood footstep as the hero leaves a log, stump, shelf or bough.',
    source: { files: ['step-wood-1.wav', 'step-wood-2.wav', 'step-wood-3.wav'] },
  },
  landMoss: {
    group: 'Hero', label: 'Landing on moss', mix: 'action', level: 0, vary: 0.08, double: 0.07, under: 'thump',
    what: 'Two soft moss footsteps close together, with a low soft thump under them.',
    source: { files: ['step-moss-1.wav', 'step-moss-2.wav', 'step-moss-3.wav', 'step-moss-4.wav'] },
  },
  landWood: {
    group: 'Hero', label: 'Landing on wood', mix: 'action', level: 0, vary: 0.08, double: 0.07, under: 'thump',
    what: 'Two soft wood footsteps close together, with a low soft thump under them.',
    source: { files: ['step-wood-1.wav', 'step-wood-2.wav', 'step-wood-3.wav'] },
  },
  bounce: {
    group: 'Hero', label: 'Mushroom bounce', mix: 'action', level: -1, vary: 0.05,
    what: 'A big springy "boing" off a mushroom.',
    source: { files: ['bounce.wav'] },
  },
  roll: {
    group: 'Hero', label: "Yaarbro's roll", mix: 'action', level: -4, loop: true,
    what: 'A heavy ball rolling, for as long as he rolls. It fades in and out with the roll.',
    source: { files: ['roll.wav'] },
  },
  pounce: {
    group: 'Hero', label: "Caputo's pounce", mix: 'action', level: -2, vary: 0.05,
    what: 'A heavier swish than the jump as he springs.',
    source: { files: ['pounce.wav'] },
  },
  hit: {
    group: 'Hero', label: 'The hero is hit', mix: 'cue', level: 0,
    what: 'A soft, padded thump when a heart is lost. Clear, not a crash.',
    source: { files: ['hit.wav'] },
  },
  heartsOut: {
    group: 'Hero', label: 'Out of hearts', mix: 'cue', level: 0,
    what: 'Four chime notes going down, before the hero is back on the last safe bank.',
    source: { files: ['hearts-out.wav'] },
  },
  fall: {
    group: 'Hero', label: 'Falling', mix: 'cue', level: -3,
    what: 'A second of rushing wind when the hero drops off the route.',
    source: { files: ['fall.wav'] },
  },
  marmotTell: {
    group: 'Enemies', label: "Marmot scout's warning", mix: 'cue', level: -4,
    what: 'A squeak as the scout rears up with its acorn. A squeaky toy, played a little lower.',
    source: { files: ['marmot-warning.wav'] },
  },
  marmotThrow: {
    group: 'Enemies', label: "Marmot scout's throw", mix: 'cue', level: -3,
    what: 'A quick, short swish as the acorn leaves its paw.',
    source: { files: ['marmot-throw.wav'] },
  },
  mosquitoHover: {
    group: 'Enemies', label: 'Giant mosquito hovering', mix: 'cue', level: -12, loop: true,
    what: 'A thin whine for as long as the mosquito is about, quiet far off and louder close. An extra, not on the list: it is how the mosquito is heard before it is seen. Made in code.',
    source: { synth: 'mosquitoHover' },
  },
  mosquitoTell: {
    group: 'Enemies', label: "Giant mosquito's warning", mix: 'cue', level: -1,
    what: 'The whine climbs and quickens just before it dives. Made in code.',
    source: { synth: 'mosquitoTell' },
  },
  mosquitoDive: {
    group: 'Enemies', label: "Giant mosquito's dive", mix: 'cue', level: -3,
    what: 'The whine swoops down as it dives. Made in code.',
    source: { synth: 'mosquitoDive' },
  },
  strike: {
    group: 'Enemies', label: 'Landing on an enemy', mix: 'cue', level: 0,
    what: 'A short hollow knock, a "bonk", when the hero lands on an enemy or strikes it with a roll or a pounce.',
    source: { files: ['strike.wav'] },
  },
  checkpoint: {
    group: 'World', label: 'Checkpoint', mix: 'cue', level: -1,
    what: 'Three bright chime notes on reaching a safe mossy bank.',
    source: { files: ['checkpoint.wav'] },
  },
  leafTune: {
    group: 'Music', label: 'Golden leaf tune', mix: 'music', level: 6,
    what: 'A ten-second victory fanfare in a bright key when the golden leaf is found. The grove music stops for it.',
    source: { files: ['leaf-tune.mp3'] },
  },
  button: {
    group: 'Menu', label: 'Menu button', mix: 'menu', level: 0,
    what: 'A very short soft click on every button: hero, difficulty, Play, pause, mute.',
    source: { files: ['button.wav'] },
  },
  groveMusic: {
    group: 'Music', label: 'Grove music', mix: 'music', level: 0, loop: true,
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
