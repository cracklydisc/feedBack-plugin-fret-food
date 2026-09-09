/*
 * WHERE EVERY LETTER LANDS.
 *
 * A number that runs two pixels past the edge of its plate is still a number:
 * every other test in this folder passes and the screen is wrong. So the scene
 * is drawn onto a canvas that records instead of painting (`paper.js`), the
 * letters are glued back into strings, and the strings are held to three rules
 * a player would state in the same words:
 *
 *   nothing off the screen, nothing outside the box it belongs to, and no two
 *   things written on top of each other.
 *
 * The snapshots are not the pretty ones. They are the widest a real service
 * can produce: the longest level name, three digits of served, six figures of
 * takings, the eight step dish at every station, the longest dish name, the
 * longest customer name, and a station one second from being lost.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paper, distinct, hits } from './paper.js';
import { GEO, slotX } from '../src/art/geo.js';
import { P } from '../src/art/pix.js';
import { barLayout, stripLayout, chordBoxes, bubbleLayout, bubbleLines, coachText } from '../src/art/hud.js';
import { inventMenu, FAMILIES } from '../src/invent.js';
import { wrap, measure } from '../src/art/font.js';
import { chordSvg, barres, window_ } from '../src/art/chordsvg.js';
import { diagram, CHORDS, label } from '../src/menu.js';
import { recipeLayout, previewName } from '../src/art/recipe.js';
import { keyFor } from '../src/input/keys.js';
import { MENU, NAMES, COOKWARE } from '../src/menu.js';
import { FONTS } from '../src/art/font.js';
import { newGame } from './harness.js';
import { STEP_MS } from '../src/clock.js';

/* Where a run is allowed to be drawn outside a panel: text that floats over
 * the scene by design. The floats and the banner are drawn with an outline for
 * exactly that reason, and they are the only things that pass over a card. */
const FX_BAND = null;

const longest = (a) => a.slice().sort((x, y) => y.length - x.length)[0];

/** A station whose every string is the longest one the menu can produce. */
function worstStation(i, over) {
  const dish = MENU.slice().sort((a, b) => b.steps.length - a.steps.length)[0];
  return Object.assign({
    i,
    dish: longest(MENU.map((m) => m.dish)),
    id: dish.id,
    name: longest(NAMES),
    face: 3,
    stars: 5,
    steps: dish.steps,
    rn: dish.rn,
    price: 99,
    step: 1,
    pan: COOKWARE[0],
    ingredients: dish.steps.map(() => 'tomato'),
    inPan: ['tomato'],
    nextIn: 'tomato',
    wants: 'Am',
    heat: 64, heatPct: 64, readyPct: 65, ready: false,
    cycle: 1, soot: 0, burner: 4.5, life: 9.4,
  }, over || {});
}

function worstSnapshot(over) {
  const s = {
    t: 359000, cash: 999999, chain: 5, served: 999, ruined: 99, strikes: 2,
    level: 6, levelName: 'Saturday Night', levelCash: 999999,
    combo: 999, comboBest: 999, cycles: 400, rings: 800, hits: 800, misses: 90,
    over: false, silent: false,
    wants: ['Am'],
    queue: Array.from({ length: 6 }, (_, k) => ({ name: longest(NAMES), face: k })),
    stations: Array.from({ length: GEO.SLOTS }, (_, i) => worstStation(i)),
  };
  return Object.assign(s, over || {});
}

/**
 * Draws one frame of `snap` and hands back the strings that were printed.
 *
 * `opts.events` are engine events fired before the frame, and `opts.after` is
 * how long after them the frame happens: that is how the moving states — a
 * card sliding out of the rail, a card knocked by a spoiled pan, a float over
 * the counter — are held to the same rules as the still ones.
 */
async function drawn(snap, opts) {
  const o = opts || {};
  const page = paper(o);
  const { createScene } = await import('../src/scene.js?' + Math.random());
  const scene = createScene(page.container);
  if (o.hints) scene.setHints(true);
  if (o.diag) scene.setDiag(o.diag);
  scene.update(snap);
  const t0 = o.at === undefined ? performance.now() : o.at - 40;
  page.frame(t0);                       // the first frame builds every sprite
  for (const [name, e] of o.events || []) scene.event(name, e);
  const shot = page.capture(() => page.frame(o.at === undefined ? t0 + (o.after === undefined ? 40 : o.after) : o.at));
  scene.destroy();
  return { runs: distinct(shot.runs), ops: shot.ops };
}

/* Text that is MEANT to be over the scene rather than on a plate: the money
 * that floats up off a served dish, the level banner, the closing card. It is
 * printed with an outline for exactly that reason, which is nine copies of the
 * same string, and that is how it is told apart here. */
const onScene = (r) => (r.copies || 1) >= 3;
const onPlate = (list) => list.filter((r) => !onScene(r));

/* ── the three rules ──────────────────────────────────────────────────── */

function inScreen(runs) {
  const bad = runs.filter((r) => r.x < 0 || r.y < 0 || r.x + r.w > GEO.W || r.y + r.h > GEO.H);
  assert.deepEqual(bad.map((r) => [r.x, r.y, r.w, r.h]), [], 'letters off the 480x270 screen');
}

/** Inside the card it belongs to, border included: a card is 80 wide and its
 *  plate takes two pixels of that on each side. */
function inCards(runs) {
  const { CARD_Y, CARD_H, CARD_W } = GEO;
  const bad = [];
  for (const r of runs) {
    if (r.y + r.h <= CARD_Y || r.y >= CARD_Y + CARD_H) continue;
    if (r.x >= GEO.RIGHT_X) continue;                     // the player's column
    const i = Math.floor((r.x + r.w / 2) / GEO.SLOT_W);
    const left = slotX(i) + 2 + 2;
    const right = slotX(i) + 2 + CARD_W - 2;
    if (r.x < left || r.x + r.w > right) bad.push({ x: r.x, y: r.y, w: r.w, slot: i, left, right });
  }
  assert.deepEqual(bad, [], 'letters outside the card they belong to');
}

/** Inside its own place at the counter: a bubble may not lean into the next. */
function inSlots(runs) {
  const bad = [];
  for (const r of runs) {
    if (r.y + r.h <= GEO.BUBBLE_Y || r.y >= GEO.BUBBLE_Y + GEO.BUBBLE_H) continue;
    const i = Math.floor((r.x + r.w / 2) / GEO.SLOT_W);
    if (r.x < slotX(i) + 2 || r.x + r.w > slotX(i) + GEO.SLOT_W - 2) {
      bad.push({ x: r.x, y: r.y, w: r.w, slot: i });
    }
  }
  assert.deepEqual(bad, [], 'a speech bubble leaning into the next place');
}

function noPileUp(runs) {
  const bad = [];
  for (let a = 0; a < runs.length; a++) {
    for (let b = a + 1; b < runs.length; b++) {
      if (hits(runs[a], runs[b])) bad.push([[runs[a].x, runs[a].y, runs[a].w], [runs[b].x, runs[b].y, runs[b].w]]);
    }
  }
  assert.deepEqual(bad, [], 'two strings written on top of each other');
}

/* ── the tests ────────────────────────────────────────────────────────── */

test('the worst service that can happen still fits on the screen', async () => {
  const { runs } = await drawn(worstSnapshot());
  assert.ok(runs.length > 20, 'the frame printed almost nothing: ' + runs.length);
  inScreen(runs);
  inCards(runs);
  inSlots(runs);
  noPileUp(runs);
});

test('a real service, from the engine, fits at every stage of it', async () => {
  const g = newGame({ seed: 21 });
  for (let k = 0; k < 6; k++) {
    for (let t = 0; t < 4000; t += STEP_MS) g.tick(STEP_MS);
    const snap = g.snapshot();
    const { runs } = await drawn(snap);
    inScreen(runs);
    inCards(runs);
    inSlots(runs);
    noPileUp(runs);
  }
});

test('a closed station and a free one are labelled inside their card', async () => {
  const snap = worstSnapshot({
    stations: [worstStation(0), null, worstStation(2, { dish: null, name: null }), null, null],
  });
  const { runs } = await drawn(snap);
  inScreen(runs);
  inCards(runs);
  noPileUp(runs);
});

test('the smallest box the game can be given still gets a whole kitchen', async () => {
  const { runs } = await drawn(worstSnapshot(), { w: 320, h: 180 });
  inScreen(runs);
  inCards(runs);
  noPileUp(runs);
});

test('with motion turned off nothing moves and everything is still readable', async () => {
  const { runs } = await drawn(worstSnapshot(), { still: true });
  inScreen(runs);
  inCards(runs);
  inSlots(runs);
  noPileUp(runs);
});


/* ── the readouts, without a canvas at all ────────────────────────────────
 *
 * The bar and the strip are laid out by pure functions now, so the strongest
 * test of them needs no drawing: it asks for the boxes and checks them. This
 * is the one that would have caught the defect that started this pass —
 * `SERVED 128` printed eight pixels past the end of a plate whose width was
 * the number 66, written by hand, sized for `SERVED 9`.
 */

const RANGE = [0, 1, 9, 10, 99, 100, 999, 1234];

test('every plate in the bar is cut to what is written on it', () => {
  for (const n of RANGE) {
    for (const lvl of [1, 6]) {
      const snap = {
        t: n * 1000, level: lvl, levelName: lvl === 6 ? 'Saturday Night' : 'Opening',
        served: n, ruined: n, strikes: lvl === 6 ? 3 : 0, levelCash: n * 137,
      };
      const { panels, beam } = barLayout(snap, GEO.W, GEO, 60000);
      for (const p of panels) {
        assert.ok(p.x >= 0 && p.x + p.w <= GEO.W, 'a plate off the screen: ' + JSON.stringify([p.x, p.w]));
        for (const it of p.items) {
          const what = JSON.stringify(it.s || it.icon || 'tickets');
          assert.ok(it.x >= p.x + 2 && it.x + it.w <= p.x + p.w - 2,
            what + ' at ' + it.x + '+' + it.w + ' is outside its plate ' + p.x + '+' + p.w);
          /* Three, not one. `plate()` paints a two pixel border, so at one the
           * takings landed ON the frame — which is what "too close to the
           * edge" looks like from the outside, and the reason the rows are
           * distributed now instead of written out per panel. */
          assert.ok(it.y >= p.y + 3, what + ' at ' + it.y + ' is on the top frame of its plate ' + p.y);
          assert.ok(it.y + it.h <= p.y + p.h - 3,
            what + ' ends at ' + (it.y + it.h) + ' and its plate ends at ' + (p.y + p.h) + ': on the frame');
        }
      }
      for (let a = 0; a < panels.length; a++) {
        for (let b = a + 1; b < panels.length; b++) {
          assert.ok(!hits(panels[a], panels[b]), 'two plates on top of each other in the bar');
        }
      }
      if (beam) {
        const last = panels[panels.length - 2];
        const cash = panels[panels.length - 1];
        assert.ok(beam.x > last.x + last.w && beam.x + beam.w < cash.x, 'the name on the beam touches a plate');
      }
    }
  }
});

test('the strip never writes two numbers on top of each other', () => {
  for (const combo of RANGE) {
    for (const cash of RANGE) {
      const snap = { chain: 5, combo, comboBest: combo, cash: cash * 991 };
      const items = stripLayout(snap, GEO.W, GEO).items;
      for (const it of items) {
        assert.ok(it.x >= 0 && it.x + it.w <= GEO.W, it.role + ' is off the screen');
      }
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          assert.ok(!hits(items[a], items[b]), items[a].role + ' and ' + items[b].role + ' overlap');
        }
      }
    }
  }
});

test('every sentence the coach can say fits beside a four-digit combo', () => {
  /* The coach line took the strip's right-hand side from the total. It is
   * dropped by the layout when it does not fit, which is the safe failure —
   * but a sentence that is always dropped is a sentence never said, so every
   * one `coachText` can produce has to fit beside the widest combo the strip
   * is tested at, and land on nothing. */
  const snaps = [
    { started: false, wants: ['C#m'] },
    { started: true, silent: true },
    { started: true, strikes: 1, redeemIn: 8 },
    { started: true },
  ];
  const opts = [{}, { narrow: true }, { hints: true, alt: true }];
  for (const s of snaps) {
    for (const o of opts) {
      const snap = Object.assign({ chain: 5, combo: 1234, comboBest: 1234 }, s);
      const say = coachText(snap, o);
      const items = stripLayout(snap, GEO.W, GEO, { coach: say }).items;
      const it = items.find((i) => i.role === 'coach');
      assert.ok(it, 'the strip dropped "' + say + '" for want of room');
      assert.equal(it.s, say);
      for (const other of items) if (other !== it) assert.ok(!hits(it, other), '"' + say + '" lands on ' + other.role);
    }
  }
});

test('the combo stays in the middle of the screen whatever it reads', () => {
  // It is the one number on the strip with nothing to lean against, so it is
  // centred and the labels move, not the other way round.
  for (const combo of RANGE) {
    const items = stripLayout({ combo, comboBest: combo }, GEO.W, GEO).items;
    const c = items.find((i) => i.role === 'combo');
    assert.ok(Math.abs((c.x + c.w / 2) - GEO.W / 2) <= 1, 'the combo drifted off centre at x' + combo);
  }
});


/* ── the same rules, while things are moving ──────────────────────────────
 *
 * A card that slides out of the rail and a card that is knocked sideways are
 * the two states where a letter can leave its place, and they are exactly the
 * two states a screenshot of a still frame cannot show. The moving frames are
 * sampled through the whole length of each animation, not at the end of it.
 */

test('a card sliding out of the rail stays inside its place all the way', async () => {
  const snap = worstSnapshot();
  for (const after of [20, 60, 120, 200, 300, 340, 500]) {
    const { runs } = await drawn(snap, { events: [['seat', { station: 2 }]], after });
    inScreen(runs);
    inCards(onPlate(runs));
    noPileUp(onPlate(runs));
  }
});

test('a card knocked about by a spoiled pan never writes into the next one', async () => {
  const snap = worstSnapshot();
  for (const after of [20, 60, 140, 260, 420, 600]) {
    const { runs } = await drawn(snap, {
      events: [['strum', { chord: 'Am', stations: [1, 2], dirty: true, together: 2, gain: 4 }]],
      after,
    });
    inScreen(runs);
    inCards(onPlate(runs));
  }
});

test('the money, the banner and the closing card stay on the screen', async () => {
  const snap = worstSnapshot();
  const events = [
    ['serve', { station: 1, money: 1234, tip: true, who: { face: 2, name: 'Giulia' }, dish: { pan: 'skillet', ingredients: ['tomato'] } }],
    ['ruin', { station: 3, who: { face: 4, name: 'Giulia' } }],
    ['level', { level: 6, name: 'Saturday Night', stations: 5 }],
  ];
  for (const after of [40, 300, 900, 1600, 2300]) {
    const { runs } = await drawn(snap, { events, after });
    inScreen(runs);
  }
  // The closing card is a lid over the kitchen, so it is allowed to cover the
  // strip: what it may not do is print outside the screen.
  const closed = await drawn(snap, { events: [['over', {}]], after: 900 });
  inScreen(closed.runs);
});


test('with nothing happening, nothing on the screen moves', async () => {
  /* Every flourish in the scene is timed from an instant it stores, and the
   * instant it stores means "never" until an event sets it. `performance.now()`
   * starts at zero, so writing that "never" as zero makes every card judder
   * for the first half second of a game that was mounted quickly — which is
   * exactly what happened, and what this test now refuses.
   *
   * The check is that a frame drawn early and a frame drawn much later put
   * every string in the same place, given a counter where nothing is blinking. */
  const calm = worstSnapshot({
    stations: Array.from({ length: GEO.SLOTS }, (_, i) => worstStation(i, { life: 9.4, ready: false })),
    restArmed: false, restIn: 0, runOn: 0,
  });
  const early = await drawn(calm, { at: 60 });
  const later = await drawn(calm, { at: 60000 });
  const box = (list) => list.map((r) => [r.x, r.y, r.w, r.h]).sort();
  assert.deepEqual(box(early.runs), box(later.runs), 'a string moved with nothing to move it');
});


test('when an order arrives its card comes out of the rail', async () => {
  // The counterpart of the test above: the flourishes have to be there as well
  // as be contained. Five cards changing between one frame and the next is the
  // easiest thing on this screen to miss, which is why the card moves at all.
  const snap = worstSnapshot();
  const a = await drawn(snap, { events: [['seat', { station: 2 }]], after: 40 });
  const b = await drawn(snap, { events: [['seat', { station: 2 }]], after: 600 });
  const col = (list) => list.filter((r) => Math.floor((r.x + r.w / 2) / GEO.SLOT_W) === 2
    && r.y >= GEO.CARD_Y && r.y < GEO.CARD_Y + GEO.CARD_H).length;
  assert.ok(col(a.runs) < col(b.runs), 'the card was already fully out on the first frame');
});

test('a minor chord is written as a minor chord everywhere it is written', () => {
  /* The recipe on a card is printed in the small font, and the small font was
   * uppercase only: `Am` came out `AM`, which is the name of a different
   * chord. In a game about chords that is not a typography question. */
  const minor = [...new Set(MENU.flatMap((m) => m.steps))].filter((c) => /m$/.test(c));
  assert.ok(minor.length >= 3, 'the menu should have minor chords to get wrong');
  for (const c of minor) assert.ok(FONTS.S.glyphs[c[1]], 'the small font cannot write ' + c);

  /* And it has to LOOK lowercase, which is a stricter thing than being a
   * different bitmap. The first attempt was the capital dropped by one row:
   * two glyphs that differ, and on the screen a difference nobody can see. It
   * has to sit at the x-height, so its top two rows are empty and the capital
   * beside it is twice as tall as its own ink. */
  const m = FONTS.S.glyphs.m;
  const blank = (r) => !r.includes('#');
  assert.ok(blank(m[0]) && blank(m[1]), 'the lowercase m has to sit below the capitals, not one row down');
  assert.ok(!blank(FONTS.S.glyphs.M[0]), 'the capital M is the thing it has to be shorter than');
});


/* ── the one panel that is not pixels ────────────────────────────────────
 *
 * The chord diagram is drawn as SVG on a layer over the canvas, so the canvas
 * recorder cannot see it. Its geometry is a pure function for exactly that
 * reason: "the diagram is inside its card" stays checkable, and the layer and
 * the pixels cannot drift apart.
 */

test('every chord diagram sits inside its own card', () => {
  const snap = worstSnapshot();
  const boxes = chordBoxes(snap, GEO).filter(Boolean);
  assert.equal(boxes.length, GEO.SLOTS, 'a busy counter should have a diagram at every place');
  for (const b of boxes) {
    const left = slotX(b.i) + 2;
    const right = left + GEO.CARD_W;
    assert.ok(b.x >= left + 2 && b.x + b.w <= right - 2,
      'diagram ' + b.i + ' at ' + b.x + '+' + b.w + ' is outside its card ' + left + '..' + right);
    assert.ok(b.y >= GEO.CARD_Y && b.y + b.h <= GEO.CARD_Y + GEO.CARD_H, 'diagram ' + b.i + ' is above or below its card');
  }
  for (let a = 0; a < boxes.length; a++) {
    for (let c = a + 1; c < boxes.length; c++) assert.ok(!hits(boxes[a], boxes[c]), 'two diagrams overlap');
  }
});

test('a closed or empty place has no diagram', () => {
  const snap = worstSnapshot({
    stations: [worstStation(0), null, worstStation(2, { dish: null, wants: null }), null, null],
  });
  const boxes = chordBoxes(snap, GEO);
  assert.equal(boxes.filter(Boolean).length, 1, 'only the one station with an order gets a diagram');
});

test('every chord in the game draws a diagram, and it stays in its box', () => {
  /* The markup is checked rather than eyeballed: every co-ordinate it emits
   * has to be a number (a NaN silently draws nothing at all) and has to be
   * inside the box it was given. A shape whose dots land outside its board is
   * the defect this catches, and it is the one a new chord high up the neck is
   * most likely to have. */
  const box = { x: 40, y: 173, w: 40, h: 46 };
  for (const name of CHORDS) {
    const d = diagram(name);
    assert.ok(d, 'no diagram for ' + name);
    const svg = chordSvg(d, box);
    assert.ok(svg.length > 100, name + ' drew almost nothing');
    assert.ok(!/NaN|undefined/.test(svg), name + ' emitted a NaN or an undefined');
    // The space matters: `rx="1.5"` is a corner radius, not an x.
    for (const m of svg.matchAll(/\s(?:cx|x1|x2|x)="(-?[\d.]+)"/g)) {
      const v = Number(m[1]);
      assert.ok(v >= box.x - 4 && v <= box.x + box.w + 4, name + ' put an x at ' + v + ', outside its box');
    }
    for (const m of svg.matchAll(/\s(?:cy|y1|y2|y)="(-?[\d.]+)"/g)) {
      const v = Number(m[1]);
      assert.ok(v >= box.y - 4 && v <= box.y + box.h + 4, name + ' put a y at ' + v + ', outside its box');
    }
  }
});

test('a shape up the neck shows the fret it starts at, and one at the nut shows the nut', () => {
  for (const name of CHORDS) {
    const d = diagram(name);
    const win = window_(d);
    if (d.lowestFret > 0 && d.highestFret <= 4) {
      assert.equal(win.from, 1, name + ' fits at the nut and should be drawn there');
      assert.equal(win.nut, true, name + ' should show the nut');
    }
    if (d.highestFret > 4) {
      assert.ok(win.from > 1, name + ' reaches fret ' + d.highestFret + ' and must slide the window up');
      assert.equal(win.nut, false, name + ' is up the neck and must not draw a nut');
      assert.ok(d.highestFret - win.from < 4, name + ' does not fit in the four frets shown');
    }
  }
});

test('one finger over several strings is drawn as one barre', () => {
  /* A barre is a different physical act from four separate dots and has to
   * look like one. The bar has to reach the OUTERMOST strings that finger
   * holds — for F#m that is all six — and every string it crosses on the way
   * must be one it holds or one pressed at a higher fret, which is another
   * finger standing on top of the bar. */
  const seen = [];
  for (const name of CHORDS) {
    const d = diagram(name);
    for (const b of barres(d)) {
      seen.push(name);
      assert.ok(b.n >= 2, name + ': a barre of one string is a dot');
      const cols = d.strings
        .filter((s) => s.finger === b.finger && s.fret === b.fret)
        .map((s) => 6 - s.string);
      assert.equal(b.first, Math.min(...cols), name + ': the bar does not start where the finger does');
      assert.equal(b.last, Math.max(...cols), name + ': the bar does not end where the finger does');
      for (let c = b.first; c <= b.last; c++) {
        if (cols.includes(c)) continue;
        assert.ok(d.strings[c].fret > b.fret,
          name + ': the bar crosses string ' + (6 - c) + ', which is not held and not pressed above it');
      }
    }
  }
  assert.ok(seen.includes('F#m') && seen.includes('Bb'), 'the barre shapes should be recognised as barres: ' + seen.join(','));
});


/* ── margins: nothing is allowed to touch the edge it lives inside ───────── */

test('the chord diagram starts below the recipe chips', () => {
  /* The board is opaque and it started two pixels INSIDE the chip row, so it
   * cut the bottoms off the chord names of the recipe and covered the second
   * and third chips outright. The chips occupy CARD_Y+3 to CARD_Y+11. */
  const CHIPS_END = GEO.CARD_Y + 11;
  for (const b of chordBoxes(worstSnapshot(), GEO).filter(Boolean)) {
    assert.ok(b.y > CHIPS_END, 'diagram ' + b.i + ' starts at ' + b.y + ', over the chips that end at ' + CHIPS_END);
    assert.ok(b.y + b.h <= GEO.CARD_Y + GEO.CARD_H - 3, "diagram " + b.i + " runs into the bottom frame of its card");
  }
});

test('the chord diagram covers no letter on its card', async () => {
  /* The strongest form of the rule, and the one that actually failed: the
   * board is drawn over the pixels, so any glyph it overlaps is a glyph the
   * player cannot read. The canvas recorder knows where every letter landed,
   * so this compares the two directly instead of trusting two sets of
   * coordinates to agree. */
  const snap = worstSnapshot();
  const { runs } = await drawn(snap);
  const boxes = chordBoxes(snap, GEO).filter(Boolean);
  const bad = [];
  for (const b of boxes) {
    for (const r of runs) {
      if (hits({ x: b.x, y: b.y, w: b.w, h: b.h }, r)) {
        bad.push('diagram ' + b.i + ' covers a string at ' + r.x + ',' + r.y);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('a speech bubble is cut to what is in it, with air under the last line', async () => {
  /* The height was a fixed 25 with the second line printed at 18 — seven
   * pixels tall, ending on row 25, the bubble's own last row. Every two-line
   * dish on the menu had its descenders on the outline. */
  const AIR = 2;
  for (const dish of MENU.map((m) => m.dish)) {
    const lines = wrap(dish.toUpperCase(), 12, 2);
    const b = bubbleLayout({ name: longest(NAMES), stars: 5 }, 2, GEO, lines);
    assert.equal(b.lines.length, lines.length, dish + ': a line went missing');
    for (const l of b.lines) {
      assert.ok(l.y >= b.y + AIR, dish + ": a line starts on the top edge of the bubble");
      assert.ok(l.y + l.h <= b.y + b.h - AIR,
        dish + ": the line ending at " + (l.y + l.h) + " has no air before the bubble ends at " + (b.y + b.h));
      assert.ok(l.x >= b.x + AIR && l.x + l.w <= b.x + b.w - AIR, dish + ': a line touches a side');
    }
    assert.ok(b.name.y >= b.y + AIR, dish + ": the name is on the top edge");
    assert.ok(!hits(b.name, b.stars), dish + ': the name and the stars overlap');
    assert.ok(b.h <= GEO.BUBBLE_H, dish + ': the bubble is taller than the band GEO reserves for it');
    assert.ok(b.x >= 2 * GEO.SLOT_W + 2 && b.x + b.w <= 3 * GEO.SLOT_W - 2, dish + ': the bubble leans out of its place');
  }
});

test('a one-line dish gets a shorter bubble than a two-line one', () => {
  // Derived, not fixed: that is the property that makes the margin impossible
  // to lose again.
  const one = bubbleLayout({ name: 'Ada', stars: 5 }, 0, GEO, ['GELATO']);
  const two = bubbleLayout({ name: 'Ada', stars: 5 }, 0, GEO, ['THREE-CHORD', 'MARGHERITA']);
  assert.ok(two.h > one.h, 'the two-line bubble should be taller: ' + one.h + ' vs ' + two.h);
});

test('no noun the inventor can reach makes a name too long to draw', () => {
  /* The test below draws the names of four seeds' menus, which finds a bad
   * noun only when a seed's draw runs far enough down the pool to reach it.
   * "Stracciatella" and "Tagliatelle" both sat there unreached until the menu
   * grew and the noun pool started being exhausted, and then they walked out
   * of the bubble in front of a player. Every noun, against the longest thing
   * that can be put in front of it and the longest thing after. */
  for (const family of FAMILIES) {
    for (const noun of family.nouns) {
      const dish = 'Up-the-Neck ' + noun + ' in Minor';
      const { lines, font } = bubbleLines(dish, GEO);
      assert.ok(lines.length <= 2, dish + ' needs ' + lines.length + ' lines');
      const b = bubbleLayout({ name: longest(NAMES), stars: 5 }, 2, GEO, lines, font);
      for (const l of b.lines) {
        assert.ok(l.x >= b.x && l.x + l.w <= b.x + b.w,
          '"' + noun + '" cannot be drawn: "' + l.s + '" runs out of the bubble');
      }
    }
  }
});

test('a long invented name stays inside its bubble', () => {
  /* "Shadow Sorbetto in Minor" cut by characters came out as SHADOW over
   * SORBETTO IN MINOR, and the second line walked out of the bubble across the
   * next customer. Cut by measured width, and in the small font when the big
   * one will not go in two lines, every line has to end inside the bubble and
   * the bubble inside its slot and its band — for every name the menu can
   * invent, on several seeds, and not only for the ones written by hand. */
  const names = ['Shadow Sorbetto in Minor', 'Nightfall Minestrone', 'Half-Step Frittata',
    'Twelve-Bar Beans in Minor', longest(MENU.map((m) => m.dish))];
  for (const seed of [1, 7, 11, 4101469671]) for (const m of inventMenu(MENU, seed, 6)) names.push(m.dish);
  for (const dish of names) {
    const { lines, font } = bubbleLines(dish, GEO);
    assert.ok(lines.length <= 2, dish + ' needs ' + lines.length + ' lines');
    const b = bubbleLayout({ name: longest(NAMES), stars: 5 }, 2, GEO, lines, font);
    for (const l of b.lines) {
      assert.ok(l.x >= b.x && l.x + l.w <= b.x + b.w,
        dish + ': "' + l.s + '" runs out of its bubble in the ' + font + ' font');
    }
    assert.ok(b.x >= slotX(2) && b.x + b.w <= slotX(2) + GEO.SLOT_W, dish + ': the bubble leaves its slot');
    assert.ok(b.y + b.h <= GEO.BUBBLE_Y + GEO.BUBBLE_H, dish + ': the bubble is taller than its band (' + b.h + ')');
  }
});


test('the keyboard hint fits on the card beside the chord', async () => {
  /* The guitar path is blocked by the host, so today the game is played from
   * the keyboard, and the key that plays a chord is printed on its card. It is
   * new text in a card that was already full, which is exactly the kind of
   * addition that lands on top of something else. */
  const { runs } = await drawn(worstSnapshot(), { hints: true });
  inScreen(runs);
  inCards(onPlate(runs));
  noPileUp(onPlate(runs));
});

test('every chord has a key, and the key is short enough to print', () => {
  for (const c of CHORDS) {
    const k = keyFor(c);
    assert.ok(k, c + ' has no key, so the keyboard cannot play it');
    assert.ok(k.length <= 2, c + ' needs the key ' + k + ', which is too wide for the card');
  }
});


test('the rule is spelled out on the strip until something has cooked', async () => {
  /* The legend is longer than the label it replaces, and it lives in the beat
   * meter's box between the chain and the combo. If it does not fit there it
   * lands on the combo, which is the number it is standing next to. */
  const green = worstSnapshot({ cycles: 0, combo: 0, comboBest: 0 });
  const { runs } = await drawn(green);
  inScreen(runs);
  noPileUp(onPlate(runs));

  // And it goes away once the player has cooked a step.
  const taught = await drawn(worstSnapshot({ cycles: 1 }));
  inScreen(taught.runs);
  noPileUp(onPlate(taught.runs));

  const width = (list) => list.reduce((m, r) => Math.max(m, r.x + r.w), 0);
  assert.ok(width(runs) > 0 && width(taught.runs) > 0, 'both frames should have printed something');
});


test('the card says when a chord is wanted at another pot too', async () => {
  /* THE ROW UNDER THE CHORD, and what it has said over three rules.
   *
   * It was a compact fingering, which said the same thing as the diagram two
   * pixels to its right. Then it was the rule made visible — pips for the
   * strums a step wanted and a bar for the silence after them — because the
   * first person to play with a guitar asked whether they had to strum the
   * same chord many times, and nothing near where they were looking answered.
   * Now a step is one chord heard, so there is nothing to count, and the row
   * carries the only fact a player cannot get from the card in front of them:
   * this chord is wanted at another pot too, and one strum cooks both. It has
   * to fit the left column — the diagram is opaque and owns everything from
   * `x + 40` — so it is two words and the chord is the big letter above it.
   *
   * Which is worth a whole row because it is the best-paid move in the game
   * and it used to be a two-character hint in a corner. */
  /* The recorder hands back BOXES and not strings — a run is where letters
   * were printed and how many, which is what a layout test can honestly know
   * — so the label is identified by where it sits: the row under the chord, in
   * the left column, six characters of the small font. */
  const shared = async (n) => {
    const stations = Array.from({ length: n }, (_, i) => worstStation(i, { wants: 'Bb' }));
    const { runs } = await drawn(worstSnapshot({ stations, hand: 'Bb' }));
    inScreen(runs);
    inCards(runs);
    /* Only the cards that have a ticket on them: the closed ones print `OPENS
     * AT LUNCH` across this same row, which is their own business. */
    return runs.filter((r) => r.y >= GEO.CARD_Y + 27 && r.y < GEO.CARD_Y + 34
      && Math.floor(r.x / GEO.SLOT_W) < n && r.x % GEO.SLOT_W >= 21);
  };

  assert.equal((await shared(1)).length, 0, 'one pot wants it: there is nothing to say');
  const two = await shared(2);
  assert.equal(two.length, 2, 'two pots want it, so both cards say so');
  for (const r of two) {
    const i = Math.floor(r.x / GEO.SLOT_W);
    const left = slotX(i) + 2;
    assert.ok(r.x >= left + 3, 'the label starts inside its card: ' + r.x);
    assert.ok(r.x + r.w <= left + 38, 'and ends before the diagram at ' + (left + 40) + ': ' + (r.x + r.w));
    /* Five and not six: the space in `2 POTS` has no ink, and the recorder
     * only sees the glyphs that were actually blitted. */
    assert.equal(r.n, 5, 'the five inked characters of "2 POTS": ' + r.n);
  }
});

test('a long chord name stays in its column, big or small', async () => {
  /* The left column of a card is thirty-six pixels and was cut for three
   * glyphs. `Cadd9` and `Asus4` are five: written big they would run under
   * the diagram, so the root is written big and the rest small, and in a
   * chip too narrow for the name the root stands for it. Six steps of
   * five-glyph names is the worst recipe the menu can now deal. */
  const steps = ['Cadd9', 'Gsus4', 'Asus4', 'Asus2', 'Dsus4', 'Cadd9'];
  const snap = worstSnapshot({
    wants: ['Cadd9'],
    stations: Array.from({ length: GEO.SLOTS }, (_, i) => worstStation(i, { steps, wants: 'Cadd9', step: 2 })),
  });
  const { runs } = await drawn(snap);
  inScreen(runs);
  inCards(onPlate(runs));
  noPileUp(onPlate(runs));
});

test('eight-step recipes preview two full upcoming chords, including both F shapes', () => {
  for (const chord of CHORDS) {
    const steps = Array(8).fill(chord);
    const recipe = recipeLayout(worstStation(0, { steps, step: 3 }), 0, GEO);
    assert.equal(recipe.cells.length, 2);
    for (const cell of recipe.cells) {
      assert.equal(cell.name, previewName(chord));
      assert.ok(measure(cell.name, 'M') < cell.w, chord + ' needs room for every letter');
      assert.ok(cell.x >= recipe.x + 1 && cell.x + cell.w <= recipe.x + recipe.w - 1);
      assert.ok(cell.y >= GEO.CARD_Y + 2 && cell.y + cell.h <= GEO.CARD_Y + 12);
      assert.ok(cell.x + cell.w <= recipe.more.dividerX - 2, 'chord brackets leave air before the continuation divider');
    }
    assert.ok(recipe.more.x >= recipe.more.dividerX + 2);
    assert.ok(recipe.more.x + recipe.more.w <= recipe.x + recipe.w - 2);
    assert.deepEqual(recipe.cells.map(c => c.index), [4, 5]);
    assert.equal(recipe.cells[0].state, 'next');
    assert.equal(recipe.hidden, 2);
    assert.equal(recipe.next, chord);
  }
  assert.equal(previewName('Cadd9'), 'Cadd9');
  assert.notEqual(previewName('F'), previewName('F+'));
  assert.equal(recipeLayout(null, 0, GEO), null);
  assert.equal(recipeLayout({ dish: null, steps: [] }, 0, GEO), null);
});

test('two upcoming chords stay readable at every step, including narrow windows', async () => {
  const steps = ['Cadd9', 'Gsus4', 'Dsus4', 'Asus4', 'F+', 'F', 'G/B', 'Asus2'];
  for (const w of [600, 960]) {
    for (let step = 0; step < steps.length; step++) {
      const stations = Array.from({ length: GEO.SLOTS }, (_, i) => worstStation(i, { steps, step, wants: steps[step] }));
      const { runs, ops } = await drawn(worstSnapshot({ stations }), { w, hints: true });
      inScreen(runs);
      inCards(onPlate(runs));
      noPileUp(onPlate(runs));
      const glyphs = ops.filter((op) => op.kind === 'glyph' && op.y >= GEO.CARD_Y + 3 && op.y + op.h <= GEO.CARD_Y + 10);
      const upcoming = steps.slice(step + 1, step + 3);
      const more = Math.max(0, steps.length - step - 3);
      const expected = upcoming.length ? upcoming.reduce((n, c) => n + previewName(c).replace(/ /g, '').length, 0) + (more ? 2 : 0) : 8;
      assert.equal(glyphs.length, GEO.SLOTS * expected, 'no upcoming chord glyph is omitted at width ' + w);
      const recipe = recipeLayout(stations[0], 0, GEO);
      assert.equal(recipe.next, steps[step + 1] || null);
      assert.equal(recipe.hidden, more);
    }
  }
});

test('step feedback stays on the stove tag and never crosses the heat gauge', async () => {
  for (const spoiled of [false, true]) {
    for (const after of [40, 350, 700]) {
      const { runs, ops } = await drawn(worstSnapshot(), {
        events: [['cycle', { stations: [0], late: spoiled ? [0] : [] }]], after,
      });
      const tag = runs.filter(r => r.y === GEO.STOVE_FRONT_Y + 5 && r.x < GEO.SLOT_W);
      assert.equal(tag.length, 1, 'one stationary message replaces the price');
      assert.equal(tag[0].n, 6, 'all six inked letters of COOKED / -1 STAR remain visible');
      assert.ok(tag[0].x >= GEO.SLOT_W / 2 - 23 && tag[0].x + tag[0].w <= GEO.SLOT_W / 2 + 23);
      // Use the painted track: a dirty hit can shift the whole board by a pixel.
      const gauges = ops.filter(op => op.kind === 'rect' && op.color === P.ink
        && op.w === GEO.CARD_W - 8 && op.h === 5 && op.y >= GEO.CARD_Y + 47 && op.y <= GEO.CARD_Y + 51);
      assert.equal(gauges.length, GEO.SLOTS);
      const overGauge = ops.filter(op => op.kind === 'glyph' && gauges.some(gauge => hits(op, gauge)));
      assert.equal(overGauge.length, 0, 'the heat gauge and its tick stay readable during feedback');
      noPileUp(onPlate(runs));
    }
  }
});

test('urgent clocks retain every digit in both pulse phases and reduced motion', async () => {
  const snap = worstSnapshot({ stations: Array.from({ length: GEO.SLOTS }, (_, i) => worstStation(i, { life: 1.8 })) });
  for (const opts of [{ at: 3000 }, { at: 3300 }, { still: true }]) {
    const { ops } = await drawn(snap, opts);
    const digits = ops.filter(op => op.kind === 'glyph' && op.y === GEO.CARD_Y + 34 && op.h === 14);
    assert.equal(digits.length, GEO.SLOTS, 'every urgent station keeps its timer');
    for (const digit of digits) assert.ok(digit.x % GEO.SLOT_W < 38, 'digits stay in the clock column');
  }
});

test('pausing holds the actual scene and preserves in-flight feedback', async (t) => {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const page = paper();
  const { createScene } = await import('../src/scene.js?pause-check');
  const scene = createScene(page.container);
  try {
    scene.update(worstSnapshot());
    page.frame(time);
    scene.event('strum', { chord: 'Am', stations: [0, 1], together: 2, gain: 4 });
    scene.setPaused({ title: 'PAUSED' });
    const first = page.capture(() => page.frame(time + 20));
    time += 15000;
    const later = page.capture(() => page.frame(time));
    assert.deepEqual(later.ops, first.ops, 'neither the scenery nor feedback ages while paused');
    scene.setPaused(null);
    const resumed = page.capture(() => page.frame(time));
    assert.ok(resumed.ops.length > 0, 'the scene resumes drawing');
  } finally { scene.destroy(); }
});

test('the diagnostic header and long error tokens stay on screen', async () => {
  const diag = [
    'EAR MEDIUM - NOTES - STRUMS 123456 NAMED 123456 COOKED 123456 MUDDY 123456 HELD 123456 QUICK 123456 UNNAMED 123456',
    'X'.repeat(260),
    'C3 E3 G3 C4 E4 - Cadd9 0.95 NAMED',
  ];
  const { runs } = await drawn(worstSnapshot(), { diag });
  inScreen(runs);
});
