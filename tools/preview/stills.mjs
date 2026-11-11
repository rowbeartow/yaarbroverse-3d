// Takes still frames of the hero preview page and lays them out on one sheet,
// for judging a clip here, where nothing can be watched at speed.
//
//   node tools/preview/stills.mjs <sheet.jpg> <what> [bones] [columns]
//
//   what      side:<walk|run>:<shares>            the slow side view, held at each share (0 to 1) of the stride
//             pose:<clip>:<shares>:<angle>        the stage holding a clip at each share, seen from `angle` radians round
//                                                 (0 is from in front, -1.57 from his right side)
//             game:<seconds>:<angle>              the stage's "In the game" loop at each moment
//             Shares, seconds: numbers with commas between, such as 0,0.25,0.5,0.75
//   bones     the word bones to draw the skeleton, or "" for none
//   columns   frames in a row (default 4)
//
// First build the page (build.mjs) and serve it in another terminal:
//   npx vite preview --outDir <folder> --port 4174
// It draws with flat light (?plain): the test browser has no graphics card.

import { chromium } from 'playwright';
import sharp from 'sharp';

const [out, what, bonesWord = '', columnsText = '4'] = process.argv.slice(2);
if (!out || !what) {
  console.error('Usage: node tools/preview/stills.mjs <sheet.jpg> <what> [bones] [columns]');
  process.exit(1);
}
const parts = what.split(':');
const kind = parts[0];
const [name, list, angle = '-1.57'] = kind === 'game' ? ['', parts[1], parts[2]] : parts.slice(1);
const bones = bonesWord === 'bones';

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.log(`page error: ${error.message}`));
await page.goto(`http://localhost:${process.env.PORT || 4174}/index.html?plain&still`);
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 120_000 });
const canvas = page.locator(kind === 'side' ? `#side-${name}` : '#view');
await canvas.scrollIntoViewIfNeeded();
const shots = [];
for (const value of list.split(',').map(Number)) {
  await page.evaluate(
    ([kind, name, value, angle, bones]) => {
      const preview = window.__preview;
      if (kind === 'side') preview.side(name, value, bones);
      else if (kind === 'pose') preview.pose(name, value, Number(angle), bones);
      else preview.game(value, Number(angle));
    },
    [kind, name, value, angle, bones],
  );
  // The page draws again on its next frame; wait for that drawing, not the clock.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  shots.push({ value, picture: await canvas.screenshot() });
}
await browser.close();

const columns = Number(columnsText);
const size = await sharp(shots[0].picture).metadata();
const scale = Number(process.env.SCALE) || 0.62;
const width = Math.round(size.width * scale);
const height = Math.round(size.height * scale);
const placed = [];
for (const [i, shot] of shots.entries()) {
  const label = Buffer.from(`<svg width="${width}" height="${height}"><text x="6" y="18" font-size="16" font-family="sans-serif">${shot.value}</text></svg>`);
  placed.push({
    input: await sharp(shot.picture).resize(width, height).composite([{ input: label }]).png().toBuffer(),
    left: (i % columns) * width,
    top: Math.floor(i / columns) * height,
  });
}
await sharp({ create: { width: columns * width, height: Math.ceil(shots.length / columns) * height, channels: 3, background: '#9cc' } })
  .composite(placed)
  .jpeg({ quality: 85 })
  .toFile(out);
console.log(`Wrote ${out}`);
