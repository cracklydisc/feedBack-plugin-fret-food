/*
 * The options plate: the model, the sentences and the geometry.
 *
 * The picker used to be the hub's, three rows of words in the app's own grey.
 * It is the game's now, and everything about it that can be checked without
 * a canvas is checked here: where a choice comes from and what it falls back
 * to, that a locked sprint is read and not taken, that every multiplier a
 * sentence quotes is the one `scoreOf` charges, and that every box lands on
 * the plate without touching another — the third row's sentence included,
 * which shares its band with the START chip.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOptions, menuLayout, menuHit, loadChoices, saveChoices, ROWS, DEFAULTS, CHOICES_KEY, MENU } from '../src/options.js';
import { scoreOf } from '../src/engine.js';
import { measure } from '../src/art/font.js';
import { GEO } from '../src/art/geo.js';
import { FONTS } from '../src/art/font.js';

const store = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

test('a choice comes from the address, then from last time, then from the defaults', () => {
  assert.deepEqual(createOptions({}).toJSON(), DEFAULTS);
  const saved = createOptions({ saved: { pace: 'relaxed', pans: 2, mode: 'practice' } });
  assert.deepEqual(saved.toJSON(), { pace: 'relaxed', pans: 2, mode: 'practice' });
  const pinned = createOptions({ saved: { pace: 'relaxed', pans: 2 }, pinned: { pace: 'rush', pans: '4' } });
  assert.deepEqual(pinned.toJSON(), { pace: 'rush', pans: 4, mode: 'service' }, 'the address wins and its strings become numbers');
  const junk = createOptions({ saved: { pace: 'lazy', pans: 9, mode: 7 }, pinned: { mode: 'nonsense' } });
  assert.deepEqual(junk.toJSON(), DEFAULTS, 'nothing unknown is kept, nothing throws');
});

test('arrows walk the rows and the values, and wrap at both ends', () => {
  const o = createOptions({});
  assert.equal(o.state.row, 0);
  assert.equal(o.move(-1), 'mode', 'up from the first row is the last');
  assert.equal(o.move(1), 'pace');
  o.move(1);                                   // burners
  assert.equal(o.turn(1), 1, 'right from 5 burners wraps to 1');
  assert.equal(o.turn(-1), 5);
  assert.equal(o.turn(-1), 4);
  assert.ok(o.set('mode', 'loop'), 'a click sets a value outright');
  assert.equal(o.state.row, 2, 'and moves the cursor to that row');
  assert.equal(o.set('mode', 'marathon'), false);
  assert.equal(o.state.mode, 'loop');
});

test('a sprint not yet earned can be read and not taken', () => {
  const locked = createOptions({ saved: { mode: 'sprint' } });
  assert.equal(locked.state.mode, 'sprint', 'the chip is chosen');
  assert.equal(locked.resolved().mode, 'service', 'the service is not');
  assert.equal(locked.resolved().locked, 'sprint');
  assert.match(locked.tell('mode'), /OPENS AT 1000 DB/);
  const open = createOptions({ saved: { mode: 'sprint' }, unlocked: new Set(['sprint']) });
  assert.equal(open.resolved().mode, 'sprint');
  assert.equal(open.resolved().locked, null);
  assert.match(open.tell('mode'), /THREE MINUTES/);
});

test('every multiplier a sentence quotes is the one the score charges', () => {
  for (const row of ROWS) {
    for (const v of row.values) {
      const m = /SCORE X([\d.]+)/.exec(v.tell);
      const o = {};
      o[row.id] = v.id;
      const { mult } = scoreOf(1, o);
      if (mult === 0) {
        assert.match(v.tell, /NOT SCORED/, row.id + ' ' + v.id + ' should say it is not scored');
        assert.equal(m, null);
      } else if (mult !== 1) {
        assert.ok(m, row.id + ' ' + v.id + ' does not say its multiplier');
        assert.equal(Number(m[1]), mult, row.id + ' ' + v.id + ' quotes ' + m[1] + ' and charges ' + mult);
      } else if (m) {
        // A mode worth the whole takings says so in words; a number, if any, has to be one.
        assert.equal(Number(m[1]), 1, row.id + ' ' + v.id + ' quotes ' + m[1] + ' and charges 1');
      } else {
        assert.match(v.tell, /SCORE/, row.id + ' ' + v.id + ' says nothing about the score');
      }
    }
  }
});

test('the plate says what the three choices add up to', () => {
  const o = createOptions({ saved: { pace: 'relaxed', pans: 2, mode: 'service' } });
  assert.equal(menuLayout(o, GEO).score.s, 'SCORE X' + (0.75 * 0.7).toFixed(2));
  o.set('mode', 'practice');
  assert.equal(menuLayout(o, GEO).score.s, 'NOT SCORED');
  o.set('mode', 'sprint');
  assert.equal(menuLayout(o, GEO).score.s, 'SCORE X' + (0.75 * 0.7).toFixed(2), 'a locked sprint is scored as the service it will be');
});

test('every sentence is written in the S font and stops short of the START chip', () => {
  const glyphs = FONTS.S.glyphs;
  for (const row of ROWS) {
    for (const v of row.values) {
      for (const s of [v.tell, v.locked || '', v.label]) {
        for (const ch of s.toUpperCase()) assert.ok(glyphs[ch], JSON.stringify(ch) + ' is not in the S font: ' + s);
      }
    }
  }
  // Every value of every row, chosen in turn, with the sprint both ways.
  for (const unlocked of [new Set(), new Set(['sprint'])]) {
    for (const row of ROWS) {
      for (const v of row.values) {
        const o = createOptions({ unlocked });
        o.set(row.id, v.id);
        const L = menuLayout(o, GEO);
        const right = L.plate.x + L.plate.w - MENU.PAD;
        for (const r of L.rows) {
          const w = measure(r.tell.s, 'S');
          assert.ok(r.tell.x + w <= right, r.tell.s + ' runs off the plate');
          if (r.tell.y + 5 > L.start.y) {
            assert.ok(r.tell.x + w < L.start.x - 2, r.tell.s + ' runs into START');
          }
        }
      }
    }
  }
});

test('nothing on the plate touches anything else, and nothing leaves it', () => {
  const o = createOptions({});
  const L = menuLayout(o, GEO);
  const boxes = [];
  const inner = { x: L.plate.x + 2, y: L.plate.y + 2, w: L.plate.w - 4, h: L.plate.h - 4 };
  const within = (b, name) => assert.ok(b.x >= inner.x && b.y >= inner.y && b.x + b.w <= inner.x + inner.w && b.y + b.h <= inner.y + inner.h, name + ' leaves the plate: ' + JSON.stringify(b));
  boxes.push({ x: L.title.x, y: L.title.y, w: measure(L.title.s, 'M'), h: 7, name: 'title' });
  boxes.push({ x: L.score.x - measure(L.score.s, 'M'), y: L.score.y, w: measure(L.score.s, 'M'), h: 7, name: 'score' });
  for (const r of L.rows) {
    boxes.push({ x: r.x, y: r.y, w: 6 + measure(r.label, 'S'), h: 5, name: r.label });
    for (const c of r.chips) boxes.push(Object.assign({ name: r.label + ' ' + c.label }, c));
    boxes.push({ x: r.tell.x, y: r.tell.y, w: measure(r.tell.s, 'S'), h: 5, name: r.label + ' tell' });
  }
  boxes.push({ x: L.footer.x, y: L.footer.y, w: measure(L.footer.s, 'S'), h: 5, name: 'footer' });
  boxes.push(Object.assign({ name: 'start' }, L.start));
  for (const b of boxes) within(b, b.name);
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      assert.ok(!overlap(boxes[i], boxes[j]), boxes[i].name + ' lands on ' + boxes[j].name);
    }
  }
  // The plate itself sits between the bar and the strip: the strip's own line
  // — PLAY C TO OPEN THE KITCHEN — and the first ticket stay in view.
  assert.ok(L.plate.y >= GEO.BAR_Y + GEO.BAR_H, 'the plate covers the bar');
  assert.ok(L.plate.y + L.plate.h <= GEO.STRIP_Y, 'the plate covers the strip');
  assert.ok(L.plate.x >= 0 && L.plate.x + L.plate.w <= GEO.W);
});

test('a click lands on a chip or on START, and a click on the wood on nothing', () => {
  const o = createOptions({});
  const L = menuLayout(o, GEO);
  const chip = L.rows[2].chips[1];
  assert.deepEqual(menuHit(L, chip.x + 1, chip.y + 1), { kind: 'chip', row: 'mode', value: 'practice' });
  assert.deepEqual(menuHit(L, L.start.x + 2, L.start.y + 2), { kind: 'start' });
  assert.equal(menuHit(L, L.plate.x + 1, L.plate.y + 1), null);
  assert.equal(menuHit(L, 0, 200), null);
  // The chosen chip is marked, and only it.
  const chosen = L.rows[1].chips.filter((c) => c.selected);
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].value, 5);
});

test('the choices survive a service, and a broken store does not', () => {
  const s = store();
  assert.equal(loadChoices(s), null);
  const o = createOptions({ saved: { pace: 'rush', pans: 3, mode: 'loop' } });
  assert.ok(saveChoices(s, o.toJSON()));
  assert.deepEqual(loadChoices(s), { pace: 'rush', pans: 3, mode: 'loop' });
  assert.deepEqual(createOptions({ saved: loadChoices(s) }).toJSON(), { pace: 'rush', pans: 3, mode: 'loop' });
  s.setItem(CHOICES_KEY, '{not json');
  assert.equal(loadChoices(s), null, 'a broken store is an empty one');
  const angry = { getItem() { throw new Error('private'); }, setItem() { throw new Error('private'); } };
  assert.equal(loadChoices(angry), null);
  assert.equal(saveChoices(angry, {}), false);
});
