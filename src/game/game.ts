// The game rules: one hero in one level. Walk, jump, bounce, fall back to the
// last safe bank, reach the golden leaf. No browser or drawing code, so the
// tests (and later a server, for two-device play) can run it as is.

import type { Difficulty } from './difficulty';
import { MOVE, STEP, type HeroName } from './hero';
import { pushOutside, surfaceBelow, touchesFromAbove, type Level, type Solid } from './level';

/** What the player is asking for during one step. */
export interface Input {
  /** Left (-1) to right (+1). */
  moveX: number;
  /** Away from the camera (-1) to toward it (+1). */
  moveZ: number;
  /** True while the Jump button is held. */
  jump: boolean;
}

export const IDLE: Input = { moveX: 0, moveZ: 0, jump: false };

/** Things that happened during the last step, for sounds and animation. */
export type GameEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'bounce'; solidId: string }
  | { type: 'fall' }
  | { type: 'safe'; solidId: string }
  | { type: 'goal' };

/** The record of a run, shown on the end card. */
export interface Summary {
  level: string;
  difficulty: Difficulty;
  hero: HeroName;
  /** Play time in seconds. Paused time is never counted. */
  seconds: number;
  falls: number;
  complete: boolean;
}

const EPSILON = 1e-4;

export class Game {
  readonly level: Level;
  readonly difficulty: Difficulty;
  readonly hero: HeroName;

  /** Position of the hero's feet. */
  x: number;
  y: number;
  z: number;
  /** Speed along each direction. */
  vx = 0;
  vy = 0;
  vz = 0;
  /** Which way the hero faces, as an angle seen from above (0 faces the camera). */
  facing = Math.PI;
  grounded = true;
  /** Id of the solid under the hero's feet, when standing. */
  groundId: string | null = null;
  /** Seconds played, falls so far, and whether the leaf has been reached. */
  seconds = 0;
  falls = 0;
  complete = false;
  /** Counts down while the hero stands still after a fall. */
  returning = 0;
  /** What happened during the most recent step. */
  events: GameEvent[] = [];

  private safeSpot: { x: number; y: number; z: number; id: string | null };
  private coyote = 0;
  private buffer = 0;
  private jumpWasHeld = false;
  private canCutJump = false;

  constructor(level: Level, difficulty: Difficulty, hero: HeroName) {
    this.level = level;
    this.difficulty = difficulty;
    this.hero = hero;
    this.x = level.spawn.x;
    this.y = level.spawn.y;
    this.z = level.spawn.z;
    const under = surfaceBelow(level, this.x, this.z, this.y, MOVE.footRadius);
    this.groundId = under ? under.id : null;
    this.safeSpot = { ...level.spawn, id: under?.safe ? under.id : null };
  }

  /** Where a fall would return the hero right now. */
  get safe(): { x: number; y: number; z: number; id: string | null } {
    return this.safeSpot;
  }

  summary(): Summary {
    return {
      level: this.level.name,
      difficulty: this.difficulty,
      hero: this.hero,
      seconds: this.seconds,
      falls: this.falls,
      complete: this.complete,
    };
  }

  /** Advances the game by one fixed step (STEP seconds). */
  step(input: Input): void {
    const dt = STEP;
    const { level } = this;
    this.events = [];
    if (!this.complete) this.seconds += dt;

    // After the leaf, or while standing still after a fall, the buttons do nothing.
    const frozen = this.complete || this.returning > 0;
    this.returning = Math.max(0, this.returning - dt);
    let moveX = frozen ? 0 : input.moveX;
    let moveZ = frozen ? 0 : input.moveZ;
    const jumpHeld = frozen ? false : input.jump;
    const length = Math.hypot(moveX, moveZ);
    if (length > 1) {
      moveX /= length;
      moveZ /= length;
    }

    // A fresh press of Jump is remembered for a moment, so pressing just
    // before landing still jumps.
    if (jumpHeld && !this.jumpWasHeld) this.buffer = MOVE.jumpBuffer;
    this.jumpWasHeld = input.jump;

    // Speed up or slow down toward the speed the stick asks for.
    const change = (this.grounded ? MOVE.groundAccel : MOVE.airAccel) * dt;
    const wantX = moveX * MOVE.walkSpeed;
    const wantZ = moveZ * MOVE.walkSpeed;
    const gapX = wantX - this.vx;
    const gapZ = wantZ - this.vz;
    const gap = Math.hypot(gapX, gapZ);
    if (gap <= change) {
      this.vx = wantX;
      this.vz = wantZ;
    } else {
      this.vx += (gapX / gap) * change;
      this.vz += (gapZ / gap) * change;
    }
    if (Math.hypot(this.vx, this.vz) > 0.5) this.facing = Math.atan2(this.vx, this.vz);

    // Jump: from the ground, or within a moment of walking off an edge.
    if (this.grounded) this.coyote = level.coyoteTime;
    if (this.buffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vy = MOVE.jumpSpeed;
      this.grounded = false;
      this.groundId = null;
      this.coyote = 0;
      this.buffer = 0;
      this.canCutJump = true;
      this.events.push({ type: 'jump' });
    }
    this.coyote = Math.max(0, this.coyote - dt);
    this.buffer = Math.max(0, this.buffer - dt);

    // Letting go of Jump on the way up makes a shorter hop.
    if (this.canCutJump && !jumpHeld && this.vy > MOVE.jumpCutSpeed) {
      this.vy = MOVE.jumpCutSpeed;
      this.canCutJump = false;
    }
    if (this.vy <= 0) this.canCutJump = false;

    this.vy = Math.max(this.vy - MOVE.gravity * dt, -MOVE.maxFallSpeed);

    // Move sideways, then get pushed back out of anything solid at body height.
    let nextX = this.x + this.vx * dt;
    let nextZ = this.z + this.vz * dt;
    for (const s of level.solids) {
      const feetWellBelowTop = this.y < s.top - level.ledgeHelp - EPSILON;
      const headAboveUnderside = this.y + MOVE.bodyHeight > s.bottom + EPSILON;
      if (!feetWellBelowTop || !headAboveUnderside) continue;
      const out = pushOutside(s, nextX, nextZ, MOVE.bodyRadius);
      if (out) {
        nextX = out.x;
        nextZ = out.z;
      }
    }

    // Move up or down.
    const wasGrounded = this.grounded;
    const previousY = this.y;
    let nextY = this.y + this.vy * dt;
    this.grounded = false;
    this.groundId = null;
    if (this.vy <= 0) {
      const ground = this.landingSurface(nextX, nextZ, previousY, nextY);
      if (ground) {
        nextY = ground.top;
        if (ground.bounce) {
          this.vy = ground.bounce;
          this.coyote = 0;
          this.canCutJump = false;
          this.events.push({ type: 'bounce', solidId: ground.id });
        } else {
          this.vy = 0;
          this.grounded = true;
          this.groundId = ground.id;
          if (!wasGrounded) this.events.push({ type: 'land' });
          if (ground.safe && this.safeSpot.id !== ground.id) {
            this.safeSpot = { x: ground.x, y: ground.top, z: ground.z, id: ground.id };
            this.events.push({ type: 'safe', solidId: ground.id });
          }
        }
      }
    } else {
      // Rising: stop at the underside of anything overhead.
      for (const s of level.solids) {
        const headWasBelow = previousY + MOVE.bodyHeight <= s.bottom + EPSILON;
        const headNowInside = nextY + MOVE.bodyHeight > s.bottom;
        if (headWasBelow && headNowInside && touchesFromAbove(s, nextX, nextZ, MOVE.bodyRadius)) {
          nextY = s.bottom - MOVE.bodyHeight;
          this.vy = 0;
        }
      }
    }
    this.x = nextX;
    this.y = nextY;
    this.z = nextZ;

    if (this.complete) return;

    // The goal: touch the golden leaf.
    const { leaf } = level;
    const middleY = this.y + MOVE.bodyHeight / 2;
    const reach = leaf.radius + MOVE.bodyRadius;
    const distanceSquared = (this.x - leaf.x) ** 2 + (middleY - leaf.y) ** 2 + (this.z - leaf.z) ** 2;
    if (distanceSquared <= reach * reach) {
      this.complete = true;
      this.events.push({ type: 'goal' });
      return;
    }

    // A fall: back to the last safe bank.
    if (this.y < level.fallY) {
      this.falls += 1;
      this.x = this.safeSpot.x;
      this.y = this.safeSpot.y;
      this.z = this.safeSpot.z;
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      this.grounded = true;
      this.groundId = this.safeSpot.id;
      this.returning = MOVE.returnPause;
      this.buffer = 0;
      this.coyote = 0;
      this.events.push({ type: 'fall' });
    }
  }

  /**
   * The surface the hero's feet come to rest on when moving from previousY
   * down to nextY: the highest one they cross, or are within ledge help of.
   */
  private landingSurface(x: number, z: number, previousY: number, nextY: number): Solid | null {
    let best: Solid | null = null;
    for (const s of this.level.solids) {
      if (s.top < nextY - EPSILON) continue;
      if (s.top > previousY + this.level.ledgeHelp + EPSILON) continue;
      if (!touchesFromAbove(s, x, z, MOVE.footRadius)) continue;
      if (!best || s.top > best.top) best = s;
    }
    return best;
  }
}
