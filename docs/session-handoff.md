# Session handoff

Last updated: 2026-11-11

## Start here

**Milestone three, part one is in progress: the longer Bouncing Grove.** The owner approved a six-section route on 2026-11-11 (the plan page: https://claude.ai/artifact/MdPwsE2Hg43pBYEjPevSmn ). It is built in three pull requests, each to be merged once its checks pass:

1. Pull request 18: sections 1 and 2, the checkpoint list, and drawing only the stretch of forest near the hero. This text arrives with it. If `main` shows a commit named "A longer grove, part 1 of 3", it merged; if not, look at the pull request before assuming anything.
2. Not opened yet: sections 3 and 4.
3. Not opened yet: sections 5 and 6, and this file rewritten with part two (enemies, hearts, roll, pounce) as next.

The six sections, each ending on a mossy bank (a checkpoint):

1. **The Broken Logs** (built). Fallen logs end to end. The first break is a short hop, the rest are real jumps.
2. **The Stump Steps** (built). Stumps that climb, left and right, to a wide clearing. The clearing has room for the marmot scout in part two.
3. **The Ravine** (not built). Root shelves stepping down into a ravine and to the right, a low log with a break, root shelves climbing out. Ends on bank 3, about 9 m right of the start line.
4. **The Mushroom Springs** (the mushroom, high log and mushroom chain exist now and lead straight to the leaf; they become this section). Ends on bank 4, a mossy ledge about 8 m up.
5. **The High Boughs** (not built). Narrow boughs through the canopy that turn left and right, with a gap at each corner: forward, across the screen to the left, forward, across again, forward. Ends on bank 5. Room for the giant mosquito over the boughs.
6. **The Climb** (not built). A mushroom on bank 5, a high log, tall snags to hop, two mushrooms, then the bough with the golden leaf. Room for a scout on bank 5.

Rules for the rest of the build, from the owner:

- A perfect run on Normal takes about a minute. `GROVE_TIMES=1 npx vitest run tests/sections.test.ts --silent=false` prints the bot's time at the end of each section. Sections 1 and 2 take the bot 7.3 seconds each on Normal, so the later ones need to be about 11 seconds each, or these two lengthened.
- On Easy and Normal every bank is a checkpoint. On Hard a fall never costs more than about 30 seconds of a perfect run: the plan is checkpoints at banks 2 and 4. `tests/sections.test.ts` checks this from the bot's times.
- Only walk, jump and mushroom bounce. Nothing moves: the Caputo Mountain forest has no moving platform. No enemies, hearts, roll or pounce in part one.
- Every pull request has screenshots of its sections (`docs/pictures/grove-<number>-<name>.jpg`, taken with `scripts/screenshot.mjs` at medium quality).
- The route never comes back toward the camera. Sections 3 and 5 move it sideways; the forest follows (see `src/view/route.ts`).

The playtest that led to this (the owner, 2026-11-11): the kids loved it and want more to play. The older player said Normal was about the right difficulty. The first set of jumps was hard for them to figure out, which is why the level now opens with a short hop. The owner has no iPad to hand, so the iPad frame rate is still unknown.

What the owner has approved:

- Yaarbro, as he is.
- Caputo's model, skeleton and clips. He said the walk reads as a cat, and that idle, jump, falling and landing are good: leave those four alone unless he asks. He said to merge the three gaits after seeing the preview page. He has not said in his own words how the trot, the gallop or the gait changes look in motion.
- The jump stays as it is, with no pause before take-off. Jumping the instant the button is pressed matters more for the kids than a crouch that can be seen.

If the run reads to him as moving in pairs once he plays it, he brings in an animator and no more script rounds are made (see `docs/decisions.md`).

How to work on Caputo's movement:

1. Get his source file. It is not in the repo. It is a file on the `hero-models` release: https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/Meshy_AI_SaberToothCatGameRead_1110213716_texture.glb (20.9 MB). Download it to a scratch folder, never into the repo.
2. Once per session: `apt-get install -y python3-numpy` (Blender needs it), `npm ci`, `npm run assets`.
3. Rig him: `blender -b -P tools/rig-quadruped.py -- <source.glb> <rigged.glb> tools/caputo.rig.json`. It takes about five seconds. It prints the speed each of the walk, the trot and the run covers ground at and when each paw lands, and stops if a planted paw is asked to reach further than its leg is long. His joint places, and any numbers changed from the script's own, are in `tools/caputo.rig.json`. The gaits are the `walk`, `trot` and `run` functions of the `Quadruped` class; `step` moves one paw through one stride.
4. Build the preview page: `node tools/preview/build.mjs <rigged.glb> <folder>`.
5. Look at it in still frames: serve it with `npx vite preview --outDir <folder> --port 4174`, then `node tools/preview/stills.mjs <sheet.jpg> side:walk:0,0.125,0.25,0.375,0.5,0.625,0.75,0.875 "" 2` (the top of that file lists the other views). A session cannot watch him move, only look at stills.
6. Measure it: with the page still served, `node tools/preview/measure.mjs` drives the game's own animation player and prints how far planted paws slide in each gait and at each change of gait, whether the three gait clips stay on one clock, and the size he is drawn at.
7. When it looks right: `node tools/compress-hero.mjs <rigged.glb> caputo` writes `assets/heroes/caputo.glb`. If the script printed new speeds, put them in `walkSpeed`, `trotSpeed` and `runSpeed` for Caputo in `src/view/hero-model.ts`: metres a second from the script, times the size `measure.mjs` prints (1.1211 now). An older note here gave 1.0946, which was wrong for the current idle pose.
8. Bring the hand-written text in `tools/preview/index.html` up to date, rebuild the page, and publish it over the page the owner already has, so his link stays the same: https://claude.ai/artifact/V3Z9Car7Ttfp1zRNRPLf7D . The top of `tools/preview/build.mjs` lists the files to publish.
9. A hero change goes in a pull request marked "do not merge until the owner says OK", and waits for his OK on the preview page. The page now shows the three gaits as merged.

Open:

- **Frame rate on the iPad and the Mac has never been checked.** The owner opens the live link with `?fps` on the address and says what frame rate and tier show.
- **Nobody has reported watching Caputo's clips inside the game on a real device.** The owner judges them on the preview page.

## Where things stand

Milestone one is built, merged and live at https://rowbeartow.github.io/yaarbroverse-3d/ . Every merge to `main` publishes there.

Milestone two (the modern look) is done apart from the open items above:

1. Done: a check that fails any pull request holding a private term.
2. Skipped: tuning from the playtest. The playtest notes in the milestone prompt were blank, so no numbers changed.
3. Done: browser checks run in WebKit as well as Chromium.
4. Done: the world and lighting. The grove is a lit, textured forest.
5. Done: the hero models. Yaarbro and Caputo are both drawn from their models, and the owner has approved both. His walk, trot and gallop are merged and live.
6. Done: the textures and the forest light were fetched straight from Poly Haven and checked against the copies here.
7. Done: the trees read as conifers, and the banks have irregular, rounded outlines with rock, roots and moss at their edges.

Nobody has played the new look on a real iPad or Mac yet.

## What exists now

- **The level.** Two sections so far, then the way up to the leaf. The Broken Logs: a mossy bank, then fallen logs end to end (three on Easy, four on Normal, five on Hard) with a short hop at the first break and real jumps after, then a bank. The Stump Steps: stumps that climb left and right (four, six or seven), then a wide clearing. From the clearing a mushroom bounces the hero to a high log, then mushrooms over open air, then the big bough with the golden leaf. Touch the leaf to finish. The bot's perfect run takes 17 seconds on Easy, 21 on Normal and 24 on Hard; a first try will take a good deal longer.
- **Checkpoints.** Every bank is a checkpoint on Easy and Normal. On Hard the bank after the logs is bare stone and the clearing is a checkpoint. Which banks are checkpoints is the `checkpoints` list in `difficulty.ts`.
- **Drawing by distance.** The forest, the ferns and grass, and the platforms are built in 36 m stretches of route, and only the stretches between the camera and the far end of the mist (165 m) are drawn. Past 100 m trees wear their lighter crowns and ferns and grass are left out. The forest follows the route's middle, so it bends when the route does. On the test machine at medium quality the start of the level draws 305 thousand triangles in 197 draw calls; the short level drew 322 thousand in 144.
- **The look.** The route crosses a misty gully in a fir forest. Logs and trunks have bark with moss growing over it, stumps have cut rings, mushrooms have glossy spotted caps. Ferns and grass sway. The golden leaf glows.
  - **Trees.** Firs and cedars are cones that narrow to a point: a straight trunk and tiers of boughs that leave it angled out and a little down, with a dark inner cone so they are solid from the side. The boughs sway.
  - **Banks.** Each bank's top has its own outline: the edge wanders and each corner is rounded by a different amount. Moss spills over the sides in curtains and tongues, roots come out from under the turf and run down the rock, boulders are bedded in the sides, and the rock below swells into lobes and rounds off as it goes down into the mist. The drawn top never reaches past where a hero can stand, and everything else starts well below the top (see `src/view/bank-outline.ts` and `docs/decisions.md`). The walkable area in the rules is unchanged.
- **Lighting.** A forest photograph lights everything (image-based lighting), a warm sun casts soft shadows, leaf shade drifts over the route, a filmic curve maps light to the screen, mist thickens with distance and with depth, and bright things glow.
- **Quality tiers.** High, medium, low and minimal, chosen automatically: a computer starts on high, an iPad on medium, a machine with no graphics card on minimal. The game watches the frame rate and steps down (never up) if it cannot hold 60 on a computer or a steady 30 on touch. `?fps` on the address shows the frame rate and tier. `?quality=` fixes the tier.
- **Loading.** The start screen shows at once. The 3D code and files load behind it with a progress bar, and Play switches on when they are ready. A file that fails to arrive shows a card with a "Try again" button.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They move the same: walk, jump (hold for height), bounce on mushrooms. Both are textured models on skeletons, made by the owner in Meshy from the Caputo Mountain art.
  - **Yaarbro** was rigged and animated in Meshy. His file holds six clips: `idle`, `walk`, `run`, `jump`, `landing` and `roll`. Walk and run are mixed by how fast he is moving. In the air the jump clip is held as a pose, moved along by his upward speed, on the way up and on the way down: Meshy's falling clip is a head-first dive, so it is not used for falling. Landing plays once when he touches down, a little after a hop and in full after a long drop, and running straight on cuts it short. The roll is not used until milestone three.
  - **Yaarbro's skin** had a cleanup pass. A pose test showed two things wrong and both were reweighted: his belt skewed with his legs (it now stays with the hips), and his beard sank into his chest when his head tipped down (the lower beard now stays on the chest). He is shaded smooth, with sharp edges kept on the buckle and the boot soles. Armpits, crotch and materials were checked and left as Meshy made them.
  - **Caputo.** Meshy could not rig him, so `tools/rig-quadruped.py` does it in Blender: 29 bones (hips, two spine, chest, neck, head, two shoulder blades, two ears, four legs of upper, lower and paw, six in the tail), skinned with automatic weights, and seven clips written by the script to move like a cat:
    - `walk`: one paw at a time (left hind, left front, right hind, right front), each hind paw landing in the print of the front paw on its side. The shoulder blades rise in turn, the head stays level, the spine sways, and each front paw curls back at the wrist as it lifts. Every paw eases off the ground and onto it: its speed never changes in a jump.
    - `trot`: diagonal pairs, left hind with right front, then right hind with left front, two even beats in 0.4 seconds with a short float between. Back level, head steady, tail up.
    - `run`: a rotary gallop. Each paw lands by itself, going round the body: left hind, right hind 13 hundredths of a stride later, right front at 57, left front at 70. He is off the ground stretched out after the hind legs push, and for a moment gathered after the front legs push. The back curls and stretches.
    - **Gaits in the game.** He walks up to 34 hundredths of top speed, trots up to 68 and gallops above; coming down he changes at 63 and 30 (`gaits` for Caputo in `src/view/hero-model.ts`). He is in one gait at a time and fades to the next in about a tenth of a second. The three clips share one clock, set in the rig script so each paw is as near as it can be to the same point of its step in each gait, so a change carries on in mid stride. Yaarbro still mixes his walk and run by pace, as before.
    - **Measured** (`tools/preview/measure.mjs`): in a steady gait a planted paw slides about half a centimetre for each metre travelled, at every pace tried. At a change of gait a planted paw slides about 10 cm (walk and trot) or 15 to 20 cm (trot and gallop), once, because the gaits put the paws down in different orders.
    - `idle`: 8 seconds of breathing, weight shifting, two looks around, ear flicks and tail-tip flicks.
    - `jump`: a crouch and push from the hind legs, then fully stretched. The game plays the crouch and push in a tenth of a second as he leaves the ground (the rules lift him the moment Jump is pressed), then holds the rest as a pose moved along by his upward speed.
    - `falling` (legs down and spread, tail out) and `landing` (front paws, then hind paws, the body sinks, he stands).
    - His tail follows his body late, bone by bone. Paws are placed by working each leg back from where the toes should be, and the script stops if a planted paw is asked to reach further than its leg is long. Pounce comes in milestone three.
  - **The hero preview page** is the page the owner looks at before a hero change is merged: the hero in the game's light playing each clip, the clips mixed by the game's own animation player, and slow side views of the walk, the trot and the run over ground that moves at the game's speed, each with speed buttons, pause, a slider to step through a stride, and the skeleton. Its code is in `tools/preview/`: `build.mjs` builds it, `preview.ts` is the viewer, `index.html` is the page and its hand-written notes, `stills.mjs` takes still frames of it, and `measure.mjs` measures paw slide on it. It is published as a private Claude artifact, not as part of the game. The current one is https://claude.ai/artifact/V3Z9Car7Ttfp1zRNRPLf7D .
  - Every clip happens on the spot, because the rules own where a hero is. Meshy's clips carried Yaarbro about (the dive started fourteen metres up, the roll travelled five metres, and the landing pushed his right hand 40 cm into the ground). `tools/prepare-rigged.py` takes that out.
  - A model is stood on the spot the rules use by its footprint: soles or paws on the ground, the middle of them over the spot, so the soft dark spot sits under the feet and an edge looks as safe as it is.
  - The owner's original model files are files on the `hero-models` release of this repo: six for Yaarbro, one clip each (about 29 MB each), and one for Caputo (20.9 MB, `Meshy_AI_SaberToothCatGameRead_1110213716_texture.glb`). They are not committed. To rebuild a hero, run its Blender script on the originals and then `node tools/compress-hero.mjs <out.glb> <name>`; the commands are in `CLAUDE.md`. The compressed files are `assets/heroes/yaarbro.glb` (1.1 MB) and `assets/heroes/caputo.glb` (0.9 MB), which the build copies as they are. The CC0 stand-in robot (`?standin`) still checks the loader with a library file that has its whole jump in one clip.
- **Camera.** Behind and above the hero, always looking the same way. A soft dark spot under the hero shows where a jump will land.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. No hearts and nothing that hurts.
- **End card.** Difficulty, hero, time, falls, date. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, Esc. Touch: drag the left half to move, press the right half to jump.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card.
- **This device remembers** the last hero and difficulty.
- **Size.** The whole download is about 6.8 MB (budget 20 MB, checked on every build). The build compresses textures to KTX2 and models with meshopt.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0. It also lists the hero models, which are not: the README says the characters, their art and the hero models are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit. The two browser jobs run inside Playwright's container image, pinned to the Playwright version in `package.json` (1.63.0), so a run installs nothing from Ubuntu's servers. Before this, on 2026-11-11, four runs in a row failed before any test because GitHub's machines could not reach those servers.

## Checks on this state

- `npm test`: 217 tests pass. The game rules (a bot plays the whole grove on Easy, Normal and Hard as each hero with no falls), 17 for the sections and checkpoints (each section ends on a bank, a fall returns to the right bank, a fall on Hard costs under about 30 seconds, a perfect run takes as long as planned), 16 for the route line the forest follows and the rule for drawing by distance, 11 for the private-terms check, 22 for the quality tier rules and the animation mixing rules, with choosing a gait by pace and keeping the stride matched to the ground, 6 for finding a model's clips and how hard a landing shows, 39 that check every bank's drawn top against where the rules let a hero stand, 11 that check each hero model file holds its skeleton and clips, that no clip carries a hero away from the spot, that Caputo has the bones and clips his rig script should give him, and that none of his clips is a frozen pose.
- `npm run test:browser`: 68 browser checks pass. 22 in Chromium at Mac size with the keyboard, 23 in Chromium at iPad size with touch, 23 in WebKit at iPad size with touch. They cover loading and the progress bar, a failed download, the frame counter, fixed and automatic tiers, the full lighting at medium quality (and high at Mac size), each hero's model loading with its clips and animating while it stands, runs and jumps, the stand-in model doing the same, and everything milestone one checked.
- **Not checked:**
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on real devices. The only numbers so far are from the test machine, which has no graphics card: about 15 frames a second in Chromium and 9 in WebKit on the minimal tier, and several seconds a frame on the tiers above. A real device has to be looked at with `?fps`.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids.

## What's next

1. **The owner plays Caputo's three gaits in the game** on the iPad and the Mac and says how they look.
2. **The owner looks at the live link on the iPad and the Mac**, with `?fps` on the address, and says what frame rate and tier show and whether anything looks wrong.
3. **Checking the Blender scripts on new files.** `tools/rig-quadruped.py` is meant for the milestone-three enemies too: each needs its own guide file of joint places, like `tools/caputo.rig.json`. Its path for a file that already has a skeleton (keep it, add the bones it lacks) was tried only on Caputo's earlier output, before he had shoulder blades and ears.
4. **Playtest tuning**, when there are notes: change only `src/levels/bouncing-grove/difficulty.ts`.
5. **Milestone three** makes the grove a full level: the marmot scout and giant mosquito, hearts, a longer route with checkpoints, Yaarbro's roll and Caputo's pounce. Each move must beat or get past both enemies. Easy stays finishable with walk and jump alone. See `docs/decisions.md`.

## Known limits

- Short: one area, about 105 metres of route so far.
- No sound, no saved progress, one player.
- Caputo is long and the footing check is a small circle under his middle, so his head, tail and outer paws hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled (issue #5).
- The minimal tier is blurry and its trees are sparse. It is only for machines that draw in software.
- On the keyboard a hero is at full speed almost at once, so Caputo's walk and trot are mostly seen on the iPad with a gentle push.
- Each of Caputo's gaits is one clip played slower or faster to match the ground, so the trot is quick-stepping at the top of its range and the gallop a little floaty at the bottom of its range.

## Added as plain scenery, not canon

Tree stumps to hop on, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. Everything else (the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, the golden leaf tucked in the canopy, both heroes' looks, the end card) comes from Caputo Mountain.
