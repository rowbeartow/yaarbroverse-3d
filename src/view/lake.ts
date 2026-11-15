// The surroundings of a lake level (Cocolalla): open water reaching off to the
// Selkirk mountains, a wooded shore along the left with rocks and reeds at
// the waterline, and a log boom along the right that marks where the swimming
// stops. Looks only: what a hero can stand on or swim in comes from the level.
//
// It lays itself out from the level's own pools: together they make one
// rectangle of water, the length of the route and the width of the lake. The
// shore rises out of the water just past its left side, the boom floats along
// its right side, and the open water carries on everywhere else.

import {
  BackSide,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import type { Level } from '../game/level';
import { CROWN_SHAPE, crownGeometry, trunkGeometry, type Forest } from './forest';
import type { Materials } from './materials';
import { rough, smooth } from './noise';
import { MIST_COLOR, skyPicture } from './pictures';
import type { Decor } from './scenery';
import { surface } from './surface';
import { basinMaterial, surfaceMaterial } from './water';

const TAU = Math.PI * 2;

/** The lake's numbers for its looks. Distances in metres. */
export const LAKE_LOOK = {
  /** How far past the left side of the water the shore line runs, on average, and how much it wanders. */
  shoreOut: 2.6,
  shoreWander: 1.6,
  /** How steeply the shore rises inland, and how high its hills reach. */
  shoreRise: 0.22,
  hills: 26,
  /** The pines on the shore: how many near the water, and how many on the hills behind. */
  nearPines: 36,
  farPines: 100,
  /** The log boom: how far out from the right side of the water it floats, and how long each log is. */
  boomOut: 0.7,
  boomLog: 6.2,
  /** The mountains across the water: how far off they are drawn, and how high the tallest stand. */
  /** The haze over the lake: clearer than the forest's mist, so the far shore shows. */
  haze: { near: 70, far: 230 },
  mountainsAt: 360,
  peaks: 70,
} as const;

/** The water a level's pools make together, seen from above. */
const waterBounds = (level: Level): { minX: number; maxX: number; minZ: number; maxZ: number; surface: number; floor: number } => {
  const pools = level.water ?? [];
  if (!pools.length) return { minX: -18, maxX: 18, minZ: -200, maxZ: -10, surface: 0, floor: -4 };
  return {
    minX: Math.min(...pools.map((p) => p.minX)),
    maxX: Math.max(...pools.map((p) => p.maxX)),
    minZ: Math.min(...pools.map((p) => p.minZ)),
    maxZ: Math.max(...pools.map((p) => p.maxZ)),
    surface: pools[0].surface,
    floor: Math.min(...pools.map((p) => p.floor)),
  };
};

/**
 * The mountains across the water, as a band around the camera that moves with
 * it, like the sky: forested slopes, grey rock above, snow on the high tops,
 * all paler with distance. Two ranges, the far one higher and paler.
 */
const mountains = (): Mesh => {
  const haze = new Color(MIST_COLOR);
  const forest = new Color(0x274a40);
  const rock = new Color(0x66767c);
  const snow = new Color(0xeef4f2);
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const steps = 260;
  const ranges = [
    { radius: LAKE_LOOK.mountainsAt, tall: LAKE_LOOK.peaks, seed: 3.1, pale: 0.3 },
    { radius: LAKE_LOOK.mountainsAt - 40, tall: LAKE_LOOK.peaks * 0.5, seed: 8.7, pale: 0.1 },
  ];
  const colour = new Color();
  for (const range of ranges) {
    const start = positions.length / 3;
    for (let i = 0; i <= steps; i += 1) {
      // From the left, round through straight ahead (-z), to well round to the right.
      const angle = -2.1 + (i / steps) * 4.2;
      const x = Math.sin(angle) * range.radius;
      const z = -Math.cos(angle) * range.radius;
      const lift = 0.35 + 0.65 * smooth(-2.1, -0.8, angle) * (1 - smooth(1.5, 2.1, angle) * 0.5);
      const ridge = (0.5 + 0.5 * rough(angle * 2.3 + range.seed, range.seed, 0, 4)) ** 1.6;
      const height = range.tall * lift * (0.25 + 0.95 * ridge);
      // Rows from below the horizon, where the far water hides them, to the ridge line.
      for (const [y, share] of [
        [-40, 0],
        [-4, 0.15],
        [height * 0.45, 0.5],
        [height, 1],
      ] as const) {
        positions.push(x, y, z);
        // Forest low down, rock higher, snow on the tops of the tallest, all paler with distance.
        colour.copy(forest).lerp(rock, smooth(0.5, 1, share) * smooth(0.45, 0.8, height / range.tall));
        if (share === 1 && height > range.tall * 0.7) colour.lerp(snow, smooth(range.tall * 0.7, range.tall * 0.95, height) * 0.8);
        colour.lerp(haze, share === 0 ? 1 : range.pale + (1 - share) * 0.12);
        colors.push(colour.r, colour.g, colour.b);
      }
    }
    for (let i = 0; i < steps; i += 1) {
      for (let r = 0; r < 3; r += 1) {
        const a = start + i * 4 + r;
        const b = a + 4;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, side: DoubleSide }));
  mesh.name = 'lake-mountains';
  // After the sky, before everything else: the far range first, then the nearer one over it.
  mesh.renderOrder = -9;
  return mesh;
};

export const buildLake = (level: Level, materials: Materials, decor: Decor, random: () => number): Forest => {
  const group = new Group();
  const water = waterBounds(level);
  const simple = materials.simple;
  const near = 60;
  const far = water.minZ - 420;

  // ---------- The open water past the pools, and the lake bed under everything ----------
  // The pools draw their own water. Around them the lake carries on, with the same
  // look, out to where the haze closes in. One bed lies under all of it, with the
  // light rippling over it as in a pool.
  const openLook = surfaceMaterial(simple);
  const bedLook = basinMaterial(materials.ground, water.surface);
  const reach = 170;
  const open: Array<[number, number, number, number]> = [
    // Right of the pools, out across the lake.
    [water.maxX, water.maxX + reach, water.minZ - reach, near],
    // Ahead of the pools, and behind them, from under the shore to the right.
    [water.minX - 30, water.maxX, water.minZ - reach, water.minZ],
    [water.minX - 30, water.maxX, water.maxZ, near],
    // Under the shore's edge on the left, so the water meets it everywhere.
    [water.minX - 30, water.minX, water.minZ, water.maxZ],
  ];
  for (const [x0, x1, z0, z1] of open) {
    // Points about every two metres close by: enough for the waves to catch the light.
    const sheet = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 2.5), Math.ceil((z1 - z0) / 2.5)), openLook);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set((x0 + x1) / 2, water.surface, (z0 + z1) / 2);
    sheet.renderOrder = 2;
    group.add(sheet);
  }
  const bed = new Mesh(new PlaneGeometry(water.maxX - water.minX + reach + 30, near - water.minZ + reach), bedLook);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set((water.minX - 30 + water.maxX + reach) / 2, water.floor - 0.3, (near + water.minZ - reach) / 2);
  bed.receiveShadow = true;
  group.add(bed);

  // ---------- The shore on the left ----------
  /** Where the shore line is at z: the waterline, a little past the left side of the pools. */
  // Past the dock the shore bends away to the left, and the lake opens out toward the mountains.
  const shoreLine = (z: number): number =>
    water.minX - LAKE_LOOK.shoreOut - LAKE_LOOK.shoreWander * rough(z * 0.035, 1.7, 0, 3) - 90 * smooth(water.minZ - 10, water.minZ - 160, z) ** 1.5;
  /** The ground's height at (x, z): under water to the right of the shore line, rising to hills inland. */
  const groundAt = (x: number, z: number): number => {
    const inland = shoreLine(z) - x;
    // Under the water it slopes down to the lake bed and no further.
    if (inland < 0) return Math.max(water.surface + inland * 0.9 - 0.15, water.floor - 0.3);
    // The hills sink away far ahead, so nothing stands up out of the haze there: the mountains close the view.
    const fade = 1 - smooth(water.minZ - 20, water.minZ - 140, z);
    const hill = LAKE_LOOK.hills * fade * smooth(8, 90, inland) * (0.55 + 0.45 * rough(x * 0.012, z * 0.012, 4.2, 3));
    return water.surface - 0.15 + inland * LAKE_LOOK.shoreRise * (1 - smooth(10, 40, inland) * 0.6) + hill;
  };
  const width = 230;
  const shore = new Mesh(
    surface(Math.round((near - far) / 4), Math.round(width / 3), (across, down, point) => {
      // More rows near the water, where the shape changes fastest.
      point.x = water.minX + 2 - width * across ** 1.6;
      point.z = near + (far - near) * down;
      point.y = groundAt(point.x, point.z);
      point.s = point.x / 6;
      point.t = point.z / 6;
      point.moss = smooth(0.2, 1.5, point.y - water.surface);
    }),
    bedLook,
  );
  shore.receiveShadow = true;
  shore.name = 'lake-shore';
  group.add(shore);

  // Rocks and reeds along the waterline, and reeds round the edges of the low banks out in the lake.
  for (let z = water.maxZ + 4; z > water.minZ - 10; z -= 1.6) {
    const line = shoreLine(z);
    if (random() < 0.55) decor.rock(line - 0.4 + random() * 1.6, water.surface - 0.25, z + random(), 0.45 + random() * 0.9, random() * TAU);
    if (random() < 0.8) decor.grass(line + 0.6 + random() * 2.2, water.surface - 0.1, z + random(), 2.4 + random() * 1.4, random() * TAU);
  }
  for (const s of level.solids) {
    if (s.kind !== 'bank' || s.top - water.surface > 0.5 || s.halfX > 15) continue;
    const around = Math.round((s.halfX + s.halfZ) * 1.6);
    for (let i = 0; i < around; i += 1) {
      const side = random() * 4;
      const t = random() * 2 - 1;
      const [x, z] =
        side < 1 ? [s.x - s.halfX - 0.3, s.z + t * s.halfZ] : side < 2 ? [s.x + s.halfX + 0.3, s.z + t * s.halfZ] : side < 3 ? [s.x + t * s.halfX, s.z - s.halfZ - 0.3] : [s.x + t * s.halfX, s.z + s.halfZ + 0.3];
      decor.grass(x, water.surface - 0.1, z, 2 + random() * 1.2, random() * TAU);
    }
  }
  // The reed beds of the shallows: clumps in the open water either side of the swims, clear of the way across.
  for (const pool of level.water ?? []) {
    const length = pool.maxZ - pool.minZ;
    const clumps = Math.round(length / 3);
    for (let i = 0; i < clumps; i += 1) {
      const z = pool.minZ + random() * length;
      const x = random() < 0.5 ? pool.minX + 1 + random() * 6 : pool.maxX - 1 - random() * 5;
      const clear = level.solids.some((s) => Math.abs(s.x - x) < s.halfX + 1.2 && Math.abs(s.z - z) < s.halfZ + 1.2);
      if (!clear) for (let k = 0; k < 4; k += 1) decor.grass(x + random() * 1.4, water.surface - 0.1, z + random() * 1.4, 2.4 + random() * 1.4, random() * TAU);
    }
  }

  // ---------- Pines on the shore ----------
  interface Pine {
    x: number;
    z: number;
    foot: number;
    tip: number;
    green: number;
    spread: number;
    girth: number;
  }
  const pines: Pine[] = [];
  const spreadFor = (crown: number): number => Math.min(5, Math.max(1.4, crown / CROWN_SHAPE));
  for (let i = 0; i < LAKE_LOOK.nearPines + LAKE_LOOK.farPines; i += 1) {
    const close = i < LAKE_LOOK.nearPines;
    const z = near - 10 + random() * (water.minZ - 40 - near + 10);
    const inland = close ? 4 + random() * 14 : 18 + random() * 110;
    const x = shoreLine(z) - inland;
    const foot = groundAt(x, z);
    const tall = close ? 9 + random() * 10 : 14 + random() * 18;
    const green = foot + tall * (0.18 + random() * 0.15);
    pines.push({ x, z, foot, tip: foot + tall, green, spread: spreadFor(foot + tall - green), girth: 0.3 + random() * 0.3 });
  }
  const place = new Object3D();
  const tint = new Color();
  const greens = [0x9ccfa6, 0xb5dca4, 0xa6d0b0, 0x8fc49c];
  const closePines = pines.slice(0, LAKE_LOOK.nearPines);
  const farPines = pines.slice(LAKE_LOOK.nearPines);
  const crownSets: Array<[BufferGeometry, Pine[]]> = [
    [crownGeometry(11, 22, 10), closePines.filter((_, i) => i % 2 === 0)],
    [crownGeometry(29, 20, 9), closePines.filter((_, i) => i % 2 === 1)],
    [crownGeometry(61, 9, 6, 2), farPines],
  ];
  const crowns = crownSets.map(([shape, some]) => {
    const mesh = new InstancedMesh(shape, materials.foliage, Math.max(some.length, 1));
    some.forEach((pine, i) => {
      place.position.set(pine.x, pine.green, pine.z);
      place.rotation.set(0, random() * TAU, 0);
      place.scale.set(pine.spread, pine.tip - pine.green, pine.spread);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
      mesh.setColorAt(i, tint.setHex(greens[Math.floor(random() * greens.length)]));
    });
    mesh.count = some.length;
    group.add(mesh);
    return mesh;
  });
  const trunks = new InstancedMesh(trunkGeometry(), materials.bark, pines.length);
  pines.forEach((pine, i) => {
    place.position.set(pine.x, pine.foot - 0.5, pine.z);
    place.rotation.set(0, random() * TAU, 0);
    place.scale.set(pine.girth, pine.tip - pine.foot, pine.girth);
    place.updateMatrix();
    trunks.setMatrixAt(i, place.matrix);
  });
  trunks.castShadow = true;
  group.add(trunks);

  // ---------- The log boom along the right ----------
  // Logs end to end on the water, chained, just past where a swimmer can go.
  const boomX = water.maxX + LAKE_LOOK.boomOut;
  const boomCount = Math.ceil((water.maxZ - water.minZ + 8) / LAKE_LOOK.boomLog);
  const boom = new InstancedMesh(new CylinderGeometry(0.34, 0.36, LAKE_LOOK.boomLog - 0.25, 10, 1), materials.bark, boomCount);
  boom.castShadow = true;
  boom.receiveShadow = true;
  const boomBob = Array.from({ length: boomCount }, () => random() * TAU);
  const placeBoom = (time: number): void => {
    for (let i = 0; i < boomCount; i += 1) {
      const z = water.maxZ + 4 - (i + 0.5) * LAKE_LOOK.boomLog;
      place.position.set(boomX + Math.sin(i * 1.7) * 0.25, water.surface + 0.08 + Math.sin(time * 1.1 + boomBob[i]) * 0.04, z);
      place.rotation.set(Math.PI / 2, 0, Math.sin(time * 0.8 + boomBob[i]) * 0.03 + Math.sin(i * 2.3) * 0.05);
      place.scale.set(1, 1, 1);
      place.updateMatrix();
      boom.setMatrixAt(i, place.matrix);
    }
    boom.instanceMatrix.needsUpdate = true;
  };
  placeBoom(0);
  group.add(boom);

  // ---------- The sky, with the mountains across the water ----------
  const glowTurn = Math.atan2(-0.85, 0.5) / TAU;
  const sky = new Mesh(
    new SphereGeometry(430, 32, 16),
    new MeshBasicMaterial({ map: skyPicture(((glowTurn % 1) + 1) % 1, 0.32), side: BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  sky.add(mountains());
  group.add(sky);

  return {
    group,
    sky,
    crowns,
    update(time) {
      placeBoom(time);
    },
    lakeBed: true,
    fog: LAKE_LOOK.haze,
    setDetail(share) {
      // On the slowest machines, half the pines on the hills.
      crowns[2].count = Math.ceil(farPines.length * (share < 0.3 ? 0.5 : 1));
    },
  };
};
