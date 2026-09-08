/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE CHORD DIAGRAM, IN VECTOR, AND WHY IT IS THE ONE THING THAT IS NOT PIXELS.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Everything else on this screen is drawn into a 480x270 buffer and blown up,
 * because that is what makes it a game and not a form. The chord diagram was
 * drawn there too, and it was wrong three times running: a fingering is not
 * scenery, it is the INSTRUCTION, and at three pixels a digit the instruction
 * was a smudge. Making the pixel version bigger bought a bigger smudge.
 *
 * So this one thing is drawn as SVG, on a layer over the canvas, in the same
 * coordinate system: the layer's `viewBox` is `0 0 480 270`, so a box here is
 * given in exactly the same units as `GEO`, and the browser renders it at the
 * real resolution of the screen. A dot is a circle, a finger number is a font,
 * and both are as sharp as the display can make them at any size the stage
 * happens to be.
 *
 * It stays a 16-bit kitchen. The one panel a player has to READ is allowed to
 * be legible.
 *
 * ── WHAT IT DRAWS ────────────────────────────────────────────────────────
 *
 *   - six strings and four fret spaces, the low E on the left, as every chord
 *     book in the world prints them;
 *   - a thick nut when the shape sits at the first fret, and a FRET NUMBER
 *     beside the board when it does not, which is what makes a shape further
 *     up the neck readable as being further up the neck;
 *   - a filled dot per finger with its number in it, and a BARRE — one bar
 *     across the strings a single finger covers — because a barre is a
 *     different physical act from four separate dots and has to look like one;
 *   - `o` over an open string, `x` over a muted one.
 *
 * It knows nothing about the game: it takes what `menu.diagram()` returns and
 * a box, and gives back markup.
 */

import { P } from './pix.js';

/* The geometry of one diagram, in the units of the box it is given. Fractions
 * are fine and are the point: this is not on the pixel grid. */
const PAD_X = 5;            // from the edge of the box to the outer strings
const HEAD = 7.5;           // the row above the nut, for the o and x markers
const STRINGS = 6;
const SPACES = 4;           // fret spaces shown

/** Six strings across the board, string 6 (low E) on the left. */
const stringX = (box, k) => box.x + PAD_X + (k * (box.w - 2 * PAD_X)) / (STRINGS - 1);

/**
 * Which of the dots are one barre.
 *
 * A barre is a single finger lying across the neck at one fret. Drawn as
 * separate dots it reads as "put four fingers here", which is the opposite of
 * what a barre asks for.
 *
 * The bar spans from the outermost string that finger holds to the other, and
 * it is only drawn when the finger really does lie flat: every string between
 * its ends has to be one it holds, or one pressed at a HIGHER fret — which is
 * another finger standing on top of the bar, and is exactly what F#m and Bm
 * are. A gap that is open or muted is not a barre, it is two dots, because
 * that is what the hand is doing.
 */
export function barres(d) {
  const groups = new Map();
  for (const s of d.strings) {
    if (s.fret <= 0 || !s.finger) continue;
    const key = s.finger + '@' + s.fret;
    const g = groups.get(key) || { finger: s.finger, fret: s.fret, cols: [] };
    g.cols.push(6 - s.string);              // 0 is the low E, on the left
    groups.set(key, g);
  }
  const out = [];
  for (const g of groups.values()) {
    if (g.cols.length < 2) continue;
    const first = Math.min.apply(null, g.cols);
    const last = Math.max.apply(null, g.cols);
    let flat = true;
    for (let c = first; c <= last; c++) {
      if (g.cols.indexOf(c) >= 0) continue;
      if (!(d.strings[c] && d.strings[c].fret > g.fret)) { flat = false; break; }
    }
    if (flat) out.push({ finger: g.finger, fret: g.fret, first, last, n: g.cols.length });
  }
  return out;
}

/**
 * The window of frets the diagram shows.
 *
 * Open shapes start at the nut. A shape whose lowest finger is past the third
 * fret slides the window up to it and prints the number, which is how a chord
 * book says "this shape, but up there".
 */
export function window_(d) {
  const low = d.lowestFret || 0;
  const high = d.highestFret || 0;
  if (!low || high <= SPACES) return { from: 1, nut: true };
  const from = Math.max(1, Math.min(low, high - SPACES + 1));
  return { from, nut: from === 1 };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * One diagram as SVG markup, positioned inside `box` ({x, y, w, h} in the
 * layer's units, which are the game's units).
 *
 * `o.dim` draws it as spent: the shape is still readable but it is no longer
 * what is being asked for.
 */
export function chordSvg(d, box, o) {
  const opt = o || {};
  const win = window_(d);
  const top = box.y + HEAD;
  const boardH = box.h - HEAD - 1;
  const rowH = boardH / SPACES;
  const fretY = (n) => top + (n - win.from + 1) * rowH;
  const x0 = stringX(box, 0);
  const x1 = stringX(box, STRINGS - 1);
  const gold = opt.dim ? P.amberLo : P.gold;
  const ink = P.ink;

  const parts = [];

  // The board. A flat dark panel so the strings read on a card of any colour.
  parts.push(`<rect x="${box.x + 1}" y="${box.y}" width="${box.w - 2}" height="${box.h}" rx="1.5" fill="${P.plate}" stroke="${opt.dim ? P.frameLo : P.frame}" stroke-width="0.6"/>`);

  // Frets, then strings over them: a string is continuous and a fret is what
  // it crosses. Drawn the other way round it reads as a ladder.
  for (let f = 1; f <= SPACES; f++) {
    const y = fretY(win.from + f - 1);
    parts.push(`<line x1="${x0 - 1.5}" y1="${y}" x2="${x1 + 1.5}" y2="${y}" stroke="${P.greyLo}" stroke-width="0.8"/>`);
  }
  for (let k = 0; k < STRINGS; k++) {
    const x = stringX(box, k);
    parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${top + boardH}" stroke="${k < 3 ? P.greyHi : P.grey}" stroke-width="${k < 3 ? 0.7 : 0.5}"/>`);
  }

  if (win.nut) {
    parts.push(`<rect x="${x0 - 1.5}" y="${top - 1.4}" width="${x1 - x0 + 3}" height="1.8" fill="${P.white}"/>`);
  } else {
    // The shape is up the neck, and the number says how far.
    parts.push(`<text x="${box.x + 2}" y="${top + rowH * 0.72}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="5.4" font-weight="700" fill="${P.cream}">${win.from}</text>`);
    parts.push(`<line x1="${x0 - 1.5}" y1="${top}" x2="${x1 + 1.5}" y2="${top}" stroke="${P.grey}" stroke-width="0.8"/>`);
  }

  // Over the nut: open and muted.
  for (const s of d.strings) {
    const x = stringX(box, 6 - s.string);
    const y = box.y + HEAD / 2 - 0.6;
    if (s.muted) {
      const r = 1.7;
      parts.push(`<path d="M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}" stroke="${P.redHi}" stroke-width="0.9" stroke-linecap="round"/>`);
    } else if (s.open) {
      parts.push(`<circle cx="${x}" cy="${y}" r="1.8" fill="none" stroke="${P.cyanHi}" stroke-width="0.9"/>`);
    }
  }

  // A barre before the dots, so the dots sit on top of it.
  for (const b of barres(d)) {
    const bx0 = stringX(box, b.first);
    const bx1 = stringX(box, b.last);
    const cy = fretY(b.fret) - rowH / 2;
    parts.push(`<rect x="${Math.min(bx0, bx1) - 2.6}" y="${cy - 2.6}" width="${Math.abs(bx1 - bx0) + 5.2}" height="5.2" rx="2.6" fill="${gold}" stroke="${ink}" stroke-width="0.7"/>`);
  }

  // The fingers, last and brightest.
  for (const s of d.strings) {
    if (s.fret <= 0) continue;
    const x = stringX(box, 6 - s.string);
    const cy = fretY(s.fret) - rowH / 2;
    parts.push(`<circle cx="${x}" cy="${cy}" r="2.7" fill="${gold}" stroke="${ink}" stroke-width="0.7"/>`);
    if (s.finger) {
      parts.push(`<text x="${x}" y="${cy + 1.9}" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="5" font-weight="800" fill="${ink}">${esc(s.finger)}</text>`);
    }
  }

  return parts.join('');
}
