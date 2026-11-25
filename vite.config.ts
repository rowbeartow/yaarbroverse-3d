import { defineConfig } from 'vitest/config';
import { BOT_RUN_LIMIT, botRunFiles } from './tests/bot-runs';

// The rule tests come in two kinds (tests/bot-runs.ts): those where a bot plays
// the game, which get a long time limit, and the rest.
const botRuns = botRunFiles();

// Relative base so the same build works at a site root, under /yaarbroverse-3d/ on
// GitHub Pages, or opened from any other folder.
export default defineConfig({
  base: './',
  // A stamp on every asset address, so a new build never shows an old copy of a file.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    projects: [
      { extends: true, test: { name: 'rules', include: ['tests/**/*.test.ts'], exclude: botRuns } },
      { extends: true, test: { name: 'bot', include: botRuns, testTimeout: BOT_RUN_LIMIT } },
    ],
  },
});
