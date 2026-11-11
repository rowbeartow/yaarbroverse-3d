# Session handoff

Last updated: 2026-11-10

## Where things stand

Milestone one is built, merged and live at https://rowbeartow.github.io/yaarbroverse-3d/ . GitHub Pages is switched on, and every merge to `main` publishes there.

Milestone two (the modern look) is part way through:

1. Done: a check that fails any pull request holding a private term.
2. Skipped: tuning from the playtest. The playtest notes in the milestone prompt were blank, so no numbers changed.
3. Done: browser checks run in WebKit as well as Chromium.
4. Done: the world and lighting. The grove is a lit, textured forest.
5. Half done: the hero models. Yaarbro is drawn from his model. Caputo is still drawn from shapes: Meshy could not give him a four-legged skeleton, so he is to be rigged and animated in Blender by a script in `tools/` (see `docs/decisions.md`).
6. Done: the textures and the forest light were fetched straight from Poly Haven and compared with the copies here. The forest light was the same file, byte for byte. All ten texture files differed, because the copies here had been re-saved from a mirror's PNG files, so they were replaced with Poly Haven's own 1K JPG files.
7. Not started: trees that read as conifers, and banks with irregular, rounded outlines.

Nobody has played the new look on a real iPad or Mac yet.

## What exists now

- **The level.** Mossy bank, a fallen log with a break, a second bank, tree stumps that climb, a third bank with a mushroom, a high log, mushrooms over open air, then the big bough with the golden leaf. Touch the leaf to finish. A perfect run takes about 15 seconds; a first try will take a good deal longer. The rules, difficulty numbers and controls are the same as in milestone one.
- **The look.** The route crosses a misty gully in a fir forest. Banks are pillars of lichen rock with moss on top. Logs and trunks have bark with moss growing over it, stumps have cut rings, mushrooms have glossy spotted caps. Firs and cedars have boughs that sway, as do ferns and grass. The golden leaf glows.
- **Lighting.** A forest photograph lights everything (image-based lighting), a warm sun casts soft shadows, leaf shade drifts over the route, a filmic curve maps light to the screen, mist thickens with distance and with depth, and bright things glow.
- **Quality tiers.** High, medium, low and minimal, chosen automatically: a computer starts on high, an iPad on medium, a machine with no graphics card on minimal. The game watches the frame rate and steps down (never up) if it cannot hold 60 on a computer or a steady 30 on touch. `?fps` on the address shows the frame rate and tier. `?quality=` fixes the tier.
- **Loading.** The start screen shows at once. The 3D code and files load behind it with a progress bar, and Play switches on when they are ready. A file that fails to arrive shows a card with a "Try again" button.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They move the same: walk, jump (hold for height), bounce on mushrooms.
  - **Yaarbro** is a textured model on a skeleton, made by the owner in Meshy. His file holds two clips, `Walking` and `Running`, mixed by how fast he is moving. It has no idle, jump, falling, landing or roll clip. Until it does: standing still he holds the middle pose of his walk and breathes; in the air he holds the part of his run where both feet are off the ground; landing is a quick squash; the roll is not used until milestone three. When the file gains clips named Idle, Jump, Falling, Landing or Roll they are used with no code change, except that `airborne` in `src/view/hero-model.ts` must then be set for the jump clip.
  - **Caputo** is still built from shapes.
  - A model is stood on the spot the rules use by its footprint: soles on the ground, the middle of its feet over the spot, so the soft dark spot sits under the feet and an edge looks as safe as it is.
  - The owner's original model files are files on the `hero-models` release of this repo (28.5 MB and 19.9 MB). They are not committed. `node tools/compress-hero.mjs <original.glb> yaarbro` makes `assets/heroes/yaarbro.glb` (1 MB), which is committed and which the build copies as it is. The CC0 stand-in robot (`?standin`) still checks the loader with a file that has idle and jump clips.
- **Camera.** Behind and above the hero, always looking the same way. A soft dark spot under the hero shows where a jump will land.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. No hearts and nothing that hurts.
- **End card.** Difficulty, hero, time, falls, date. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, Esc. Touch: drag the left half to move, press the right half to jump.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card.
- **This device remembers** the last hero and difficulty.
- **Size.** The whole download is about 5.8 MB (budget 20 MB, checked on every build). The build compresses textures to KTX2 and models with meshopt.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0. It also lists the hero models, which are not: the README says the characters, their art and the hero models are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit.

## Checks on this state

- `npm test`: 128 tests pass. 94 for the game rules (a bot plays the whole grove on Easy, Normal and Hard as each hero with no falls), 11 for the private-terms check, 16 for the quality tier rules and the animation mixing rules, 7 for finding a model's clips and doing without the ones it lacks.
- `npm run test:browser`: 68 browser checks pass. 22 in Chromium at Mac size with the keyboard, 23 in Chromium at iPad size with touch, 23 in WebKit at iPad size with touch. They cover loading and the progress bar, a failed download, the frame counter, fixed and automatic tiers, the full lighting at medium quality (and high at Mac size), Yaarbro's model loading and animating while he stands, runs and jumps, the stand-in model doing the same, Caputo still drawn from shapes, and everything milestone one checked.
- **Not checked:**
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on real devices. The only numbers so far are from the test machine, which has no graphics card: about 15 frames a second in Chromium and 9 in WebKit on the minimal tier, and several seconds a frame on the tiers above. A real device has to be looked at with `?fps`.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids.

## What's next

1. **The owner looks at the live link on the iPad and the Mac**, with `?fps` on the address, and says what frame rate and tier show and whether anything looks wrong.
2. **Yaarbro's missing clips.** If the owner exports idle, jump, falling, landing and roll clips for him from Meshy, compress the new file the same way and set `airborne` for the jump clip.
3. **Trees and banks** (item 7 above), as its own pull request. It needs before-and-after pictures in the pull request, and the walkable area in the rules must not change.
4. **Caputo.** Write the Blender script in `tools/` that takes his original file and gives back a rigged, animated one: a spine, neck, head, four legs with upper, lower and paw bones, a tail of at least five bones, and clips named idle, walk, run, jump, falling and landing. Compress it, add him to `HERO_MODELS`, match his soft spot and framing. Before merging, publish a private preview page of him playing each clip in the game's lighting and wait for the owner's OK. Then add a picture of him to the README.
5. **Playtest tuning**, when there are notes: change only `src/levels/bouncing-grove/difficulty.ts`.
6. **Milestone three** makes the grove a full level: the marmot scout and giant mosquito, hearts, a longer route with checkpoints, Yaarbro's roll and Caputo's pounce. Each move must beat or get past both enemies. Easy stays finishable with walk and jump alone. See `docs/decisions.md`.

## Known limits

- Short: one area, about 60 to 80 metres of route.
- No sound, no saved progress, one player.
- Caputo is long and the footing check is a small circle under his middle, so his head and tail hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled (issue #5).
- The minimal tier is blurry and its trees are sparse. It is only for machines that draw in software.
- The branch `claude/brave-cannon-2aq6iz` carries merges of `main`, because this session could not force-push a restarted branch. Each pull request's file changes are still only its own.

## Added as plain scenery, not canon

Tree stumps to hop on, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. Everything else (the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, the golden leaf tucked in the canopy, both heroes' looks, the end card) comes from Caputo Mountain.
