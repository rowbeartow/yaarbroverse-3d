// THE BOUNCING GROVE: what this level brings to the game. The level list
// (`src/levels/index.ts`) reads this.

import type { LevelEntry } from '../entry';
import { GROVE_BLURB } from './difficulty';
import { GROVE_NAME, buildGrove } from './layout';

export const BOUNCING_GROVE: LevelEntry = {
  id: 'bouncing-grove',
  name: GROVE_NAME,
  lead: 'Find the golden leaf, tucked in the canopy.',
  card: 'cards/bouncing-grove.jpg',
  blurbs: GROVE_BLURB,
  build: (difficulty) => buildGrove(difficulty),
  scenery: 'forest',
  music: 'groveMusic',
};
