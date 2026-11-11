// How a hero model's clips are found by name, and how hard a landing shows.
// No screen needed.

import { AnimationClip } from 'three';
import { describe, expect, it } from 'vitest';
import { HERO_MODELS, findClip } from '../src/view/hero-model';
import { landingWeight } from '../src/view/hero-motion';

const clip = (name: string): AnimationClip => new AnimationClip(name, 1, []);

describe('finding a hero model\'s clips', () => {
  const clips = [clip('Armature|Walking'), clip('Running'), clip('Run_Jump')];

  it('finds a clip by its exact name first, whatever the capitals', () => {
    expect(findClip(clips, ['running'])?.name).toBe('Running');
  });

  it('otherwise finds a clip whose name holds the word', () => {
    expect(findClip(clips, ['Walking'])?.name).toBe('Armature|Walking');
    expect(findClip(clips, ['Jump'])?.name).toBe('Run_Jump');
  });

  it('tries the names in order, and finds nothing when none is there', () => {
    expect(findClip(clips, ['Stroll', 'Walking'])?.name).toBe('Armature|Walking');
    expect(findClip(clips, ['Idle'])).toBeNull();
    expect(findClip(clips, undefined)).toBeNull();
  });
});

describe('landing', () => {
  it('shows a little of the landing clip after a hop and all of it after a full jump', () => {
    const hop = landingWeight(4, 11);
    const jump = landingWeight(11, 11);
    expect(hop).toBeGreaterThan(0.2);
    expect(hop).toBeLessThan(0.45);
    expect(jump).toBe(1);
    expect(landingWeight(25, 11)).toBe(1);
  });

  it('never shows less for a faster drop', () => {
    let last = 0;
    for (let speed = 0; speed <= 25; speed += 0.5) {
      const weight = landingWeight(speed, 11);
      expect(weight).toBeGreaterThanOrEqual(last);
      expect(weight).toBeLessThanOrEqual(1);
      last = weight;
    }
  });
});

describe('the heroes that have a model', () => {
  it('names a file and a clip for walking and running, and holds part of a clip in the air', () => {
    for (const spec of Object.values(HERO_MODELS)) {
      expect(spec.file).toMatch(/^[a-z]+\.glb$/);
      expect(spec.height).toBeGreaterThan(1);
      expect(spec.clips.walk?.length).toBeGreaterThan(0);
      expect(spec.clips.run?.length).toBeGreaterThan(0);
      expect(spec.airborne[0]).toBeGreaterThanOrEqual(0);
      expect(spec.airborne[1]).toBeGreaterThan(spec.airborne[0]);
      expect(spec.airborne[1]).toBeLessThanOrEqual(1);
      expect(spec.runSpeed).toBeGreaterThan(spec.walkSpeed);
      // A hero with a trot says how fast it is and where the gaits change, in order.
      expect(Boolean(spec.clips.trot)).toBe(Boolean(spec.gaits && spec.trotSpeed));
      if (spec.gaits && spec.trotSpeed) {
        expect(spec.trotSpeed).toBeGreaterThan(spec.walkSpeed);
        expect(spec.trotSpeed).toBeLessThan(spec.runSpeed);
        const { trot, run } = spec.gaits;
        expect(trot.down).toBeLessThan(trot.up);
        expect(trot.up).toBeLessThan(run.down);
        expect(run.down).toBeLessThan(run.up);
        expect(run.up).toBeLessThan(1);
      }
    }
  });
});
