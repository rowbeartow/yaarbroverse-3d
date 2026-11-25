#!/bin/bash
# Cuts the fourteen sound candidates in this folder from the downloads.
#
#   bash tools/sound-candidates/pike/cut.sh <downloads folder> <out folder>
#
# The downloads folder holds each pack unpacked in a folder of its own, named
# as below (README.md has each pack's address and checksum):
#   swishes/            swishes.zip (its swishes/ folder)
#   thwack/             thwack-1.0.zip (its Vorbis/ folder)
#   breaking/           sfx_breaking_and_falling.zip
#   water/              water-splash-slime-sfx.zip
#   kenney/             kenney_interfaceSounds.zip (its Audio/ folder)
#   creature/           80-CC0-creature-sfx-2.zip
#   chimey/             mousebyte_chimeyui.7z
#   punch/              qubodupPunch.7z
#   crunchybite_0.ogg   as downloaded
#
# Every file comes out mono at 32,000 samples a second, with its leading
# silence off, a 4 ms fade in and a fade out.
set -e
D="$1"; O="$2"; mkdir -p "$O"
# The end of every chain: silence off the front, mono, 32 kHz, a 4 ms fade in, and a fade out of $1 seconds.
tail() { echo "silenceremove=start_periods=1:start_threshold=-50dB,aresample=32000,afade=t=in:d=0.004,areverse,afade=t=in:d=$1,areverse"; }
ff() { ffmpeg -hide_banner -loglevel error -nostdin -y "$@"; }
one() { # one <source> <out> <filters before the tail> <fade out>
  ff -i "$1" -ac 1 -af "$3,$(tail "$4")" -c:a pcm_s16le "$O/$2"
}

# 1. The monster pike hooked: a heavy thump and a taut line.
#    A: a dull wooden thump, with a plucked string an octave down 50 ms after it.
ff -i "$D/breaking/bfh1_wood_hit_02.ogg" -i "$D/kenney/pluck_002.ogg" -filter_complex \
  "[0]aformat=channel_layouts=mono,aresample=32000[a];[1]aformat=channel_layouts=mono,asetrate=44100*0.5,aresample=32000,adelay=50,volume=0.8[b];[a][b]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.08)" -c:a pcm_s16le "$O/pike-hooked-a.wav"
#    B: a deep stomp, with a shorter pluck three quarters down 40 ms after it.
ff -i "$D/creature/stomp_01.ogg" -i "$D/kenney/pluck_001.ogg" -filter_complex \
  "[0]aformat=channel_layouts=mono,aresample=32000[a];[1]aformat=channel_layouts=mono,asetrate=44100*0.6,aresample=32000,adelay=40,volume=0.9[b];[a][b]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.08)" -c:a pcm_s16le "$O/pike-hooked-b.wav"

# 2. The line snapping: a sharp twang or crack.
#    A: a dry wooden crack.
one "$D/breaking/bfh1_wood_breaking_01.ogg" line-snap-a.wav "anull" 0.05
#    B: a whip of air, then a plucked string a little down.
ff -i "$D/swishes/swish-12.wav" -i "$D/kenney/pluck_002.ogg" -filter_complex \
  "[0]aformat=channel_layouts=mono,aresample=32000,volume=0.7[a];[1]aformat=channel_layouts=mono,asetrate=44100*0.8,aresample=32000,adelay=60[b];[a][b]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.05)" -c:a pcm_s16le "$O/line-snap-b.wav"

# 3. The pike surfacing: a big body breaking the water.
#    A: a heavy, low splash, whole (1.0 s), rumble under 60 hertz out.
one "$D/water/splash_04.ogg" pike-surface-a.wav "highpass=f=60" 0.2
#    B: a longer, brighter splash, its first 1.1 s.
one "$D/water/splash_07.ogg" pike-surface-b.wav "highpass=f=80,atrim=0:1.1" 0.25

# 4. The pike snapping its jaws: a hard wet clack, bigger than the crocodile's bite.
#    A: the crocodile's crunchy bite at 0.72 of its speed (lower and longer), with a short wet slap under it.
ff -i "$D/crunchybite_0.ogg" -i "$D/water/splash_10.ogg" -filter_complex \
  "[0]aformat=channel_layouts=mono,asetrate=44100*0.72,aresample=32000[a];[1]aformat=channel_layouts=mono,aresample=32000,volume=0.5[b];[a][b]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.08)" -c:a pcm_s16le "$O/pike-snap-a.wav"
#    B: a hard bright thwack, with a dull wet slap under it.
ff -i "$D/thwack/thwack-01.oga" -i "$D/water/splash_09.ogg" -filter_complex \
  "[0]aformat=channel_layouts=mono,aresample=32000,volume=0.8[a];[1]aformat=channel_layouts=mono,aresample=32000,volume=0.9[b];[a][b]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.08)" -c:a pcm_s16le "$O/pike-snap-b.wav"

# 5. Walblum's kick landing: a short comic whack.
#    A: a punch, its first 0.3 s.
one "$D/punch/qubodupPunch01.flac" kick-a.wav "atrim=0:0.3" 0.06
#    B: a short, deep thwack, played a fifth faster so it is higher and snappier.
one "$D/thwack/thwack-03.oga" kick-b.wav "asetrate=44100*1.2,aresample=32000" 0.04

# 6. Claw Slash: a triple swish with an edge to it.
#    A: three bright swishes 70 ms apart, each a little higher than the last.
ff -i "$D/swishes/swish-10.wav" -i "$D/swishes/swish-11.wav" -i "$D/swishes/swish-12.wav" -filter_complex \
  "[0]aformat=channel_layouts=mono,aresample=32000[a];[1]aformat=channel_layouts=mono,asetrate=44100*1.1,aresample=32000,adelay=70[b];[2]aformat=channel_layouts=mono,asetrate=44100*1.2,aresample=32000,adelay=140[c];[a][b][c]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.03)" -c:a pcm_s16le "$O/claw-slash-a.wav"
#    B: three scratches 70 ms apart over one swish: more edge, less air.
ff -i "$D/kenney/scratch_001.ogg" -i "$D/kenney/scratch_002.ogg" -i "$D/kenney/scratch_001.ogg" -i "$D/swishes/swish-9.wav" -filter_complex \
  "[0]aformat=channel_layouts=mono,aresample=32000,volume=0.6[a];[1]aformat=channel_layouts=mono,aresample=32000,adelay=70,volume=0.6[b];[2]aformat=channel_layouts=mono,asetrate=44100*1.15,aresample=32000,adelay=140,volume=0.6[c];[3]aformat=channel_layouts=mono,aresample=32000,volume=0.6[d];[a][b][c][d]amix=inputs=4:normalize=0:duration=longest,alimiter=limit=0.95,$(tail 0.03)" -c:a pcm_s16le "$O/claw-slash-b.wav"

# 7. The rescue: a short warm jingle.
#    A: a rising chime (1.8 s).
one "$D/chimey/Chime_LevelUp.mp3" rescue-a.wav "anull" 0.3
#    B: a second, gentler chime (1.5 s).
one "$D/chimey/Chime_Load.mp3" rescue-b.wav "anull" 0.3
