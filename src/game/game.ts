// The game rules: one hero in one level. Walk, jump, bounce, fall back to the
// last safe bank, lose a heart to whatever hurts, reach the golden leaf. No browser or drawing code, so the
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
  /** True while the move button is held: Yaarbro's roll, Caputo's pounce. */
  move?: boolean;
}

export const IDLE: Input = { moveX: 0, moveZ: 0, jump: false };

/** Things that happened during the last step, for sounds and animation. */
export type GameEvent =
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'bounce'; solidId: string }
  | { type: 'fall' }
  /** Caputo's pounce began. */
  | { type: 'pounce' }
  /** Lost a heart. `left` is how many remain. */
  | { type: 'hurt'; left: number }
  /** Went back to the last safe bank with every heart again, after losing the last one. */
  | { type: 'restored' }
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
  /** Hearts lost over the whole run. */
  heartsLost: number;
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
  /** Yaarbro is tucked into his roll. */
  rolling = false;
  /** Seconds left of Caputo's pounce. */
  pouncing = 0;
  /** How many times the hero's own move has been used: rolls begun and pounces made. */
  movesUsed = 0;
  /** Hearts left, and hearts lost over the whole run. */
  hearts: number;
  heartsLost = 0;
  /** Seconds for which nothing can hurt the hero: after a hit, and after going back to a safe bank. */
  protectedFor = 0;
  /** Seconds for which a hit has taken the controls away. */
  stunned = 0;
  /** Out of hearts: counts down to going back to the last safe bank. */
  fainting = 0;
  /** What happened during the most recent step. */
  events: GameEvent[] = [];

  private safeSpot: { x: number; y: number; z: number; id: string | null };
  private pending: GameEvent[] = [];
  private moveWasHeld = false;
  private pounceReady = true;
  private pounceRest = 0;
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
    this.hearts = level.hearts;
    const under = surfaceBelow(level, this.x, this.z, this.y, MOVE.footRadius);
    this.groundId = under ? under.id : null;
    this.safeSpot = { ...level.spawn, id: under?.safe ? under.id : null };
  }

  /** How tall the hero is right now: shorter while rolling. */
  get bodyHeight(): number {
    return this.rolling ? MOVE.rollHeight : MOVE.bodyHeight;
  }

  /** True while the hero's move would beat an enemy it touches: rolling faster than a walk, or in a pounce. */
  get striking(): boolean {
    if (this.pouncing > 0) return true;
    return this.rolling && Math.hypot(this.vx, this.vz) > MOVE.walkSpeed * 1.02;
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
      heartsLost: this.heartsLost,
      complete: this.complete,
    };
  }

  /**
   * Something at (fromX, fromZ) hurts the hero: one heart is lost, the hero is
   * knocked away from it and loses the controls for a moment, and is then
   * protected for a while. Returns false, and does nothing, while the hero is
   * protected, already out of hearts, or has finished.
   */
  hurt(fromX: number, fromZ: number): boolean {
    if (this.complete || this.protectedFor > 0 || this.hearts <= 0) return false;
    this.hearts -= 1;
    this.heartsLost += 1;
    let awayX = this.x - fromX;
    let awayZ = this.z - fromZ;
    const distance = Math.hypot(awayX, awayZ);
    if (distance < EPSILON) {
      // Hurt from right where it stands: knocked back the way it came.
      awayX = Math.sin(this.facing + Math.PI);
      awayZ = Math.cos(this.facing + Math.PI);
    } else {
      awayX /= distance;
      awayZ /= distance;
    }
    this.vx = awayX * MOVE.hurtKnockSpeed;
    this.vz = awayZ * MOVE.hurtKnockSpeed;
    this.vy = MOVE.hurtKnockUp;
    this.grounded = false;
    this.groundId = null;
    this.coyote = 0;
    this.buffer = 0;
    this.canCutJump = false;
    this.stunned = MOVE.hurtLock;
    this.rolling = false;
    this.pouncing = 0;
    this.protectedFor = MOVE.hurtProtection * this.level.protection;
    if (this.hearts <= 0) this.fainting = MOVE.faintPause;
    this.pending.push({ type: 'hurt', left: this.hearts });
    return true;
  }

  /** Puts the hero on the last safe bank, standing still. */
  private toSafeSpot(): void {
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
    this.stunned = 0;
    this.rolling = false;
    this.pouncing = 0;
    // No hearts left: start again from here with all of them, protected for a moment.
    if (this.hearts <= 0) {
      this.hearts = this.level.hearts;
      this.fainting = 0;
      this.protectedFor = MOVE.returnProtection * this.level.protection;
      this.events.push({ type: 'restored' });
    }
  }

  /** Advances the game by one fixed step (STEP seconds). */
  step(input: Input): void {
    const dt = STEP;
    const { level } = this;
    // A hit between steps (see `hurt`) is reported with this step's events.
    this.events = this.pending;
    this.pending = [];
    if (!this.complete) this.seconds += dt;

    // After the leaf, while standing still after a fall, and for a moment
    // after being hurt, the buttons do nothing.
    const frozen = this.complete || this.returning > 0 || this.stunned > 0 || this.fainting > 0;
    this.returning = Math.max(0, this.returning - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    this.protectedFor = Math.max(0, this.protectedFor - dt);
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

    // The move button: Yaarbro rolls while it is held, Caputo pounces when it is pressed.
    const moveHeld = frozen ? false : Boolean(input.move);
    const movePressed = moveHeld && !this.moveWasHeld;
    this.moveWasHeld = Boolean(input.move);
    const wasRolling = this.rolling;
    this.rolling = this.hero === 'Yaarbro' && moveHeld;
    if (this.rolling && !wasRolling) this.movesUsed += 1;
    this.pounceRest = Math.max(0, this.pounceRest - dt);
    if (this.grounded) this.pounceReady = true;
    const stickLength = Math.hypot(moveX, moveZ);
    if (this.hero === 'Caputo' && movePressed && this.pounceReady && this.pounceRest <= 0) {
      // The way the stick points, or the way he faces.
      const aimX = stickLength > 0.01 ? moveX / stickLength : Math.sin(this.facing);
      const aimZ = stickLength > 0.01 ? moveZ / stickLength : Math.cos(this.facing);
      this.vx = aimX * MOVE.pounceSpeed;
      this.vz = aimZ * MOVE.pounceSpeed;
      this.vy = this.grounded ? MOVE.pounceHop : 0;
      this.grounded = false;
      this.groundId = null;
      this.coyote = 0;
      this.canCutJump = false;
      this.pouncing = MOVE.pounceTime;
      this.pounceRest = MOVE.pounceRest;
      this.pounceReady = false;
      this.movesUsed += 1;
      this.events.push({ type: 'pounce' });
    }

    const pouncing = this.pouncing > 0;
    if (pouncing) {
      // The burst holds its speed and direction, whatever the stick does.
      this.pouncing = Math.max(0, this.pouncing - dt);
      if (this.pouncing === 0) {
        const speed = Math.hypot(this.vx, this.vz);
        if (speed > MOVE.pounceExitSpeed) {
          this.vx *= MOVE.pounceExitSpeed / speed;
          this.vz *= MOVE.pounceExitSpeed / speed;
        }
        this.vy = Math.min(this.vy, MOVE.pounceExitRise);
      }
    } else {
      // Speed up or slow down toward the speed the stick asks for.
      const speed = Math.hypot(this.vx, this.vz);
      let wantX = moveX * MOVE.walkSpeed;
      let wantZ = moveZ * MOVE.walkSpeed;
      let accel: number = this.grounded ? MOVE.groundAccel : MOVE.airAccel;
      if (this.rolling) {
        // A roll heads the way the stick points; with the stick let go it
        // keeps going the way he is moving, or the way he faces.
        let aimX = Math.sin(this.facing);
        let aimZ = Math.cos(this.facing);
        if (stickLength > 0.01) {
          aimX = moveX / stickLength;
          aimZ = moveZ / stickLength;
        } else if (speed > 0.5) {
          aimX = this.vx / speed;
          aimZ = this.vz / speed;
        }
        wantX = aimX * MOVE.rollSpeed;
        wantZ = aimZ * MOVE.rollSpeed;
        // Up to walking speed he gets going as fast as ever; the extra comes slower.
        if (speed >= MOVE.walkSpeed) accel = this.grounded ? MOVE.rollAccel : MOVE.rollAirAccel;
      }
      const change = accel * dt;
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

    // Nothing pulls a pounce down while the burst lasts.
    if (!pouncing) this.vy = Math.max(this.vy - MOVE.gravity * dt, -MOVE.maxFallSpeed);

    // Move sideways, then get pushed back out of anything solid at body height.
    let nextX = this.x + this.vx * dt;
    let nextZ = this.z + this.vz * dt;
    for (const s of level.solids) {
      const feetWellBelowTop = this.y < s.top - level.ledgeHelp - EPSILON;
      const headAboveUnderside = this.y + this.bodyHeight > s.bottom + EPSILON;
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
        const headWasBelow = previousY + this.bodyHeight <= s.bottom + EPSILON;
        const headNowInside = nextY + this.bodyHeight > s.bottom;
        if (headWasBelow && headNowInside && touchesFromAbove(s, nextX, nextZ, MOVE.bodyRadius)) {
          nextY = s.bottom - this.bodyHeight;
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
    const middleY = this.y + this.bodyHeight / 2;
    const reach = leaf.radius + MOVE.bodyRadius;
    const distanceSquared = (this.x - leaf.x) ** 2 + (middleY - leaf.y) ** 2 + (this.z - leaf.z) ** 2;
    if (distanceSquared <= reach * reach) {
      this.complete = true;
      this.events.push({ type: 'goal' });
      return;
    }

    // A fall: back to the last safe bank, with the hearts the hero had.
    if (this.y < level.fallY) {
      this.falls += 1;
      this.events.push({ type: 'fall' });
      this.toSafeSpot();
      return;
    }

    // Out of hearts: a moment down, then back to the last safe bank with all of them.
    if (this.fainting > 0) {
      this.fainting = Math.max(0, this.fainting - dt);
      if (this.fainting === 0) this.toSafeSpot();
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
