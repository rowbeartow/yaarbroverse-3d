// Measures how well the hero's paws hold the ground on the preview page, for
// judging gait changes here, where nothing can be watched at speed.
//
//   node tools/preview/measure.mjs
//
// First build the page (build.mjs) and serve it in another terminal:
//   npx vite preview --outDir <folder> --port 4174
//
// It drives the game's own animation player at a pace, or from one pace to
// another, in steps of a sixtieth of a second, and follows the toes of every
// paw. For each case it prints:
//   slide   how far a paw that is on the ground moves against the ground: in
//           centimetres for each metre he travels at a steady pace, and in
//           centimetres in all for a change of pace (over the 0.6 seconds
//           after it, averaged over the paws). Nothing is ever exactly 0:
//           a clip played faster or slower than it was made for slides a little.
//           A change of gait slides more for the moment the two gaits are mixed.
//   clocks  the furthest apart the walk, trot and run clips get, as a share of
//           a cycle. They must stay together, or a change of gait would skip.

import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 760, height: 900 } });
page.on('pageerror', (error) => console.log(`page error: ${error.message}`));
await page.goto(`http://localhost:${process.env.PORT || 4174}/index.html?plain&still`);
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 120_000 });

const cases = [
  ['walk, steady (pace 0.22)', [[0.22, 4]]],
  ['walk, fast (pace 0.32)', [[0.32, 4]]],
  ['trot, slow (pace 0.36)', [[0.5, 1], [0.36, 4]]],
  ['trot, steady (pace 0.5)', [[0.5, 4]]],
  ['trot, fast (pace 0.66)', [[0.5, 1], [0.66, 4]]],
  ['run, slow (pace 0.7)', [[0.7, 4]]],
  ['run, top speed (pace 1)', [[1, 4]]],
  ['walk to trot', [[0.25, 2], [0.5, 0.6]], 2],
  ['trot to run', [[0.5, 2], [1, 0.6]], 2],
  ['run to trot', [[1, 2], [0.5, 0.6]], 2],
  ['trot to walk', [[0.5, 2], [0.25, 0.6]], 2],
  ['standing to top speed', [[0, 1], [1, 0.6]], 1],
];

const run = ([plan, from]) => {
      const { stage } = window.__preview;
      stage.choose(stage.choice.id === 'game' ? stage.choice : { id: 'game' });
      const hero = stage.hero;
      const topSpeed = 6;
      const paws = [];
      hero.root.traverse((node) => {
        if (/_paw_[lr]$/.test(node.name)) paws.push(node);
      });
      const length = (paw) => paw.children.length ? 0 : paw.name.startsWith('front') ? 0.253 : 0.267;
      const toe = (paw) => {
        paw.updateWorldMatrix(true, false);
        const e = paw.matrixWorld.elements;
        const l = length(paw);
        return { y: e[13] + e[5] * l, z: e[14] + e[6] * l };
      };
      hero.root.updateMatrixWorld(true);
      // The height of each toe on the ground: its lowest over a spell of
      // steady walking, found once. Each case then starts from a standstill.
      const floor = (window.__floor ??= (() => {
        const lowest = {};
        for (let i = 0; i < 600; i += 1) {
          hero.animate({ pace: 0.22, grounded: true, rise: 0 }, 1 / 120);
          if (i > 240) for (const paw of paws) lowest[paw.name] = Math.min(lowest[paw.name] ?? Infinity, toe(paw).y);
        }
        return lowest;
      })());
      for (let i = 0; i < 120; i += 1) hero.animate({ pace: 0, grounded: true, rise: 0 }, 1 / 60);
      let time = 0;
      let slid = 0;
      let travelled = 0;
      let apart = 0;
      const last = {};
      const dt = 1 / 240;
      for (const [pace, seconds] of plan) {
        for (let t = 0; t < seconds; t += dt) {
          hero.animate({ pace, grounded: true, rise: 0 }, dt);
          time += dt;
          const measured = time > from;
          const shares = ['walk', 'trot', 'run'].map((role) => hero.actions[role]).filter(Boolean).map((action) => (action.time / action.getClip().duration) % 1);
          for (const a of shares) for (const b of shares) apart = Math.max(apart, Math.abs(((a - b + 0.5) % 1 + 1) % 1 - 0.5));
          if (measured) travelled += pace * topSpeed * dt;
          for (const paw of paws) {
            const at = toe(paw);
            const before = last[paw.name];
            // On the ground now and a moment ago: it should have moved back exactly as far as the ground did.
            if (measured && before && at.y < floor[paw.name] + 0.003 && before.y < floor[paw.name] + 0.003) {
              slid += Math.abs(at.z - before.z + pace * topSpeed * dt) / paws.length;
            }
            last[paw.name] = at;
          }
        }
      }
      return { all: slid * 100, slide: travelled ? (slid / travelled) * 100 : 0, apart, gait: hero.gait, scale: Math.hypot(...paws[0].matrixWorld.elements.slice(4, 7)) };
    };

let size = 1;
for (const [label, plan, from = 1] of cases) {
  const change = plan.length > 1 && (from > 1 || label.startsWith('standing'));
  // A change of gait is tried at twelve different moments of the stride, and the results averaged.
  const tries = change ? 12 : 1;
  let slide = 0;
  let all = 0;
  let worst = 0;
  let apart = 0;
  let gait = '';
  for (let i = 0; i < tries; i += 1) {
    const late = (i / tries) * 0.5;
    const result = await page.evaluate(run, [plan.map(([pace, seconds], k) => [pace, k === 0 ? seconds + late : seconds]), from + late]);
    slide += result.slide / tries;
    all += result.all / tries;
    worst = Math.max(worst, result.all);
    apart = Math.max(apart, result.apart);
    gait = result.gait;
    size = result.scale;
  }
  const slid = change ? `${all.toFixed(1).padStart(5)} cm in all (worst ${worst.toFixed(1)})` : `${slide.toFixed(1).padStart(5)} cm a metre`;
  console.log(`${label.padEnd(28)} slide ${slid}   clocks ${apart.toFixed(4)} apart   ends in ${gait}`);
}
// The speeds the rig script prints are for the size he is in his file.
console.log(`He is drawn ${size.toFixed(4)} times the size he is in his file: multiply the rig script's speeds by that for src/view/hero-model.ts.`);
await browser.close();
