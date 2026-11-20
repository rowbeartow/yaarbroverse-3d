// Takes still frames of the enemies preview page (see enemies.mjs) and lays
// them out on one sheet, for judging a clip in a session that cannot watch it.
//
//   node tools/preview/enemy-stills.mjs <sheet.jpg> <enemy> <clip>:<shares> [<clip>:<shares> ...] [angle=<radians>] [bones]
//
//   enemy     marmot, mosquito or crocodile
//   clip      a clip's name, then the shares of its length to hold it at,
//             with commas between, such as throw:0,0.2,0.5,1
//   angle     where the camera stands: 0 is in front of it, 1.57 at its left
//             side, 3.14 behind. 1.1 unless given. Several angles, with
//             commas between, give one row of frames for each.
//   bones     the word bones draws the skeleton
//   marks     the word marks draws a marker at each grip point of a hero's
//             palms (blue for the right, pink for the left)
//   catch     which fish a hero lands, counted from 0 down the page's list:
//             catch=4 is the 110 cm pike
//
// Set PAGE to add to the page's address: PAGE='dry&reach=2.2' leaves out the
// water and stands the camera closer.
//
// Serve the page first: `npx vite preview --outDir <folder> --port 4176`.
// The page is drawn in flat light, because a cloud session has no graphics card.

import { chromium } from 'playwright';
import sharp from 'sharp';

const [out, enemy, ...rest] = process.argv.slice(2);
const bones = rest.includes('bones');
const angles = (rest.find((word) => word.startsWith('angle='))?.slice(6) ?? '1.1').split(',').map(Number);
const clips = rest.filter((word) => word.includes(':'));
const marks = rest.includes('marks');
const caught = Number(rest.find((word) => word.startsWith('catch='))?.slice(6) ?? 0);
if (!out || !enemy || clips.length === 0) {
  console.error('Usage: node tools/preview/enemy-stills.mjs <sheet.jpg> <enemy> <clip>:<shares> [...] [angle=<radians>] [bones]');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.error(`Page error: ${error.message}`));
// PAGE=dry&reach=2.2 (for one) adds to the page's address.
await page.goto(`http://localhost:4176/?plain&still${process.env.PAGE ? `&${process.env.PAGE}` : ''}`);
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 180000 });
const canvas = page.locator(`#view-${enemy}`);
await canvas.scrollIntoViewIfNeeded();

await page.evaluate(([name, index, on]) => window.preview.tackle(name, index, on), [enemy, caught, marks]);

const tile = { width: 420, height: 262 };
const rows = [];
for (const entry of clips) {
  const [clip, list] = entry.split(':');
  for (const angle of angles) {
    const row = [];
    for (const share of list.split(',').map(Number)) {
      const held = await page.evaluate(([name, which, at, from, skeleton]) => window.preview.hold(name, which, at, from, skeleton), [enemy, clip, share, angle, bones]);
      if (!held) throw new Error(`No clip called ${clip} on ${enemy}`);
      row.push(await sharp(await canvas.screenshot()).resize(tile.width, tile.height).toBuffer());
    }
    rows.push(row);
  }
}
await browser.close();

const columns = Math.max(...rows.map((row) => row.length));
await sharp({ create: { width: columns * tile.width, height: rows.length * tile.height, channels: 3, background: '#7fb3a6' } })
  .composite(rows.flatMap((row, y) => row.map((input, x) => ({ input, left: x * tile.width, top: y * tile.height }))))
  .jpeg({ quality: 86 })
  .toFile(out);
console.log(`Saved ${out}: ${rows.length} rows of up to ${columns}`);
