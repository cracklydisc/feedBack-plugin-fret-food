/*
 * NAMING THE CHORD, which is this game's one pillar.
 *
 * A drill about chord changes that hears the wrong chord is not a hard game,
 * it is a broken one, and two sessions with a guitar reported the same thing:
 * "suono lo stesso accordo a ripetizione e sblocco accordi diversi". The road
 * that produced it asked the engine how much of each WANTED shape rang and
 * took the best, so a chord nobody wants could only ever come back as one of
 * the chords somebody did, and an open string — which rings on almost
 * anything played in first position — counted as evidence.
 *
 * The road that replaces it asks the engine's polyphonic detector what is
 * actually ringing and names it against the whole vocabulary. These are the
 * tests of that: the arithmetic on its own, and then the adapter driven by a
 * fake bridge with no clock and no timers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameFrom, pitchesOf, TUNING, bestFit, frettedHits, createEngineAdapter, EARS } from '../src/input/engine.js';
import { createPort } from '../src/input/port.js';
import { SHAPES, CHORDS, label } from '../src/menu.js';

/* ── the arithmetic ─────────────────────────────────────────────────────── */

test('a shape is the pitches it puts in the air, in the engine s own tuning', () => {
  assert.deepEqual(TUNING, [40, 45, 50, 55, 59, 64], 'standard tuning, low E first, as MIDI');
  // C is x32010: the muted low E is not in the air at all.
  assert.deepEqual(pitchesOf('C'), [48, 52, 55, 60, 64]);
  assert.deepEqual(pitchesOf('Em'), [40, 47, 52, 55, 59, 64]);
  assert.equal(pitchesOf('nonsense'), null);
});

test('every shape in the game names itself, and nothing else does', () => {
  for (const chord of CHORDS) {
    const best = nameFrom(pitchesOf(chord));
    assert.ok(best, label(chord) + ' (' + chord + ') was not named at all');
    assert.equal(best.chord, chord, chord + ' came back as ' + best.chord);
    assert.equal(best.fit, 1, chord + ' should fit itself exactly');
  }
});

test('one shape inside another is told apart by what is NOT ringing', () => {
  /* The pair this has to get right. The small F is the barre F without its
   * two lowest strings, and those two are an octave below two of the four
   * that remain — so anything that forgives an octave hears the whole barre
   * in a hand playing the little shape. G/B is G without its lowest string. */
  assert.equal(nameFrom(pitchesOf('F')).chord, 'F');
  assert.equal(nameFrom(pitchesOf('F+')).chord, 'F+');
  assert.equal(nameFrom(pitchesOf('G/B')).chord, 'G/B');
  assert.equal(nameFrom(pitchesOf('G')).chord, 'G');
});

test('the one pitch that differs decides, not the four that do not', () => {
  // C and Am share four of their five pitches: C has C3 where Am has the open A.
  const c = nameFrom(pitchesOf('C'), { only: ['C', 'Am'] });
  assert.equal(c.chord, 'C');
  const am = nameFrom(pitchesOf('Am'), { only: ['C', 'Am'] });
  assert.equal(am.chord, 'Am');
  // And the margin is real, not a rounding: the wrong one is well under the floor.
  const wrong = nameFrom(pitchesOf('C'), { only: ['Am'] });
  assert.ok(wrong.fit < 0.85, 'Am should fit a played C poorly: ' + wrong.fit);
});

test('a string that did not ring costs recall; a string nobody played costs precision', () => {
  const full = pitchesOf('C');
  const muted = nameFrom(full.slice(0, 4));          // the high E did not sound
  assert.equal(muted.chord, 'C');
  assert.equal(muted.recall, 0.8);
  assert.equal(muted.precision, 1);
  const extra = nameFrom([40].concat(full));         // the low E rang anyway
  assert.equal(extra.chord, 'C');
  assert.equal(extra.recall, 1);
  assert.ok(extra.precision < 1);
  // A partial of a string that IS in the shape is not a stranger.
  const partial = nameFrom(full.concat([48 + 12, 52 + 19]));
  assert.equal(partial.chord, 'C');
  assert.equal(partial.precision, 1, 'an octave and a twelfth above a played string are its own');
});

test('nothing in the air, or nothing that fits, is named nothing', () => {
  assert.equal(nameFrom([]), null);
  assert.equal(nameFrom(null), null);
  assert.equal(nameFrom([41, 43, 46]), null, 'three semitones in a row are not a chord of this game');
  assert.equal(nameFrom(pitchesOf('C'), { floor: 1.01 }), null, 'a floor nothing can clear names nothing');
});

/* ── the fallback road's tie ────────────────────────────────────────────── */

test('a tied score goes to the shape with more fretted strings behind it', () => {
  /* Two candidates that scored the same used to be decided by whichever the
   * counter listed first. An open string rings on almost anything played in
   * first position, so what is left of a tie is the fretted strings. */
  const em = { chord: 'Em', result: { score: 0.8, hitStrings: 4, results: [
    { s: 0, f: 0, hit: true }, { s: 1, f: 2, hit: false }, { s: 2, f: 2, hit: false },
    { s: 3, f: 0, hit: true }, { s: 4, f: 0, hit: true }, { s: 5, f: 0, hit: true }] } };
  const c = { chord: 'C', result: { score: 0.8, hitStrings: 4, results: [
    { s: 1, f: 3, hit: true }, { s: 2, f: 2, hit: true }, { s: 3, f: 0, hit: true },
    { s: 4, f: 1, hit: true }, { s: 5, f: 0, hit: false }] } };
  assert.equal(frettedHits('Em', em.result), 0, 'Em scored its ratio on open strings alone');
  assert.equal(frettedHits('C', c.result), 3);
  assert.equal(bestFit([em, c], 0.4).chord, 'C');
  assert.equal(bestFit([c, em], 0.4).chord, 'C', 'and the order the counter lists them in does not matter');
});

/* ── the adapter, on a bridge with no clock ─────────────────────────────── */

/** A desktop bridge whose level and ringing notes the test decides. */
function fakeBridge(o) {
  const opt = o || {};
  return {
    level: 0,
    air: [],
    calls: { detectNotes: 0, scoreChord: 0 },
    async getLevels() { return { inputLevel: this.level }; },
    async isMlNoteDetection() { return opt.ml !== false; },
    async detectNotes() {
      this.calls.detectNotes++;
      return { notes: this.air.map((midi, k) => ({ midi, confidence: 0.9, onsetMs: 0, onsetSeq: k })) };
    },
    async scoreChord(req) {
      this.calls.scoreChord++;
      const sig = req.notes.map((n) => n.s + ':' + n.f).join(',');
      const name = Object.keys(SHAPES).find((c) => {
        const s = SHAPES[c];
        const notes = [];
        s.frets.forEach((f, i) => { if (f >= 0) notes.push(i + ':' + f); });
        return notes.join(',') === sig;
      });
      const score = (opt.scores && opt.scores[name] !== undefined) ? opt.scores[name] : 0;
      const total = req.notes.length;
      return { isHit: score >= 0.5, score, hitStrings: Math.round(score * total), totalStrings: total, results: [] };
    },
  };
}

function bench(o) {
  const opt = o || {};
  const bridge = fakeBridge(opt);
  const port = createPort('detector');
  const strums = [];
  port.on('strum', (e) => strums.push(e));
  port.setCandidates(opt.candidates || ['C']);
  let t = 0;
  let pending = null;
  const settles = [];
  const adapter = createEngineAdapter(port, {
    audio: bridge,
    ear: opt.ear || 'medium',
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
      for (let k = 0; k < 10; k++) {
        while (settles.length) settles.pop()();
        await Promise.resolve();
      }
    },
    /** A strum of `chord`, `gap` ms after the last one. */
    async play(chord, gap) {
      bridge.air = chord ? pitchesOf(chord) : [];
      await this.poll(0.02, (gap === undefined ? 500 : gap) - 16);
      await this.poll(0.6, 16);
    },
  };
}

test('the notes road names what was played, whatever the counter wants', async () => {
  const b = bench({ candidates: ['Am', 'G'] });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  // A C, while the counter wants Am and G. The shape road had to answer with
  // one of those two; this one answers "a C", which nobody ordered.
  await b.play('C');
  assert.equal(b.strums.length, 0, 'a C is not an Am');
  assert.equal(b.adapter.stats.unknown, 1);
  assert.equal(b.adapter.stats.road, 'notes');
  // And the Am the counter does want is heard.
  await b.play('Am');
  assert.equal(b.strums.length, 1);
  assert.equal(b.strums[0].chord, 'Am');
});

test('the same chord over and over is one chord, however the counter moves', async () => {
  /* The session's own words. The pot that wanted C moves on the moment it
   * cooks, so every strum after the first is judged against a counter that
   * wants something else. */
  const b = bench({ candidates: ['C', 'G'] });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.play('C');
  assert.deepEqual(b.strums.map((s) => s.chord), ['C']);
  b.port.setCandidates(['Am', 'G']);          // the pot advanced
  for (let k = 0; k < 6; k++) await b.play('C', 400);
  assert.deepEqual(b.strums.map((s) => s.chord), ['C'], 'six more strums of the same C cooked nothing else');
  assert.equal(b.adapter.stats.ring, 6, 'and they are counted as the hand still there');
  // The hand really moves, onto something the counter wants.
  await b.play('G', 500);
  assert.deepEqual(b.strums.map((s) => s.chord), ['C', 'G']);
});

test('the quality is how much of the chord rang, so half a chord is dirty', async () => {
  const b = bench({ candidates: ['C'] });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.play('C');
  assert.equal(b.strums[0].quality, 1);
  // Two strings of the five did not sound.
  b.bridge.air = pitchesOf('C').slice(0, 3);
  await b.poll(0.02, 484);
  await b.poll(0.6, 16);
  assert.equal(b.strums.length, 2);
  assert.ok(b.strums[1].quality < 0.8, 'a chord that half rang is a dirty strum: ' + b.strums[1].quality);
});

test('a build with no ML detector falls back to the shape scorer', async () => {
  const b = bench({ ml: false, candidates: ['C'], scores: { C: 0.9, Am: 0.4 } });
  b.adapter.start();
  await b.poll(0.01);
  await b.poll(0.01);
  await b.poll(0.6);
  assert.equal(b.adapter.stats.road, 'shapes');
  assert.equal(b.bridge.calls.detectNotes, 0, 'a monophonic detector is not asked to name a chord');
  assert.ok(b.bridge.calls.scoreChord > 0);
  assert.deepEqual(b.strums.map((s) => s.chord), ['C']);
});

test('the strict ear asks for more agreement than the kind one', async () => {
  assert.ok(EARS.hard.fit > EARS.medium.fit && EARS.medium.fit > EARS.easy.fit);
  assert.ok(EARS.hard.conf > EARS.medium.conf && EARS.medium.conf > EARS.easy.conf);
  /* Two strings of a five-string C fit it 0.57: the kind ear takes that and
   * calls it a C, the middle one and the strict one hear nothing. Three of
   * the five fit 0.75 and every grade takes it — a chord missing one string
   * is still that chord, whoever is listening. */
  const two = pitchesOf('C').slice(0, 2);
  assert.ok(nameFrom(two, { floor: EARS.easy.fit }), 'the kind ear takes two strings of a C');
  assert.equal(nameFrom(two, { floor: EARS.medium.fit }), null, 'the middle one does not');
  assert.equal(nameFrom(two, { floor: EARS.hard.fit }), null, 'nor the strict one');
  const three = pitchesOf('C').slice(0, 3);
  for (const grade of ['easy', 'medium', 'hard']) {
    assert.equal(nameFrom(three, { floor: EARS[grade].fit }).chord, 'C', grade + ' should hear three strings of a C');
  }
});
