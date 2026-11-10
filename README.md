# Yaarbroverse 3D

A 3D browser game set in the Yaarbroverse, the sibling of the 2D game Caputo Mountain. Made for two kids: one who finds games too easy and one who finds them too hard, so every level has Easy, Normal and Hard.

**The first area: the Bouncing Grove.** Cross the fallen log, hop the stumps, bounce on the mushrooms and find the golden leaf, tucked in the canopy. Play as Yaarbro or Caputo.

## How to play

- **Mac:** arrow keys or W A S D to move, Space to jump (hold for a higher jump), Esc to pause.
- **iPad:** hold it sideways. Left thumb moves, right thumb jumps.

A fall puts you back on the last safe mossy bank. On Hard only the first bank is safe.

## Change how hard it is

Every Easy, Normal and Hard number for the grove is in one file: [src/levels/bouncing-grove/difficulty.ts](src/levels/bouncing-grove/difficulty.ts). Each number has a plain-words note. After a change, `npm test` plays all three difficulties start to finish and fails if one has become impossible.

## For agents and developers

Start with [CLAUDE.md](CLAUDE.md). Current state and next step: [docs/session-handoff.md](docs/session-handoff.md). Decisions: [docs/decisions.md](docs/decisions.md).

Node 22 (`.nvmrc`), then:

```sh
npm ci
npm run dev           # play locally at the address it prints
npm test              # game rules, no browser
npm run build         # production build into dist/, with a download size check
npm run test:browser  # keyboard and touch checks in a real browser
```
