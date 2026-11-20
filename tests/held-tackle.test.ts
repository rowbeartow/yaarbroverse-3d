// Where the things a hero holds while fishing go (src/view/held-tackle.ts):
// the rod at the grip point in his right palm, and a landed fish across both
// palms. No screen needed. Every frame of his real clips is measured against
// his real skin by tools/preview/fishing-measure.mjs, on the preview page.

import { readFileSync } from 'node:fs';
import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HERO_MODELS } from '../src/view/hero-model';
import { GAME_UNIT, HELD_AT_LEAST, ROD, flankAt, heldSize, lieAcross, lineBetween, readHands, reelOn, rodFalling, rodLine, type Grips } from '../src/view/held-tackle';

/** A fish as a plain box about its middle: 1 long (z), 0.3 tall (y), 0.1 thick (x), three points a triangle. */
const boxFish = (): Vector3[] => {
  const corner = (x: number, y: number, z: number): Vector3 => new Vector3(x * 0.05, y * 0.15, z * 0.5);
  const skin: Vector3[] = [];
  for (const x of [-1, 1]) skin.push(corner(x, -1, -1), corner(x, 1, -1), corner(x, 1, 1), corner(x, -1, -1), corner(x, 1, 1), corner(x, -1, 1));
  return skin;
};

/** How far a point is from a line of points. */
const fromLine = (point: Vector3, line: Vector3[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i += 1) {
    const span = line[i + 1].clone().sub(line[i]);
    const t = Math.max(0, Math.min(1, point.clone().sub(line[i]).dot(span) / span.lengthSq()));
    best = Math.min(best, line[i].clone().addScaledVector(span, t).distanceTo(point));
  }
  return best;
};

describe('the grip points in his palms', () => {
  it('are the same in the game as in his guide file, which his clips are made from', () => {
    const guide = JSON.parse(readFileSync('tools/yaarbro.guide.json', 'utf8')) as { grips: Grips };
    expect(HERO_MODELS.Yaarbro.fishing?.grips).toEqual(guide.grips);
  });

  it('are read from his hand bones wherever they are', () => {
    const grips = HERO_MODELS.Yaarbro.fishing!.grips;
    const right = new Object3D();
    const left = new Object3D();
    right.position.set(1, 2, 3);
    right.scale.setScalar(0.01);
    left.position.set(-1, 2, 3);
    left.scale.setScalar(0.01);
    right.updateMatrixWorld(true);
    left.updateMatrixWorld(true);
    const hands = readHands(grips, right, left, 1);
    expect(hands.gripRight.distanceTo(new Vector3(1 + grips.right.at[0] / 100, 2 + grips.right.at[1] / 100, 3 + grips.right.at[2] / 100))).toBeLessThan(1e-9);
    // The rod's middle is its own thickness off the skin of his palm, and its reel hangs square to it.
    expect(hands.from.distanceTo(hands.gripRight)).toBeCloseTo(ROD.thick, 6);
    expect(Math.abs(hands.side.dot(hands.along))).toBeLessThan(1e-9);
  });
});

describe('the rod', () => {
  const from = new Vector3(0.2, 1.1, 0.4);
  const along = new Vector3(0, 0.4, 1).normalize();

  it('runs through the point in his palm, a little of it behind his hand', () => {
    const rod = rodLine(from, along, null, 0, GAME_UNIT);
    expect(fromLine(from, rod)).toBeLessThan(1e-9);
    expect(rod[0].distanceTo(from)).toBeCloseTo(ROD.behind * GAME_UNIT, 6);
    expect(rod[rod.length - 1].distanceTo(rod[0])).toBeCloseTo(ROD.long * GAME_UNIT, 6);
  });

  it('stays straight through both his hands when a fish bends it, and bends toward the fish beyond them', () => {
    const fish = new Vector3(0.2, 0, 6);
    const straight = rodLine(from, along, null, 0, GAME_UNIT);
    const bent = rodLine(from, along, fish, 1, GAME_UNIT);
    for (let i = 0; i <= 8; i += 1) expect(bent[i].distanceTo(straight[i])).toBeLessThan(1e-9);
    const tip = bent[bent.length - 1];
    expect(tip.y).toBeLessThan(straight[straight.length - 1].y - 0.2);
    expect(tip.distanceTo(fish)).toBeLessThan(straight[straight.length - 1].distanceTo(fish));
  });

  it('has its reel under it, facing sideways', () => {
    const side = new Vector3(0, -1, 0).addScaledVector(along, along.y).normalize();
    const reel = reelOn({ from, along, side }, GAME_UNIT);
    expect(reel.centre.y).toBeLessThan(from.y + along.y * ROD.reelAt * GAME_UNIT);
    expect(Math.abs(reel.axle.y)).toBeLessThan(1e-9);
    expect(Math.abs(reel.axle.dot(along))).toBeLessThan(1e-9);
  });

  it('falls from where his hand left it to where it lies', () => {
    const letGo = { from, along, side: new Vector3(1, 0, 0) };
    const lying = { from: new Vector3(1, 0.03, 0.9), along: new Vector3(0, 0, 1), side: new Vector3(1, 0, 0) };
    expect(rodFalling(letGo, lying, 0).from.distanceTo(from)).toBeLessThan(1e-9);
    const down = rodFalling(letGo, lying, 1);
    expect(down.from.distanceTo(lying.from)).toBeLessThan(1e-9);
    expect(down.along.distanceTo(lying.along)).toBeLessThan(1e-9);
  });

  it('has a line that hangs between its ends', () => {
    const line = lineBetween(new Vector3(0, 2, 0), new Vector3(0, 2, 4), 0.5, 1);
    expect(line[0].y).toBe(2);
    expect(line[line.length - 1].y).toBe(2);
    expect(Math.min(...line.map((point) => point.y))).toBeCloseTo(1.5, 2);
  });
});

describe('a landed fish', () => {
  const skin = boxFish();

  it('is never drawn shorter than reaches across both his palms', () => {
    expect(heldSize(12, 1, 1)).toBeCloseTo(HELD_AT_LEAST, 6);
    expect(heldSize(110, 1, 1)).toBeGreaterThan(2.8);
    expect(heldSize(40, 2, 1)).toBeCloseTo(heldSize(40, 1, 1) / 2, 6);
  });

  it('lies on its side, flat underneath', () => {
    expect(flankAt(skin, 1, 0, 1)).toBeCloseTo(-0.05, 6);
    expect(flankAt(skin, 1, 0.3, 2)).toBeCloseTo(-0.1, 6);
  });

  it('lies across his palms with its flank on the grip point of each, nose to his right', () => {
    const gripRight = new Vector3(-0.2, 2.3, 0.4);
    const gripLeft = new Vector3(0.2, 2.34, 0.4);
    const size = 0.9;
    const lying = lieAcross(skin, 1, gripRight, gripLeft, size);
    const placed = (point: Vector3): Vector3 => point.clone().multiplyScalar(size).applyQuaternion(lying.turn).add(lying.position);
    // The underside of the box, straight under its middle line, is at x = -0.05: that is what rests on each palm.
    const apart = gripRight.distanceTo(gripLeft);
    expect(placed(new Vector3(-0.05, 0, apart / 2 / size)).distanceTo(gripRight)).toBeLessThan(1e-6);
    expect(placed(new Vector3(-0.05, 0, -apart / 2 / size)).distanceTo(gripLeft)).toBeLessThan(1e-6);
    // Its middle is above his palms, and its nose is on his right.
    expect(lying.position.y).toBeGreaterThan(2.3);
    expect(placed(new Vector3(0, 0, 0.5)).x).toBeLessThan(gripRight.x);
  });
});
