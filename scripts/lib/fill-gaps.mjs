// Shared by tools/compress-hero.mjs and tools/preview/build.mjs: makes a
// model's pictures smaller without dark seams. Meshy packs a hero's skin into
// many small patches with black between them; shrunk as they are, the black
// bleeds into the patches' edges. So the pictures are shrunk from the pixels
// the model shows, and the gaps are filled with the colours next to them.

import sharp from 'sharp';

/**
 * Marks every pixel of a `size` by `size` picture whose middle lies inside one
 * of the model's triangles, as the triangles are laid out on the picture.
 */
const coverage = (document, texture, size) => {
  const covered = new Uint8Array(size * size);
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial();
      const uses = material && [material.getBaseColorTexture(), material.getMetallicRoughnessTexture(), material.getEmissiveTexture(), material.getOcclusionTexture()].includes(texture);
      const uv = primitive.getAttribute('TEXCOORD_0');
      if (!uses || !uv) continue;
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : uv.getCount();
      const corner = [0, 0];
      const at = (i) => {
        uv.getElement(indices ? indices.getScalar(i) : i, corner);
        return [corner[0] * size, corner[1] * size];
      };
      for (let i = 0; i + 2 < count; i += 3) {
        const [ax, ay] = at(i);
        const [bx, by] = at(i + 1);
        const [cx, cy] = at(i + 2);
        const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (Math.abs(area) < 1e-9) continue;
        const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
        const right = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
        const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
        const bottom = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
        for (let y = top; y <= bottom; y += 1) {
          for (let x = left; x <= right; x += 1) {
            const px = x + 0.5;
            const py = y + 0.5;
            const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area;
            const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area;
            const w2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / area;
            if (w0 >= 0 && w1 >= 0 && w2 >= 0) covered[y * size + x] = 1;
          }
        }
      }
    }
  }
  return covered;
};

/**
 * Shrinks a picture to `wanted` pixels square using only the pixels the model
 * shows, then fills every other pixel from the nearest ones that are shown.
 */
const shrinkAndFill = async (document, texture, wanted) => {
  const image = sharp(Buffer.from(texture.getImage()));
  const meta = await image.metadata();
  const size = meta.width;
  if (meta.width !== meta.height || size % wanted !== 0) throw new Error(`Cannot shrink a ${meta.width} by ${meta.height} picture to ${wanted}`);
  const pixels = await image.removeAlpha().raw().toBuffer();
  const covered = coverage(document, texture, size);
  const step = size / wanted;

  // Level 0 is the shrunk picture; each level above is half the size again.
  const levels = [];
  let width = wanted;
  let color = new Float32Array(width * width * 3);
  let weight = new Float32Array(width * width);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!covered[y * size + x]) continue;
      const o = Math.floor(y / step) * width + Math.floor(x / step);
      const i = (y * size + x) * 3;
      color[o * 3] += pixels[i];
      color[o * 3 + 1] += pixels[i + 1];
      color[o * 3 + 2] += pixels[i + 2];
      weight[o] += 1;
    }
  }
  levels.push({ width, color, weight });
  while (width > 1) {
    const half = width / 2;
    const nextColor = new Float32Array(half * half * 3);
    const nextWeight = new Float32Array(half * half);
    for (let y = 0; y < width; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const o = (y >> 1) * half + (x >> 1);
        const i = y * width + x;
        nextColor[o * 3] += color[i * 3];
        nextColor[o * 3 + 1] += color[i * 3 + 1];
        nextColor[o * 3 + 2] += color[i * 3 + 2];
        nextWeight[o] += weight[i];
      }
    }
    width = half;
    color = nextColor;
    weight = nextWeight;
    levels.push({ width, color, weight });
  }
  // Turn sums into averages, then fill each empty pixel from the level above.
  for (const level of levels) {
    for (let i = 0; i < level.weight.length; i += 1) {
      if (level.weight[i] > 0) {
        level.color[i * 3] /= level.weight[i];
        level.color[i * 3 + 1] /= level.weight[i];
        level.color[i * 3 + 2] /= level.weight[i];
      }
    }
  }
  for (let l = levels.length - 2; l >= 0; l -= 1) {
    const level = levels[l];
    const above = levels[l + 1];
    for (let y = 0; y < level.width; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const i = y * level.width + x;
        if (level.weight[i] > 0) continue;
        const o = (y >> 1) * above.width + (x >> 1);
        level.color[i * 3] = above.color[o * 3];
        level.color[i * 3 + 1] = above.color[o * 3 + 1];
        level.color[i * 3 + 2] = above.color[o * 3 + 2];
      }
    }
  }
  const out = Buffer.alloc(wanted * wanted * 3);
  for (let i = 0; i < out.length; i += 1) out[i] = Math.round(levels[0].color[i]);
  texture.setImage(new Uint8Array(await sharp(out, { raw: { width: wanted, height: wanted, channels: 3 } }).png().toBuffer()));
  texture.setMimeType('image/png');
};

/**
 * A step for the model compressor: shrink and fill every picture in the
 * model. The colour picture ends up `colorSize` pixels square.
 */
export const fillGaps = (colorSize) => async (document) => {
  const colors = new Set(document.getRoot().listMaterials().flatMap((material) => [material.getBaseColorTexture(), material.getEmissiveTexture()]));
  for (const texture of document.getRoot().listTextures()) {
    // Roughness reads fine at half the size of the colour.
    await shrinkAndFill(document, texture, colors.has(texture) ? colorSize : colorSize / 2);
  }
};
