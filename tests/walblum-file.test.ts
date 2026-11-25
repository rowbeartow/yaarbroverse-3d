// Walblum's model file (assets/heroes/walblum.glb, made by tools/rig-walblum.py
// and tools/compress-hero.mjs): compressed, small, with a skeleton and the
// clips the game and his rescue ask for. And each hero's file has the clip
// its second move plays.

import { readFileSync, statSync } from 'node:fs';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';
import { HERO_MODELS } from '../src/view/hero-model';
import { WALBLUM_FILE } from '../src/view/sidekick';

const files = new Map<string, Document>();
const guide = JSON.parse(readFileSync('tools/walblum.rig.json', 'utf8')) as { triangles: number; clips: Record<string, number> };

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  for (const file of [WALBLUM_FILE, ...Object.values(HERO_MODELS).map((spec) => spec.file)]) {
    files.set(file, await io.readBinary(new Uint8Array(readFileSync(`assets/heroes/${file}`))));
  }
});

const clips = (file: string): Map<string, number> =>
  new Map(
    files
      .get(file)!
      .getRoot()
      .listAnimations()
      .map((clip) => [clip.getName(), Math.max(...clip.listSamplers().map((sampler) => sampler.getInput()!.getMax([])[0]))]),
  );

describe("Walblum's model file", () => {
  it('is compressed, with one skeleton, and small: he is fetched in the middle of a game', () => {
    const root = files.get(WALBLUM_FILE)!.getRoot();
    expect(statSync(`assets/heroes/${WALBLUM_FILE}`).size).toBeLessThan(320 * 1024);
    expect(root.listExtensionsUsed().map((extension) => extension.extensionName)).toEqual(expect.arrayContaining(['EXT_meshopt_compression', 'KHR_texture_basisu']));
    expect(root.listSkins().length).toBe(1);
    const triangles = root.listMeshes().flatMap((mesh) => mesh.listPrimitives()).reduce((sum, part) => sum + part.getIndices()!.getCount() / 3, 0);
    expect(triangles).toBeLessThanOrEqual(guide.triangles);
  });

  it('has every clip its guide lists, each as long as the guide says', () => {
    const has = clips(WALBLUM_FILE);
    for (const [name, seconds] of Object.entries(guide.clips)) {
      expect(has.has(name), name).toBe(true);
      expect(has.get(name)).toBeCloseTo(seconds, 1);
    }
    // The game plays these two as he flies out and back.
    expect([...has.keys()]).toEqual(expect.arrayContaining(['kick', 'tumble']));
  });
});

describe("each hero's second move", () => {
  it("Yaarbro's file has his launch and his catch, and Caputo's his Claw Slash", () => {
    expect([...clips(HERO_MODELS.Yaarbro.file).keys()]).toEqual(expect.arrayContaining(HERO_MODELS.Yaarbro.clips.send!.concat(HERO_MODELS.Yaarbro.clips.take!)));
    expect([...clips(HERO_MODELS.Caputo.file).keys()]).toEqual(expect.arrayContaining(HERO_MODELS.Caputo.clips.send!));
  });

  it('the hero has let go by the time the flier leaves: each launch clip is longer than the wind-up and shorter than a second', () => {
    for (const spec of Object.values(HERO_MODELS)) {
      const long = clips(spec.file).get(spec.clips.send![0])!;
      expect(long).toBeGreaterThan(0.18);
      expect(long).toBeLessThan(1);
    }
  });
});
