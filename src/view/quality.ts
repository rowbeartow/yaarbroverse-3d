// Quality tiers: how much detail the picture carries, chosen automatically so
// the game holds its frame rate. Targets: 60 frames a second on the Mac, a
// steady 30 or better on the iPad.
//
// No browser or 3D code here, so the tests can check the choosing rules.

export type TierName = 'high' | 'medium' | 'low' | 'minimal';

export interface Tier {
  name: TierName;
  /** The most screen pixels drawn per page pixel. */
  maxPixelRatio: number;
  /** Real shadows from the sun: the size of the shadow picture, or 0 for none. */
  shadowSize: number;
  /** Whether tree crowns cast shadows of their own, on top of the leaf shade over the route. */
  crownShadows: boolean;
  /** The soft glow around bright things. */
  bloom: boolean;
  /** Smooth edges on the main picture when bloom is on (samples per pixel). */
  samples: number;
  /** How much grass, fern and floating dust to draw, 0 to 1. */
  detail: number;
  /** Sharper textures at a slant. */
  anisotropy: number;
  /**
   * Plain matte shading in place of the full lighting. Only for machines that
   * draw in software, where the full lighting takes over half a second a frame.
   */
  simple: boolean;
}

export const TIERS: Record<TierName, Tier> = {
  high: { name: 'high', maxPixelRatio: 2, shadowSize: 2048, crownShadows: false, bloom: true, samples: 4, detail: 1, anisotropy: 8, simple: false },
  medium: { name: 'medium', maxPixelRatio: 1.5, shadowSize: 1536, crownShadows: false, bloom: true, samples: 0, detail: 0.7, anisotropy: 4, simple: false },
  low: { name: 'low', maxPixelRatio: 1, shadowSize: 1024, crownShadows: false, bloom: false, samples: 0, detail: 0.4, anisotropy: 2, simple: false },
  // For machines with no graphics card at all (and the test browsers): the
  // same world at well under half the pixels, with plain shading, no shadows
  // and sparser trees. Blurry, but it moves.
  minimal: { name: 'minimal', maxPixelRatio: 0.4, shadowSize: 0, crownShadows: false, bloom: false, samples: 0, detail: 0.2, anisotropy: 1, simple: true },
};

const ORDER: readonly TierName[] = ['high', 'medium', 'low', 'minimal'];

export const isTierName = (value: unknown): value is TierName =>
  value === 'high' || value === 'medium' || value === 'low' || value === 'minimal';

export interface Device {
  /** Phones and tablets. */
  touch: boolean;
  /** The name the graphics card gives itself, when the browser tells. */
  renderer: string;
}

/** True when the "graphics card" is really the processor drawing in software. */
export const isSoftwareRenderer = (renderer: string): boolean =>
  /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);

/** Where a device starts, before any frame has been timed. */
export const startingTier = (device: Device): TierName => {
  if (isSoftwareRenderer(device.renderer)) return 'minimal';
  return device.touch ? 'medium' : 'high';
};

/** The frame rate a device should hold, and the rate below which detail is dropped. */
export const frameRateGoal = (touch: boolean): { target: number; floor: number } =>
  touch ? { target: 30, floor: 34 } : { target: 60, floor: 50 };

/** The next tier down, or null at the bottom. */
export const lowerTier = (tier: TierName): TierName | null => {
  const index = ORDER.indexOf(tier);
  return index < ORDER.length - 1 ? ORDER[index + 1] : null;
};

/**
 * Watches the frame rate and says when to drop a tier. It only ever goes down:
 * a picture that keeps changing its mind is worse than a plainer steady one.
 */
export class TierChooser {
  tier: TierName;
  /** Frames a second, averaged over the last window. */
  rate = 0;
  private frames = 0;
  private time = 0;
  private settle: number;
  private lastWasSlow = false;

  constructor(
    start: TierName,
    private readonly floor: number,
    /** When false the tier is fixed (chosen in the address bar). */
    private readonly automatic = true,
    private readonly window = 2,
    /** Seconds ignored after a change, while shaders compile and textures upload. */
    private readonly settleTime = 2.5,
  ) {
    this.tier = start;
    this.settle = settleTime;
  }

  /**
   * Call once per drawn frame with the seconds since the last one. Returns the
   * new tier when it is time to drop, otherwise null.
   */
  frame(dt: number): TierName | null {
    if (dt <= 0) return null;
    // One long gap is a hidden tab or a pause, not a slow frame. Two slow
    // frames in a row is a slow machine.
    const afterSlow = this.lastWasSlow;
    this.lastWasSlow = dt > 0.25;
    if (dt > 1 && !afterSlow) return null;
    if (this.settle > 0) {
      this.settle -= dt;
      return null;
    }
    this.frames += 1;
    this.time += dt;
    if (this.time < this.window) return null;
    this.rate = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    if (!this.automatic || this.rate >= this.floor) return null;
    // Far below the goal: go straight to the bottom instead of a step at a time.
    const next = this.rate < this.floor / 4 ? 'minimal' : lowerTier(this.tier);
    if (!next || next === this.tier) return null;
    this.tier = next;
    this.settle = this.settleTime;
    return next;
  }
}
