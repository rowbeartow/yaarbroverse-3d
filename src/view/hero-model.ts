// Heroes drawn from a model file: a rigged, textured glTF model whose animation
// clips are mixed from how the hero is moving.
//
// TO GIVE A HERO ITS MODEL:
//   1. Compress the owner's original file with tools/compress-hero.mjs, which
//      saves it in assets/heroes/ (for example assets/heroes/yaarbro.glb) and
//      lists its clips. The build copies it into media/models/.
//   2. Add the hero to HERO_MODELS below: the file name, how tall the hero
//      stands, and the names of its clips. A missing clip is fine: the player
//      uses what is there (see `clips` below).
// Until then the hero is built from shapes (heroes.ts).

import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  MeshLambertMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  type AnimationAction,
  type Interpolant,
  type KeyframeTrack,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MOVE, type HeroName } from '../game/hero';
import { airPhase, approach, breath, groundMix, strideRate } from './hero-motion';
import type { HeroInfo, HeroView, Pose } from './heroes';

export type ClipRole = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'roll';

export interface HeroModelSpec {
  /** File name in assets/models/. */
  file: string;
  /** How tall the hero stands in the game, in metres. */
  height: number;
  /** Extra turn, in radians, for a model that does not face forward (+z) in its file. */
  turn: number;
  /**
   * For each kind of movement, the clip names to look for, best first. Capitals
   * do not matter and a name only has to appear somewhere in the clip's name.
   * A kind with no match is done without:
   *   no run     the walk is played faster
   *   no walk    the run is played slower
   *   no idle    the hero stands in the middle pose of its walk, breathing
   *   no jump    a stride of the run (or walk) is held in the air
   *   no fall    the late part of the jump is held on the way down
   *   no land    a quick squash instead
   */
  clips: Partial<Record<ClipRole, string[]>>;
  /**
   * Library jump clips start with a crouch and end with a landing. These are
   * the shares of the clip (0 to 1) where the airborne part starts and ends.
   * In the air that part is held as a pose, moved along by upward speed.
   * For a hero with no jump clip, they are the shares of its run clip to hold
   * instead: the part of a stride where both feet are off the ground.
   */
  airborne: [number, number];
  /** Ground speeds, in metres a second, at which the walk and run clips look right. */
  walkSpeed: number;
  runSpeed: number;
  /** Size of the soft spot on the ground: across and along the body. */
  shadow: { across: number; along: number };
  /** Where a portrait camera should look, and from how far. */
  portrait: { height: number; distance: number };
}

/** The heroes that have a model. A hero not listed here is built from shapes. */
export const HERO_MODELS: Partial<Record<HeroName, HeroModelSpec>> = {
  // Made by the owner in Meshy and rigged there as a humanoid. The file holds
  // two clips, Walking and Running. Idle, jump, falling, landing and roll are
  // listed so they are picked up as soon as the file has them.
  Yaarbro: {
    file: 'yaarbro.glb',
    height: 2.2,
    turn: 0,
    clips: {
      idle: ['Idle'],
      walk: ['Walking', 'Walk'],
      run: ['Running', 'Run'],
      jump: ['Jump'],
      fall: ['Falling', 'Fall'],
      land: ['Landing', 'Land'],
      roll: ['Roll'],
    },
    // No jump clip: these are the part of the run with both feet off the ground.
    airborne: [0.08, 0.2],
    walkSpeed: 1.5,
    runSpeed: 4.6,
    shadow: { across: 1.05, along: 0.9 },
    portrait: { height: 1.52, distance: 2.5 },
  },
};

/**
 * A stand-in used to build and check the loader and animation player: a CC0
 * rigged robot (see CREDITS.md). It is only downloaded when the address has
 * ?standin, and then it plays both heroes.
 */
export const STAND_IN: HeroModelSpec = {
  file: 'standin.glb',
  height: 1.7,
  turn: 0,
  clips: { idle: ['Idle'], walk: ['Walking'], run: ['Running'], jump: ['Jump'] },
  airborne: [0.3, 0.62],
  walkSpeed: 2.2,
  runSpeed: 6,
  shadow: { across: 1.1, along: 1.1 },
  portrait: { height: 1.6, distance: 2.7 },
};

export const wantsStandIn = (): boolean => new URLSearchParams(window.location.search).has('standin');

/** Finds the clip for a kind of movement by the names in the spec. */
export const findClip = (clips: AnimationClip[], names: string[] | undefined): AnimationClip | null => {
  for (const name of names ?? []) {
    const wanted = name.toLowerCase();
    const exact = clips.find((clip) => clip.name.toLowerCase() === wanted);
    if (exact) return exact;
    const partial = clips.find((clip) => clip.name.toLowerCase().includes(wanted));
    if (partial) return partial;
  }
  return null;
};

/**
 * A standing pose made from a walk: every joint held at the middle of its
 * swing. Used when a model has no idle clip of its own.
 */
export const standingPose = (walk: AnimationClip): AnimationClip => {
  const samples = 32;
  const tracks: KeyframeTrack[] = [];
  for (const track of walk.tracks) {
    const size = track.getValueSize();
    // Each track knows how to read itself between keys; the type list leaves the method out.
    const reader = (track as unknown as { createInterpolant(): Interpolant }).createInterpolant();
    const sum = new Array<number>(size).fill(0);
    let first: ArrayLike<number> | null = null;
    for (let i = 0; i < samples; i += 1) {
      const value = reader.evaluate((walk.duration * i) / samples) as ArrayLike<number>;
      // The same turn can be written two ways round; add them up the same way round.
      let sign = 1;
      if (track instanceof QuaternionKeyframeTrack) {
        if (!first) first = Array.from(value);
        else if (first[0] * value[0] + first[1] * value[1] + first[2] * value[2] + first[3] * value[3] < 0) sign = -1;
      }
      for (let k = 0; k < size; k += 1) sum[k] += sign * value[k];
    }
    let middle = sum.map((total) => total / samples);
    if (track instanceof QuaternionKeyframeTrack) middle = new Quaternion().fromArray(middle).normalize().toArray();
    const held = track.clone();
    held.times = new Float32Array([0, 1]);
    held.values = new Float32Array([...middle, ...middle]);
    tracks.push(held);
  }
  return new AnimationClip(`${walk.name} (standing)`, 1, tracks);
};

/**
 * Where a model stands in the pose it is in now: the height of its lowest and
 * highest points, and the middle of its footprint (the lowest twentieth of it).
 */
const footprint = (model: Object3D, meshes: Mesh[]): { ground: number; top: number; x: number; z: number } => {
  model.updateMatrixWorld(true);
  const points: number[] = [];
  const point = new Vector3();
  let ground = Infinity;
  let top = -Infinity;
  for (const mesh of meshes) {
    const count = mesh.geometry.getAttribute('position').count;
    for (let i = 0; i < count; i += 1) {
      // For a mesh on a skeleton this follows the bones.
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
      points.push(point.x, point.y, point.z);
      ground = Math.min(ground, point.y);
      top = Math.max(top, point.y);
    }
  }
  const soles = ground + (top - ground) * 0.05;
  const box = new Box3();
  for (let i = 0; i < points.length; i += 3) {
    if (points[i + 1] <= soles) box.expandByPoint(point.set(points[i], points[i + 1], points[i + 2]));
  }
  const middle = box.getCenter(new Vector3());
  return { ground, top, x: middle.x, z: middle.z };
};

export class ModelHero implements HeroView {
  readonly root = new Group();
  readonly shadow: { across: number; along: number };
  readonly portrait: { height: number; distance: number };
  private readonly body = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions: Partial<Record<ClipRole, AnimationAction>> = {};
  private readonly clipNames: string[];
  /** How much of the air pose is showing, 0 to 1, and of the landing clip. */
  private air = 0;
  private landing = 0;
  private squashed = 0;
  private mix = { idle: 1, walk: 0, run: 0 };
  /** True when the idle is a held pose made from the walk, which needs a breath added. */
  private readonly stillIdle: boolean;
  private clock = 0;

  /** Plain materials made for this hero alone (see `simple`), freed with it. */
  private readonly ownMaterials: MeshLambertMaterial[] = [];

  /**
   * `simple` gives the model plain matte shading with its own colours and
   * textures, for machines that draw in software (see Materials).
   */
  constructor(
    private readonly spec: HeroModelSpec,
    source: GLTF,
    simple = false,
  ) {
    this.shadow = spec.shadow;
    this.portrait = spec.portrait;
    this.clipNames = source.animations.map((clip) => clip.name);

    // Each hero on screen gets its own copy of the skeleton; the meshes and
    // textures are shared with the downloaded file.
    const model = cloneRigged(source.scene);
    const meshes: Mesh[] = [];
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      meshes.push(mesh);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // A moving skeleton can carry the mesh outside the box it was measured in.
      mesh.frustumCulled = false;
      if (simple) {
        const full = mesh.material as MeshStandardMaterial;
        const plain = new MeshLambertMaterial({ map: full.map, color: full.color, vertexColors: full.vertexColors });
        this.ownMaterials.push(plain);
        mesh.material = plain;
      }
    });
    this.body.add(model);
    this.root.add(this.body);

    this.mixer = new AnimationMixer(model);
    const found: Partial<Record<ClipRole, AnimationClip>> = {};
    for (const role of ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'roll'] as const) {
      const clip = findClip(source.animations, spec.clips[role]);
      if (clip) found[role] = clip;
    }
    // Doing without (see `clips` in HeroModelSpec): stand in the middle pose
    // of the walk, and hold a stride of the run in the air.
    const stride = found.walk ?? found.run;
    this.stillIdle = !found.idle && Boolean(stride);
    if (!found.idle && stride) found.idle = standingPose(stride);
    const leap = found.run ?? found.walk;
    if (!found.jump && !found.fall && leap) {
      found.jump = leap.clone();
      found.jump.name = `${leap.name} (held in the air)`;
    }
    for (const role of Object.keys(found) as ClipRole[]) {
      const action = this.mixer.clipAction(found[role]!);
      action.enabled = true;
      action.setEffectiveWeight(0);
      this.actions[role] = action;
    }
    // Everything that loops plays all the time; the mixing is done by weight.
    for (const role of ['idle', 'walk', 'run', 'fall'] as const) this.actions[role]?.setLoop(LoopRepeat, Infinity).play();
    // The jump is never played through: its airborne part is held as a pose.
    const jump = this.actions.jump;
    if (jump) {
      jump.play();
      jump.paused = true;
    }
    const land = this.actions.land;
    if (land) {
      land.setLoop(LoopOnce, 1);
      land.clampWhenFinished = true;
    }
    this.animate({ pace: 0, grounded: true, rise: 0 }, 0);

    // Stand the model on the spot the rules use, as it stands at rest: scaled
    // to its height, soles on the ground, and the middle of its footprint
    // over the spot. Then an edge it can stand on looks like one, and the
    // soft spot sits under its feet.
    const stance = footprint(model, meshes);
    const scale = spec.height / Math.max(stance.top - stance.ground, 0.001);
    model.scale.multiplyScalar(scale);
    model.position.set(-stance.x * scale, -stance.ground * scale, -stance.z * scale);
    this.body.rotation.y = spec.turn;
  }

  react(event: 'jump' | 'land' | 'bounce'): void {
    if (event === 'land') {
      const land = this.actions.land;
      if (land) {
        land.reset().play();
        this.landing = 1;
      } else this.squashed = 0.18;
    } else {
      this.squashed = event === 'bounce' ? -0.2 : -0.12;
    }
  }

  animate(pose: Pose, dt: number): void {
    const { actions, spec } = this;
    const walk = actions.walk ?? actions.run;
    const run = actions.run ?? actions.walk;

    // On the ground: standing, walking and running, mixed by pace.
    const target = groundMix(pose.pace);
    this.mix.idle = approach(this.mix.idle, target.idle, 12, dt);
    this.mix.walk = approach(this.mix.walk, target.walk, 12, dt);
    this.mix.run = approach(this.mix.run, target.run, 12, dt);
    const total = this.mix.idle + this.mix.walk + this.mix.run || 1;

    // In the air: the airborne part of the jump, held and moved along by
    // upward speed. A falling clip, when there is one, takes over on the way down.
    const hasAirPose = Boolean(actions.jump ?? actions.fall);
    this.air = approach(this.air, pose.grounded || !hasAirPose ? 0 : 1, pose.grounded ? 16 : 22, dt);
    const phase = airPhase(pose.rise, MOVE.jumpSpeed);
    const falling = actions.fall ? Math.min(1, Math.max(0, (phase - 0.5) * 2.2)) : 0;
    if (actions.jump) {
      const clip = actions.jump.getClip();
      actions.jump.time = clip.duration * (spec.airborne[0] + (spec.airborne[1] - spec.airborne[0]) * phase);
      actions.jump.setEffectiveWeight(this.air * (1 - falling));
    }
    actions.fall?.setEffectiveWeight(this.air * (actions.jump ? falling : 1));

    // A landing clip plays once over the top, fading as it finishes.
    const land = actions.land;
    if (land && this.landing > 0) {
      const left = 1 - land.time / Math.max(land.getClip().duration, 0.001);
      this.landing = pose.grounded ? Math.min(this.landing, Math.max(0, left * 1.6)) : 0;
      // Running straight on cuts the landing short.
      this.landing *= 1 - 0.75 * target.run;
      land.setEffectiveWeight(this.landing);
    } else land?.setEffectiveWeight(0);

    const ground = (1 - this.air) * (1 - this.landing);
    const speed = pose.pace * MOVE.walkSpeed;
    const rate = strideRate(speed, target, spec.walkSpeed, spec.runSpeed);
    if (actions.idle) actions.idle.setEffectiveWeight((ground * this.mix.idle) / total);
    if (walk && run && walk !== run) {
      walk.setEffectiveWeight((ground * (this.mix.walk + (actions.idle ? 0 : this.mix.idle))) / total);
      run.setEffectiveWeight((ground * this.mix.run) / total);
      // Keep the two strides in step, so a mix of them does not shuffle.
      const walkLength = walk.getClip().duration;
      const runLength = run.getClip().duration;
      const share = this.mix.run / Math.max(this.mix.walk + this.mix.run, 0.001);
      const stride = walkLength + (runLength - walkLength) * share;
      walk.setEffectiveTimeScale((walkLength / stride) * rate);
      run.setEffectiveTimeScale((runLength / stride) * rate);
    } else if (walk) {
      // Only one moving clip: play it slower or faster to match the ground.
      walk.setEffectiveWeight((ground * (this.mix.walk + this.mix.run + (actions.idle ? 0 : this.mix.idle))) / total);
      const natural = actions.walk ? spec.walkSpeed : spec.runSpeed;
      walk.setEffectiveTimeScale(speed > 0.05 ? Math.min(2.6, Math.max(0.4, speed / natural)) : actions.idle ? 1 : 0);
    }
    this.mixer.update(dt);

    this.clock += dt;
    this.squashed *= Math.exp(-dt * 10);
    // A held standing pose would look frozen, so the body breathes a little.
    const swell = this.stillIdle ? breath(this.clock) * ((ground * this.mix.idle) / total) : 0;
    const squash = this.squashed - swell;
    this.body.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
  }

  info(): HeroInfo {
    return { model: this.spec.file, clips: this.clipNames, clock: this.mixer.time };
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    for (const material of this.ownMaterials) material.dispose();
  }
}
