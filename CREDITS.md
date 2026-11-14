# Credits

Everything in the game that this project did not make itself is listed here, with where it came from and its license. Every third-party file below is CC0: the maker gave up all rights, so anyone may use it for anything.

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

## Sound and music

Recorded files, in `assets/audio/`. All are CC0, from OpenGameArt, downloaded on 2026-11-12 (the four marked 2026-11-14 on that day). Nothing came from the 2D game, which has no sound files, and no recording here is of a voice. Each short sound was made mono, cut to its sounding part and given a clean start and end; nothing else was changed unless the table says so.

| File in this repo | What it is | Source | License |
| --- | --- | --- | --- |
| `step-moss-1.wav` to `step-moss-4.wav` | Footsteps on moss. The pack's `SandL1`, `SandR1`, `SandL2` and `SandR2` (its grass and sand steps), softened above 2,600 hertz. | "Fantozzi's Footsteps (Grass/Sand & Stone)" by Fantozzi (submitted by qubodup): https://opengameart.org/content/fantozzis-footsteps-grasssand-stone | CC0 |
| `step-wood-1.wav` to `step-wood-3.wav` | Footsteps on wood (the pack's `wood01` to `wood03`, with the deep bass under 160 hertz taken down so small speakers carry them). | "Different steps on wood, stone, leaves, gravel and mud" by TinyWorlds: https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud | CC0 |
| `pounce.wav`, `marmot-throw.wav` | Caputo's pounce (`swish-9`) and the marmot scout's throw (`swish-13`). | "Swishes Sound Pack" by artisticdude: https://opengameart.org/content/swishes-sound-pack | CC0 |
| `strike.wav` | Landing on an enemy (`thwack-02`). | "Thwack Sounds" by AntumDeluge: https://opengameart.org/content/thwack-sounds | CC0 |
| `bounce.wav`, `step-mushroom.wav` | The mushroom bounce (the first 0.7 seconds of `boing.flac`) and a footstep on a mushroom cap (its first moment, played higher and shorter). | "Boing" by Aeva: https://opengameart.org/content/boing | CC0 |
| `hit.wav` | The hero is hit (`qubodupPunch05`). | "Punch" by qubodup: https://opengameart.org/content/punch | CC0 |
| `roll.wav` | Yaarbro's roll: two seconds of a ball rolling, joined end to start so it loops. | "Bowling Ball Rolling" by qubodup: https://opengameart.org/content/bowling-ball-rolling | CC0 |
| `checkpoint.wav`, `hearts-out.wav` | Reaching a checkpoint (`Chime_Confirm`) and running out of hearts (`Chime_Exit`). | "Chimey UI Sounds" by MouseBYTE: https://opengameart.org/content/chimey-ui-sounds | CC0 |
| `fall.wav` | Falling: the first second of the wind. | "Short wind sound" by remaxim: https://opengameart.org/content/short-wind-sound | CC0 |
| `marmot-warning.wav` | The marmot scout's warning: a squeaky toy (`squeak2`), played a fifth lower. | "Squeak Toy Sounds" by bart: https://opengameart.org/content/squeak-toy-sounds | CC0 |
| `button.wav` | Menu buttons (`select_002`). | "Interface Sounds" by Kenney (www.kenney.nl): https://opengameart.org/content/interface-sounds | CC0 |
| `leaf-tune.mp3` | The tune for finding the golden leaf (`Heavy_ConceptB.wav`), evened to a steady loudness and saved as MP3. | "Victory Fanfare Short" by cynicmusic (pixelsphere.org): https://opengameart.org/content/victory-fanfare-short | CC0 |
| `grove-music.mp3` | The grove's music: a calm track of 1 minute 22 seconds that loops (`Forest Whisper.wav`), evened to a steady loudness and saved as MP3. | "Forest Whisper Theme" by Cleyton Kauffman (https://soundcloud.com/cleytonkauffman): https://opengameart.org/content/forest-whisper-theme | CC0 |
| `boss-music.mp3` | The music of a boss fight: 40 seconds from the middle of the track (8 to 48 seconds in), joined end to start so it loops, set to the grove music's loudness and saved as MP3. | "Battle Theme" by Wolfgang_: https://opengameart.org/content/battle-theme-0 | CC0 |
| `boss-beaten.wav` | A boss is beaten (`PositiveChoice`), with a longer fade out. | "Short Jingle" by OO: https://opengameart.org/content/short-jingle | CC0 |
| `creak.wav` | A tipping log's creak: 1.1 seconds of `tree_creak.flac` from 0.3 seconds in, with the bass under 120 hertz taken out. Added 2026-11-14. | "Tree Creaking" by AntumDeluge: https://opengameart.org/content/tree-creaking | CC0 |
| `moss-rustle.wav` | Moss about to crumble: 0.8 seconds of `rustle07.flac`, with the bass under 150 hertz taken out. Added 2026-11-14. | "20 Rustles of dry leaves" by qubodup: https://opengameart.org/content/20-rustles-dry-leaves | CC0 |
| `moss-fall.wav` | Moss falling away (`bfh1_wood_falling_01.ogg`). Added 2026-11-14. | "75 CC0 breaking / falling / hit sfx" by rubberduck: https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | CC0 |
| `gust.wav` | The gust before a windy bough moves: 1.6 seconds of `wind3.wav` from 20 seconds in, faded in over 0.6 seconds and out over 0.7, with the bass under 150 hertz taken out. Added 2026-11-14. | "wind1" by Luke.RUSTLTD: https://opengameart.org/content/wind1 | CC0 |
| `water-in.wav` | A hero going into the water: 0.74 seconds of `splash_05.ogg`, with the rumble under 80 hertz taken out. Added 2026-11-14. | "40 CC0 water / splash / slime SFX" by rubberduck: https://opengameart.org/content/40-cc0-water-splash-slime-sfx | CC0 |
| `stroke.wav` | One swimming stroke at the surface: 0.32 seconds of `splash_03.ogg`, with the rumble under 80 hertz taken out. Added 2026-11-14. | "40 CC0 water / splash / slime SFX" by rubberduck: https://opengameart.org/content/40-cc0-water-splash-slime-sfx | CC0 |
| `surfacing.wav` | A swimmer's head coming back up: 0.52 seconds of `splash_02.ogg`, with the rumble under 80 hertz taken out. Added 2026-11-14. | "40 CC0 water / splash / slime SFX" by rubberduck: https://opengameart.org/content/40-cc0-water-splash-slime-sfx | CC0 |

The giant mosquito's three sounds and the low thump under a landing are made in code by this project (`src/audio/synth.ts`): there is no file, and nothing to credit. A jump and a landing have no files of their own: they play the moss and wood footsteps above.

SHA-256 of each download, as OpenGameArt served it:

| Download | SHA-256 |
| --- | --- |
| `Fantozzi-footsteps.7z` | `415d360e0911c1c1c5355ee94023b772e6f4044f59b9b580610e7dbffd1840fd` |
| `[kdd]DifferentSteps_0.zip` | `987d072b7deaa65177e005ddd8185f2351be7c9a76cd7575dea560549c39b33b` |
| `swishes.zip` | `7980215241b739a787dcf26f660ce510bb237900968789395a86911619795693` |
| `thwack-1.0.zip` | `8edb002735a01369ef4d6259573be4885f9fe32c9a9efa89dfbbb14067c8c8e5` |
| `boing.flac` | `9c6af38ca79332ad3fa66ad1229179d2a91655c1157d3620e21ef676f54d9fdd` |
| `qubodupPunch.7z` | `757795e8778acc377abacea902052c2dc707583c69d00b8baa2e76b670a02398` |
| `qubodup-bowling-roll.7z` | `3c99cfe42ecf8a87ab13f66f0f4c16d0a2bdbf75f825eb2e959baab581091af8` |
| `mousebyte_chimeyui.7z` | `6272bac49c8f3e9aa251a8c9e974a2e7f5756119657d0414197baeb129b0c549` |
| `short wind sound.wav` | `4435f5ad1baf171f21f876f778d0a8a7447becea0c4955bb2566e0c63ab20f41` |
| `squeak_toy.zip` | `3ba6419b05ebf8e0b7dd4395b3c10f26811c037e357143f10a159acdb2dabfb8` |
| `kenney_interfaceSounds.zip` | `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232` |
| `Heavy_ConceptB.wav` | `cf7aca1193530c804f41a22cfd9a2813c25d3c244fa96ad88c88c6206daa033d` |
| `forest_whisper_theme.zip` | `11516801f38f4b004fa9e3641ff287fa39cb998fc805d376b372cc03db4d573f` |
| `Battle.mp3` ("Battle Theme") | `dde7bd4f10bde031800ba8e22151fad591b7c13e1c9ae51920341b4e4ae37be5` |
| `PositiveChoice_0.ogg` ("Short Jingle") | `9a2288c29f9edfc1ab67869a00e84314f7343324f52a0c987baf2de9d7d38177` |
| `tree_creak.flac` ("Tree Creaking") | `9bab7c7f68850136c43fb91216c7c1760ac2bda22b2a31659905c559a464d422` |
| `qubodup-rustle.7z` ("20 Rustles of dry leaves") | `c5d7458085e9b208009388b832184bddc0045482f6fa67a1eb6ea09335bb7a43` |
| `sfx_breaking_and_falling.zip` ("75 CC0 breaking / falling / hit sfx") | `e6ee04d91c5f4d30cfda1260d2c9d1faf96fda36319287215fbd07bcb1a80451` |
| `wind3.wav` ("wind1") | `8def85e8546fb4850f017ede32b938593aeca5dfd3a9361cbabd80d455ff954d` |
| `water-splash-slime-sfx.zip` ("40 CC0 water / splash / slime SFX") | `7cd39abb49d4362a37ba18dc0e454c7dc1d08029d4e5b683149046bc237b2eba` |

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
