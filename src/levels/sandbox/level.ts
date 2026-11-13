// THE SANDBOX: what this level brings to the game. Development only: it is in
// the level list so the tests and the bot run over it, and `devOnly` keeps it
// off every screen a player sees.

import type { LevelEntry } from '../entry';
import { SANDBOX_BLURB } from './difficulty';
import { SANDBOX_NAME, buildSandbox } from './layout';

export const SANDBOX: LevelEntry = {
  id: 'sandbox',
  name: SANDBOX_NAME,
  lead: 'A tiny level for trying things out.',
  blurbs: SANDBOX_BLURB,
  build: (difficulty) => buildSandbox(difficulty),
  scenery: 'forest',
  music: 'groveMusic',
  bossMusic: 'bossMusic',
  devOnly: true,
};
