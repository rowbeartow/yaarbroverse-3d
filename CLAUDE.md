# Yaarbroverse 3D

## What this is

A 3D browser game set in the Yaarbroverse, the sibling of the 2D game Caputo Mountain. Made for two kids: the older one finds games too easy, the younger one finds them too hard. They play on an iPad (touch, held sideways) and a Mac (keyboard). The owner is not a developer: make the technical calls, explain anything he has to do as numbered steps with the exact link to open.

Read first: `docs/session-handoff.md` (what exists, what's next, open questions), then `docs/decisions.md` (settled; do not reopen).

## Status

In development. One playable area, the Bouncing Grove. Milestone three, part one (a longer grove in six sections) is in progress; `docs/session-handoff.md` says how far it has got.
Live at: https://rowbeartow.github.io/yaarbroverse-3d/ . Every merge to `main` publishes there, straight to the kids' devices.

## Architecture

- Framework: Three.js, TypeScript, Vite. No physics library.
- Assets: source textures, the forest light (HDRI) and models in `assets/`. `scripts/build-assets.mjs` compresses them into `public/media/` (KTX2 textures, meshopt geometry, a smaller HDR) before every build and before `npm run dev`. `public/media/` is not committed. Third-party files are CC0 and listed in `CREDITS.md`; the build fails over 20 MB.
- Hero models: `assets/heroes/` holds them already compressed, and the build copies them as they are. The owner's originals (20 to 30 MB each, files on the `hero-models` release) are never committed. Blender scripts in `tools/`, run with no window, make each model from its originals: `prepare-rigged.py` for a character Meshy rigged (Yaarbro: puts his one-clip files on one model, makes each clip happen on the spot, cleans up the skin), `rig-quadruped.py` for one Meshy could not rig (Caputo: builds the skeleton, skins it, writes the clips), and `pose-test.py` to look at a skin in test poses. `tools/compress-hero.mjs` then makes the small file and lists its clips. `tools/preview/` builds the page the owner reviews a hero on before a change to it is merged.
- Deploy target: GitHub Pages, static files only. `.github/workflows/publish.yml` builds and publishes on every merge to main.
- Data layer: none. The browser remembers the last hero and difficulty.
- Auth: none.
- External services: none, and none are allowed inside the game (no accounts, payments, online services or AI calls).

How it fits together:

- `src/game/`: the rules. One hero in one level, advanced in fixed steps of 1/60 second. No browser or 3D code, so tests run it without a screen.
- `src/levels/<level>/difficulty.ts`: every Easy, Normal and Hard number for that level, in one file. `layout.ts` next to it builds the level from those numbers.
- `src/view/`: draws the level and hero and moves the camera. Looks only.
  - `grove-view.ts`: the renderer, lighting (forest light, sun with soft shadows, filmic tone mapping, glow), camera, and switching quality tiers.
  - `scenery.ts`: the level's solids as smooth textured shapes. `forest.ts`: the gully, trees, ferns, grass, mist, light. Both build shapes with `surface.ts` and `noise.ts`.
  - `route.ts`: where the route runs (its middle, sides and height), which the forest is laid out around, and the rule for drawing only the stretches of scenery near the hero (no 3D code, tested).
  - `bank-outline.ts`: the edge of a bank's top. It may be irregular, but never reaches past where the rules let a hero stand (no 3D code, tested).
  - `materials.ts`: surfaces, plus three additions to the standard ones: mist by height, moss blending, wind sway. `pictures.ts`: textures drawn in code.
  - `assets.ts`: downloads `media/` and reports progress. `quality.ts`: the tiers and the rules for choosing one (no 3D code, tested).
  - `heroes.ts`: builds a hero from its model (`hero-model.ts`, mixing rules in `hero-motion.ts`). To give a character a model, see the top of `hero-model.ts`.
- `src/input/controls.ts`: keyboard and touch, turned into "which way" and "is Jump held".
- `src/ui/screens.ts` and `index.html`: start screen, pause, end card, "turn sideways" card, messages.
- `src/main.ts`: the loop that connects them. The start screen shows first; the 3D code and files load behind it with a progress bar.

Address-bar switches: `?fps` shows the frame rate and tier, `?quality=high|medium|low|minimal` fixes the tier, `?standin` plays both heroes as the CC0 stand-in model (for checking the loader and animation player against a library file).

## Run and deploy

Node 22 (`.nvmrc`).

- Install: `npm ci`
- Run locally: `npm run dev`, then open the address it prints
- Test the rules: `npm test` (fast, no browser). `GROVE_TIMES=1 npx vitest run tests/sections.test.ts --silent=false` prints how long the bot's perfect run takes to the end of each section.
- Build: `npm run build` (prepares the assets, and fails if the download goes over 20 MB)
- Pictures for the docs: `node scripts/screenshot.mjs` (see the top of that file)
- Rebuild Yaarbro from his Meshy files: `blender -b -P tools/prepare-rigged.py -- <folder of Meshy files> <out.glb> tools/yaarbro.guide.json`, then compress `<out.glb>`.
- Rig Caputo from his Meshy file: `blender -b -P tools/rig-quadruped.py -- <caputo original.glb> <out.glb> tools/caputo.rig.json`, then compress `<out.glb>`.
- Both need Blender 4 with numpy. A cloud session has Blender; run `apt-get install -y python3-numpy` once. The steps are at the top of each script.
- Compress a hero model: `node tools/compress-hero.mjs <model.glb> <name>` (see the top of that file)
- Hero preview page: `npm run assets`, then `node tools/preview/build.mjs <rigged caputo.glb> <folder>` (see the top of that file, which also says how to publish it). Publish the folder as a private Claude artifact and wait for the owner's OK before merging a change to a hero. `node tools/preview/stills.mjs` takes still frames of the page, for judging a clip in a session that cannot watch it move, and `node tools/preview/measure.mjs` measures how far planted paws slide in each gait and at each change of gait.
- Browser checks: `npm run test:browser` (builds, serves, then drives the game with keyboard and touch, in Chromium and in WebKit). In a cloud session Chromium is already installed: do not install it again. WebKit is not: run `npx playwright install --with-deps webkit` once per session. To run one browser: `npx playwright test --project=ipad-webkit` (or `mac`, `ipad`).
- Everything: `npm run check`, then `npm run test:browser`
- Deploy: merging to `main` publishes automatically. Do not deploy by hand. The same checks run on every pull request (`.github/workflows/checks.yml`). So does the private-terms check (`scripts/check-private-terms.mjs`); to try it locally: `PRIVATE_TERMS="one,two" node scripts/check-private-terms.mjs`.

## Conventions

- World, characters and tone come from Caputo Mountain (the owner's private `digglesworth` repo: its `docs/` folder and art). Read only; never change that repo. Do not invent canon. If something is needed that is not there, ask the owner.
- This repo is public. No family names, no files copied from the private repo. The one exception is the hero models the owner made from that art (`assets/heroes/`, compressed, all rights reserved; see `docs/decisions.md`).
- A check on every pull request fails if a private term (the repository secret `PRIVATE_TERMS`) appears in a tracked file, the pull request's title or description, or a commit message. The kids are "the younger player" and "the older player" everywhere. If a flagged line is an ordinary word, reword it; never add an allowlist.
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
- The test tools can tap in WebKit but cannot hold a finger down or drag one. In WebKit, held and dragged fingers are touch pointer events handed to the element under the finger (see `tests/browser/touch.spec.ts`); in Chromium they are real touches.
