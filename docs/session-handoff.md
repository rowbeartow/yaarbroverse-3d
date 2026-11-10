# Session handoff

Last updated: 2026-11-10

## Where things stand

Milestone one is built, merged and live at https://rowbeartow.github.io/yaarbroverse-3d/ . GitHub Pages is switched on, and every merge to `main` publishes there.

Milestone two (the modern look) is part way through:

1. Done: a check that fails any pull request holding a private term.
2. Skipped: tuning from the playtest. The playtest notes in the milestone prompt were blank, so no numbers changed.
3. Done: browser checks run in WebKit as well as Chromium.
4. Done: the world and lighting. The grove is a lit, textured forest. The heroes are still drawn from shapes.
5. Not started: the hero models. The owner makes them in Meshy's web app and uploads `yaarbro.glb`, and `caputo.glb` when ready, to the repo root on the branch `hero-models`. That branch did not exist when this was written.

Nobody has played the new look on a real iPad or Mac yet.

## What exists now

- **The level.** Mossy bank, a fallen log with a break, a second bank, tree stumps that climb, a third bank with a mushroom, a high log, mushrooms over open air, then the big bough with the golden leaf. Touch the leaf to finish. A perfect run takes about 15 seconds; a first try will take a good deal longer. The rules, difficulty numbers and controls are the same as in milestone one.
- **The look.** The route crosses a misty gully in a fir forest. Banks are pillars of lichen rock with moss on top. Logs and trunks have bark with moss growing over it, stumps have cut rings, mushrooms have glossy spotted caps. Firs and cedars have boughs that sway, as do ferns and grass. The golden leaf glows.
- **Lighting.** A forest photograph lights everything (image-based lighting), a warm sun casts soft shadows, leaf shade drifts over the route, a filmic curve maps light to the screen, mist thickens with distance and with depth, and bright things glow.
- **Quality tiers.** High, medium, low and minimal, chosen automatically: a computer starts on high, an iPad on medium, a machine with no graphics card on minimal. The game watches the frame rate and steps down (never up) if it cannot hold 60 on a computer or a steady 30 on touch. `?fps` on the address shows the frame rate and tier. `?quality=` fixes the tier.
- **Loading.** The start screen shows at once. The 3D code and files load behind it with a progress bar, and Play switches on when they are ready. A file that fails to arrive shows a card with a "Try again" button.
- **Heroes.** Yaarbro and Caputo, picked on the start screen, still built from shapes. They look different and move the same: walk, jump (hold for height), bounce on mushrooms. The model loader and animation player are built and checked against a CC0 stand-in robot (`?standin`). Giving a hero its model is a file in `assets/models/` and an entry in `src/view/hero-model.ts`.
- **Camera.** Behind and above the hero, always looking the same way. A soft dark spot under the hero shows where a jump will land.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. No hearts and nothing that hurts.
- **End card.** Difficulty, hero, time, falls, date. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, Esc. Touch: drag the left half to move, press the right half to jump.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card.
- **This device remembers** the last hero and difficulty.
- **Size.** The whole download is about 4.8 MB (budget 20 MB, checked on every build). The build compresses textures to KTX2 and models with meshopt.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0. The README says the characters and art are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit.

## Checks on this state

- `npm test`: 121 tests pass. 94 for the game rules (a bot plays the whole grove on Easy, Normal and Hard as each hero with no falls), 11 for the private-terms check, 16 for the quality tier rules and the animation mixing rules.
- `npm run test:browser`: 67 browser checks pass. 21 in Chromium at Mac size with the keyboard, 23 in Chromium at iPad size with touch, 23 in WebKit at iPad size with touch. They cover loading and the progress bar, a failed download, the frame counter, fixed and automatic tiers, the full lighting at medium quality (and high at Mac size), the stand-in model loading and animating, and everything milestone one checked.
- **Not checked:**
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on real devices. The only numbers so far are from the test machine: about 6 frames a second in Chromium and 3 in WebKit on the minimal tier, and several seconds a frame on the tiers above. A real device has to be looked at with `?fps`.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - The CC0 files came from public GitHub copies, not from polyhaven.com (unreachable from a cloud session). See `CREDITS.md`.
  - Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids.

## What's next

1. **The owner looks at the live link on the iPad and the Mac**, with `?fps` on the address, and says what frame rate and tier show and whether anything looks wrong.
2. **Hero models**, once `yaarbro.glb` (and `caputo.glb`) are on the `hero-models` branch: move them to `assets/models/`, add each to `HERO_MODELS` in `src/view/hero-model.ts`, match the soft spot and camera framing, list the clips each file holds. Yaarbro is rigged as a humanoid with walk, run, idle, jump, falling, landing and roll clips. Caputo is rigged as a quadruped with only a walk clip and no tail bones: his idle, run, jump, fall and landing are to be posed in code. Then retake `docs/bouncing-grove.jpg` and add a second picture for the other hero.
3. **Playtest tuning**, when there are notes: change only `src/levels/bouncing-grove/difficulty.ts`.
4. **Milestone three** makes the grove a full level: the marmot scout and giant mosquito, hearts, a longer route with checkpoints, Yaarbro's roll and Caputo's pounce. Each move must beat or get past both enemies. Easy stays finishable with walk and jump alone. See `docs/decisions.md`.

## Known limits

- Short: one area, about 60 to 80 metres of route.
- No sound, no saved progress, one player.
- Caputo is long and the footing check is a small circle under his middle, so his head and tail hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled (issue #5).
- The minimal tier is blurry and its trees are sparse. It is only for machines that draw in software.
- The branch `claude/brave-cannon-2aq6iz` carries merges of `main`, because this session could not force-push a restarted branch. Each pull request's file changes are still only its own.

## Added as plain scenery, not canon

Tree stumps to hop on, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. Everything else (the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, the golden leaf tucked in the canopy, both heroes' looks, the end card) comes from Caputo Mountain.
