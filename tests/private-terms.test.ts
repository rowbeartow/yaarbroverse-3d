// The private-terms check, run for real against small throwaway repositories.
// The made-up terms here stand in for the real ones, which live only in the
// repository secret.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/check-private-terms.mjs');
const TERMS = 'Zorblat, Quimby Vale';

const made: string[] = [];
afterEach(() => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
  });

/** A new repository holding the given files in one commit. */
const repo = (files: Record<string, string>, message = 'First commit'): string => {
  const folder = mkdtempSync(join(tmpdir(), 'private-terms-'));
  made.push(folder);
  git(folder, 'init', '-q');
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(folder, name)), { recursive: true });
    writeFileSync(join(folder, name), text);
  }
  git(folder, 'add', '-A');
  git(folder, 'commit', '-q', '-m', message);
  return folder;
};

const check = (cwd: string, env: Record<string, string> = {}): { code: number | null; out: string } => {
  const kept = { ...process.env };
  for (const name of ['PRIVATE_TERMS', 'PR_TITLE', 'PR_BODY', 'BASE_SHA', 'HEAD_SHA']) delete kept[name];
  const run = spawnSync(process.execPath, [SCRIPT], { cwd, env: { ...kept, PRIVATE_TERMS: TERMS, ...env }, encoding: 'utf8' });
  return { code: run.status, out: run.stdout + run.stderr };
};

/** Everything printed, apart from the lines that tell the log to hide each term. */
const shown = (out: string): string =>
  out
    .split('\n')
    .filter((line) => !line.startsWith('::add-mask::'))
    .join('\n');

describe('the private-terms check', () => {
  it('passes a clean repository', () => {
    const result = check(repo({ 'README.md': 'A game about a grove.\n' }));
    expect(result.code).toBe(0);
    expect(result.out).toContain('No private terms found.');
  });

  it('hides every term in the log before doing anything else', () => {
    const result = check(repo({ 'README.md': 'Nothing here.\n' }));
    expect(result.out.split('\n').slice(0, 2)).toEqual(['::add-mask::Zorblat', '::add-mask::Quimby Vale']);
  });

  it('fails on a term in a tracked file, naming the file and line but never the text', () => {
    const result = check(repo({ 'docs/notes.md': 'line one\nline two\nplayed by Zorblat today\n' }));
    expect(result.code).toBe(1);
    expect(result.out).toContain('docs/notes.md:3');
    expect(shown(result.out)).not.toContain('Zorblat');
    expect(shown(result.out)).not.toContain('played by');
  });

  it('finds a term made of two words', () => {
    const result = check(repo({ 'a.txt': 'thanks to Quimby Vale for testing\n' }));
    expect(result.code).toBe(1);
    expect(result.out).toContain('a.txt:1');
  });

  it('only counts whole words with the same capitals', () => {
    const result = check(repo({ 'a.txt': 'zorblat\nZORBLAT\nZorblats\nMcZorblat\nZorblat_2\n' }));
    expect(result.code).toBe(0);
  });

  it('counts a term next to punctuation', () => {
    for (const text of ['(Zorblat)', "Zorblat's turn", 'well done, Zorblat.', 'Zorblat-approved']) {
      expect(check(repo({ 'a.txt': `${text}\n` })).code, text).toBe(1);
    }
  });

  it('fails on a term in a file name without printing the name', () => {
    const result = check(repo({ 'art/Zorblat-sketch.txt': 'a drawing\n' }));
    expect(result.code).toBe(1);
    expect(result.out).toContain('the name of tracked file number 1');
    expect(shown(result.out)).not.toContain('Zorblat');
  });

  it('fails on a term in a commit message', () => {
    const folder = repo({ 'a.txt': 'fine\n' }, 'Tuned after Zorblat played');
    const result = check(folder);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/the message of commit [0-9a-f]{10}, line 1/);
    expect(shown(result.out)).not.toContain('Zorblat');
  });

  it('only reads commit messages after BASE_SHA when one is given', () => {
    const folder = repo({ 'a.txt': 'fine\n' }, 'Tuned after Zorblat played');
    const base = git(folder, 'rev-parse', 'HEAD').trim();
    writeFileSync(join(folder, 'b.txt'), 'also fine\n');
    git(folder, 'add', '-A');
    git(folder, 'commit', '-q', '-m', 'A clean commit');
    const head = git(folder, 'rev-parse', 'HEAD').trim();
    expect(check(folder, { BASE_SHA: base, HEAD_SHA: head }).code).toBe(0);
    expect(check(folder).code).toBe(1);
  });

  it('fails on a term in the pull request title or description', () => {
    const folder = repo({ 'a.txt': 'fine\n' });
    const title = check(folder, { PR_TITLE: 'Easier for Zorblat', PR_BODY: 'Nothing else.' });
    expect(title.code).toBe(1);
    expect(title.out).toContain('the pull request title');
    const body = check(folder, { PR_TITLE: 'Easier stumps', PR_BODY: 'What changed\n\nQuimby Vale asked for it.' });
    expect(body.code).toBe(1);
    expect(body.out).toContain('the pull request description, line 3');
    expect(shown(body.out)).not.toContain('Quimby');
  });

  it('fails with a clear message when the secret is missing', () => {
    const folder = repo({ 'a.txt': 'fine\n' });
    for (const value of ['', ' , ,']) {
      const result = check(folder, { PRIVATE_TERMS: value });
      expect(result.code).toBe(1);
      expect(result.out).toContain('PRIVATE_TERMS is missing or empty');
    }
  });
});
