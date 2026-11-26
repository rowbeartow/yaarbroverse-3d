// What a level brings to the game: its name, its layout and difficulty
// numbers, its scenery and its music. Every level folder exports one of these
// from its `level.ts`, and `src/levels/index.ts` lists them. The game, the
// tests and the bot work from that list, so a new level needs no change
// anywhere else. `docs/adding-a-level.md` has the steps.
//
// No browser or 3D code here: the rule tests read the list.

import type { SoundName } from '../audio/sounds';
import type { Difficulty } from '../game/difficulty';
import type { Level } from '../game/level';

/**
 * The surroundings drawn around a level's solids. Each name has a builder in
 * `SURROUNDINGS` in `src/view/grove-view.ts`.
 *   forest   the misty fir gully of the Bouncing Grove, laid out along the level's route
 *   lake     open water to the Selkirk mountains, a wooded shore on the left and a log boom on the right, laid out from the level's pools
 */
export type SceneryName = 'forest' | 'lake';

export interface LevelEntry {
  /** Short name used in the address bar and in saved progress. Lower case and dashes. Never change it once players have saved progress. */
  id: string;
  /** The name players see. */
  name: string;
  /** One line under the name on the level's card: what the player is after. */
  lead: string;
  /** The picture on the level's card: a small JPEG in `public/cards/`, given as `cards/<id>.jpg`. A development level may leave it out. */
  card?: string;
  /** One short line per difficulty for the start screen. */
  blurbs: Record<Difficulty, string>;
  /** Builds the level for one difficulty, from the numbers in the level's `difficulty.ts`. */
  build(difficulty: Difficulty): Level;
  /** What is drawn around the level. */
  scenery: SceneryName;
  /**
   * The level's course number, when the way to its leaf has changed since it went live (2 for the first change). A
   * player's best time from an older course gives way to their first run on this one (`Best.course` in src/save/players.ts).
   */
  course?: number;
  /** The music that loops while the level is up: a sound from `src/audio/sounds.ts`. */
  music: SoundName;
  /** The music that takes over while the level's boss fight is on, if the level has a boss. Left out: the level's own music plays on. */
  bossMusic?: SoundName;
  /** For development only: never shown to players, and reachable only with `?level=<id>` on the address. */
  devOnly?: boolean;
}
