// Measures what a visit downloads before Play works, and how long that takes
// on a home connection. Used to compare start-up before and after a change
// to what loads when.
//
//   npm run build
//   npx vite preview --port 4173 --strictPort        (in another terminal)
//   node tools/startup-measure.mjs [address] [megabits a second] [runs]
//
// It opens the game in Chromium with nothing cached and the connection held
// to the given speed (20 megabits a second and 40 ms each way unless told
// otherwise), waits until Play works and nothing more is arriving, and prints
// the bytes that came down, by kind, and the seconds each took. The test
// machine has no graphics card, so the seconds are slower than a real device;
// compare them with each other, not with a stopwatch.
import { chromium } from 'playwright';

const address = process.argv[2] ?? 'http://localhost:4173/';
const megabits = Number(process.argv[3] ?? 20);
const runs = Number(process.argv[4] ?? 3);
const kindOf = (url) => {
  const path = new URL(url).pathname;
  if (path.includes('/media/audio/')) return 'sound';
  if (path.includes('/media/models/')) return 'models';
  if (path.includes('/media/textures/') || path.includes('/media/hdri/')) return 'textures and light';
  if (/\.(js|css|html|wasm)$/.test(path) || path.endsWith('/')) return 'code';
  return 'other';
};

const one = async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: (megabits * 1e6) / 8, uploadThroughput: (megabits * 1e6) / 8 });
  const urls = new Map();
  const done = [];
  cdp.on('Network.requestWillBeSent', (event) => urls.set(event.requestId, event.request.url));
  cdp.on('Network.loadingFinished', (event) => done.push({ url: urls.get(event.requestId) ?? '', bytes: event.encodedDataLength, at: Date.now() }));
  const start = Date.now();
  await page.goto(address);
  await page.waitForFunction(() => window.__grove?.ready === true, null, { timeout: 180_000 });
  const ready = Date.now();
  // Sound files arrive on their own; wait until nothing has come down for a second and a half.
  let last = done.length;
  for (;;) {
    await page.waitForTimeout(1500);
    if (done.length === last) break;
    last = done.length;
  }
  await browser.close();
  const sum = (list) => list.reduce((total, item) => total + item.bytes, 0);
  const kinds = {};
  for (const item of done) (kinds[kindOf(item.url)] ??= []).push(item);
  return {
    readySeconds: (ready - start) / 1000,
    allSeconds: (Math.max(...done.map((item) => item.at)) - start) / 1000,
    files: done.length,
    bytes: sum(done),
    kinds: Object.fromEntries(Object.entries(kinds).map(([kind, list]) => [kind, { files: list.length, bytes: sum(list) }])),
  };
};

const results = [];
for (let i = 0; i < runs; i += 1) results.push(await one());
results.sort((a, b) => a.allSeconds - b.allSeconds);
const middle = results[Math.floor(results.length / 2)];
const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;
console.log(`${address} at ${megabits} megabits a second, the middle of ${runs} runs:`);
console.log(`  Play works after ${middle.readySeconds.toFixed(1)} s; everything has arrived after ${middle.allSeconds.toFixed(1)} s`);
console.log(`  ${middle.files} files, ${mb(middle.bytes)}`);
for (const [kind, { files, bytes }] of Object.entries(middle.kinds).sort((a, b) => b[1].bytes - a[1].bytes)) console.log(`    ${kind.padEnd(20)} ${String(files).padStart(3)} files  ${mb(bytes)}`);
