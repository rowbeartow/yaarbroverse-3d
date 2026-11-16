// Rope swings, drawn: each rope as a chain of short pieces that bends and
// sways, moved every frame toward where the rules have it; the bare snag with
// a bough that holds it up; and a hero hung from a rope by the hands (or the
// teeth), the body following the swing a moment late. Looks only: the rules
// are in src/game/rope.ts.
//
// The rules swing a rope as one straight line from where it is tied to its
// end. The chain here is a little longer than that line, so it never pulls
// dead straight: when a hero takes hold, the end is pinned to the hero's grip
// and the middle of the rope bows and wobbles after it; a rope nobody holds
// hangs and sways, its end drawn gently toward where the rules have it, so
// the place a hero can grab is where it looks to be.

import { ConeGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Material, type Object3D } from 'three';
import type { Level } from '../game/level';
import { handOf, handSpeed, newRope, type Rope, type RopeState } from '../game/rope';
import type { Materials } from './materials';

const ROPE_COLOR = 0xc9a66b;
/** How many points the chain has, from where it is tied to its end. */
const POINTS = 14;
/** How much longer the chain is than the rules' straight rope, so it bows. */
const SLACK = 1.02;
/** Steps a second the chain is moved in, and how many times each step its pieces are pulled back to length. */
const RATE = 120;
const PASSES = 8;
/** How much of its speed the chain keeps each step (the rest is lost to the air). */
const KEEP = 0.992;
/** A rope nobody holds: how hard its end is drawn toward the rules' end, a share a second. */
const FOLLOW = 6;
const GRAVITY = 20;

interface Chain {
  rope: Rope;
  at: Vector3[];
  was: Vector3[];
  pieces: InstancedMesh;
  knot: Mesh;
  /** Leftover time not yet stepped. */
  owed: number;
  /** Seconds since it was last taken hold of, for the wobble of the catch. */
  sinceCatch: number;
}

const UP = new Vector3(0, 1, 0);
const scratch = { a: new Vector3(), b: new Vector3(), q: new Quaternion(), m: new Matrix4(), s: new Vector3() };

export class RopesView {
  readonly group = new Group();
  private readonly chains = new Map<string, Chain>();
  private readonly looks: Material[] = [];
  private clock = 0;

  constructor(level: Level, materials: Materials) {
    const hemp = materials.simple ? new MeshLambertMaterial({ color: ROPE_COLOR }) : new MeshStandardMaterial({ color: ROPE_COLOR, roughness: 0.9 });
    this.looks.push(hemp);
    const piece = new CylinderGeometry(0.055, 0.055, 1, 6, 1, true);
    for (const rope of level.ropes ?? []) {
      const at: Vector3[] = [];
      for (let i = 0; i < POINTS; i += 1) at.push(new Vector3(rope.x, rope.y - (rope.length * SLACK * i) / (POINTS - 1), rope.z));
      const pieces = new InstancedMesh(piece, hemp, POINTS - 1);
      pieces.castShadow = true;
      pieces.frustumCulled = false;
      pieces.name = `rope-${rope.id}`;
      // A fat knot at the end to hold.
      const knot = new Mesh(new SphereGeometry(0.16, 8, 6), hemp);
      knot.castShadow = true;
      this.group.add(pieces, knot);
      this.chains.set(rope.id, { rope, at, was: at.map((p) => p.clone()), pieces, knot, owed: 0, sinceCatch: 10 });

      // What holds it: a bare snag standing a little to one side, with a bough out to the rope and a tuft of green at its top.
      const foot = rope.foot ?? { x: rope.x, z: rope.z - 3 };
      const pool = level.water?.find((w) => foot.x >= w.minX && foot.x <= w.maxX && foot.z >= w.minZ && foot.z <= w.maxZ);
      const base = pool ? pool.floor - 0.3 : Math.min(...level.solids.map((s) => s.top)) - 6;
      const top = rope.y + 1.6;
      const trunk = new Mesh(new CylinderGeometry(0.22, 0.42, top - base, 9), materials.bark);
      trunk.position.set(foot.x, (top + base) / 2, foot.z);
      trunk.castShadow = true;
      const from = new Vector3(foot.x, rope.y + 0.5, foot.z);
      const to = new Vector3(rope.x, rope.y + 0.1, rope.z);
      const reach = to.clone().sub(from);
      const bough = new Mesh(new CylinderGeometry(0.1, 0.17, reach.length() + 0.8, 7), materials.bark);
      bough.position.copy(from).addScaledVector(reach, 0.5);
      bough.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), reach.clone().normalize().negate());
      bough.castShadow = true;
      this.group.add(trunk, bough);
      for (const [dy, size] of [[0.2, 1.5], [1.3, 1.1], [2.2, 0.7]] as const) {
        const tuft = new Mesh(new ConeGeometry(size, 1.6, 8), materials.foliage);
        tuft.position.set(foot.x, top + dy, foot.z);
        tuft.castShadow = true;
        this.group.add(tuft);
      }
    }
    this.draw();
  }

  /** A hero just took hold of this rope: the wobble of the catch starts now. */
  caught(id: string): void {
    const chain = this.chains.get(id);
    if (chain) chain.sinceCatch = 0;
  }

  /**
   * Moves each rope on by `dt`, toward the rules' `ropes`. `holding` is the
   * rope a hero holds and where the hero's grip is drawn, which pins its end;
   * every other rope hangs free.
   */
  update(dt: number, ropes: readonly RopeState[], holding: { id: string; grip: Vector3 } | null): void {
    this.clock += dt;
    for (const chain of this.chains.values()) {
      const state = ropes.find((each) => each.rope.id === chain.rope.id) ?? newRope(chain.rope);
      chain.sinceCatch += dt;
      chain.owed = Math.min(chain.owed + dt, 0.1);
      const held = holding?.id === chain.rope.id ? holding.grip : null;
      while (chain.owed >= 1 / RATE) {
        chain.owed -= 1 / RATE;
        this.step(chain, state, held, 1 / RATE);
      }
    }
    this.draw();
  }

  private step(chain: Chain, state: RopeState, held: Vector3 | null, h: number): void {
    const { at, was, rope } = chain;
    const end = handOf(state);
    const going = handSpeed(state);
    // A breath of wind, and while a hero hangs on, the wobble of the catch dying away.
    const wind = 0.35 * Math.sin(this.clock * 1.3 + rope.x) + 0.2 * Math.sin(this.clock * 2.9 + rope.z);
    const wobble = held ? 4 * Math.exp(-2.2 * chain.sinceCatch) * Math.sin(chain.sinceCatch * 13) : 0;
    const across = scratch.s.set(-rope.ahead.z, 0, rope.ahead.x);
    for (let i = 1; i < POINTS; i += 1) {
      const p = at[i];
      const v = scratch.a.copy(p).sub(was[i]).multiplyScalar(KEEP);
      was[i].copy(p);
      const middle = Math.sin((Math.PI * i) / (POINTS - 1));
      p.add(v);
      p.y -= GRAVITY * h * h;
      p.addScaledVector(across, (wind + wobble) * middle * h * h);
    }
    if (!held) {
      // Drawn gently toward where the rules have the end, moving as it moves.
      const last = at[POINTS - 1];
      const pull = 1 - Math.exp(-FOLLOW * h);
      last.x += (end.x + going.x * h - last.x) * pull;
      last.y += (end.y + going.y * h - last.y) * pull;
      last.z += (end.z + going.z * h - last.z) * pull;
    }
    const piece = (rope.length * SLACK) / (POINTS - 1);
    for (let pass = 0; pass < PASSES; pass += 1) {
      at[0].set(rope.x, rope.y, rope.z);
      if (held) at[POINTS - 1].copy(held);
      for (let i = 0; i < POINTS - 1; i += 1) {
        const a = at[i];
        const b = at[i + 1];
        const d = scratch.b.copy(b).sub(a);
        const length = d.length() || 1e-6;
        const off = (length - piece) / length;
        // The tied end never moves, and a held end moves with the hero.
        const aFixed = i === 0;
        const bFixed = held !== null && i + 1 === POINTS - 1;
        if (aFixed && bFixed) continue;
        const share = aFixed ? 1 : bFixed ? 0 : 0.5;
        b.addScaledVector(d, -off * share);
        a.addScaledVector(d, off * (1 - share));
      }
    }
    at[0].set(rope.x, rope.y, rope.z);
    if (held) at[POINTS - 1].copy(held);
  }

  private draw(): void {
    for (const chain of this.chains.values()) {
      const { at, pieces, knot } = chain;
      for (let i = 0; i < POINTS - 1; i += 1) {
        const d = scratch.a.copy(at[i + 1]).sub(at[i]);
        const length = d.length() || 1e-6;
        scratch.q.setFromUnitVectors(UP, d.multiplyScalar(1 / length));
        scratch.b.copy(at[i]).lerp(at[i + 1], 0.5);
        scratch.m.compose(scratch.b, scratch.q, scratch.s.set(1, length * 1.04, 1));
        pieces.setMatrixAt(i, scratch.m);
      }
      pieces.instanceMatrix.needsUpdate = true;
      knot.position.copy(at[POINTS - 1]);
    }
  }

  /** How many ropes are drawn, how far each has swung by the rules, and where its end is drawn, for the browser checks. */
  info(ropes: readonly RopeState[]): { id: string; angle: number; end: { x: number; y: number; z: number } }[] {
    return ropes
      .filter((state) => this.chains.has(state.rope.id))
      .map((state) => {
        const end = this.chains.get(state.rope.id)!.at[POINTS - 1];
        return { id: state.rope.id, angle: state.angle, end: { x: end.x, y: end.y, z: end.z } };
      });
  }

  dispose(): void {
    for (const look of this.looks) look.dispose();
  }
}

/**
 * Hangs a hero from a rope, or lets them go: call once a frame after the
 * hero has been put where the rules have them, turned and animated.
 *
 * While a hero holds on, its whole body swings with the rope, a moment late
 * (a weight on a spring), and it is moved so its grip (hands, or jaw) is on
 * the rope's end. After letting go, the difference between where the grip put
 * the hero and where the rules have them fades out over a moment, so nothing
 * jumps.
 */
export class Hanger {
  /** The body's swing, and how fast it is changing. */
  private angle = 0;
  private speed = 0;
  /** How far the drawing is moved from where the rules have the hero, to keep the grip on the rope. */
  private readonly offset = new Vector3();
  private readonly grip = new Vector3();

  update(
    root: Object3D,
    hero: { grip(into: Vector3): boolean; held: number },
    swinging: RopeState | null,
    dt: number,
  ): { id: string; grip: Vector3 } | null {
    root.rotation.order = 'YXZ';
    const want = swinging ? swinging.angle : 0;
    if (dt > 0) {
      // A spring that follows the rope's swing: the body lags it and overshoots a little at each end.
      const steps = Math.ceil(dt * 240);
      const h = dt / steps;
      for (let i = 0; i < steps; i += 1) {
        this.speed += ((want - this.angle) * 70 - this.speed * 9) * h;
        this.angle += this.speed * h;
      }
    }
    const lean = this.angle * Math.max(hero.held, swinging ? 1 : 0);
    root.rotation.x = -lean;
    if (swinging) {
      const hand = handOf(swinging);
      if (hero.grip(this.grip)) {
        // Move the hero so the grip is on the rope's end, easing in over the catch.
        const target = scratch.a.set(hand.x, hand.y, hand.z).sub(this.grip);
        this.offset.lerp(target, Math.min(1, hero.held * 1.2));
      }
      root.position.add(this.offset);
      return { id: swinging.rope.id, grip: scratch.b.set(hand.x, hand.y, hand.z).clone() };
    }
    // Let go: the difference fades, and the body swings upright.
    this.offset.multiplyScalar(Math.exp(-3 * dt));
    root.position.add(this.offset);
    return null;
  }

  /** Forgets any hold, for a fresh start (a new level, or a hero sent back). */
  reset(): void {
    this.angle = 0;
    this.speed = 0;
    this.offset.set(0, 0, 0);
  }
}
