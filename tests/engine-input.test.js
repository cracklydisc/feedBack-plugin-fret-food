/*
 * THE GUITAR ADAPTER, without a guitar.
 *
 * The whole thing is driven by two calls on the desktop bridge —
 * `getLevels()` and `scoreChord()` — so a fake bridge is a complete
 * instrument: a level to rise and fall, and a scorer that answers for each
 * shape. What is tested here is the two decisions the adapter makes, which are
 * the two decisions the guitar path IS:
 *
 *   when did you strum, and which of the chords on the counter was it.
 *
 * These are the tests that would have caught the thing I had wrong: the game
 * listened on the road that needs a chart, and so it heard nothing at all.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPort } from '../src/input/port.js';
import { createEngineAdapter, engineNotes, bestFit, audioBridge } from '../src/input/engine.js';
import { SHAPES, CHORDS } from '../src/menu.js';

/** A bridge whose input level and per-chord scores the test decides. */
function fakeBridge(opts) {
  const o = opts || {};
  const calls = [];
  return {
    level: o.level === undefined ? 0 : o.level,
    scores: o.scores || {},
    calls,
    async getLevels() { return { inputLevel: this.level }; },
    async scoreChord(req) {
      calls.push(req);
      /* Name the shape back from its notes, so the fake answers per chord the
       * way the engine does: by what it was asked about. */
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
function bench(opts) {
  const o = opts || {};
  const bridge = fakeBridge(o);
  const port = createPort('detector');
  const strums = [];
  const status = [];
  port.on('strum', (e) => strums.push(e));
  port.on('status', (e) => status.push(e));
  port.setCandidates(o.candidates || ['C', 'Am']);

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
    bridge, port, strums, status, adapter,
    get t() { return t; },
    /** One poll of the level at `level`, `ms` after the last one. */
    async poll(level, ms) {
      t += ms === undefined ? 16 : ms;
      bridge.level = level;
      const fn = pending;
      pending = null;
      if (fn) await fn();
      // Let the settle wait and the scoring promises run to completion.
      for (let k = 0; k < 8; k++) {
        while (settles.length) settles.pop()();
        await Promise.resolve();
      }
    },
  };
}

/* ── which chord was it ──────────────────────────────────────────────────── */

test('the shape reaches the engine in the numbering the engine uses', () => {
  /* Both sides count strings from the low E and both drop the muted ones, so
   * the index passes straight through. It is the kind of agreement that half
   * works when it is wrong: the shapes still match, only mirrored. */
  assert.deepEqual(engineNotes('C'), [{ s: 1, f: 3 }, { s: 2, f: 2 }, { s: 3, f: 0 }, { s: 4, f: 1 }, { s: 5, f: 0 }]);
  assert.deepEqual(engineNotes('Em'), [
    { s: 0, f: 0 }, { s: 1, f: 2 }, { s: 2, f: 2 }, { s: 3, f: 0 }, { s: 4, f: 0 }, { s: 5, f: 0 },
  ]);
  assert.equal(engineNotes('nonsense'), null);

  /* Every chord in the game can be asked about, open strings included: they
   * are what makes two similar shapes tell each other apart. */
  for (const c of CHORDS) {
    const notes = engineNotes(c);
    assert.ok(notes && notes.length >= 3, c + ' reaches the engine as ' + JSON.stringify(notes));
    assert.equal(notes.length, SHAPES[c].frets.filter((f) => f >= 0).length, c + ' lost a string on the way');
  }
});

test('the best fit wins, and a tie goes to the shape with more evidence', () => {
  const r = (score, hitStrings) => ({ score, hitStrings, totalStrings: 6, isHit: score >= 0.5 });
  assert.equal(bestFit([{ chord: 'C', result: r(1, 5) }, { chord: 'Am', result: r(0.6, 3) }]).chord, 'C');
  /* A ratio cannot tell three-of-three from six-of-six: between two shapes
   * that fit equally well, the one with more strings confirmed has more
   * behind it. */
  assert.equal(bestFit([{ chord: 'C', result: r(0.8, 4) }, { chord: 'F#m', result: r(0.8, 5) }]).chord, 'F#m');
  // Nothing fits: that is an answer, and it is not a chord.
  assert.equal(bestFit([{ chord: 'C', result: r(0.2, 1) }]), null);
  assert.equal(bestFit([null, { chord: 'C', result: null }]), null);
});

/* ── when did you strum ──────────────────────────────────────────────────── */

test('a strum names the chord that fits, with the ratio from the engine as its quality', async () => {
  const b = bench({ candidates: ['C', 'Am'], scores: { C: 1, Am: 0.6 } });
  b.adapter.start();
  await b.poll(0.01);            // quiet: primes the background
  await b.poll(0.01);
  await b.poll(0.5);             // a sharp rise: a strum
  assert.equal(b.strums.length, 1, 'one strum, not none and not two');
  assert.equal(b.strums[0].chord, 'C');
  assert.equal(b.strums[0].quality, 1);
  assert.equal(b.strums[0].source, 'detector');
  // It asked about both chords, in one go.
  assert.equal(b.bridge.calls.length, 2, 'both candidates should have been scored');
});

test('a strum nothing fits is dropped, not charged to the player', async () => {
  /* The port's `chord: null` means "something was heard that is not a chord of
   * this game", and the engine files a miss for it — three in a row cost the
   * chain. Right for a keyboard, where the key pressed is a fact; wrong for an
   * ear, where a strum we cannot name is evidence WE did not hear it. Charging
   * the player for our deafness is the one way to make a flaky detector feel
   * like a broken game. It is counted instead. */
  const b = bench({ candidates: ['C', 'Am'], scores: { C: 0.2, Am: 0.1 } });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.5);
  assert.equal(b.strums.length, 0, 'a strum nobody could name should not reach the engine');
  assert.equal(b.adapter.stats.unknown, 1, 'but it has to be counted, or nobody can diagnose it');
  assert.equal(b.adapter.stats.named, 0);
});

test('the second strum of a cycle is heard while the first is still ringing', async () => {
  /* THE defect that made the guitar feel broken. `armed` goes false on a strum
   * and came back only when the level fell to within a whisker of the
   * background — which, on a chord decaying over a second or more, is long
   * after the second strum of the cycle has come and gone. So the rest was
   * judged on one strum, one strum never reaches the line, and almost nothing
   * cooked: "it takes it now and then and mostly not". */
  const b = bench({ candidates: ['C'], scores: { C: 1 } });
  b.adapter.start();
  await b.poll(0.02);
  await b.poll(0.02);
  await b.poll(0.60);                      // first strum
  assert.equal(b.strums.length, 1);
  // The chord rings on and down — the level never falls near the background.
  for (let k = 0; k < 12; k++) await b.poll(0.58 - k * 0.01, 16);
  // 375 ms after the first: the second strum of the cycle, on top of the ring.
  await b.poll(0.75, 180);
  assert.equal(b.strums.length, 2, 'the second strum was swallowed by the ring-out gate');
  assert.equal(b.strums[1].chord, 'C');
});

test('a chord ringing out is one strum, not thirty', async () => {
  /* The level stays high while the chord decays, and every poll of it would be
   * a strum without the re-arm: the level has to fall back near the background
   * before another can fire. */
  const b = bench({ candidates: ['C'], scores: { C: 1 } });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.6);                                            // the strum
  for (let k = 0; k < 12; k++) await b.poll(0.55 - k * 0.03);   // ringing down
  assert.equal(b.strums.length, 1, 'the ring-out fired ' + b.strums.length + ' strums');
  // Once it has fallen back, the next one counts again.
  await b.poll(0.01);
  await b.poll(0.6, 200);
  assert.equal(b.strums.length, 2, 'the second strum of a cycle has to be heard');
});

test('a slow swell is not a strum', async () => {
  /* Backing music fading in crosses any absolute floor. A pluck jumps frame to
   * frame; a swell does not, and that is the difference the slope test makes.
   * Strum Fighter records the same bug: a fixed floor pinned high by its boss
   * music dropped every strum. */
  const b = bench({ candidates: ['C'], scores: { C: 1 } });
  b.adapter.start();
  await b.poll(0.01);
  for (let k = 0; k < 30; k++) await b.poll(0.01 + k * 0.02);
  assert.equal(b.strums.length, 0, 'a swell was taken for ' + b.strums.length + ' strums');
});

test('with nothing on the counter it asks the engine nothing', async () => {
  // No pot wants a chord: there is nothing to compare against and no reason to
  // spend a round trip on the bridge.
  const b = bench({ candidates: [], scores: { C: 1 } });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.6);
  assert.equal(b.bridge.calls.length, 0);
  assert.equal(b.strums.length, 0);
});

/* ── and when the engine is not there ────────────────────────────────────── */

test('with no desktop engine it refuses before it opens anything, and says why', () => {
  const port = createPort('detector');
  const status = [];
  port.on('status', (e) => status.push(e));
  const adapter = createEngineAdapter(port, { audio: null, window: {} });
  adapter.start();
  assert.equal(status.length, 1);
  assert.equal(status[0].ready, false);
  assert.match(status[0].reason, /desktop/);
});

test('the bridge is found under either of the two names the host has used', () => {
  const audio = { scoreChord() {}, getLevels() {} };
  assert.equal(audioBridge({ feedBackDesktop: { audio } }), audio);
  assert.equal(audioBridge({ slopsmithDesktop: { audio } }), audio, 'the old name has to keep working');
  assert.equal(audioBridge({}), null);
  // A bridge without the two calls this needs is not a bridge.
  assert.equal(audioBridge({ feedBackDesktop: { audio: { getLevels() {} } } }), null);
});
