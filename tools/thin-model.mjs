// Makes a lighter copy of an enemy's model for a level whose frame budget is
// tight: the same skeleton, clips and pictures, with fewer triangles. The
// skeleton moves every point of a model on every frame, so points are what an
// enemy costs. This is how the lake's giant mosquito was made.
//
//   node tools/thin-model.mjs <name> <triangles> [folder]
//
//   name        mosquito, ...: reads assets/<folder>/<name>.glb and writes
//               assets/<folder>/<name>-light.glb
//   triangles   about how many triangles to keep
//   folder      enemies unless given
//
// Look at the result before using it (tools/preview/enemies.mjs): thin parts
// such as legs and wings are the first to suffer.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dequantize, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { modelIO } from '../scripts/lib/compress-model.mjs';

const [name, wanted, folder = 'enemies'] = process.argv.slice(2);
if (!name || !Number(wanted)) {
  console.error('Usage: node tools/thin-model.mjs <name> <triangles> [folder]');
  process.exit(1);
}
const from = join('assets', folder, `${name}.glb`);
const to = join('assets', folder, `${name}-light.glb`);
const io = await modelIO();
const document = await io.readBinary(new Uint8Array(readFileSync(from)));
document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
const count = () => {
  let triangles = 0;
  let points = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
      points += primitive.getAttribute('POSITION').getCount();
    }
  }
  return { triangles, points };
};
const before = count();
await MeshoptSimplifier.ready;
await document.transform(
  dequantize(),
  weld(),
  // `error` is how far a point may move, as a share of the model's size: the limit that stops it before thin parts go.
  simplify({ simplifier: MeshoptSimplifier, ratio: Number(wanted) / before.triangles, error: 0.02, lockBorder: false }),
  prune({ keepAttributes: true }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
const after = count();
const bytes = Buffer.from(await io.writeBinary(document));
writeFileSync(to, bytes);
console.log(`${from}: ${before.triangles} triangles, ${before.points} points`);
console.log(`${to}: ${after.triangles} triangles, ${after.points} points, ${(bytes.length / 1024).toFixed(0)} KB`);
console.log(`Clips: ${document.getRoot().listAnimations().map((clip) => clip.getName()).join(', ')}`);
