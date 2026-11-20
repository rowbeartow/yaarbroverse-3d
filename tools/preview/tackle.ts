// What a hero holds while fishing, on the enemies preview page (enemies.ts):
// the rod, its reel, the line and the fish he lands. Also the measuring that
// tools/preview/fishing-measure.mjs runs over every frame of the fishing clips.
//
// Where each thing goes is worked out by src/view/held-tackle.ts, which the
// game draws from too; this file draws it on the page. The top of that file
// says how he holds things: at a grip point in the middle of each palm.
//
// Lengths in this file are metres on his model as it comes (he is 2.87 m tall
// there, 2.2 m in the game), turned into the page's units by `unit`.

import {
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SkinnedMesh,
  SphereGeometry,
  Triangle,
  TubeGeometry,
  Vector3,
  BufferGeometry,
  type AnimationAction,
  type AnimationClip,
  type AnimationMixer,
  type Object3D,
} from 'three';
import { AnimationMixer as Mixer } from 'three';
import { CAST, GAME_TALL, LANDED, MODEL_TALL, ROD, ease, fishFlying, heldSize, lieAcross, lineBetween as lineOf, readHands as handsOf, reelOn, rodFalling, rodLine as rodOf, type Grip, type Grips, type RodPose } from '../../src/view/held-tackle';

export type { Grip, Grips };

/** Which fishing clip is playing: what he holds differs in each. */
export type Held = 'cast' | 'reel' | 'landed';

/** The catches he can be shown landing: a kind of fish and its length, as the fish book has it. */
export const CATCHES: { kind: string; cm: number; label: string }[] = [
  { kind: 'bass', cm: 38, label: 'Bass, 38 cm' },
  { kind: 'bass', cm: 25, label: 'Bass, 25 cm' },
  { kind: 'bass', cm: 55, label: 'Bass, 55 cm' },
  { kind: 'perch', cm: 12, label: 'Perch, 12 cm' },
  { kind: 'perch', cm: 30, label: 'Perch, 30 cm' },
  { kind: 'trout', cm: 30, label: 'Trout, 30 cm' },
  { kind: 'trout', cm: 70, label: 'Trout, 70 cm' },
  { kind: 'pike', cm: 50, label: 'Pike, 50 cm' },
  { kind: 'pike', cm: 110, label: 'Pike, 110 cm' },
];
interface Loaded {
  scene: Group;
  animations: AnimationClip[];
}

interface Fish {
  kind: string;
  group: Group;
  long: number;
  mixer: AnimationMixer;
  thrash: AnimationAction | undefined;
  /** Its skin at rest, about its middle: three points a triangle. */
  skin: Vector3[];
  meshes: Mesh[];
}

/** Where everything was put the last time `place` ran: what the measuring reads. */
export interface Placed {
  what: Held | undefined;
  /** The rod is in his right palm. */
  rodHeld: boolean;
  /** His left palm is on the rod too. */
  twoHands: boolean;
  /** The fish lies on his palms. */
  fishHeld: boolean;
  gripRight: Vector3;
  gripLeft: Vector3;
  palmRight: Vector3;
  palmLeft: Vector3;
  /** The middle of the rod, butt to tip. Empty when no rod is drawn. */
  rod: Vector3[];
  /** Which way the rod's handle points. */
  along: Vector3;
  /** Points on the reel. */
  reel: Vector3[];
  /** From the rod to the middle of the reel. */
  reelSide: Vector3;
  /** Which way the reel's axle points. */
  axle: Vector3;
  /** How far round the reel has turned, in turns. */
  spun: number;
  /** The line, rod's tip to its far end. Empty when no line is drawn. */
  line: Vector3[];
  fish: Fish | null;
}

export interface Tackle {
  /** Which of `CATCHES` he lands. */
  caught: number;
  /** Draw a marker at each grip point. */
  marks: boolean;
  place: (what: Held | undefined, share: number, clock: number) => void;
  placed: Placed;
  unit: number;
}

const UP = new Vector3(0, 1, 0);
export const makeTackle = (
  model: Group,
  root: Group,
  unit: number,
  grips: Grips,
  heldFish: Map<string, Loaded>,
  mixer: AnimationMixer,
  actions: Map<string, AnimationAction>,
  landedClip = 'fish_show',
): Tackle => {
  const right = model.getObjectByName(grips.right.bone) as Object3D;
  const left = model.getObjectByName(grips.left.bone) as Object3D;
  // A place given in metres on his model (x to his left, y behind him, z up), on this page.
  const place = (x: number, y: number, z: number): Vector3 => new Vector3(x * unit + model.position.x, z * unit + model.position.y, -y * unit + model.position.z);

  const wood = new MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 });
  const metal = new MeshStandardMaterial({
    color: 0xd9a441,
    roughness: 0.45,
    metalness: 0.2,
  });
  const dark = new MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5 });
  const rod = new Mesh(new BufferGeometry(), wood);
  rod.castShadow = true;
  // The reel: a drum under the rod, its axle sideways, with a knob on its face to show it turning.
  const drum = new Mesh(new CylinderGeometry(ROD.reelRadius * unit, ROD.reelRadius * unit, ROD.reelWide * unit, 24), metal);
  const hub = new Mesh(new CylinderGeometry(ROD.reelRadius * 0.35 * unit, ROD.reelRadius * 0.35 * unit, ROD.reelWide * 1.3 * unit, 12), dark);
  const knob = new Mesh(new SphereGeometry(0.028 * unit, 12, 8), dark);
  const knobFar = new Mesh(new SphereGeometry(0.028 * unit, 12, 8), dark);
  const line = new Mesh(new BufferGeometry(), new MeshStandardMaterial({ color: 0xf8f6ee, emissive: 0x777777 }));
  const bobber = new Mesh(new SphereGeometry(0.05 * unit, 12, 8), new MeshStandardMaterial({ color: 0xd8402f, roughness: 0.5 }));
  const markRight = new Mesh(new SphereGeometry(0.035 * unit, 12, 8), new MeshBasicMaterial({ color: 0x00e5ff, depthTest: false }));
  const markLeft = new Mesh(new SphereGeometry(0.035 * unit, 12, 8), new MeshBasicMaterial({ color: 0xff3df2, depthTest: false }));
  markRight.renderOrder = markLeft.renderOrder = 5;
  for (const part of [rod, drum, hub, knob, knobFar, line, bobber, markRight, markLeft]) {
    part.frustumCulled = false;
    part.visible = false;
    root.add(part);
  }

  // The fish: one of each kind, drawn at the size of the catch that is picked.
  const fishes = new Map<string, Fish>();
  root.updateMatrixWorld(true);
  for (const [kind, loaded] of heldFish) {
    const group = new Group();
    group.add(loaded.scene);
    group.visible = false;
    root.add(group);
    group.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    loaded.scene.traverse((node) => {
      if ((node as Mesh).isMesh) meshes.push(node as Mesh);
    });
    // Its points as it lies at rest, to find its middle, its length and the line of its belly.
    const points: Vector3[] = [];
    for (const mesh of meshes) {
      const count = mesh.geometry.getAttribute('position').count;
      for (let i = 0; i < count; i += 1) points.push(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
    }
    const low = new Vector3(Infinity, Infinity, Infinity);
    const high = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const point of points) {
      low.min(point);
      high.max(point);
    }
    const centre = low.clone().add(high).multiplyScalar(0.5);
    loaded.scene.position.sub(centre);
    const long = high.z - low.z;
    const skin: Vector3[] = [];
    let base = 0;
    for (const mesh of meshes) {
      const count = mesh.geometry.getAttribute('position').count;
      const index = mesh.geometry.getIndex();
      const total = index ? index.count : count;
      for (let i = 0; i < total; i += 1) skin.push(points[base + (index ? index.getX(i) : i)].clone().sub(centre));
      base += count;
    }
    const fishMixer = new Mixer(loaded.scene);
    const thrashClip = loaded.animations.find((clip) => clip.name === 'thrash');
    fishes.set(kind, {
      kind,
      group,
      long,
      mixer: fishMixer,
      thrash: thrashClip ? fishMixer.clipAction(thrashClip) : undefined,
      skin,
      meshes,
    });
  }
  const placed: Placed = {
    what: undefined,
    rodHeld: false,
    twoHands: false,
    fishHeld: false,
    gripRight: new Vector3(),
    gripLeft: new Vector3(),
    palmRight: new Vector3(),
    palmLeft: new Vector3(),
    rod: [],
    along: new Vector3(),
    reel: [],
    reelSide: new Vector3(),
    axle: new Vector3(),
    spun: 0,
    line: [],
    fish: null,
  };

  const rodLine = (from: Vector3, along: Vector3, toward: Vector3 | null, pulled: number): Vector3[] => rodOf(from, along, toward, pulled, unit);
  const tube = (mesh: Mesh, points: Vector3[], radius: number): void => {
    mesh.geometry.dispose();
    mesh.geometry = new TubeGeometry(new CatmullRomCurve3(points), Math.max(8, points.length * 2), radius, 6);
    mesh.visible = true;
  };
  const lineBetween = (from: Vector3, to: Vector3, sag: number): Vector3[] => lineOf(from, to, sag, unit);
  const reelAt = (from: Vector3, along: Vector3, side: Vector3, turns: number): void => {
    const { centre, axle } = reelOn({ from, along, side }, unit);
    const turn = new Quaternion().setFromUnitVectors(UP, axle);
    drum.position.copy(centre);
    hub.position.copy(centre);
    drum.quaternion.copy(turn);
    hub.quaternion.copy(turn);
    const angle = turns * Math.PI * 2;
    const out = along
      .clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(side, Math.sin(angle))
      .multiplyScalar(ROD.knobOut * unit);
    knob.position
      .copy(centre)
      .addScaledVector(axle, (ROD.reelWide / 2 + 0.02) * unit)
      .add(out);
    knobFar.position
      .copy(centre)
      .addScaledVector(axle, -(ROD.reelWide / 2 + 0.02) * unit)
      .sub(out);
    drum.visible = hub.visible = knob.visible = knobFar.visible = true;
    placed.reel = [centre.clone(), knob.position.clone(), knobFar.position.clone()];
    for (let i = 0; i < 12; i += 1) {
      const round = along
        .clone()
        .multiplyScalar(Math.cos((i * Math.PI) / 6))
        .addScaledVector(side, Math.sin((i * Math.PI) / 6))
        .multiplyScalar(ROD.reelRadius * unit);
      for (const face of [-1, 1])
        placed.reel.push(
          centre
            .clone()
            .add(round)
            .addScaledVector(axle, (face * ROD.reelWide * unit) / 2),
        );
    }
    placed.reelSide.copy(side);
    placed.axle.copy(axle);
    placed.spun = turns;
  };

  /** Where the rod is in his right palm in the pose he is in now: a point on its middle, and which way it runs and its reel hangs. */
  let hands = handsOf(grips, right, left, unit);
  const inHand = (): RodPose => ({ from: hands.from.clone(), along: hands.along.clone(), side: hands.side.clone() });
  const readHands = (): void => {
    root.updateMatrixWorld(true);
    hands = handsOf(grips, right, left, unit);
    placed.gripRight.copy(hands.gripRight);
    placed.gripLeft.copy(hands.gripLeft);
    placed.palmRight.copy(hands.palmRight);
    placed.palmLeft.copy(hands.palmLeft);
  };

  // The rod as he lets go of it in "Landed": read from the clip once, so it falls from exactly where his hand left it.
  let letGo: RodPose | null = null;
  const letGoPose = (): RodPose => {
    if (letGo) return letGo;
    const action = actions.get(landedClip);
    if (!action) return inHand();
    const was = action.time;
    action.time = action.getClip().duration * LANDED.release;
    mixer.update(0);
    readHands();
    letGo = inHand();
    action.time = was;
    mixer.update(0);
    readHands();
    return letGo;
  };
  // Lying on the boards at his right, pointing the way he faces.
  const LYING = {
    from: place(-0.95, -0.75, 0.03),
    along: new Vector3(0, 0, 1),
    side: new Vector3(-1, 0, 0),
  };
  const FAR = place(0, -5.4, 0.02);
  const NEAR = place(0, -3.0, 0.0);

  const tackle: Tackle = {
    caught: Math.max(
      0,
      CATCHES.findIndex((entry) => fishes.has(entry.kind)),
    ),
    marks: false,
    placed,
    unit,
    place(what, share, clock) {
      for (const part of [rod, drum, hub, knob, knobFar, line, bobber]) part.visible = false;
      for (const fish of fishes.values()) fish.group.visible = false;
      readHands();
      markRight.visible = markLeft.visible = tackle.marks;
      markRight.position.copy(placed.gripRight);
      markLeft.position.copy(placed.gripLeft);
      Object.assign(placed, {
        what,
        rodHeld: false,
        twoHands: false,
        fishHeld: false,
        rod: [],
        reel: [],
        line: [],
        fish: null,
      });
      if (!what) return;
      const held = inHand();
      placed.along.copy(held.along);
      const ground = model.position.y;

      if (what === 'cast') {
        placed.rodHeld = true;
        placed.rod = rodLine(held.from, held.along, null, 0);
        reelAt(held.from, held.along, held.side, 0);
        const tip = placed.rod[placed.rod.length - 1];
        // The lure hangs from the tip until the rod whips forward, then flies out and lands on the water.
        const hung = tip.clone().addScaledVector(UP, -0.5 * unit);
        hung.y = Math.max(hung.y, ground + 0.06 * unit);
        const out = ease((share - CAST.fly) / (CAST.down - CAST.fly));
        const end = hung.clone().lerp(FAR, out);
        end.y += Math.sin(Math.PI * out) * 0.5 * unit;
        placed.line = lineBetween(tip, end, 0.12 * unit * out);
        bobber.position.copy(end);
        bobber.visible = true;
      } else if (what === 'reel') {
        placed.rodHeld = placed.twoHands = true;
        // The fish pulls twice a loop, and the line comes in a little at a time.
        const pull = 0.5 - 0.5 * Math.cos(2 * Math.PI * share * 2);
        const heading = new Vector3(held.along.x, 0, held.along.z).normalize();
        const reach = 5.4 - 2.8 * ((clock / 7) % 1);
        const far = new Vector3(held.from.x, ground + 0.02 * unit, held.from.z).addScaledVector(heading, reach * unit);
        placed.rod = rodLine(held.from, held.along, far, 0.6 + 0.4 * pull);
        reelAt(held.from, held.along, held.side, clock * 2.2);
        placed.line = lineBetween(placed.rod[placed.rod.length - 1], far, 0);
        bobber.position.copy(far);
        bobber.visible = true;
      } else {
        const entry = CATCHES[tackle.caught] ?? CATCHES[0];
        const fish = fishes.get(entry.kind) ?? null;
        placed.fish = fish;
        // As long beside him as the catch is, so many times life size, but never shorter than reaches across both his palms.
        const size = fish ? heldSize(entry.cm, fish.long, unit) : 1;
        const lying = fish ? lieAcross(fish.skin, fish.long, placed.gripRight, placed.gripLeft, size) : null;
        let mouth = NEAR.clone();
        if (fish && lying && share >= LANDED.burst) {
          fish.group.visible = true;
          fish.group.scale.setScalar(size);
          const flight = (share - LANDED.burst) / (LANDED.caught - LANDED.burst);
          if (flight < 1) {
            const flying = fishFlying(NEAR, lying, flight, unit);
            fish.group.position.copy(flying.position);
            fish.group.quaternion.copy(flying.turn);
            if (fish.thrash) {
              fish.thrash.play();
              fish.thrash.setEffectiveWeight(1 - flying.settled);
              fish.thrash.time = ((share - LANDED.burst) * 2.8) % fish.thrash.getClip().duration;
            }
            mouth = fish.group.position.clone().add(new Vector3(0, 0, 1).applyQuaternion(fish.group.quaternion).multiplyScalar(fish.long * size * 0.5));
          } else {
            placed.fishHeld = true;
            fish.thrash?.stop();
            fish.group.position.copy(lying.position);
            fish.group.quaternion.copy(lying.turn);
          }
          fish.mixer.update(0);
        }
        if (share < LANDED.release) {
          placed.rodHeld = placed.twoHands = true;
          placed.rod = rodLine(held.from, held.along, mouth, 1 - 0.6 * ease(share / LANDED.release));
          reelAt(held.from, held.along, held.side, share < LANDED.burst ? clock * 2.2 : 0);
        } else {
          // He lets go: it drops to the boards at his right.
          const falling = rodFalling(letGoPose(), LYING, Math.min(1, (share - LANDED.release) / (LANDED.down - LANDED.release)));
          placed.along.copy(falling.along);
          placed.rod = rodLine(falling.from, falling.along, null, 0);
          reelAt(falling.from, falling.along, falling.side, 0);
        }
        if (!placed.fishHeld) placed.line = lineBetween(placed.rod[placed.rod.length - 1], mouth, share < LANDED.release ? 0 : 0.25 * unit);
      }
      tube(rod, placed.rod, ROD.thick * unit);
      if (placed.line.length > 1) tube(line, placed.line, 0.006);
    },
  };
  return tackle;
};

// ---------- Measuring ----------

/** What the measuring found over every frame of one clip. Lengths are centimetres at his size in the game; angles are degrees. */
export interface Measured {
  clip: string;
  frames: number;
  /** How far each grip point is from the skin of its palm, and how far along the hand it is from the wrist (0) to the fingertips (1). */
  palms: {
    hand: string;
    fromSkin: number;
    alongHand: number;
    fromWrist: number;
  }[];
  /** Furthest the rod's surface is from each grip point, over the frames that hand holds it. */
  rodFromRight: number | null;
  rodFromLeft: number | null;
  /** Furthest the fish's skin is from each grip point, over the frames it lies on his palms. */
  fishFromRight: number | null;
  fishFromLeft: number | null;
  /** Most his palms tip away from straight up while the fish lies on them. */
  palmsOffUp: number | null;
  /** Most his fingers point away from straight out to each hand's own side while the fish lies on his palms. */
  fingersOffOut: number | null;
  /** Frames in which some point of a thing is inside his body or head (his hands are not counted: they hold it). */
  through: Record<string, { frames: number; first: number; worst: number; parts: string[] }>;
  /** While reeling: how far the rod's heading is off the line's, how far the reel is off straight under the rod, how far its axle is off level, how high his palms are above his hips, the line's longest and shortest, and how far round the reel turns. */
  reel?: {
    headingOff: number;
    reelOffUnder: number;
    axleOffLevel: number;
    palmsAboveHips: [number, number];
    line: [number, number];
    turns: number;
    bend: [number, number];
    leanSwing: number;
    sideSwing: number;
    hangs: number[];
  };
  /** In "Landed": how far the fish's lowest point is above the top of his head once it is up, and where the fish starts. */
  landed?: { aboveHead: number; startsUnderWater: boolean; fishKind: string };
}

/**
 * Plays one clip a frame at a time (30 a second) and measures what he holds
 * against his palms and his body. `action` must be the clip, playing and paused.
 */
export const measureClip = (model: Group, mixer: AnimationMixer, action: AnimationAction, tackle: Tackle, what: Held, grips: Grips, catchIndex: number): Measured => {
  const clip = action.getClip();
  const frames = Math.round(clip.duration * 30);
  const cm = (GAME_TALL / MODEL_TALL / tackle.unit) * 100;
  tackle.caught = catchIndex;

  // His skin, and which of its points belong to a hand or to the head.
  const skins: SkinnedMesh[] = [];
  model.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh) skins.push(node as SkinnedMesh);
  });
  const hands = new Set([grips.right.bone, grips.left.bone]);
  const parts = skins.map((skin) => {
    const count = skin.geometry.getAttribute('position').count;
    const index = skin.geometry.getIndex();
    const joints = skin.geometry.getAttribute('skinIndex');
    const weights = skin.geometry.getAttribute('skinWeight');
    const owner: string[] = [];
    for (let i = 0; i < count; i += 1) {
      let best = 0;
      for (let k = 1; k < 4; k += 1) if (weights.getComponent(i, k) > weights.getComponent(i, best)) best = k;
      owner.push(skin.skeleton.bones[joints.getComponent(i, best)]?.name ?? '');
    }
    const triangles: number[] = [];
    const total = index ? index.count : count;
    for (let i = 0; i < total; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
      // His hands are left out: they are what holds things.
      if (!hands.has(owner[a]) && !hands.has(owner[b]) && !hands.has(owner[c])) triangles.push(a, b, c);
    }
    return {
      skin,
      count,
      owner,
      triangles,
      points: Array.from({ length: count }, () => new Vector3()),
    };
  });
  const pose = (frame: number): number => {
    const share = frame / frames;
    action.time = Math.min(clip.duration * share, clip.duration - 1e-4);
    mixer.update(0);
    tackle.place(what, share, frame / 30);
    for (const part of parts) for (let i = 0; i < part.count; i += 1) part.skin.getVertexPosition(i, part.points[i]).applyMatrix4(part.skin.matrixWorld);
    return share;
  };

  /** Whether each point is inside his body: a line straight up and a line straight down from it both come out through his skin. */
  const inside = (points: Vector3[], into: Set<string>): number => {
    if (points.length === 0) return 0;
    const cell = 0.05;
    const grid = new Map<number, number[][]>();
    const key = (x: number, z: number): number => Math.floor(x / cell) * 4096 + Math.floor(z / cell);
    parts.forEach((part, which) => {
      for (let i = 0; i < part.triangles.length; i += 3) {
        const [a, b, c] = [part.points[part.triangles[i]], part.points[part.triangles[i + 1]], part.points[part.triangles[i + 2]]];
        for (let x = Math.floor(Math.min(a.x, b.x, c.x) / cell); x <= Math.floor(Math.max(a.x, b.x, c.x) / cell); x += 1) {
          for (let z = Math.floor(Math.min(a.z, b.z, c.z) / cell); z <= Math.floor(Math.max(a.z, b.z, c.z) / cell); z += 1) {
            const at = x * 4096 + z;
            if (!grid.has(at)) grid.set(at, []);
            grid.get(at)?.push([which, i]);
          }
        }
      }
    });
    let count = 0;
    for (const point of points) {
      let up = 0;
      let down = 0;
      for (const [which, i] of grid.get(key(point.x, point.z)) ?? []) {
        const part = parts[which];
        const [a, b, c] = [part.points[part.triangles[i]], part.points[part.triangles[i + 1]], part.points[part.triangles[i + 2]]];
        const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
        if (Math.abs(area) < 1e-12) continue;
        const u = ((point.x - a.x) * (c.z - a.z) - (c.x - a.x) * (point.z - a.z)) / area;
        const v = ((b.x - a.x) * (point.z - a.z) - (point.x - a.x) * (b.z - a.z)) / area;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const y = a.y + u * (b.y - a.y) + v * (c.y - a.y);
        if (y > point.y) up += Math.sign(area);
        else down += Math.sign(area);
      }
      if (up === 0 || down === 0) continue;
      count += 1;
      // Which part of him it is in: the bone that owns the nearest point of his skin.
      let nearest = Infinity;
      let owner = '';
      for (const part of parts) {
        for (let i = 0; i < part.count; i += 1) {
          const far = part.points[i].distanceToSquared(point);
          if (far < nearest) [nearest, owner] = [far, part.owner[i]];
        }
      }
      into.add(owner);
    }
    return count;
  };
  const toLine = (point: Vector3, lineOf: Vector3[]): number => {
    let best = Infinity;
    const on = new Vector3();
    for (let i = 0; i + 1 < lineOf.length; i += 1) {
      const span = lineOf[i + 1].clone().sub(lineOf[i]);
      const t = Math.max(0, Math.min(1, point.clone().sub(lineOf[i]).dot(span) / span.lengthSq()));
      best = Math.min(best, on.copy(lineOf[i]).addScaledVector(span, t).distanceTo(point));
    }
    return best;
  };
  const fishPoints = (): { points: Vector3[]; triangles: number[] } => {
    const fish = tackle.placed.fish;
    const points: Vector3[] = [];
    const triangles: number[] = [];
    if (!fish || !fish.group.visible) return { points, triangles };
    fish.group.updateMatrixWorld(true);
    for (const mesh of fish.meshes) {
      const base = points.length;
      const count = mesh.geometry.getAttribute('position').count;
      for (let i = 0; i < count; i += 1) points.push(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
      const index = mesh.geometry.getIndex();
      const total = index ? index.count : count;
      for (let i = 0; i < total; i += 1) triangles.push(base + (index ? index.getX(i) : i));
    }
    return { points, triangles };
  };
  const toSkinOf = (point: Vector3, shape: { points: Vector3[]; triangles: number[] }): number => {
    let best = Infinity;
    const triangle = new Triangle();
    const on = new Vector3();
    for (let i = 0; i < shape.triangles.length; i += 3) {
      triangle.set(shape.points[shape.triangles[i]], shape.points[shape.triangles[i + 1]], shape.points[shape.triangles[i + 2]]);
      best = Math.min(best, triangle.closestPointToPoint(point, on).distanceTo(point));
    }
    return best;
  };

  const out: Measured = {
    clip: clip.name,
    frames: frames + 1,
    palms: [],
    rodFromRight: null,
    rodFromLeft: null,
    fishFromRight: null,
    fishFromLeft: null,
    palmsOffUp: null,
    fingersOffOut: null,
    through: {},
  };
  const worse = (now: number | null, value: number): number => Math.max(now ?? 0, value);
  const hips = model.getObjectByName('Hips');
  const reel = {
    headingOff: 0,
    reelOffUnder: 0,
    axleOffLevel: 0,
    low: Infinity,
    high: -Infinity,
    longest: 0,
    shortest: Infinity,
    turns: 0,
    bendLow: Infinity,
    bendHigh: 0,
  };
  let aboveHead = Infinity;
  let startsUnderWater = false;
  const placed = tackle.placed;

  /** The side of the rod that is straight under it as he starts to reel, in his right hand's own space: `reel` in the guide's grips. */
  let hangs: number[] = [];
  for (let frame = 0; frame <= frames; frame += 1) {
    const share = pose(frame);
    if (frame === 0) {
      const hand = model.getObjectByName(grips.right.bone) as Object3D;
      const under = UP.clone().negate().addScaledVector(placed.along, UP.dot(placed.along)).normalize();
      hangs = under
        .transformDirection(hand.matrixWorld.clone().invert())
        .toArray()
        .map((value) => Math.round(value * 1000) / 1000);
      // The grip points themselves: on the skin of the palm, in the middle of the hand.
      for (const [grip, at] of [
        [grips.right, placed.gripRight],
        [grips.left, placed.gripLeft],
      ] as [Grip, Vector3][]) {
        const bone = model.getObjectByName(grip.bone) as Object3D;
        const wrist = bone.getWorldPosition(new Vector3());
        const fingers = new Vector3().fromArray(grip.fingers).transformDirection(bone.matrixWorld);
        let long = 0;
        const hand: { points: Vector3[]; triangles: number[] } = {
          points: [],
          triangles: [],
        };
        for (const part of parts) {
          for (let i = 0; i < part.count; i += 1) if (part.owner[i] === grip.bone) long = Math.max(long, part.points[i].clone().sub(wrist).dot(fingers));
          const index = part.skin.geometry.getIndex();
          const total = index ? index.count : part.count;
          for (let i = 0; i < total; i += 3) {
            const corners = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
            if (!corners.some((corner) => part.owner[corner] === grip.bone)) continue;
            for (const corner of corners) hand.triangles.push(hand.points.push(part.points[corner]) - 1);
          }
        }
        const fromSkin = toSkinOf(at, hand);
        out.palms.push({
          hand: grip.bone,
          fromSkin: fromSkin * cm,
          alongHand: at.clone().sub(wrist).dot(fingers) / long,
          fromWrist: at.distanceTo(wrist) * cm,
        });
      }
    }
    if (placed.rodHeld) out.rodFromRight = worse(out.rodFromRight, Math.abs(toLine(placed.gripRight, placed.rod) - ROD.thick * tackle.unit) * cm);
    if (placed.twoHands) out.rodFromLeft = worse(out.rodFromLeft, Math.abs(toLine(placed.gripLeft, placed.rod) - ROD.thick * tackle.unit) * cm);
    const fish = fishPoints();
    if (placed.fishHeld) {
      out.fishFromRight = worse(out.fishFromRight, toSkinOf(placed.gripRight, fish) * cm);
      out.fishFromLeft = worse(out.fishFromLeft, toSkinOf(placed.gripLeft, fish) * cm);
      out.palmsOffUp = worse(out.palmsOffUp, Math.max(placed.palmRight.angleTo(UP), placed.palmLeft.angleTo(UP)) * (180 / Math.PI));
      // Out to each hand's own side is away from the other hand.
      const outward = placed.gripRight.clone().sub(placed.gripLeft).setY(0).normalize();
      const fingersOf = (grip: Grip): Vector3 => new Vector3().fromArray(grip.fingers).transformDirection((model.getObjectByName(grip.bone) as Object3D).matrixWorld).setY(0).normalize();
      out.fingersOffOut = worse(out.fingersOffOut, Math.max(fingersOf(grips.right).angleTo(outward), fingersOf(grips.left).angleTo(outward.clone().negate())) * (180 / Math.PI));
      if (share >= 0.7) {
        let top = -Infinity;
        for (const part of parts) for (let i = 0; i < part.count; i += 1) if (/head/i.test(part.owner[i])) top = Math.max(top, part.points[i].y);
        aboveHead = Math.min(aboveHead, (Math.min(...fish.points.map((point) => point.y)) - top) * cm);
      }
    }
    if (what === 'landed' && frame === 0) startsUnderWater = !placed.fish?.group.visible;
    // Points on the rod's skin as well as its middle.
    const rodPoints = [...placed.rod];
    for (let i = 0; i + 1 < placed.rod.length; i += 1) {
      const along = placed.rod[i + 1].clone().sub(placed.rod[i]).normalize();
      const off = new Vector3().crossVectors(along, Math.abs(along.y) < 0.9 ? UP : new Vector3(1, 0, 0)).normalize();
      const other = new Vector3().crossVectors(along, off);
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        rodPoints.push(
          placed.rod[i]
            .clone()
            .addScaledVector(off, a * ROD.thick * tackle.unit)
            .addScaledVector(other, b * ROD.thick * tackle.unit),
        );
    }
    const things: Record<string, Vector3[]> = {
      rod: rodPoints,
      reel: placed.reel,
      line: placed.line,
      fish: fish.points,
    };
    for (const [name, points] of Object.entries(things)) {
      const into = new Set<string>();
      const count = inside(points, into);
      out.through[name] ??= { frames: 0, first: -1, worst: 0, parts: [] };
      if (count > 0) {
        const entry = out.through[name];
        entry.parts = [...new Set([...entry.parts, ...into])];
        entry.frames += 1;
        if (entry.first < 0) entry.first = frame;
        entry.worst = Math.max(entry.worst, count);
      }
    }
    if (what === 'reel' && hips) {
      const tip = placed.rod[placed.rod.length - 1];
      const far = placed.line[placed.line.length - 1];
      const rodHeading = new Vector3(placed.along.x, 0, placed.along.z).normalize();
      const lineHeading = new Vector3(far.x - tip.x, 0, far.z - tip.z).normalize();
      reel.headingOff = Math.max(reel.headingOff, rodHeading.angleTo(lineHeading) * (180 / Math.PI));
      const under = UP.clone().negate().addScaledVector(placed.along, UP.dot(placed.along)).normalize();
      reel.reelOffUnder = Math.max(reel.reelOffUnder, placed.reelSide.angleTo(under) * (180 / Math.PI));
      reel.axleOffLevel = Math.max(reel.axleOffLevel, Math.abs(90 - placed.axle.angleTo(UP) * (180 / Math.PI)));
      const hipsAt = hips.getWorldPosition(new Vector3()).y;
      for (const grip of [placed.gripRight, placed.gripLeft]) {
        reel.low = Math.min(reel.low, (grip.y - hipsAt) * cm);
        reel.high = Math.max(reel.high, (grip.y - hipsAt) * cm);
      }
      const long = tip.distanceTo(far) * cm;
      reel.longest = Math.max(reel.longest, long);
      reel.shortest = Math.min(reel.shortest, long);
      reel.turns = placed.spun;
      // How far the tip is bent off the line of the handle.
      const handle = placed.rod[8];
      const bent = tip.clone().sub(handle);
      const off = bent.clone().addScaledVector(placed.along, -bent.dot(placed.along)).length() * cm;
      reel.bendLow = Math.min(reel.bendLow, off);
      reel.bendHigh = Math.max(reel.bendHigh, off);
    }
  }
  if (what === 'reel') {
    // How much he leans back and sways: the swing of his head over his hips.
    let [backLow, backHigh, sideLow, sideHigh] = [Infinity, -Infinity, Infinity, -Infinity];
    const head = model.getObjectByName('Head');
    for (let frame = 0; frame <= frames; frame += 1) {
      pose(frame);
      if (!head || !hips) break;
      const lean = head.getWorldPosition(new Vector3()).sub(hips.getWorldPosition(new Vector3()));
      backLow = Math.min(backLow, lean.z * cm);
      backHigh = Math.max(backHigh, lean.z * cm);
      sideLow = Math.min(sideLow, lean.x * cm);
      sideHigh = Math.max(sideHigh, lean.x * cm);
    }
    out.reel = {
      headingOff: reel.headingOff,
      reelOffUnder: reel.reelOffUnder,
      axleOffLevel: reel.axleOffLevel,
      palmsAboveHips: [reel.low, reel.high],
      line: [reel.shortest, reel.longest],
      turns: reel.turns,
      bend: [reel.bendLow, reel.bendHigh],
      leanSwing: backHigh - backLow,
      sideSwing: sideHigh - sideLow,
      hangs,
    };
  }
  if (what === 'landed')
    out.landed = {
      aboveHead,
      startsUnderWater,
      fishKind: CATCHES[catchIndex]?.label ?? '',
    };
  return out;
};
