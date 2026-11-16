# Adding a level

A level is a folder of plain data plus one line in the level list. The rules, the heroes, the enemies, hearts, sound, the camera and the screens take any level. This page is the whole recipe. The Sandbox (`src/levels/sandbox/`) is the smallest working example: copy it.

## Before any code

1. The level's place, its name, what is in it and its goal come from the Caputo Mountain docs (the owner's private `digglesworth` repo) and from what the owner has said in a prompt (recorded in `docs/decisions.md`). Nothing else is canon. If neither says something you need, open an issue labeled `needs-decision` and ask the owner.
2. The owner approves a route plan first: a map from above showing the sections in order, each built around one idea and ending on a safe place, which way the camera faces in each, and the route's numbers on the route rule (below). The grove's plan is at the top of `src/levels/bouncing-grove/layout.ts`.
3. This repo is public. Copy no file and no wording from the private repo.

## The route rule

Routes turn (the owner's rule, 2026-11-15). A level winds, switches back and opens into wider areas, so the hero moves left, right and toward the camera, not only away from it, and the camera turns to follow the route. A level that is one line running up the screen is not allowed, however good its pieces are.

`src/game/route-shape.ts` measures it and `tests/route-shape.test.ts` holds every level on the picker to it:

- No more than 60% of the route runs away from the camera.
- At least 10% runs left on the screen, and at least 10% runs right.
- At least 8% comes back toward the camera.
- At least 2 turns for each 100 m. A turn is counted each time the route has swung 45 degrees from the way it ran at the turn before, so a long curve counts too.
- The camera turns to a new facing at least twice.

Each section of the level says which way the camera faces through it: `facing` on the section, in degrees seen from above (0 looks along -z, 90 along +x, 180 back along +z, 270 along -x). "Away", "left", "right" and "toward" are judged against that, so a camera that simply swings to keep the hero running up the screen does not pass: plan stretches that cross the screen and come back toward it.

`ROUTE_SHAPE=1 npx vitest run tests/route-shape.test.ts --silent=false` prints every level's numbers. Put them on the route plan the owner approves.

The Bouncing Grove and Cocolalla Lake were built before the rule and are on the test's waiting list until each is reshaped. No new level goes on the waiting list.

The camera does the rest (`src/view/route-camera.ts`): it turns to the next section's `facing` when the hero stands on the last solid of the section before, so end every section on a safe, roomy solid. It keeps that facing through a swim. A section can also ask the camera to sit further back and higher with `pull` (1.5 is half as far again): use it where the route comes back toward the camera, so the player sees what is ahead. The stick follows the camera, so up is always away from it. A level whose sections give no `facing` or `pull` keeps the camera looking along -z.

## The files

Pick an id: lower case and dashes, such as `bouncing-grove`. It names the folder, goes on the address (`?level=<id>`) and is the key saved progress is kept under, so it never changes once the level is live.

Make `src/levels/<id>/` with three files:

1. **`difficulty.ts`**: every Easy, Normal and Hard number for the level, in one table, with a comment on each number saying what it does. Also the three one-line blurbs for the start screen. Every level needs `hearts`, `protection`, `knockback`, `coyoteTime` and `ledgeHelp`; if it has enemies, `enemyWarning`, `enemySpeed` and `enemyRest` too, and if its scouts walk a beat and give chase or its mosquito keeps up, the grove's `scoutPatrol`, `scoutChase`, `mosquitoFollow`, `mosquitoHover` and `mosquitoPause`. Start from the grove's values for those.
2. **`layout.ts`**: one function, `build<Name>(difficulty)`, that returns a `Level` (`src/game/level.ts`) built from those numbers. No drawing code.
   - `solids`: everything to stand on. Kinds that already draw: `bank`, `log`, `stump`, `shelf`, `mushroom` (give it `bounce`), `bough`, `moss` (crumbling moss only), `arch` (rock across water, with its opening drawn when water runs under it), and for a lake `boulder` (a round rock standing out of the water), `crag` (a block of rock), `deck` (wooden boards on posts) and `island` (a wooded rise the lake scenery draws; a wall to a hero, never on the route). Mark checkpoints `safe: true`. A solid can also move: see "Pieces that move" below.
   - `spawn` must be on a safe solid. `leaf` is the goal.
   - `route`: the ids of the solids in the order a run crosses them, of any pool where a run swims across it, and of any rope a run swings on. The test bot follows it, so it must be complete and in order.
   - `water` and `breath`: see "Water" below.
   - `sections`, `hints` (shown the first time a hero stands on that solid) and `goalLine` are optional.
   - `enemies`: see how the grove places its scouts and mosquito at the end of its `layout.ts`.
   - `boss`: see "Ending a level with a boss" below.
   - Directions: x is left and right, y is up, and a level starts out running along -z, away from the camera. From there the route must turn: see "The route rule" below.
3. **`level.ts`**: the level's entry (`LevelEntry` in `src/levels/entry.ts`): `id`, `name`, `lead` (one line under the name on its card), `card`, `blurbs`, `build`, `scenery` and `music`.

And one picture, `public/cards/<id>.jpg`, for the level's card on the picker: 480 by 270, under 60 KB. Take a picture of the level with `node scripts/screenshot.mjs` and shrink it (`sharp` is installed: resize to 480 by 270, JPEG quality about 72). A level that is `devOnly` may leave `card` out.

Then add the entry to `LEVELS` in `src/levels/index.ts`. Order there is the order of the cards on the level picker. The picker, saved progress and best times all work from the list and the `id`. That is the only change outside the level's folder for a level that reuses the forest scenery and the grove music.

## Scenery

`scenery` in the entry names what is drawn around the solids. `'forest'` is the misty fir gully, and it lays itself out along any route (`src/view/route.ts`). `'lake'` (`src/view/lake.ts`) is a wooded shore with rocks and reeds round the south, west and east of the water, and open water to the north out to the Selkirk mountains. It lays itself out from the level's pools: the box that holds them all is the lake. It floats a log boom along every edge of a pool that is not shore and has no solid standing on it, draws a solid of kind `island` as a wooded rise nobody can stand on (make it more than a full jump higher than anything beside it), and leaves out any pine that would stand between the camera and the route. It draws one lake bed under everything, so the pools leave out their rock basins, and sets a clearer haze than the forest's mist (`lakeBed` and `fog` on what a builder returns). Keep the camera from facing south on a lake: the mountains are to the north.

For different surroundings:

1. Add a name to `SceneryName` in `src/levels/entry.ts`.
2. Write a builder in `src/view/` with the same shape as `buildForest` in `src/view/forest.ts` (it returns a `Forest`: a group, the sky, the tree crowns, and `update` and `setDetail`).
3. Add it to `SURROUNDINGS` in `src/view/grove-view.ts`.
4. New textures or models go in `assets/` and into `scripts/build-assets.mjs`, and each third-party file needs a line in `CREDITS.md`. Third-party files must be CC0. The build fails if the download goes over 20 MB.

A new kind of solid needs a name in `SolidKind` (`src/game/level.ts`) and a shape for it in `src/view/scenery.ts`.

## Music

`music` in the entry is the name of a looping track in `src/audio/sounds.ts`. To give a level its own:

1. Put the MP3 in `assets/audio/` and credit it in `CREDITS.md` (`tests/sound-files.test.ts` fails otherwise).
2. Add it to `SOUNDS` beside `groveMusic`, with `mix: 'music'`, `loop: true` and `home: ['<the level's id>']`.
3. It goes on the sound board for the owner's OK before it merges (`node tools/preview/sounds.mjs`).

## What loads when

Music, sounds and enemy models that belong to one level are fetched when that level is picked, not at start-up, so a new level adds nothing to every visit's first download.

- **Sounds.** A sound in `src/audio/sounds.ts` with a `home` (a list of level ids) belongs to those levels; one without is shared and fetched at start-up. A level's own sounds and music must stay under 2.5 MB together, and the shared ones under 1 MB (`SOUND_LIMITS`; `tests/sound-files.test.ts` holds both and `SOUND_SIZES=1 npx vitest run tests/sound-files.test.ts --silent=false` prints where each stands). When a level reuses a piece that makes a sound (water, a tipping log, an enemy), add the level's id to that sound's `home`: `tests/levels.test.ts` fails until every sound the level's pieces make is shared or its own.
- **Enemy models.** Nothing to do: the game works out a level's models from its enemies and its boss (`modelFilesOf` in `src/view/enemies.ts`).
- **Textures and the light** are shared by every level and fetched at start-up.

## Pieces that move

Any solid can move: give it a `motion` in `layout.ts`. The rules are in `src/game/moving.ts` (its top says how each kind behaves), the drawing in `src/view/scenery.ts` (`placeMoving`), the sounds in `src/audio/game-sounds.ts`, and `tests/moving.test.ts` holds the tests. Each game keeps its own copy of a level's moving pieces, so the level as built never changes.

Every moving piece has a tell before it moves (it shakes, and a sound plays), carries a hero standing on it, and is drawn from the rules' own numbers every frame, so its drawn top is where a hero can stand while it moves. Put its numbers in the level's `difficulty.ts` like any other, and on Easy choose numbers that need no precise timing.

- **Tipping log**: `motion: { kind: 'tip', tell, dip, rate }` on a `log` that runs along the route (longer front to back than side to side). It rests on a snag at its middle. A moment after a hero lands (`tell` seconds of creaking and rocking), the end the hero stands on sinks, up to `dip` metres at the very end, at `rate` metres a second. With nobody on it, it settles back level. A fall puts it back level. The grove's section 4, The Tipping Logs, is the example: `tip*` in its `difficulty.ts`. Keep `dip` plus the rise to the next piece well under a full jump (about 2 metres), and on Easy under half of one.

- **Crumbling moss**: `motion: { kind: 'crumble', tell, falls, sag, back }` on a `moss` solid (a mossy pad on thin rotten sticks). The moment a hero lands it shivers and drops crumbs (`tell` seconds), then falls into the mist and grows back `back` seconds later. With `falls: false` it only sags `sag` metres, holds a hero as long as they like, and rises back once left: that is the Easy version. A fall puts it back whole. Never make a hero wait on crumbling moss: put something solid before anything that has to be waited for.
- **Windy bough**: `motion: { kind: 'sway', rise, rest, move, tell, start }` on a `bough`. It keeps the wind's rhythm whether anyone is on it or not: rests low, rises `rise` metres over `move` seconds, rests high, sinks back. The last `tell` seconds of each rest are the tell (a gust, its needles shiver). `start` is how far into its rhythm it is when a run begins, in seconds; boughs in a row take turns when each starts half a rhythm after the one before. Make its low rest level with what comes before it and its high rest level with what comes after, so a hero steps on and off without a jump.

- **Crocodile stepping stone**: `motion: { kind: 'float', wake, rise, hold, tell, snap, down }` on a solid lying in a pool, its `top` where a crocodile's back floats (0.4 m over the water) and about half a metre thick so a swimmer passes under. It lies low, not there to stand on, until a hero comes within `wake` metres, then comes up over `rise` seconds. From the first step on it, it holds `hold` seconds and goes under; the last `tell` seconds are its warning. With `snap: true`, one a hero is still on when its hold runs out costs a heart. It comes up again `down` seconds later. Leave `hold` at `Infinity` for Easy: it then never goes under while anyone is about. Nobody can climb onto one from the water, so put a rock to climb onto at each end of a row and, in a long row, half way; and make what the row leads to too high to climb onto from the water, or a swimmer skips the row. Cocolalla Lake's Crocodile Crossing is the example: `stone*` in its `difficulty.ts`. It is drawn from the crocodile's model (`src/view/croc-stones.ts`); add the level's id to the `home` of the crocodile's sounds in `src/audio/sounds.ts`.

The grove's section 6, The Windy Climb, has both: `moss*` and `wind*` in its `difficulty.ts`.

The test bot copes with moving pieces on its own: it reads each piece where it is now, never lingers, does not take walking down a tilted log for an edge, waits at the edge (or on the bough) until a windy bough is resting level with where it is going, for long enough to get across, and waits for a crocodile's back to be up and good for long enough before it jumps onto it.

## Rope swings

Any level can hang a rope: give the `Level` a `ropes` list. The rules are in `src/game/rope.ts` (its top says how a swing goes), the drawing in `src/view/ropes.ts`, and `tests/rope.test.ts` holds the tests. Cocolalla Lake's Swinging Pines is the example.

- A rope is where it is tied (`x`, `y`, `z`), its `length`, which way it carries a hero (`ahead`, a step of length 1 seen from above), the solid it leads to (`to`), and where the foot of the snag that holds it stands (`foot`, for drawing only).
- Hang it about 3 m past the edge of the solid before it, with its end about 2.3 m above that solid's top (`y` is that plus the length): a running jump off the edge reaches it. A 7 m rope swings out and back in about three seconds and carries a hero 5.5 m out and 2.7 m up at the top of its swing.
- Put the rope's id in `route` between the solid before it and the solid it leads to. The test bot jumps for it and lets go when that lands it.
- Without help, a hero who lets go on the way forward flies 3 to 8 m past where the rope is tied: put the landing there, and make it long. To go up to a ledge, put its edge 3 to 4 m past the rope: only letting go in the upper part of the way forward reaches it.
- **Easy:** set `ropeHelp: true` on the `Level` from the level's `difficulty.ts`. Letting go at any point then lands the hero on the rope's `to` (the owner's rule).
- Over water, a miss is a swim: make something beside the rope low enough to climb back onto. Over open air a miss is a fall, so keep a checkpoint just before the rope.
- Make ropes cross the screen where you can (the camera's facing at right angles to `ahead`): a swing reads best from the side.
- Its sounds (`ropeGrab`, `ropeRelease`) belong to the levels that hang ropes: add the level's id to their `home` in `src/audio/sounds.ts`.

## Water

Any level can have deep water: give the `Level` a `water` list of pools, each a box seen from above (`minX`, `maxX`, `minZ`, `maxZ`) with a `surface` and a `floor` height, and an `id`. The rules are in `src/game/swim.ts` (its top says how swimming goes), and `tests/swim.test.ts` holds the tests. The Sandbox's pool is the example.

- Deep water is never a fall: a hero who walks, jumps or drops into a pool swims. Keep the `floor` above `fallY` and the pool at least 2.5 m deep.
- Put the pool's id in `route` where a run swims across it, between the solid before it and the solid after it. The test bot walks off the edge into it, swims for the next solid, dives under anything in the way, and climbs out.
- A swimmer floats with head and shoulders out, swims slower than walking, dives with the move button, swims up with Jump, and drifts up with neither. The heroes' own moves (the roll and the pounce) do nothing in water.
- The sides of a pool hold a swimmer in: the only way out is to climb. Jump at the surface next to a solid whose top is no more than 1.35 m above the water climbs out onto it; a top no higher than 0.35 m above the water is a shore, walked out on. So the solid after a pool must be within that reach, and anything a player should not climb onto must be higher.
- Something across the water with deep water under it (the Sandbox's `pool-arch`: a `bank` whose `bottom` is above the pool's floor) can only be passed underwater. Leave at least 1 m of water between its underside and the floor. Put it well past where a running jump into the pool lands (about 5 m), or the plunge carries a hero under it without a dive.
- **Breath:** `breath` on the `Level`, in seconds, from the level's `difficulty.ts`. Leave it out on Easy: breath never runs out there (the owner's rule). It fills again at the surface. Running out underwater is the same as losing the last heart: back to the last checkpoint with every heart. Make the longest swim under anything well under half the breath there is.
- **Telling players how:** the game says how to dive the first time in a run a hero goes into the water ("Press X to dive", or on touch the round button turns into a pulsing Dive button), and again when a swimmer waits a few seconds at the surface by an underwater-only passage (`passageNear` in `src/game/swim.ts`, `src/ui/dive-hint.ts`). Nothing for the level to do.
- **Checkpoints:** water is never one. Make the solid a hero climbs out onto `safe` if losing breath on the next swim should not cost what came before.
- **Enemies:** no land enemy reaches a hero whose head is underwater (acorns and dives stop at the surface). Crocodiles, still to be made, will: the owner's rule in `docs/decisions.md`. A mosquito whose patch is over a pool can dive at a swimmer at the surface: give it a `floor` just above the water. Scouts and bosses stay on their banks.
- Pieces that move and water: the crocodile stepping stone (see "Pieces that move") is the one moving piece made for water. The others have not been tried in it.
- **A lake of several pools:** each pool's id may appear only once in `route`, so a run that swims, climbs out and swims again needs a pool for each swim. A pool need not be in `route` at all: it can be only the water a missed jump lands in, as long as a solid of the route stands in it or at its edge. Pools sit side by side and never overlap. A swimmer cannot cross from one pool into the next, so stand a solid across every place the route passes from one to the other (Cocolalla Lake's grassy point, rock island, headland, gravel bar and reed bar each straddle such a line), and make sure no low bank lets a swimmer skip a section. The lake scenery floats a log boom along the rest of the line.

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

The test bot fights any boss built this way: it keeps moving round it, steps out of the line of an attack, and jumps on it when a hit would count. Before it acts it plays its plan forward on a copy of the game for under two seconds, and if that gets it hurt it dodges first (`fightSafely` in `tests/helpers/bot.ts`). `tests/boss-entry.test.ts` runs over every level with a boss with no change: the bot walks in from seven places across the arena's near side, standing or already running, and must win its first fight on every difficulty as each hero. If the bot cannot beat a boss, look at the boss's numbers before the bot.

## Checks

1. `npm test`. `tests/levels.test.ts` runs over every level in the list with no change: the level is well formed, the bot finishes it on every difficulty as each hero with no fall and no lost heart on walk and jump alone, it crosses every solid of the route in order, and standing still does not finish it. If the bot cannot finish, the level is too hard or the route list is wrong: fix the level, not the bot.
2. Add tests of the level's own numbers next to the grove's (`tests/difficulty.test.ts`, `tests/sections.test.ts`): what each difficulty changes, and how much a fall costs.
3. Look at it: `npm run dev`, then open the address it prints with `?level=<id>` on the end. Pictures: `node scripts/screenshot.mjs` (the top of that file says how).
4. `npm run check`, then `npm run test:browser`.
5. Rewrite the level's part of `docs/session-handoff.md`, and record the owner's choices in `docs/decisions.md`.

## A level still in the making

Set `devOnly: true` in its entry. It is then left off every screen a player sees and opens only with `?level=<id>`, while the tests and the bot still run over it. Take the line out when the owner says it is ready. The Sandbox stays `devOnly` for good.
