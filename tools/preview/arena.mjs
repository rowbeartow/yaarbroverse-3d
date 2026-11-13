// Builds the arena preview page: the page the owner watches enemies (and a
// boss) on, at full speed, before a change to how they behave is merged.
// It runs the game's own rules, numbers, enemy drawing and hero drawing in a
// plain blocked-out copy of the level, so what moves on the page is what
// moves in the game. The scenery is not the game's: banks are flat turf.
//
//   node tools/preview/arena.mjs <folder> marmot=<rigged.glb> mosquito=<rigged.glb> yaarbro=<rigged.glb> caputo=<rigged.glb>
//
//   folder       where to put the page. Anything already there is replaced.
//   rigged.glb   each model as its Blender script wrote it, before it is
//                compressed (CLAUDE.md gives the four commands)
//
// Run `npm run assets` first: the page uses the game's forest light.
//
// Like the other preview pages, it is made to be published as a private
// Claude artifact: models and the forest light travel as base64 text in .txt
// files, and each model's colour picture as a JPG beside it.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4179`, then
// open http://localhost:4179/ (add ?plain for flat light on a machine with no
// graphics card). `node tools/preview/arena-stills.mjs` takes still frames.
//
// To publish it (a Claude session does this with its Artifact tool): the page
// is <folder>/index.html, with <folder> as the root, and every file listed in
// <folder>/files.json goes with it at the same path. What the page shows
// (which places, and the words about each) is the PLACES table in arena.ts;
// the words around the picture are written by hand in arena.html.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prune, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import { build } from 'vite';
import { modelIO } from '../../scripts/lib/compress-model.mjs';
import { fillGaps } from '../../scripts/lib/fill-gaps.mjs';

const [out, ...pairs] = process.argv.slice(2);
const wanted = ['marmot', 'mosquito', 'yaarbro', 'caputo'];
const given = Object.fromEntries(pairs.filter((pair) => pair.includes('=')).map((pair) => pair.split('=')));
if (!out || wanted.some((name) => !given[name])) {
  console.error('Usage: node tools/preview/arena.mjs <folder> marmot=<rigged.glb> mosquito=<rigged.glb> yaarbro=<rigged.glb> caputo=<rigged.glb>');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const media = join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(media, { recursive: true });
const files = ['arena.js', 'media/forest.hdr.txt', 'media/turf_color.jpg', 'media/turf_normal.jpg'];

const io = await modelIO();
for (const name of wanted) {
  const document = await io.readBinary(new Uint8Array(readFileSync(given[name])));
  document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  await document.transform(fillGaps(1024), resample());
  const root = document.getRoot();
  const color = root.listMaterials().map((material) => material.getBaseColorTexture()).find(Boolean);
  await sharp(Buffer.from(color.getImage())).resize(1024, 1024, { fit: 'inside' }).jpeg({ quality: 86 }).toFile(join(media, `${name}_color.jpg`));
  for (const material of root.listMaterials()) {
    material.setBaseColorTexture(null).setMetallicRoughnessTexture(null).setNormalTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  }
  // The model keeps its picture coordinates, though the picture now travels beside it.
  await document.transform(prune({ keepAttributes: true }));
  writeFileSync(join(media, `${name}.glb.txt`), Buffer.from(await io.writeBinary(document)).toString('base64'));
  files.push(`media/${name}.glb.txt`, `media/${name}_color.jpg`);
  console.log(`${name}: ${root.listAnimations().map((animation) => animation.getName()).join(', ')}`);
}

// The game's forest light, and the turf the banks are covered in.
writeFileSync(join(media, 'forest.hdr.txt'), readFileSync('public/media/hdri/forest.hdr').toString('base64'));
const turf = 'assets/textures/aerial_grass_rock/aerial_grass_rock';
await sharp(`${turf}_diff_1k.jpg`).resize(512).jpeg({ quality: 82 }).toFile(join(media, 'turf_color.jpg'));
await sharp(`${turf}_nor_gl_1k.jpg`).resize(512).jpeg({ quality: 82 }).toFile(join(media, 'turf_normal.jpg'));

await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: join(here, 'arena.ts'), formats: ['es'], fileName: () => 'arena.js' },
    chunkSizeWarningLimit: 2000,
  },
});
copyFileSync(join(here, 'arena.html'), join(out, 'index.html'));
writeFileSync(join(out, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
console.log(`The arena page is in ${out}`);
