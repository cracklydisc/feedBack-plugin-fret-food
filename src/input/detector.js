/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE SDK's CHORD DETECTOR, and why it is not the road that works.
 *
 * ── READ `engine.js` FIRST ──────────────────────────────────────────────
 *
 * Everything below is true and it is no longer the answer. The guitar works,
 * through `window.feedBackDesktop.audio.scoreChord()` — the desktop build's
 * native engine, which scores a chord shape against the live audio with no
 * chart and no song. `engine.js` is the adapter and it is what the game uses.
 *
 * This file stays because the reasoning in it is the map of a dead end, and
 * the day the SDK grows chart-free chord scoring it is the adapter that road
 * needs. What it got wrong was not any of the three findings: it was assuming
 * the SDK was the only door. Strum Fighter had been going round it all along.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This file does two things. The first is the adapter: it takes what the
 * minigames SDK sends and translates it into the contract of `port.js`. The
 * second is a report, and it sits here instead of in a document of its own
 * because the day the app changes, whoever touches this file has to read it.
 *
 * ── WHAT IS REALLY IN THE APP ───────────────────────────────────────────
 *
 * `sdk.scoring.createChord(opts)` is not a chord detector. It is a
 * re-emitter: `plugins/minigames/screen.js:947` hands it to
 * `_wrapNoteDetector` (same file, line ~368), which calls
 * `window.createNoteDetector` and does nothing more than pass the DOM events
 * `notedetect:hit` / `notedetect:miss` on to its listeners. The comment above
 * that function says so itself: the minigames that use it "must run alongside
 * a chart", and the case with no chart is "out of scope".
 *
 * This is not pessimism, it is how `createNoteDetector` is built
 * (`plugins/notedetect/screen.js:2449`): it takes the notes to judge from the
 * highway (`hw.getFilteredNotes()` / `getNotes()`), and `matchNotes()` (line
 * 6009) judges them AGAINST THE TIMEKEEPER: `t = hw.getTime() + avOffset -
 * latencyOffset`, and a note counts as taken only when `timingState === 'OK'`,
 * that is, inside its own window (150 ms for chords). Outside the window the
 * note is not ignored: it is CALLED BACK as `notedetect:miss`. There is no
 * "tell me what was played" mode: there is only "did they play what was
 * written, at the right moment?".
 *
 * ── THE TWO ROADS THAT WERE TRIED ───────────────────────────────────────
 *
 * (a) MANUFACTURE A SYNTHETIC CHART out of `port.candidates`. It can be
 *     started: `_wrapNoteDetector` passes its `opts` through untouched to
 *     `createNoteDetector`, and that one accepts `opts.highway`, so a fake
 *     highway running on our clock slides in without touching the app. It
 *     falls over right after, and not on a detail:
 *       - Fret Food has no moment at which to play. A chart does, it is made of
 *         instants. To keep N chords playable "right now" a grid of notes has
 *         to be laid down for each of them; every square left unplayed is
 *         called back as a miss, so with 4 stations you take 3 misses every
 *         time you play the right thing, and a burst of them when you keep
 *         quiet: and silence, in Fret Food, is half the game.
 *       - The windows are +-150 ms: squares closer together than 300 ms get
 *         the same strum judged twice, squares further apart leave holes where
 *         the strum is not judged at all. There is no spacing that gives one
 *         strum = one event.
 *       - The fake highway has to be filled by hand with undocumented things:
 *         `getTime getAvOffset getSongInfo getNotes getChords getFilteredNotes
 *         getFilteredChords getBeats getBPM getSections getMastery
 *         hasPhraseData getStringCount setNoteStateProvider
 *         getNoteStateProvider removeDrawHook project fretX isDefaultRenderer`
 *         (every one of them dug out by hand inside `notedetect/screen.js`).
 *         None of them is a contract towards the plugins, and the first one to
 *         change switches us off.
 *     Conclusion: it can be built, but it turns a free strumming game into a
 *     rhythm game on a chart we made up ourselves. It does not hold.
 *
 * (b) GO THROUGH `sdk.scoring.createContinuous`. This one needs no chart at
 *     all (it opens the microphone by itself, `minigames/screen.js:100`) but
 *     it emits `pitch` with ONE frequency: inside it there is YIN, which is a
 *     MONOPHONIC detector, plus a moving average over the log of the
 *     frequency. A chord cannot be pulled out of a single fundamental: C and
 *     Am played on the same guitar give the same row of numbers. Recognising a
 *     chord from there means writing a polyphonic analyser in house, which is
 *     to say not using the SDK. It does not hold.
 *
 * ── THE THIRD ROAD, FOUND BY READING, AND WHY NOT THAT ONE EITHER ───────
 *
 * `createNoteDetector` exposes `setVerifyTarget(notes, ctx)`
 * (`notedetect/screen.js:18153`), and it is exactly what would be needed here:
 * with NO timekeeper, it judges a set of `{s, f}` chosen by us against the
 * live audio on every frame, it accepts an explicit tuning (`openMidis`) so no
 * song has to be loaded, and it emits
 * `notedetect:verify { isHit, score, hitStrings, totalStrings, notes }`
 * (line 5999). It is reachable from the SDK too, because `_wrapNoteDetector`
 * gives back the real instance under `handle.noteDetector`.
 *
 * Three things make it useless for Fret Food all the same:
 *   1. it is a LEVEL, not an ATTACK: it fires on every frame for as long as
 *      the chord rings. Fret Food is made of "strum, strum, silence": a held
 *      chord would become one long hammering and the rest would never fire.
 *   2. the target is ONE ONLY (`_verifyTarget` is a single array). Fret Food has
 *      three to five of them at a time, and asking "is THIS one playing?" in
 *      turn means listening to each chord one frame in five.
 *   3. the threshold is fixed at half the strings (`_ND_VERIFY_MIN_HIT_RATIO =
 *      0.5`, line 432). Our shapes have two or three fingers, so one right
 *      string is enough: C and Am, which share two fingers out of three, both
 *      verify.
 *
 * The third one is the one that ends it, and it took reading the dispatch to
 * see how completely. The event's `notes` field is `target.map(n => ({s, f}))`
 * (`notedetect/screen.js:6004`): it ECHOES BACK THE TARGET WE ASKED ABOUT. So
 * there is no route where we take the per-string detail as a raw sensor and do
 * the naming ourselves with our own `chordOf` — the only thing the host will
 * tell us is whether the shape we named rang half its strings. A judge that
 * cannot tell C from Am cannot drive a game whose whole subject is which chord
 * you played.
 *
 * ── SO ──────────────────────────────────────────────────────────────────
 *
 * No road holds without putting hands on the app's code, which is not ours.
 * The adapter stays written in full and written right: the day the
 * "scoring-core" extraction mentioned in `minigames/screen.js:366` arrives, or
 * when Fret Food runs alongside a loaded song, it works without a line changing.
 * But when it cannot work IT SAYS SO: `status` with `ready: false` and the
 * reason, before the microphone is even opened. That way the game starts all
 * the same with the keyboard or with the script, and the badge tells the truth
 * instead of promising a guitar that hears nothing.
 *
 * ── THE STRINGS, WHICH ARE COUNTED BACKWARDS ────────────────────────────
 *
 * `notedetect` numbers the strings from 0 = low E (`_ND_TUNING_GUITAR_6 =
 * [40, 45, 50, 55, 59, 64]`, line 460); `menu.js` numbers them from 6 = low E.
 * Hence the `6 - s`, and it is the kind of mistake that never shows up in a
 * log: the shapes match all the same, only mirrored.
 */

import { PRESSED as SHAPES } from '../menu.js';

/** The same chord heard twice 80 ms apart is one single strum: the strings of
 *  a chord do not all start together, and the judgement can arrive both under
 *  the chord's key and under a string's. */
export const DEDUPE_MS = 80;

/** From note_detect's `[{s, f}]` to the shape of `menu.js`. The open strings
 *  are not in there: they do not appear in the menu shapes, because for the
 *  hand they are not a finger. Keeping them would mean never recognising an
 *  Em. */
function shapeOf(notes) {
  const shape = {};
  for (const n of notes || []) {
    if (!n || !Number.isInteger(n.s) || !n.f) continue;
    const string = 6 - n.s;
    if (string < 1 || string > 6) continue;
    shape[string] = n.f;
  }
  return shape;
}

const sameShape = (a, b) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};
const inside = (a, b) => Object.keys(a).every((k) => b[k] === a[k]);

/**
 * Which chord we heard.
 *
 * `candidates` are the chords somebody wants right now, and they are there for
 * one rule only: THE TRIAD ACCEPTS ITS OWN DOMINANT. Whoever plays G7 while
 * the dish asks for G is playing G: they added a note, they did not get one
 * wrong. The other way round, no: whoever asks for G7 and hears G gets `G`,
 * and nobody wants `G`, so the engine counts it as a miss on its own, with no
 * special case in here.
 *
 * Outside a chord it knows it gives back `null`, which in the contract is
 * "something was heard that is not a chord of this game".
 */
export function chordOf(notes, candidates) {
  const heard = shapeOf(notes);
  if (!Object.keys(heard).length) return null;

  let name = null;
  for (const c of Object.keys(SHAPES)) if (sameShape(heard, SHAPES[c])) { name = c; break; }
  if (!name) {
    /* One voice can go missing: the detector reports the strings of the chart,
     * but a synthetic chart or a half played chord carries fewer of them. It
     * is accepted only when ONE single shape contains what was heard: if there
     * are two, guessing is worse than saying no. */
    const within = Object.keys(SHAPES).filter((c) => inside(heard, SHAPES[c]));
    if (within.length !== 1) return null;
    name = within[0];
  }

  const want = candidates || [];
  if (want.includes(name)) return name;
  if (name.length > 1 && name.endsWith('7')) {
    const triad = name.slice(0, -1);
    if (SHAPES[triad] && want.includes(triad)) return triad;
  }
  return name;
}

/** How clean it came out. `score` is already `strings taken / strings total`
 *  (`_ndScoreChord`), but on a called back judgement it can be missing: then
 *  the sum is done again by hand, instead of taking for good a strum that was
 *  not. */
function qualityOf(d) {
  const q = Number.isFinite(d.score)
    ? d.score
    : (d.totalStrings > 0 ? (d.hitStrings || 0) / d.totalStrings : 1);
  return Math.max(0, Math.min(1, q));
}

/**
 * The adapter. Same shape as the others: `start()`, `stop()`, and no clock of
 * its own.
 *
 * `opts.sdk` is `window.feedBackMinigames`, `opts.highway` the app's highway:
 * both of them injectable because a test has no `window`.
 */
export function createDetectorAdapter(port, opts) {
  const o = opts || {};
  const now = o.now || (() => Date.now());
  const dedupeMs = o.dedupeMs === undefined ? DEDUPE_MS : o.dedupeMs;
  /* As in the script: the default flaw is no flaw. It is NOT
   * `createFlaws('perfect')`, which would rewrite `at` and `heardAt` with the
   * clean time and wipe out the very latency the detector measured. */
  const flaw = o.flaws || ((ev) => [ev]);

  let handle = null;
  let running = false;
  let lastChord;
  let lastAt = -Infinity;

  const down = (reason) => port.emit('status', { ready: false, source: port.source, reason });

  /* With no notes to judge, `createNoteDetector` never emits anything: it
   * takes them from the highway and that is all. It is checked BEFORE building
   * it, so we do not open a microphone to sit and listen to nothing. */
  function hasChart() {
    const hw = o.highway || (typeof window !== 'undefined' ? window.highway : null);
    if (!hw || typeof hw.getNotes !== 'function') return false;
    const notes = hw.getNotes() || [];
    const chords = typeof hw.getChords === 'function' ? (hw.getChords() || []) : [];
    return notes.length > 0 || chords.length > 0;
  }

  function push(ev) {
    if (ev.chord === lastChord && ev.at - lastAt < dedupeMs) return;
    lastChord = ev.chord;
    lastAt = ev.at;
    for (const out of flaw(ev)) port.emit('strum', Object.assign({ source: port.source, quality: 1 }, out));
  }

  /* The SDK listeners cannot be taken off again: `_wrapNoteDetector` only has
   * `on()`, and its `stop()` detaches its own DOM listeners but not ours. So
   * the guard sits in here, otherwise a stopped adapter goes on talking to the
   * port. */
  function onHit(d) {
    if (!running || !d) return;
    const at = now();
    const notes = d.notes || (d.note ? [d.note] : []);
    push({
      chord: chordOf(notes, port.candidates),
      quality: qualityOf(d),
      at,
      heardAt: at - (d.timingError | 0),
      raw: d,
    });
  }

  /* A missed judgement with at least one string taken means something did play
   * and it was not that: it is the miss of the contract. With zero strings
   * nobody played at all, and that is silence: and silence is emitted by no
   * adapter, the engine measures it. */
  function onMiss(d) {
    if (!running || !d) return;
    if (!(d.hitStrings > 0)) return;
    const at = now();
    push({ chord: null, quality: qualityOf(d), at, heardAt: at - (d.timingError | 0), raw: d });
  }

  function onEnd(d) {
    if (!running) return;
    running = false;
    down((d && d.reason) || 'detector stopped');
  }

  return {
    kind: 'guitar',
    start() {
      if (running) return;
      const sdk = o.sdk || (typeof window !== 'undefined' ? window.feedBackMinigames : null);
      const make = sdk && sdk.scoring && sdk.scoring.createChord;
      if (typeof make !== 'function') { down('minigames SDK missing'); return; }
      if (!hasChart()) { down('with no chart the detector judges nothing'); return; }

      running = true;
      handle = make(Object.assign({}, o.chord));
      handle.on('hit', onHit);
      handle.on('miss', onMiss);
      handle.on('end', onEnd);
      /* `_wrapNoteDetector` answers with a fake, switched off handle when
       * `window.createNoteDetector` is missing: that is how it is recognised,
       * and it is the "note_detect not installed" case. */
      if (typeof handle.isRunning === 'function' && !handle.isRunning()) {
        running = false;
        down('note_detect not installed');
        return;
      }
      port.emit('status', { ready: true, source: port.source, reason: 'guitar' });
    },
    stop() {
      const h = handle;
      const was = running;
      handle = null;
      running = false;                          // first, so the SDK's `end` does not bounce back
      if (h && typeof h.stop === 'function') { try { h.stop(); } catch (_) { /* it goes away anyway */ } }
      lastChord = undefined;
      lastAt = -Infinity;
      /* Only a guitar that was heard can be unplugged. A stop after a start
       * that already said `ready: false` used to say it AGAIN, and the glue
       * that listens for that answer stops this adapter — so each answer
       * produced the next, the recursion ran until the stack gave out, and
       * every turn of it left a keyboard listener behind. Measured: one key
       * pressed, 2,264 strums. */
      if (was) port.emit('status', { ready: false, source: port.source, reason: 'guitar unplugged' });
    },
  };
}
