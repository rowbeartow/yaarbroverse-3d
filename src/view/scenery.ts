// Turns the level's solids into smooth, textured shapes: mossy banks, fallen
// logs, stumps with cut-ring tops, mushroom springs, the canopy bough and the
// golden leaf. Looks only; the rules never read any of this.
//
// Every top surface matches the footing in the rules: flat where you stand,
// and as wide as the solid says. The lumps and flares are all below or beside.
// A bank's top has an irregular edge, which never reaches past where a hero
// can stand (bank-outline.ts).

import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MOVE } from '../game/hero';
import type { Level, Solid } from '../game/level';
import { bankOutline, bankSeed } from './bank-outline';
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

/** A lumpy boulder about two units across, for the rock that shows round a bank's sides. */
const boulderGeometry = (): BufferGeometry => {
  const geometry = new IcosahedronGeometry(1, 2);
  const position = geometry.getAttribute('position');
  const moss = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // Big lumps and small ones, so no two sides of it look alike.
    const lump = 1 + 0.38 * rough(x * 1.1, y * 1.1, z * 1.1) + 0.1 * rough(x * 3.1, y * 3.1, z * 3.1);
    position.setXYZ(i, x * lump, y * lump, z * lump);
    moss[i] = smooth(0.1, 0.7, y) * (0.5 + 0.5 * noise(x * 2, y * 2, z * 2));
  }
  geometry.setAttribute('moss', new Float32BufferAttribute(moss, 1));
  geometry.computeVertexNormals();
  return geometry;
};

const bank = (s: Solid, materials: Materials, decor: Decor, random: () => number): Group => {
  const group = new Group();
  const seed = bankSeed(s.x, s.z);
  // The top's edge: irregular and round-cornered, but never past where a hero
  // can stand (see bank-outline.ts).
  const outline = bankOutline(s.halfX, s.halfZ, MOVE.footRadius, seed);
  const around = Math.max(48, Math.round(outline.length / 0.32));
  const ring = outline.length / TAU;

  // The top you stand on: flat, with the texture laid in world metres.
  const top = surface(5, around, (across, down, point) => {
    const edge = outline.at(across);
    const share = Math.sqrt(down);
    point.x = edge.x * share;
    point.y = s.top;
    point.z = edge.z * share;
    point.s = (point.x + s.x) / 3;
    point.t = (point.z + s.z) / 3;
  });
  group.add(solid(top, s.safe ? materials.mossTop : materials.stoneTop));

  /**
   * Where the rock face is, `depth` metres below the top and `across` of the
   * way round. At the top it is the top's own edge. Just below it tucks in
   * under the turf. Lower down it swells into lobes and lumps, and the whole
   * stack eases from the top's outline toward a rough oval, so the bank
   * stands on a rounded mass of rock and not a box. None of the swelling
   * starts until well below the top, so nothing beside the top looks like
   * more ground to stand on.
   */
  const rockAt = (across: number, depth: number): { x: number; z: number; outX: number; outZ: number } => {
    const edge = outline.at(across);
    const round = 0.8 * smooth(0.6, 7, depth);
    const angle = Math.atan2(edge.z / s.halfZ, edge.x / s.halfX);
    const x = edge.x + (Math.cos(angle) * s.halfX * 1.08 - edge.x) * round;
    const z = edge.z + (Math.sin(angle) * s.halfZ * 1.08 - edge.z) * round;
    const y = s.top - depth;
    const tuck = -0.16 * smooth(0, 0.35, depth) * (1 - smooth(0.7, 2, depth));
    const flare = 0.05 * depth + 0.009 * depth * depth;
    const lobes = 0.9 * rough(x * 0.21 + seed, y * 0.17, z * 0.21) * smooth(0.6, 2.8, depth);
    const lumps =
      (0.3 * rough(x * 0.45 + seed, y * 0.45, z * 0.45) + 0.12 * rough(x * 1.3, y * 1.3 + seed, z * 1.3)) * smooth(0.25, 1.4, depth);
    const out = tuck + flare + lobes + lumps;
    return { x: x + edge.outX * out, z: z + edge.outZ * out, outX: edge.outX, outZ: edge.outZ };
  };

  /**
   * How far the moss spills down the side at each place round the bank, in
   * metres: broad curtains with narrow tongues between, never a ruled hem.
   * A bare stone bank has only a thin worn edge.
   */
  const spill = (across: number): number => {
    if (!s.safe) return 0.22;
    const angle = across * TAU;
    const u = Math.cos(angle) * ring;
    const v = Math.sin(angle) * ring;
    const curtains = Math.max(0, rough(u * 0.55 + seed, v * 0.55, 9.1));
    const tongues = smooth(0.5, 0.8, noise(u * 1.8 + seed, v * 1.8, 4.4));
    return 0.38 + 1.2 * curtains + 0.8 * tongues;
  };

  // The rock, from the top's edge down into the mist.
  const tiles = Math.max(1, Math.round(outline.length / 3));
  const wall = surface(
    16,
    around,
    (across, down, point) => {
      const depth = down ** 1.6 * (s.top - UNDER);
      const rock = rockAt(across, depth);
      point.x = rock.x;
      point.y = s.top - depth;
      point.z = rock.z;
      point.s = across * tiles;
      point.t = depth / 3;
      // Moss creeps on below the cushion, thinning, then only grows in patches.
      const hem = spill(across);
      const hang = (s.safe ? 1 : 0.25) * (1 - smooth(hem * 0.8, hem * 1.5 + 0.7, depth));
      const patches = smooth(0.5, 0.75, noise(rock.x * 0.5 + seed, point.y * 0.35, rock.z * 0.5)) * (s.safe ? 0.9 : 0.45);
      point.moss = Math.min(1, Math.max(hang, patches));
    },
    { closed: true },
  );
  group.add(solid(wall, materials.rock));

  // The cushion of moss spilling over the side (or a worn stone edge). It drops
  // straight from the top's edge, is fattest a little way down and thins to
  // nothing at its hem.
  const lip = surface(
    6,
    around,
    (across, down, point) => {
      const depth = down * spill(across);
      const rock = rockAt(across, depth);
      const fat = (s.safe ? 0.2 : 0.05) * Math.sin(Math.PI * Math.min(down * 1.1, 1) ** 0.85) + 0.03 * smooth(0, 0.15, down);
      point.x = rock.x + rock.outX * fat;
      point.y = s.top - depth;
      point.z = rock.z + rock.outZ * fat;
      point.s = (point.x + s.x) / 3;
      point.t = (point.z + s.z) / 3 + depth / 3;
    },
    { closed: true },
  );
  group.add(solid(lip, s.safe ? materials.mossTop : materials.stoneTop));

  // Boulders bedded in the rock round the sides. Each sits well below the top
  // and half inside the face, so it reads as crag, not as a ledge to land on.
  const place = new Object3D();
  const rockCount = Math.round(outline.length / 2.6);
  const rocks = new InstancedMesh(boulderGeometry(), materials.rock, rockCount);
  for (let i = 0; i < rockCount; i += 1) {
    const across = (i + random() * 0.8) / rockCount;
    const size = 0.28 + random() * random() * 0.42;
    const depth = 0.6 + size * 1.3 + random() * 1.6;
    const rock = rockAt(across, depth);
    place.position.set(rock.x - rock.outX * size * 0.15, s.top - depth, rock.z - rock.outZ * size * 0.15);
    place.rotation.set(random() * TAU, random() * TAU, random() * 0.5);
    place.scale.set(size * (0.9 + random() * 0.7), size * (0.6 + random() * 0.3), size * (0.9 + random() * 0.7));
    place.updateMatrix();
    rocks.setMatrixAt(i, place.matrix);
  }
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // Roots: they come out from under the turf and grip their way down the rock.
  const rootCount = Math.round(outline.length / 3);
  const roots: BufferGeometry[] = [];
  for (let i = 0; i < rootCount; i += 1) {
    const start = (i + random() * 0.8) / rootCount;
    const long = 1.5 + random() * 2.8;
    const thick = 0.07 + random() * 0.08;
    const drift = ((random() - 0.5) * 1.6) / outline.length;
    const wiggle = random() * TAU;
    const root = surface(
      Math.max(6, Math.round(long / 0.3)),
      5,
      (round, down, point) => {
        const depth = 0.04 + down * long;
        const across = start + drift * down + (0.12 / outline.length) * Math.sin(down * 5 + wiggle);
        const rock = rockAt(across, depth);
        const radius = thick * (1 - 0.7 * down);
        // Stand off the rock by a little less than its own thickness.
        const centreX = rock.x + rock.outX * (radius * 0.7 + 0.02);
        const centreZ = rock.z + rock.outZ * (radius * 0.7 + 0.02);
        const turn = round * TAU;
        point.x = centreX + (rock.outX * Math.cos(turn) - rock.outZ * Math.sin(turn)) * radius;
        point.y = s.top - depth;
        point.z = centreZ + (rock.outZ * Math.cos(turn) + rock.outX * Math.sin(turn)) * radius;
        point.s = round;
        point.t = depth / 1.5;
        point.moss = 0.5 * (1 - smooth(0.3, 1.5, depth));
      },
      { closed: true },
    );
    roots.push(root);
  }
  // All of a bank's roots are drawn as one shape.
  if (roots.length > 0) {
    group.add(solid(mergeGeometries(roots), materials.bark));
    for (const root of roots) root.dispose();
  }

  // Ferns and grass along the side edges of safe banks, out of the walking line.
  if (s.safe) {
    const count = Math.round(s.halfZ * 2 * 1.1);
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = s.x + side * (s.halfX - 0.15 - random() * 0.45);
      const z = s.z + (random() * 2 - 1) * (s.halfZ - 0.9);
      if (i % 3 === 0) decor.fern(x, s.top, z, 0.55 + random() * 0.35, random() * TAU);
      else decor.grass(x, s.top, z, 0.75 + random() * 0.6, random() * TAU);
    }
    // Low tufts over the rest of the top, thin enough to see the ground through.
    for (let i = 0; i < Math.round(s.halfX * s.halfZ * 1.2); i += 1) {
      // Mostly toward the sides: the middle is where feet go.
      const x = s.x + Math.sign(random() - 0.5) * (0.9 + random() * (s.halfX - 1.4));
      const z = s.z + (random() * 2 - 1) * (s.halfZ - 0.9);
      decor.grass(x, s.top, z, 0.35 + random() * 0.3, random() * TAU);
    }
  } else {
    for (let i = 0; i < 5; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      decor.rock(
        s.x + side * (s.halfX - 0.5 - random() * 0.5),
        s.top + 0.05,
        s.z + (random() * 2 - 1) * (s.halfZ - 0.9),
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
