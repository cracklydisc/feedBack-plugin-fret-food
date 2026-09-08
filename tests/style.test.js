/*
 * The stylesheet, checked against the kit's first law.
 *
 * The law is: no literal colour outside the token block. It is not tidiness.
 * The host repaints every plugin from one palette, and a hex buried in a rule
 * survives that repaint and sits there glowing in the wrong theme. The kit
 * enforces this on itself with a test; this is the same test for the game's own
 * sheet, and it exists because the sheet is going to be rewritten more than
 * once and the rule has to outlive whoever rewrites it.
 *
 * The exception is the `:root` block at the top, which is where the game's own
 * palette is defined and where literals belong.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(here, '..', 'assets', 'fret-food.css'), 'utf8');

/** Comments are prose: they are allowed to say "white" without meaning it. */
const withoutComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** `var(--fbk-gold)` names a role, not a colour. Blanking the whole `var(...)`
 *  before looking for colour words is what keeps this test from crying wolf on
 *  the very form the house style requires. */
const withoutVars = (css) => css.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, 'VAR');

/** The sheet with every `:root { ... }` block cut out. */
function withoutTokens(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf(':root', i);
    if (at < 0) { out += css.slice(i); break; }
    const open = css.indexOf('{', at);
    if (open < 0) { out += css.slice(i); break; }
    out += css.slice(i, at);
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    i = j;
  }
  return out;
}

/* Colour words a designer reaches for without thinking. `transparent` and
 * `currentColor` are not colours in this sense: they take whatever is already
 * there, so they cannot fight the palette.
 *
 * The guards on both sides exclude a hyphen, and that is not fussiness: a plain
 * word boundary matches the `white` in `white-space` and the `gray` in a
 * `kc-gray` keyframe name, and a test that reports those is a test people learn
 * to ignore. */
const NAMED = /(?<![\w-])(white|black|red|green|blue|yellow|orange|purple|pink|brown|grey|gray|silver|gold|cyan|magenta|beige|ivory|tan|teal|navy|olive|maroon|lime|aqua|fuchsia)(?![\w-])/gi;

test('no literal colour outside the token block', () => {
  const body = withoutTokens(withoutComments(CSS));

  const hex = body.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hex, [], 'hex colours in the rules: ' + hex.join(', '));

  // `rgb(var(--x))` is the house form and is fine; `rgb(12 34 56)` is not.
  const raw = (body.match(/\b(rgb|rgba|hsl|hsla|oklch|lab)\(([^)]*)\)/g) || [])
    .filter((s) => !/var\(/.test(s));
  assert.deepEqual(raw, [], 'colour functions with literal channels: ' + raw.join(', '));

  const named = [...new Set(withoutVars(body).match(NAMED) || [])];
  assert.deepEqual(named, [], 'colour names in the rules: ' + named.join(', '));
});

test('the palette is declared, and declared once, at the top', () => {
  const first = CSS.indexOf(':root');
  assert.ok(first >= 0, 'the sheet has no token block');
  assert.ok(first < 4000, 'the token block is not near the top of the file');

  const tokens = [...CSS.matchAll(/--kc-[a-z0-9-]+\s*:/g)].map((m) => m[0].slice(0, -1).trim());
  assert.ok(tokens.length >= 5, 'the game should have a palette of its own, found ' + tokens.length);
  assert.equal(new Set(tokens).size, tokens.length, 'a token is declared twice: ' + tokens.join(', '));
});

test('every kitchen token the rules use is actually declared', () => {
  const declared = new Set([...CSS.matchAll(/(--kc-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...CSS.matchAll(/var\((--kc-[a-z0-9-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((t) => !declared.has(t));
  assert.deepEqual(missing, [], 'used but never declared: ' + missing.join(', '));
});

test('a kit class is only ever overridden inside one of ours', () => {
  /* The kit is the base layer, and a bare `.fbk-chip { ... }` here changes
   * every chip on the page, not only the ones in this game. Scoping it under
   * one of our own classes is the way the kit expects to be adjusted, so
   * `.kc-recipe .fbk-chip` is fine and `.fbk-chip` alone is not.
   *
   * Only the first compound of each selector is judged, which is exactly where
   * the difference lives. */
  const body = withoutComments(CSS);
  const bad = [];
  for (const block of body.split('}')) {
    const head = block.split('{')[0];
    if (!head || !/\.fbk-/.test(head)) continue;
    for (const sel of head.split(',')) {
      const first = sel.trim().split(/[\s>+~]/)[0];
      if (first.startsWith('.fbk-')) bad.push(first);
    }
  }
  assert.deepEqual([...new Set(bad)], [], 'kit classes redefined unscoped: ' + bad.join(', '));
});

test('animation only moves transform and opacity', () => {
  // Anything else animates on the main thread, and this runs on top of a live
  // WebGL highway. A `transition: left` here costs the app frames.
  const props = [...CSS.matchAll(/transition\s*:\s*([^;}]+)/g)]
    .flatMap((m) => m[1].split(','))
    .map((s) => s.trim().split(/\s+/)[0])
    .filter((p) => p && p !== 'transform' && p !== 'opacity' && p !== 'none' && p !== 'all');
  const allowed = new Set(['color', 'background', 'background-color', 'border-color', 'fill', 'stroke', 'box-shadow', 'filter', 'stroke-dasharray', '--heat', '--fire']);
  const bad = [...new Set(props)].filter((p) => !allowed.has(p));
  assert.deepEqual(bad, [], 'transitions on layout properties: ' + bad.join(', '));
});
