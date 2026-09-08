/*
 * Every chord in the game, on one sheet, drawn by the game's own code.
 *
 *     node tools/chordsheet.mjs            > docs/chords.svg
 *     node tools/chordsheet.mjs --scale 3  bigger cells
 *
 * The diagrams are the one panel of this game that is not pixels, so a
 * screenshot of the running game is a bad way to review them: it depends on a
 * browser window being painted, and it shows one chord at a time. This asks
 * `chordsvg.js` for all of them at the size they are drawn at in a card, lays
 * them out by the level they are unlocked at, and writes an SVG.
 *
 * It is the proof sheet for the second axis of difficulty: read down it and
 * the shapes climb the neck.
 */

import { CHORDS, diagram, chordLevel, label } from '../src/menu.js';
import { chordSvg } from '../src/art/chordsvg.js';
import { P } from '../src/art/pix.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SCALE = Number(opt('scale', 4));

/* The same box a card gives it, so what is on this sheet is what is on the
 * screen and not a prettier version of it. */
const CELL = { w: 40, h: 46 };
const GAP = 10;
const LABEL = 12;
const COLS = 7;

const byLevel = new Map();
for (const c of CHORDS) {
  const lv = chordLevel(c);
  if (!byLevel.has(lv)) byLevel.set(lv, []);
  byLevel.get(lv).push(c);
}
const levels = [...byLevel.keys()].sort((a, b) => a - b);

const rowH = CELL.h + LABEL + GAP;
const W = COLS * (CELL.w + GAP) + GAP;
let H = GAP;
for (const lv of levels) H += LABEL + Math.ceil(byLevel.get(lv).length / COLS) * rowH;

const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}">`);
out.push(`<rect width="${W}" height="${H}" fill="${P.ink}"/>`);
const font = 'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif"';

let y = GAP;
for (const lv of levels) {
  out.push(`<text x="${GAP}" y="${y + 6}" ${font} font-size="7" font-weight="700" fill="${P.amber}">LEVEL ${lv}</text>`);
  y += LABEL;
  byLevel.get(lv).forEach((name, k) => {
    const col = k % COLS;
    const row = Math.floor(k / COLS);
    const box = { x: GAP + col * (CELL.w + GAP), y: y + row * rowH + LABEL, w: CELL.w, h: CELL.h };
    const d = diagram(name);
    out.push(`<text x="${box.x + CELL.w / 2}" y="${box.y - 3}" text-anchor="middle" ${font} font-size="8" font-weight="700" fill="${P.white}">${label(name).replace(/&/g, '&amp;')}</text>`);
    // The frets, the way a chord book writes them: it is what tells the two Fs apart.
    out.push(`<text x="${box.x + CELL.w / 2}" y="${box.y + CELL.h + 6}" text-anchor="middle" ${font} font-size="5" fill="${P.grey}">${d.text}</text>`);
    out.push(chordSvg(d, box));
    out.push(`<text x="${box.x + CELL.w / 2}" y="${box.y + CELL.h + 7}" text-anchor="middle" ${font} font-size="5.5" fill="${P.grey}">${d.text}</text>`);
  });
  y += Math.ceil(byLevel.get(lv).length / COLS) * rowH;
}
out.push('</svg>');

process.stdout.write(out.join('\n') + '\n');
