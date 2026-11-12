// Adds up everything in dist/ (what a player downloads) and fails the build if
// it goes over the budget of 20 MB (see docs/decisions.md), or if the sound
// and music in it go over 4 MB.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_MB = 20;
const AUDIO_BUDGET_MB = 4;
const files = [];
const walk = (folder) => {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push({ path, bytes: statSync(path).size });
  }
};
walk('dist');
const total = files.reduce((sum, file) => sum + file.bytes, 0);
for (const file of files.sort((a, b) => b.bytes - a.bytes)) {
  console.log(`${(file.bytes / 1024).toFixed(1).padStart(9)} KB  ${file.path}`);
}
const megabytes = total / (1024 * 1024);
console.log(`Total download: ${megabytes.toFixed(2)} MB (budget ${BUDGET_MB} MB)`);
const audio = files.filter((file) => /[\\/]audio[\\/]/.test(file.path)).reduce((sum, file) => sum + file.bytes, 0) / (1024 * 1024);
console.log(`Sound and music: ${audio.toFixed(2)} MB (budget ${AUDIO_BUDGET_MB} MB)`);
if (audio > AUDIO_BUDGET_MB) {
  console.error(`Sound and music are over the ${AUDIO_BUDGET_MB} MB budget.`);
  process.exit(1);
}
if (megabytes > BUDGET_MB) {
  console.error(`Over the ${BUDGET_MB} MB budget.`);
  process.exit(1);
}
