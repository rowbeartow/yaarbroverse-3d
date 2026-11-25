# Sound candidates for the monster pike, the new moves and the rescue

**Nothing is here yet.** The session of 2026-11-25 could not fetch a single recording: its environment's network settings do not allow `opengameart.org` or `kenney.nl` (the proxy answered "403 Forbidden: no rule or network setting allows this host"). No stand-ins were synthesised, because the owner asked for recordings.

To carry on, a session needs `opengameart.org` allowed in its environment's network settings (the same kind of change `CLAUDE.md` describes for the Poly Haven hosts).

## What is wanted

Two choices (A and B) of each, all CC0 recordings, for the owner's pick on the sound board before any goes into the game:

| Sound | What it should be | Group | Whose |
| --- | --- | --- | --- |
| Pike hooked | a heavy thump and a taut line | cue | the lake's |
| Line snaps | a sharp twang or crack | cue | the lake's |
| Pike surfacing | a big body breaking the water | cue | the lake's |
| Pike snapping its jaws | a hard wet clack, bigger than the crocodile's bite | cue | the lake's |
| Walblum's kick landing | a short comic whack | action | shared |
| Claw Slash | a triple swish with an edge to it | action | shared |
| The rescue | a short warm jingle, unlike the leaf tune and the boss-beaten jingle | cue | the lake's (or shared) |

## Where to look first (not checked: nothing could be downloaded)

These are packs the game already credits (`CREDITS.md` has each address and the SHA-256 of each download), which hold sounds the game does not use yet. The file names below are guesses to try, not picks:

- Hooked, kick: "Thwack Sounds" by AntumDeluge (`thwack-*`), "Punch" by qubodup (`qubodupPunch*`), "75 CC0 breaking / falling / hit sfx" by rubberduck (`bfh1_hit_*`).
- Line snaps: rubberduck's breaking pack (`bfh1_*breaking*`); "Swishes Sound Pack" for a whip-like crack.
- Surfacing: "40 CC0 water / splash / slime SFX" by rubberduck (`splash_*`), "Ocean splash" by Thimras, "Fisheefects" (`splash.wav`, later than the 0.9 s already used).
- Jaws: "Crunchy bite" by fvcalderan played lower, "80 CC0 creture SFX #2" by rubberduck.
- Claw Slash: three of the "Swishes Sound Pack" swishes laid 70 ms apart (`adelay` and `amix` in ffmpeg), sped up a little.
- Rescue: "Chimey UI Sounds" by MouseBYTE, "Fisheefects" (`point_special.wav` past the 1.3 s already used), Kenney's "Interface Sounds" (`confirmation_*`).

## How to cut and show them

Cut as the others were: `ffmpeg -i <source> -ac 1 -ar 32000 -af "silenceremove=start_periods=1:start_threshold=-50dB,afade=t=in:d=0.004,afade=t=out:st=<end - fade>:d=<fade>" -t <length> <name>-a.wav`. Put the fourteen files here with an `extras.json` (the top of `tools/preview/sounds.mjs` says what it holds), fill in a table of source, author, licence, address, download checksum and exact cut for each, then `node tools/preview/sounds.mjs <folder> tools/sound-candidates/pike` and publish the folder as a private Claude artifact.

## Room under the size limits (measured 2026-11-25)

`SOUND_SIZES=1 npx vitest run tests/sound-files.test.ts --silent=false`:

- Shared sounds: 769,999 of 1,048,576 bytes: 278,577 to spare. A one-second mono WAV at 32,000 samples a second is 64 KB, so the kick and Claw Slash fit easily; a two-second jingle would too.
- Cocolalla Lake's own: 1,656,974 of 2,621,440 bytes: 964,466 to spare.
