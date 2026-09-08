/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE GUITAR, THROUGH THE DESKTOP AUDIO ENGINE. THIS IS THE ONE THAT WORKS.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `detector.js` is written against the Minigames SDK's `scoring.createChord`,
 * which re-emits `notedetect`'s chart-judged events, and that road really is
 * closed: it needs a song loaded and a playhead running. Three more roads were
 * explored from there and all three are dead ends, and the file says why.
 *
 * All of that was answering the wrong question. There is a FOURTH road, it is
 * not in the SDK at all, and Strum Fighter — a FeedBarcade game that hears
 * chords, on this machine, today — has been using it all along:
 *
 *     window.feedBackDesktop.audio.scoreChord({ notes, ... })
 *
 * The desktop build's JUCE engine will score the CURRENT live audio against
 * any chord shape you hand it, with no chart, no playhead and no song, and
 * give back how much of that shape actually rang:
 *
 *     { isHit, score, hitStrings, totalStrings, results[] }
 *
 * With `audio.getLevels()` for the input level beside it, that is everything
 * this game needs, and the two halves map exactly onto its two questions.
 *
 * ── WHEN DID YOU STRUM ─────────────────────────────────────────────────
 *
 * The level is polled at about sixty a second and a strum is a sharp rise
 * ABOVE A ROLLING BACKGROUND, not above a fixed floor. That distinction is
 * not ours and it was not free: Strum Fighter's own comments record that a
 * fixed floor was pinned high by its boss music and dropped every strum. The
 * constants below are its measured ones, kept deliberately identical — a
 * second set of numbers tuned by ear against the same engine would be a worse
 * set of numbers.
 *
 * ── WHICH CHORD WAS IT ─────────────────────────────────────────────────
 *
 * Strum Fighter only ever asks about ONE shape, because it is a shooter and
 * you are aimed at one enemy. This game has one to five pots wanting one to
 * five different chords, so on every strum it scores EVERY candidate and takes
 * the best. That is the whole difference, and it is the reason the fixed
 * `minHitRatio` that sank the `setVerifyTarget` road does not matter here: we
 * never ask "did this pass a threshold", we ask "which of these fits best".
 * C and Am both clear half their strings on either chord; C played scores
 * higher against C than against Am, and the comparison is the answer.
 *
 * The open strings are part of the shape and are scored with it, which is what
 * makes that comparison sharp. Play C (x32010) and Am's expected open A and
 * fretted G both come back wrong, because you are holding a C.
 *
 * ── WHAT THE GAME GETS ─────────────────────────────────────────────────
 *
 * `strum(chord, quality)` with `quality` = the engine's own ratio of strings
 * that rang. The engine already treats quality under 0.8 as a dirty strum that
 * leaves soot, so a chord that half-rang costs the tip on its own, with no new
 * rule anywhere: "how cleanly it came out" and "how much of it rang" turn out
 * to be the same number.
 *
 * And when the desktop engine is not there — a browser build, the dev server
 * in a tab — this adapter says so through `status { ready: false }` before it
 * touches anything, and the glue falls back to the keyboard with a badge that
 * tells the truth.
 */

import { SHAPES } from '../menu.js';

/* ── the onset detector's constants ──────────────────────────────────────
 *
 * Measured by Strum Fighter against the same engine and the same kind of
 * playing (`strum_fighter/assets/modules/audio-input.js`). Kept identical on
 * purpose; the comments are why each one exists, in its terms.
 */
const RISE_RATIO = 1.6;    // a strum is this many times the background
const RISE_DELTA = 0.06;   // or at least this far above it, for a near-zero background
const REARM_DELTA = 0.04;  // and falls back to this before another can fire: ring-out
const BASE_ATTACK = 0.012; // the background tracks up slowly, so a transient barely moves it
const BASE_RELEASE = 0.06; // and down faster, so the floor drops when the music stops
const MIN_GAP_MS = 170;    // two strums closer than this are one strum ringing

/*
 * AND THE ONE CONSTANT THAT IS OURS, because it is the one Strum Fighter
 * could not have needed.
 *
 * `armed` goes false on a strum and comes back when the level falls to within
 * `REARM_DELTA` of the background. On a guitar that takes a while: the ring
 * decays over one to three seconds while the background climbs at a time
 * constant of about 1.3 s, so they meet somewhere past half a second.
 *
 * Strum Fighter fires one shot per enemy and WANTS the ring-out suppressed for
 * exactly that long. Fret Food is made of "strum, strum, silence", and the
 * second strum lands 375 ms after the first — inside that window, every time.
 * It was dropped, so the rest was judged on a single strum, which never
 * reaches the line, so almost nothing cooked. What that looks like from the
 * player's chair is "it takes it now and then and mostly not", which is
 * precisely what came back.
 *
 * So the gate times out. What actually stops a decay from re-triggering is the
 * SLOPE test — a ring-out falls, and falling is not a strum — and `armed` is
 * only there to help it. Given 180 ms, `MIN_GAP_MS` stays the real limit and
 * the second strum of a cycle is heard.
 */
const REARM_MS = 180;

/* How long to let the chord ring before scoring it. The attack transient is
 * noise; the sustain reads clean. Strum Fighter waits the same 55 ms, and Fret
 * Food can afford it: the two strums of a cycle are 375 ms apart. */
const SETTLE_MS = 55;

const POLL_MS = 16;        // about sixty a second, like the game itself

/* What the engine is asked for. `bypassMl` + `harmonicVerify` select the DSP
 * harmonic-comb verifier, which is the mode that actually detects a STRUMMED
 * chord: the plain energy/band check returns almost nothing for one. Not ours,
 * measured, kept verbatim. */
const SCORE_MODE = {
  arrangement: 'guitar',
  stringCount: 6,
  offsets: [0, 0, 0, 0, 0, 0],
  capo: 0,
  bypassMl: true,
  harmonicVerify: true,
};

/*
 * How hard the ear is, in three grades.
 *
 * These are Strum Fighter's measured tiers (`chords.js: tierParams`), and the
 * middle one is the default for a reason that is particular to this game:
 * every other consumer of `scoreChord` asks "did this pass", and we ask "which
 * of these fits best". A very forgiving ear pushes every candidate's score up
 * and blurs the comparison — C and Am start scoring the same. A very strict
 * one makes a real strum score low and fall under the floor. The middle is
 * where the ANSWER is sharpest, which is not the same place as where a
 * threshold is kindest.
 *
 * `minHitRatio` only sets the `isHit` flag, which this adapter does not read;
 * it is passed through so the numbers stay the tiers they came from rather
 * than a doctored copy of them.
 *
 *   pitchCheckCents   how far off pitch a string may be and still count
 *   harmonicSnr       how far above the noise floor a harmonic must sit
 *   fundamentalRatio  how much of the fundamental has to be present
 *   floor             below this, the best fit is not a fit: nothing was played
 *                     that resembles any chord on the counter
 */
export const EARS = {
  easy: {
    pitchCheckCents: 80, minHitRatio: 0.28, harmonicSnr: 2.0, fundamentalRatio: 0.12,
    floor: 0.34, level: 0.03, slope: 0.02,
  },
  medium: {
    pitchCheckCents: 65, minHitRatio: 0.34, harmonicSnr: 2.4, fundamentalRatio: 0.15,
    floor: 0.42, level: 0.05, slope: 0.03,
  },
  hard: {
    pitchCheckCents: 50, minHitRatio: 0.50, harmonicSnr: 3.2, fundamentalRatio: 0.22,
    floor: 0.50, level: 0.07, slope: 0.04,
  },
};

const MIN_FIT = EARS.medium.floor;

/**
 * WHICH EAR, FROM THE FIRST CHORD.
 *
 * The three grades were a URL parameter, which is to say nobody's. The first
 * chord of a service — the one that opens the kitchen — is heard with the
 * kindest ear, so that it is heard at all on a guitar the game has never met,
 * and how well it scored says which ear this guitar and this room deserve: a
 * chord that comes back nearly whole can afford the strict ear, where the
 * ANSWER is sharpest; one that barely clears the floor keeps the kind one.
 * `quality` is the engine's own score for the chord that was named, 0 to 1.
 */
export function earFor(quality) {
  const q = Number(quality);
  if (!Number.isFinite(q)) return 'medium';
  if (q >= 0.85) return 'hard';
  if (q >= 0.5) return 'medium';
  return 'easy';
}

/*
 * THE HAND HOLDS ITS SHAPE.
 *
 * The first session with the calibrated ear reported this: play the G a
 * ticket wants and the pot cooks — and so does the C on the ticket beside it.
 * Not because the ear heard a C. Because this adapter never asks "is this a
 * C", it asks "which of the chords on the counter fits best", and the moment
 * the G cooks, the pot that wanted it moves on: the counter now wants C and
 * Am, and the NEXT strum of the same G — a player strums a chord three or
 * four times, not once — is judged against those alone. The G's open strings
 * are half of a C, Em shares three strings with G, Am three with C; the
 * nearest wrong shape clears the floor, and the best fit among the wrong
 * candidates is still called the best fit.
 *
 * The first answer was a decoy with a clock on it: the chord just named stayed
 * in the line-up for seven tenths of a second. The second session said that
 * was not long enough — a player strumming in time comes back to the same
 * chord well after that — and the clock was the mistake: a hand does not let
 * go of a shape because time has passed, it lets go when it makes another.
 * So the chord last named stays in the line-up for as long as it takes, and
 * a strum that still fits IT best is the hand still there: dropped, counted
 * under `ring`. Only a chord that BEATS the one the hand holds is a change.
 *
 * And a hand cannot change shape in a quarter of a second. Two strums closer
 * than `MIN_CHANGE_MS` that name two different chords are one chord and a
 * misjudged ring — the onset detector re-arms at 180 ms, and the transient
 * of a strum is the worst moment to score it — so the second is dropped,
 * counted under `quick`. A quarter of a second is eighth notes at 120 to the
 * minute; a change made faster than that is heard on its next strum.
 */
export const MIN_CHANGE_MS = 250;

/**
 * The shape as the engine wants it: `{ s, f }` with `s` counted from 0 at the
 * low E, muted strings left out.
 *
 * The two conventions agree, which is worth stating because it is the kind of
 * thing that silently half-works. `menu.js` writes its frets low E first and
 * `-1` for a muted string; the engine indexes its strings from 0 at the low E
 * (`_ND_TUNING_GUITAR_6 = [40, ...]`, MIDI 40 is E2) and wants the muted ones
 * omitted. So the index passes through untouched.
 */
export function engineNotes(chord) {
  const shape = SHAPES[chord];
  if (!shape) return null;
  const out = [];
  shape.frets.forEach((f, i) => { if (f >= 0) out.push({ s: i, f }); });
  return out.length ? out : null;
}

/** The engine's audio bridge, or `null` when this is not a desktop build. */
export function audioBridge(win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  // The host renamed `slopsmithDesktop` to `feedBackDesktop`; both are tried
  // so the game works on a build that still carries the old name.
  const host = w && (w.feedBackDesktop || w.slopsmithDesktop);
  const audio = host && host.audio;
  if (!audio || typeof audio.scoreChord !== 'function' || typeof audio.getLevels !== 'function') return null;
  return audio;
}

/**
 * Picks the chord that fits what was just played.
 *
 * Exported and pure so the choosing can be tested without an engine: hand it
 * the scores and it names the winner. `score` decides, and `hitStrings` breaks
 * a tie — a ratio treats three strings out of three and six out of six as the
 * same fit, and between two shapes that fit equally well the one with more
 * strings confirmed is the one with more evidence behind it.
 */
export function bestFit(scored, floor) {
  const min = floor === undefined ? MIN_FIT : floor;
  let best = null;
  for (const s of scored) {
    if (!s || !s.result) continue;
    const score = Number(s.result.score);
    if (!Number.isFinite(score) || score < min) continue;
    const hits = Number(s.result.hitStrings) || 0;
    if (!best || score > best.score + 1e-9 || (Math.abs(score - best.score) <= 1e-9 && hits > best.hits)) {
      best = { chord: s.chord, score, hits };
    }
  }
  return best;
}

/**
 * The adapter. Same contract as the keyboard and the script: `start`, `stop`,
 * and it emits `strum` on the port. It has no `pump`, because it does not
 * follow the game's clock — it follows the audio.
 */
export function createEngineAdapter(port, opts) {
  const o = opts || {};
  const audio = o.audio || audioBridge(o.window);
  const flaws = o.flaws;
  let ear = EARS[o.ear] || EARS.medium;
  let scoreOpts = null;
  /* The ear can be changed while the adapter runs: the glue calls `setEar`
   * with what the first chord said (`earFor`), and every strum after it is
   * scored with the new grade. */
  function setEar(name) {
    ear = EARS[name] || EARS.medium;
    stats.ear = EARS[name] ? name : 'medium';
    scoreOpts = Object.assign({}, SCORE_MODE, {
      pitchCheckCents: ear.pitchCheckCents,
      minHitRatio: ear.minHitRatio,
      harmonicSnr: ear.harmonicSnr,
      fundamentalRatio: ear.fundamentalRatio,
    });
  }
  const now = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const wait = o.wait || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const schedule = o.schedule || ((fn, ms) => setTimeout(fn, ms));
  const unschedule = o.unschedule || ((h) => clearTimeout(h));

  let running = false;
  let timer = null;
  let baseline = 0;
  let prevLevel = 0;
  let primed = false;
  let armed = true;
  let lastOnsetAt = -1e9;
  let scoring = false;
  const stats = { onsets: 0, named: 0, unknown: 0, ring: 0, quick: 0, level: 0, ear: o.ear || 'medium' };
  setEar(o.ear || 'medium');
  let lastNamed = null;               // { chord, at }: the shape the hand holds, and when it was last heard

  function send(ev) {
    const out = flaws ? flaws(ev) : [ev];
    for (const e of out) port.emit('strum', Object.assign({ source: port.source, quality: 1 }, e));
  }

  /** Scores every chord the counter is waiting for and reports the winner. */
  async function hear() {
    const wanted = port.candidates.slice();
    if (!wanted.length) return;
    /* The shape the hand holds stays in the line-up, however long ago it was
     * named, when nobody wants it any more: see `MIN_CHANGE_MS` above. */
    const decoy = lastNamed && !wanted.includes(lastNamed.chord) ? lastNamed.chord : null;
    const chords = decoy ? wanted.concat([decoy]) : wanted;
    await wait(SETTLE_MS);
    if (!running) return;

    /* All of them at once. Each call scores the audio as it is when the engine
     * gets it, so scoring five in a row would judge five different instants of
     * the same ring; in parallel they land within a few milliseconds of each
     * other, on a chord that will go on ringing for hundreds. */
    const scored = await Promise.all(chords.map(async (chord) => {
      const notes = engineNotes(chord);
      if (!notes) return null;
      try {
        return { chord, result: await audio.scoreChord(Object.assign({ notes }, scoreOpts)) };
      } catch (_) {
        return null;                    // a hiccup on the bridge is not a miss
      }
    }));
    if (!running) return;

    const at = now();
    const best = bestFit(scored, ear.floor);
    stats.scores = scored.filter(Boolean).map((x) => x.chord + ':' + (x.result ? Number(x.result.score).toFixed(2) : '-'));
    if (best && decoy && best.chord === decoy) {
      // The shape the hand holds, strummed again or still ringing: nothing
      // new was played. The hand was heard NOW, which is what the quarter of
      // a second below is measured from.
      stats.ring++;
      lastNamed = { chord: decoy, at };
      return;
    }
    if (best && lastNamed && best.chord !== lastNamed.chord && at - lastNamed.at < MIN_CHANGE_MS) {
      // A different chord a quarter of a second after the last: no hand
      // changes shape that fast. The ring, misjudged; heard on its next strum.
      stats.quick++;
      return;
    }
    if (best) {
      stats.named++;
      lastNamed = { chord: best.chord, at };
      send({ chord: best.chord, quality: Math.max(0, Math.min(1, best.score)), at, heardAt: at });
      return;
    }

    /* Nothing on the counter fitted, and this is DROPPED rather than reported
     * as a strum of no chord.
     *
     * The port's `chord: null` means "something was heard that is not a chord
     * of this game", and the engine files a miss for it — three of those in a
     * row cost the chain. That is the right answer for a keyboard, where the
     * key pressed is a fact. It is the wrong answer for an ear: a strum we
     * cannot name is evidence that WE did not hear it, and charging the player
     * for our deafness is the one way to make a flaky detector feel like a
     * broken game. The pot not heating is punishment enough for a wrong chord,
     * and it needs no help from us.
     *
     * It is counted, though: `unknown` climbing while `named` does not is the
     * signature of an ear set too strict for this guitar. */
    stats.unknown++;
  }

  async function tick() {
    if (!running) return;
    try {
      const lv = await audio.getLevels();
      // `Number.isFinite`, not a typeof check: one NaN reading poisons the
      // moving average for good and the onset detector never fires again.
      const level = lv && Number.isFinite(lv.inputLevel) ? lv.inputLevel : 0;
      stats.level = level;

      if (!primed) {
        // Warm start, so a cold zero-to-floor jump is not taken for a strum.
        primed = true;
        baseline = level;
        prevLevel = level;
      } else {
        baseline += (level - baseline) * (level > baseline ? BASE_ATTACK : BASE_RELEASE);
        const onset = Math.max(ear.level, baseline + RISE_DELTA, baseline * RISE_RATIO);
        const rearm = baseline + REARM_DELTA;
        const t = now();
        // Re-armed by the level falling back OR by time running out: see
        // `REARM_MS`. Without the second one the second strum of every cycle
        // arrives while the first is still ringing and is thrown away.
        if (!armed) {
          if (level < rearm || t - lastOnsetAt >= REARM_MS) armed = true;
        }
        if (armed && level > onset && level - prevLevel > ear.slope && t - lastOnsetAt > MIN_GAP_MS) {
          lastOnsetAt = t;
          armed = false;
          stats.onsets++;
          if (!scoring) {
            scoring = true;
            hear().catch(() => {}).then(() => { scoring = false; });
          }
        }
        prevLevel = level;
      }
    } catch (_) {
      // A transient failure on the bridge: keep polling rather than give up.
    }
    if (running) timer = schedule(tick, POLL_MS);
  }

  return {
    kind: 'engine',
    get stats() { return stats; },
    setEar,
    start() {
      if (running) return;
      if (!audio) {
        /* Said before anything is opened, and with the reason, so the badge
         * never claims a guitar the machine cannot hear. */
        port.emit('status', {
          ready: false,
          source: port.source,
          reason: 'no desktop audio engine (this needs the fee[dB]ack desktop build)',
        });
        return;
      }
      running = true;
      port.emit('status', { ready: true, source: port.source, reason: 'desktop audio engine' });
      tick();
    },
    stop() {
      running = false;
      if (timer) { unschedule(timer); timer = null; }
      // A fresh start begins from a clean background, not the last session's.
      baseline = 0; prevLevel = 0; primed = false; armed = true;
    },
  };
}
