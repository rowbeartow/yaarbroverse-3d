// Draws the enemies: the marmot scout and the giant mosquito, each from its
// model, playing the clip for whatever the rules say it is doing. Also the
// acorn, and the line an attack is aimed along while its warning lasts. Looks
// only: where an enemy is and what it is doing come from src/game/enemy.ts.
//
// The models are made by tools/rig-quadruped.py (marmot) and
// tools/rig-insect.py (mosquito), which also name the clips used here.

import {
  AnimationMixer,
  Box3,
  CylinderGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type Material,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMY, type Enemy, type EnemyKind, type EnemyPhase, type EnemyTuning } from '../game/enemy';

export interface EnemyModelSpec {
  /** File name in assets/models/. */
  file: string;
  /** How long the enemy is drawn, nose to tail, in metres. */
  length: number;
  /** Where the rules' place for it is on its body: the ground under its feet, or its middle. */
  stands: boolean;
  /** The clip for each thing it does. */
  clips: {
    idle: string;
    /** Marmot only: moving about while on watch. */
    walk?: string;
    warning: string;
    attack: string;
    rest: string;
    /** Marmot only: the first strike, and its hop out of the way. */
    hit?: string;
    dodge?: string;
    defeated: string;
  };
}

export const ENEMY_MODELS: Record<EnemyKind, EnemyModelSpec> = {
  marmot: {
    file: 'marmot.glb',
    // About half as tall as Yaarbro, as in Caputo Mountain.
    length: 2,
    stands: true,
    clips: { idle: 'idle', walk: 'walk', warning: 'warning', attack: 'throw', rest: 'winded', hit: 'hit', dodge: 'hop', defeated: 'defeated' },
  },
  mosquito: {
    file: 'mosquito.glb',
    length: 1.45,
    stands: false,
    clips: { idle: 'hover', warning: 'warning', attack: 'dive', rest: 'winded', defeated: 'defeated' },
  },
};

/** The model files to download before the game can start. */
export const ENEMY_MODEL_FILES = (): string[] => Object.values(ENEMY_MODELS).map((spec) => spec.file);

type ClipKey = keyof EnemyModelSpec['clips'];

/** Enemies further than this from the hero are neither moved nor drawn: the mist has them. */
const SEEN_WITHIN = 70;
const FADE_RATE = 14;
/** How many times a second a struck enemy's flash turns over. */
const FLASH_BLINKS = 15;
const ACORN_COLOR = 0x8a5a2b;

const acornShape = new SphereGeometry(ENEMY.acornRadius, 12, 8);
const laneShape = new CylinderGeometry(0.05, 0.05, 1, 6, 1, true);

export class EnemyView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions: Partial<Record<ClipKey, AnimationAction>> = {};
  private readonly weights: Partial<Record<ClipKey, number>> = {};
  private readonly materials: Array<{ material: MeshStandardMaterial | MeshLambertMaterial; opacity: number; seeThrough: boolean }> = [];
  private readonly acorn: Mesh;
  private readonly lane: Mesh;
  private readonly laneMaterial: MeshBasicMaterial;
  private phase: EnemyPhase | null = null;
  private showing: ClipKey = 'idle';
  private last = { x: 0, z: 0 };
  private moving = 0;
  private pace = 0;
  private risen = 0;
  private gone = 0;
  /** The rest that follows a strike opens with the flinch. */
  private struck = false;
  /** Seconds of the flash of a strike still to show. */
  private flashing = 0;
  private clock = 0;

  constructor(
    private readonly spec: EnemyModelSpec,
    source: GLTF,
    simple: boolean,
  ) {
    const model = cloneRigged(source.scene);
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      // Each enemy needs materials of its own: it flashes when struck and fades when beaten.
      const full = mesh.material as MeshStandardMaterial;
      const own = simple
        ? new MeshLambertMaterial({ map: full.map, color: full.color, transparent: full.transparent, opacity: full.opacity, side: full.side })
        : full.clone();
      mesh.material = own;
      mesh.castShadow = !full.transparent;
      mesh.receiveShadow = !full.transparent;
      this.materials.push({ material: own, opacity: full.opacity, seeThrough: full.transparent });
    });

    // Scale it to its length, and put the rules' place for it at the middle of the group.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const middle = box.getCenter(new Vector3());
    const scale = spec.length / Math.max(size.z, 0.001);
    model.scale.multiplyScalar(scale);
    model.position.set(-middle.x * scale, spec.stands ? -box.min.y * scale : -middle.y * scale, -middle.z * scale);
    this.body.add(model);
    this.root.add(this.body);

    this.mixer = new AnimationMixer(model);
    for (const [key, name] of Object.entries(spec.clips) as Array<[ClipKey, string]>) {
      const clip = source.animations.find((each) => each.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      const loops = key === 'idle' || key === 'walk' || key === 'rest' || (key === 'attack' && !spec.stands);
      action.setLoop(loops ? LoopRepeat : LoopOnce, loops ? Infinity : 1);
      action.clampWhenFinished = true;
      action.enabled = true;
      action.setEffectiveWeight(0);
      action.play();
      this.actions[key] = action;
      this.weights[key] = 0;
    }
    this.weights.idle = 1;

    // The acorn, and the line an attack is aimed along. They live in the level, not on the body.
    this.acorn = new Mesh(acornShape, simple ? new MeshLambertMaterial({ color: ACORN_COLOR }) : new MeshStandardMaterial({ color: ACORN_COLOR, roughness: 0.6 }));
    this.acorn.scale.set(1, 1.25, 1);
    this.acorn.castShadow = true;
    this.acorn.visible = false;
    this.laneMaterial = new MeshBasicMaterial({ color: spec.stands ? 0xffd27a : 0xff8a5c, transparent: true, opacity: 0, depthWrite: false });
    this.lane = new Mesh(laneShape, this.laneMaterial);
    this.lane.visible = false;
    this.root.visible = false;
  }

  /** The acorn and the aiming line: added to the scene beside the enemy itself. */
  get extras(): Mesh[] {
    return [this.acorn, this.lane];
  }

  /** The hero's move just struck it: it flashes bright, on and off, for as long as it cannot be struck again. */
  strike(): void {
    this.struck = true;
    this.flashing = ENEMY.flash;
  }

  private choose(enemy: Enemy): ClipKey {
    const { clips } = this.spec;
    switch (enemy.phase) {
      case 'warning':
        return 'warning';
      case 'attack':
        return 'attack';
      case 'rest':
        return this.struck && clips.hit && enemy.timer < 0.4 ? 'hit' : 'rest';
      case 'dodge':
      case 'dodge-warning':
        return clips.dodge ? 'dodge' : 'idle';
      case 'defeated':
        return 'defeated';
      default:
        return clips.walk && this.moving > 0.15 ? 'walk' : 'idle';
    }
  }

  /** Matches the picture to the rules. `near` is false for an enemy too far off to matter. */
  update(enemy: Enemy, tuning: EnemyTuning, heroZ: number, dt: number): void {
    const near = Math.abs(enemy.z - heroZ) < SEEN_WITHIN;
    const hidden = enemy.phase === 'concealed' || (enemy.phase === 'defeated' && enemy.timer > ENEMY.fade);
    this.root.visible = near && !hidden;
    this.acorn.visible = false;
    this.lane.visible = false;
    if (!this.root.visible) {
      this.phase = enemy.phase;
      this.risen = 0;
      this.pace = 0;
      this.last = { x: enemy.x, z: enemy.z };
      return;
    }
    this.clock += dt;
    const entered = enemy.phase !== this.phase;
    this.phase = enemy.phase;
    if (enemy.phase !== 'rest') this.struck = this.struck && enemy.phase === 'defeated';

    // Where it is and which way it faces.
    const speed = dt > 0 ? Math.hypot(enemy.x - this.last.x, enemy.z - this.last.z) / dt : 0;
    this.last = { x: enemy.x, z: enemy.z };
    this.moving += (Math.min(speed, 1.5) / 1.5 - this.moving) * (1 - Math.exp(-10 * dt));
    // A scout giving chase covers ground several times faster than its shuffle: its legs keep up.
    this.pace += (Math.min(speed, 6) - this.pace) * (1 - Math.exp(-10 * dt));
    this.root.position.set(enemy.x, enemy.y, enemy.z);
    let facing = enemy.facing;
    let nose = 0;
    const aiming = enemy.phase === 'warning' || enemy.phase === 'attack';
    const along = new Vector3(enemy.target.x - enemy.from.x, enemy.target.y - enemy.from.y, enemy.target.z - enemy.from.z);
    if (aiming && along.lengthSq() > 1e-6) {
      facing = Math.atan2(along.x, along.z);
      // The mosquito points its whole body down the line of its dive.
      if (!this.spec.stands) nose = Math.atan2(-along.y, Math.hypot(along.x, along.z));
    }
    let turn = facing - this.root.rotation.y;
    turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2;
    this.root.rotation.y += turn * (1 - Math.exp(-12 * dt));
    const pitch = enemy.phase === 'warning' ? nose * Math.min(1, enemy.timer / 0.25) : enemy.phase === 'attack' ? nose : 0;
    this.body.rotation.x += (pitch - this.body.rotation.x) * (1 - Math.exp(-14 * dt));

    // A marmot pops up out of hiding; a beaten enemy drops, tumbles and fades.
    this.risen = Math.min(1, this.risen + dt / 0.25);
    const pop = this.risen < 1 ? 0.2 + 0.8 * (1 - (1 - this.risen) ** 2) : 1;
    this.gone = enemy.phase === 'defeated' ? Math.min(1, enemy.timer / ENEMY.fade) : 0;
    this.body.scale.setScalar(pop);
    this.body.position.y = enemy.phase === 'defeated' && !this.spec.stands ? -2.5 * this.gone * this.gone : 0;
    for (const each of this.materials) {
      const fading = this.gone > 0;
      each.material.transparent = each.seeThrough || fading;
      each.material.opacity = each.opacity * (1 - this.gone);
      each.material.depthWrite = !each.seeThrough;
      // The flash of a strike: bright, blinking, then gone.
      const lit = this.flashing > 0 ? (Math.floor(this.flashing * FLASH_BLINKS) % 2 === 0 ? 1 : 0.3) : 0;
      each.material.emissive.setRGB(lit, lit * 0.92, lit * 0.7);
    }
    this.flashing = Math.max(0, this.flashing - dt);

    // Which clip, and where in it.
    const next = this.choose(enemy);
    if (next !== this.showing || entered) {
      const action = this.actions[next];
      // A clip that plays once starts from its beginning each time.
      if (action && action.loop === LoopOnce) action.reset().play();
      this.showing = next;
    }
    for (const key of Object.keys(this.actions) as ClipKey[]) {
      const action = this.actions[key];
      if (!action) continue;
      const weight = this.weights[key] ?? 0;
      const want = key === this.showing ? 1 : 0;
      const now = weight + (want - weight) * (1 - Math.exp(-FADE_RATE * dt));
      this.weights[key] = now;
      action.setEffectiveWeight(now);
    }
    // A warning is stretched to last exactly as long as the rules' warning does, and a
    // hop to last as long as the hop: the clip is held at the share of it that has passed.
    const held = (key: ClipKey, share: number): void => {
      const action = this.actions[key];
      if (!action) return;
      action.paused = true;
      action.time = action.getClip().duration * Math.min(1, Math.max(0, share));
    };
    if (enemy.phase === 'warning') held('warning', enemy.timer / (ENEMY.warning * tuning.warning));
    else if (enemy.phase === 'dodge') held('dodge', 0.15 + 0.7 * (enemy.timer / ENEMY.dodgeTime));
    else if (enemy.phase === 'dodge-warning') held('dodge', 0.15 * (enemy.timer / ENEMY.dodgeWarning));
    else if (enemy.phase === 'attack' && this.spec.stands) {
      const action = this.actions.attack;
      if (action) action.paused = false;
    }
    const walk = this.actions.walk;
    if (walk) walk.setEffectiveTimeScale(0.6 + Math.max(this.moving, this.pace / 1.5));
    this.mixer.update(dt);

    // The acorn: in the raised paw through the warning, then in flight.
    if (this.spec.stands && enemy.phase === 'warning' && enemy.timer > 0.3 * ENEMY.warning * tuning.warning) {
      this.acorn.visible = true;
      this.acorn.position.set(enemy.from.x, enemy.from.y, enemy.from.z);
    } else if (enemy.acorn) {
      this.acorn.visible = true;
      this.acorn.position.set(enemy.acorn.x, enemy.acorn.y, enemy.acorn.z);
      this.acorn.rotation.x += dt * 14;
    }

    // The line the attack will follow, shown for as long as the warning lasts
    // and through the attack itself, pulsing faster as the warning runs out.
    // Only where the level's difficulty asks for it: without it, the warning
    // is the enemy's own wind-up (the clip held above) and its sound.
    if (tuning.aimLine !== false && aiming && along.lengthSq() > 1e-6) {
      const length = along.length();
      this.lane.visible = true;
      this.lane.position.set((enemy.from.x + enemy.target.x) / 2, (enemy.from.y + enemy.target.y) / 2, (enemy.from.z + enemy.target.z) / 2);
      this.lane.scale.set(1, length, 1);
      this.lane.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along.normalize()));
      const share = enemy.phase === 'warning' ? enemy.timer / (ENEMY.warning * tuning.warning) : 1;
      this.laneMaterial.opacity = enemy.phase === 'attack' ? 0.55 : 0.25 + 0.3 * share * (0.6 + 0.4 * Math.sin(this.clock * (10 + 20 * share)));
    }
  }

  /** The clip showing now, for the browser checks. */
  info(): { clip: string; visible: boolean; aimLine: boolean; flashing: boolean } {
    return { clip: this.spec.clips[this.showing] ?? 'idle', visible: this.root.visible, aimLine: this.lane.visible, flashing: this.flashing > 0 };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const each of this.materials) each.material.dispose();
    (this.acorn.material as Material).dispose();
    this.laneMaterial.dispose();
  }
}
