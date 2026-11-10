# Yaarbroverse 3D

A 3D browser game set in the Yaarbroverse, the sibling of the 2D game Caputo Mountain. Made for two kids: one who finds games too easy and one who finds them too hard, so every level has Easy, Normal and Hard.

There is no playable page yet. This first step holds the game rules for the first area, the Bouncing Grove, and the tests that play it start to finish.

## For agents and developers

Node 22 (`.nvmrc`), then:

```sh
npm ci
npm test    # game rules: movement, falls, the goal, difficulty numbers, full runs
```

- Current state and next step: [docs/session-handoff.md](docs/session-handoff.md)
- Why things are the way they are: [docs/decisions.md](docs/decisions.md)
- Easy, Normal and Hard numbers for the grove: [src/levels/bouncing-grove/difficulty.ts](src/levels/bouncing-grove/difficulty.ts)
