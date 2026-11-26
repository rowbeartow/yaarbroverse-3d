// The new button drawn (the rules are src/game/ability.ts). Looks only.
//
//   Yaarbro   Walblum himself, from his own model: he shoots out feet first
//             in his flying kick, and tumbles back in a ball.
//   Caputo    Claw Slash: three glowing claw marks, side by side, that fly
//             to what they strike and are gone. Nothing comes back.
//
// Either way a burst shows where a strike lands.

import { AdditiveBlending, AnimationMixer, Box3, DoubleSide, Group, LoopRepeat, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, Vector3, type AnimationAction, type Material } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AbilityEvent, AbilityState } from '../game/ability';
import type { HeroName } from '../game/hero';
import { WALBLUM_HEIGHT } from './rescue';

/** How long the burst where a strike lands shows, and how long the claw marks hang there. */
const BURST = 0.22;
/** The claw marks: how long each is, how far apart they fly, and how much they lean. */
const MARK = { long: 1.25, wide: 0.16, apart: 0.3, lean: 0.5 };

export class AbilityView {
  readonly group = new Group();
  private readonly flyer = new Group();
  private readonly marks = new Group();
  private readonly burst: Mesh;
  private readonly looks: Material[] = [];
  private mixer: AnimationMixer | null = null;
  private readonly actions: Partial<Record<'kick' | 'spin', AnimationAction>> = {};
  private burstFor = 0;
  private clock = 0;
  private showing = 'none';

  /** `walblum` is his model, for Yaarbro; without it (or for Caputo) the claw marks are drawn. */
  constructor(hero: HeroName, walblum: GLTF | null, simple: boolean) {
    if (hero === 'Yaarbro' && walblum) {
      const model = cloneRigged(walblum.scene);
      model.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        if (simple) {
          const full = mesh.material as MeshStandardMaterial;
          const own = new MeshLambertMaterial({ map: full.map, color: full.color });
          mesh.material = own;
          this.looks.push(own);
        }
      });
      const size = new Box3().setFromObject(model).getSize(new Vector3());
      const scale = WALBLUM_HEIGHT / Math.max(size.y, 0.001);
      // His middle is the place the rules have: half his height up his model.
      model.position.y = -size.y / 2;
      const holder = new Group();
      holder.add(model);
      holder.scale.setScalar(scale);
      this.flyer.add(holder);
      this.mixer = new AnimationMixer(model);
      for (const name of ['kick', 'spin'] as const) {
        const clip = walblum.animations.find((each) => each.name === name);
        if (!clip) continue;
        const action = this.mixer.clipAction(clip);
        action.setLoop(LoopRepeat, Infinity);
        action.setEffectiveWeight(0);
        action.play();
        this.actions[name] = action;
      }
    }
    // Three claw marks, glowing: each a long thin blade, leaning, brightest in the middle.
    const glow = new MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
    const core = new MeshBasicMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });
    this.looks.push(glow, core);
    for (const side of [-1, 0, 1]) {
      const mark = new Group();
      const outer = new Mesh(new PlaneGeometry(MARK.wide, MARK.long), glow);
      const inner = new Mesh(new PlaneGeometry(MARK.wide * 0.4, MARK.long * 0.86), core);
      mark.add(outer, inner);
      // Upright blades seen from behind and above, leaning the way a paw swipes, flying edge on.
      mark.position.x = side * MARK.apart;
      mark.rotation.z = MARK.lean;
      this.marks.add(mark);
    }
    this.burst = new Mesh(new RingGeometry(0.5, 0.72, 28), new MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
    this.looks.push(this.burst.material as Material);
    this.flyer.visible = false;
    this.marks.visible = false;
    this.burst.visible = false;
    this.group.add(this.flyer, this.marks, this.burst);
  }

  /** What the rules reported: a strike lands with a burst. */
  event(event: AbilityEvent, state: AbilityState): void {
    if (event.what !== 'reach') return;
    this.burstFor = BURST;
    this.burst.position.set(state.x, state.y, state.z);
  }

  update(state: AbilityState | null, camera: { x: number; y: number; z: number }, dt: number): void {
    this.clock += dt;
    this.burstFor = Math.max(0, this.burstFor - dt);
    this.burst.visible = this.burstFor > 0;
    if (this.burst.visible) {
      const t = 1 - this.burstFor / BURST;
      this.burst.scale.setScalar(0.5 + t * 1.6);
      (this.burst.material as MeshBasicMaterial).opacity = 0.9 * (1 - t);
      this.burst.lookAt(camera.x, camera.y, camera.z);
    }
    const out = state?.phase === 'out';
    const back = state?.phase === 'back';
    const walblum = this.mixer !== null;
    this.flyer.visible = walblum && Boolean(state) && (out || back);
    // The claw marks fly out, hang a moment where they land, and are gone: nothing flies back.
    this.marks.visible = !walblum && Boolean(state) && (out || (back && state!.hit && this.burstFor > 0));
    this.showing = this.flyer.visible ? (out ? 'kick' : 'spin') : this.marks.visible ? 'marks' : 'none';
    if (!state) return;
    const flat = Math.hypot(state.heading.x, state.heading.z);
    const yaw = Math.atan2(state.heading.x, state.heading.z);
    if (this.flyer.visible && this.mixer) {
      for (const name of ['kick', 'spin'] as const) this.actions[name]?.setEffectiveWeight(name === (out ? 'kick' : 'spin') ? 1 : 0);
      this.mixer.update(dt);
      this.flyer.position.set(state.x, state.y, state.z);
      // Feet first along the way he flies; coming back he tumbles, facing home.
      this.flyer.rotation.set(out ? -Math.atan2(state.heading.y, Math.max(flat, 1e-3)) : 0, yaw, 0, 'YXZ');
    }
    if (this.marks.visible) {
      if (out) this.marks.position.set(state.x, state.y, state.z);
      this.marks.rotation.set(0, yaw, 0);
      const pulse = 1 + 0.12 * Math.sin(this.clock * 40);
      this.marks.scale.set(pulse, out ? pulse : 1 + (1 - this.burstFor / BURST) * 0.5, 1);
    }
  }

  /** What is on screen, for the browser checks. */
  info(): { showing: string; burst: boolean; x: number; y: number; z: number } {
    const at = this.flyer.visible ? this.flyer.position : this.marks.position;
    return { showing: this.showing, burst: this.burst.visible, x: at.x, y: at.y, z: at.z };
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    for (const material of this.looks) material.dispose();
    this.burst.geometry.dispose();
    this.marks.traverse((node) => (node as Mesh).geometry?.dispose());
  }
}
