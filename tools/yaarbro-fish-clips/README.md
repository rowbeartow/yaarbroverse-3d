# Yaarbro's fishing clips, as Meshy made them

Four files from `tools/meshy-rig-animate.mjs` with `tools/yaarbro.fish.json` (2026-11-19, 37 credits): Meshy's Rigging API on his model, then `fish_cast` and `fish_reel` made from words with Text to Motion (Meshy's animation library has no fishing), and from the library `fish_throw` ("Over Shoulder Throw", library 421, kept in case the cast from words does not read) and `fish_show` ("Cheer with One Hand Up", 306, for holding a landed fish up).

Each file is the skeleton and its one clip, exactly as Meshy sent them, with the model swapped for a single small triangle and the pictures removed by `tools/strip-clip.mjs`, so no art is in the repo. That is all `tools/prepare-rigged.py` reads from them (it retargets the clip onto his own model).

They are not on his model yet. Nobody has looked at them. To use them: name each in `tools/yaarbro.guide.json` as the rope clips are named, put these beside the other clip folders' files and his six files from the `hero-models` release in one folder, and rebuild him:

    blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> tools/yaarbro.guide.json

A change to a hero waits for the owner's OK on the hero preview page.
