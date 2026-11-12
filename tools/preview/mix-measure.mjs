// Measures how loud the game's mix comes out, without speakers. It asks the
// mixer page to draw its sample run as numbers, saves them as WAV files, and
// has ffmpeg measure each in LUFS (the broadcast measure of loudness).
//
//   node tools/preview/mix-measure.mjs [<folder for the WAV files>] ["master -10, music -14, ..."]
//
// First build and serve the mixer page:
//   node tools/preview/mixer.mjs <folder> && npx vite preview --outDir <folder> --port 4178
//
// It prints four numbers:
//   normal play   music, footsteps, jumps and landings together. The aim is about -23 LUFS.
//   whole sample  the same with a bounce, a marmot warning, a hit and a checkpoint.
//   music alone, effects alone   the music should be at least 10 under the effects.
// and the highest peak, which should be well under 0 dB.
//
// With a line of settings (as copied from the mixer page) it measures those
// instead of the levels in src/audio/sounds.ts. Needs ffmpeg.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const folder = process.argv[2] ?? 'node_modules/.cache/mix';
const line = process.argv[3];
mkdirSync(folder, { recursive: true });

const wav = (left, right, rate) => {
  const frames = left.length;
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  return buffer;
};

const loudness = (file) => {
  // ffmpeg writes its report to the error stream.
  const report = spawnSync('ffmpeg', ['-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const summary = report.slice(report.lastIndexOf('Summary:'));
  return { lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]), peak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]) };
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:4178/');
await page.waitForFunction(() => 'mixer' in window);
let levels = await page.evaluate(() => window.mixer.start);
if (line) {
  const short = { master: 'master', music: 'music', warnings: 'cue', jumps: 'action', footsteps: 'step', menu: 'menu' };
  for (const part of line.split(',')) {
    const [name, value] = part.trim().split(/\s+/);
    if (!(name in short) || Number.isNaN(Number(value))) throw new Error(`Cannot read "${part.trim()}"`);
    levels[short[name]] = Number(value);
  }
}
console.log('Levels:', JSON.stringify(levels));
const results = {};
for (const what of ['normal', 'all', 'music', 'effects']) {
  const { rate, left, right } = await page.evaluate(([kind, with_]) => window.mixer.render(kind, with_), [what, levels]);
  const file = join(folder, `${what}.wav`);
  writeFileSync(file, wav(left, right, rate));
  results[what] = loudness(file);
}
await browser.close();
const show = (label, { lufs, peak }) => console.log(`${label.padEnd(16)} ${lufs.toFixed(1)} LUFS   peak ${peak.toFixed(1)} dB`);
show('normal play', results.normal);
show('whole sample', results.all);
show('music alone', results.music);
show('effects alone', results.effects);
console.log(`Music sits ${(results.effects.lufs - results.music.lufs).toFixed(1)} dB under the effects.`);
