// Repeatable randomness for the scenery: a seeded number source, and smooth
// noise for lumpy rock, wandering moss and rolling ground. The forest looks the
// same on every visit because nothing here uses the clock or Math.random.

/** A repeatable random number source: the same seed gives the same numbers. */
export const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash = (x: number, y: number, z: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const fade = (t: number): number => t * t * (3 - 2 * t);

/** Smooth noise from 0 to 1 at a point in space. */
export const noise = (x: number, y = 0, z = 0): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);
  const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
  return mix(
    mix(
      mix(hash(xi, yi, zi), hash(xi + 1, yi, zi), u),
      mix(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u),
      v,
    ),
    mix(
      mix(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u),
      mix(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u),
      v,
    ),
    w,
  );
};

/** Noise with finer detail layered on top, from -1 to 1. */
export const rough = (x: number, y = 0, z = 0, layers = 3): number => {
  let total = 0;
  let size = 1;
  let weight = 0;
  for (let i = 0; i < layers; i += 1) {
    total += (noise(x / size, y / size, z / size) * 2 - 1) * size;
    weight += size;
    size /= 2;
  }
  return total / weight;
};

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** 0 below `from`, 1 above `to`, smooth in between (`from` may be the larger). */
export const smooth = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
