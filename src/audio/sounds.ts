// Every sound and piece of music in the game, in one list: what it is for,
// where it comes from (a recorded file in assets/audio/, or for the mosquito a
// recipe in synth.ts), how loud it is against the others, and which levels it
// belongs to (`home`). Shared sounds are fetched at start-up; a level's own
// when that level is picked.
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
  menu: -20,
};

/** Taking the edge off everything: how far the top end is turned down, and from what pitch. */
export const SOFTEN = { above: 6000, by: -9 };

export type Source = { synth: SynthName } | { files: string[] };

export interface SoundDef {
  /** The heading it goes under on the sound board. */
  group: 'Footsteps' | 'Hero' | 'Water' | 'Fishing' | 'Enemies' | 'World' | 'Menu' | 'Music';
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
  /**
   * The levels this sound belongs to, by their ids in the level list. Its
   * files are fetched when one of those levels is picked, not at start-up.
   * Left out, the sound is shared: every level may play it, and it is fetched
   * at start-up.
   */
  home?: readonly string[];
}

/** Sounds only the Bouncing Grove plays (and the Sandbox, which borrows its enemies, boss and music). */
const GROVE = ['bouncing-grove', 'sandbox'] as const;
/** Sounds only Cocolalla Lake plays. */
const LAKE = ['cocolalla'] as const;
/** Every level that ends with a boss: the grove's chief, the sandbox's practice boss and the lake's monster pike. */
const BOSSES = ['bouncing-grove', 'sandbox', 'cocolalla'] as const;
/** The marmot scout's sounds, for the levels that have one. */
const SCOUTS = ['bouncing-grove', 'sandbox', 'cocolalla'] as const;
/** The creak of wood that is about to move: the grove's tipping logs, and the lake's sinking logs and posts. */
const WOOD = ['bouncing-grove', 'sandbox', 'cocolalla'] as const;
/** Sounds of rope swings, for the levels that hang any. */
const ROPES = ['cocolalla'] as const;
/** Sounds of deep water, for the levels that have any. */
const WATER = ['cocolalla', 'sandbox'] as const;

/**
 * How big the recorded files may be, in bytes: the shared ones together, and
 * each level's own together (`tests/sound-files.test.ts` holds both). Shared
 * sounds are part of every visit's start-up, so keep them small; a level's own
 * are fetched when it is picked.
 */
export const SOUND_LIMITS = { shared: 1024 * 1024, level: 2.5 * 1024 * 1024 } as const;

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
  crocTell: {
    home: LAKE,
    group: 'Enemies', label: "Crocodile's warning", mix: 'cue', level: 0,
    what: 'A deep growl as a crocodile fixes its aim and its eyes sink: its tell before a lunge. The owner picked choice B.',
    source: { files: ['croc-warning.wav'] },
  },
  crocBite: {
    home: LAKE,
    group: 'Enemies', label: "Crocodile's bite", mix: 'cue', level: 0,
    what: 'A quick crunchy chomp as a crocodile lunges. The owner picked choice B.',
    source: { files: ['croc-bite.wav'] },
  },
  crocSplash: {
    home: LAKE,
    group: 'Enemies', label: "Crocodile's splash", mix: 'action', level: 0,
    what: 'A heavy splash as a crocodile comes down after a lunge, and when it is beaten. The owner picked choice A.',
    source: { files: ['croc-splash.wav'] },
  },
  crocHit: {
    home: LAKE,
    group: 'Enemies', label: 'A crocodile is struck', mix: 'cue', level: 0,
    what: 'A dull thump when a hero lands on a crocodile or strikes it. The owner picked choice A.',
    source: { files: ['croc-hit.wav'] },
  },
  marmotTell: {
    home: SCOUTS,
    group: 'Enemies', label: "Marmot scout's warning", mix: 'cue', level: -4,
    what: 'A squeak as the scout rears up with its acorn. A squeaky toy, played a little lower.',
    source: { files: ['marmot-warning.wav'] },
  },
  marmotThrow: {
    home: SCOUTS,
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
  huckleberry: {
    group: 'World', label: 'Picking up a huckleberry', mix: 'action', level: -6, vary: 0.06,
    what: 'A round little drop, like a berry into a pail, each time a hero picks up a huckleberry. The owner picked choice B.',
    source: { files: ['huckleberry.wav'] },
  },
  hiddenLeaf: {
    group: 'World', label: 'Finding a hidden leaf', mix: 'cue', level: 0,
    what: 'A soft chime of a second when a hero finds a hidden leaf. The owner picked choice A.',
    source: { files: ['hidden-leaf.wav'] },
  },
  creak: {
    home: WOOD,
    group: 'World', label: 'Tipping log creak', mix: 'cue', level: -3, vary: 0.06,
    what: 'A slow wooden creak when a hero lands on a tipping log (its tell), and again as it starts to tip. The owner picked choice A. Also the tell of a log or post that sinks, on the lake.',
    source: { files: ['creak.wav'] },
  },
  mossRustle: {
    home: GROVE,
    group: 'World', label: 'Moss about to crumble', mix: 'cue', level: -3, vary: 0.06,
    what: 'A dry rustle the moment a hero lands on crumbling moss: its tell. The owner picked choice B.',
    source: { files: ['moss-rustle.wav'] },
  },
  mossFall: {
    home: GROVE,
    group: 'World', label: 'Moss falling away', mix: 'action', level: 0, vary: 0.05,
    what: 'Wood and bark tumbling as crumbling moss gives way into the mist. The owner picked choice A.',
    source: { files: ['moss-fall.wav'] },
  },
  gust: {
    home: GROVE,
    group: 'World', label: 'Wind before a bough moves', mix: 'cue', level: -3, vary: 0.04,
    what: 'A gust that swells just before a windy bough rises or sinks: its tell. The owner picked choice B.',
    source: { files: ['gust.wav'] },
  },
  ropeGrab: {
    home: ROPES,
    group: 'World', label: 'Taking hold of a rope', mix: 'action', level: 0, vary: 0.06,
    what: 'A short creak of rope and bough taking the weight, the moment a hero grabs a rope swing. The owner\'s pick, A (2026-11-17).',
    source: { files: ['rope-grab.wav'] },
  },
  ropeRelease: {
    home: ROPES,
    group: 'World', label: 'Letting go of a rope', mix: 'action', level: -2, vary: 0.06,
    what: 'A short, quick whoosh as a hero lets go of a rope swing and flies on. The owner\'s pick, B (2026-11-17).',
    source: { files: ['rope-release.wav'] },
  },
  // Fishing: the owner's picks on the sound board, 2026-11-19 (choice A of each).
  fishCast: {
    home: LAKE,
    group: 'Fishing', label: 'Casting', mix: 'action', level: -2, vary: 0.05,
    what: 'A quick swish as the rod whips forward and the lure flies.',
    source: { files: ['fish-cast.wav'] },
  },
  fishReel: {
    home: LAKE,
    group: 'Fishing', label: 'Reeling', mix: 'action', level: -5, loop: true,
    what: 'A fishing reel winding, for as long as the button reels a hooked fish in.',
    source: { files: ['fish-reel.wav'] },
  },
  fishBite: {
    home: LAKE,
    group: 'Fishing', label: 'A bite', mix: 'cue', level: 0,
    what: 'A bloop as the bobber goes under: the moment to press.',
    source: { files: ['fish-bite.wav'] },
  },
  fishSplash: {
    home: LAKE,
    group: 'Fishing', label: "A fish's splash", mix: 'cue', level: 0, vary: 0.06,
    what: 'A hooked fish starts to thrash: the tell to let the line run. Played quietly when the lure lands.',
    source: { files: ['fish-splash.wav'] },
  },
  fishLanded: {
    home: LAKE,
    group: 'Fishing', label: 'A fish is landed', mix: 'action', level: 0,
    what: 'A little prize tune as the fish is held up.',
    source: { files: ['fish-landed.wav'] },
  },
  waterIn: {
    home: WATER,
    group: 'Water', label: 'Going into the water', mix: 'action', level: 0, vary: 0.05,
    what: 'A splash when a hero goes into deep water, louder the higher the drop. The owner picked choice A.',
    source: { files: ['water-in.wav'] },
  },
  stroke: {
    home: WATER,
    group: 'Water', label: 'A swimming stroke', mix: 'step', level: -2, vary: 0.08,
    what: 'A small splash for each stroke while swimming at the surface. The owner picked choice B.',
    source: { files: ['stroke.wav'] },
  },
  surfacing: {
    home: WATER,
    group: 'Water', label: 'Surfacing', mix: 'action', level: -4, vary: 0.05,
    what: "A soft splash when a swimmer's head comes back up. The owner picked choice A.",
    source: { files: ['surfacing.wav'] },
  },
  lapping: {
    home: WATER,
    group: 'Water', label: 'Water lapping', mix: 'step', level: 0, loop: true,
    what: 'Small waves lapping at a shore, round and round, softly while a hero is by or in the water. The owner said OK.',
    source: { files: ['lake-lapping.wav'] },
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
  bossBeaten: {
    home: BOSSES,
    group: 'Enemies', label: 'Boss beaten', mix: 'cue', level: 2,
    what: 'Rising chime notes that ring out over two and a half seconds, the moment a boss is beaten.',
    source: { files: ['boss-beaten.wav'] },
  },
  bossMusic: {
    home: GROVE,
    group: 'Music', label: 'Boss music', mix: 'music', level: 0, loop: true,
    what: 'An orchestral battle theme, 40 seconds round, that takes over from a level\'s own music while a boss fight is on.',
    source: { files: ['boss-music.mp3'] },
  },
  groveMusic: {
    home: GROVE,
    group: 'Music', label: 'Grove music', mix: 'music', level: 0, loop: true,
    what: 'A calm forest track, 1 minute 22 seconds, that goes round without a gap. It sits well under the effects.',
    source: { files: ['grove-music.mp3'] },
  },
  lakeMusic: {
    home: LAKE,
    group: 'Music', label: 'Lake music', mix: 'music', level: 0, loop: true,
    what: "Cocolalla Lake's music: a calm, bright morning tune, 2 minutes 12 seconds, that goes round without a gap. The owner picked B, \"Morning Sky\".",
    source: { files: ['lake-music.mp3'] },
  },
} satisfies Record<string, SoundDef>;

export type SoundName = keyof typeof SOUNDS;

/**
 * The recorded files to fetch: the shared ones (no level given), or one
 * level's own. A file a shared sound uses is shared, whoever else uses it.
 */
export const soundFiles = (levelId: string | null): string[] => {
  const defs = Object.values(SOUNDS) as SoundDef[];
  const filesOf = (def: SoundDef): string[] => ('files' in def.source ? def.source.files : []);
  const shared = new Set(defs.filter((def) => !def.home).flatMap(filesOf));
  if (levelId === null) return [...shared];
  return [...new Set(defs.filter((def) => def.home?.includes(levelId)).flatMap(filesOf))].filter((file) => !shared.has(file));
};

/** True when a level may play this sound: it is shared, or the level is one of its homes. */
export const soundAt = (name: SoundName, levelId: string): boolean => {
  const home = (SOUNDS[name] as SoundDef).home;
  return !home || home.includes(levelId);
};

/**
 * Who a sound is made by, when that changes how it is played. Caputo's
 * footsteps are a cat's: quieter, lighter and with the edge taken off. A boss
 * plays the scout's sounds lower (0.7 of the speed is about six notes down,
 * and that much longer), so it sounds as big as it looks.
 */
export const VOICE = {
  yaarbro: { level: 0, rate: 1, soften: 0 },
  caputo: { level: -6, rate: 1.25, soften: 1500 },
  chief: { level: 0, rate: 0.7, soften: 0 },
} as const;

/** Decibels to the number a volume control takes. */
export const gainOf = (decibels: number): number => 10 ** (decibels / 20);
