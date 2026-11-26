// Walblum's model file (assets/heroes/walblum.glb, rigged by
// tools/rig-walblum.py): small, with a skeleton and every clip the game and
// the kick ask for. This catches a file compressed from the wrong original,
// or a script that lost a clip.

import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';
import { WALBLUM_MODEL } from '../src/view/rescue';

const path = `assets/heroes/${WALBLUM_MODEL}`;
let file: Document;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  file = await io.readBinary(new Uint8Array(readFileSync(path)));
});

describe("Walblum's model file", () => {
  it('is compressed, small and light: he is one more model at the dock, the lake\'s heaviest place', () => {
    expect(statSync(path).size).toBeLessThan(500 * 1024);
    const triangles = file.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, primitive) => sum + (primitive.getIndices()?.getCount() ?? 0) / 3, 0);
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(file.getRoot().listExtensionsUsed().map((extension) => extension.extensionName)).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']));
  });

  it('has one skeleton, and the clips for the rescue (scared, paddle, cheer, idle) and for the kick (kick, spin)', () => {
    expect(file.getRoot().listSkins().length).toBe(1);
    expect(file.getRoot().listAnimations().map((clip) => clip.getName()).sort()).toEqual(['cheer', 'idle', 'kick', 'paddle', 'scared', 'spin']);
  });
});
