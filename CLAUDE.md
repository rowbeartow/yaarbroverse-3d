# Yaarbroverse 3D

## What this is

A 3D browser game set in the Yaarbroverse, the sibling of the 2D game Caputo Mountain. Made for two kids: the older one finds games too easy, the younger one finds them too hard. They play on an iPad (touch, held sideways) and a Mac (keyboard). The owner is not a developer: make the technical calls, explain anything he has to do as numbered steps with the exact link to open.

Read first: `docs/session-handoff.md` (what exists, what's next, open questions), then `docs/decisions.md` (settled; do not reopen).

## Status

In development. Milestone one: one playable area, the Bouncing Grove.
Live at: https://rowbeartow.github.io/yaarbroverse-3d/ once the owner has switched GitHub Pages on. `docs/session-handoff.md` says whether that has happened.

## Architecture

- Framework: Three.js, TypeScript, Vite. No physics library, no model or picture files.
- Deploy target: GitHub Pages, static files only. `.github/workflows/publish.yml` builds and publishes on every merge to main.
- Data layer: none. The browser remembers the last hero and difficulty.
- Auth: none.
- External services: none, and none are allowed inside the game (no accounts, payments, online services or AI calls).

How it fits together:

- `src/game/`: the rules. One hero in one level, advanced in fixed steps of 1/60 second. No browser or 3D code, so tests run it without a screen.
- `src/levels/<level>/difficulty.ts`: every Easy, Normal and Hard number for that level, in one file. `layout.ts` next to it builds the level from those numbers.
- `src/view/`: turns the level and hero into low-poly shapes and moves the camera. Looks only.
- `src/input/controls.ts`: keyboard and touch, turned into "which way" and "is Jump held".
- `src/ui/screens.ts` and `index.html`: start screen, pause, end card, "turn sideways" card, messages.
- `src/main.ts`: the loop that connects them.

## Run and deploy

Node 22 (`.nvmrc`).

- Install: `npm ci`
- Run locally: `npm run dev`, then open the address it prints
- Test the rules: `npm test` (fast, no browser)
- Build: `npm run build` (also fails if the download goes over 10 MB)
- Browser checks: `npm run test:browser` (builds, serves, then drives the game with keyboard and touch, in Chromium and in WebKit). In a cloud session Chromium is already installed: do not install it again. WebKit is not: run `npx playwright install --with-deps webkit` once per session. To run one browser: `npx playwright test --project=ipad-webkit` (or `mac`, `ipad`).
- Everything: `npm run check`, then `npm run test:browser`
- Deploy: merging to `main` publishes automatically. Do not deploy by hand. The same checks run on every pull request (`.github/workflows/checks.yml`). So does the private-terms check (`scripts/check-private-terms.mjs`); to try it locally: `PRIVATE_TERMS="one,two" node scripts/check-private-terms.mjs`.

## Conventions

- World, characters and tone come from Caputo Mountain (the owner's private `digglesworth` repo: its `docs/` folder and art). Read only; never change that repo. Do not invent canon. If something is needed that is not there, ask the owner.
- This repo is public. No family names, no files copied from the private repo.
- A check on every pull request fails if a private term (the repository secret `PRIVATE_TERMS`) appears in a tracked file, the pull request's title or description, or a commit message. The kids are "the younger player" and "the older player" everywhere. If a flagged line is an ordinary word, reword it; never add an allowlist.
- Every level has Easy, Normal and Hard, with all its numbers in that level's `difficulty.ts`. After changing numbers run `npm test`: a bot plays each difficulty start to finish.
- Keep rules out of `src/view` and drawing out of `src/game`.
- Small pull requests with plain-words descriptions: what changed, how it was tested. Claude merges its own once the checks pass (see `docs/decisions.md`).
- Backlog lives in GitHub Issues. New ideas become a one-line issue labeled `inbox`.
- Record settled decisions in `docs/decisions.md`. Append only.
- Keep `docs/session-handoff.md` true: what exists now, not plans written as if done.

Never modify or commit a file unrelated to the current task, including to produce a clean working tree.

## Known constraints

- The test browser has no graphics card, so 3D draws slowly there (about 10 frames a second). Browser checks run one at a time in small windows for that reason. Real devices are not affected.
- Browser checks run in Chromium (Mac-sized with a keyboard, iPad-sized with touch) and in WebKit (iPad-sized with touch), each as its own job in `checks.yml`. WebKit is Safari's engine built for Linux, not Safari itself: Safari on a real iPad is only checked by hand.
- The test tools can tap in WebKit but cannot hold a finger down or drag one. In WebKit, held and dragged fingers are touch pointer events handed to the element under the finger (see `tests/browser/touch.spec.ts`); in Chromium they are real touches.
