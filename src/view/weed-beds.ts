// Beds of weed floating on a pool (the rules: `weeds` on a pool, src/game/swim.ts).
// Looks only. Each bed is a raft of small flat pads in dull greens, thickest
// in its middle and ragged at its edge, lying on the water. It never reaches
// past the bed's box in the rules, so where it looks weedy is where a swimmer
// is slowed. Every pad of every bed in a level is one draw, and none moves.

import { CircleGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3 } from 'three';
import type { Water } from '../game/swim';

/** Pads to a square metre of bed, and how big one is across. */
const WEED = { density: 3.2, small: 0.22, large: 0.5, lift: 0.025 } as const;
const GREENS = ['#4f6d2a', '#5f7a30', '#44602a', '#6a7d36', '#757a34'];

export class WeedBeds {
  readonly group = new Group();
  private readonly shape = new CircleGeometry(1, 7);
  private readonly look = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide });

  constructor(waters: readonly Water[]) {
    this.shape.rotateX(-Math.PI / 2);
    const beds = waters.flatMap((water) => (water.weeds ?? []).map((bed) => ({ bed, surface: water.surface })));
    const counts = beds.map(({ bed }) => Math.round((bed.maxX - bed.minX) * (bed.maxZ - bed.minZ) * WEED.density));
    const mesh = new InstancedMesh(this.shape, this.look, Math.max(1, counts.reduce((sum, each) => sum + each, 0)));
    mesh.name = 'weed-beds';
    // The same pads every time, so a bed looks the same on every visit.
    let seed = 20261117;
    const random = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const m = new Matrix4();
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const colour = new Color();
    let placed = 0;
    beds.forEach(({ bed, surface }, index) => {
      const halfX = (bed.maxX - bed.minX) / 2;
      const halfZ = (bed.maxZ - bed.minZ) / 2;
      for (let i = 0; i < counts[index]; i += 1) {
        // Thicker toward the middle: two rolls averaged, then kept inside the box by a pad's own size.
        const size = WEED.small + (WEED.large - WEED.small) * random() ** 2;
        const ax = (random() + random() - 1) * (halfX - size);
        const az = (random() + random() - 1) * (halfZ - size);
        q.setFromAxisAngle(up, random() * Math.PI * 2);
        m.compose(new Vector3(bed.minX + halfX + ax, surface + WEED.lift + random() * 0.01, bed.minZ + halfZ + az), q, new Vector3(size, 1, size * (0.7 + random() * 0.3)));
        mesh.setMatrixAt(placed, m);
        mesh.setColorAt(placed, colour.set(GREENS[Math.floor(random() * GREENS.length)]).multiplyScalar(0.85 + random() * 0.3));
        placed += 1;
      }
    });
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  dispose(): void {
    this.shape.dispose();
    this.look.dispose();
  }
}
