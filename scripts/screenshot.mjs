// Takes a picture of the game, for the docs and for checking the look by eye.
//
//   node scripts/screenshot.mjs <picture.png> [quality] [solid] [back] [hero] [difficulty] [frames]
//
//   quality     high, medium, low or minimal (default high)
//   solid       the part of the level to stand the hero on, such as bank-start,
//               log-2, bank-1, stump-3, bank-2, ravine-log-1, bank-3, high-log, bank-4
//               or bough (default bank-start)
//   back        metres toward the camera from the middle of that part (default 2)
//   hero        Yaarbro or Caputo
//   difficulty  easy, normal or hard
//   frames      how many frames to let the camera settle for (default 6)
//
// Builds nothing: run `npm run build` first, then `npx vite preview --port 4173`
// in another terminal. Set W and H for a window size other than 1280 by 800,
// and PORT if the game is served somewhere other than port 4173.
// The test browser has no graphics card, so above the minimal tier a frame
// takes several seconds here. Real devices are not affected.

import { chromium } from 'playwright';

const [out = 'grove.png', quality = 'high', solidId = 'bank-start', back = '2', hero = 'Yaarbro', difficulty = 'normal', settle = '6'] =
  process.argv.slice(2);

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({
  viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 800) },
  deviceScaleFactor: 1,
});
page.on('pageerror', (error) => console.log(`page error: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') console.log(`console ${message.type()}: ${message.text()}`);
});

await page.goto(`http://localhost:${process.env.PORT || 4173}/?quality=${quality}`);
await page.locator('#play:not([disabled])').waitFor({ timeout: 240_000 });
await page.locator(`[data-hero="${hero}"]`).click();
await page.locator(`[data-difficulty="${difficulty}"]`).click();
await page.locator('#play').click();
await page.evaluate(
  ([id, offset]) => {
    const { game } = window.__grove;
    const solid = game.level.solids.find((s) => s.id === id);
    game.x = solid.x;
    game.z = solid.z + Number(offset);
    game.y = solid.top;
    game.vx = game.vy = game.vz = 0;
  },
  [solidId, back],
);
await page.evaluate(
  (wanted) =>
    new Promise((done) => {
      let drawn = 0;
      const next = () => {
        drawn += 1;
        if (drawn >= wanted) done();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    }),
  Number(settle),
);
await page.locator('#hud').evaluate((element) => (element.style.visibility = 'hidden'));
await page.screenshot({ path: out, timeout: 300_000 });
console.log(out, JSON.stringify(await page.evaluate(() => window.__grove.stats)));
await browser.close();
