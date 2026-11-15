// The shapes of a lake level's own solids: boulders standing up out of the
// water, the rocky point's crags, and the old pier's wooden deck on its posts.
// Looks only; `buildSolids` in scenery.ts picks the shape by the solid's kind.

import {
  BoxGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Level, Solid } from '../game/level';
import type { Materials } from './materials';
import { noise, rough, smooth } from './noise';

/** How far below the water a shape reaches: the lake's floor, or a little below the solid when there is no water under it. */
const footOf = (s: Solid, level: Level): number => {
  const pool = level.water?.find((w) => s.x >= w.minX - 1 && s.x <= w.maxX + 1 && s.z >= w.minZ - 1 && s.z <= w.maxZ + 1);
  return pool ? pool.floor - 0.3 : s.top - 4;
};

/**
 * A lump of rock that fills a box from `bottom` to `top`, with a flattish
 * top (where a hero stands) and moss on its upper parts. One shape, stretched
 * to fit, with its lumps set by where it is so no two look alike.
 */
const rockLump = (seed: number, round: boolean, mossy = 1): BufferGeometry => {
  const geometry = new IcosahedronGeometry(1, round ? 3 : 4);
  const position = geometry.getAttribute('position');
  const moss = new Float32Array(position.count);
  for (let i = 0; i < position.count; i += 1) {
    let x = position.getX(i);
    let y = position.getY(i);
    let z = position.getZ(i);
    if (!round) {
      // A box with rounded edges, for crags.
      const k = 2.6;
      const d = (Math.abs(x) ** k + Math.abs(y) ** k + Math.abs(z) ** k) ** (1 / k);
      x /= d;
      y /= d;
      z /= d;
    }
    const lump = 1 + 0.12 * rough(x * 1.6 + seed, y * 1.6, z * 1.6 + seed) + 0.04 * rough(x * 4 + seed, y * 4, z * 4);
    x *= lump;
    z *= lump;
    // Flat on top, so the drawn top is where a hero stands; sides bulge a little.
    y = y > 0.55 ? 0.55 + (y - 0.55) * 0.25 : y * lump;
    position.setXYZ(i, x, y, z);
    moss[i] = mossy * smooth(0.2, 0.6, y) * (0.45 + 0.55 * noise(x * 2 + seed, y * 2, z * 2));
  }
  // Scale so the flat top is at +1 and the foot at -1.
  const top = 0.55 + 0.45 * 0.25;
  for (let i = 0; i < position.count; i += 1) position.setY(i, ((position.getY(i) + 1) / (top + 1)) * 2 - 1);
  geometry.setAttribute('moss', new Float32BufferAttribute(moss, 1));
  geometry.computeVertexNormals();
  return geometry;
};

/** A boulder standing up out of the lake: round, its top where the solid's top is. */
export const boulder = (s: Solid, materials: Materials, level: Level): Group => {
  const group = new Group();
  const foot = footOf(s, level);
  const mesh = new Mesh(rockLump(s.x * 1.3 + s.z * 0.7, true, 0.6), materials.rock);
  mesh.scale.set(s.halfX * 1.04, (s.top - foot) / 2, s.halfZ * 1.04);
  mesh.position.set(s.x, (s.top + foot) / 2, s.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
};

/** A crag of the rocky point: a long block of rock with rounded edges. */
export const crag = (s: Solid, materials: Materials, level: Level): Group => {
  const group = new Group();
  const foot = footOf(s, level);
  const mesh = new Mesh(rockLump(s.x * 0.9 + s.z * 1.1, false, 0.35), materials.rock);
  mesh.scale.set(s.halfX + 0.3, (s.top - foot) / 2, s.halfZ + 0.3);
  mesh.position.set(s.x, (s.top + foot) / 2, s.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
};

const woodLooks = new WeakMap<Materials, Material>();
/** Weathered grey-brown boards. */
const wood = (materials: Materials): Material => {
  let look = woodLooks.get(materials);
  if (!look) {
    look = materials.simple ? new MeshLambertMaterial({ color: 0x9a8466 }) : new MeshStandardMaterial({ color: 0x9a8466, roughness: 0.88 });
    woodLooks.set(materials, look);
  }
  return look;
};

/**
 * The old pier's deck: boards laid across, a beam under each side, and posts
 * down into the water every couple of metres. Its top is the solid's top.
 */
export const deck = (s: Solid, materials: Materials, level: Level): Group => {
  const group = new Group();
  const look = wood(materials);
  const foot = footOf(s, level);
  const across = s.halfX >= s.halfZ;
  const length = (across ? s.halfZ : s.halfX) * 2;
  const span = (across ? s.halfX : s.halfZ) * 2;
  // Boards: about 0.28 m wide with thin gaps, each a little different in height and shade.
  const board = new BoxGeometry(across ? span : 0.26, 0.09, across ? 0.26 : span);
  const count = Math.floor(length / 0.3);
  for (let i = 0; i < count; i += 1) {
    const along = -length / 2 + (i + 0.5) * (length / count);
    const plank = new Mesh(board, look);
    plank.position.set(s.x + (across ? 0 : along), s.top - 0.045 - Math.abs(noise(i * 0.7, s.z)) * 0.012, s.z + (across ? along : 0));
    plank.rotation.y = (noise(i * 1.3, s.x) - 0.5) * 0.015;
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  // A beam under each side, and posts down into the lake.
  const beam = new BoxGeometry(across ? 0.2 : length, 0.22, across ? length : 0.2);
  const post = new CylinderGeometry(0.13, 0.15, s.top - foot, 8);
  for (const side of [-1, 1]) {
    const edge = (across ? s.halfX : s.halfZ) - 0.25;
    const b = new Mesh(beam, look);
    b.position.set(s.x + (across ? side * edge : 0), s.top - 0.2, s.z + (across ? 0 : side * edge));
    group.add(b);
    const posts = Math.max(2, Math.round(length / 2.2) + 1);
    for (let i = 0; i < posts; i += 1) {
      const along = -length / 2 + 0.2 + (i / (posts - 1)) * (length - 0.4);
      const p = new Mesh(post, materials.bark);
      p.position.set(s.x + (across ? side * edge : along), (s.top + foot) / 2 - 0.1, s.z + (across ? along : side * edge));
      p.castShadow = true;
      group.add(p);
    }
  }
  return group;
};
