// Huckleberries and hidden leaves drawn (the rules are src/game/collect.ts).
// Looks only. Every huckleberry in a level is one copy of one small shape, a
// cluster of dark blue berries under a green leaf, so the whole trail costs
// one draw. Each bobs and turns slowly; one that has been picked up pops and
// is gone. A hidden leaf is a small copy of the golden leaf with a soft glow.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pickup } from '../game/collect';
import type { Materials } from './materials';
import { glowPicture } from './pictures';

/** Seconds a pickup takes to pop and vanish once picked up. */
const POP = 0.22;
/** How big a huckleberry cluster is drawn, against the shape's own size: big enough to see across a jump. */
const BERRY_SIZE = 1.3;
/** Pickups further from the hero than this are not moved (they still draw, standing still). */
const NEAR = 60;

/** One shape for every huckleberry: three berries and a leaf, coloured at its corners. */
const berryShape = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  const paint = (geometry: BufferGeometry, colour: Color, light = 0): BufferGeometry => {
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = plain.getAttribute('position');
    const colours = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      // A little lighter on top, so each berry reads as round even in flat light.
      const lift = 1 + light * Math.max(0, position.getY(i)) * 4;
      colours.set([colour.r * lift, colour.g * lift, colour.b * lift], i * 3);
    }
    plain.setAttribute('color', new BufferAttribute(colours, 3));
    return plain;
  };
  const blue = new Color('#3b3f9c');
  for (const [x, y, z, r] of [
    [-0.13, -0.02, 0.05, 0.17],
    [0.13, 0, 0.03, 0.16],
    [0, -0.04, -0.13, 0.15],
    [0.01, 0.17, 0, 0.14],
  ]) {
    // Coarse on purpose: about 260 triangles a cluster, so sixty in a level cost under 16 thousand.
    const ball = new SphereGeometry(r, 8, 5);
    ball.translate(x, y, z);
    parts.push(paint(ball, blue, 0.6));
  }
  const leaf = new PlaneGeometry(0.3, 0.2, 2, 1);
  leaf.rotateX(-Math.PI / 2.4);
  leaf.translate(0.12, 0.3, 0);
  parts.push(paint(leaf, new Color('#4f9d4a')));
  const back = new PlaneGeometry(0.3, 0.2, 2, 1);
  back.rotateX(Math.PI - Math.PI / 2.4);
  back.translate(0.12, 0.3, 0);
  parts.push(paint(back, new Color('#3f8340')));
  return mergeGeometries(parts);
};

export class PickupsView {
  readonly group = new Group();
  private readonly berries: Pickup[];
  private readonly mesh: InstancedMesh | null = null;
  private readonly leaves: Array<{ pickup: Pickup; group: Group; blade: Mesh; halo: Sprite }> = [];
  /** Seconds since each pickup was picked up, by id. Not there: still to find. */
  private readonly since = new Map<string, number>();
  private readonly place = new Object3D();
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(pickups: readonly Pickup[], materials: Materials) {
    this.berries = pickups.filter((pickup) => pickup.kind === 'berry');
    if (this.berries.length) {
      const shape = berryShape();
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0, emissive: new Color('#23246b'), emissiveIntensity: 0.55 });
      this.mesh = new InstancedMesh(shape, material, this.berries.length);
      this.mesh.name = 'pickups-berries';
      // Spread over a whole level, so never left out for being off screen as one lump.
      this.mesh.frustumCulled = false;
      this.group.add(this.mesh);
      this.disposables.push(shape, material);
    }
    const leafShape = new PlaneGeometry(0.55, 0.62, 4, 5);
    const position = leafShape.getAttribute('position');
    for (let i = 0; i < position.count; i += 1) position.setZ(i, 0.45 * position.getX(i) ** 2 - 0.2 * position.getY(i) ** 2);
    leafShape.computeVertexNormals();
    const glow = new SpriteMaterial({ map: glowPicture('gold', 'rgba(255, 220, 110, 0.75)', 'rgba(255, 214, 90, 0)'), blending: AdditiveBlending, depthWrite: false, fog: false });
    this.disposables.push(leafShape, glow);
    for (const pickup of pickups) {
      if (pickup.kind !== 'leaf') continue;
      const group = new Group();
      group.name = `pickups-leaf-${pickup.id}`;
      const blade = new Mesh(leafShape, materials.goldLeaf);
      blade.rotation.z = 0.25;
      const halo = new Sprite(glow);
      halo.scale.set(1.5, 1.5, 1);
      group.add(blade, halo);
      group.position.set(pickup.x, pickup.y, pickup.z);
      this.group.add(group);
      this.leaves.push({ pickup, group, blade, halo });
    }
    this.update(new Set(), { x: 0, z: 0 }, 0, 0, true);
  }

  /** How many huckleberries and hidden leaves are still drawn: for the checks. */
  get shown(): { berries: number; leaves: number } {
    return { berries: this.berries.filter((b) => (this.since.get(b.id) ?? 0) < POP).length, leaves: this.leaves.filter((l) => l.group.visible).length };
  }

  /** Puts every pickup where it is now: bobbing, turning, popping, or gone. `collected` is the game's own list. */
  update(collected: ReadonlySet<string>, hero: { x: number; z: number }, clock: number, dt: number, all = false): void {
    // A new run starts with nothing collected: everything is back.
    for (const id of [...this.since.keys()]) if (!collected.has(id)) this.since.delete(id);
    for (const id of collected) this.since.set(id, (this.since.get(id) ?? 0) + dt);
    if (this.mesh) {
      for (let i = 0; i < this.berries.length; i += 1) {
        const berry = this.berries[i];
        const gone = this.since.get(berry.id);
        if (!all && gone === undefined && Math.abs(berry.x - hero.x) + Math.abs(berry.z - hero.z) > NEAR) continue;
        const pop = gone === undefined ? 0 : Math.min(gone / POP, 1);
        const size = gone === undefined ? 1 : pop >= 1 ? 0 : 1 + Math.sin(pop * Math.PI) * 0.7 - pop;
        this.place.position.set(berry.x, berry.y + Math.sin(clock * 2.2 + i * 0.9) * 0.07 + pop * 0.5, berry.z);
        this.place.rotation.set(0, clock * 1.1 + i * 0.7, 0);
        this.place.scale.setScalar(Math.max(size, 0) * BERRY_SIZE);
        this.place.updateMatrix();
        this.mesh.setMatrixAt(i, this.place.matrix);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const leaf of this.leaves) {
      const gone = this.since.get(leaf.pickup.id);
      const pop = gone === undefined ? 0 : Math.min(gone / (POP * 2), 1);
      leaf.group.visible = pop < 1;
      leaf.blade.rotation.y = clock * 1.8;
      leaf.group.position.y = leaf.pickup.y + Math.sin(clock * 2) * 0.08 + pop * 0.9;
      leaf.group.scale.setScalar(1 + Math.sin(pop * Math.PI) * 0.8);
      leaf.halo.scale.setScalar(1.5 + Math.sin(clock * 3) * 0.12 + pop * 2);
    }
  }

  dispose(): void {
    for (const each of this.disposables) each.dispose();
  }
}
