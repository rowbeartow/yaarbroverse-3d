import { defineConfig } from 'vitest/config';

// Relative base so the same build works at a site root, under /yaarbroverse-3d/ on
// GitHub Pages, or opened from any other folder.
export default defineConfig({
  base: './',
  // A stamp on every asset address, so a new build never shows an old copy of a file.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
