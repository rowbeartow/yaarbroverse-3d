// Shared by scripts/build-assets.mjs and tools/compress-hero.mjs: the settings
// for KTX2 textures, and the steps that turn a GLB into the small GLB the game
// downloads (meshopt geometry, KTX2 textures).

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

/** Turns a JPG or PNG into raw pixels at the wanted size, for the KTX2 encoder. */
export const decoderAt = (size) => async (buffer) => {
  let image = sharp(buffer);
  const meta = await image.metadata();
  if (size && (meta.width > size || meta.height > size)) image = image.resize(size, size, { fit: 'inside' });
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

/**
 * Settings for the KTX2 encoder, by what the picture holds:
 *   color   what the surface looks like (stored as sRGB)
 *   normal  which way each point faces, for fine bumps
 *   data    plain numbers, such as roughness
 * `sharp` keeps a colour picture in the sharper, larger format too (for a
 * hero, whose face is looked at closely).
 */
export const ktx2Options = (kind, { sharp: keepSharp = false } = {}) => {
  // ETC1S is the small format. Normals get the sharper UASTC format, squeezed
  // with Zstandard, because blocky normals show up as blocky light.
  const uastc = kind === 'normal' || keepSharp;
  return {
    isKTX2File: true,
    enableDebug: false,
    generateMipmap: true,
    isUASTC: uastc,
    needSupercompression: uastc,
    enableRDO: uastc,
    rdoQualityLevel: 2,
    uastcLDRQualityLevel: 2,
    qualityLevel: 190,
    compressionLevel: 2,
    isNormalMap: kind === 'normal',
    isPerceptual: kind === 'color',
    isSetKTX2SRGBTransferFunc: kind === 'color',
  };
};

/** A reader and writer for GLB files that understands compressed ones. */
export const modelIO = async () => {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
};

/**
 * Compresses a model held in a glTF-Transform document, in place. `textureSize`
 * caps the size of the pictures inside the model. `sharpColor` keeps the colour
 * picture in the sharper format. `before` are extra steps to run first.
 */
export const compressModel = async (document, { textureSize, sharpColor = false, before = [] }) => {
  document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
  await document.transform(
    ...before,
    dedup(),
    prune(),
    resample(),
    textureCompress({ encoder: sharp, resize: [textureSize, textureSize] }),
    // Normal maps keep the sharper format; everything else takes the small one.
    ktx2({ ...ktx2Options('normal'), slots: /^normalTexture$/, imageDecoder: decoderAt(0) }),
    ktx2({ ...ktx2Options('color', { sharp: sharpColor }), slots: /^(baseColorTexture|emissiveTexture)$/, imageDecoder: decoderAt(0) }),
    ktx2({ ...ktx2Options('data'), imageDecoder: decoderAt(0) }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  return document;
};
