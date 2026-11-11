// Builds the preview page for the enemies: the page the owner looks at before
// a change to an enemy's model or clips is merged. Each enemy stands in the
// game's light and plays whichever of its clips is picked.
//
//   node tools/preview/enemies.mjs <folder> <name>=<rigged.glb> [<name>=<rigged.glb> ...]
//
//   folder       where to put the page. Anything already there is replaced.
//   name         marmot or mosquito (what the page says about each enemy and
//                its clips is in enemies.ts)
//   rigged.glb   the model from tools/rig-quadruped.py or tools/rig-insect.py,
//                before it is compressed
//
// Run `npm run assets` first: the page uses the game's forest light.
//
// Like the hero preview page (build.mjs), it is made to be published as a
// private Claude artifact: models and the forest light travel as base64 text
// in .txt files, and each model's colour picture as a JPG beside it.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4176`, then
// open http://localhost:4176/ (add ?plain for flat light on a machine with no
// graphics card). `node tools/preview/enemy-stills.mjs` takes still frames.
//
// To publish it (a Claude session does this with its Artifact tool): the page
// is <folder>/index.html, with <folder> as the root, and every file listed in
// <folder>/files.json goes with it at the same path. To replace the page the
// owner already has, pass that page's address (docs/session-handoff.md gives
// it) so his link stays the same. What the page says under "What to look
// for" and after is written by hand in enemies.html.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prune, resample } from '@gltf-transform/functions';
import sharp from 'sharp';
import { build } from 'vite';
import { modelIO } from '../../scripts/lib/compress-model.mjs';
import { fillGaps } from '../../scripts/lib/fill-gaps.mjs';

const [out, ...pairs] = process.argv.slice(2);
if (!out || pairs.length === 0 || pairs.some((pair) => !pair.includes('='))) {
  console.error('Usage: node tools/preview/enemies.mjs <folder> <name>=<rigged.glb> [<name>=<rigged.glb> ...]');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const media = join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(media, { recursive: true });
const files = ['enemies.js', 'media/enemies.json', 'media/forest.hdr.txt', 'media/turf_color.jpg', 'media/turf_normal.jpg'];

const io = await modelIO();
const enemies = [];
for (const pair of pairs) {
  const [name, from] = pair.split('=');
  const document = await io.readBinary(new Uint8Array(readFileSync(from)));
  document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  await document.transform(fillGaps(1024), resample());
  const root = document.getRoot();
  const color = root.listMaterials().map((material) => material.getBaseColorTexture()).find(Boolean);
  await sharp(Buffer.from(color.getImage())).jpeg({ quality: 88 }).toFile(join(media, `${name}_color.jpg`));
  for (const material of root.listMaterials()) {
    material.setBaseColorTexture(null).setMetallicRoughnessTexture(null).setNormalTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  }
  // The model keeps its picture coordinates, though the picture now travels beside it.
  await document.transform(prune({ keepAttributes: true }));
  writeFileSync(join(media, `${name}.glb.txt`), Buffer.from(await io.writeBinary(document)).toString('base64'));
  files.push(`media/${name}.glb.txt`, `media/${name}_color.jpg`);
  enemies.push({
    name,
    model: `media/${name}.glb.txt`,
    color: `media/${name}_color.jpg`,
    clips: root.listAnimations().map((animation) => animation.getName()),
  });
  console.log(`${name}: ${enemies.at(-1).clips.join(', ')}`);
}
writeFileSync(join(media, 'enemies.json'), `${JSON.stringify(enemies, null, 2)}\n`);

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
    lib: { entry: join(here, 'enemies.ts'), formats: ['es'], fileName: () => 'enemies.js' },
    chunkSizeWarningLimit: 2000,
  },
});
copyFileSync(join(here, 'enemies.html'), join(out, 'index.html'));
writeFileSync(join(out, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
console.log(`The enemies page is in ${out}`);
