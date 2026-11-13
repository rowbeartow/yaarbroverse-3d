# Yaarbroverse 3D

## What this is

A 3D browser game set in the Yaarbroverse, the sibling of the 2D game Caputo Mountain. Made for two kids: the older one finds games too easy, the younger one finds them too hard. They play on an iPad (touch, held sideways) and a Mac (keyboard). The owner is not a developer: make the technical calls, explain anything he has to do as numbered steps with the exact link to open.

Read first: `docs/session-handoff.md` (what exists, what's next, open questions), then `docs/decisions.md` (settled; do not reopen).

## Status

In development. One playable area, the Bouncing Grove: a full level in six sections, with three enemies, hearts, a move for each hero, and sound and music. Around it: up to four players on a device, a level picker, saved best times and a ghost of each player's best run to race (milestone five, done). The next step is a second level, by the recipe in `docs/adding-a-level.md`. `docs/session-handoff.md` says what the owner has still to check on a real device.
Live at: https://rowbeartow.github.io/yaarbroverse-3d/ . Every merge to `main` publishes there, straight to the kids' devices.

## Architecture

- Framework: Three.js, TypeScript, Vite. No physics library.
- Assets: source textures, the forest light (HDRI) and models in `assets/`. `scripts/build-assets.mjs` compresses them into `public/media/` (KTX2 textures, meshopt geometry, a smaller HDR) before every build and before `npm run dev`. `public/media/` is not committed. Third-party files are CC0 and listed in `CREDITS.md`; the build fails over 20 MB. Recorded sounds and music are in `assets/audio/` (WAV and MP3, which Safari plays; under 4 MB in total, checked by `tests/sound-files.test.ts`).
- Hero models: `assets/heroes/` holds them already compressed, and the build copies them as they are. The owner's originals (20 to 30 MB each, files on the `hero-models` release) are never committed. Blender scripts in `tools/`, run with no window, make each model from its originals: `prepare-rigged.py` for a character Meshy rigged (Yaarbro: puts his one-clip files on one model, makes each clip happen on the spot, cleans up the skin), `rig-quadruped.py` for one Meshy could not rig (Caputo: builds the skeleton, skins it, writes the clips), and `pose-test.py` to look at a skin in test poses. `tools/compress-hero.mjs` then makes the small file and lists its clips. `tools/preview/` builds the page the owner reviews a hero on before a change to it is merged. Enemy models are kept the same way in `assets/enemies/`: `rig-quadruped.py` rigs the marmot scout (its guide file picks the marmot's own clips), `rig-insect.py` rigs the giant mosquito, `joint-views.py` draws a model on a grid to find its joints, and `tools/preview/enemies.mjs` builds the page the owner reviews them on. `tools/meshy-image-to-3d.mjs` makes enemy model candidates from a picture through Meshy's API, and `tools/preview/candidates.mjs` builds the page the owner picks one on.
- Deploy target: GitHub Pages, static files only. `.github/workflows/publish.yml` builds and publishes on every merge to main.
- Data layer: none. The browser's own storage on each device keeps the players (up to four, each a typed name, a colour, their last hero and difficulty, their bests and the ghost of each best run) and whether sound is muted. Nothing about a player goes into the repo, a commit, a log or a network request.
- Auth: none.
- External services: none, and none are allowed inside the game (no accounts, payments, online services or AI calls).

How it fits together:

- `src/game/`: the rules. One hero in one level, advanced in fixed steps of 1/60 second. No browser or 3D code, so tests run it without a screen.
  - `ghost.ts`: records where a hero was during a run and gives it back at any moment, as small text for storage. Looked at only: the rules never see a ghost.
  - `boss.ts`: bosses. Any level can end with one: an arena that starts the fight, a loop of warning, attack and rest, stages that change its attacks as it loses health, sidekicks it can call, and a goal kept back until it is beaten. `docs/adding-a-level.md` says how to give a level one.
  - `enemy.ts`: the marmot scout and the giant mosquito: what each does, what hurts a hero and what strikes an enemy. `game.ts` steps them with the hero. A level's difficulty can make a scout walk a beat and give chase, and the mosquito keep up and dive more often.
- `src/levels/index.ts`: the level list. The game builds whichever level is chosen from it, and the rule tests and the bot run over every level in it. `docs/adding-a-level.md` is the recipe for a new one.
- `src/levels/<level>/difficulty.ts`: every Easy, Normal and Hard number for that level, in one file. `layout.ts` next to it builds the level from those numbers. `level.ts` is what the level brings to the list: its name, layout, scenery and music. `src/levels/sandbox/` is a tiny development level, never shown to players; it ends with a practice boss that proves the boss system.
- `src/view/`: draws the level and hero and moves the camera. Looks only.
  - `grove-view.ts`: the renderer, lighting (forest light, sun with soft shadows, filmic tone mapping, glow), camera, and switching quality tiers.
  - `scenery.ts`: the level's solids as smooth textured shapes. `forest.ts`: the gully, trees, ferns, grass, mist, light. Both build shapes with `surface.ts` and `noise.ts`.
  - `route.ts`: where the route runs (its middle, sides and height), which the forest is laid out around, and the rule for drawing only the stretches of scenery near the hero (no 3D code, tested).
  - `bank-outline.ts`: the edge of a bank's top. It may be irregular, but never reaches past where the rules let a hero stand (no 3D code, tested).
  - `materials.ts`: surfaces, plus three additions to the standard ones: mist by height, moss blending, wind sway. `pictures.ts`: textures drawn in code.
  - `assets.ts`: downloads `media/` and reports progress. `quality.ts`: the tiers and the rules for choosing one (no 3D code, tested).
  - `enemies.ts`: draws each enemy from its model, the acorn, and the line an attack is aimed along. `boss.ts`: draws a boss from an enemy's model, bigger and recoloured, with its acorns and aim lines.
  - `heroes.ts`: builds a hero from its model (`hero-model.ts`, mixing rules in `hero-motion.ts`). To give a character a model, see the top of `hero-model.ts`.
- `src/audio/`: sound. Nothing plays before the first tap or key press.
  - `sounds.ts`: every sound and the music in one list: what it is for, its file in `assets/audio/` (or its recipe), its group, and its level within the group. `MIX` at the top is how loud each group and the whole game is, in decibels: the six numbers the owner sets on the mixer page.
  - `mix.ts`: whether sound may play yet, mute and its memory (no browser code, tested). `game-sounds.ts`: turns what the rules report into sounds: events, footsteps by surface and hero, the roll, the mosquito's whine, and fading with distance (no browser code, tested).
  - `graph.ts`: how the sounds are wired: each sound, its group's volume, the master, the top end turned down, a soft limiter. Shared by the game, the mixer page and the measuring tool. `player.ts`: the game's speaker: fetches and decodes the files and plays them through that wiring.
  - `synth.ts`: the recipes for the few sounds made in code, and the step that brings short sounds to one loudness.
- `src/save/ghosts.ts`: where each player's ghosts are kept, one storage entry for each level, hero and difficulty, apart from their progress.
- `src/save/players.ts`: the players on this device and their saved progress. Reading and writing never throw: damaged saved data is dropped and the game carries on (no browser code, tested).
- `src/input/controls.ts`: keyboard and touch, turned into "which way", "is Jump held" and "is the move button held" (Yaarbro's roll, Caputo's pounce).
- `src/ui/screens.ts` and `index.html`: start screen, pause, end card, "turn sideways" card, messages, hearts and a boss's health bar. `src/ui/who.ts`: the "Who's playing?" screen, shown first, with the grown-ups' reset behind a confirmation. `src/ui/picker.ts`: the level picker on the start screen, a card for each area with the current player's finished difficulties and best times, and the ghost switch.
- `src/main.ts`: the loop that connects them, the Sound button and the M key. The start screen shows first; the 3D code and files load behind it with a progress bar.

Address-bar switches: `?fps` shows the frame rate and tier, `?quality=high|medium|low|minimal` fixes the tier, `?level=sandbox` opens the development level, `?standin` plays both heroes as the CC0 stand-in model (for checking the loader and animation player against a library file).

## Run and deploy

Node 22 (`.nvmrc`).

- Install: `npm ci`
- Run locally: `npm run dev`, then open the address it prints
- Test the rules: `npm test` (fast, no browser). `GROVE_TIMES=1 npx vitest run tests/sections.test.ts --silent=false` prints how long the bot's perfect run takes to the end of each section.
- Build: `npm run build` (prepares the assets, and fails if the download goes over 20 MB or the sound and music in it go over 4 MB)
- Pictures for the docs: `node scripts/screenshot.mjs` (see the top of that file)
- Rebuild Yaarbro from his Meshy files: `blender -b -P tools/prepare-rigged.py -- <folder of Meshy files> <out.glb> tools/yaarbro.guide.json`, then compress `<out.glb>`.
- Rig Caputo from his Meshy file: `blender -b -P tools/rig-quadruped.py -- <caputo original.glb> <out.glb> tools/caputo.rig.json`, then compress `<out.glb>`.
- Rig the marmot scout: `blender -b -P tools/rig-quadruped.py -- <marmot original.glb> <out.glb> tools/marmot.rig.json`. Rig the giant mosquito: `blender -b -P tools/rig-insect.py -- <mosquito original.glb> <out.glb> tools/mosquito.rig.json`. Then `node tools/compress-hero.mjs <out.glb> <marmot or mosquito> 1024 enemies`.
- Find a model's joints for a guide file: `blender -b -P tools/joint-views.py -- <model.glb> <out.png> [guide.json]` (also needs `apt-get install -y python3-pil`).
- All of these need Blender 4 with numpy. A cloud session has Blender; run `apt-get install -y python3-numpy` once. The steps are at the top of each script.
- Compress a hero model: `node tools/compress-hero.mjs <model.glb> <name>` (see the top of that file)
- Hero preview page: `npm run assets`, then `node tools/preview/build.mjs <rigged caputo.glb> <folder>` (see the top of that file, which also says how to publish it). Publish the folder as a private Claude artifact and wait for the owner's OK before merging a change to a hero. `node tools/preview/stills.mjs` takes still frames of the page, for judging a clip in a session that cannot watch it move, and `node tools/preview/measure.mjs` measures how far planted paws slide in each gait and at each change of gait.
- Enemy preview page: `node tools/preview/enemies.mjs <folder> marmot=<rigged.glb> mosquito=<rigged.glb>`, published as a private Claude artifact for the owner's OK before a change to an enemy merges. `node tools/preview/enemy-stills.mjs` takes still frames of it.
- Arena preview page (enemies and bosses at full speed, on the game's own rules, in a blocked-out level): `npm run assets`, then `node tools/preview/arena.mjs <folder> marmot=<rigged.glb> mosquito=<rigged.glb> yaarbro=<rigged.glb> caputo=<rigged.glb>`, published as a private Claude artifact for the owner's OK before a change to how an enemy behaves merges. `node tools/preview/arena-stills.mjs` takes still frames of it. The tops of those files say the rest.
- Enemy model candidates: `NODE_USE_ENV_PROXY=1 node tools/meshy-image-to-3d.mjs <picture.png> <scratch folder> <name>` asks Meshy for three models from one picture (30 credits each; it prints the balance before and after, and never prints a key). Then `node tools/preview/candidates.mjs <scratch folder> <page folder>` builds the page the owner picks on, and `node tools/preview/candidate-stills.mjs` takes a still of it. The tops of those files say the rest.
- Pictures of the screens ("Who's playing?", the level picker, a level card), for a preview page before a change to them merges: with the built game served, `node tools/preview/screen-shots.mjs <folder> [width] [height]`.
- Sound board: `node tools/preview/sounds.mjs <folder> [<extras folder>]` builds the page the owner listens to every sound on, published as a private Claude artifact for his OK before a sound goes into the game or changes. The top of that file says the rest.
- Mixer page: `node tools/preview/mixer.mjs <folder>` builds the page the owner sets the six mix levels on by ear, published as a private Claude artifact. With it served (`npx vite preview --outDir <folder> --port 4178`), `node tools/preview/mix-measure.mjs` measures the mix in LUFS (needs ffmpeg). The aim is about -23 LUFS in normal play with the music at least 10 decibels under the effects.
- Browser checks: `npm run test:browser` (builds, serves, then drives the game with keyboard and touch, in Chromium and in WebKit). In a cloud session Chromium is already installed: do not install it again. WebKit is not: run `npx playwright install --with-deps webkit` once per session. To run one browser: `npx playwright test --project=ipad-webkit` (or `mac`, `ipad`).
- Everything: `npm run check`, then `npm run test:browser`
- Deploy: merging to `main` publishes automatically. Do not deploy by hand. The same checks run on every pull request (`.github/workflows/checks.yml`). So does the private-terms check (`scripts/check-private-terms.mjs`); to try it locally: `PRIVATE_TERMS="one,two" node scripts/check-private-terms.mjs`.

## Conventions

- World, characters and tone come from Caputo Mountain (the owner's private `digglesworth` repo: its `docs/` folder and art) and from the owner's prompts. Anything the owner states in a prompt is canon; record it in `docs/decisions.md`. The private repo is read only; never change it. Do not invent canon. If something is needed that neither source gives, ask the owner.
- This repo is public. No family names, no files copied from the private repo. The one exception is the hero models the owner made from that art (`assets/heroes/`, compressed, all rights reserved; see `docs/decisions.md`).
- A check on every pull request fails if a private term (the repository secret `PRIVATE_TERMS`) appears in a tracked file, the pull request's title or description, or a commit message. The kids are "the younger player" and "the older player" everywhere. Player names in tests and docs are made up (Pip, Moss). If a flagged line is an ordinary word, reword it; never add an allowlist.
- Every level has Easy, Normal and Hard, with all its numbers in that level's `difficulty.ts`. After changing numbers run `npm test`: a bot plays each difficulty start to finish.
- Keep rules out of `src/view` and drawing out of `src/game`.
- Small pull requests with plain-words descriptions: what changed, how it was tested. Claude merges its own once the checks pass (see `docs/decisions.md`).
- Backlog lives in GitHub Issues. New ideas become a one-line issue labeled `inbox`.
- Record settled decisions in `docs/decisions.md`. Append only.
- Keep `docs/session-handoff.md` true: what exists now, not plans written as if done.

Never modify or commit a file unrelated to the current task, including to produce a clean working tree.

## Known constraints

- The test browsers have no graphics card. The game notices (Chromium says so; for WebKit the checks add `?quality=minimal`) and uses the lowest tier: plain shading, no shadows, no smoothed edges, sparse trees, about 9 to 15 frames a second here and fewer on GitHub's machines. Browser checks run one at a time for that reason. The full lighting is checked on purpose by `tests/browser/look.spec.ts` at medium and high quality in a small window, which takes seconds a frame. Real devices are not affected.
- Browser checks must not wait on the clock for the game to do something. A slow machine draws few frames, and the game only moves forward a tenth of a second per frame. Wait on the game's own state (`expectAtRest` and `frames` in `tests/browser/helpers.ts`).
- Pictures drawn in code (`pictures.ts`) ask for `willReadFrequently`, which keeps the drawing on the processor. Without it a browser with no graphics card takes about 7 seconds to start.
- The Poly Haven files come straight from Poly Haven (`CREDITS.md` gives the addresses and checksums). A cloud session can only fetch them if its environment's network settings allow `polyhaven.com`, `api.polyhaven.com` and `dl.polyhaven.org`.
- Browser checks run in Chromium (Mac-sized with a keyboard, iPad-sized with touch) and in WebKit (iPad-sized with touch), each as its own job in `checks.yml`. On GitHub both jobs run inside Playwright's container image (`mcr.microsoft.com/playwright`), pinned to the exact Playwright version in `package.json`, so no run installs anything from Ubuntu's servers. To upgrade Playwright, change `package.json`, `package-lock.json` and the two image lines in `checks.yml` together; `scripts/check-playwright-image.mjs` fails the checks if they differ. WebKit is Safari's engine built for Linux, not Safari itself: Safari on a real iPad is only checked by hand.
- Nobody can hear a test browser, and a cloud session cannot hear at all. The checks prove sound is asked for at the right moments, is silent before the first tap and when muted, and raises no error (`tests/sound.test.ts`, `tests/browser/sound.spec.ts`, and `__grove.sound` on the page). How it sounds is judged by the owner, on the sound board and in the game.
- Sound must start from inside a tap or key press, or Safari stays silent. The page listens for every tap and key before anything else does (`main.ts`) and wakes the sound each time. Sound files are WAV for short sounds (nothing added at either end) and MP3 for music.
- The test tools can tap in WebKit but cannot hold a finger down or drag one. In WebKit, held and dragged fingers are touch pointer events handed to the element under the finger (see `tests/browser/touch.spec.ts`); in Chromium they are real touches.
