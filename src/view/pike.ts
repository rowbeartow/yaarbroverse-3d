// The monster pike drawn (the rules are src/game/pike.ts). Looks only.
//
// It is the pike the kids picked (assets/fish/pike.glb), drawn nose to tail as
// long as the level says and darkened (the owner's word, 2026-11-25: the
// picked pike, much bigger and darker). The rules keep where its head is;
// the body is laid out behind it, the way it faces.
//
//   in the fishing water   a long dark shape under the surface, with a far
//                          bigger shadow on the water than any fish's
//   on the line            near the top, thrashing when the rules say so
//   circling, charging     under the surface; a charge throws rings off the water
//   its jaws up            head and shoulders out of the water off the end of
//                          the log, reared back
//   the snap, and spent    thrown up onto the log, then lying along it
//   struck                 it flashes pale, and thrashes back in
//   beaten                 it rolls belly up and sinks out of sight
//
// On Easy a line on the water shows where a charge or a snap will go.
//
// One skinned model with no shadow, so it costs the dock one more fish.

import { AnimationMixer, Box3, CircleGeometry, Color, DoubleSide, Group, LoopRepeat, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, PlaneGeometry, Vector3, type AnimationAction, type Material } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FishingState } from '../game/fishing';
import { PIKE, type Pike, type PikePhase, type PikeSpot } from '../game/pike';
import type { WaterView } from './water';

/** How much of its own colour the monster keeps: the rest is taken out, so it reads as a dark shape. */
const DARK = new Color(0.34, 0.42, 0.36);
/** How far back from its nose the rules' head point is, as a share of its length. */
const HEAD_AT = 0.12;
type Clip = 'idle' | 'swim' | 'thrash';

export class PikeView {
  readonly root = new Group();
  /** Its shadow on the water and Easy's aim line: they lie in the level, not on the body. */
  readonly extras: Group = new Group();
  private readonly body = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions: Partial<Record<Clip, AnimationAction>> = {};
  private readonly materials: Array<MeshStandardMaterial | MeshLambertMaterial> = [];
  private readonly tints: Color[] = [];
  private readonly shade: Mesh;
  private readonly lane: Mesh;
  private readonly looks: Material[] = [];
  private showing: Clip = 'swim';
  private flashing = 0;
  private pitch = 0;
  private roll = 0;
  private lift = 0;
  private clock = 0;
  private last: PikePhase = 'lurking';

  constructor(private readonly spot: PikeSpot, source: GLTF, simple: boolean, private readonly water: WaterView | null) {
    const model = cloneRigged(source.scene);
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Its own copy of the material, darkened, so the fish in the fishing water keep their colours and it can flash.
      const full = mesh.material as MeshStandardMaterial;
      const own = simple ? new MeshLambertMaterial({ map: full.map, color: full.color.clone() }) : full.clone();
      own.color.multiply(DARK);
      own.transparent = true;
      mesh.material = own;
      this.materials.push(own);
      this.tints.push(own.color.clone());
    });
    // The model faces +z about its middle; it is scaled to the level's length and hung with its head point at the root.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const middle = box.getCenter(new Vector3());
    const scale = spot.length / Math.max(size.z, 0.001);
    model.position.set(-middle.x, -middle.y, -middle.z);
    this.body.add(model);
    this.body.scale.setScalar(scale);
    this.body.position.z = -spot.length * (0.5 - HEAD_AT);
    this.root.add(this.body);
    this.mixer = new AnimationMixer(model);
    for (const name of ['idle', 'swim', 'thrash'] as Clip[]) {
      const clip = source.animations.find((each) => each.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.setEffectiveWeight(name === 'swim' ? 1 : 0);
      action.play();
      this.actions[name] = action;
    }

    const dark = new MeshBasicMaterial({ color: 0x06140f, transparent: true, opacity: 0.5, depthWrite: false });
    this.shade = new Mesh(new CircleGeometry(0.5, 24), dark);
    this.shade.rotation.x = -Math.PI / 2;
    this.shade.renderOrder = 2;
    const line = new MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.55, depthWrite: false, side: DoubleSide });
    this.lane = new Mesh(new PlaneGeometry(1, 1), line);
    this.lane.rotation.x = -Math.PI / 2;
    this.lane.renderOrder = 2;
    this.lane.visible = false;
    this.looks.push(dark, line);
    this.extras.add(this.shade, this.lane);
  }

  /** A hit: it flashes pale while it thrashes back into the water. */
  strike(): void {
    this.flashing = 0.9;
  }

  private play(clip: Clip, speed: number, dt: number): void {
    this.showing = clip;
    for (const name of Object.keys(this.actions) as Clip[]) {
      const action = this.actions[name]!;
      const weight = action.getEffectiveWeight();
      action.setEffectiveWeight(weight + ((name === clip ? 1 : 0) - weight) * (1 - Math.exp(-12 * dt)));
    }
    this.mixer.update(dt * speed);
  }

  /** Draws it where the rules have it. `fishing` is the level's fishing as it is now, for how it fights on the line. */
  update(pike: Pike, fishing: FishingState | null, dt: number): void {
    const { spot } = this;
    this.clock += dt;
    const phase = pike.phase;
    const entered = phase !== this.last;
    this.last = phase;
    const thrashing = phase === 'hooked' && fishing?.fight === 'thrash';

    // How it holds itself: nose up with its jaws out of the water, lying up the log, belly up when beaten.
    const wantPitch = phase === 'snapTell' ? 0.6 : phase === 'snap' || phase === 'rest' ? 0.16 : phase === 'charge' ? 0.05 : 0;
    const wantRoll = phase === 'defeated' ? Math.PI : phase === 'stagger' ? 0.5 * Math.sin(this.clock * 17) : thrashing ? 0.35 * Math.sin(this.clock * 13) : 0;
    // On the line it is drawn nearer the top than it lurks, so the fight shows.
    const wantLift = phase === 'hooked' ? (thrashing ? PIKE.depth - 0.15 : PIKE.depth - 0.5) : 0;
    const ease = 1 - Math.exp(-(phase === 'snap' ? 30 : 7) * dt);
    this.pitch += (wantPitch - this.pitch) * ease;
    this.roll += (wantRoll - this.roll) * (phase === 'defeated' ? 1 - Math.exp(-2.2 * dt) : ease);
    this.lift += (wantLift - this.lift) * ease;
    this.root.position.set(pike.x, pike.y + this.lift, pike.z);
    this.root.rotation.set(-this.pitch, pike.facing, this.roll, 'YXZ');

    if (phase === 'lurking') this.play('swim', 0.6, dt);
    else if (phase === 'hooked') this.play(thrashing ? 'thrash' : 'swim', thrashing ? 1.4 : 1, dt);
    else if (phase === 'chargeTell') this.play('idle', 2.4, dt);
    else if (phase === 'charge' || phase === 'closing') this.play('swim', 2.2, dt);
    else if (phase === 'snapTell') this.play('idle', 1.8, dt);
    else if (phase === 'snap' || phase === 'stagger') this.play('thrash', 1.5, dt);
    else if (phase === 'rest') this.play('idle', 0.5, dt);
    else if (phase === 'defeated') this.play('idle', 0.25, dt);
    else this.play('swim', 1, dt);

    // Beaten, it fades as it sinks. Struck, it flashes pale.
    const gone = phase === 'defeated' ? Math.min(1, Math.max(0, (pike.timer - 1.2) / 1.6)) : 0;
    this.root.visible = gone < 1;
    this.flashing = Math.max(0, this.flashing - dt);
    const flash = this.flashing > 0 ? 0.5 + 0.5 * Math.sin(this.flashing * 40) : 0;
    this.materials.forEach((material, i) => {
      material.opacity = 1 - gone;
      material.color.copy(this.tints[i]).lerp(WHITE, flash * 0.7);
    });

    // Its shadow on the water, while it is under it: far bigger than any fish's.
    const under = spot.surface - (pike.y + this.lift);
    const shaded = phase !== 'defeated' && phase !== 'snapTell' && phase !== 'snap' && phase !== 'rest' && phase !== 'stagger' && under > 0.2;
    this.shade.visible = shaded;
    if (shaded) {
      const back = spot.length * (0.5 - HEAD_AT);
      this.shade.position.set(pike.x - Math.sin(pike.facing) * back, spot.surface + 0.03, pike.z - Math.cos(pike.facing) * back);
      this.shade.rotation.z = pike.facing;
      this.shade.scale.set(spot.length * 0.3, spot.length * 1.02, 1);
      (this.shade.material as MeshBasicMaterial).opacity = 0.34 + 0.2 * Math.min(1, under / PIKE.depth);
    }

    // Easy's line: where a charge or a snap will go, from the moment of its tell.
    const aimed = spot.numbers.aimLine && (phase === 'chargeTell' || phase === 'charge' || phase === 'snapTell' || phase === 'snap');
    this.lane.visible = aimed;
    if (aimed) {
      const from = phase === 'chargeTell' || phase === 'snapTell' ? pike : pike.from;
      const dx = pike.target.x - from.x;
      const dz = pike.target.z - from.z;
      const length = Math.hypot(dx, dz);
      const snap = phase === 'snapTell' || phase === 'snap';
      this.lane.position.set(from.x + dx / 2, snap ? pike.target.y - PIKE.headRise * 0.5 + 0.06 : spot.surface + 0.05, from.z + dz / 2);
      this.lane.rotation.z = Math.atan2(dx, dz);
      this.lane.scale.set(PIKE.radius * 2, Math.max(length, 0.01), 1);
      (this.lane.material as MeshBasicMaterial).opacity = 0.4 + 0.2 * Math.sin(this.clock * 10);
    }

    // The water it throws about.
    const { water } = this;
    if (!water) return;
    if (entered && (phase === 'snapTell' || phase === 'snap' || phase === 'stagger' || phase === 'defeated' || phase === 'dragging')) {
      water.splash(pike.x, pike.z, phase === 'snap' ? 1 : 0.8);
      water.ring(pike.x, pike.z, 3.2, 1.2);
    }
    if (phase === 'charge' && Math.random() < dt * 14) water.ring(pike.x, pike.z, 1.8, 0.7);
    if (phase === 'chargeTell' && Math.random() < dt * 5) water.bubbles(pike.x, pike.y, pike.z, 3);
    if ((thrashing || phase === 'stagger') && Math.random() < dt * 9) water.ring(pike.x, pike.z, 2.2, 0.8);
    if (phase === 'snapTell' && Math.random() < dt * 6) water.ring(pike.x, pike.z, 1.6, 0.9);
  }

  /** What is on screen, for the browser checks. */
  info(): { phase: PikePhase; visible: boolean; clip: Clip; shadow: boolean; aimLine: boolean; flashing: boolean; length: number } {
    return { phase: this.last, visible: this.root.visible, clip: this.showing, shadow: this.shade.visible, aimLine: this.lane.visible, flashing: this.flashing > 0, length: this.spot.length };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const material of this.materials) material.dispose();
    for (const material of this.looks) material.dispose();
    this.shade.geometry.dispose();
    this.lane.geometry.dispose();
  }
}

const WHITE = new Color(1, 1, 1);
