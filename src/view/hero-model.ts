// Heroes drawn from a model file: a rigged, textured glTF model whose animation
// clips are mixed from how the hero is moving.
//
// TO GIVE A CHARACTER ITS MODEL:
//   1. If Meshy rigged and animated it, it comes as one file per clip. Put
//      every clip on one model, take the travel out of the clips and clean up
//      the skin with tools/prepare-rigged.py. If Meshy could not rig it, rig
//      and animate it with tools/rig-quadruped.py. (See the top of each.)
//   2. Compress the result with tools/compress-hero.mjs, which saves it in
//      assets/heroes/ (for example assets/heroes/yaarbro.glb) and lists its
//      clips. The build copies it into media/models/.
//   3. Add it to HERO_MODELS below: the file name, how tall it stands, and the
//      names of its clips. A missing clip is fine: the player uses what is
//      there (see `clips` below).

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
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MOVE, type HeroName } from '../game/hero';
import { airPhase, approach, groundMix, landingWeight, movingShare, nextGait, strideBeat, strideRate, type Gait, type GaitBands } from './hero-motion';
import type { HeroInfo, HeroView, Pose } from './heroes';

export type ClipRole = 'idle' | 'walk' | 'trot' | 'run' | 'jump' | 'fall' | 'land' | 'roll';

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
   *   no trot    walk and run are mixed by pace, with nothing between
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
   * A clip already cut to its airborne part uses all of it: 0 to 1.
   */
  airborne: [number, number];
  /**
   * For a jump clip that opens with a crouch and a push off the ground: the
   * share of the clip that takes (the airborne part starts where it ends),
   * and how many seconds to play it over when a jump starts. The rules lift
   * the hero the moment Jump is pressed, so this is a flash of a crouch, not
   * a wind-up.
   */
  pushOff?: { share: number; seconds: number };
  /** Ground speeds, in metres a second, at which the walk and run clips look right. */
  walkSpeed: number;
  runSpeed: number;
  /**
   * For a hero with a trot between its walk and its run: the speed the trot
   * clip looks right at, and the paces (0 to 1 of top speed) at which it
   * changes gait. The three clips must share one clock: a paw is at the same
   * point of its step at the same share of each clip, as near as the gaits allow.
   */
  trotSpeed?: number;
  gaits?: GaitBands;
  /** Size of the soft spot on the ground: across and along the body. */
  shadow: { across: number; along: number };
  /** Where a portrait camera should look, and from how far. */
  portrait: { height: number; distance: number };
}

/** Each hero's model. */
export const HERO_MODELS: Record<HeroName, HeroModelSpec> = {
  // Made by the owner in Meshy, and rigged and animated there. Meshy gives one
  // file per clip; tools/prepare-rigged.py puts them on one model, takes the
  // travel out of them and cleans up the skin (see tools/yaarbro.guide.json).
  // He has no falling clip of his own: the one Meshy made is a head-first
  // dive, so the airborne part of his jump is held on the way down too.
  Yaarbro: {
    file: 'yaarbro.glb',
    height: 2.2,
    turn: 0,
    clips: {
      idle: ['idle'],
      walk: ['walk'],
      run: ['run'],
      jump: ['jump'],
      fall: ['falling'],
      land: ['landing'],
      roll: ['roll'],
    },
    // The jump clip is already cut to the part where he is in the air.
    airborne: [0, 1],
    walkSpeed: 1.5,
    runSpeed: 4.6,
    shadow: { across: 1.1, along: 0.95 },
    portrait: { height: 1.52, distance: 2.5 },
  },
  // Made by the owner in Meshy. Meshy could not give him a four-legged
  // skeleton, so tools/rig-quadruped.py rigs him and writes his clips: idle,
  // walk, trot, run, jump, falling and landing. The script prints the speed
  // each of the walk, the trot and the run covers ground at, which is where
  // the three speeds below come from (times his height here over his height
  // in the file). He walks up to about a third of top speed, trots to two
  // thirds, and gallops above that.
  Caputo: {
    file: 'caputo.glb',
    height: 1.55,
    turn: 0,
    clips: {
      idle: ['idle'],
      walk: ['walk'],
      trot: ['trot'],
      run: ['run'],
      jump: ['jump'],
      fall: ['falling'],
      land: ['landing'],
      roll: ['pounce'],
    },
    // His jump opens with a crouch and a push from the hind legs.
    airborne: [0.2, 1],
    pushOff: { share: 0.2, seconds: 0.1 },
    walkSpeed: 1.36,
    trotSpeed: 3.06,
    runSpeed: 5.61,
    gaits: { trot: { down: 0.3, up: 0.34 }, run: { down: 0.63, up: 0.68 } },
    shadow: { across: 1.1, along: 1.8 },
    portrait: { height: 0.95, distance: 2.45 },
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

/**
 * How fast a hero with three gaits fades from one to the next, as a rate a
 * second: most of the way in a twentieth of a second, all of it in about a
 * tenth. The paws slide a little while two gaits are mixed, so it is kept
 * short (tools/preview/measure.mjs measures the slide).
 */
const GAIT_CHANGE = 24;

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
  private mix = { idle: 1, walk: 0, trot: 0, run: 0 };
  /** For a hero with three gaits: the gait it is in, and how much of each is showing (they add up to 1). */
  private gait: Gait = 'walk';
  private gaitShare = { walk: 1, trot: 0, run: 0 };
  /** How fast the hero was dropping when last in the air, for how hard it lands. */
  private dropping = 0;
  /** Seconds left of the push off the ground at the start of a jump. */
  private pushing = 0;

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
    for (const role of ['idle', 'walk', 'trot', 'run', 'jump', 'fall', 'land', 'roll'] as const) {
      const clip = findClip(source.animations, spec.clips[role]);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(0);
      this.actions[role] = action;
    }
    // Everything that loops plays all the time; the mixing is done by weight.
    for (const role of ['idle', 'walk', 'trot', 'run', 'fall'] as const) this.actions[role]?.setLoop(LoopRepeat, Infinity).play();
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
        // A hop lands lightly and a long drop lands hard.
        this.landing = landingWeight(this.dropping, MOVE.jumpSpeed);
      } else this.squashed = 0.18;
    } else {
      this.squashed = event === 'bounce' ? -0.2 : -0.12;
      this.pushing = this.spec.pushOff?.seconds ?? 0;
    }
  }

  animate(pose: Pose, dt: number): void {
    const { actions, spec } = this;
    const walk = actions.walk ?? actions.run;
    const run = actions.run ?? actions.walk;

    // On the ground: standing, walking and running, mixed by pace.
    const trot = spec.gaits && spec.trotSpeed ? actions.trot : undefined;
    const target = groundMix(pose.pace);
    if (trot && spec.gaits) {
      // A hero with a trot is in one gait at a time, chosen by pace, and
      // fades quickly from one to the next when it changes.
      this.gait = nextGait(this.gait, pose.pace, spec.gaits);
      for (const gait of ['walk', 'trot', 'run'] as const) {
        this.gaitShare[gait] = approach(this.gaitShare[gait], gait === this.gait ? 1 : 0, GAIT_CHANGE, dt);
      }
      this.mix.idle = approach(this.mix.idle, 1 - movingShare(pose.pace), 12, dt);
      this.mix.walk = (1 - this.mix.idle) * this.gaitShare.walk;
      this.mix.trot = (1 - this.mix.idle) * this.gaitShare.trot;
      this.mix.run = (1 - this.mix.idle) * this.gaitShare.run;
      target.run = this.gait === 'run' ? 1 - target.idle : 0;
    } else {
      this.mix.idle = approach(this.mix.idle, target.idle, 12, dt);
      this.mix.walk = approach(this.mix.walk, target.walk, 12, dt);
      this.mix.run = approach(this.mix.run, target.run, 12, dt);
    }
    const total = this.mix.idle + this.mix.walk + this.mix.trot + this.mix.run || 1;

    // In the air: the airborne part of the jump, held and moved along by
    // upward speed. A falling clip, when there is one, takes over on the way down.
    if (!pose.grounded) this.dropping = Math.max(0, -pose.rise);
    const hasAirPose = Boolean(actions.jump ?? actions.fall);
    // A push off the ground has to show at once, or it is over before it is seen.
    this.air = approach(this.air, pose.grounded || !hasAirPose ? 0 : 1, pose.grounded ? 16 : this.pushing > 0 ? 70 : 22, dt);
    const phase = airPhase(pose.rise, MOVE.jumpSpeed);
    const falling = actions.fall ? Math.min(1, Math.max(0, (phase - 0.5) * 2.2)) : 0;
    if (actions.jump) {
      const clip = actions.jump.getClip();
      let share = spec.airborne[0] + (spec.airborne[1] - spec.airborne[0]) * phase;
      if (spec.pushOff && this.pushing > 0) {
        // The crouch and push play through once, then upward speed takes over.
        share = Math.min(share, spec.pushOff.share * (1 - this.pushing / spec.pushOff.seconds));
        this.pushing = Math.max(0, this.pushing - dt);
      }
      actions.jump.time = clip.duration * share;
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
    if (walk && trot && run && spec.trotSpeed) {
      // Three gaits on one clock: every clip is played at the speed that gets
      // it through one cycle in the same time, so each is always at the same
      // share of its cycle and a change of gait carries on in mid stride.
      walk.setEffectiveWeight((ground * (this.mix.walk + (actions.idle ? 0 : this.mix.idle))) / total);
      trot.setEffectiveWeight((ground * this.mix.trot) / total);
      run.setEffectiveWeight((ground * this.mix.run) / total);
      const gaits = [
        { clip: walk, share: this.mix.walk, pace: spec.walkSpeed },
        { clip: trot, share: this.mix.trot, pace: spec.trotSpeed },
        { clip: run, share: this.mix.run, pace: spec.runSpeed },
      ].map(({ clip, share, pace }) => ({ clip, share, seconds: clip.getClip().duration, ground: pace * clip.getClip().duration }));
      const beat = strideBeat(speed, gaits);
      for (const gait of gaits) gait.clip.setEffectiveTimeScale(gait.seconds * beat);
    } else if (walk && run && walk !== run) {
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
