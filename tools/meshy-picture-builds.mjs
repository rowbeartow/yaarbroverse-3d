// Makes model candidates for several things in one shared style, through
// Meshy's API: one reference picture for each from words (Text to Image), then
// a model from that picture with each of the plan's builds (Image to 3D), so
// the candidates differ only in how Meshy built them. This is how the fish
// candidates were made. Nothing is rigged.
//
//   node tools/meshy-picture-builds.mjs <plan.json> <folder>
//
//   plan.json   see tools/fish.candidates.json: `style` is the prompt, with
//               {words} filled in from each entry of `species`; `builds` is
//               the Meshy settings for candidate a, b, ...; `imageModel` makes
//               the pictures. `credits` and `imageCredits` are Meshy's prices.
//   folder      a scratch folder, never the repo. For each name it gets
//               <name>-ref.png, <name>-a.glb, <name>-b.glb, ... and
//               <name>.candidates.json, which tools/preview/candidates.mjs reads.
//               A picture already there is used, not made again.
//
// The key and the proxy: as tools/meshy-text-to-3d.mjs (run it as
// `NODE_USE_ENV_PROXY=1 node tools/...` in a cloud session). It never prints a
// key or a signed download address. It prints the balance before and after,
// and stops before starting if the plan costs more than MESHY_MAX_CREDITS (default 200).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [planFile, folder] = process.argv.slice(2);
if (!planFile || !folder) {
  console.error('Usage: node tools/meshy-picture-builds.mjs <plan.json> <folder>');
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const cost = plan.species.length * (plan.imageCredits + plan.builds.reduce((sum, build) => sum + build.credits, 0));
const limit = Number(process.env.MESHY_MAX_CREDITS ?? 200);
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
console.log(`Credits before: ${before}. This plan costs about ${cost}.`);
const shared = { should_texture: true, should_remesh: true, topology: 'triangle', target_polycount: 30000 };

await Promise.all(
  plan.species.map(async (species) => {
    const { name } = species;
    const prompt = plan.style.replace(/\{(\w+)\}/g, (_, word) => species[word] ?? '');
    const pictureFile = join(folder, `${name}-ref.png`);
    let pictureTask = null;
    if (!existsSync(pictureFile)) {
      const { result } = await call('/text-to-image', {
        method: 'POST',
        body: JSON.stringify({ ai_model: plan.imageModel, prompt, aspect_ratio: '4:3', remove_background: true }),
      });
      pictureTask = result;
      const task = await finished('text-to-image', result, `${name} picture`);
      writeFileSync(pictureFile, await download(task.image_urls[0]));
      console.log(`${name}: picture saved`);
    }
    if (process.env.PICTURES_ONLY) return;
    const image = `data:image/png;base64,${readFileSync(pictureFile).toString('base64')}`;
    const list = [];
    const save = () => writeFileSync(join(folder, `${name}.candidates.json`), `${JSON.stringify(list, null, 2)}\n`);
    await Promise.all(
      plan.builds.map(async (build, index) => {
        const letter = String.fromCharCode(97 + index);
        const settings = { ...shared, ...build.settings };
        const entry = { letter, label: build.label, prompt, pictureTask, settings, file: `${name}-${letter}.glb` };
        list.push(entry);
        try {
          const { result } = await call('/image-to-3d', { method: 'POST', body: JSON.stringify({ image_url: image, ...settings }) });
          entry.task = result;
          save();
          const task = await finished('image-to-3d', result, `${name} ${letter} model`);
          const model = await download(task.model_urls.glb);
          writeFileSync(join(folder, entry.file), model);
          entry.megabytes = Number((model.length / (1024 * 1024)).toFixed(2));
          console.log(`${name} ${letter} (${build.label}): saved ${entry.file} (${entry.megabytes} MB)`);
        } catch (error) {
          entry.failed = error.message;
          console.log(`${name} ${letter}: failed (${entry.failed})`);
        }
        list.sort((a, b) => a.letter.localeCompare(b.letter));
        save();
      }),
    );
  }),
);
const after = (await call('/balance')).balance;
console.log(`Credits after: ${after}. Spent: ${before - after}.`);
