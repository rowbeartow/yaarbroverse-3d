// No stretch of water is a trap (the owner's rule, 2026-11-19): wherever a
// hero falls in along the route, there is a way out, by climbing onto
// something or swimming back to land. Run over every level in the list, on
// every difficulty, as each hero. `tests/helpers/water-exit.ts` has the
// swimmer; `docs/adding-a-level.md` has the rule.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { HEROES } from '../src/game/hero';
import { LEVELS } from '../src/levels';
import { waterAt } from '../src/game/swim';
import { EXIT_WITHIN, dropPoints, escapeFrom, exitsOf } from './helpers/water-exit';

// Hundreds of short swims a level, so this file is a bot run: its tests have the long time limit in tests/bot-runs.ts.

describe('every stretch of water has a way out', () => {
  for (const entry of LEVELS) {
    for (const difficulty of DIFFICULTIES) {
      const level = entry.build(difficulty);
      if (!level.water?.length) continue;

      it(`${entry.id} on ${difficulty}: every pool has something to get out onto`, () => {
        for (const pool of level.water!) expect(exitsOf(level, pool).map((s) => s.id), pool.id).not.toEqual([]);
      });

      for (const hero of HEROES) {
        it(`${entry.id} on ${difficulty} as ${hero}: dropped in anywhere along the route, the hero gets back out`, () => {
          const points = dropPoints(level);
          expect(points.length).toBeGreaterThan(5);
          // Water the route itself swims across may be as long as the swim. Anywhere else a way out is close by.
          const within = (point: { x: number; z: number }): number => (level.route.includes(waterAt(level.water, point.x, point.z)!.id) ? Infinity : EXIT_WITHIN);
          const stuck = points.filter((point) => escapeFrom(level, difficulty, hero, point, 45, within(point)) === null).map((point) => `${point.near} at ${point.x.toFixed(0)}, ${point.z.toFixed(0)}`);
          expect(stuck).toEqual([]);
        });
      }

      // The water half of a monster pike's fight (src/game/pike.ts): the hero is thrown into it, off the route.
      const { pike } = level;
      if (pike) {
        it(`${entry.id} on ${difficulty}: the water the monster pike drags a hero into has a way out close by, wherever they are in it`, () => {
          const log = level.solids.find((s) => s.id === pike.log)!;
          const points = [{ ...pike.landAt, near: 'where the drag lands' }];
          // All round its circle, and all round the floating log.
          for (let i = 0; i < 8; i += 1) {
            const angle = (i * Math.PI) / 4;
            points.push({ x: pike.home.x + Math.cos(angle) * pike.circle, z: pike.home.z + Math.sin(angle) * pike.circle, near: 'its circle' });
            points.push({ x: log.x + Math.cos(angle) * (log.halfX + 3), z: log.z + Math.sin(angle) * (log.halfZ + 3), near: 'the floating log' });
          }
          for (const point of points) expect(waterAt(level.water, point.x, point.z)?.id, point.near).toBe(pike.water);
          const stuck = HEROES.flatMap((hero) => points.filter((point) => escapeFrom(level, difficulty, hero, point, 45, EXIT_WITHIN) === null).map((point) => `${hero}: ${point.near} at ${point.x.toFixed(0)}, ${point.z.toFixed(0)}`));
          expect(stuck).toEqual([]);
        });
      }
    }
  }
});
