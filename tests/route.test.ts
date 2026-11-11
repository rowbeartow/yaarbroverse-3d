// The route line the forest is laid out around, and the rule for which
// stretches of scenery are drawn. No screen needed.

import { describe, expect, it } from 'vitest';
import { DIFFICULTIES } from '../src/game/difficulty';
import { buildGrove } from '../src/levels/bouncing-grove/layout';
import { DETAIL_AHEAD, DRAW_AHEAD, DRAW_BEHIND, MIST_FAR, MIST_NEAR, STRETCH, inDetail, inView, routeOf } from '../src/view/route';

describe.each(DIFFICULTIES)('the route line on %s', (difficulty) => {
  const level = buildGrove(difficulty);
  const route = routeOf(level);

  it('runs from the first bank to the last bough', () => {
    expect(route.near).toBeGreaterThan(0);
    expect(route.far).toBeLessThan(-60);
  });

  it('has every solid between its sides', () => {
    for (const s of level.solids) {
      const { left, right } = route.sides(s.z);
      expect(left, s.id).toBeLessThanOrEqual(s.x - s.halfX + 1e-9);
      expect(right, s.id).toBeGreaterThanOrEqual(s.x + s.halfX - 1e-9);
    }
  });

  it('keeps its middle within the sides, and never jumps sideways', () => {
    let last = route.centre(route.near);
    for (let z = route.near; z >= route.far; z -= 0.5) {
      const centre = route.centre(z);
      expect(Math.abs(centre - last)).toBeLessThan(0.5);
      last = centre;
      const xs = level.solids.flatMap((s) => [s.x - s.halfX, s.x + s.halfX]);
      expect(centre).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(centre).toBeLessThanOrEqual(Math.max(...xs));
    }
  });

  it('follows the height of the route', () => {
    const last = level.solids[level.solids.length - 1];
    expect(route.height(route.near)).toBeCloseTo(0, 1);
    expect(route.height(last.z)).toBeGreaterThan(last.top - 3);
  });
});

describe('drawing only what is near', () => {
  it('draws the stretch the hero is in, and the ones just ahead and behind', () => {
    const heroZ = -100;
    expect(inView(heroZ + 10, heroZ - 10, heroZ)).toBe(true);
    expect(inView(heroZ - 20, heroZ - 20 - STRETCH, heroZ)).toBe(true);
    expect(inView(heroZ + 12 + STRETCH, heroZ + 12, heroZ)).toBe(true);
  });

  it('draws everything the mist has not hidden', () => {
    // The camera sits 12 m behind the hero, so the mist closes 12 m short of MIST_FAR ahead of the hero.
    expect(DRAW_AHEAD).toBeGreaterThanOrEqual(MIST_FAR - 12);
    const heroZ = 0;
    expect(inView(-MIST_FAR + 13, -MIST_FAR - 20, heroZ)).toBe(true);
  });

  it('keeps full detail until the mist is more than half closed', () => {
    expect(DETAIL_AHEAD + 12).toBeGreaterThan((MIST_NEAR + MIST_FAR) / 2);
    expect(inDetail(-90, 0)).toBe(true);
    expect(inDetail(-DETAIL_AHEAD - 1, 0)).toBe(false);
  });

  it('leaves out what is past the mist or well behind the camera', () => {
    const heroZ = -100;
    expect(inView(heroZ - DRAW_AHEAD - 1, heroZ - DRAW_AHEAD - 40, heroZ)).toBe(false);
    expect(inView(heroZ + DRAW_BEHIND + 40, heroZ + DRAW_BEHIND + 1, heroZ)).toBe(false);
  });
});
