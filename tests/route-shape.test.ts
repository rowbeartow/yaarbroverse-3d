// THE ROUTE RULE: routes turn (the owner's rule, 2026-11-15). Every level on
// the level picker has to meet it. `src/game/route-shape.ts` says how a route
// is measured. To print every level's numbers:
//   ROUTE_SHAPE=1 npx vitest run tests/route-shape.test.ts --silent=false

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import type { Level, Section, Solid } from '../src/game/level';
import { ROUTE_RULE, routeFaults, routeShape } from '../src/game/route-shape';
import { LEVELS } from '../src/levels';

/**
 * Levels built before the rule, waiting to be reshaped. Cocolalla Lake was
 * reshaped in milestone nine; the Bouncing Grove waits for a later milestone.
 * Take a level's line out when it is reshaped. Never add one.
 */
const WAITING = ['bouncing-grove'];

/** A level that is only a line of small banks through the given corners, each stretch with its camera facing. */
const through = (corners: [number, number][], facings: number[] = []): Level => {
  const solids: Solid[] = [];
  const sections: Section[] = [];
  corners.forEach(([x, z], i) => {
    solids.push({ id: `b${i}`, kind: 'bank', shape: 'round', x, z, halfX: 1, halfZ: 1, top: 0, bottom: -40 });
    sections.push({ name: `s${i}`, solids: [`b${i}`], facing: facings[i] ?? 0 });
  });
  const [lastX, lastZ] = corners[corners.length - 1];
  return {
    name: 'test', solids, spawn: { x: corners[0][0], y: 0, z: corners[0][1] }, leaf: { x: lastX, y: 1, z: lastZ, radius: 0.7 },
    fallY: -6, coyoteTime: 0.1, ledgeHelp: 0.3, hearts: 3, protection: 1, knockback: 1, route: solids.map((s) => s.id), sections,
  };
};

describe('measuring a route', () => {
  it('a straight line away from the camera is all "away", with no turns', () => {
    const shape = routeShape(through([[0, 0], [0, -50], [0, -100]]));
    expect(shape.length).toBeCloseTo(100);
    expect(shape.away).toBeCloseTo(1);
    expect(shape.turns).toBe(0);
    expect(routeFaults(shape).length).toBeGreaterThan(0);
  });

  it('sorts each stretch by which way it runs on the screen', () => {
    // 40 m away, 30 m right, 20 m back toward the camera, 10 m left.
    const shape = routeShape(through([[0, 0], [0, -40], [30, -40], [30, -20], [20, -20]]));
    expect(shape.length).toBeCloseTo(100);
    expect(shape.away).toBeCloseTo(0.4);
    expect(shape.right).toBeCloseTo(0.3);
    expect(shape.toward).toBeCloseTo(0.2);
    expect(shape.left).toBeCloseTo(0.1);
    expect(shape.turns).toBe(3);
    expect(shape.turnsPer100).toBeCloseTo(3);
  });

  it('a camera that turns with the route changes what is "away"', () => {
    // The same line, with the camera turned to face along the second stretch from its start.
    const shape = routeShape(through([[0, 0], [0, -40], [30, -40]], [0, 0, 90]));
    expect(shape.away).toBeCloseTo(1);
    expect(shape.cameraTurns).toBe(1);
  });

  it('a long curve counts as a turn, the same as a sharp corner', () => {
    // A quarter circle in six easy steps of 15 degrees: no one step is a turn, the whole of it is.
    const corners: [number, number][] = [[0, 0], [0, -30]];
    for (let i = 1; i <= 6; i += 1) {
      const angle = (i * 15 * Math.PI) / 180;
      corners.push([30 - 30 * Math.cos(angle), -30 - 30 * Math.sin(angle)]);
    }
    corners.push([60, -60]);
    expect(routeShape(through(corners)).turns).toBeGreaterThanOrEqual(1);
  });

  it('where the camera turns part-way along a straight stretch, each part counts under its own facing', () => {
    // 60 m straight on: the first 30 with the camera behind, the last 30 with it turned to look from the side.
    const shape = routeShape(through([[0, 0], [0, -30], [0, -60]], [0, 0, 90]));
    expect(shape.away).toBeCloseTo(0.5);
    expect(shape.left).toBeCloseTo(0.5);
    expect(shape.cameraTurns).toBe(1);
  });

  it('small wiggles are not turns', () => {
    const corners: [number, number][] = [];
    for (let i = 0; i <= 20; i += 1) corners.push([i % 2 === 0 ? -0.6 : 0.6, -i * 4]);
    const shape = routeShape(through(corners));
    expect(shape.turns).toBe(0);
    expect(shape.away).toBeCloseTo(1);
  });

  it('a route that winds, switches back and has a camera that turns meets the rule', () => {
    const shape = routeShape(through([[0, 0], [0, -30], [25, -30], [25, -10], [45, -10], [45, -40], [20, -55]], [0, 0, 0, 0, 90, 90, 200]));
    expect(routeFaults(shape)).toEqual([]);
  });
});

describe('the route rule', () => {
  const listed = LEVELS.filter((entry) => !entry.devOnly);

  it.each(listed.filter((entry) => !WAITING.includes(entry.id)).flatMap((entry) => DIFFICULTIES.map((difficulty) => [entry.name, difficulty, entry] as const)))(
    '%s on %s turns enough',
    (_name, difficulty, entry) => {
      expect(routeFaults(routeShape(entry.build(difficulty)))).toEqual([]);
    },
  );

  it('a level waiting to be reshaped really does fall short, so the waiting list cannot go stale', () => {
    for (const id of WAITING) {
      const entry = LEVELS.find((level) => level.id === id);
      expect(entry, id).toBeDefined();
      expect(routeFaults(routeShape(entry!.build('normal'))).length, id).toBeGreaterThan(0);
    }
  });

  it('prints the numbers when asked', () => {
    if (!process.env.ROUTE_SHAPE) return;
    const percent = (share: number): string => `${Math.round(share * 100)}%`.padStart(4);
    console.log(`The rule: away at most ${percent(ROUTE_RULE.mostAway)}, left and right at least ${percent(ROUTE_RULE.leastEachSide)} each, toward at least ${percent(ROUTE_RULE.leastToward)}, ${ROUTE_RULE.leastTurnsPer100} turns per 100 m, the camera turns at least ${ROUTE_RULE.leastCameraTurns} times.`);
    for (const entry of listed) {
      for (const difficulty of DIFFICULTIES) {
        const s = routeShape(entry.build(difficulty));
        console.log(`${entry.name.padEnd(18)} ${difficulty.padEnd(7)} ${s.length.toFixed(0).padStart(4)} m  away ${percent(s.away)}  left ${percent(s.left)}  right ${percent(s.right)}  toward ${percent(s.toward)}  turns ${String(s.turns).padStart(2)} (${s.turnsPer100.toFixed(1)} per 100 m)  camera turns ${s.cameraTurns}`);
      }
    }
  });
});
