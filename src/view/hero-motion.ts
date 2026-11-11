// How a hero's animation clips are mixed from how it is moving. Numbers only:
// no 3D code here, so the tests can check the mixing rules.

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smooth = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/** How much of each ground clip to show. The three always add up to 1. */
export interface GroundMix {
  idle: number;
  walk: number;
  run: number;
}

/**
 * Standing, walking and running, mixed by pace (0 standing still, 1 top speed).
 * Walk fades in from a standstill, and run takes over from walk past half speed.
 * This is for a hero with two gaits. One with a trot as well is in one gait at
 * a time (see `nextGait`): a four-legged hero's gaits put the paws down in
 * different orders, so a steady half-and-half of two of them would shuffle.
 */
export const groundMix = (pace: number): GroundMix => {
  const moving = movingShare(pace);
  const running = smooth(0.5, 0.9, pace);
  return { idle: 1 - moving, walk: moving * (1 - running), run: moving * running };
};

export type Gait = 'walk' | 'trot' | 'run';

/**
 * The paces at which a hero with three gaits changes gait. Each change has
 * two paces: the higher one going up and the lower one coming down, so a
 * steady pace near a change does not flick between two gaits.
 */
export interface GaitBands {
  /** Walk gives way to trot going up past `up`, and returns coming down past `down`. */
  trot: { down: number; up: number };
  /** Trot gives way to run going up past `up`, and returns coming down past `down`. */
  run: { down: number; up: number };
}

/** The gait to be in at this pace, given the gait the hero is in now. */
export const nextGait = (gait: Gait, pace: number, bands: GaitBands): Gait => {
  if (pace >= bands.run.up) return 'run';
  if (pace < bands.trot.down) return 'walk';
  if (gait === 'run') return pace < bands.run.down ? 'trot' : 'run';
  if (gait === 'walk') return pace >= bands.trot.up ? 'trot' : 'walk';
  return 'trot';
};

/** How much of the hero is moving and not standing, by pace: none at rest, all of it from a slow walk up. */
export const movingShare = (pace: number): number => smooth(0.02, 0.22, pace);

/**
 * Where in the airborne part of a jump the pose should be held, from the
 * upward speed: 0 just after take-off, 0.5 at the top, 1 falling fast.
 */
export const airPhase = (rise: number, jumpSpeed: number): number => clamp01(0.5 - rise / (2 * jumpSpeed));

/**
 * How fast to play the walk and run clips so the feet keep up with the ground.
 * `speed` is metres a second; each clip looks right at its own `walkSpeed` or
 * `runSpeed`. The two are kept in step so they can be mixed.
 */
export const strideRate = (speed: number, mix: GroundMix, walkSpeed: number, runSpeed: number): number => {
  const moving = mix.walk + mix.run;
  if (moving <= 0.001) return 1;
  const natural = (mix.walk * walkSpeed + mix.run * runSpeed) / moving;
  return Math.min(2, Math.max(0.5, speed / natural));
};

/**
 * How many strides a second a hero with three gaits should take, so its paws
 * keep up with the ground while two gaits are being mixed as well as in one.
 * Each gait is given as the share of it showing, the ground one cycle of its
 * clip covers (metres) and how long that cycle lasts (seconds). A mix of
 * gaits covers a mix of their ground, so the strides a second are the speed
 * over that. No clip is played at under half or over twice its own speed.
 */
export const strideBeat = (speed: number, gaits: { share: number; ground: number; seconds: number }[]): number => {
  const showing = gaits.reduce((sum, gait) => sum + gait.share, 0);
  if (showing <= 0.001) return 1 / gaits[0].seconds;
  const ground = gaits.reduce((sum, gait) => sum + gait.share * gait.ground, 0) / showing;
  const seconds = gaits.reduce((sum, gait) => sum + gait.share * gait.seconds, 0) / showing;
  return Math.min(2 / seconds, Math.max(0.5 / seconds, speed / ground));
};

/** Eases a value toward a target, by `rate` per second. */
export const approach = (value: number, target: number, rate: number, dt: number): number =>
  value + (target - value) * (1 - Math.exp(-rate * dt));

/**
 * How much of the landing clip to show, 0 to 1, from how fast the hero was
 * dropping when it touched down: a little for a hop, all of it for a full jump
 * or more.
 */
export const landingWeight = (dropSpeed: number, jumpSpeed: number): number => 0.25 + 0.75 * smooth(0.3, 0.95, dropSpeed / jumpSpeed);
