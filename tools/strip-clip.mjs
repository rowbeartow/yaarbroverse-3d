// Makes a Meshy clip file small enough to commit: keeps the skeleton and its
// one clip exactly as Meshy sent them, swaps the model for a single small
// triangle and removes the pictures, so no art goes into the repo. That is
// all tools/prepare-rigged.py reads from a clip file it retargets.
//
//   node tools/strip-clip.mjs <in.glb> <out.glb>

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node tools/strip-clip.mjs <in.glb> <out.glb>');
  process.exit(1);
}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(input);
const root = document.getRoot();
const buffer = root.listBuffers()[0];
for (const mesh of root.listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    for (const semantic of primitive.listSemantics()) primitive.setAttribute(semantic, null);
    for (const target of primitive.listTargets()) primitive.removeTarget(target);
    const accessor = (type, array) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    primitive.setAttribute('POSITION', accessor('VEC3', new Float32Array([0, 0, 0, 0.01, 0, 0, 0, 0.01, 0])));
    primitive.setAttribute('JOINTS_0', accessor('VEC4', new Uint16Array(12)));
    primitive.setAttribute('WEIGHTS_0', accessor('VEC4', new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
    primitive.setIndices(accessor('SCALAR', new Uint16Array([0, 1, 2])));
    primitive.setMaterial(null);
  }
}
for (const material of root.listMaterials()) material.dispose();
for (const texture of root.listTextures()) texture.dispose();
await document.transform(prune());
await io.write(output, document);
