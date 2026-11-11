// The hero model files in assets/heroes/: each holds a skeleton and the clips
// its entry in src/view/hero-model.ts asks for, and stays small. This catches
// a file compressed from the wrong original, or a script that lost a clip.

import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';
import { HERO_MODELS, findClip } from '../src/view/hero-model';

const path = (file: string): string => `assets/heroes/${file}`;
const files = new Map<string, Document>();

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const spec of Object.values(HERO_MODELS)) {
    files.set(spec.file, await io.readBinary(new Uint8Array(readFileSync(path(spec.file)))));
  }
});

const clipNames = (file: string): string[] => files.get(file)!.getRoot().listAnimations().map((clip) => clip.getName());
const boneNames = (file: string): string[] => files.get(file)!.getRoot().listSkins().flatMap((skin) => skin.listJoints().map((joint) => joint.getName()));

describe('the hero model files', () => {
  for (const [hero, spec] of Object.entries(HERO_MODELS)) {
    it(`${hero}: the file is compressed, with a skeleton, and well under the size the originals were`, () => {
      const root = files.get(spec.file)!.getRoot();
      expect(statSync(path(spec.file)).size).toBeLessThan(2 * 1024 * 1024);
      expect(root.listExtensionsUsed().map((extension) => extension.extensionName)).toEqual(
        expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']),
      );
      expect(root.listSkins().length).toBe(1);
      expect(boneNames(spec.file).length).toBeGreaterThan(10);
    });

    it(`${hero}: has a clip for walking and one for running`, () => {
      const clips = clipNames(spec.file).map((name) => ({ name }));
      expect(findClip(clips as never, spec.clips.walk)).not.toBeNull();
      expect(findClip(clips as never, spec.clips.run)).not.toBeNull();
    });
  }

  it('Yaarbro: holds one clip from each of his Meshy files', () => {
    expect(clipNames('yaarbro.glb').sort()).toEqual(['idle', 'jump', 'landing', 'roll', 'run', 'walk']);
  });

  it('Yaarbro: every clip happens on the spot, because the rules own where he is', () => {
    const root = files.get('yaarbro.glb')!.getRoot();
    // The bone the whole body hangs from, in the units of the file (centimetres).
    for (const clip of root.listAnimations()) {
      for (const channel of clip.listChannels()) {
        if (channel.getTargetPath() !== 'translation' || channel.getTargetNode()!.getName() !== 'Hips') continue;
        const output = channel.getSampler()!.getOutput()!;
        const low = [Infinity, Infinity, Infinity];
        const high = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < output.getCount(); i += 1) {
          output.getElement(i, []).forEach((part, k) => {
            low[k] = Math.min(low[k], part);
            high[k] = Math.max(high[k], part);
          });
        }
        // Side to side and forward: a sway of a few centimetres, never a journey.
        expect(high[0] - low[0], `${clip.getName()} sideways`).toBeLessThan(15);
        expect(high[2] - low[2], `${clip.getName()} forward`).toBeLessThan(15);
        // Up and down: he may crouch or tuck, but never leaves for the sky.
        expect(high[1], `${clip.getName()} height`).toBeLessThan(200);
      }
    }
  });

  it('Yaarbro: the clips that repeat end where they began', () => {
    const root = files.get('yaarbro.glb')!.getRoot();
    for (const clip of root.listAnimations()) {
      if (!['idle', 'walk', 'run'].includes(clip.getName())) continue;
      for (const sampler of clip.listSamplers()) {
        const output = sampler.getOutput()!;
        const first = output.getElement(0, []);
        const last = output.getElement(output.getCount() - 1, []);
        const same = Math.max(...last.map((part, k) => Math.abs(part - first[k])));
        const flipped = Math.max(...last.map((part, k) => Math.abs(part + first[k])));
        // A turn can be written two ways round (all four numbers negated), which is not a difference.
        expect(last.length === 4 ? Math.min(same, flipped) : same, clip.getName()).toBeLessThan(0.01);
      }
    }
  });

  it('Caputo: holds every clip the rig script writes', () => {
    expect(clipNames('caputo.glb').sort()).toEqual(['falling', 'idle', 'jump', 'landing', 'pounce', 'run', 'trot', 'walk']);
  });

  it('Caputo: has a spine, neck and head, shoulder blades, ears, four legs of three bones, and a tail of at least five', () => {
    const bones = boneNames('caputo.glb');
    expect(bones).toEqual(expect.arrayContaining(['hips', 'spine1', 'spine2', 'chest', 'neck', 'head']));
    expect(bones).toEqual(expect.arrayContaining(['blade_l', 'blade_r', 'ear_l', 'ear_r']));
    for (const leg of ['front', 'hind']) {
      for (const side of ['l', 'r']) {
        expect(bones).toEqual(expect.arrayContaining([`${leg}_upper_${side}`, `${leg}_lower_${side}`, `${leg}_paw_${side}`]));
      }
    }
    expect(bones.filter((name) => /^tail\d+$/.test(name)).length).toBeGreaterThanOrEqual(5);
  });

  it('Caputo: every clip moves, and the ones that repeat end where they began', () => {
    const root = files.get('caputo.glb')!.getRoot();
    for (const clip of root.listAnimations()) {
      const repeats = ['idle', 'walk', 'trot', 'run', 'falling'].includes(clip.getName());
      let moves = false;
      for (const sampler of clip.listSamplers()) {
        const output = sampler.getOutput()!;
        const first = output.getElement(0, []);
        // How far a later key is from the first. A turn can be written two
        // ways round (all four numbers negated), which is not a difference.
        const apart = (value: number[]): number => {
          const same = Math.max(...value.map((part, k) => Math.abs(part - first[k])));
          const flipped = Math.max(...value.map((part, k) => Math.abs(part + first[k])));
          return value.length === 4 ? Math.min(same, flipped) : same;
        };
        // A looping clip ends where it began, so it can repeat without a jump.
        if (repeats) expect(apart(output.getElement(output.getCount() - 1, [])), clip.getName()).toBeLessThan(0.002);
        for (let i = 1; i < output.getCount(); i += 1) {
          if (apart(output.getElement(i, [])) > 0.002) moves = true;
        }
      }
      // Never a frozen pose, standing or in the air.
      expect(moves, clip.getName()).toBe(true);
    }
  });

  it('Caputo: no clip carries him away from the spot, because the rules own where he is', () => {
    const root = files.get('caputo.glb')!.getRoot();
    for (const clip of root.listAnimations()) {
      for (const channel of clip.listChannels()) {
        if (channel.getTargetPath() !== 'translation' || channel.getTargetNode()!.getName() !== 'hips') continue;
        const output = channel.getSampler()!.getOutput()!;
        const low = [Infinity, Infinity, Infinity];
        const high = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < output.getCount(); i += 1) {
          output.getElement(i, []).forEach((part, k) => {
            low[k] = Math.min(low[k], part);
            high[k] = Math.max(high[k], part);
          });
        }
        // His file is in metres. A sway, a crouch or a bound, never a journey.
        for (const k of [0, 1, 2]) expect(high[k] - low[k], `${clip.getName()} axis ${k}`).toBeLessThan(0.4);
      }
    }
  });
});
