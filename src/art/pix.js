/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE PALETTE AND THE PIXEL PRIMITIVES.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every colour the scene uses is a name in `P`. It is a game palette, not the
 * host's design tokens, and that is on purpose: the kit's greys and accent are
 * built for a settings panel, and a kitchen painted with them looked like the
 * UI of a recording studio. Warm wood and brick, amber for anything worth
 * money, near-black plates with a thick border for anything that has to be
 * read, white for speech, cyan for the guitar and nothing else.
 *
 * The primitives below draw with hard edges only. No anti-aliasing, no
 * gradients: shading is a second colour, or a 2x2 checker of two colours,
 * which is the dithering a 16-bit console would have used.
 */

// Order quality needs a larger silhouette than the tiny stove/status icons.
export const ORDER_STAR = { size: 7, advance: 9 };

export const P = {
  ink: '#0d0b0c',
  plate: '#24221c',
  plateHi: '#373326',
  teal: '#234c46',
  frame: '#6a4e3a',
  frameHi: '#a07a56',
  frameLo: '#3a2a20',

  amber: '#f4b23a',
  gold: '#ffd968',
  amberLo: '#a86a18',

  white: '#f6f0e4',
  cream: '#e7d7b6',
  paper: '#fbf7ee',
  grey: '#8e8880',
  greyLo: '#4c464a',
  greyHi: '#c6c0b8',

  brick: '#764c38',
  brickHi: '#94634a',
  brickLo: '#533525',
  mortar: '#3e2618',

  wood: '#8c5628',
  woodHi: '#bc7c40',
  woodLo: '#5c3616',
  woodInk: '#2c180a',

  steel: '#6e727a',
  steelHi: '#a6aab2',
  steelLo: '#3e4048',
  steelInk: '#1c1d22',

  copper: '#b46a32',
  copperHi: '#e09a58',
  copperLo: '#6c3a18',

  fire: '#ff6a1a',
  fireHi: '#ffb324',
  fireCore: '#fff4a8',
  fireLo: '#c8341a',

  green: '#48c04c',
  greenLo: '#287a30',
  greenHi: '#a4f4a0',

  cyan: '#40e8ff',
  cyanLo: '#1a8cb0',
  cyanHi: '#d0fbff',

  red: '#d83028',
  redLo: '#861a14',
  redHi: '#ff7a6a',

  night: '#182034',
  nightHi: '#2a3654',
  lamp: '#ffd890',

  smoke: '#5a5652',
  steam: '#e8e4dc',
};

/* Who walks in: five skins, seven hairs, twelve coats. `face` indexes them. */
export const SKINS = ['#f8d8b8', '#eab48c', '#c98a5c', '#9c6038', '#6a3e22'];
export const HAIRS = ['#2a1a12', '#5c3618', '#a8642a', '#e8c878', '#c8c0b8', '#b03020', '#141414'];
export const COATS = [
  '#3c6cba', '#b83a3a', '#3a9a5a', '#e0b030', '#7a4aa0', '#2a9a9a',
  '#e07a30', '#ececec', '#e080a0', '#6c7480', '#6a4a30', '#262626',
];

/* A room full of people needs more than twelve coats. The twelve above come
 * first so the twelve regulars keep the colours they have always had; the rest
 * are for the crowd, the shirts under the jackets and the scarves. */
export const CLOTHES = [
  ...COATS,
  '#c85a2a', '#4a9ad0', '#9a2a4a', '#d8c8a0', '#2a5a3a', '#8a6ad0',
  '#f0e060', '#4a4a6a', '#b8905a', '#2e6a8a', '#f6f0e4', '#d84a9a',
];
export const TROUSERS = ['#2c2430', '#2a3a6a', '#4a3a2a', '#3a5a9a', '#141414', '#7a7050', '#5a2a3a', '#1e2a22'];

/** A fresh offscreen canvas of exact size, with a 2D context set up for pixels. */
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

/** A filled rectangle at integer coordinates. */
export function rect(g, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A one pixel frame. */
export function frame(g, x, y, w, h, color) {
  rect(g, x, y, w, 1, color);
  rect(g, x, y + h - 1, w, 1, color);
  rect(g, x, y, 1, h, color);
  rect(g, x + w - 1, y, 1, h, color);
}

/* The 2x2 checker, cached per pair of colours. `createPattern` fills big
 * areas of dither in one call, which is why the bricks cost nothing. */
const checkers = new Map();
export function checker(g, a, b) {
  const key = a + '|' + b;
  let p = checkers.get(key);
  if (p) return p;
  const { c, g: cg } = canvas(2, 2);
  cg.fillStyle = a; cg.fillRect(0, 0, 2, 2);
  cg.fillStyle = b; cg.fillRect(0, 0, 1, 1); cg.fillRect(1, 1, 1, 1);
  p = g.createPattern(c, 'repeat');
  checkers.set(key, p);
  return p;
}

/** A rectangle filled with a 2x2 checker of two colours. */
export function dither(g, x, y, w, h, a, b) {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = checker(g, a, b);
  // Patterns are anchored at the canvas origin, so the checker phase is stable
  // wherever the rectangle lands, which keeps two adjacent fills seamless.
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/**
 * A pixel-rounded rectangle: the four corner pixels are left out, which is all
 * the rounding a 16-bit plate ever had. `r` = 2 also skips the pixel next to
 * each corner, for bigger plates.
 */
export function rrect(g, x, y, w, h, color, r) {
  const k = r === undefined ? 1 : r;
  g.fillStyle = color;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (k <= 0) { g.fillRect(x, y, w, h); return; }
  g.fillRect(x + k, y, w - 2 * k, h);
  g.fillRect(x, y + k, w, h - 2 * k);
  if (k === 2) {
    g.fillRect(x + 1, y + 1, w - 2, h - 2);
  }
}

/**
 * The plate everything readable sits on: near-black fill, a two pixel warm
 * border, rounded corners, and a one pixel highlight along the top inside the
 * border so it reads as a raised sign rather than a hole.
 */
export function plate(g, x, y, w, h, o) {
  const opt = o || {};
  const border = opt.border || P.frame;
  const fill = opt.fill || P.plate;
  rrect(g, x, y, w, h, P.ink, 2);
  rrect(g, x + 1, y + 1, w - 2, h - 2, border, 1);
  rrect(g, x + 2, y + 2, w - 4, h - 4, fill, 1);
  if (opt.hi !== false) rect(g, x + 3, y + 2, w - 6, 1, opt.hiColor || P.plateHi);
}

/**
 * Builds a sprite from rows of characters. Each character is looked up in
 * `map` and drawn as one pixel of that colour; `.` and anything not in the map
 * is transparent. Rows may be ragged; the width is the longest one.
 *
 * Returns the canvas. Sprites are built once and cached by whoever calls this,
 * never per frame.
 */
export function sprite(rows, map) {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const h = rows.length;
  const { c, g } = canvas(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const col = map[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

/**
 * Draws `rows` straight onto a context at (x, y) with `map`. For the small
 * dynamic things (a star, a flame tongue) that are cheaper drawn than cached.
 */
export function stamp(g, rows, map, x, y) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const col = map[row[i]];
      if (col) { g.fillStyle = col; g.fillRect(x + i, y + j, 1, 1); }
    }
  }
}

/** A sprite flipped left to right, cached on the sprite itself. */
export function flipped(spr) {
  if (spr.__flip) return spr.__flip;
  const { c, g } = canvas(spr.width, spr.height);
  g.translate(spr.width, 0);
  g.scale(-1, 1);
  g.drawImage(spr, 0, 0);
  spr.__flip = c;
  return c;
}

/**
 * A copy of a sprite with `color` (an rgba) laid over every opaque pixel. The
 * crowd at the back of the room is the same people as the front, further from
 * the lamps: one fill, cached by whoever asks.
 */
export function tinted(spr, color) {
  const { c, g } = canvas(spr.width, spr.height);
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, spr.width, spr.height);
  return c;
}

/** Draws a sprite at integer coordinates. */
export function blit(g, spr, x, y) {
  g.drawImage(spr, Math.round(x), Math.round(y));
}

/*
 * A small drawing, made once and blitted from then on.
 *
 * Everything stamped pixel by pixel — a star, a ticket, a note in flight —
 * costs one `fillRect` per lit pixel on every frame it is on the screen. Five
 * stars is fifty of them, and there are ten rows of five on the counter at
 * once. This turns each of those into one `drawImage`.
 *
 * `key` is what makes one version of the drawing different from another, and
 * it has to be a SMALL and CLOSED set: `stars/3` and `stars/4` are two of six,
 * and that is the whole point. A flame keyed on its exact height would make a
 * new entry every frame, which is not a cache, it is a leak with a nice name.
 */
const sprites = new Map();
export function sprited(key, w, h, draw) {
  let c = sprites.get(key);
  if (!c) {
    const b = canvas(w, h);
    draw(b.g);
    c = b.c;
    sprites.set(key, c);
  }
  return c;
}

/**
 * Deterministic noise in [0, 1) from integers. The flames flicker with it and
 * the bricks vary with it, so the same wall is drawn the same way every time
 * and the flicker has no `Math.random` anywhere in the loop.
 */
export function hash(a, b, c) {
  let h = (a | 0) * 374761393 + (b | 0) * 668265263 + ((c | 0) + 1) * 1274126177;
  h = (h ^ (h >>> 13)) * 1103515245;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/** A pixel oval: `w` by `h`, drawn as stacked rows. Pots and plates are ovals. */
export function oval(g, cx, cy, w, h, color) {
  g.fillStyle = color;
  const rx = w / 2;
  const ry = h / 2;
  const top = Math.round(cy - ry);
  for (let j = 0; j < Math.round(h); j++) {
    const yy = (j + 0.5 - ry) / ry;
    const half = rx * Math.sqrt(Math.max(0, 1 - yy * yy));
    const x0 = Math.round(cx - half);
    const x1 = Math.round(cx + half);
    if (x1 > x0) g.fillRect(x0, top + j, x1 - x0, 1);
  }
}

/** The outline of `oval`, one pixel, drawn as the difference of two ovals. */
export function ovalRing(g, cx, cy, w, h, color) {
  const { c, g: t } = canvas(w + 2, h + 2);
  oval(t, (w + 2) / 2, (h + 2) / 2, w + 2, h + 2, color);
  t.globalCompositeOperation = 'destination-out';
  oval(t, (w + 2) / 2, (h + 2) / 2, w, h, '#000');
  g.drawImage(c, Math.round(cx - (w + 2) / 2), Math.round(cy - (h + 2) / 2));
}
