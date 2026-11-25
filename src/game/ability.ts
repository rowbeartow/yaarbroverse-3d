// The new button, won by rescuing Walblum at Cocolalla Lake (milestone
// eleven, part two). Game rules only: nothing here draws anything.
//
//   Yaarbro   Walblum's karate kick. Walblum shoots out of Yaarbro's armpit
//             at the nearest enemy in front of him, kicks it, and boomerangs
//             back. He cannot be sent again until he is back.
//   Caputo    Claw Slash. Caputo swipes, and three glowing claw marks fly to
//             the nearest enemy in front of him and hit it.
//
// The owner's rules (docs/decisions.md, 2026-11-17): the hero does not aim;
// a kick counts as a hit on every enemy and boss, the monster pike included;
// and Claw Slash must stay as useful as Walblum's kick. So both are one set of
// rules with one set of numbers: the claw marks fly as fast and as far as
// Walblum does, and Caputo's paw is ready again exactly when Walblum would be
// back. Only the drawing differs.
//
// How it goes: on a press it picks its target (the nearest thing that can be
// struck within `range`, inside `cone` of the way the hero faces), and flies
// to it, following it if it moves. Reaching it strikes it: the game then asks
// the enemy, boss or pike whether a hit counts right now, exactly as it does
// for a landing on top. With nothing in front it flies `empty` metres straight
// ahead. Then it comes back to the hero, however fast the hero runs.

import type { HeroName } from './hero';

/** Distances are metres, times are seconds, speeds are metres per second. */
export const ABILITY = {
  /** How far away a target may be, and how far to either side of the way the hero faces, in degrees. */
  range: 10,
  cone: 70,
  /** A target this close counts whichever way the hero faces: it is right beside them. */
  beside: 2,
  /** How fast it flies out, and how far it flies when there is nothing to hit. */
  out: 22,
  empty: 6,
  /** How fast it comes back, and how much faster than the hero at the very least. */
  back: 17,
  backOver: 7,
  /** Back within this far of the hero, it is home. */
  home: 0.5,
  /** After it is home, the button rests this long. */
  rest: 0.15,
  /** It leaves the hero from this high over the feet, and flies no lower than this over them when sent at nothing. */
  from: 1.1,
} as const;

/** What the button is called on the screen. */
export const ABILITY_NAME: Record<HeroName, string> = { Yaarbro: 'Kick', Caputo: 'Slash' };

/** How a strike by the button is told apart from the others. */
export const ABILITY_STRIKE: Record<HeroName, 'kick' | 'slash'> = { Yaarbro: 'kick', Caputo: 'slash' };

/** Something the button could be sent at: where its middle is, how far out it reaches, and a name the game knows it by. */
export interface AbilityTarget {
  key: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export type AbilityPhase = 'ready' | 'out' | 'back' | 'rest';

export interface AbilityState {
  phase: AbilityPhase;
  /** Seconds in this phase. */
  timer: number;
  /** Where Walblum, or the claw marks, are now, and which way they are flying (a step of length 1). */
  x: number;
  y: number;
  z: number;
  heading: { x: number; y: number; z: number };
  /** What it was sent at, or null when it was sent at nothing; and where that was last seen. */
  target: string | null;
  aim: { x: number; y: number; z: number };
  /** True once it has struck on this flight. */
  hit: boolean;
  /** Whether the button was held on the last step. */
  held: boolean;
  /** How many times it has been sent. */
  used: number;
}

export type AbilityEvent =
  /** Sent, at `target` or at nothing. */
  | { what: 'launch'; target: string | null }
  /** It reached what it was sent at: the game settles whether the hit counts. */
  | { what: 'reach'; target: string }
  /** It turned for home, having hit nothing. */
  | { what: 'miss' }
  /** Home again. */
  | { what: 'back' };

export const newAbility = (): AbilityState => ({
  phase: 'ready', timer: 0, x: 0, y: 0, z: 0, heading: { x: 0, y: 0, z: 1 }, target: null, aim: { x: 0, y: 0, z: 0 }, hit: false, held: false, used: 0,
});

/** Where the hero is, for the button: the feet, which way they face (0 faces the camera) and how fast they move. */
export interface AbilityHero {
  x: number;
  y: number;
  z: number;
  facing: number;
  vx: number;
  vz: number;
}

/**
 * The target a press would pick: the nearest within range and inside the cone
 * of the way the hero faces (or right beside the hero), or null.
 */
export const pickTarget = (hero: AbilityHero, targets: readonly AbilityTarget[]): AbilityTarget | null => {
  const faceX = Math.sin(hero.facing);
  const faceZ = Math.cos(hero.facing);
  const within = Math.cos((ABILITY.cone * Math.PI) / 180);
  let best: AbilityTarget | null = null;
  let nearest = Infinity;
  for (const target of targets) {
    const dx = target.x - hero.x;
    const dy = target.y - (hero.y + ABILITY.from);
    const dz = target.z - hero.z;
    const flat = Math.hypot(dx, dz);
    const far = Math.max(0, Math.hypot(dx, dy, dz) - target.radius);
    if (far > ABILITY.range || far >= nearest) continue;
    const ahead = flat > 1e-6 ? (dx * faceX + dz * faceZ) / flat : 1;
    if (ahead < within && far > ABILITY.beside) continue;
    best = target;
    nearest = far;
  }
  return best;
};

/**
 * Advances the button by one step. `pressed` is a fresh press that the game
 * allows (the hero has the button, and is on their feet or in the air, not
 * swimming, hanging or fishing). `targets` is everything that could be struck
 * right now.
 */
export const stepAbility = (state: AbilityState, hero: AbilityHero, pressed: boolean, targets: readonly AbilityTarget[], dt: number): AbilityEvent[] => {
  const events: AbilityEvent[] = [];
  state.timer += dt;
  const chest = { x: hero.x, y: hero.y + ABILITY.from, z: hero.z };

  if (state.phase === 'rest' && state.timer >= ABILITY.rest) {
    state.phase = 'ready';
    state.timer = 0;
  }
  if (state.phase === 'ready') {
    if (!pressed) return events;
    const target = pickTarget(hero, targets);
    Object.assign(state, chest);
    state.phase = 'out';
    state.timer = 0;
    state.hit = false;
    state.used += 1;
    state.target = target ? target.key : null;
    state.aim = target
      ? { x: target.x, y: target.y, z: target.z }
      : { x: chest.x + Math.sin(hero.facing) * ABILITY.empty, y: chest.y, z: chest.z + Math.cos(hero.facing) * ABILITY.empty };
    events.push({ what: 'launch', target: state.target });
    return events;
  }

  /** Flies toward a point at a speed. True when it is within `near` of it. */
  const fly = (to: { x: number; y: number; z: number }, speed: number, near: number): boolean => {
    const dx = to.x - state.x;
    const dy = to.y - state.y;
    const dz = to.z - state.z;
    const far = Math.hypot(dx, dy, dz);
    if (far > 1e-6) state.heading = { x: dx / far, y: dy / far, z: dz / far };
    if (far <= near + speed * dt) {
      const stop = Math.max(0, far - near);
      state.x += state.heading.x * stop;
      state.y += state.heading.y * stop;
      state.z += state.heading.z * stop;
      return true;
    }
    state.x += state.heading.x * speed * dt;
    state.y += state.heading.y * speed * dt;
    state.z += state.heading.z * speed * dt;
    return false;
  };

  if (state.phase === 'out') {
    // It follows what it was sent at for as long as that can still be struck.
    const target = state.target === null ? undefined : targets.find((each) => each.key === state.target);
    if (target) state.aim = { x: target.x, y: target.y, z: target.z };
    const there = fly(state.aim, ABILITY.out, target ? target.radius : 0);
    // It never flies further than it could have been sent.
    const spent = state.timer * ABILITY.out > ABILITY.range + ABILITY.empty;
    if (there || spent) {
      if (there && target) {
        state.hit = true;
        events.push({ what: 'reach', target: target.key });
      } else events.push({ what: 'miss' });
      state.phase = 'back';
      state.timer = 0;
    }
    return events;
  }

  if (state.phase === 'back') {
    const speed = Math.max(ABILITY.back, Math.hypot(hero.vx, hero.vz) + ABILITY.backOver);
    if (fly(chest, speed, ABILITY.home)) {
      state.phase = 'rest';
      state.timer = 0;
      events.push({ what: 'back' });
    }
  }
  return events;
};
