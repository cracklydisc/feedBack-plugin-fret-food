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
import {
  nameFrom, pitchesOf, TUNING, bestFit, frettedHits, createEngineAdapter, EARS, NEAR_SHAPES,
} from '../src/input/engine.js';
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
  const extra = nameFrom([45].concat(full));         // the A rang open instead of fretted
  assert.equal(extra.chord, 'C');
  assert.equal(extra.recall, 1);
  assert.ok(extra.precision < 1);
  // A partial of a string that IS in the shape is not a stranger.
  const partial = nameFrom(full.concat([48 + 12, 52 + 19]));
  assert.equal(partial.chord, 'C');
  assert.equal(partial.precision, 1, 'an octave and a twelfth above a played string are its own');
});

test('the string a shape tells you to mute is not a stranger when it rings', () => {
  /* The C, as a beginner actually plays it. `x32010` mutes the low E and a
   * thumb damps it about as often as not; a strummed low E is the loudest
   * string there is, so the detector reports it. It used to cost precision —
   * a clean C came back 0.87 — and a session with a guitar reported exactly
   * that chord, not confused with another, simply not heard. */
  const clean = nameFrom(pitchesOf('C'));
  const rings = nameFrom([40].concat(pitchesOf('C')));
  assert.equal(rings.chord, 'C');
  assert.equal(rings.fit, clean.fit, 'the low E ringing on a C costs nothing');
  assert.equal(rings.precision, 1);
  // Same for the other four shapes built on a muted string.
  for (const [chord, stray] of [['Am', 40], ['Dm', 45], ['D', 45], ['F', 40]]) {
    const got = nameFrom([stray].concat(pitchesOf(chord)));
    assert.equal(got.chord, chord, chord + ' lost itself to a string it asks you to mute');
    assert.equal(got.precision, 1);
  }
  // And it is forgiveness, not blindness: the shape still has to be there.
  assert.equal(nameFrom([40, 47, 52, 55, 59, 64]).chord, 'Em', 'six open strings are an Em, not a C');
});

test('when the pitches cannot separate two shapes, the counter says which', () => {
  /* Every tie in this vocabulary is the chord's third — Am without its C4 is
   * the pitches of an A — and the third sits on a thin string where a lazy
   * finger leaves it. Deciding those by the order the shapes are written in
   * always picked the same side. */
  const noThird = pitchesOf('Am').filter((p) => p !== 60);
  assert.equal(nameFrom(noThird, { wanted: ['A'] }).chord, 'A');
  assert.equal(nameFrom(noThird, { wanted: ['Am'] }).chord, 'Am');
  assert.equal(nameFrom(noThird, { wanted: ['G', 'Em'] }).chord, nameFrom(noThird).chord,
    'a counter that wants neither changes nothing');
  // What it must never do: talk the ear out of a chord it plainly heard.
  assert.equal(nameFrom(pitchesOf('C'), { wanted: ['Am'] }).chord, 'C');
  assert.equal(nameFrom(pitchesOf('Em'), { wanted: ['C', 'G'] }).chord, 'Em');
  assert.equal(nameFrom(pitchesOf('F+'), { wanted: ['F'] }).chord, 'F+');
});

test('a chord is not named on less than half of itself', () => {
  /* Two notes of an Am — the top two — are both in a C and nothing else was
   * in the air to argue, so the fit came out 0.57 and the kind ear called it
   * a C. Precision alone is not evidence: some of the SHAPE has to be there. */
  assert.equal(nameFrom(pitchesOf('Am').slice(3), { floor: 0 }), null);
  const twoLeft = nameFrom(pitchesOf('Am').slice(2), { floor: 0 });
  assert.equal(twoLeft.chord, 'Am', 'three of the five is still an Am');
  assert.equal(twoLeft.recall, 0.6);
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

/* ── the fallback road, on a scorer with no model behind it ─────────────── */

/** A shape the engine answered for: `hits` of its `total` strings confirmed. */
const conf = (chord, hits, total) => ({
  chord,
  result: { score: hits / total, hitStrings: hits, totalStrings: total, results: [] },
});

test('the smallest shape no longer wins on the strings every shape shares', () => {
  /* Straight off a session's overlay: A7 0.40, Em 0.33, G 0.33 — the SAME two
   * strings on all three. A7 led because two of five is 0.40 where two of six
   * is 0.33, which ranks the shapes by how many strings they have and not by
   * anything that was played. */
  const a7 = conf('A7', 2, 5);
  const g = conf('G', 2, 6);
  assert.equal(bestFit([a7, g], 0.28).chord, 'A7',
    'with nobody at the counter the ratio still breaks what the strings cannot');
  assert.equal(bestFit([a7, g], 0.28, ['G']).chord, 'G',
    'but a chord somebody ordered breaks it first');
  assert.equal(bestFit([g, a7], 0.28, ['G']).chord, 'G', 'whichever order they arrive in');
});

test('more strings confirmed beats the chord somebody ordered', () => {
  /* The counter is a tie-break and never a filter. If wanting a chord could
   * outrank the evidence, every strum would cook something and the game would
   * stop being about playing the right one. */
  assert.equal(bestFit([conf('Em', 5, 6), conf('C', 2, 5)], 0.28, ['C']).chord, 'Em');
});

test('two strings is not one, and one string is not a chord', () => {
  assert.equal(bestFit([conf('C', 1, 5)], 0.15, ['C']), null,
    'one string clears a low floor and is still nothing');
  assert.equal(bestFit([conf('C', 2, 5)], 0.15, ['C']).chord, 'C');
  // A build that reports no per-string count is judged the old way, on the ratio.
  assert.equal(bestFit([{ chord: 'C', result: { score: 0.9 } }], 0.28, ['C']).chord, 'C');
});

test('the scorer with no model behind it is read against its own floor', () => {
  /* Chords the player called clean came back at 0.40, 0.33, 0.33 and 0.17 on
   * the band scorer — the best of them under the 0.42 that the model-backed
   * scorer calls "nothing was played". Two scorers, two floors. */
  for (const name of ['easy', 'medium', 'hard']) {
    const e = EARS[name];
    assert.ok(e.dsp > 0 && e.dsp < e.floor,
      name + ' needs a floor for the scorer that confirms one or two strings');
  }
  assert.ok(EARS.easy.dsp < EARS.medium.dsp && EARS.medium.dsp < EARS.hard.dsp,
    'and the three grades still get harder in the same order');
});

test('a chord only the band scorer heard still cooks, and the plate names it', async () => {
  /* 0.34 is two of C's five strings, which is what a clean C came back as on
   * the machine with no model loaded. Against the single old floor of 0.42 it
   * was nothing at all, and nine strums of twenty-two cooked nothing. */
  const b = bench({ ml: false, candidates: ['C'], scores: { C: 0.34 } });
  b.adapter.start();
  await b.play('C');
  assert.equal(b.adapter.stats.road, 'shapes');
  assert.equal(b.adapter.stats.why, 'ml off');
  assert.equal(b.strums.length, 1, 'the kitchen heard it');
  assert.equal(b.strums[0].chord, 'C');
});

test('the chord the counter wants is on the plate however badly it ranked', async () => {
  /* The overlay used to show the four best scores, which are the wrong four:
   * the shape somebody ordered can rank fifth, never appear, and leave the
   * log silent about the only comparison anybody reads it for. */
  const loud = [...new Set(NEAR_SHAPES.C.concat(NEAR_SHAPES.G))].filter((c) => c !== 'C' && c !== 'G');
  assert.ok(loud.length >= 4, 'C and G have neighbours enough to be outranked by');
  const scores = { C: 0.34, G: 0.34 };
  for (const n of loud) scores[n] = 0.95;
  const b = bench({ ml: false, candidates: ['C', 'G'], scores });
  b.adapter.start();
  await b.play('C');
  const rows = b.adapter.stats.last[0].air;
  assert.equal(rows.length, 4, 'the plate still holds four rows and no more');
  assert.ok(rows[0].startsWith('C*') && rows[1].startsWith('G*'),
    'both wanted chords lead the rows, however they scored: ' + JSON.stringify(rows));
  assert.match(rows[0], /^C\* 2\/5 0\.34$/,
    'and a row says the strings confirmed, which is what bestFit ranks on');
  assert.ok(rows.slice(2).every((r) => !r.includes('*')), 'only the wanted ones are starred');
});

/* ── the adapter, on a bridge with no clock ─────────────────────────────── */

/** A desktop bridge whose level and ringing notes the test decides. */
function fakeBridge(o) {
  const opt = o || {};
  const b = {
    level: 0,
    air: [],
    strike: 0,
    asked: [],
    /* The engine's ML pipeline, which the real one leaves suspended until a
     * consumer asks. `gate: true` gives this bridge the ask, and then it
     * answers about ML the way the desktop build does: only once armed. */
    armed: false,
    gateCalls: [],
    calls: { detectNotes: 0, scoreChord: 0 },
    async setNoteDetectionEnabled(on) { this.gateCalls.push(!!on); this.armed = !!on; },
    async getLevels() { return { inputLevel: this.level }; },
    async isMlNoteDetection() {
      if (opt.ml === 'unknown') throw new Error('too old to be asked');
      if (opt.gate) return this.armed && opt.ml !== false;
      return opt.ml !== false;
    },
    async detectNotes() {
      this.calls.detectNotes++;
      // `onsetSeq` counts how many times THAT pitch has been struck. The
      // bench bumps `strike` when the hand plays, which is what the adapter
      // reads to know a chord was struck anew.
      return { notes: this.air.map((midi) => ({ midi, confidence: 0.9, onsetMs: 0, onsetSeq: this.strike })) };
    },
    async scoreChord(req) {
      this.calls.scoreChord++;
      this.asked.push(req);
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
  // A host too old for the bridge method simply does not have it.
  if (!opt.gate) delete b.setNoteDetectionEnabled;
  return b;
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
    gateStore: opt.gateStore || {},
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
    /** A strum of `chord`, `gap` ms after the last one: the hand puts those
     *  pitches in the air and strikes them, and the level rises. */
    async play(chord, gap) {
      bridge.air = chord ? pitchesOf(chord) : [];
      bridge.strike++;
      await this.poll(0.02, (gap === undefined ? 500 : gap) - 16);
      await this.poll(0.6, 16);
    },
    /** The same, played so quietly that the level never rises: only the
     *  notes' own onsets can notice it. */
    async quietly(chord, gap) {
      bridge.air = chord ? pitchesOf(chord) : [];
      bridge.strike++;
      await this.poll(0.02, (gap === undefined ? 500 : gap) - 16);
      await this.poll(0.02, 16);
      await this.poll(0.02, 48);
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
  /* Three strings of a five-string C fit it 0.75 and every grade takes it: a
   * chord missing a string is still that chord, whoever is listening. Two of
   * the five is under `MIN_RECALL` and no grade takes it — a chord is not
   * named on less than half of itself. What the grades really move is the
   * middle ground, so this is measured on a shape with more strings: four of
   * a six-string Em fits 0.67, which the kind ear takes and the strict one
   * does not. */
  const three = pitchesOf('C').slice(0, 3);
  for (const grade of ['easy', 'medium', 'hard']) {
    assert.equal(nameFrom(three, { floor: EARS[grade].fit }).chord, 'C', grade + ' should hear three strings of a C');
  }
  /* Half an Em with something ringing that is not in it — three of its six
   * strings and a stray D# — fits 0.60: the kind and middle ears take that
   * and the strict one does not. */
  const rough = pitchesOf('Em').slice(0, 3).concat([63]);
  assert.equal(nameFrom(rough, { floor: EARS.easy.fit }).chord, 'Em');
  assert.equal(nameFrom(rough, { floor: EARS.medium.fit }).chord, 'Em');
  assert.equal(nameFrom(rough, { floor: EARS.hard.fit }), null, 'the strict ear will not have it');
  assert.equal(nameFrom(pitchesOf('C').slice(0, 2), { floor: 0 }), null,
    'and two strings of five are not a chord at any grade: see MIN_RECALL');
});

test('one gesture is one hearing', () => {
  /* The notes' own onsets were tried as a second trigger and taken back out:
   * one pitch struck anew is one STRING, so a single sweep fired several
   * times and every extra hearing was another chance to name something
   * wrong. A whole-chord attack is what a strum is. */
  return (async () => {
    const b = bench({ candidates: ['C'] });
    b.adapter.start();
    await b.poll(0.01);
    await b.poll(0.01);
    await b.play('C');
    assert.equal(b.strums.length, 1);
    assert.equal(b.adapter.stats.onsets, 1, 'one gesture, one onset');
  })();
});

test('a chord left ringing when the service opens is not a strum', () => {
  return (async () => {
    const b = bench({ candidates: ['C'] });
    b.bridge.air = pitchesOf('C');
    b.adapter.start();
    for (let k = 0; k < 6; k++) await b.poll(0.01, 48);
    assert.equal(b.strums.length, 0, 'a level that never rises is nobody playing');
  })();
});

test('with the engine s model loaded, the chord is scored the way the app scores a chord', () => {
  /* `scoreChord` has two scorers behind it: with the Basic Pitch model
   * loaded it judges each note against the ML detector's active pitch set,
   * and without it a constraint scorer over spectral bands that `notedetect`
   * itself documents as false-positiving on a neighbour's bleed. We forced
   * the second one on every call, copied from a game that asks about one
   * shape. `notedetect` sends that flag for single notes and NOT for chords,
   * and a chord is what this game asks about. */
  return (async () => {
    const withMl = bench({ ml: true, candidates: ['C'], scores: { C: 0.9 } });
    // No detectNotes on this build, so it is the shapes road with the model behind it.
    withMl.bridge.detectNotes = undefined;
    withMl.adapter.start();
    await withMl.poll(0.01);
    await withMl.poll(0.01);
    await withMl.poll(0.6);
    assert.equal(withMl.adapter.stats.road, 'shapes');
    assert.ok(withMl.bridge.asked.length > 0, 'it asked the engine about some shapes');
    for (const req of withMl.bridge.asked) {
      assert.equal(req.bypassMl, undefined, 'the ML scorer must not be bypassed when there is one');
      assert.equal(req.harmonicVerify, undefined);
      assert.ok(Number.isFinite(req.pitchCheckCents), 'the ear still rides along');
    }

    const noMl = bench({ ml: false, candidates: ['C'], scores: { C: 0.9 } });
    noMl.adapter.start();
    await noMl.poll(0.01);
    await noMl.poll(0.01);
    await noMl.poll(0.6);
    assert.ok(noMl.bridge.asked.length > 0);
    for (const req of noMl.bridge.asked) {
      assert.equal(req.bypassMl, true, 'with no model there is nothing to choose, and the comb hears a strum');
      assert.equal(req.harmonicVerify, true);
    }
  })();
});

/* ── arming the engine's ML detector ────────────────────────────── */

test('the pipeline is asked for at the door and given back at closing', async () => {
  /* Basic Pitch is loaded at startup and left SUSPENDED — it is the most
   * expensive thing in the audio engine, so nothing runs inference until a
   * consumer asks. This game read the suspended state as "no model here" and
   * settled for the band scorer on a machine that had the model. */
  const b = bench({ gate: true, candidates: ['C'] });
  assert.equal(b.bridge.armed, false, 'nothing is armed before the service opens');
  b.adapter.start();
  await b.poll(0.01);
  assert.equal(b.bridge.armed, true, 'the kitchen asked');
  await b.poll(0.01);
  await b.poll(0.6);
  assert.equal(b.adapter.stats.road, 'notes', 'and now the notes road is open');
  assert.equal(b.adapter.stats.why, '');
  b.adapter.stop();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(b.bridge.armed, false, 'an idle kitchen runs no inference');
  assert.deepEqual(b.bridge.gateCalls, [true, false], 'and it is asked once each way');
});

test('a host that cannot be asked reads differently from one that said no', () => {
  return (async () => {
    /* Two different problems with two different fixes, and they used to read
     * the same on the plate: an older host with no bridge method needs a new
     * build, where a host that was asked and stayed off has a model that did
     * not load. */
    const old = bench({ ml: false, candidates: ['C'] });
    old.adapter.start();
    await old.poll(0.01);
    await old.poll(0.01);
    await old.poll(0.6);
    assert.equal(old.bridge.setNoteDetectionEnabled, undefined);
    assert.equal(old.adapter.stats.why, 'ml off');

    const said = bench({ gate: true, ml: false, candidates: ['C'] });
    said.adapter.start();
    await said.poll(0.01);
    await said.poll(0.01);
    await said.poll(0.6);
    assert.deepEqual(said.bridge.gateCalls, [true], 'it was asked');
    assert.equal(said.adapter.stats.why, 'ml asked, still off');
    assert.equal(said.adapter.stats.road, 'shapes');
  })();
});

test('one consumer closing does not suspend the pipeline another is reading', async () => {
  /* The count is the whole app's, not ours — notedetect keeps it in
   * `window.__ndShared.mlGateWanters` for exactly this. A minigame that
   * disarmed on its way out would take the detector away from whoever else
   * was still on it. */
  const page = {};
  const mine = bench({ gate: true, gateStore: page, candidates: ['C'] });
  const theirs = createEngineAdapter(createPort('other'), {
    audio: mine.bridge,
    gateStore: page,
    now: () => 0,
    wait: () => Promise.resolve(),
    schedule: () => 1,
    unschedule: () => {},
  });
  mine.adapter.start();
  theirs.start();
  await mine.poll(0.01);
  assert.equal(mine.bridge.armed, true);
  theirs.stop();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(mine.bridge.armed, true, 'we are still reading it');
  mine.adapter.stop();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(mine.bridge.armed, false, 'and the last one out gives it back');
});

test('the overlay says which road and why it is not the other one', () => {
  return (async () => {
    const no = bench({ candidates: ['C'] });
    no.bridge.detectNotes = undefined;
    no.adapter.start();
    await no.poll(0.01);
    await no.poll(0.01);
    await no.poll(0.6);
    assert.equal(no.adapter.stats.road, 'shapes');
    assert.match(no.adapter.stats.why, /detectnotes/);

    const off = bench({ ml: false, candidates: ['C'] });
    off.adapter.start();
    await off.poll(0.01);
    await off.poll(0.01);
    await off.poll(0.6);
    assert.equal(off.adapter.stats.road, 'shapes');
    assert.equal(off.adapter.stats.why, 'ml off');

    const good = bench({ candidates: ['C'] });
    good.adapter.start();
    await good.poll(0.01);
    await good.poll(0.01);
    await good.poll(0.6);
    assert.equal(good.adapter.stats.road, 'notes');
    assert.equal(good.adapter.stats.why, '');
  })();
});
