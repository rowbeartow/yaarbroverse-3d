// Turns a hero's original model file into the small file the game downloads,
// and saves it in assets/heroes/. The originals are far too big to keep in
// this repo (20 to 30 MB each), so only what this makes is committed.
//
//   node tools/compress-hero.mjs <original.glb> <name> [texture size]
//
//   original.glb   the file from Meshy, or from tools/rig-quadruped.py
//   name           yaarbro or caputo: the file is saved as assets/heroes/<name>.glb
//   texture size   the size of the colour picture, 2048 unless given
//
// What it does:
//   1. Fills the empty gaps in the model's pictures with the colours next to
//      them. Meshy packs a hero's skin into many small patches with black
//      between them, and without this the black shows as dark seams once the
//      pictures are made smaller.
//   2. Shrinks the pictures and stores them as KTX2, which stays compressed
//      on the graphics card.
//   3. Packs the shape and the animation with meshopt.
// It then lists the animation clips in the file, by name and length.
//
// The owner keeps the originals as files on the "hero-models" release:
// https://github.com/rowbeartow/yaarbroverse-3d/releases

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compressModel, modelIO } from '../scripts/lib/compress-model.mjs';
import { fillGaps } from '../scripts/lib/fill-gaps.mjs';

const [from, name, sizeText = '2048'] = process.argv.slice(2);
if (!from || !name) {
  console.error('Usage: node tools/compress-hero.mjs <original.glb> <name> [texture size]');
  process.exit(1);
}
const colorSize = Number(sizeText);
const to = join('assets', 'heroes', `${name}.glb`);

const io = await modelIO();
const document = await io.readBinary(new Uint8Array(readFileSync(from)));
// The picture encoder prints a page of its own notes; keep them off the screen.
const print = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;
try {
  await compressModel(document, { textureSize: colorSize, before: [fillGaps(colorSize)] });
} finally {
  process.stdout.write = print;
}
const bytes = Buffer.from(await io.writeBinary(document));
mkdirSync(dirname(to), { recursive: true });
writeFileSync(to, bytes);

const megabytes = (count) => `${(count / (1024 * 1024)).toFixed(2)} MB`;
console.log(`${from} (${megabytes(readFileSync(from).length)})  ->  ${to} (${megabytes(bytes.length)})`);
const root = document.getRoot();
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    const corners = primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount();
    console.log(`Shape: ${corners / 3} triangles, ${primitive.getAttribute('POSITION').getCount()} points`);
  }
}
for (const skin of root.listSkins()) console.log(`Skeleton: ${skin.listJoints().length} bones`);
const clips = root.listAnimations();
console.log(clips.length ? 'Clips:' : 'Clips: none');
for (const clip of clips) {
  const length = Math.max(...clip.listSamplers().map((sampler) => sampler.getInput().getMax([])[0]));
  console.log(`  ${clip.getName()}  ${length.toFixed(2)} s`);
}
