// Turns the level's solids into smooth, textured shapes: mossy banks, fallen
// logs, stumps with cut-ring tops, mushroom springs, the canopy bough and the
// golden leaf. Looks only; the rules never read any of this.
//
// Every top surface matches the footing in the rules: flat where you stand,
// and as wide as the solid says. The lumps and flares are all below or beside.

import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  type Material,
} from 'three';
import type { Level, Solid } from '../game/level';
import type { Materials } from './materials';
import { noise, rough, smooth } from './noise';
import { glowPicture } from './pictures';
import { surface, through } from './surface';

/** Where the mist begins and where it hides everything, and how far down shapes go. */
export const MIST_TOP = -2.5;
export const MIST_BOTTOM = -9;
const UNDER = -15;

const TAU = Math.PI * 2;

/** Small things scattered over the scenery, gathered here and drawn together. */
export interface Decor {
  fern(x: number, y: number, z: number, size: number, turn: number): void;
  grass(x: number, y: number, z: number, size: number, turn: number): void;
  rock(x: number, y: number, z: number, size: number, turn: number): void;
}

const solid = (geometry: BufferGeometry, material: Material): Mesh => {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

// ---------- Mossy banks ----------

/** A point on a rectangle with rounded corners, `across` of the way round, with the outward direction. */
const roundedRect = (
  across: number,
  halfX: number,
  halfZ: number,
  corner: number,
): { x: number; z: number; outX: number; outZ: number; along: number } => {
  const straightX = 2 * (halfX - corner);
  const straightZ = 2 * (halfZ - corner);
  const arc = (Math.PI / 2) * corner;
  const total = 2 * straightX + 2 * straightZ + 4 * arc;
  let left = (((across % 1) + 1) % 1) * total;
  const along = left;
  // Start halfway up the right-hand edge and go round toward +z.
  const pieces: Array<['line' | 'arc', number, number, number, number, number]> = [
    ['line', straightZ / 2, halfX, 0, 0, 1],
    ['arc', arc, halfX - corner, halfZ - corner, 0, 0],
    ['line', straightX, halfX - corner, halfZ, -1, 0],
    ['arc', arc, -(halfX - corner), halfZ - corner, Math.PI / 2, 0],
    ['line', straightZ, -halfX, halfZ - corner, 0, -1],
    ['arc', arc, -(halfX - corner), -(halfZ - corner), Math.PI, 0],
    ['line', straightX, -(halfX - corner), -halfZ, 1, 0],
    ['arc', arc, halfX - corner, -(halfZ - corner), Math.PI * 1.5, 0],
    ['line', straightZ / 2, halfX, -(halfZ - corner), 0, 1],
  ];
  for (const [kind, length, a, b, c, d] of pieces) {
    if (left > length) {
      left -= length;
      continue;
    }
    if (kind === 'line') {
      // (a, b) is the start, (c, d) the direction of travel.
      return { x: a + c * left, z: b + d * left, outX: d, outZ: -c, along };
    }
    // (a, b) is the corner's centre, c the angle it starts at.
    const angle = c + left / corner;
    return {
      x: a + Math.cos(angle) * corner,
      z: b + Math.sin(angle) * corner,
      outX: Math.cos(angle),
      outZ: Math.sin(angle),
      along,
    };
  }
  return { x: halfX, z: 0, outX: 1, outZ: 0, along };
};

const bank = (s: Solid, materials: Materials, decor: Decor, random: () => number): Group => {
  const group = new Group();
  const corner = 0.8;
  // The picture reaches a touch past the footing, as far as feet may overhang.
  const halfX = s.halfX + 0.1;
  const halfZ = s.halfZ + 0.1;
  const lipDepth = s.safe ? 0.55 : 0.25;
  const seed = s.x * 0.7 + s.z * 0.13;
  /** The edge wanders in and out a little, so the bank is not a ruled rectangle. */
  const outline = (across: number): ReturnType<typeof roundedRect> => {
    const edge = roundedRect(across, halfX, halfZ, corner);
    const wander = 0.11 * rough(edge.along * 0.45, seed, 2.2);
    return { ...edge, x: edge.x + edge.outX * wander, z: edge.z + edge.outZ * wander };
  };

  // The top you stand on: flat, with the texture laid in world metres.
  const top = surface(
    4,
    48,
    (across, down, point) => {
      const edge = outline(across);
      const share = Math.sqrt(down);
      point.x = edge.x * share;
      point.y = s.top;
      point.z = edge.z * share;
      point.s = (point.x + s.x) / 3;
      point.t = (point.z + s.z) / 3;
    },
  );
  group.add(solid(top, s.safe ? materials.mossTop : materials.stoneTop));

  // The lip: a cushion of moss hanging over the edge (or a worn stone edge).
  const lip = surface(
    4,
    48,
    (across, down, point) => {
      const edge = outline(across);
      const depth = down * lipDepth;
      const bulge = (s.safe ? 0.17 : 0.05) * Math.sin(Math.PI * Math.min(down * 0.9, 1));
      const lump = s.safe ? 0.05 * rough(edge.along * 0.9, seed, 4.2) * down : 0;
      point.x = edge.x + edge.outX * (bulge + lump);
      point.y = s.top - depth;
      point.z = edge.z + edge.outZ * (bulge + lump);
      point.s = (point.x + s.x) / 3;
      point.t = (point.z + s.z) / 3 + depth / 3;
    },
    { closed: true },
  );
  group.add(solid(lip, s.safe ? materials.mossTop : materials.stoneTop));

  // The rock below, lumpier and wider the deeper it goes, down into the mist.
  const wallTop = s.top - lipDepth;
  const perimeter = 4 * (halfX + halfZ);
  const tiles = Math.max(1, Math.round(perimeter / 3));
  const wall = surface(
    12,
    48,
    (across, down, point) => {
      const edge = outline(across);
      const depth = down ** 1.5 * (wallTop - UNDER);
      const y = wallTop - depth;
      const tuck = (s.safe ? -0.1 : 0) * (1 - smooth(0, 1.2, depth));
      const flare = 0.07 * depth + 0.012 * depth * depth;
      const lumps =
        (0.75 * rough(edge.x * 0.3 + seed, y * 0.3, edge.z * 0.3) + 0.22 * rough(edge.x * 1.1, y * 1.1 + seed, edge.z * 1.1)) *
        smooth(0, 2, depth);
      const out = tuck + flare + lumps;
      point.x = edge.x + edge.outX * out;
      point.y = y;
      point.z = edge.z + edge.outZ * out;
      point.s = across * tiles;
      point.t = depth / 3;
      // Moss hangs down from a safe bank's top, then thins to patches.
      const hang = (s.safe ? 1 : 0.25) * (1 - smooth(0.2, s.safe ? 2.6 : 1, depth));
      const patches = smooth(0.5, 0.75, noise(edge.x * 0.5 + seed, y * 0.35, edge.z * 0.5)) * (s.safe ? 0.9 : 0.45);
      point.moss = Math.min(1, Math.max(hang, patches));
    },
    { closed: true },
  );
  group.add(solid(wall, materials.rock));

  // Ferns and grass along the side edges of safe banks, out of the walking line.
  if (s.safe) {
    const count = Math.round(s.halfZ * 2 * 1.1);
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = s.x + side * (s.halfX - 0.15 - random() * 0.45);
      const z = s.z + (random() * 2 - 1) * (s.halfZ - 0.5);
      if (i % 3 === 0) decor.fern(x, s.top, z, 0.55 + random() * 0.35, random() * TAU);
      else decor.grass(x, s.top, z, 0.75 + random() * 0.6, random() * TAU);
    }
    // Low tufts over the rest of the top, thin enough to see the ground through.
    for (let i = 0; i < Math.round(s.halfX * s.halfZ * 1.2); i += 1) {
      // Mostly toward the sides: the middle is where feet go.
      const x = s.x + Math.sign(random() - 0.5) * (0.9 + random() * (s.halfX - 1.2));
      const z = s.z + (random() * 2 - 1) * (s.halfZ - 0.4);
      decor.grass(x, s.top, z, 0.35 + random() * 0.3, random() * TAU);
    }
  } else {
    for (let i = 0; i < 5; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      decor.rock(
        s.x + side * (s.halfX - 0.5 - random() * 0.5),
        s.top + 0.05,
        s.z + (random() * 2 - 1) * (s.halfZ - 0.6),
        0.16 + random() * 0.2,
        random() * TAU,
      );
    }
  }
  group.position.set(s.x, 0, s.z);
  return group;
};

// ---------- Fallen logs and the canopy bough ----------

/**
 * A log seen end-on, `across` of the way round: flat on top as wide as the
 * footing, round below. Returns x, y (0 at the top) and how mossy that side is.
 */
const logSection = (across: number, halfX: number, thickness: number): { x: number; y: number; up: number } => {
  const angle = across * TAU;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = halfX * 1.05 * Math.sign(s) * Math.abs(s) ** 0.8;
  const y = c >= 0 ? -thickness * 0.5 * (1 - c ** 0.14) : -thickness * 0.5 * (1 + (-c) ** 0.85);
  return { x, y, up: c };
};

interface LogOptions {
  /** Extra length past the far end (the bough runs on into the cedar). */
  extend?: number;
  thickness?: number;
  /** How much of the top is moss, 0 to 1. */
  mossiness?: number;
}

const log = (s: Solid, materials: Materials, options: LogOptions = {}): Group => {
  const group = new Group();
  const thickness = options.thickness ?? s.top - s.bottom;
  const length = s.halfZ * 2 + (options.extend ?? 0);
  const middleZ = -(options.extend ?? 0) / 2;
  const rows = Math.max(6, Math.round(length / 0.7));
  const around = 22;
  const seed = s.z * 0.37 + s.x;
  const tilesAround = Math.max(1, Math.round((s.halfX * 4 + thickness * 2) / 2));
  const mossiness = options.mossiness ?? 0.75;

  /** Broken ends: splintered rather than sawn. */
  const endJag = (down: number, across: number): number => {
    const fromEnd = Math.min(down, 1 - down) * length;
    return fromEnd < 0.01 ? 0.22 * rough(across * 9 + seed, down * 3, 1.7) : 0;
  };

  const body = surface(
    rows,
    around,
    (across, down, point) => {
      const section = logSection(across, s.halfX, thickness);
      const z = middleZ - length / 2 + down * length;
      // A little unevenness in girth below the walking surface only.
      const swell = 1 + 0.05 * rough(z * 0.35 + seed, across * 3) * smooth(0.25, -0.5, section.up);
      point.x = section.x * (section.up > 0.2 ? 1 : swell);
      point.y = s.top + section.y * (section.up > 0.2 ? 1 : swell);
      point.z = z + (down < 0.5 ? -1 : 1) * endJag(down, across);
      point.s = across * tilesAround;
      point.t = z / 2;
      // Moss on the shoulders and in patches along the top; the middle is worn by feet.
      const shoulder = smooth(0.35, 0.95, Math.abs(section.x) / s.halfX);
      const patch = smooth(0.35, 0.7, noise(z * 0.45 + seed, across * 2.5));
      point.moss = mossiness * smooth(-0.15, 0.25, section.up) * Math.min(1, shoulder * 0.9 + patch * 0.8);
    },
    { closed: true, flip: true },
  );
  group.add(solid(body, materials.bark));

  // The two ends: pale wood with growth rings.
  for (const end of [-1, 1]) {
    const cap = surface(
      3,
      around,
      (across, down, point) => {
        const section = logSection(across, s.halfX, thickness);
        const share = 1 - down;
        point.x = section.x * share;
        point.y = s.top + (section.y + thickness * 0.5) * share - thickness * 0.5;
        point.z = middleZ + end * (length / 2 + endJag(end < 0 ? 0 : 1, across) * share * share - (1 - share) * 0.12);
        point.s = 0.5 + (section.x / (s.halfX * 2.1)) * share * 0.92;
        point.t = 0.5 + ((section.y + thickness * 0.5) / thickness) * share * 0.92;
      },
      { closed: true, flip: end > 0 },
    );
    group.add(solid(cap, materials.rings));
  }
  group.position.set(s.x, 0, s.z);
  return group;
};

/** An upright trunk from `bottom` to `top`, a little wider and lumpier lower down. */
const trunk = (
  materials: Materials,
  radiusTop: number,
  radiusBottom: number,
  bottom: number,
  top: number,
  seed: number,
  options: { mossAtTop?: number; lean?: number } = {},
): Mesh => {
  const height = top - bottom;
  const tiles = Math.max(1, Math.round((TAU * (radiusTop + radiusBottom) * 0.5) / 2));
  const geometry = surface(
    Math.max(4, Math.round(height / 1.8)),
    Math.max(10, Math.min(24, Math.round(radiusTop * 14))),
    (across, down, point) => {
      const angle = across * TAU;
      const depth = down * height;
      const lumpy = 1 + 0.045 * Math.sin(angle * 3 + seed) + 0.03 * Math.sin(angle * 5 + seed * 2.3 + depth * 0.25);
      const radius = (radiusTop + (radiusBottom - radiusTop) * down) * lumpy;
      const lean = (options.lean ?? 0) * depth;
      point.x = Math.cos(angle) * radius + lean;
      point.y = top - depth;
      point.z = Math.sin(angle) * radius;
      point.s = across * tiles;
      point.t = depth / 2;
      const collar = (options.mossAtTop ?? 0) * (1 - smooth(0, 1.4, depth));
      const side = smooth(0.45, 0.8, noise(Math.cos(angle) * 1.3 + seed, depth * 0.3, Math.sin(angle) * 1.3)) * 0.85;
      point.moss = Math.min(1, Math.max(collar, side));
    },
    { closed: true },
  );
  return solid(geometry, materials.bark);
};

const highLogPosts = (s: Solid, materials: Materials): Group => {
  const group = new Group();
  for (const end of [-1, 1]) {
    const post = trunk(materials, 0.4, 0.62, UNDER, s.bottom + 0.25, s.z + end, { mossAtTop: 0.8, lean: end * 0.012 });
    post.position.z = end * (s.halfZ - 0.8);
    group.add(post);
  }
  group.position.set(s.x, 0, s.z);
  return group;
};

const bough = (s: Solid, materials: Materials): Group => {
  // The bough runs on past its far end into the trunk of the great cedar.
  const group = log(s, materials, { extend: 4, thickness: (s.top - s.bottom) * 1.5, mossiness: 1 });
  const trunkZ = -s.halfZ - 3.6;
  const cedar = trunk(materials, 2.3, 3.4, UNDER, s.top + 26, 5.5, { mossAtTop: 0 });
  cedar.position.z = trunkZ;
  group.add(cedar);
  return group;
};

// ---------- Stumps ----------

const stump = (s: Solid, materials: Materials): Group => {
  const group = new Group();
  const seed = s.x * 1.7 + s.z * 0.31;
  /** The outline of the cut top: nearly round, as wide as the footing. */
  const outline = (angle: number): number =>
    s.halfX * (1.02 + 0.03 * Math.sin(angle * 3 + seed) + 0.018 * Math.sin(angle * 7 + seed * 1.9));
  const height = s.top - UNDER;
  const around = Math.max(18, Math.min(28, Math.round(s.halfX * 20)));
  const tiles = Math.max(1, Math.round((TAU * s.halfX) / 2));
  const sides = surface(
    10,
    around,
    (across, down, point) => {
      const angle = across * TAU;
      const depth = down ** 1.4 * height;
      // Roots of old bark: ridges that deepen on the way down.
      const ridges = 1 + 0.02 * depth * Math.max(0, Math.sin(angle * 5 + seed)) + 0.012 * depth;
      const radius = outline(angle) * ridges;
      point.x = Math.cos(angle) * radius;
      point.y = s.top - depth;
      point.z = Math.sin(angle) * radius;
      point.s = across * tiles;
      point.t = depth / 2;
      const side = smooth(0.4, 0.75, noise(Math.cos(angle) * 1.2 + seed, depth * 0.4, Math.sin(angle) * 1.2));
      point.moss = Math.min(1, side * 0.9 + 0.5 * (1 - smooth(0, 0.5, depth)) * side);
    },
    { closed: true },
  );
  group.add(solid(sides, materials.bark));

  const top = surface(
    3,
    around,
    (across, down, point) => {
      const angle = across * TAU;
      const radius = outline(angle) * down;
      point.x = Math.cos(angle) * radius;
      point.y = s.top;
      point.z = Math.sin(angle) * radius;
      point.s = 0.5 + Math.cos(angle) * down * 0.49;
      point.t = 0.5 + Math.sin(angle) * down * 0.49;
    },
  );
  group.add(solid(top, materials.rings));
  group.position.set(s.x, 0, s.z);
  return group;
};

// ---------- Mushroom springs ----------

export interface MushroomView {
  /** The part that squashes when bounced on. */
  cap: Group;
  /** Seconds since the last bounce. */
  sinceBounce: number;
}

const mushroom = (s: Solid, materials: Materials): { group: Group; view: MushroomView } => {
  const group = new Group();
  const radius = s.halfX;
  const stemHeight = 1;
  // Free-standing mushrooms grow from the top of a broken snag.
  if (s.bottom < s.top - stemHeight - 0.5) {
    group.add(trunk(materials, radius * 0.66, radius * 0.95, UNDER, s.top - stemHeight + 0.04, s.z * 0.9, { mossAtTop: 1 }));
  }
  const cap = new Group();
  cap.position.y = s.top - stemHeight;

  const stem = surface(
    4,
    14,
    (across, down, point) => {
      const angle = across * TAU;
      // Slim under the cap, swelling toward the foot.
      const r = radius * (0.27 + 0.2 * down ** 2);
      point.x = Math.cos(angle) * r;
      point.y = (stemHeight - 0.3) * (1 - down);
      point.z = Math.sin(angle) * r;
      point.s = across;
      point.t = down;
    },
    { closed: true },
  );
  cap.add(solid(stem, materials.stem));

  // The cap, from the stem outward along its underside, round the rim and over
  // the top. Nearly flat on top, so the footing matches what you see.
  const profile: Array<[number, number]> = [
    [radius * 0.26, stemHeight - 0.34],
    [radius * 0.6, stemHeight - 0.4],
    [radius * 0.9, stemHeight - 0.4],
    [radius * 1.04, stemHeight - 0.28],
    [radius * 1.02, stemHeight - 0.12],
    [radius * 0.9, stemHeight - 0.01],
    [radius * 0.6, stemHeight + 0.07],
    [radius * 0.3, stemHeight + 0.1],
    [0, stemHeight + 0.105],
  ];
  const underShare = 0.3;
  const under = surface(
    3,
    28,
    (across, down, point) => {
      const angle = across * TAU;
      const [r, y] = through(profile, down * underShare);
      point.x = Math.cos(angle) * r;
      point.y = y;
      point.z = Math.sin(angle) * r;
      point.s = 0.5 + (Math.cos(angle) * r) / (radius * 2.1);
      point.t = 0.5 + (Math.sin(angle) * r) / (radius * 2.1);
    },
    { closed: true, flip: true },
  );
  cap.add(solid(under, materials.gills));
  const over = surface(
    12,
    28,
    (across, down, point) => {
      const angle = across * TAU;
      const [r, y] = through(profile, underShare + down * (1 - underShare));
      point.x = Math.cos(angle) * Math.max(r, 0);
      point.y = y;
      point.z = Math.sin(angle) * Math.max(r, 0);
      point.s = 0.5 + (Math.cos(angle) * r) / (radius * 2.1);
      point.t = 0.5 + (Math.sin(angle) * r) / (radius * 2.1);
    },
    { closed: true, flip: true },
  );
  cap.add(solid(over, materials.cap));
  group.add(cap);
  group.position.set(s.x, 0, s.z);
  return { group, view: { cap, sinceBounce: 10 } };
};

/** Squashes a mushroom cap right after a bounce and lets it spring back. */
export const animateMushroom = (view: MushroomView, dt: number): void => {
  view.sinceBounce += dt;
  const t = view.sinceBounce;
  const squash = t < 0.6 ? 0.42 * Math.exp(-t * 7) * Math.cos(t * 22) : 0;
  view.cap.scale.set(1 + squash * 0.35, 1 - squash, 1 + squash * 0.35);
};

// ---------- The golden leaf ----------

export interface LeafView {
  group: Group;
  blade: Group;
  halo: Sprite;
  sparkles: Points;
  baseY: number;
}

export const goldenLeaf = (level: Level, materials: Materials): LeafView => {
  const group = new Group();
  // A leaf with a gentle curl, so it catches the light as it turns.
  const shape = new PlaneGeometry(1.15, 1.3, 6, 8);
  const position = shape.getAttribute('position');
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    position.setZ(i, 0.22 * x * x - 0.1 * y * y);
  }
  shape.computeVertexNormals();
  const blade = new Group();
  blade.add(new Mesh(shape, materials.goldLeaf));
  blade.rotation.z = 0.25;
  blade.scale.setScalar(1.25);
  group.add(blade);

  const halo = new Sprite(
    new SpriteMaterial({
      map: glowPicture('gold', 'rgba(255, 220, 110, 0.75)', 'rgba(255, 214, 90, 0)'),
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.scale.set(3.6, 3.6, 1);
  group.add(halo);

  // A faint shaft of light, so the leaf can be found from far off.
  const shaft = new Mesh(
    new CylinderGeometry(0.45, 1.2, 16, 16, 1, true),
    new MeshBasicMaterial({
      color: 0xffd97a,
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    }),
  );
  shaft.position.y = 7.5;
  group.add(shaft);

  // Slow sparkles drifting round the leaf.
  const count = 26;
  const places = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const turn = (i / count) * TAU * 3;
    const out = 0.7 + ((i * 37) % 10) / 14;
    places[i * 3] = Math.cos(turn) * out;
    places[i * 3 + 1] = ((i * 53) % 20) / 10 - 1;
    places[i * 3 + 2] = Math.sin(turn) * out;
  }
  const dots = new BufferGeometry();
  dots.setAttribute('position', new Float32BufferAttribute(places, 3));
  const sparkles = new Points(
    dots,
    new PointsMaterial({
      map: glowPicture('spark', 'rgba(255, 244, 190, 1)', 'rgba(255, 230, 150, 0)'),
      size: 0.22,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  group.add(sparkles);

  group.position.set(level.leaf.x, level.leaf.y, level.leaf.z);
  return { group, blade, halo, sparkles, baseY: level.leaf.y };
};

// ---------- Putting the level together ----------

export interface LevelSolids {
  group: Group;
  mushrooms: Map<string, MushroomView>;
  leaf: LeafView;
}

export const buildSolids = (level: Level, materials: Materials, decor: Decor, random: () => number): LevelSolids => {
  const group = new Group();
  const mushrooms = new Map<string, MushroomView>();
  for (const s of level.solids) {
    if (s.kind === 'mushroom') {
      const made = mushroom(s, materials);
      group.add(made.group);
      mushrooms.set(s.id, made.view);
    } else if (s.kind === 'bank') group.add(bank(s, materials, decor, random));
    else if (s.kind === 'stump') group.add(stump(s, materials));
    else if (s.kind === 'bough') group.add(bough(s, materials));
    else {
      group.add(log(s, materials));
      // Two snags hold a raised log up; a log at bank height rests on the banks.
      if (s.top > 2) group.add(highLogPosts(s, materials));
    }
  }
  const leaf = goldenLeaf(level, materials);
  group.add(leaf.group);
  return { group, mushrooms, leaf };
};

/** The soft dark spot under the hero that shows where a jump will land. */
export const blobShadow = (): Mesh => {
  const shadow = new Mesh(
    new CircleGeometry(0.62, 24),
    new MeshBasicMaterial({
      map: glowPicture('shade', 'rgba(8, 20, 14, 0.9)', 'rgba(8, 20, 14, 0)'),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 5;
  return shadow;
};
