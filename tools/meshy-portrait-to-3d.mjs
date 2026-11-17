// Makes model candidates of a character from a portrait that does not show
// all of them, through Meshy's API: first a full-body picture from the
// portrait and a description of what to keep and add (Image to Image), then a
// textured model from each picture (Image to 3D). This is how Walblum's
// candidates were made: his portrait stops at his folded arms.
//
//   node tools/meshy-portrait-to-3d.mjs pictures <portrait.png> <plan.json> <folder>
//   node tools/meshy-portrait-to-3d.mjs models <plan.json> <folder>
//
//   portrait.png  the character's portrait. For Walblum it is in the owner's
//                 private repo, and is never copied into this one.
//   plan.json     { "name", "candidates": [{ "label", "ai_model", "prompt" }] }
//                 (`tools/walblum.candidates.json` is Walblum's)
//   folder        a scratch folder, never the repo. `pictures` writes
//                 <name>-<letter>.png; look at them, run it again for any that
//                 are wrong, then `models` writes <name>-<letter>.glb,
//                 <name>-ref.png (the pictures side by side) and
//                 <name>.candidates.json, which tools/preview/candidates.mjs reads.
//                 `pictures` skips a letter whose picture is already there.
//
// The key: none in a cloud session whose environment holds the Meshy key as a
// network secret; run it as `NODE_USE_ENV_PROXY=1 node tools/...`. Anywhere
// else, put the key in MESHY_API_KEY. It never prints or saves a key, nor the
// signed download addresses Meshy returns.
//
// Credits: a textured model costs 30; a picture a few, by image model. It
// prints the balance before and after each step. `models` stops before
// starting if it would cost more than MESHY_MAX_CREDITS (default 100).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const [step, ...rest] = process.argv.slice(2);
const [portrait, planFile, folder] = step === 'pictures' ? rest : [null, ...rest];
if (!['pictures', 'models'].includes(step) || !planFile || !folder) {
  console.error('Usage: node tools/meshy-portrait-to-3d.mjs pictures <portrait.png> <plan.json> <folder>\n       node tools/meshy-portrait-to-3d.mjs models <plan.json> <folder>');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const name = plan.name;
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
const letters = plan.candidates.map((_, index) => String.fromCharCode(97 + index));
const tasksFile = join(folder, `${name}.pictures.json`);
const pictureTasks = existsSync(tasksFile) ? JSON.parse(readFileSync(tasksFile, 'utf8')) : {};

mkdirSync(folder, { recursive: true });
const before = (await call('/balance')).balance;
console.log(`Credits before: ${before}`);

if (step === 'pictures') {
  const reference = `data:image/png;base64,${readFileSync(portrait).toString('base64')}`;
  await Promise.all(
    plan.candidates.map(async (candidate, index) => {
      const letter = letters[index];
      const file = join(folder, `${name}-${letter}.png`);
      if (existsSync(file)) return;
      try {
        const { result } = await call('/image-to-image', {
          method: 'POST',
          body: JSON.stringify({ ai_model: candidate.ai_model, prompt: candidate.prompt, reference_image_urls: [reference], aspect_ratio: '3:4', remove_background: true }),
        });
        const task = await finished('image-to-image', result, `${name} ${letter} picture`);
        writeFileSync(file, await download(task.image_urls[0]));
        pictureTasks[letter] = result;
        console.log(`${name} ${letter} (${candidate.label}): picture saved`);
      } catch (error) {
        console.log(`${name} ${letter}: no picture (${error.message})`);
      }
    }),
  );
  writeFileSync(tasksFile, `${JSON.stringify(pictureTasks, null, 2)}\n`);
} else {
  const limit = Number(process.env.MESHY_MAX_CREDITS ?? 100);
  if (letters.length * 30 > limit) {
    console.error(`${letters.length} models cost about ${letters.length * 30} credits, over the limit of ${limit}. Set MESHY_MAX_CREDITS to allow it.`);
    process.exit(1);
  }
  const pictures = letters.map((letter) => readFileSync(join(folder, `${name}-${letter}.png`)));
  const tiles = await Promise.all(pictures.map((bytes) => sharp(bytes).resize(300, 400, { fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).png().toBuffer()));
  await sharp({ create: { width: 300 * tiles.length, height: 400, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((input, i) => ({ input, left: i * 300, top: 0 })))
    .png()
    .toFile(join(folder, `${name}-ref.png`));
  const settings = { ai_model: 'latest', should_texture: true, should_remesh: true, topology: 'triangle', target_polycount: 30000, ...plan.settings };
  const list = [];
  const save = () => writeFileSync(join(folder, `${name}.candidates.json`), `${JSON.stringify(list, null, 2)}\n`);
  await Promise.all(
    plan.candidates.map(async (candidate, index) => {
      const letter = letters[index];
      const entry = { letter, label: candidate.label, prompt: candidate.prompt, pictureModel: candidate.ai_model, pictureTask: pictureTasks[letter], settings, file: `${name}-${letter}.glb` };
      list.push(entry);
      try {
        const image = `data:image/png;base64,${pictures[index].toString('base64')}`;
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
}
const after = (await call('/balance')).balance;
console.log(`Credits after: ${after}. Spent: ${before - after}.`);
