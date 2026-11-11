# Credits

Everything in the game that this project did not make itself is listed here, with where it came from and its license. Every file below is CC0: the maker gave up all rights, so anyone may use it for anything.

The Yaarbroverse, its characters and their art are not CC0. They are all rights reserved (see README.md).

## Hero models (all rights reserved, not CC0)

| File in this repo | What it is | Source | License |
| --- | --- | --- | --- |
| `assets/heroes/yaarbro.glb` | Yaarbro: a textured model on a skeleton, with clips for standing, walking, running, jumping, landing and rolling. Put together and cleaned up from the owner's originals by `tools/prepare-rigged.py` and compressed by `tools/compress-hero.mjs`. | Made, rigged and animated by the owner in Meshy from the Caputo Mountain art | All rights reserved |
| `assets/heroes/caputo.glb` | Caputo: a textured model on a skeleton, with clips for standing, walking, running, jumping, falling and landing. The model is the owner's; the skeleton and clips are made by `tools/rig-quadruped.py`, and the file is compressed by `tools/compress-hero.mjs`. | Model made by the owner in Meshy from the Caputo Mountain art. Skeleton and clips made here. | All rights reserved |

## Enemy models (all rights reserved, not CC0)

| File in this repo | What it is | Source | License |
| --- | --- | --- | --- |
| `assets/enemies/marmot.glb` | The marmot scout: a textured model on a skeleton, with clips for watching, shuffling, the acorn warning, the throw, resting, being struck, hopping away and being beaten. The skeleton and clips are made by `tools/rig-quadruped.py`, and the file is compressed by `tools/compress-hero.mjs`. | Model made with Meshy's Image to 3D (Meshy 6) on the owner's account, from the owner's Caputo Mountain art of the marmot scout. Skeleton and clips made here. | All rights reserved |
| `assets/enemies/mosquito.glb` | The giant mosquito: a textured model on a skeleton, with clips for hovering, the dive warning, the dive, resting and being beaten. The skeleton, the see-through wings and the clips are made by `tools/rig-insect.py`, and the file is compressed by `tools/compress-hero.mjs`. | Model made with Meshy's Image to 3D (Meshy 7.1) on the owner's account, from the owner's Caputo Mountain art of the giant mosquito. Skeleton, wings and clips made here. | All rights reserved |

## Forest light

| File in this repo | What it is | Source | License |
| --- | --- | --- | --- |
| `assets/hdri/forest_slope_1k.hdr` | A photograph of a forest in every direction, used to light the scene. Never shown itself. | "Forest Slope" on Poly Haven: https://polyhaven.com/a/forest_slope | CC0 |

## Surface textures

Each texture is a colour picture (`_diff_`) and a picture of fine bumps (`_nor_gl_`), 1024 pixels square.

| Folder in `assets/textures/` | Used for | Source | License |
| --- | --- | --- | --- |
| `bark_brown_02` | Tree trunks, logs, stumps, the bough | https://polyhaven.com/a/bark_brown_02 | CC0 |
| `mossy_rock` | The rock under each bank, bare stone banks, boulders | https://polyhaven.com/a/mossy_rock | CC0 |
| `aerial_grass_rock` | The tops of the mossy banks | https://polyhaven.com/a/aerial_grass_rock | CC0 |
| `moss_wood` | Moss growing over bark and rock | https://polyhaven.com/a/moss_wood | CC0 |
| `coast_sand_rocks_02` | The forest floor in the gully and on the slopes | https://polyhaven.com/a/coast_sand_rocks_02 | CC0 |

## Stand-in model

| File in this repo | What it is | Source | License |
| --- | --- | --- | --- |
| `assets/models/standin.glb` | A rigged, animated robot used to build and check the model loader and animation player. Only downloaded when the address has `?standin`. Not a character in the game. | "RobotExpressive" by Tomás Laulhé (Quaternius), with changes by Don McCurdy, from the three.js examples: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive | CC0 1.0 |

## How the files were fetched

The Poly Haven files were downloaded straight from Poly Haven on 2026-11-10: the list of files for each one from `https://api.polyhaven.com/files/<name>`, and the files themselves from `https://dl.polyhaven.org`. Each download was checked against the checksum Poly Haven publishes for it. To fetch one again, open its Poly Haven page above and download the 1K JPG maps (or the 1K HDR), or use the addresses below.

- Textures: the 1K JPG colour and bump pictures, exactly as Poly Haven serves them, from `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<name>/<file>`. SHA-256 of each:

| File | SHA-256 |
| --- | --- |
| `aerial_grass_rock_diff_1k.jpg` | `57b8041bfe0d0f01430e4dbaad45e7ddddf0a9fc97317f90dbc51f7b0d9e1b5d` |
| `aerial_grass_rock_nor_gl_1k.jpg` | `1aa3e23bff453f152e089b9f83aa36b4901651e019f7e2ca01d5331a9bbbda78` |
| `bark_brown_02_diff_1k.jpg` | `920fa0bed0c9d78c1d530e99795113afd532d7db746de440f4a85d7c83ed0f1a` |
| `bark_brown_02_nor_gl_1k.jpg` | `0d5e691e8ad8bcd093a3587887fda2a6b4a948b5708a4f256f7919584c6eb857` |
| `coast_sand_rocks_02_diff_1k.jpg` | `78eae8ce6209f79417a15ba863fe828f983c22f7e63a9ee3ef504a0062a05ea9` |
| `coast_sand_rocks_02_nor_gl_1k.jpg` | `52776374a8f64aaa8334a87ef8484048baa6f689428a9f8b812004871417ef3e` |
| `moss_wood_diff_1k.jpg` | `758a9720d29ca030d505fac0f8fdd90db172882ff149d8ea730c11d57c98924c` |
| `moss_wood_nor_gl_1k.jpg` | `008a7f7c7b76f9200bf623418b8d350cd81c42e107e9afed01d1102f176d8797` |
| `mossy_rock_diff_1k.jpg` | `4dbf37f1b0465c9c8914213163923be159716f5b97fb6946437b6c5e143ef540` |
| `mossy_rock_nor_gl_1k.jpg` | `232cdd6a9fdfd01bb8bb1f8f604c53dbca79fa0d3d7995edf85c9945757aa8df` |

- Forest light: `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/forest_slope_1k.hdr`. SHA-256 `926a6bb81897919b2924f42407162b8d54be91eab2da3fe7fe19daf308cfa09a`. The copy here was first taken from a public copy on GitHub (`pmndrs/drei-assets` at commit `456060a26bbeb8fdf79326f224b6d99b8bcce736`), before Poly Haven could be reached. It was then compared with Poly Haven's own download and is the same file, byte for byte, so it was not replaced.
- Stand-in model: `examples/models/gltf/RobotExpressive/RobotExpressive.glb` from `mrdoob/three.js`, `dev` branch, fetched 2026-11-10. SHA-256 `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319`.

## Made here

Drawn in code when the game starts, so there is no file to credit: the cut rings on stumps and log ends, mushroom caps and gills, fir boughs, fern fronds, the golden leaf, the sky, the mist, shafts of light and the leaf shade. See `src/view/pictures.ts`. The shapes of everything in the grove are built in code too (`src/view/scenery.ts`, `src/view/forest.ts`).

## Code libraries shipped with the game

Not assets, but part of what a player downloads: [three.js](https://threejs.org) (MIT), which includes the Basis Universal texture decoder (Apache 2.0) and the meshopt decoder (MIT).
