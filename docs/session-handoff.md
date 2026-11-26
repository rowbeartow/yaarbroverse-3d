# Session handoff

Last updated: 2026-11-26. Milestone eleven, part two is under way. **The monster pike fight is built** (the pull request this version of the handoff arrived in: if you are reading this on `main`, it has merged). Walblum's rescue, the two new moves and the pike's own sounds are not in the game yet: each waits on the owner (below). Everything under "The record" is as earlier sessions wrote it.

## Start here

### Where part two stands

The owner's order for part two is in `docs/decisions.md` ("Milestone eleven, part two: the owner's word", 2026-11-25). Step by step:

1. **The dock measured first: done.** Before anything was built, on Hard (`node tools/draw-measure.mjs cocolalla hard`, the test browser, high tier, Yaarbro): 828,942 triangles in 377 draw calls at the dock. Draw calls in that tool move by tens from run to run (the handoff before this one had 321 for the same build).
2. **Walblum's kick and Claw Slash: on a preview page, waiting for the owner's and the kids' OK. Not in the game.** The page: https://claude.ai/artifact/3LWDnEZhPwmaL1ybvNCZbt (the game itself in the Bouncing Grove, at a marmot scout or the Marmot Chief, either hero, watching or playing). The work is on the branch `claude/backup-moves` and is not merged:
   - Rules: `src/game/sidekick.ts`, one mechanism and one set of numbers for both heroes, on a third button (`ally` on `Input`; C or Z, or a third round touch button). It goes to the nearest enemy or boss within 11 m in front, strikes once and comes back; it cannot be sent again until it is back. Off unless the game is made with `{ ally: true }`. `tests/sidekick.test.ts` has its tests.
   - Clips, all built in Blender, no Meshy credits: Walblum rigged by `tools/rig-walblum.py` (`idle`, `kick`, `tumble`, and for the rescue `scared`, `paddle`, `cheer`); Yaarbro's `ally_send` and `ally_catch`; Caputo's `claw_slash`. `walblum.glb` is 262 KB, fetched only when a game has the move.
   - Claude's read from still frames: the armpit launch reads as an arm thrown up, Claw Slash reads clearly, and Walblum's kick reads as a feet-first flying kick, because his legs are very short. The owner judges it moving.
   - Once he says OK: merge that branch into a fresh one from `main`, wire the pike in at `PIKE HOOK` in `src/game/game.ts` (`pikeOpen` and `hitPike`), run `node tools/preview/fishing-measure.mjs` for both heroes (both models were rebuilt), run the browser checks in WebKit (that branch ran Chromium only), and count the dock again.
3. **The monster pike fight: built** (this pull request). What it is: `docs/decisions.md`, "The monster pike fight, as built". Where it is in the code: below.
4. **Walblum's rescue: not built.** It needs Walblum's model rigged with his clips (part of step 2's work, waiting for the OK) and then: Walblum on a drifting log in the middle of the pike's circle, paddling to the dock when the pike is beaten, and reaching him and the golden leaf as one moment that ends the level; the rescue saved for the player, and the new button there from the start in every level from then on.
5. **The new sounds: on the sound board, waiting for the owner's picks.** https://claude.ai/artifact/MuruPdJayZchXcq4MxRYde , the last group on the page: two recordings each for the pike hooked, the line snapping, the pike surfacing, its jaws snapping, Walblum's kick, Claw Slash and the rescue. He replies with seven letters. The fourteen cut files, their sources, checksums and the exact cuts are on the branch `claude/backup-pike-sounds` under `tools/sound-candidates/pike/` (its README says what to do once he picks). Until then the pike borrows the crocodile's growl, splash and bite and the grove's boss-beaten jingle (`src/audio/game-sounds.ts`, the `pike` events).

### The monster pike, as built

- **Rules:** `src/game/pike.ts` (the water half; its top says how the fight goes) and the `monster` in `src/game/fishing.ts` (its shadow's circle, the hook, the pips of the tug of war, the drag, getting away). `game.ts` joins the two (`fished`, `dragged`, `fightPike`) and keeps the goal shut until it is beaten (`goalOpen`). The level gives a `pike` (`PikeSpot`) beside its `fishing`.
- **Numbers:** `monster` and `pike` in the lake's `difficulty.ts`; where things are, `pike*` in `LAKE_SHAPE` in its `layout.ts`. Easy 4 pips, Normal 6, Hard 8; the tug of war takes half.
- **Drawn** by `src/view/pike.ts` from the picked pike's model, nine metres long and darkened, with its shadow on the water, and on Easy a line where a charge or a snap will go. Its words are `pikeNews` in `src/ui/fishing-words.ts`; its health bar is the boss's (`showBoss` in `src/main.ts`).
- **The floating log** is the solid `pike-log`, west of the fishing water. The fishing dock is a checkpoint on every difficulty now.
- **Tests:** `tests/pike.test.ts` (the tug of war: tiring, thrashing, the line snapping; the drag; the charge; the snap and the opening; each way of striking it; the regen rule; the level ending only after it is beaten; the bot beating it on every difficulty as each hero). `tests/water-exits.test.ts` covers the water the drag throws a hero into. `tests/browser/pike.spec.ts` checks it in a browser. The bot's way with it is `tests/helpers/pike-plan.ts`: it walks to the end of the dock first (and meets the scouts there), then fishes.
- **The fight on a page the owner can watch:** the lake preview page opens on "The monster pike": PREVIEW_FIGHT
- **Not in it yet, and why:** jaws that open (the pike's model has no jaw bone: cut the lower jaw free in `tools/rig-fish.py` the way `weigh_jaw` in `tools/rig-quadruped.py` did for the crocodile, and show the owner on the enemy preview page first); Walblum and his log (step 4); a hit from the kick or Claw Slash (step 2: `pikeOpen` and `hitPike` in `src/game/pike.ts` are what the move calls); music of its own (the lake's plays on).
- **What the bot's perfect run of the whole lake takes now:** about 96 s on Easy, 112 on Normal and 138 on Hard, the fight included (`RUN_TIME` in `tests/lake.test.ts`).

### What the pike costs to draw

DRAW_COST

### What was not checked, and the owner is the one who can (on the Mac)

1. **The frame rate at the jetty and on the floating log, on Hard, in Safari with `?fps`.** A cloud session counts triangles, not frames. The floor is 60; he is to be told before the dock goes below 65.
2. **The fight moving, and how it feels.** A cloud session saw still frames. Whether the big shadow reads as something to cast at, whether the drag is fun or a shock, whether the jaws coming up are warning enough on Hard, whether Easy needs no timing for the younger player.
3. **How the stand-in sounds sit** until he picks the pike's own.

### Things this session learned

- **Start a session in the `yaarbroverse` environment.** This one was started in the `digglesworth` environment, whose network rules allow neither `opengameart.org` (every CC0 recording so far) nor `rowbeartow.github.io` (the live site). The owner approved moving the session's network onto `yaarbroverse`, which allows both.
- **There is no Meshy key in either environment** (no network secret for `api.meshy.ai`). Clips are built in Blender on the hero's own rig, which costs nothing.
- **The fishing and pike design page could not be opened** (https://claude.ai/artifact/WM17aRk4LTHHDwveCCkfrs : "not found" from a cloud session, as the handoff before this one warned). The fight was built from `docs/decisions.md`.
- **The private repo** (`digglesworth`) can be added to a session read only with the `add_repo` tool. Its notes on Walblum: a small brown muskrat, terrified of pike, not human, no clothes, mostly body language and little dialogue; rescued from pike at Cocolalla Lake by fishing (an approved adaptation there).
- **Never `git add -A` while a side job has a worktree open** under `.claude/worktrees/`: it sweeps the worktree in as a stray entry. This session did, and took it back out in the next commit.

### The frame budget: the dock's number

**The owner measured the jetty on 2026-11-25: 75 frames a second at the lowest, on Hard, as Yaarbro, in Safari on his Mac.** His words: "Record it in the handoff as the dock's number for part two to stay above."

- The dock is the lake's heaviest place, and it is where the pike and Walblum go.
- **The floor is still 60 frames a second on the Mac** (`docs/decisions.md`). 75 is the jetty's measured headroom, not a new floor: part two can spend it. **Tell the owner before building anything that would take the dock below 65 on Hard**, so there is margin left for later levels (his answer, 2026-11-25).
- A cloud session counts triangles, not frames. With fishing, the dock draws 825,006 triangles in 321 draw calls (`node tools/draw-measure.mjs cocolalla hard`, the test browser, high tier, Yaarbro). That is what 75 frames a second looks like in that tool. Count again after each piece of part two and give him the before and after; he measures the frames.
- If the jetty drops: draw fewer fish first (`count` in `FISH`, the lake's `difficulty.ts`).

### Money and limits

- **Meshy credits spent in milestone eleven: 233** (196 on the fish, 37 on Yaarbro's clips). The owner allowed 200 and then 40. Ask before spending more.
- **No iPad.** The owner has none to test on (his note, 2026-11-11, and again 2026-11-25: "skip iPad checks"). Ask him for nothing on an iPad. The checks on GitHub in WebKit at iPad size still run on every pull request and must pass.

### What exists now from part one

- **Fishing** from a jetty off the lake's fishing dock: bass, perch, trout and pike. Rules `src/game/fishing.ts`; every number is `fishing` and `FISH` in the lake's `difficulty.ts`; drawn by `src/view/fishing.ts`; words `src/ui/fishing-words.ts`; recipe `docs/adding-a-level.md`, "Fishing". `tests/fishing.test.ts` covers it and the fishing bot (`tests/helpers/fisher.ts`) catches every kind on every difficulty as each hero.
- **The fish book**: each player's catch (how many of each kind, and the biggest), on the end card and the lake's card. `fish` on the player in `src/save/players.ts`; `tests/fish-book.test.ts`.
- **The fishing sounds** are in (the owner's picks, choice A of each).
- **Yaarbro's fishing clips** (the owner's OK, 2026-11-20): made by `tools/prepare-rigged.py` from keys in `tools/yaarbro.guide.json`. He has no finger bones, so the rod, its reel and a landed fish are held at a grip point in the middle of each palm.
- **Caputo's fishing clips** (the owner's OK, 2026-11-25; `docs/decisions.md`, "Caputo's fishing clips are in the game"): written by `tools/rig-quadruped.py`. The rod is held at one grip point between his teeth (`"grips"` in `tools/caputo.rig.json`, the same numbers on his entry in `HERO_MODELS`). The cast and the reel are as on his page. **Landing a fish differs from his page, and that was Claude's call:** the jetty has water in front of him, so he flings the fish over himself onto the boards behind, and turns to stand over it and roar, facing the camera (`landOnBoards` and `fishFlung` in `src/view/held-tackle.ts`). If the owner does not like it in the game, that is the place to change it.
- **The check for both heroes' clips**: `node tools/preview/fishing-measure.mjs [yaarbro or caputo]`, on the enemies preview page built with the hero and the four fish. It measures every frame: what he holds stays at his grips, and nothing passes through his body or head. It passes for both. Run it before any change to their fishing clips, their grips or `held-tackle.ts`.
- **The fish**: bass A, perch A, trout B and pike A, the kids' picks. Never make them again. **Their four originals are on the `hero-models` release now** (downloaded and checked on 2026-11-25: sizes and checksums match the table below). `tools/rig-fish.py` with `tools/fish.rig.json` rigs any of them; the compressed files are `assets/fish/<name>.glb`.

| File | Bytes | SHA-256 starts | Meshy Image to 3D task |
| --- | --- | --- | --- |
| `bass-a.glb` | 4,292,620 | `0b293250cfce4502` | `01a1f52c-0dc4-71b5-8564-171a244bf294` |
| `perch-a.glb` | 4,474,100 | `50255cf9bbb4a47b` | `01a1f52c-0f9b-776d-947a-499465247a27` |
| `trout-b.glb` | 3,414,568 | `db1f7bdbe91e7ad0` | `01a1f52c-0f1b-71a9-927d-88f30c7f301c` |
| `pike-a.glb` | 4,750,672 | `10c7f2442efa488b` | `01a1f52c-0f3f-7013-8552-5704d31a7c92` |

- **Headroom on the lake** (pull requests 82 and 83): the lake's mosquitoes are drawn from a 5 thousand triangle copy of the model, and only the six nearest enemies within 45 m are drawn (`lightEnemies` and `enemySight` on the level).

### The checks, as they run now

- `npm test`: 1,327 rule tests pass. They come in two kinds (`tests/bot-runs.ts`): 790 in which a bot plays the game (any test file that uses a helper that plays it), and 537 quick ones. `npm run test:rules` and `npm run test:bot` run one kind each.
- **On GitHub the bot's runs have a job of their own**, "Whole-level bot runs", with an hour to finish in, and each test in it may take five minutes (the owner's word, 2026-11-25: a slow machine must not fail a run). No bot-run test may set a time limit of its own; `tests/bot-runs.test.ts` fails if one does. The required check "Tests, build and browser checks" waits for the new job.
- The browser checks pass in Chromium and in WebKit on every pull request. New: a whole catch as Caputo (`tests/browser/fishing.spec.ts`).
- The whole download is 15.28 MB (budget 20 MB).

### Not checked, and the owner is the one who can (on the Mac)

1. **Caputo's fishing in the game, moving.** A cloud session saw still frames: the rod in his jaws through the cast and the reel, the heave, the turn, the fish on the boards and the rod beside him, from the middle of the jetty and from its end. Whether the turn and the fling read well at full speed is his to say.
2. **Yaarbro's fishing in the game.** He said OK on the page; he has not said he has seen it in the game.
3. **How fishing feels**: whether the dark shapes read as fish, whether Easy needs no timing for the younger player and Hard is work enough for the older.
4. **The lighter mosquito** in the game's light, and whether an enemy can be seen to appear as the hero comes within 45 m.

### Things a new session trips on

- **Blender is not always on the machine.** Run `apt-get update && apt-get install -y blender python3-numpy` once.
- **The owner's preview pages could not be opened from the session of 2026-11-25** (claude.ai said "not found" for every address in this file, though the owner can open them). That session changed no page. If a page has to change and cannot be read, ask the owner for its link or publish a new one and give him the new address.
- **To see the game itself in still frames**, serve the built game (`npm run build`, then `npx vite preview --port 4173`) and drive it with Playwright through `window.__grove` (`tests/browser/helpers.ts` shows how to pick a player, a hero and stand on a solid). The test browser draws in real time on the low tier; to step through a quick moment, hold `requestAnimationFrame` from an init script and run the held frame by hand, one frame a step.
- **Backup branches that can be deleted** (their work is merged): every `claude/backup-*` branch on GitHub, `claude/backup-caputo-fishing`, `claude/backup-caputo-clips` and `claude/backup-handoff` among them.

### The roadmap, in the owner's order

1. **Milestone eleven, part two: next.** Walblum's kick, Claw Slash, the monster pike fight and the rescue.
2. **The Bouncing Grove reshaped by the route rule.** Today 92% of it runs away from the camera with no camera turns; it is on the route test's waiting list until then. Plan it the way the lake was planned: a map from above with the camera's facing in each part, for the owner's OK before anything is built.
3. **Simple gripping hands for Yaarbro** (the owner's word, 2026-11-20), before skiing and climbing: one bone that curls his fingers and one for his thumb, on each hand.
4. Skiing in the Selkirks, with Caputo on a snowboard.
5. Mountain climbing on rock, ice and trees.

---

---

# The record

Everything below is the record of earlier work, kept as it was written at the time. Where it disagrees with "Start here", "Start here" is right.

## The top of this page as it stood on 2026-11-25, before part two

**Next: milestone eleven, part two. Walblum's kick, Caputo's Claw Slash, the monster pike fight and the rescue.** Start with a plan for the owner, as every milestone has. Nothing of part two is built.

**What part two is**

- **The design is settled**: https://claude.ai/artifact/WM17aRk4LTHHDwveCCkfrs , with the owner's answers at its foot (`docs/decisions.md`, "The owner's answers on the fishing and pike design"). The fight starts as fishing: casting at the monster's shadow hooks it. A tug of war from the jetty takes half its pips; it then drags the hero into the lake; in the water it circles and charges, the hero climbs onto a floating log and strikes it when it surfaces to snap; beaten, it sinks, and **Walblum's rescue is the last thing in the level**: reaching him and the golden leaf at the dock is one moment. The new button (Walblum's kick for Yaarbro, Claw Slash for Caputo) is the reward, saved for the player and there from the start in every level from then on.
- **Walblum's kick and Claw Slash** (`docs/decisions.md`, "Walblum and Caputo's new ability" and "The kids' picks"): Claw Slash is a swipe that sends three glowing claw marks to the nearest enemy in front of Caputo and hits it. It must stay as useful as Walblum's kick against every enemy and boss, the pike included.
- **The monster pike** is the picked pike (`assets/fish/pike.glb`, 5,000 triangles), much bigger and darker, unless the kids ask for its own model. It needs jaws that snap: cut its lower jaw free in `tools/rig-fish.py` the way `weigh_jaw` in `tools/rig-quadruped.py` did for the crocodile.
- **Walblum** is `walblum-b.glb` on the `hero-models` release (3,550,484 bytes, SHA-256 starts `b8c2d3a956888065`): https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/walblum-b.glb . Never make him again. He was made standing with his arms out, so Meshy's rigging (`tools/meshy-rig-animate.mjs`) may take him. His whiskers hang down in the model and are to be straightened when he is rigged.

**What part two can build on**

- The tug of war is fishing's own (`src/game/fishing.ts`: `hooked`, `fight`, `strain`), so the first half of the fight is a bigger fish with pips.
- Bosses are `src/game/boss.ts`. The pike is the first in water; the crocodile (`src/game/crocodile.ts`) is the model for circling, a tell and a charge. The golden leaf is already kept back until a boss is beaten.
- **The way out of the water at the dock is built**: steps up the dock's south side (`dock-step-*` in the lake's `layout.ts`), away from the fishing. `tests/water-exits.test.ts` holds every stretch of water to having a way out.
- Both heroes hold a rod and land a fish with clips of their own, placed by one piece of code (`src/view/held-tackle.ts`). A fight on the line can use the reel clips as they are.


## Milestone eleven, part one, as written on 2026-11-20

**Milestone eleven, part one, fishing at Cocolalla: built and merged (2026-11-19).** What the owner asked for is in `docs/decisions.md` (2026-11-19). Pull requests: 82 and 83 (headroom on the lake), 84 (the fish rig), 85 (fishing from the jetty), 86 (the fish book). The last pull request of the session carried this handoff: if you are reading this on `main`, it has merged.

**The owner played fishing on 2026-11-19** (`docs/decisions.md`, "The owner's play of fishing"): sounds, choice A of each; Yaarbro's cast OK, his reel and "landed" to be built again and shown again; and two bugs, both fixed in the pull request this version of the handoff arrived in (if you are reading this on `main`, it has merged):

- **The golden leaf is off the way to the jetty.** The dock is 9 m long, the jetty leaves its west end and the leaf is at its east end (`leafFromEast`, `jettyFromWest` in the lake's `layout.ts`). `tests/fishing.test.ts` walks a hero to the jetty three ways and checks the level does not end.
- **No stretch of water is a trap.** The pier's water has a low rock by the posts (`post-rock`) and steps up the dock's south side (`dock-step-*`). `tests/water-exits.test.ts` drops a hero into the water all along every level's route and fails if it cannot get out; `docs/adding-a-level.md` ("Water") has the rule.

**The fishing sounds are in** (choice A of each; `fishCast`, `fishReel`, `fishBite`, `fishSplash`, `fishLanded` in `src/audio/sounds.ts`, played from the `fishing` events in `src/audio/game-sounds.ts`), in the pull request this version of the handoff arrived in. Item 1 below is done; item 2 changed: the owner said the cast is OK and asked for the reel and "landed" to be built again and shown again before merging.

**As written before he played:**

1. **The fishing sounds.** Fishing is silent. Ten recordings, two each for cast, reel, bite, splash and landing a fish, are on the sound board for his picks: https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH . He replies with a letter for each. All are CC0 from OpenGameArt; the sources and how each was cut are in the table below. Once he picks: put the five files in `assets/audio/`, add them to `SOUNDS` in `src/audio/sounds.ts` with `home: ['cocolalla']` (bite and splash in the `cue` group, the others `action`, the reel `loop: true`), play them from the `fishing` events in `src/audio/game-sounds.ts` (`cast`, `plop` and `thrash` for the splash, `bite`, `landed`; the reel while `game.fishing.reeling`), credit them in `CREDITS.md` with the downloads' checksums, and check the lake's own sounds stay under 2.5 MB (`tests/sound-files.test.ts`).
2. **Yaarbro's fishing clips are in the game** (the owner's OK, 2026-11-20, with tray hands on "landed"; `docs/decisions.md`). His page: https://claude.ai/artifact/QGgTaP26vF1NQFfTUFcQk9 . All three clips (`fish_cast`, `fish_reel`, `fish_show`) are made by `tools/prepare-rigged.py` from keys in `tools/yaarbro.guide.json` (`"made"`); Meshy's are not used. His model has no finger bones, so everything is held at a grip point in the middle of a palm (`"grips"` in the guide, and `fishing.grips` on his entry in `HERO_MODELS`; `tests/held-tackle.test.ts` holds the two together). Where the rod, the reel, the line and a landed fish go is worked out in one place, `src/view/held-tackle.ts`: the game draws from it (`src/view/fishing.ts`, from `HeroView.tackle()`), so does the preview page (`tools/preview/tackle.ts`), and `node tools/preview/fishing-measure.mjs` checks every frame of the clips on the page: props at the grip points, nothing through his body or head, tray hands, and the reel clip's rod, reel, line, lean and sway. Run it after any change to his clips, his grips or `held-tackle.ts`; it passes now. In the game: the cast winds back while a cast is aimed and whips forward as the lure flies; the reel loops while a fish is on, and he turns to face the fish; "landed" follows the rules' clock (`FISHING.show`, 2.6 s, the clip's length). The page's words are written by hand into the built `index.html`, not kept in the repo. **Not yet checked by the owner in the game itself, on the iPad or the Mac.**
3. **Caputo's fishing: on a page of its own, waiting for the owner's OK.** The page: https://claude.ai/artifact/RfCs71TkWax5kSqCFsbjGg (2026-11-20). He holds the rod in his jaws, as the design page said: three clips written by `tools/rig-quadruped.py` (`fish_cast`, `fish_reel`, `fish_show`), with the grip in his mouth in `tools/caputo.rig.json` (`"grips"`). `node tools/preview/fishing-measure.mjs caputo` checks every frame and passes. Claude's read is that the jaws work, so the swatting version was not built; it is the owner's fallback if he or the kids think it looks bad. The work is on the branch `claude/backup-caputo-fishing` and is not in the game: Caputo still stands still with the rod drawn in front of him. Once he says OK: merge that branch's tools, compress the rigged model into `assets/heroes/caputo.glb`, add the three clips and a jaw grip to his entry in `HERO_MODELS`, and draw his rod, reel and landed fish in `src/view/fishing.ts` from `readJaws`, `rodSpatOut` and `lieOnBoards` in `src/view/held-tackle.ts` (which are on that branch), as the page does.

| Sound | A | B |
| --- | --- | --- |
| Cast | `swish-7` from "Swishes Sound Pack" by artisticdude | `swish-3` from the same pack, at three quarters speed |
| Reel (loops) | 1.5 s of `reel.wav` from 1.0 s in, "Fisheefects" by You're Perfect Studio (sounds by Memoraphile) | `rattle1.wav`, "Mechanical Sounds" by BMacZero |
| Bite | `bloop.wav`, "Fisheefects" | `bubble_02`, "40 CC0 water / splash / slime SFX" by rubberduck |
| Splash | the first 0.9 s of `splash.wav`, "Fisheefects" | the first 0.7 s of `splash_04`, rubberduck's pack |
| Landed | the first 1.3 s of `point_special.wav`, "Fisheefects" | `confirmation_002`, "Interface Sounds" by Kenney |

Each was made mono at 32,000 samples a second with its leading silence off and short fades. "Fisheefects" is offered under CC0 among other licenses (https://opengameart.org/content/fisheefects ); "Mechanical Sounds" is https://opengameart.org/content/mechanical-sounds . The cut files exist only on the machine that made them: cut them again from the downloads. SHA-256 of the downloads starts: `FisheefectsComplete.zip` `4532eca6b9829a56`, `swishes.zip` `7980215241b739a7`, `water-splash-slime-sfx.zip` `7cd39abb49d4362a`, `rattle1.wav` `65ae71cd800986e4`, `kenney_interfaceSounds.zip` `f2193d072726d675`.

**Next: milestone eleven, part two.** Walblum's kick, Caputo's Claw Slash, the monster pike fight and the rescue. Start with a plan for the owner, as every milestone has.

- **The design is settled**: https://claude.ai/artifact/WM17aRk4LTHHDwveCCkfrs , with the owner's answers at its foot (`docs/decisions.md`, "The owner's answers on the fishing and pike design"). The fight starts as fishing: casting at the monster's shadow hooks it. A tug of war from the jetty takes half its pips; it then drags the hero into the lake; in the water it circles and charges, the hero climbs onto a floating log and strikes it when it surfaces to snap; beaten, it sinks, and **Walblum's rescue is the last thing in the level**: reaching him and the golden leaf at the dock is one moment. The new button (Walblum's kick for Yaarbro, Claw Slash for Caputo) is the reward, saved for the player and there from the start in every level from then on. The page is built by a script that is not in the repo: to change it, read the page with the Artifact tool and publish over the same address.
- **What part two can build on**: the tug of war is fishing's own (`src/game/fishing.ts`: `hooked`, `fight`, `strain`), so the first half of the fight is a bigger fish with pips. Bosses are `src/game/boss.ts`; the pike is the first in water, and the crocodile (`src/game/crocodile.ts`) is the model for circling, a tell and a charge. The golden leaf is kept back until a boss is beaten already.
- **The monster pike** is the picked pike (`assets/fish/pike.glb`, 5,000 triangles), much bigger and darker, unless the kids ask for its own model. It needs jaws that snap: cut its lower jaw free in `tools/rig-fish.py` the way `weigh_jaw` in `tools/rig-quadruped.py` did for the crocodile.
- **Walblum** is `walblum-b.glb` on the `hero-models` release (see "The kids' picks" below). He was made standing with his arms out, so Meshy's rigging may take him.
- **A way out of the water at the dock** is needed: the dock stands 2.6 m over the water, too high to climb (the design has low steps).
- **The frame budget**: the dock is the lake's heaviest place and fishing has used some of the headroom (below). Count with `tools/draw-measure.mjs` before and after each piece.

**Meshy credits in milestone eleven: 233** (196 on the fish, 37 on Yaarbro's clips). The owner allowed 200 and then 40. Ask before spending more.

**What exists from part one:**

- **The fish**: bass A, perch A, trout B and pike A, the kids' picks. Never make them again. `tools/rig-fish.py` with `tools/fish.rig.json` rigs any of them (seven bones; clips `idle`, `swim`, `thrash`, `flop`); the compressed files are `assets/fish/<name>.glb`; `tests/fish-files.test.ts` holds them. The owner was sent fresh download links on 2026-11-19 to save the four originals to the `hero-models` release: once they are there, check them against this table.

| File | Bytes | SHA-256 starts | Meshy Image to 3D task |
| --- | --- | --- | --- |
| `bass-a.glb` | 4,292,620 | `0b293250cfce4502` | `01a1f52c-0dc4-71b5-8564-171a244bf294` |
| `perch-a.glb` | 4,474,100 | `50255cf9bbb4a47b` | `01a1f52c-0f9b-776d-947a-499465247a27` |
| `trout-b.glb` | 3,414,568 | `db1f7bdbe91e7ad0` | `01a1f52c-0f1b-71a9-927d-88f30c7f301c` |
| `pike-a.glb` | 4,750,672 | `10c7f2442efa488b` | `01a1f52c-0f3f-7013-8552-5704d31a7c92` |

  - Rig a fish: `blender -b -P tools/rig-fish.py -- <picked original.glb> <out.glb> tools/fish.rig.json <bass, perch, trout or pike>`, then `node tools/compress-hero.mjs <out.glb> <name> 512 fish`.
  - Pages: the candidates https://claude.ai/artifact/1h8T7Z81kdQBjd8ZC1Kcuh , the rigged fish moving https://claude.ai/artifact/TznKmhea4xUFvcL8DLQsRx .
- **Fishing** (`docs/decisions.md`, "How fishing works, and its numbers" and "Where the lake's fishing is, and how it is drawn"; the recipe is `docs/adding-a-level.md`, "Fishing"). The rules are `src/game/fishing.ts`, stepped by `game.ts` while the hero stands on the spot; every number is `fishing` (and `FISH`) in the lake's `difficulty.ts`. The spot is on a jetty off the dock's north side (`jetty` in the lake's `layout.ts`), off the route and off the scouts' ground. Drawn by `src/view/fishing.ts`; the words and the button's labels are `src/ui/fishing-words.ts`; the line bar is `#line`. `tests/fishing.test.ts` covers casting, bites, reeling and the line snapping, and the bot (`tests/helpers/fisher.ts`) catches every kind on every difficulty as each hero. `tests/browser/fishing.spec.ts` plays a catch in the browser.
- **The fish book** (`docs/decisions.md`, "The fish book"): one for each player for the whole game, `fish` on the player in `src/save/players.ts`; `Players.land` adds a run's catch, finished or not. On the landed message, the end card ("Fish caught") and the lake's card (`.fish-book`, pictures in `public/fish/`). `tests/fish-book.test.ts`.
- **The lake preview page** (https://claude.ai/artifact/Gq1nsmNEZTm7NnfsdaTPq5 ) opens on "Fishing from the jetty": watching, the fishing bot goes after each kind in turn. Rebuild it with `npm run assets` then `node tools/preview/lake.mjs <folder>`.
- **A camera fix**: a solid off the route now keeps its section's facing, and one in no section leaves the camera alone (`src/view/route-camera.ts`). Before, stepping onto one swung the camera to the level's first facing.
- **Yaarbro's fishing clip files** from Meshy, stripped small, are in `tools/yaarbro-fish-clips/`. None is used now: his three fishing clips are made by `tools/prepare-rigged.py` from the guide's keys (see item 2 under "Start here").
- `tests/lake.test.ts` gives its bot tests 60 seconds each: three had timed out at the usual 5 on busy machines, one of them on a publish run.

**What fishing costs to draw** (`node tools/draw-measure.mjs cocolalla hard`, the test browser, high tier): the dock, the lake's heaviest place, draws 825,006 triangles in 321 draw calls with fishing, against 798,124 in 278 without it and 921,462 in 288 before the headroom work. The triangles keep a tenth of margin under where the lake sat at exactly 60; the draw calls are a little over what they were then (eight fish are eight more skinned models, and the jetty is new). Fishing is neither moved nor drawn more than 32 m from the spot. Draw calls in that tool move by ten or so from run to run. **If the owner finds the jetty under 60 on Hard, draw fewer fish (`count` in `FISH`) first.**

**Not checked, and the owner is the one who can:**

1. **The frame rate** in Safari with `?fps` on Hard: across the lake with the headroom fixes, and standing on the jetty with a line out.
2. **How fishing moves and feels.** A cloud session saw still frames of one catch. Whether the dark shapes read as fish, whether the ring is easy to follow on the iPad, whether Easy needs no timing for the younger player and Hard is work enough for the older.
3. **The lighter mosquito** in the game's light, and whether an enemy can be seen to appear as the hero comes within 45 m.
4. **The fish book on a real iPad**: the start screen is 66 pixels taller with it.

**Headroom on the lake: pull request 82, merged 2026-11-19. Its publish run failed, so it did not go live with that merge:** a rule test that plays most of the lake twice (`tests/lake.test.ts`, "a missed jump lands in the lake") ran past the usual 5 second limit on the publish machine, though it passed in the pull request's own checks. It now has a 60 second limit, in the pull request this version of the handoff arrived in; that merged as pull request 83, its publish run succeeded, and the live site was checked on 2026-11-19: it serves `media/models/mosquito-light.glb`, the same size as the file here. The owner measured the reworked lake at exactly 60 frames a second on Hard in Safari on his Mac, and the kids found it pretty fun. Two fixes (`docs/decisions.md`, "Headroom on the lake"): the lake's mosquitoes are drawn from a 5 thousand triangle copy of the model (`assets/enemies/mosquito-light.glb`, made by `node tools/thin-model.mjs mosquito 5000`; `lightEnemies` on the level), and the lake draws an enemy only within 45 m of the hero and never more than the six nearest (`enemySight` on the level, `src/view/sight.ts`, `tests/sight.test.ts`).

Counted with `node tools/draw-measure.mjs cocolalla hard` (the test browser, high tier, Yaarbro):

| Place | Before: draw calls, triangles, enemies drawn | After |
| --- | --- | --- |
| beach | 127, 666,628, 11 | 107, 478,640, 0 |
| boulder-3 | 120, 680,604, 12 | 98, 492,614, 1 |
| point | 163, 790,212, 12 | 139, 602,094, 1 |
| mid-rock | 160, 770,303, 12 | 138, 582,313, 1 |
| island | 138, 692,245, 12 | 114, 476,257, 0 |
| headland | 158, 772,427, 12 | 135, 564,438, 1 |
| step-2 | 140, 661,345, 12 | 121, 463,684, 2 |
| gravel-bar | 144, 846,076, 12 | 132, 682,740, 6 |
| open-water (mid swim) | 255, 882,227, 12 | 240, 716,562, 6 |
| reed-bar | 302, 861,999, 12 | 292, 738,661, 6 |
| tunnel-water (mid swim) | 257, 859,343, 12 | 247, 736,005, 6 |
| cove-beach | 192, 831,283, 12 | 177, 689,618, 4 |
| landing | 238, 843,020, 12 | 228, 719,682, 6 |
| dock | 288, 921,462, 12 | 278, 798,124, 6 |

The heaviest frame is 13% lighter (921 to 798 thousand triangles). **The dock is the heaviest place on the lake, and it is where fishing, the pike and Walblum go: count again with that tool after each piece of fishing, and keep the dock under the 921 thousand it drew before.**

**Not checked, and the owner is the one who can:** the frame rate with the fixes, in Safari with `?fps` on Hard (a cloud session counts triangles, not frames a second); the lighter mosquito in the game's light (compared here only as outlines of the two models from the side and from above: legs, wings, antennae and beak are all there, the head and body are plainer); and whether an enemy can be seen to appear as the hero comes within 45 m of it or as the nearest six change.

---

## Milestones nine and ten, as written on 2026-11-17


**Milestone nine: Cocolalla Lake reshaped.** The game is live at https://rowbeartow.github.io/yaarbroverse-3d/ . What the owner asked for and why is in `docs/decisions.md` (2026-11-15 and 2026-11-16): his playtest found the lake "just more jumping", the crocodiles easy to avoid, and every route a straight line up the screen.

**Milestone ten: making the lake worth playing. The owner said OK to underwater and to the plan (2026-11-17), with one addition: keep enemies out of the trickiest jump spots, as in the grove, so hazards do not stack.** The plan page: https://claude.ai/artifact/DedyjY39qBwHUn2Ldn15aB . Underwater is rebuilt and merged (`src/view/underwater.ts`). The rest is built in the page's order: collecting (huckleberries and hidden leaves, saved per player); moving pieces (sinking logs and posts, a tipping log); enemies (Easy 3, Normal 8, Hard 12, all kinds the game has); the Open Water rebuilt (two booms with gaps, weed beds that slow a swimmer, mosquitoes that dive at swimmers, a rest rock); then the trails and three hidden leaves per difficulty placed. Tiny hats are dropped. When the rework is live the owner checks the frame rate on Hard. **Walblum and Caputo's new ability** come in the pike milestone, not this one: `docs/decisions.md`, "Walblum and Caputo's new ability", has the owner's design.

**The rework is built, merged and live (2026-11-17): milestone ten is done, but for the owner's frame rate check on Hard.** He played each part on the lake preview page (https://claude.ai/artifact/Gq1nsmNEZTm7NnfsdaTPq5 ) and said OK to the huckleberries and to the Open Water; steps 3 to 6 merged as pull request 80. The preview page opens on the first place in `PLACES` in `tools/preview/lake-preview.ts`, because an artifact's link cannot carry the panel's choice.

1. Underwater: merged.
2. Collecting: merged at his word (he played the huckleberries: OK). `src/game/collect.ts`, `Players.collect` and `findsOn` in `src/save/players.ts`, `src/view/pickups.ts`.
3. Moving pieces: logs and posts that sink (`sink` in `src/game/moving.ts`; `log*` and `post*` in the lake's `difficulty.ts`), and the tipping log off the zigzag that holds a hidden leaf (`leaf-log`). They keep the sounds they reuse, at his word.
4. Enemies: 3, 8 and 12. `docs/decisions.md` "Where the lake's new enemies are" lists the four placements that differ from the plan and why.
5. The Open Water rebuilt: booms, weed beds (`src/view/weed-beds.ts`), a rest rock, more crocodiles, mosquitoes. `docs/decisions.md` "The Open Water as rebuilt".
6. Trails and hidden leaves through the whole lake: `docs/decisions.md` "The lake's trails and hidden leaves".

**Still open in the rework:**

- The pickup sounds are in: his picks on the sound board were huckleberry B (`huckleberry.wav`, Kenney's `drop_002`) and hidden leaf A (`hidden-leaf.wav`, MouseBYTE's `Chime_Save`). Both are shared sounds, played on the `pickup` event in `src/audio/game-sounds.ts`. Nobody has heard them in the game yet.
- **The owner checks the frame rate on Hard** once it is live. What the rework adds to a frame, counted in the test browser: the berries are 1 draw and about 17 thousand triangles for all 65; the booms 8 draws and 7 thousand; the weed 1 draw and 2 thousand; the sinking pieces nothing new. The enemies are the cost: in the Open Water on Hard up to five crocodiles (8 thousand each) and two mosquitoes (14 thousand each) can be in view where there were two crocodiles, about 50 thousand triangles more, 8% of what the lake drew. If it drops under 60, thin the mosquito's model for the lake or draw fewer of them at once (`SEEN_WITHIN` in `src/view/enemies.ts`).
- **Nobody has seen any of it move.** Still frames only: a log awash, the posts, a boom's gap with its trail, the weed, the tipping log with its leaf, the boardwalk's berries and a scout on the dock.
- **Whether the swim is busy enough.** The bot crosses in 9, 12 and 15 seconds (see the decision above).
- The bot's perfect run of the whole lake now takes 60.9 s on Easy, 77.3 on Normal and 87 to 88 on Hard, with no heart lost.

**The kids' picks (2026-11-17), both for the pike milestone** (`docs/decisions.md`, "The kids' picks"):

- **Walblum's model is candidate B**: `walblum-b.glb`, 3,550,484 bytes, SHA-256 starts `b8c2d3a956888065`. It is on the `hero-models` release (the owner saved it on 2026-11-17; downloaded from there and checked: same size and checksum): https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/walblum-b.glb . Download it to a scratch folder, never into the repo. Its Meshy tasks, for the record: Image to 3D task `01a1e822-3d39-72a0-9bd7-4faf5fcc9c6a`, made from Image to Image. Never make him again. He was made standing upright with his arms out (`tools/meshy-portrait-to-3d.mjs`, `tools/walblum.candidates.json`), so Meshy's Rigging API and animation library (`tools/meshy-rig-animate.mjs`) may be able to rig him and give him a kick. His whiskers hang down in the model and are to be straightened when he is rigged. The candidates page: https://claude.ai/artifact/TnaX5sRabHkRvqg3PBem3E .
- **Caputo's new ability is Claw Slash**: he swipes, and three glowing claw marks fly to the nearest enemy in front of him and hit it. It must stay as useful as Walblum's kick against every enemy and boss, including the pike. The options page: https://claude.ai/artifact/1BDnjtZPjhstDEPfzv1zgM .

**The kids' verdict on the lake (2026-11-17), the next job.** In the owner's words (`docs/decisions.md`, "The owner's play of the live lake, and the kids' verdict on it"): underwater is underwhelming and the graphics fall apart; the one crocodile in the long swim is easy to pass, then it is holding one direction to the far bank; it needs more crocodiles and enemies; nothing is challenging but the jumps, which are not especially challenging; not much fun; unimpressed with the whole level. Found: underwater the camera still shows sky, mountains and log booms, the bed is a flat repeating pattern, and in the rock tunnel the camera goes into the rock. Pictures: `node tools/preview/lake-stills.mjs`, or a throwaway browser check that stands the hero in the water (`standOn` and `__grove.game` in `tests/browser/helpers.ts`). Claude proposed a plan to the owner on 2026-11-17; nothing of it is built until he says go. The rope's letting go and the rope sounds are done (A to take hold, B to let go).

**The keyboard fixes: merged at the owner's word** (pull request 74). His keyboard playtest on Normal could not get past the first crocodile (`docs/decisions.md`, "A keyboard must get through"); after the fixes he played the stepping stones on Normal with the keyboard: OK. Built: the crossing's camera faces straight up the rows; the Shore Path's looks east along the boulders (the lake's third camera turn, at his word); the jump assist on Easy and Normal on every level (`src/game/assist.ts`); the stepping stones' footing is the whole drawn crocodile, 4.6 by 1.5 m, and the drawing takes its size from the footing; on Normal each row's first crocodile waits for the first step (`stoneWait`), and the wave is 1.4 s apart, 4 s up, every 8 s; the keyboard rule test over every level (`tests/keyboard.test.ts`). Before the fixes the keyboard bot failed only the lake on Normal; now every level passes. If he asks for changes: Normal's stone numbers are in the lake's `difficulty.ts`, the assist's in each level's `difficulty.ts` (`jumpAssist`) and `ASSIST` in `src/game/assist.ts`. 

**Merged and live:**

1. **The route rule** (pull requests 66 and 68). Routes turn: `src/game/route-shape.ts` measures a level's route and `tests/route-shape.test.ts` holds every level on the picker to the minimum. `docs/adding-a-level.md` "The route rule" has it in words. The Bouncing Grove is the one level still on the test's waiting list.
2. **Loading by level** (67). A level's music, sounds and enemy models are fetched when it is picked. The 4 MB limit on sound is now 1 MB for shared sounds and 2.5 MB for each level's own (`home` and `SOUND_LIMITS` in `src/audio/sounds.ts`).
3. **The camera that follows the route** (69). `src/view/route-camera.ts`: a section says which way the camera faces (`facing`) and may ask it to sit further back (`pull`); the stick follows the camera.
4. **The lake's new layout** (70). Eight sections round a wooded island; `src/levels/cocolalla/layout.ts` has the map in words at its top. On the route rule, Normal: 26% away, 24% left, 30% right, 20% toward, 8 turns, 4 camera turns (it was 100% away with none).
5. **The hunting crocodiles** (71). On Normal and Hard the crocodiles have all of the Open Water and come after a swimmer, heading for where they are going; on Hard one more waits under the sunken logs for a hero who falls in (`crocHunt`, `crocLead`, `crocUnderLogs` in the lake's `difficulty.ts`).

**The rope swings and the crocodile stepping stones, reworked after the owner's first look: merged at his word.** His second look (2026-11-16, `docs/decisions.md` "The owner's second look"): the stepping stones are OK; on the ropes taking hold is OK, but **letting go is not quite right: the dismount needs work, and it is the next job on the lake.** Start there: ask him what looks wrong in it if his words are not enough to go on (where the hero is drawn as he leaves the rope, the push-off clip, the way the body swings upright, or the flight), using the preview page below. The pieces involved: `rope_release` in each hero's clips (Yaarbro's cut from Meshy's "Swing on Rope to Ground" in `tools/yaarbro.guide.json`, Caputo's `rope_release` in `tools/rig-quadruped.py`), `ropeClips` in `src/view/hero-model.ts`, `Hanger` in `src/view/ropes.ts` (after letting go, the 0.4 m or so between where the grip held Yaarbro and where the rules have him fades out over a moment), and `letGo` and `HANG` in `src/game/rope.ts`. What he asked for and what was built is `docs/decisions.md` "Rope swings and crocodile stepping stones, reworked after the owner's first look".

- The preview page is the game itself (its scenery, light and camera), opening on the crocodiles on Normal, with a panel to pick the place, difficulty, hero, and whether the test bot plays: https://claude.ai/artifact/Gq1nsmNEZTm7NnfsdaTPq5 . The first preview (the blocked-out arena, https://claude.ai/artifact/HKCAXXuzCGGT6oJNyxEHRZ ) is out of date.
- The rope's two sounds still wait for his pick on the sound board, A or B for each (choice A is wired in): https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH
- **The rope swings:** `src/game/rope.ts` has the rules, `src/view/ropes.ts` the drawing (the rope as a chain that bows and sways, and `Hanger`, which holds a hero by the grip and swings the body after the rope), `docs/adding-a-level.md` "Rope swings" the recipe. Each hero has four rope clips: reach, catch, hang, release. Yaarbro's are from Meshy's animation library (`tools/yaarbro.rope.json`, 14 credits; the stripped clip files are `tools/yaarbro-rope-clips/`, made small with `tools/strip-clip.mjs`). Caputo's are written by `tools/rig-quadruped.py`, and he has a jaw now (`jaw` and `mouth` in `tools/caputo.rig.json`). Two ropes cross the lake's cove in section 3, to a rock stack and up to the headland's ledge. On Easy, letting go anywhere lands safely (`ropeHelp`).
- **The crocodile stepping stones:** a kind of moving piece, `float`, in `src/game/moving.ts` (`floatPhase` gives where one is in its row's rhythm), drawn from the crocodile's model in its new `float` pose by `src/view/croc-stones.ts`, which also makes the splashes, rings, bubbles, the dip and the snap (the crocodile's new `turn_snap` clip). Two rows cross the east channel in section 2 with a rock half way: 11, 13 and 14 crocodiles. On Easy the wave runs once and they stay up; on Normal and Hard they keep a rhythm (`stoneStagger`, `stoneUp`, `stonePeriod`); on Hard one stood on for 0.8 s snaps (`stoneSnap`). All in the lake's `difficulty.ts`.
- If he asks for changes: the numbers are in `src/levels/cocolalla/difficulty.ts`, `ROPE` and `HANG` in `src/game/rope.ts`, and the look in `src/view/croc-stones.ts` and `src/view/ropes.ts`. Rebuild the page with `npm run assets` then `node tools/preview/lake.mjs <folder>`, and publish the folder over the same address (its `files.json` lists every file). `node tools/preview/lake-stills.mjs` takes still frames of it. A hero's clips are rebuilt from the originals on the `hero-models` release with the commands in `CLAUDE.md` (Yaarbro's folder also needs `tools/yaarbro-rope-clips/`).
- If he picks choice B for a rope sound: the two B files were cut as `CREDITS.md` describes for A, with these differences: taking hold B is 0.6 s of `tree_creak.flac` from 4.0 s in, played 1.9 times as fast, bass under 180 hertz out; letting go B is `swish-8` played at three quarters of its speed.

**What nobody has checked yet on the reshaped lake, and the owner is the one who can:**

1. **The frame rate on the Mac** in Safari with `?fps`, on Hard. It must stay at 60 or more. In the test browser the reshaped lake draws about what the old one drew (347 to 575 thousand triangles at six places, against 344 to 598 thousand).
2. **How the camera's turns feel**, above all on the reed bar (a quarter turn after swimming toward the camera) and on the pier's landing, and whether the stick following the camera is clear to the kids on touch.
3. **Anything in motion.** A cloud session has seen only still frames: the swings, the crocodiles surfacing and snapping, the hunt.
4. **Whether the hunting crocodiles are now a real threat on Normal and fair on Hard**, and whether Easy is still easy enough for the younger player.
5. **How the wooded island, the booms and the snags look in full light.**
6. **How the lake's music comes in** after the short fetch when the lake is picked, on a real connection.

**The roadmap, in the owner's order:**

1. Milestones six to nine (the grove's boss and variety, swimming, the lake, the lake reshaped): done, apart from the owner's OK above.
2. **Fishing and the monster pike boss, on the lake's fishing dock: next.** The pike is fought both on the fishing line and in the water. The dock stands in open water at the end of the Old Pier, with the camera looking north.
3. **The Bouncing Grove reshaped by the route rule.** Today 92% of it runs away from the camera with no camera turns; it is on the route test's waiting list until then.
4. **Simple gripping hands for Yaarbro** (the owner's word, 2026-11-20), before skiing and climbing: one bone that curls his fingers and one for his thumb, on each hand, since ski poles and climbing holds will need him to hold things. His model has no finger bones today, so everything he holds is held at a grip point in a palm (`src/view/held-tackle.ts`). The work: cut the fingers and thumb free in `tools/prepare-rigged.py` (as the crocodile's jaw was cut free in `tools/rig-quadruped.py`), skin them to the two new bones, add a curl to the clips that hold something (the rope clips, the fishing clips), and show it on the hero preview page for his OK.
5. Skiing in the Selkirks, with Caputo on a snowboard.
6. Mountain climbing on rock, ice and trees.

---

**Milestone eight, part three (done 2026-11-15): the crocodiles, as it was written then.** The lake's layout, where the crocodiles wait and how they behave on Normal and Hard have changed since (see above); the crocodile's model, clips, tell, lunge and sounds have not.


**Frame rate budget, still in force:** the owner measured the lake at 75 to 81 frames a second in Safari on his Mac before the crocodiles (the grove runs at 120). It must stay at 60 or more. The owner checks the lake with the crocodiles next (see "What nobody has checked yet").

Milestone eight, part three (the crocodiles), in order:

1. **The handoff's record of the model: pull request 61, merged 2026-11-15.** The crocodile the kids picked is `crocodile-c.glb` on the `hero-models` release (below). Never make it again.
2. **Rig and clips: pull request 62, merged 2026-11-15**, after the owner's OK on the preview page (https://claude.ai/artifact/K5LovBcEE3786jU137sCzf ). `tools/rig-quadruped.py` has a `Crocodile` class and its guide is `tools/crocodile.rig.json`. Six clips: `lurk` (only eyes and snout above water), `swim`, `dive` (underwater), `lunge` (jaws snap shut 0.34 s in), `hit`, `defeated` (rolls over and sinks). Its curled tail is laid out straight before the clips are written (`straighten_tail`), and it has a jaw bone weighted along the line of the closed mouth (`weigh_jaw`). 8,000 triangles, a 1,024-pixel picture, 0.5 MB (`assets/enemies/crocodile.glb`).
3. **Behaviour: pull request 63, merged 2026-11-15**, after the owner's OK on the arena preview (https://claude.ai/artifact/39XqeJ12kwpjJjdMtjTAZp ). `src/game/crocodile.ts`; drawn by `src/view/enemies.ts`.
4. **Sounds: pull request 64, merged 2026-11-15.** The owner's picks on the sound board (https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH ): warning B (`croc-warning.wav`), bite B (`croc-bite.wav`), splash A (`croc-splash.wav`), hit A (`croc-hit.wav`). All CC0 recordings. Sound and music: 4,095,111 of the 4,194,304 bytes allowed: about 99 KB to spare.
5. **Placement and the bot: the pull request this version of the handoff arrived in. If you are reading this on `main`, it has merged.** The owner said OK to the arena preview of both swims.

**The crocodile, as built:**

- It lurks at home with only its eyes and snout above water; touching it then does nothing. A hero in its water is stalked at their depth (at the surface with its back awash), always slower than a hero swims. Close enough, it gives its tell: it fixes its aim, its eyes sink under and it creeps along the aim, pushing a wake. Then it lunges along exactly that line, a metre past where the hero was. Only the lunge hurts, at the surface or underwater: it is the one enemy that reaches a swimmer whose head is under. Afterwards it rests at the surface.
- Getting past: swim out of the line, or dive under it (the move button). Beating it: land on it, or Yaarbro's roll or Caputo's pounce from a log or the bank. The regen rule applies.
- On Easy a line shows where it will lunge; on Normal and Hard there is none.
- Its numbers per difficulty are `croc*` in `src/levels/cocolalla/difficulty.ts`: Easy, one in each long swim, 11 m to the side of the way (a hero swimming straight across never wakes it), tell 1.8 s; Normal, one in each, across the way, tell 0.9 s, swims 2.4 m/s, lunges 4.5 m; Hard, two in each, tell 0.63 s, swims 2.9 m/s, lunges 5.5 m, two hits to beat.
- The test bot swims past them by looking ahead on a copy of the game, as it does in a boss fight, and swimming or diving out of a lunge's line (`swimSafely` in `tests/helpers/bot.ts`). It finishes the lake on every difficulty as each hero with no heart lost. A perfect run now takes 50.5 s on Easy, 59.9 on Normal and 73.4 on Hard.
- Cost to draw: it casts no shadow, and only crocodiles within 70 m of the hero are drawn or moved. Each shares the model's shape; each has its own copy of the materials, so it can flash when struck.

**The crocodile's original model:**

- The crocodile (candidate C) is `crocodile-c.glb`, 4,880,312 bytes: https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/crocodile-c.glb . Its SHA-256 is `3598bc12a93f52170ce796478be153bb7c9f7ba1afceacde5cf4ec7be838bf25` (starts `3598bc12a93f5217`). Downloaded from the release on 2026-11-15 and checked: same size and checksum as the file the kids picked. Download it to a scratch folder, never into the repo. The kids picked this exact model: never make it again.
- Its Meshy tasks, for the record: Image to 3D `01a1dc47-f78d-7479-af00-b87be42bfada`, made from Text to Image `01a1dc47-77c3-754b-bd1b-187e4793413f`.

**Triangles and draw calls on the lake** (the test browser, high tier, Hard, at the grassy point, the rock island, the reed bar and the first post of the pier):

| Place | Before the crocodiles | With crocodiles, shadows on | With crocodiles, no shadows (as built) |
| --- | --- | --- | --- |
| Grassy point | 125 draw calls, 565,592 triangles | 129, 597,588 | 127, 581,590 |
| Rock island | 142, 584,888 | 146, 616,884 | 144, 600,886 |
| Reed bar | 144, 485,942 | 148, 517,938 | 146, 501,940 |
| First post | 166, 378,944 | 171, 410,942 | 169, 394,944 |

Two crocodiles in view cost 2 draw calls and 16,000 triangles, about 3% more triangles. The start of the grove draws about 300 draw calls and 380,000 triangles.

**What nobody has checked yet, and the owner is the one who can:**

1. **The frame rate on the Mac with the crocodiles**, in Safari with `?fps` on Hard, swimming both crocodile stretches. It must stay at 60 or more.
2. **The crocodiles in motion and in the game's full light.** Judged here from still frames in flat light, and by the owner on the preview pages.
3. **How they sound in the game.** Heard on the board only.
4. **Whether Easy is easy enough and Hard a real threat**, played by the kids on the iPad.
5. Still open from parts one and two: swimming in the Sandbox, the lake's music and lapping in the game, the iPad's frame rate on the lake.
---

**Milestone eight, part two (done 2026-11-15): Cocolalla Lake.** Pull requests 55 to 60, all merged: the browser checks in parallel shards, about 10 minutes a pull request (55); the route plan (owner's OK: https://claude.ai/artifact/WzVaTX3yBGtw8qswMdqTY5 ); sections 1 to 3 (56) and 4 to 6 (57); the lake's scenery (58); the lake on the level picker (59); its music, "Morning Sky", and lapping water (60). The level is `src/levels/cocolalla/` (id `cocolalla`): a pebble beach, boulder hops, a swim to a rock island, sunken logs to a gravel bar, a dive under a rocky point, a swim across Cattail Cove, and posts up to the boardwalk and the fishing dock. The water is three pools the full width of the lake, parted by the gravel bar and the reed bar, so a missed jump lands in the water and is never a fall. `tests/lake.test.ts` checks the lake's own rules; `LAKE_TIMES=1 npx vitest run tests/lake.test.ts --silent=false` prints the section times. The surroundings are `scenery: 'lake'` (`src/view/lake.ts`, `src/view/lake-solids.ts`).

---

**Milestone eight, part one (done 2026-11-14): swimming.** Pull requests 47 to 54, all merged: the bot's boss fights made sturdy (47); swimming rules (48), looks (49), sounds (50) and both heroes' swimming clips (51); then the dive hint (52), the gap under the arch shown from above (53) and the controls on the level card and pause screen (54). `src/game/swim.ts` has the rules and `docs/adding-a-level.md` the recipe. The owner's picks: swimming sounds A, B and A on the sound board; the swimming preview "looks great" (https://claude.ai/artifact/Hona3BPm8mPnDy8JoWaxbw ); the controls preview OK (https://claude.ai/artifact/5f6MKjojBtx6VjedwqCPhF ). Yaarbro's swimming clips cost 27 Meshy credits.

---

**Milestone seven (done 2026-11-14): grove variety, and ghosts in the browser's database.**

Milestone seven, in order:

1. **The Tipping Logs: pull request 44, merged 2026-11-14.**
   - Pieces may now move, at the owner's word. `src/game/moving.ts` lets any solid tip, crumble or sway; it carries a hero standing on it, and each game keeps its own copy of the level's moving pieces. The drawing (`placeMoving` in `src/view/scenery.ts`) reads the rules' own numbers every frame, so a moving piece's drawn top is where a hero can stand. `docs/adding-a-level.md` has the recipe ("Pieces that move"); `tests/moving.test.ts` has the tests.
   - Section 4 keeps its mushroom spring up to the high log. After it, logs balanced on a snag at their middle (2, 3 and 4) cross open air, each a little higher, to the high ledge. A moment after a hero lands one creaks and rocks (the tell: 0.8, 0.45 and 0.3 seconds), then the end under the hero sinks, up to 0.35, 0.8 and 1.2 m at the very end. Lingering makes the next jump higher; on Easy it is always a small hop. Numbers: `tip*`.
2. **The Windy Climb: pull request 45, merged 2026-11-14.**
   - Section 6 keeps its mushroom spring up to the high log. After it: crumbling moss in a straight line (2, 3 and 4 pads), a short solid log to wait on (`wind-perch`), and windy boughs (1, 2 and 2) that carry the hero up to the chief's bank.
   - Moss shivers and drops crumbs the moment a hero lands (the tell, with a rustle), then falls into the mist (1 second later on Normal, 0.6 on Hard) and grows back 3 seconds after. On Easy it only sags 0.3 m and never falls.
   - A windy bough rests low, rises, rests high and sinks, on the wind's rhythm, whether anyone is on it or not. Before each move a gust sounds and its needles shiver (the tell). When one rests high the next rests low beside it, level with it. On Easy it rests 2 seconds at each end. The gust is heard only within 18 m. Numbers: `moss*` and `wind*`.
   - Not in the plan, and recorded in `docs/decisions.md`: the solid log before the first bough (without it, a hero reaching the last moss pad while the bough was up could only fall), and the chief's bank 0.8 m to the left of the route (`chiefAside`), because the test bot's fight on Hard went badly when it walked in at the middle. (Milestone eight made the bot's fighting sturdy and put the bank back on the route's line.)
3. **Ghosts in the browser's database: pull request 46, merged 2026-11-14.**
   - The worst case across the roadmap: 4 players × 5 levels (the grove, the lake, fishing and the pike, the Selkirks, climbing) × 2 heroes × 3 difficulties = 120 ghosts of up to about 25,700 characters each, about 3.1 million characters. Safari counts two bytes a character, so about 6.2 MB, over the roughly 5 MB local storage gives a whole site, and `rowbeartow.github.io` is shared by every GitHub Pages project on the account. It would not fit.
   - So ghosts are kept in IndexedDB (`src/save/ghost-store.ts`). The game reads and writes them without waiting: the store holds a copy in memory and writes behind the scenes. On first opening, ghosts still in local storage are moved into the database and removed from local storage only once the database holds them; a newer ghost already in the database wins. Where there is no database (some private windows) it falls back to local storage, as before. Players and bests stay in local storage.
   - `tests/ghost-store.test.ts` (with a stand-in database, `fake-indexeddb`, a development package only) checks keeping, carrying over, removing a player's ghosts, the fallback, and room for all 120 of the biggest. `tests/browser/ghost.spec.ts` checks the carry-over in a real browser.
   - Found and left for the skiing milestone: a ghost only records places within about 650 m of the start (`REACH` in `src/game/ghost.ts`). A longer run would quietly keep no ghost.

**How long a perfect run takes** (the test bot), before milestone seven and after:

| | To the chief's bank | To the golden leaf |
| --- | --- | --- |
| Easy | 39.0 → 42.3 s (+8.5%) | 52.0 → 55.4 s |
| Normal | 57.0 → 61.3 s (+7.5%) | 95.0 → 98.1 s |
| Hard | 62.2 → 62.5 s | 109.8 → 108.3 s |

The chief's fight is unchanged in its rules and numbers; the bot's time in it moves with how it walks in. On Hard the worst fall costs 24.1 seconds of a perfect run.

**What nobody has checked yet in milestone seven, and the owner is the one who can:**

1. **How the new pieces move and sound in the game.** A cloud session only sees still frames and cannot hear. The plan page's plain-block demos showed the intended motion; nobody has watched the real tipping logs, moss or boughs move, or heard the creak, rustle, fall or gust in the game.
2. **Whether the tells read.** The rocking log, the shivering moss with its crumbs, and the gust with shivering needles are meant to be seen before anything moves. If the kids miss them, the tell times are numbers in `difficulty.ts` (`tipTell`, `mossTell`, `windTell`).
3. **Whether Easy needs no timing for the younger player,** and whether waiting for a bough feels slow. Easy's bough rests 2 seconds at each end (`windRest`).
4. **Whether Hard's new sections are work enough for the older player.**
5. **Frame rate** at sections 4 and 6, in Safari on the Mac with `?fps`.

**What nobody had checked in milestone seven, as written then** (still open): how the new pieces move and sound in the game, whether their tells read, whether Easy needs no timing, whether Hard's new sections are work enough, and the frame rate at sections 4 and 6 in Safari.

---

Everything from "Milestone seven" down to "Where things stand" is the record of earlier milestones, kept as it was written.

**Milestone six (done 2026-11-13): tougher enemies, enemy health and the regen rule, the boss system, and the marmot chief.**

Milestone six, in the order the owner set:

1. **Tougher enemies: pull request 40, merged 2026-11-13 after the owner said OK on the preview page** (https://claude.ai/artifact/Nmwtn8SMup8HVLkdK3PnGA ).
   - Easy is unchanged.
   - On Normal and Hard the marmot scout is never hidden. It walks a beat across its bank (1.6 and 2.2 metres a second), and when a hero steps onto its bank it stands for half a second, then comes after the hero (3.4 and 4.6; a hero runs at 6). From 2.5 to 4.2 metres it stops and throws; closer, it keeps coming and touching it costs a heart. It never leaves its bank, and gives up when the hero does.
   - A warning lasts 1.2 seconds on Easy, 0.56 on Normal and 0.36 on Hard.
   - The line showing where an attack will go is drawn on Easy only, at the owner's word (`enemyAimLine`). On Normal and Hard the warning is the scout rearing up with its acorn, or the mosquito tipping nose-down, and the warning sound.
   - The mosquito keeps up with the hero on Normal and Hard (5 and 6.5 metres a second), dives more often, and hovers 3.4 metres over the hero so a jump across a gap does not carry the hero up into it.
   - After a hero is sent back to a safe bank, no enemy notices it for a second and a half.
   - The numbers are `enemyWarning`, `enemyAimLine`, `scoutPatrol`, `scoutChase`, `mosquitoFollow`, `mosquitoHover` and `mosquitoPause` in the grove's `difficulty.ts`; the rules are in `src/game/enemy.ts`.
2. **Enemy health and the regen rule: pull request 41, merged 2026-11-13.**
   - A scout takes one hit on Easy and Normal and two on Hard; the mosquito one on every difficulty (`scoutHealth`, `mosquitoHealth`).
   - A hit shows as a blinking flash and a short shove, and the screen says how many more it takes.
   - The older player's rule: when the hero is sent back to a safe bank by a fall or by running out of hearts, every enemy that is not beaten is at full health again, and the screen says so. A beaten enemy stays beaten (the owner approved that).
3. **The boss system: pull request 42, merged 2026-11-13.**
   - Any level can end with a boss. `docs/adding-a-level.md` has the recipe ("Ending a level with a boss"), `src/game/boss.ts` the rules, `src/view/boss.ts` the drawing, `tests/boss.test.ts` the rule tests.
   - A fight begins when the hero stands in the boss's arena. The boss goes round on watch, warning, attack, rest. Its attacks (`throw`, `charge`, `call`) come in turn from a list that changes as it loses health, with a roar at each change. A hit is a roll faster than a walk, a pounce, or a landing on top. A `guarded` boss only takes a hit while it rests; at other times a landing bounces off unharmed.
   - The health bar is the boss's name over a pip for each hit, at the bottom of the screen. The pips glow while a hit will count.
   - The level's goal is out of reach and out of sight until the boss is beaten.
   - The arena is a checkpoint on every difficulty. A hero sent back stands on its doorstep, outside the fight, with the boss at full health and at home (the regen rule).
   - Boss music (`bossMusic` in a level's entry) takes over while the fight is on. The owner picked it and the "boss beaten" sound on the sound board (https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH ): "Battle Theme" by Wolfgang_ and "Short Jingle" by OO, both CC0 from OpenGameArt.
   - The Sandbox (`?level=sandbox`) ends with a practice boss, a marmot twice the scout's size, which proves the system.
4. **The marmot chief: the pull request this version of the handoff arrived in. It waits for the owner's OK on the preview of the whole fight** (https://claude.ai/artifact/EkkwHXFr8ibqGY28T3NGAc ). **If you are reading this on `main`, he said OK and it has merged.**
   - The chief is the scout's model at 2.3 times the size, with a dark colour laid over its fur. Nothing else is added to its look, at the owner's word.
   - It waits on a wide mossy bank (`bank-6`, 16 by 19 metres) at the top of the last climb. The bough with the golden leaf reaches out from the bank's far side. The grove has a seventh section, The Marmot Chief.
   - It takes 4, 6 and 8 hits. It throws; from two thirds of its health it charges too; in its last third it also calls its sidekicks, giant mosquitoes (1, 2 and 2).
   - On Easy any landing on top counts, it throws one slow acorn, and lines show where its attacks go. On Normal and Hard only a hit while it rests counts, it throws a fan of 3 and 5 acorns, and nothing is drawn.
   - Every number is `chief` and `chiefSidekicks` in the grove's `difficulty.ts`. `tests/chief.test.ts` holds its tests.
   - In a boss fight the camera pulls back and up so the whole arena shows (`src/view/boss-camera.ts`).
   - A ghost now holds 2,400 samples (160 seconds at full rate), because a run with the fight is longer than the old 80.

**What nobody has checked yet in milestone six, and the owner is the one who can:**

1. **How any of it moves.** A cloud session only sees still frames. The owner watched the tougher enemies on the preview page; nobody has watched them in the game itself, or the flash and shove of a hit, or the boss's health bar and the camera pulling back.
2. **How the fight sounds.** The boss music and the "boss beaten" sound were picked on the sound board, not heard in the game. The chief's warnings, throws and hits are the scout's sounds played lower (0.7 of the speed, `VOICE.chief` in `src/audio/sounds.ts`), at the owner's word, so it sounds as big as it looks. Nobody has heard that either: if it is too low or not low enough, that one number changes it.
3. **Whether Easy's chief is easy enough for the younger player, and Hard's is work enough for the older player.** The numbers are in one place if not.
4. **The frame rate in the fight**, in Safari on the Mac with `?fps` on the address: the chief, two mosquitoes and the hero are on screen together.
5. **Safari itself and a real iPad.** The checks pass in WebKit built for Linux.

**The preview pages for behaviour** (new in milestone six). `tools/preview/arena.mjs` builds a page that runs the game's own rules, numbers, enemy and boss drawing and hero drawing in a blocked-out copy of the level, at full speed. "Watch" plays a script, or for a boss fight the rule tests' own bot; "Play it yourself" hands over the hero. Its places are the `PLACES` table in `tools/preview/arena.ts`; its hand-written words are in `arena.html`, which now holds the chief's page. It needs the four plain model files rebuilt from the originals on the `hero-models` release (the commands are in `CLAUDE.md`; Yaarbro's six files are named in `tools/yaarbro.guide.json`). `node tools/preview/arena-stills.mjs` takes still frames of it. The first version of the page did not load for the owner once; it now says what it is loading and reports its own errors on the page.

---

**Milestone five (done 2026-11-13): players, saved progress, a level picker, best times and a ghost to race.**

Milestone five, in the order the owner set (his decisions are in `docs/decisions.md`, 2026-11-13):

1. **Levels as a recipe: pull request 35, merged 2026-11-13.** The game builds its level from the level list (`src/levels/index.ts`). Each level brings its layout, difficulty numbers, scenery and music through a `level.ts` in its folder. The Sandbox (`src/levels/sandbox/`) is a tiny development level that opens only with `?level=sandbox` and is never shown to players. `tests/levels.test.ts` runs the bot over every listed level.
2. **Players and saved progress: pull request 36, merged 2026-11-13.**
   - "Who's playing?" comes up first on every visit (`src/ui/who.ts`): pick a player, or add one with a typed name (12 characters at most) and one of six colours, up to four players. With nobody on the device yet it opens on the form.
   - Each player keeps their own last hero and difficulty, their own bests and their own ghosts. The start screen shows who is playing, with "Switch player".
   - "For grown-ups" on that screen: "Reset progress" (wipes bests and ghosts, keeps the name, colour and choices) and "Remove player", each behind a question whose safe answer is the big button.
   - Players and bests are one entry in the browser's storage, `yaarbroverse-3d:players` (`src/save/players.ts`). Reading and writing never throw: saved data that is missing or damaged is dropped piece by piece and the game carries on. With storage blocked, everything works until the page closes.
   - A name is only ever put on the page as plain text. `tests/browser/players.spec.ts` checks no request carries it.
   - The old key `yaarbroverse-3d:choice` is no longer written. A first player on a device starts from the hero and difficulty in it.
3. **The level picker: pull request 37, merged 2026-11-13 after the owner said OK on the preview page** (https://claude.ai/artifact/PKoes4buicSvLc9n4WYmWx ).
   - The start screen is headed "Where to?" and shows the areas as a row of cards (`src/ui/picker.ts`), with the grove the only one. A card is a picture (`public/cards/<id>.jpg`), the area's name and line, and for whoever is playing a tick and best time for each difficulty they have finished, or "Not yet". The time on a card is the better of the two heroes.
   - Every area is open. Picking another card builds that level and plays its music. With `?level=sandbox` the Sandbox is a second card, already picked, which is how the checks try a row of two.
   - To show the owner a change to these screens: with the built game served, `node tools/preview/screen-shots.mjs <folder> [width] [height]` takes the pictures; the page itself was put together by hand from them and published over that address.
4. **Best times: pull request 38, merged 2026-11-13.**
   - For each player, level, hero and difficulty, the best time and the fewest falls are kept separately, so each can come from a different run. Only a run that reached the golden leaf counts. Matching a best is not beating it.
   - The end card shows them under Time and Falls ("Best 1:07.4", "Fewest 2"). A best this run set is marked "New best!" in a gold box, with a gold line over the card.
   - The words are chosen by `endBests` in `src/save/players.ts`; `showEnd` in `src/ui/screens.ts` puts them on the card.
5. **The ghost: the pull request this version of the handoff arrived in.** If you are reading this on `main`, it has merged.
   - Every run is recorded (`src/game/ghost.ts`). When a run sets a best time, its recording is kept as the ghost for that player, level, hero and difficulty, in place of the old one.
   - On the next run that way, the ghost is a see-through copy of the hero that replays the best run on the game's own clock: it starts when the player starts, waits while the game is paused, and stops at the leaf. It fades out when it is on top of the player's own hero.
   - It is a picture only. The rules (`src/game/game.ts`) and the sounds are never told about it, so it cannot block, hit or trigger anything and it makes no sound. `tests/ghost.test.ts` plays a run with and without a ghost and checks every step is the same.
   - On by default on Normal and Hard, off on Easy. "Race your ghost" at the foot of the picked level card switches it for the difficulty picked now, and the choice is kept for each player.
   - Size (as built in milestone five; milestone six raised the limit to 2,400 samples): eight bytes a sample, 15 samples a second, and never more than 1,200 samples: a recording that fills up drops every other sample and carries on at half the rate. A grove run is about 9,000 characters, the biggest possible about 13,000. Four players with a ghost for every hero and difficulty of two levels (48) come to under 700,000 characters.
   - Each ghost is its own entry in storage, `yaarbroverse-3d:ghost:<player>:<level>:<hero>:<difficulty>` (`src/save/ghosts.ts`), apart from the players' entry, so a ghost that is damaged or will not fit never costs anyone their progress. A ghost that cannot be read is no ghost.
   - Between samples the ghost goes in a straight line, so it cuts the corner a little where a mushroom turns a drop into a bounce (under 0.6 m, for a fifteenth of a second).

**What nobody has checked yet in milestone five, and the owner is the one who can:**

1. **The frame rate with a ghost on screen**, in Safari on the Mac with `?fps` on the address. The ghost is a second copy of the hero's model (about 14 thousand triangles and a second skeleton). The target is 60 on the high tier. It was 120 without one.
2. **How the ghost looks moving.** A cloud session has only seen still frames: it is see-through, it is where the recording says, and it plays the hero's clips from the recording's speed.
3. **The new screens in Safari and on a real iPad**, typing a name with the on-screen keyboard above all. At iPad size the start screen is as tall as the screen, and the Sound button sits over the card's top right corner.
4. **Whether the kids can read the end card's bests** and whether "New best!" is clear enough.

**The quieter, softer mix (the pull request this version of the handoff arrived in; on `main`, it has merged).** The owner played with the kids and said everything was far too loud, the music most of all, the jump and landing clanky, and all the sounds harsh. What changed, and how to change it again:

- **The mix is his six numbers, set by ear** on the mixer page (https://claude.ai/artifact/WMgkjK91oXMEeHN3tofT15 ): `master -8, music -21, warnings -15, jumps -26, footsteps -24, menu -20`, in decibels. They are `MIX` in `src/audio/sounds.ts`, in the order master, music, cue, action, step, menu. This is his second set, with menu then taken from -12 to -20 at his word so clicks sit under the warnings; the first (`master -12, music -14, warnings -17, jumps -22, footsteps -9, menu -12`) never reached the live site.
- **Measured** (`node tools/preview/mix-measure.mjs`, with the mixer page served): normal play -41.6 LUFS, the whole sample -39.6, music alone -43.8, effects alone -39.6, so the music sits 4.2 decibels under the effects. The highest peak is -19.2 dB. That is far quieter than the -23 LUFS he first asked for and closer than his 10 decibels between music and effects: his ears outrank the numbers (`docs/decisions.md`).
- **Warnings and hits are the clearest group again:** 9 decibels over footsteps and 11 over jumps and landings. Menu clicks, at -20, sit 5 under the warnings.
- **It is a quiet game now.** On a device with its volume low, it may be hard to hear at all. If he says so, raise `master`.
- **What makes it softer:** the top end above 6,000 hertz is turned down 9 decibels (`SOFTEN` in `sounds.ts`); every sound fades in over 6 to 12 thousandths of a second (`ATTACK` in `graph.ts`); the limiter is a fixed curve that leaves sound alone up to a third of full and lets nothing past seven tenths (`LIMIT` in `graph.ts`). The browsers' own compressor was dropped because it adds loudness of its own accord.
- **Jump and landing:** no recordings of their own now. A landing is two soft footsteps of the surface with a low thump made in code under them; a jump is one quiet footstep of the surface left. `jump.wav` and `land.wav` are gone.
- **`src/audio/graph.ts`:** the wiring, shared by the game, the mixer page, the sound board and the measuring tool, so all play the same thing.
- To change the mix again: rebuild the mixer page (`node tools/preview/mixer.mjs <folder>`), publish it over the address above, and put the line he sends back into `MIX`. `tests/sound-files.test.ts` holds the six numbers too.
- A cloud session cannot hear. Nobody has yet said how the new mix sounds in the game itself.

**The owner's playtest of milestone three (2026-11-12, in `docs/decisions.md`):** Hard is properly hard and the older player loved it, so every difficulty number stays. The enemies' tells make them fair to dodge, so they stay on every difficulty. On his Mac in Safari, on Normal with the scout on screen: 120 frames a second on the high tier, 310 draw calls, 407 thousand triangles.

**What nobody has checked yet, and the owner is the one who can:**

1. **How the new mix sounds, played.** He set the levels on the mixer page's sample run. Nobody has yet heard them in the game: whether a warning is still clear at its new level, whether footsteps are too many, whether anything is still harsh. A cloud session cannot hear.
2. **Sound in Safari on the Mac.** Open the live link, click Play, and listen. Then press M (sound off), M again (on), close the tab, open it again and check the Sound button still says what it said.
3. **Sound on a real iPad.** He has none to test on right now. The checks pass in WebKit, Safari's engine built for Linux, which is not Safari. On an iPad the ring switch and the volume buttons also matter, and nothing here can check them.
4. **The mushroom footstep.** It is the bounce's boing, shorter and higher, and he has not heard it. In the grove every mushroom bounces the hero, so it never plays there; it is on the sound board.
5. **Whether the roll and the pounce feel right to the kids**, and whether the touch button is where a thumb finds it.

**The publish guard.** The publish workflow (`.github/workflows/publish.yml`) only publishes the newest commit on main. It compares its own commit with the head of main before the build and again just before the files go up, and finishes with a notice and no publish if they differ. Both paths were tried on 2026-11-12: the merge of pull request 30 published, and a run started by hand from an older commit skipped its "Build and publish" job.

- Why: GitHub's outage on 2026-11-11 left three runs stuck in the queue: publish run 20 for pull request 24 (https://github.com/rowbeartow/yaarbroverse-3d/actions/runs/43097921897 ), and two runs of the checks (43097921924 and 43098011488). They were still there on 2026-11-12.
- **The guard does not cover that stuck publish run.** A run uses the workflow file of its own commit, and run 20's commit is from before the guard. If GitHub ever starts it, it would publish pull request 24's version, and the live site would stay on that until the next merge to main (or until someone runs "Publish the game" by hand from main: Actions, Publish the game, Run workflow). Cancelling it was tried on 2026-11-12 and GitHub refused ("Cannot cancel a workflow run that has not been queued yet"). The owner was asked to try Cancel or Delete on the run's page.

**Sound, for the next time one is changed or added:**

- Every sound is in one list, `src/audio/sounds.ts`: its job, its file or recipe, its level in decibels against the others, and which group it is mixed with (cue, effect, step or music). To change how loud one is, change `level` there.
- Recorded files are in `assets/audio/` (1.78 MB): WAV for short sounds, MP3 for the grove music and the leaf tune. All are CC0 from OpenGameArt. `CREDITS.md` lists each file's source, author and license, what was done to it, and the checksum of the download. A new file needs a line there and in the list, or `tests/sound-files.test.ts` fails.
- The giant mosquito's hover, warning and dive are made in code (`src/audio/synth.ts`). The owner called them perfect. Everything else made in code was replaced with a recording at his request.
- To make a short sound from a download: mono, cut to the sounding part, a few thousandths of a second of fade in and a longer fade out, 32,000 samples a second, 16 bit. Take deep bass out if most of the sound is under 150 hertz, because small speakers lose it. The game brings every short sound to one loudness when it loads, so the file's own level does not matter.
- A changed sound goes on the sound board for the owner's OK first: `node tools/preview/sounds.mjs <folder> [<extras folder>]`, published over the address above. The words at the bottom of the page are written by hand in `tools/preview/sounds.html`.
- Sites a cloud session could not reach for sounds: freesound.org, pixabay.com, archive.org. kenney.nl refuses downloads from a script, so Kenney's pack was taken from his OpenGameArt page.
- Nothing came from the 2D game: it has no sound or music files, only placeholder beeps in its fishing code.

How the enemies were made, for the next time one is changed or added:

- **The two picked originals are on the `hero-models` release**, as Meshy made them (the owner attached them on 2026-11-12):
  - The marmot scout (candidate B) is `marmot-b.glb`, 4,906,284 bytes: https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/marmot-b.glb . Its SHA-256 starts `aa77f4afb6dd8370`.
  - The giant mosquito (candidate C) is `mosquito-c.glb`, 5,126,232 bytes: https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/mosquito-c.glb . Its SHA-256 starts `ff3a5e765a94a497`.
  - The crocodile (candidate C, added in milestone eight) is `crocodile-c.glb`, 4,880,312 bytes: https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/crocodile-c.glb . Its SHA-256 starts `3598bc12a93f5217`.
  - Both were downloaded from the release and checked against the files the enemies were rigged from: same size and same checksum. Download them to a scratch folder, never into the repo.

- The reference pictures were the "Alert" marmot and the "Hover" mosquito from the approved studies (`docs/art-direction/b02a/marmot-scout-study.png` and `giant-mosquito-study.png` on the private repo's `codex/forest-f01` branch), each cut out of its sheet with the background and ground dust removed. `tools/meshy-image-to-3d.mjs` asks Meshy for candidates and reports the credits spent; `tools/preview/candidates.mjs` builds the page the owner picks on. The owner's limit was 300 credits without asking.
- **The marmot scout** is rigged by `tools/rig-quadruped.py` with `tools/marmot.rig.json`, whose `"character": "marmot"` picks the `MarmotScout` class's clips in place of the cat's: 26 bones, automatic weights worked on the mesh as it came. Clips, one for each phase of its behaviour in the 2D forest: `idle` (on watch), `walk` (a low shuffle), `warning` (rears up with its right paw back over its shoulder and holds), `throw` (the acorn leaves the paw a fifth of the way in, then it drops to all fours), `winded` (the rest after a throw), `hit` (the first strike), `hop` (its dodge) and `defeated` (over onto its back).
- **The giant mosquito** is rigged by `tools/rig-insect.py` with `tools/mosquito.rig.json`: 23 bones (body, head, beak, two antennae, three abdomen parts, two wings, five legs of two or three bones). The script borrows the opening, skinning and saving steps from `rig-quadruped.py`. Each wing is a separate piece of the model, tied whole to its wing bone. The wings get their own see-through material and their part of the colour picture is repainted pale, keeping the veins. Clips: `hover` (12 wingbeats a second, legs swinging late), `warning` (legs drawn up, wings racing), `dive` (wings swept back, legs trailing), `winded` (slow heavy beats) and `defeated` (curls and rolls over). The game is to point the whole mosquito along its dive; the clips stay level.
- Both meshes are thinned by the rig scripts from Meshy's 31 thousand triangles to 14 thousand (`"triangles"` in each guide file), about what a hero has, because the skeleton moves every one of them on every frame. Still frames of the thinned models look the same as the full ones.
- Meshy made the mosquito's two middle legs as one leg under the middle of its body, so it has five.
- `tools/joint-views.py` draws a model from the side, from above and from behind on a grid in metres, with a guide's joints over it. Both guide files were written from its pictures.
- Caputo was rigged again with the changed `rig-quadruped.py` and with the old one: the two files are the same, byte for byte.
- To rebuild an enemy: `blender -b -P tools/rig-quadruped.py -- <marmot-b.glb> <out.glb> tools/marmot.rig.json` or `blender -b -P tools/rig-insect.py -- <mosquito-c.glb> <out.glb> tools/mosquito.rig.json`, then `node tools/compress-hero.mjs <out.glb> <marmot or mosquito> 1024 enemies`. To rebuild the page: `node tools/preview/enemies.mjs <folder> marmot=<rigged.glb> mosquito=<rigged.glb>`, and publish it over the address above. `node tools/preview/enemy-stills.mjs` takes still frames of it.
- The marmot's raised paw is empty in its clips: the game draws the acorn, in the paw and in flight.
- A change to an enemy's model or clips goes on the enemies preview page for the owner's OK before it merges, the same as a hero.


What the owner has approved:

- Yaarbro, as he is.
- Caputo's model, skeleton and clips. He said the walk reads as a cat, and that idle, jump, falling and landing are good: leave those four alone unless he asks. He said to merge the three gaits after seeing the preview page. He has not said in his own words how the trot, the gallop or the gait changes look in motion.
- The jump stays as it is, with no pause before take-off. Jumping the instant the button is pressed matters more for the kids than a crouch that can be seen.

If the run reads to him as moving in pairs once he plays it, he brings in an animator and no more script rounds are made (see `docs/decisions.md`).

How to work on Caputo's movement:

1. Get his source file. It is not in the repo. It is a file on the `hero-models` release: https://github.com/rowbeartow/yaarbroverse-3d/releases/download/hero-models/Meshy_AI_SaberToothCatGameRead_1110213716_texture.glb (20.9 MB). Download it to a scratch folder, never into the repo.
2. Once per session: `apt-get install -y python3-numpy` (Blender needs it), `npm ci`, `npm run assets`.
3. Rig him: `blender -b -P tools/rig-quadruped.py -- <source.glb> <rigged.glb> tools/caputo.rig.json`. It takes about five seconds. It prints the speed each of the walk, the trot and the run covers ground at and when each paw lands, and stops if a planted paw is asked to reach further than its leg is long. His joint places, and any numbers changed from the script's own, are in `tools/caputo.rig.json`. The gaits are the `walk`, `trot` and `run` functions of the `Quadruped` class; `step` moves one paw through one stride.
4. Build the preview page: `node tools/preview/build.mjs <rigged.glb> <folder>`.
5. Look at it in still frames: serve it with `npx vite preview --outDir <folder> --port 4174`, then `node tools/preview/stills.mjs <sheet.jpg> side:walk:0,0.125,0.25,0.375,0.5,0.625,0.75,0.875 "" 2` (the top of that file lists the other views). A session cannot watch him move, only look at stills.
6. Measure it: with the page still served, `node tools/preview/measure.mjs` drives the game's own animation player and prints how far planted paws slide in each gait and at each change of gait, whether the three gait clips stay on one clock, and the size he is drawn at.
7. When it looks right: `node tools/compress-hero.mjs <rigged.glb> caputo` writes `assets/heroes/caputo.glb`. If the script printed new speeds, put them in `walkSpeed`, `trotSpeed` and `runSpeed` for Caputo in `src/view/hero-model.ts`: metres a second from the script, times the size `measure.mjs` prints (1.1211 now). An older note here gave 1.0946, which was wrong for the current idle pose.
8. Bring the hand-written text in `tools/preview/index.html` up to date, rebuild the page, and publish it over the page the owner already has, so his link stays the same: https://claude.ai/artifact/V3Z9Car7Ttfp1zRNRPLf7D . The top of `tools/preview/build.mjs` lists the files to publish.
9. A hero change goes in a pull request marked "do not merge until the owner says OK", and waits for his OK on the preview page. The page now shows the three gaits as merged.

Open:

- **Real-device testing is on the owner's Mac, in Safari.** He has no iPad to test on right now (his note, 2026-11-11). The iPad frame-rate target (a steady 30) and the touch controls stay as they are, and nothing waits on an iPad number. He opens the live link with `?fps` on the address in Safari on the Mac and says what frame rate and tier show; the target there is 60. Frame rate on a real device has still never been checked. If an iPad number does come in and it is under 30, fix that first, in its own pull request.
- **Nobody has reported watching Caputo's clips inside the game on a real device.** The owner judges them on the preview page.

## Where things stand

Milestone one is built, merged and live at https://rowbeartow.github.io/yaarbroverse-3d/ . Every merge to `main` publishes there.

Milestone two (the modern look) is done apart from the open items above:

1. Done: a check that fails any pull request holding a private term.
2. Skipped: tuning from the playtest. The playtest notes in the milestone prompt were blank, so no numbers changed.
3. Done: browser checks run in WebKit as well as Chromium.
4. Done: the world and lighting. The grove is a lit, textured forest.
5. Done: the hero models. Yaarbro and Caputo are both drawn from their models, and the owner has approved both. His walk, trot and gallop are merged and live.
6. Done: the textures and the forest light were fetched straight from Poly Haven and checked against the copies here.
7. Done: the trees read as conifers, and the banks have irregular, rounded outlines with rock, roots and moss at their edges.

Nobody has played the new look on a real iPad or Mac yet.

Milestone three, part one (the longer grove) is done, in three merged pull requests (18, 19 and 20):

1. Sections 1 and 2 (the Broken Logs, the Stump Steps), the checkpoint list, and drawing only the stretch of forest near the hero.
2. Sections 3 and 4 (the Ravine, the Mushroom Springs), with root shelves as a new kind of platform.
3. Sections 5 and 6 (the High Boughs, the Climb).

Milestone three, part two (enemies, hearts, the roll and the pounce) is done, in five merged pull requests (23 to 27).

Milestone four (sound and music) is done, in the pull requests listed under "Start here".

## What exists now

- **The level.** Six sections, each built around one idea and ending on a mossy bank, then the marmot chief. About 250 m of route on Normal (180 on Easy, 295 on Hard), climbing about 15 m. It runs away from the camera and never comes back toward it; sections 3 and 5 move it sideways.
  1. **The Broken Logs.** Fallen logs end to end (three on Easy, five on Normal, six on Hard). The first break is a short hop on every difficulty; the rest are real jumps.
  2. **The Stump Steps.** Stumps that climb, left and right (four, seven or eight), to a wide clearing.
  3. **The Ravine.** Root shelves step down and to the right (two on Easy, three otherwise), a low log with a break crosses the bottom, and shelves climb out to a bank. On Easy the shelves are close enough to walk down and low enough to step up.
  4. **The Tipping Logs** (milestone seven). A mushroom bounces the hero to a high log, then logs balanced on a snag at their middle (two, three or four) cross open air, each a little higher, to a mossy ledge high up. A moment after a hero lands on one it creaks and rocks (the tell), then the end the hero stands on sinks, up to 0.35, 0.8 or 1.2 m at the very end, so lingering makes the next jump higher. Numbers: `tip*` in `difficulty.ts`; rules: `src/game/moving.ts`.
  5. **The High Boughs.** Five narrow boughs level with the ledge: forward, across the screen to the left, forward, across again, forward to a bank. Each corner is a gap on Normal and Hard: two are jumped away from the camera and two across the screen. On Easy only the first corner has a gap and the others are joined.
  6. **The Windy Climb** (milestone seven). A mushroom bounces the hero to a high log, then pads of crumbling moss in a straight line (two, three or four), a short solid log to wait on, and windy boughs (one, two or two) that rise and sink and carry the hero up to the wide mossy bank at the top. Moss shivers and drops crumbs when a hero lands, then falls into the mist (1 second later on Normal, 0.6 on Hard) and grows back 3 seconds after; on Easy it only sags 0.3 m. A bough gusts and its needles shiver before each move. Numbers: `moss*` and `wind*` in `difficulty.ts`.
  7. **The Marmot Chief.** The wide bank is the chief's (see "The marmot chief" below). Beyond it, the great cedar's bough with the golden leaf. The leaf is not there to take until the chief is beaten. Touch the leaf to finish.
- **How long it takes.** The test bot's run to the chief's bank: 42.3 seconds on Easy, 61.3 on Normal, 62.5 on Hard. Its fight with the chief: 13, 36 and 45 seconds more. `GROVE_TIMES=1 npx vitest run tests/sections.test.ts --silent=false` prints the time to the end of each section. A first try will take a good deal longer.
- **Checkpoints.** Every bank is a checkpoint on Easy and Normal, so a fall costs one section at most. On Hard only the clearing (bank 2), the high ledge (bank 4) and the chief's bank (bank 6) are; the other banks are bare stone. The worst fall on Hard, just short of the chief's bank, costs about 24 seconds of a perfect run (24.1). Which banks are checkpoints is the `checkpoints` list in `difficulty.ts`; the chief's bank is one on every difficulty. A hero sent back to it stands on its near edge, and the chief is at full health again.
- **Platform kinds.** Banks, logs, stumps, mushrooms, crumbling moss (`moss`), tipping logs and windy boughs (a `log` and a `bough` with a `motion`), root shelves (`shelf`: the flat top of a great root on a trunk rising from the mist) and boughs. A root shelf's top edge is drawn the way a bank's is, never past where a hero can stand, and the bank-outline tests cover it. The high boughs of section 5 are drawn as thick mossy limbs on snags, turned a quarter turn where they lie across; only the last bough of the route is the great cedar's. A log end that rests on no bank or shelf is held up by a snag.
- **Drawing by distance.** The forest, the ferns and grass, and the platforms are built in 36 m stretches of route. Only the stretches between the camera and 140 m ahead of the hero are drawn: past that the mist has hidden nineteen twentieths of anything. Past 85 m trees wear their lighter crowns, and ferns, grass and the boulders and roots on the sides of banks are left out. The forest follows the route's middle (`src/view/route.ts`), so the gully and the trees bend where the route does, and no tree stands closer than 3.5 m to anything a hero can stand on. Measured on the test machine at medium quality, standing at the start of each section on Normal: 280 to 375 thousand triangles and 179 to 301 draw calls a frame. The short level drew 322 thousand in 144. So the triangle count runs from 13% under to 17% over what it was, and draw calls are up to twice what they were. What that does to the frame rate on a real iPad is not known.
- **The look.** The route crosses a misty gully in a fir forest. Logs and trunks have bark with moss growing over it, stumps have cut rings, mushrooms have glossy spotted caps. Ferns and grass sway. The golden leaf glows.
  - **Trees.** Firs and cedars are cones that narrow to a point: a straight trunk and tiers of boughs that leave it angled out and a little down, with a dark inner cone so they are solid from the side. The boughs sway.
  - **Banks.** Each bank's top has its own outline: the edge wanders and each corner is rounded by a different amount. Moss spills over the sides in curtains and tongues, roots come out from under the turf and run down the rock, boulders are bedded in the sides, and the rock below swells into lobes and rounds off as it goes down into the mist. The drawn top never reaches past where a hero can stand, and everything else starts well below the top (see `src/view/bank-outline.ts` and `docs/decisions.md`). The walkable area in the rules is unchanged.
- **Lighting.** A forest photograph lights everything (image-based lighting), a warm sun casts soft shadows, leaf shade drifts over the route, a filmic curve maps light to the screen, mist thickens with distance and with depth, and bright things glow.
- **Quality tiers.** High, medium, low and minimal, chosen automatically: a computer starts on high, an iPad on medium, a machine with no graphics card on minimal. The game watches the frame rate and steps down (never up) if it cannot hold 60 on a computer or a steady 30 on touch. `?fps` on the address shows the frame rate and tier. `?quality=` fixes the tier.
- **Loading.** The start screen shows at once. The 3D code and files load behind it with a progress bar, and Play switches on when they are ready. A file that fails to arrive shows a card with a "Try again" button.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They walk, jump (hold for height), bounce on mushrooms and swim the same, and each has one move of its own: Yaarbro's roll and Caputo's pounce (in water the move button dives). Both are textured models on skeletons, made by the owner in Meshy from the Caputo Mountain art.
  - **Yaarbro** was rigged and animated in Meshy. His file holds six clips: `idle`, `walk`, `run`, `jump`, `landing` and `roll`. Walk and run are mixed by how fast he is moving. In the air the jump clip is held as a pose, moved along by his upward speed, on the way up and on the way down: Meshy's falling clip is a head-first dive, so it is not used for falling. Landing plays once when he touches down, a little after a hop and in full after a long drop, and running straight on cuts it short. The roll loops while he rolls.
  - **Yaarbro's skin** had a cleanup pass. A pose test showed two things wrong and both were reweighted: his belt skewed with his legs (it now stays with the hips), and his beard sank into his chest when his head tipped down (the lower beard now stays on the chest). He is shaded smooth, with sharp edges kept on the buckle and the boot soles. Armpits, crotch and materials were checked and left as Meshy made them.
  - **Caputo.** Meshy could not rig him, so `tools/rig-quadruped.py` does it in Blender: 29 bones (hips, two spine, chest, neck, head, two shoulder blades, two ears, four legs of upper, lower and paw, six in the tail), skinned with automatic weights, and eight clips written by the script to move like a cat (the eighth is `pounce`):
    - `walk`: one paw at a time (left hind, left front, right hind, right front), each hind paw landing in the print of the front paw on its side. The shoulder blades rise in turn, the head stays level, the spine sways, and each front paw curls back at the wrist as it lifts. Every paw eases off the ground and onto it: its speed never changes in a jump.
    - `trot`: diagonal pairs, left hind with right front, then right hind with left front, two even beats in 0.4 seconds with a short float between. Back level, head steady, tail up.
    - `run`: a rotary gallop. Each paw lands by itself, going round the body: left hind, right hind 13 hundredths of a stride later, right front at 57, left front at 70. He is off the ground stretched out after the hind legs push, and for a moment gathered after the front legs push. The back curls and stretches.
    - **Gaits in the game.** He walks up to 34 hundredths of top speed, trots up to 68 and gallops above; coming down he changes at 63 and 30 (`gaits` for Caputo in `src/view/hero-model.ts`). He is in one gait at a time and fades to the next in about a tenth of a second. The three clips share one clock, set in the rig script so each paw is as near as it can be to the same point of its step in each gait, so a change carries on in mid stride. Yaarbro still mixes his walk and run by pace, as before.
    - **Measured** (`tools/preview/measure.mjs`): in a steady gait a planted paw slides about half a centimetre for each metre travelled, at every pace tried. At a change of gait a planted paw slides about 10 cm (walk and trot) or 15 to 20 cm (trot and gallop), once, because the gaits put the paws down in different orders.
    - `idle`: 8 seconds of breathing, weight shifting, two looks around, ear flicks and tail-tip flicks.
    - `jump`: a crouch and push from the hind legs, then fully stretched. The game plays the crouch and push in a tenth of a second as he leaves the ground (the rules lift him the moment Jump is pressed), then holds the rest as a pose moved along by his upward speed.
    - `falling` (legs down and spread, tail out) and `landing` (front paws, then hind paws, the body sinks, he stands).
    - His tail follows his body late, bone by bone. Paws are placed by working each leg back from where the toes should be, and the script stops if a planted paw is asked to reach further than its leg is long. His `pounce` clip is the eighth.
  - **The hero preview page** is the page the owner looks at before a hero change is merged: the hero in the game's light playing each clip, the clips mixed by the game's own animation player, and slow side views of the walk, the trot and the run over ground that moves at the game's speed, each with speed buttons, pause, a slider to step through a stride, and the skeleton. Its code is in `tools/preview/`: `build.mjs` builds it, `preview.ts` is the viewer, `index.html` is the page and its hand-written notes, `stills.mjs` takes still frames of it, and `measure.mjs` measures paw slide on it. It is published as a private Claude artifact, not as part of the game. The current one is https://claude.ai/artifact/V3Z9Car7Ttfp1zRNRPLf7D .
  - Every clip happens on the spot, because the rules own where a hero is. Meshy's clips carried Yaarbro about (the dive started fourteen metres up, the roll travelled five metres, and the landing pushed his right hand 40 cm into the ground). `tools/prepare-rigged.py` takes that out.
  - A model is stood on the spot the rules use by its footprint: soles or paws on the ground, the middle of them over the spot, so the soft dark spot sits under the feet and an edge looks as safe as it is.
  - The owner's original model files are files on the `hero-models` release of this repo: six for Yaarbro, one clip each (about 29 MB each), and one for Caputo (20.9 MB, `Meshy_AI_SaberToothCatGameRead_1110213716_texture.glb`). They are not committed. To rebuild a hero, run its Blender script on the originals and then `node tools/compress-hero.mjs <out.glb> <name>`; the commands are in `CLAUDE.md`. The compressed files are `assets/heroes/yaarbro.glb` (1.1 MB) and `assets/heroes/caputo.glb` (0.9 MB), which the build copies as they are. The CC0 stand-in robot (`?standin`) still checks the loader with a library file that has its whole jump in one clip.
- **Each hero's own move.** Yaarbro rolls while the move button is held: he tucks down and builds up to one and a half times walking speed, more slowly than he walks up to speed, keeps going with the stick let go, and carries the speed into a jump. Caputo pounces when it is pressed: a flat burst at about twice walking speed for a fifth of a second, the way the stick points or the way he faces, once for each time in the air. A roll faster than a walk, or a pounce, is a strike. The numbers are in `src/game/hero.ts`.
- **Enemies.** Three on the route, on every difficulty: a marmot scout in the clearing after the stumps (`bank-2`), a giant mosquito over the last three high boughs, and a second scout on the bank at the foot of the last climb (`bank-5`). Each notices a hero only on its own footing and never aims outside it. The rules are in `src/game/enemy.ts`:
  - Both get ready, give a warning during which the aim is fixed on where the hero stood, attack along that line, then rest. On Easy a line on screen shows where the attack will go for as long as the warning lasts. On Normal and Hard nothing is drawn: the warning is what the enemy does and its sound.
  - **The marmot scout on Easy** hides until a hero is near, shuffles toward a hero who is far off and away from one who is close, rears up with an acorn, throws it, and rests.
  - **The marmot scout on Normal and Hard** walks a beat across its bank in plain view, comes after a hero who steps onto its bank, stops to throw from a few metres off, runs straight at a hero who is close, and gives up when the hero leaves.
  - On every difficulty it hops back from a hero charging it along the ground.
  - **The giant mosquito** hovers above the hero, dives to where the hero stood, and rests there, low enough to reach. On Normal and Hard it keeps up with a running hero, dives more often, and hovers higher.
  - **Health:** a scout takes one hit on Easy and Normal and two on Hard; the mosquito one. A hit shows as a blinking flash and a short shove.
  - **What hurts:** touching either while it is on watch, on its beat or attacking, and the acorn. Touching one while it warns, hops or rests does nothing.
  - **What is a hit:** a roll faster than a walk, a pounce, or either hero landing on top. A pounce or a landing bounces the hero up off it. A hit wins over a touch that would hurt.
  - **The regen rule:** after a fall, or after running out of hearts, every enemy that is not beaten goes home at full health, and notices nobody for a second and a half. A beaten one stays beaten for the run.
  - They are drawn by `src/view/enemies.ts` from `assets/enemies/marmot.glb` and `mosquito.glb`, each playing the clip for what the rules say it is doing. Enemies far from the hero are neither moved nor drawn.
- **The marmot chief.** The grove's boss, on the wide bank at the top of the climb (`bank-6`). The rules for any boss are in `src/game/boss.ts`; the chief's numbers are `chief` in the grove's `difficulty.ts`.
  - The fight begins when the hero walks a few steps onto its bank. Its name and health come up at the bottom of the screen, the boss music takes over, and the camera pulls back so the whole bank shows.
  - It goes round on watch (walking at the hero; touching it costs a heart), warning, attack, rest. It rears up before a throw or a call, and lowers itself before a charge.
  - It throws acorns (1, a fan of 3, a fan of 5). From two thirds of its health it also charges, straight through where the hero stood to the far side of its bank. In its last third it also calls giant mosquitoes (1, 2, 2), which come back each time it calls.
  - It takes 4, 6 and 8 hits. On Easy any landing on top counts unless it is staggered. On Normal and Hard only a hit while it rests counts; a landing at other times bounces the hero clear, unharmed.
  - Beaten, it topples and fades, its sidekicks give up, the "boss beaten" sound plays, the grove music comes back, and the golden leaf bursts into view on the bough beyond.
  - Fall off its bank or run out of hearts, and the hero is back on the bank's near edge with the chief at full health and at home. The fight starts over when the hero steps in.
  - It is drawn by `src/view/boss.ts` from the scout's model, 2.3 times the size and darker. It has no clips of its own.
- **Sound.** Nothing plays until the first tap or key press, because browsers block it before that; the files are fetched while the start screen is up.
  - **Music.** A calm forest track loops from the first tap on, on the start screen too. A battle theme takes over while a boss fight is on. Finding the golden leaf plays a ten-second fanfare; the grove music makes way for it and drifts back after.
  - **What the hero does:** a swish for a jump, a thud for a landing, a boing off a mushroom, a rolling rumble for as long as Yaarbro rolls (louder the faster he goes), a heavier swish for Caputo's pounce.
  - **Footsteps** by what is underfoot: moss on banks, wood on logs, stumps, shelves and boughs. A step every 1.25 metres for Yaarbro and every 0.8 for Caputo, whose steps are the same recordings made quieter, lighter and softer. A gentle walk is quieter than a run. Each step is a little higher or lower than the last.
  - **What tells the player something:** a hit, running out of hearts, a fall, a checkpoint (the first time a safe bank is reached), landing on or striking an enemy, the marmot scout's warning squeak and its throw, the mosquito's warning and its dive, and a boss being beaten. A boss's own warnings, throws and hits use the scout's sounds. These are the loudest, and the music dips under them.
  - **Distance.** Enemy sounds are full within 6 metres and fade to nothing at 48, well past the edge of the screen. The mosquito whines for as long as it is about, so it is heard before it is seen.
  - **Mute.** A Sound button beside Pause, on every screen, and the M key. The choice is remembered in the browser. Muted, the music keeps its place silently, so it is there when sound comes back.
  - **Loudness.** Every short sound is brought to one loudness when it loads, then set by its job. One limiter holds down whatever piles up.
  - Pausing, the end of the level and starting again stop the roll and the whine. Every button gives a soft click.
- **Hearts.** 5 on Easy, 3 on Normal, 2 on Hard, shown under the level's name; a lost heart stays in place as a dark outline. A hit takes one, throws the hero away from what hurt it (0.5, 1.2 or 2 metres, by difficulty), takes the controls for a moment, and then nothing can hurt the hero for a while (1.3 seconds, times 1.5 on Easy and 0.6 on Hard), during which the hero flickers. A fall costs no heart. Losing the last one returns the hero to the last safe bank with all of them again. That is the same bank a fall returns to, so on Hard the cost stays under about 30 seconds of a perfect run.
- **Water and swimming** (milestone eight; only the Sandbox has a pool so far). Deep water is never a fall: a hero in it swims, floating head and shoulders out. Move to swim, hold the move button (X, Shift or the round touch button) to dive, hold Jump to swim up; with neither the swimmer drifts back up. Jump at the surface beside something low enough climbs out. A breath bar under the hearts shows while breath runs down underwater (never on Easy); running out is the same as losing the last heart. Nothing reaches a hero whose head is underwater. The water is see-through with gentle waves; underwater the camera dips under the surface and the picture turns blue-green and misty, with light from above; there are splashes, rings, bubbles and drips. Going in, strokes and surfacing have sounds, and underwater everything is muffled. Yaarbro treads water, crawls, swims underwater and climbs out with clips from Meshy; Caputo dog-paddles, swims underwater and shakes himself off when he climbs out. A ghost swims too. Rules: `src/game/swim.ts`; drawing: `src/view/water.ts`; recipe: "Water" in `docs/adding-a-level.md`.
- **Camera.** Behind and above the hero, always looking the same way. A soft dark spot under the hero shows where a jump will land. In a boss fight it pulls back and up so the whole arena shows.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`: the route's sizes and gaps, the checkpoints, hearts, how long a hit protects, how far it throws, and the enemies' warning, speed and rest.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. It costs no heart.
- **End card.** Difficulty, hero, time, falls, hearts lost, date, and the player's best time and fewest falls with a new best marked. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, X or Shift for the hero's own move (and to dive in water), Esc, M for sound off and on. Touch: drag the left half to move, press the right half to jump, and a smaller round button above Jump for the hero's own move (in water it turns into a Dive button). The picked level card and the pause screen list them for the device in use.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card.
- **This device remembers** its players (see "Start here") and whether sound is off.
- **Size.** The whole download is 11.45 MB (budget 20 MB), of which sound and music are 2.84 MB (budget 4 MB). The heroes' swimming clips added about 0.27 MB to their two files. Both are checked on every build.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0, the sounds and music included. It also lists the hero and enemy models, which are not: the README says the characters, their art and the models are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit. The two browser jobs run inside Playwright's container image, pinned to the Playwright version in `package.json` (1.63.0), so a run installs nothing from Ubuntu's servers. Before this, on 2026-11-11, four runs in a row failed before any test because GitHub's machines could not reach those servers.

## Checks on this state

- `npm test`: 995 rule tests pass. New in milestone eight, part three: the crocodile's lurking, stalking at the surface and underwater, its tell, its bite at the surface and underwater, getting past by swimming out of its line or diving, beating it, and the regen rule (`tests/crocodile.test.ts`); where the crocodiles wait on each difficulty, and the bot getting past every one on Normal and Hard with no heart lost (`tests/lake.test.ts`); its sounds (`tests/sound.test.ts`); its model file and clips (`tests/enemy-files.test.ts`). New in milestone eight, part two: Cocolalla Lake's sections, run times, the dive against the breath, the rocky point only passable underwater, the banks that cannot be climbed from the water, a missed jump landing in the water, and what each difficulty changes (`tests/lake.test.ts`); the bot finishes the lake on every difficulty as each hero (`tests/levels.test.ts`). New in milestone eight, part one: the bot wins every boss's first fight from 14 ways in on every difficulty as each hero (`tests/boss-entry.test.ts`); swimming, diving, swimming up, the floor, the pool's sides, breath, running out of it, climbing out, shores, checkpoints and enemies in water, and the bot crossing the Sandbox pool with the dive button on every difficulty as each hero (`tests/swim.test.ts`, and `tests/levels.test.ts` for every pool in every level); the swimming sounds and the muffle (`tests/sound.test.ts`); a ghost that swims, and old ghosts still loading (`tests/ghost.test.ts`); the heroes' new clips (`tests/hero-files.test.ts`). New in milestone seven: tipping logs, crumbling moss and windy boughs on their own and as the grove uses them, the drawn top of a tipping log against the rules' (`tests/moving.test.ts`); the ghost store (`tests/ghost-store.test.ts`). New in milestone six: the scout's beat and chase, the shorter warnings, the mosquito keeping up, enemy health, the shove of a hit, the regen rule for enemies (`tests/enemies.test.ts`); how any boss fights, its stages, its guard, its sidekicks, the locked goal and the regen rule for a boss (`tests/boss.test.ts`); the marmot chief's place, look, numbers and sidekicks (`tests/chief.test.ts`). The test bot plays every level on every difficulty as each hero: no fall, no heart lost on the way to a boss, the boss beaten in its first fight, on walk and jump alone. It loses no heart to the chief on any difficulty with the current layout.
- `npm run test:browser`: the browser checks pass on GitHub for every pull request of milestones seven and eight, now in parallel shards, about 10 minutes a pull request (new in part two: the lake opens, draws its water, shore and mountains, and plays to its end card, in `levels.spec.ts`; its card on the picker, in `picker.spec.ts`; new in part one: new in eight: diving with the keyboard and the touch button, the breath bar on Normal and never on Easy, and the sound muffled underwater, in `swim.spec.ts`; the pool drawn, splashes, and the underwater look coming and going, in `water.spec.ts`), in Chromium at Mac size with the keyboard, in Chromium at iPad size with touch, and in WebKit at iPad size with touch. New in milestone six: the scout hiding on Easy and walking its beat on Hard, the aim line on Easy only, a hit showing and a fall undoing it (`enemies.spec.ts`); a boss's bar, music, hit, regen, victory and locked leaf, on the practice boss and on the chief (`boss.spec.ts`). Checks about the end of a run count the boss as beaten (`skipBoss` in `helpers.ts`) and do not fight it.
- **Not checked:**
  - How anything moves or sounds in milestone six, beyond the owner's look at the tougher enemies on the preview page (see "Start here").
  - How anything sounds. Nobody can hear a test browser, and a cloud session cannot hear. The checks prove sound is asked for at the right moments and raises no error.
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on an iPad. On the owner's Mac in Safari it was 120 a second on the high tier with a scout on screen (before sound). Whether sound costs frames on any device has not been measured; it should not, since sounds are decoded once and played by the browser.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - Any clip in motion, other than by the owner on the preview pages: a cloud session can only look at still frames.
  - Whether Easy is easy enough for the younger player. Hard is settled: the older player loved it.

## What's next

1. **The rope swing's dismount** (see the top of this file), with a new look on the lake preview page before it merges. The rope's two sounds still wait for his pick on the sound board.
2. **Fishing and the monster pike, in a new session.** The owner's word so far (`docs/decisions.md`, 2026-11-14): the lake level ends at a fishing dock, and the monster pike fight goes there; the pike is fought both on the fishing line and in the water. Read the Caputo Mountain docs on fishing in the private repo first, and ask the owner for anything they do not give.
3. **The Bouncing Grove reshaped by the route rule**, after that. Plan it the way the lake was planned: a map from above with the camera's facing in each part and its numbers on the rule, for the owner's OK before anything is built.
4. **The owner checks the reshaped lake on the Mac and with the kids** (see "What nobody has checked yet on the reshaped lake"). If the frame rate drops under 60, the first things to cut are the near pines (`nearPines` in `LAKE_LOOK`, `src/view/lake.ts`), the pines on the island (`islandPineArea`), and the water's points (the 2.5 m cells in `sheet`, `src/view/lake.ts`).
5. **Ideas that came up and were not asked for** are not in the code: a rolling log and logs drifting in a stream (drifting logs could be a new `motion` kind in `src/game/moving.ts`), a run clip for the scout and clips of its own for the chief, a clip of its own for each hero hanging from a rope, harder optional routes on the lake for the older player.

## Known limits

- The test bot's look-ahead in a boss fight costs time: three Hard runs of the grove with the bot take about 2.5 seconds of computing here. The ghost test that plays three of them has a 30 second limit.
- Water: moving pieces and water have not been tried together. A crocodile, or any enemy in the water, is not built. A swimmer cannot leap out of open water: the way out is always a climb. The swimming camera can cut, rather than ease, where an arch stands between the two views.
- A swimmer underwater is shorter in the rules (0.9 m) than any hero's model lying level, so the model can poke a little into an arch's underside while passing under it.
- Caputo's climb out is his jump's push off the ground, played over the climb; Yaarbro's is the end of Meshy's "Swimming to Edge". Neither is a clip made for climbing out.
- The windy boughs keep the wind's rhythm from the start of a run, and their rhythm (`windStart`) was set so the bot's perfect run meets the first bough as it comes down. A player who arrives at another moment waits on the solid log up to a full rhythm (6.8, 5.6 and 3.6 seconds).
- A crumbling moss pad pops back whole when it grows back; it does not grow.

- One area, with three enemies and a boss in it.
- Progress lives in one browser on one device. Another browser, a private window or cleared site data starts from nothing, and nothing carries between the Mac and the iPad.
- A ghost is only kept for a best time. A run with the fewest falls that was slower leaves no ghost.
- On Easy a run that never stops is never hit by an enemy. On Normal and Hard a scout comes after the hero, so it has to be outrun, jumped over or hit.
- The chief and the scout share one model and one set of clips: the chief's charge is the scout's shuffle played fast.
- A boss's attacks are taken in a fixed order, so a fight plays the same way each time until the player does something different.
- On Normal and Hard nothing on screen marks where an attack will land. That is the owner's rule; if the kids cannot read the wind-ups, `enemyAimLine` and `chief.aimLine` bring the lines back.
- The mosquito has five legs: Meshy made its two middle legs as one.
- A scout's dodge and the mosquito's resting place are easy to miss at speed: nothing on screen explains that a resting enemy is the one to strike.
- The high boughs are logs on tall snags. They read clearly as footing, but they do not look like living boughs growing from trees.
- A hero who falls from high up drops a long way before the fall is counted (the rule is a fixed height, 6 m below the start), and the camera follows it down.
- The test bot is the only thing that has played the whole level. It measures whether each difficulty can be finished and how long a perfect run takes, not whether a jump reads well or feels fair.
- Sound is the same in both ears: an enemy on the left does not sound from the left.
- Footsteps are counted from distance walked, not from the hero's feet touching down, so a step can sound a moment off the animation.
- The golden leaf tune is ten seconds long, and the end card appears under two seconds into it.
- Caputo is long and the footing check is a small circle under his middle, so his head, tail and outer paws hang over narrow stumps.
- On a phone-sized screen the start screen is taller than the screen and has to be scrolled (issue #5).
- The minimal tier is blurry and its trees are sparse. It is only for machines that draw in software.
- On the keyboard a hero is at full speed almost at once, so Caputo's walk and trot are mostly seen on the iPad with a gentle push.
- Each of Caputo's gaits is one clip played slower or faster to match the ground, so the trot is quick-stepping at the top of its range and the gallop a little floaty at the bottom of its range.

## Added as plain scenery, not canon

Tree stumps to hop on, the tall snags of the last climb, the snags that hold logs and boughs up, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. The marmot chief, its mosquito sidekicks and the regen rule come from the owner (`docs/decisions.md`, 2026-11-13); the wide bank it stands on is plain scenery. Everything else comes from Caputo Mountain: the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, root shelves, a ravine, high boughs, a climb that starts with a spring, the golden leaf tucked in the canopy, both heroes' looks, and the end card. Pieces that move (the tipping logs, the crumbling moss and the windy boughs) come from the owner's word (`docs/decisions.md`, 2026-11-14), not from the Caputo Mountain forest, where nothing moves. The enemies, the hearts and the two moves are Caputo Mountain's too.
