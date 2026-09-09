/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE READOUTS, LAID OUT BEFORE THEY ARE PAINTED.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The top bar and the strip used to be drawn with the widths written out by
 * hand: a plate 66 pixels wide with `SERVED` printed 15 pixels in. That works
 * for `SERVED 9` and breaks for `SERVED 12`, silently, in the second half of
 * every good run — the number simply walks off the end of its plate and sits
 * on the wood, and nothing in the code notices.
 *
 * So nothing here is measured by eye. A panel is a list of ROWS, a row is a
 * list of ITEMS, an item knows its own width, and the panel is as wide as the
 * widest row plus its padding. A longer number makes a wider plate. It is not
 * possible to write a string that does not fit, because the plate is cut to
 * the string.
 *
 * These functions touch no canvas: they take the snapshot and hand back boxes.
 * That is what lets `tests/layout.test.js` check the whole bar without a
 * browser, and what makes "every letter is inside its plate" something the
 * code guarantees rather than something somebody checks.
 */

import { measure, money, clock as fmtClock, wrapPx } from './font.js';
import { P, ORDER_STAR } from './pix.js';
import { label } from '../menu.js';

const PAD = 5;            // from the edge of the plate to the first thing on it
const GAP = 3;            // between two things on the same row
const SPACING = 4;        // between two plates

/* The things that are not letters, and how wide they are. The numbers come
 * from the sprites in `props.js`; a wrong one here shows up as a gap, never as
 * an overlap, because everything after it is pushed along by the layout. */
const ICON = { clock: 7, plate: 9 };
const TICKET_W = 9;
const TICKET_GAP = 2;
const STAR_ADV = 6;
const PIP_ADV = 7;

/** How wide one item is, whatever kind of thing it is. */
export function itemWidth(it) {
  if (it.icon) return ICON[it.icon] || 0;
  if (it.tickets) return it.tickets * (TICKET_W + TICKET_GAP) - TICKET_GAP;
  if (it.stars) return it.stars * STAR_ADV - 1;
  if (it.pips) return it.pips * PIP_ADV - 2;
  return measure(it.s, it.font || 'M', it.scale || 1);
}

/** How tall one item is. */
export function itemHeight(it) {
  if (it.icon === 'clock') return 7;
  if (it.icon === 'plate') return 3;
  if (it.tickets || it.stars) return 5;
  if (it.pips) return 6;
  return (it.font === 'S' ? 5 : 7) * (it.scale || 1);
}

const rowWidth = (row) => row.reduce((w, it) => w + itemWidth(it), 0) + GAP * Math.max(0, row.length - 1);

/* From the edge of the plate to the first row of anything readable.
 *
 * `plate()` paints a two pixel border, so rows 1 and `h-2` of the box are
 * frame and row `h-2` in particular is the one a number kept landing on. Three
 * is that border plus a row of air, and it is the smallest inset that reads as
 * deliberate rather than as a clipping accident. */
const INSET = 3;

/**
 * Places the rows of one panel and gives the panel back with every item
 * carrying an absolute box.
 *
 * The row positions used to be written out per panel — `[3, 11]` for the clock,
 * `[3, 10]` for the takings — and the second of those put a seven pixel number
 * at row 12 of an eighteen pixel plate, which ends on row 19: the plate's own
 * bottom border. The takings sat ON the frame for the whole life of the game
 * and nobody could unsee it once it was pointed out.
 *
 * So the rows are DISTRIBUTED now: measured, stacked with even air between
 * them, and centred as a block inside the plate minus its border. A panel
 * cannot touch its own frame, whatever fonts and however many rows it is given.
 */
function place(rows, x, y, h) {
  const w = Math.max.apply(null, rows.map(rowWidth)) + PAD * 2;
  const heights = rows.map((row) => Math.max.apply(null, row.map(itemHeight)));
  const inner = h - INSET * 2;
  const used = heights.reduce((a, b) => a + b, 0);
  const gaps = Math.max(0, rows.length - 1);
  const air = gaps ? Math.max(1, Math.floor((inner - used) / gaps)) : 0;
  const block = used + air * gaps;
  let ry = y + INSET + Math.max(0, Math.floor((inner - block) / 2));

  const items = [];
  rows.forEach((row, r) => {
    const rh = heights[r];
    let ix = x + PAD;
    for (const it of row) {
      const iw = itemWidth(it);
      const ih = itemHeight(it);
      items.push(Object.assign({}, it, { x: ix, y: ry + Math.floor((rh - ih) / 2), w: iw, h: ih }));
      ix += iw + GAP;
    }
    ry += rh + air;
  });
  return { x, y, w, h, items };
}

/**
 * The top bar: level, clock, service, takings.
 *
 * The first three plates are packed from the left in the order they are read;
 * the takings are pinned to the right, because money belongs in the corner and
 * a number that grows should grow towards the middle instead of pushing the
 * clock off the screen. What is left in between is the beam, and the name of
 * the place is written on it only when there is room — measured, not hoped.
 */
export function barLayout(snap, W, geo, levelMs) {
  /* The plates take the whole band bar a pixel. They used to be inset by two
   * at the top and two at the bottom, which threw away four of the twenty-two
   * rows the bar has and left twelve pixels of type in fourteen of frame-free
   * space — the reason the second row of every panel ended up against the
   * border no matter how it was placed. */
  const y = geo.BAR_Y + 1;
  const h = geo.BAR_H - 2;
  const span = levelMs || 60000;
  const level = snap.drill ? 'PAIR PRACTICE' : 'LV ' + snap.level + ' - ' + String(snap.levelName || 'SERVICE').toUpperCase();

  const specs = [
    [[{ s: level, font: 'M', color: P.amber }]],
    [
      /* The player's clock, not the bench's: it counts from the first chord
       * (`clock`), and the next bell is the engine's own schedule and not a
       * modulo of the mount time. Both fall back to `t` for a snapshot that
       * does not carry them, which is what the tests hand in. */
      [{ icon: 'clock', color: P.white }, { s: fmtClock(snap.clock === undefined ? snap.t : snap.clock), font: 'M', color: P.white }],
      /* A sprint counts DOWN, and that is the row it uses: the bell of the
       * next level matters less than the bell of the end, and it turns red
       * in the last half minute. */
      snap.drill ? [{ s: 'UNTIMED', font: 'S', color: P.greyHi }]
        : snap.timeLeft !== null && snap.timeLeft !== undefined
        ? [{ s: 'LEFT ' + fmtClock(snap.timeLeft), font: 'S', color: snap.timeLeft < 30000 ? P.redHi : P.amber }]
        : [{ s: 'NEXT ' + fmtClock(snap.nextLevelIn === undefined ? span - (snap.t % span) : snap.nextLevelIn), font: 'S', color: P.amber }],
    ],
    [
      [{ icon: 'plate' }, { s: 'SERVED ' + (snap.served || 0), font: 'M', color: P.white }],
      [{ tickets: 3, alive: 3 - (snap.strikes || 0) },
        { s: 'LOST ' + (snap.ruined || 0), font: 'S', color: snap.strikes ? P.redHi : P.grey }],
    ],
  ];

  const panels = [];
  let x = 3;
  for (const rows of specs) {
    const p = place(rows, x, y, h);
    panels.push(p);
    x += p.w + SPACING;
  }

  /* The takings, in the corner where money lives. This plate said THIS LEVEL
   * and went back to $0 at every bell while the strip below carried the
   * TOTAL: two sums of money on one screen, and one of them kept falling. The
   * total is the number a player keeps, so it is the one in the corner, and
   * the strip's right-hand side went to the coach line. */
  const cash = place([
    [{ s: 'TOTAL', font: 'S', color: P.grey }],
    // Gold, like every sum of money on the screen: amber is the frame's colour
    // and the labels', gold is what gets paid.
    [{ s: money(snap.cash || 0), font: 'M', color: P.gold }],
  ], 0, y, h);
  cash.x = W - 3 - cash.w;
  for (const it of cash.items) it.x += cash.x;
  panels.push(cash);

  /* The name on the beam, between the last plate and the takings, and only if
   * it fits between them with a plate's worth of air on either side. */
  const gap = cash.x - x;
  const nameW = measure('FRET FOOD', 'M');
  const beam = gap > nameW + 24
    ? {
      s: 'FRET FOOD', font: 'M', color: P.woodHi, shadow: P.woodInk,
      x: Math.round(x + (gap - nameW) / 2), y: y + 6, w: nameW, h: 7,
    }
    : null;

  return { panels, beam };
}

/**
 * The strip under the room: the chain on the left, the combo in the middle,
 * the takings on the right.
 *
 * The combo is the one number here that grows without a ceiling, so it is
 * measured first and the two labels beside it are placed against what it
 * actually is rather than against what it usually is.
 */
export function stripLayout(snap, W, geo, opts) {
  const y = geo.STRIP_Y;
  const items = [];

  /* Left: the price multiplier, its five pips and the number.
   *
   * It was labelled CHAIN, beside a COMBO that also counts cooked steps, and
   * the two read as one number written twice. They are not: this one is what
   * the next dish PAYS, capped at five and lost by standing still; the combo is
   * how long the player has gone without a mistake. So it is named for what it
   * does to the money. Same width as the old word, so the pips stay put. */
  const chain = snap.chain || 1;
  const pipsW = itemWidth({ pips: 5 });
  items.push({ role: 'chainLabel', s: 'PRICE', font: 'S', color: P.grey, x: 6, y: y + 6, w: measure('PRICE', 'S'), h: 5 });
  items.push({ role: 'pips', pips: 5, lit: chain, x: 30, y: y + 5, w: pipsW, h: 6 });
  items.push({
    role: 'chain', s: 'x' + chain, font: 'M', x: 30 + pipsW + 4, y: y + 5,
    w: measure('x' + chain, 'M'), h: 7,
  });

  // Middle: the combo, twice the size, centred on the screen.
  const combo = 'x' + (snap.combo || 0);
  const cw = measure(combo, 'M', 2);
  const cx = Math.round(W / 2 - cw / 2);
  items.push({ role: 'combo', s: combo, font: 'M', scale: 2, x: cx, y: y + 1, w: cw, h: 14 });
  const caption = 'COMBO';       // not `label`: this file imports one, see style.test.js
  items.push({
    role: 'comboLabel', s: caption, font: 'S', color: P.grey,
    x: cx - GAP - measure(caption, 'S'), y: y + 6, w: measure(caption, 'S'), h: 5,
  });
  const best = 'BEST x' + (snap.comboBest || 0);
  items.push({ role: 'best', s: best, font: 'S', color: P.grey, x: cx + cw + GAP, y: y + 6, w: measure(best, 'S'), h: 5 });

  /* Right: the coach line.
   *
   * This side used to carry the TOTAL, which now lives in the bar's corner,
   * and the middle used to carry a second heat bar for the pot in most
   * trouble, which was the third gauge for one fact the cards already show
   * twice. What was missing was a place for the game to SAY something: the
   * rule while it is new, that the kitchen is waiting for the first chord,
   * that the pots are cooling twice as fast because nobody is playing. One
   * sentence of the small font, right-aligned to the edge, and only when it
   * fits between the combo's BEST and the edge — a combo of four digits leaves
   * a hundred and fifty pixels, and every sentence `coachText` can produce is
   * measured to fit inside that. The drawing may pass its own sentence, since
   * it knows things the snapshot does not (the keyboard, the window). */
  const coach = opts && opts.coach !== undefined ? opts.coach : coachText(snap);
  const coachW = measure(coach, 'S');
  const room = (W - 6) - (cx + cw + GAP + measure(best, 'S') + 8);
  if (coach && coachW <= room) {
    items.push({ role: 'coach', s: coach, font: 'S', color: P.grey, x: W - 6 - coachW, y: y + 6, w: coachW, h: 5 });
  }

  return { items };
}

/**
 * What the strip has to say right now, most urgent first.
 *
 * `o.narrow` is a window too small to read the fingering in, `o.hints` that
 * the keyboard is what is talking and `o.alt` that it is the legend's turn on
 * the rotation. Every sentence here is under thirty-eight characters of the S
 * font, which is what fits beside a four-digit combo; a longer one would be
 * dropped by the layout rather than written over the number.
 */
export function coachText(snap, o) {
  const opt = o || {};
  const s = snap || {};
  if (s.started === false) {
    const want = (s.wants && s.wants[0])
      || ((s.stations || []).map((st) => st && st.wants).find(Boolean));
    return want ? 'PLAY ' + label(want) + ' TO OPEN THE KITCHEN' : 'PLAY A CHORD TO OPEN THE KITCHEN';
  }
  // Not "twice as fast" any more, and not on a pot nobody has fed yet: see
  // `SILENCE_BEATS`. The line says the fact and leaves the arithmetic out.
  if (s.silent) return 'SILENCE - THE POTS GO DOWN FASTER';
  // A customer is lost, and there is a way back: say how far it is.
  if (s.redeemIn !== null && s.redeemIn !== undefined && s.redeemIn > 0) {
    return s.redeemIn + ' CLEAN DISHES WIN A TICKET BACK';
  }
  if (opt.narrow) return 'WIDEN THE WINDOW TO READ THE FINGERING';
  if (opt.hints && opt.alt) return '^ IS SHIFT - 1 TO 6 ARE 7THS AND FLATS';
  return 'ONE CHORD, ONE STEP';
}

/**
 * Where each station's chord diagram goes, in the game's own units.
 *
 * The diagram is the one panel that is drawn as vector on a layer over the
 * canvas (`chordsvg.js`), so its geometry lives here with the rest of the
 * layout instead of inside the drawing: that way "the diagram is inside its
 * card" is something a test can check without a browser, and the layer and the
 * pixels cannot drift apart.
 *
 * `null` for a station with nobody at it. The box is the right-hand column of
 * the card; the left-hand column keeps the chord name, the seconds and the
 * heat bar, which are pixels and are fine as pixels.
 */
export function chordBoxes(snap, geo) {
  // The top row previews NEXT in every window; the recipe has its own rail.
  const out = [];
  for (let i = 0; i < geo.SLOTS; i++) {
    const st = (snap.stations || [])[i];
    if (!st || !st.dish || !st.wants || st.diagramVisible === false) { out.push(null); continue; }
    const x = i * geo.SLOT_W + 2;
    out.push({ i, chord: st.wants, x: x + 40, y: geo.CARD_Y + 12, w: 38, h: 36 });
  }
  return out;
}

/**
 * The speech bubble over a customer, and how tall it has to be.
 *
 * The height is DERIVED, like the width of a plate: a name, then one line of
 * dish or two, then a row of air, and the box is cut to fit. It used to be a
 * fixed 25 with the second line printed at 18 — seven pixels tall, ending on
 * row 25, which is the bubble's own last row. Every two-line dish on the menu
 * had its descenders sitting on the outline.
 */
const BUBBLE_AIR = 3;

/**
 * The dish's name cut into the lines a bubble can hold, and the font to print
 * them in.
 *
 * Use the same small hand for every order. Wrapping is measured in pixels,
 * with at most two lines so long invented names cannot cover a guest's face.
 */
export function bubbleLines(dish, geo) {
  const maxW = geo.SLOT_W - 4 - 2 * BUBBLE_AIR;
  const s = String(dish || '').toUpperCase();
  // Orders are supporting information; keep a consistent, compact hand.
  return { lines: wrapPx(s, maxW, 'S', 2).lines, font: 'S' };
}

export function bubbleLayout(st, slot, geo, lines, font) {
  const NAME_H = 5;
  const HEADER_H = ORDER_STAR.size;
  const f = font || 'M';
  const LINE_H = f === 'S' ? 7 : 8;
  const TEXT_H = f === 'S' ? 5 : 7;
  const AIR = BUBBLE_AIR;
  const cx = slot * geo.SLOT_W + geo.SLOT_W / 2;
  const starsW = 4 * ORDER_STAR.advance + ORDER_STAR.size;
  const tw = Math.max(
    measure(String(st.name || '').toUpperCase(), 'S') + starsW + GAP,
    ...lines.map((l) => measure(l, f)),
  );
  const w = Math.min(geo.SLOT_W - 4, tw + AIR * 2);
  const h = AIR + HEADER_H + 2 + lines.length * LINE_H + AIR - 2;
  let x = Math.round(cx - w / 2);
  x = Math.max(slot * geo.SLOT_W + 2, Math.min(slot * geo.SLOT_W + geo.SLOT_W - 2 - w, x));
  const y = geo.BUBBLE_Y;
  return {
    x, y, w, h, cx, font: f,
    // Uppercased here and not left to the font: the small font has lowercase
    // letters now, for chord names, and `Maria` is not `MaRIa`.
    name: { s: String(st.name || '').toUpperCase(), x: x + AIR, y: y + AIR + 1, w: measure(String(st.name || '').toUpperCase(), 'S'), h: NAME_H },
    stars: { n: st.stars, x: x + w - AIR - starsW, y: y + AIR, w: starsW, h: HEADER_H },
    lines: lines.map((l, k) => ({
      s: l, x: x + AIR, y: y + AIR + HEADER_H + 2 + k * LINE_H, w: measure(l, f), h: TEXT_H,
    })),
  };
}
