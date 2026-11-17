// The surroundings of a lake level (Cocolalla): a wooded shore round the south,
// west and east of the water with rocks and reeds at the waterline, open
// water to the north reaching off to the Selkirk mountains, any wooded island
// the level has, and log booms that mark where the swimming stops. Looks
// only: what a hero can stand on or swim in comes from the level.
//
// It lays itself out from the level's own pools. The box that holds them all
// is the lake: the shore rises just outside it on three sides, and the open
// water carries on to the north. A log boom floats along every edge of a pool
// that is not shore or rock, because the sides of a pool hold a swimmer in. A
// solid of kind `island` is drawn here as a steep, wooded rise. No pine stands
// where it would come between the camera and the route.

import { lakeBed } from './underwater';
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
import type { Level, Solid } from '../game/level';
import { cameraFor, forwardOf } from './route-camera';
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
  /** How far past the edge of the water the shore line runs, on average, and how much it wanders. */
  shoreOut: 2.6,
  shoreWander: 1.6,
  /** How steeply the shore rises inland, and how high its hills reach. */
  shoreRise: 0.22,
  hills: 26,
  /** The pines on the shore: how many near the water, and how many on the hills behind. */
  nearPines: 30,
  farPines: 100,
  /** The pines on a wooded island: one for about this many square metres, and how far in from its shore the first stand. */
  islandPineArea: 70,
  islandPineIn: 6,
  /** No pine stands this close to the line from the camera to any part of the route. */
  clearOfView: 9,
  /** The log boom: how long each log is. */
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
  const pools = level.water ?? [];
  const simple = materials.simple;
  const reach = 190;
  const islands = level.solids.filter((s) => s.kind === 'island');

  // ---------- The open water round the pools, and the lake bed under everything ----------
  // The pools draw their own water. Wherever no pool lies (round the lake, and in
  // any backwater between pools) the lake carries on with the same look, out to
  // where the haze closes in. One bed lies under all of it.
  const openLook = surfaceMaterial(simple);
  const bedLook = basinMaterial(materials.ground, water.surface, true);
  const sheet = (x0: number, x1: number, z0: number, z1: number, cell = 2.5): void => {
    if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
    // Points about every two and a half metres close by: enough for the waves to catch the light. Far off, far fewer.
    const mesh = new Mesh(new PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / cell), Math.ceil((z1 - z0) / cell)), openLook);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, water.surface, (z0 + z1) / 2);
    mesh.renderOrder = 2;
    group.add(mesh);
  };
  // Round the lake's box: a near band north of it, where the lake is open, and the far water beyond in bigger pieces.
  const band = 50;
  sheet(water.minX - band, water.maxX + band, water.minZ - band, water.minZ);
  sheet(water.minX - reach, water.maxX + reach, water.minZ - reach * 2, water.minZ - band, 12);
  sheet(water.minX - reach, water.minX - band, water.minZ - band, water.minZ, 12);
  sheet(water.maxX + band, water.maxX + reach, water.minZ - band, water.minZ, 12);
  // South, west and east of it the shore is close: a strip of water under its edge is all that shows.
  sheet(water.minX - reach, water.maxX + reach, water.maxZ, water.maxZ + 40, 6);
  sheet(water.minX - reach, water.minX, water.minZ, water.maxZ, 6);
  sheet(water.maxX, water.maxX + reach, water.minZ, water.maxZ, 6);
  // Inside the box: every patch no pool covers, unless an island fills it.
  const cuts = (values: number[]): number[] => [...new Set(values.map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  const xs = cuts([water.minX, water.maxX, ...pools.flatMap((p) => [p.minX, p.maxX])]);
  const zs = cuts([water.minZ, water.maxZ, ...pools.flatMap((p) => [p.minZ, p.maxZ])]);
  for (let i = 0; i + 1 < xs.length; i += 1) {
    for (let k = 0; k + 1 < zs.length; k += 1) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cz = (zs[k] + zs[k + 1]) / 2;
      if (pools.some((p) => cx > p.minX && cx < p.maxX && cz > p.minZ && cz < p.maxZ)) continue;
      if (islands.some((s) => Math.abs(cx - s.x) < s.halfX - 2 && Math.abs(cz - s.z) < s.halfZ - 2 && xs[i] >= s.x - s.halfX && xs[i + 1] <= s.x + s.halfX && zs[k] >= s.z - s.halfZ && zs[k + 1] <= s.z + s.halfZ)) continue;
      sheet(xs[i], xs[i + 1], zs[k], zs[k + 1]);
    }
  }
  const bed = new Mesh(new PlaneGeometry(water.maxX - water.minX + reach * 2, water.maxZ - water.minZ + reach * 2 + 40), bedLook);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set((water.minX + water.maxX) / 2, water.floor - 0.3, (water.minZ - reach * 2 + water.maxZ + 40) / 2);
  bed.receiveShadow = true;
  group.add(bed);
  // On the bed, in the pools: rocks, weed and sunken logs (src/view/underwater.ts).
  group.add(lakeBed(level, materials, water.floor - 0.3, simple));

  // ---------- The shore: south, west and east of the water ----------
  // To the north the west and east shores bend away, and the lake opens out toward the mountains.
  const opening = (z: number): number => 110 * smooth(water.minZ - 6, water.minZ - 150, z) ** 1.5;
  const wander = (along: number, seed: number): number => LAKE_LOOK.shoreOut + LAKE_LOOK.shoreWander * rough(along * 0.035, seed, 0, 3);
  /** How far inland a spot is: more than 0 on land, less in the water. */
  const inlandAt = (x: number, z: number): number =>
    Math.max(z - (water.maxZ + wander(x, 5.3)), water.minX - wander(z, 1.7) - opening(z) - x, x - (water.maxX + wander(z, 8.9) + opening(z)));
  /** The ground's height at (x, z): under water inside the shore line, rising to hills inland. */
  const groundAt = (x: number, z: number): number => {
    const inland = inlandAt(x, z);
    // Under the water it slopes down to the lake bed and no further.
    if (inland < 0) return Math.max(water.surface + inland * 0.9 - 0.15, water.floor - 0.3);
    // The hills sink away far to the north, so nothing stands up out of the haze there: the mountains close the view.
    const fade = 1 - smooth(water.minZ - 20, water.minZ - 140, z);
    const hill = LAKE_LOOK.hills * fade * smooth(8, 90, inland) * (0.55 + 0.45 * rough(x * 0.012, z * 0.012, 4.2, 3));
    return water.surface - 0.15 + inland * LAKE_LOOK.shoreRise * (1 - smooth(10, 40, inland) * 0.6) + hill;
  };
  // One sheet of ground under and round the lake, with more points near the water where the shape changes fastest.
  const spread = (share: number, low: number, high: number, margin: number, far: number): number => {
    // The first and last fifth of the points cover the far ground; the rest, the lake and its shores.
    if (share < 0.2) return low - margin - far * (1 - share / 0.2) ** 1.5;
    if (share > 0.8) return high + margin + far * ((share - 0.8) / 0.2) ** 1.5;
    return low - margin + ((share - 0.2) / 0.6) * (high - low + margin * 2);
  };
  const shore = new Mesh(
    surface(simple ? 70 : 110, simple ? 70 : 110, (across, down, point) => {
      point.x = spread(across, water.minX, water.maxX, 34, 200);
      point.z = spread(1 - down, water.minZ, water.maxZ, 34, 200);
      if (down > 0.8) point.z = water.minZ - 34 - 400 * ((down - 0.8) / 0.2) ** 1.5;
      point.y = groundAt(point.x, point.z);
      point.s = point.x / 6;
      point.t = point.z / 6;
      point.moss = smooth(0.2, 1.5, point.y - water.surface);
    }, { flip: true }),
    bedLook,
  );
  shore.receiveShadow = true;
  shore.name = 'lake-shore';
  group.add(shore);

  // ---------- A wooded island: a steep rise out of the water, flat-topped ----------
  /** How far inside an island's edge a spot is (less than 0 outside), with a wobble so the shore is not a ruled line. */
  const insideOf = (s: Solid, x: number, z: number): number =>
    Math.min(s.halfX - Math.abs(x - s.x), s.halfZ - Math.abs(z - s.z)) + 0.5 * rough(x * 0.11, z * 0.11, 2.4, 2);
  const islandTop = (s: Solid, x: number, z: number): number => {
    const inside = insideOf(s, x, z);
    // Out of the water at its edge, then a bank that climbs to a rolling top a few metres in.
    if (inside < 0) return Math.max(water.floor - 0.3, water.surface - 0.1 + inside * 1.1);
    const rise = smooth(0, 7, inside);
    const roll = smooth(2, 14, inside) * 1.8 * (0.5 + 0.5 * rough(x * 0.05, z * 0.05, 7.1, 3));
    return water.surface - 0.1 + (s.top - water.surface) * rise + roll;
  };
  for (const s of islands) {
    const mound = new Mesh(
      surface(Math.max(12, Math.round(s.halfZ)), Math.max(12, Math.round(s.halfX)), (across, down, point) => {
        point.x = s.x + (across * 2 - 1) * (s.halfX + 3);
        point.z = s.z + (down * 2 - 1) * (s.halfZ + 3);
        point.y = islandTop(s, point.x, point.z);
        point.s = point.x / 6;
        point.t = point.z / 6;
        point.moss = smooth(0.6, 2.4, point.y - water.surface);
      }, { flip: true }),
      bedLook,
    );
    mound.receiveShadow = true;
    mound.castShadow = true;
    mound.name = 'lake-island';
    group.add(mound);
    // Rocks and reeds round its waterline.
    const around = Math.round((s.halfX + s.halfZ) * 1.1);
    for (let i = 0; i < around; i += 1) {
      const side = random() * 4;
      const t = random() * 2 - 1;
      const [x, z] = side < 1 ? [s.x - s.halfX, s.z + t * s.halfZ] : side < 2 ? [s.x + s.halfX, s.z + t * s.halfZ] : side < 3 ? [s.x + t * s.halfX, s.z - s.halfZ] : [s.x + t * s.halfX, s.z + s.halfZ];
      if (level.solids.some((other) => other !== s && Math.abs(other.x - x) < other.halfX + 1.5 && Math.abs(other.z - z) < other.halfZ + 1.5)) continue;
      if (random() < 0.6) decor.rock(x, water.surface - 0.2, z, 0.6 + random() * 1.1, random() * TAU);
      else decor.grass(x, water.surface - 0.1, z, 2.2 + random() * 1.4, random() * TAU);
    }
  }

  // ---------- Where no pine may stand: between the camera and the route ----------
  const sights: Array<{ ax: number; az: number; bx: number; bz: number }> = [];
  for (const id of level.route) {
    const s = level.solids.find((solid) => solid.id === id);
    if (!s) continue;
    const view = cameraFor(level, id);
    const ahead = forwardOf(view.facing);
    // The camera sits about 12 m behind the hero, times the section's pull; allow for a swim's width either side.
    const back = 14 * view.pull;
    sights.push({ ax: s.x, az: s.z, bx: s.x - ahead.x * back, bz: s.z - ahead.z * back });
  }
  const inView = (x: number, z: number): boolean =>
    sights.some(({ ax, az, bx, bz }) => {
      const lx = bx - ax;
      const lz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * lx + (z - az) * lz) / (lx * lx + lz * lz || 1)));
      return Math.hypot(x - ax - lx * t, z - az - lz * t) < LAKE_LOOK.clearOfView;
    });

  // Rocks and reeds along the waterline, and reeds round the edges of the low banks out in the lake.
  const waterline = (x: number, z: number, step: (dx: number, dz: number) => void): void => {
    if (random() < 0.55) decor.rock(x + random() * 1.2, water.surface - 0.25, z + random() * 1.2, 0.45 + random() * 0.9, random() * TAU);
    if (random() < 0.8) step(random() * 2.2, random());
  };
  for (let x = water.minX - 6; x < water.maxX + 6; x += 1.6) {
    const z = water.maxZ + wander(x, 5.3);
    waterline(x, z - 0.4, (dx, dz) => decor.grass(x + dz, water.surface - 0.1, z - 0.6 - dx, 2.4 + random() * 1.4, random() * TAU));
  }
  for (let z = water.maxZ + 4; z > water.minZ - 10; z -= 1.6) {
    const west = water.minX - wander(z, 1.7) - opening(z);
    waterline(west + 0.4, z, (dx, dz) => decor.grass(west + 0.6 + dx, water.surface - 0.1, z + dz, 2.4 + random() * 1.4, random() * TAU));
    const east = water.maxX + wander(z, 8.9) + opening(z);
    waterline(east - 0.4, z, (dx, dz) => decor.grass(east - 0.6 - dx, water.surface - 0.1, z + dz, 2.4 + random() * 1.4, random() * TAU));
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
  // Reed beds: clumps in the water by the shores, clear of anything to stand on and of the way through.
  const clearOfSolids = (x: number, z: number): boolean => !level.solids.some((s) => Math.abs(s.x - x) < s.halfX + 2.5 && Math.abs(s.z - z) < s.halfZ + 2.5);
  const clumps = Math.round((water.maxX - water.minX + (water.maxZ - water.minZ) * 2) / 3.2);
  for (let i = 0; i < clumps; i += 1) {
    const pick = random();
    const x = pick < 0.4 ? water.minX + random() * (water.maxX - water.minX) : pick < 0.7 ? water.minX + 0.5 + random() * 4 : water.maxX - 0.5 - random() * 4;
    const z = pick < 0.4 ? water.maxZ - 0.5 - random() * 3 : water.minZ + random() * (water.maxZ - water.minZ);
    if (!clearOfSolids(x, z)) continue;
    for (let k = 0; k < 4; k += 1) decor.grass(x + random() * 1.4, water.surface - 0.1, z + random() * 1.4, 2.4 + random() * 1.4, random() * TAU);
  }

  // ---------- Pines on the shores and on the islands ----------
  interface Pine {
    x: number;
    z: number;
    foot: number;
    tip: number;
    green: number;
    spread: number;
    girth: number;
  }
  const spreadFor = (crown: number): number => Math.min(5, Math.max(1.4, crown / CROWN_SHAPE));
  const pine = (x: number, z: number, foot: number, tall: number): Pine => {
    const green = foot + tall * (0.18 + random() * 0.15);
    return { x, z, foot, tip: foot + tall, green, spread: spreadFor(foot + tall - green), girth: 0.3 + random() * 0.3 };
  };
  const closePines: Pine[] = [];
  const farPines: Pine[] = [];
  const width = water.maxX - water.minX;
  const length = water.maxZ - water.minZ;
  for (let i = 0; i < LAKE_LOOK.nearPines + LAKE_LOOK.farPines; i += 1) {
    const close = i < LAKE_LOOK.nearPines;
    const inland = close ? 4 + random() * 14 : 18 + random() * 110;
    // A place along the shore: the south, the west or the east, by how long each is.
    const along = random() * (width + length * 2 + 80);
    let x: number;
    let z: number;
    if (along < width + 40) {
      x = water.minX - 20 + along;
      z = water.maxZ + wander(x, 5.3) + inland;
    } else {
      const west = along < width + 40 + length + 20;
      z = water.maxZ + 10 - random() * (length + 50);
      x = west ? water.minX - wander(z, 1.7) - opening(z) - inland : water.maxX + wander(z, 8.9) + opening(z) + inland;
    }
    if (inView(x, z)) continue;
    const made = pine(x, z, groundAt(x, z), close ? 9 + random() * 10 : 14 + random() * 18);
    (close ? closePines : farPines).push(made);
  }
  for (const s of islands) {
    const count = Math.round((s.halfX * s.halfZ * 4) / LAKE_LOOK.islandPineArea);
    for (let i = 0; i < count; i += 1) {
      const x = s.x + (random() * 2 - 1) * (s.halfX - LAKE_LOOK.islandPineIn);
      const z = s.z + (random() * 2 - 1) * (s.halfZ - LAKE_LOOK.islandPineIn);
      if (inView(x, z)) continue;
      // Two in three wear the lighter crown the far hills' pines have.
      (i % 3 === 0 ? closePines : farPines).push(pine(x, z, islandTop(s, x, z), 8 + random() * 9));
    }
  }
  const pines = [...closePines, ...farPines];
  const place = new Object3D();
  const tint = new Color();
  const greens = [0x9ccfa6, 0xb5dca4, 0xa6d0b0, 0x8fc49c];
  const crownSets: Array<[BufferGeometry, Pine[]]> = [
    [crownGeometry(11, 22, 10), closePines.filter((_, i) => i % 2 === 0)],
    [crownGeometry(29, 20, 9), closePines.filter((_, i) => i % 2 === 1)],
    [crownGeometry(61, 9, 6, 2), farPines],
  ];
  const crowns = crownSets.map(([shape, some]) => {
    const mesh = new InstancedMesh(shape, materials.foliage, Math.max(some.length, 1));
    some.forEach((tree, i) => {
      place.position.set(tree.x, tree.green, tree.z);
      place.rotation.set(0, random() * TAU, 0);
      place.scale.set(tree.spread, tree.tip - tree.green, tree.spread);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
      mesh.setColorAt(i, tint.setHex(greens[Math.floor(random() * greens.length)]));
    });
    mesh.count = some.length;
    group.add(mesh);
    return mesh;
  });
  const trunks = new InstancedMesh(trunkGeometry(), materials.bark, Math.max(pines.length, 1));
  pines.forEach((tree, i) => {
    place.position.set(tree.x, tree.foot - 0.5, tree.z);
    place.rotation.set(0, random() * TAU, 0);
    place.scale.set(tree.girth, tree.tip - tree.foot, tree.girth);
    place.updateMatrix();
    trunks.setMatrixAt(i, place.matrix);
  });
  trunks.count = pines.length;
  trunks.castShadow = true;
  group.add(trunks);

  // ---------- The log booms ----------
  // Logs end to end on the water, chained, along every edge of a pool where the swimming
  // stops and nothing else shows it: not along the shores, and not where rock or a bank stands.
  const booms: Array<{ x: number; z: number; alongX: boolean }> = [];
  const seen = new Set<string>();
  const boomAt = (x: number, z: number, alongX: boolean): void => {
    const key = `${Math.round(x * 2)}:${Math.round(z * 2)}:${alongX}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (level.solids.some((s) => Math.abs(s.x - x) < s.halfX + 0.6 && Math.abs(s.z - z) < s.halfZ + 0.6 && s.top > water.surface - 0.5 && s.bottom < water.surface)) return;
    booms.push({ x, z, alongX });
  };
  const close = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
  for (const p of pools) {
    const acrossCount = Math.max(1, Math.round((p.maxX - p.minX) / LAKE_LOOK.boomLog));
    const alongCount = Math.max(1, Math.round((p.maxZ - p.minZ) / LAKE_LOOK.boomLog));
    for (let i = 0; i < acrossCount; i += 1) {
      const x = p.minX + ((i + 0.5) / acrossCount) * (p.maxX - p.minX);
      // The south edge of the lake is shore; every other east-west edge gets a boom.
      boomAt(x, p.minZ, true);
      if (!close(p.maxZ, water.maxZ)) boomAt(x, p.maxZ, true);
    }
    for (let i = 0; i < alongCount; i += 1) {
      const z = p.minZ + ((i + 0.5) / alongCount) * (p.maxZ - p.minZ);
      if (!close(p.minX, water.minX)) boomAt(p.minX, z, false);
      if (!close(p.maxX, water.maxX)) boomAt(p.maxX, z, false);
    }
  }
  const boom = new InstancedMesh(new CylinderGeometry(0.34, 0.36, LAKE_LOOK.boomLog - 0.25, 10, 1), materials.bark, Math.max(booms.length, 1));
  boom.count = booms.length;
  boom.castShadow = true;
  boom.receiveShadow = true;
  boom.name = 'lake-boom';
  const boomBob = booms.map(() => random() * TAU);
  const placeBoom = (time: number): void => {
    booms.forEach((log, i) => {
      const drift = Math.sin(i * 1.7) * 0.2;
      place.position.set(log.x + (log.alongX ? 0 : drift), water.surface + 0.08 + Math.sin(time * 1.1 + boomBob[i]) * 0.04, log.z + (log.alongX ? drift : 0));
      const roll = Math.sin(time * 0.8 + boomBob[i]) * 0.03 + Math.sin(i * 2.3) * 0.05;
      // The log's own length runs up and down until it is laid over: along z, or along x.
      if (log.alongX) place.rotation.set(0, roll, Math.PI / 2);
      else place.rotation.set(Math.PI / 2, 0, roll);
      place.scale.set(1, 1, 1);
      place.updateMatrix();
      boom.setMatrixAt(i, place.matrix);
    });
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
