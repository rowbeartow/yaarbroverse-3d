# Session handoff

Last updated: 2026-11-10

## What exists now

- The game rules for one hero in one level (`src/game`): walk, jump (hold for height), bounce on mushrooms, fall back to the last safe mossy bank, touch the golden leaf to finish. A run record: level, difficulty, hero, time, falls.
- The first area as data (`src/levels/bouncing-grove`): the Bouncing Grove, built from the Easy, Normal and Hard numbers in `difficulty.ts`.
- Tests (`npm test`, 81 passing): movement, the goal and run record, the difficulty numbers, and a bot that plays the whole grove on Easy, Normal and Hard as each hero without a fall.

## What does not exist yet

- Anything you can see or play. There is no page, no 3D picture, no controls. That is the next pull request.
- Hosting.

## What's next

1. The playable page: 3D picture, both heroes, follow camera, keyboard and touch, start screen, end card, "turn sideways" card, browser checks.
2. Publishing to GitHub Pages on merge.

## Open questions

None yet.
