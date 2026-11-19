// Draws the enemies: the marmot scout, the giant mosquito and the crocodile, each from its
// model, playing the clip for whatever the rules say it is doing. Also the
// acorn, and the line an attack is aimed along while its warning lasts. Looks
// only: where an enemy is and what it is doing come from src/game/enemy.ts.
//
// The models are made by tools/rig-quadruped.py (marmot, crocodile) and
// tools/rig-insect.py (mosquito), which also name the clips used here. A
// crocodile also pushes a wake across the surface as it swims near it, plainest
// in its tell, when it creeps at a hero with its eyes sunk.

import {
  AnimationMixer,
  Box3,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type AnimationAction,
  type Material,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CROC } from '../game/crocodile';
import type { Level } from '../game/level';
import { ENEMY, type Enemy, type EnemyKind, type EnemyPhase, type EnemyTuning } from '../game/enemy';

export interface EnemyModelSpec {
  /** File name in assets/models/. */
  file: string;
  /** A lighter copy of the model, for a level that asks for light enemies (`lightEnemies`). */
  light?: string;
  /** How long the enemy is drawn, nose to tail, in metres. */
  length: number;
  /** Where the rules' place for it is on its body: the ground under its feet, or its middle. */
  stands: boolean;
  /** It lives in the water (the crocodile): seen while it lurks, its warning is a swim and not a held wind-up, and its lunge plays once. */
  swims?: boolean;
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
    /** Crocodile only: lying low, and swimming deep. */
    lurk?: string;
    deep?: string;
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
    // 5 thousand triangles where the full one has 14 (tools/thin-model.mjs).
    light: 'mosquito-light.glb',
    length: 1.45,
    stands: false,
    clips: { idle: 'hover', warning: 'warning', attack: 'dive', rest: 'winded', defeated: 'defeated' },
  },
  crocodile: {
    file: 'crocodile.glb',
    // Nose to tail, long enough to be the biggest thing in the water, its head
    // about as wide as a hero.
    length: 2.6,
    stands: false,
    swims: true,
    clips: { idle: 'swim', warning: 'swim', attack: 'lunge', rest: 'lurk', hit: 'hit', defeated: 'defeated', lurk: 'lurk', deep: 'dive' },
  },
};

/** The model files one level needs: its enemies', and its boss's. They are fetched when the level is picked. */
export const modelFilesOf = (level: Level): string[] => {
  const kinds = new Set<EnemyKind>((level.enemies ?? []).map((spot) => spot.kind));
  // Crocodile stepping stones are drawn from the crocodile's model too.
  if (level.solids.some((s) => s.motion?.kind === 'float')) kinds.add('crocodile');
  // A boss is always drawn from the full model.
  const files = new Set([...kinds].map((kind) => modelFileFor(kind, level)));
  if (level.boss) files.add(ENEMY_MODELS[level.boss.look.model].file);
  return [...files];
};

/** The file one of a level's enemies is drawn from: the lighter one where the level asks and there is one. */
export const modelFileFor = (kind: EnemyKind, level: Level): string => (level.lightEnemies ? ENEMY_MODELS[kind].light : undefined) ?? ENEMY_MODELS[kind].file;

export type ClipKey = keyof EnemyModelSpec['clips'];

const FADE_RATE = 14;
/** How many times a second a struck enemy's flash turns over. */
const FLASH_BLINKS = 15;
const ACORN_COLOR = 0x8a5a2b;

const acornShape = new SphereGeometry(ENEMY.acornRadius, 12, 8);
const laneShape = new CylinderGeometry(0.05, 0.05, 1, 6, 1, true);
const wakeShape = new PlaneGeometry(1, 1);

/** A wake: two pale lines spreading back from a point, fading out behind. Drawn once, in code. */
let wakeTexture: CanvasTexture | null = null;
const wakePicture = (): CanvasTexture => {
  if (wakeTexture) return wakeTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const pen = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  for (let i = 0; i < 3; i += 1) {
    const back = 0.25 + i * 0.28;
    pen.strokeStyle = `rgba(255,255,255,${0.9 - i * 0.28})`;
    pen.lineWidth = 7 - i * 1.5;
    pen.beginPath();
    pen.moveTo(size * (0.5 - back * 0.45), size * (0.06 + back));
    pen.lineTo(size * 0.5, size * 0.06 + i * 6);
    pen.lineTo(size * (0.5 + back * 0.45), size * (0.06 + back));
    pen.stroke();
  }
  const fade = pen.createLinearGradient(0, 0, 0, size);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  pen.globalCompositeOperation = 'destination-out';
  pen.fillStyle = fade;
  pen.fillRect(0, 0, size, size);
  wakeTexture = new CanvasTexture(canvas);
  return wakeTexture;
};

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

  /**
   * Set by a boss (src/view/boss.ts), which decides its own clips: which clip
   * shows, and where in it to hold (a share of its length), if it is held.
   */
  pose: { clip: ClipKey; hold?: number } | null = null;

  constructor(
    private readonly spec: EnemyModelSpec,
    source: GLTF,
    simple: boolean,
    /** For a boss drawn from an enemy's model: how many times the size, and a colour laid over its own. */
    look: { scale?: number; tint?: number } = {},
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
      if (look.tint !== undefined) own.color.multiply(new Color(look.tint));
      mesh.material = own;
      // A crocodile in the water casts no shadow worth its cost: the lake's frame budget is tight.
      mesh.castShadow = !full.transparent && !spec.swims;
      mesh.receiveShadow = !full.transparent;
      this.materials.push({ material: own, opacity: full.opacity, seeThrough: full.transparent });
    });

    // Scale it to its length, and put the rules' place for it at the middle of the group.
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const middle = box.getCenter(new Vector3());
    const scale = (spec.length * (look.scale ?? 1)) / Math.max(size.z, 0.001);
    model.scale.multiplyScalar(scale);
    model.position.set(-middle.x * scale, spec.stands ? -box.min.y * scale : -middle.y * scale, -middle.z * scale);
    this.body.add(model);
    this.root.add(this.body);

    this.mixer = new AnimationMixer(model);
    for (const [key, name] of Object.entries(spec.clips) as Array<[ClipKey, string]>) {
      const clip = source.animations.find((each) => each.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      const loops = key === 'idle' || key === 'walk' || key === 'rest' || key === 'lurk' || key === 'deep' || (key === 'attack' && !spec.stands && !spec.swims);
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
    if (spec.swims) {
      this.wake = new Mesh(wakeShape, new MeshBasicMaterial({ map: wakePicture(), color: 0xeafcf7, transparent: true, opacity: 0, depthWrite: false }));
      this.wake.renderOrder = 3;
      this.wake.visible = false;
    }
    this.root.visible = false;
  }

  private readonly wake: Mesh | null = null;

  /** The acorn, the aiming line and a crocodile's wake: added to the scene beside the enemy itself. */
  get extras(): Mesh[] {
    return this.wake ? [this.acorn, this.lane, this.wake] : [this.acorn, this.lane];
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
      case 'concealed':
        return clips.lurk ? 'lurk' : 'idle';
      default:
        if (clips.deep && enemy.spot.surface !== undefined && enemy.y < enemy.spot.surface - 0.9) return 'deep';
        if (this.spec.swims && this.moving < 0.1) return 'lurk';
        return clips.walk && this.moving > 0.15 ? 'walk' : 'idle';
    }
  }

  /** Matches the picture to the rules. `near` is false for an enemy too far off to matter (src/view/sight.ts): it is neither moved nor drawn. */
  update(enemy: Enemy, tuning: EnemyTuning, near: boolean, dt: number): void {
    // Hidden: a scout that has not come out, a sidekick its boss has not called, and a beaten enemy once it has faded.
    // A crocodile lying low is still seen: its eyes and snout show above the water.
    const hidden = (enemy.phase === 'concealed' && !this.spec.swims) || enemy.dormant || (enemy.phase === 'defeated' && enemy.timer > ENEMY.fade);
    this.root.visible = near && !hidden;
    this.acorn.visible = false;
    this.lane.visible = false;
    if (this.wake) this.wake.visible = false;
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
    const next = this.pose?.clip ?? this.choose(enemy);
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
    if (this.pose) {
      const action = this.actions[this.pose.clip];
      if (this.pose.hold !== undefined) held(this.pose.clip, this.pose.hold);
      else if (action) action.paused = false;
    } else if (enemy.phase === 'warning' && !this.spec.swims) held('warning', enemy.timer / (ENEMY.warning * tuning.warning));
    else if (enemy.phase === 'dodge') held('dodge', 0.15 + 0.7 * (enemy.timer / ENEMY.dodgeTime));
    else if (enemy.phase === 'dodge-warning') held('dodge', 0.15 * (enemy.timer / ENEMY.dodgeWarning));
    else if (enemy.phase === 'attack' && this.spec.stands) {
      const action = this.actions.attack;
      if (action) action.paused = false;
    }
    const walk = this.actions.walk;
    if (walk) walk.setEffectiveTimeScale(0.6 + Math.max(this.moving, this.pace / 1.5));
    this.mixer.update(dt);
    this.wakeAt(enemy);

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
      const share = enemy.phase === 'warning' ? enemy.timer / ((this.spec.swims ? CROC.warning : ENEMY.warning) * tuning.warning) : 1;
      this.laneMaterial.opacity = enemy.phase === 'attack' ? 0.55 : 0.25 + 0.3 * share * (0.6 + 0.4 * Math.sin(this.clock * (10 + 20 * share)));
    }
  }

  /**
   * The wake: a pale V on the water ahead of a crocodile swimming near the
   * surface, longer the faster it goes, and plainest in its tell, when it
   * creeps at a hero with its eyes sunk.
   */
  private wakeAt(enemy: Enemy): void {
    const wake = this.wake;
    const surface = enemy.spot.surface;
    if (!wake || surface === undefined || enemy.phase === 'defeated') return;
    const depth = surface - enemy.y;
    const telling = enemy.phase === 'warning';
    const strength = (telling ? 1 : Math.min(1, this.moving * 1.4) * 0.6) * (depth < 1 ? 1 : 0);
    if (strength < 0.05) return;
    wake.visible = true;
    const facing = this.root.rotation.y;
    // Its point at the snout, spreading back along its body.
    wake.position.set(enemy.x + Math.sin(facing) * 0.2, surface + 0.03, enemy.z + Math.cos(facing) * 0.2);
    wake.rotation.set(-Math.PI / 2, 0, facing + Math.PI);
    wake.scale.set(1.6, 2.6 + strength, 1);
    (wake.material as MeshBasicMaterial).opacity = 0.55 * strength * (0.85 + 0.15 * Math.sin(this.clock * 9));
  }

  /** The clip showing now, for the browser checks. */
  info(): { clip: string; visible: boolean; aimLine: boolean; flashing: boolean; wake: boolean } {
    return { clip: this.spec.clips[this.showing] ?? 'idle', visible: this.root.visible, aimLine: this.lane.visible, flashing: this.flashing > 0, wake: Boolean(this.wake?.visible) };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const each of this.materials) each.material.dispose();
    (this.acorn.material as Material).dispose();
    if (this.wake) (this.wake.material as Material).dispose();
    this.laneMaterial.dispose();
  }
}
