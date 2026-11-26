// The monster pike drawn (the rules are src/game/pike.ts). Looks only. It is
// the lake's own pike model (assets/fish/pike.glb), much bigger and darker,
// as the owner asked: one more fish's worth of triangles at the dock, the
// lake's heaviest place. It casts no shadow.
//
// What shows what the rules are doing:
//   circling     a long dark shape under the water, going round its log.
//   on the line  thrashing at the surface at the end of the line.
//   a charge     its back and fin out of the water, a wake ahead of it, and
//                on Easy a line along the way it will come.
//   beside the   its head up out of the water with its jaws open (the tell),
//   log          the snap, then lying still at the surface: the opening. On
//                Easy a ring shows where the jaws are aimed.
//   a hit        it flashes and thrashes.
//   beaten       it rolls belly up and sinks.

import {
  AnimationMixer,
  Box3,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Vector3,
  type AnimationAction,
  type Material,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PIKE, pikeUp, type Pike, type PikePhase, type PikeSpot } from '../game/pike';
import type { WaterView } from './water';

/** How much of its own colour the monster keeps: it is the lake's pike, darker. */
const DARK = new Color(0.42, 0.5, 0.46);
/** The colour it flashes when it is hit. */
const FLASH = new Color(1, 0.86, 0.6);
/** It is neither moved nor drawn when the hero is further than this from its log. */
const NEAR = 60;

type Clip = 'idle' | 'swim' | 'thrash' | 'gape' | 'snap' | 'beaten';

/** The clip that shows each thing the rules have it doing. A clip the model lacks falls back to the next best. */
const CLIP_FOR: Record<PikePhase, Clip> = {
  lurking: 'swim',
  hooked: 'thrash',
  dragging: 'swim',
  circling: 'swim',
  'charge-tell': 'swim',
  charge: 'swim',
  rising: 'swim',
  gape: 'gape',
  snap: 'snap',
  rest: 'idle',
  stagger: 'thrash',
  beaten: 'beaten',
};
const FALLBACK: Record<Clip, Clip[]> = { idle: [], swim: ['idle'], thrash: ['swim', 'idle'], gape: ['idle'], snap: ['thrash', 'idle'], beaten: ['idle'] };

export class PikeView {
  readonly group = new Group();
  private readonly body = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions: Partial<Record<Clip, AnimationAction>> = {};
  private showing: Clip = 'swim';
  private readonly skins: Array<MeshStandardMaterial | MeshLambertMaterial> = [];
  private readonly looks: Material[] = [];
  /** Its dark shape on the water, the line a charge will take and the ring a snap will land in. */
  private readonly shade: Mesh;
  private readonly lane: Line;
  private readonly ring: Mesh;
  private flash = 0;
  private clock = 0;
  private lastPhase: PikePhase = 'lurking';
  /** How far it has rolled over, beaten, and how far its head is lifted out of the water. */
  private roll = 0;
  private lift = 0;

  constructor(private readonly spot: PikeSpot, source: GLTF, simple: boolean, private readonly water: WaterView | null) {
    const model = cloneRigged(source.scene);
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Its own skin, so darkening it and flashing it leave the lake's ordinary pike alone.
      const full = mesh.material as MeshStandardMaterial;
      const own = simple ? new MeshLambertMaterial({ map: full.map, color: full.color }) : full.clone();
      own.color.multiply(DARK);
      mesh.material = own;
      this.skins.push(own);
    });
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const middle = box.getCenter(new Vector3());
    model.position.set(-middle.x, -middle.y, -middle.z);
    this.body.add(model);
    this.body.scale.setScalar(PIKE.length / Math.max(size.z, 0.001));
    this.body.rotation.order = 'YXZ';
    this.group.add(this.body);
    this.mixer = new AnimationMixer(model);
    for (const name of ['idle', 'swim', 'thrash', 'gape', 'snap', 'beaten'] as Clip[]) {
      const clip = source.animations.find((each) => each.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      const once = name === 'snap' || name === 'beaten';
      action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
      action.clampWhenFinished = once;
      action.setEffectiveWeight(name === 'swim' ? 1 : 0);
      action.play();
      this.actions[name] = action;
    }
    const look = <T extends Material>(material: T): T => {
      this.looks.push(material);
      return material;
    };
    this.shade = new Mesh(new CircleGeometry(0.5, 24), look(new MeshBasicMaterial({ color: 0x06242a, transparent: true, opacity: 0.55, depthWrite: false, fog: false })));
    this.shade.rotation.order = 'YXZ';
    this.shade.renderOrder = 3;
    this.shade.frustumCulled = false;
    this.lane = new Line(new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3)), look(new LineBasicMaterial({ color: 0xffd766, transparent: true, opacity: 0.9, depthWrite: false, fog: false })));
    this.lane.frustumCulled = false;
    this.lane.renderOrder = 4;
    this.ring = new Mesh(new RingGeometry(0.86, 1, 40), look(new MeshBasicMaterial({ color: 0xff8a5c, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false, fog: false })));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 4;
    this.group.add(this.shade, this.lane, this.ring);
    this.lane.visible = false;
    this.ring.visible = false;
  }

  private play(clip: Clip, dt: number): void {
    const has = (name: Clip): boolean => this.actions[name] !== undefined;
    const pick = has(clip) ? clip : (FALLBACK[clip].find(has) ?? 'idle');
    if (pick !== this.showing) {
      const action = this.actions[pick];
      // A clip that plays once starts from its beginning each time it is asked for.
      if (action && (pick === 'snap' || pick === 'beaten')) action.reset();
      this.showing = pick;
    }
    for (const name of Object.keys(this.actions) as Clip[]) {
      const action = this.actions[name]!;
      const weight = action.getEffectiveWeight();
      action.setEffectiveWeight(weight + ((name === pick ? 1 : 0) - weight) * (1 - Math.exp(-14 * dt)));
    }
    this.mixer.update(dt);
  }

  /** A hit landed on it: it flashes. */
  strike(): void {
    this.flash = 0.4;
    this.water?.splash(this.body.position.x, this.body.position.z, 0.8);
  }

  /** Puts it where the rules have it. `hero` is where the hero is, for leaving it alone when far off. */
  update(pike: Pike, hero: { x: number; z: number }, dt: number): void {
    const { spot } = this;
    const n = spot.numbers;
    this.clock += dt;
    const sunk = pike.phase === 'beaten' && pike.timer > PIKE.fade;
    const near = Math.hypot(hero.x - spot.home.x, hero.z - spot.home.z) < NEAR;
    this.group.visible = near && !sunk;
    if (!this.group.visible) return;

    // What it was doing a moment ago, for the splash as it changes.
    if (pike.phase !== this.lastPhase && this.water) {
      if (pike.phase === 'gape') {
        this.water.splash(pike.x, pike.z, 1);
        this.water.ring(pike.x, pike.z, 5, 1.4);
      } else if (pike.phase === 'snap') this.water.splash(pike.x + Math.sin(pike.facing) * 1.6, pike.z + Math.cos(pike.facing) * 1.6, 0.8);
      else if (pike.phase === 'charge') this.water.ring(pike.x, pike.z, 4, 1);
      else if (pike.phase === 'stagger' || pike.phase === 'beaten') this.water.ring(pike.x, pike.z, 6, 1.6);
      else if (pike.phase === 'circling' && pikeUpBefore(this.lastPhase)) this.water.ring(pike.x, pike.z, 4, 1.2);
    }
    this.lastPhase = pike.phase;

    const up = pikeUp(pike);
    const thrashing = pike.phase === 'hooked' || pike.phase === 'stagger';
    this.play(CLIP_FOR[pike.phase], dt);
    // Beside the log its head comes up out of the water; beaten, it rolls belly up.
    this.lift += ((pike.phase === 'gape' || pike.phase === 'snap' ? 1 : 0) - this.lift) * (1 - Math.exp(-9 * dt));
    this.roll += ((pike.phase === 'beaten' ? 1 : 0) - this.roll) * (1 - Math.exp(-2.5 * dt));
    const wobble = thrashing ? Math.sin(this.clock * 22) * 0.25 : 0;
    this.body.position.set(pike.x, pike.y + this.lift * 0.35, pike.z);
    this.body.rotation.set(-this.lift * 0.42, pike.facing + wobble, this.roll * Math.PI);

    // Hit: a flash of pale gold over its dark skin.
    this.flash = Math.max(0, this.flash - dt);
    const lit = this.flash > 0 && Math.floor(this.flash * 20) % 2 === 0;
    for (const skin of this.skins) skin.emissive.copy(lit ? FLASH : BLACK).multiplyScalar(lit ? 0.6 : 0);

    // Its dark shape on the water while it is under: what a player casts at, and what circles the log.
    const depth = spot.surface - pike.y;
    const shaded = pike.phase !== 'beaten' && !up && depth > 0.2;
    this.shade.visible = shaded;
    if (shaded) {
      this.shade.position.set(pike.x, spot.surface + 0.03, pike.z);
      this.shade.rotation.set(-Math.PI / 2, pike.facing, 0);
      this.shade.scale.set(PIKE.length * 0.34, PIKE.length * 1.02, 1);
    }
    if (this.water) {
      // On the line it churns the water; charging, it pushes a wake.
      if (thrashing && Math.random() < dt * 7) this.water.ring(pike.x, pike.z, 2.6, 0.9);
      if (pike.phase === 'charge' && Math.random() < dt * 14) this.water.ring(pike.x, pike.z, 1.8, 0.7);
      if (pike.phase === 'charge-tell' && Math.random() < dt * 5) this.water.ring(pike.x, pike.z, 2.2, 0.9);
      if (pike.phase === 'beaten' && pike.timer < PIKE.fade && Math.random() < dt * 6) this.water.bubbles(pike.x, pike.y, pike.z, 2);
    }

    // Easy: where a charge will come, and where the jaws will snap.
    const charging = pike.phase === 'charge-tell' || pike.phase === 'charge';
    this.lane.visible = n.aimLine && charging;
    if (this.lane.visible) {
      const at = this.lane.geometry.getAttribute('position') as Float32BufferAttribute;
      at.setXYZ(0, pike.x, spot.surface + 0.08, pike.z);
      at.setXYZ(1, pike.target.x, spot.surface + 0.08, pike.target.z);
      at.needsUpdate = true;
    }
    this.ring.visible = n.aimLine && pike.phase === 'gape';
    if (this.ring.visible) {
      this.ring.position.set(pike.target.x, pike.target.y + 0.06, pike.target.z);
      this.ring.scale.setScalar(n.snapReach * (1 + 0.06 * Math.sin(this.clock * 10)));
    }
  }

  /** What is on screen, for the browser checks. */
  info(): { visible: boolean; clip: string; shade: boolean; flashing: boolean; aim: boolean; x: number; y: number; z: number; long: number } {
    const size = new Box3().setFromObject(this.body).getSize(new Vector3());
    return {
      visible: this.group.visible,
      clip: this.showing,
      shade: this.shade.visible,
      flashing: this.flash > 0,
      aim: this.lane.visible || this.ring.visible,
      x: this.body.position.x,
      y: this.body.position.y,
      z: this.body.position.z,
      long: Math.max(size.x, size.z),
    };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const skin of this.skins) skin.dispose();
    for (const material of this.looks) material.dispose();
    this.shade.geometry.dispose();
    this.lane.geometry.dispose();
    this.ring.geometry.dispose();
  }
}

const BLACK = new Color(0, 0, 0);
const pikeUpBefore = (phase: PikePhase): boolean => phase === 'rest' || phase === 'snap' || phase === 'gape';
