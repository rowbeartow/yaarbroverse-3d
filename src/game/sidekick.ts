// The heroes' second move, on its own button: Walblum's karate kick for
// Yaarbro and the Claw Slash for Caputo. One set of rules and one set of
// numbers for both, so neither hero is the weaker one. Game rules only:
// nothing here draws anything.
//
// How it goes:
//   - Pressing the button sends a flier: Walblum, shot from Yaarbro's armpit,
//     or three glowing claw marks from Caputo's swipe. The hero does not aim:
//     it goes to the nearest thing that can be struck in front of the hero,
//     within `range` and inside a cone `cone` degrees to either side of the
//     way the hero faces.
//   - A short wind-up first (`windup`: the arm comes up, the paw goes back),
//     then it flies at `speed`, following its target if the target moves.
//   - Reaching the target, it strikes: one strike on an enemy; on a boss, one
//     hit when a hit would count, and otherwise it bounces off the guard.
//   - Then it comes back to the hero, wherever the hero has gone. It cannot
//     be sent again until it is back. The claw marks take just as long: they
//     fade on the way out and the paw glows again when the wait is over.
//   - With nothing to strike it flies out `range` straight ahead and returns.
//   - It is not sent from the water, from a rope, or while the controls are
//     taken away. The hero is free to move while it is out.
//
// A game has this move only when it was made with it (`ally` in the game's
// options): it is the reward for rescuing Walblum.

import type { HeroName } from './hero';

/** Distances are metres, times are seconds, speeds are metres per second. */
export const SIDEKICK = {
  /** How far away a target may be, and how far to either side of the hero's facing, in degrees. */
  range: 11,
  cone: 65,
  /** A target may be this far above or below the hero's middle. */
  reachUp: 4.5,
  /** Seconds from the press to the flier leaving. */
  windup: 0.18,
  /** How fast it flies out, and back. */
  speed: 21,
  backSpeed: 17,
  /** It has reached its target within this of the target's body, and is home within this of the hero. */
  touch: 0.25,
  home: 0.7,
  /** Where it leaves the hero and comes back to: this high above the feet. */
  hand: 1.05,
  /** It never takes longer than this to get home: after that it is simply back. */
  longest: 2.4,
} as const;

/** What each hero's second move is called on the screen. */
export const ALLY_NAME: Record<HeroName, string> = { Yaarbro: 'Walblum', Caputo: 'Claws' };

/** What a strike did: it counted, it bounced off (a boss on its guard), or it could not land at all. */
export type AllyStrike = 'hit' | 'blocked' | 'none';

/** Something the flier can be sent at. The game builds one for each enemy, the boss, and anything else that can be struck. */
export interface AllyTarget {
  id: string;
  /** Where its middle is now, and how far out its body reaches. */
  at: () => { x: number; y: number; z: number };
  radius: number;
  /** False while there is no point sending anything at it (beaten, hidden away). */
  there: () => boolean;
  /** The flier arrives, moving along (alongX, alongZ) seen from above. */
  strike: (alongX: number, alongZ: number) => AllyStrike;
}

export type AllyPhase = 'ready' | 'windup' | 'out' | 'back';

export interface Sidekick {
  phase: AllyPhase;
  /** Seconds in this phase. */
  timer: number;
  /** Where the flier is. While ready it rides with the hero. */
  x: number;
  y: number;
  z: number;
  /** Which way it is flying, seen from above (the same angle as a hero's facing). */
  heading: number;
  /** What it was sent at, or null when there was nothing: then it flies to `aim`. */
  target: AllyTarget | null;
  aim: { x: number; y: number; z: number };
  /** Whether its last strike counted. */
  landed: boolean;
  /** Whether the button was held on the last step. */
  held: boolean;
  /** How many times it has been sent. */
  sent: number;
}

export type AllyEvent =
  | { what: 'sent'; target: string | null }
  | { what: 'hit' | 'blocked'; target: string; x: number; y: number; z: number }
  | { what: 'missed' }
  | { what: 'back' };

/** What the rules need to know about the hero. The game itself fits this. */
export interface AllyHero {
  x: number;
  y: number;
  z: number;
  facing: number;
  bodyHeight: number;
}

export const newSidekick = (): Sidekick => ({
  phase: 'ready', timer: 0, x: 0, y: 0, z: 0, heading: 0, target: null, aim: { x: 0, y: 0, z: 0 }, landed: false, held: false, sent: 0,
});

/** True when the button would send it now. */
export const allyReady = (sidekick: Sidekick): boolean => sidekick.phase === 'ready';

/** The nearest target in front of the hero, within range and inside the cone, or null. */
export const pickTarget = (hero: AllyHero, targets: readonly AllyTarget[]): AllyTarget | null => {
  const aheadX = Math.sin(hero.facing);
  const aheadZ = Math.cos(hero.facing);
  const middle = hero.y + hero.bodyHeight / 2;
  const widest = Math.cos((SIDEKICK.cone * Math.PI) / 180);
  let best: AllyTarget | null = null;
  let nearest = Infinity;
  for (const target of targets) {
    if (!target.there()) continue;
    const at = target.at();
    const dx = at.x - hero.x;
    const dz = at.z - hero.z;
    const flat = Math.hypot(dx, dz);
    const far = Math.max(0, flat - target.radius);
    if (far > SIDEKICK.range || Math.abs(at.y - middle) > SIDEKICK.reachUp) continue;
    // Right on top of the hero counts as in front.
    if (flat > target.radius + 0.4 && (dx * aheadX + dz * aheadZ) / flat < widest) continue;
    if (far < nearest) {
      best = target;
      nearest = far;
    }
  }
  return best;
};

/** Moves the flier toward a point at a speed. Returns how far is still to go. */
const flyTo = (sidekick: Sidekick, x: number, y: number, z: number, speed: number, dt: number): number => {
  const dx = x - sidekick.x;
  const dy = y - sidekick.y;
  const dz = z - sidekick.z;
  const far = Math.hypot(dx, dy, dz);
  if (Math.hypot(dx, dz) > 1e-4) sidekick.heading = Math.atan2(dx, dz);
  const step = speed * dt;
  if (far <= step) {
    sidekick.x = x;
    sidekick.y = y;
    sidekick.z = z;
    return 0;
  }
  sidekick.x += (dx / far) * step;
  sidekick.y += (dy / far) * step;
  sidekick.z += (dz / far) * step;
  return far - step;
};

/**
 * Advances the move by one step. `button` is whether its button is held and
 * `free` whether the hero may use it now (not swimming, swinging or frozen).
 * `targets` is everything that could be struck.
 */
export const stepSidekick = (sidekick: Sidekick, hero: AllyHero, button: boolean, free: boolean, targets: readonly AllyTarget[], dt: number): AllyEvent[] => {
  const events: AllyEvent[] = [];
  const pressed = button && !sidekick.held;
  sidekick.held = button;
  sidekick.timer += dt;
  const hand = { x: hero.x, y: hero.y + Math.min(SIDEKICK.hand, hero.bodyHeight * 0.66), z: hero.z };

  if (sidekick.phase === 'ready') {
    Object.assign(sidekick, hand);
    if (!pressed || !free) return events;
    sidekick.phase = 'windup';
    sidekick.timer = 0;
    sidekick.sent += 1;
    sidekick.landed = false;
    sidekick.target = pickTarget(hero, targets);
    sidekick.heading = hero.facing;
    sidekick.aim = { x: hero.x + Math.sin(hero.facing) * SIDEKICK.range, y: hand.y, z: hero.z + Math.cos(hero.facing) * SIDEKICK.range };
    events.push({ what: 'sent', target: sidekick.target ? sidekick.target.id : null });
    return events;
  }

  if (sidekick.phase === 'windup') {
    Object.assign(sidekick, hand);
    if (sidekick.timer >= SIDEKICK.windup) {
      sidekick.phase = 'out';
      sidekick.timer = 0;
    }
    return events;
  }

  if (sidekick.phase === 'out') {
    const { target } = sidekick;
    if (target && !target.there()) {
      // What it was sent at is gone: it turns for home.
      sidekick.phase = 'back';
      sidekick.timer = 0;
      events.push({ what: 'missed' });
      return events;
    }
    const at = target ? target.at() : sidekick.aim;
    const reach = target ? target.radius + SIDEKICK.touch : 0;
    const left = flyTo(sidekick, at.x, at.y, at.z, SIDEKICK.speed, dt);
    if (left <= reach) {
      if (target) {
        const did = target.strike(Math.sin(sidekick.heading), Math.cos(sidekick.heading));
        sidekick.landed = did === 'hit';
        if (did === 'none') events.push({ what: 'missed' });
        else events.push({ what: did, target: target.id, x: sidekick.x, y: sidekick.y, z: sidekick.z });
      } else events.push({ what: 'missed' });
      sidekick.phase = 'back';
      sidekick.timer = 0;
    } else if (sidekick.timer >= SIDEKICK.longest) {
      sidekick.phase = 'back';
      sidekick.timer = 0;
      events.push({ what: 'missed' });
    }
    return events;
  }

  // Back to the hero, wherever the hero is now.
  const left = flyTo(sidekick, hand.x, hand.y, hand.z, SIDEKICK.backSpeed, dt);
  if (left <= SIDEKICK.home || sidekick.timer >= SIDEKICK.longest) {
    sidekick.phase = 'ready';
    sidekick.timer = 0;
    sidekick.target = null;
    Object.assign(sidekick, hand);
    events.push({ what: 'back' });
  }
  return events;
};
