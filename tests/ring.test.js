/*
 * The hand holds its shape.
 *
 * Reported from the first session with the calibrated ear, and again from the
 * second: play the G a ticket wants and the pot cooks — and so does the C on
 * the ticket beside it. The adapter asks "which of the chords on the counter
 * fits best", and once the G has cooked the counter wants C and Am, so the
 * NEXT strum of the same G — a player strums a chord several times — is
 * judged against those alone, and the nearest wrong shape wins. The first fix
 * kept the chord just named in the line-up for seven tenths of a second; the
 * second session played slower than that. So the chord last named stays in
 * the line-up for as long as it takes: only a chord that BEATS it is a change,
 * and no change comes a quarter of a second after the last strum.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineAdapter, engineNotes, MIN_CHANGE_MS } from '../src/input/engine.js';
import { createPort } from '../src/input/port.js';
import { SHAPES } from '../src/menu.js';

/** A bridge whose input level and per-chord scores the test decides. */
function fakeBridge(scores) {
  return {
    level: 0,
    scores,
    async getLevels() { return { inputLevel: this.level }; },
    async scoreChord(req) {
      const sig = req.notes.map((n) => n.s + ':' + n.f).join(',');
      const name = Object.keys(SHAPES).find((c) => {
        const notes = engineNotes(c);
        return notes && notes.map((n) => n.s + ':' + n.f).join(',') === sig;
      });
      const score = name && this.scores[name] !== undefined ? this.scores[name] : 0;
      const total = req.notes.length;
      return { isHit: score >= 0.5, score, hitStrings: Math.round(score * total), totalStrings: total };
    },
  };
}

/** Drives the adapter's poll loop by hand: no timers, no real clock. */
function bench(scores, candidates) {
  const bridge = fakeBridge(scores);
  const port = createPort('detector');
  const strums = [];
  port.on('strum', (e) => strums.push(e));
  port.setCandidates(candidates);
  let t = 0;
  let pending = null;
  const settles = [];
  const adapter = createEngineAdapter(port, {
    audio: bridge,
    now: () => t,
    wait: () => new Promise((r) => settles.push(r)),
    schedule: (fn) => { pending = fn; return 1; },
    unschedule: () => { pending = null; },
  });
  return {
    port, strums, adapter, bridge,
    async poll(level, ms) {
      t += ms === undefined ? 16 : ms;
      bridge.level = level;
      const fn = pending;
      pending = null;
      if (fn) await fn();
      for (let k = 0; k < 8; k++) {
        while (settles.length) settles.pop()();
        await Promise.resolve();
      }
    },
    /** A strum: quiet, then a sharp rise, `gap` ms after the last one. */
    async strum(gap) {
      await this.poll(0.02, gap - 16);
      await this.poll(0.6, 16);
    },
  };
}

test('the chord the hand holds is not the next chord, however long it keeps coming back', async () => {
  // A G rings well; a C, played on its own, less so but well over the floor.
  const b = bench({ G: 0.9, C: 0.55 }, ['G']);
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.5);                          // the strum: a G, named
  assert.equal(b.strums.length, 1);
  assert.equal(b.strums[0].chord, 'G');

  // The pot moves on and wants C now. The player strums the G again, in time,
  // and again a bar later: neither is a C.
  b.port.setCandidates(['C']);
  await b.strum(400);
  assert.equal(b.strums.length, 1, 'the second strum of the G was named a C');
  assert.equal(b.adapter.stats.ring, 1, 'and it is counted as the hand still there');
  await b.strum(2000);
  assert.equal(b.strums.length, 1, 'two seconds later the same G is still not a C');
  assert.equal(b.adapter.stats.ring, 2);

  // The hand really moves: the G is gone from the picture and the C is there.
  b.bridge.scores = { G: 0.2, C: 0.55 };
  await b.strum(600);
  assert.equal(b.strums.length, 2, 'a chord that beats the one the hand held is a new chord');
  assert.equal(b.strums[1].chord, 'C');
});

test('a new chord that beats the one still ringing is heard at once', async () => {
  // The player really does change: the C scores higher than the fading G.
  const b = bench({ G: 0.9, C: 0.55 }, ['G']);
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.5);
  assert.equal(b.strums[0].chord, 'G');
  b.port.setCandidates(['C']);
  b.bridge.scores = { G: 0.5, C: 0.9 };
  await b.strum(MIN_CHANGE_MS + 60);
  assert.equal(b.strums.length, 2, 'a clean change is not held back by the hand');
  assert.equal(b.strums[1].chord, 'C');
  assert.equal(b.adapter.stats.ring, 0);
  assert.equal(b.adapter.stats.quick, 0);
});

test('no hand changes shape in a quarter of a second', async () => {
  const b = bench({ G: 0.9, C: 0.3 }, ['G']);
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.5);
  assert.equal(b.strums[0].chord, 'G');
  // The pot wants C now, and the ring is misjudged as one right after the
  // strum: a C named 190 ms after a G is not a change anybody made.
  b.port.setCandidates(['C']);
  b.bridge.scores = { G: 0.3, C: 0.9 };
  await b.strum(190);
  assert.equal(b.strums.length, 1, 'a change faster than a hand was believed');
  assert.equal(b.adapter.stats.quick, 1);
  // Its next strum, at a human distance, is the C.
  await b.strum(MIN_CHANGE_MS + 40);
  assert.equal(b.strums.length, 2);
  assert.equal(b.strums[1].chord, 'C');
  // The same chord twice in quick succession is never a "quick change".
  b.port.setCandidates(['C', 'G']);
  await b.strum(180);
  assert.equal(b.strums.length, 3, 'a repeat is a repeat: the engine throttles those, not the ear');
  assert.equal(b.strums[2].chord, 'C');
  assert.equal(b.adapter.stats.quick, 1);
});
