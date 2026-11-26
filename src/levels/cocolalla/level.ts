// COCOLALLA LAKE: what this level brings to the game. Players reach it from
// the level picker, after the Bouncing Grove.

import type { LevelEntry } from '../entry';
import { LAKE_BLURB } from './difficulty';
import { LAKE_NAME, buildLake } from './layout';

export const COCOLALLA: LevelEntry = {
  id: 'cocolalla',
  name: LAKE_NAME,
  lead: 'Swim, dive and hop across the lake to the fishing dock.',
  card: 'cards/cocolalla.jpg',
  blurbs: LAKE_BLURB,
  build: (difficulty) => buildLake(difficulty),
  scenery: 'lake',
  // The monster pike stands before the leaf since milestone eleven, part two: times from before it are not ones to beat.
  course: 2,
  music: 'lakeMusic',
};
