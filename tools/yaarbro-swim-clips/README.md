# Yaarbro's swimming clips, as Meshy made them

Four files from `tools/meshy-rig-animate.mjs` with `tools/yaarbro.swim.json` (2026-11-14, 27 credits): Meshy's Rigging API on his model, then `tread` ("Swim Idle", library 568), `surface` ("Swim Forward", 569) and `climb_out` ("Swimming to Edge", 570) from the animation library, and `underwater` from Text to Motion.

Each file is the skeleton and its one clip, exactly as Meshy sent them, with the model swapped for a single small triangle and the pictures removed, so no art is in the repo and each is about 100 KB. That is all `tools/prepare-rigged.py` reads from them (it retargets the clip onto his own model). Rebuilt from these, every clip matches the build from Meshy's full files to under a tenth of a degree.

To rebuild Yaarbro: put these four beside his six files from the `hero-models` release in one folder, then

    blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> tools/yaarbro.guide.json
