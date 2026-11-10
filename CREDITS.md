# Credits

Everything in the game that this project did not make itself is listed here, with where it came from and its license. Every file below is CC0: the maker gave up all rights, so anyone may use it for anything.

The Yaarbroverse, its characters and their art are not CC0. They are all rights reserved (see README.md).

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

The build environment cannot reach polyhaven.com, so the Poly Haven files were taken from public copies on GitHub that keep Poly Haven's own file names. They were not compared byte for byte with Poly Haven's downloads. To replace any of them with a fresh download, open its Poly Haven page above, download the 1K JPG maps, and put them in the same folder under the same names.

- Forest light: `hdri/forest_slope_1k.hdr` from `pmndrs/drei-assets` at commit `456060a26bbeb8fdf79326f224b6d99b8bcce736`. SHA-256 `926a6bb81897919b2924f42407162b8d54be91eab2da3fe7fe19daf308cfa09a`.
- Textures: `<name>_diff_1k.png` and `<name>_nor_gl_1k.png` from `FT1E/Game-Scripts` at commit `0c78653982ae4337a4aa1402833b399a213f3879`, folder `Assets/GreenMossGames/UltimateMaterialLibrary/Textures/`. They were re-saved here from PNG to JPEG (quality 92) to keep the repo small. SHA-256 of each PNG as fetched:

| File | SHA-256 |
| --- | --- |
| `aerial_grass_rock_diff_1k.png` | `375dcb05aaced6f690ae53016a45f9a6b780a5b66f77f0a53a90ce840b4d71bc` |
| `aerial_grass_rock_nor_gl_1k.png` | `23bf3adc3f0d2a59eac317718377ca681dab9398fe824eb89925f89a2469f62e` |
| `bark_brown_02_diff_1k.png` | `22144dbe0e9f1cfd44de3f3c8311c898fe672f087c1e81a18baab77476dc046f` |
| `bark_brown_02_nor_gl_1k.png` | `45c632c61b642759ee935a4300b71aa1e6097d2b2d8aae42376c4661ecc518eb` |
| `coast_sand_rocks_02_diff_1k.png` | `0e3f365244065de9f1a1b230f7b1024d86dd5a0a52dd2ee31a47ff88a776ba38` |
| `coast_sand_rocks_02_nor_gl_1k.png` | `5c4ce25cd6cf0954adf35c02c057746e95c9e968972a1d98f4dc3879f31d4a59` |
| `moss_wood_diff_1k.png` | `7db8e60272fb2816ba4025522e134c02bfdab062bfcf054667768e20551349f5` |
| `moss_wood_nor_gl_1k.png` | `3ff73d9e43e96d4aff2a19b261b0eabfa0136b1b838fa57c87a31308b4e5849c` |
| `mossy_rock_diff_1k.png` | `f829810c87e0cc54dda4b9cb03eeca703ec53e9cc7e6820cf0936f89b3e2cfa6` |
| `mossy_rock_nor_gl_1k.png` | `08b01ee4387e4bb3433f901c62acc40d4be8d6d4a481e5fb508400cb4664d82e` |

- Stand-in model: `examples/models/gltf/RobotExpressive/RobotExpressive.glb` from `mrdoob/three.js`, `dev` branch, fetched 2026-11-10. SHA-256 `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319`.

## Made here

Drawn in code when the game starts, so there is no file to credit: the cut rings on stumps and log ends, mushroom caps and gills, fir boughs, fern fronds, the golden leaf, the sky, the mist, shafts of light and the leaf shade. See `src/view/pictures.ts`. The shapes of everything in the grove are built in code too (`src/view/scenery.ts`, `src/view/forest.ts`).

## Code libraries shipped with the game

Not assets, but part of what a player downloads: [three.js](https://threejs.org) (MIT), which includes the Basis Universal texture decoder (Apache 2.0) and the meshopt decoder (MIT).
