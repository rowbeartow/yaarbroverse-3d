# Adding a level

A level is a folder of plain data plus one line in the level list. The rules, the heroes, the enemies, hearts, sound, the camera and the screens take any level. This page is the whole recipe. The Sandbox (`src/levels/sandbox/`) is the smallest working example: copy it.

## Before any code

1. The level's place, its name, what is in it and its goal come from the Caputo Mountain docs (the owner's private `digglesworth` repo) and from what the owner has said in a prompt (recorded in `docs/decisions.md`). Nothing else is canon. If neither says something you need, open an issue labeled `needs-decision` and ask the owner.
2. The owner approves a route plan first: the sections in order, each built around one idea and ending on a safe place. The grove's plan is at the top of `src/levels/bouncing-grove/layout.ts`.
3. This repo is public. Copy no file and no wording from the private repo.

## The files

Pick an id: lower case and dashes, such as `bouncing-grove`. It names the folder, goes on the address (`?level=<id>`) and is the key saved progress is kept under, so it never changes once the level is live.

Make `src/levels/<id>/` with three files:

1. **`difficulty.ts`**: every Easy, Normal and Hard number for the level, in one table, with a comment on each number saying what it does. Also the three one-line blurbs for the start screen. Every level needs `hearts`, `protection`, `knockback`, `coyoteTime` and `ledgeHelp`; if it has enemies, `enemyWarning`, `enemySpeed` and `enemyRest` too, and if its scouts walk a beat and give chase or its mosquito keeps up, the grove's `scoutPatrol`, `scoutChase`, `mosquitoFollow`, `mosquitoHover` and `mosquitoPause`. Start from the grove's values for those.
2. **`layout.ts`**: one function, `build<Name>(difficulty)`, that returns a `Level` (`src/game/level.ts`) built from those numbers. No drawing code.
   - `solids`: everything to stand on. Kinds that already draw: `bank`, `log`, `stump`, `shelf`, `mushroom` (give it `bounce`), `bough`. Mark checkpoints `safe: true`. A solid can also move: see "Pieces that move" below.
   - `spawn` must be on a safe solid. `leaf` is the goal.
   - `route`: the ids of the solids in the order a run crosses them. The test bot follows it, so it must be complete and in order.
   - `sections`, `hints` (shown the first time a hero stands on that solid) and `goalLine` are optional.
   - `enemies`: see how the grove places its scouts and mosquito at the end of its `layout.ts`.
   - `boss`: see "Ending a level with a boss" below.
   - Directions: x is left and right, y is up, and the route runs away from the camera, which is -z. The camera always looks that way, so a route never comes back toward it.
3. **`level.ts`**: the level's entry (`LevelEntry` in `src/levels/entry.ts`): `id`, `name`, `lead` (one line under the name on its card), `card`, `blurbs`, `build`, `scenery` and `music`.

And one picture, `public/cards/<id>.jpg`, for the level's card on the picker: 480 by 270, under 60 KB. Take a picture of the level with `node scripts/screenshot.mjs` and shrink it (`sharp` is installed: resize to 480 by 270, JPEG quality about 72). A level that is `devOnly` may leave `card` out.

Then add the entry to `LEVELS` in `src/levels/index.ts`. Order there is the order of the cards on the level picker. The picker, saved progress and best times all work from the list and the `id`. That is the only change outside the level's folder for a level that reuses the forest scenery and the grove music.

## Scenery

`scenery` in the entry names what is drawn around the solids. `'forest'` is the misty fir gully, and it lays itself out along any route (`src/view/route.ts`).

For different surroundings:

1. Add a name to `SceneryName` in `src/levels/entry.ts`.
2. Write a builder in `src/view/` with the same shape as `buildForest` in `src/view/forest.ts` (it returns a `Forest`: a group, the sky, the tree crowns, and `update` and `setDetail`).
3. Add it to `SURROUNDINGS` in `src/view/grove-view.ts`.
4. New textures or models go in `assets/` and into `scripts/build-assets.mjs`, and each third-party file needs a line in `CREDITS.md`. Third-party files must be CC0. The build fails if the download goes over 20 MB.

A new kind of solid needs a name in `SolidKind` (`src/game/level.ts`) and a shape for it in `src/view/scenery.ts`.

## Music

`music` in the entry is the name of a looping track in `src/audio/sounds.ts`. To give a level its own:

1. Put the MP3 in `assets/audio/` and credit it in `CREDITS.md` (`tests/sound-files.test.ts` fails otherwise). Sound and music together must stay under 4 MB.
2. Add it to `SOUNDS` beside `groveMusic`, with `mix: 'music'` and `loop: true`.
3. It goes on the sound board for the owner's OK before it merges (`node tools/preview/sounds.mjs`).

## Pieces that move

Any solid can move: give it a `motion` in `layout.ts`. The rules are in `src/game/moving.ts` (its top says how each kind behaves), the drawing in `src/view/scenery.ts` (`placeMoving`), the sounds in `src/audio/game-sounds.ts`, and `tests/moving.test.ts` holds the tests. Each game keeps its own copy of a level's moving pieces, so the level as built never changes.

Every moving piece has a tell before it moves (it shakes, and a sound plays), carries a hero standing on it, and is drawn from the rules' own numbers every frame, so its drawn top is where a hero can stand while it moves. Put its numbers in the level's `difficulty.ts` like any other, and on Easy choose numbers that need no precise timing.

- **Tipping log**: `motion: { kind: 'tip', tell, dip, rate }` on a `log` that runs along the route (longer front to back than side to side). It rests on a snag at its middle. A moment after a hero lands (`tell` seconds of creaking and rocking), the end the hero stands on sinks, up to `dip` metres at the very end, at `rate` metres a second. With nobody on it, it settles back level. A fall puts it back level. The grove's section 4, The Tipping Logs, is the example: `tip*` in its `difficulty.ts`. Keep `dip` plus the rise to the next piece well under a full jump (about 2 metres), and on Easy under half of one.

The test bot copes with moving pieces on its own: it reads each piece where it is now, never lingers, and does not take walking down a tilted log for an edge.

## New enemies

A level may reuse the marmot scout and the giant mosquito as they are. A new enemy is its own piece of work, done before the level: its behaviour in `src/game/enemy.ts`, its model made and rigged the way the handoff describes, and the owner's OK on the enemy preview page.

## Ending a level with a boss

Any level can end with a boss. The rules are in `src/game/boss.ts` (read its top: it says how a fight goes), the drawing in `src/view/boss.ts`. The Sandbox's practice boss is the smallest working example.

1. **Its numbers** go in the level's `difficulty.ts`, as a `boss: BossNumbers` for each difficulty: health, whether it is `guarded` (only a hit while it rests counts), how long its warnings and rests last, how many acorns it throws and how fast, how fast it charges, whether lines are drawn where its attacks will go (`aimLine`: Easy only, by the owner's rule), and its `stages`. A stage is a list of attacks (`throw`, `charge`, `call`) and the share of health at which it begins, so the attacks change as it loses health. Every attack has a warning: the rules give it one whatever the list says.
2. **Its arena** is a wide, flat solid in `layout.ts`, marked `safe: true` on every difficulty, with `safeAt` set to a spot just inside its near edge. That makes the arena's doorstep the checkpoint, so losing to the boss costs the fight and not the level. Leave at least 3 metres between `safeAt` and the near edge of the boss's `arena` rectangle, so a hero sent back stands outside the fight until they step in.
3. **The boss itself** is `boss` on the `Level`: its `id`, the `name` on its health bar, its `look` (which enemy's model, how many times the size, a colour laid over it), where it waits, its `patch` (the rectangle its middle never leaves: keep its whole body on the arena), its `arena` (the rectangle that starts the fight when the hero stands in it), its `radius` and `height`, and the numbers. Keep `height` under about 1.7: a full jump rises 2 metres, and landing on top has to be possible.
4. **The goal** goes beyond the arena. The game keeps it out of reach, and out of sight, until the boss is beaten.
5. **Sidekicks** are ordinary enemies in the level's `enemies` list with `sidekickOf: '<the boss's id>'`. They lie low until the boss uses its `call` attack, come back each time it calls, and give up when it is beaten.
6. **Its music** is `bossMusic` in the level's entry: a looping track from `src/audio/sounds.ts` that takes over from the level's own music while the fight is on. Left out, the level's music plays on.
7. **The regen rule** needs nothing from the level: when the hero is sent back to a safe bank, the boss goes home at full health and the fight starts over.
8. A new boss is canon: its name and what it is come from the owner. It goes on the arena preview page (`tools/preview/arena.mjs`) for his OK before it merges.

The test bot fights any boss built this way: it keeps moving round it, steps out of the line of an attack, and jumps on it when a hit would count. If the bot cannot beat a boss without losing a heart, look at the boss's numbers before the bot.

## Checks

1. `npm test`. `tests/levels.test.ts` runs over every level in the list with no change: the level is well formed, the bot finishes it on every difficulty as each hero with no fall and no lost heart on walk and jump alone, it crosses every solid of the route in order, and standing still does not finish it. If the bot cannot finish, the level is too hard or the route list is wrong: fix the level, not the bot.
2. Add tests of the level's own numbers next to the grove's (`tests/difficulty.test.ts`, `tests/sections.test.ts`): what each difficulty changes, and how much a fall costs.
3. Look at it: `npm run dev`, then open the address it prints with `?level=<id>` on the end. Pictures: `node scripts/screenshot.mjs` (the top of that file says how).
4. `npm run check`, then `npm run test:browser`.
5. Rewrite the level's part of `docs/session-handoff.md`, and record the owner's choices in `docs/decisions.md`.

## A level still in the making

Set `devOnly: true` in its entry. It is then left off every screen a player sees and opens only with `?level=<id>`, while the tests and the bot still run over it. Take the line out when the owner says it is ready. The Sandbox stays `devOnly` for good.
