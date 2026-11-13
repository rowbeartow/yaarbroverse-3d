# Decision log: Yaarbroverse 3D

Append only. Never edit or delete a past entry. If a decision is reversed, add a
new entry that supersedes it and say which one it replaces.

---

## 2026-11-10 Objective: a 3D browser game in the Yaarbroverse for two kids
Reason: The family already has Caputo Mountain, a 2D game in the same world. This is its 3D sibling. One kid is older and finds games too easy, the other is younger and finds them too hard, so every level has to work for both. They play on an iPad (touch, held sideways) and a Mac (keyboard).
Supersedes: none

## 2026-11-10 Milestone one is one small playable area, then stop
Reason: Done means: one 3D area from the world, a hero that walks and jumps, a camera that follows, one goal, Easy/Normal/Hard, an end screen, automated tests for the rules, and a link that opens on the Mac and the iPad. Out of scope for now: enemies, hearts, hero abilities, sound, saved progress, two-player, more levels.
Supersedes: none

## 2026-11-10 World, characters and tone come from Caputo Mountain. Nothing new is canon.
Reason: The owner's rule. Source is the docs and art in the private Caputo Mountain repo (`digglesworth`), read only. If something is needed that is not there, ask the owner. Plain scenery (a tree stump, a tall cedar) is allowed and is not canon.
Supersedes: none

## 2026-11-10 Stack: Three.js, TypeScript and Vite
Reason: Runs in any modern browser with nothing to install. Three.js is the most widely used 3D library for the web, so help and examples are easy to find. TypeScript catches mistakes before the game runs. Vite builds one small static site that any host can serve. Tests: Vitest for the game rules, Playwright for the browser.
Supersedes: none

## 2026-11-10 No database, no accounts, no online services
Reason: The owner's rule. The only thing kept is the hero and difficulty a device last chose, stored in that browser.
Supersedes: none

## 2026-11-10 Lifespan: a maintained family project
Reason: It will grow level by level, so it gets tests, docs and a handoff file from day one.
Supersedes: none

## 2026-11-10 Game rules are separate from drawing, and run in fixed steps of 1/60 second
Reason: `src/game` and `src/levels` have no browser or 3D code. Tests can play a whole level in milliseconds, the game plays the same on a slow or fast screen, and a server could run the same rules later for two-device play. No physics library: walking, jumping and landing on boxes and circles is a few hundred lines we fully control.
Supersedes: none

## 2026-11-10 The first area is the Bouncing Grove, and the goal is the golden leaf
Reason: It is the opening of the forest in Caputo Mountain (mushroom springs, fallen logs with breaks, mossy banks, a golden leaf hidden up high), it suits 3D jumping, and the forest is the part of the 2D game the family is building on. Stumps and the great cedar holding the last bough are plain scenery added to make a 3D route.
Supersedes: none

## 2026-11-10 Both heroes are playable now and move the same
Reason: Each kid has their own hero in the 2D game, so shipping only one would leave one of them without theirs. Different abilities (the 2D game has a roll and a pounce) are a milestone-two choice for the owner.
Supersedes: none

## 2026-11-10 Each level keeps all its Easy, Normal and Hard numbers in one file
Reason: The owner's rule, and the same idea as the 2D forest. For the grove that file is `src/levels/bouncing-grove/difficulty.ts`. It changes how wide the footing is, how long the jumps are, how many stumps and mushrooms there are, how many banks are safe, and how forgiving edges are. The tests play the level on all three and fail if a change makes one impossible.
Supersedes: none

## 2026-11-10 A fall returns the hero to the last safe mossy bank. No hearts yet.
Reason: This is the 2D forest's rule. Nothing in milestone one can hurt a hero, so hearts would have nothing to do. On Hard only the first bank is safe (the others are bare stone), so a fall means starting the grove again. Hearts arrive with the first thing that can hurt.
Supersedes: none

## 2026-11-10 Working rule: small pull requests, merged by Claude once their checks pass
Reason: The owner asked for small pull requests and for the work to run through to the end of the milestone without stopping. One branch can only carry one open pull request, so each has to merge before the next starts. Every pull request says what changed and how it was tested. The owner can change this rule at any time.
Supersedes: none

## 2026-11-10 This repo is public, so it holds no family names and no art from the private repo
Reason: Public repos make GitHub Pages free. The kids are "the older player" and "the younger player" in these docs. The heroes are redrawn here as low-poly shapes; no file was copied from Caputo Mountain.
Supersedes: none

## 2026-11-10 Everything on screen is built from simple shapes in code. No model or picture files.
Reason: The 2D game's 18 MB load is too slow. Low-poly shapes built in code keep the whole download near 0.6 MB (the budget is 10 MB, checked on every build). Detailed models can replace shapes later, one at a time.
Supersedes: none

## 2026-11-10 The camera sits behind and above the hero and always looks the same way
Reason: No camera control to learn, which matters most for the younger player on a touch screen. "Up" on the stick is always "away from you". A dark spot under the hero shows where a jump will land; over open air there is no spot.
Supersedes: none

## 2026-11-10 Touch: drag the left half to move, press the right half to jump
Reason: Whole halves of the screen are easier for small thumbs than small buttons. The stick appears under the thumb wherever it lands. Keyboard: arrows or W A S D, Space to jump, Esc to pause.
Supersedes: none

## 2026-11-10 "Turn sideways" shows whenever a touch device's page is taller than it is wide
Reason: A device held upright and a device turned sideways with its screen locked upright look the same to a web page: the page is tall. One rule covers both, and the card explains how to turn rotation lock off. The game holds still while the card is up. Computers never see the card.
Supersedes: none

## 2026-11-10 Browser checks do not replay a whole level with timed key presses
Reason: Caputo Mountain found those unreliable on slow machines. Here the rule tests play each difficulty start to finish with a bot (fast, exact), and the browser checks cover what only a browser can show: drawing, keyboard, touch, the screens.
Supersedes: none

## 2026-11-10 Hosting: GitHub Pages, published by GitHub Actions on every merge to main
Reason: The game is only static files and this repo is public, so Pages is free and needs no other account. It needs the owner to switch Pages on once in the repo settings.
Supersedes: none

## 2026-11-10 No login. The link is public and the game holds nothing personal.
Reason: Nothing in the game or this repo names the family or the kids, so a login would only add friction on the kids' devices. If the owner wants it private later, Cloudflare Access (already used for Caputo Mountain) can sit in front of the same files.
Supersedes: none

## 2026-11-10 Milestone two is the modern look: textured models, image-based lighting and real shadows
Reason: The grove read as blocky. The owner wants a modern 3D game: smooth, textured, properly lit characters and scenery, in the range of Astro Bot or Super Mario Odyssey. Stylized, not photoreal. Heroes are rigged, textured glTF models with skeletal animation, and scenery uses textured models and materials, image-based lighting and real shadows. The shapes were a download-size choice that expected this swap. Game rules, difficulty numbers and controls do not change, apart from playtest tuning.
Supersedes: "Everything on screen is built from simple shapes in code. No model or picture files."

## 2026-11-10 Hero models are made by the owner in Meshy and live in this repo
Reason: Hero models were made by the owner in Meshy's web app on a Pro plan (privately owned), from the Caputo Mountain art. Characters and art are all rights reserved, and README.md says so.
Supersedes: "This repo is public, so it holds no family names and no art from the private repo", for the hero model files only. The rest of that entry stands: no family names, and no other file from the private repo.

## 2026-11-10 Every other third-party asset is CC0 and listed in CREDITS.md
Reason: CC0 means anyone may use the file for anything, so a public repo can hold it without asking. CREDITS.md lists each one with its source and license.
Supersedes: none

## 2026-11-10 Download budget rises from 10 MB to 20 MB, and assets are compressed at build time
Reason: Models and textures need the room. The build enforces the budget. Assets are compressed when the game is built (meshopt for geometry, KTX2 for textures). The start screen appears before the 3D assets finish loading, with a progress bar, so nobody waits at a blank page.
Supersedes: the 10 MB budget in "Everything on screen is built from simple shapes in code. No model or picture files."

## 2026-11-10 Frame rate targets: 60 on the Mac, a steady 30 or better on the iPad
Reason: Smooth play matters more than extra detail. Quality tiers are chosen automatically, so each device gets the best look it can hold at its target.
Supersedes: none

## 2026-11-10 Browser checks run in WebKit as well as Chromium, and WebKit is a required check
Reason: Every iPad browser is WebKit, and merges publish straight to the kids' devices.
Supersedes: none

## 2026-11-10 A required check fails any pull request that contains a private term
Reason: The repo and its Actions logs are public. The terms live only in the repository secret PRIVATE_TERMS. The check looks for each term as a whole word, with the same capitals, in tracked files, the pull request's title and description, and commit messages. It prints only file and line number. If a flagged line is an ordinary word, reword the line; there is no list of exceptions.
Supersedes: none

## 2026-11-10 Milestone three makes the grove a full level
Reason: The marmot scout and giant mosquito, hearts, a longer route with checkpoints, Yaarbro's roll and Caputo's pounce. Each move must beat or get past both enemies, so neither hero is the weaker one. Easy stays finishable with walk and jump alone. Enemy models are made the same way as the hero models.
Supersedes: none

## 2026-11-10 Confirmed: the link stays public, and Claude keeps merging its own pull requests once checks pass
Reason: The owner confirmed both at the start of milestone two.
Supersedes: none

## 2026-11-10 Hero model files are kept here in compressed form only
Reason: The owner's originals are 20 to 30 MB each, over GitHub's 25 MB web upload limit and several times the rest of the game's download. `tools/compress-hero.mjs` turns an original into the small file the game loads (about 1 MB), and only that is committed, in `assets/heroes/`. The owner keeps the originals as files on the `hero-models` release of this repo. The characters and art stay all rights reserved, and README.md says so.
Supersedes: "Hero models are made by the owner in Meshy and live in this repo", for how the files are kept. The rest of that entry stands.

## 2026-11-10 Characters Meshy cannot rig are rigged and animated in Blender by a script in tools/, run headless
Reason: Meshy rigs only humanoids reliably and could not rig Caputo. A script makes the rig repeatable, and reusable for the milestone-three enemies.
Supersedes: none

## 2026-11-10 The drawn top of a bank never reaches past where a hero can stand
Reason: The owner's rule: scenery may be made to look more natural, but the walkable area in the rules does not change, and the visible top edge must match where a hero can actually stand, so a jump never looks safe when it isn't. A bank's edge may wander and its corners may be rounded only inside the strip between the bank's rectangle in the rules and the furthest line a hero can stand on (the foot radius past it). Rock, roots and moss go below and beside the top, starting well below it, so they do not read as more ground. `tests/bank-outline.test.ts` checks every bank on every difficulty.
Supersedes: none

## 2026-11-10 A clip never carries a character across the level: the rules own position
Reason: The owner's rule. Library clips move the whole body (Yaarbro's dive starts fourteen metres up, his roll travels five metres). In the game the rules decide where a hero is, so every clip is made to happen on the spot before it is used: the hips stay over one place, a body in the air is brought down to stand on the ground, and a body or hand pushed into the ground is lifted out. `tools/prepare-rigged.py` does this, and `tests/hero-files.test.ts` checks the result.
Supersedes: none

## 2026-11-10 Yaarbro is built from Meshy's one-clip files, and falls in his jump pose
Reason: Meshy exports one file per clip, each with the whole model in it: walk, run, idle, jump, a dive that ends in a landing, and a run, jump and roll. `tools/prepare-rigged.py` takes the model from one and puts every clip on it, cut to the part the game uses (`tools/yaarbro.guide.json` says which). The dive is head-first, which looks wrong as an ordinary fall, so by the owner's rule for that case falling uses the airborne part of the jump and only the landing is kept from the dive. Only the roll itself is kept from the last file, for milestone three.
Supersedes: none

## 2026-11-10 A character's skin is only changed where a pose test shows it is wrong
Reason: The owner's rule for Yaarbro's cleanup pass: pose-test before changing anything, and fix only what can be seen to be wrong. `tools/pose-test.py` puts a model in the poses that show up bad weighting (arms raised, a wide stride, head up and down, a deep squat). For Yaarbro that showed the belt skewing with the legs and the beard sinking into the chest, and those were reweighted. His armpits, crotch and the head under raised shoulders held up and were left as Meshy made them. His metallic-roughness map already had the leather rough and non-metallic and the buckle metallic and shinier, so no material value was changed. The fixes are written in `tools/yaarbro.guide.json` and done by `tools/prepare-rigged.py`, so they can be rerun on a new export.
Supersedes: none

## 2026-11-11 Caputo moves like a cat, and the owner judges that on a preview page before it merges
Reason: The owner's rule, with what a cat does written out: a four-beat walk (left hind, left front, right hind, right front) in which each hind paw lands where the front paw on its side just was, shoulder blades that rise in turn, a level head, a bounding gallop with one moment off the ground, an idle that is never still, a jump from a crouch, a fall with the legs down and spread, a landing on the front paws first, and a tail that lags. Stylized and easy to read for a young player, not realistic detail. `tools/rig-quadruped.py` writes the clips, and `tools/preview/build.mjs` builds the page the owner reviews, with slow side views of the walk and run. If a script cannot make the walk read as a cat, the owner brings in an animator and no more script rounds are made.
Supersedes: none

## 2026-11-11 A jump's crouch plays as he leaves the ground, and does not delay the jump
Reason: The rules lift a hero the moment Jump is pressed, and changing that would change how the game plays. So a jump clip that opens with a crouch and push plays that part in a tenth of a second as the hero takes off (`pushOff` in `src/view/hero-model.ts`), and the rest follows his upward speed as before. A crouch that can be watched needs a pause before take-off, which is the owner's call.
Supersedes: none

## 2026-11-11 Caputo has three gaits: walk, trot and run, and run is a rotary gallop
Reason: The owner's rule. Walk at low speed, a trot in the middle (diagonal pairs, back level, head steady, tail up), and at top speed a gallop in which each paw lands by itself in a rolling order: left hind, right hind, right front, left front. The clips are named walk, trot and run, so run means the same thing for both heroes and trot is Caputo's only extra clip. The jump stays as it is, with no pause before take-off: jumping the instant the button is pressed matters more for the kids than a crouch that can be seen. If a script cannot make the run read as four separate footfalls, the owner brings in an animator and no more script rounds are made.
Supersedes: none

## 2026-11-11 A hero with three gaits is in one at a time, chosen by pace, and all three share one clock
Reason: A four-legged hero's gaits put the paws down in different orders, so a steady mix of two would shuffle and slide. Caputo walks up to 0.34 of top speed, trots up to 0.68 and gallops above, and changes back at 0.63 and 0.30, so a pace held near a change does not flick between gaits. The change is a fade of about a tenth of a second. The rig script times the three clips so each paw is as near as it can be to the same point of its step at the same share of each clip, and the game plays them all on one clock, so a change of gait carries on in mid stride. Yaarbro, with two gaits, still mixes walk and run by pace.
Supersedes: none

## 2026-11-11 Milestone three comes in two parts, and part one is the longer route alone
Reason: The owner's call after the first playtest: the kids loved it and want more to play. Part one makes the grove a full level with what the heroes can already do (walk, jump, mushroom bounce). Enemies, hearts, the roll and the pounce are part two, in a later session.
Supersedes: none

## 2026-11-11 The longer grove is six sections, each built around one idea and ending on a mossy bank
Reason: The owner approved the route plan: The Broken Logs, The Stump Steps, The Ravine, The Mushroom Springs, The High Boughs, The Climb. A perfect run on Normal takes about a minute. Every piece comes from the Caputo Mountain forest (logs with breaks, mossy banks, mushroom springs, root shelves, a ravine, high boughs, a climb that starts with a spring, the golden leaf), apart from plain scenery (stumps, tall snags, the great cedar). Nothing moves, because the forest has no moving platform. The clearing after the stumps, the air beside the high boughs and the bank at the foot of the climb are kept clear for an enemy each in part two.
Supersedes: none

## 2026-11-11 Which banks are checkpoints is a list per difficulty
Reason: The owner's rule: on Easy and Normal a fall returns the hero to the last bank; on Hard a fall never costs more than about 30 seconds of a perfect run. `checkpoints` in the level's `difficulty.ts` lists the safe banks, and `tests/sections.test.ts` measures the cost of a fall with the bot.
Supersedes: "A fall returns the hero to the last safe mossy bank. No hearts yet.", for the line that only the first bank is safe on Hard. The rest of that entry stands.

## 2026-11-11 The level opens with a short hop before its first real jump
Reason: The playtest: the first set of jumps was hard for the kids to figure out. The first break in the logs is short on every difficulty (`firstLogGap`), and the breaks after it are the real jumps.
Supersedes: none

## 2026-11-11 Scenery is built in stretches of route, and only the stretches near the hero are drawn
Reason: The owner's rule for the longer level: draw only what is near enough to matter, and hold the frame-rate targets. Mist hides everything past 165 m, so stretches beyond it, or behind the camera, are left out, and deep in the mist trees wear lighter crowns. `src/view/route.ts` holds the distances and the rule, with tests.
Supersedes: none

## 2026-11-11 The browser checks on GitHub run inside Playwright's container image, pinned to the version in package.json
Reason: The owner's call. The jobs used to install the test browser and its system packages from Ubuntu's servers on every run, and four runs in a row failed before any test because GitHub's machines could not reach those servers. The container image already holds the browsers and packages. `scripts/check-playwright-image.mjs` fails the checks if the image is not for the Playwright version `package.json` installs.
Supersedes: none

## 2026-11-11 The far limit for drawing is 140 m ahead of the hero, and full detail stops at 85 m
Reason: With all six sections built, the first limits (the far end of the mist, and 100 m for detail) drew up to 417 thousand triangles a frame against 322 thousand for the short level. At 152 m from the camera the mist hides nineteen twentieths of anything, and at 97 m it hides a third, so those are the new limits. The triangle count is back within 17% of the short level.
Supersedes: the distances in "Scenery is built in stretches of route, and only the stretches near the hero are drawn". The rest of that entry stands.

## 2026-11-11 Real-device testing is on the owner's Mac in Safari, and nothing waits on an iPad number
Reason: The owner's note: he has no iPad to test on right now. The iPad frame-rate target (a steady 30 or better) and the touch controls stay as they are, and the browser checks still cover touch at iPad size in Chromium and WebKit. Work no longer waits for a frame rate measured on an iPad.
Supersedes: none

## 2026-11-11 Enemy models are made by Claude through Meshy's API, and the owner picks from candidates
Reason: The owner's instruction for milestone three, part two. `tools/meshy-image-to-3d.mjs` runs Image to 3D on the clearest Caputo Mountain art, three candidates for each enemy, and `tools/preview/candidates.mjs` builds a private page that shows them in the game's light for the owner to pick from. The Meshy key is a network secret on the cloud environment: it is never printed, stored or committed. No more than 300 credits are spent without asking him. Meshy's rigging is not used, because it only handles humanoids. If the art converts poorly, he is asked for a different reference picture.
Supersedes: "Enemy models are made the same way as the hero models" in "Milestone three makes the grove a full level", for who runs Meshy. The rest of that entry stands.

## 2026-11-11 Part two keeps the difficulty numbers, and the diagonal-jump sections get no enemies
Reason: The owner's playtest of the longer grove: the kids found it fun and the right difficulty, and fell most on the diagonal jumps. Those sections stay as they are. On his Mac in Safari the level ran at 60 frames a second on the high tier, with 121 draw calls and 226 thousand triangles at the end of the level.
Supersedes: none

## 2026-11-11 The owner picked marmot B and mosquito C, and enemy models are kept compressed in assets/enemies/
Reason: His pick from the six candidates. The compressed files (about 1 MB each) are committed in `assets/enemies/` and the build copies them as it does the heroes; the originals from Meshy go on the `hero-models` release with the heroes' originals. They are made from the Caputo Mountain art, so like the hero models they are all rights reserved, and CREDITS.md says so.
Supersedes: none

## 2026-11-11 Each enemy has one clip for each thing it does in the 2D forest, and the mosquito has its own rig script
Reason: The owner's instruction: clips come from the behaviour in the 2D game. Its enemies are concealed, idle, warning, attacking, resting or defeated, and the marmot also dodges and takes two hits. So the marmot scout has idle, walk, warning, throw, winded, hit, hop and defeated, written in `tools/rig-quadruped.py` as its own set beside the cat's. The giant mosquito has hover, warning, dive, winded and defeated, from `tools/rig-insect.py`: body, head, abdomen, legs and wings, with the wings beating fast and the legs hanging loose. Meshy's wings are solid colour, so the script gives them a see-through material and repaints them pale. Every clip happens on the spot, as the heroes' do. Both go on a preview page for the owner's OK before they merge.
Supersedes: none

## 2026-11-11 Hearts follow Caputo Mountain: 5, 3 and 2, a fall costs none, and running out returns the hero to the last safe bank
Reason: The owner's instruction for part two. Something that hurts takes one heart, throws the hero away from it, takes the controls for a moment and then protects the hero for a while (1.3 seconds, times 1.5 on Easy and 0.6 on Hard). A fall costs no heart. Losing the last heart returns the hero to the last safe bank with every heart again, protected for a moment. That is the same bank a fall returns to, so on Hard the cost stays under about 30 seconds of a perfect run. Hearts and the protection number are in the level's `difficulty.ts`. Hearts show on screen under the level's name, and the end card counts hearts lost.
Supersedes: the "No hearts yet" part of "A fall returns the hero to the last safe mossy bank. No hearts yet."

## 2026-11-11 Yaarbro's roll tops out at one and a half times walking speed, not the 2D game's two and a half
Reason: The owner's call. Everything else about the roll follows Caputo Mountain: held on the move button, slower to build than a walk, kept up with the stick let go, and a strike only once it is faster than a walk. The top speed is a deliberate change, because footing is narrower in 3D than on the 2D game's ground: at two and a half times walking speed a roll leaves a log or a bough before a player can steer it. The number is `rollSpeed` in `src/game/hero.ts`.
Supersedes: none

## 2026-11-11 How far a hit throws a hero is a number for each difficulty
Reason: The owner's call. Caputo Mountain throws a hero about 2 metres. On a narrow bough that turns one mistake into two: the heart, then a fall. So `knockback` in the level's `difficulty.ts` is 0.5 metres on Easy (a hit on a bough rarely means a fall too), 1.2 on Normal and Caputo Mountain's 2 on Hard. The throw carries until the hero lands, so it clears whatever did the hurting.
Supersedes: none

## 2026-11-11 Landing on an enemy strikes it on every difficulty, and Hard's enemy numbers wait for the playtest
Reason: The owner's calls. Landing on top of an enemy strikes it, as in Caputo Mountain, for both heroes and on Easy, Normal and Hard. A perfect run that never stops gets past every enemy untouched even on Hard; whether Hard makes the older player work for it is for the kids to show, and the three Hard numbers (`enemyWarning`, `enemySpeed`, `enemyRest`) stay at Caputo Mountain's until then.
Supersedes: none

## 2026-11-12 The milestone-three playtest: every difficulty number stays, and Hard is right
Reason: The owner's playtest. Hard is properly hard and the older player loved it: super fun, and the right difficulty. So no difficulty number changes, and Hard's three enemy numbers (`enemyWarning`, `enemySpeed`, `enemyRest`) are settled at Caputo Mountain's. On his Mac in Safari, on Normal with the scout on screen, the game ran at 120 frames a second on the high tier, with 310 draw calls and 407 thousand triangles.
Supersedes: "Hard's enemy numbers wait for the playtest" in "Landing on an enemy strikes it on every difficulty, and Hard's enemy numbers wait for the playtest". The rest of that entry stands.

## 2026-11-12 Enemies show where they will throw or attack on every difficulty
Reason: The owner's playtest: the tells make the enemies fair to dodge. The line that shows where an attack will go stays on Easy, Normal and Hard.
Supersedes: none

## 2026-11-12 Only the newest commit on main is ever published
Reason: The owner's instruction, after a GitHub outage left an old publish run stuck in the queue. The publish workflow compares its own commit with the head of main, before the build and again just before the files go up, and finishes without publishing if they differ. A run started again later, or one that waited while newer work merged, can no longer put an older version on the live site. A run from before this change still carries the old workflow file, so the guard does not cover it.
Supersedes: none

## 2026-11-12 Sounds are recordings; a sound is made in code only where it holds up beside one
Reason: The owner's call after the first sound board: the sounds made in code sounded like beeps next to the recorded ones. Jump, landing, mushroom bounce, the hero hit and the golden leaf tune are CC0 recordings, and so is every other sound a fitting CC0 recording could be found for. Only the giant mosquito's three sounds are still made in code, because no usable recording was found; the owner judges them on the board. A changed set of sounds goes back on the sound board for his OK before it is wired into the game.
Supersedes: none

## 2026-11-12 The owner approved the sounds, and both mushroom sounds are boings
Reason: His verdict on the second sound board: the mosquito's made sounds are perfect; the jump, the marmot scout's warning, the golden leaf tune, the music and everything else are OK; and the mushroom bounce and the mushroom footstep should be boings, not springs. Both now come from the "Boing" recording by Aeva (CC0) that was a choice on the board: the bounce is its first 0.7 seconds, and the footstep is its first moment played higher and shorter. He said to wire the sounds in.
Supersedes: none

## 2026-11-12 Sound starts on the first tap or key press, and mute is a button, the M key, and remembered
Reason: The owner's rules for sound in the game. Browsers block sound until the player does something, so the game asks for none before the first tap or key press, and wakes the sound again on every later one (Safari puts it to sleep). A Sound button sits beside Pause on every screen and the M key does the same; the choice is kept in the browser with the hero and difficulty. Sounds that tell the player something (an enemy's warning, a hit, a checkpoint, a fall) are the loudest and the music dips under them; what the hero does sits under those, footsteps under that, music under everything; every short sound is brought to one loudness when it loads, and one limiter holds down whatever piles up. Enemy sounds fade with distance and are heard out to 48 metres, well past the edge of the screen. The grove music plays from the first tap, on the start screen too, and makes way for the golden leaf tune.
Supersedes: none

## 2026-11-12 The mix is quiet and soft: about -23 LUFS in normal play, music at least 10 decibels under the effects
Reason: The owner's verdict after playing with the kids: everything was far too loud, the music most of all, and the sounds were harsh and overstated. His rules: normal play (footsteps, jumps and music together) aims for about -23 LUFS; the music bed sits at least 10 decibels under the effects; a soft limiter on the master lets nothing peak; the top end above about 6,000 hertz is turned down; every sound starts softly; footsteps and menu clicks sit well in the background; warnings, hits and checkpoints stay the clearest but are not loud. How loud each group is (music, warnings and hits, jumps and landings, footsteps, menu) and the master are six numbers, `MIX` in `src/audio/sounds.ts`, which he sets by ear on a mixer page. `tools/preview/mix-measure.mjs` measures the result.
Supersedes: the loudness order in "Sound starts on the first tap or key press, and mute is a button, the M key, and remembered" only where it said cues are "the loudest". The rest of that entry stands.

## 2026-11-12 A landing sounds like the surface, and a jump is a quiet push-off
Reason: The owner's call: the jump and landing recordings sounded clanky. A landing is now two soft footsteps of what the hero lands on (moss or wood), a moment apart, with a low soft thump made in code under them. A jump is one quiet footstep of what the hero leaves. Neither has a recording of its own any more.
Supersedes: the jump and landing recordings in "Sounds are recordings; a sound is made in code only where it holds up beside one". The rest of that entry stands.

## 2026-11-12 The mix is the owner's six numbers, set by ear
Reason: His settings from the mixer page: master -12, music -14, warnings and hits -17, jumps and landings -22, footsteps -9, menu -12, in decibels. They are `MIX` in `src/audio/sounds.ts`. Measured, normal play comes out at about -34.4 LUFS with the music 5.9 decibels under the effects and no peak over -11.7 dB: quieter than the -23 LUFS he first aimed for, and with less than 10 decibels between music and effects. His ears outrank the numbers. Warnings and hits now sit 8 decibels under footsteps as groups; he was told, and the levels stand unless he changes them.
Supersedes: the two numbers (-23 LUFS, music at least 10 decibels under the effects) in "The mix is quiet and soft: about -23 LUFS in normal play, music at least 10 decibels under the effects". The rest of that entry stands.

## 2026-11-12 The owner's second set of mix levels
Reason: After the first set he sent a second from the mixer page, before anything merged: master -8, music -21, warnings and hits -15, jumps and landings -26, footsteps -24, menu -12. Warnings and hits are again the clearest group, 9 decibels over footsteps and 11 over jumps and landings. Measured, normal play is about -41.6 LUFS, the music sits 4.2 decibels under the effects, and no peak is over -19.2 dB. These are the numbers in `MIX`.
Supersedes: the six numbers and the measurements in "The mix is the owner's six numbers, set by ear", and its note that warnings sat under footsteps. The rest of that entry stands.

## 2026-11-12 Menu clicks sit under the warnings: menu is -20
Reason: The owner's call, on being told that at -12 menu clicks were the loudest group, 3 decibels over warnings and hits. Menu is now -20, 5 under them. The other five numbers are unchanged, and menu clicks are not in the sample run, so the measurements stand.
Supersedes: the menu number in "The owner's second set of mix levels". The rest of that entry stands.

## 2026-11-13 Milestone five: best times, a ghost to race, saved progress and a level picker
Reason: The owner's call. It gives the kids reasons to replay the grove and makes adding a level a repeatable recipe, so more levels can follow quickly. Five pull requests in this order: levels as a recipe, profiles and saved progress, the level picker, best times, the ghost.
Supersedes: "No saved progress" and "more levels" as out of scope in "Milestone one is one small playable area, then stop".

## 2026-11-13 Player profiles: a "Who's playing?" screen, up to four players, each with a typed name and a colour
Reason: The owner's decision. The screen comes before the start screen. Names and progress stay in the browser's storage on that device. Nothing about players goes into the repo, a commit, a log or any network request.
Supersedes: "The only thing kept is the hero and difficulty a device last chose" in "No database, no accounts, no online services", and "the game holds nothing personal" in "No login. The link is public and the game holds nothing personal.", for what the browser on a device keeps. The rest of both stands: no database, no accounts, no online services, and nothing personal in the repo or on the network.

## 2026-11-13 Every area is open from the start
Reason: The owner's decision. Finished areas are marked per difficulty. Nothing is locked.
Supersedes: none

## 2026-11-13 The ghost is on by default on Normal and Hard and off on Easy, with a toggle on the level card
Reason: The owner's decision.
Supersedes: none

## 2026-11-13 The game builds its level from a level list, and a level is a folder plus one line in that list
Reason: The owner's instruction for milestone five. `src/levels/index.ts` lists every level; each brings its own layout, difficulty numbers, scenery and music through its `level.ts`. The rule tests and the bot run over every level in the list. A tiny development level, the Sandbox, proves the recipe: it is marked `devOnly`, is never shown to players and opens only with `?level=sandbox`. `docs/adding-a-level.md` has the steps.
Supersedes: none

## 2026-11-13 A player is a name of up to twelve characters and one of six colours, and a grown-up can also remove one
Reason: Claude's calls within the owner's decision on profiles. Twelve characters fit the tiles on an iPad. With four places on a device, a mistyped name or a visiting friend would otherwise use one up for good, so "For grown-ups" has "Remove player" beside "Reset progress", each behind a question whose safe answer is the big button. Each player keeps their own last hero and difficulty. Everything is one entry in the browser's storage (`yaarbroverse-3d:players`), and saved data that is missing or damaged is dropped piece by piece while the game carries on.
Supersedes: none

## 2026-11-13 The level picker is a row of cards on the start screen, and a card's best time is the better of the two heroes
Reason: Claude's calls within the owner's instruction for the picker, shown to him on a preview page before merging. The start screen is headed "Where to?"; each area is a card with a picture, its name and line, and for the current player a tick and best time on each finished difficulty, or "Not yet". One time per difficulty keeps a card readable; each hero's own best time and fewest falls go on the end card. A development level is a card only when the address names it.
Supersedes: none

## 2026-11-13 The owner said OK to the new screens, and the level picker merged
Reason: His OK on the preview page (https://claude.ai/artifact/PKoes4buicSvLc9n4WYmWx ) for "Who's playing?", the level picker and the level card, as shown.
Supersedes: none

## 2026-11-13 Best time and fewest falls are kept separately, and matching a best is not beating it
Reason: The owner's instruction for best times: for each player, level, hero and difficulty, the best time and the fewest falls, each from whichever run set it, and only from runs that reached the golden leaf. The end card shows both under the run's own numbers and marks a new one in gold. A first finish is marked as new on both.
Supersedes: none

## 2026-11-13 The ghost is the recording of the best time, drawn only, and kept apart from the progress
Reason: The owner's instruction for the ghost: the player's best run for that level, hero and difficulty, replayed as a see-through copy of the hero they ran with; visual only, never blocking, hitting, triggering anything or making sound; starting when the player starts and stopping at the leaf; small enough that a few dozen fit in browser storage. Claude's calls within it: "best" means best time; the ghost runs on the game's clock, so it waits while the game is paused; it fades out where it stands on the player's own hero; a recording is eight bytes a sample at 15 samples a second and never more than 1,200 samples, halving its rate each time it fills; and each ghost is its own storage entry, so a damaged or over-large ghost never costs the progress. The rules are never handed a ghost, which is what makes it unable to touch anything.
Supersedes: none

## 2026-11-13 Canon comes from the Caputo Mountain docs and from the owner's prompts
Reason: The owner's rule. Anything the owner states in a prompt is canon, the same as what the Caputo Mountain docs and art say. Everything else still is not: if something is needed that neither says, ask him.
Supersedes: "Nothing new is canon" in "World, characters and tone come from Caputo Mountain. Nothing new is canon.", for what counts as a source. The rest of that entry stands.

## 2026-11-13 From the kids: more levels that are not all jumping, and the lake comes first among them
Reason: The owner's decision, from what the kids asked for. Lakes are central to the Yaarbroverse. Both heroes swim, on the surface and underwater. There is fishing. Lake enemies include monster-sized pike and crocodiles. Caputo can swim; it would be nice, not required, if he shakes the water off when he gets out. The monster pike is fought both on the fishing line and in the water.
Supersedes: none

## 2026-11-13 From the kids: skiing in the Selkirk mountains, where Caputo snowboards
Reason: The owner's decision, from what the kids asked for.
Supersedes: none

## 2026-11-13 From the kids: mountain climbing on rock, ice and trees
Reason: The owner's decision, from what the kids asked for.
Supersedes: none

## 2026-11-13 From the kids: bosses, and the grove's boss is a giant marmot chief with mosquito sidekicks
Reason: The owner's decision, from what the kids asked for. The chief uses the marmot scout's model, much larger and recoloured so it clearly reads as the chief. Nothing else is added to its look (a crown, a scar) unless the owner says so. Its attacks grow from what the scouts already do (throwing, charging), and in a later phase it calls in mosquito sidekicks. Its arena goes at the end of the grove, before the golden leaf. On Easy it can be beaten by jumping on it alone, with sidekicks that are easy to avoid. On Hard it should make the older player work for it.
Supersedes: none

## 2026-11-13 The older player's rule: an enemy that was damaged regains full health when the hero is sent back to a checkpoint
Reason: The owner's decision, from the older player. If the hero is sent back to a checkpoint (by a fall or by running out of hearts) after damaging an enemy, that enemy regains full health. This applies to every enemy and every boss.
Supersedes: "keeping the strikes it has taken" as the rule for an enemy that goes home after a fall (built in milestone three, part two; described in `docs/session-handoff.md`).

## 2026-11-13 From the kids: the marmot scout and the mosquito are too easy, so they get tougher on Normal and Hard
Reason: The owner's decision, from the kids' playtest: the tells make them easy to dodge, and the scout barely moves. Easy stays as it is. On Normal and Hard the marmot scout patrols its area and comes after a hero it spots, and gives up and goes back when the hero leaves its area. Tells stay, so attacks remain fair, but they get shorter: noticeably on Normal, brief on Hard. The mosquito follows the hero along the boughs and dives more often. All new numbers go in the level's `difficulty.ts`. Still no enemies in diagonal-jump sections.
Supersedes: "no difficulty number changes, and Hard's three enemy numbers (`enemyWarning`, `enemySpeed`, `enemyRest`) are settled at Caputo Mountain's" in "The milestone-three playtest: every difficulty number stays, and Hard is right", for the enemies' numbers on Normal and Hard. The route's numbers stay. "Enemies show where they will throw or attack on every difficulty" stands.

## 2026-11-13 From the kids: the grove repeats its jump patterns, and that is fixed in the milestone after this one
Reason: The owner's decision, from the kids' playtest: the vertical-log hops appear three times. Grove variety keeps the best vertical-log section and replaces the other two with different obstacles. It is not part of milestone six.
Supersedes: none

## 2026-11-13 Milestone six is tougher enemies, enemy health, the boss system and the marmot chief; the roadmap after it is set
Reason: The owner's call. Four pull requests in this order: tougher enemies; enemy health and the regen rule (a scout takes one hit on Easy and Normal and two on Hard, the mosquito one on every difficulty, and damage shows with a flash and a small knockback); the boss system (an arena the hero enters, a health bar, phases that change the boss's attacks as it loses health, a tell for every attack, the regen rule, boss music that takes over in the arena, a victory moment, built so any level can end with a boss, proved by a dev-only boss in the sandbox); the marmot chief. He looks at a private preview page before the first and the fourth merge. The roadmap, in order: (1) milestone six; (2) grove variety; (3) the lake: swimming, diving, a lake level and crocodiles; (4) fishing and the monster pike boss; (5) skiing in the Selkirks, with Caputo on a snowboard; (6) mountain climbing on rock, ice and trees.
Supersedes: "The next step is adding a level" as what comes next (`docs/session-handoff.md`, milestone five).

## 2026-11-13 How the tougher enemies work, and their numbers
Reason: Claude's calls within the owner's decision, shown to him on a preview page before merging. On Normal and Hard a scout is never hidden: it walks a beat across its bank (1.6 and 2.2 metres a second), and when a hero comes onto its bank it stands for half a second, then comes after the hero (3.4 and 4.6 metres a second; a hero walks at 6, so running away always works). From between 2.5 and 4.2 metres it stops and throws, with its warning first; nearer than that it keeps coming, and touching it costs a heart. It never leaves its bank. A warning lasts 1.2 seconds on Easy as before, 0.56 on Normal (it was 0.8) and 0.36 on Hard (it was 0.52). The mosquito keeps up with the hero at 5 and 6.5 metres a second (it was 2.1 and 2.7, which a running hero left behind), gets ready and rests for 0.6 and 0.45 of the time, and hovers 3.4 metres over the hero in place of 2.2, so a jump across a gap in the boughs does not carry the hero up into it. After a hero is sent back to a safe bank, no enemy notices it for a second and a half, so nothing reaches the hero before the controls come back. The test bot now jumps on a scout that comes at it: landing on an enemy is walk and jump alone.
Supersedes: none

## 2026-11-13 The line showing where an attack will go is drawn on Easy only
Reason: The owner's call on the tougher-enemies preview. On Normal and Hard the warning is the enemy's own wind-up and its warning sound, with nothing drawn: the marmot scout rears up on its hind legs with the acorn back over its shoulder before it throws, and the giant mosquito tips nose-down along its dive with its legs drawn up and its wings racing. Both wind-ups were already in the models' `warning` clips, stretched to last exactly as long as the warning. The same goes for anything that marks where the mosquito will strike. The switch is `enemyAimLine` in the level's `difficulty.ts`; the rules do not read it, so attacks are aimed and timed the same with and without the line. He also approved, as built: a beaten enemy stays beaten under the regen rule; the mosquito's higher hover on Normal and Hard; and the second and a half in which no enemy notices a hero sent back to a safe bank.
Supersedes: "Enemies show where they will throw or attack on every difficulty", for Normal and Hard. It stands for Easy.
