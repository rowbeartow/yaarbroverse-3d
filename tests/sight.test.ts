// Which enemies are drawn (src/view/sight.ts): the lake's margin under 60
// frames a second depends on it, so its numbers and the rule are held here.

import { describe, expect, it } from 'vitest';
import { ENEMY_MODELS, modelFileFor, modelFilesOf } from '../src/view/enemies';
import { SEEN_WITHIN, enemiesInSight } from '../src/view/sight';
import { LEVELS } from '../src/levels';
import { DIFFICULTIES } from '../src/game/difficulty';

const hero = { x: 0, z: 0 };
const row = (count: number, step: number) => Array.from({ length: count }, (_, i) => ({ x: 0, z: -(i + 1) * step }));

describe('which enemies are drawn', () => {
  it('without numbers of its own, a level draws every enemy within the mist along the route', () => {
    const seen = enemiesInSight([{ x: 500, z: -10 }, { x: 0, z: -(SEEN_WITHIN + 1) }], hero, undefined);
    expect(seen).toEqual([true, false]);
  });

  it('with numbers, only enemies within the distance are drawn, measured flat in every direction', () => {
    const seen = enemiesInSight([{ x: 30, z: -30 }, { x: 0, z: -44 }, { x: 46, z: 0 }], hero, { within: 45, most: 9 });
    expect(seen).toEqual([true, true, false]);
  });

  it('never draws more than the most, and keeps the nearest', () => {
    const seen = enemiesInSight(row(8, 5), hero, { within: 45, most: 3 });
    expect(seen).toEqual([true, true, true, false, false, false, false, false]);
  });

  it('always draws an enemy that is warning or attacking, if it is within the distance', () => {
    const busy = [false, false, false, false, true, false, false, false, false, true];
    const seen = enemiesInSight(row(10, 5), hero, { within: 45, most: 2 }, busy);
    // The fifth is busy and near enough; the tenth is busy but 50 m off.
    expect(seen).toEqual([true, true, false, false, true, false, false, false, false, false]);
  });

  it('the answer does not depend on the order of two enemies equally far off', () => {
    const seen = enemiesInSight([{ x: 5, z: 0 }, { x: -5, z: 0 }, { x: 0, z: 5 }], hero, { within: 45, most: 2 });
    expect(seen).toEqual([true, true, false]);
  });
});

describe("the lake's drawing budget", () => {
  const lake = LEVELS.find((entry) => entry.id === 'cocolalla')!;

  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: draws at most six enemies at once, from the lighter mosquito`, () => {
      const level = lake.build(difficulty);
      expect(level.enemySight).toEqual({ within: 45, most: 6 });
      expect(modelFileFor('mosquito', level)).toBe('mosquito-light.glb');
      // An enemy with no lighter model keeps its own.
      expect(modelFileFor('crocodile', level)).toBe(ENEMY_MODELS.crocodile.file);
      if (level.enemies?.some((spot) => spot.kind === 'mosquito')) expect(modelFilesOf(level)).not.toContain('mosquito.glb');
    });
  }

  it('the grove keeps the full mosquito, for its own enemies and its boss', () => {
    const grove = LEVELS.find((entry) => entry.id === 'bouncing-grove')!.build('hard');
    expect(grove.lightEnemies).toBeUndefined();
    expect(modelFilesOf(grove)).toEqual(expect.arrayContaining(['marmot.glb', 'mosquito.glb']));
  });
});
