// Heroes drawn from a model file: a rigged, textured glTF model whose animation
// clips are mixed from how the hero is moving.
//
// TO GIVE A HERO ITS MODEL:
//   1. Put the file in assets/models/ (for example assets/models/yaarbro.glb).
//      The build compresses it into media/models/.
//   2. Add the hero to HERO_MODELS below: the file name, how tall the hero
//      stands, and the names of its clips. A missing clip is fine: the player
//      uses what is there (see `clips` below).
// Until then the hero is built from shapes (heroes.ts).

import {
  AnimationMixer,
  Box3,
  Group,
  LoopOnce,
  LoopRepeat,
  MeshLambertMaterial,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Mesh,
  type MeshStandardMaterial,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MOVE, type HeroName } from '../game/hero';
import { airPhase, approach, groundMix, strideRate } from './hero-motion';
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
   *   no idle    the hero holds the first frame of its walk
   *   no jump    the hero keeps its ground pose in the air, with a stretch
   *   no fall    the late part of the jump is held on the way down
   *   no land    a quick squash instead
   */
  clips: Partial<Record<ClipRole, string[]>>;
  /**
   * Library jump clips start with a crouch and end with a landing. These are
   * the shares of the clip (0 to 1) where the airborne part starts and ends.
   * In the air that part is held as a pose, moved along by upward speed.
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

/** The heroes that have a model. Empty until the models arrive; see the top of this file. */
export const HERO_MODELS: Partial<Record<HeroName, HeroModelSpec>> = {};

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
    model.updateMatrixWorld(true);
    const size = new Box3().setFromObject(model);
    const tall = Math.max(size.max.y - size.min.y, 0.001);
    const scale = spec.height / tall;
    const middle = size.getCenter(new Vector3());
    model.position.set(-middle.x * scale, -size.min.y * scale, -middle.z * scale);
    model.scale.multiplyScalar(scale);
    model.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
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
    this.body.rotation.y = spec.turn;
    this.root.add(this.body);

    this.mixer = new AnimationMixer(model);
    for (const role of ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'roll'] as const) {
      const clip = findClip(source.animations, spec.clips[role]);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
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

    this.squashed *= Math.exp(-dt * 10);
    this.body.scale.set(1 + this.squashed * 0.5, 1 - this.squashed, 1 + this.squashed * 0.5);
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
