# Yaarbro's fishing clips, as Meshy made them

Four files from `tools/meshy-rig-animate.mjs` with `tools/yaarbro.fish.json` (2026-11-19, 37 credits): Meshy's Rigging API on his model, then `fish_cast` and `fish_reel` made from words with Text to Motion (Meshy's animation library has no fishing), and from the library `fish_throw` ("Over Shoulder Throw", library 421, kept in case the cast from words does not read) and `fish_show` ("Cheer with One Hand Up", 306, for holding a landed fish up).

Each file is the skeleton and its one clip, exactly as Meshy sent them, with the model swapped for a single small triangle and the pictures removed by `tools/strip-clip.mjs`, so no art is in the repo. That is all `tools/prepare-rigged.py` reads from them (it retargets the clip onto his own model).

Only `fish_cast` is used. The owner looked at all three on 2026-11-19: the cast is OK, the reel did not read as reeling and the cheer did not read as landing a fish. The reel and "landed" are now made by `tools/prepare-rigged.py` itself, pose by pose, from the keys under `"made"` in `tools/yaarbro.guide.json`. The other three files are kept in case they are wanted. To rebuild him, put these beside the other clip folders' files and his six files from the `hero-models` release in one folder:

    blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> tools/yaarbro.guide.json

A change to a hero waits for the owner's OK on the hero preview page.

**None of these is on his model now (2026-11-20).** `fish_cast`, `fish_reel` and `fish_show` are made by `tools/prepare-rigged.py` itself, from the keys in `tools/yaarbro.guide.json`, so that what he holds sits at a grip point in each palm. Meshy's cast presses his right hand against his chest, and a rod held in it passes through his body. The files are kept in case a later character can use them.
