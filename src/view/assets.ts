// Downloads the files the 3D picture needs (textures, the forest light, hero
// models) and reports how far along it is, for the progress bar on the start
// screen. The files are made by scripts/build-assets.mjs and live in media/.

import {
  EquirectangularReflectionMapping,
  PMREMGenerator,
  RepeatWrapping,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

/** The surface pictures, by what they are used for. File names are in CREDITS.md. */
const SETS = {
  bark: 'bark_brown_02',
  rock: 'mossy_rock',
  moss: 'aerial_grass_rock',
  mossWood: 'moss_wood',
  ground: 'coast_sand_rocks_02',
} as const;

export type SetName = keyof typeof SETS;

export interface TextureSet {
  /** What the surface looks like. */
  color: Texture;
  /** Fine bumps, as directions. */
  normal: Texture;
}

export interface Assets {
  sets: Record<SetName, TextureSet>;
  /**
   * The forest light, ready to light every surface. Worked out the first time
   * it is asked for, because plain shading (the lowest tier) never needs it.
   */
  environment(): Texture;
  /** Hero and stand-in models that were asked for, by file name. */
  models: Map<string, GLTF>;
  /** Sharper textures at a slant, as far as the device allows. */
  setAnisotropy(level: number): void;
}

declare const __BUILD_ID__: string;

/** Address of a file in media/, with the build's stamp so an old copy is never reused. */
const media = (path: string): string => `${import.meta.env.BASE_URL}media/${path}?v=${__BUILD_ID__}`;

/**
 * Loads everything. `onProgress` is called with a number from 0 to 1.
 * `modelFiles` are the GLB files to fetch, such as 'yaarbro.glb'.
 */
export const loadAssets = async (
  renderer: WebGLRenderer,
  modelFiles: string[],
  onProgress: (share: number) => void,
): Promise<Assets> => {
  // The loader brings its own decoder, which the build bundles with the game's code.
  const ktx2 = new KTX2Loader().detectSupport(renderer);
  const gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  const hdr = new HDRLoader();

  // Progress: every file counts the same, and a file part-way down counts in part.
  const shares: number[] = [];
  const report = (): void => onProgress(shares.reduce((sum, share) => sum + share, 0) / shares.length);
  const track = <T>(start: (onPart: (event: ProgressEvent) => void) => Promise<T>): Promise<T> => {
    const index = shares.push(0) - 1;
    return start((event) => {
      if (event.lengthComputable && event.total > 0) {
        shares[index] = Math.min(event.loaded / event.total, 0.95);
        report();
      }
    }).then((result) => {
      shares[index] = 1;
      report();
      return result;
    });
  };

  const names = Object.keys(SETS) as SetName[];
  const textures = names.flatMap((name) => [
    track((onPart) => ktx2.loadAsync(media(`textures/${SETS[name]}_color.ktx2`), onPart)),
    track((onPart) => ktx2.loadAsync(media(`textures/${SETS[name]}_normal.ktx2`), onPart)),
  ]);
  const sky = track((onPart) => hdr.loadAsync(media('hdri/forest.hdr'), onPart));
  const models = modelFiles.map((file) => track((onPart) => gltf.loadAsync(media(`models/${file}`), onPart)));

  const [loadedTextures, loadedSky, loadedModels] = await Promise.all([
    Promise.all(textures),
    sky,
    Promise.all(models),
  ]);

  const all: Texture[] = [];
  const sets = {} as Record<SetName, TextureSet>;
  names.forEach((name, i) => {
    const color = loadedTextures[i * 2];
    const normal = loadedTextures[i * 2 + 1];
    for (const texture of [color, normal]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      all.push(texture);
    }
    sets[name] = { color, normal };
  });

  loadedSky.mapping = EquirectangularReflectionMapping;
  let environment: Texture | null = null;

  const byFile = new Map<string, GLTF>();
  modelFiles.forEach((file, i) => byFile.set(file, loadedModels[i]));
  ktx2.dispose();

  return {
    sets,
    environment() {
      if (!environment) {
        // Blur the forest picture into light for rough and shiny surfaces alike.
        const blur = new PMREMGenerator(renderer);
        environment = blur.fromEquirectangular(loadedSky).texture;
        blur.dispose();
        loadedSky.dispose();
      }
      return environment;
    },
    models: byFile,
    setAnisotropy(level) {
      const most = renderer.capabilities.getMaxAnisotropy();
      for (const texture of all) {
        texture.anisotropy = Math.max(1, Math.min(level, most));
        texture.needsUpdate = true;
      }
    },
  };
};
