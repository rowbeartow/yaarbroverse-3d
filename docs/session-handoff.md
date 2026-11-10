# Session handoff

Last updated: 2026-11-10

## What exists now

One small playable area: **the Bouncing Grove**. It runs locally (`npm run dev`). It is not published anywhere yet.

- **The level.** Mossy bank, a fallen log with a break, a second bank, tree stumps that climb, a third bank with a mushroom, a high log, mushrooms over open air, then the big bough with the golden leaf. Touch the leaf to finish.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They look different and move the same: walk, jump (hold for height), bounce on mushrooms.
- **Camera.** Behind and above the hero, always looking the same way. A dark spot under the hero shows where a jump will land.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`. Easy: wide logs, short gaps, 3 stumps, 1 mushroom to cross, every bank safe. Normal: 4 stumps, 2 mushrooms. Hard: thin logs, long gaps, 5 stumps, 3 mushrooms, only the first bank safe.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. There are no hearts and nothing that hurts.
- **End card.** Difficulty, hero, time, falls, date. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, Esc. Touch: drag the left half to move, press the right half to jump.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card, with a line on turning rotation lock off. The game holds still while it shows.
- **This device remembers** the last hero and difficulty.
- **Size.** The whole download is about 0.6 MB (budget 10 MB, checked on every build). No model, picture or sound files apart from three small icons.

## Checks on this state

- `npm test`: 94 rule tests pass. They include a bot playing the whole grove on Easy, Normal and Hard as each hero with no falls.
- `npm run test:browser`: 25 browser checks pass in Chromium, on a Mac-sized window with the keyboard and an iPad-sized window with touch.
- Not checked: Safari, a real iPad, a real Mac. Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids. Only a playtest answers those.

## What does not exist yet

- Hosting. There is no link to open. That is the next pull request.
- Enemies, hearts, hero abilities, sound, saved progress, two-player, a second level.

## What's next

1. Publish to GitHub Pages on merge, and give the owner the steps to switch Pages on.
2. Report to the owner and stop (end of milestone one).

## Open questions

None yet. They go in the milestone report.

## Added as plain scenery, not canon

Tree stumps to hop on, and the great cedar that holds the last bough. Everything else (the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, the golden leaf tucked in the canopy, both heroes' looks, the end card) comes from Caputo Mountain.
