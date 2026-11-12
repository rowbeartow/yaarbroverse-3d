// The sound list and the files in assets/audio/ have to agree, every recorded
// file has to be credited, and all of it has to stay small.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOUNDS, type SoundDef } from '../src/audio/sounds';
import { RECIPES } from '../src/audio/synth';

const FOLDER = 'assets/audio';
const onDisk = readdirSync(FOLDER).sort();
const defs = Object.values(SOUNDS) as SoundDef[];
const listed = defs.flatMap((def) => ('files' in def.source ? def.source.files : [])).sort();

describe('sound files', () => {
  it('every file the list names is in assets/audio, and nothing else is', () => {
    expect(listed).toEqual(onDisk);
  });

  it('every sound made in code has a recipe', () => {
    for (const def of defs) {
      if ('synth' in def.source) expect(RECIPES[def.source.synth], def.label).toBeDefined();
    }
  });

  it('every recorded file is credited in CREDITS.md', () => {
    const credits = readFileSync('CREDITS.md', 'utf8');
    for (const file of onDisk) {
      const family = file.replace(/-\d+\.wav$/, '-');
      expect(credits.includes(file) || credits.includes(`${family}1.wav\` to`), file).toBe(true);
    }
  });

  it('is in formats Safari plays: WAV and MP3', () => {
    for (const file of onDisk) expect(file).toMatch(/\.(wav|mp3)$/);
  });

  it('stays under 4 MB in total', () => {
    const bytes = onDisk.reduce((sum, file) => sum + statSync(`${FOLDER}/${file}`).size, 0);
    expect(bytes).toBeLessThan(4 * 1024 * 1024);
  });

  it('a loop made in code is one second long, so its wobbles fit a whole number of times', () => {
    for (const recipe of Object.values(RECIPES) as { length: number; loop?: boolean }[]) {
      if (recipe.loop) expect(recipe.length).toBe(1);
    }
  });

  it('nothing is louder than the common loudness by more than 2 decibels', () => {
    for (const def of defs) expect(def.level, def.label).toBeLessThanOrEqual(2);
  });
});
