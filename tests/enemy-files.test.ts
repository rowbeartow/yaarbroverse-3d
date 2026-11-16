// The enemy model files in assets/enemies/: each holds a skeleton and the
// clips its behaviour needs, stays small, and happens on the spot. This
// catches a file compressed from the wrong model, or a script that lost a clip.

import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';

/** Each enemy's file, its clips, and the bone its whole body hangs from. */
/** `sinks`: a clip in which the body goes down out of sight, as the crocodile does when beaten. */
const ENEMIES: Record<string, { clips: readonly string[]; body: string; sinks?: readonly string[] }> = {
  marmot: { clips: ['defeated', 'hit', 'hop', 'idle', 'throw', 'walk', 'warning', 'winded'], body: 'hips' },
  mosquito: { clips: ['defeated', 'dive', 'hover', 'warning', 'winded'], body: 'body' },
  crocodile: { clips: ['defeated', 'dive', 'float', 'hit', 'lunge', 'lurk', 'swim', 'turn_snap'], body: 'hips', sinks: ['defeated'] },
};

const path = (name: string): string => `assets/enemies/${name}.glb`;
const files = new Map<string, Document>();

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const name of Object.keys(ENEMIES)) files.set(name, await io.readBinary(new Uint8Array(readFileSync(path(name)))));
});

describe('the enemy model files', () => {
  for (const [name, spec] of Object.entries(ENEMIES)) {
    const root = () => files.get(name)!.getRoot();

    it(`${name}: the file is compressed, with a skeleton, and small`, () => {
      expect(statSync(path(name)).size).toBeLessThan(1.5 * 1024 * 1024);
      // Light enough for several on screen at once: the crocodiles share the lake's frame budget.
      if (name === 'crocodile') {
        const triangles = root().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? 0) / 3, 0);
        expect(triangles).toBeLessThanOrEqual(8000);
      }
      expect(root().listExtensionsUsed().map((extension) => extension.extensionName)).toEqual(
        expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']),
      );
      expect(root().listSkins().length).toBe(1);
      expect(root().listSkins()[0].listJoints().length).toBeGreaterThan(10);
    });

    it(`${name}: holds a clip for each thing it does in the game`, () => {
      expect(root().listAnimations().map((clip) => clip.getName()).sort()).toEqual([...spec.clips]);
    });

    it(`${name}: every clip happens on the spot, because the rules own where it is`, () => {
      for (const clip of root().listAnimations()) {
        for (const channel of clip.listChannels()) {
          if (channel.getTargetPath() !== 'translation' || channel.getTargetNode()!.getName() !== spec.body) continue;
          const output = channel.getSampler()!.getOutput()!;
          const low = [Infinity, Infinity, Infinity];
          const high = [-Infinity, -Infinity, -Infinity];
          for (let i = 0; i < output.getCount(); i += 1) {
            output.getElement(i, []).forEach((part, k) => {
              low[k] = Math.min(low[k], part);
              high[k] = Math.max(high[k], part);
            });
          }
          // The body may bob, crouch or sink onto its back, but never travels:
          // under 30 cm any way, on a model about 1.9 m long.
          // A clip that sinks may go further one way (down, which is along one of the bone's own axes), but no further the other two.
          const ranges = [0, 1, 2].map((k) => high[k] - low[k]).sort((a, b) => b - a);
          const sinking = spec.sinks?.includes(clip.getName());
          expect(ranges[0], `${clip.getName()} moves the body`).toBeLessThan(sinking ? 1.2 : 0.3);
          expect(ranges[1], `${clip.getName()} moves the body`).toBeLessThan(0.3);
        }
      }
    });
  }

  it('mosquito: the wings have their own see-through material', () => {
    const materials = files.get('mosquito')!.getRoot().listMaterials();
    const wings = materials.find((material) => material.getName() === 'wings');
    expect(wings?.getAlphaMode()).toBe('BLEND');
    expect(wings!.getBaseColorFactor()[3]).toBeLessThan(0.8);
    expect(materials.filter((material) => material.getAlphaMode() === 'OPAQUE').length).toBe(1);
  });
});
