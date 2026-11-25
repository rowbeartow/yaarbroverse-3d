// Where the things a hero holds while fishing go (src/view/held-tackle.ts):
// the rod at the grip point in his right palm, and a landed fish across both
// palms. No screen needed. Every frame of his real clips is measured against
// his real skin by tools/preview/fishing-measure.mjs, on the preview page.

import { readFileSync } from 'node:fs';
import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HERO_MODELS } from '../src/view/hero-model';
import { GAME_UNIT, HELD_AT_LEAST, ROD, fishFlung, flankAt, heldSize, landOnBoards, lieAcross, lieOnBoards, lineBetween, readHands, readJaws, reelOn, rodFalling, rodLine, rodSpatOut, type Grips, type JawGrip } from '../src/view/held-tackle';
import { buildLake } from '../src/levels/cocolalla/layout';
import { DIFFICULTIES } from '../src/game/difficulty';

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

/** Yaarbro's grips, in his palms, and Caputo's, in his jaws. */
const palms = (): Grips => {
  const fishing = HERO_MODELS.Yaarbro.fishing;
  if (!fishing || !('grips' in fishing)) throw new Error('Yaarbro holds things in his palms');
  return fishing.grips;
};
const jaws = (): JawGrip => {
  const fishing = HERO_MODELS.Caputo.fishing;
  if (!fishing || !('jaws' in fishing)) throw new Error('Caputo holds the rod in his jaws');
  return fishing.jaws;
};

describe('the grip points in his palms', () => {
  it('are the same in the game as in his guide file, which his clips are made from', () => {
    const guide = JSON.parse(readFileSync('tools/yaarbro.guide.json', 'utf8')) as { grips: Grips };
    expect(palms()).toEqual(guide.grips);
  });

  it('are read from his hand bones wherever they are', () => {
    const grips = palms();
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

describe('a rod held in the jaws (Caputo)', () => {
  it('has the same grip in the game as in his guide file, which his preview page was drawn from', () => {
    const guide = JSON.parse(readFileSync('tools/caputo.rig.json', 'utf8')) as { grips: { jaws: JawGrip } };
    expect(jaws()).toEqual(guide.grips.jaws);
    // His three fishing clips are named for him, as Yaarbro's are.
    expect(HERO_MODELS.Caputo.clips).toMatchObject({ cast: ['fish_cast'], reel: ['fish_reel'], show: ['fish_show'] });
  });

  it('runs through the grip point between his teeth, wherever his head is, with its reel under it', () => {
    const head = new Object3D();
    head.position.set(2, 1, -3);
    head.rotation.set(0.3, 0.8, 0);
    head.updateMatrixWorld(true);
    const grip = jaws();
    const rod = readJaws(grip, head);
    expect(rod.from.distanceTo(head.localToWorld(new Vector3().fromArray(grip.at)))).toBeLessThan(1e-9);
    expect(fromLine(rod.from, rodLine(rod.from, rod.along, null, 0, GAME_UNIT))).toBeLessThan(1e-9);
    expect(Math.abs(rod.side.dot(rod.along))).toBeLessThan(1e-9);
    expect(rod.along.length()).toBeCloseTo(1, 6);
  });

  it('slides out ahead of his teeth before it falls, and ends where it lies', () => {
    const letGo = { from: new Vector3(0, 1.2, 0.9), along: new Vector3(0, 0.6, 0.8), side: new Vector3(1, 0, 0) };
    const lying = { from: new Vector3(1.3, 0.03, 0.5), along: new Vector3(0, 0, 1), side: new Vector3(1, 0, 0) };
    const early = rodSpatOut(letGo, lying, 0.15, GAME_UNIT);
    // Still on its own line, further out along it.
    expect(early.from.clone().sub(letGo.from).normalize().distanceTo(letGo.along)).toBeLessThan(1e-6);
    expect(early.from.distanceTo(letGo.from)).toBeCloseTo(0.2 * GAME_UNIT, 6);
    const down = rodSpatOut(letGo, lying, 1, GAME_UNIT);
    expect(down.from.distanceTo(lying.from)).toBeLessThan(1e-9);
    expect(down.along.distanceTo(lying.along)).toBeLessThan(1e-9);
  });
});

describe('a fish flung onto the boards (Caputo)', () => {
  const skin = boxFish();
  // A jetty 3.2 m wide and 3.4 long, reaching north (-z) to z = -3.4 from a dock; the water lies north, 2.6 m below.
  const boards = { x: 0, z: -1.7, halfX: 1.6, halfZ: 1.7, top: 3 };
  const north = { x: 0, z: -1 };
  const onBoards = (point: Vector3, margin = 0): boolean => Math.abs(point.x - boards.x) <= boards.halfX - margin && point.z >= boards.z - boards.halfZ + margin;

  it('lies on its side on the boards, its lowest point resting on them', () => {
    const lying = lieOnBoards(skin, new Vector3(1, 3, 2), new Vector3(1, 0, 0), 2);
    const placed = skin.map((point) => point.clone().multiplyScalar(2).applyQuaternion(lying.turn).add(lying.position));
    expect(Math.min(...placed.map((point) => point.y))).toBeCloseTo(3, 6);
    // On its side: no taller than it is thick. Nose along the way asked.
    expect(Math.max(...placed.map((point) => point.y))).toBeCloseTo(3.2, 6);
    expect(new Vector3(0, 0, 1).applyQuaternion(lying.turn).distanceTo(new Vector3(1, 0, 0))).toBeLessThan(1e-6);
  });

  it('lands on the boards behind him wherever he stands on the spot, even at the very end of the jetty', () => {
    for (const x of [-1.3, -0.6, 0, 0.6, 1.3]) {
      for (const z of [-3.4, -2.9, -2.3, -1.4, -1]) {
        const landing = landOnBoards({ x, z }, north, boards, GAME_UNIT);
        // He ends up facing away from the water, with the fish in front of him: more than his own length away, and on the boards.
        expect(Math.sin(landing.facing)).toBeCloseTo(0, 6);
        expect(Math.cos(landing.facing)).toBeCloseTo(1, 6);
        expect(landing.fishAt.z - z, `${x}, ${z}`).toBeGreaterThan(1.5);
        expect(Math.abs(landing.fishAt.x - boards.x), `${x}, ${z}`).toBeLessThanOrEqual(boards.halfX - 0.3);
        expect(landing.fishAt.y).toBe(boards.top);
        // It lies across in front of him.
        expect(Math.abs(landing.nose.x)).toBeCloseTo(1, 6);
        // The rod lies beside where he stood, pointing at the water, its handle on the boards and no more than its tip past the end.
        const rod = rodLine(landing.rod.from, landing.rod.along, null, 0, GAME_UNIT);
        expect(onBoards(rod[0], 0.15), `${x}, ${z}`).toBe(true);
        expect(rod[rod.length - 1].z, `${x}, ${z}`).toBeGreaterThan(boards.z - boards.halfZ - 0.75);
        expect(Math.abs(landing.rod.from.x - x), `${x}, ${z}`).toBeGreaterThan(1.2);
        // And it does not lie under the fish.
        expect(landing.fishAt.z - rod[0].z, `${x}, ${z}`).toBeGreaterThan(0.3);
      }
    }
  });

  it('is high before it is far across: clear of the end of the boards and over his head, and comes straight down at the end', () => {
    for (const z of [-3.4, -2.3, -1]) {
      const hero = { x: 0.4, z };
      const landing = landOnBoards(hero, north, boards, GAME_UNIT);
      const lying = lieOnBoards(skin, landing.fishAt, landing.nose, 1);
      // It breaks the water a little past the end of the jetty, and never nearer than 2.2 m out from him.
      const water = new Vector3(0.2, boards.top - 2.6, Math.min(-3.9, z - 2.2));
      expect(fishFlung(water, lying, 0, boards.top + 4).position.distanceTo(water)).toBeLessThan(1e-9);
      expect(fishFlung(water, lying, 1, boards.top + 4).position.distanceTo(lying.position)).toBeLessThan(1e-9);
      let peak = -Infinity;
      for (let step = 0; step <= 200; step += 1) {
        const now = fishFlung(water, lying, step / 200, boards.top + 4).position;
        peak = Math.max(peak, now.y);
        // Over the boards and not yet down beside where it lies, it is well above them; over him, above his head.
        if (now.z > boards.z - boards.halfZ && now.z < landing.fishAt.z - 0.5) expect(now.y, `${z}: ${step}`).toBeGreaterThan(boards.top + 1);
        if (Math.abs(now.z - hero.z) < 0.9) expect(now.y, `${z}: ${step}`).toBeGreaterThan(boards.top + 2);
      }
      expect(peak).toBeCloseTo(boards.top + 4, 2);
      // For the last fifth of the way it only falls.
      const late = fishFlung(water, lying, 0.85, boards.top + 4).position;
      expect(Math.hypot(late.x - lying.position.x, late.z - lying.position.z)).toBeLessThan(1e-9);
      expect(late.y).toBeGreaterThan(lying.position.y + 1);
    }
  });

  it('has boards to land on at the lake: the jetty and the dock behind it are one height', () => {
    for (const difficulty of DIFFICULTIES) {
      const level = buildLake(difficulty);
      const spot = level.fishing!;
      const jetty = level.solids.find((solid) => solid.id === spot.solid)!;
      const dock = level.solids.find((solid) => solid.id === 'dock')!;
      expect(dock.top).toBe(jetty.top);
      // From anywhere on the spot, facing away from the water, the fish lands on the jetty or the dock.
      for (const [dx, dz] of [[0, 0], [spot.radius, 0], [-spot.radius, 0], [0, spot.radius], [0, -spot.radius]]) {
        const hero = { x: Math.max(jetty.x - jetty.halfX, Math.min(jetty.x + jetty.halfX, spot.x + dx)), z: Math.max(jetty.z - jetty.halfZ, spot.z + dz) };
        const { fishAt } = landOnBoards(hero, spot.ahead, jetty, GAME_UNIT);
        const on = [jetty, dock].some((solid) => Math.abs(fishAt.x - solid.x) <= solid.halfX - 0.25 && Math.abs(fishAt.z - solid.z) <= solid.halfZ);
        expect(on, `${difficulty}: ${dx}, ${dz}`).toBe(true);
      }
    }
  });
});
