# Session handoff

Last updated: 2026-11-11

## Start here

**Milestone three, part one is done: the Bouncing Grove is a full level.** Six sections, a checkpoint bank between each, and a perfect run of about a minute on Normal. The owner approved the route on a plan page (https://claude.ai/artifact/MdPwsE2Hg43pBYEjPevSmn ) before it was built. It went in as three pull requests, all merged on 2026-11-11 with their checks green:

1. Pull request 18: sections 1 and 2, the checkpoint list, drawing only the stretch of forest near the hero, and the browser checks moved into Playwright's container image.
2. Pull request 19: sections 3 and 4.
3. Pull request 20: sections 5 and 6.

There are no open pull requests from this work.

**Milestone three, part two is under way: enemies, hearts, the roll and the pounce.** The owner gave the go-ahead on 2026-11-11 and set the order, one pull request each: (1) enemy models through Meshy's API, (2) rig and animate his picks in Blender, (3) hearts and damage, (4) Yaarbro's roll and Caputo's pounce, (5) enemy placement and behaviour. His answers to the open questions: everything about the enemies, the hearts and the two moves follows the 2D game (`docs/forest.md` and `src/forest/` in the private repo); anything not found there becomes an issue labeled `needs-decision`, not an invention.

**Where step 1 stands: waiting for the owner's pick.**

- Six candidate models exist, three for the marmot scout and three for the giant mosquito, made by Meshy's Image to 3D. They are on a private page for the owner: https://claude.ai/artifact/1HMoWtxB1vsAtWLJtH1Ryt . He replies with one letter for each enemy. Nothing is rigged, and no enemy model is in the repo.
- The reference pictures were the "Alert" marmot and the "Hover" mosquito from the approved studies (`docs/art-direction/b02a/marmot-scout-study.png` and `giant-mosquito-study.png` on the private repo's `codex/forest-f01` branch), each cut out of the sheet with its background and ground dust removed. The art converted well, so no other reference picture was needed.
- Candidates A, B and C are Meshy 7.1, Meshy 6, and Meshy 7.1 with the picture left as drawn. Each is about 31 thousand triangles with a 2K colour picture, 4 to 5 MB.
- **The models are not saved anywhere lasting.** They were downloaded to the session's scratch folder, which is gone when the session ends. Meshy's task numbers, for downloading the picked ones again (`GET https://api.meshy.ai/openapi/v1/image-to-3d/<task>`, then the `glb` address in the reply): marmot A `01a1cb90-4c80-75ee-968a-12bef046e189`, B `01a1cb90-5110-76bb-aff5-cb9c9f384842`, C `01a1cb90-556a-7321-83fc-b360dbd2e1e8`; mosquito A `01a1cb90-63d4-70a0-9727-586c2b46e25e`, B `01a1cb90-67e1-757c-8ab5-89049eee09dd`, C `01a1cb90-6bc4-7196-84e5-86177f2d9020`. Meshy keeps a task's files for about three days. After that a pick has to be made again from the picture, at 30 credits, and will not be the same model.
- Credits: 1,200 before, 1,020 after, 180 spent (30 for each model). The owner's limit is 300 without asking, so 120 are left under it.
- On two mosquito candidates the underside of the wings came out dark green. Whichever is picked, the wings are made pale and see-through when it is rigged.

What part one left ready, and what the owner has settled for the later steps:

- **Room for three enemies, with nothing placed.** The clearing at the end of section 2 (`bank-2`, 10 m wide and 12 m long) for the marmot scout. The open air beside the high boughs of section 5 for the giant mosquito. The bank at the foot of the last climb (`bank-5`) for a second scout. Enemies go only there: never in a diagonal-jump section, which is where the kids fell most.
- **The difficulty numbers stay as they are.** The kids found the longer grove fun and the right difficulty.
- **Hearts** follow the 2D game's rules (5, 3 and 2 there), with the numbers in `difficulty.ts` and shown on screen. Running out returns the hero to the last checkpoint on Easy and Normal; on Hard a setback never costs more than about 30 seconds of a perfect run.
- **The roll and the pounce.** Yaarbro's file already holds a `roll` clip, unused. Caputo's pounce is written in `tools/rig-quadruped.py`. Each move must beat or get past both enemies. On touch, Jump stays the largest target.
- **Rigging.** `tools/rig-quadruped.py` for the marmot scout, with its own guide file like `tools/caputo.rig.json`. The mosquito gets its own small rig script: body, head, legs and wings, wings beating fast and legs hanging loose. The clips each enemy needs come from its behaviour in the 2D game. Both go on a preview page for the owner's OK before merging.
- **Easy stays finishable with walk and jump alone**, and on Hard the enemies should make the older player work for it.
- **Done means** the bot finishes every difficulty as each hero through the enemies without losing a heart, and on Easy without using the move.

The playtest that led to part one (the owner, 2026-11-11): the kids loved it and want more to play. The older player said Normal was about the right difficulty. The first set of jumps was hard for them to figure out, which is why the level now opens with a short hop. The owner and the kids have since played the longer level: fun, and the right difficulty. They fell most on the diagonal jumps. On his Mac in Safari it ran at 60 frames a second on the high tier, with 121 draw calls and 226 thousand triangles at the end of the level.

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

- **Real-device testing is on the owner's Mac, in Safari.** He has no iPad to test on right now (his note, 2026-11-11). The iPad frame-rate target (a steady 30) and the touch controls stay as they are, and nothing waits on an iPad number. He opens the live link with `?fps` on the address in Safari on the Mac and says what frame rate and tier show; the target there is 60. Frame rate on a real device has still never been checked. If an iPad number does come in and it is under 30, fix that first, in its own pull request.
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

Milestone three, part one (the longer grove) is done, in the three merged pull requests listed under "Start here":

1. Sections 1 and 2 (the Broken Logs, the Stump Steps), the checkpoint list, and drawing only the stretch of forest near the hero.
2. Sections 3 and 4 (the Ravine, the Mushroom Springs), with root shelves as a new kind of platform.
3. Sections 5 and 6 (the High Boughs, the Climb).

## What exists now

- **The level.** Six sections, each built around one idea and ending on a mossy bank. About 235 m of route on Normal (164 on Easy, 278 on Hard), climbing about 15 m. It runs away from the camera and never comes back toward it; sections 3 and 5 move it sideways.
  1. **The Broken Logs.** Fallen logs end to end (three on Easy, five on Normal, six on Hard). The first break is a short hop on every difficulty; the rest are real jumps.
  2. **The Stump Steps.** Stumps that climb, left and right (four, seven or eight), to a wide clearing.
  3. **The Ravine.** Root shelves step down and to the right (two on Easy, three otherwise), a low log with a break crosses the bottom, and shelves climb out to a bank. On Easy the shelves are close enough to walk down and low enough to step up.
  4. **The Mushroom Springs.** A mushroom bounces the hero to a high log, then mushrooms over open air (one, four or five) lead to a mossy ledge high up.
  5. **The High Boughs.** Five narrow boughs level with the ledge: forward, across the screen to the left, forward, across again, forward to a bank. Each corner is a gap on Normal and Hard: two are jumped away from the camera and two across the screen. On Easy only the first corner has a gap and the others are joined.
  6. **The Climb.** A mushroom, a high log, tall snags that climb (two, four or five), mushrooms over open air (one, three or four), then the great cedar's bough with the golden leaf. Touch the leaf to finish.
- **How long it takes.** The test bot's perfect run: 39.6 seconds on Easy, 57.0 on Normal, 61.1 on Hard. On Normal the sections take it 9.0, 8.2, 11.1, 6.9, 11.6 and 10.2 seconds. `GROVE_TIMES=1 npx vitest run tests/sections.test.ts --silent=false` prints these. A first try will take a good deal longer.
- **Checkpoints.** Every bank is a checkpoint on Easy and Normal, so a fall costs one section at most. On Hard only the clearing (bank 2) and the high ledge (bank 4) are; the other banks are bare stone. The worst fall on Hard, just short of the leaf, costs 23.5 seconds of a perfect run. Which banks are checkpoints is the `checkpoints` list in `difficulty.ts`.
- **Platform kinds.** Banks, logs, stumps (the tall snags of section 6 are stumps too), mushrooms, root shelves (`shelf`: the flat top of a great root on a trunk rising from the mist) and boughs. A root shelf's top edge is drawn the way a bank's is, never past where a hero can stand, and the bank-outline tests cover it. The high boughs of section 5 are drawn as thick mossy limbs on snags, turned a quarter turn where they lie across; only the last bough of the route is the great cedar's. A log end that rests on no bank or shelf is held up by a snag.
- **Drawing by distance.** The forest, the ferns and grass, and the platforms are built in 36 m stretches of route. Only the stretches between the camera and 140 m ahead of the hero are drawn: past that the mist has hidden nineteen twentieths of anything. Past 85 m trees wear their lighter crowns, and ferns, grass and the boulders and roots on the sides of banks are left out. The forest follows the route's middle (`src/view/route.ts`), so the gully and the trees bend where the route does, and no tree stands closer than 3.5 m to anything a hero can stand on. Measured on the test machine at medium quality, standing at the start of each section on Normal: 280 to 375 thousand triangles and 179 to 301 draw calls a frame. The short level drew 322 thousand in 144. So the triangle count runs from 13% under to 17% over what it was, and draw calls are up to twice what they were. What that does to the frame rate on a real iPad is not known.
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
- **Size.** The whole download is 6.87 MB (budget 20 MB, checked on every build). The build compresses textures to KTX2 and models with meshopt.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0. It also lists the hero models, which are not: the README says the characters, their art and the hero models are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit. The two browser jobs run inside Playwright's container image, pinned to the Playwright version in `package.json` (1.63.0), so a run installs nothing from Ubuntu's servers. Before this, on 2026-11-11, four runs in a row failed before any test because GitHub's machines could not reach those servers.

## Checks on this state

- `npm test`: 306 tests pass. They cover: the game rules; a bot playing the whole grove on Easy, Normal and Hard as each hero with no falls, crossing every platform in order; the sections and checkpoints (the six sections are the planned ones, each ends on a bank, a fall in each returns to the right bank, a fall on Hard costs under about 30 seconds, a perfect run takes as long as planned); every number in `difficulty.ts` showing up in the level; the route line the forest follows and the rule for drawing by distance; every bank's and root shelf's drawn top against where the rules let a hero stand; the private-terms check; the quality tiers and animation mixing; and the hero model files.
- `npm run test:browser`: 68 browser checks pass. 22 in Chromium at Mac size with the keyboard, 23 in Chromium at iPad size with touch, 23 in WebKit at iPad size with touch. They cover loading and the progress bar, a failed download, the frame counter, fixed and automatic tiers, the full lighting at medium quality (and high at Mac size), each hero's model loading with its clips and animating while it stands, runs and jumps, the stand-in model doing the same, and everything milestone one checked.
- **Not checked:**
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on real devices. The only numbers so far are from the test machine, which has no graphics card: about 15 frames a second in Chromium and 9 in WebKit on the minimal tier, and several seconds a frame on the tiers above. A real device has to be looked at with `?fps`.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids.

## What's next

1. **The owner picks one marmot scout and one giant mosquito** on the candidates page (see "Start here").
2. **Rig and animate his picks**, then the rest of part two in the order under "Start here", one pull request each.
3. **Done already:** the owner and the kids played the longer level, and he looked at it in Safari on his Mac (60 frames a second, high tier).
4. **The owner plays Caputo's three gaits in the game** and says how they look.
5. **Checking the Blender scripts on new files.** `tools/rig-quadruped.py` is meant for the enemies too: each needs its own guide file of joint places, like `tools/caputo.rig.json`. Its path for a file that already has a skeleton (keep it, add the bones it lacks) was tried only on Caputo's earlier output, before he had shoulder blades and ears.

## Known limits

- One area. Nothing in it can hurt a hero yet.
- The high boughs are logs on tall snags. They read clearly as footing, but they do not look like living boughs growing from trees.
- A hero who falls from high up drops a long way before the fall is counted (the rule is a fixed height, 6 m below the start), and the camera follows it down.
- The test bot is the only thing that has played the whole level. It measures whether each difficulty can be finished and how long a perfect run takes, not whether a jump reads well or feels fair.
- No sound, no saved progress, one player.
- Caputo is long and the footing check is a small circle under his middle, so his head, tail and outer paws hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled (issue #5).
- The minimal tier is blurry and its trees are sparse. It is only for machines that draw in software.
- On the keyboard a hero is at full speed almost at once, so Caputo's walk and trot are mostly seen on the iPad with a gentle push.
- Each of Caputo's gaits is one clip played slower or faster to match the ground, so the trot is quick-stepping at the top of its range and the gallop a little floaty at the bottom of its range.

## Added as plain scenery, not canon

Tree stumps to hop on, the tall snags of the last climb, the snags that hold logs and boughs up, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. Everything else comes from Caputo Mountain: the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, root shelves, a ravine, high boughs, a climb that starts with a spring, the golden leaf tucked in the canopy, both heroes' looks, and the end card. Nothing in the level moves, because nothing in the Caputo Mountain forest does.
