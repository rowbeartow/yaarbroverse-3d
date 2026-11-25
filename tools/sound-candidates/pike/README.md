# Sound candidates for the monster pike, the new moves and the rescue

Fourteen recordings, two choices (A and B) of each of seven sounds, for the owner's pick on the sound board before any goes into the game. Made on 2026-11-25. **None is in the game.** Nobody in a cloud session can hear them: they were chosen by their names in the packs, their length, and how deep or bright they measure, and the owner's ear decides.

All sources are CC0, downloaded from OpenGameArt on 2026-11-25. `cut.sh` in this folder is the exact ffmpeg cut of every file (its top says how to lay out the downloads); `extras.json` is what the sound board shows.

| Sound | Group, and whose | A | B |
| --- | --- | --- | --- |
| Pike hooked | cue, the lake's | `pike-hooked-a.wav` (0.37 s): `bfh1_wood_hit_02` (rubberduck's breaking pack), with Kenney's `pluck_002` at half speed 50 ms after it | `pike-hooked-b.wav` (0.44 s): `stomp_01` (rubberduck's creature pack), with Kenney's `pluck_001` at 0.6 of its speed 40 ms after it |
| Line snaps | cue, the lake's | `line-snap-a.wav` (0.28 s): `bfh1_wood_breaking_01` | `line-snap-b.wav` (0.25 s): `swish-12`, with Kenney's `pluck_002` at 0.8 of its speed 60 ms after it |
| Pike surfacing | cue, the lake's | `pike-surface-a.wav` (1.0 s): `splash_04` whole, rumble under 60 hertz out | `pike-surface-b.wav` (1.08 s): the first 1.1 s of `splash_07`, rumble under 80 hertz out |
| Pike's jaws snap | cue, the lake's | `pike-snap-a.wav` (0.44 s): `crunchybite` at 0.72 of its speed, with `splash_10` at half loudness | `pike-snap-b.wav` (0.35 s): `thwack-01` with `splash_09` |
| Walblum's kick | action, shared | `kick-a.wav` (0.30 s): the first 0.3 s of `qubodupPunch01` | `kick-b.wav` (0.13 s): `thwack-03` played a fifth faster |
| Claw Slash | action, shared | `claw-slash-a.wav` (0.19 s): `swish-10`, `swish-11` and `swish-12` 70 ms apart, each a little higher | `claw-slash-b.wav` (0.26 s): Kenney's `scratch_001`, `scratch_002`, `scratch_001` 70 ms apart over `swish-9` |
| The rescue | cue, shared or the lake's | `rescue-a.wav` (1.61 s): `Chime_LevelUp` | `rescue-b.wav` (1.43 s): `Chime_Load` |

Sounds already in the game from the same packs, so a pick does not repeat one: `strike.wav` is `thwack-02`, `hit.wav` is `qubodupPunch05`, `croc-bite.wav` is `crunchybite` at full speed, `water-in`, `stroke` and `surfacing` are `splash_05`, `_03` and `_02`, the pounce and the cast are `swish-9` and `swish-7`, and the checkpoint, hearts-out and hidden-leaf chimes are `Chime_Confirm`, `Chime_Exit` and `Chime_Save`.

## The downloads

| Pack | Author | Address | File | SHA-256 |
| --- | --- | --- | --- | --- |
| 75 CC0 breaking / falling / hit sfx | rubberduck | https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | `sfx_breaking_and_falling.zip` | `e6ee04d91c5f4d30cfda1260d2c9d1faf96fda36319287215fbd07bcb1a80451` |
| 80 CC0 creture SFX #2 | rubberduck | https://opengameart.org/content/80-cc0-creture-sfx-2 | `80-CC0-creature-sfx-2.zip` | `6d251aeaaaa9c2fffed8fc2f64bab3104725ceabf9259a8441994e7a20cfe22f` |
| 40 CC0 water / splash / slime SFX | rubberduck | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | `water-splash-slime-sfx.zip` | `7cd39abb49d4362a37ba18dc0e454c7dc1d08029d4e5b683149046bc237b2eba` |
| Interface Sounds | Kenney (www.kenney.nl) | https://opengameart.org/content/interface-sounds | `kenney_interfaceSounds.zip` | `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232` |
| Swishes Sound Pack | artisticdude | https://opengameart.org/content/swishes-sound-pack | `swishes.zip` | `7980215241b739a787dcf26f660ce510bb237900968789395a86911619795693` |
| Thwack Sounds | AntumDeluge | https://opengameart.org/content/thwack-sounds | `thwack-1.0.zip` | `8edb002735a01369ef4d6259573be4885f9fe32c9a9efa89dfbbb14067c8c8e5` |
| Crunchy bite | fvcalderan | https://opengameart.org/content/crunchy-bite | `crunchybite_0.ogg` | `679e360c29fd61bbaa47bd5ff130652f9ff7d9b3a30fc010810671d19f0ebc71` |
| Punch | qubodup | https://opengameart.org/content/punch | `qubodupPunch.7z` | `757795e8778acc377abacea902052c2dc707583c69d00b8baa2e76b670a02398` |
| Chimey UI Sounds | MouseBYTE | https://opengameart.org/content/chimey-ui-sounds | `mousebyte_chimeyui.7z` | `6272bac49c8f3e9aa251a8c9e974a2e7f5756119657d0414197baeb129b0c549` |

Every pack's page says CC0, and every checksum is the one `CREDITS.md` already records for that download. Each download file is at `https://opengameart.org/sites/default/files/<file>`. The two `.7z` packs were unpacked with Python's `py7zr`.

## When the owner has picked

Copy each picked file into `assets/audio/` under its game name, add it to `SOUNDS` in `src/audio/sounds.ts` (the pike's four with `home: ['cocolalla']`), add a row to `CREDITS.md` from the tables above, and run `npx vitest run tests/sound-files.test.ts`.

## Room under the size limits (measured 2026-11-25)

`SOUND_SIZES=1 npx vitest run tests/sound-files.test.ts --silent=false`:

- Shared sounds: 769,999 of 1,048,576 bytes, 278,577 to spare. The biggest shared picks (kick A, Claw Slash B, rescue A) are 138,756 bytes together.
- Cocolalla Lake's own: 1,656,974 of 2,621,440 bytes, 964,466 to spare. The biggest lake picks (hooked B, snap A of each, surfacing B) are 143,444 bytes together.

## The sound board

`node tools/preview/sounds.mjs <folder> tools/sound-candidates/pike` builds the board with these fourteen under "New: the monster pike, the new moves and the rescue". In the test browser every one of the fourteen loads, plays through and raises no error.
