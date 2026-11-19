// The camera that follows the route, and the stick that follows the camera.
// No screen needed: src/view/route-camera.ts has no 3D code.

import { describe, expect, it } from 'vitest';
import { buildLake } from '../src/levels/cocolalla/layout';
import { IDLE, type Input } from '../src/game/game';
import type { Level, Solid } from '../src/game/level';
import { LEVELS } from '../src/levels';
import { cameraFor, followsRoute, forwardOf, placesCamera, stickToLevel, turnToward, wrapDegrees } from '../src/view/route-camera';

const bank = (id: string, x: number, z: number): Solid => ({ id, kind: 'bank', shape: 'round', x, z, halfX: 2, halfZ: 2, top: 0, bottom: -40 });

/** Three sections: away, then across to the right with the camera still, then on with the camera turned west and pulled back. */
const level: Level = {
  name: 'test', solids: [bank('a', 0, 0), bank('b', 0, -20), bank('c', 20, -20), bank('d', 40, -20), bank('e', 40, -40)],
  spawn: { x: 0, y: 0, z: 0 }, leaf: { x: 40, y: 1, z: -44, radius: 0.7 },
  fallY: -6, coyoteTime: 0.1, ledgeHelp: 0.3, hearts: 3, protection: 1, knockback: 1,
  route: ['a', 'b', 'pool', 'c', 'd', 'e'],
  sections: [{ name: 'one', solids: ['a', 'b'] }, { name: 'two', solids: ['c', 'd'], facing: 0 }, { name: 'three', solids: ['e'], facing: 270, pull: 1.5 }],
};

describe('which way the camera faces', () => {
  it('is the facing of the section the hero is heading into', () => {
    expect(cameraFor(level, 'a')).toEqual({ facing: 0, pull: 1 });
    expect(cameraFor(level, 'c')).toEqual({ facing: 0, pull: 1 });
  });

  it('turns on the last solid of a section, before the hero sets out, and keeps that through a swim', () => {
    // 'd' ends section two; the next solid is in section three. A pool in the route is skipped.
    expect(cameraFor(level, 'd')).toEqual({ facing: 270, pull: 1.5 });
    expect(cameraFor(level, 'b')).toEqual({ facing: 0, pull: 1 });
  });

  it('holds its last facing on the final solid, and starts from the first section before the hero has stood anywhere', () => {
    expect(cameraFor(level, 'e')).toEqual({ facing: 270, pull: 1.5 });
    expect(cameraFor(level, null)).toEqual({ facing: 0, pull: 1 });
    expect(cameraFor(level, 'nowhere')).toEqual({ facing: 0, pull: 1 });
  });

  it('is only turned by a level whose sections say so', () => {
    expect(followsRoute(level)).toBe(true);
    expect(followsRoute({ ...level, sections: [{ name: 'one', solids: ['a'] }] })).toBe(false);
    expect(followsRoute({ ...level, sections: undefined })).toBe(false);
  });
});

describe('a solid off the route', () => {
  it('in a section keeps that section’s facing: the lake’s fishing jetty looks north with the pier', () => {
    const lake = buildLake('normal');
    expect(lake.route).not.toContain('jetty');
    expect(cameraFor(lake, 'jetty')).toEqual(cameraFor(lake, 'dock'));
    expect(cameraFor(lake, 'jetty').facing).toBe(0);
    expect(placesCamera(lake, 'jetty')).toBe(true);
  });

  it('in no section says nothing about the camera, so the view leaves it as it is', () => {
    const lake = buildLake('easy');
    const loose = lake.solids.find((solid) => !lake.route.includes(solid.id) && !(lake.sections ?? []).some((section) => section.solids.includes(solid.id)));
    expect(loose).toBeDefined();
    expect(placesCamera(lake, loose!.id)).toBe(false);
    expect(placesCamera(lake, 'dock')).toBe(true);
  });
});

describe('turning', () => {
  it('eases round the short way and settles on the new facing', () => {
    let facing = 0;
    const seen: number[] = [];
    for (let i = 0; i < 240; i += 1) {
      facing = turnToward(facing, 270, 1 / 60);
      seen.push(facing);
    }
    // 0 to 270 is a quarter turn to the left, not three quarters to the right.
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(-90);
    expect(Math.max(...seen)).toBeLessThanOrEqual(0);
    expect(wrapDegrees(facing - 270)).toBeCloseTo(0, 1);
    // No jump: never more than a few degrees in one frame.
    for (let i = 1; i < seen.length; i += 1) expect(Math.abs(seen[i] - seen[i - 1])).toBeLessThan(4);
    // Most of the way round within a second and a half.
    expect(Math.abs(wrapDegrees(seen[89] - 270))).toBeLessThan(5);
  });

  it('stays put when it is already there', () => {
    expect(turnToward(90, 90, 1 / 60)).toBe(90);
    expect(turnToward(-90, 270, 1 / 60)).toBe(-90);
  });
});

describe('the stick follows the camera', () => {
  const up: Input = { moveX: 0, moveZ: -1, jump: true, move: false };
  const right: Input = { moveX: 1, moveZ: 0, jump: false };

  it('changes nothing while the camera looks along -z', () => {
    expect(stickToLevel(up, 0)).toBe(up);
    expect(stickToLevel(IDLE, 270)).toBe(IDLE);
  });

  it('up on the stick is the way the camera looks, whichever way that is', () => {
    for (const facing of [0, 30, 90, 180, 270]) {
      const moved = stickToLevel(up, facing);
      const ahead = forwardOf(facing);
      expect(moved.moveX).toBeCloseTo(ahead.x);
      expect(moved.moveZ).toBeCloseTo(ahead.z);
      expect(moved.jump).toBe(true);
    }
  });

  it('right on the stick is to the right of the picture', () => {
    // Looking west (270), the right of the picture is north: -z.
    const moved = stickToLevel(right, 270);
    expect(moved.moveX).toBeCloseTo(0);
    expect(moved.moveZ).toBeCloseTo(-1);
    // Looking east (90), it is south: +z.
    expect(stickToLevel(right, 90).moveZ).toBeCloseTo(1);
  });

  it('keeps how hard the stick is pushed', () => {
    const moved = stickToLevel({ moveX: 0.3, moveZ: -0.4, jump: false }, 137);
    expect(Math.hypot(moved.moveX, moved.moveZ)).toBeCloseTo(0.5);
  });
});

describe('every level', () => {
  it.each(LEVELS.map((entry) => [entry.id, entry] as const))('%s has a camera facing for every solid of its route', (_id, entry) => {
    const built = entry.build('normal');
    for (const id of built.route) {
      const view = cameraFor(built, id);
      expect(Number.isFinite(view.facing)).toBe(true);
      expect(view.pull).toBeGreaterThan(0);
    }
  });
});
