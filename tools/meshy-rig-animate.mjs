// Rigs a character with Meshy's Rigging API and gives it clips from Meshy's
// Animation API: some from its library, and some made from words with Text
// to Motion. This is how Yaarbro's swimming clips were made.
//
//   node tools/meshy-rig-animate.mjs <plan.json> <folder>
//
//   plan.json   what to ask for:
//                 model_url       the character, a GLB at an http(s) address
//                                 (Yaarbro: one of his files on the hero-models release)
//                 height_meters   about how tall it is
//                 library         [{ "name": "tread", "action_id": 568 }, ...]
//                 motions         [{ "name": "underwater", "prompt": "...", "duration": 4 }, ...]
//               `tools/yaarbro.swim.json` is Yaarbro's.
//   folder      a scratch folder. It gets <name>.glb for each clip (each the
//               rigged character with that one clip, the way his other Meshy
//               files are), rigged.glb, and meshy.json with every task number.
//               Never the repo: originals are not committed.
//
// The key: none is needed in a cloud session whose environment holds the
// Meshy key as a network secret. Run it as `NODE_USE_ENV_PROXY=1 node tools/...`.
// Anywhere else, put the key in MESHY_API_KEY. It never prints or saves a key,
// and never prints the download addresses Meshy returns (they are signed).
//
// Credits (Meshy's prices on 2026-11-14): rigging 5, each library clip 3,
// each Text to Motion clip 10 to make and 3 to put on the rig. It prints the
// balance before and after, and stops before starting if the plan would cost
// more than MESHY_MAX_CREDITS (default 100).
//
// Then: `blender -b -P tools/prepare-rigged.py -- <folder> <out.glb> tools/yaarbro.guide.json`
// puts these clips beside his others (the guide names each file).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [planFile, folder] = process.argv.slice(2);
if (!planFile || !folder) {
  console.error('Usage: node tools/meshy-rig-animate.mjs <plan.json> <folder>');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const library = plan.library ?? [];
const motions = plan.motions ?? [];
const cost = 5 + library.length * 3 + motions.length * 13;
const limit = Number(process.env.MESHY_MAX_CREDITS ?? 100);
if (cost > limit) {
  console.error(`This plan costs about ${cost} credits, over the limit of ${limit}. Set MESHY_MAX_CREDITS to allow it.`);
  process.exit(1);
}

const api = 'https://api.meshy.ai/openapi/v1';
const headers = { 'Content-Type': 'application/json' };
if (process.env.MESHY_API_KEY) headers.Authorization = `Bearer ${process.env.MESHY_API_KEY}`;

async function call(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`Meshy said ${response.status} to ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
const balance = async () => (await call('/balance')).balance;
const wait = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/** Waits for a task to finish and returns it. */
async function finished(kind, id, label) {
  for (;;) {
    const task = await call(`/${kind}/${id}`);
    if (task.status === 'SUCCEEDED') {
      console.log(`${label}: done (${task.consumed_credits ?? '?'} credits)`);
      return task;
    }
    if (task.status === 'FAILED' || task.status === 'CANCELED') throw new Error(`${label} ${task.status}: ${JSON.stringify(task.task_error)}`);
    await wait(5);
  }
}

async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download of ${file} failed: ${response.status}`);
  writeFileSync(join(folder, file), Buffer.from(await response.arrayBuffer()));
  console.log(`saved ${file}`);
}

mkdirSync(folder, { recursive: true });
const record = { plan: planFile, tasks: {} };
const save = () => writeFileSync(join(folder, 'meshy.json'), `${JSON.stringify(record, null, 2)}\n`);
const before = await balance();
console.log(`Credits before: ${before}`);

// 1. The rig: Meshy's default skeleton.
const { result: rigId } = await call('/rigging', { method: 'POST', body: JSON.stringify({ model_url: plan.model_url, height_meters: plan.height_meters ?? 1.7 }) });
record.tasks.rig = rigId;
save();
const rig = await finished('rigging', rigId, 'rig');
await download(rig.result.rigged_character_glb_url, 'rigged.glb');

// 2. Text to Motion clips are made while the library clips are put on the rig.
const motionIds = [];
for (const motion of motions) {
  const { result } = await call('/text-to-motion', { method: 'POST', body: JSON.stringify({ prompt: motion.prompt, duration: motion.duration, mode: 'prime' }) });
  motionIds.push(result);
  record.tasks[`motion:${motion.name}`] = result;
  save();
}

// 3. Each library clip on the rig, one file each.
for (const clip of library) {
  const { result } = await call('/animations', { method: 'POST', body: JSON.stringify({ rig_task_id: rigId, action_id: clip.action_id }) });
  record.tasks[`clip:${clip.name}`] = result;
  save();
  const task = await finished('animations', result, `${clip.name} (library ${clip.action_id})`);
  await download(task.result.animation_glb_url, `${clip.name}.glb`);
}

// 4. Each Text to Motion clip on the rig.
for (const [i, motion] of motions.entries()) {
  await finished('text-to-motion', motionIds[i], `${motion.name} (made from words)`);
  const { result } = await call('/animations', { method: 'POST', body: JSON.stringify({ rig_task_id: rigId, motion_task_id: motionIds[i] }) });
  record.tasks[`clip:${motion.name}`] = result;
  save();
  const task = await finished('animations', result, `${motion.name} on the rig`);
  await download(task.result.animation_glb_url, `${motion.name}.glb`);
}

const after = await balance();
record.credits = { before, after, spent: before - after };
save();
console.log(`Credits after: ${after} (spent ${before - after})`);
