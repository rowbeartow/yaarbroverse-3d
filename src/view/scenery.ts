// Turns the level's solids into low-poly shapes: mossy banks, fallen logs,
// stumps, mushroom springs, the canopy bough and the golden leaf, plus the
// cedars and mist around them. Looks only; the rules never read any of this.

import {
  AdditiveBlending,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
} from 'three';
import type { Level, Solid } from '../game/level';
import { COLOR, boxAt, fuse, glow, paint, paintByFace, postAt, prism, seeded, softSpot } from './shapes';

/** How far below the level the mist lies, and how deep the trunks and banks go under it. */
export const MIST_Y = -7;
const UNDER = MIST_Y - 6;

// ---------- Mossy banks ----------

const bank = (s: Solid, random: () => number): Group => {
  const group = new Group();
  const width = s.halfX * 2;
  const depth = s.halfZ * 2;
  // Earth and rock below, moss on top when the bank is safe, bare stone when not.
  group.add(boxAt(paint(COLOR.earth), width - 0.3, s.top - 0.4 - UNDER, depth - 0.3, 0, (s.top - 0.4 + UNDER) / 2, 0));
  group.add(boxAt(paint(s.safe ? COLOR.moss : COLOR.rock), width, 0.4, depth, 0, s.top - 0.2, 0));
  group.add(boxAt(paint(s.safe ? COLOR.mossDark : COLOR.rockDark), width + 0.16, 0.14, depth + 0.16, 0, s.top - 0.36, 0));

  // Patches on top, so the ground is not one flat colour.
  const patch = new CylinderGeometry(1, 1, 0.03, 7);
  const tones = s.safe ? [COLOR.mossDark, COLOR.mossLight, COLOR.mossDark] : [COLOR.rockDark, COLOR.rockLight, COLOR.rockDark];
  for (let i = 0; i < Math.round(width * depth * 0.22); i += 1) {
    const spot = new Mesh(patch, paint(tones[i % tones.length]));
    const size = 0.35 + random() * 0.75;
    spot.scale.set(size, 1, size * (0.6 + random() * 0.6));
    spot.position.set((random() * 2 - 1) * (s.halfX - 1), s.top + 0.005 + (i % 3) * 0.004, (random() * 2 - 1) * (s.halfZ - 1));
    spot.rotation.y = random() * 3;
    group.add(spot);
  }

  // Boulders set into the sides.
  const boulder = new IcosahedronGeometry(1, 0);
  const sides = Math.round((width + depth) * 0.9);
  for (let i = 0; i < sides; i += 1) {
    const rock = new Mesh(boulder, paint(random() < 0.5 ? COLOR.rock : COLOR.rockDark));
    const along = random() * 2 - 1;
    const onSide = random() < depth / (width + depth);
    const sign = random() < 0.5 ? -1 : 1;
    rock.position.set(
      onSide ? sign * (s.halfX - 0.2) : along * (s.halfX - 0.5),
      s.top - 1 - random() * 4.5,
      onSide ? along * (s.halfZ - 0.5) : sign * (s.halfZ - 0.2),
    );
    const size = 0.35 + random() * 0.45;
    rock.scale.set(size, size * (0.7 + random() * 0.4), size);
    rock.rotation.set(random() * 3, random() * 3, random() * 3);
    group.add(rock);
  }

  // Ferns along the side edges of safe banks, out of the walking line.
  if (s.safe) {
    const frond = new ConeGeometry(0.16, 1, 4);
    for (let i = 0; i < Math.round(depth * 0.8); i += 1) {
      const clump = new Group();
      const sign = i % 2 === 0 ? -1 : 1;
      clump.position.set(sign * (s.halfX - 0.25 - random() * 0.3), s.top, (random() * 2 - 1) * (s.halfZ - 0.4));
      for (let f = 0; f < 5; f += 1) {
        const leaf = new Mesh(frond, paint(f % 2 ? COLOR.fern : COLOR.mossDark));
        const lean = 0.5 + random() * 0.5;
        const turn = (f / 5) * Math.PI * 2 + random();
        leaf.position.set(Math.sin(turn) * 0.22, 0.38, Math.cos(turn) * 0.22);
        leaf.rotation.set(Math.cos(turn) * lean, 0, -Math.sin(turn) * lean);
        clump.add(leaf);
      }
      group.add(clump);
    }
  }
  group.position.set(s.x, 0, s.z);
  return group;
};

// ---------- Fallen logs and the canopy bough ----------

/** A log seen end-on: flat mossy top as wide as the footing, round bark below. */
const logOutline = (half: number, thickness: number): Array<[number, number]> => [
  [half, 0],
  [-half, 0],
  [-half * 1.04, -thickness * 0.3],
  [-half * 0.82, -thickness * 0.75],
  [-half * 0.36, -thickness],
  [half * 0.36, -thickness],
  [half * 0.82, -thickness * 0.75],
  [half * 1.04, -thickness * 0.3],
];

const log = (s: Solid, random: () => number): Group => {
  const group = new Group();
  const thickness = s.top - s.bottom;
  const body = new Mesh(
    prism(logOutline(s.halfX, thickness), s.halfZ * 2, { top: COLOR.logTop, side: COLOR.bark, end: COLOR.wood }),
    paintByFace,
  );
  body.position.y = s.top;
  group.add(body);
  // Moss creeping in from the edges.
  for (let i = 0; i < Math.round(s.halfZ * 2.4); i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const reach = s.halfX * (0.25 + random() * 0.4);
    group.add(
      boxAt(
        paint(i % 3 ? COLOR.moss : COLOR.mossDark),
        reach,
        0.05,
        0.5 + random() * 0.9,
        side * (s.halfX - reach / 2),
        s.top,
        (random() * 2 - 1) * (s.halfZ - 0.5),
      ),
    );
  }
  // Two snags hold a raised log up; a log at bank height just rests on the banks.
  if (s.top > 2) {
    for (const end of [-1, 1]) {
      group.add(postAt(paint(COLOR.barkDark), 0.38, 0.55, UNDER, s.bottom + 0.1, 0, end * (s.halfZ - 0.7), 7));
    }
  }
  group.position.set(s.x, 0, s.z);
  return group;
};

const bough = (s: Solid, random: () => number): Group => {
  const group = new Group();
  const thickness = s.top - s.bottom;
  const body = new Mesh(
    prism(logOutline(s.halfX, thickness * 1.5), s.halfZ * 2 + 3, {
      top: COLOR.moss,
      side: COLOR.barkDark,
      end: COLOR.wood,
    }),
    paintByFace,
  );
  // The bough runs on past its far end into the trunk of a great cedar.
  body.position.set(0, s.top, -1.5);
  group.add(body);
  const trunkZ = -s.halfZ - 3.2;
  group.add(postAt(paint(COLOR.bark), 2.1, 2.9, UNDER, s.top + 16, 0, trunkZ, 10));
  const needles = new ConeGeometry(1, 1, 7);
  for (let i = 0; i < 9; i += 1) {
    const mass = new Mesh(needles, paint([COLOR.leafDark, COLOR.leafMid, COLOR.leafLight][i % 3]));
    const turn = random() * Math.PI * 2;
    const out = 2 + random() * 3.5;
    mass.position.set(Math.sin(turn) * out, s.top + 6.5 + random() * 8, trunkZ + Math.cos(turn) * out * 0.6 - 1);
    mass.scale.set(3 + random() * 2.5, 2.2 + random() * 1.6, 3 + random() * 2.5);
    group.add(mass);
  }
  group.position.set(s.x, 0, s.z);
  return group;
};

// ---------- Stumps ----------

const stump = (s: Solid, random: () => number): Group => {
  const group = new Group();
  group.add(postAt(paint(COLOR.bark), s.halfX, s.halfX * 1.12, UNDER, s.top - 0.06, 0, 0, 9));
  // Pale cut wood on top, with a darker ring and a patch of moss.
  const cut = new Mesh(new CylinderGeometry(s.halfX * 0.93, s.halfX * 0.93, 0.08, 9), paint(COLOR.wood));
  cut.position.y = s.top - 0.03;
  group.add(cut);
  const ring = new Mesh(new CylinderGeometry(s.halfX * 0.5, s.halfX * 0.5, 0.02, 9), paint(0xc39c64));
  ring.position.y = s.top + 0.012;
  group.add(ring);
  const patch = new Mesh(new CylinderGeometry(s.halfX * 0.34, s.halfX * 0.34, 0.03, 6), paint(COLOR.moss));
  const turn = random() * Math.PI * 2;
  patch.position.set(Math.sin(turn) * s.halfX * 0.55, s.top + 0.02, Math.cos(turn) * s.halfX * 0.55);
  group.add(patch);
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

const mushroom = (s: Solid, random: () => number): { group: Group; view: MushroomView } => {
  const group = new Group();
  const radius = s.halfX;
  const stemHeight = 1;
  // Free-standing mushrooms grow from the top of a broken snag.
  if (s.bottom < s.top - stemHeight - 0.5) {
    group.add(postAt(paint(COLOR.barkDark), radius * 0.62, radius * 0.8, UNDER, s.top - stemHeight, 0, 0, 8));
    const lip = new Mesh(new CylinderGeometry(radius * 0.7, radius * 0.62, 0.12, 8), paint(COLOR.mossDark));
    lip.position.y = s.top - stemHeight + 0.04;
    group.add(lip);
  }
  const cap = new Group();
  cap.position.y = s.top - stemHeight;
  cap.add(postAt(paint(COLOR.cream), radius * 0.3, radius * 0.42, 0, stemHeight - 0.25, 0, 0, 8));
  // The cap, seen side-on from the middle outward: nearly flat on top so the
  // footing matches what you see, curling under at the rim.
  const profile = [
    new Vector2(radius * 0.28, stemHeight - 0.36),
    new Vector2(radius * 0.86, stemHeight - 0.42),
    new Vector2(radius * 1.02, stemHeight - 0.26),
    new Vector2(radius * 0.92, stemHeight - 0.06),
    new Vector2(radius * 0.55, stemHeight + 0.06),
    new Vector2(0.001, stemHeight + 0.1),
  ];
  cap.add(new Mesh(new LatheGeometry(profile, 10), paint(COLOR.cap)));
  const gills = new Mesh(new CylinderGeometry(radius * 0.84, radius * 0.3, 0.1, 10), paint(COLOR.cream));
  gills.position.y = stemHeight - 0.4;
  cap.add(gills);
  // Cream spots.
  const spot = new CylinderGeometry(1, 1, 0.05, 7);
  const spots = Math.max(5, Math.round(radius * 6));
  for (let i = 0; i < spots; i += 1) {
    const dot = new Mesh(spot, paint(COLOR.cream));
    const turn = (i / spots) * Math.PI * 2 + random() * 0.5;
    const out = i === 0 ? 0 : radius * (0.35 + random() * 0.45);
    const size = radius * (0.1 + random() * 0.07);
    dot.scale.set(size, 1, size);
    dot.position.set(Math.sin(turn) * out, stemHeight + 0.1 - (out / radius) * 0.12, Math.cos(turn) * out);
    cap.add(dot);
  }
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
  baseY: number;
}

export const goldenLeaf = (level: Level): LeafView => {
  const group = new Group();
  // A pointed leaf outline, as a fan of triangles around its middle.
  const outline: Array<[number, number]> = [
    [0, 0.62],
    [0.2, 0.36],
    [0.34, 0.04],
    [0.28, -0.26],
    [0.1, -0.46],
    [0, -0.52],
    [-0.1, -0.46],
    [-0.28, -0.26],
    [-0.34, 0.04],
    [-0.2, 0.36],
  ];
  const positions: number[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const [ax, ay] = outline[i];
    const [bx, by] = outline[(i + 1) % outline.length];
    positions.push(0, 0, 0, ax, ay, 0, bx, by, 0);
  }
  const shape = new BufferGeometry();
  shape.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const gold = new MeshBasicMaterial({ color: COLOR.gold, side: DoubleSide, fog: false });
  const blade = new Group();
  blade.add(new Mesh(shape, gold));
  blade.add(boxAt(glow(COLOR.goldDeep), 0.05, 1.3, 0.03, 0, -0.08, 0));
  blade.rotation.z = 0.25;
  blade.scale.setScalar(1.5);
  group.add(blade);

  const halo = new Sprite(
    new SpriteMaterial({
      map: softSpot('rgba(255, 214, 90, 0.5)', 'rgba(255, 214, 90, 0)'),
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.scale.set(3.4, 3.4, 1);
  group.add(halo);

  // A faint shaft of light, so the leaf can be found from far off.
  const shaft = new Mesh(
    new CylinderGeometry(0.5, 1.1, 14, 10, 1, true),
    new MeshBasicMaterial({
      color: COLOR.gold,
      transparent: true,
      opacity: 0.12,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    }),
  );
  shaft.position.y = 6.5;
  group.add(shaft);

  group.position.set(level.leaf.x, level.leaf.y, level.leaf.z);
  return { group, blade, halo, baseY: level.leaf.y };
};

// ---------- The forest around the level ----------

const forest = (level: Level, random: () => number): Group => {
  const group = new Group();
  const far = Math.min(...level.solids.map((s) => s.z - s.halfZ));
  const top = Math.max(...level.solids.map((s) => s.top));

  // Mist: one solid sheet with thin sheets above it, so trunks fade in.
  const sheet = new PlaneGeometry(400, 400);
  for (let i = 0; i < 3; i += 1) {
    const layer = new Mesh(
      sheet,
      new MeshBasicMaterial({
        color: COLOR.mist,
        transparent: i > 0,
        opacity: i === 0 ? 1 : 0.42,
        depthWrite: i === 0,
        fog: false,
      }),
    );
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(0, MIST_Y + i * 1.1, far / 2);
    layer.renderOrder = i;
    group.add(layer);
  }

  // Trees on both sides, well clear of anything you can stand on: young firs
  // close by, with their green at the height you walk at, and tall cedars behind.
  const trees: Array<{ x: number; z: number; height: number; girth: number; crown: number }> = [];
  const pathHeight = (z: number): number => top * Math.min(Math.max(z / far, 0), 1);
  /** How far the lowest branches of a tree reach out from its trunk. */
  const crownWidth = (crown: number): number => 1.7 + crown * 0.17;
  for (let z = 24; z > far - 60; z -= 2.6) {
    for (const sign of [-1, 1]) {
      const near = random() < 0.62;
      const treeZ = z + random() * 2.6;
      // Nothing green closer than this to the middle of the path, so branches
      // never hide a place to stand. Wider beside the start, where the camera sits.
      const clear = treeZ > -4 ? 10 : 6.5;
      if (near) {
        const tip = pathHeight(treeZ) + 1 + random() * 8;
        const crown = (tip - MIST_Y) * 0.82;
        const out = clear + crownWidth(crown) + random() * 7;
        trees.push({ x: sign * out, z: treeZ, height: tip, girth: 0.3 + random() * 0.25, crown });
      } else {
        const tip = top + 8 + random() * 16;
        const crown = tip * (0.45 + random() * 0.2);
        const out = clear + crownWidth(crown) + 4 + random() * random() * 30;
        trees.push({ x: sign * out, z: treeZ, height: tip, girth: 0.5 + random() * 0.5, crown });
      }
    }
  }
  // More beyond the far end, to close the view.
  for (let i = 0; i < 16; i += 1) {
    const tip = top + 4 + random() * 22;
    trees.push({
      x: (random() * 2 - 1) * 34,
      z: far - 20 - random() * 50,
      height: tip,
      girth: 0.45 + random() * 0.6,
      crown: (tip - MIST_Y) * (0.5 + random() * 0.3),
    });
  }

  const trunks = new InstancedMesh(new CylinderGeometry(0.55, 1, 1, 7), paint(COLOR.bark), trees.length);
  const tiers = 4;
  const needles = new InstancedMesh(new ConeGeometry(1, 1, 7), paint(0xffffff), trees.length * tiers);
  const place = new Object3D();
  const tint = new Color();
  const greens = [COLOR.leafDark, COLOR.leafMid, COLOR.leafLight];
  trees.forEach((tree, i) => {
    place.position.set(tree.x, (tree.height - 1 + UNDER) / 2, tree.z);
    place.scale.set(tree.girth, tree.height - 1 - UNDER, tree.girth);
    place.rotation.set(0, random() * 3, 0);
    place.updateMatrix();
    trunks.setMatrixAt(i, place.matrix);
    const widest = crownWidth(tree.crown);
    for (let t = 0; t < tiers; t += 1) {
      const share = t / tiers;
      const width = widest * (1 - share * 0.68);
      const tall = (tree.crown / tiers) * 1.55;
      place.position.set(tree.x, tree.height - tree.crown + share * tree.crown + tall / 2, tree.z);
      place.scale.set(width, tall, width);
      place.rotation.set(0, random() * 3, 0);
      place.updateMatrix();
      needles.setMatrixAt(i * tiers + t, place.matrix);
      needles.setColorAt(i * tiers + t, tint.setHex(greens[Math.floor(random() * greens.length)]));
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  needles.instanceMatrix.needsUpdate = true;
  if (needles.instanceColor) needles.instanceColor.needsUpdate = true;
  group.add(trunks, needles);

  // Warm light slanting in from the upper left, as in the forest paintings.
  const beam = new PlaneGeometry(5, 46);
  for (let i = 0; i < 7; i += 1) {
    const ray = new Mesh(
      beam,
      new MeshBasicMaterial({
        color: 0xfff0b8,
        transparent: true,
        opacity: 0.05 + random() * 0.05,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        fog: false,
      }),
    );
    ray.position.set(-13 - random() * 9, top + 6, 8 + (far - 10) * (i / 6) + random() * 4);
    ray.rotation.set(0, 0.35, -0.5);
    ray.scale.x = 0.7 + random() * 1.4;
    group.add(ray);
  }
  return group;
};

// ---------- Putting the level together ----------

export interface LevelView {
  group: Group;
  mushrooms: Map<string, MushroomView>;
  leaf: LeafView;
}

export const buildLevelView = (level: Level): LevelView => {
  const random = seeded(20261110);
  const group = new Group();
  const mushrooms = new Map<string, MushroomView>();
  for (const s of level.solids) {
    if (s.kind === 'mushroom') {
      const made = mushroom(s, random);
      // The cap squashes when bounced on, so it stays a separate shape.
      fuse(made.view.cap);
      fuse(made.group, [made.view.cap]);
      group.add(made.group);
      mushrooms.set(s.id, made.view);
      continue;
    }
    const made =
      s.kind === 'bank' ? bank(s, random) : s.kind === 'log' ? log(s, random) : s.kind === 'bough' ? bough(s, random) : stump(s, random);
    fuse(made);
    group.add(made);
  }
  const leaf = goldenLeaf(level);
  group.add(leaf.group);
  group.add(forest(level, random));
  return { group, mushrooms, leaf };
};

/** The dark spot under the hero that shows where a jump will land. */
export const blobShadow = (): Mesh => {
  const shadow = new Mesh(
    new CircleGeometry(0.55, 18),
    new MeshBasicMaterial({ color: 0x0b1a14, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 5;
  return shadow;
};
