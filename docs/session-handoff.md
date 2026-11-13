# Session handoff

Last updated: 2026-11-13 (milestone six, done)

## Start here

**Milestone six is done: tougher enemies, enemy health and the regen rule, the boss system, and the marmot chief at the end of the grove.** The game is live at https://rowbeartow.github.io/yaarbroverse-3d/ . **The next step is grove variety** (see "The roadmap" and "What's next"). The owner's decisions for milestone six, and what the kids asked for, are in `docs/decisions.md` (2026-11-13).

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
2. **How the fight sounds.** The boss music and the "boss beaten" sound were picked on the sound board, not heard in the game. The chief's warnings, throws and hits use the scout's sounds.
3. **Whether Easy's chief is easy enough for the younger player, and Hard's is work enough for the older player.** The numbers are in one place if not.
4. **The frame rate in the fight**, in Safari on the Mac with `?fps` on the address: the chief, two mosquitoes and the hero are on screen together.
5. **Safari itself and a real iPad.** The checks pass in WebKit built for Linux.

**The preview pages for behaviour** (new in milestone six). `tools/preview/arena.mjs` builds a page that runs the game's own rules, numbers, enemy and boss drawing and hero drawing in a blocked-out copy of the level, at full speed. "Watch" plays a script, or for a boss fight the rule tests' own bot; "Play it yourself" hands over the hero. Its places are the `PLACES` table in `tools/preview/arena.ts`; its hand-written words are in `arena.html`, which now holds the chief's page. It needs the four plain model files rebuilt from the originals on the `hero-models` release (the commands are in `CLAUDE.md`; Yaarbro's six files are named in `tools/yaarbro.guide.json`). `node tools/preview/arena-stills.mjs` takes still frames of it. The first version of the page did not load for the owner once; it now says what it is loading and reports its own errors on the page.

**The roadmap, in the owner's order:**

1. Milestone six: done.
2. **Grove variety: next.** Keep the best vertical-log section and replace the other two with different obstacles. The kids said the grove repeats the same jump patterns: the vertical-log hops appear three times.
3. The lake: swimming, diving, a lake level and crocodiles. Lakes are central to the Yaarbroverse. Both heroes swim, on the surface and underwater. It would be nice, not required, if Caputo shakes the water off when he gets out.
4. Fishing and the monster pike boss. The pike is fought both on the fishing line and in the water.
5. Skiing in the Selkirks, with Caputo on a snowboard.
6. Mountain climbing on rock, ice and trees.

Everything from "Milestone five" down to "Where things stand" is the record of earlier milestones, kept as it was written.

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
  4. **The Mushroom Springs.** A mushroom bounces the hero to a high log, then mushrooms over open air (one, four or five) lead to a mossy ledge high up.
  5. **The High Boughs.** Five narrow boughs level with the ledge: forward, across the screen to the left, forward, across again, forward to a bank. Each corner is a gap on Normal and Hard: two are jumped away from the camera and two across the screen. On Easy only the first corner has a gap and the others are joined.
  6. **The Climb.** A mushroom, a high log, tall snags that climb (two, four or five), mushrooms over open air (one, three or four), up to a wide mossy bank at the top.
  7. **The Marmot Chief.** The wide bank is the chief's (see "The marmot chief" below). Beyond it, the great cedar's bough with the golden leaf. The leaf is not there to take until the chief is beaten. Touch the leaf to finish.
- **How long it takes.** The test bot's run to the chief's bank: 39.0 seconds on Easy, 57.0 on Normal, 62.2 on Hard. Its fight with the chief: 13, 38 and 48 seconds more. `GROVE_TIMES=1 npx vitest run tests/sections.test.ts --silent=false` prints the time to the end of each section. A first try will take a good deal longer.
- **Checkpoints.** Every bank is a checkpoint on Easy and Normal, so a fall costs one section at most. On Hard only the clearing (bank 2), the high ledge (bank 4) and the chief's bank (bank 6) are; the other banks are bare stone. The worst fall on Hard, just short of the chief's bank, costs about 24 seconds of a perfect run. Which banks are checkpoints is the `checkpoints` list in `difficulty.ts`; the chief's bank is one on every difficulty. A hero sent back to it stands on its near edge, and the chief is at full health again.
- **Platform kinds.** Banks, logs, stumps (the tall snags of section 6 are stumps too), mushrooms, root shelves (`shelf`: the flat top of a great root on a trunk rising from the mist) and boughs. A root shelf's top edge is drawn the way a bank's is, never past where a hero can stand, and the bank-outline tests cover it. The high boughs of section 5 are drawn as thick mossy limbs on snags, turned a quarter turn where they lie across; only the last bough of the route is the great cedar's. A log end that rests on no bank or shelf is held up by a snag.
- **Drawing by distance.** The forest, the ferns and grass, and the platforms are built in 36 m stretches of route. Only the stretches between the camera and 140 m ahead of the hero are drawn: past that the mist has hidden nineteen twentieths of anything. Past 85 m trees wear their lighter crowns, and ferns, grass and the boulders and roots on the sides of banks are left out. The forest follows the route's middle (`src/view/route.ts`), so the gully and the trees bend where the route does, and no tree stands closer than 3.5 m to anything a hero can stand on. Measured on the test machine at medium quality, standing at the start of each section on Normal: 280 to 375 thousand triangles and 179 to 301 draw calls a frame. The short level drew 322 thousand in 144. So the triangle count runs from 13% under to 17% over what it was, and draw calls are up to twice what they were. What that does to the frame rate on a real iPad is not known.
- **The look.** The route crosses a misty gully in a fir forest. Logs and trunks have bark with moss growing over it, stumps have cut rings, mushrooms have glossy spotted caps. Ferns and grass sway. The golden leaf glows.
  - **Trees.** Firs and cedars are cones that narrow to a point: a straight trunk and tiers of boughs that leave it angled out and a little down, with a dark inner cone so they are solid from the side. The boughs sway.
  - **Banks.** Each bank's top has its own outline: the edge wanders and each corner is rounded by a different amount. Moss spills over the sides in curtains and tongues, roots come out from under the turf and run down the rock, boulders are bedded in the sides, and the rock below swells into lobes and rounds off as it goes down into the mist. The drawn top never reaches past where a hero can stand, and everything else starts well below the top (see `src/view/bank-outline.ts` and `docs/decisions.md`). The walkable area in the rules is unchanged.
- **Lighting.** A forest photograph lights everything (image-based lighting), a warm sun casts soft shadows, leaf shade drifts over the route, a filmic curve maps light to the screen, mist thickens with distance and with depth, and bright things glow.
- **Quality tiers.** High, medium, low and minimal, chosen automatically: a computer starts on high, an iPad on medium, a machine with no graphics card on minimal. The game watches the frame rate and steps down (never up) if it cannot hold 60 on a computer or a steady 30 on touch. `?fps` on the address shows the frame rate and tier. `?quality=` fixes the tier.
- **Loading.** The start screen shows at once. The 3D code and files load behind it with a progress bar, and Play switches on when they are ready. A file that fails to arrive shows a card with a "Try again" button.
- **Heroes.** Yaarbro and Caputo, picked on the start screen. They walk, jump (hold for height) and bounce on mushrooms the same, and each has one move of its own: Yaarbro's roll and Caputo's pounce. Both are textured models on skeletons, made by the owner in Meshy from the Caputo Mountain art.
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
- **Camera.** Behind and above the hero, always looking the same way. A soft dark spot under the hero shows where a jump will land. In a boss fight it pulls back and up so the whole arena shows.
- **Difficulty.** Easy, Normal, Hard on the start screen. All numbers are in `src/levels/bouncing-grove/difficulty.ts`: the route's sizes and gaps, the checkpoints, hearts, how long a hit protects, how far it throws, and the enemies' warning, speed and rest.
- **Falls.** A fall returns the hero to the last safe mossy bank and is counted. It costs no heart.
- **End card.** Difficulty, hero, time, falls, hearts lost, date, and the player's best time and fewest falls with a new best marked. "Play again" returns to the start screen.
- **Controls.** Mac: arrows or W A S D, Space, X or Shift for the hero's own move, Esc, M for sound off and on. Touch: drag the left half to move, press the right half to jump, and a smaller round button above Jump for the hero's own move.
- **Turn sideways.** A touch device whose page is taller than wide gets a "Turn sideways to play" card.
- **This device remembers** its players (see "Start here") and whether sound is off.
- **Size.** The whole download is 10.80 MB (budget 20 MB), of which sound and music are 2.48 MB (budget 4 MB). Both are checked on every build.
- **Credits.** `CREDITS.md` lists every third-party file. All are CC0, the sounds and music included. It also lists the hero and enemy models, which are not: the README says the characters, their art and the models are all rights reserved.
- **Checks on every pull request.** `.github/workflows/checks.yml`, three jobs: the private-terms check; rule tests, build with size check and browser checks in Chromium; browser checks in WebKit. The two browser jobs run inside Playwright's container image, pinned to the Playwright version in `package.json` (1.63.0), so a run installs nothing from Ubuntu's servers. Before this, on 2026-11-11, four runs in a row failed before any test because GitHub's machines could not reach those servers.

## Checks on this state

- `npm test`: 667 rule tests pass. New in milestone six: the scout's beat and chase, the shorter warnings, the mosquito keeping up, enemy health, the shove of a hit, the regen rule for enemies (`tests/enemies.test.ts`); how any boss fights, its stages, its guard, its sidekicks, the locked goal and the regen rule for a boss (`tests/boss.test.ts`); the marmot chief's place, look, numbers and sidekicks (`tests/chief.test.ts`). The test bot plays every level on every difficulty as each hero: no fall, no heart lost on the way to a boss, the boss beaten in its first fight, on walk and jump alone. It loses no heart to the chief on Easy and Hard and one on Normal.
- `npm run test:browser`: 201 browser checks pass, in Chromium at Mac size with the keyboard, in Chromium at iPad size with touch, and in WebKit at iPad size with touch. New in milestone six: the scout hiding on Easy and walking its beat on Hard, the aim line on Easy only, a hit showing and a fall undoing it (`enemies.spec.ts`); a boss's bar, music, hit, regen, victory and locked leaf, on the practice boss and on the chief (`boss.spec.ts`). Checks about the end of a run count the boss as beaten (`skipBoss` in `helpers.ts`) and do not fight it.
- **Not checked:**
  - How anything moves or sounds in milestone six, beyond the owner's look at the tougher enemies on the preview page (see "Start here").
  - How anything sounds. Nobody can hear a test browser, and a cloud session cannot hear. The checks prove sound is asked for at the right moments and raises no error.
  - Safari itself, a real iPad, a real Mac. The test browsers have no graphics card, so most checks run on the minimal tier, which has plain shading and no shadows. The full lighting is drawn in both browsers by two checks, slowly and in a small window.
  - Frame rate on an iPad. On the owner's Mac in Safari it was 120 a second on the high tier with a scout on screen (before sound). Whether sound costs frames on any device has not been measured; it should not, since sounds are decoded once and played by the browser.
  - In WebKit the test tools cannot hold or drag a real finger, so held and dragged touches are simulated at the page; taps on buttons are real.
  - Any clip in motion, other than by the owner on the preview pages: a cloud session can only look at still frames.
  - Whether Easy is easy enough for the younger player. Hard is settled: the older player loved it.

## What's next

1. **Grove variety** (the owner's next milestone). The vertical-log hops appear three times in the grove: the stumps of section 2, the mushrooms over open air in section 4 and the snags and mushrooms of section 6 all step left and right and climb. Keep the best of them and replace the other two with different obstacles. What it needs from the owner first: which one is "the best" (or leave to pick), and an approved plan for the two replacements. Every piece of the grove comes from the Caputo Mountain forest or from what he says; nothing in the forest moves, so a moving platform needs his word. The route's numbers are in `src/levels/bouncing-grove/difficulty.ts`, its shape in `layout.ts`, and the bot and the rule tests check any change.
2. **The owner and the kids play milestone six** and say what is off (see "What nobody has checked yet"). Tuning is numbers in `difficulty.ts`: `chief` for the boss, `enemyWarning`, `scoutChase` and the rest for the enemies.
3. **Then the lake**, and the rest of the roadmap in "Start here". A level that is not the forest needs its own surroundings and music; `docs/adding-a-level.md` says where those go, and how to end a level with a boss.
4. **Ideas that came up and were not asked for** are not in the code: a run clip for the scout and clips of its own for the chief, sounds of its own for the chief, a hint on screen the first time a guarded boss is open, remembering the last area each player picked, a ghost of someone else's run, sound that moves left and right with what makes it.

## Known limits

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

Tree stumps to hop on, the tall snags of the last climb, the snags that hold logs and boughs up, the great cedar that holds the last bough, and the misty gully the route crosses with its slopes, ferns and boulders. The Caputo Mountain docs do not say what lies below the grove; its forest painting shows a misty valley of firs, which this follows. The marmot chief, its mosquito sidekicks and the regen rule come from the owner (`docs/decisions.md`, 2026-11-13); the wide bank it stands on is plain scenery. Everything else comes from Caputo Mountain: the Bouncing Grove, mossy banks as safe places, mushroom springs, logs with breaks, root shelves, a ravine, high boughs, a climb that starts with a spring, the golden leaf tucked in the canopy, both heroes' looks, and the end card. No platform in the level moves, because none in the Caputo Mountain forest does. The enemies, the hearts and the two moves are Caputo Mountain's too.
