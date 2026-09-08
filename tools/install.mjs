/*
 * Copies the plugin into a fee[dB]ack installation, so it can be played with a
 * real guitar instead of a keyboard.
 *
 *     node tools/install.mjs                          the default install below
 *     node tools/install.mjs --to "D:\\Feedback"       somewhere else
 *     node tools/install.mjs --dry                     say what would be copied
 *
 * The host loads a plugin as a DIRECTORY under `resources/<app>/plugins/<id>`,
 * reads `plugin.json` and imports `screen.js` as a module, so installing is a
 * mirror of this repo and nothing more: no bundler, no build step, no rewriting
 * of imports. What that buys is that the thing being played IS the thing in the
 * editor, to the line — which matters when the bug you are chasing only happens
 * with a guitar plugged in.
 *
 * `--dry` first, always, when pointing this at a new root: it prints the target
 * and every file, and it refuses a root that has no `resources` directory
 * rather than helpfully creating one somewhere harmless.
 */

import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Where this machine keeps the build that is wired to the user's guitar. Not a
 * guess and not a search: a wrong root here means installing a plugin into a
 * copy of the app nobody is running, and then wondering why nothing changed. */
const DEFAULT_TO = 'C:\\Users\\nicks\\Desktop\\Feedback';
const APP = 'slopsmith';

/* What a plugin is made of. `tests` and `tools` go too, and that is deliberate:
 * the installed copy is a working checkout, so a fix found while playing can be
 * made and tested where it was found. `assets/art/raw` does NOT go: it is forty
 * megabytes of thousand-pixel generations that the cut sheets are made from. */
const COPY = ['plugin.json', 'screen.js', 'package.json', 'README.md', 'CHANGELOG.md',
  'LICENSE', 'src', 'assets', 'docs', 'tests', 'tools'];
const SKIP = new Set(['raw', 'node_modules', '__pycache__', '.git']);

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};

const to = opt('to', DEFAULT_TO);
const dry = args.includes('--dry');

const id = JSON.parse(await readFile(join(ROOT, 'plugin.json'))).id;
const dest = join(to, 'resources', APP, 'plugins', id);

if (!existsSync(join(to, 'resources'))) {
  console.error(`${to} has no resources directory: is that a fee[dB]ack install?`);
  process.exit(1);
}

/** Everything under `src` that is going, as repo-relative paths. */
async function walk(rel) {
  const full = join(ROOT, rel);
  const s = await stat(full);
  if (!s.isDirectory()) return [rel];
  const out = [];
  for (const name of await readdir(full)) {
    if (SKIP.has(name)) continue;
    out.push(...await walk(join(rel, name)));
  }
  return out;
}

const files = [];
for (const top of COPY) {
  if (!existsSync(join(ROOT, top))) continue;
  files.push(...await walk(top));
}

console.log(`${files.length} files -> ${dest}`);
if (dry) {
  for (const f of files) console.log('  ' + f);
  process.exit(0);
}

/* A clean mirror, because a stale file is worse than a missing one: a sheet
 * that has been renamed leaves its old self behind, the atlas still lists it,
 * and the game draws last week's art from a file nothing in the repo produces
 * any more. */
await rm(dest, { recursive: true, force: true });
for (const f of files) {
  const target = join(dest, f);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(ROOT, f), target);
}
console.log(`installed ${files.length} files, ${files.filter((f) => f.endsWith('.png')).length} of them sprites`);
console.log(`restart fee[dB]ack, or reopen the minigame, to pick it up`);

async function readFile(p) {
  const { readFile: rf } = await import('node:fs/promises');
  return rf(p, 'utf8');
}
