// The game rules: one hero in one level. Walk, jump, bounce, fall back to the
// last safe bank, lose a heart to whatever hurts, reach the golden leaf. No browser or drawing code, so the
// tests (and later a server, for two-device play) can run it as is.

import { BOSS, bossFighting, newBoss, resetBoss, stepBoss, type Boss, type BossAttack, type BossPhase } from './boss';
import type { Difficulty } from './difficulty';
import { ENEMY, callSidekick, dismissSidekick, newEnemy, sendHome, stepEnemy, type Enemy, type EnemyPhase, type EnemyTuning } from './enemy';
import { MOVE, STEP, knockSpeed, type HeroName } from './hero';
import { pushOutside, surfaceBelow, topAt, touchesFromAbove, type Level, type Solid } from './level';
import { ownPieces, resetPieces, stepPieces, type PieceEvent } from './moving';
import { SWIM, climbOut, inWater, waterAt, type Water } from './swim';

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
  /** An enemy began something: woke, warned, attacked, dodged, rested, or was beaten. */
  | { type: 'enemy'; id: string; kind: Enemy['kind']; phase: EnemyPhase }
  /** The hero's move, or a landing, struck an enemy. `left` is how many more strikes it takes. */
  | { type: 'strike'; id: string; kind: Enemy['kind']; how: 'roll' | 'pounce' | 'stomp'; left: number }
  /** The hero was sent back to a safe bank, and an enemy it had damaged is at full health again. */
  | { type: 'healed'; id: string; kind: Enemy['kind'] }
  /**
   * The boss: the fight began (`begin`), it began something (`phase`, with the attack it belongs to),
   * a hit landed (`hit`, with the health it has left), a landing bounced off its guard (`blocked`),
   * it moved to a new stage (`stage`), it called its sidekicks (`call`), it was beaten (`beaten`), or
   * the hero was sent back and the fight starts over (`reset`; `healed` when it had been damaged).
   */
  | { type: 'boss'; id: string; what: 'begin' | 'blocked' | 'call' | 'beaten' }
  | { type: 'boss'; id: string; what: 'phase'; phase: BossPhase; attack: BossAttack | null }
  | { type: 'boss'; id: string; what: 'hit'; how: 'roll' | 'pounce' | 'stomp'; left: number }
  | { type: 'boss'; id: string; what: 'stage'; stage: number }
  | { type: 'boss'; id: string; what: 'reset'; healed: boolean }
  /** Lost a heart. `left` is how many remain. */
  | { type: 'hurt'; left: number }
  /** Went back to the last safe bank with every heart again, after losing the last one. */
  | { type: 'restored' }
  | { type: 'safe'; solidId: string }
  /** Went into deep water, this fast (metres a second, downward). */
  | { type: 'splash'; waterId: string; speed: number }
  /** The swimmer's head went under, or came back up. */
  | { type: 'dive' }
  | { type: 'surface' }
  /** Began climbing out of the water onto a solid. */
  | { type: 'climb'; solidId: string }
  /** Ran out of breath underwater: a moment down, then back to the last safe bank. */
  | { type: 'breathless' }
  /** A moving piece (see moving.ts) began its tell, began to move, fell away or came back. */
  | ({ type: 'piece' } & PieceEvent)
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
  /** Enemies beaten. */
  beaten: number;
  complete: boolean;
}

const EPSILON = 1e-4;
/** How far down a hero walking on a tilted surface keeps to it in one step. */
const STICK_DOWN = 0.3;

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
  /** The level's enemies, as they are now. */
  readonly enemies: Enemy[];
  /** Enemies beaten so far. */
  beaten = 0;
  /** The level's boss, as it is now, or null when the level has none. */
  readonly boss: Boss | null;
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
  /** In deep water (see swim.ts), and which pool. */
  swimming = false;
  waterId: string | null = null;
  /** Swimming with the head underwater. */
  under = false;
  /** Seconds of breath left underwater. Infinite where the level's breath never runs out. */
  breath: number;
  /** Seconds left of climbing out of the water, and where from and to. */
  climbing = 0;
  private climb: { fromX: number; fromY: number; fromZ: number; solidId: string; x: number; y: number; z: number } | null = null;
  /** Ran out of breath: going back to the last safe bank counts as running out of hearts. */
  private breathOut = false;

  private safeSpot: { x: number; y: number; z: number; id: string | null };
  private pending: GameEvent[] = [];
  private readonly tuning: EnemyTuning;
  private moveWasHeld = false;
  /** Thrown by a hit and still in the air: the throw carries until the hero lands or steers. */
  private knocked = false;
  private pounceReady = true;
  private pounceRest = 0;
  private coyote = 0;
  private buffer = 0;
  private jumpWasHeld = false;
  private canCutJump = false;

  constructor(level: Level, difficulty: Difficulty, hero: HeroName) {
    // Pieces that move are this game's own, so two games of one level never share them.
    this.level = level.solids.some((s) => s.motion) ? { ...level, solids: ownPieces(level.solids) } : level;
    level = this.level;
    this.difficulty = difficulty;
    this.hero = hero;
    this.x = level.spawn.x;
    this.y = level.spawn.y;
    this.z = level.spawn.z;
    this.hearts = level.hearts;
    this.breath = this.maxBreath;
    this.tuning = level.enemyTuning ?? { warning: 1, speed: 1, rest: 1 };
    this.enemies = (level.enemies ?? []).map((spot) => newEnemy(spot, this.tuning));
    this.boss = level.boss ? newBoss(level.boss) : null;
    const under = surfaceBelow(level, this.x, this.z, this.y, MOVE.footRadius);
    this.groundId = under ? under.id : null;
    this.safeSpot = { ...level.spawn, id: under?.safe ? under.id : null };
  }

  /** How tall the hero is right now: shorter while rolling, and while swimming underwater. */
  get bodyHeight(): number {
    if (this.swimming && this.under) return SWIM.underHeight;
    return this.rolling ? MOVE.rollHeight : MOVE.bodyHeight;
  }

  /** Seconds of breath when full: the level's, or never running out. */
  get maxBreath(): number {
    return this.level.breath ?? Infinity;
  }

  /** The pool the hero is swimming in, if any. */
  get water(): Water | null {
    return this.swimming ? this.level.water?.find((w) => w.id === this.waterId) ?? null : null;
  }

  /** True while the hero's move would beat an enemy it touches: rolling faster than a walk, or in a pounce. */
  get striking(): boolean {
    if (this.pouncing > 0) return true;
    return this.rolling && Math.hypot(this.vx, this.vz) > MOVE.walkSpeed * 1.02;
  }

  /** True when the goal can be taken: always, but for a level whose boss is not yet beaten. */
  get goalOpen(): boolean {
    return !this.boss || this.boss.phase === 'defeated';
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
      beaten: this.beaten,
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
    const thrown = knockSpeed(this.level.knockback);
    this.vx = awayX * thrown;
    this.vz = awayZ * thrown;
    // In the water a hit pushes the swimmer away along the surface, not up out of it.
    this.vy = this.swimming ? 0 : MOVE.hurtKnockUp;
    this.grounded = false;
    this.groundId = null;
    this.coyote = 0;
    this.buffer = 0;
    this.canCutJump = false;
    this.stunned = MOVE.hurtLock;
    this.knocked = true;
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
    this.swimming = false;
    this.waterId = null;
    this.under = false;
    this.breath = this.maxBreath;
    this.climbing = 0;
    this.climb = null;
    // Tipping logs and crumbling moss are as they were at the start.
    resetPieces(this.level.solids);
    // The older player's rule: every enemy that is not beaten starts over at
    // full health. Strikes landed before the hero was sent back are undone.
    for (const enemy of this.enemies) {
      if (sendHome(enemy)) this.events.push({ type: 'healed', id: enemy.spot.id, kind: enemy.kind });
    }
    // The same rule for a boss: home, full health, and the fight starts over.
    if (this.boss && bossFighting(this.boss)) {
      const healed = resetBoss(this.boss);
      this.events.push({ type: 'boss', id: this.boss.spot.id, what: 'reset', healed });
    }
    // No hearts left: start again from here with all of them, protected for a moment.
    if (this.hearts <= 0 || this.breathOut) {
      this.breathOut = false;
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

    // Pieces that move go first, and carry a hero standing on one.
    const standingOn = this.grounded && this.groundId ? level.solids.find((s) => s.id === this.groundId) : undefined;
    const forward = standingOn ? standingOn.z - this.z : 0;
    for (const event of stepPieces(level.solids, standingOn ? standingOn.id : null, forward, dt)) this.events.push({ type: 'piece', ...event });
    if (standingOn?.piece) {
      if (standingOn.gone) {
        this.grounded = false;
        this.groundId = null;
      } else this.y = topAt(standingOn, this.x, this.z);
    }

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

    const previousY = this.y;
    if (this.swimming || this.climbing > 0) {
      this.swim(moveX, moveZ, jumpHeld, frozen ? false : Boolean(input.move), dt);
      this.moveWasHeld = Boolean(input.move);
    } else {
    // The move button: Yaarbro rolls while it is held, Caputo pounces when it is pressed.
    const moveHeld = frozen ? false : Boolean(input.move);
    const movePressed = moveHeld && !this.moveWasHeld;
    this.moveWasHeld = Boolean(input.move);
    const wasRolling = this.rolling;
    this.rolling = this.hero === 'Yaarbro' && moveHeld;
    if (this.rolling && !wasRolling) this.movesUsed += 1;
    this.pounceRest = Math.max(0, this.pounceRest - dt);
    if (this.grounded) {
      this.pounceReady = true;
      this.knocked = false;
    }
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
    } else if (this.knocked && !this.grounded && stickLength < 0.01) {
      // Thrown by a hit, with the stick let go: nothing slows the throw until
      // the hero lands, so it carries clear of whatever did the hurting.
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
      if (s.gone) continue;
      // A tilted top is measured at the nearest point of it.
      const top = s.slopeZ ? topAt(s, nextX, nextZ) : s.top;
      const feetWellBelowTop = this.y < top - level.ledgeHelp - EPSILON;
      const headAboveUnderside = this.y + this.bodyHeight > s.bottom + (top - s.top) + EPSILON;
      if (!feetWellBelowTop || !headAboveUnderside) continue;
      const out = pushOutside(s, nextX, nextZ, MOVE.bodyRadius);
      if (out) {
        nextX = out.x;
        nextZ = out.z;
      }
    }

    // Move up or down.
    const wasGrounded = this.grounded;
    let nextY = this.y + this.vy * dt;
    this.grounded = false;
    this.groundId = null;
    if (this.vy <= 0) {
      const ground = this.landingSurface(nextX, nextZ, previousY, nextY, wasGrounded ? standingOn?.id ?? null : null);
      if (ground) {
        nextY = topAt(ground, nextX, nextZ);
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
          this.reachSafe(ground);
        }
      }
    } else {
      // Rising: stop at the underside of anything overhead.
      for (const s of level.solids) {
        if (s.gone) continue;
        const bottom = s.bottom + (topAt(s, nextX, nextZ) - s.top);
        const headWasBelow = previousY + this.bodyHeight <= bottom + EPSILON;
        const headNowInside = nextY + this.bodyHeight > bottom;
        if (headWasBelow && headNowInside && touchesFromAbove(s, nextX, nextZ, MOVE.bodyRadius)) {
          nextY = bottom - this.bodyHeight;
          this.vy = 0;
        }
      }
    }
    this.x = nextX;
    this.y = nextY;
    this.z = nextZ;
    this.enterWater();
    }

    if (this.complete) return;

    // The enemies move, and anything they touch is settled.
    for (const enemy of this.enemies) {
      const canBeHurt = this.protectedFor <= 0 && this.hearts > 0 && !this.under;
      const outcome = stepEnemy(enemy, this, MOVE.bodyRadius, previousY, this.tuning, canBeHurt, dt);
      for (const phase of outcome.entered) this.events.push({ type: 'enemy', id: enemy.spot.id, kind: enemy.kind, phase });
      if (outcome.struck) {
        if (enemy.phase === 'defeated') this.beaten += 1;
        this.events.push({ type: 'strike', id: enemy.spot.id, kind: enemy.kind, how: outcome.struck, left: enemy.hits });
        // A pounce or a landing bounces the hero up off it, ready to pounce again.
        if (outcome.struck !== 'roll') {
          if (this.pouncing > 0) {
            const speed = Math.hypot(this.vx, this.vz);
            if (speed > MOVE.pounceExitSpeed) {
              this.vx *= MOVE.pounceExitSpeed / speed;
              this.vz *= MOVE.pounceExitSpeed / speed;
            }
          }
          this.vy = ENEMY.rebound;
          this.pouncing = 0;
          this.pounceReady = true;
          this.pounceRest = 0.12;
          this.grounded = false;
          this.groundId = null;
          this.coyote = 0;
          this.canCutJump = false;
        }
        this.protectedFor = Math.max(this.protectedFor, ENEMY.strikeProtection);
      } else if (outcome.hurt && this.hurt(enemy.x, enemy.z)) {
        // `hurt` reports itself next step; say it now too, so nothing waits a step.
        this.events.push(...this.pending);
        this.pending = [];
      }
    }

    // The boss moves, and anything it touches is settled.
    const { boss } = this;
    if (boss) {
      const id = boss.spot.id;
      const sidekicks = this.enemies.filter((enemy) => enemy.spot.sidekickOf === id);
      const canBeHurt = this.protectedFor <= 0 && this.hearts > 0 && !this.under;
      const outcome = stepBoss(boss, this, MOVE.bodyRadius, previousY, canBeHurt, level.ledgeHelp, sidekicks, dt);
      if (outcome.began) this.events.push({ type: 'boss', id, what: 'begin' });
      for (const phase of outcome.entered) this.events.push({ type: 'boss', id, what: 'phase', phase, attack: boss.attack });
      if (outcome.called) {
        sidekicks.forEach((sidekick, i) => callSidekick(sidekick, i * 0.7));
        this.events.push({ type: 'boss', id, what: 'call' });
      }
      if (outcome.struck || outcome.blocked) {
        if (outcome.struck) this.events.push({ type: 'boss', id, what: 'hit', how: outcome.struck, left: boss.health });
        else this.events.push({ type: 'boss', id, what: 'blocked' });
        // A pounce or a landing bounces the hero up off it, ready to pounce again.
        if (outcome.struck !== 'roll') {
          if (this.pouncing > 0) {
            const speed = Math.hypot(this.vx, this.vz);
            if (speed > MOVE.pounceExitSpeed) {
              this.vx *= MOVE.pounceExitSpeed / speed;
              this.vz *= MOVE.pounceExitSpeed / speed;
            }
          }
          this.vy = BOSS.rebound;
          if (outcome.blocked) {
            // Bounced off its guard: thrown clear of it, so the hero does not come straight back down on its head.
            const awayX = this.x - boss.x;
            const awayZ = this.z - boss.z;
            const away = Math.hypot(awayX, awayZ);
            const out = away > 0.05 ? { x: awayX / away, z: awayZ / away } : { x: Math.sin(this.facing + Math.PI), z: Math.cos(this.facing + Math.PI) };
            this.vx = out.x * BOSS.bounceOff;
            this.vz = out.z * BOSS.bounceOff;
            this.knocked = true;
          }
          this.pouncing = 0;
          this.pounceReady = true;
          this.pounceRest = 0.12;
          this.grounded = false;
          this.groundId = null;
          this.coyote = 0;
          this.canCutJump = false;
        }
        this.protectedFor = Math.max(this.protectedFor, BOSS.strikeProtection);
        if (boss.phase === 'defeated') {
          this.beaten += 1;
          this.protectedFor = Math.max(this.protectedFor, BOSS.victoryProtection);
          for (const sidekick of sidekicks) dismissSidekick(sidekick);
          this.events.push({ type: 'boss', id, what: 'beaten' });
        }
      } else if (outcome.hurt && this.hurt(outcome.hurt.x, outcome.hurt.z)) {
        this.events.push(...this.pending);
        this.pending = [];
      }
      if (outcome.stage !== undefined) this.events.push({ type: 'boss', id, what: 'stage', stage: outcome.stage });
    }

    // The goal: touch the golden leaf. A level with a boss keeps it out of reach until the boss is beaten.
    const { leaf } = level;
    const middleY = this.y + this.bodyHeight / 2;
    const reach = leaf.radius + MOVE.bodyRadius;
    const distanceSquared = (this.x - leaf.x) ** 2 + (middleY - leaf.y) ** 2 + (this.z - leaf.z) ** 2;
    if (distanceSquared <= reach * reach && this.goalOpen) {
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

  /** Standing on a safe solid makes it the place a fall returns the hero to. */
  private reachSafe(ground: Solid): void {
    if (ground.safe && this.safeSpot.id !== ground.id) {
      this.safeSpot = { x: ground.safeAt?.x ?? ground.x, y: ground.top, z: ground.safeAt?.z ?? ground.z, id: ground.id };
      this.events.push({ type: 'safe', solidId: ground.id });
    }
  }

  /** Dropped into deep water: from now on the hero swims. */
  private enterWater(): void {
    if (this.grounded) return;
    const water = waterAt(this.level.water, this.x, this.z);
    if (!water || !inWater(water, this.y)) return;
    this.swimming = true;
    this.waterId = water.id;
    this.rolling = false;
    this.pouncing = 0;
    this.knocked = false;
    this.canCutJump = false;
    this.coyote = 0;
    this.events.push({ type: 'splash', waterId: water.id, speed: Math.max(0, -this.vy) });
  }

  /** One step in the water: swimming, diving, coming up, breath, and climbing out (see swim.ts). */
  private swim(moveX: number, moveZ: number, jumpHeld: boolean, moveHeld: boolean, dt: number): void {
    // Climbing out: up over the edge, then onto it, with the controls taken for the moment it lasts.
    if (this.climbing > 0 && this.climb) {
      const c = this.climb;
      this.climbing = Math.max(0, this.climbing - dt);
      const t = 1 - this.climbing / SWIM.climbTime;
      // Up first, then across.
      const up = Math.min(1, t / 0.6);
      const across = Math.max(0, (t - 0.35) / 0.65);
      this.x = c.fromX + (c.x - c.fromX) * across;
      this.z = c.fromZ + (c.z - c.fromZ) * across;
      this.y = c.fromY + (c.y + 0.25 * Math.sin(Math.PI * Math.min(1, t)) - c.fromY) * up * (2 - up);
      this.vx = 0;
      this.vy = 0;
      this.vz = 0;
      if (this.climbing === 0) {
        const solid = this.level.solids.find((s) => s.id === c.solidId);
        this.x = c.x;
        this.z = c.z;
        this.y = solid ? topAt(solid, c.x, c.z) : c.y;
        this.climb = null;
        this.grounded = true;
        this.groundId = c.solidId;
        this.events.push({ type: 'land' });
        if (solid) this.reachSafe(solid);
      }
      return;
    }
    const water = this.water;
    if (!water) {
      this.swimming = false;
      this.waterId = null;
      this.under = false;
      return;
    }
    const floatY = water.surface - SWIM.float;
    const stick = Math.hypot(moveX, moveZ);

    // Climb out: Jump at the surface, next to something low enough to reach. Holding it while swimming up to the edge does too.
    if (!this.under && (this.buffer > 0 || jumpHeld)) {
      const aim = stick > 0.2 ? { x: moveX / stick, z: moveZ / stick } : null;
      const edge = climbOut(this.level.solids, water, this.x, this.z, aim);
      if (edge) {
        this.buffer = 0;
        this.startClimb(edge.solid, edge.x, edge.z);
        return;
      }
    }
    this.buffer = 0;

    // Across: the way the stick points, slower than on land.
    const top = this.under ? SWIM.underSpeed : SWIM.surfaceSpeed;
    const wantX = moveX * top;
    const wantZ = moveZ * top;
    const change = SWIM.accel * dt;
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

    // Up and down: the move button dives, Jump swims up, and with neither the swimmer drifts up to float.
    const atSurface = this.y >= floatY - 0.05;
    let wantVy: number;
    if (moveHeld) wantVy = -SWIM.diveSpeed;
    else if (atSurface) wantVy = Math.max(-2, Math.min(3, (floatY - this.y) * 6));
    else wantVy = jumpHeld ? SWIM.upSpeed : SWIM.driftUp;
    // Water is thick: speed comes to what is asked smoothly, and a plunge from a height is slowed hard.
    const rate = this.vy < wantVy - 4 ? SWIM.plungeDrag : SWIM.verticalAccel / 2;
    this.vy = wantVy + (this.vy - wantVy) * Math.exp(-rate * dt);

    let nextX = this.x + this.vx * dt;
    let nextZ = this.z + this.vz * dt;
    let nextY = this.y + this.vy * dt;
    // Never up out of the water: the swimmer floats at the surface.
    if (nextY > floatY && this.vy > 0) {
      nextY = floatY;
      this.vy = 0;
    }
    if (nextY < water.floor + SWIM.aboveFloor) {
      nextY = water.floor + SWIM.aboveFloor;
      this.vy = Math.max(0, this.vy);
    }
    // The sides of the pool hold the swimmer in.
    nextX = Math.max(water.minX + SWIM.radius, Math.min(water.maxX - SWIM.radius, nextX));
    nextZ = Math.max(water.minZ + SWIM.radius, Math.min(water.maxZ - SWIM.radius, nextZ));

    // Bumping into solids: pushed out sideways from anything at body height, stopped by anything above or below.
    const height = nextY < floatY - 0.3 ? SWIM.underHeight : MOVE.bodyHeight;
    for (const s of this.level.solids) {
      if (s.gone) continue;
      const sTop = topAt(s, nextX, nextZ);
      const sBottom = s.bottom + (sTop - s.top);
      if (!touchesFromAbove(s, nextX, nextZ, SWIM.radius)) continue;
      const overlaps = nextY < sTop - EPSILON && nextY + height > sBottom + EPSILON;
      if (!overlaps) continue;
      const wasBelow = this.y + height <= sBottom + 0.05;
      const wasAbove = this.y >= sTop - 0.05;
      if (wasBelow) {
        nextY = sBottom - height;
        this.vy = Math.min(0, this.vy);
      } else if (wasAbove) {
        nextY = sTop;
        this.vy = Math.max(0, this.vy);
      } else {
        // A shore no higher than the water: swimming into it walks the hero out.
        if (sTop - water.surface <= SWIM.shoreHeight && !s.bounce && stick > 0.2 && !this.under) {
          const edge = climbOut([s], water, this.x, this.z, null, SWIM.shoreHeight);
          if (edge) {
            this.startClimb(s, edge.x, edge.z);
            return;
          }
        }
        const out = pushOutside(s, nextX, nextZ, SWIM.radius);
        if (out) {
          nextX = out.x;
          nextZ = out.z;
        }
      }
    }
    this.x = nextX;
    this.y = nextY;
    this.z = nextZ;

    // Head under, or back up.
    const under = this.y < floatY - 0.3;
    if (under && !this.under) this.events.push({ type: 'dive' });
    if (!under && this.under) this.events.push({ type: 'surface' });
    this.under = under;

    // Breath: held underwater, filled again at the surface.
    if (this.under) {
      this.breath = Math.max(0, this.breath - dt);
      if (this.breath === 0 && this.fainting === 0 && !this.complete) {
        this.breathOut = true;
        this.fainting = MOVE.faintPause;
        this.events.push({ type: 'breathless' });
      }
    } else this.breath = Math.min(this.maxBreath, this.breath + SWIM.refill * dt);
  }

  private startClimb(solid: Solid, x: number, z: number): void {
    this.climbing = SWIM.climbTime;
    this.climb = { fromX: this.x, fromY: this.y, fromZ: this.z, solidId: solid.id, x, y: topAt(solid, x, z), z };
    this.swimming = false;
    this.waterId = null;
    this.under = false;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.events.push({ type: 'climb', solidId: solid.id });
  }

  /**
   * The surface the hero's feet come to rest on when moving from previousY
   * down to nextY: the highest one they cross, or are within ledge help of.
   */
  private landingSurface(x: number, z: number, previousY: number, nextY: number, stickTo: string | null): Solid | null {
    let best: Solid | null = null;
    let bestTop = -Infinity;
    for (const s of this.level.solids) {
      if (s.gone) continue;
      const top = topAt(s, x, z);
      // Walking down a tilted log, the feet keep to it rather than stepping off into the air.
      const below = s.id === stickTo ? STICK_DOWN : 0;
      if (top < nextY - below - EPSILON) continue;
      if (top > previousY + this.level.ledgeHelp + EPSILON) continue;
      if (!touchesFromAbove(s, x, z, MOVE.footRadius)) continue;
      if (!best || top > bestTop) {
        best = s;
        bestTop = top;
      }
    }
    return best;
  }
}
