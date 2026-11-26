// A level's rescue drawn (the rules are src/game/rescue.ts): Walblum the
// muskrat, from his own model (assets/heroes/walblum.glb, rigged by
// tools/rig-walblum.py), and the log he is stranded on. Looks only. He casts
// no shadow and is not moved or drawn when the hero is far off: the dock is
// the lake's heaviest place.

import { AnimationMixer, Box3, CylinderGeometry, Group, LoopRepeat, Mesh, MeshLambertMaterial, MeshStandardMaterial, Vector3, type AnimationAction, type Material } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RESCUE, logAt, type Rescue, type RescuePhase, type RescueSpot } from '../game/rescue';
import type { WaterView } from './water';

/** The file he is drawn from, and how tall he stands in the game, in metres: a small muskrat beside a hero of 1.6. */
export const WALBLUM_MODEL = 'walblum.glb';
export const WALBLUM_HEIGHT = 0.85;
/** He is neither moved nor drawn when the hero is further than this from him. */
const NEAR = 70;

type Clip = 'idle' | 'scared' | 'paddle' | 'cheer';
const CLIP_FOR: Record<RescuePhase, Clip> = { stranded: 'scared', cheering: 'cheer', paddling: 'paddle', climbing: 'paddle', walking: 'idle', waiting: 'cheer', rescued: 'cheer' };

export class RescueView {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly log: Mesh;
  private readonly mixer: AnimationMixer;
  private readonly actions: Partial<Record<Clip, AnimationAction>> = {};
  private showing: Clip = 'scared';
  private readonly looks: Material[] = [];

  constructor(private readonly spot: RescueSpot, source: GLTF, simple: boolean, private readonly water: WaterView | null) {
    const model = cloneRigged(source.scene);
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (simple) {
        const full = mesh.material as MeshStandardMaterial;
        const own = new MeshLambertMaterial({ map: full.map, color: full.color });
        mesh.material = own;
        this.looks.push(own);
      }
    });
    const size = new Box3().setFromObject(model).getSize(new Vector3());
    this.body.add(model);
    this.body.scale.setScalar(WALBLUM_HEIGHT / Math.max(size.y, 0.001));
    this.group.add(this.body);
    this.mixer = new AnimationMixer(model);
    for (const name of ['idle', 'scared', 'paddle', 'cheer'] as Clip[]) {
      const clip = source.animations.find((each) => each.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.setEffectiveWeight(name === 'scared' ? 1 : 0);
      action.play();
      this.actions[name] = action;
    }
    // The log he is stranded on: a short length of trunk, awash.
    const wood = new MeshLambertMaterial({ color: 0x6a4a2e });
    this.looks.push(wood);
    this.log = new Mesh(new CylinderGeometry(0.34, 0.38, 2.2, 10), wood);
    this.log.rotation.z = Math.PI / 2;
    this.log.castShadow = false;
    this.group.add(this.log);
  }

  update(rescue: Rescue, hero: { x: number; z: number }, dt: number): void {
    const near = Math.hypot(hero.x - rescue.x, hero.z - rescue.z) < NEAR || Math.hypot(hero.x - this.spot.log.x, hero.z - this.spot.log.z) < NEAR;
    this.group.visible = near;
    if (!near) return;
    // His log goes on drifting, bobbing a little, whether he is on it or not.
    const at = logAt(this.spot, rescue.clock);
    const bob = Math.sin(rescue.clock * 1.7) * 0.04;
    this.log.position.set(at.x, this.spot.surface + RESCUE.sits - 0.36 + bob, at.z);
    this.log.rotation.y = rescue.clock * 0.12;
    const onLog = rescue.phase === 'stranded' || rescue.phase === 'cheering';
    const wanted = CLIP_FOR[rescue.phase];
    const clip = this.actions[wanted] ? wanted : 'idle';
    this.showing = clip;
    for (const name of Object.keys(this.actions) as Clip[]) {
      const action = this.actions[name]!;
      const weight = action.getEffectiveWeight();
      action.setEffectiveWeight(weight + ((name === clip ? 1 : 0) - weight) * (1 - Math.exp(-10 * dt)));
    }
    this.mixer.update(dt);
    this.body.position.set(rescue.x, rescue.y + (onLog ? bob : 0), rescue.z);
    // Climbing, he goes up nose first.
    this.body.rotation.set(rescue.phase === 'climbing' ? -Math.PI / 2.4 : 0, rescue.facing, 0, 'YXZ');
    if (this.water && rescue.phase === 'paddling' && Math.random() < dt * 8) this.water.ring(rescue.x, rescue.z, 1.1, 0.8);
  }

  /** What is on screen, for the browser checks. */
  info(): { visible: boolean; clip: string; x: number; y: number; z: number; tall: number } {
    return { visible: this.group.visible, clip: this.showing, x: this.body.position.x, y: this.body.position.y, z: this.body.position.z, tall: WALBLUM_HEIGHT };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const material of this.looks) material.dispose();
    this.log.geometry.dispose();
  }
}
