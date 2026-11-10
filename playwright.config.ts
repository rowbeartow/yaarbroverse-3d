import { defineConfig, devices } from '@playwright/test';

// Browser checks: build the game, serve it, and drive it the way a player would,
// in Chromium (Mac-sized with a keyboard, iPad-sized with touch) and in WebKit
// (iPad-sized with touch). Headless browsers have no graphics card, so WebGL
// runs on the software renderer.
const webgl = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'tests/browser',
  timeout: 90_000,
  // Software 3D is slow: two browsers at once starve each other, so run one at
  // a time, keep the windows small, and give the game time to get where it is going.
  workers: 1,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    // The first build compresses every texture, which takes a minute or two.
    timeout: 360_000,
  },
  projects: [
    {
      name: 'mac',
      use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 600 }, launchOptions: { args: webgl } },
    },
    {
      // An iPad held sideways, in Chromium: touch, no mouse. Fingers here are
      // real touches sent through the browser's own input path.
      name: 'ipad',
      use: {
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 1,
        launchOptions: { args: webgl },
      },
    },
    {
      // The same iPad in WebKit, the engine behind every iPad browser. One
      // screen pixel per page pixel keeps the software 3D fast enough to test.
      name: 'ipad-webkit',
      use: { ...devices['iPad (gen 7) landscape'], viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 },
    },
  ],
});
