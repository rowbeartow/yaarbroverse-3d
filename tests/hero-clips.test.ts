// How a hero model's clips are found by name, and what the player does for a
// kind of movement the file has no clip for. No screen needed.

import { AnimationClip, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { HERO_MODELS, findClip, standingPose } from '../src/view/hero-model';
import { breath } from '../src/view/hero-motion';

const clip = (name: string): AnimationClip => new AnimationClip(name, 1, []);

/** A leg that swings forward and back by `swing` radians, and hips that bob, once a second. */
const walkCycle = (swing: number): AnimationClip => {
  const times: number[] = [];
  const turns: number[] = [];
  const places: number[] = [];
  const axis = new Vector3(1, 0, 0);
  for (let i = 0; i <= 20; i += 1) {
    const t = i / 20;
    times.push(t);
    turns.push(...new Quaternion().setFromAxisAngle(axis, 0.3 + swing * Math.sin(t * Math.PI * 2)).toArray());
    places.push(0, 1 + 0.05 * Math.cos(t * Math.PI * 4), 0.1);
  }
  return new AnimationClip('Walking', 1, [
    new QuaternionKeyframeTrack('Leg.quaternion', times, turns),
    new VectorKeyframeTrack('Hips.position', times, places),
  ]);
};

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

describe('a hero whose file has no idle clip', () => {
  it('stands with every joint at the middle of its walking swing', () => {
    const standing = standingPose(walkCycle(0.6));
    expect(standing.name).toBe('Walking (standing)');
    expect(standing.duration).toBe(1);
    const [leg, hips] = standing.tracks;
    const middle = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.3);
    expect(new Quaternion().fromArray(Array.from(leg.values.slice(0, 4))).angleTo(middle)).toBeLessThan(0.01);
    expect(hips.values[0]).toBeCloseTo(0);
    expect(hips.values[1]).toBeCloseTo(1, 2);
    expect(hips.values[2]).toBeCloseTo(0.1);
  });

  it('holds that pose still from start to end', () => {
    for (const track of standingPose(walkCycle(0.6)).tracks) {
      const size = track.getValueSize();
      expect(Array.from(track.times)).toEqual([0, 1]);
      expect(Array.from(track.values.slice(0, size))).toEqual(Array.from(track.values.slice(size)));
    }
  });

  it('breathes a little, in and out by the same amount', () => {
    let most = 0;
    let sum = 0;
    for (let i = 0; i < 3000; i += 1) {
      const swell = breath(i / 100);
      most = Math.max(most, Math.abs(swell));
      sum += swell;
    }
    expect(most).toBeGreaterThan(0.005);
    expect(most).toBeLessThan(0.02);
    expect(Math.abs(sum / 3000)).toBeLessThan(0.001);
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
    }
  });
});
