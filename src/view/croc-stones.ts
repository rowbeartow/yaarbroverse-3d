// Crocodile stepping stones, drawn: each one is the crocodile's own model,
// bigger, floating high with its head, eyes, back and tail out of the water,
// lying across the way with its back where a hero can stand. It is put every
// frame where the rules have it (src/game/moving.ts, kind `float`):
//
//   - under the water, out of sight, until its turn in the row's rhythm; a
//     moment before, bubbles come up where it is;
//   - surfacing nose first with a splash at its head and its tail;
//   - floating, breathing, its tail lazily moving, rings spreading round it;
//   - dipping and bobbing when a hero lands on it;
//   - its warning before it goes: it shudders and bubbles stream up;
//   - going under nose first with a splash, gliding a little forward;
//   - on Hard, stood on too long, it swings its head round and snaps.

import { AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, MeshLambertMaterial, Vector3, type AnimationAction, type Material, type Mesh, type MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Level, Solid } from '../game/level';
import { FLOAT_LOW, floatPhase, type Motion } from '../game/moving';
import type { WaterView } from './water';

/**
 * A stepping stone is drawn exactly as long, nose to tail, as its solid is
 * (the longer side), so every part of the crocodile a player can see is
 * footing (the owner's rule, 2026-11-16). The lake's are 4.6 m, much bigger
 * than its hunting crocodiles (2.6 m), so a back holds a hero.
 */
export const stoneLength = (s: Solid): number => 2 * Math.max(s.halfX, s.halfZ);

type Float = Extract<Motion, { kind: 'float' }>;

interface Stone {
  id: string;
  motion: Float;
  root: Group;
  /** Turns for surfacing and going under (nose up or down) and the shudder of its warning. */
  tilt: Group;
  mixer: AnimationMixer;
  float: AnimationAction | null;
  snap: AnimationAction | null;
  /** How far its back is above the root, in its floating pose. */
  back: number;
  /** Which way it faces along its length: its head is this way (+1 or -1 along x before turning). */
  phase: string;
  /** A bob after a hero lands on it: how far down, and how fast. */
  bob: number;
  bobSpeed: number;
  /** Seconds to the next ring spreading round it, and to the next bubble. */
  nextRing: number;
  nextBubble: number;
  /** How far it has glided forward while going under. */
  glide: number;
  /** Where its head and tail are, seen from above, for splashes. */
  head: Vector3;
  tail: Vector3;
}

export class CrocStones {
  readonly group = new Group();
  private readonly stones: Stone[] = [];
  private readonly looks: Material[] = [];
  private clock = 0;
  /** The id of the stone a hero stood on last frame, to see a landing. */
  private underHero: string | null = null;

  constructor(level: Level, source: GLTF, simple: boolean, private readonly water: WaterView | null) {
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
      const mixer = new AnimationMixer(model);
      const action = (names: string[], once: boolean): AnimationAction | null => {
        const clip = names.map((name) => source.animations.find((each) => each.name === name)).find(Boolean);
        if (!clip) return null;
        const made = mixer.clipAction(clip);
        made.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
        made.clampWhenFinished = true;
        return made;
      };
      const float = action(['float', 'lurk'], false);
      float?.play();
      // Each a little out of step with the next, so the row does not breathe as one.
      mixer.update(index * 0.53);
      model.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3());
      const middle = box.getCenter(new Vector3());
      const length = stoneLength(s);
      const scale = length / Math.max(size.z, 0.001);
      model.scale.multiplyScalar(scale);
      model.position.set(-middle.x * scale, -middle.y * scale, -middle.z * scale);
      const tilt = new Group();
      tilt.add(model);
      const root = new Group();
      root.add(tilt);
      // It lies along the longer side of its solid, every other one facing the other way.
      const alongX = s.halfX >= s.halfZ;
      root.rotation.y = (alongX ? Math.PI / 2 : 0) + (index % 2 ? Math.PI : 0);
      root.name = `stone-${s.id}`;
      const ahead = new Vector3(0, 0, length * 0.42).applyAxisAngle(new Vector3(0, 1, 0), root.rotation.y);
      this.stones.push({
        id: s.id,
        motion: s.motion as Float,
        root,
        tilt,
        mixer,
        float,
        snap: action(['turn_snap', 'lunge'], true),
        // The top of its back is a little under the top of the whole model (its lifted head).
        back: (size.y * scale) / 2 - 0.08,
        phase: 'gone',
        bob: 0,
        bobSpeed: 0,
        nextRing: 0.5 + index * 0.37,
        nextBubble: 0,
        glide: 0,
        head: new Vector3(s.x + ahead.x, 0, s.z + ahead.z),
        tail: new Vector3(s.x - ahead.x, 0, s.z - ahead.z),
      });
      root.visible = false;
      this.group.add(root);
    });
  }

  /** Something the rules say a stone just began: surfacing, going under. */
  event(id: string, what: string): void {
    const stone = this.stones.find((each) => each.id === id);
    if (!stone || !this.water) return;
    if (what === 'back') {
      // Surfacing: a splash at its head and its tail.
      this.water.splash(stone.head.x, stone.head.z, 0.55);
      this.water.splash(stone.tail.x, stone.tail.z, 0.35);
    } else if (what === 'fall') {
      this.water.splash(stone.head.x, stone.head.z, 0.3);
      this.water.ring((stone.head.x + stone.tail.x) / 2, (stone.head.z + stone.tail.z) / 2, 3.4, 1.6);
    }
  }

  /** Puts each crocodile where the rules have its solid now. `standing` is the solid the hero stands on. */
  update(solids: readonly Solid[], standing: string | null, dt: number): void {
    this.clock += dt;
    // A hero landing on a back: it bobs down under them and back.
    if (standing !== this.underHero) {
      const landed = this.stones.find((each) => each.id === standing);
      if (landed) {
        landed.bobSpeed = -1.1;
        this.water?.ring((landed.head.x + landed.tail.x) / 2, (landed.head.z + landed.tail.z) / 2, 2.6, 1.0);
      }
      this.underHero = standing;
    }
    for (const stone of this.stones) {
      const s = solids.find((each) => each.id === stone.id);
      const piece = s?.piece;
      if (!s || !piece) continue;
      const now = floatPhase(stone.motion, piece.since ?? -1, piece.clock);
      stone.phase = piece.phase;
      // Out of sight under the water: not drawn at all, so it costs nothing. Just before its turn, bubbles where it lies.
      const hidden = piece.phase === 'gone' && now.under >= 1 && piece.dip >= FLOAT_LOW - 0.01;
      stone.root.visible = !hidden;
      const soon = piece.phase === 'gone' && floatPhase(stone.motion, (piece.since ?? -1) >= 0 ? (piece.since ?? -1) + 0.6 : -1, piece.clock >= 0 ? piece.clock + 0.6 : -1).phase === 'rise';
      stone.nextBubble -= dt;
      if ((soon || piece.telling) && stone.nextBubble <= 0 && this.water) {
        stone.nextBubble = piece.telling ? 0.05 : 0.08;
        const t = Math.random();
        this.water.bubbles(stone.tail.x + (stone.head.x - stone.tail.x) * t, -0.9, stone.tail.z + (stone.head.z - stone.tail.z) * t, 2);
      }
      if (hidden) {
        stone.glide = 0;
        continue;
      }
      // The bob of a landing, a spring that settles.
      stone.bobSpeed += (-stone.bob * 60 - stone.bobSpeed * 7) * dt;
      stone.bob += stone.bobSpeed * dt;
      // Surfacing comes up nose first; going under goes nose first and glides on a little.
      let pitch = 0;
      if (piece.phase === 'rise') pitch = -0.22 * now.under;
      if (piece.phase === 'sink') {
        pitch = 0.2 * Math.min(1, now.under * 2);
        stone.glide += dt * 0.9;
      } else stone.glide = Math.max(0, stone.glide - dt);
      // Its warning: it shudders, and bubbles stream up round it.
      const shudder = piece.telling ? Math.sin(this.clock * 31 + s.x) * 0.06 : 0;
      stone.tilt.rotation.set(pitch, 0, shudder);
      stone.tilt.position.set(0, 0, stone.glide);
      // The rules' top is its back.
      stone.root.position.set(s.x, s.top - stone.back + stone.bob + Math.sin(this.clock * 1.4 + s.z) * 0.015, s.z);
      // Rings spread round a crocodile afloat.
      stone.nextRing -= dt;
      if (stone.nextRing <= 0 && (piece.phase === 'rest' || piece.phase === 'tell') && this.water) {
        stone.nextRing = 1.6 + Math.random();
        this.water.ring((stone.head.x + stone.tail.x) / 2, (stone.head.z + stone.tail.z) / 2, 2.2, 1.5);
      }
      stone.mixer.update(dt);
    }
  }

  /** A crocodile stood on too long swings its head round and snaps its jaws. */
  snap(id: string): void {
    const stone = this.stones.find((each) => each.id === id);
    if (!stone?.snap) return;
    stone.snap.reset().setEffectiveWeight(1).play();
    stone.float?.setEffectiveWeight(0);
    const { float, snap } = stone;
    const done = (): void => {
      snap.setEffectiveWeight(0);
      float?.setEffectiveWeight(1);
      stone.mixer.removeEventListener('finished', done);
    };
    stone.mixer.addEventListener('finished', done);
    this.water?.splash(stone.head.x, stone.head.z, 0.4);
  }

  /** What each crocodile is doing, for the browser checks: its id, phase, height and whether it is drawn. */
  info(): { id: string; phase: string; y: number; shown: boolean }[] {
    return this.stones.map((stone) => ({ id: stone.id, phase: stone.phase, y: stone.root.position.y, shown: stone.root.visible }));
  }

  dispose(): void {
    for (const stone of this.stones) stone.mixer.stopAllAction();
    for (const look of this.looks) look.dispose();
  }
}
