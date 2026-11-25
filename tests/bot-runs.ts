// Which test files play the game with a bot.
//
// A bot playing a whole level takes a second or two on a fast machine and many
// times that on a busy one, so those tests have a time limit of their own
// (BOT_RUN_LIMIT) and, on GitHub, a job of their own ("Whole-level bot runs" in
// .github/workflows/checks.yml). Every other rule test keeps the usual 5 seconds.
//
// Nobody keeps a list: a test file is a bot run if it uses one of the helpers
// that play the game (PLAYERS), or a helper built on one of them. `npm test`
// runs both kinds; `npm run test:rules` and `npm run test:bot` run one.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The helpers in tests/helpers that play the game: the bot, the keyboard player, the fishing bot, and the hero dropped in the water. */
export const PLAYERS = ['bot', 'keyboard', 'fisher', 'water-exit'];

/** How long one bot-run test may take, in milliseconds: five minutes. The slowest takes about 7 seconds here. */
export const BOT_RUN_LIMIT = 300_000;

/** The helpers a file uses, by name. */
const helpersUsed = (file: string, prefix: string): string[] =>
  [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)]
    .map((found) => found[1])
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length));

/** The test files that play the game with a bot, as paths from the repo's root. */
export const botRunFiles = (root = '.'): string[] => {
  const tests = join(root, 'tests');
  const helpers = join(tests, 'helpers');
  // A helper built on a player is a player too.
  const players = new Set(PLAYERS);
  for (let grew = true; grew; ) {
    grew = false;
    for (const file of readdirSync(helpers)) {
      const name = file.replace(/\.ts$/, '');
      if (!players.has(name) && helpersUsed(join(helpers, file), './').some((used) => players.has(used))) {
        players.add(name);
        grew = true;
      }
    }
  }
  return readdirSync(tests)
    .filter((file) => file.endsWith('.test.ts'))
    .filter((file) => helpersUsed(join(tests, file), './helpers/').some((used) => players.has(used)))
    .sort()
    .map((file) => `tests/${file}`);
};
