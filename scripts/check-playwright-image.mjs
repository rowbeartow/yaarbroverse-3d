// The browser checks on GitHub run inside Playwright's container image, which
// holds the test browsers for one exact version of Playwright. This fails,
// with a plain message, if the image named in the checks workflow is not for
// the version of Playwright that package.json installs.
//
//   node scripts/check-playwright-image.mjs

import { readFileSync } from 'node:fs';

const wanted = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).devDependencies['@playwright/test'];
const installed = JSON.parse(
  readFileSync(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'),
).version;
const workflow = readFileSync(new URL('../.github/workflows/checks.yml', import.meta.url), 'utf8');
const images = [...workflow.matchAll(/image:\s*mcr\.microsoft\.com\/playwright:v([0-9.]+)-/g)].map((match) => match[1]);

const problems = [];
if (!/^\d+\.\d+\.\d+$/.test(wanted)) problems.push(`package.json must name one exact Playwright version, not "${wanted}".`);
if (installed !== wanted) problems.push(`package.json asks for Playwright ${wanted} but ${installed} is installed.`);
if (images.length === 0) problems.push('No Playwright container image is named in .github/workflows/checks.yml.');
for (const image of images) {
  if (image !== wanted) problems.push(`A container image in checks.yml is for Playwright ${image}, but package.json installs ${wanted}.`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error('Change package.json, package-lock.json and the image lines in checks.yml together.');
  process.exit(1);
}
console.log(`Playwright ${wanted}: package.json, the installed copy and ${images.length} container image lines agree.`);
