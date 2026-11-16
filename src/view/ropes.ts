// Rope swings, drawn: each rope from where it is tied to where a hero holds
// it, moved every frame to where the rules have it, and the bare snag with a
// bough that holds it up. Looks only: the rules are in src/game/rope.ts.

import { ConeGeometry, CylinderGeometry, Group, Mesh, type Object3D, MeshLambertMaterial, MeshStandardMaterial, SphereGeometry, Vector3, type Material } from 'three';
import type { Level } from '../game/level';
import { ROPE, handOf, type RopeState } from '../game/rope';
import type { Materials } from './materials';

const ROPE_COLOR = 0xc9a66b;
const DOWN = new Vector3(0, -1, 0);

export class RopesView {
  readonly group = new Group();
  private readonly lines = new Map<string, Group>();
  private readonly looks: Material[] = [];

  constructor(level: Level, materials: Materials) {
    const hemp = materials.simple ? new MeshLambertMaterial({ color: ROPE_COLOR }) : new MeshStandardMaterial({ color: ROPE_COLOR, roughness: 0.9 });
    this.looks.push(hemp);
    for (const rope of level.ropes ?? []) {
      // The rope hangs from its own top, so turning the group swings it.
      const line = new Group();
      line.position.set(rope.x, rope.y, rope.z);
      const cord = new Mesh(new CylinderGeometry(0.055, 0.055, rope.length, 6), hemp);
      cord.position.y = -rope.length / 2;
      cord.castShadow = true;
      // A fat knot at the end to hold, and two more up the part a hero can grab.
      for (const up of [0, 0.7, 1.4]) {
        const knot = new Mesh(new SphereGeometry(up === 0 ? 0.16 : 0.1, 8, 6), hemp);
        knot.position.y = -rope.length + up;
        line.add(knot);
      }
      line.add(cord);
      line.name = `rope-${rope.id}`;
      this.lines.set(rope.id, line);
      this.group.add(line);

      // What holds it: a bare snag standing a little to one side, with a bough out to the rope and a tuft of green at its top.
      const foot = rope.foot ?? { x: rope.x, z: rope.z - 3 };
      const pool = level.water?.find((w) => foot.x >= w.minX && foot.x <= w.maxX && foot.z >= w.minZ && foot.z <= w.maxZ);
      const base = pool ? pool.floor - 0.3 : Math.min(...level.solids.map((s) => s.top)) - 6;
      const top = rope.y + 1.6;
      const trunk = new Mesh(new CylinderGeometry(0.22, 0.42, top - base, 9), materials.bark);
      trunk.position.set(foot.x, (top + base) / 2, foot.z);
      trunk.castShadow = true;
      const from = new Vector3(foot.x, rope.y + 0.5, foot.z);
      const to = new Vector3(rope.x, rope.y + 0.1, rope.z);
      const reach = to.clone().sub(from);
      const bough = new Mesh(new CylinderGeometry(0.1, 0.17, reach.length() + 0.8, 7), materials.bark);
      bough.position.copy(from).addScaledVector(reach, 0.5);
      bough.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), reach.clone().normalize().negate());
      bough.castShadow = true;
      this.group.add(trunk, bough);
      for (const [dy, size] of [[0.2, 1.5], [1.3, 1.1], [2.2, 0.7]] as const) {
        const tuft = new Mesh(new ConeGeometry(size, 1.6, 8), materials.foliage);
        tuft.position.set(foot.x, top + dy, foot.z);
        tuft.castShadow = true;
        this.group.add(tuft);
      }
    }
  }

  /** Puts each rope where the rules have it now. */
  update(ropes: readonly RopeState[]): void {
    for (const state of ropes) {
      const line = this.lines.get(state.rope.id);
      if (!line) continue;
      const hand = handOf(state);
      line.quaternion.setFromUnitVectors(DOWN, new Vector3(hand.x - state.rope.x, hand.y - state.rope.y, hand.z - state.rope.z).normalize());
    }
  }

  /** How many ropes are drawn, and how far each has swung, for the browser checks. */
  info(ropes: readonly RopeState[]): { id: string; angle: number }[] {
    return ropes.filter((state) => this.lines.has(state.rope.id)).map((state) => ({ id: state.rope.id, angle: state.angle }));
  }

  dispose(): void {
    for (const look of this.looks) look.dispose();
  }
}

/**
 * Hangs a hero from the rope it is swinging on: in line with the rope, hands
 * at its end. Off a rope (`swinging` null) it eases the hero upright again.
 * Call after the hero has been put where the rules have it and turned.
 */
export const hangOnRope = (root: Object3D, swinging: RopeState | null, dt: number): void => {
  root.rotation.order = 'YXZ';
  const lean = swinging ? -swinging.angle : 0;
  root.rotation.x += (lean - root.rotation.x) * (1 - Math.exp(-18 * dt));
  // The rules slide a hero to the rope's end over a moment after it takes hold; once there, hang it exactly.
  if (!swinging || Math.hypot(root.position.x - handOf(swinging).x, root.position.z - handOf(swinging).z) > 0.25) return;
  const hand = handOf(swinging);
  const { rope } = swinging;
  // Feet a body's length down the line of the rope from the hands.
  root.position.set(
    hand.x - ((rope.x - hand.x) / rope.length) * ROPE.hang,
    hand.y - ((rope.y - hand.y) / rope.length) * ROPE.hang,
    hand.z - ((rope.z - hand.z) / rope.length) * ROPE.hang,
  );
};
