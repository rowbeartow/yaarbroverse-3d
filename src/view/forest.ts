// The forest around the route: the misty gully below, the slopes on either
// side, firs and cedars with real boughs, ferns, grass, boulders, drifting mist,
// shafts of light and floating dust. Plain scenery: none of it can be stood on
// and the rules never read any of it.

import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
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
  SphereGeometry,
  type Material,
} from 'three';
import type { Level } from '../game/level';
import type { Materials } from './materials';
import { noise, rough, smooth } from './noise';
import { canopyPicture, glowPicture, mistPicture, rayPicture, skyPicture } from './pictures';
import { MIST_BOTTOM, MIST_TOP, type Decor } from './scenery';
import { surface } from './surface';

const TAU = Math.PI * 2;

// ---------- The ground ----------

/**
 * Height of the forest floor. The route crosses a gully: deep and misty under
 * the path, rising to wooded slopes on both sides and a hillside at the far end.
 */
export const groundHeight = (x: number, z: number, farEnd: number): number => {
  const wander = 2.5 * rough(z * 0.02, 3.3);
  const gullyHalf = 15 + 3 * rough(z * 0.03, 7.7);
  const out = Math.abs(x - wander) - gullyHalf;
  const floor = -13 + 1.2 * rough(x * 0.08, 1.3, z * 0.08);
  const rise = 13.6 * smooth(0, 12, out);
  const beyond = Math.max(0, out - 12) * 0.18;
  const bumps = 0.7 * rough(x * 0.11, 5.1, z * 0.11) * smooth(0, 7, out);
  // Past the great cedar the ground climbs, closing the view.
  const hill = Math.max(0, farEnd - 14 - z) * 0.3 * smooth(-4, 14, Math.abs(x) + (farEnd - 14 - z) * 0.5);
  return floor + rise + beyond + bumps + hill;
};

// ---------- Shapes drawn many times ----------

/** Adds one flat strip (a bough, a frond, a blade) to the lists that make up a shape. */
interface StripLists {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  sway: number[];
  index: number[];
}

const emptyLists = (): StripLists => ({ positions: [], normals: [], uvs: [], colors: [], sway: [], index: [] });

const toGeometry = (lists: StripLists): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(lists.positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(lists.normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(lists.uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(lists.colors, 3));
  geometry.setAttribute('sway', new Float32BufferAttribute(lists.sway, 1));
  geometry.setIndex(lists.index);
  return geometry;
};

/**
 * A strip running out from (x, y, z) in direction `turn`, following `path`
 * (how far out and how high at each step). `tone` shades it along its length.
 */
const strip = (
  lists: StripLists,
  x: number,
  y: number,
  z: number,
  turn: number,
  steps: number,
  path: (along: number) => { out: number; up: number; halfWidth: number },
  tone: (along: number) => [number, number, number],
  swayAmount = 1,
): void => {
  const start = lists.positions.length / 3;
  const forwardX = Math.cos(turn);
  const forwardZ = Math.sin(turn);
  const sideX = -forwardZ;
  const sideZ = forwardX;
  for (let i = 0; i <= steps; i += 1) {
    const along = i / steps;
    const { out, up, halfWidth } = path(along);
    const [r, g, b] = tone(along);
    for (const side of [-1, 1]) {
      lists.positions.push(x + forwardX * out + sideX * halfWidth * side, y + up, z + forwardZ * out + sideZ * halfWidth * side);
      // Lit as if facing up and a little outward, which keeps foliage soft.
      const nx = forwardX * 0.45 + sideX * side * 0.12;
      const nz = forwardZ * 0.45 + sideZ * side * 0.12;
      const length = Math.hypot(nx, 0.85, nz);
      lists.normals.push(nx / length, 0.85 / length, nz / length);
      lists.uvs.push(side < 0 ? 0 : 1, along);
      lists.colors.push(r, g, b);
      lists.sway.push(along * along * swayAmount);
    }
    if (i < steps) {
      const a = start + i * 2;
      lists.index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
};

/** Crowns are drawn this many times taller than their lowest boughs reach. */
const CROWN_SHAPE = 4;

/**
 * The green of one conifer, one unit tall and one unit in reach at the bottom:
 * a cone that narrows to a point, made of tiers of boughs. Each bough is a flat
 * spray that leaves the trunk angled out and a little down, as fir and cedar
 * boughs do, with its tip turning up. A dark inner cone fills the middle, so
 * the tree is solid from the side and the tiers show as lighter edges.
 *
 * It is made for a tree CROWN_SHAPE times taller than its reach, which is how
 * trees are sized below, so a bough's slope comes out right in metres.
 */
const crownGeometry = (seed: number, tiers: number, fullest: number, steps = 4): BufferGeometry => {
  const lists = emptyLists();
  let random = seed;
  const next = (): number => {
    random = (random * 16807) % 2147483647;
    return random / 2147483647;
  };
  /** How far the boughs reach at a height: widest at the bottom, a point at the top. */
  const reachAt = (height: number): number => 0.11 + 0.89 * (1 - height) ** 0.95;

  // The inner cone. Its colour comes from one dark spot of the bough picture.
  const sides = 7;
  const rings = 5;
  const coreStart = lists.positions.length / 3;
  for (let r = 0; r <= rings; r += 1) {
    const height = (r / rings) * 0.97 - 0.02;
    const radius = 0.24 * reachAt(Math.max(height, 0)) * (r === rings ? 0.2 : 1);
    for (let k = 0; k <= sides; k += 1) {
      const angle = (k / sides) * TAU;
      lists.positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
      const out = Math.hypot(1, 0.24 / CROWN_SHAPE);
      lists.normals.push(Math.cos(angle) / out, 0.24 / CROWN_SHAPE / out, Math.sin(angle) / out);
      lists.uvs.push(0.47, 0.3);
      // That spot of the picture is very dark, so these are well over 1 to bring it up to a deep green.
      const dark = 1.5 + 0.5 * (r / rings) + 0.3 * (((k * 5 + r * 3) % 4) / 3);
      lists.colors.push(dark * 0.9, dark, dark * 0.85);
      lists.sway.push(0);
    }
  }
  for (let r = 0; r < rings; r += 1) {
    for (let k = 0; k < sides; k += 1) {
      const a = coreStart + r * (sides + 1) + k;
      const c = a + sides + 1;
      lists.index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }

  for (let t = 0; t < tiers; t += 1) {
    // Tiers sit closer together toward the top, where the boughs are short.
    const height = 1 - (1 - t / tiers) ** 1.2;
    const reach = reachAt(height);
    const count = Math.max(6, Math.round(fullest * (0.55 + 0.45 * (1 - height))));
    // How steeply a bough leaves the trunk: about 30 degrees below level at
    // the bottom of the tree, easing to 20 at the top. Never level: a flat
    // bough seen from the side is a line, and the tree turns into plates.
    const slope = 0.6 - 0.24 * height;
    const offset = next() * TAU;
    // Every other tier a touch darker, so the tiers read apart.
    const tierShade = (t % 2 === 0 ? 0.92 : 1.04) * (0.7 + 0.3 * height);
    for (let k = 0; k < count; k += 1) {
      const turn = offset + ((k + (next() - 0.5) * 0.5) / count) * TAU;
      const length = reach * (0.82 + next() * 0.26);
      const y = height + (next() - 0.5) * (0.35 / tiers);
      const shade = tierShade * (0.94 + next() * 0.14);
      const lean = slope * (0.85 + next() * 0.3);
      // Wide enough at the far end to meet its neighbours and close the tier.
      const fan = Math.min(0.62, Math.tan((Math.PI / count) * 1.25));
      strip(
        lists,
        0,
        y,
        0,
        turn,
        steps,
        (along) => ({
          out: 0.02 + length * along,
          // Out and a little down, sagging slightly, with the tip turning up.
          up: (-lean * length * along - 0.1 * length * along * along + 0.17 * length * along ** 4) / CROWN_SHAPE,
          halfWidth: length * (0.07 + fan * along ** 0.75),
        }),
        (along) => {
          const light = shade * (0.4 + 0.72 * along);
          return [light * 0.9, light, light * 0.88];
        },
      );
    }
  }
  // The leader: a few short boughs standing up at the very top.
  for (let k = 0; k < 3; k += 1) {
    strip(
      lists,
      0,
      0.95,
      0,
      (k / 3) * TAU,
      2,
      (along) => ({ out: 0.035 * along, up: 0.085 * along, halfWidth: 0.05 * (1 - along * 0.7) }),
      () => [1, 1.05, 0.95],
      0.4,
    );
  }
  return toGeometry(lists);
};

/**
 * One trunk, one unit tall and one unit in radius at the foot: straight,
 * tapering to almost nothing at the tip, flaring into roots at the ground.
 */
const trunkGeometry = (): BufferGeometry =>
  surface(
    6,
    10,
    (across, rowShare, point) => {
      // Most of the rows sit near the foot, where the roots flare out.
      const down = rowShare ** 0.45;
      const angle = across * TAU;
      const flare = 1 + 1.3 * smooth(0.9, 1, down) ** 2 * (1 + 0.5 * Math.sin(angle * 4 + 1));
      const radius = (0.1 + 0.9 * down ** 0.7) * flare * (1 + 0.05 * Math.sin(angle * 3 + down * 9));
      point.x = Math.cos(angle) * radius;
      point.y = 1 - down;
      point.z = Math.sin(angle) * radius;
      point.s = across * 3;
      point.t = down * 10;
      point.moss = smooth(0.45, 0.8, noise(Math.cos(angle) * 1.4, down * 7, Math.sin(angle) * 1.4)) * 0.9;
    },
    { closed: true },
  );

/** A clump of fern fronds arching out from one point, about one unit across. */
const fernGeometry = (): BufferGeometry => {
  const lists = emptyLists();
  const fronds = 7;
  for (let k = 0; k < fronds; k += 1) {
    const turn = (k / fronds) * TAU + (k % 2) * 0.3;
    const length = 0.85 + (k % 3) * 0.12;
    strip(
      lists,
      0,
      0,
      0,
      turn,
      4,
      (along) => ({
        out: length * (0.08 + 0.92 * along) * 0.9,
        up: length * 0.62 * Math.sin(along * Math.PI * 0.72),
        halfWidth: length * 0.2,
      }),
      (along) => {
        const light = 0.62 + 0.45 * along;
        return [light, light, light];
      },
    );
  }
  return toGeometry(lists);
};

/** A tuft of grass blades, about half a unit tall. */
const grassGeometry = (): BufferGeometry => {
  const lists = emptyLists();
  const blades = 9;
  for (let k = 0; k < blades; k += 1) {
    const turn = (k / blades) * TAU + ((k * 7) % 5) * 0.2;
    const height = 0.34 + ((k * 5) % 4) * 0.07;
    const lean = 0.1 + ((k * 3) % 5) * 0.045;
    const startOut = 0.03 + ((k * 11) % 6) * 0.018;
    strip(
      lists,
      0,
      0,
      0,
      turn,
      3,
      (along) => ({ out: startOut + lean * along * along, up: height * along, halfWidth: 0.028 * (1 - along * 0.85) }),
      (along) => [0.1 + 0.26 * along, 0.24 + 0.36 * along, 0.06 + 0.1 * along],
    );
  }
  return toGeometry(lists);
};

/** A boulder, about one unit across, with moss on its upper side. */
const rockGeometry = (): BufferGeometry => {
  const geometry = new IcosahedronGeometry(1, 1);
  const position = geometry.getAttribute('position');
  const moss = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump = 1 + 0.3 * rough(x * 1.3, y * 1.3, z * 1.3);
    position.setXYZ(i, x * lump, y * lump * 0.72, z * lump);
    moss[i] = smooth(0.15, 0.7, y) * (0.55 + 0.45 * noise(x * 2, y * 2, z * 2));
  }
  geometry.setAttribute('moss', new Float32BufferAttribute(moss, 1));
  geometry.computeVertexNormals();
  return geometry;
};

// ---------- Scatter: small things, drawn together ----------

interface Placed {
  x: number;
  y: number;
  z: number;
  size: number;
  turn: number;
}

/** Collects where ferns, grass and rocks go, then draws each kind in one go. */
export class Scatter implements Decor {
  private readonly ferns: Placed[] = [];
  private readonly tufts: Placed[] = [];
  private readonly rocks: Placed[] = [];
  private fernMesh: InstancedMesh | null = null;
  private grassMesh: InstancedMesh | null = null;

  fern(x: number, y: number, z: number, size: number, turn: number): void {
    this.ferns.push({ x, y, z, size, turn });
  }

  grass(x: number, y: number, z: number, size: number, turn: number): void {
    this.tufts.push({ x, y, z, size, turn });
  }

  rock(x: number, y: number, z: number, size: number, turn: number): void {
    this.rocks.push({ x, y, z, size, turn });
  }

  build(materials: Materials): Group {
    const group = new Group();
    const place = new Object3D();
    const make = (list: Placed[], geometry: BufferGeometry, material: Material, flat = 1): InstancedMesh => {
      const mesh = new InstancedMesh(geometry, material, Math.max(list.length, 1));
      list.forEach((item, i) => {
        place.position.set(item.x, item.y, item.z);
        place.rotation.set(0, item.turn, 0);
        place.scale.set(item.size, item.size * flat, item.size);
        place.updateMatrix();
        mesh.setMatrixAt(i, place.matrix);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    this.fernMesh = make(this.ferns, fernGeometry(), materials.fern);
    this.grassMesh = make(this.tufts, grassGeometry(), materials.grass);
    const rocks = make(this.rocks, rockGeometry(), materials.rock);
    rocks.castShadow = true;
    return group;
  }

  /** Draws only a share of the ferns and grass (0 to 1), for slower devices. */
  setDetail(share: number): void {
    // The lists are in scattered order, so dropping the tail thins them evenly.
    const kept = share < 0.3 ? share : 0.3 + 0.7 * share;
    if (this.fernMesh) this.fernMesh.count = Math.ceil(this.ferns.length * kept);
    if (this.grassMesh) this.grassMesh.count = Math.ceil(this.tufts.length * kept);
  }
}

// ---------- The forest ----------

export interface Forest {
  group: Group;
  /** The sky, which follows the camera so it is never reached. */
  sky: Mesh;
  /** Tree crowns, for turning their shadows on and off. */
  crowns: InstancedMesh[];
  /** Mist sheets, dust and light, moved a little each frame. */
  update(time: number): void;
  setDetail(share: number): void;
}

interface Tree {
  x: number;
  z: number;
  /** Height of the ground it stands on, of its tip, and of its lowest boughs. */
  foot: number;
  tip: number;
  green: number;
  girth: number;
  /** How far the lowest boughs reach. */
  spread: number;
  near: boolean;
}

export const buildForest = (level: Level, materials: Materials, decor: Decor, random: () => number): Forest => {
  const group = new Group();
  const far = Math.min(...level.solids.map((s) => s.z - s.halfZ));
  const top = Math.max(...level.solids.map((s) => s.top));
  const height = (x: number, z: number): number => groundHeight(x, z, far);

  // The ground: gully floor, slopes and the far hillside, as one smooth sheet.
  const nearEdge = 44;
  const farEdge = far - 120;
  const width = 190;
  const ground = new Mesh(
    surface(Math.round((nearEdge - farEdge) / 3.4), Math.round(width / 3.4), (across, down, point) => {
      point.x = (across - 0.5) * width;
      point.z = nearEdge + (farEdge - nearEdge) * down;
      point.y = height(point.x, point.z);
      point.s = point.x / 6;
      point.t = point.z / 6;
    }),
    materials.ground,
  );
  ground.receiveShadow = true;
  group.add(ground);

  // Trees on both sides, well clear of anything you can stand on: young firs
  // close by, with their green at the height you walk at, and tall cedars behind.
  const trees: Tree[] = [];
  const pathHeight = (z: number): number => top * Math.min(Math.max(z / far, 0), 1);
  /** How wide a crown of a given height spreads, so every tree keeps the same shape. */
  const spreadFor = (crownHeight: number): number => Math.min(5.5, Math.max(1.5, crownHeight / CROWN_SHAPE));
  for (let z = 26; z > far - 64; z -= 2.6) {
    for (const sign of [-1, 1]) {
      const near = random() < 0.6;
      const treeZ = z + random() * 2.6;
      // Nothing green closer than this to the middle of the path, so boughs
      // never hide a place to stand. Wider beside the start, where the camera sits.
      const clear = treeZ > -4 ? 12 : 7;
      if (near) {
        const tip = pathHeight(treeZ) + 3 + random() * 9;
        const green = MIST_TOP - 2.5;
        const spread = spreadFor(tip - green);
        const x = sign * (clear + spread + random() * 7);
        trees.push({ x, z: treeZ, foot: height(x, treeZ), tip, green, girth: 0.3 + random() * 0.18, spread, near: true });
      } else {
        const tip = top + 9 + random() * 18;
        const reachOut = 5 + random() * random() * 34;
        // Stand it first, to learn how tall it is, then give it room for its boughs.
        const roughX = sign * (clear + 5 + reachOut);
        const roughFoot = height(roughX, treeZ);
        const green = roughFoot + (tip - roughFoot) * (0.28 + random() * 0.2);
        const spread = spreadFor(tip - green);
        const x = sign * (clear + spread + reachOut);
        trees.push({ x, z: treeZ, foot: height(x, treeZ), tip, green, girth: 0.5 + random() * 0.45, spread, near: false });
      }
    }
  }
  // More on the far hillside, to close the view.
  for (let i = 0; i < 26; i += 1) {
    const x = (random() * 2 - 1) * 60;
    const z = far - 26 - random() * 70;
    const foot = height(x, z);
    const tall = 16 + random() * 20;
    const green = foot + tall * (0.25 + random() * 0.2);
    trees.push({ x, z, foot, tip: foot + tall, green, girth: 0.5 + random() * 0.5, spread: spreadFor(foot + tall - green), near: false });
  }

  const place = new Object3D();
  // Three crown shapes, so no two neighbours match: two full ones for trees near
  // the path and a lighter one for the many behind. A fourth, sparse one stands
  // in for all of them on the slowest machines.
  const shapes = [crownGeometry(11, 24, 10), crownGeometry(29, 22, 9), crownGeometry(47, 13, 7), crownGeometry(61, 9, 6, 2)];
  const lists: Tree[][] = [[], [], []];
  trees.forEach((tree, i) => lists[tree.near ? i % 2 : 2].push(tree));
  // Far trees go in scattered order, so drawing fewer of them thins the forest evenly.
  for (let i = lists[2].length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [lists[2][i], lists[2][j]] = [lists[2][j], lists[2][i]];
  }
  const tint = new Color();
  const greens = [0x9ccfa6, 0xb5dca4, 0xcfe6a0, 0xa6d0b0, 0xe4e88a];
  const trunkShape = trunkGeometry();
  const trunksFor = (list: Tree[]): InstancedMesh => {
    const mesh = new InstancedMesh(trunkShape, materials.bark, Math.max(list.length, 1));
    list.forEach((tree, i) => {
      place.position.set(tree.x, tree.foot - 0.6, tree.z);
      place.rotation.set(0, random() * TAU, 0);
      place.scale.set(tree.girth, tree.tip - tree.foot, tree.girth);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  trunksFor([...lists[0], ...lists[1]]);
  const farTrunks = trunksFor(lists[2]);
  // Near trees are listed twice: with a full crown, and with the lighter one
  // that stands in for it on the slowest machines. Only one set is drawn.
  const nearTrees = [...lists[0], ...lists[1]];
  const crownSets: Array<[BufferGeometry, Tree[]]> = [
    [shapes[0], lists[0]],
    [shapes[1], lists[1]],
    [shapes[2], lists[2]],
    [shapes[3], nearTrees],
    [shapes[3], lists[2]],
  ];
  const crowns = crownSets.map(([shape, list]) => {
    const mesh = new InstancedMesh(shape, materials.foliage, Math.max(list.length, 1));
    list.forEach((tree, i) => {
      place.position.set(tree.x, tree.green, tree.z);
      place.rotation.set(0, random() * TAU, 0);
      place.scale.set(tree.spread, tree.tip - tree.green, tree.spread);
      place.updateMatrix();
      mesh.setMatrixAt(i, place.matrix);
      // Mostly deep greens, with the odd young tree catching the light.
      const pick = random();
      mesh.setColorAt(i, tint.setHex(greens[pick < 0.08 ? 4 : Math.floor(random() * 4)]));
    });
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Crowns take no shadows: at this size they would be dark squares, not shade.
    group.add(mesh);
    return mesh;
  });

  // The great cedar's crown, high above the last bough.
  const boughSolid = level.solids.find((s) => s.kind === 'bough');
  if (boughSolid) {
    const crown = new Mesh(crownGeometry(83, 12, 9), materials.foliage);
    crown.position.set(boughSolid.x, boughSolid.top + 8, boughSolid.z - boughSolid.halfZ - 3.6);
    crown.scale.set(9, 27, 9);
    group.add(crown);
  }

  // Ferns, grass and boulders on the slopes. None near enough to the path, or
  // high enough, to look like somewhere to jump to.
  for (let i = 0; i < 900; i += 1) {
    const x = (random() * 2 - 1) * 46;
    const z = 30 + random() * (far - 70 - 30);
    const y = height(x, z);
    if (y < MIST_BOTTOM + 1 || Math.abs(x) < 16) continue;
    const kind = random();
    if (kind < 0.45) decor.fern(x, y - 0.05, z, 0.8 + random() * 0.9, random() * TAU);
    else if (kind < 0.9) decor.grass(x, y - 0.03, z, 1.2 + random() * 1.4, random() * TAU);
    else decor.rock(x, y + 0.1, z, 0.5 + random() * 1.3, random() * TAU);
  }

  // Leaf shade: a sheet high overhead that is never drawn but shapes the
  // sun's shadows, so light falls on the route in moving patches. Real crowns
  // would put the whole route in solid shade, which is harder to read.
  const shadePicture = canopyPicture().clone();
  shadePicture.repeat.set(5, Math.max(4, Math.round((30 - far) / 26)));
  shadePicture.needsUpdate = true;
  const shade = new Mesh(
    new PlaneGeometry(130, 60 - far + 60),
    new MeshBasicMaterial({ map: shadePicture, alphaTest: 0.5, colorWrite: false, depthWrite: false, side: DoubleSide }),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.set(-18, top + 30, far / 2 + 12);
  shade.castShadow = true;
  shade.frustumCulled = false;
  group.add(shade);

  /** Things left out on the slowest machines. */
  const extras: Object3D[] = [];

  // Mist lying in the gully: two slow sheets, one drifting each way.
  const sheet = new PlaneGeometry(520, 520);
  const sheets = [0, 1].map((i) => {
    const picture = mistPicture().clone();
    picture.repeat.set(7 + i * 3, 7 + i * 3);
    picture.needsUpdate = true;
    const layer = new Mesh(
      sheet,
      new MeshBasicMaterial({
        map: picture,
        color: 0xc4e6da,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(0, MIST_TOP - 1.2 - i * 2.2, far / 2);
    layer.renderOrder = 2 + i;
    group.add(layer);
    if (i === 1) extras.push(layer);
    return picture;
  });

  // Warm light slanting in from the upper left, as in the forest paintings.
  const beam = new PlaneGeometry(6, 54);
  for (let i = 0; i < 7; i += 1) {
    const ray = new Mesh(
      beam,
      new MeshBasicMaterial({
        map: rayPicture(),
        color: 0xfff0b8,
        transparent: true,
        opacity: 0.1 + random() * 0.1,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      }),
    );
    ray.position.set(-15 - random() * 10, top + 5, 8 + (far - 10) * (i / 6) + random() * 4);
    ray.rotation.set(0, 0.35, -0.5);
    ray.scale.x = 0.7 + random() * 1.4;
    ray.renderOrder = 6;
    group.add(ray);
    extras.push(ray);
  }

  // Dust and pollen hanging in the air along the route.
  const moteCount = 220;
  const motePlaces = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i += 1) {
    motePlaces[i * 3] = (random() * 2 - 1) * 16;
    motePlaces[i * 3 + 1] = -2 + random() * (top + 10);
    motePlaces[i * 3 + 2] = 10 + random() * (far - 20);
  }
  const moteShape = new BufferGeometry();
  moteShape.setAttribute('position', new Float32BufferAttribute(motePlaces, 3));
  const motes = new Points(
    moteShape,
    new PointsMaterial({
      map: glowPicture('mote', 'rgba(255, 248, 215, 0.9)', 'rgba(255, 240, 190, 0)'),
      size: 0.14,
      transparent: true,
      opacity: 0.7,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  motes.renderOrder = 7;
  group.add(motes);

  // The sky: mist colour at the horizon, pale gold above, a warm glow ahead and to the left.
  const glowTurn = Math.atan2(-0.85, 0.5) / TAU;
  const sky = new Mesh(
    new SphereGeometry(430, 32, 16),
    new MeshBasicMaterial({ map: skyPicture(((glowTurn % 1) + 1) % 1, 0.32), side: BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -10;
  group.add(sky);

  return {
    group,
    sky,
    crowns,
    update(time) {
      // The shade drifts and breathes a little, like boughs moving overhead.
      shadePicture.offset.set(Math.sin(time * 0.23) * 0.012, time * 0.0015 + Math.cos(time * 0.19) * 0.008);
      sheets[0].offset.set(time * 0.006, time * 0.002);
      sheets[1].offset.set(-time * 0.004, time * 0.003);
      motes.position.set(Math.sin(time * 0.11) * 0.6, Math.sin(time * 0.17) * 0.5, Math.cos(time * 0.09) * 0.6);
    },
    setDetail(share) {
      moteShape.setDrawRange(0, Math.round(moteCount * share));
      // On the slowest machines every tree wears the sparse crown, and the
      // second mist sheet and the shafts of light are left out.
      const light = share < 0.3;
      crowns[0].visible = !light;
      crowns[1].visible = !light;
      crowns[2].visible = !light;
      crowns[3].visible = light;
      crowns[4].visible = light;
      // Fewer far trees too: each crown goes together with its trunk.
      const farCount = Math.ceil(lists[2].length * (light ? 0.55 : 1));
      crowns[4].count = farCount;
      farTrunks.count = farCount;
      extras.forEach((extra) => (extra.visible = !light));
    },
  };
};
