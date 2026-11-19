// The fish model files in assets/fish/: each holds the one fish skeleton and
// the four clips fishing needs, stays small and light, and happens on the
// spot. This catches a file compressed from the wrong model, or a script that
// lost a clip.

import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';

/** Each fish and the most triangles it may have: several are in the water at the dock, the lake's heaviest place. */
const FISH: Record<string, number> = { bass: 3000, perch: 3000, trout: 3000, pike: 5000 };
const CLIPS = ['flop', 'idle', 'swim', 'thrash'];
const BONES = ['body', 'head', 'root', 'tail1', 'tail2', 'tail3', 'tail4'];

const path = (name: string): string => `assets/fish/${name}.glb`;
const files = new Map<string, Document>();

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const name of Object.keys(FISH)) files.set(name, await io.readBinary(new Uint8Array(readFileSync(path(name)))));
});

describe('the fish model files', () => {
  for (const [name, most] of Object.entries(FISH)) {
    const root = () => files.get(name)!.getRoot();

    it(`${name}: the file is compressed, small and light`, () => {
      expect(statSync(path(name)).size).toBeLessThan(300 * 1024);
      const triangles = root().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? 0) / 3, 0);
      expect(triangles).toBeLessThanOrEqual(most);
      expect(root().listExtensionsUsed().map((extension) => extension.extensionName)).toEqual(
        expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']),
      );
    });

    it(`${name}: has the one fish skeleton and the four clips`, () => {
      expect(root().listSkins().length).toBe(1);
      expect(root().listSkins()[0].listJoints().map((joint) => joint.getName()).sort()).toEqual(expect.arrayContaining(BONES.filter((bone) => bone !== 'root')));
      expect(root().listAnimations().map((clip) => clip.getName()).sort()).toEqual(CLIPS);
    });

    it(`${name}: every clip happens on the spot, because the rules own where a fish is`, () => {
      for (const clip of root().listAnimations()) {
        for (const channel of clip.listChannels()) {
          if (channel.getTargetPath() !== 'translation' || channel.getTargetNode()!.getName() !== 'body') continue;
          const output = channel.getSampler()!.getOutput()!;
          const low = [Infinity, Infinity, Infinity];
          const high = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < output.getCount(); i += 1) {
            output.getElement(i, []).forEach((part, k) => {
              low[k] = Math.min(low[k], part);
              high[k] = Math.max(high[k], part);
            });
          }
          // Under 15 cm any way, on a model about 1.9 m long.
          for (const k of [0, 1, 2]) expect(high[k] - low[k], `${clip.getName()} moves the body`).toBeLessThan(0.15);
        }
      }
    });
  }
});
