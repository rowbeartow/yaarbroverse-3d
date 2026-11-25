// The bot's runs have a time limit and a job of their own on GitHub
// (tests/bot-runs.ts). These hold that split together.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOT_RUN_LIMIT, PLAYERS, botRunFiles } from './bot-runs';

describe('the bot runs', () => {
  const files = botRunFiles();

  it('are the test files that play the game with a bot', () => {
    for (const file of ['tests/levels.test.ts', 'tests/keyboard.test.ts', 'tests/lake.test.ts', 'tests/boss-entry.test.ts', 'tests/water-exits.test.ts', 'tests/fishing.test.ts']) {
      expect(files, file).toContain(file);
    }
    // Tests of the rules alone stay in the quick kind, this one among them.
    for (const file of ['tests/movement.test.ts', 'tests/moving.test.ts', 'tests/bot-runs.test.ts']) expect(files, file).not.toContain(file);
  });

  it('name helpers that exist', () => {
    for (const player of PLAYERS) expect(() => readFileSync(`tests/helpers/${player}.ts`), player).not.toThrow();
  });

  it('set no shorter time limit of their own', () => {
    // One number rules them all: a limit written into a test would be the one a slow machine hits.
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/testTimeout|\},\s*[\d_]{4,}\s*\)\s*;/);
    }
    expect(BOT_RUN_LIMIT).toBeGreaterThanOrEqual(300_000);
  });

  it('have a job of their own on GitHub, with room for a slow machine', () => {
    const checks = readFileSync('.github/workflows/checks.yml', 'utf8');
    const job = checks.slice(checks.indexOf('\n  bot-runs:'), checks.indexOf('\n  chromium:'));
    expect(job).toContain('npm run test:bot');
    expect(Number(/timeout-minutes: (\d+)/.exec(job)?.[1])).toBeGreaterThanOrEqual(60);
    // The quick job runs the rest, and the summary job waits for both.
    expect(checks).toContain('npm run test:rules');
    expect(checks).toMatch(/needs: \[build, bot-runs, chromium\]/);
  });
});
