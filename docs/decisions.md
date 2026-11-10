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
