# Yaarbro's rope clips, as Meshy made them

Three files from `tools/meshy-rig-animate.mjs` with `tools/yaarbro.rope.json` (2026-11-16, 14 credits): Meshy's Rigging API on his model, then from the animation library `rope_catch` ("Jump and Hang on Bar", library 485), `rope_hang` ("Rope Hang Idle", 477) and `rope_release` ("Swing on Rope to Ground", 494). `tools/yaarbro.guide.json` cuts the reach and the catch from the first, and the push-off from the last.

Each file is the skeleton and its one clip, exactly as Meshy sent them, with the model swapped for a single small triangle and the pictures removed by `tools/strip-clip.mjs`, so no art is in the repo. That is all `tools/prepare-rigged.py` reads from them (it retargets the clip onto his own model).

To rebuild Yaarbro: put these three and the four in `tools/yaarbro-swim-clips/` beside his six files from the `hero-models` release in one folder, then

    blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> tools/yaarbro.guide.json
