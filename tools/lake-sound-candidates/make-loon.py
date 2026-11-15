# A distant loon's wail, made in code: a smooth rising and falling call with a little
# vibrato, softened for distance and given the echo of a lake. Writes a mono WAV.
import sys, wave
import numpy as np
RATE = 16000
out = sys.argv[1]
# The call's pitch through time: (seconds, hertz). A low start, a rise to a long note, a lift, and a fall.
shape = [(0.0, 470), (0.25, 700), (0.55, 760), (1.6, 790), (1.85, 1010), (2.6, 980), (2.9, 760), (3.3, 700)]
length = shape[-1][0]
n = int(length * RATE)
t = np.arange(n) / RATE
pitch = np.interp(t, [p[0] for p in shape], [p[1] for p in shape])
pitch *= 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.6, 0, 1)
phase = 2 * np.pi * np.cumsum(pitch) / RATE
voice = np.sin(phase) + 0.28 * np.sin(2 * phase + 0.3) + 0.09 * np.sin(3 * phase + 0.7) + 0.04 * np.sin(4 * phase)
# Loudness through time: a soft swell in, a dip between notes, a slow fade.
env = np.interp(t, [0, 0.2, 1.6, 1.75, 1.9, 2.7, 3.3], [0, 0.8, 1.0, 0.75, 1.0, 0.85, 0])
env = env ** 1.4
call = voice * env
# Far away: the highs go first.
def lowpass(x, hz):
    a = np.exp(-2 * np.pi * hz / RATE); y = np.zeros_like(x); prev = 0.0
    for i, v in enumerate(x):
        prev = (1 - a) * v + a * prev; y[i] = prev
    return y
call = lowpass(lowpass(call, 2600), 3200)
# The lake answers: a few echoes, then a soft tail.
tail = int(1.8 * RATE)
mix = np.concatenate([call, np.zeros(tail)])
for delay, gain in [(0.21, 0.32), (0.47, 0.2), (0.93, 0.12), (1.4, 0.07)]:
    d = int(delay * RATE)
    mix[d:d + n] += lowpass(call, 1800) * gain
mix *= 0.89 / np.max(np.abs(mix))
# A clean start and end.
fade = int(0.05 * RATE); mix[-fade:] *= np.linspace(1, 0, fade)
pcm = (mix * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(pcm.tobytes())
print(out, len(pcm) / RATE, 's', len(pcm) * 2, 'bytes')
