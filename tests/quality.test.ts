// The rules that choose a quality tier, and the rules that mix a hero's
// animation clips. Both are plain numbers, checked without a screen.

import { describe, expect, it } from 'vitest';
import { airPhase, groundMix, movingShare, nextGait, strideBeat, strideRate, type Gait } from '../src/view/hero-motion';
import { TIERS, TierChooser, frameRateGoal, isSoftwareRenderer, lowerTier, startingTier } from '../src/view/quality';

/** Feeds the chooser `seconds` of frames at a steady rate and returns every tier it dropped to. */
const run = (chooser: TierChooser, framesPerSecond: number, seconds: number): string[] => {
  const drops: string[] = [];
  for (let i = 0; i < framesPerSecond * seconds; i += 1) {
    const next = chooser.frame(1 / framesPerSecond);
    if (next) drops.push(next);
  }
  return drops;
};

describe('quality tiers', () => {
  it('starts a Mac on high, an iPad on medium, and a machine with no graphics card on minimal', () => {
    expect(startingTier({ touch: false, renderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1)' })).toBe('high');
    expect(startingTier({ touch: true, renderer: 'Apple GPU' })).toBe('medium');
    expect(startingTier({ touch: false, renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)' })).toBe('minimal');
    expect(startingTier({ touch: true, renderer: 'llvmpipe (LLVM 17.0.6, 256 bits)' })).toBe('minimal');
    expect(isSoftwareRenderer('Apple GPU')).toBe(false);
  });

  it('aims for 60 on a computer and a steady 30 or better on touch', () => {
    expect(frameRateGoal(false).target).toBe(60);
    expect(frameRateGoal(true).target).toBe(30);
    expect(frameRateGoal(true).floor).toBeGreaterThan(30);
  });

  it('gets cheaper with every step down, and only the lowest tier uses plain shading', () => {
    const order = ['high', 'medium', 'low', 'minimal'] as const;
    for (let i = 1; i < order.length; i += 1) {
      const above = TIERS[order[i - 1]];
      const below = TIERS[order[i]];
      expect(lowerTier(above.name)).toBe(below.name);
      expect(below.maxPixelRatio).toBeLessThanOrEqual(above.maxPixelRatio);
      expect(below.shadowSize).toBeLessThanOrEqual(above.shadowSize);
      expect(below.detail).toBeLessThan(above.detail);
    }
    expect(lowerTier('minimal')).toBeNull();
    expect(order.filter((name) => TIERS[name].simple)).toEqual(['minimal']);
  });

  it('holds its tier while the frame rate is at the goal', () => {
    expect(run(new TierChooser('high', 50), 60, 30)).toEqual([]);
    expect(run(new TierChooser('medium', 34), 40, 30)).toEqual([]);
  });

  it('drops one tier at a time when the frame rate is a little short', () => {
    const chooser = new TierChooser('high', 50);
    expect(run(chooser, 40, 6)).toEqual(['medium']);
    expect(run(chooser, 40, 6)).toEqual(['low']);
    expect(chooser.tier).toBe('low');
  });

  it('goes straight to the lowest tier when the frame rate is far short', () => {
    const chooser = new TierChooser('high', 50);
    expect(run(chooser, 5, 8)).toEqual(['minimal']);
  });

  it('copes with frames that take more than a second each', () => {
    const chooser = new TierChooser('medium', 34);
    const drops: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      const next = chooser.frame(1.5);
      if (next) drops.push(next);
    }
    expect(drops).toEqual(['minimal']);
  });

  it('ignores one long gap, such as a hidden tab coming back', () => {
    const chooser = new TierChooser('high', 50);
    run(chooser, 60, 5);
    expect(chooser.frame(1.5)).toBeNull();
    expect(run(chooser, 60, 5)).toEqual([]);
    expect(chooser.tier).toBe('high');
  });

  it('never rises again, and never drops below the lowest tier', () => {
    const chooser = new TierChooser('low', 50);
    expect(run(chooser, 30, 6)).toEqual(['minimal']);
    expect(run(chooser, 10, 20)).toEqual([]);
    expect(run(chooser, 120, 20)).toEqual([]);
    expect(chooser.tier).toBe('minimal');
  });

  it('stays put when the tier is fixed in the address bar', () => {
    const chooser = new TierChooser('high', 50, false);
    expect(run(chooser, 5, 20)).toEqual([]);
    expect(chooser.tier).toBe('high');
  });

  it('waits out the first moments after a change, while the picture is still being set up', () => {
    const chooser = new TierChooser('high', 50);
    expect(run(chooser, 20, 2)).toEqual([]);
  });
});

describe('mixing a hero\'s animation clips', () => {
  it('stands still at rest, walks at a stroll and runs at full speed', () => {
    expect(groundMix(0)).toEqual({ idle: 1, walk: 0, run: 0 });
    const stroll = groundMix(0.4);
    expect(stroll.walk).toBeGreaterThan(0.9);
    expect(stroll.run).toBe(0);
    const sprint = groundMix(1);
    expect(sprint.run).toBeCloseTo(1);
    expect(sprint.idle).toBe(0);
  });

  it('always adds up to exactly one hero', () => {
    for (let pace = 0; pace <= 1; pace += 0.05) {
      const mix = groundMix(pace);
      expect(mix.idle + mix.walk + mix.run).toBeCloseTo(1);
      expect(Math.min(mix.idle, mix.walk, mix.run)).toBeGreaterThanOrEqual(0);
    }
  });

  it('blends walk into run between half and full speed', () => {
    const mix = groundMix(0.7);
    expect(mix.walk).toBeGreaterThan(0.2);
    expect(mix.run).toBeGreaterThan(0.2);
  });

  it('moves the held air pose from take-off to falling by upward speed', () => {
    expect(airPhase(11, 11)).toBe(0);
    expect(airPhase(0, 11)).toBe(0.5);
    expect(airPhase(-11, 11)).toBe(1);
    expect(airPhase(-25, 11)).toBe(1);
    expect(airPhase(5, 11)).toBeLessThan(airPhase(-5, 11));
  });

  it('plays the stride faster when the ground moves faster than the clip was made for', () => {
    expect(strideRate(2, groundMix(0.33), 2, 6)).toBeCloseTo(1, 1);
    expect(strideRate(6, groundMix(1), 2, 6)).toBeCloseTo(1, 1);
    expect(strideRate(6, groundMix(1), 2, 4)).toBeCloseTo(1.5, 1);
    expect(strideRate(0, groundMix(0), 2, 6)).toBe(1);
  });
});

describe('a hero with three gaits', () => {
  const bands = { trot: { down: 0.3, up: 0.34 }, run: { down: 0.63, up: 0.68 } };

  it('walks at a slow pace, trots in the middle and runs at top speed', () => {
    for (const from of ['walk', 'trot', 'run'] as Gait[]) {
      expect(nextGait(from, 0.1, bands)).toBe('walk');
      expect(nextGait(from, 0.5, bands)).toBe('trot');
      expect(nextGait(from, 1, bands)).toBe('run');
    }
  });

  it('stays in the gait it is in at a pace between the two sides of a change', () => {
    expect(nextGait('walk', 0.32, bands)).toBe('walk');
    expect(nextGait('trot', 0.32, bands)).toBe('trot');
    expect(nextGait('trot', 0.65, bands)).toBe('trot');
    expect(nextGait('run', 0.65, bands)).toBe('run');
  });

  it('does not flick between gaits when the pace wobbles around a change', () => {
    let gait: Gait = 'walk';
    let changes = 0;
    for (let i = 0; i < 200; i += 1) {
      const next = nextGait(gait, 0.33 + 0.02 * Math.sin(i), bands);
      if (next !== gait) changes += 1;
      gait = next;
    }
    expect(changes).toBeLessThanOrEqual(1);
  });

  it('goes straight from a walk to a run, and back, when the pace jumps', () => {
    expect(nextGait('walk', 0.9, bands)).toBe('run');
    expect(nextGait('run', 0.05, bands)).toBe('walk');
  });

  it('is all standing at rest and all moving from a slow walk up', () => {
    expect(movingShare(0)).toBe(0);
    expect(movingShare(0.25)).toBe(1);
    expect(movingShare(1)).toBe(1);
  });

  it('takes the strides a second that cover the ground, in one gait and in a mix of two', () => {
    const walk = { ground: 1, seconds: 0.8 };
    const trot = { ground: 1.2, seconds: 0.4 };
    const only = (share: number, other: number) => [{ ...walk, share }, { ...trot, share: other }];
    // Three metres a second on a trot that covers 1.2 m a cycle: 2.5 cycles a second.
    expect(strideBeat(3, only(0, 1))).toBeCloseTo(2.5);
    // Half and half covers 1.1 m a cycle.
    expect(strideBeat(2.2, only(0.5, 0.5))).toBeCloseTo(2);
    // Never under half or over twice a clip's own speed.
    expect(strideBeat(0.1, only(1, 0))).toBeCloseTo(0.5 / 0.8);
    expect(strideBeat(20, only(1, 0))).toBeCloseTo(2 / 0.8);
    // Standing still, the clips tick over at the first one's own speed.
    expect(strideBeat(0, only(0, 0))).toBeCloseTo(1 / 0.8);
  });
});
