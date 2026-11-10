// Turns the source files in assets/ into the compressed files the game
// downloads, in public/media/ (which Vite copies into the build):
//
//   textures  JPG or PNG  ->  KTX2 (stays compressed on the graphics card)
//   models    GLB         ->  GLB with meshopt geometry and KTX2 textures
//   sky light HDR         ->  a smaller HDR (lighting only needs a small one)
//
// Runs before every build and before `npm run dev`. A file is only redone when
// its source or its settings change, so the second run takes a moment.
//
// To add a texture or model: put the source in assets/, add a line to
// TEXTURES or MODELS below, and list it in CREDITS.md if it is not ours.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, textureCompress } from '@gltf-transform/functions';
import { encodeToKTX2 } from 'ktx2-encoder';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SOURCE = 'assets';
const OUT = 'public/media';
const CACHE = 'node_modules/.cache/grove-assets.json';
/** Change this to redo every file (after changing how files are made). */
const RECIPE = 3;

/**
 * Texture files. `kind` says what the picture holds:
 *   color   what the surface looks like (stored as sRGB)
 *   normal  which way each point faces, for fine bumps
 *   data    plain numbers, such as roughness
 */
const TEXTURES = [];
const textureSet = (name, { size = 1024, normal = 'nor_gl', data = 'arm' } = {}) => {
  const folder = `textures/${name}`;
  TEXTURES.push({ from: `${folder}/${name}_diff_1k.jpg`, to: `textures/${name}_color.ktx2`, kind: 'color', size });
  // Bumps read fine at half the size of the colour, and the file is a quarter as big.
  if (normal) TEXTURES.push({ from: `${folder}/${name}_${normal}_1k.jpg`, to: `textures/${name}_normal.ktx2`, kind: 'normal', size: size / 2 });
  if (data) TEXTURES.push({ from: `${folder}/${name}_${data}_1k.jpg`, to: `textures/${name}_arm.ktx2`, kind: 'data', size: size / 2 });
};
for (const folder of existsSync(join(SOURCE, 'textures')) ? readdirSync(join(SOURCE, 'textures')).sort() : []) {
  if (!statSync(join(SOURCE, 'textures', folder)).isDirectory()) continue;
  const has = (suffix) => existsSync(join(SOURCE, 'textures', folder, `${folder}_${suffix}_1k.jpg`));
  textureSet(folder, { normal: has('nor_gl') ? 'nor_gl' : null, data: has('arm') ? 'arm' : has('rough') ? 'rough' : null });
}

/** Model files. `textureSize` caps the size of the pictures inside the model. */
const MODELS = [];
for (const file of existsSync(join(SOURCE, 'models')) ? readdirSync(join(SOURCE, 'models')).sort() : []) {
  if (file.endsWith('.glb')) MODELS.push({ from: `models/${file}`, to: `models/${file}`, textureSize: 1024 });
}

const HDR = [{ from: 'hdri/forest_slope_1k.hdr', to: 'hdri/forest.hdr', width: 512 }];

// ---------- Helpers ----------

const hash = (...parts) => {
  const sum = createHash('sha256');
  for (const part of parts) sum.update(typeof part === 'string' ? part : part);
  return sum.digest('hex').slice(0, 24);
};

let cache = {};
try {
  cache = JSON.parse(readFileSync(CACHE, 'utf8'));
} catch {
  // First run, or node_modules was cleared.
}

/** Every file made (or found up to date) this run. Anything else in OUT is stale and removed. */
const made = new Set();

const write = (to, bytes) => {
  const path = join(OUT, to);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
};

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

/** Makes one output file unless it is already up to date. */
const make = async (to, key, build) => {
  const path = join(OUT, to);
  made.add(path);
  if (cache[to] === key && existsSync(path)) return;
  const started = Date.now();
  const bytes = await build();
  write(to, bytes);
  cache[to] = key;
  console.log(`  ${to}  ${kilobytes(bytes.length)}  (${((Date.now() - started) / 1000).toFixed(1)} s)`);
};

/** Turns a JPG or PNG into raw pixels at the wanted size, for the KTX2 encoder. */
const decoderAt = (size) => async (buffer) => {
  let image = sharp(buffer);
  const meta = await image.metadata();
  if (size && (meta.width > size || meta.height > size)) image = image.resize(size, size, { fit: 'inside' });
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};

/** Settings for the KTX2 encoder, by what the picture holds. */
const ktx2Options = (kind) => ({
  isKTX2File: true,
  enableDebug: false,
  generateMipmap: true,
  // ETC1S is the small format. Normals get the sharper UASTC format, squeezed
  // with Zstandard, because blocky normals show up as blocky light.
  isUASTC: kind === 'normal',
  needSupercompression: kind === 'normal',
  enableRDO: kind === 'normal',
  rdoQualityLevel: 2,
  uastcLDRQualityLevel: 2,
  qualityLevel: 190,
  compressionLevel: 2,
  isNormalMap: kind === 'normal',
  isPerceptual: kind === 'color',
  isSetKTX2SRGBTransferFunc: kind === 'color',
});

// ---------- Sky light (HDR) ----------

/** Reads a Radiance .hdr file into floating point red, green, blue. */
const readHdr = (bytes) => {
  let at = 0;
  const line = () => {
    let text = '';
    while (at < bytes.length && bytes[at] !== 10) text += String.fromCharCode(bytes[at++]);
    at += 1;
    return text;
  };
  if (!line().startsWith('#?')) throw new Error('Not a Radiance .hdr file');
  while (line() !== '') {
    // Skip the header lines up to the blank one.
  }
  const size = /-Y (\d+) \+X (\d+)/.exec(line());
  if (!size) throw new Error('Unsupported .hdr layout');
  const height = Number(size[1]);
  const width = Number(size[2]);
  const pixels = new Float32Array(width * height * 3);
  const row = new Uint8Array(width * 4);
  for (let y = 0; y < height; y += 1) {
    if (bytes[at] !== 2 || bytes[at + 1] !== 2) throw new Error('Only run-length .hdr files are supported');
    at += 4;
    for (let channel = 0; channel < 4; channel += 1) {
      let x = 0;
      while (x < width) {
        let count = bytes[at++];
        if (count > 128) {
          count -= 128;
          const value = bytes[at++];
          while (count-- > 0) row[x++ * 4 + channel] = value;
        } else {
          while (count-- > 0) row[x++ * 4 + channel] = bytes[at++];
        }
      }
    }
    for (let x = 0; x < width; x += 1) {
      const scale = row[x * 4 + 3] === 0 ? 0 : 2 ** (row[x * 4 + 3] - 136);
      const i = (y * width + x) * 3;
      pixels[i] = row[x * 4] * scale;
      pixels[i + 1] = row[x * 4 + 1] * scale;
      pixels[i + 2] = row[x * 4 + 2] * scale;
    }
  }
  return { width, height, pixels };
};

/** Shrinks to the wanted width by averaging blocks of pixels. */
const shrinkHdr = ({ width, height, pixels }, wanted) => {
  const step = Math.max(1, Math.round(width / wanted));
  const w = Math.floor(width / step);
  const h = Math.floor(height / step);
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let dy = 0; dy < step; dy += 1) {
          for (let dx = 0; dx < step; dx += 1) sum += pixels[((y * step + dy) * width + x * step + dx) * 3 + c];
        }
        out[(y * w + x) * 3 + c] = sum / (step * step);
      }
    }
  }
  return { width: w, height: h, pixels: out };
};

/** Writes floating point pixels back out as a plain (not run-length) .hdr file. */
const writeHdr = ({ width, height, pixels }) => {
  const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`, 'latin1');
  const body = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const r = pixels[i * 3];
    const g = pixels[i * 3 + 1];
    const b = pixels[i * 3 + 2];
    const most = Math.max(r, g, b);
    if (most < 1e-32) continue;
    let exponent = Math.ceil(Math.log2(most));
    if (most / 2 ** exponent >= 1) exponent += 1;
    const scale = 256 / 2 ** exponent;
    body[i * 4] = Math.min(255, Math.floor(r * scale));
    body[i * 4 + 1] = Math.min(255, Math.floor(g * scale));
    body[i * 4 + 2] = Math.min(255, Math.floor(b * scale));
    body[i * 4 + 3] = exponent + 128;
  }
  // A file that starts 2, 2 would be read as run-length. Nudge it if so.
  if (body[0] === 2 && body[1] === 2) body[0] = 3;
  return Buffer.concat([header, body]);
};

// ---------- Run ----------

console.log('Preparing assets');
mkdirSync(OUT, { recursive: true });

for (const item of TEXTURES) {
  const source = readFileSync(join(SOURCE, item.from));
  const options = ktx2Options(item.kind);
  await make(item.to, hash(source, JSON.stringify([options, item.size, RECIPE])), async () =>
    Buffer.from(await encodeToKTX2(new Uint8Array(source), { ...options, imageDecoder: decoderAt(item.size) })),
  );
}

if (MODELS.length > 0) {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  for (const item of MODELS) {
    const source = readFileSync(join(SOURCE, item.from));
    await make(item.to, hash(source, JSON.stringify([item.textureSize, RECIPE])), async () => {
      const document = await io.readBinary(new Uint8Array(source));
      document.setLogger({ debug() {}, info() {}, warn() {}, error: console.error });
      await document.transform(
        dedup(),
        prune(),
        resample(),
        textureCompress({ encoder: sharp, resize: [item.textureSize, item.textureSize] }),
        // Normal maps keep the sharper format; everything else takes the small one.
        ktx2({ ...ktx2Options('normal'), slots: /^normalTexture$/, imageDecoder: decoderAt(0) }),
        ktx2({ ...ktx2Options('color'), slots: /^(baseColorTexture|emissiveTexture)$/, imageDecoder: decoderAt(0) }),
        ktx2({ ...ktx2Options('data'), imageDecoder: decoderAt(0) }),
        meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
      );
      return Buffer.from(await io.writeBinary(document));
    });
  }
}

for (const item of HDR) {
  const source = readFileSync(join(SOURCE, item.from));
  await make(item.to, hash(source, JSON.stringify([item.width, RECIPE])), async () =>
    writeHdr(shrinkHdr(readHdr(source), item.width)),
  );
}

// Clear out files from an earlier recipe that nothing makes any more.
const sweep = (folder) => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      sweep(path);
      if (readdirSync(path).length === 0) rmdirSync(path);
    } else if (!made.has(path)) {
      unlinkSync(path);
      console.log(`  removed ${path}`);
    }
  }
};
sweep(OUT);

mkdirSync(dirname(CACHE), { recursive: true });
writeFileSync(CACHE, JSON.stringify(cache, null, 1));

const total = (folder) =>
  readdirSync(folder, { withFileTypes: true }).reduce(
    (sum, entry) => sum + (entry.isDirectory() ? total(join(folder, entry.name)) : statSync(join(folder, entry.name)).size),
    0,
  );
console.log(`Assets ready in ${OUT}: ${(total(OUT) / (1024 * 1024)).toFixed(2)} MB`);
