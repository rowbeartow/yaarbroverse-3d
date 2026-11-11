// Builds the page the owner picks an enemy model on: every candidate that
// tools/meshy-image-to-3d.mjs made, in the game's light, turning slowly, with
// its letter. Nothing here is rigged or animated yet.
//
//   node tools/preview/candidates.mjs <models folder> <folder>
//
//   models folder   where tools/meshy-image-to-3d.mjs saved the models, with
//                   its <name>.candidates.json lists and <name>-ref.png pictures
//   folder          where to put the page. Anything already there is replaced.
//
// Run `npm run assets` first: the page uses the game's forest light.
//
// Like the hero preview page (build.mjs), it is made to be published as a
// private Claude artifact: models and the forest light travel as base64 text
// in .txt files, and each model's colour picture as a JPG beside it.
//
// To look at it here: `npx vite preview --outDir <folder> --port 4175`, then
// open http://localhost:4175/ (add ?plain for flat light on a machine with no
// graphics card, and ?still to stop the turning).
//
// To publish it (a Claude session does this with its Artifact tool): the page
// is <folder>/index.html, with <folder> as the root, and every file listed in
// <folder>/files.json goes with it at the same path.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prune } from '@gltf-transform/functions';
import sharp from 'sharp';
import { build } from 'vite';
import { modelIO } from '../../scripts/lib/compress-model.mjs';
import { fillGaps } from '../../scripts/lib/fill-gaps.mjs';

const [from, out] = process.argv.slice(2);
if (!from || !out) {
  console.error('Usage: node tools/preview/candidates.mjs <models folder> <folder>');
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const media = join(out, 'media');
rmSync(out, { recursive: true, force: true });
mkdirSync(media, { recursive: true });
const files = ['candidates.js', 'media/candidates.json', 'media/forest.hdr.txt', 'media/turf_color.jpg', 'media/turf_normal.jpg'];

const io = await modelIO();
const enemies = [];
for (const listFile of readdirSync(from).filter((file) => file.endsWith('.candidates.json')).sort()) {
  const name = listFile.replace('.candidates.json', '');
  const enemy = { name, picture: null, candidates: [] };
  const picture = join(from, `${name}-ref.png`);
  if (existsSync(picture)) {
    enemy.picture = `media/${name}-ref.png`;
    await sharp(picture).resize(512).png().toFile(join(out, enemy.picture));
    files.push(enemy.picture);
  }
  for (const candidate of JSON.parse(readFileSync(join(from, listFile), 'utf8'))) {
    if (candidate.failed) {
      enemy.candidates.push({ letter: candidate.letter, label: candidate.label, failed: candidate.failed });
      continue;
    }
    const document = await io.readBinary(new Uint8Array(readFileSync(join(from, candidate.file))));
    document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
    await document.transform(fillGaps(1024));
    const root = document.getRoot();
    let triangles = 0;
    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
      }
    }
    const base = `media/${name}-${candidate.letter}`;
    const material = root.listMaterials()[0];
    const color = material?.getBaseColorTexture();
    if (color) {
      await sharp(Buffer.from(color.getImage())).jpeg({ quality: 88 }).toFile(join(out, `${base}_color.jpg`));
      files.push(`${base}_color.jpg`);
    }
    for (const each of root.listMaterials()) {
      each.setBaseColorTexture(null).setMetallicRoughnessTexture(null).setNormalTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
    }
    await document.transform(prune({ keepAttributes: true }));
    writeFileSync(join(out, `${base}.glb.txt`), Buffer.from(await io.writeBinary(document)).toString('base64'));
    files.push(`${base}.glb.txt`);
    enemy.candidates.push({
      letter: candidate.letter,
      label: candidate.label,
      model: `${base}.glb.txt`,
      color: color ? `${base}_color.jpg` : null,
      triangles: Math.round(triangles),
    });
    console.log(`${name} ${candidate.letter}: ${Math.round(triangles)} triangles`);
  }
  enemies.push(enemy);
}
writeFileSync(join(media, 'candidates.json'), `${JSON.stringify(enemies, null, 2)}\n`);

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
    lib: { entry: join(here, 'candidates.ts'), formats: ['es'], fileName: () => 'candidates.js' },
    chunkSizeWarningLimit: 2000,
  },
});
copyFileSync(join(here, 'candidates.html'), join(out, 'index.html'));
writeFileSync(join(out, 'files.json'), `${JSON.stringify(files, null, 2)}\n`);
console.log(`The candidates page is in ${out}`);
