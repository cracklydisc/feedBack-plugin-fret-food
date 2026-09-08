/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE OPTIONS PLATE: what tonight's service is, chosen in the game.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The pace, the burners and the mode used to be three rows of buttons in the
 * hub's picker, a grey modal in the app's own type with a word on each button
 * and nothing else. A tester's note said it in one line: the settings need
 * explaining, and they need to be a menu of THIS game. So the picker is empty
 * now and the choice is made here, on a plate over the dining room, drawn in
 * the game's pixels while the first customer already sits at the counter with
 * their ticket up. Every value has a sentence under it that says what it does
 * to the kitchen and what it does to the score, and the plate says the
 * multiplier the three choices add up to. Arrows and Enter, a click or a tap,
 * or the first chord — which opens the kitchen exactly as it did before.
 *
 * This file is the model and the geometry and nothing else: no canvas, no
 * DOM. The scene draws what `menuLayout` hands it and the glue turns keys and
 * clicks into `move`, `turn`, `set` — so the whole plate can be checked in
 * Node, box by box, the way the strip and the cards are.
 */

import { scoreOf } from './engine.js';
import { measure } from './art/font.js';

/* What can be chosen, and what each choice does — said in the S font, which
 * has no lowercase and no brackets, so the sentences are written for it, and
 * in at most seventy-four characters, so the last row's sentence stops short
 * of the START chip. The multipliers in the sentences are checked against
 * `SCORE_MULT` by a test: a number written twice has to agree with itself. */
export const ROWS = [
  {
    id: 'pace', label: 'PACE',
    values: [
      { id: 'relaxed', label: 'RELAXED', tell: 'POTS DRAIN A FIFTH SLOWER AND THE FLAMES CLIMB SLOWER - SCORE X0.75' },
      { id: 'normal', label: 'NORMAL', tell: 'THE KITCHEN AS IT IS TUNED - SCORE X1' },
      { id: 'rush', label: 'RUSH', tell: 'POTS DRAIN A QUARTER FASTER AND THE FLAMES CLIMB FASTER - SCORE X1.25' },
    ],
  },
  {
    id: 'pans', label: 'BURNERS',
    values: [
      { id: 1, label: '1', tell: 'ONE POT - THE CHANGE DRILL WITH NOTHING ELSE ON THE COUNTER - SCORE X0.5' },
      { id: 2, label: '2', tell: 'TWO POTS - ONE ROUND TRIP, AND TWO POTS CAN WANT ONE CHORD - SCORE X0.7' },
      { id: 3, label: '3', tell: 'THREE POTS - THE THIRD OPENS AT LATE DINNER - SCORE X0.85' },
      { id: 4, label: '4', tell: 'FOUR POTS - THE FOURTH OPENS ON SATURDAY NIGHT - SCORE X0.95' },
      { id: 5, label: '5', tell: 'THE WHOLE COUNTER - FIVE POTS BY CLOSING TIME - SCORE X1' },
    ],
  },
  {
    id: 'mode', label: 'MODE',
    values: [
      { id: 'service', label: 'SERVICE', tell: 'THREE LOST CUSTOMERS CLOSE THE KITCHEN - THE TAKINGS ARE THE SCORE' },
      { id: 'practice', label: 'PRACTICE', tell: 'NO STRIKES - EVERY CHANGE IS TIMED AND WRITTEN OVER ITS CARD - NOT SCORED' },
      { id: 'loop', label: 'LOOP', tell: 'ONE DISH ON ONE POT, FOR EVER - AIMED AT YOUR SLOWEST CHANGE - NOT SCORED' },
      {
        id: 'sprint', label: 'SPRINT', tell: 'THREE MINUTES FROM THE FIRST CHORD - THE TAKINGS ARE THE SCORE',
        /* Earned, not chosen: the hub counts dB across its games and says
         * when this one is open. Until then it can be read and not taken. */
        unlock: 'sprint', locked: "OPENS AT 1000 DB ACROSS THE HUB'S GAMES - A SERVICE UNTIL THEN",
      },
    ],
  },
];

export const DEFAULTS = { pace: 'normal', pans: 5, mode: 'service' };

/* Where the choices are kept between services. */
export const CHOICES_KEY = 'fretfood.choices';

/** A choice the rows know, or nothing. `pans` arrives as a string from the
 *  address and from the hub, and as a number from here. */
function known(rowId, value) {
  const row = ROWS.find((r) => r.id === rowId);
  if (!row || value === null || value === undefined || value === '') return undefined;
  const v = rowId === 'pans' ? Number(value) : String(value).toLowerCase();
  return row.values.some((x) => x.id === v) ? v : undefined;
}

/**
 * The model: three values and a cursor.
 *
 * `o.saved` is last time's choice, `o.pinned` what the address or the hub
 * insists on (it wins), `o.unlocked` the set of ids the hub says are earned.
 * Anything unknown falls back one step, and never throws: a stale key in
 * storage is not a reason to refuse a service.
 */
export function createOptions(o) {
  const opt = o || {};
  const unlocked = opt.unlocked || new Set();
  const state = { row: 0 };
  for (const row of ROWS) {
    const pinned = known(row.id, opt.pinned && opt.pinned[row.id]);
    const saved = known(row.id, opt.saved && opt.saved[row.id]);
    state[row.id] = pinned !== undefined ? pinned : saved !== undefined ? saved : DEFAULTS[row.id];
  }

  const rowOf = (id) => ROWS.find((r) => r.id === id);
  const valueOf = (rowId) => rowOf(rowId).values.find((v) => v.id === state[rowId]);
  const isLocked = (v) => !!(v && v.unlock && !unlocked.has(v.unlock));

  /** Up and down between rows; wraps. */
  function move(dy) {
    state.row = (state.row + (dy < 0 ? -1 : 1) + ROWS.length) % ROWS.length;
    return ROWS[state.row].id;
  }
  /** Left and right along the row under the cursor; wraps. */
  function turn(dx) {
    const row = ROWS[state.row];
    const i = row.values.findIndex((v) => v.id === state[row.id]);
    const j = (i + (dx < 0 ? -1 : 1) + row.values.length) % row.values.length;
    state[row.id] = row.values[j].id;
    return state[row.id];
  }
  /** A value chosen outright (a click); moves the cursor to that row. */
  function set(rowId, value) {
    const v = known(rowId, value);
    if (v === undefined) return false;
    state[rowId] = v;
    state.row = ROWS.findIndex((r) => r.id === rowId);
    return true;
  }

  /** What the service will actually be: a locked choice falls back to the
   *  first value of its row, and `locked` names what was asked and refused. */
  function resolved() {
    const out = { locked: null };
    for (const row of ROWS) {
      const v = valueOf(row.id);
      if (isLocked(v)) { out[row.id] = row.values[0].id; out.locked = v.id; } else out[row.id] = v.id;
    }
    return out;
  }

  /** The sentence under a row: the value's own, or why it cannot be had. */
  function tell(rowId) {
    const v = valueOf(rowId);
    return isLocked(v) ? v.locked : v.tell;
  }

  /** The three values, as something to keep. */
  function toJSON() {
    return { pace: state.pace, pans: state.pans, mode: state.mode };
  }

  return { state, rows: ROWS, move, turn, set, resolved, tell, locked: (rowId, value) => isLocked(rowOf(rowId).values.find((v) => v.id === value)), toJSON };
}

/** Last time's choices out of storage, or nothing. Never throws. */
export function loadChoices(storage) {
  try {
    const raw = (storage || localStorage).getItem(CHOICES_KEY);
    const j = raw ? JSON.parse(raw) : null;
    return j && typeof j === 'object' ? j : null;
  } catch (_) { return null; }
}

/** The choices kept for next time. Never throws. */
export function saveChoices(storage, choices) {
  try { (storage || localStorage).setItem(CHOICES_KEY, JSON.stringify(choices)); return true; } catch (_) { return false; }
}

/* ── the geometry ───────────────────────────────────────────────────────── */

/* The plate over the dining room: from under the bar to the top of the
 * strip, so the strip's own line — PLAY C TO OPEN THE KITCHEN — and the whole
 * kitchen with the first ticket stay in view under it. */
export const MENU = {
  X: 36, Y: 24, W: 408, H: 94,
  PAD: 6,
  LABEL_W: 52,          // the row's name, and the caret before it
  CHIP_H: 11,           // an M glyph is seven tall, plus two above and below
  CHIP_PAD: 4,          // air either side of a chip's word
  CHIP_GAP: 4,
  ROW_H: 21,            // chips, the sentence under them, and a breath
  TITLE_H: 7,
};

/**
 * Every box on the plate, in game pixels: the title and the multiplier, the
 * three rows with their chips and their sentence, the footer and the START
 * chip. Pure, so a test can walk it and say nothing overlaps and nothing
 * leaves the plate.
 */
export function menuLayout(model, geo) {
  const G = geo || { W: 480 };
  const M = MENU;
  const x0 = M.X + M.PAD, y0 = M.Y + M.PAD;
  const right = M.X + M.W - M.PAD;
  const res = model.resolved();
  const mult = scoreOf(1, res).mult;
  const scored = mult > 0;
  const rows = model.rows.map((row, k) => {
    const ry = y0 + M.TITLE_H + 4 + k * M.ROW_H;
    let cx = x0 + M.LABEL_W;
    const chips = row.values.map((v) => {
      const w = measure(v.label, 'M') + M.CHIP_PAD * 2;
      const chip = {
        row: row.id, value: v.id, label: v.label,
        x: cx, y: ry, w, h: M.CHIP_H,
        selected: model.state[row.id] === v.id,
        locked: model.locked(row.id, v.id),
      };
      cx += w + M.CHIP_GAP;
      return chip;
    });
    return {
      id: row.id, label: row.label, cursor: model.state.row === k,
      x: x0, y: ry + 3, chips,
      tell: { s: model.tell(row.id), x: x0 + M.LABEL_W, y: ry + M.CHIP_H + 2 },
    };
  });
  const startW = measure('START', 'M') + M.CHIP_PAD * 2 + 4;
  const footY = M.Y + M.H - M.PAD - 6;
  return {
    plate: { x: M.X, y: M.Y, w: M.W, h: M.H },
    title: { s: "TONIGHT'S SERVICE", x: x0, y: y0 },
    score: { s: scored ? 'SCORE X' + mult.toFixed(2) : 'NOT SCORED', x: right, y: y0, scored },
    rows,
    footer: { s: 'ARROWS CHOOSE - ENTER OR YOUR FIRST CHORD OPENS THE KITCHEN', x: x0, y: footY },
    start: { s: 'START', x: right - startW, y: footY - 3, w: startW, h: M.CHIP_H },
    W: G.W,
  };
}

/** What a point on the screen lands on: a chip, START, or nothing. */
export function menuHit(layout, gx, gy) {
  const inside = (b) => gx >= b.x && gx < b.x + b.w && gy >= b.y && gy < b.y + b.h;
  if (inside(layout.start)) return { kind: 'start' };
  for (const row of layout.rows) {
    for (const c of row.chips) if (inside(c)) return { kind: 'chip', row: row.id, value: c.value };
  }
  return null;
}
