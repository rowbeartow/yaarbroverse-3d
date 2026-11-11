// Asks Meshy to turn one picture into 3D models, and saves each model.
// This is how the enemy model candidates are made. It never rigs: Meshy's
// rigging only handles humanoids, so tools/rig-quadruped.py and its like do that.
//
//   node tools/meshy-image-to-3d.mjs <picture.png> <folder> <name> [plan.json]
//
//   picture.png   the reference picture: one character, cut out, no background
//   folder        where the models go, as <name>-a.glb, <name>-b.glb, ...,
//                 with a copy of the picture as <name>-ref.png.
//                 Use a scratch folder: originals are never committed.
//   name          marmot, mosquito, ...
//   plan.json     optional. A list of Meshy settings, one entry per candidate.
//                 Without it, three candidates are made (see `plan` below).
//
// The key: none is needed in a cloud session whose environment holds the
// Meshy key as a network secret, because the proxy adds it to every call to
// api.meshy.ai. There, run it as `NODE_USE_ENV_PROXY=1 node tools/...`: without
// that, Node does not send its calls through the proxy. Anywhere else, put the key in the MESHY_API_KEY environment
// variable. This script never prints or saves a key, and never prints the
// download addresses Meshy returns (they are signed).
//
// Credits: it prints the balance before and after, and what was spent. A
// textured model costs 30 credits. It stops before starting if the plan would
// cost more than MESHY_MAX_CREDITS (default 100).
//
// It also writes <folder>/<name>.candidates.json: each candidate's letter,
// settings and Meshy task number, so a pick can be traced back.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [picture, folder, name, planFile] = process.argv.slice(2);
if (!picture || !folder || !name) {
  console.error('Usage: node tools/meshy-image-to-3d.mjs <picture.png> <folder> <name> [plan.json]');
  process.exit(1);
}

const api = 'https://api.meshy.ai/openapi/v1';
const creditsEach = 30;
const limit = Number(process.env.MESHY_MAX_CREDITS ?? 100);

// Every candidate: textured, triangles, about 30 thousand of them (the build
// makes it smaller still), no pose forced on it.
const shared = { should_texture: true, should_remesh: true, topology: 'triangle', target_polycount: 30000 };
const plan = planFile
  ? JSON.parse(readFileSync(planFile, 'utf8'))
  : [
      { label: 'Meshy 7.1', settings: { ai_model: 'latest' } },
      { label: 'Meshy 6', settings: { ai_model: 'meshy-6' } },
      { label: 'Meshy 7.1, picture left as drawn', settings: { ai_model: 'latest', image_enhancement: false } },
    ];

if (plan.length * creditsEach > limit) {
  console.error(`${plan.length} candidates cost about ${plan.length * creditsEach} credits, over the limit of ${limit}. Set MESHY_MAX_CREDITS to allow it.`);
  process.exit(1);
}

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

mkdirSync(folder, { recursive: true });
const image = `data:image/png;base64,${readFileSync(picture).toString('base64')}`;
// The picture goes beside the models, for the candidates page to show.
writeFileSync(join(folder, `${name}-ref.png`), readFileSync(picture));
const before = await balance();
console.log(`Credits before: ${before}`);

const candidates = [];
for (const [index, entry] of plan.entries()) {
  const letter = String.fromCharCode(97 + index);
  const settings = { ...shared, ...entry.settings };
  const { result } = await call('/image-to-3d', { method: 'POST', body: JSON.stringify({ image_url: image, ...settings }) });
  candidates.push({ letter, label: entry.label, settings, task: result, file: `${name}-${letter}.glb` });
  console.log(`${name} ${letter} (${entry.label}): started`);
}
const listFile = join(folder, `${name}.candidates.json`);
const saveList = () => writeFileSync(listFile, `${JSON.stringify(candidates, null, 2)}\n`);
saveList();

const waiting = new Set(candidates);
while (waiting.size > 0) {
  await wait(10);
  for (const candidate of [...waiting]) {
    const task = await call(`/image-to-3d/${candidate.task}`);
    if (task.status === 'SUCCEEDED') {
      const model = await fetch(task.model_urls.glb);
      if (!model.ok) throw new Error(`Could not download ${candidate.file}: ${model.status}`);
      const bytes = Buffer.from(await model.arrayBuffer());
      writeFileSync(join(folder, candidate.file), bytes);
      candidate.megabytes = Number((bytes.length / (1024 * 1024)).toFixed(2));
      console.log(`${name} ${candidate.letter}: saved ${candidate.file} (${candidate.megabytes} MB)`);
      waiting.delete(candidate);
    } else if (task.status === 'FAILED' || task.status === 'CANCELED') {
      candidate.failed = task.task_error?.message ?? task.status;
      console.log(`${name} ${candidate.letter}: failed (${candidate.failed})`);
      waiting.delete(candidate);
    }
  }
  saveList();
}

const after = await balance();
console.log(`Credits after: ${after}. Spent: ${before - after}.`);
