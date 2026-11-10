import { defineConfig } from 'vitest/config';

// Relative base so the same build works at a site root, under /yaarbroverse-3d/ on
// GitHub Pages, or opened from any other folder.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
