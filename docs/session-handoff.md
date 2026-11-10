# Session handoff

Last updated: 2026-11-10

## Where things stand

Milestone one is built and merged. One small playable area, **the Bouncing Grove**, runs locally and passes its checks. **It is not live at a web address yet**: publishing is wired up, but the owner has to switch GitHub Pages on once (steps in `README.md` under "Switch on the link"). Nobody has played it on a real iPad or Mac yet.

Milestone two has not started. It waits on the owner's choices below.

## What exists now

- **The level.** Mossy bank, a fallen log with a break, a second bank, tree stumps that climb, a third bank with a mushroom, a high log, mushrooms over open air, then the big bough with the golden leaf. Touch the leaf to finish. A perfect run takes about 15 seconds; a first try will take a good deal longer.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They look different and move the same: walk, jump (hold for height), bounce on mushrooms.
- **Camera.** Behind and above the hero, always looking the same way. A dark spot under the hero shows where a jump will land.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`. Easy: wide logs, short gaps, 3 stumps, 1 mushroom to cross, every bank safe. Normal: 4 stumps, 2 mushrooms. Hard: thin logs, long gaps, 5 stumps, 3 mushrooms, only the first bank safe.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. There are no hearts and nothing that hurts.
- **End card.** Difficulty, hero, time, falls, date. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, Esc. Touch: drag the left half to move, press the right half to jump.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card, with a line on turning rotation lock off. The game holds still while it shows.
- **This device remembers** the last hero and difficulty.
- **Size.** The whole download is about 0.6 MB (budget 10 MB, checked on every build). No model, picture or sound files apart from three small icons.
- **Publishing.** `.github/workflows/publish.yml` builds and publishes to GitHub Pages on every merge to main. Until Pages is switched on it finishes without publishing. The address will be https://rowbeartow.github.io/yaarbroverse-3d/ .
- **Checks on every pull request.** `.github/workflows/checks.yml`: rule tests, build with size check, browser checks.

## Checks on this state

- `npm test`: 94 rule tests pass. They include a bot playing the whole grove on Easy, Normal and Hard as each hero with no falls.
- `npm run test:browser`: 25 browser checks pass in Chromium, on a Mac-sized window with the keyboard and an iPad-sized window with touch. They pass on GitHub's machines too.
- **Not checked:**
  - The published page. Nothing has been published, so the publish step itself has never run for real.
  - Safari, a real iPad, a real Mac. The checks use Chromium on a machine with no graphics card.
  - Whether it is fun, and whether Easy is easy enough and Hard hard enough for the kids.

## What's next

**The owner switches GitHub Pages on** (five steps in `README.md`), then the kids play it: the younger on Easy, the older on Hard, each with their own hero. Things to watch for:

- Does the younger player reach the leaf on Easy? If not, raise the Easy `logWidth`, `stumpRadius` and `mushroomRadius`, or lower the gaps.
- Does the older player fall and want another go on Hard? "Still too easy" means raising the Hard gaps. The tests cap every jump at four fifths of what a running jump can cover: on Hard the log gap can grow from 3.6 to 4.0 and the stump gap from 3.0 to about 3.7.
- Touch on the real iPad: does the stick feel right, does anything zoom or scroll, are the buttons in the way.
- Can they judge jumps going away from the camera, or do they want the camera higher or lower.

## Open questions for the owner (milestone two)

1. **What milestone two adds.** Recommended: make the grove a fuller level before adding a second area. That means something that can hurt, taken from the 2D forest (the marmot scout and the giant mosquito), hearts, and a longer route.
2. **Should the heroes play differently?** In the 2D game Yaarbro rolls and Caputo pounces and wall-jumps. Recommended: bring one signature move each into 3D at the same time as the first enemies, so there is something to use them on.
3. **Public or private link.** The link will be public: anyone who has the address can play. Nothing in the game or this repo names the family. Recommended: leave it public, because a login on the kids' iPads is a hassle. The alternative is the Cloudflare login used for Caputo Mountain.

Smaller: the start screen says "Yaarbroverse 3D" above the level name. That is the repo name used as a working title, not a name anyone chose.

## Known limits

- Short: one area, about 60 to 80 metres of route.
- No sound, no saved progress, one player.
- Caputo is long and the footing check is a small circle under his middle, so his head and tail hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled. iPads and Macs are fine.
- Browser checks do not cover Safari's engine.

## Added as plain scenery, not canon

Tree stumps to hop on, and the great cedar that holds the last bough. Everything else (the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, the golden leaf tucked in the canopy, both heroes' looks, the end card) comes from Caputo Mountain.
