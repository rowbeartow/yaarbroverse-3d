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
//                    ground. Two strikes beat it.
//   Giant mosquito   Hovers above the hero. Its warning is a wind-up; its
//                    attack is a dive to where the hero stood, where it then
//                    rests, low enough to reach. One strike beats it.
//
// What hurts a hero: touching either while it is idle or attacking, and the
// acorn. Touching one while it warns, hops or rests does nothing.
// What beats an enemy: Yaarbro rolling faster than a walk, Caputo's pounce, or
// either hero landing on top of it. A strike wins over a touch that would hurt.

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
  /** The mosquito hovers this far above the middle of the hero, and dives once it is at least `diveAbove` above it. */
  hoverAbove: 2.2,
  diveAbove: 1.1,
  hoverSpeed: 2.1,
  climbSpeed: 2.8,
  /** How long a dive takes, divided by the difficulty's `speed`. */
  diveTime: 0.42,
  /** How fast either goes home when no hero is near. */
  homeSpeed: 1.3,
  /** Body sizes: how far out from the middle, and how tall. A marmot stands on its feet; a mosquito's middle is its place. */
  marmotRadius: 0.55,
  marmotHeight: 0.9,
  mosquitoRadius: 0.6,
  mosquitoHalfHeight: 0.36,
  /** Strikes needed to beat each. */
  marmotHits: 2,
  mosquitoHits: 1,
  /** A struck enemy is knocked this far along the hero's way, and cannot be struck again for this long. */
  knock: 0.76,
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

export type EnemyPhase = 'concealed' | 'idle' | 'dodge-warning' | 'dodge' | 'warning' | 'attack' | 'rest' | 'defeated';

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
  /** Strikes left before it is beaten. */
  hits: number;
  /** Counts down after a strike; it cannot be struck again until this is zero. */
  flash: number;
  dodgeRest: number;
  threat: number;
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

export const newEnemy = (spot: EnemySpot): Enemy => ({
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
  hits: spot.kind === 'marmot' ? ENEMY.marmotHits : ENEMY.mosquitoHits,
  flash: 0,
  dodgeRest: 0,
  threat: 0,
});

/** Puts an enemy that is not beaten back at home, as it was at the start, keeping the strikes it has taken. */
export const sendHome = (enemy: Enemy): void => {
  if (enemy.phase === 'defeated') return;
  const { hits } = enemy;
  Object.assign(enemy, newEnemy(enemy.spot), { hits });
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
export const isDangerous = (enemy: Enemy): boolean => enemy.phase === 'idle' || enemy.phase === 'attack';

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
  const enter = (phase: EnemyPhase): void => {
    enemy.phase = phase;
    enemy.timer = 0;
    outcome.entered.push(phase);
  };
  enemy.timer += dt;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.dodgeRest = Math.max(0, enemy.dodgeRest - dt);
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
  const level = Math.abs(middle - (marmot ? enemy.y + ENEMY.marmotHeight / 2 : enemy.spot.y)) < ENEMY.noticeHeight + (marmot ? 0 : ENEMY.hoverAbove);
  const nearby = level && inArena;
  const stayIn = (): void => {
    enemy.x = clamp(enemy.x, arena.minX, arena.maxX);
    enemy.z = clamp(enemy.z, arena.minZ, arena.maxZ);
  };

  if (enemy.phase === 'concealed' && nearby) enter('idle');

  if (enemy.phase === 'idle') {
    if (!nearby) {
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
        } else if (distance > ENEMY.marmotFar) {
          enemy.x += towardX * ENEMY.marmotCloseSpeed * tuning.speed * dt;
          enemy.z += towardZ * ENEMY.marmotCloseSpeed * tuning.speed * dt;
        } else if (distance < ENEMY.marmotNear) {
          enemy.x -= towardX * ENEMY.marmotBackSpeed * tuning.speed * dt;
          enemy.z -= towardZ * ENEMY.marmotBackSpeed * tuning.speed * dt;
        }
      } else {
        // Stalk the hero from above. Only this follows; the warning and the dive are fixed.
        const step = ENEMY.hoverSpeed * tuning.speed * dt;
        if (distance > step) {
          enemy.x += towardX * step;
          enemy.z += towardZ * step;
        } else {
          enemy.x = hero.x;
          enemy.z = hero.z;
        }
        const height = clamp(middle + ENEMY.hoverAbove, enemy.spot.floor ?? -Infinity, enemy.spot.ceiling ?? Infinity);
        enemy.y = approach(enemy.y, height, ENEMY.climbSpeed * tuning.speed * dt);
      }
      stayIn();
      const ready = marmot ? enemy.timer >= ENEMY.marmotReady : enemy.timer >= ENEMY.mosquitoReady && enemy.y >= middle + ENEMY.diveAbove;
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
    if (enemy.timer >= ENEMY.rest * tuning.rest) {
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
    // Knocked along the hero's way.
    const speed = Math.hypot(hero.vx, hero.vz);
    if (speed > 0.1) {
      enemy.x += (hero.vx / speed) * ENEMY.knock;
      enemy.z += (hero.vz / speed) * ENEMY.knock;
      stayIn();
    }
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

