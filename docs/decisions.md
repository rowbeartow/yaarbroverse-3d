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

## 2026-11-13 Enemy health, how a hit shows, and what the regen rule does to a beaten enemy
Reason: The owner's numbers: a marmot scout takes one hit on Easy and Normal and two on Hard, and the giant mosquito one on every difficulty (`scoutHealth` and `mosquitoHealth` in the grove's `difficulty.ts`). Claude's calls within his instruction: a hit shows as a bright flash that blinks for 0.4 seconds, during which the enemy cannot be hit again, and a shove of 0.76 metres along the hero's path, travelled over a few steps so it is seen; the screen says how many more hits it takes. Under the regen rule an enemy that was damaged but not beaten is at full health again when the hero is sent back to a safe bank, and the screen says so. An enemy that was beaten stays beaten for the run: the rule as the older player gave it is about an enemy the hero damaged, and bringing beaten enemies back would put a scout on top of a hero returning to its own bank.
Supersedes: "Two strikes beat it" for the marmot scout on Easy and Normal (milestone three, part two).

## 2026-11-13 The owner picked the boss music and the "boss beaten" sound
Reason: His picks on the sound board (https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH ) from three music choices and two sounds: boss music A, "Battle Theme" by Wolfgang_, and "boss beaten" B, "Short Jingle" by OO. Both are CC0 recordings from OpenGameArt, credited in `CREDITS.md`. The music is 40 seconds cut from the middle of the track on its own phrases and joined end to start, set to the grove music's loudness; it is `bossMusic` in `src/audio/sounds.ts`, in the music group of the mix. The sound is `bossBeaten`, in the warnings group.
Supersedes: none

## 2026-11-13 How a boss fight works
Reason: Claude's calls within the owner's instruction for the boss system (an arena the hero enters, a health bar, phases that change the attacks, a tell for every attack, the regen rule, boss music, a victory moment, any level able to end with one). The fight begins when the hero stands inside the boss's arena, with a moment of show in which nothing hurts. The boss then goes round on watch, warning, attack, rest; its attacks come in turn from a list that changes with its health, and a change is marked by a roar. The attacks any boss can use are a throw (one acorn, or a fan), a charge (a straight run through where the hero stood) and a call (its sidekicks come out). A hit is a roll faster than a walk, a pounce, or a landing on top, as for any enemy; it staggers the boss, and no second hit counts until the stagger is over. A boss can be `guarded`: then only a hit while it rests counts, a landing on top at other times bounces the hero off unharmed, and the screen says to hit it while it rests. The health bar is the boss's name over one pip for each hit, at the bottom of the screen between the thumbs; the pips glow while a hit would count. The level's goal is out of reach and out of sight until the boss is beaten. Beating it plays the "boss beaten" sound, brings the level's music back, makes the leaf burst into view, sends its sidekicks packing and protects the hero for three seconds. Lines showing where its attacks will go follow the owner's rule for enemies: Easy only.
Supersedes: none

## 2026-11-13 A boss's arena is a checkpoint on every difficulty, and the hero comes back to its doorstep
Reason: Claude's call. Under the regen rule, losing to a boss already costs the whole fight. If the arena were not a checkpoint, on Hard it would also cost the climb before it, well over the 30 seconds of a perfect run that a fall may cost there. So an arena is a safe bank on Easy, Normal and Hard, and a fall or running out of hearts returns the hero to a spot just inside its near edge (`safeAt` on the solid), outside the rectangle that starts the fight. The hero steps in when ready, and the fight starts over.
Supersedes: none

## 2026-11-13 The marmot chief: where it is, how it looks, and its numbers
Reason: Claude's calls within the owner's instruction, shown to him on a preview page before merging. The chief waits on a wide mossy bank (16 by 19 metres, `bank-6`) at the top of the last climb, where the great cedar's bough used to begin; the bough with the golden leaf now reaches out from the bank's far side, so the chief stands between the hero and the leaf. The bank ends section 6, The Climb, and the bough alone is a seventh section, The Marmot Chief. It is the marmot scout's model at 2.3 times the size with a dark colour laid over its fur, and nothing else: no new clips either (its charge is the scout's shuffle played fast, and it lowers itself before a charge with the start of the scout's hop). It takes 4, 6 and 8 hits on Easy, Normal and Hard. It throws; from two thirds of its health it charges too; in its last third it also calls its sidekicks, giant mosquitoes (1, 2 and 2) that fly as the mosquito over the boughs does on that difficulty. On Easy any landing on top counts, it throws one slow acorn, and lines show where its attacks will go. On Normal and Hard only a hit while it rests counts, it throws a fan of 3 and 5 acorns, and nothing is drawn. Every number is `chief` and `chiefSidekicks` in the grove's `difficulty.ts`. The test bot beats it first time on every difficulty as each hero, losing no heart on Easy and Hard and one on Normal.
Supersedes: "the bough with the leaf" as the end of The Climb, and six sections, in "The longer grove is six sections, each built around one idea and ending on a mossy bank". The six sections themselves stand.

## 2026-11-13 In a boss fight the camera pulls back so the whole arena shows
Reason: Claude's call. The camera sits close behind the hero and looks ahead, which is right for a route that runs away from it, and hides anything behind the hero. In a fight the boss is often behind the hero. So while a fight is on, the camera sits 1.6 times further back and 1.7 times higher and follows a point between the hero and the middle of the arena. It looks the same way as ever, so "up" on the stick is still "away".
Supersedes: none. "The camera sits behind and above the hero and always looks the same way" stands.

## 2026-11-13 A mosquito that hovers high climbs back over the hero's head before it warns again
Reason: Claude's call, found in the chief's fight. With the higher hover the owner approved for Normal and Hard, a mosquito that had just rested where it dived could warn again from knee height, a metre from the hero. It now has to be within 1.1 metres of its hover height first. Easy, where it hovers at 2.2 metres, is unchanged. This also applies to the mosquito over the high boughs.
Supersedes: none

## 2026-11-13 A ghost holds up to 2,400 samples
Reason: Claude's call. A run of the grove with the chief's fight is longer than the 80 seconds that 1,200 samples hold at full rate, so every ghost on Normal and Hard would have been kept at half rate. 2,400 samples hold 160 seconds at 15 a second. A ghost is now up to about 26,000 characters, and four dozen of the biggest come to about a megabyte and a quarter, still well inside a browser's storage.
Supersedes: "never more than 1,200 samples" in "The ghost is the recording of the best time, drawn only, and kept apart from the progress". The rest of that entry stands.

## 2026-11-13 The owner approved the marmot chief, and it sounds lower than the scout
Reason: The owner's OK on the preview of the whole fight, and on these calls by name: the chief's bank as a checkpoint on every difficulty, the camera pulling back for the fight, the mosquito climbing back before it warns, the longer ghost, and the words "Hit it while it rests!". His instruction with it: the chief's warnings, throws and hits play lower in pitch than the scout's, so it sounds as big as it looks. Claude's call on how much: 0.7 of the speed, about six notes down (`VOICE.chief` in `src/audio/sounds.ts`). They are the same recordings, so nothing new is downloaded. Its charge and a landing that bounces off it are unchanged.
Supersedes: none

## 2026-11-14 Pieces that move or change are now allowed in the forest
Reason: The owner's word for milestone seven, grove variety. A piece may move or change: a vine to swing from, a log that tips like a seesaw, stumps or moss that sink or crumble, a log that rolls, logs drifting in a stream, a bough that sways in the wind, or others that fit a misty fir forest. Every new piece has a clear tell before it moves, a sound at the current mix levels, and rules the bot and the rule tests cover. On Easy every new piece is crossable without precise timing. Its visible edge matches where a hero can stand, including while it moves.
Supersedes: "Nothing moves, because the forest has no moving platform" in "The longer grove is six sections, each built around one idea and ending on a mossy bank", and the same in "Added as plain scenery, not canon" in `docs/session-handoff.md`. The rest of both stands.

## 2026-11-14 Grove variety: keep the Stump Steps, and sections 4 and 6 become The Tipping Logs and The Windy Climb
Reason: The owner's OK on the plan page (https://claude.ai/artifact/PNCastENb5h534Ns7KRjN4 ). The stumps of section 2, the mushrooms over open air in section 4 and the snags and mushrooms of section 6 all stepped left and right and climbed. Section 2 stays: it is the plainest form of the pattern, it is low and early, and both banks around it are checkpoints on every difficulty, so the diagonal jumps the kids fell on most are learned where a fall is cheap. Sections 4 and 6 keep their opening mushroom spring up to a high log. After it, section 4 is tipping logs across open air up to the high ledge (2, 3 and 4); section 6 is crumbling moss in a straight line (2, 3 and 4), then windy boughs that rise and sink and carry the hero up to the chief's bank (1, 2 and 2). Every number is in the grove's `difficulty.ts`. A perfect run on each difficulty stays within about 10 percent of what it was, the chief's fight is unchanged, there are no enemies in either section, and on Hard no setback costs more than about 30 seconds of a perfect run. Ghosts move to the browser's database, because four players across the roadmap's five levels would outgrow the browser's local storage.
Supersedes: "The Mushroom Springs" and "The Climb" as the names and contents of sections 4 and 6 in "The longer grove is six sections, each built around one idea and ending on a mossy bank". The other sections stand.

## 2026-11-14 The owner picked the sounds of the moving pieces
Reason: His picks on the sound board (https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH ): creak A ("Tree Creaking" by AntumDeluge) for a tipping log's tell and its tipping, rustle B ("20 Rustles of dry leaves" by qubodup) for moss about to crumble, fall A ("75 CC0 breaking / falling / hit sfx" by rubberduck) for moss falling away, and gust B ("wind1" by Luke.RUSTLTD) for the wind before a windy bough moves. All CC0 from OpenGameArt, credited in `CREDITS.md`. The three tells play with the warnings and hits, 3 decibels under the group; the moss falling away plays with the jumps and landings. They fade with distance, as an enemy's sounds do.
Supersedes: none

## 2026-11-14 A solid log to wait on before the windy boughs, and the chief's bank a little to the left
Reason: Claude's calls while building The Windy Climb. The plan put the first windy bough straight after the crumbling moss; a hero who reached the last pad while the bough was up would have had nowhere to stand and would always fall. A short solid log (`wind-perch`, 3 m) now sits between them on every difficulty. The chief's bank moved 0.8 m to the left of the route (`chiefAside` in the grove's `layout.ts`): with the hero now walking in off a bough rather than bouncing in off a mushroom, the test bot's fight on Hard went badly from the middle (three fights, five hearts lost) and well from a little to the right. The chief's numbers, rules and size are unchanged.
Supersedes: none

## 2026-11-14 Ghosts are kept in the browser's database
Reason: The owner asked for the check: if ghosts will not fit, move them to IndexedDB and carry over the ghosts already saved. Worked out: four players across the roadmap's five levels, both heroes and three difficulties are 120 ghosts of up to about 25,700 characters, about 3.1 million characters, which Safari counts as about 6.2 MB, over the roughly 5 MB local storage gives a whole site (and `rowbeartow.github.io` is shared with every GitHub Pages project on the account). Claude's calls within it: the game keeps reading and writing ghosts without waiting, through a store that holds a copy in memory and writes to the database behind the scenes (`src/save/ghost-store.ts`); ghosts in local storage are moved on first opening and removed only once the database holds them, and a ghost already in the database wins; with no database, it falls back to local storage as before. Players and bests stay in local storage.
Supersedes: "each ghost is its own storage entry" in "The ghost is the recording of the best time, drawn only, and kept apart from the progress", for where the entry lives. Each ghost is still its own entry, kept apart from the progress.

## 2026-11-14 Milestone eight, part one: swimming, in five pull requests
Reason: The owner's call. In order: the test bot's boss fights made to work from any reasonable way in; swimming rules any level can use, proved in a sandbox pool; how water looks; swimming sounds (on the sound board for his OK before they go in); and the heroes' swimming clips (on a preview page for his OK). Part two (the lake level, its scenery and music, and crocodiles) is a later session.
Supersedes: none

## 2026-11-14 Both heroes swim, on the surface and underwater, and deep water is never a fall
Reason: The owner's decision. A hero in deep water swims. The controls stay the same: move to swim, Jump to swim up or to climb out at an edge, and the move button (X, Shift, or the round touch button) dives.
Supersedes: none

## 2026-11-14 Underwater there is a breath meter; on Easy breath never runs out
Reason: The owner's decision. On Normal and Hard breath refills at the surface, and running out sends the hero back to the last checkpoint, the same as losing all hearts.
Supersedes: none

## 2026-11-14 Caputo shakes the water off when he climbs out, if it looks good
Reason: The owner's word: a nice touch, not a requirement.
Supersedes: none

## 2026-11-14 Backup branches while checks run
Reason: The owner's standing permission, also in `CLAUDE.md`: while one pull request's checks run, Claude may push the next one's work to a backup branch named `claude/backup-<topic>`, so no work exists only on the session's machine. Each report says which backup branches can be deleted.
Supersedes: none

## 2026-11-14 The test bot looks ahead in a boss fight, and the chief's bank is back on the route's line
Reason: The owner's instruction: the chief fight must succeed from any reasonable way in, not one tuned spot. Claude's calls: before it acts in a fight, the bot plays its own plan forward on a copy of the game for 1.8 seconds (the rules have no chance in them, so the copy plays out exactly); if the plan gets it hurt or off the bank, it tries standing still and each of eight ways, walking or jumping, for a quarter of a second followed by the plan again, and takes the safest. It also keeps a hit's throw and a step from the arena's edge. `tests/boss-entry.test.ts` has it walk into every boss's arena from seven places across the near side, standing or already running, on every difficulty as each hero: it wins every first fight, and in the grove loses no heart in any of the 84. The bot plays with walk and jump alone, as before. With the bot no longer fragile, the chief's bank sits on the route's line again; the chief's numbers and rules are unchanged.
Supersedes: "the chief's bank 0.8 m to the left of the route (`chiefAside` ...)" in "A solid log to wait on before the windy boughs, and the chief's bank a little to the left". The solid log stands.

## 2026-11-14 How swimming works, and its numbers
Reason: Claude's calls within the owner's decision that both heroes swim. Water is a pool any level can have: a box seen from above with a surface and a floor (`src/game/swim.ts`). A swimmer floats with head and shoulders out, swims at 3.6 metres a second at the surface and 4.2 underwater (walking is 6), dives at 3.4 with the move button held, swims up at 3.8 with Jump held, and with neither drifts up at 1.1, so letting go always brings a hero back to the air. A jump or drop into water plunges deeper the higher it came from, and then floats up. The sides of a pool hold a swimmer in, so the way out is always a climb: Jump at the surface, pressed or held, beside something whose top is within 1.35 metres of the water, climbs out in 0.45 seconds with the controls taken; a top no more than 0.35 metres above the water is a shore that is swum straight out onto. The roll and the pounce do nothing in water. A hero whose head is underwater cannot be hurt by anything (acorns and dives stop at the surface); at the surface a swimmer can be. A hit in the water pushes the swimmer along the surface rather than up out of it. Breath fills again at the surface eight times as fast as it runs down. Running out of breath is a moment down, as when the last heart goes, then the hero is back on the last checkpoint with every heart and the regen rule applied; it counts as neither a fall nor hearts lost. The Sandbox's pool has a rock arch across it that can only be passed underwater; breath there is 14 seconds on Normal and 9 on Hard, and the dive under the arch takes about 3.
Supersedes: none

## 2026-11-14 How water looks
Reason: Claude's calls within the owner's brief (water you can see into, a surface with gentle waves; underwater a colour shift, fog and light from above; splashes). Each pool is a see-through, glossy surface (about 60 percent opaque) moved by three small waves, at most about 7 cm high, over a rock basin with a floor and four sides. Light from above ripples over the basin below the surface, fading with depth, and the deeper rock takes on the water's blue-green. When a swimmer's head goes under, the camera eases in close behind it (4.6 m back, against the grove's 12) and just under the surface; while the camera is under, the fog closes in to about 24 metres and turns blue-green, and soft shafts of light come down from the surface. A hero going in throws up droplets and one or two spreading rings, more for a higher drop; a swimmer at the surface leaves rings behind; one underwater lets out bubbles that rise to the surface; one climbing out drips. All of it is drawn from the rules' own numbers and changes nothing in them (`src/view/water.ts`). The Sandbox's rock arch is drawn as a slab of rock with a mossy top (a new kind of solid, `arch`, which sounds like moss underfoot).
Supersedes: none

## 2026-11-14 The owner picked the swimming sounds
Reason: His picks on the sound board (https://claude.ai/artifact/WvtY9CjWaa5yTpwyJCferH ): going in A, stroke B, surfacing A, all from "40 CC0 water / splash / slime SFX" by rubberduck (CC0, OpenGameArt), credited in `CREDITS.md`. Claude's calls: going in plays with the jumps and landings, from 0.45 of full for a step in to full for a drop of about 2.5 m or more; a stroke plays with the footsteps once every 1.4 m swum at the surface (0.9 m for Caputo, in his lighter voice) and never underwater; surfacing plays with the jumps and landings, 4 decibels under. Underwater the whole mix passes a low-pass at 700 hertz and drops 3 decibels, as in the demo on the board, and clears at the surface (`MUFFLE` in `src/audio/graph.ts`). The owner did not comment on the muffle; it went in as demonstrated. Running out of breath plays the out-of-hearts sound.
Supersedes: none

## 2026-11-14 The owner approved the swimming clips, and the ghost swims too
Reason: The owner said the swimming preview (https://claude.ai/artifact/Hona3BPm8mPnDy8JoWaxbw ) "looks great", and asked that a ghost swim with the same clips rather than show the jumping pose in water.
Supersedes: none

## 2026-11-14 How the heroes' swimming clips were made, and how they are kept
Reason: Claude's calls within the owner's instruction, approved by him on the swimming preview. Yaarbro: a copy of his model rigged with Meshy's Rigging API (Meshy's default skeleton, the same bones his other files have), then "Swim Idle" for treading water, "Swim Forward" for the surface swim and the end of "Swimming to Edge" for climbing out, all from Meshy's animation library, and an underwater breaststroke made with Text to Motion because the library has none. 27 credits. The new rig stands a little differently from his current model (up to 17 degrees at a foot, and taller), so `tools/prepare-rigged.py` carries each clip onto his model bone by bone: each bone's turn away from its own rest pose, measured in the world, applied to his; the hips' movement scaled by how much taller his hips stand. His belt and beard cleanup is unchanged. The four Meshy files are kept in `tools/yaarbro-swim-clips/` as the skeleton and clip only, with the model swapped for one small triangle (about 100 KB each, no art), so he can be rebuilt without Meshy; rebuilt from them, every clip matches to under a tenth of a degree. Caputo's dog-paddle, underwater swim and shake-off are written in `tools/rig-quadruped.py` like his other clips; the shake plays once after climbing out and is cut short by running. Each clip is raised or lowered in the water by an amount measured in Blender (`swim` in `src/view/hero-model.ts`): Yaarbro treads with the water at his shoulders and crawls with his back at the surface; Caputo paddles with his back at the surface and his head out; both sit a little lower underwater so they stay under an arch's underside. Underwater the body tips a little along its way up or down. A ghost records swimming, underwater and climbing out in three spare bits of each sample, so ghosts saved before still load.
Supersedes: none

## 2026-11-14 The game tells players how to dive
Reason: The owner's word after playing the Sandbox pool: diving worked, but they did not know it was X or Shift. The first time in a run that a hero goes into the water, the screen says "Press X to dive" (his words) on a keyboard; on touch it says "Tap the round button to dive" and the round button pulses for four seconds. It says so again whenever a swimmer sits at the surface for three seconds by a passage that can only be passed underwater (a solid reaching down into the water with room under it), once for each such wait. Claude's calls within it: while a hero is in the water the round touch button shows a dive mark (an arrow going down into waves) and the word "Dive", since there it dives; the pulse is a steady glow for anyone who has asked their device for less motion; the Sandbox's own hint no longer says "move button".
Supersedes: none

## 2026-11-14 The way under an arch shows from above
Reason: The owner's word: make the gap under the arch visible from above, with a dark opening at the waterline and light showing through underneath. Claude's calls within it: each face of an arch over water has a dark half-oval opening from the waterline up (about four fifths of the arch's width, at most 0.6 m tall), with a pale sliver low in it, daylight from the far end; a pale lane of light lies on the water in front of each opening, about 3 m long. A first try with the light under the surface did not show through the water from the game's camera. All of it is drawn by `arch` in `src/view/scenery.ts` from the arch and the pool's own numbers, so any level's arch over water gets it.
Supersedes: none

## 2026-11-14 The controls show on the level card and the pause screen
Reason: The owner's word: show the controls (move, jump, roll or pounce, dive) on the level card before a run starts, and on the pause screen, for both keyboard and touch. Claude's calls within it: each device shows its own set (keys at a keyboard, where to touch on a touch screen), with the picked hero's own move by name, as a list of what to press in a key-like badge beside what it does; the keyboard set adds Esc to pause and M for sound. Only the picked card shows its controls, below the ghost switch, in two columns on a wide screen so the start screen stays short. The one-line controls note under Play is gone, since the card now says it. The owner said OK on the preview page (https://claude.ai/artifact/5f6MKjojBtx6VjedwqCPhF ).
Supersedes: none

## 2026-11-14 The Chromium checks job gets 45 minutes
Reason: Claude's call. On pull request 52 every browser check passed (145 in 27 minutes), but with the rule tests and the build before them the job ran past its 30-minute limit and GitHub cancelled it. Milestone eight added browser checks, so the limit is now 45 minutes (`.github/workflows/checks.yml`). A run that hangs is still stopped. The WebKit job, at about 20 minutes, keeps its 30.
Supersedes: none

## 2026-11-14 Milestone eight, part two: the lake level, Cocolalla
Reason: The owner's call. The lake is Cocolalla (the Caputo Mountain docs' first playable area is Cocolalla Lake). In order: faster checks; a route plan for his OK; crocodile model candidates through Meshy for his pick (at most 150 credits without asking); the level in pull requests of one or two sections, with lake scenery (shores, reeds, rocks, the dock, the Selkirk mountains across the water), its own CC0 music and lake sounds (lapping water, a distant loon) on the sound board for his OK first, and the crocodile stretches left empty; then the lake on the level picker. Rigging, animating and placing the crocodiles is a later session. The Mac must hold 60 fps on the high tier across the whole lake. He reported 60 fps in Safari on his Mac in the Sandbox pool, on the normal tier.
Supersedes: none

## 2026-11-14 Crocodiles are water enemies, and reach a swimmer underwater
Reason: The owner's decision. Crocodiles can reach a hero at the surface and underwater; that is what makes them a threat. Land enemies still cannot reach a swimmer underwater. On Easy every crocodile can be avoided without diving or precise timing. Each hero's move must beat or get past a crocodile. The regen rule applies.
Supersedes: "nothing reaches a hero whose head is underwater" in "How swimming works, and its numbers", for crocodiles only. It stands for every land enemy.

## 2026-11-14 The lake level ends at a fishing dock
Reason: The owner's decision. The monster pike fight goes there in milestone nine; until then the level ends at the dock with the usual finish.
Supersedes: none

## 2026-11-14 The browser checks run in parallel shards on GitHub
Reason: The owner asked for a pull request's checks to finish in about ten minutes, keeping every check, with each job's time limit back at 30 minutes. Claude's calls: the rule tests and the build run in one job, and the built game is handed to the browser jobs so it is built once; Chromium's checks run in six shards and WebKit's in four, side by side, each shard one check at a time as before (the machines have no graphics card); checks are split one by one rather than by file (`fullyParallel`), so the shards come out even. Two summary jobs keep the names branch protection requires ("Tests, build and browser checks" and "Browser checks in WebKit (iPad)"), and fail if any job they stand for did not pass.
Supersedes: "The Chromium checks job gets 45 minutes" (its time limit is 30 again).

## 2026-11-15 The lake's route plan
Reason: The owner said OK to the route plan page (https://claude.ai/artifact/WzVaTX3yBGtw8qswMdqTY5 ). Six sections from a pebble beach to the fishing dock: The Shore Path (boulder hops to a grassy point), The Reed Shallows (a swim to a rock island, a crocodile stretch), The Sunken Logs (logs and boulders to a gravel bar too high to climb onto from the water), The Rock Tunnel (a rocky point right across the lake, passed only by diving under its middle), Cattail Cove (a long swim to the old pier, the second crocodile stretch) and The Old Pier (posts up to the boardwalk and the dock, the golden leaf at its end). About a minute on Normal. Claude's calls within it: the lake is three pools the full width of the lake, parted by the gravel bar and the reed bar, so a missed jump anywhere lands in the water and is never a fall; Easy keeps breath that never runs out; the tunnel is 4, 6 and 9 m long on Easy, Normal and Hard. Every number is in `src/levels/cocolalla/difficulty.ts`. The level id is `cocolalla`.
Supersedes: none

## 2026-11-15 The crocodile is candidate C
Reason: The owner's pick on the candidates page (https://claude.ai/artifact/FMAkkG9cFaoNmu7hbGA5Jk ): C, the big crocodile with the broad head, bold stripes and green eyes. Made with Meshy's Text to Image and then Image to 3D (`tools/meshy-text-to-3d.mjs`, words in `tools/crocodile.candidates.json`), 117 credits for all three. Its tail is curled to one side in the model and is to be straightened when it is rigged. Rigging, animating and placing it is a later session.
Supersedes: none

## 2026-11-15 How Cocolalla Lake looks
Reason: The owner asked for shores, reeds, rocks, the dock and the Selkirk mountains across the water. Claude's calls within it: a new kind of surroundings, `lake` (`src/view/lake.ts`), laid out from the level's pools; a wooded shore with pines, rocks and reeds along the left, which bends away past the dock; a log boom along the right, where the swimming stops, since a pool's side holds a swimmer in; open water with the pools' own look all round, over one lake bed with light rippling on it, so the pools draw no rock basins; a clearer haze than the forest's mist (it begins at 70 m and closes in at 230 m); the Selkirks as a dark wooded band with snow on the high tops, drawn round the camera like the sky. Boulders, the rocky point's crags and the pier's boards are new kinds of solid (`boulder`, `crag`, `deck`); the pier's posts are old stumps. The beach is narrower than the lake, with water either side. A boulder or crag sounds like moss underfoot, the deck like wood.
Supersedes: none

## 2026-11-15 Cocolalla Lake is on the level picker, with the grove's music for now
Reason: The owner's order: once the level is built, add the lake to the level picker, and stop for his OK on the lake's music and sounds before wiring them in. So the lake is on the picker after the Bouncing Grove, playable from start to dock without crocodiles, and plays the grove's music until he picks a lake tune on the sound board. Its card picture is a still of the sunken logs with the gravel bar, the rocky point and the pier beyond.
Supersedes: none

## 2026-11-15 The lake's music and sounds
Reason: The owner's picks on the sound board: lake music B ("Morning Sky" by Centurion_of_war, CC0), the lapping water OK, and the loon left out. Claude's calls within it: the lapping loops in the footsteps group at the level the owner heard on the board, full while the hero is within 3 m of any water (in a pool, or by it) and fading to nothing 20 m away, so the Sandbox's pool laps too and the grove never does (`lappingAt` in `src/audio/game-sounds.ts`). Underwater it is muffled with everything else. Sound and music now come to 3.75 MB of the 4 MB budget.
Supersedes: none

## 2026-11-15 The lake's frame rate, and the crocodiles' budget
Reason: The owner measured Cocolalla Lake in Safari on his Mac: 75 to 81 frames a second across the run, against 120 in the grove. The crocodiles must not push the lake under 60.
Supersedes: none

## 2026-11-15 The crocodile is that exact model
Reason: The owner's word: the kids picked crocodile C as Meshy made it, so it is never made again from its words. Its Meshy task IDs and checksum are in `docs/session-handoff.md`, and the file goes on the `hero-models` release beside the marmot and mosquito originals.
Supersedes: none

## 2026-11-15 Milestone eight, part three: the crocodiles
Reason: The owner's order: rig and animate the picked crocodile (lurking with only eyes and snout above water, a surface swim, an underwater swim, a lunge with a snapping bite, a flinch, and sinking away when beaten) for his OK on a preview page; its behaviour by his rules of 2026-11-14, with a tell read in the water (the eyes sinking, a wake heading for the hero) and any aim marker on Easy only, Normal and Hard a real threat; CC0 recorded sounds (warning, lunge and bite, splash, hit) on the sound board for his OK; then placing them in `reed-water` and `cove-water` with every number in the lake's difficulty file, the bot taught to get past them, and a preview of both stretches for his OK. The lake must stay at 60 fps or more on the Mac. At most 50 Meshy credits without asking.
Supersedes: none

## 2026-11-15 How the crocodile is rigged
Reason: Claude's calls. The crocodile uses the four-legged rig script with clips of its own (`Crocodile` in `tools/rig-quadruped.py`, guide `tools/crocodile.rig.json`). Its tail, curled round to one side in Meshy's model, is laid out straight behind before the clips are written: the skin is moved with the tail bones and that becomes its resting shape. It has a jaw bone, and the lower jaw is given to it along the line of the closed mouth, since automatic weights cannot tell the two jaws apart. It is thinned to 8,000 triangles (the marmot has 14,000) with a 1,024-pixel picture, 0.5 MB, so several can swim at once. Its clips happen on the spot apart from sinking when beaten; the rules own where it is.
Supersedes: none

## 2026-11-15 How the crocodile behaves
Reason: The owner's rules of 2026-11-14 and his order for part three; he said OK to the arena preview of both swims (https://claude.ai/artifact/39XqeJ12kwpjJjdMtjTAZp ). Claude's calls within them (`src/game/crocodile.ts`): it lurks at home with only its eyes and snout above water, and touching it then does nothing; a hero in its water is stalked at their depth, at the surface with its back awash, always slower than a hero swims; close enough, it fixes its aim (its tell: its eyes sink under and it creeps along the aim, pushing a wake), then lunges along exactly that line, a metre past where the hero was; only the lunge hurts, at the surface or underwater; afterwards it rests at the surface. Getting past it: swim out of the line or dive under it (the move button). Beating it: landing on it, or Yaarbro's roll or Caputo's pounce from a log or the bank. The line showing where it will lunge is drawn on Easy only. It casts no shadow, to keep the lake's frame rate.
Supersedes: none

## 2026-11-15 The crocodile's sounds
Reason: The owner's picks on the sound board: warning B (a deep growl made by voice, rubberduck), bite B (a crunchy bite, fvcalderan), splash A (a cannonball landing in the sea, Thimras) and hit A (a dull thump, rubberduck). All CC0 recordings. Claude's calls within it: the growl plays at its tell, the bite as it lunges, the splash as it comes down after a lunge and as it goes under beaten, the thump when it is struck, each fading with distance like the other enemies'. They play at the levels heard on the board. Sound and music now come to 4,095,111 of the 4,194,304 bytes allowed.
Supersedes: none

## 2026-11-15 Where the crocodiles wait
Reason: The owner said OK to the arena preview of both swims (https://claude.ai/artifact/39XqeJ12kwpjJjdMtjTAZp ). Claude's calls within his rules: on Easy one crocodile in each long swim, 11 m to the side of the way across, so a hero swimming straight across never wakes it, with a tell of 1.8 s and the aim line; on Normal one in each, across the way, tell 0.9 s, swimming 2.4 m/s and lunging 4.5 m; on Hard two in each, tell 0.63 s, 2.9 m/s, 5.5 m, two hits to beat. Every number is `croc*` in `src/levels/cocolalla/difficulty.ts`. The test bot gets past them by looking ahead on a copy of the game and swimming or diving out of a lunge's line. With crocodile shadows off, two crocodiles in view add 2 draw calls and 16,000 triangles in the test browser.
Supersedes: none

## 2026-11-15 The owner's playtest of Cocolalla Lake
Reason: The owner played the lake with the kids. On his Mac in Safari, on Hard, the lowest frame rate was 75 frames a second, so the lake keeps its budget of 60 or more. The lake was not fun: "just more jumping". The crocodiles were easy to avoid. Every route so far runs straight away from the camera, from the bottom of the screen to the top, with very little sideways movement, and the grove has the same problem. The kids picked two lake activities: crocodile stepping stones and rope swings.
Supersedes: none

## 2026-11-15 Routes turn: a rule for every level
Reason: The owner's rule, from that playtest. A level winds, switches back and opens into wider areas, so the hero moves left, right and toward the camera, not only away from it, and the camera turns to follow the route. Claude's calls within it: how it is measured and the minimum (`src/game/route-shape.ts`, held by `tests/route-shape.test.ts`). The route is drawn from above as a line through its solids, wiggles under 1.5 m are smoothed out, and each straight stretch is sorted by which way it runs on the screen given the camera's facing there (a section's `facing`). A level must have no more than 60% of its route running away from the camera, at least 10% running left and 10% running right, at least 8% coming back toward the camera, at least 2 turns of 45 degrees or more for each 100 m, and a camera that turns to a new facing at least twice. Measured the day the rule was made, on Normal: the Bouncing Grove 92% away, 8% left, 0% right, 0% toward, 3.1 turns per 100 m, no camera turns; Cocolalla Lake 100% away and no turns at all. Both fall short and are on the test's waiting list, which only ever gets shorter. The Sandbox, a development level, is not held to it.
Supersedes: "the route runs away from the camera ... The camera always looks that way, so a route never comes back toward it" in `docs/adding-a-level.md` as it stood, for every level made or reshaped from now on.

## 2026-11-15 Milestone nine is the lake reshaped; fishing and the pike follow, then the grove reshaped
Reason: The owner's order. Milestone nine reshapes Cocolalla Lake around a route that winds around and across the lake, crocodile stepping stones, rope swings (built so any level can use them), and crocodiles that hunt a swimmer in open water on Normal and Hard while staying avoidable on Easy without diving or precise timing. The shore, the rock tunnel, the dock and the crocodiles are reused. Before it, music, sounds and models that belong to one level load when that level is picked, and the single 4 MB limit on sound gives way to a limit for each level and one for shared sounds. Fishing and the monster pike stay at the dock for the milestone after; the grove is reshaped by the route rule after that. New sounds are recordings, not sounds made in code, and go on the sound board for his OK first.
Supersedes: "Fishing and the monster pike boss, on the fishing dock (milestone nine): next" in the roadmap of `docs/session-handoff.md`; the order of the rest of the roadmap stands.

## 2026-11-15 What belongs to one level loads when that level is picked
Reason: The owner's order for milestone nine: the rope swing and stepping-stone sounds would not fit in the 99 KB left under the single 4 MB limit on sound. Claude's calls within it: every sound is shared or belongs to named levels (`home` in `src/audio/sounds.ts`). Shared sounds are fetched at start-up and must stay under 1 MB together; a level's own sounds and music are fetched when it is picked and must stay under 2.5 MB a level (`SOUND_LIMITS`, held by `tests/sound-files.test.ts`). The day it was made: shared 0.65 MB, the Bouncing Grove 2.09 MB, Cocolalla Lake 1.16 MB. The speaker holds one level's own sounds at a time and lets the last level's go. A level's enemy models are fetched the same way, worked out from its enemies and boss; the heroes, the textures and the light stay shared. Picking a level for the first time shows the progress bar until its files are here. The whole download keeps its 20 MB limit. Measured on a 20 megabit connection in the test browser, opening onto the grove: 12.04 MB and 6.8 s before, 10.36 MB and 6.0 s after.
Supersedes: "Sound and music together must stay under 4 MB" (the single limit on sound, wherever it is written).

## 2026-11-15 The route measure counts curves, and each piece under its own camera
Reason: Claude's calls, found while planning the reshaped lake. A turn is now counted each time the route has swung 45 degrees from the way it ran at the turn before, so a long curve counts as well as a sharp corner, and a zigzag of small steps does not count over and over. Where the camera turns part-way along a straight stretch, each piece of the stretch counts under the camera's facing on the solid it leads to. The minimums are unchanged. Measured again on Normal: the Bouncing Grove 289 m, 92% away, 8% left, 4 turns (1.4 for each 100 m); Cocolalla Lake 256 m, 100% away, no turns.
Supersedes: the turn counts given for the grove ("3.1 turns per 100 m") in "Routes turn: a rule for every level"; the rule and its minimums stand.

## 2026-11-16 The owner approved the reshaped lake's route plan, with two changes
Reason: The owner said OK to the route plan (https://claude.ai/artifact/84V2QoJRpCt69CWxHNkJbz ) and to build it. Two changes for margin, since the numbers move once it is built: more leftward movement, around 20 percent of the route, for example by having the rope swings carry the hero left across a cove; and a third camera turn. He approved the new scenery: the wooded island the route goes round, the headland where the swings end, and the small beach in the west cove. Claude's calls within it: the rope swings move to the north side of the island, after the crocodile crossing, and carry the hero left across a cove to a ledge on a headland of the wooded island, with the sunken logs carrying on left from there; and the camera turns a little to the right for the crocodile crossing, to look along the channel, so it turns four times in all.
Supersedes: the order of sections 2 and 3 on the plan page (the swings before the crossing, on the east shore).

## 2026-11-16 The camera follows the route, and the stick follows the camera
Reason: The owner's rule that the camera turns to follow the route. Claude's calls (`src/view/route-camera.ts`): each section says which way the camera faces (`facing`) and may ask it to sit further back and higher (`pull`); the camera turns to the next section's facing when the hero stands on the last solid of the section before, which is a safe place, and eases round over about a second and a half; it keeps that facing through a swim. Up on the stick, or the up arrow, is always away from the camera, whichever way it faces, so the player never has to think about the map. Underwater the camera sits close behind the swimmer the way it faces. A level whose sections say nothing (the Bouncing Grove, the Sandbox) keeps the camera exactly as it was.
Supersedes: none

## 2026-11-16 Cocolalla Lake's new layout
Reason: The owner's approved route plan and his two changes. Claude's calls in building it (`src/levels/cocolalla/layout.ts`): eight sections round a wooded island. The Shore Path runs east along the south shore; the Crocodile Crossing north up the east channel to a rock island; the Swinging Pines west across a cove to a ledge on the island's headland; the Sunken Logs west along the island's north shore with a zigzag out into the channel, to the gravel bar; the Open Water south down the middle of the lake, back toward the camera, to the reed bar; the Rock Tunnel west under the rocky point to a beach in the west cove; Cattail Cove's posts north up the west shore to the pier's landing; the Old Pier east to the fishing dock. Until the stepping stones and rope swings are built, the crossing is a plain swim and the cove is boulder hops that climb to the ledge. The camera looks north, turns a little left to look up the channel for the crossing, back north, west for the tunnel and the cove, and north again on the pier: four turns. On the route rule, Normal: 276 m, 26% away, 24% left, 30% right, 20% toward, 8 turns (2.9 for each 100 m); Easy and Hard are within two points of that. The water is seven pools; a solid stands across every place the route passes from one to the next, and the scenery floats a log boom along every other pool edge, so nobody swims past a section. The wooded island is a solid nobody can stand on, 5.2 m high, drawn by the lake's scenery as a wooded rise. No pine stands between the camera and the route. Checkpoints: all six banks on Easy and Normal; the rock island, the gravel bar and the cove's beach on Hard. The crocodiles wait in the Open Water as they did in the old swims, until the hunting crocodiles are built. A perfect run by the bot: 55 s on Easy, 62 on Normal, 70 on Hard. Drawn triangles at six places at the low tier in the test browser: 347 to 575 thousand, against 344 to 598 thousand for the old lake.
Supersedes: the lake's six sections and three pools as approved on 2026-11-15 ("Cocolalla Lake's route plan" and the entries that describe its layout); "Where the crocodiles wait" for where they are placed, though not for their numbers.

## 2026-11-16 The crocodiles hunt in the open water
Reason: The owner's playtest (the crocodiles were easy to avoid) and his order for milestone nine: on Normal and Hard they come after a swimmer instead of waiting to the side; on Easy they are still avoidable without diving or precise timing. Claude's calls within it: a crocodile that hunts (`crocHunt` in the lake's `difficulty.ts`) has the whole of the Open Water as its own, so it comes after a swimmer from the moment they are in, wherever they swim, and takes up the hunt again after every lunge; it goes home when the swimmer is out of the water. It heads for where the swimmer will be a moment from now (`crocLead`: 0.6 s on Normal, 1.2 s on Hard), to cut them off, and turns to face them close in. Its tell, its lunge and its rest are unchanged, and it is still slower than a hero swims (2.9 m a second on Normal, 3.3 on Hard, against 3.6), so the way past is still to swim out of the line of a lunge or dive under it. Normal has one, Hard two. On Hard one more waits under the sunken logs for anyone who falls in; it notices only a hero in the water, never one on the logs. Easy is as it was: one, well to the side, slow, with its line, and it never wakes for a hero who swims straight down the lake. The test bot gets past them on Normal and Hard as each hero with no heart lost.
Supersedes: "On Normal one in each, across the way ... on Hard two in each" in "Where the crocodiles wait", for how they behave on Normal and Hard.

## 2026-11-16 How a rope swing works
Reason: The owner's order for milestone nine: grab a rope hanging from a tree or branch, swing, and let go to fly across water, onto an island or up to a ledge; built so any level can use them; on Easy, letting go at any point in the swing lands safely. Claude's calls within it (`src/game/rope.ts`): a rope hangs still from a bough on a bare snag, out past an edge, its end a jump's height up. A hero in the air who comes within reach of its lower end takes hold with no button. Holding on, the hero swings out and back, always 52 degrees each way whatever speed it was grabbed at, for as long as they hold on; the stick does nothing. Jump lets go: the hero leaves the way the rope's end was moving with a small kick upward, the flight carries on its own unless the player steers, and the rope cannot be grabbed again until the hero has landed or gone into the water. A hit knocks a hero off. With help (`ropeHelp`, Easy), letting go anywhere throws the hero onto the solid the rope leads to and the stick cannot spoil the throw; the rope is also a little easier to reach. A rope nobody holds swings itself still. On Cocolalla Lake two ropes cross the cove in place of the boulder hops: from the rock island to a rock stack, and from the stack up to the headland's ledge. Both carry the hero west, so the swing is seen from the side. A miss lands in the cove, and the island and the stack can be climbed back onto. On Normal, letting go anywhere on the way forward gets there; on Hard the stack is smaller and the ledge further, so fewer moments work. The heroes have no clip of their own for hanging: they hang in the pose they have in the air, tipped to the line of the rope. Its two sounds (taking hold, letting go) are CC0 recordings cut from the tree creak and the swish pack already credited, because the only rope recordings found asked for credit on screen; they wait for the owner's pick on the sound board.
Supersedes: "the cove is boulder hops that climb to the ledge" in "Cocolalla Lake's new layout".

## 2026-11-16 How the crocodile stepping stones work
Reason: The owner's order for milestone nine: crocodiles surface in a row, and the hero crosses on their backs before they sink; on Easy they stay up long enough that timing does not matter; on Hard they sink fast, and one stood on too long snaps. Claude's calls within it (a new kind of moving piece, `float`, in `src/game/moving.ts`): the crocodiles lie low, with only eyes and snouts showing and nothing to stand on, until a hero comes within 11 m; then each comes up in half a second, the nearest first. From the first step on one it holds, then goes under and drops the hero in the water; for the last part of its hold it shudders and growls, its warning. Hopping off does not reset it. It comes up again a few seconds later if a hero is near. Nobody can climb onto one from the water. Easy: they never go under while anyone is about. Normal: a hold of 2.2 s with 0.9 s of warning, and no harm done. Hard: 1.1 s with 0.6 s of warning, and one a hero is still on when its hold runs out snaps, which costs a heart and throws the hero off. On Cocolalla Lake they replace the plain swim up the east channel: two rows with a rock half way, about 1.3, 2 and 2.6 m apart. The rock island at the end now stands 1.6 m high, too high to climb onto from the water, so the crocodiles are the way across; a low step on its cove side lets a hero who misses a rope climb back. They are drawn from the lake's crocodile model at 4.6 m long, in its lurking pose, snapping with its lunge, and cast no shadow. They use the crocodile sounds the owner already picked (its growl, its bite, and its splash, quieter), so no new recording was needed.
Supersedes: "the crossing is a plain swim" in "Cocolalla Lake's new layout", and the rock island being a low shore there.

## 2026-11-16 Rope swings and crocodile stepping stones, reworked after the owner's first look
Reason: The owner's review of the first preview: not OK on either (the camera's turns are fine). His word, canon from here: on a rope the hero goes through the whole of it: reaches for the rope, catches it (Yaarbro with his hands, Caputo with his teeth), hangs and swings with the body following the rope, and pushes off on letting go; the rope bends and sways when grabbed; Yaarbro's clips from Meshy's library through the API if it has suitable ones, for no more than 20 credits, else made in Blender; Caputo's in his rig script. The stepping stones must be unmistakably crocodiles (head, eyes, back and tail above water), rise with a splash as the hero comes, dip visibly when stepped on and sink away; on Normal and Hard they surface and sink in a rhythm along the row, so the player reads the pattern and times each step; the crossing is longer, with more crocodiles; on Hard one stood on too long turns and snaps; on Easy they still surface in sequence for the look but stay up while the hero is on them. The preview is the game's own scenery, light and camera, opening on Normal.
Claude's calls within it: Yaarbro's clips are three from Meshy's animation library on a new Meshy rig of his model, 14 credits (`tools/yaarbro.rope.json`): "Jump and Hang on Bar" gives the reach and the catch, "Rope Hang Idle" the hang, "Swing on Rope to Ground" the push-off; their files are kept in `tools/yaarbro-rope-clips/` stripped of the model, as the swimming clips are. Caputo has a jaw now (measured on his model; only the head's share of the skin under the mouth goes to it, so his other clips move as before) and four clips written by `tools/rig-quadruped.py`; he hangs nose up, 70 degrees. The drawing holds each hero by the grip (hands or the front of the jaw) on the rope's end and swings the body after the rope on a spring; in the rules the grip is 2.5 m over Yaarbro's feet and 1.4 m over Caputo's (`HANG` in `src/game/rope.ts`), and a test holds the two heroes to about the same number of good moments to let go. The rope is drawn as a chain 2% longer than the rules' straight rope, so it bows and wobbles under a hero who takes hold and sways in a breeze. The crocodile has two new clips, `float` (high in the water, head lifted, tail out, legs spread) and `turn_snap` (head round toward its own back, jaws snap half way). A row of stones sleeps under the water until a hero is within 9 m of its first crocodile; then each comes up a beat after the one before (1.1 s on Normal, 0.95 on Hard), stays up 2.9 and 2.1 s with a warning (shudder, bubbles) at the end, and comes up again every 6.5 and 5 s: a wave up the row no faster than a hero hops, so the skill is waiting for each crocodile and stepping on the beat. Easy: the wave runs once, 0.3 s apart, and they stay up. Hard: a hero who stands on one for 0.8 s is snapped at (a heart, thrown off). A back dips 0.12 m under a hero. The crossing is 34, 48 and 54 m (it was 28, 36 and 42), with 11, 13 and 14 crocodiles in two rows with a rock between; the Open Water swim back is as much longer, since it comes back the same distance. The preview page is the game itself with a panel to pick the place, difficulty, hero and whether the test bot plays (`tools/preview/lake.mjs`); the arena page's rope and stepping-stone places are gone.
Supersedes: in "How a rope swing works", "the heroes have no clip of their own for hanging"; in "How the crocodile stepping stones work", each crocodile waking on its own, holding from the first step on it, and the lurking pose; the crossing's numbers.

## 2026-11-16 The owner's second look: stepping stones OK, rope swings merge with the dismount still to fix
Reason: The owner's review of the lake preview (https://claude.ai/artifact/Gq1nsmNEZTm7NnfsdaTPq5): the crocodile stepping stones are OK; on the rope swing, taking hold is OK but letting go "isn't quite right" and the dismount needs work. His order: merge it now and confirm the live site. The dismount is the next piece of work on the lake, before fishing and the monster pike.

## 2026-11-16 A keyboard must get through: the crossing lined up, a jump assist, footing as drawn, Normal's first crocodile waits
Reason: The owner's keyboard playtest on Normal: he could not get past the first crocodile on the stepping stones. The keys only moved the hero at an angle to the row (the camera faced 330 degrees there), the nearest he could aim landed on the first crocodile's drawn tail, which was not footing, and he fell in. His rules, canon from here: (1) in precise sections like the stepping stones the camera lines up with the row, so up on the keyboard runs along it; (2) on Easy and Normal a gentle jump assist: a jump aimed roughly at a nearby crocodile, stone or rope steers onto it; Hard stays as it is; (3) footing matches what is drawn: the whole visible crocodile, head to tail, can be stood on; (4) on Normal the first crocodile surfaces and stays up until the hero steps on it, so the row always starts from a fair first jump, and the rest of the wave is slower and the crocodiles stay up longer; (5) a rule test for every level: the bot, limited to the eight keyboard directions relative to the camera, gets through on Easy and Normal as each hero.
Claude's calls within it: the crossing's camera faces 0 degrees, straight up the channel; the lake loses its third camera turn by it (two remain, the route rule's minimum), which the owner had asked for on 2026-11-16, so his newer rule wins and the third turn is his to place again if he wants it. The jump assist (`src/game/assist.ts`) works in the air after a jump or a rope, with the stick held: it predicts where the jump comes down; on big ground (banks, crags, decks) it does nothing; on a small piece it brings the landing at least 0.45 m in from the edge; over water or air it picks the small piece or rope nearest that spot, within `reach` of it and within `angle` of the stick's direction, and aims the hero's own air control at it, no faster than 1.15 times the stick's speed, so no jump goes further than it could. Easy: 1.6 m and 35 degrees; Normal: 1 m and 25 degrees; Hard none; the same on every level. Letting go of the stick ends it, and a bounce off a mushroom or an enemy is not steered. The stepping stones' footing is 4.6 m by 1.5 m, the drawn crocodile's length and body width (legs and all), and the drawing now takes its size from the footing so the two cannot drift apart; the row moved 0.7 m further from the island so the longer crocodiles clear it. On Normal (`stoneWait`) each row's first crocodile comes up when a hero is near and waits; the first step on it starts the row's clock; a hero back on the bank before the row (after a swim) finds it waiting again, and the others go under smoothly. Normal's wave: 1.4 s apart (was 1.1), each up 4 s (was 2.9), every 8 s (was 6.5). Easy and Hard unchanged. The keyboard rule test (`tests/keyboard.test.ts`, `tests/helpers/keyboard.ts`): the bot's every wish goes through eight directions relative to the camera as the game turns it, keys change no faster than a tenth of a second, and in the air the keys stay as they were at take-off (a player may let go, but presses no new direction until landing, a bounce, a swim or a rope). Without that last part the bot passed the live lake, because it steered every jump in the air; with it, the live lake failed on Normal at the crossing as the owner did, and every level passes with these changes.
Supersedes: "the camera turns a little to the right for the crocodile crossing, to look along the channel, so it turns four times in all" in "The owner approved the reshaped lake's route plan, with two changes"; Normal's stone numbers in "Rope swings and crocodile stepping stones, reworked after the owner's first look"; the stones being "drawn from the lake's crocodile model at 4.6 m long" on a 3 m by 1.2 m footing.

## 2026-11-16 The owner's keyboard play: the crossing OK; the third camera turn goes on the Shore Path
Reason: The owner played the stepping stones on Normal with the keyboard on the preview page: OK. His word on the third camera turn: put it on the Shore Path, looking east along the boulders, and keep it off any precise section. Claude's calls within it: the Shore Path faces 90 degrees from the start of the level, so up on the keys runs along the boulders; it turns north for the crossing on the grassy point, a roomy bank, never on a boulder or a crocodile. On the route rule, Normal: 41% away, 23% left, 15% right, 22% toward, 8 turns, 3 camera turns. The keyboard rule still passes on every level.
Supersedes: "the lake loses its third camera turn" in "A keyboard must get through".

## 2026-11-17 The owner's play of the live lake, and the kids' verdict on it
Reason: The owner's word. The crossing on Normal with the keyboard: OK. Letting go of the rope: "the rope motion is very natural": OK, so the dismount is done. Rope sounds: taking hold A, letting go B (`rope-release.wav` is now the B file from the sound board, `swish-8` at three quarters of its speed). The kids' verdict on the lake, canon for what comes next: underwater is underwhelming, the graphics fall apart and do not look good; the one crocodile in the long swim is easy to get past, and after it there is nothing to do but hold one direction to the far bank; the lake needs more crocodiles and enemies; nothing makes it challenging but the jumps, which are not especially challenging; it is not much fun, and they were unimpressed with the whole level.
What Claude found looking at it: underwater in the Open Water the camera still shows the sky, the mountains and the log booms, and the lake bed is one flat repeating ripple pattern; in the rock tunnel the camera goes into the rock and looks down on the hero from above.
Supersedes: "letting go is not quite right: the dismount needs work" in "The owner's second look".
