// Builds the preview page for a hero: the page the owner looks at before a
// change to a hero's model or movement is merged. It shows the hero in the
// game's light, playing each clip, the clips mixed as the game mixes them, and
// slow side views of the walk and the run.
//
//   node tools/preview/build.mjs <rigged.glb> <folder>
//
//   rigged.glb   the model from tools/rig-quadruped.py, before it is compressed
//   folder       where to put the page. Anything already there is replaced.
//
// Run `npm run assets` first: the page uses the game's forest light.
//
// The page is made to be published as a private Claude artifact, which cannot
// run the decoders the game uses for its compressed files. So the folder
// holds the model with plain geometry, and its pictures as ordinary JPG and
// PNG files. An artifact takes only web media and plain text, so the model
// and the forest light are written as base64 text in .txt files.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4174`, then
// open http://localhost:4174/ (add ?plain for flat light on a machine with no
// graphics card).

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prune, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import { build } from 'vite';
import { modelIO } from '../../scripts/lib/compress-model.mjs';
import { fillGaps } from '../../scripts/lib/fill-gaps.mjs';

const [from, out] = process.argv.slice(2);
if (!from || !out) {
  console.error('Usage: node tools/preview/build.mjs <rigged.glb> <folder>');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const media = join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(media, { recursive: true });

// The model: pictures out, clips thinned, nothing compressed.
const io = await modelIO();
const document = await io.readBinary(new Uint8Array(readFileSync(from)));
document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
await document.transform(fillGaps(1024), resample());
const material = document.getRoot().listMaterials()[0];
const color = material.getBaseColorTexture();
const surface = material.getMetallicRoughnessTexture();
await sharp(Buffer.from(color.getImage())).jpeg({ quality: 88 }).toFile(join(media, 'caputo_color.jpg'));
if (surface) await sharp(Buffer.from(surface.getImage())).png().toFile(join(media, 'caputo_mr.png'));
material.setBaseColorTexture(null).setMetallicRoughnessTexture(null);
// The model keeps its picture coordinates, though the pictures now travel beside it.
await document.transform(prune({ keepAttributes: true }));
writeFileSync(join(media, 'caputo.glb.txt'), Buffer.from(await io.writeBinary(document)).toString('base64'));

// The game's forest light, and the turf the banks are covered in.
writeFileSync(join(media, 'forest.hdr.txt'), readFileSync('public/media/hdri/forest.hdr').toString('base64'));
const turf = 'assets/textures/aerial_grass_rock/aerial_grass_rock';
await sharp(`${turf}_diff_1k.jpg`).resize(512).jpeg({ quality: 82 }).toFile(join(media, 'turf_color.jpg'));
await sharp(`${turf}_nor_gl_1k.jpg`).resize(512).jpeg({ quality: 82 }).toFile(join(media, 'turf_normal.jpg'));

// The page's script, as one file.
await build({
  configFile: false,
  logLevel: 'warn',
  publicDir: false,
  build: {
    outDir: resolve(out),
    emptyOutDir: false,
    target: 'es2022',
    lib: { entry: join(here, 'preview.ts'), formats: ['es'], fileName: () => 'preview.js' },
    chunkSizeWarningLimit: 2000,
  },
});
copyFileSync(join(here, 'index.html'), join(out, 'index.html'));
console.log(`The preview page is in ${out}`);
