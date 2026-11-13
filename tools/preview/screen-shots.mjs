// Takes pictures of the screens around the game ("Who's playing?", the level
// picker and its card), for a preview page the owner looks at before a change
// to them merges. The players and their progress in the pictures are made up
// and put straight into the test browser's storage.
//
// Usage, with the built game served (npm run build, then
// npx vite preview --port 4173 --strictPort):
//   node tools/preview/screen-shots.mjs <folder> [width] [height]
// A cloud session draws in software, so the forest behind the screens is the
// plainest tier. On a real device it is the full picture.

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [out, W = '1024', H = '768'] = process.argv.slice(2);
if (!out) throw new Error('Say which folder the pictures go in.');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(W), height: Number(H) }, deviceScaleFactor: 2 });
const shot = (name) => page.screenshot({ timeout: 180_000, path: `${out}/${name}-${W}.png` });
const address = `http://localhost:${process.env.PORT || 4173}/?quality=minimal`;

// A first visit: nobody on the device yet.
await page.goto(address);
await page.locator('#play:not([disabled])').waitFor({ state: 'attached', timeout: 240_000 });
await page.locator('#who-name').fill('Pip');
await page.locator('.swatch[data-colour="berry"]').click();
await shot('who-first');

// Three made-up players, one with some of the grove finished.
await page.evaluate(() => {
  const best = (seconds, falls) => ({ seconds, falls });
  localStorage.setItem(
    'yaarbroverse-3d:players',
    JSON.stringify({
      version: 1,
      last: 'p-pip',
      players: [
        { id: 'p-pip', name: 'Pip', colour: 'berry', hero: 'Caputo', difficulty: 'normal', bests: { 'bouncing-grove': { Caputo: { easy: best(52.3, 0), normal: best(74.0, 2) }, Yaarbro: { easy: best(58.9, 1) } } } },
        { id: 'p-moss', name: 'Moss', colour: 'sky', hero: 'Yaarbro', difficulty: 'easy', bests: {} },
        { id: 'p-fern', name: 'Fern', colour: 'sun', hero: 'Yaarbro', difficulty: 'hard', bests: {} },
      ],
    }),
  );
});
await page.goto(address);
await page.locator('#play:not([disabled])').waitFor({ state: 'attached', timeout: 240_000 });
await page.locator('#who-players .player').first().waitFor();
await shot('who-list');
await page.locator('#who-manage').click();
await shot('who-grown');
await page.locator('[data-action="reset"]').first().click();
await shot('who-confirm');
await page.locator('#who-confirm-no').click();
await page.locator('#who-grown-done').click();
await page.locator('#who-players .player', { hasText: 'Pip' }).click();
await page.locator('.area img').first().evaluate((img) => img.decode?.());
await shot('picker');
await page.locator('.area').first().screenshot({ timeout: 180_000, path: `${out}/card-${W}.png` });
await page.locator('#switch-player').click();
await page.locator('#who-players .player', { hasText: 'Moss' }).click();
await page.locator('.area').first().screenshot({ timeout: 180_000, path: `${out}/card-new-${W}.png` });
await browser.close();
console.log(`Pictures are in ${out}`);
