// The sound list and the files in assets/audio/ have to agree, every recorded
// file has to be credited, and it has to stay small: the shared sounds
// together, and each level's own together.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIX, SOUNDS, SOUND_LIMITS, soundFiles, type SoundDef } from '../src/audio/sounds';
import { LEVELS } from '../src/levels';
import { RECIPES } from '../src/audio/synth';

const FOLDER = 'assets/audio';
const onDisk = readdirSync(FOLDER).sort();
const defs = Object.values(SOUNDS) as SoundDef[];
const listed = [...new Set(defs.flatMap((def) => ('files' in def.source ? def.source.files : [])))].sort();

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
      expect(credits.includes(`\`${file}\``) || credits.includes(`${family}1.wav\` to`), file).toBe(true);
    }
  });

  it('is in formats Safari plays: WAV and MP3', () => {
    for (const file of onDisk) expect(file).toMatch(/\.(wav|mp3)$/);
  });

  const bytesOf = (files: string[]): number => files.reduce((sum, file) => sum + statSync(`${FOLDER}/${file}`).size, 0);

  it('the shared sounds, fetched on every visit, stay under 1 MB together', () => {
    expect(SOUND_LIMITS.shared).toBe(1024 * 1024);
    expect(bytesOf(soundFiles(null))).toBeLessThan(SOUND_LIMITS.shared);
  });

  it.each(LEVELS.map((level) => [level.id] as const))("%s's own sounds and music, fetched when it is picked, stay under 2.5 MB together", (id) => {
    expect(SOUND_LIMITS.level).toBe(2.5 * 1024 * 1024);
    expect(bytesOf(soundFiles(id))).toBeLessThan(SOUND_LIMITS.level);
  });

  it('every file is shared or belongs to a level in the level list, and no file is both', () => {
    const shared = soundFiles(null);
    const ids = LEVELS.map((level) => level.id);
    for (const def of defs) for (const id of def.home ?? []) expect(ids, def.label).toContain(id);
    const owned = new Set(ids.flatMap((id) => soundFiles(id)));
    for (const file of owned) expect(shared, file).not.toContain(file);
    expect([...shared, ...owned].sort()).toEqual(onDisk);
  });

  it('prints the sizes when asked (SOUND_SIZES=1)', () => {
    if (!process.env.SOUND_SIZES) return;
    console.log(`shared: ${bytesOf(soundFiles(null))} bytes of ${SOUND_LIMITS.shared}`);
    for (const level of LEVELS) console.log(`${level.id}: ${bytesOf(soundFiles(level.id))} bytes of ${SOUND_LIMITS.level}`);
  });

  it('a loop made in code is one second long, so its wobbles fit a whole number of times', () => {
    for (const recipe of Object.values(RECIPES) as { length: number; loop?: boolean }[]) {
      if (recipe.loop) expect(recipe.length).toBe(1);
    }
  });

  it('the mix is the six numbers the owner set by ear, and none of them turns anything up', () => {
    expect(MIX).toEqual({ master: -8, music: -21, cue: -15, action: -26, step: -24, menu: -20 });
    for (const value of Object.values(MIX)) expect(value).toBeLessThanOrEqual(0);
  });

  it('no sound stands more than 6 decibels over the rest of its group', () => {
    for (const def of defs) expect(def.level, def.label).toBeLessThanOrEqual(6);
  });
});
