// The heroes' second move, drawn (the rules are src/game/sidekick.ts).
// Looks only: everything here is placed from what the rules say.
//
//   Yaarbro   Walblum the muskrat, from his own model (assets/heroes/
//             walblum.glb, rigged by tools/rig-walblum.py): out of sight
//             under Yaarbro's arm until he is sent, a flying karate kick on
//             the way out, and heels over head on the way back.
//   Caputo    Three glowing claw marks, drawn in code: they fly out side by
//             side from his swipe, and fade on the way back.
//
// A hit shows as a burst where it landed: a star for the kick, three long
// slashes for the claws. A hit that bounces off a guard shows smaller and grey.

import {
  AdditiveBlending,
  AnimationMixer,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  type AnimationAction,
  type Material,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { HeroName } from '../game/hero';
import type { AllyEvent, Sidekick } from '../game/sidekick';

/** Walblum's model file, in media/models/. It is fetched the first time a game has the move. */
export const WALBLUM_FILE = 'walblum.glb';

export const SIDEKICK_LOOK = {
  /** How tall Walblum is in the game, and how tall he stands in his file. A muskrat, but big enough to read from the game's camera. */
  walblumHeight: 0.85,
  walblumFileHeight: 1.9,
  /** The claw marks: how long each is, how far apart they fly, and their colour. */
  clawLength: 1.15,
  clawGap: 0.26,
  clawColor: 0xffc247,
  /** Seconds a burst lasts, and how big it grows, in metres. */
  burst: 0.3,
  burstSize: 1.5,
} as const;

/** A curved blade of light, lying in the x-y plane with its middle at the origin: thick in the middle, a point at each end. */
const bladeShape = (length: number, width: number, bow: number): BufferGeometry => {
  const steps = 10;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const along = (t - 0.5) * length;
    const curve = bow * (1 - (2 * t - 1) ** 2);
    const half = (width / 2) * Math.sin(Math.PI * t) ** 0.8;
    positions.push(curve - half, along, 0, curve + half, along, 0);
    if (i < steps) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const shape = new BufferGeometry();
  shape.setAttribute('position', new Float32BufferAttribute(positions, 3));
  shape.setIndex(indices);
  return shape;
};

const glow = (color: number): MeshBasicMaterial =>
  new MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false });

export class SidekickView {
  readonly group = new Group();
  private readonly flier = new Group();
  private readonly burst = new Group();
  private readonly materials: Material[] = [];
  private readonly shapes: BufferGeometry[] = [];
  private readonly flierGlow: MeshBasicMaterial[] = [];
  private readonly burstGlow: MeshBasicMaterial;
  private mixer: AnimationMixer | null = null;
  private kick: AnimationAction | null = null;
  private tumble: AnimationAction | null = null;
  private walblum: Object3D | null = null;
  /** Seconds since the last burst began, and whether it was a hit that counted. */
  private sinceBurst = Infinity;
  private clock = 0;

  /**
   * `hero` says which flier this is. `model` gives Walblum's file once it has
   * been fetched (it is asked for each frame until it is there). `simple`
   * is the lowest tier's plain shading.
   */
  constructor(
    readonly hero: HeroName,
    private readonly model: () => GLTF | undefined,
    private readonly simple: boolean,
  ) {
    this.group.add(this.flier, this.burst);
    this.flier.visible = false;
    this.burst.visible = false;
    const look = SIDEKICK_LOOK;
    if (hero === 'Caputo') {
      // Three claw marks side by side, each a bowed blade standing upright across the way it flies.
      const blade = bladeShape(look.clawLength, 0.2, 0.22);
      this.shapes.push(blade);
      for (let i = -1; i <= 1; i += 1) {
        const material = glow(look.clawColor);
        this.materials.push(material);
        this.flierGlow.push(material);
        // Each mark is two blades crossed, so it shows from behind and from the side alike.
        for (const turn of [0, Math.PI / 2]) {
          const mark = new Mesh(blade, material);
          mark.position.set(i * look.clawGap, 0, -Math.abs(i) * 0.12 + i * 0.3 * Math.sin(turn));
          mark.rotation.set(0, turn, -0.35);
          mark.frustumCulled = false;
          this.flier.add(mark);
        }
      }
    }
    // The burst: for the claws three long slashes, for the kick a star of eight rays.
    this.burstGlow = glow(hero === 'Caputo' ? look.clawColor : 0xfff1c9);
    this.materials.push(this.burstGlow);
    if (hero === 'Caputo') {
      const slash = bladeShape(1, 0.14, 0.12);
      this.shapes.push(slash);
      for (let i = -1; i <= 1; i += 1) {
        const mark = new Mesh(slash, this.burstGlow);
        mark.position.set(i * 0.28, 0, 0);
        mark.rotation.z = -0.5;
        mark.frustumCulled = false;
        this.burst.add(mark);
      }
    } else {
      const ray = bladeShape(1, 0.1, 0);
      this.shapes.push(ray);
      for (let i = 0; i < 4; i += 1) {
        const mark = new Mesh(ray, this.burstGlow);
        mark.rotation.z = (i * Math.PI) / 4;
        mark.scale.setScalar(i % 2 === 0 ? 1 : 0.6);
        mark.frustumCulled = false;
        this.burst.add(mark);
      }
    }
  }

  /** Builds Walblum from his file, once it is here. */
  private summon(): void {
    if (this.hero !== 'Yaarbro' || this.walblum) return;
    const loaded = this.model();
    if (!loaded) return;
    const look = SIDEKICK_LOOK;
    const model = cloneRigged(loaded.scene);
    model.scale.setScalar(look.walblumHeight / look.walblumFileHeight);
    // His clips turn about his middle; the flier's place is his middle.
    model.position.y = -look.walblumHeight * 0.45;
    model.traverse((part) => {
      const mesh = part as Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      // He is small and gone in half a second: no shadow, so he costs one draw.
      mesh.castShadow = false;
      if (this.simple) {
        const full = mesh.material as MeshLambertMaterial;
        const plain = new MeshLambertMaterial({ map: full.map ?? null });
        this.materials.push(plain);
        mesh.material = plain;
      }
    });
    this.mixer = new AnimationMixer(model);
    const clip = (name: string): AnimationAction | null => {
      const found = loaded.animations.find((each) => each.name === name);
      return found ? this.mixer!.clipAction(found).setLoop(LoopRepeat, Infinity).play() : null;
    };
    this.kick = clip('kick');
    this.tumble = clip('tumble');
    this.walblum = model;
    this.flier.add(model);
    // A pale streak behind him, so the eye follows him out and back.
    const streak = bladeShape(1.5, 0.22, 0);
    this.shapes.push(streak);
    const pale = glow(0xfff1c9);
    pale.opacity = 0.5;
    this.materials.push(pale);
    for (const turn of [0, Math.PI / 2]) {
      const blade = new Mesh(streak, pale);
      blade.rotation.set(Math.PI / 2, turn, 0);
      blade.position.z = -1;
      blade.frustumCulled = false;
      this.flier.add(blade);
    }
  }

  /** Something happened in the rules: a hit or a block shows as a burst. */
  event(event: AllyEvent): void {
    if (event.what !== 'hit' && event.what !== 'blocked') return;
    this.sinceBurst = 0;
    this.burst.position.set(event.x, event.y, event.z);
    this.burstGlow.color.set(event.what === 'blocked' ? 0xb8c4c9 : this.hero === 'Caputo' ? SIDEKICK_LOOK.clawColor : 0xfff1c9);
    this.burst.userData.size = event.what === 'blocked' ? 0.6 : 1;
  }

  /** Places everything for this frame. `facing` is which way the camera looks, in radians about y, so bursts face it. */
  update(sidekick: Sidekick, cameraTurn: number, dt: number): void {
    this.summon();
    this.clock += dt;
    const look = SIDEKICK_LOOK;
    const flying = sidekick.phase === 'out' || sidekick.phase === 'back';
    this.flier.visible = flying && (this.hero === 'Caputo' ? true : this.walblum !== null);
    if (flying) {
      this.flier.position.set(sidekick.x, sidekick.y, sidekick.z);
      this.flier.rotation.y = sidekick.heading;
      if (this.hero === 'Caputo') {
        // Bright on the way out, growing a little; gone soon after they turn for home.
        const out = sidekick.phase === 'out';
        const fade = out ? Math.min(1, sidekick.timer / 0.05) : Math.max(0, 1 - sidekick.timer / 0.12);
        const size = out ? 0.75 + Math.min(0.45, sidekick.timer * 1.6) : 1.2;
        this.flier.scale.setScalar(size);
        this.flier.rotation.z = Math.sin(this.clock * 30) * 0.05;
        for (const material of this.flierGlow) material.opacity = fade;
      } else if (this.kick && this.tumble) {
        const out = sidekick.phase === 'out';
        this.kick.setEffectiveWeight(out ? 1 : 0);
        this.tumble.setEffectiveWeight(out ? 0 : 1);
      }
    }
    this.mixer?.update(dt);

    this.sinceBurst += dt;
    const share = this.sinceBurst / look.burst;
    this.burst.visible = share < 1;
    if (share < 1) {
      const size = (this.burst.userData.size as number | undefined) ?? 1;
      this.burst.scale.setScalar(look.burstSize * size * (0.35 + 0.65 * Math.sqrt(share)));
      this.burst.rotation.y = cameraTurn;
      this.burstGlow.opacity = 1 - share * share;
    }
  }

  /** What the browser checks can ask: whether the flier and a burst are drawn, and whether Walblum's model is here. */
  info(): { flier: boolean; burst: boolean; walblum: boolean } {
    return { flier: this.flier.visible, burst: this.burst.visible, walblum: this.walblum !== null };
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    for (const material of this.materials) material.dispose();
    for (const shape of this.shapes) shape.dispose();
  }
}
