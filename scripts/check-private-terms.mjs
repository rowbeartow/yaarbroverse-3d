// Fails if a private term appears anywhere this repo shows the public: tracked
// files and their names, the pull request's title and description, and commit
// messages. The terms come from the repository secret PRIVATE_TERMS (a list
// separated by commas), handed over by .github/workflows/checks.yml.
//
// A term counts when it stands as a whole word with the same capitals. This
// prints where a term was found (file and line number) and never the text
// itself, because the logs of a public repo are public too.
//
// There is no list of exceptions on purpose. If a flagged line turns out to be
// an ordinary word, reword the line.
//
// Reads from the environment:
//   PRIVATE_TERMS  the terms, separated by commas (required)
//   PR_TITLE       the pull request's title, when there is one
//   PR_BODY        the pull request's description, when there is one
//   BASE_SHA       commit messages are checked from after this commit...
//   HEAD_SHA       ...up to and including this one

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const say = (line) => process.stdout.write(`${line}\n`);

const terms = (process.env.PRIVATE_TERMS ?? '')
  .split(',')
  .map((term) => term.trim())
  .filter((term) => term.length > 0);

if (terms.length === 0) {
  say(
    '::error::The repository secret PRIVATE_TERMS is missing or empty, so this check cannot run. ' +
      'Set it at Settings > Secrets and variables > Actions > Repository secrets. ' +
      'Pull requests from a fork never receive secrets and fail here for the same reason.',
  );
  process.exit(1);
}

// Hide every term in the log before anything else can print one.
for (const term of terms) say(`::add-mask::${term}`);

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A whole word: no letter, digit or underscore directly before or after.
const patterns = terms.map((term) => new RegExp(`(?<![\\p{L}\\p{N}_])${escape(term)}(?![\\p{L}\\p{N}_])`, 'u'));
const hasTerm = (text) => patterns.some((pattern) => pattern.test(text));

/** The numbers (starting at 1) of the lines that hold a term. */
const linesWithTerm = (text) => {
  const found = [];
  text.split('\n').forEach((line, index) => {
    if (hasTerm(line)) found.push(index + 1);
  });
  return found;
};

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const findings = [];

// 1. Tracked files: their names and their contents (pictures and models too,
// since those can carry a name in their details).
const files = git('ls-files', '-z').split('\0').filter(Boolean);
files.forEach((file, index) => {
  if (hasTerm(file)) findings.push(`the name of tracked file number ${index + 1} in "git ls-files"`);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return; // Listed but not on disk (a removed file not yet committed).
  }
  for (const line of linesWithTerm(text)) findings.push(`${file}:${line}`);
});

// 2. The pull request's title and description.
if (hasTerm(process.env.PR_TITLE ?? '')) findings.push('the pull request title');
for (const line of linesWithTerm(process.env.PR_BODY ?? '')) {
  findings.push(`the pull request description, line ${line}`);
}

// 3. Commit messages.
const isCommit = (sha) => {
  if (!sha || /^0+$/.test(sha)) return false;
  try {
    git('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
};
const head = isCommit(process.env.HEAD_SHA) ? process.env.HEAD_SHA : 'HEAD';
const range = isCommit(process.env.BASE_SHA) ? [`${process.env.BASE_SHA}..${head}`] : ['-n', '50', head];
const commits = git('log', '--format=%H', ...range).split('\n').filter(Boolean);
for (const commit of commits) {
  const message = git('log', '-1', '--format=%B', commit);
  for (const line of linesWithTerm(message)) {
    findings.push(`the message of commit ${commit.slice(0, 10)}, line ${line}`);
  }
}

say(
  `Checked ${files.length} tracked files, ${commits.length} commit message${commits.length === 1 ? '' : 's'}` +
    `${process.env.PR_TITLE ? ', the pull request title and description' : ''}` +
    ` against ${terms.length} private term${terms.length === 1 ? '' : 's'}.`,
);

if (findings.length > 0) {
  for (const place of findings) say(`::error::A private term appears in ${place}`);
  say(
    `Found ${findings.length} place${findings.length === 1 ? '' : 's'} with a private term. ` +
      'Reword each one. A term in a commit message needs that commit rewritten. There is no list of exceptions.',
  );
  process.exit(1);
}
say('No private terms found.');
