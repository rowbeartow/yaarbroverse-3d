# Yaarbroverse 3D

A 3D browser game set in the Yaarbroverse, the sibling of the 2D game Caputo Mountain. Made for two kids: one who finds games too easy and one who finds them too hard, so every level has Easy, Normal and Hard.

**The first area: the Bouncing Grove.** Cross the fallen log, hop the stumps, bounce on the mushrooms and find the golden leaf, tucked in the canopy. Play as Yaarbro or Caputo.

![Yaarbro on a mossy bank in the Bouncing Grove, with tree stumps and a mushroom ahead](docs/bouncing-grove.jpg)

## Play

**https://rowbeartow.github.io/yaarbroverse-3d/**

The link works once GitHub Pages is switched on for this repo (a one-time step for the owner, below). After that, every change merged to `main` is published there within a few minutes.

- **Mac:** arrow keys or W A S D to move, Space to jump (hold for a higher jump), Esc to pause.
- **iPad:** hold it sideways. Left thumb moves, right thumb jumps.

A fall puts you back on the last safe mossy bank. On Hard only the first bank is safe.

### Switch on the link (owner, one time)

1. Open https://github.com/rowbeartow/yaarbroverse-3d/settings/pages
2. Under **Build and deployment**, open the **Source** menu and choose **GitHub Actions**. There is no Save button; it saves by itself.
3. Open https://github.com/rowbeartow/yaarbroverse-3d/actions/workflows/publish.yml
4. Click **Run workflow** (right side), leave the branch as `main`, and click the green **Run workflow** button.
5. Wait about two minutes for the green tick, then open https://rowbeartow.github.io/yaarbroverse-3d/

If the address is different on your account, the real one is shown at the top of the page from step 1 once the first publish has finished.

### Put it on an iPad

1. On the iPad, open **Safari** and go to `rowbeartow.github.io/yaarbroverse-3d`.
2. Tap **Share** (the square with an up arrow; on newer iPads it can be inside the **•••** menu), then **Add to Home Screen**, then **Add**.
3. Open the new **Bouncing Grove** icon. It opens full screen.
4. Turn the iPad sideways, pick a hero and a difficulty, tap **Play**. The iPad remembers the choices.

If the game says "Turn sideways to play" while the iPad is already sideways, rotation lock is on: swipe down from the top-right corner and tap the lock button with the arrow around it.

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
