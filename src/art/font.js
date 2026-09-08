/*
 * ─────────────────────────────────────────────────────────────────────────
 * TWO BITMAP FONTS, and why `ctx.font` is not used anywhere.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The scene is drawn into a 480 by 270 buffer and blown up with hard pixels.
 * A system font rendered into that buffer is anti-aliased grey mush at 7 px
 * and looks like a sticker on the pixel art once it is scaled. So the glyphs
 * are bits, written here, and the printer copies them from a cached atlas.
 *
 * `M` is 5x7 with a 6 px advance: every number that matters, every chord name
 * and every heading. It has one lowercase letter, `m`, so that Am, Dm and Em
 * read the way a guitarist reads them.
 *
 * `S` is 3x5 with a 4 px advance: labels, customer names, the compact
 * fingering, anything that is a caption. It is uppercase only.
 *
 * Nothing here knows about the game; it is a printer.
 */

const M_ROWS = 7;
const S_ROWS = 5;

/* 5x7. `#` is a lit pixel. */
const M = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['....#', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '..##.', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  "'": ['.##..', '.##..', '..#..', '.....', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  // Shift, on the keyboard hints: `^D` is Shift+D. It printed as `?` until
  // somebody looked at a card and asked what the question mark was for.
  '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  /* A lowercase b, for the flats: `Bb` printed `BB` is a different chord, the
   * same way `AM` is. */
  b: ['#....', '#....', '#....', '####.', '#...#', '#...#', '####.'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
  ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

/* 3x5. Uppercase, and one lowercase letter: `m`.
 *
 * It was uppercase only, on the grounds that a lowercase m does not exist
 * three pixels wide, and that was true and beside the point. The recipe on a
 * card is printed in this font, and a recipe printed AM DM EM is not a
 * shorthand for A minor, it is the name of three other chords. So there is an
 * m: three rows tall against the capitals' five, so it sits at the
 * x-height and cannot be mistaken for one of them. Three pixels wide cannot
 * draw two humps; they can draw the one thing that has to be true, which is
 * that this letter is not a capital. The first attempt was the capital dropped
 * a single row, and on the screen that is not a difference anybody sees. */
const S = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '###', '..#', '###'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  $: ['.##', '##.', '.#.', '.##', '##.'],
  '.': ['...', '...', '...', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  x: ['...', '#.#', '.#.', '#.#', '...'],
  m: ['...', '...', '###', '#.#', '#.#'],
  /* A lowercase b and a sharp: the recipe chips print chord names, and
   * `F#m` and `Bb` are chords this game now asks for. Three pixels can draw
   * both, and a sharp has to fill its cell to read as one at all. */
  b: ['#..', '#..', '##.', '#.#', '##.'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '^': ['.#.', '#.#', '...', '...', '...'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  ',': ['...', '...', '...', '.#.', '#..'],
  ' ': ['...', '...', '...', '...', '...'],
};

export const FONTS = {
  M: { glyphs: M, w: 5, h: M_ROWS, adv: 6 },
  S: { glyphs: S, w: 3, h: S_ROWS, adv: 4 },
};

/* The S font has no lowercase, so anything printed with it is uppercased. The
 * M font keeps `m` and `x` and uppercases the rest, which is exactly what a
 * chord name and a combo counter need. */
function normalise(font, ch) {
  if (font.glyphs[ch]) return ch;
  const up = ch.toUpperCase();
  if (font.glyphs[up]) return up;
  return '?';
}

/** Width in pixels of `str` printed with `font` at `scale`. */
export function measure(str, fontName, scale) {
  const f = FONTS[fontName] || FONTS.M;
  const s = scale || 1;
  const n = String(str).length;
  return n ? (n * f.adv - (f.adv - f.w)) * s : 0;
}

/* ── the atlas ────────────────────────────────────────────────────────────
 *
 * One offscreen canvas per (font, colour, scale), holding every glyph in a
 * row, built the first time that combination is asked for. Printing is then
 * one `drawImage` per character, which is the cheapest thing a 2D context does.
 * Drawing each pixel with `fillRect` instead was measured at three
 * milliseconds a frame for a full screen of text, and the budget is four.
 */
const atlases = new Map();

function atlas(fontName, color, scale) {
  const key = fontName + '|' + color + '|' + scale;
  let a = atlases.get(key);
  if (a) return a;
  const f = FONTS[fontName];
  const keys = Object.keys(f.glyphs);
  const cw = f.w * scale;
  const ch = f.h * scale;
  const c = document.createElement('canvas');
  c.width = cw * keys.length;
  c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = color;
  const at = {};
  keys.forEach((k, i) => {
    at[k] = i * cw;
    const rows = f.glyphs[k];
    for (let y = 0; y < f.h; y++) {
      const row = rows[y];
      for (let x = 0; x < f.w; x++) {
        if (row[x] === '#') g.fillRect(i * cw + x * scale, y * scale, scale, scale);
      }
    }
  });
  a = { canvas: c, at, cw, ch };
  atlases.set(key, a);
  return a;
}

/**
 * Prints `str` with its top-left corner at (x, y).
 *
 * `o.font` is 'M' or 'S', `o.scale` an integer, `o.color` any CSS colour,
 * `o.align` 'left' | 'center' | 'right'. `o.shadow` prints the same text one
 * pixel down and right in that colour first, which is how a number sits on the
 * wood without a plate under it. `o.outline` rings every glyph with one pixel
 * of that colour, for text floating over the scene.
 * Returns the width printed.
 */
export function text(ctx, str, x, y, o) {
  const opt = o || {};
  const fontName = opt.font || 'M';
  const f = FONTS[fontName];
  const scale = opt.scale || 1;
  const s = String(str);
  const w = measure(s, fontName, scale);
  let x0 = Math.round(x);
  if (opt.align === 'center') x0 -= Math.floor(w / 2);
  else if (opt.align === 'right') x0 -= w;
  const y0 = Math.round(y);

  if (opt.outline) {
    const a = atlas(fontName, opt.outline, scale);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx || dy) blit(ctx, a, f, s, x0 + dx, y0 + dy, scale);
      }
    }
  }
  if (opt.shadow) blit(ctx, atlas(fontName, opt.shadow, scale), f, s, x0 + scale, y0 + scale, scale);
  blit(ctx, atlas(fontName, opt.color || '#ffffff', scale), f, s, x0, y0, scale);
  return w;
}

function blit(ctx, a, f, s, x0, y0, scale) {
  let x = x0;
  for (let i = 0; i < s.length; i++) {
    const k = normalise(f, s[i]);
    if (k !== ' ') ctx.drawImage(a.canvas, a.at[k], 0, a.cw, a.ch, x, y0, a.cw, a.ch);
    x += f.adv * scale;
  }
}

/**
 * Breaks `str` into at most `maxLines` lines of at most `maxChars` characters
 * each, on spaces. A word longer than the limit is kept whole and overflows:
 * hyphenating a dish name in a speech bubble is worse than a wide bubble.
 */
export function wrap(str, maxChars, maxLines) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const head = lines.slice(0, maxLines - 1);
    head.push(lines.slice(maxLines - 1).join(' '));
    return head;
  }
  return lines;
}

/**
 * Wraps by MEASURED WIDTH, in the pixels of the font that will print it.
 *
 * `wrap()` above counts characters, and twelve characters of the M font are
 * seventy-one pixels: right for a bubble seventy-four wide, and only by luck.
 * Its other habit is the one that showed: past `maxLines` it glues the tail
 * back onto the last line, so "Shadow Sorbetto in Minor" came out as `SHADOW`
 * over `SORBETTO IN MINOR`, a hundred and one pixels on a line that had room
 * for seventy-four, and the second line walked out of its bubble across the
 * next customer. Here a word that does not fit starts a new line, and when
 * the lines run out the caller is told the truth instead of a joined tail:
 * `fits` is false, and the caller picks a smaller font or a shorter name.
 */
export function wrapPx(str, maxW, fontName, maxLines) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (measure(cur + ' ' + w, fontName) <= maxW) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const limit = maxLines || lines.length;
  if (lines.length > limit) {
    const head = lines.slice(0, limit - 1);
    head.push(lines.slice(limit - 1).join(' '));
    return { lines: head, fits: false };
  }
  return { lines, fits: lines.every((l) => measure(l, fontName) <= maxW) };
}

/** `14850` -> `$14,850`. The till prints thousands with a comma. */
export function money(n) {
  const v = Math.round(Math.abs(n));
  const s = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + s;
}

/** Milliseconds as `M:SS`. */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
