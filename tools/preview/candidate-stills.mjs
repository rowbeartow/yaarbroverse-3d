// Takes a still picture of the enemy candidates page (see candidates.mjs), for
// a session that has to judge the models without watching them turn.
//
//   node tools/preview/candidate-stills.mjs <picture.png> [angle] [shape]
//
//   picture.png   where to save the picture of the whole page
//   angle         how far round each model the camera stands, in radians:
//                 0 is one side, 1.57 a quarter turn on. 0.7 unless given.
//   shape         the word `shape` takes the colour off the models
//
// TALL is the window's height (1500 unless given): only models in the window are drawn, so a long page needs a tall one.
// WAIT is how long to let the models draw, in milliseconds (4000 unless given; a page of many models needs more).
// Serve the page first: `npx vite preview --outDir <folder> --port 4175`.
// The page is drawn in flat light, because a cloud session has no graphics card.

import { chromium } from '@playwright/test';

const [out, angle = '0.7', shape] = process.argv.slice(2);
if (!out) {
  console.error('Usage: node tools/preview/candidate-stills.mjs <picture.png> [angle] [shape]');
  process.exit(1);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: Number(process.env.TALL ?? 1500) }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.error(`Page error: ${error.message}`));
await page.goto(`http://localhost:4175/?plain&still=${angle}`);
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 180000 });
if (shape === 'shape') await page.click('#shape');
// A few frames, so every model has been drawn at least once.
await page.waitForTimeout(Number(process.env.WAIT ?? 4000));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`Saved ${out}`);
