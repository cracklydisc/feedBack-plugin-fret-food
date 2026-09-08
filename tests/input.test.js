/*
 * The two real sources, tested with no browser and no guitar.
 *
 * The keyboard is tested with a fake target: whoever brings the `keydown`
 * events comes in through `opts.target`, so no DOM is needed, and no human
 * either, which is the point: the rules that matter here (the debounce, the
 * key held down, the focus inside a text field) are all things that get tested
 * badly by hand and forgotten easily.
 *
 * The detector is tested with a fake SDK that fires the events on command,
 * because the real one needs a chart and a microphone: and why it does not
 * have them is written at the top of `detector.js`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPort } from '../src/input/port.js';
import { SHAPES, PRESSED } from '../src/menu.js';
import { createKeysAdapter, DEBOUNCE_MS, DIRTY_QUALITY } from '../src/input/keys.js';
import { createDetectorAdapter, chordOf, DEDUPE_MS } from '../src/input/detector.js';
import { createClock } from '../src/clock.js';

/** A fake `EventTarget`: it keeps its listeners and counts them, so you can
 *  ask whether `stop()` really did detach instead of taking its word. */
function fakeTarget() {
  const fns = new Set();
  return {
    activeElement: null,
    addEventListener(type, fn) { if (type === 'keydown') fns.add(fn); },
    removeEventListener(type, fn) { fns.delete(fn); },
    press(key, extra) {
      const e = Object.assign({ key, preventDefault() {} }, extra);
      for (const fn of [...fns]) fn(e);
      return e;
    },
    get count() { return fns.size; },
  };
}

function bench(opts) {
  const o = opts || {};
  const port = createPort('keyboard');
  const strums = [];
  const status = [];
  port.on('strum', (e) => strums.push(e));
  port.on('status', (e) => status.push(e));
  let t = 1000;
  const target = fakeTarget();
  const keys = createKeysAdapter(port, Object.assign({ target, now: () => t }, o));
  return {
    port, strums, status, target, keys,
    tick(ms) { t += ms; },
    get now() { return t; },
  };
}

// ── the keyboard ─────────────────────────────────────────────────────────

test('every key sends its own chord, and the capitals the two majors', () => {
  const b = bench();
  b.keys.start();
  const keymap = [
    ['c', {}, 'C'], ['d', {}, 'Dm'], ['e', {}, 'Em'], ['f', {}, 'F'],
    ['g', {}, 'G'], ['a', {}, 'Am'], ['b', {}, 'B7'],
    ['D', { shiftKey: true }, 'D'], ['E', { shiftKey: true }, 'E'],
    ['1', {}, 'A7'], ['2', {}, 'D7'], ['3', {}, 'E7'], ['4', {}, 'G7'],
    // The second axis: the open major on A, the barres on the capitals, and the
    // two flats on the spare digits.
    ['A', { shiftKey: true }, 'A'], ['B', { shiftKey: true }, 'Bm'],
    ['F', { shiftKey: true }, 'F#m'], ['C', { shiftKey: true }, 'C#m'],
    ['5', {}, 'Bb'], ['6', {}, 'Eb'],
  ];
  for (const [key, extra] of keymap) { b.tick(100); b.target.press(key, extra); }

  assert.deepEqual(b.strums.map((s) => s.chord), keymap.map((m) => m[2]));
  assert.ok(b.strums.every((s) => s.quality === 1), 'without Ctrl the strum is clean');
  assert.ok(b.strums.every((s) => s.source === 'keyboard'), 'the port stamps the source');
  // All thirteen shapes of the menu can be played: if somebody adds a chord
  // and gives it no key, this one falls.
  assert.equal(new Set(b.strums.map((s) => s.chord)).size, Object.keys(SHAPES).length);
});

test('Ctrl makes the strum dirty, and dirty is under the engine threshold', () => {
  const b = bench();
  b.keys.start();
  b.target.press('c', { ctrlKey: true });
  assert.equal(b.strums[0].chord, 'C');
  assert.equal(b.strums[0].quality, DIRTY_QUALITY);
  assert.ok(DIRTY_QUALITY < 0.8, 'the engine calls dirty everything that sits under 0.8');
});

test('x sends a strum nobody wants', () => {
  const b = bench();
  b.keys.start();
  b.target.press('x');
  assert.equal(b.strums.length, 1);
  assert.equal(b.strums[0].chord, null, 'chord null: the contract for a miss');
});

test('the bounce of a key is not a strum', () => {
  const b = bench();
  b.keys.start();
  b.target.press('c');
  b.tick(DEBOUNCE_MS - 1);
  b.target.press('c');
  assert.equal(b.strums.length, 1, 'two strums under the threshold are one');
  b.tick(2);
  b.target.press('c');
  assert.equal(b.strums.length, 2, 'past the threshold it plays again');
});

test('the debounce is per key, not per keyboard', () => {
  const b = bench();
  b.keys.start();
  b.target.press('c');
  b.target.press('g');
  assert.equal(b.strums.length, 2, 'two different keys at the same instant are two strums');
});

test('a key held down does not repeat', () => {
  const b = bench();
  b.keys.start();
  b.target.press('c', { repeat: true });
  assert.equal(b.strums.length, 0, 'e.repeat is not a strum');
});

test('with the focus in a text field the keyboard keeps quiet', () => {
  const b = bench();
  b.keys.start();
  for (const el of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'DIV', isContentEditable: true }]) {
    b.target.activeElement = el;
    b.tick(100);
    b.target.press('c');
  }
  assert.equal(b.strums.length, 0, 'somebody typing their name must not play half the menu');
  b.target.activeElement = null;
  b.tick(100);
  b.target.press('c');
  assert.equal(b.strums.length, 1, 'with the focus off the field it plays again');
});

test('stop() detaches everything, even after two start()', () => {
  const b = bench();
  b.keys.start();
  b.keys.start();
  assert.equal(b.target.count, 1, 'two start() do not leave two listeners');
  b.keys.stop();
  assert.equal(b.target.count, 0, 'stop() leaves none behind');
  b.target.press('c');
  assert.equal(b.strums.length, 0, 'and after stop() the keyboard says nothing more');
});

test('the keyboard says it is ready as soon as it starts', () => {
  const b = bench();
  b.keys.start();
  assert.equal(b.status[0].ready, true);
  assert.equal(b.status[0].source, 'keyboard');
  assert.equal(b.port.ready, true);
  b.keys.stop();
  assert.equal(b.port.ready, false);
});

test('zero switches the imperfect ear on and off', () => {
  // `rand` held fixed: at 0.99 no flaw with a probability fires, and only the
  // latency is left, which is the flaw we want to see and the only one that
  // can be measured without depending on chance. The timer is fake and
  // immediate, otherwise the test would really wait a tenth of a second.
  const b = bench({ rand: () => 0.99, later: (fn) => { fn(); return 0; } });
  b.keys.start();
  b.target.press('c');
  assert.equal(b.strums[0].at, b.now, 'with the perfect ear the strum arrives when the key goes down');

  b.tick(100);
  b.target.press('0');
  assert.equal(b.keys.flawed, true);
  b.tick(100);
  const pressed = b.now;
  b.target.press('c');
  assert.equal(b.strums.length, 2, 'zero is not a chord, but it does not switch the keys off');
  assert.equal(b.strums[1].chord, 'C');
  assert.ok(b.strums[1].at > pressed, 'with the flaws on the strum arrives late');

  b.tick(100);
  b.target.press('0');
  assert.equal(b.keys.flawed, false);
  b.tick(100);
  b.target.press('c');
  assert.equal(b.strums[2].at, b.now, 'switched off again, back to clean');
});

// ── the detector ─────────────────────────────────────────────────────────

/** A menu shape as note_detect sees it: strings from 0 = low E. */
const notesOf = (name) => Object.entries(PRESSED[name])
  .map(([string, f]) => ({ s: 6 - Number(string), f }));

function fakeSdk(opts) {
  const o = opts || {};
  const hs = {};
  let stopped = false;
  const handle = {
    on(ev, cb) { (hs[ev] = hs[ev] || []).push(cb); return handle; },
    stop() { stopped = true; },
    isRunning: () => (o.running === undefined ? true : o.running),
  };
  return {
    scoring: { createChord: () => handle },
    fire(ev, d) { for (const cb of hs[ev] || []) cb(d); },
    get stopped() { return stopped; },
  };
}

function detBench(opts) {
  const o = opts || {};
  const port = createPort('guitar');
  const strums = [];
  const status = [];
  port.on('strum', (e) => strums.push(e));
  port.on('status', (e) => status.push(e));
  let t = 10000;
  const sdk = o.sdk === undefined ? fakeSdk(o) : o.sdk;
  const det = createDetectorAdapter(port, {
    sdk,
    highway: o.highway === undefined ? { getNotes: () => [{ t: 0 }] } : o.highway,
    now: () => t,
  });
  return { port, strums, status, sdk, det, tick(ms) { t += ms; }, get now() { return t; } };
}

test('chordOf reads the neck shapes backwards and recognises them', () => {
  for (const name of Object.keys(PRESSED)) {
    assert.equal(chordOf(notesOf(name), [name]), name, name + ' has to come back as itself');
  }
});

test('chordOf ignores the open strings', () => {
  // A chart lists the open strings of the chord as well; the menu shapes do
  // not, because for the hand they are not a finger.
  const withOpen = notesOf('Em').concat([{ s: 0, f: 0 }, { s: 5, f: 0 }]);
  assert.equal(chordOf(withOpen, ['Em']), 'Em');
});

test('the triad accepts its own dominant, the seventh does not accept the triad', () => {
  assert.equal(chordOf(notesOf('G7'), ['G']), 'G', 'whoever plays G7 is playing G');
  assert.equal(chordOf(notesOf('G7'), ['G7', 'G']), 'G7', 'if somebody wants G7, it is G7');
  assert.equal(chordOf(notesOf('G'), ['G7']), 'G',
    'asking for G7 and hearing G gives back G, and nobody wants G');
});

test('chordOf does not guess', () => {
  assert.equal(chordOf([], ['C']), null, 'no notes, no chord');
  assert.equal(chordOf([{ s: 0, f: 9 }, { s: 1, f: 11 }], ['C']), null, 'stuff that is not a shape');
  assert.equal(chordOf([{ s: 4, f: 1 }], ['C', 'Am']), null,
    'one string alone sits inside two shapes: better to say no than to guess');
  assert.equal(chordOf([{ s: 1, f: 3 }, { s: 2, f: 2 }], ['C']), 'C',
    'but if one single shape contains it there is nothing to guess');
});

test('a taken hit becomes a strum with its own quality', () => {
  const b = detBench();
  b.det.start();
  const when = b.now;
  b.sdk.fire('hit', { notes: notesOf('C'), score: 0.75, timingError: 40, chord: true });
  assert.equal(b.strums.length, 1);
  assert.equal(b.strums[0].chord, 'C');
  assert.equal(b.strums[0].quality, 0.75);
  assert.equal(b.strums[0].at, when);
  assert.equal(b.strums[0].heardAt, when - 40, 'heard before the moment we know about it');
  assert.equal(b.strums[0].source, 'guitar');
});

test('with no score the quality is the strings taken over the total', () => {
  const b = detBench();
  b.det.start();
  b.sdk.fire('hit', { notes: notesOf('F'), hitStrings: 3, totalStrings: 4 });
  assert.equal(b.strums[0].quality, 0.75);
});

test('a miss with at least one string is a strum nobody wants, silence is not', () => {
  const b = detBench();
  b.det.start();
  b.sdk.fire('miss', { notes: notesOf('C'), hitStrings: 1, totalStrings: 3, score: 0.33 });
  assert.equal(b.strums.length, 1);
  assert.equal(b.strums[0].chord, null);

  b.tick(500);
  b.sdk.fire('miss', { notes: notesOf('C'), hitStrings: 0, totalStrings: 3, score: 0 });
  assert.equal(b.strums.length, 1, 'zero strings is silence, and silence is measured by the engine');
});

test('the same chord inside 80 ms is one single strum', () => {
  const b = detBench();
  b.det.start();
  b.sdk.fire('hit', { notes: notesOf('C'), score: 1 });
  b.tick(DEDUPE_MS - 1);
  b.sdk.fire('hit', { notes: notesOf('C'), score: 1 });
  assert.equal(b.strums.length, 1, 'the strings of a chord do not all start together');

  b.tick(2);
  b.sdk.fire('hit', { notes: notesOf('C'), score: 1 });
  assert.equal(b.strums.length, 2, 'past the 80 ms it is a new strum');

  b.tick(5);
  b.sdk.fire('hit', { notes: notesOf('Am'), score: 1 });
  assert.equal(b.strums.length, 3, 'a different chord goes through at once');
});

test('with no createChord the detector says so instead of pretending', () => {
  const b = detBench({ sdk: null });
  b.det.start();
  assert.equal(b.status.length, 1);
  assert.equal(b.status[0].ready, false);
  assert.equal(b.port.ready, false);
  assert.match(b.status[0].reason, /SDK/);
});

test('with note_detect not installed the detector says so', () => {
  const b = detBench({ running: false });
  b.det.start();
  assert.equal(b.status[0].ready, false);
  assert.match(b.status[0].reason, /note_detect/);
  b.sdk.fire('hit', { notes: notesOf('C'), score: 1 });
  assert.equal(b.strums.length, 0, 'a detector that never started does not speak');
});

test('with no chart the detector does not start and does not open the microphone', () => {
  const b = detBench({ highway: { getNotes: () => [], getChords: () => [] } });
  b.det.start();
  assert.equal(b.status[0].ready, false);
  assert.match(b.status[0].reason, /chart/);
  assert.equal(b.sdk.stopped, false, 'we did not even build it');
});

test('the end of the detector switches the badge off', () => {
  const b = detBench();
  b.det.start();
  assert.equal(b.port.ready, true);
  b.sdk.fire('end', { reason: 'stopped' });
  assert.equal(b.port.ready, false);
  assert.equal(b.status[1].reason, 'stopped');
  b.sdk.fire('hit', { notes: notesOf('C'), score: 1 });
  assert.equal(b.strums.length, 0, 'after the end nothing else arrives');
});

test('stop() stops the SDK handle too, which has no off()', () => {
  const b = detBench();
  b.det.start();
  b.det.stop();
  assert.equal(b.sdk.stopped, true);
  assert.equal(b.port.ready, false);
  b.sdk.fire('hit', { notes: notesOf('C'), score: 1 });
  assert.equal(b.strums.length, 0, 'the listeners stay attached: the guard is on the inside');
});

// ── the loop that must not stop ──────────────────────────────────────────

test('a fault in the game step does not stop the clock', () => {
  /* `raf(frame)` used to be the LAST statement in the loop, so anything that
   * threw out of a step or a frame took the whole clock with it. What that
   * looks like from the outside is the worst failure this file can have: the
   * scene keeps animating off its own timer while the game stands still at
   * whatever millisecond it reached, with nothing in the console to say why.
   *
   * (For the record, the freeze that sent me looking for this was not this:
   * it was a browser window behind another one, which stops `rAF` entirely and
   * pauses the game on purpose. The hole was real all the same.) */
  let pending = null;
  let t = 0;
  const clock = createClock({
    raf: (fn) => { pending = fn; return 1; },
    cancelRaf: () => { pending = null; },
    now: () => t,
  });
  const tick = (ms) => { t += ms; const fn = pending; pending = null; if (fn) fn(); };

  let steps = 0;
  let frames = 0;
  clock.start(() => { steps++; throw new Error('boom'); }, () => { frames++; });
  tick(0);
  for (let k = 0; k < 5; k++) tick(20);

  assert.ok(steps >= 10, 'the step should have been called every 10 ms, not once: ' + steps);
  assert.ok(frames >= 5, 'the frame callback should still be running');
  assert.equal(clock.running, true, 'the clock has to still be alive');
  const faults = clock.faults();
  assert.equal(faults.length, 1, 'one kind of fault, reported once and then counted');
  assert.ok(faults[0].n >= 10, 'and counted every time: ' + faults[0].n);
  assert.match(faults[0].key, /game step:boom/);
});

test('a fault in the drawing does not stop the game either', () => {
  let pending = null;
  let t = 0;
  const clock = createClock({
    raf: (fn) => { pending = fn; return 1; },
    cancelRaf: () => { pending = null; },
    now: () => t,
  });
  const tick = (ms) => { t += ms; const fn = pending; pending = null; if (fn) fn(); };
  let steps = 0;
  clock.start(() => { steps++; }, () => { throw new Error('the scene fell over'); });
  tick(0);
  for (let k = 0; k < 4; k++) tick(20);
  assert.ok(steps >= 8, 'the game must keep ticking while the drawing is broken');
  assert.match(clock.faults()[0].key, /frame:the scene fell over/);
});

test('a detector that never started does not announce a guitar unplugged', () => {
  /* The glue listens for `ready: false` and answers it by stopping this
   * adapter and switching to the keyboard. `stop()` used to answer with
   * another `ready: false` — "guitar unplugged" from a guitar that was never
   * heard — and the two answered each other until the stack gave out, leaving
   * a keyboard listener on `document` at every turn. Measured: one key, 2,264
   * strums. A stop after a failed start has nothing new to say. */
  const port = createPort('detector');
  const status = [];
  port.on('status', (e) => status.push(e));
  const det = createDetectorAdapter(port, { sdk: null });
  det.start();
  assert.equal(status.length, 1, 'a start with no SDK says so, once');
  assert.equal(status[0].ready, false);
  det.stop();
  assert.equal(status.length, 1, 'stop() answered a start that had already failed: ' + JSON.stringify(status));
});
