// Makes enemy model candidates from words, through Meshy's API: a reference
// picture from each description (Text to Image), then a textured model from
// each picture (Image to 3D). This is how the crocodile candidates were made.
// Nothing is rigged: see tools/rig-quadruped.py and its like for that.
//
//   node tools/meshy-text-to-3d.mjs <plan.json> <folder>
//
//   plan.json   { "name": "crocodile", "candidates": [{ "label", "prompt" }, ...] }
//               (`tools/crocodile.candidates.json` is the crocodile's)
//   folder      a scratch folder, never the repo. It gets <name>-<letter>.png
//               (each reference picture), <name>-<letter>.glb (each model),
//               <name>-ref.png (the pictures side by side, for the candidates
//               page) and <name>.candidates.json, which tools/preview/candidates.mjs reads.
//
// The key: none in a cloud session whose environment holds the Meshy key as a
// network secret; run it as `NODE_USE_ENV_PROXY=1 node tools/...`. Anywhere
// else, put the key in MESHY_API_KEY. It never prints or saves a key, nor the
// signed download addresses Meshy returns.
//
// Credits (Meshy's prices on 2026-11-14): a picture from the GPT image model 9,
// a textured model 30. It prints the balance before and after, and stops
// before starting if the plan would cost more than MESHY_MAX_CREDITS (default 150).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [planFile, folder] = process.argv.slice(2);
if (!planFile || !folder) {
  console.error('Usage: node tools/meshy-text-to-3d.mjs <plan.json> <folder>');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const cost = plan.candidates.length * (9 + 30);
const limit = Number(process.env.MESHY_MAX_CREDITS ?? 150);
if (cost > limit) {
  console.error(`This plan costs about ${cost} credits, over the limit of ${limit}. Set MESHY_MAX_CREDITS to allow it.`);
  process.exit(1);
}

const api = 'https://api.meshy.ai/openapi/v1';
const headers = { 'Content-Type': 'application/json' };
if (process.env.MESHY_API_KEY) headers.Authorization = `Bearer ${process.env.MESHY_API_KEY}`;
const call = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, { ...options, headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`Meshy said ${response.status} to ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
};
const wait = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));
const finished = async (kind, id, label) => {
  for (;;) {
    const task = await call(`/${kind}/${id}`);
    if (task.status === 'SUCCEEDED') return task;
    if (task.status === 'FAILED' || task.status === 'CANCELED') throw new Error(`${label}: ${task.status} ${JSON.stringify(task.task_error)}`);
    await wait(6);
  }
};
const download = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`A download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

mkdirSync(folder, { recursive: true });
const before = (await call('/balance')).balance;
console.log(`Credits before: ${before}`);
const name = plan.name;
const list = [];
const save = () => writeFileSync(join(folder, `${name}.candidates.json`), `${JSON.stringify(list, null, 2)}\n`);

// The pictures first, all at once.
const pictures = await Promise.all(
  plan.candidates.map(async (candidate, index) => {
    const letter = String.fromCharCode(97 + index);
    const { result } = await call('/text-to-image', {
      method: 'POST',
      body: JSON.stringify({ ai_model: 'gpt-image-2', prompt: candidate.prompt, aspect_ratio: '4:3', remove_background: true }),
    });
    const task = await finished('text-to-image', result, `${name} ${letter} picture`);
    const bytes = await download(task.image_urls[0]);
    writeFileSync(join(folder, `${name}-${letter}.png`), bytes);
    console.log(`${name} ${letter} (${candidate.label}): picture saved`);
    return { letter, candidate, task: result, bytes };
  }),
);

// The pictures side by side, for the candidates page.
const tiles = await Promise.all(pictures.map((p) => sharp(p.bytes).resize(400, 300, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer()));
await sharp({ create: { width: 400 * tiles.length, height: 300, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((input, i) => ({ input, left: i * 400, top: 0 })))
  .png()
  .toFile(join(folder, `${name}-ref.png`));

// Then a model from each picture: textured, triangles, about 30 thousand of them, as the other enemies were made.
const settings = { ai_model: 'latest', should_texture: true, should_remesh: true, topology: 'triangle', target_polycount: 30000 };
await Promise.all(
  pictures.map(async ({ letter, candidate, task: pictureTask, bytes }) => {
    const entry = { letter, label: candidate.label, prompt: candidate.prompt, pictureTask, settings, file: `${name}-${letter}.glb` };
    list.push(entry);
    try {
      const image = `data:image/png;base64,${bytes.toString('base64')}`;
      const { result } = await call('/image-to-3d', { method: 'POST', body: JSON.stringify({ image_url: image, ...settings }) });
      entry.task = result;
      save();
      const task = await finished('image-to-3d', result, `${name} ${letter} model`);
      const model = await download(task.model_urls.glb);
      writeFileSync(join(folder, entry.file), model);
      entry.megabytes = Number((model.length / (1024 * 1024)).toFixed(2));
      console.log(`${name} ${letter}: saved ${entry.file} (${entry.megabytes} MB)`);
    } catch (error) {
      entry.failed = error.message;
      console.log(`${name} ${letter}: failed (${entry.failed})`);
    }
    save();
  }),
);
list.sort((a, b) => a.letter.localeCompare(b.letter));
save();
const after = (await call('/balance')).balance;
console.log(`Credits after: ${after}. Spent: ${before - after}.`);
