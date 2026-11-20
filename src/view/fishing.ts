// Fishing drawn (the rules are src/game/fishing.ts). Looks only: the marked
// boards of the spot and the rod that waits there, the gold ring that slides
// over the water while a cast is aimed, the lure in the air, the bobber, the
// line, the rod in the hero's grip, and the fish themselves, each from its
// own model (assets/fish/, rigged by tools/rig-fish.py): swimming under the
// surface, coming to the lure, thrashing on the line, and held up when landed.
//
// A hero with fishing clips (Yaarbro) holds the rod at the grip point in his
// right palm, with a reel under it, and a landed fish lies across both his
// upturned palms: where each goes is worked out by held-tackle.ts from his
// hand bones. A hero without them has the rod drawn in front of it.
//
// The dock is the heaviest place on the lake, so the fish cast no shadow and
// nothing here is moved or drawn while the hero is far from the spot.

import {
  AnimationMixer,
  Box3,
  CatmullRomCurve3,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Matrix4,
  Object3D,
  RingGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type AnimationAction,
  type Material,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneRigged } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { FISHING, SPECIES, fishingPoint, type Fish, type FishingEvent, type FishingSpot, type FishingState, type Species } from '../game/fishing';
import type { HeroName } from '../game/hero';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDED, ROD, ease, fishFlying, heldSize, lieAcross, readHands, reelOn, rodFalling, rodLine, type RodPose } from './held-tackle';
import type { HeroView } from './heroes';
import type { WaterView } from './water';

/** The file each fish is drawn from. */
export const FISH_MODELS: Record<Species, string> = { perch: 'perch.glb', bass: 'bass.glb', trout: 'trout.glb', pike: 'pike.glb' };
export const fishModelFiles = (): string[] => SPECIES.map((species) => FISH_MODELS[species]);

/** How many times its real length a fish is drawn: seen from the camera, a real perch would be a speck. */
const SHOWN = 3;
/** Fishing is neither moved nor drawn when the hero is further than this from the spot. */
const NEAR = 32;
/** Where a hero holds the rod, and where its tip is, from the hero's feet: metres ahead and up. */
const GRIP: Record<HeroName, { ahead: number; up: number; tipAhead: number; tipUp: number }> = {
  Yaarbro: { ahead: 0.35, up: 1.05, tipAhead: 1.9, tipUp: 2.5 },
  // Caputo holds it in his jaws.
  Caputo: { ahead: 0.75, up: 0.95, tipAhead: 2.3, tipUp: 2.2 },
};
const LINE_POINTS = 14;
/** Metres in the game for a metre on Yaarbro's model as it comes: what the reel is sized by. */
const GAME_REEL = 2.2 / 2.87;
/** One round shape, stretched into each fish's shadow on the water. */
const SHADE_SHAPE = new CircleGeometry(0.5, 20);
type Clip = 'idle' | 'swim' | 'thrash' | 'flop';
/** Each kind of fish's skin as it lies at rest, about its middle, three points a triangle: found once, for laying a landed one across a hero's palms. */
const SKINS = new Map<Species, Vector3[]>();

/** One fish in the water, drawn from its kind's model. */
class FishView {
  readonly root = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions: Partial<Record<Clip, AnimationAction>> = {};
  private showing: Clip = 'idle';
  /** The model's own length, for drawing a fish at its size. */
  private readonly length: number;
  readonly materials: Material[] = [];
  /** The id of the fish this is drawing now, or null. */
  fishId: number | null = null;
  /**
   * The dark shape a fish makes seen from above: a soft ellipse lying on the
   * water over it. From the camera's height the fish itself is lost in the
   * water's colour; this is what a player casts at.
   */
  shade: { x: number; z: number; facing: number } | null = null;
  /** How long the fish is drawn, in metres. */
  drawn = 1;

  constructor(readonly species: Species, source: GLTF, simple: boolean) {
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
        this.materials.push(own);
      }
    });
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const middle = box.getCenter(new Vector3());
    this.length = Math.max(size.z, 0.001);
    model.position.set(-middle.x, -middle.y, -middle.z);
    this.root.add(model);
    if (!SKINS.has(species)) {
      const skin: Vector3[] = [];
      this.root.updateMatrixWorld(true);
      model.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        const index = mesh.geometry.getIndex();
        const count = index ? index.count : mesh.geometry.getAttribute('position').count;
        for (let i = 0; i < count; i += 1) skin.push(mesh.getVertexPosition(index ? index.getX(i) : i, new Vector3()).applyMatrix4(mesh.matrixWorld));
      });
      SKINS.set(species, skin);
    }
    this.mixer = new AnimationMixer(model);
    for (const name of ['idle', 'swim', 'thrash', 'flop'] as Clip[]) {
      const clip = source.animations.find((each) => each.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.setLoop(LoopRepeat, Infinity);
      action.setEffectiveWeight(name === 'idle' ? 1 : 0);
      action.play();
      this.actions[name] = action;
    }
    this.root.visible = false;
  }

  /** Its skin at rest and its own length, for laying it across a hero's palms. */
  get shape(): { skin: Vector3[]; long: number } {
    return { skin: SKINS.get(this.species) ?? [], long: this.length };
  }

  /** Still, or thrashing by a share: a landed fish on its way to a hero's palms, and lying on them. */
  held(thrashing: number, dt: number): void {
    this.showing = thrashing > 0.5 ? 'thrash' : 'idle';
    for (const name of Object.keys(this.actions) as Clip[]) this.actions[name]!.setEffectiveWeight(name === 'thrash' ? thrashing : 0);
    this.mixer.update(dt);
  }

  /** Draws the fish `size` centimetres long. */
  sized(size: number): void {
    this.drawn = (size / 100) * SHOWN;
    this.root.scale.setScalar(this.drawn / this.length);
  }

  /** Lays the dark shape on the water at (x, z), along the way the fish faces, or hides it. */
  shadeAt(x: number, _surface: number, z: number, facing: number, shown: boolean): void {
    this.shade = shown ? { x, z, facing } : null;
  }

  play(clip: Clip, dt: number): void {
    this.showing = clip;
    for (const name of Object.keys(this.actions) as Clip[]) {
      const action = this.actions[name]!;
      const weight = action.getEffectiveWeight();
      action.setEffectiveWeight(weight + ((name === clip ? 1 : 0) - weight) * (1 - Math.exp(-12 * dt)));
    }
    this.mixer.update(dt);
  }

  get clip(): Clip {
    return this.showing;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    for (const material of this.materials) material.dispose();
  }
}

export class FishingView {
  readonly group = new Group();
  private readonly fish: FishView[] = [];
  private readonly ring: Mesh;
  private readonly mark: Mesh;
  private readonly bobber: Group;
  private readonly rod: Mesh;
  /** The rod in a hero's palm: bent by a fish, with its reel under it. */
  private readonly heldRod: Mesh;
  private readonly reel: Mesh;
  /** How far round the reel has turned, in turns. */
  private spun = 0;
  /** The rod as he last held it, for it to fall from when he lets go to show off a fish. */
  private letGo: RodPose | null = null;
  /** Whether a landed fish lies on the hero's palms. */
  private onPalms = false;
  private readonly line: Line;
  private readonly linePoints = new Float32Array(LINE_POINTS * 3);
  private readonly looks: Material[] = [];
  /** Every fish's dark shape on the water, in one draw. */
  private readonly shades: InstancedMesh;
  private readonly scratch = new Object3D();
  private clock = 0;
  /** Seconds the bobber has left to twitch (a nibble) and how far under it is (a bite). */
  private twitch = 0;
  private sunk = 0;

  constructor(private readonly spot: FishingSpot, models: Map<Species, GLTF>, simple: boolean, private readonly water: WaterView | null, deckTop: number) {
    // As many fish of each kind as the water ever holds at once.
    for (const species of SPECIES) {
      const source = models.get(species);
      if (!source) continue;
      for (let i = 0; i < spot.numbers.species[species].count; i += 1) {
        const view = new FishView(species, source, simple);
        this.fish.push(view);
        this.group.add(view.root);
      }
    }
    const look = <T extends Material>(material: T): T => {
      this.looks.push(material);
      return material;
    };
    this.shades = new InstancedMesh(SHADE_SHAPE, look(new MeshBasicMaterial({ color: 0x0b3238, transparent: true, opacity: 0.42, depthWrite: false, fog: false })), Math.max(1, this.fish.length));
    this.shades.frustumCulled = false;
    this.shades.renderOrder = 3;
    this.scratch.rotation.order = 'YXZ';
    this.group.add(this.shades);
    // The spot: a gold ring painted on the boards.
    this.mark = new Mesh(new RingGeometry(spot.radius * 0.62, spot.radius * 0.8, 40), look(new MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.75, side: DoubleSide, depthWrite: false })));
    this.mark.rotation.x = -Math.PI / 2;
    this.mark.position.set(spot.x, deckTop + 0.03, spot.z);
    this.mark.renderOrder = 2;
    // The ring a cast is aimed with, flat on the water.
    this.ring = new Mesh(new RingGeometry(0.75, 1, 40), look(new MeshBasicMaterial({ color: 0xffd766, transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: false, fog: false })));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 4;
    this.ring.visible = false;
    // The bobber: white below, red on top.
    this.bobber = new Group();
    const white = new Mesh(new SphereGeometry(0.2, 14, 10), look(simple ? new MeshLambertMaterial({ color: 0xfffbee }) : new MeshStandardMaterial({ color: 0xfffbee, roughness: 0.5 })));
    const red = new Mesh(new SphereGeometry(0.205, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), look(simple ? new MeshLambertMaterial({ color: 0xd6452b }) : new MeshStandardMaterial({ color: 0xd6452b, roughness: 0.5 })));
    this.bobber.add(white, red);
    // Big enough to pick out from the camera's height.
    this.bobber.scale.setScalar(1.7);
    this.bobber.visible = false;
    // The rod: a thin pole, thinner at the tip. It lies along +y until it is aimed.
    this.rod = new Mesh(new CylinderGeometry(0.018, 0.045, 1, 6), look(simple ? new MeshLambertMaterial({ color: 0x6b4a2b }) : new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 })));
    this.rod.castShadow = !simple;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.linePoints, 3));
    this.line = new Line(geometry, look(new LineBasicMaterial({ color: 0xfffbee, transparent: true, opacity: 0.9 })));
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.heldRod = new Mesh(new BufferGeometry(), this.rod.material);
    this.heldRod.castShadow = !simple;
    this.heldRod.frustumCulled = false;
    this.heldRod.visible = false;
    // The reel: a drum whose axle is its own y, with a knob on each face to show it turning. One shape, one draw.
    const unit = GAME_REEL;
    const drum = new CylinderGeometry(ROD.reelRadius * unit, ROD.reelRadius * unit, ROD.reelWide * unit, 16);
    const knob = new SphereGeometry(0.028 * unit, 8, 6);
    const near = knob.clone().translate(ROD.knobOut * unit, (ROD.reelWide / 2 + 0.02) * unit, 0);
    const far = knob.clone().translate(-ROD.knobOut * unit, -(ROD.reelWide / 2 + 0.02) * unit, 0);
    this.reel = new Mesh(mergeGeometries([drum, near, far]), look(simple ? new MeshLambertMaterial({ color: 0xd9a441 }) : new MeshStandardMaterial({ color: 0xd9a441, roughness: 0.45, metalness: 0.2 })));
    for (const part of [drum, knob, near, far]) part.dispose();
    this.reel.frustumCulled = false;
    this.reel.visible = false;
    this.group.add(this.mark, this.ring, this.bobber, this.rod, this.heldRod, this.reel, this.line);
  }

  /** What the rules reported this step: splashes and the bobber's twitch. */
  event(event: FishingEvent, state: FishingState): void {
    const at = fishingPoint(this.spot, state.out, state.across);
    if (event.what === 'plop') this.water?.splash(at.x, at.z, 0.25);
    else if (event.what === 'nibble') {
      this.twitch = 0.3;
      this.water?.ring(at.x, at.z, 0.7, 0.7);
    } else if (event.what === 'bite') this.water?.splash(at.x, at.z, 0.5);
    else if (event.what === 'thrash') this.water?.splash(at.x, at.z, 0.8);
    else if (event.what === 'landed' || event.what === 'snapped') this.water?.splash(at.x, at.z, 0.6);
  }

  private viewFor(fish: Fish): FishView | null {
    return this.fish.find((view) => view.fishId === fish.id) ?? null;
  }

  /** Matches the picture to the rules. `hero` is where the hero's feet are. */
  update(state: FishingState, hero: { x: number; y: number; z: number }, heroName: HeroName, dt: number, holder: HeroView | null = null): void {
    const { spot } = this;
    const near = Math.hypot(hero.x - spot.x, hero.z - spot.z) < NEAR;
    this.group.visible = near;
    if (!near) return;
    this.clock += dt;
    this.twitch = Math.max(0, this.twitch - dt);
    this.sunk += ((state.phase === 'bite' ? 0.32 : 0) - this.sunk) * (1 - Math.exp(-18 * dt));
    const grip = GRIP[heroName];
    const fishing = state.phase !== 'off';
    const strain = state.phase === 'hooked' ? (state.fight === 'thrash' ? 0.5 + 0.5 * state.strain : 0.2) : 0;

    // The rod: in the hero's grip while fishing, else leaning at the end of the jetty.
    const hand = new Vector3(hero.x + spot.ahead.x * grip.ahead, hero.y + grip.up, hero.z + spot.ahead.z * grip.ahead);
    const tip = new Vector3(hero.x + spot.ahead.x * (grip.tipAhead + 0.5 * strain), hero.y + grip.tipUp - 0.9 * strain, hero.z + spot.ahead.z * (grip.tipAhead + 0.5 * strain));
    if (state.phase === 'aim') tip.set(hero.x - spot.ahead.x * 0.6, hero.y + grip.tipUp + 0.3, hero.z - spot.ahead.z * 0.6);
    if (!fishing) {
      hand.set(spot.x + spot.ahead.x * (spot.radius + 0.25) - spot.ahead.z * 0.9, hero.y * 0 + this.mark.position.y, spot.z + spot.ahead.z * (spot.radius + 0.25) + spot.ahead.x * 0.9);
      tip.set(hand.x - spot.ahead.x * 0.5, hand.y + 2.2, hand.z - spot.ahead.z * 0.5);
    }
    // A hero with fishing clips holds the rod in his palm: its tip is wherever his hand has swung it.
    const at = fishingPoint(spot, state.out, state.across);
    const tackle = fishing ? (holder?.tackle() ?? null) : null;
    const landedFish = state.phase === 'show' && state.shown ? (state.fish.find((fish) => fish.mood === 'landed' && fish.species === state.shown?.species && fish.size === state.shown?.size && this.viewFor(fish)) ?? null) : null;
    const landedView = landedFish ? this.viewFor(landedFish) : null;
    let flying: Vector3 | null = null;
    this.onPalms = false;
    this.heldRod.visible = this.reel.visible = tackle !== null;
    this.rod.visible = tackle === null;
    if (tackle && holder) {
      holder.root.updateMatrixWorld(true);
      const unit = tackle.unit;
      const hands = readHands(tackle.grips, tackle.right, tackle.left, unit);
      const share = state.phase === 'show' ? (tackle.show ?? Math.min(1, state.timer / FISHING.show)) : null;
      // The landed fish: up out of the water on the line, over in an arc, and down onto his upturned palms.
      if (share !== null && landedFish && landedView) {
        const { skin, long } = landedView.shape;
        const size = heldSize(landedFish.size, long, unit);
        const lying = lieAcross(skin, long, hands.gripRight, hands.gripLeft, size);
        const flight = (share - LANDED.burst) / (LANDED.caught - LANDED.burst);
        landedView.root.scale.setScalar(size);
        landedView.root.visible = flight >= 0;
        if (flight < 1) {
          const now = fishFlying(new Vector3(at.x, spot.surface, at.z), lying, Math.max(0, flight), unit);
          landedView.root.position.copy(now.position);
          landedView.root.quaternion.copy(now.turn);
          landedView.held(1 - now.settled, dt);
          // The line runs to its mouth.
          flying = now.position.clone().add(new Vector3(0, 0, 1).applyQuaternion(now.turn).multiplyScalar(long * size * 0.5));
        } else {
          landedView.root.position.copy(lying.position);
          landedView.root.quaternion.copy(lying.turn);
          landedView.held(0, dt);
          this.onPalms = true;
        }
      }
      // The rod: in his right palm, or dropping to the boards at his right once he lets go of it to take the fish.
      let pose: RodPose = hands;
      if (share !== null && share >= LANDED.release) {
        const right = { x: -spot.ahead.z, z: spot.ahead.x };
        const lying: RodPose = {
          from: new Vector3(hero.x + right.x * 0.73 + spot.ahead.x * 0.57, hero.y + 0.03, hero.z + right.z * 0.73 + spot.ahead.z * 0.57),
          along: new Vector3(spot.ahead.x, 0, spot.ahead.z),
          side: new Vector3(right.x, 0, right.z),
        };
        pose = rodFalling(this.letGo ?? hands, lying, Math.min(1, (share - LANDED.release) / (LANDED.down - LANDED.release)));
      } else this.letGo = { from: hands.from.clone(), along: hands.along.clone(), side: hands.side.clone() };
      // Bent toward a fish on the line, harder as it thrashes; and toward the landed fish as he heaves it out.
      const held = share === null || share < LANDED.release;
      const toward = state.phase === 'hooked' ? new Vector3(at.x, spot.surface, at.z) : share !== null && held ? (flying ?? new Vector3(at.x, spot.surface, at.z)) : null;
      const pulled = state.phase === 'hooked' ? 0.45 + 0.55 * strain : share !== null && held ? 1 - 0.6 * ease(share / LANDED.release) : 0;
      const points = rodLine(pose.from, pose.along, toward, pulled, unit);
      this.heldRod.geometry.dispose();
      this.heldRod.geometry = new TubeGeometry(new CatmullRomCurve3(points), 24, ROD.thick * unit * 1.4, 5);
      tip.copy(points[points.length - 1]);
      // The reel hangs under the rod with its face sideways, and turns while the button reels.
      if (state.reeling) this.spun += dt * 2.2;
      const reel = reelOn(pose, unit);
      const angle = this.spun * Math.PI * 2;
      const spoke = pose.along.clone().multiplyScalar(Math.cos(angle)).addScaledVector(pose.side, Math.sin(angle));
      this.reel.position.copy(reel.centre);
      this.reel.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(spoke, reel.axle, new Vector3().crossVectors(spoke, reel.axle)));
    } else {
      this.letGo = null;
      const along = tip.clone().sub(hand);
      this.rod.position.copy(hand).addScaledVector(along, 0.5);
      this.rod.scale.set(1, along.length(), 1);
      this.rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), along.clone().normalize());
    }
    this.mark.visible = !fishing;

    // The ring while aiming.
    this.ring.visible = state.phase === 'aim';
    if (this.ring.visible) {
      this.ring.position.set(at.x, spot.surface + 0.06, at.z);
      this.ring.scale.setScalar(1 + 0.08 * Math.sin(this.clock * 8));
    }

    // The lure: in the air through the cast, then the bobber on the water, then with the fish.
    let lure: Vector3 | null = null;
    if (state.phase === 'cast') {
      const share = Math.min(1, state.timer / FISHING.castTime);
      lure = tip.clone().lerp(new Vector3(at.x, spot.surface, at.z), share);
      lure.y += 3 * 4 * share * (1 - share);
    } else if (state.phase === 'wait' || state.phase === 'bite') {
      lure = new Vector3(at.x, spot.surface + 0.05 - this.sunk + (this.twitch > 0 ? 0.07 * Math.sin(this.twitch * 60) : 0.02 * Math.sin(this.clock * 3)), at.z);
    } else if (state.phase === 'hooked') lure = new Vector3(at.x, spot.surface - 0.1, at.z);
    else if (flying) lure = flying;
    this.bobber.visible = state.phase === 'cast' || state.phase === 'wait' || state.phase === 'bite';
    if (lure && this.bobber.visible) this.bobber.position.copy(lure);
    this.line.visible = lure !== null;
    if (lure) {
      // Slack hangs in a curve; a strained line is straight.
      const sag = state.phase === 'hooked' ? 0.4 * (1 - strain) : flying ? 0.15 : 1.1;
      for (let i = 0; i < LINE_POINTS; i += 1) {
        const t = i / (LINE_POINTS - 1);
        this.linePoints[i * 3] = tip.x + (lure.x - tip.x) * t;
        this.linePoints[i * 3 + 1] = tip.y + (lure.y - tip.y) * t - sag * 4 * t * (1 - t);
        this.linePoints[i * 3 + 2] = tip.z + (lure.z - tip.z) * t;
      }
      this.line.geometry.getAttribute('position').needsUpdate = true;
      const colour = (this.line.material as LineBasicMaterial).color;
      // White while it holds, through gold to red as it strains.
      if (state.phase === 'hooked' && state.fight === 'thrash') colour.setRGB(1, 0.85 - 0.6 * state.strain, 0.75 - 0.6 * state.strain);
      else colour.setRGB(1, 0.98, 0.93);
    }

    // The fish. A view draws the fish it drew last frame, or takes one of its kind that has none.
    for (const view of this.fish) {
      if (view.fishId !== null && !state.fish.some((fish) => fish.id === view.fishId)) {
        view.fishId = null;
        view.root.visible = false;
        view.shadeAt(0, 0, 0, 0, false);
      }
    }
    for (const fish of state.fish) {
      let view = this.viewFor(fish);
      if (!view) {
        view = this.fish.find((each) => each.species === fish.species && each.fishId === null) ?? null;
        if (!view) continue;
        view.fishId = fish.id;
        view.sized(fish.size);
      }
      const shown = state.shown && fish.mood === 'landed' && state.phase === 'show';
      // A landed fish on its way to a hero's palms, or lying on them, was placed above.
      if (shown && view === landedView && tackle) {
        view.shadeAt(0, 0, 0, 0, false);
        continue;
      }
      view.sized(fish.size);
      view.root.visible = fish.mood !== 'landed' || Boolean(shown);
      if (!view.root.visible || shown) view.shadeAt(0, 0, 0, 0, false);
      if (!view.root.visible) continue;
      if (shown) {
        // Held up beside the hero, nose up, turning slowly.
        view.root.position.set(hero.x + spot.ahead.x * 0.9, hero.y + 1.9, hero.z + spot.ahead.z * 0.9);
        view.root.rotation.set(-Math.PI / 2, this.clock * 1.5, 0, 'YXZ');
        view.play('flop', dt);
        continue;
      }
      const where = fishingPoint(spot, fish.out, fish.across);
      const thrashing = fish.mood === 'hooked' && state.fight === 'thrash';
      const depth = fish.mood === 'hooked' ? (thrashing ? 0.05 : 0.25) : fish.mood === 'nibbling' || fish.mood === 'biting' ? 0.3 : FISHING.depth;
      view.root.position.set(where.x, spot.surface - depth, where.z);
      // The models face +z; `heading` is measured from `ahead`, turning to the right.
      const facing = Math.atan2(spot.ahead.x, spot.ahead.z) - fish.heading;
      view.root.rotation.set(0, facing, 0);
      // The shadow fades out as a fish comes to the top to fight.
      view.shadeAt(where.x, spot.surface, where.z, facing, !thrashing);
      view.play(thrashing ? 'thrash' : fish.mood === 'idle' || fish.mood === 'nibbling' || fish.mood === 'biting' ? 'idle' : 'swim', dt);
      if (thrashing && this.water && Math.random() < dt * 5) this.water.ring(where.x, where.z, 1.2, 0.8);
    }
    this.layShades();
  }

  /** Puts every fish's dark shape where its fish is; one with none is drawn at no size. */
  private layShades(): void {
    this.fish.forEach((view, index) => {
      const shade = view.shade;
      this.scratch.position.set(shade?.x ?? 0, this.spot.surface + 0.04, shade?.z ?? 0);
      this.scratch.rotation.set(-Math.PI / 2, shade?.facing ?? 0, 0);
      if (shade) this.scratch.scale.set(view.drawn * 0.32, view.drawn * 1.05, 1);
      else this.scratch.scale.setScalar(0);
      this.scratch.updateMatrix();
      this.shades.setMatrixAt(index, this.scratch.matrix);
    });
    this.shades.instanceMatrix.needsUpdate = true;
  }

  /** What is drawn, for the browser checks. */
  info(): { fish: number; ring: boolean; bobber: boolean; line: boolean; mark: boolean; thrashing: boolean; rodInPalm: boolean; fishOnPalms: boolean } {
    return {
      rodInPalm: this.heldRod.visible,
      fishOnPalms: this.onPalms,
      fish: this.fish.filter((view) => view.root.visible).length,
      ring: this.ring.visible,
      bobber: this.bobber.visible,
      line: this.line.visible,
      mark: this.mark.visible,
      thrashing: this.fish.some((view) => view.root.visible && view.clip === 'thrash'),
    };
  }

  dispose(): void {
    for (const view of this.fish) view.dispose();
    for (const material of this.looks) material.dispose();
    this.ring.geometry.dispose();
    this.mark.geometry.dispose();
    this.rod.geometry.dispose();
    this.heldRod.geometry.dispose();
    this.reel.geometry.dispose();
    this.line.geometry.dispose();
  }
}
