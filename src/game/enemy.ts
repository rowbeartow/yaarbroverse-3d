// The enemies: the marmot scout and the giant mosquito. Their behaviour is
// Caputo Mountain's, moved from its flat forest into three dimensions. Game
// rules only: nothing here draws anything.
//
// Both go round the same loop. They wait for a hero to come near, get ready
// (idle), give a warning during which they aim at where the hero is standing
// and no longer follow it, attack along that line, then rest. The rest is the
// opening to strike them or get past.
//
//   Marmot scout     Hides until a hero is near. Shuffles toward a hero who is
//                    far off and away from one who is close. Its warning is an
//                    acorn held up; its attack is the acorn thrown to where the
//                    hero stood. It hops back from a hero charging along the
//                    ground. Two strikes beat it, unless its level says
//                    otherwise (`scoutHits`).
//                    Where a level says so (`patrolSpeed`, `chaseSpeed`: the
//                    grove's Normal and Hard) it does not hide or hold its
//                    distance. It walks a beat across its patch in plain
//                    view, comes after a hero it spots, stops to throw from
//                    a few metres off, runs straight at a hero who is close,
//                    and gives up and goes back to its beat when the hero
//                    leaves its patch.
//   Giant mosquito   Hovers above the hero. Its warning is a wind-up; its
//                    attack is a dive to where the hero stood, where it then
//                    rests, low enough to reach. One strike beats it.
//
// What hurts a hero: touching either while it is idle, on its beat or
// attacking, and the acorn. Touching one while it warns, hops or rests does nothing.
// What beats an enemy: Yaarbro rolling faster than a walk, Caputo's pounce, or
// either hero landing on top of it. A strike wins over a touch that would hurt.
// A strike shows: the enemy is shoved a short way along the hero's path and
// flashes, and cannot be struck again until the flash is over.
//
// The older player's rule: when the hero is sent back to a safe bank, every
// enemy that is not beaten is at full health again (`sendHome`).

/** Distances are metres, times are seconds, speeds are metres per second. */
export const ENEMY = {
  /**
   * An enemy notices a hero who is over its patch (and a little beyond: see
   * `notice` on its spot) and no more than this far above or below it. It
   * never bothers a hero anywhere else, and never aims outside that area.
   */
  noticeHeight: 4,
  /** Ready for this long before the warning starts. */
  marmotReady: 0.5,
  mosquitoReady: 0.45,
  /** How long a warning lasts, times the difficulty's `warning`. */
  warning: 0.8,
  /** How long the rest after an attack lasts, times the difficulty's `rest`. */
  rest: 1.35,
  /** The marmot closes on a hero further off than `far`, and backs away from one nearer than `near`. */
  marmotFar: 4.2,
  marmotNear: 2.5,
  marmotCloseSpeed: 1.05,
  marmotBackSpeed: 1.3,
  /** How fast an acorn flies, how short its flight can be, and how far it can be thrown. */
  acornSpeed: 7.6,
  acornShortest: 0.25,
  acornRange: 9,
  acornRadius: 0.18,
  /** The height the acorn leaves the marmot's paw at, above its feet. */
  acornFrom: 1.3,
  /** The marmot's dodge: a hero coming at it faster than a walk, from between these distances, for this long. */
  /** Faster than this toward it counts as a charge: a little over walking speed. */
  dodgeSpeed: 6.3,
  dodgeFrom: 2,
  dodgeTo: 7,
  dodgeNotice: 0.08,
  dodgeWarning: 0.18,
  /** The hop itself: how far, how high and how long, and how long before it can dodge again. */
  dodgeDistance: 1.8,
  dodgeHeight: 1.8,
  dodgeTime: 0.5,
  dodgeRest: 3.6,
  /**
   * The mosquito hovers this far above the middle of the hero, and dives once
   * it is at least `diveAbove` above it. Where a level has it hover higher,
   * it dives from no lower than `diveAbove` under that height: it has to
   * climb back over the hero's head before it can warn again.
   */
  hoverAbove: 2.2,
  diveAbove: 1.1,
  hoverSpeed: 2.1,
  climbSpeed: 2.8,
  /** How long a dive takes, divided by the difficulty's `speed`. */
  diveTime: 0.42,
  /** How fast either goes home when no hero is near. */
  homeSpeed: 1.3,
  /** A scout on its beat stands and looks about for this long at each end. */
  patrolPause: 0.9,
  /** A scout that comes after a hero throws from between `marmotNear` and `marmotFar`, or from anywhere once it has chased for this long. */
  chaseLong: 2.2,
  /** After a hero is sent back to a safe bank, no enemy notices it for this long. */
  homeGrace: 1.5,
  /** Body sizes: how far out from the middle, and how tall. A marmot stands on its feet; a mosquito's middle is its place. */
  marmotRadius: 0.55,
  marmotHeight: 0.9,
  mosquitoRadius: 0.6,
  mosquitoHalfHeight: 0.36,
  /** Strikes needed to beat each, where a level does not say (`scoutHits`, `mosquitoHits`). */
  marmotHits: 2,
  mosquitoHits: 1,
  /** A struck enemy is shoved this far along the hero's way, over this long, and cannot be struck again while it flashes. */
  knock: 0.76,
  knockTime: 0.14,
  flash: 0.4,
  /** Landing on one, or pouncing it, throws the hero up at this speed. */
  rebound: 10.6,
  /** After a strike the hero cannot be hurt for at least this long. */
  strikeProtection: 0.25,
  /** A hero has to be falling at least this fast for landing on an enemy to count. */
  stompSpeed: 0.8,
  /** A beaten enemy is gone from the level this long after it is beaten. */
  fade: 0.8,
} as const;

export type EnemyKind = 'marmot' | 'mosquito';

export type EnemyPhase = 'concealed' | 'patrol' | 'idle' | 'dodge-warning' | 'dodge' | 'warning' | 'attack' | 'rest' | 'defeated';

/** Where an enemy lives in a level. */
export interface EnemySpot {
  id: string;
  kind: EnemyKind;
  /** Home: where it waits. For a marmot, y is the ground under its feet; for a mosquito, its hovering height. */
  x: number;
  y: number;
  z: number;
  /** The patch it never leaves, seen from above. */
  arena: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** How far past the edge of its patch it notices a hero, and aims. 0 when left out. */
  notice?: number;
  /** For a marmot that walks a beat: the far end of it. Home is the near end. Left out, it is home mirrored across the middle of the patch. */
  beat?: { x: number; z: number };
  /**
   * The id of the boss this enemy answers to. A sidekick lies low, unseen and
   * harmless, until its boss calls it, and is gone when its boss is beaten.
   */
  sidekickOf?: string;
  /** For a mosquito: the lowest and highest it flies. */
  floor?: number;
  ceiling?: number;
}

/** How a level's difficulty stretches the enemies' timing. Normal is 1 for each. */
export interface EnemyTuning {
  /** Times every warning. Longer is easier. */
  warning: number;
  /** Times how fast enemies move and attack. */
  speed: number;
  /** Times the rest after an attack. Longer is easier. */
  rest: number;
  /**
   * The marmot scout walks a beat across its patch at this speed, in plain
   * view, while no hero is about. 0 or left out: it hides where it is.
   */
  patrolSpeed?: number;
  /**
   * The marmot scout comes after a hero on its patch at this speed. Keep it
   * under a hero's walking speed (6), so running away works. 0 or left out:
   * it shuffles to keep its distance and only throws.
   */
  chaseSpeed?: number;
  /** How fast the mosquito keeps up with a hero under it. Left out: 2.1 times `speed`. */
  followSpeed?: number;
  /** How far above the middle of the hero the mosquito hovers. Left out: 2.2. Above about 3.3, a full jump under it no longer touches it. */
  hoverAbove?: number;
  /** Times how long the mosquito gets ready before a dive and rests after one. Smaller means it dives more often. Left out: 1. */
  divePause?: number;
  /**
   * Whether a line is drawn along the path an attack will take, for as long
   * as its warning lasts. Left out: drawn. The rules do not use this: the
   * attack goes where it was aimed either way. With no line, the warning is
   * the enemy's own wind-up and its warning sound.
   */
  aimLine?: boolean;
  /** Strikes it takes to beat a marmot scout, and a giant mosquito. Left out: 2 and 1. */
  scoutHits?: number;
  mosquitoHits?: number;
}

export interface Enemy {
  spot: EnemySpot;
  kind: EnemyKind;
  x: number;
  y: number;
  z: number;
  phase: EnemyPhase;
  /** Seconds in this phase. */
  timer: number;
  /** Which way it faces, as an angle seen from above (0 faces the camera). */
  facing: number;
  /** Where its attack starts and where it is aimed: fixed when the warning begins. */
  from: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  /** The acorn in flight, or null. */
  acorn: { x: number; y: number; z: number } | null;
  /** Strikes left before it is beaten, and how many it takes from full health. */
  hits: number;
  maxHits: number;
  /** The shove of a strike still to be travelled: which way, and for how many more seconds. */
  shove: { x: number; z: number; left: number };
  /** Counts down after a strike; it cannot be struck again until this is zero. */
  flash: number;
  dodgeRest: number;
  threat: number;
  /** A scout on its beat: which end it is heading for (0 the far end, 1 home), and how long it still stands at this end. */
  leg: number;
  pause: number;
  /** Counts down after a hero was sent back to a safe bank: it notices nobody until this is zero. */
  grace: number;
  /** A sidekick that has not been called: it does nothing and nothing touches it. */
  dormant: boolean;
}

/** What an enemy needs to know about the hero. The game itself fits this. */
export interface HeroBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bodyHeight: number;
  striking: boolean;
  pouncing: number;
}

/** What one step of one enemy did to the hero. */
export interface EnemyOutcome {
  /** The hero's move or a landing struck it: how. */
  struck?: 'roll' | 'pounce' | 'stomp';
  /** It hurt the hero. */
  hurt?: boolean;
  /** Phases it entered this step, for sounds, messages and animation. */
  entered: EnemyPhase[];
}

/** How many strikes it takes to beat an enemy of this kind in a level with this tuning. */
export const fullHits = (kind: EnemyKind, tuning?: EnemyTuning): number =>
  kind === 'marmot' ? (tuning?.scoutHits ?? ENEMY.marmotHits) : (tuning?.mosquitoHits ?? ENEMY.mosquitoHits);

export const newEnemy = (spot: EnemySpot, tuning?: EnemyTuning): Enemy => ({
  spot,
  kind: spot.kind,
  x: spot.x,
  y: spot.y,
  z: spot.z,
  phase: spot.kind === 'marmot' ? 'concealed' : 'idle',
  timer: 0,
  facing: 0,
  from: { x: spot.x, y: spot.y, z: spot.z },
  target: { x: spot.x, y: spot.y, z: spot.z },
  acorn: null,
  hits: fullHits(spot.kind, tuning),
  maxHits: fullHits(spot.kind, tuning),
  shove: { x: 0, z: 0, left: 0 },
  flash: 0,
  dodgeRest: 0,
  threat: 0,
  leg: 0,
  pause: 0,
  grace: 0,
  dormant: spot.sidekickOf !== undefined,
});

/** A boss calls a sidekick: it comes out at home at full health, whether it was lying low or had been beaten. */
export const callSidekick = (enemy: Enemy, wait = 0): void => {
  const { maxHits } = enemy;
  // `wait` holds back its first dive, so sidekicks called together do not dive together.
  Object.assign(enemy, newEnemy(enemy.spot), { hits: maxHits, maxHits, dormant: false, timer: -wait });
  if (enemy.kind === 'marmot') enemy.phase = 'idle';
};

/** A sidekick whose boss is beaten gives up at once. */
export const dismissSidekick = (enemy: Enemy): void => {
  if (enemy.dormant || enemy.phase === 'defeated') return;
  enemy.phase = 'defeated';
  enemy.timer = 0;
  enemy.acorn = null;
};

/**
 * Puts an enemy that is not beaten back at home, as it was at the start, at
 * full health: whatever strikes it had taken are undone. Returns true when it
 * had been damaged, so the game can say so. A beaten enemy stays beaten.
 */
export const sendHome = (enemy: Enemy): boolean => {
  if (enemy.spot.sidekickOf !== undefined) {
    // A sidekick, beaten or not, lies low again until its boss calls.
    const { maxHits } = enemy;
    Object.assign(enemy, newEnemy(enemy.spot), { hits: maxHits, maxHits });
    return false;
  }
  if (enemy.phase === 'defeated') return false;
  const { hits, maxHits } = enemy;
  Object.assign(enemy, newEnemy(enemy.spot), { hits: maxHits, maxHits, grace: ENEMY.homeGrace });
  return hits < maxHits;
};

const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
const approach = (value: number, target: number, amount: number): number =>
  value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

/** Its body, as an upright can: the middle seen from above, the bottom, the top and how far out it reaches. */
export const enemyBody = (enemy: Enemy): { bottom: number; top: number; radius: number } =>
  enemy.kind === 'marmot'
    ? { bottom: enemy.y, top: enemy.y + ENEMY.marmotHeight, radius: ENEMY.marmotRadius }
    : { bottom: enemy.y - ENEMY.mosquitoHalfHeight, top: enemy.y + ENEMY.mosquitoHalfHeight, radius: ENEMY.mosquitoRadius };

/** True while touching this enemy would hurt. */
export const isDangerous = (enemy: Enemy): boolean => enemy.phase === 'idle' || enemy.phase === 'patrol' || enemy.phase === 'attack';

/**
 * Advances one enemy by `dt` seconds and works out what it does to the hero.
 * `heroRadius` is how far out the hero's body reaches, and `previousY` is
 * where the hero's feet were before this step, for telling a landing on top.
 */
export const stepEnemy = (
  enemy: Enemy,
  hero: HeroBody,
  heroRadius: number,
  previousY: number,
  tuning: EnemyTuning,
  canBeHurt: boolean,
  dt: number,
): EnemyOutcome => {
  const outcome: EnemyOutcome = { entered: [] };
  if (enemy.dormant) return outcome;
  const enter = (phase: EnemyPhase): void => {
    enemy.phase = phase;
    enemy.timer = 0;
    outcome.entered.push(phase);
  };
  enemy.timer += dt;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.dodgeRest = Math.max(0, enemy.dodgeRest - dt);
  enemy.grace = Math.max(0, enemy.grace - dt);
  // The shove of a strike is travelled over a few steps, so it is seen and not a jump. It never leaves the patch.
  if (enemy.shove.left > 0) {
    const share = Math.min(dt, enemy.shove.left) / ENEMY.knockTime;
    enemy.x = Math.max(enemy.spot.arena.minX, Math.min(enemy.spot.arena.maxX, enemy.x + enemy.shove.x * share));
    enemy.z = Math.max(enemy.spot.arena.minZ, Math.min(enemy.spot.arena.maxZ, enemy.z + enemy.shove.z * share));
    enemy.shove.left = Math.max(0, enemy.shove.left - dt);
  }
  if (enemy.phase === 'defeated') {
    enemy.acorn = null;
    return outcome;
  }

  const marmot = enemy.kind === 'marmot';
  const { arena } = enemy.spot;
  const middle = hero.y + hero.bodyHeight / 2;
  const dx = hero.x - enemy.x;
  const dz = hero.z - enemy.z;
  const distance = Math.hypot(dx, dz);
  const reach = enemy.spot.notice ?? 0;
  const inArena =
    hero.x >= arena.minX - reach && hero.x <= arena.maxX + reach && hero.z >= arena.minZ - reach && hero.z <= arena.maxZ + reach;
  const hoverAbove = tuning.hoverAbove ?? ENEMY.hoverAbove;
  const level = Math.abs(middle - (marmot ? enemy.y + ENEMY.marmotHeight / 2 : enemy.spot.y)) < ENEMY.noticeHeight + (marmot ? 0 : hoverAbove);
  const nearby = level && inArena && enemy.grace === 0;
  const patrolSpeed = marmot ? (tuning.patrolSpeed ?? 0) : 0;
  const chaseSpeed = marmot ? (tuning.chaseSpeed ?? 0) : 0;
  const pause = marmot ? 1 : (tuning.divePause ?? 1);
  const stayIn = (): void => {
    enemy.x = clamp(enemy.x, arena.minX, arena.maxX);
    enemy.z = clamp(enemy.z, arena.minZ, arena.maxZ);
  };

  // A scout with a beat to walk is never hidden.
  if (enemy.phase === 'concealed' && patrolSpeed > 0) enemy.phase = 'patrol';
  if ((enemy.phase === 'concealed' || enemy.phase === 'patrol') && nearby) enter('idle');

  if (enemy.phase === 'patrol') {
    // Back and forth between home and the far end of its beat, with a look about at each end.
    const far = enemy.spot.beat ?? { x: arena.minX + arena.maxX - enemy.spot.x, z: enemy.spot.z };
    const end = enemy.leg === 0 ? far : { x: enemy.spot.x, z: enemy.spot.z };
    enemy.pause = Math.max(0, enemy.pause - dt);
    if (enemy.pause === 0) {
      const gap = Math.hypot(end.x - enemy.x, end.z - enemy.z);
      const step = patrolSpeed * dt;
      if (gap > step) {
        enemy.facing = Math.atan2(end.x - enemy.x, end.z - enemy.z);
        enemy.x += ((end.x - enemy.x) / gap) * step;
        enemy.z += ((end.z - enemy.z) / gap) * step;
      } else {
        enemy.x = end.x;
        enemy.z = end.z;
        enemy.leg = 1 - enemy.leg;
        enemy.pause = ENEMY.patrolPause;
      }
      stayIn();
    }
  } else if (enemy.phase === 'idle') {
    if (!nearby && patrolSpeed > 0) {
      // The hero has left its patch: it gives up and goes back to its beat.
      enter('patrol');
      enemy.threat = 0;
      enemy.pause = ENEMY.patrolPause;
    } else if (!nearby) {
      // Home is fixed. It never follows a hero out of its patch.
      const gap = Math.hypot(enemy.spot.x - enemy.x, enemy.spot.z - enemy.z);
      const step = ENEMY.homeSpeed * tuning.speed * dt;
      if (gap > step) {
        enemy.x += ((enemy.spot.x - enemy.x) / gap) * step;
        enemy.z += ((enemy.spot.z - enemy.z) / gap) * step;
      } else {
        enemy.x = enemy.spot.x;
        enemy.z = enemy.spot.z;
      }
      if (!marmot) enemy.y = approach(enemy.y, enemy.spot.y, ENEMY.climbSpeed * tuning.speed * dt);
      enemy.timer = 0;
      enemy.threat = 0;
    } else {
      if (distance > 1e-6) enemy.facing = Math.atan2(dx, dz);
      const towardX = distance > 1e-6 ? dx / distance : 0;
      const towardZ = distance > 1e-6 ? dz / distance : 0;
      if (marmot) {
        // Watch a fast charge along the ground for a beat, then hop back from it.
        const closing = -(hero.vx * towardX + hero.vz * towardZ);
        const charging = distance > ENEMY.dodgeFrom && distance < ENEMY.dodgeTo && closing > ENEMY.dodgeSpeed && hero.y < enemy.y + 0.5;
        enemy.threat = charging ? enemy.threat + dt : 0;
        if (enemy.threat >= ENEMY.dodgeNotice && enemy.dodgeRest === 0) {
          enter('dodge-warning');
          enemy.dodgeRest = ENEMY.dodgeRest;
          enemy.from = { x: enemy.x, y: enemy.y, z: enemy.z };
          enemy.target = {
            x: clamp(enemy.x - towardX * ENEMY.dodgeDistance, arena.minX, arena.maxX),
            y: enemy.y,
            z: clamp(enemy.z - towardZ * ENEMY.dodgeDistance, arena.minZ, arena.maxZ),
          };
        } else if (chaseSpeed > 0) {
          // It comes after the hero, and stands its ground only to throw.
          // A beat on the spot first, each time: that is the tell for the run.
          const step = chaseSpeed * dt;
          if (enemy.timer >= ENEMY.marmotReady && distance > step) {
            enemy.x += towardX * step;
            enemy.z += towardZ * step;
          }
        } else if (distance > ENEMY.marmotFar) {
          enemy.x += towardX * ENEMY.marmotCloseSpeed * tuning.speed * dt;
          enemy.z += towardZ * ENEMY.marmotCloseSpeed * tuning.speed * dt;
        } else if (distance < ENEMY.marmotNear) {
          enemy.x -= towardX * ENEMY.marmotBackSpeed * tuning.speed * dt;
          enemy.z -= towardZ * ENEMY.marmotBackSpeed * tuning.speed * dt;
        }
      } else {
        // Stalk the hero from above. Only this follows; the warning and the dive are fixed.
        const step = (tuning.followSpeed ?? ENEMY.hoverSpeed * tuning.speed) * dt;
        if (distance > step) {
          enemy.x += towardX * step;
          enemy.z += towardZ * step;
        } else {
          enemy.x = hero.x;
          enemy.z = hero.z;
        }
        const height = clamp(middle + hoverAbove, enemy.spot.floor ?? -Infinity, enemy.spot.ceiling ?? Infinity);
        enemy.y = approach(enemy.y, height, ENEMY.climbSpeed * tuning.speed * dt);
      }
      stayIn();
      // A scout that chases throws once it is a few metres off, or has chased long enough; one close to the hero keeps coming.
      const inRange = chaseSpeed === 0 || (distance >= ENEMY.marmotNear && (distance <= ENEMY.marmotFar || enemy.timer >= ENEMY.chaseLong));
      const ready = marmot
        ? enemy.timer >= ENEMY.marmotReady && inRange
        : enemy.timer >= ENEMY.mosquitoReady * pause && enemy.y >= middle + Math.max(ENEMY.diveAbove, hoverAbove - ENEMY.diveAbove);
      if (enemy.phase === 'idle' && ready) {
        enter('warning');
        enemy.from = { x: enemy.x, y: marmot ? enemy.y + ENEMY.acornFrom : enemy.y, z: enemy.z };
        // Aim at where the hero is now. An acorn only carries so far; a dive stays inside the patch.
        let aimX = hero.x;
        let aimZ = hero.z;
        if (marmot && distance > ENEMY.acornRange) {
          aimX = enemy.x + towardX * ENEMY.acornRange;
          aimZ = enemy.z + towardZ * ENEMY.acornRange;
        }
        aimX = clamp(aimX, arena.minX - reach, arena.maxX + reach);
        aimZ = clamp(aimZ, arena.minZ - reach, arena.maxZ + reach);
        enemy.target = { x: aimX, y: marmot ? middle : Math.max(middle, enemy.spot.floor ?? -Infinity), z: aimZ };
      }
    }
  } else if (enemy.phase === 'dodge-warning') {
    if (enemy.timer >= ENEMY.dodgeWarning) enter('dodge');
  } else if (enemy.phase === 'dodge') {
    const share = clamp(enemy.timer / ENEMY.dodgeTime, 0, 1);
    enemy.x = enemy.from.x + (enemy.target.x - enemy.from.x) * share;
    enemy.z = enemy.from.z + (enemy.target.z - enemy.from.z) * share;
    enemy.y = enemy.spot.y + Math.sin(share * Math.PI) * ENEMY.dodgeHeight;
    if (share === 1) enter('rest');
  } else if (enemy.phase === 'warning') {
    if (enemy.timer >= ENEMY.warning * tuning.warning) {
      enter('attack');
      if (marmot) enemy.acorn = { ...enemy.from };
    }
  } else if (enemy.phase === 'attack') {
    // One acorn, or one dive, along exactly the line that was shown.
    const length = Math.hypot(enemy.target.x - enemy.from.x, enemy.target.y - enemy.from.y, enemy.target.z - enemy.from.z);
    const seconds = marmot
      ? Math.max(ENEMY.acornShortest / tuning.speed, length / (ENEMY.acornSpeed * tuning.speed))
      : ENEMY.diveTime / tuning.speed;
    const share = clamp(enemy.timer / seconds, 0, 1);
    const at = {
      x: enemy.from.x + (enemy.target.x - enemy.from.x) * share,
      y: enemy.from.y + (enemy.target.y - enemy.from.y) * share,
      z: enemy.from.z + (enemy.target.z - enemy.from.z) * share,
    };
    if (marmot) enemy.acorn = at;
    else Object.assign(enemy, at);
    if (share === 1) enter('rest');
  } else if (enemy.phase === 'rest') {
    if (enemy.timer >= ENEMY.rest * tuning.rest * pause) {
      enter('idle');
      enemy.threat = 0;
    }
  }
  if (marmot && enemy.phase !== 'dodge') enemy.y = enemy.spot.y;

  // Touching it.
  const body = enemyBody(enemy);
  const apart = Math.hypot(hero.x - enemy.x, hero.z - enemy.z);
  const overlapping = apart < heroRadius + body.radius;
  const touching = overlapping && hero.y < body.top && hero.y + hero.bodyHeight > body.bottom;
  const stomp = overlapping && hero.vy < -ENEMY.stompSpeed && previousY >= body.top - 0.1 && hero.y <= body.top;
  // The step that ends an attack still counts as part of it.
  const dangerous = isDangerous(enemy) || outcome.entered.includes('rest');
  if (enemy.flash <= 0 && (touching || stomp) && (hero.striking || stomp)) {
    enemy.hits -= 1;
    enemy.flash = ENEMY.flash;
    enemy.acorn = null;
    // Shoved along the hero's way, or straight away from a hero who came down on it.
    const speed = Math.hypot(hero.vx, hero.vz);
    const awayX = speed > 0.1 ? hero.vx / speed : apart > 1e-6 ? (enemy.x - hero.x) / apart : 0;
    const awayZ = speed > 0.1 ? hero.vz / speed : apart > 1e-6 ? (enemy.z - hero.z) / apart : 0;
    enemy.shove = { x: awayX * ENEMY.knock, z: awayZ * ENEMY.knock, left: ENEMY.knockTime };
    if (marmot) enemy.y = enemy.spot.y;
    enter(enemy.hits <= 0 ? 'defeated' : 'rest');
    outcome.struck = hero.pouncing > 0 ? 'pounce' : stomp ? 'stomp' : 'roll';
    return outcome;
  }

  const acorn = enemy.acorn;
  const acornHit =
    acorn !== null &&
    Math.hypot(hero.x - acorn.x, hero.z - acorn.z) < heroRadius + ENEMY.acornRadius &&
    acorn.y > hero.y - ENEMY.acornRadius &&
    acorn.y < hero.y + hero.bodyHeight + ENEMY.acornRadius;
  if ((acornHit || (touching && dangerous)) && canBeHurt) {
    outcome.hurt = true;
    enemy.acorn = null;
    if (enemy.phase !== 'rest') enter('rest');
  }
  if (enemy.phase !== 'attack') enemy.acorn = null;
  return outcome;
};

