// Measures Yaarbro's fishing clips on the enemies preview page (see
// enemies.mjs), every frame of each (30 a second), and fails if what he holds
// is not where it should be. A session cannot watch a clip move, and a still
// frame shows one moment from one side: this checks all of them.
//
//   node tools/preview/fishing-measure.mjs [hero]
//
// Serve the page first: `npx vite preview --outDir <folder> --port 4176`. The
// page must have been built with the four fish he can land
// (`held-bass=<the rigged bass>` and the other three).
//
// What it checks (the measuring itself is `measureClip` in tackle.ts):
//   - The grip points are in the middle of his palms: on the skin, and well
//     along the hand from the wrist.
//   - The rod is at the grip point of his right palm in every frame he has it
//     (all of the cast, all of the reel, and "Landed" until he lets go), and
//     at his left palm's too whenever both hands are on it.
//   - The landed fish lies on its side on both palms' grip points, palms up
//     and fingers pointing outward as under a tray, from the
//     moment he catches it to the end, and ends up above his head. Every
//     catch on the page is tried.
//   - No point of the rod, the reel, the line or the fish is inside his body
//     or his head in any frame. His hands are not counted: they hold it.
//   - A hero who holds the rod in his jaws (Caputo) has one grip point,
//     between his teeth: the rod runs through it whenever he holds it, the
//     part of it inside his mouth is not counted as passing through him, and
//     his landed fish ends up lying on the boards in front of him.
//   - Reeling: the rod points along the line, the reel hangs under the rod
//     with its axle level, his palms are at his waist, the line gets shorter,
//     the reel turns, the rod bends, and he leans back and sways.
//
// Lengths are centimetres at his size in the game (2.2 m tall).

import { chromium } from 'playwright';

const hero = process.argv[2] ?? 'yaarbro';
const LIMITS = {
  palmFromSkin: 1,
  palmAlongHand: [0.25, 0.65],
  rodFromRight: 0.5,
  rodFromLeft: 1.5,
  fishFromPalm: 1.5,
  palmsOffUp: 25,
  fingersOffOut: 20,
  headingOff: 3,
  reelOffUnder: 20,
  axleOffLevel: 15,
  palmsAboveHips: [-20, 35],
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 760, height: 900 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (error) => console.error(`Page error: ${error.message}`));
await page.goto('http://localhost:4176/?plain&still');
await page.waitForFunction(() => document.documentElement.dataset.ready === 'true', null, { timeout: 180000 });
const measure = (clip, caught = 0) => page.evaluate(([name, which, index]) => window.preview.measure(name, which, index), [hero, clip, caught]);
const catches = await page.evaluate(() => [...document.querySelectorAll('[aria-label="The fish he lands"] button')].length);

const failures = [];
const check = (clip, what, ok, found) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}: ${found}`);
  if (!ok) failures.push(`${clip}: ${what} (${found})`);
};
const one = (value) => (value === null ? 'never held' : `${value.toFixed(2)} cm`);
const through = (clip, found) => {
  for (const [thing, entry] of Object.entries(found.through)) {
    check(
      clip,
      `no point of the ${thing} is inside his body or head`,
      entry.frames === 0,
      entry.frames === 0 ? `0 of ${found.frames} frames` : `${entry.frames} of ${found.frames} frames, first at frame ${entry.first}, up to ${entry.worst} points, in his ${entry.parts.join(', ')}`,
    );
  }
};

const cast = await measure('fish_cast');
if (!cast) throw new Error(`The page has no fishing clips for ${hero}`);
// A hero with no palm grips holds the rod in his jaws (Caputo): one grip point, between his teeth.
const jaws = cast.palms.length === 0;
const where = jaws ? 'in his jaws' : 'at his right palm';
console.log(jaws ? 'He holds the rod in his jaws' : 'Grip points (measured in the first frame of the cast)');
for (const palm of cast.palms) {
  check('grips', `${palm.hand}: on the skin of the palm`, palm.fromSkin <= LIMITS.palmFromSkin, `${palm.fromSkin.toFixed(2)} cm from it`);
  check(
    'grips',
    `${palm.hand}: in the middle of the hand, not at the wrist`,
    palm.alongHand >= LIMITS.palmAlongHand[0] && palm.alongHand <= LIMITS.palmAlongHand[1],
    `${Math.round(palm.alongHand * 100)}% of the way from wrist to fingertips, ${palm.fromWrist.toFixed(1)} cm from the wrist`,
  );
}

console.log(`Cast (${cast.frames} frames)`);
check('cast', `the rod is ${where} in every frame`, cast.rodFromRight !== null && cast.rodFromRight <= LIMITS.rodFromRight, `at most ${one(cast.rodFromRight)} off`);
through('cast', cast);

const reel = await measure('fish_reel');
console.log(`Reel (${reel.frames} frames)`);
check('reel', `the rod is ${where} in every frame`, reel.rodFromRight !== null && reel.rodFromRight <= LIMITS.rodFromRight, `at most ${one(reel.rodFromRight)} off`);
if (!jaws) check('reel', 'the rod is at his left palm in every frame', reel.rodFromLeft !== null && reel.rodFromLeft <= LIMITS.rodFromLeft, `at most ${one(reel.rodFromLeft)} off`);
check('reel', 'the rod points along the line', reel.reel.headingOff <= LIMITS.headingOff, `at most ${reel.reel.headingOff.toFixed(1)} degrees off`);
check('reel', 'the reel hangs under the rod', reel.reel.reelOffUnder <= LIMITS.reelOffUnder, `at most ${reel.reel.reelOffUnder.toFixed(1)} degrees off straight under`);
check('reel', 'the reel faces sideways', reel.reel.axleOffLevel <= LIMITS.axleOffLevel, `its axle at most ${reel.reel.axleOffLevel.toFixed(1)} degrees off level`);
if (!jaws) check(
  'reel',
  'his palms are at his waist',
  reel.reel.palmsAboveHips[0] >= LIMITS.palmsAboveHips[0] && reel.reel.palmsAboveHips[1] <= LIMITS.palmsAboveHips[1],
  `${reel.reel.palmsAboveHips.map((value) => value.toFixed(0)).join(' to ')} cm above his hip joint`,
);
check('reel', 'the reel turns', reel.reel.turns > 1, `${reel.reel.turns.toFixed(1)} turns a loop`);
check('reel', 'the line shortens', reel.reel.line[1] - reel.reel.line[0] > 30, `${reel.reel.line[1].toFixed(0)} cm down to ${reel.reel.line[0].toFixed(0)} cm in one loop`);
check('reel', 'the rod bends', reel.reel.bend[0] > 10, `its tip ${reel.reel.bend.map((value) => value.toFixed(0)).join(' to ')} cm off the line of the handle`);
if (jaws) check('reel', 'he is hauled about as the fish pulls', reel.reel.upSwing > 3 && reel.reel.sideSwing > 4, `his head goes ${reel.reel.upSwing.toFixed(0)} cm up and down and ${reel.reel.sideSwing.toFixed(0)} cm side to side over his hips`);
else check('reel', 'he leans back and sways', reel.reel.leanSwing > 4 && reel.reel.sideSwing > 4, `his head moves ${reel.reel.leanSwing.toFixed(0)} cm front to back and ${reel.reel.sideSwing.toFixed(0)} cm side to side over his hips`);
through('reel', reel);
if (!jaws) console.log(`  (straight under the rod as he starts to reel is ${JSON.stringify(reel.reel.hangs)} in his right hand's own space: "reel" in the guide's grips)`);

for (let caught = 0; caught < Math.max(1, catches); caught += 1) {
  const landed = await measure('fish_show', caught);
  console.log(`Landed, ${landed.landed.fishKind} (${landed.frames} frames)`);
  check('landed', 'the fish starts under the water', landed.landed.startsUnderWater, landed.landed.startsUnderWater ? 'yes' : 'no');
  check('landed', `the rod is ${where} until he lets go`, landed.rodFromRight !== null && landed.rodFromRight <= LIMITS.rodFromRight, `at most ${one(landed.rodFromRight)} off`);
  if (jaws) {
    const down = landed.landed.onBoards;
    check('landed', 'the fish ends up lying on the boards', down.frames > 10 && down.offBoards <= 1.5, `for the last ${down.frames} frames, its underside at most ${down.offBoards.toFixed(2)} cm off them`);
    check('landed', 'the fish lies in front of him', down.ahead > 0, `at least ${down.ahead.toFixed(0)} cm ahead of the front of him`);
  } else {
    check('landed', 'the fish lies on his right palm', landed.fishFromRight !== null && landed.fishFromRight <= LIMITS.fishFromPalm, `at most ${one(landed.fishFromRight)} off`);
    check('landed', 'the fish lies on his left palm', landed.fishFromLeft !== null && landed.fishFromLeft <= LIMITS.fishFromPalm, `at most ${one(landed.fishFromLeft)} off`);
    check('landed', 'his palms are turned up under it', landed.palmsOffUp !== null && landed.palmsOffUp <= LIMITS.palmsOffUp, `at most ${landed.palmsOffUp?.toFixed(1)} degrees off straight up`);
    check('landed', 'his fingers point outward, as under a tray', landed.fingersOffOut !== null && landed.fingersOffOut <= LIMITS.fingersOffOut, `at most ${landed.fingersOffOut?.toFixed(1)} degrees off straight out to each side`);
    check('landed', 'the fish ends up over his head', landed.landed.aboveHead > 0, `its lowest point ${landed.landed.aboveHead.toFixed(0)} cm above the top of his head`);
    console.log(`        (on his palms from frame ${Math.ceil(0.4 * (landed.frames - 1))})`);
  }
  through('landed', landed);
}
await browser.close();

if (failures.length > 0) {
  console.error(`\n${failures.length} failed:\n${failures.map((line) => `  ${line}`).join('\n')}`);
  process.exit(1);
}
console.log('\nEvery check passed.');
