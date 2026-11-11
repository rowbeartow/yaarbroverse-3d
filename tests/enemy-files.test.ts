// The enemy model files in assets/enemies/: each holds a skeleton and the
// clips its behaviour needs, stays small, and happens on the spot. This
// catches a file compressed from the wrong model, or a script that lost a clip.

import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';

/** Each enemy's file, its clips, and the bone its whole body hangs from. */
const ENEMIES = {
  marmot: { clips: ['defeated', 'hit', 'hop', 'idle', 'throw', 'walk', 'warning', 'winded'], body: 'hips' },
  mosquito: { clips: ['defeated', 'dive', 'hover', 'warning', 'winded'], body: 'body' },
} as const;

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
          for (let k = 0; k < 3; k += 1) expect(high[k] - low[k], `${clip.getName()} moves the body`).toBeLessThan(0.3);
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
