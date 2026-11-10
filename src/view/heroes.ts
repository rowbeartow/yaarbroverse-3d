// The two heroes, built from simple low-poly shapes, with a walk and a jump
// worked out from how fast they are moving. Looks follow the family-approved
// Caputo Mountain art: Yaarbro in his blue tunic with the orange beard, Caputo
// grey-brown with dark stripes, long fangs and green eyes.

import { ConeGeometry, Group, IcosahedronGeometry, Mesh } from 'three';
import type { HeroName } from '../game/hero';
import { COLOR, boxAt, fuse, paint } from './shapes';

/** What the hero is doing this frame, for the animation. */
export interface Pose {
  /** Sideways speed as a share of walking speed, 0 to 1. */
  pace: number;
  grounded: boolean;
  /** Upward speed; negative when dropping. */
  rise: number;
}

export interface HeroView {
  root: Group;
  /** Size of the shadow on the ground: across and along the body. */
  shadow: { across: number; along: number };
  /** Where a portrait camera should look, and from how far. */
  portrait: { height: number; distance: number };
  animate(pose: Pose, dt: number): void;
  /** A quick squash (landing) or stretch (jumping). */
  squash(amount: number): void;
}

const spring = (value: number, dt: number): number => value * Math.exp(-dt * 10);

const yaarbro = (): HeroView => {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const leg = (side: number): Group => {
    const pivot = new Group();
    pivot.position.set(side * 0.25, 0.8, 0);
    pivot.add(boxAt(paint(COLOR.trousers), 0.34, 0.5, 0.38, 0, -0.26, 0));
    pivot.add(boxAt(paint(COLOR.boot), 0.4, 0.2, 0.42, 0, -0.5, 0));
    pivot.add(boxAt(paint(COLOR.boot), 0.4, 0.26, 0.64, 0, -0.67, 0.1));
    body.add(pivot);
    return pivot;
  };
  const legs = [leg(-1), leg(1)];

  body.add(boxAt(paint(COLOR.tunic), 1.02, 0.86, 0.64, 0, 1.25, 0));
  body.add(boxAt(paint(COLOR.tunicDark), 1.08, 0.3, 0.7, 0, 0.8, 0));
  body.add(boxAt(paint(COLOR.belt), 1.06, 0.14, 0.68, 0, 0.96, 0));
  body.add(boxAt(paint(COLOR.buckle), 0.24, 0.2, 0.06, 0, 0.96, 0.36));
  body.add(boxAt(paint(COLOR.tunicDark), 0.9, 0.2, 0.7, 0, 1.7, -0.02));

  const arm = (side: number): Group => {
    const pivot = new Group();
    pivot.position.set(side * 0.67, 1.55, 0);
    pivot.add(boxAt(paint(COLOR.tunic), 0.32, 0.5, 0.36, 0, -0.2, 0));
    pivot.add(boxAt(paint(COLOR.cuff), 0.35, 0.15, 0.39, 0, -0.5, 0));
    pivot.add(boxAt(paint(COLOR.skin), 0.3, 0.26, 0.32, 0, -0.69, 0));
    body.add(pivot);
    return pivot;
  };
  const arms = [arm(-1), arm(1)];

  const head = new Group();
  head.position.set(0, 2.06, 0.02);
  const skull = new Mesh(new IcosahedronGeometry(0.42, 1), paint(COLOR.skin));
  skull.scale.set(1, 0.96, 0.96);
  head.add(skull);
  // One full orange beard, wide at the jaw and coming to a point.
  head.add(boxAt(paint(COLOR.beard), 0.9, 0.36, 0.56, 0, -0.2, 0.06));
  const beardTip = new Mesh(new ConeGeometry(0.44, 0.7, 6), paint(COLOR.beard));
  beardTip.rotation.x = Math.PI;
  beardTip.position.set(0, -0.6, 0.14);
  head.add(beardTip);
  head.add(boxAt(paint(COLOR.beard), 0.42, 0.11, 0.12, 0, -0.1, 0.4));
  // Hair: swept-up orange tufts.
  const hair = new Mesh(new IcosahedronGeometry(0.44, 0), paint(COLOR.beard));
  hair.scale.set(1.02, 0.7, 1);
  hair.position.set(0, 0.2, -0.1);
  head.add(hair);
  const tuft = new ConeGeometry(0.16, 0.42, 5);
  for (const [x, y, z, lean] of [
    [-0.2, 0.5, 0, 0.5],
    [0.04, 0.58, 0.06, 0],
    [0.24, 0.5, 0, -0.5],
    [0, 0.5, -0.24, 0],
  ] as const) {
    const spike = new Mesh(tuft, paint(COLOR.beard));
    spike.position.set(x, y, z);
    spike.rotation.z = lean;
    head.add(spike);
  }
  const nose = new Mesh(new IcosahedronGeometry(0.12, 1), paint(0xe9a37a));
  nose.position.set(0, 0, 0.42);
  head.add(nose);
  for (const side of [-1, 1]) {
    head.add(boxAt(paint(COLOR.ink), 0.07, 0.11, 0.05, side * 0.16, 0.12, 0.38));
    head.add(boxAt(paint(COLOR.beard), 0.16, 0.05, 0.05, side * 0.16, 0.24, 0.39));
    head.add(boxAt(paint(COLOR.skin), 0.1, 0.2, 0.16, side * 0.43, 0.04, 0));
  }
  body.add(head);

  // One shape per moving part: each leg, each arm, the head, and the rest.
  for (const part of [...legs, ...arms, head]) fuse(part);
  fuse(body, [...legs, ...arms, head]);
  root.scale.setScalar(0.82);
  let stride = 0;
  let squashed = 0;
  return {
    root,
    shadow: { across: 1, along: 1 },
    portrait: { height: 1.52, distance: 2.5 },
    squash(amount) {
      squashed = amount;
    },
    animate(pose, dt) {
      stride += pose.pace * dt * 13;
      squashed = spring(squashed, dt);
      body.scale.set(1 + squashed * 0.5, 1 - squashed, 1 + squashed * 0.5);
      if (pose.grounded) {
        const swing = Math.sin(stride) * pose.pace * 0.8;
        legs[0].rotation.x = swing;
        legs[1].rotation.x = -swing;
        arms[0].rotation.set(-swing * 0.8, 0, 0);
        arms[1].rotation.set(swing * 0.8, 0, 0);
        body.position.y = Math.abs(Math.sin(stride)) * 0.07 * pose.pace;
        body.rotation.x = pose.pace * 0.08;
        head.rotation.x = 0;
      } else {
        const rising = pose.rise > 0;
        legs[0].rotation.x = rising ? -0.7 : 0.25;
        legs[1].rotation.x = rising ? 0.3 : -0.35;
        // Arms up on the way up, out wide on the way down.
        arms[0].rotation.set(rising ? -2.6 : -0.4, 0, rising ? 0 : -1.1);
        arms[1].rotation.set(rising ? -2.6 : -0.4, 0, rising ? 0 : 1.1);
        body.position.y = 0;
        body.rotation.x = rising ? -0.08 : 0.12;
        head.rotation.x = rising ? -0.2 : 0.15;
      }
    },
  };
};

const caputo = (): HeroView => {
  const root = new Group();
  const body = new Group();
  root.add(body);

  body.add(boxAt(paint(COLOR.fur), 0.86, 0.7, 1.9, 0, 0.9, 0));
  body.add(boxAt(paint(COLOR.furLight), 0.7, 0.16, 1.7, 0, 0.56, 0));
  body.add(boxAt(paint(COLOR.furLight), 0.78, 0.5, 0.3, 0, 0.78, 0.92));
  // Dark stripes over the back.
  for (let i = 0; i < 6; i += 1) {
    const stripe = boxAt(paint(COLOR.furDark), 0.9, 0.44, 0.12, 0, 1.05, -0.78 + i * 0.28);
    stripe.rotation.x = i % 2 ? 0.16 : -0.1;
    body.add(stripe);
  }

  const leg = (side: number, front: number): Group => {
    const pivot = new Group();
    pivot.position.set(side * 0.3, 0.6, front * 0.68);
    pivot.add(boxAt(paint(COLOR.fur), 0.27, 0.5, 0.31, 0, -0.22, 0));
    pivot.add(boxAt(paint(COLOR.furDark), 0.29, 0.07, 0.33, 0, -0.16, 0));
    pivot.add(boxAt(paint(COLOR.furLight), 0.31, 0.16, 0.4, 0, -0.52, 0.04));
    body.add(pivot);
    return pivot;
  };
  // Front left, front right, back left, back right.
  const legs = [leg(-1, 1), leg(1, 1), leg(-1, -1), leg(1, -1)];

  const head = new Group();
  head.position.set(0, 1.3, 1.16);
  head.add(boxAt(paint(COLOR.fur), 0.76, 0.62, 0.62, 0, 0, 0));
  head.add(boxAt(paint(COLOR.furLight), 0.44, 0.28, 0.3, 0, -0.15, 0.38));
  head.add(boxAt(paint(COLOR.nose), 0.15, 0.1, 0.06, 0, -0.04, 0.55));
  const ear = new ConeGeometry(0.17, 0.3, 4);
  const fang = new ConeGeometry(0.06, 0.46, 5);
  for (const side of [-1, 1]) {
    head.add(boxAt(paint(COLOR.eye), 0.16, 0.14, 0.05, side * 0.2, 0.1, 0.31));
    head.add(boxAt(paint(COLOR.ink), 0.06, 0.12, 0.03, side * 0.2, 0.1, 0.34));
    head.add(boxAt(paint(COLOR.furDark), 0.09, 0.04, 0.34, side * 0.13, 0.32, 0.06));
    head.add(boxAt(paint(COLOR.furDark), 0.05, 0.2, 0.3, side * 0.39, 0.02, 0.02));
    const outer = new Mesh(ear, paint(COLOR.fur));
    outer.position.set(side * 0.25, 0.44, -0.08);
    outer.rotation.y = Math.PI / 4;
    head.add(outer);
    const inner = new Mesh(ear, paint(COLOR.furLight));
    inner.scale.setScalar(0.6);
    inner.position.set(side * 0.25, 0.4, -0.01);
    inner.rotation.y = Math.PI / 4;
    head.add(inner);
    // The long curved fangs.
    const tooth = new Mesh(fang, paint(COLOR.cream));
    tooth.rotation.x = Math.PI - 0.12;
    tooth.position.set(side * 0.14, -0.46, 0.46);
    head.add(tooth);
  }
  body.add(head);

  // A striped tail that curls up.
  const tail = new Group();
  tail.position.set(0, 1.12, -0.95);
  const curl: Array<[number, number, number]> = [
    [0, -0.14, 0.5],
    [0.14, -0.4, 0.1],
    [0.42, -0.5, -0.5],
    [0.74, -0.38, -1.1],
    [0.98, -0.14, -1.6],
  ];
  curl.forEach(([y, z, tilt], i) => {
    const piece = boxAt(paint(i % 2 ? COLOR.furDark : COLOR.fur), 0.2, 0.2, 0.36, 0, y, z);
    piece.rotation.x = tilt;
    tail.add(piece);
  });
  body.add(tail);

  // One shape per moving part: each leg, the head, the tail, and the rest.
  for (const part of [...legs, head, tail]) fuse(part);
  fuse(body, [...legs, head, tail]);
  root.scale.setScalar(0.96);
  let stride = 0;
  let squashed = 0;
  let clock = 0;
  return {
    root,
    shadow: { across: 1.1, along: 2.2 },
    portrait: { height: 1.05, distance: 2.9 },
    squash(amount) {
      squashed = amount;
    },
    animate(pose, dt) {
      stride += pose.pace * dt * 14;
      clock += dt;
      squashed = spring(squashed, dt);
      body.scale.set(1 + squashed * 0.4, 1 - squashed, 1 + squashed * 0.2);
      tail.rotation.y = Math.sin(clock * 2.2) * 0.25;
      if (pose.grounded) {
        // A trot: opposite corners move together.
        const swing = Math.sin(stride) * pose.pace * 0.75;
        legs[0].rotation.x = swing;
        legs[3].rotation.x = swing;
        legs[1].rotation.x = -swing;
        legs[2].rotation.x = -swing;
        body.position.y = Math.abs(Math.sin(stride)) * 0.05 * pose.pace;
        body.rotation.x = 0;
        head.rotation.x = Math.sin(stride * 2) * 0.04 * pose.pace;
      } else {
        // A leap: front legs reach forward, back legs trail.
        const rising = pose.rise > 0;
        legs[0].rotation.x = legs[1].rotation.x = rising ? -1 : -0.5;
        legs[2].rotation.x = legs[3].rotation.x = rising ? 0.9 : 0.4;
        body.position.y = 0;
        body.rotation.x = rising ? -0.28 : 0.2;
        head.rotation.x = rising ? 0.15 : -0.1;
      }
    },
  };
};

export const buildHero = (name: HeroName): HeroView => (name === 'Caputo' ? caputo() : yaarbro());
