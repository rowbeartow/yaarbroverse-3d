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
 */
export const groundMix = (pace: number): GroundMix => {
  const moving = smooth(0.02, 0.22, pace);
  const running = smooth(0.5, 0.9, pace);
  return { idle: 1 - moving, walk: moving * (1 - running), run: moving * running };
};

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

/** Eases a value toward a target, by `rate` per second. */
export const approach = (value: number, target: number, rate: number, dt: number): number =>
  value + (target - value) * (1 - Math.exp(-rate * dt));

/**
 * A slow breath for a hero standing still with no idle clip: how much taller
 * than normal the body is, as a share of its height, `seconds` into standing.
 */
export const breath = (seconds: number): number => 0.012 * Math.sin(seconds * 2.1);
