// The lake's jump assist numbers, for tests that build their own small levels.

import type { JumpAssist } from '../../src/game/assist';
import type { Difficulty } from '../../src/game/difficulty';
import { LAKE_DIFFICULTY } from '../../src/levels/cocolalla/difficulty';

export const JUMP_ASSIST_FOR_TESTS: Record<Difficulty, JumpAssist | undefined> = {
  easy: LAKE_DIFFICULTY.easy.jumpAssist,
  normal: LAKE_DIFFICULTY.normal.jumpAssist,
  hard: LAKE_DIFFICULTY.hard.jumpAssist,
};
