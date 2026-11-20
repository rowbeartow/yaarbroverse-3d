// Where the things a hero holds while fishing go: the rod, its reel, the line
// and a landed fish. Shapes and places only, no drawing: the game
// (fishing.ts) and the preview page (tools/preview/tackle.ts) both draw from
// this, and tools/preview/fishing-measure.mjs measures every frame of it.
//
// Yaarbro's model has no finger bones, so nothing is ever "in his fingers".
// Everything he holds is held at a grip point in the middle of a palm
// (`grips` in tools/yaarbro.guide.json, and on his entry in HERO_MODELS):
//   - The rod is fixed in his right palm for as long as he has it. It runs
//     through that hand the same way in every clip.
//   - With both hands on the rod, his left palm is under it, further along.
//   - A landed fish lies on its side across both palms, turned up with the
//     fingers pointing outward, as under a tray.
// The clips put his palms in the right places (tools/prepare-rigged.py).
//
// Lengths here are metres on his model as it comes (he is 2.87 m tall there),
// turned into the caller's own units by `unit`: for the game, `GAME_UNIT`.

import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';

/** A grip point in the middle of a palm, in its hand bone's own space. */
export interface Grip {
  bone: string;
  /** The grip point, on the skin of the palm. */
  at: number[];
  /** The way the palm faces, and the way the fingers run. */
  palm: number[];
  fingers: number[];
  /** The way the rod runs through this hand. */
  rod?: number[];
  /** The side of the rod its reel hangs on. */
  reel?: number[];
}
export interface Grips {
  right: Grip;
  left: Grip;
}

/** His height on the model as it comes, and in the game. */
export const MODEL_TALL = 2.87;
export const GAME_TALL = 2.2;
/** Metres in the game for a metre on his model as it comes. */
export const GAME_UNIT = GAME_TALL / MODEL_TALL;

/** A landed fish is drawn this many times its real length, so an ordinary bass is about as long as his arm. */
export const HELD_TIMES_LIFE = 2;
/** The shortest a landed fish is drawn, in metres on his model: long enough to lie across both palms, which are 56 cm apart there. A catch under about 31 cm is drawn as if it were that long. */
export const HELD_AT_LEAST = 0.8;

/**
 * The moments of the "Landed" clip, as shares of it: the fish breaks the
 * water, he lets go of the rod, the rod is down on the boards, the fish lands
 * on his palms.
 */
export const LANDED = { burst: 0.05, release: 0.2, down: 0.33, caught: 0.4 };
/** The moments of the cast clip, as shares of it: the rod is all the way back, the line leaves the rod's tip, and the lure is down on the water. */
export const CAST = { back: 0.35, fly: 0.56, down: 0.86 };

/** The rod: how long, how much of it is behind his right palm, how thick, how far it runs straight before it bends, and its reel. */
export const ROD = {
  long: 2.3,
  behind: 0.12,
  thick: 0.02,
  straight: 0.8,
  reelAt: 0.56,
  reelRadius: 0.085,
  reelWide: 0.06,
  knobOut: 0.055,
};

const UP = new Vector3(0, 1, 0);

export const ease = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** Where a rod is: a point on its middle (at his right palm, when he holds it), which way it runs, and the side its reel hangs on. */
export interface RodPose {
  from: Vector3;
  along: Vector3;
  side: Vector3;
}

/** His two palms as they are now: each grip point and the way each palm faces, and the rod as it lies in his right. */
export interface Hands extends RodPose {
  gripRight: Vector3;
  gripLeft: Vector3;
  palmRight: Vector3;
  palmLeft: Vector3;
}

/** Reads his palms from his hand bones. Their world matrices must be up to date. */
export const readHands = (grips: Grips, right: Object3D, left: Object3D, unit: number): Hands => {
  const gripRight = new Vector3().fromArray(grips.right.at).applyMatrix4(right.matrixWorld);
  const gripLeft = new Vector3().fromArray(grips.left.at).applyMatrix4(left.matrixWorld);
  const palmRight = new Vector3().fromArray(grips.right.palm).transformDirection(right.matrixWorld);
  const palmLeft = new Vector3().fromArray(grips.left.palm).transformDirection(left.matrixWorld);
  const along = new Vector3().fromArray(grips.right.rod ?? grips.right.fingers).transformDirection(right.matrixWorld);
  const side = new Vector3().fromArray(grips.right.reel ?? grips.right.palm).transformDirection(right.matrixWorld);
  side.addScaledVector(along, -side.dot(along)).normalize();
  // The rod lies on his palm, so its middle is its own thickness off the skin.
  return { gripRight, gripLeft, palmRight, palmLeft, from: gripRight.clone().addScaledVector(palmRight, ROD.thick * unit), along, side };
};

/** The middle of the rod, butt to tip, from a point on it at his right palm: straight through his hands, then bent toward what pulls on it. */
export const rodLine = (from: Vector3, along: Vector3, toward: Vector3 | null, pulled: number, unit: number): Vector3[] => {
  const points: Vector3[] = [];
  for (let i = 0; i <= 8; i += 1) points.push(from.clone().addScaledVector(along, (-ROD.behind + ((ROD.straight + ROD.behind) * i) / 8) * unit));
  const rest = ROD.long - ROD.behind - ROD.straight;
  const end = from.clone().addScaledVector(along, (ROD.straight + rest) * unit);
  const bend = new Vector3();
  if (toward && pulled > 0) {
    bend.copy(toward).sub(end);
    bend.addScaledVector(along, -bend.dot(along)).normalize();
  }
  for (let i = 1; i <= 24; i += 1) {
    const u = i / 24;
    points.push(
      from
        .clone()
        .addScaledVector(along, (ROD.straight + rest * u * (1 - 0.14 * pulled * u)) * unit)
        .addScaledVector(bend, rest * 0.45 * pulled * u * u * unit),
    );
  }
  return points;
};

/** A line between two places, hanging by `sag` in the middle. */
export const lineBetween = (from: Vector3, to: Vector3, sag: number, unit: number): Vector3[] => {
  const points: Vector3[] = [];
  const steps = Math.max(4, Math.ceil(from.distanceTo(to) / (0.05 * unit)));
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const point = from.clone().lerp(to, u);
    point.y -= sag * 4 * u * (1 - u);
    points.push(point);
  }
  return points;
};

/** Where the reel is on a rod: its middle, under the rod, and which way its axle points (sideways). */
export const reelOn = (rod: RodPose, unit: number): { centre: Vector3; axle: Vector3 } => ({
  centre: rod.from
    .clone()
    .addScaledVector(rod.along, ROD.reelAt * unit)
    .addScaledVector(rod.side, (ROD.thick + ROD.reelRadius) * unit),
  axle: new Vector3().crossVectors(rod.along, rod.side).normalize(),
});

/** A rod he has let go of, a share of the way (0 to 1) through its drop from where his hand left it to where it lies. */
export const rodFalling = (letGo: RodPose, lying: RodPose, fall: number): RodPose => {
  const down = fall * fall;
  const from = letGo.from.clone().lerp(lying.from, down);
  // It goes out to the side at once, and down as things fall.
  from.x += (lying.from.x - letGo.from.x) * (ease(fall * 1.6) - down);
  from.z += (lying.from.z - letGo.from.z) * (ease(fall * 1.6) - down);
  const along = letGo.along.clone().lerp(lying.along, ease(fall)).normalize();
  const side = letGo.side.clone().lerp(lying.side, ease(fall));
  side.addScaledVector(along, -side.dot(along)).normalize();
  return { from, along, side };
};

/**
 * How low a fish's underside is as it lies on its side (its left flank down),
 * under its middle line, a way along it from its middle (toward its nose is
 * more), for a fish drawn `size` times its own. `skin` is its skin at rest,
 * about its middle, three points a triangle: nose along +z, back along +y.
 */
export const flankAt = (skin: Vector3[], long: number, along: number, size: number): number => {
  const z = Math.max(-0.48, Math.min(0.48, along / (long * size))) * long;
  let lowest = Infinity;
  for (let i = 0; i < skin.length; i += 3) {
    const [a, b, c] = [skin[i], skin[i + 1], skin[i + 2]];
    const area = (b.y - a.y) * (c.z - a.z) - (c.y - a.y) * (b.z - a.z);
    if (Math.abs(area) < 1e-12) continue;
    const u = ((0 - a.y) * (c.z - a.z) - (c.y - a.y) * (z - a.z)) / area;
    const v = ((b.y - a.y) * (z - a.z) - (0 - a.y) * (b.z - a.z)) / area;
    if (u < 0 || v < 0 || u + v > 1) continue;
    lowest = Math.min(lowest, a.x + u * (b.x - a.x) + v * (c.x - a.x));
  }
  return (Number.isFinite(lowest) ? lowest : 0) * size;
};

/** How many times its own size a landed fish is drawn, for a catch so many centimetres long and a model so long. */
export const heldSize = (cm: number, long: number, unit: number): number => (Math.max((cm / 100) * HELD_TIMES_LIFE * (MODEL_TALL / GAME_TALL), HELD_AT_LEAST) * unit) / long;

/**
 * Where a landed fish lies across his upturned palms: on its side with its
 * nose to his right, its flank on the grip point of each. A fish on its side
 * is flat underneath, so nothing of it hangs down between his palms onto his
 * wrists.
 */
export const lieAcross = (skin: Vector3[], long: number, gripRight: Vector3, gripLeft: Vector3, size: number): { position: Vector3; turn: Quaternion } => {
  const across = gripRight.clone().sub(gripLeft);
  const apart = across.length();
  across.normalize();
  const above = UP.clone().addScaledVector(across, -UP.dot(across)).normalize();
  const front = flankAt(skin, long, apart / 2, size);
  const back = flankAt(skin, long, -apart / 2, size);
  const tilt = Math.atan2(front - back, apart);
  const nose = across.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(above, -Math.sin(tilt));
  const top = above.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(across, Math.sin(tilt));
  return {
    turn: new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(top, new Vector3().crossVectors(nose, top), nose)),
    position: gripRight
      .clone()
      .add(gripLeft)
      .multiplyScalar(0.5)
      .addScaledVector(top, -(front + back) / 2),
  };
};

/** A fish on the end of the line, hanging nose up. */
const HANGING = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 1, 0)));

/**
 * A landed fish on its way from the water to his palms, a share of the way
 * (0 to 1): up out of the water on the end of the line, over in an arc and
 * down onto them. `settled` is how far it has turned from hanging to lying
 * (and how far its thrashing has stopped).
 */
export const fishFlying = (water: Vector3, lying: { position: Vector3; turn: Quaternion }, flight: number, unit: number): { position: Vector3; turn: Quaternion; settled: number } => {
  const settled = ease((flight - 0.55) / 0.45);
  const position = water.clone().lerp(lying.position, flight);
  position.y += Math.sin(Math.PI * flight) * 1.1 * unit;
  return { position, turn: HANGING.clone().slerp(lying.turn, settled), settled };
};
