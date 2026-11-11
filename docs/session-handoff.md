# Session handoff

Last updated: 2026-11-10

## Where things stand

Milestone one is built, merged and live at https://rowbeartow.github.io/yaarbroverse-3d/ . GitHub Pages is switched on, and every merge to `main` publishes there.

Milestone two (the modern look) is part way through:

1. Done: a check that fails any pull request holding a private term.
2. Skipped: tuning from the playtest. The playtest notes in the milestone prompt were blank, so no numbers changed.
3. Done: browser checks run in WebKit as well as Chromium.
4. Done: the world and lighting. The grove is a lit, textured forest.
5. Done: the hero models. Yaarbro and Caputo are both drawn from their models. The shape heroes are gone.
6. Done: the textures and the forest light were fetched straight from Poly Haven and compared with the copies here. The forest light was the same file, byte for byte. All ten texture files differed, because the copies here had been re-saved from a mirror's PNG files, so they were replaced with Poly Haven's own 1K JPG files.
7. Done: the trees read as conifers, and the banks have irregular, rounded outlines with rock, roots and moss at their edges.

Nobody has played the new look on a real iPad or Mac yet.

## What exists now

- **The level.** Mossy bank, a fallen log with a break, a second bank, tree stumps that climb, a third bank with a mushroom, a high log, mushrooms over open air, then the big bough with the golden leaf. Touch the leaf to finish. A perfect run takes about 15 seconds; a first try will take a good deal longer. The rules, difficulty numbers and controls are the same as in milestone one.
- **The look.** The route crosses a misty gully in a fir forest. Logs and trunks have bark with moss growing over it, stumps have cut rings, mushrooms have glossy spotted caps. Ferns and grass sway. The golden leaf glows.
  - **Trees.** Firs and cedars are cones that narrow to a point: a straight trunk and tiers of boughs that leave it angled out and a little down, with a dark inner cone so they are solid from the side. The boughs sway.
  - **Banks.** Each bank's top has its own outline: the edge wanders and each corner is rounded by a different amount. Moss spills over the sides in curtains and tongues, roots come out from under the turf and run down the rock, boulders are bedded in the sides, and the rock below swells into lobes and rounds off as it goes down into the mist. The drawn top never reaches past where a hero can stand, and everything else starts well below the top (see `src/view/bank-outline.ts` and `docs/decisions.md`). The walkable area in the rules is unchanged.
- **Lighting.** A forest photograph lights everything (image-based lighting), a warm sun casts soft shadows, leaf shade drifts over the route, a filmic curve maps light to the screen, mist thickens with distance and with depth, and bright things glow.
- **Quality tiers.** High, medium, low and minimal, chosen automatically: a computer starts on high, an iPad on medium, a machine with no graphics card on minimal. The game watches the frame rate and steps down (never up) if it cannot hold 60 on a computer or a steady 30 on touch. `?fps` on the address shows the frame rate and tier. `?quality=` fixes the tier.
- **Loading.** The start screen shows at once. The 3D code and files load behind it with a progress bar, and Play switches on when they are ready. A file that fails to arrive shows a card with a "Try again" button.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They move the same: walk, jump (hold for height), bounce on mushrooms. Both are textured models on skeletons, made by the owner in Meshy from the Caputo Mountain art.
  - **Yaarbro** was rigged and animated in Meshy. His file holds six clips: `idle`, `walk`, `run`, `jump`, `landing` and `roll`. Walk and run are mixed by how fast he is moving. In the air the jump clip is held as a pose, moved along by his upward speed, on the way up and on the way down: Meshy's falling clip is a head-first dive, so it is not used for falling. Landing plays once when he touches down, a little after a hop and in full after a long drop, and running straight on cuts it short. The roll is not used until milestone three.
  - **Yaarbro's skin** had a cleanup pass. A pose test showed two things wrong and both were reweighted: his belt skewed with his legs (it now stays with the hips), and his beard sank into his chest when his head tipped down (the lower beard now stays on the chest). He is shaded smooth, with sharp edges kept on the buckle and the boot soles. Armpits, crotch and materials were checked and left as Meshy made them.
  - **Caputo** could not be rigged by Meshy, so `tools/rig-quadruped.py` does it in Blender: 25 bones (hips, two spine, chest, neck, head, four legs of upper, lower and paw, six in the tail), skinned with automatic weights, and six clips written by the script: `idle` (he breathes and his tail sways), `walk` (a four-beat walk), `run` (a gallop), and held poses for `jump`, `falling` and `landing`. His paws are placed by working each leg back from where the paw should be, so a paw on the ground stays put. Pounce comes in milestone three.
  - Every clip happens on the spot, because the rules own where a hero is. Meshy's clips carried Yaarbro about (the dive started fourteen metres up, the roll travelled five metres, and the landing pushed his right hand 40 cm into the ground). `tools/prepare-rigged.py` takes that out.
  - A model is stood on the spot the rules use by its footprint: soles or paws on the ground, the middle of them over the spot, so the soft dark spot sits under the feet and an edge looks as safe as it is.
  - The owner's original model files are files on the `hero-models` release of this repo: six for Yaarbro, one clip each (about 29 MB each), and one for Caputo (19.9 MB). They are not committed. To rebuild a hero, run its Blender script on the originals and then `node tools/compress-hero.mjs <out.glb> <name>`; the commands are in `CLAUDE.md`. The compressed files are `assets/heroes/yaarbro.glb` (1.1 MB) and `assets/heroes/caputo.glb` (0.9 MB), which the build copies as they are. The CC0 stand-in robot (`?standin`) still checks the loader with a library file that has its whole jump in one clip.
- **Camera.** Behind and above the hero, always looking the same way. A soft dark spot under the hero shows where a jump will land.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. No hearts and nothing that hurts.
- **End card.** Difficulty, hero, time, falls, date. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, Esc. Touch: drag the left half to move, press the right half to jump.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card.
- **This device remembers** the last hero and difficulty.
- **Size.** The whole download is about 6.8 MB (budget 20 MB, checked on every build). The build compresses textures to KTX2 and models with meshopt.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0. It also lists the hero models, which are not: the README says the characters, their art and the hero models are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit.

## Checks on this state

- `npm test`: 176 tests pass. 94 for the game rules (a bot plays the whole grove on Easy, Normal and Hard as each hero with no falls), 11 for the private-terms check, 16 for the quality tier rules and the animation mixing rules, 6 for finding a model's clips and how hard a landing shows, 39 that check every bank's drawn top against where the rules let a hero stand, 10 that check each hero model file holds its skeleton and clips, that Yaarbro's clips happen on the spot, and that Caputo has the bones and clips his rig script should give him.
- `npm run test:browser`: 68 browser checks pass. 22 in Chromium at Mac size with the keyboard, 23 in Chromium at iPad size with touch, 23 in WebKit at iPad size with touch. They cover loading and the progress bar, a failed download, the frame counter, fixed and automatic tiers, the full lighting at medium quality (and high at Mac size), each hero's model loading with its clips and animating while it stands, runs and jumps, the stand-in model doing the same, and everything milestone one checked.
- **Not checked:**
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on real devices. The only numbers so far are from the test machine, which has no graphics card: about 15 frames a second in Chromium and 9 in WebKit on the minimal tier, and several seconds a frame on the tiers above. A real device has to be looked at with `?fps`.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids.

## What's next

1. **The owner looks at the live link on the iPad and the Mac**, with `?fps` on the address, and says what frame rate and tier show and whether anything looks wrong.
2. **Checking the Blender scripts on new files.** `tools/rig-quadruped.py` is meant for the milestone-three enemies too: each needs its own guide file of joint places, like `tools/caputo.rig.json`. Its path for a file that already has a skeleton (keep it, add the bones it lacks) was tried only on Caputo's own output, whole and with four tail bones removed. On that second file Blender's automatic weights failed on the mesh as it was, and the script's answer to that (weight a clean rebuilt copy, carry the weights across) worked.
3. **Playtest tuning**, when there are notes: change only `src/levels/bouncing-grove/difficulty.ts`.
4. **Milestone three** makes the grove a full level: the marmot scout and giant mosquito, hearts, a longer route with checkpoints, Yaarbro's roll and Caputo's pounce. Each move must beat or get past both enemies. Easy stays finishable with walk and jump alone. See `docs/decisions.md`.

## Known limits

- Short: one area, about 60 to 80 metres of route.
- No sound, no saved progress, one player.
- Caputo is long and the footing check is a small circle under his middle, so his head, tail and outer paws hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled (issue #5).
- The minimal tier is blurry and its trees are sparse. It is only for machines that draw in software.
- The branch `claude/brave-cannon-2aq6iz` carries merges of `main`, because this session could not force-push a restarted branch. Each pull request's file changes are still only its own.

## Added as plain scenery, not canon

Tree stumps to hop on, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. Everything else (the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, the golden leaf tucked in the canopy, both heroes' looks, the end card) comes from Caputo Mountain.
