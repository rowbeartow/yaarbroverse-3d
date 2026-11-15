// COCOLALLA LAKE: what this level brings to the game. Still being made, so
// `devOnly` keeps it off every screen a player sees until it is ready; it
// opens with `?level=cocolalla`.

import type { LevelEntry } from '../entry';
import { LAKE_BLURB } from './difficulty';
import { LAKE_NAME, buildLake } from './layout';

export const COCOLALLA: LevelEntry = {
  id: 'cocolalla',
  name: LAKE_NAME,
  lead: 'Swim, dive and hop across the lake to the fishing dock.',
  blurbs: LAKE_BLURB,
  build: (difficulty) => buildLake(difficulty),
  scenery: 'lake',
  music: 'groveMusic',
  devOnly: true,
};
