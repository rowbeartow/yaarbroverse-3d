// Crocodile stepping stones, drawn: each one is the crocodile's own model,
// bigger, lying across the way with its back where a hero can stand. It is
// put every frame where the rules have it (src/game/moving.ts, kind `float`):
// low in the water with only its eyes and snout showing, up with its back
// awash, shuddering through its warning, snapping, and going under.

import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, MeshLambertMaterial, Vector3, type AnimationAction, type Material, type Mesh, type MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Level, Solid } from '../game/level';

/** How much longer than the lake's hunting crocodiles (2.6 m) a stepping stone is: its back has to hold a hero. */
export const STONE_LENGTH = 4.6;
/** Its back stands this far above the middle of its body, as a share of how tall the model is. */
const BACK = 0.3;

interface Stone {
  id: string;
  root: Group;
  mixer: AnimationMixer;
  lurk: AnimationAction | null;
  snap: AnimationAction | null;
  /** How far its back is above the middle of the model. */
  back: number;
  phase: string;
  /** Seconds since it last snapped, for showing the snap through. */
  sinceSnap: number;
}

export class CrocStones {
  readonly group = new Group();
  private readonly stones: Stone[] = [];
  private readonly looks: Material[] = [];
  private clock = 0;

  constructor(level: Level, source: GLTF, simple: boolean) {
    level.solids.filter((s) => s.motion?.kind === 'float').forEach((s, index) => {
      const model = cloneRigged(source.scene);
      model.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        if (simple) {
          const full = mesh.material as MeshStandardMaterial;
          const own = new MeshLambertMaterial({ map: full.map, color: full.color });
          mesh.material = own;
          this.looks.push(own);
        }
        // No shadows from crocodiles in the water: the lake's frame budget is tight.
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      });
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3());
      const middle = box.getCenter(new Vector3());
      const scale = STONE_LENGTH / Math.max(size.z, 0.001);
      model.scale.multiplyScalar(scale);
      model.position.set(-middle.x * scale, -middle.y * scale, -middle.z * scale);
      const root = new Group();
      root.add(model);
      // It lies along the longer side of its solid, every other one facing the other way.
      const alongX = s.halfX >= s.halfZ;
      root.rotation.y = (alongX ? Math.PI / 2 : 0) + (index % 2 ? Math.PI : 0);
      root.name = `stone-${s.id}`;
      const mixer = new AnimationMixer(model);
      const action = (name: string, once: boolean): AnimationAction | null => {
        const clip = source.animations.find((each) => each.name === name);
        if (!clip) return null;
        const made = mixer.clipAction(clip);
        made.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
        made.clampWhenFinished = true;
        return made;
      };
      const lurk = action('lurk', false);
      lurk?.play();
      // Each a little out of step with the next, so the row does not breathe as one.
      mixer.update(index * 0.37);
      this.stones.push({ id: s.id, root, mixer, lurk, snap: action('lunge', true), back: size.y * scale * BACK, phase: 'gone', sinceSnap: 10 });
      this.group.add(root);
    });
  }

  /** Puts each crocodile where the rules have its solid now. */
  update(solids: readonly Solid[], dt: number): void {
    this.clock += dt;
    for (const stone of this.stones) {
      const s = solids.find((each) => each.id === stone.id);
      const piece = s?.piece;
      if (!s || !piece) continue;
      // The rules' top is its back.
      let y = s.top - stone.back;
      let roll = 0;
      // Its warning: it shudders, harder as its hold runs out.
      if (piece.telling) roll = Math.sin(this.clock * 34) * 0.07;
      else if (piece.phase === 'tell') y += Math.sin(this.clock * 5 + s.x) * 0.02;
      stone.root.position.set(s.x, y, s.z);
      stone.root.rotation.z = roll;
      stone.sinceSnap += dt;
      stone.phase = piece.phase;
      stone.mixer.update(dt);
    }
  }

  /** A crocodile stood on too long snaps its jaws. */
  snap(id: string): void {
    const stone = this.stones.find((each) => each.id === id);
    if (!stone?.snap) return;
    stone.sinceSnap = 0;
    stone.snap.reset().setEffectiveWeight(1).play();
    stone.lurk?.setEffectiveWeight(0);
    const { lurk, snap } = stone;
    const done = (): void => {
      snap.setEffectiveWeight(0);
      lurk?.setEffectiveWeight(1);
      stone.mixer.removeEventListener('finished', done);
    };
    stone.mixer.addEventListener('finished', done);
  }

  /** What each crocodile is doing, for the browser checks. */
  info(): { id: string; phase: string; y: number }[] {
    return this.stones.map((stone) => ({ id: stone.id, phase: stone.phase, y: stone.root.position.y }));
  }

  dispose(): void {
    for (const stone of this.stones) stone.mixer.stopAllAction();
    for (const look of this.looks) look.dispose();
  }
}
