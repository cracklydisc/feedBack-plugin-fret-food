/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE PROPS: pans, ingredients, fire, bricks, tiles, wood, jars, stars, notes.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Everything in the kitchen that is not a person. Most of it is procedural
 * (rectangles with an outline and a shadow side) because a pan is a shape and
 * a shape is cheaper to describe than to draw pixel by pixel; the things that
 * need a silhouette (an ingredient, a star, a note, a clef) are rows of
 * characters.
 *
 * The pans and the ingredients are the vocabulary the menu declares in
 * `COOKWARE` and `INGREDIENTS`: one drawing for each entry, and a name the
 * menu uses that is missing here would come out as a dark pan or an empty
 * spot, which the preview would show at once.
 *
 * The pans are the second thing on the screen after the cards, and they are
 * drawn at a size that says so: thirty pixels tall for the stockpot, a
 * surface you can see into, and every ingredient a sprite you can name. A pan
 * body never changes while it sits on the fire, so it is built once per kind
 * and soot level and blitted; only the fire, the food and the steam are drawn
 * every frame.
 */

import { P, ORDER_STAR, rect, dither, oval, stamp, sprite, sprited, hash, canvas, blit } from './pix.js';

/* ── fire ─────────────────────────────────────────────────────────────────
 *
 * Tongues two pixels wide, tallest in the middle, each flickering on its own
 * from `hash` so the same frame is always drawn the same way. `height` is what
 * the burner says: the flames really are taller at level five. `cold` draws
 * frost instead of fire, for the two dishes that sit on ice. */
export function flame(g, cx, baseY, width, height, t, cold, still) {
  const cols = Math.max(3, Math.floor(width / 2));
  const half = (cols - 1) / 2;
  const bucket = still ? 0 : Math.floor(t / 90);
  const outer = cold ? '#9ad8f8' : P.fire;
  const mid = cold ? '#d8f0ff' : P.fireHi;
  const core = cold ? P.white : P.fireCore;
  for (let i = 0; i < cols; i++) {
    const d = Math.abs(i - half) / (half + 0.5);
    const n = still ? 0.5 : hash(i, bucket, 7);
    const h = Math.max(1, Math.round(height * (1 - d * d * 0.55) * (0.65 + 0.45 * n)));
    const x = Math.round(cx - half * 2 + i * 2);
    rect(g, x, baseY - h, 2, h, outer);
    const h2 = Math.round(h * 0.6);
    if (h2 > 0) rect(g, x, baseY - h2, 2, h2, mid);
    const h3 = Math.round(h * 0.3);
    if (h3 > 0 && d < 0.6) rect(g, x, baseY - h3, 2, h3, core);
    // The tip of the tongue, one shade darker: a drawn fire is brightest at
    // its heart and darkest where it thins into the air, and without the dark
    // tips the flame read as a flat orange comb.
    if (h > 3) rect(g, x, baseY - h, 2, 1, cold ? '#6ab0e0' : P.fireLo);
  }
}

/* ── what goes in the pan ────────────────────────────────────────────────
 *
 * One entry per name in `INGREDIENTS`. `kind` says how it behaves in a pan:
 * `liquid` covers the surface, `disc` is a dough that covers it with a rim,
 * `grain` is a scatter of single pixels, and `bit` is a sprite dropped on top.
 * `fill` and `hi` are the two colours everything else (the plate, the splash)
 * borrows. `o` in a sprite is the outline. */
const I = P.ink;
export const ING = {
  bread: { kind: 'bit', fill: '#d8a860', hi: '#f0d090', rows: ['.oooooo.', 'occhhcco', 'obbbbbbo', 'obdbbdbo', '.oooooo.'], map: { o: I, c: '#d8a860', h: '#f0d090', b: '#f4e4c0', d: '#c89860' } },
  tomato: { kind: 'bit', fill: '#d83028', hi: '#ff8a7a', rows: ['..gg..', '.oooo.', 'orhrro', 'orrrro', 'orrrro', '.oooo.'], map: { o: I, r: '#d83028', h: '#ff8a7a', g: '#3a9a3a' } },
  basil: { kind: 'bit', fill: '#3a9a3a', hi: '#7ad060', rows: ['....oo', '..oggo', '.oghgo', 'ogggo.', '.ooo..'], map: { o: I, g: '#3a9a3a', h: '#7ad060' } },
  garlic: { kind: 'bit', fill: '#f0ece0', hi: '#c8c0a8', rows: ['..o..', '.oco.', 'ogghgo', 'oggggo', '.oooo.'], map: { o: I, c: '#c8c0a8', g: '#f0ece0', h: '#ffffff' } },
  herbs: { kind: 'grain', fill: '#4a8a3a', hi: '#8ac060' },
  water: { kind: 'liquid', fill: '#6aa8d8', hi: '#a8d8f8' },
  broth: { kind: 'liquid', fill: '#d8a040', hi: '#f0c870' },
  rice: { kind: 'grain', fill: '#f4f0e4', hi: '#d8d0c0' },
  butter: { kind: 'bit', fill: '#f8e060', hi: '#fff4a8', rows: ['.ooooo.', 'oyhhhyo', 'oyyyyyo', 'oyyyyyo', '.ooooo.'], map: { o: I, y: '#f8e060', h: '#fff4a8' } },
  pasta: { kind: 'bit', fill: '#f0d070', hi: '#f8e8a0', rows: ['.yhyyhyy.', 'yy.yy.yhy', '.yhyyhyy.', 'yy.yhy.yy', '.yyy.yyy.'], map: { y: '#f0d070', h: '#f8e8a0' } },
  cream: { kind: 'liquid', fill: '#fbf4e4', hi: '#ffffff' },
  pepper: { kind: 'grain', fill: '#282020', hi: '#585050' },
  dough: { kind: 'disc', fill: '#e8d0a0', hi: '#f8ecd0' },
  mozzarella: { kind: 'bit', fill: '#fbf8f0', hi: '#e0dcd0', rows: ['.oooo.', 'owwhwo', 'owwwwo', 'oswwwo', '.oooo.'], map: { o: I, w: '#fbf8f0', h: '#ffffff', s: '#e0dcd0' } },
  eggplant: { kind: 'bit', fill: '#5a2a7a', hi: '#8a5aa8', rows: ['.....og.', '.oooopgo', 'opphpppo', 'oppppo..', '.oooo...'], map: { o: I, p: '#5a2a7a', h: '#8a5aa8', g: '#3a9a3a' } },
  cheese: { kind: 'grain', fill: '#f0c040', hi: '#f8e080' },
  ribs: { kind: 'bit', fill: '#8a3a2a', hi: '#c06040', rows: ['.oooooo.', 'obwbwbwo', 'obbbbbbo', 'orrrrrro', '.oooooo.'], map: { o: I, b: '#8a3a2a', w: '#f0ece0', r: '#c06040' } },
  onion: { kind: 'bit', fill: '#e8d8f0', hi: '#c0a8d0', rows: ['.oooo.', 'olwwlo', 'owllwo', 'owllwo', 'olwwlo', '.oooo.'], map: { o: I, l: '#c0a8d0', w: '#e8d8f0' } },
  wine: { kind: 'liquid', fill: '#7a1030', hi: '#a83050' },
  rosemary: { kind: 'bit', fill: '#3a6a3a', hi: '#6a9a5a', rows: ['g.h.g.h.', 'ogggggg.', 'h.g.h.g.'], map: { o: '#2a4a2a', g: '#3a6a3a', h: '#6a9a5a' } },
  sugar: { kind: 'grain', fill: '#ffffff', hi: '#e0e0e0' },
  vanilla: { kind: 'bit', fill: '#4a3020', hi: '#7a5030', rows: ['.dddddhd', 'ddhdddd.'], map: { d: '#4a3020', h: '#7a5030' } },
  cherry: { kind: 'bit', fill: '#c81030', hi: '#ff5060', rows: ['...g.', '..g..', '.oro.', 'orhro', 'orrro', '.ooo.'], map: { o: I, r: '#c81030', h: '#ff5060', g: '#3a6a3a' } },
  kernels: { kind: 'grain', fill: '#f8f0d0', hi: '#f0c040' },
  oil: { kind: 'liquid', fill: '#d8c030', hi: '#f0e070' },
  salt: { kind: 'grain', fill: '#f8f8f8', hi: '#d0d0d0' },
  potato: { kind: 'bit', fill: '#c8a060', hi: '#e8c890', rows: ['.oooo.', 'obbhbo', 'obbbbo', 'obdbbo', '.oooo.'], map: { o: I, b: '#c8a060', h: '#e8c890', d: '#a88040' } },
  chicken: { kind: 'bit', fill: '#d89050', hi: '#f0b878', rows: ['...ooooo', '..occhco', 'wwocccco', '.w.oooo.'], map: { o: I, c: '#d89050', h: '#f0b878', w: '#f0ece0' } },
  thyme: { kind: 'bit', fill: '#5a8a4a', hi: '#90b070', rows: ['.h.g.h', 'gggggg', 'h.g.h.'], map: { g: '#5a8a4a', h: '#90b070' } },
  beans: { kind: 'bit', fill: '#a86038', hi: '#d08858', rows: ['.oo.oo.', 'obhobho', 'obbobbo', '.oo.oo.'], map: { o: I, b: '#a86038', h: '#d08858' } },
  carrot: { kind: 'bit', fill: '#f08020', hi: '#ffb060', rows: ['.oooooo.g', 'occcchogg', '.oooooo.g'], map: { o: I, c: '#f08020', h: '#ffb060', g: '#3a9a3a' } },
  celery: { kind: 'bit', fill: '#8ac060', hi: '#b8e090', rows: ['.ooooooo', 'ochcccho', '.ooooooo'], map: { o: I, c: '#8ac060', h: '#b8e090' } },
  bacon: { kind: 'bit', fill: '#b83040', hi: '#f0a0a0', rows: ['oooooooo', 'orpprppo', 'oprrprro', 'oooooooo'], map: { o: I, r: '#b83040', p: '#f0a0a0' } },
  chilli: { kind: 'bit', fill: '#e02020', hi: '#ff6040', rows: ['.....og', '..oorro', 'orhroo.', '.ooo...'], map: { o: I, r: '#e02020', h: '#ff6040', g: '#3a9a3a' } },
  parsley: { kind: 'bit', fill: '#3aa040', hi: '#80d070', rows: ['.g.hg.', 'ghgggh', '.gghg.', '..gg..'], map: { g: '#3aa040', h: '#80d070' } },
  cucumber: { kind: 'bit', fill: '#5aa848', hi: '#a8e090', rows: ['.ooo.', 'ogwgo', 'owwwo', 'ogwgo', '.ooo.'], map: { o: I, g: '#5aa848', w: '#a8e090' } },
  salami: { kind: 'bit', fill: '#a83838', hi: '#e08080', rows: ['.oooo.', 'orwrro', 'orrrwo', 'owrrro', 'orrwro', '.oooo.'], map: { o: I, r: '#a83838', w: '#e08080' } },
  flour: { kind: 'grain', fill: '#f8f4ec', hi: '#e0dcd0' },
  ricotta: { kind: 'bit', fill: '#faf6ee', hi: '#e8e0d0', rows: ['..oo..', '.owho.', 'owwwwo', '.oooo.'], map: { o: I, w: '#faf6ee', h: '#ffffff' } },
  chocolate: { kind: 'bit', fill: '#4a2a18', hi: '#7a4a30', rows: ['ooooo', 'occco', 'ochco', 'occco', 'ooooo'], map: { o: I, c: '#4a2a18', h: '#7a4a30' } },
  pistachio: { kind: 'grain', fill: '#98b848', hi: '#c8e080' },
  peel: { kind: 'bit', fill: '#f0a030', hi: '#ffd060', rows: ['.oooo.', 'ophppo', 'oo..oo'], map: { o: I, p: '#f0a030', h: '#ffd060' } },
};

const ingCache = new Map();
/** The sprite of a `bit` ingredient, built once. `null` for the other kinds. */
export function ingredientSprite(name) {
  const d = ING[name];
  if (!d || !d.rows) return null;
  let s = ingCache.get(name);
  if (!s) { s = sprite(d.rows, d.map); ingCache.set(name, s); }
  return s;
}

/**
 * Draws one ingredient centred on (cx, cy), whatever its kind: a sprite, a
 * scatter of grains, or, for a liquid, a small pool. This is what falls into
 * the pan and what sits on the cutting board waiting to.
 */
export function drawIngredient(g, name, cx, cy) {
  const d = ING[name];
  if (!d) return;
  if (d.rows) {
    const s = ingredientSprite(name);
    blit(g, s, cx - s.width / 2, cy - s.height / 2);
  } else if (d.kind === 'grain') {
    for (let k = 0; k < 7; k++) {
      rect(g, cx - 3 + Math.floor(hash(k, 1, 31) * 7), cy - 2 + Math.floor(hash(k, 2, 31) * 5), 1, 1, k % 2 ? d.hi : d.fill);
    }
  } else {
    oval(g, cx, cy, 8, 5, I);
    oval(g, cx, cy, 6, 3, d.fill);
    rect(g, cx - 2, cy - 1, 2, 1, d.hi);
  }
}

/**
 * Where the i-th of n solid ingredients sits on a surface: a lane across it,
 * and a wobble in height that depends only on the index. The falling
 * ingredient aims for the same spot, so it lands where it will stay.
 */
export function bitPos(s, n, i) {
  const lane = (i + 0.5) / Math.max(1, n);
  return [
    Math.round(s.x + 4 + lane * (s.w - 8)),
    Math.round(s.y + s.h / 2 + (hash(i, 3, s.w) - 0.5) * Math.max(1, s.h - 5)),
  ];
}

/**
 * Draws the ingredients that are in the pan onto its surface. `s` is the
 * surface `{x, y, w, h}` the pan drawing returns. Liquids and doughs go down
 * first and cover the surface; everything else is laid on top at a position
 * that depends only on its index, so nothing jumps between frames.
 */
export function ingredients(g, s, list, shape) {
  const bases = list.filter((n) => ING[n] && (ING[n].kind === 'liquid' || ING[n].kind === 'disc'));
  const bits = list.filter((n) => ING[n] && ING[n].kind !== 'liquid' && ING[n].kind !== 'disc');
  const midX = s.x + s.w / 2, midY = s.y + s.h / 2;
  for (const n of bases) {
    const d = ING[n];
    if (shape === 'rect') {
      rect(g, s.x, s.y, s.w, s.h, d.fill);
      if (d.kind === 'disc') rect(g, s.x + 2, s.y + 1, s.w - 4, s.h - 2, d.hi);
      else rect(g, s.x + 3, s.y + 1, Math.max(2, Math.round(s.w / 3)), 1, d.hi);
    } else {
      oval(g, midX, midY, s.w, s.h, d.fill);
      if (d.kind === 'disc') oval(g, midX, midY, s.w - 6, s.h - 3, d.hi);
      else rect(g, s.x + 4, s.y + 1, Math.max(2, Math.round(s.w / 3)), 1, d.hi);
    }
  }
  const n = bits.length;
  bits.forEach((name, i) => {
    const d = ING[name];
    const [x, y] = bitPos(s, n, i);
    if (d.kind === 'grain') {
      for (let k = 0; k < 7; k++) {
        const gx = x - 4 + Math.floor(hash(i, k, 11) * 9);
        const gy = s.y + 1 + Math.floor(hash(i, k, 13) * Math.max(1, s.h - 2));
        rect(g, gx, gy, 1, 1, k % 2 ? d.hi : d.fill);
      }
    } else {
      const spr = ingredientSprite(name);
      blit(g, spr, x - spr.width / 2, y - spr.height / 2);
    }
  });
}

/* ── the pans ────────────────────────────────────────────────────────────
 *
 * Every pan sits with its bottom on `baseY` and is centred on `cx`. Each
 * returns the surface where the food shows, in a slight top-down view: the top
 * of the pan is an oval you can see into. `soot` (0..3) smudges the side.
 *
 * `BOX` says how far each drawing reaches from (cx, baseY): to the left, to
 * the right, and up. That is what lets the body be built once into a canvas
 * of exactly that size and blitted afterwards. */

/* A vessel's wall, seen front on. The light is from the upper left, as it is
 * everywhere in this kitchen: two bright columns near the left edge, a dark
 * band down the right, and — since the loupe went over the stove — a shaded
 * row along the bottom and an ink foot under it. Without the foot the wall's
 * own colour sat straight on the grate and the pan looked pasted on. */
function body(g, x, y, w, h, fill, lo, hi) {
  rect(g, x - 1, y, w + 2, h, I);
  rect(g, x, y, w, h, fill);
  rect(g, x + w - 5, y, 5, h, lo);
  rect(g, x + 2, y + 1, 1, h - 2, hi);
  rect(g, x + 3, y + 1, 1, Math.max(1, h - 4), hi);
  if (h > 6) rect(g, x, y + h - 2, w, 1, lo);
  rect(g, x - 1, y + h - 1, w + 2, 1, I);
}

/* The inside of a pan, and what is left of it once the food goes in. */
const DEEP = '#1c1816';

function surface(g, cx, y, w, h, empty, rim) {
  // The rim first, then the inside: dark when the pan is empty, and darker
  // still towards the middle, which is what makes a flat oval read as a hole.
  oval(g, cx, y, w + 2, h + 2, I);
  oval(g, cx, y, w, h, rim || P.steelHi);
  oval(g, cx, y + 1, w - 4, h - 2, empty);
  if (w > 14 && h > 5) oval(g, cx, y + 2, w - 10, h - 5, DEEP);
  return { x: Math.round(cx - (w - 4) / 2), y: Math.round(y + 1 - (h - 2) / 2), w: w - 4, h: h - 2 };
}

function sootMarks(g, x, y, w, h, soot) {
  for (let k = 0; k < soot; k++) {
    const sx = x + 3 + Math.floor(hash(k, 5, w) * (w - 9));
    rect(g, sx, y + h - 4 - k * 2, 4, 3, I);
    rect(g, sx + 1, y + h - 5 - k * 2, 2, 1, I);
  }
}

const EMPTY = '#2a2422';

export const PANS = {
  skillet(g, cx, baseY, soot) {
    const w = 44, h = 12, x = cx - w / 2, y = baseY - h;
    body(g, x, y, w, h, '#344b55', '#1c2d36', '#76919a');
    rect(g, x + 5, y + h - 3, w - 12, 1, '#506b72');
    // The long handle, with the rivet where it meets the pan.
    rect(g, x + w, y + 1, 17, 4, I); rect(g, x + w, y + 2, 15, 2, P.woodInk); rect(g, x + w, y + 2, 15, 1, P.woodLo);
    rect(g, x + w + 14, y + 2, 1, 2, P.steelHi);
    sootMarks(g, x, y, w, h, soot);
    return surface(g, cx, y, w - 2, 10, EMPTY);
  },
  saucepan(g, cx, baseY, soot) {
    const w = 30, h = 18, x = cx - w / 2, y = baseY - h;
    body(g, x, y, w, h, P.copper, P.copperLo, P.copperHi);
    rect(g, x + w, y + 3, 15, 4, I); rect(g, x + w, y + 4, 13, 2, P.woodInk); rect(g, x + w, y + 4, 13, 1, P.woodLo);
    rect(g, x + 5, y + 5, 2, 2, P.copperHi);
    rect(g, x + w - 4, y + 5, 2, 2, P.steelHi);
    rect(g, x, y + h - 3, w, 1, P.copperLo);
    sootMarks(g, x, y, w, h, soot);
    return surface(g, cx, y, w - 2, 9, EMPTY);
  },
  stockpot(g, cx, baseY, soot) {
    const w = 36, h = 26, x = cx - w / 2, y = baseY - h;
    body(g, x, y, w, h, '#3f827b', '#24524e', '#a0c9b7');
    // Two loop handles.
    rect(g, x - 6, y + 5, 6, 5, I); rect(g, x + w, y + 5, 6, 5, I);
    rect(g, x - 5, y + 6, 3, 3, P.steelHi); rect(g, x + w + 2, y + 6, 3, 3, P.steelHi);
    rect(g, x - 4, y + 7, 2, 1, P.steel); rect(g, x + w + 2, y + 7, 2, 1, P.steel);
    rect(g, x + 5, y + 12, w - 10, 1, '#72a89a');
    rect(g, x + 5, y + h - 4, w - 10, 1, '#24524e');
    sootMarks(g, x, y, w, h, soot);
    return surface(g, cx, y, w - 2, 10, EMPTY);
  },
  casserole(g, cx, baseY, soot) {
    const w = 40, h = 16, x = cx - w / 2, y = baseY - h;
    const red = '#b8482a', redLo = '#7a2c18', redHi = '#e07a50';
    body(g, x, y, w, h, red, redLo, redHi);
    rect(g, x - 6, y + 4, 6, 4, I); rect(g, x + w, y + 4, 6, 4, I);
    rect(g, x - 5, y + 5, 4, 2, redHi); rect(g, x + w + 1, y + 5, 4, 2, red);
    rect(g, x + 4, y + h - 3, w - 8, 1, redLo);
    sootMarks(g, x, y, w, h, soot);
    const s = surface(g, cx, y, w - 2, 9, EMPTY, redHi);
    // The lid, lifted and resting against the far side, so the stew shows.
    rect(g, x + 5, y - 8, w - 10, 1, I);
    rect(g, x + 4, y - 7, w - 8, 3, I);
    rect(g, x + 5, y - 6, w - 10, 1, red); rect(g, x + 6, y - 7, w - 12, 1, redHi);
    rect(g, x + w / 2 - 3, y - 11, 6, 3, I); rect(g, x + w / 2 - 2, y - 10, 4, 1, redHi);
    return s;
  },
  pizza(g, cx, baseY, soot) {
    // A flat stone; the dough will cover its top.
    const w = 48, h = 5, x = cx - w / 2, y = baseY - h;
    body(g, x, y, w, h, '#7a7068', '#4a423c', '#9a9088');
    sootMarks(g, x, y, w, h, soot);
    oval(g, cx, y, w - 2, 12, I);
    oval(g, cx, y, w - 4, 10, '#8a8078');
    oval(g, cx, y, w - 8, 8, '#7a7068');
    return { x: Math.round(cx - (w - 6) / 2), y: y - 4, w: w - 6, h: 9, shape: 'oval' };
  },
  roasting(g, cx, baseY, soot) {
    // A rectangular tray: the one surface that is not an oval.
    const w = 48, h = 10, x = cx - w / 2, y = baseY - h;
    body(g, x, y, w, h, P.steel, P.steelLo, P.steelHi);
    rect(g, x - 4, y + 2, 4, 3, I); rect(g, x + w, y + 2, 4, 3, I);
    rect(g, x - 3, y + 3, 2, 1, P.steelHi); rect(g, x + w + 1, y + 3, 2, 1, P.steelHi);
    sootMarks(g, x, y, w, h, soot);
    rect(g, x + 1, y - 4, w - 2, 8, I);
    rect(g, x + 2, y - 3, w - 4, 6, P.steelHi);
    rect(g, x + 3, y - 2, w - 6, 4, EMPTY);
    return { x: x + 3, y: y - 2, w: w - 6, h: 4, shape: 'rect' };
  },
  tub(g, cx, baseY, soot) {
    // The gelato tub: paper, a pink band with the label, and the ice under it.
    const w = 28, h = 20, x = cx - w / 2, y = baseY - h;
    dither(g, x - 8, baseY - 4, w + 16, 4, '#dff2ff', '#a8d8f8');
    rect(g, x - 9, baseY - 4, w + 18, 1, P.white);
    body(g, x, y, w, h, P.paper, P.greyHi, P.white);
    rect(g, x, y + 6, w, 6, '#e08aa8'); rect(g, x + w - 5, y + 6, 5, 6, '#b86488');
    rect(g, x + 3, y + 8, 10, 1, P.white); rect(g, x + 3, y + 10, 6, 1, P.white);
    sootMarks(g, x, y, w, h, soot);
    return surface(g, cx, y, w - 2, 9, '#3a3634', P.white);
  },
  fryer(g, cx, baseY, soot) {
    const w = 36, h = 20, x = cx - w / 2, y = baseY - h;
    body(g, x, y, w, h, P.steelLo, P.steelInk, P.steel);
    rect(g, x, y + 5, w, 1, P.steelInk);
    // The basket handle, up and to the right, with its grip.
    rect(g, x + w - 8, y - 10, 3, 10, I); rect(g, x + w - 8, y - 10, 12, 3, I);
    rect(g, x + w - 7, y - 9, 1, 8, P.steelHi); rect(g, x + w - 6, y - 9, 8, 1, P.steelHi);
    rect(g, x + w + 1, y - 10, 4, 3, P.red);
    sootMarks(g, x, y, w, h, soot);
    const s = surface(g, cx, y, w - 2, 9, EMPTY);
    // The oil is there before anything goes in, and the basket's mesh over it.
    oval(g, cx, y + 1, w - 8, 6, '#d8b830');
    rect(g, x + 6, y, 8, 1, '#f0e070');
    for (let k = x + 5; k < x + w - 5; k += 3) rect(g, k, y - 1, 1, 4, P.steelHi);
    rect(g, x + 4, y + 1, w - 8, 1, P.steelHi);
    return s;
  },
  bowl(g, cx, baseY, soot) {
    // A wide bowl on a bed of crushed ice, for the one dish served cold.
    const w = 34, h = 13, x = cx - w / 2, y = baseY - h;
    dither(g, x - 7, baseY - 5, w + 14, 5, '#dff2ff', '#a8d8f8');
    rect(g, x - 8, baseY - 5, w + 16, 1, P.white);
    rect(g, x - 3, baseY - 7, 3, 2, P.white); rect(g, x + w + 1, baseY - 6, 3, 2, P.white);
    body(g, x, y, w, h, P.paper, P.greyHi, P.white);
    rect(g, x, y + 4, w, 2, '#3c6cba'); rect(g, x, y + 7, w, 1, '#3c6cba');
    sootMarks(g, x, y, w, h, soot);
    return surface(g, cx, y, w - 2, 10, '#3a3634', P.white);
  },
};

/** The dishes that sit on ice and freeze instead of burning. */
export const COLD = new Set(['tub', 'bowl']);

/** How far each drawing reaches from (cx, baseY): left, right, up. */
export const BOX = {
  skillet: { l: 24, r: 42, up: 19 },
  saucepan: { l: 17, r: 32, up: 24 },
  stockpot: { l: 25, r: 26, up: 33 },
  casserole: { l: 27, r: 28, up: 28 },
  pizza: { l: 26, r: 26, up: 12 },
  roasting: { l: 29, r: 29, up: 16 },
  tub: { l: 24, r: 24, up: 26 },
  fryer: { l: 20, r: 24, up: 31 },
  bowl: { l: 26, r: 26, up: 20 },
};

/** The surface of a pan in screen coordinates, without drawing it: where a
 *  falling ingredient is going. */
export function panSurface(cx, baseY, kind) {
  const pb = panBody(kind, 0);
  return { x: cx + pb.s.x, y: baseY + pb.s.y, w: pb.s.w, h: pb.s.h, shape: pb.s.shape };
}

/** How wide each pan is at the base, so the fire can be drawn wider than it. */
const WIDTHS = { skillet: 44, saucepan: 30, stockpot: 36, casserole: 40, pizza: 48, roasting: 48, tub: 28, fryer: 36, bowl: 34 };

/* The pan bodies, built once per kind and soot level. */
const panCache = new Map();
function panBody(kind, soot) {
  const key = kind + '|' + soot;
  let v = panCache.get(key);
  if (v) return v;
  const draw = PANS[kind] || PANS.saucepan;
  const box = BOX[kind] || BOX.saucepan;
  const { c, g } = canvas(box.l + box.r, box.up + 1);
  const s = draw(g, box.l, box.up, soot);
  v = { c, box, s: { x: s.x - box.l, y: s.y - box.up, w: s.w, h: s.h, shape: s.shape || 'oval' } };
  panCache.set(key, v);
  return v;
}

/**
 * Draws a pan with what is in it, plus the fire under it. Returns the pan's
 * surface in screen coordinates. `o`: `{ soot, inPan, heat, burner, t, still,
 * hide }`; `hide` is an ingredient not to draw yet because it is still
 * falling.
 *
 * The fire is the burner's rate made visible, and it has to be seen: it is
 * drawn wider than the pan so the tongues show at both sides, and a few short
 * ones are drawn again in front of the pan's foot so the flame wraps it.
 *
 * `o.sprite` swaps the VESSEL for a drawn one and nothing else: the ring, the
 * flame, the tongues in front of the foot, the food and the bubbles all stay
 * where they are, because every one of them is something the game says rather
 * than something a picture can hold. See `surfaceFor` for the one hard part,
 * which is where the food sits once the vessel is not the one this file drew.
 */
export function pan(g, cx, baseY, kind, o) {
  const cold = COLD.has(kind);
  const pb = panBody(kind, o.soot || 0);
  const spr = o.sprite || null;
  /* How wide the fire is allowed to be, and where its middle is: the VESSEL's,
   * not the sprite's.
   *
   * `WIDTHS` describes the coded pans, which are drawn from their own centre
   * and have their handles built into that. A drawn pan is a rectangle out of
   * a sheet with a handle sticking out of one side of it, so its box is up to
   * a third wider than the thing that goes on the fire and its middle is three
   * to five pixels off. Sized and centred on the box, the flame came out under
   * the handle and licked past the pan on the other side. `body` is measured
   * off the sheet by the atlas — see `measure` there. */
  const body = spr && spr.body ? spr.body : null;
  const pw = spr ? (body ? body.w : spr.w) : (WIDTHS[kind] || 30);
  // Where the sprite's left edge goes so that the vessel lands on the burner.
  const sx = spr ? Math.round(cx - (body ? body.cx : spr.w / 2)) : 0;
  /* The flame stays INSIDE the pan and UNDER its rim.
   *
   * It used to be `pw + 14` wide and up to 27 tall, which at a high burner is
   * a wall of orange wider and taller than the pan itself: the pan's own dark
   * silhouette disappeared into it and the player could no longer see what was
   * on the fire, which is the one thing the stove is there to show. Flames come
   * out from under a pan, so they belong under its rim and within its width,
   * and how hard the burner is going is read off the gauge on the stove front
   * and the ring underneath — neither of which can swallow the pan. */
  /* And how TALL, off the vessel that is actually on the burner — ONE rule for
   * a drawn pan and a coded one, and the way that got written twice is worth
   * keeping.
   *
   * The first drawn pans came back eleven to eighteen pixels tall where the
   * coded ones are twenty to thirty, so the flame sized for the second read as
   * a bonfire under the first, and the fix looked like scaling the fire down
   * with the pan: a shorter cap, a gentler burner, a tighter ring. It worked
   * and it was wrong. The fire, the ring, the steam and the tongues in front of
   * the foot were all tuned together against a pan of a certain size, and
   * shrinking each of them to match a half-size sprite gives a stove where
   * nothing is broken and nothing has any weight. The sprite was the thing out
   * of scale, so the sprite is what got fixed — and the animation went back to
   * the numbers it always had. */
  /* And its height is the CONTENT's, not the cell's: every cell in a sheet is
   * as tall as the tallest sprite in it, so a roasting tray twenty pixels deep
   * lives in a cell of thirty-one and was getting a stockpot's flame. */
  const tall = spr ? (body ? body.h : spr.h) : pb.box.up;
  const rim = Math.max(6, tall - 3);
  const fh = Math.min(rim, 7 + Math.min(20, (o.burner || 2.4) * 2.6));
  // The lit ring under it all, brighter the harder the burner is going.
  oval(g, cx, baseY + 1, pw + 12, 5, cold ? '#6ab0e0' : (o.burner || 2.4) > 5 ? P.fire : P.fireLo);
  flame(g, cx, baseY + 2, pw - 2, fh, o.t || 0, cold, o.still);
  if (spr) {
    g.drawImage(spr.img, spr.sx, spr.sy, spr.w, spr.h, sx, baseY - spr.h, spr.w, spr.h);
  } else {
    blit(g, pb.c, cx - pb.box.l, baseY - pb.box.up);
  }
  const s = spr ? surfaceFor(pb, spr, cx, baseY, body)
    : { x: cx + pb.s.x, y: baseY + pb.s.y, w: pb.s.w, h: pb.s.h, shape: pb.s.shape };
  /* Soot, on a drawn pan, is a veil over the food's own surface.
   *
   * The coded vessels take a soot level and are BUILT dirty, one cached body
   * per kind and level, which a drawn one cannot be. But soot is not decor:
   * a dirty pan costs the tip, so it has to be visible or the player is being
   * charged for something they cannot see. Grime is in the pan, so darkening
   * the pan's inside says it in the right place. */
  if (spr && o.soot > 0) {
    g.globalAlpha = Math.min(0.55, o.soot * 0.2);
    oval(g, s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, I);
    g.globalAlpha = 1;
  }
  // The tongues in front of the foot of the pan.
  g.save();
  g.beginPath();
  g.rect(cx - pw / 2 - 3, baseY - 4, pw + 6, 6);
  g.clip();
  flame(g, cx, baseY + 2, pw - 6, Math.max(3, Math.round(fh * 0.45)), (o.t || 0) + 37, cold, o.still);
  g.restore();
  let list = o.inPan || [];
  if (o.hide && list.length && list[list.length - 1] === o.hide) list = list.slice(0, -1);
  if (list.length) ingredients(g, s, list, s.shape);
  // Bubbles on a hot surface: the hotter, the more of them.
  if (!cold && o.heat > 40 && list.length) {
    const n = o.heat > 80 ? 4 : o.heat > 60 ? 3 : 2;
    const bucket = o.still ? 0 : Math.floor((o.t || 0) / 160);
    for (let k = 0; k < n; k++) {
      const bx = s.x + 2 + Math.floor(hash(k, bucket, 17) * (s.w - 4));
      const by = s.y + Math.floor(hash(k, bucket, 19) * s.h);
      rect(g, bx, by, 1, 1, P.white);
    }
  }
  return s;
}

/** Steam or frost rising from a pan, `k` puffs, drifting with `t`. */
export function steam(g, cx, topY, t, cold, still) {
  const col = cold ? '#dff2ff' : P.steam;
  for (let k = 0; k < 3; k++) {
    const ph = still ? 0.4 : ((t / 900) + k / 3) % 1;
    const y = topY - 2 - Math.round(ph * 10);
    const x = cx - 8 + k * 7 + Math.round(Math.sin((ph + k) * 6.28) * 2);
    const a = 1 - ph;
    g.globalAlpha = 0.25 + 0.6 * a;
    rect(g, x, y, 3, 2, col);
    rect(g, x + 1, y - 1, 1, 1, col);
    g.globalAlpha = 1;
  }
}

/* ── the dish, plated ─────────────────────────────────────────────────────
 *
 * What the customer gets has to look like what was cooked. The pan says how
 * it is served (a bowl, a slice, a tray, a cone) and the ingredients say what
 * colour it is and what sits on top. Centred on (cx, y), the plate's centre. */
export function plated(g, cx, y, kind, list) {
  const ings = list || [];
  const col = (i, k) => (ING[ings[i]] ? ING[ings[i]][k || 'fill'] : P.amber);
  const bits = ings.filter((n) => ING[n] && ING[n].kind === 'bit');
  const bases = ings.filter((n) => ING[n] && ING[n].kind === 'liquid');
  const top = (n, dx, dy) => { if (n) { const s = ingredientSprite(n); if (s) blit(g, s, cx + dx - s.width / 2, y + dy - s.height / 2); } };
  switch (kind) {
    case 'pizza': {
      oval(g, cx, y - 1, 18, 9, I);
      oval(g, cx, y - 1, 16, 7, '#e8c890');
      oval(g, cx, y - 1, 12, 5, '#d83028');
      for (let k = 0; k < 4; k++) rect(g, cx - 5 + k * 3, y - 2 + (k % 2), 2, 1, '#fbf8f0');
      if (bits.length > 3) top(bits[3], 2, -1);
      break;
    }
    case 'saucepan':
    case 'stockpot':
    case 'bowl': {
      // A bowl with the liquid, and two things showing.
      oval(g, cx, y - 1, 18, 9, I);
      oval(g, cx, y - 1, 16, 7, P.white);
      oval(g, cx, y - 2, 12, 4, bases.length ? col(ings.indexOf(bases[0])) : col(0));
      top(bits[0], -3, -2); top(bits[bits.length - 1], 3, -2);
      break;
    }
    case 'casserole': {
      // A mound of stew with the meat on top.
      oval(g, cx, y - 1, 16, 7, I);
      oval(g, cx, y - 1, 14, 5, '#8a3a2a');
      rect(g, cx - 4, y - 3, 5, 1, '#c06040');
      top(bits[0], -2, -2); top(bits[1], 4, 0);
      break;
    }
    case 'tub': {
      // Two scoops in a cup, and a cherry.
      rect(g, cx - 5, y - 1, 10, 5, I); rect(g, cx - 4, y, 8, 3, '#e8d0a0');
      oval(g, cx - 2, y - 3, 8, 6, I); oval(g, cx - 2, y - 3, 6, 4, '#fbf4e4');
      oval(g, cx + 3, y - 4, 8, 6, I); oval(g, cx + 3, y - 4, 6, 4, col(1, 'hi'));
      top(bits[bits.length - 1], 2, -7);
      break;
    }
    case 'fryer': {
      // Two golden tubes with the filling showing at the ends.
      for (const dx of [-4, 3]) {
        rect(g, cx + dx - 5, y - 3, 11, 5, I); rect(g, cx + dx - 4, y - 2, 9, 3, '#d8a040');
        rect(g, cx + dx - 3, y - 2, 7, 1, '#f0c870');
        rect(g, cx + dx - 4, y - 2, 1, 3, '#faf6ee'); rect(g, cx + dx + 4, y - 2, 1, 3, '#faf6ee');
      }
      for (let k = 0; k < 4; k++) rect(g, cx - 6 + k * 4, y - 4 + (k % 2), 1, 1, k % 2 ? '#98b848' : '#4a2a18');
      break;
    }
    case 'roasting': {
      top(bits[1] || bits[0], -3, -2); top(bits[0], 4, -1);
      rect(g, cx - 3, y + 1, 7, 1, '#5a8a4a');
      break;
    }
    default: {
      // Off the skillet: the pieces laid on the plate with a smear of sauce.
      oval(g, cx, y, 14, 5, col(ings.length - 1, 'hi'));
      top(bits[0], -3, -2); top(bits[1], 3, -1); if (bits[2]) top(bits[2], 0, 1);
    }
  }
}

/* ── walls and wood ──────────────────────────────────────────────────────── */

/** A brick wall: 12x5 bricks with a pixel of mortar, courses offset by half a
 *  brick, each brick one of three shades so the wall is not a wallpaper. */
export function bricks(g, x, y, w, h, seed) {
  rect(g, x, y, w, h, P.mortar);
  const BW = 12, BH = 5;
  for (let row = 0, yy = y; yy < y + h; row++, yy += BH + 1) {
    const off = row % 2 ? 6 : 0;
    for (let xx = x - off; xx < x + w; xx += BW + 1) {
      const n = hash(row, xx, seed || 1);
      const col = n < 0.62 ? P.brick : n < 0.82 ? P.brickHi : P.brickLo;
      const bx = Math.max(x, xx), bw = Math.min(x + w, xx + BW) - bx;
      const bh = Math.min(y + h, yy + BH) - yy;
      if (bw > 0 && bh > 0) {
        rect(g, bx, yy, bw, bh, col);
        if (bh === BH) rect(g, bx, yy + BH - 1, bw, 1, P.brickLo);
        if (n > 0.9 && bw > 3) rect(g, bx + 1, yy + 1, 2, 1, P.brickHi);
      }
    }
  }
}

/** Kitchen tiles: 8x8 cream squares with a grout line, a few of them darker
 *  or chipped so the wall reads as a wall. */
export function tiles(g, x, y, w, h, seed) {
  // Quiet, warm grout: the wall stays behind the staff and chalk lettering.
  rect(g, x, y, w, h, '#77806e');
  const T = 12;
  for (let row = 0, yy = y; yy < y + h; row++, yy += T) {
    for (let col = 0, xx = x; xx < x + w; col++, xx += T) {
      const n = hash(row, col, seed || 3);
      const fill = n < 0.7 ? '#a5ac97' : n < 0.9 ? '#9da48f' : '#939b85';
      const tw = Math.min(T - 1, x + w - xx), th = Math.min(T - 1, y + h - yy);
      if (tw > 0 && th > 0) {
        rect(g, xx, yy, tw, th, fill);
        rect(g, xx, yy, tw, 1, '#b5baa5');
        if (n > 0.96 && tw > 4) rect(g, xx + 2, yy + 3, 2, 1, '#858d79');
      }
    }
  }
}

/** Darkens an area with a checker of ink at `alpha`: the shadow under a shelf
 *  or the bottom of a wall. */
export function shadow(g, x, y, w, h, alpha) {
  g.globalAlpha = alpha === undefined ? 0.45 : alpha;
  dither(g, x, y, w, h, P.ink, 'rgba(0,0,0,0)');
  g.globalAlpha = 1;
}

/** Horizontal boards: the top of a counter. */
export function boards(g, x, y, w, h, seed) {
  rect(g, x, y, w, h, P.wood);
  for (let yy = y; yy < y + h; yy += 4) {
    rect(g, x, yy, w, 1, P.woodHi);
    rect(g, x, yy + 3, w, 1, P.woodLo);
    for (let k = 0; k < w / 16; k++) {
      const gx = x + Math.floor(hash(yy, k, seed || 2) * w);
      rect(g, gx, yy + 1 + Math.floor(hash(k, yy, 3) * 2), 3, 1, P.woodLo);
    }
  }
}

/** Vertical planks: the front of a counter. */
export function planks(g, x, y, w, h) {
  rect(g, x, y, w, h, P.woodLo);
  for (let xx = x; xx < x + w; xx += 10) {
    rect(g, xx + 1, y, 8, h, P.wood);
    rect(g, xx + 1, y, 1, h, P.woodHi);
    rect(g, xx + 8, y, 1, h, P.woodLo);
  }
  dither(g, x, y + h - 3, w, 3, P.woodLo, P.woodInk);
}

/** A shelf board with its two brackets. */
export function shelf(g, x, y, w) {
  rect(g, x, y, w, 1, P.woodHi);
  rect(g, x, y + 1, w, 2, P.wood);
  rect(g, x, y + 3, w, 1, P.woodInk);
  rect(g, x + 3, y + 4, 2, 3, P.woodInk);
  rect(g, x + w - 5, y + 4, 2, 3, P.woodInk);
}

/** A wooden pillar. */
export function pillar(g, x, y, w, h) {
  rect(g, x - 1, y, w + 2, h, P.woodInk);
  rect(g, x, y, w, h, P.wood);
  rect(g, x, y, 1, h, P.woodHi);
  rect(g, x + w - 2, y, 2, h, P.woodLo);
  for (let yy = y + 5; yy < y + h; yy += 9) rect(g, x + 1, yy, w - 3, 1, P.woodLo);
}

/** Riveted steel: the stove's front. */
export function steel(g, x, y, w, h) {
  rect(g, x, y, w, h, P.steel);
  rect(g, x, y, w, 1, P.steelHi);
  rect(g, x, y + h - 2, w, 2, P.steelLo);
  dither(g, x, y + 1, w, 2, P.steel, P.steelHi);
}

/** The extractor hood over the stove: a steel canopy with a lip and lights. */
export function hood(g, x, y, w, h) {
  rect(g, x, y, w, h, P.steelLo);
  rect(g, x, y, w, 1, P.steelHi);
  dither(g, x, y + 1, w, h - 3, P.steelLo, P.steel);
  rect(g, x, y + h - 3, w, 2, P.steel);
  rect(g, x, y + h - 1, w, 1, P.steelInk);
  for (let lx = x + 30; lx < x + w - 10; lx += 60) {
    rect(g, lx - 3, y + h - 3, 7, 2, I); rect(g, lx - 2, y + h - 3, 5, 1, P.lamp);
  }
  // The rivets along the lip.
  for (let rx = x + 6; rx < x + w; rx += 12) rect(g, rx, y + 2, 1, 1, P.steelHi);
}

/** A steel rail with hooks, the kind pans and ladles hang from. */
export function rail(g, x, y, w) {
  rect(g, x, y, w, 2, I);
  rect(g, x, y, w, 1, P.steelHi);
  rect(g, x, y + 1, w, 1, P.steel);
  rect(g, x, y - 2, 2, 4, I); rect(g, x + w - 2, y - 2, 2, 4, I);
}

/* ── things on shelves and hooks ────────────────────────────────────────── */

export function jar(g, x, y, w, h, fill, lid) {
  rect(g, x - 1, y + 1, w + 2, h - 1, I);
  rect(g, x, y + 2, w, h - 3, fill);
  rect(g, x + 1, y + 3, 1, h - 5, '#ffffff88');
  rect(g, x, y, w, 2, I);
  rect(g, x + 1, y, w - 2, 2, lid || P.woodLo);
  rect(g, x + 1, y + Math.floor(h / 2), w - 2, 2, P.cream);
}

export function bottle(g, x, y, h, fill, cap) {
  rect(g, x, y, 4, h, I);
  rect(g, x + 1, y + 1, 2, h - 2, fill);
  rect(g, x + 1, y + Math.floor(h / 2), 1, Math.floor(h / 3), '#ffffff66');
  rect(g, x + 1, y - 4, 2, 4, I);
  rect(g, x + 1, y - 4, 1, 2, cap || P.amber);
}

/** A tall oil bottle with a pouring spout and a label. */
export function oilBottle(g, x, y, h) {
  rect(g, x, y, 6, h, I);
  rect(g, x + 1, y + 1, 4, h - 2, '#b8a828');
  rect(g, x + 1, y + 2, 1, h - 5, '#e0d060');
  rect(g, x + 2, y + Math.floor(h / 2) - 1, 2, 3, P.cream);
  rect(g, x + 2, y - 5, 2, 5, I); rect(g, x + 2, y - 5, 1, 4, P.steelHi);
  rect(g, x + 1, y - 2, 4, 2, I);
}

export function squeeze(g, x, y, fill) {
  rect(g, x, y, 5, 10, I);
  rect(g, x + 1, y + 1, 3, 8, fill);
  rect(g, x + 1, y + 2, 1, 5, '#ffffff66');
  rect(g, x + 1, y - 3, 3, 3, I);
  rect(g, x + 2, y - 3, 1, 3, P.greyHi);
}

export function plates(g, x, y, n) {
  for (let k = 0; k < n; k++) {
    rect(g, x - k % 2, y - k * 2, 12 + (k % 2) * 2, 2, I);
    rect(g, x + 1 - k % 2, y - k * 2, 10 + (k % 2) * 2, 1, P.white);
  }
}

export function cup(g, x, y, fill) {
  rect(g, x, y, 6, 6, I); rect(g, x + 1, y + 1, 4, 4, fill || P.white);
  rect(g, x + 6, y + 1, 2, 4, I); rect(g, x + 6, y + 2, 1, 2, fill || P.white);
}

/** Each guest has a small place setting, drawn on the counter at native
 * resolution. Keep the centre free for the plate and the arriving food. */
export function guestSetting(g, cx, y, face, t, still) {
  const variant = face % 3;
  const x = cx - 25;
  // A contact shadow and a porcelain saucer ground the drink on the wood.
  rect(g, x - 2, y, 11, 2, P.woodLo);
  rect(g, x - 1, y - 1, 9, 1, P.cream);
  if (variant === 2) {
    // Water tumbler: rim, blue water, and a broken vertical reflection.
    rect(g, x + 1, y - 8, 6, 8, P.ink);
    rect(g, x + 2, y - 7, 4, 6, P.steelLo);
    rect(g, x + 2, y - 4, 4, 3, P.steelHi);
    rect(g, x + 2, y - 7, 1, 2, P.white);
    rect(g, x + 1, y - 8, 6, 1, P.steelHi);
  } else {
    cup(g, x, y - 6, variant ? P.teal : P.cream);
    rect(g, x + 1, y - 5, 4, 1, P.woodLo); // coffee visible over the lip
    rect(g, x + 1, y - 3, 1, 2, P.white);
    const drift = still ? 0 : Math.floor((t + face * 211) / 700) % 2;
    rect(g, x + 2 + drift, y - 10, 1, 2, P.smoke);
    rect(g, x + 3 - drift, y - 13, 1, 1, P.smoke);
  }
  // Folded linen and a fork, beside (never on top of) the dinner plate.
  rect(g, cx + 15, y - 2, 9, 4, P.woodLo);
  rect(g, cx + 15, y - 3, 8, 3, P.cream);
  rect(g, cx + 16, y - 3, 5, 1, P.white);
  rect(g, cx + 21, y - 2, 1, 2, P.grey);
  rect(g, cx + 18, y - 6, 1, 6, P.steelHi);
  rect(g, cx + 16, y - 6, 1, 2, P.steelHi);
  rect(g, cx + 20, y - 6, 1, 2, P.steelHi);
  rect(g, cx + 16, y - 4, 5, 1, P.steelHi);
}

/** A ladle hanging from a hook: the handle up, the bowl down. */
export function ladle(g, x, y) {
  stamp(g, [
    '..###..', '..#s#..', '..#w#..', '..#w#..', '..#s#..',
    '..#s#..', '..#s#..', '..#s#..', '.#s#...', '.#s#...',
    '.#####.', '#ssssl#', '#sdddl#', '.#lll#.', '..###..',
  ], { '#': I, s: P.steelHi, l: P.steel, d: P.steelLo, w: P.woodHi }, x, y);
}

/** A whisk hanging. */
export function whisk(g, x, y) {
  stamp(g, [
    '..###..', '..#s#..', '..#w#..', '..#w#..', '..#w#..',
    '..#s#..', '..###..', '.#sss#.', '#s#s#s#', '#s#s#s#',
    '#s#s#s#', '#s#s#s#', '.#sss#.', '..#s#..', '...#...',
  ], { '#': I, s: P.steelHi, w: P.woodHi }, x, y);
}

/** A spatula hanging. */
export function spatula(g, x, y) {
  stamp(g, [
    '..###..', '..#s#..', '..#w#..', '..#w#..', '..#w#..',
    '..#s#..', '..#s#..', '.#####.', '#ssssl#', '#s#s#l#',
    '#s#s#l#', '#s#s#l#', '#ssssl#', '.#lll#.', '..###..',
  ], { '#': I, s: P.steelHi, l: P.steel, w: P.woodHi }, x, y);
}

/** Round cookware seen from the back, with a hanging loop and a stepped rim. */
export function hangingPan(g, x, y, material = 'copper') {
  const metals = material === 'iron'
    ? [P.steelLo, P.steel, P.steelInk]
    : material === 'steel' ? [P.steel, P.steelHi, P.steelLo]
      : [P.copper, P.copperHi, P.copperLo];
  stamp(g, [
    '......###......', '......#s#......', '......#w#......',
    '......#w#......', '......#s#......', '.....#####.....',
    '...##HHHHH##...', '...#HcccccL#...', '..#HccccccLL#..',
    '..#HcccccccL#..', '..#HcccHcccL#..', '..#ccccccccL#..',
    '..#LccccccLL#..', '...#LLLLLLL#...', '...##LLLLL##...',
    '.....#####.....',
  ], { '#': I, s: P.steelHi, w: P.woodLo, c: metals[0], H: metals[1], L: metals[2] }, x, y);
}

/** A braid of garlic hanging on a string. */
export function garlic(g, x, y) {
  rect(g, x + 3, y, 1, 4, P.cream);
  const bulbs = [[0, 3], [3, 6], [0, 9], [3, 12]];
  for (const [dx, dy] of bulbs) {
    stamp(g, ['..s..', '.###.', '#whs#', '.###.'],
      { '#': I, w: P.white, h: P.cream, s: P.greyHi }, x + dx, y + dy);
  }
}

/** A string of dried chillies. */
export function chillies(g, x, y) {
  rect(g, x + 2, y, 1, 3, P.cream);
  for (let k = 0; k < 3; k++) {
    const dx = k % 2 ? 2 : 0;
    stamp(g, ['.g..', '#hr#', '.rr#', '..r#', '..#.'],
      { '#': I, g: P.greenLo, h: '#e46f3d', r: '#a73523' }, x + dx, y + 2 + k * 4);
  }
}

export function loaf(g, x, y) {
  rect(g, x, y, 10, 5, I);
  rect(g, x + 1, y + 1, 8, 3, '#d8a860');
  rect(g, x + 2, y + 1, 6, 1, '#f0d090');
  rect(g, x + 3, y + 2, 1, 1, '#a87838'); rect(g, x + 6, y + 2, 1, 1, '#a87838');
}

/** A cutting board with vegetables and a knife on it. */
export function board(g, x, y) {
  rect(g, x, y, 18, 4, I); rect(g, x + 1, y + 1, 16, 2, P.woodHi); rect(g, x + 1, y + 2, 16, 1, P.wood);
  rect(g, x + 2, y - 2, 5, 3, I); rect(g, x + 3, y - 2, 3, 2, '#b94228');
  rect(g, x + 4, y - 3, 1, 1, P.greenLo);
  rect(g, x + 8, y, 2, 1, P.cream); rect(g, x + 10, y - 1, 2, 1, P.cream);
  // A blade laid on the board, its dark grip kept distinct from the vegetables.
  rect(g, x + 11, y - 3, 6, 2, I); rect(g, x + 12, y - 3, 4, 1, P.steelHi);
  rect(g, x + 9, y - 2, 3, 1, P.woodInk);
}

/** A knife block with three handles showing. */
export function knifeBlock(g, x, y) {
  rect(g, x + 2, y, 8, 2, I); rect(g, x, y + 2, 11, 6, I);
  rect(g, x + 2, y + 1, 7, 2, P.woodHi); rect(g, x + 1, y + 3, 7, 4, P.wood);
  rect(g, x + 8, y + 3, 2, 4, P.woodLo);
  rect(g, x + 2, y + 5, 4, 1, P.woodHi);
  for (let k = 0; k < 3; k++) {
    const top = y - 3 + k % 2;
    rect(g, x + 2 + k * 3, top, 2, 5 - k % 2, I);
    rect(g, x + 2 + k * 3, top + 1, 1, 1, P.steelHi);
  }
}

/** A sack of flour, tied at the top, slumped. */
export function sack(g, x, y) {
  rect(g, x + 4, y, 6, 3, I); rect(g, x + 5, y + 1, 4, 1, P.cream);
  rect(g, x + 2, y + 3, 10, 2, I); rect(g, x + 1, y + 5, 12, 8, I);
  rect(g, x, y + 8, 14, 5, I); rect(g, x + 2, y + 5, 10, 7, '#d8c8a0');
  rect(g, x + 1, y + 9, 12, 3, '#d8c8a0'); rect(g, x + 10, y + 6, 2, 6, '#b8a880');
  rect(g, x + 3, y + 6, 6, 5, P.paper);
  rect(g, x + 5, y + 7, 1, 3, P.wood); rect(g, x + 4, y + 7, 3, 1, P.woodHi);
  rect(g, x + 1, y + 13, 12, 1, I);
}

/** A folded towel hanging over a rail. */
export function towel(g, x, y, color) {
  rect(g, x, y, 8, 10, I); rect(g, x + 1, y + 1, 6, 8, color || P.white);
  rect(g, x + 1, y + 9, 6, 2, I); rect(g, x + 2, y + 9, 4, 1, P.cream);
  rect(g, x + 1, y + 2, 6, 1, P.greyHi); rect(g, x + 5, y + 3, 1, 6, P.greyHi);
  rect(g, x + 1, y + 7, 6, 1, P.red);
}

/** A bowl of eggs. */
export function eggs(g, x, y) {
  for (const [dx, dy] of [[1, 1], [4, 0], [7, 1]]) {
    stamp(g, ['.##.', '#hh#', '#hs#', '.##.'], { '#': I, h: P.cream, s: P.greyHi }, x + dx, y + dy);
  }
  rect(g, x, y + 3, 12, 2, I); rect(g, x + 1, y + 3, 10, 1, P.cream);
  rect(g, x + 1, y + 5, 10, 1, I); rect(g, x + 2, y + 5, 8, 1, P.copper);
  rect(g, x + 3, y + 6, 6, 1, I);
}

/** A basket of bread rolls. */
export function basket(g, x, y) {
  rect(g, x, y + 4, 14, 5, I); rect(g, x + 1, y + 5, 12, 3, P.woodHi);
  rect(g, x + 1, y + 6, 12, 1, P.wood);
  for (const dx of [1, 5, 9]) { rect(g, x + dx, y + 1, 4, 4, I); rect(g, x + dx + 1, y + 2, 2, 2, '#d8a860'); rect(g, x + dx + 1, y + 2, 1, 1, '#f0d090'); }
}

export function produce(g, x, y, fill, hi, w) {
  const ww = w || 4;
  rect(g, x - 1, y, ww + 2, ww, I);
  rect(g, x, y, ww, ww, fill);
  rect(g, x, y, 1, 1, hi);
}

export function stool(g, cx, y) {
  rect(g, cx - 7, y, 14, 3, I);
  rect(g, cx - 6, y, 12, 2, P.woodHi);
  rect(g, cx - 5, y + 3, 2, 6, P.woodInk); rect(g, cx + 3, y + 3, 2, 6, P.woodInk);
}

/** A pendant lamp hanging from the ceiling on a cord, with its light. */
export function pendant(g, x, y, drop) {
  rect(g, x, y, 1, drop, I);
  rect(g, x - 4, y + drop, 9, 1, I); rect(g, x - 5, y + drop + 1, 11, 3, I);
  rect(g, x - 4, y + drop + 1, 9, 2, '#3a4a5a'); rect(g, x - 3, y + drop + 1, 4, 1, '#5a6a7a');
  rect(g, x - 2, y + drop + 4, 5, 1, P.lamp); rect(g, x - 1, y + drop + 5, 3, 1, '#ffeec0');
}

/* ── the small glyphs ───────────────────────────────────────────────────── */

const STAR = ['..#..', '.###.', '#####', '.###.', '#...#'];
const PAPER_STAR = ['...o...', '..ofo..', 'oofffoo', '.offfo.', '..ofo..', '.oo.oo.', '.o...o.'];
export function star(g, x, y, lit, onPaper = false) {
  if (onPaper) {
    // A gold centre and dark outline keep all five points legible on parchment.
    // Lost stars retain only a muted outline, with the paper showing through.
    stamp(g, PAPER_STAR, lit ? { o: '#65451f', f: P.amber } : { o: '#958871' }, x, y);
    if (lit) rect(g, x + 3, y + 2, 1, 1, P.gold);
    return;
  }
  stamp(g, STAR, { '#': lit ? P.amber : P.greyLo }, x, y);
  if (lit) rect(g, x + 2, y + 1, 1, 1, P.gold);
}

/** Cached quality rows: larger outlined stars on paper, compact ones on the stove. */
export function stars(g, x, y, n, total, onPaper = false) {
  const t = total || 5;
  const lit = Math.max(0, Math.min(t, n));
  const size = onPaper ? ORDER_STAR.size : 5;
  const advance = onPaper ? ORDER_STAR.advance : 6;
  blit(g, sprited('stars/' + t + '/' + lit + '/' + onPaper, (t - 1) * advance + size, size, (s) => {
    for (let k = 0; k < t; k++) star(s, k * advance, 0, k < lit, onPaper);
  }), x, y);
}

const NOTE = ['...##', '...#.', '...#.', '...#.', '.###.', '####.', '.##..'];
const NOTE2 = ['..#####', '..#...#', '..#...#', '..#...#', '###.###', '###.###', '.#...#.'];
export function note(g, x, y, color, double) {
  // Five copies of this go out with every strum, and each is stamped in two
  // colours: two dozen a frame during a busy service, in four shapes.
  blit(g, sprited('note/' + color + '/' + (double ? 2 : 1), double ? 7 : 5, 7, (s) => {
    stamp(s, double ? NOTE2 : NOTE, { '#': color }, 0, 0);
  }), x, y);
}

const CLEF = [
  '...#...', '..##...', '..#.#..', '..#.#..', '..##...', '..#....', '.###...',
  '##.#...', '#..#...', '#.##...', '.##....', '..#....', '.###...', '.#.#...', '..##...',
];
export function clef(g, x, y, color) {
  stamp(g, CLEF, { '#': color }, x, y);
}

const TICKET = ['#########', '#.......#', '#.#.#.#.#', '#.......#', '#########'];
export function ticket(g, x, y, alive) {
  blit(g, sprited('ticket/' + (alive ? 1 : 0), 9, 5, (s) => {
    stamp(s, TICKET, { '#': alive ? P.amber : P.greyLo }, 0, 0);
    if (alive) rect(s, 1, 1, 7, 1, P.gold);
    else { rect(s, 2, 1, 5, 3, P.redLo); rect(s, 3, 2, 3, 1, P.red); }
  }), x, y);
}

const CLOCK = ['.#####.', '#.....#', '#..#..#', '#..##.#', '#.....#', '#.....#', '.#####.'];
export function clockIcon(g, x, y, color) {
  blit(g, sprited('clockIcon/' + color, 7, 7, (s) => stamp(s, CLOCK, { '#': color }, 0, 0)), x, y);
}

export function plateIcon(g, x, y) {
  blit(g, sprited('plateIcon', 9, 3, (s) => {
    rect(s, 0, 1, 9, 2, I); rect(s, 1, 1, 7, 1, P.white);
    rect(s, 2, 0, 5, 1, I); rect(s, 3, 0, 3, 1, P.greyHi);
  }), x, y);
}

/** A dinner plate on the counter, empty or with the dish `full` on it:
 *  `{ pan, ingredients }`. */
export function dinnerPlate(g, cx, y, full) {
  oval(g, cx, y, 22, 7, I);
  oval(g, cx, y, 20, 5, P.white);
  oval(g, cx, y, 15, 3, P.greyHi);
  if (full) plated(g, cx, y, full.pan, full.ingredients);
}

/**
 * Where the food sits inside a DRAWN pan.
 *
 * The coded vessels each hand back their own surface, because each one is a
 * function that knows where it put its rim. A drawn one is a picture and knows
 * nothing, and the honest answers are both bad: measure nine openings by hand
 * and keep nine more numbers in step with a sheet that gets regenerated, or
 * pick one proportion and watch the food float above the stockpot and drown in
 * the skillet.
 *
 * The third answer is that the coded pan already IS the measurement. Both are
 * the same subject from the same angle — a vessel seen slightly from above —
 * so the surface's position as a FRACTION of the vessel carries over even
 * though the pixels do not. The depth of the food below the top of the pan and
 * the width of the food as a share of the pan's width are read off the coded
 * body, and applied to whatever size the drawn one turned out to be. Nothing
 * to keep in step, and a regenerated sheet lands with the food still in it.
 */
function surfaceFor(pb, spr, cx, baseY, body) {
  const up = Math.max(1, pb.box.up);
  const pw = Math.max(1, WIDTHS_OF(pb));
  const depth = (up + pb.s.y) / up;          // how far below the rim, 0..1
  const deep = pb.s.h / up;                  // and how deep the food is
  const wide = pb.s.w / pw;                  // as a share of the pan's width
  /* Off the BODY where there is one: a skillet's box is half handle, and food
   * measured as a share of that box would be drawn wider than the pan. */
  const vw = body ? body.w : spr.w;
  const vh = body ? body.h : spr.h;
  const w = Math.max(4, Math.round(vw * wide));
  const h = Math.max(2, Math.round(vh * deep));
  return {
    x: cx - Math.round(w / 2),
    y: baseY - vh + Math.round(vh * depth),
    w, h, shape: pb.s.shape,
  };
}

/** The coded body's own width, which is the denominator the proportions above
 *  are taken against. It is the box the cached canvas was drawn in. */
function WIDTHS_OF(pb) {
  return pb.box.l + pb.box.r;
}

/** A small side plate with the next ingredient on it, waiting by the burner. */
export function sidePlate(g, cx, y, name) {
  oval(g, cx, y, 14, 5, I);
  oval(g, cx, y, 12, 3, P.white);
  if (name) drawIngredient(g, name, cx, y - 2);
}

/* ── a cached static drawing ─────────────────────────────────────────────── */

/** Draws with `fn(g)` into an offscreen canvas of `w` by `h`, once. */
export function baked(w, h, fn) {
  const { c, g } = canvas(w, h);
  fn(g);
  return c;
}

export { blit };
