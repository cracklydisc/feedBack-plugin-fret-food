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
 * Two ways, and either will do.
 *
 * THE LEVEL is polled at about sixty a second and a strum is a sharp rise
 * ABOVE A ROLLING BACKGROUND, not above a fixed floor. That distinction is
 * not ours and it was not free: Strum Fighter's own comments record that a
 * fixed floor was pinned high by its boss music and dropped every strum. The
 * constants below are its measured ones, kept deliberately identical — a
 * second set of numbers tuned by ear against the same engine would be a worse
 * set of numbers.
 *
 * THE NOTES' OWN ONSETS are the second, and on a build with the ML detector
 * they are the better one. Every note `detectNotes` reports carries an
 * `onsetSeq`, a counter that goes up when THAT pitch is struck anew, and
 * `notedetect` gates its own chord timing on exactly that. A rise in the
 * level is a rise in the level: it depends on how hard the room, the pickup
 * and the hand happen to make a chord, and a session with a guitar reported
 * the C going unheard over and over — which is the one shape you strum
 * carefully, because `x32010` asks you to miss the low E, and missing a
 * string means less signal. A pitch struck anew is struck anew however
 * quietly.
 *
 * So both fire, and `MIN_GAP_MS` keeps one strum from being two. Whichever
 * notices first wins, and on a quiet C that is the notes.
 *
 * ── WHICH CHORD WAS IT: THE NOTES, WHEN THE ENGINE HAS THEM ────────────
 *
 * The engine has a second thing to offer and it is the better one:
 *
 *     window.feedBackDesktop.audio.detectNotes()
 *       → { notes: [ { midi, confidence, onsetMs, onsetSeq } ] }
 *
 * That is the polyphonic ML detector (Basic Pitch) reporting the pitches
 * actually ringing, and `notedetect` gates its own chord timing on it. With
 * the pitches in hand, naming a chord stops being a similarity contest and
 * becomes arithmetic: a shape is a set of pitches, and the answer is the
 * shape whose set the air agrees with — see `nameFrom`. One call, the whole
 * vocabulary compared locally, and a chord nobody wants comes back named as
 * itself instead of being pushed onto the nearest thing on the counter.
 *
 * ── AND `scoreChord`, WHEN IT DOES NOT ─────────────────────────────────
 *
 * On a build with no ML detector the fallback is Strum Fighter's road: ask
 * the engine how much of ONE shape rang, for every chord the counter wants,
 * and take the best. It works, and its weakness is worth writing down because
 * it is what the second road exists to fix: `score` is strings-that-rang over
 * strings-in-the-shape, and an OPEN string rings on almost anything played in
 * first position. Em is four open strings out of six, G three: on a strummed
 * C they score most of their ratio for nothing, and the shape with the most
 * open strings drifts to the top of a comparison it should lose. What is left
 * of the difference is the fretted strings, so a tie there is broken by them
 * (`bestFit`), and a session with a guitar still reported the rest: "suono lo
 * stesso accordo e sblocco accordi diversi".
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

/* How often the notes are asked for. `notedetect` runs its own detection loop
 * at fifty and guards against overlapping calls, so this is the app's own
 * rate rather than a number of ours; the level goes on being read every
 * poll, because it costs nothing and it is the one thing that says whether
 * the guitar is reaching the app at all. */
const NOTES_MS = 48;

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
/* `fit` and `conf` are the note road's two: how well the pitches in the air
 * have to agree with a shape before it is named (`nameFrom`), and how sure
 * the detector has to be of a pitch before it counts as ringing at all. The
 * confidence is `notedetect`'s own scale, where the app's default is 0.20 and
 * the slider stops at 0.50. */
export const EARS = {
  easy: {
    pitchCheckCents: 80, minHitRatio: 0.28, harmonicSnr: 2.0, fundamentalRatio: 0.12,
    floor: 0.34, level: 0.03, slope: 0.02, fit: 0.50, conf: 0.15,
  },
  medium: {
    pitchCheckCents: 65, minHitRatio: 0.34, harmonicSnr: 2.4, fundamentalRatio: 0.15,
    floor: 0.42, level: 0.05, slope: 0.03, fit: 0.58, conf: 0.20,
  },
  hard: {
    pitchCheckCents: 50, minHitRatio: 0.50, harmonicSnr: 3.2, fundamentalRatio: 0.22,
    floor: 0.50, level: 0.07, slope: 0.04, fit: 0.66, conf: 0.30,
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

/* How near two shapes have to be before the counter is asked which one it
 * was, and it is a DEAD HEAT and nothing wider. Measured over every shape
 * with a string missing, a stray one ringing, or two strings gone: a band of
 * 0.08 rescues 98.2% of them when the counter wants them and a band of zero
 * rescues 98.1%, because the cases that need rescuing ARE exact ties — a hand
 * that fails to press the one string telling Am from A leaves pitches that
 * fit both to the last decimal. A wider band buys a tenth of a percent and
 * spends it letting the counter speak where the ear had an opinion. */
export const TIE_BAND = 0;

/* HOW MUCH OF A SHAPE HAS TO BE THERE BEFORE IT IS THAT SHAPE.
 *
 * The fit is a balance of two ratios, so a very small piece of a chord that
 * happens to be clean scores like a whole one that is slightly dirty: two
 * notes of an Am — the top two, C4 and E4 — fit a C at 0.57, because a C
 * contains both and nothing else was in the air to argue. The kind ear takes
 * 0.50, so those two notes cooked a C.
 *
 * Half is the floor: a chord is not named on less than half of itself,
 * whatever the rest of the arithmetic says. A five-string shape needs three
 * of its notes, a six-string one needs three. It costs nothing real — two
 * strings dead out of five is 0.6 and still passes — and it closes the door
 * on a chord named out of somebody else's ringing. */
export const MIN_RECALL = 0.5;

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

/* Standard tuning, low E first, as MIDI. The same table the engine keeps
 * (`_ND_TUNING_GUITAR_6`), and it has to be: a pitch we compute has to be the
 * pitch it reports. */
export const TUNING = [40, 45, 50, 55, 59, 64];

/** A MIDI pitch as a player would say it: `C3`, `F#4`. For the overlay that
 *  shows what the ear actually heard, and for anything else that has to print
 *  a note. The S font has no lowercase, so the sharps are spelled with `#`. */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteName(midi) {
  const m = Math.round(Number(midi));
  if (!Number.isFinite(m)) return '?';
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/** The pitches a shape puts in the air, low to high. Muted strings are not in it. */
export function pitchesOf(chord) {
  const s = SHAPES[chord];
  if (!s) return null;
  const out = [];
  s.frets.forEach((f, i) => { if (f >= 0) out.push(TUNING[i] + f); });
  return out.length ? out : null;
}

const PITCHES = {};
for (const name of Object.keys(SHAPES)) PITCHES[name] = pitchesOf(name);

/*
 * THE STRING THE SHAPE TELLS YOU TO MUTE, WHICH RINGS ANYWAY.
 *
 * A session with a guitar reported the C in particular: not confused with
 * another chord, simply not heard, over and over, while the rest of the
 * vocabulary was fine. The arithmetic says what is different about it, and it
 * is not the fingering — it is the string that is NOT in it.
 *
 * C is `x32010`: the low E is muted, and a beginner's thumb damps it about as
 * often as not. A strummed low E is the loudest string on the guitar, so the
 * detector reports it, and precision counted it as a note the shape does not
 * explain: a clean C came back 0.87 instead of 1, a C with one more thing
 * wrong came back 0.76, and against a strict ear that is the difference
 * between cooking and nothing happening. Five shapes are built this way —
 * C and Am mute the low E, Dm, D and F mute the low E and the A — and C is
 * the one a player meets first and plays most.
 *
 * So the open sound of a string a shape asks you to MUTE is not a stranger.
 * It is that shape's own known imperfection, and forgiving it costs no
 * discrimination: Em is those same six strings all ringing, and a hand
 * playing Em still names Em by a mile, because recall does not move.
 */
const MUTED = {};
for (const name of Object.keys(SHAPES)) {
  const shape = SHAPES[name];
  MUTED[name] = shape.frets.map((f, i) => (f < 0 ? TUNING[i] : null)).filter((p) => p !== null);
}

/* A pitch the ear reports that the shape does not contain can still BE the
 * shape: a string's own partials are an octave and an octave-and-a-fifth
 * above it, and the detector reports the loud ones as notes. Those two
 * intervals are forgiven; anything else ringing is a note the shape does not
 * explain, and that is the whole discrimination — C and Am differ by one
 * pitch, and it is the one that decides. */
const PARTIALS = [12, 19, 24];

/**
 * WHICH CHORD IS RINGING, out of everything this game knows.
 *
 * `heard` is the pitches the detector reports. For every shape, two numbers:
 * how much of the SHAPE is in the air (recall), and how much of the AIR the
 * shape accounts for (precision). Their harmonic mean is the fit, and the
 * best fit wins if it clears `floor`.
 *
 * Both halves are needed and it is worth saying why, because the road this
 * replaces had only the first. Recall alone is what `scoreChord` gives, and
 * on a strummed C the Am shape recalls four of its five pitches — they share
 * everything but one string. Precision is what notices that a C3 is ringing
 * and Am has no C3 in it. One pitch of difference, and the answer comes out
 * of the pitch that differs rather than the four that do not.
 *
 * A shape is allowed to be incomplete — a muted string, a finger that did not
 * press — so recall is forgiving. What it may not be is a shape with notes in
 * it that nobody played.
 */
export function nameFrom(heard, opts) {
  const o = opts || {};
  const floor = o.floor === undefined ? 0.55 : o.floor;
  const air = [...new Set((heard || []).filter((n) => Number.isFinite(n)).map((n) => Math.round(n)))];
  if (!air.length) return null;
  const only = o.only && o.only.length ? o.only : Object.keys(PITCHES);
  const asked = o.wanted && o.wanted.length ? o.wanted : null;
  let best = null;
  for (const chord of only) {
    const want = PITCHES[chord];
    if (!want || !want.length) continue;
    /* The pitch itself, and not its octave. Forgiving the octave here cost
     * exactly the pair this has to get right: the small F (xx3211) is the
     * whole F (133211) without its two lowest strings, and those two are an
     * octave below two of the four that remain — so a lenient recall heard
     * the whole barre in a hand playing the little shape, and G/B the same
     * way against G. One shape inside another is told apart by what is NOT
     * ringing, which means recall has to be literal. */
    let hit = 0;
    for (const p of want) if (air.includes(p)) hit++;
    const spare = MUTED[chord] || [];
    let known = 0;
    for (const h of air) {
      if (want.includes(h) || PARTIALS.some((k) => want.includes(h - k)) || spare.includes(h)) known++;
    }
    const recall = hit / want.length;
    const precision = known / air.length;
    if (!recall || !precision || recall < MIN_RECALL) continue;
    const fit = (2 * recall * precision) / (recall + precision);
    /* TOO CLOSE TO CALL: the counter decides.
     *
     * Every tie in this vocabulary is the chord's THIRD, and there are
     * twenty-one of them: Am without its C4 is the pitches of an A, Em
     * without its G3 an E, Dm without its F4 a D. Not one of them turns on
     * the bass — it is always the one note that says major or minor, and in
     * open position that note is usually on a thin string where a lazy finger
     * leaves it. When two shapes are inside `TIE_BAND` of each other the
     * pitches have said everything they can, and deciding it by the order the
     * shapes happen to be written in is an answer with nothing behind it:
     * every open minor is declared before its major, so a hand playing A with
     * a missing third was told it had played Am, for ever.
     *
     * This is not the mistake the whole notes road exists to undo. That one
     * asked "which of the WANTED shapes fits best" and so could only ever
     * answer with a chord somebody ordered, however badly it fitted. This
     * asks the pitches first, across everything the game knows, and hands the
     * counter only what they could not separate. Measured over every shape
     * with a string missing: 143 of 144 come back right when the counter
     * wants them, and all 756 whole shapes still name themselves when the
     * counter wants something else. Past about a tenth the second of those
     * starts to fall, which is the counter talking the ear out of what it
     * plainly heard, so the band stops well short of it.
     */
    const level = best && best.fit - fit <= TIE_BAND + 1e-9;
    const mine = asked ? asked.includes(chord) : false;
    const theirs = best && asked ? asked.includes(best.chord) : false;
    const better = !best
      || (fit > best.fit + 1e-9 && !(theirs && !mine && fit - best.fit <= TIE_BAND))
      || (level && ((mine && !theirs) || (mine === theirs && fit > best.fit + 1e-9)));
    if (better) best = { chord, fit, hit, recall, precision };
  }
  return best && best.fit >= floor ? best : null;
}

/** The engine's audio bridge, or `null` when this is not a desktop build. */
export function audioBridge(win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  // The host renamed `slopsmithDesktop` to `feedBackDesktop`; both are tried
  // so the game works on a build that still carries the old name.
  const host = w && (w.feedBackDesktop || w.slopsmithDesktop);
  const audio = host && host.audio;
  if (!audio || typeof audio.getLevels !== 'function') return null;
  // Either road will do, and `detectNotes` is the better one: a build with
  // only the shape scorer is still a build this game can be played on.
  if (typeof audio.scoreChord !== 'function' && typeof audio.detectNotes !== 'function') return null;
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
    const fretted = frettedHits(s.chord, s.result);
    /* Ties are common and they used to go to whichever chord the counter
     * listed first, which is an answer with no evidence in it at all. An open
     * string rings on almost anything played in first position, so what is
     * left of a tied comparison is the FRETTED strings: between two shapes
     * that scored the same, the one with more of its fretted strings
     * confirmed is the one the hand was actually holding. `hitStrings` breaks
     * what is still level after that. */
    const better = !best
      || score > best.score + 1e-9
      || (Math.abs(score - best.score) <= 1e-9
        && (fretted > best.fretted || (fretted === best.fretted && hits > best.hits)));
    if (better) best = { chord: s.chord, score, hits, fretted };
  }
  return best;
}

/** How many of a shape's FRETTED strings the engine confirmed. `results[]` is
 *  per string; a build that does not send it answers with the shape's ratio,
 *  which is the same for every candidate and so breaks nothing. */
export function frettedHits(chord, result) {
  const shape = SHAPES[chord];
  const rows = result && Array.isArray(result.results) ? result.results : null;
  if (!shape || !rows) return 0;
  let n = 0;
  for (const r of rows) {
    if (!r || !r.hit) continue;
    const f = Number(r.f);
    if (Number.isFinite(f) && f > 0) n++;
  }
  return n;
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

  /* Which road this build gives us, decided once at `start`. The notes are
   * preferred and the shape scorer is the fallback; `null` until asked. A
   * build whose ML model failed to load answers `isMlNoteDetection()` false
   * and still has `detectNotes`, but it is monophonic YIN then and naming a
   * chord from one pitch is not naming a chord — so the question is asked. */
  let notes = null;
  async function road() {
    if (notes !== null) return notes;
    notes = false;
    try {
      if (typeof audio.detectNotes === 'function') {
        notes = typeof audio.isMlNoteDetection !== 'function'
          ? true
          : (await audio.isMlNoteDetection()) === true;
      }
    } catch (_) { notes = false; }
    if (!notes && typeof audio.scoreChord !== 'function') notes = true;   // nothing else to try
    stats.road = notes ? 'notes' : 'shapes';
    return notes;
  }

  let running = false;
  let timer = null;
  /* The onset counter last seen for each pitch, and whether the first poll
   * has been taken. Without the priming, every pitch already ringing when
   * the service opens arrives as a strum. */
  const seqSeen = new Map();
  let primedNotes = false;
  let notesAt = -1e9;
  let baseline = 0;
  let prevLevel = 0;
  let primed = false;
  let armed = true;
  let lastOnsetAt = -1e9;
  let scoring = false;
  const stats = {
    onsets: 0, struck: 0, named: 0, unknown: 0, ring: 0, quick: 0, level: 0,
    ear: o.ear || 'medium', road: '?',
    /* The last few hearings, newest first, for the overlay: what was in the
     * air, what it was called and what became of it. It is the only way to
     * tell a strum the detector never reported from a chord this code named
     * wrongly, and the difference decides who has the bug. */
    last: [],
  };
  const LOG = 4;
  function logged(why, air, best) {
    stats.last.unshift({
      why,
      air: (air || []).slice().sort((a, b) => a - b).map(noteName),
      chord: best ? best.chord : null,
      fit: best ? best.fit : 0,
    });
    if (stats.last.length > LOG) stats.last.length = LOG;
  }
  setEar(o.ear || 'medium');
  let lastNamed = null;               // { chord, at }: the shape the hand holds, and when it was last heard

  function send(ev) {
    const out = flaws ? flaws(ev) : [ev];
    for (const e of out) port.emit('strum', Object.assign({ source: port.source, quality: 1 }, e));
  }

  /**
   * THE NOTES ROAD: what is ringing, named against everything the game knows.
   *
   * One call, and the answer is a chord and not a ranking of the chords the
   * counter happens to want. That is the whole point: a C played while the
   * counter wants Am and G comes back a C — which nobody wants, so nothing
   * cooks — where the shape road had to hand back the better of two wrong
   * answers.
   */
  async function byNotes() {
    let d = null;
    try { d = await audio.detectNotes(); } catch (_) { return null; }
    if (!running || !d || !Array.isArray(d.notes)) return null;
    const air = [];
    for (const n of d.notes) {
      if (!n || !Number.isFinite(n.midi)) continue;
      const c = Number(n.confidence);
      if (Number.isFinite(c) && c < ear.conf) continue;
      air.push(Math.round(n.midi));
    }
    stats.air = air.slice().sort((a, b) => a - b);
    // The counter is handed over as a TIE-BREAK and never as a filter: see
    // `nameFrom`. What is played is named first, out of everything.
    const best = nameFrom(air, { floor: ear.fit, wanted: port.candidates });
    heardAir = air;
    return best ? { chord: best.chord, quality: best.fit } : null;
  }

  /**
   * THE SHAPE ROAD: how much of each shape rang, and the best of them.
   *
   * The candidates, plus the shape the hand was last holding when nobody
   * wants it any more — without that decoy the ring of a chord already cooked
   * is scored against the counter's new wants and named as one of them.
   */
  async function byShapes(wanted) {
    const decoy = lastNamed && !wanted.includes(lastNamed.chord) ? lastNamed.chord : null;
    const chords = decoy ? wanted.concat([decoy]) : wanted;
    /* All of them at once. Each call scores the audio as it is when the engine
     * gets it, so scoring five in a row would judge five different instants of
     * the same ring; in parallel they land within a few milliseconds of each
     * other, on a chord that will go on ringing for hundreds. */
    const scored = await Promise.all(chords.map(async (chord) => {
      const shape = engineNotes(chord);
      if (!shape) return null;
      try {
        return { chord, result: await audio.scoreChord(Object.assign({ notes: shape }, scoreOpts)) };
      } catch (_) {
        return null;                    // a hiccup on the bridge is not a miss
      }
    }));
    if (!running) return null;
    stats.scores = scored.filter(Boolean).map((x) => x.chord + ':' + (x.result ? Number(x.result.score).toFixed(2) : '-'));
    const best = bestFit(scored, ear.floor);
    return best ? { chord: best.chord, quality: best.score } : null;
  }

  let heardAir = [];               // what the notes road last had in front of it

  /** Names what was just played, and decides whether the game hears it. */
  async function hear() {
    heardAir = [];
    const wanted = port.candidates.slice();
    if (!wanted.length) return;
    await wait(SETTLE_MS);
    if (!running) return;

    const best = (await road()) ? await byNotes() : await byShapes(wanted);
    if (!running) return;
    const at = now();

    if (best && lastNamed && best.chord === lastNamed.chord && !wanted.includes(best.chord)) {
      /* THE HAND HOLDS ITS SHAPE. The chord it was holding, strummed again or
       * still ringing, and no pot wants it any more: nothing new was played.
       * The hand was heard NOW, which is what the quarter of a second below
       * is measured from. */
      stats.ring++;
      logged('ring', heardAir, best);
      lastNamed = { chord: best.chord, at };
      return;
    }
    if (best && lastNamed && best.chord !== lastNamed.chord && at - lastNamed.at < MIN_CHANGE_MS) {
      // A different chord a quarter of a second after the last: no hand
      // changes shape that fast. The ring, misjudged; heard on its next strum.
      stats.quick++;
      logged('quick', heardAir, best);
      return;
    }
    if (best && !wanted.includes(best.chord)) {
      /* A chord this game knows and nobody ordered. On the notes road this is
       * a real answer — the player played a D and no ticket wants one — and
       * it is still not charged as a miss: see below. The hand is holding it
       * now, which is what stops its next strum being read as a change. */
      stats.unknown++;
      logged('nobody wants', heardAir, best);
      lastNamed = { chord: best.chord, at };
      return;
    }
    if (best) {
      stats.named++;
      logged('cooked', heardAir, best);
      lastNamed = { chord: best.chord, at };
      send({ chord: best.chord, quality: Math.max(0, Math.min(1, best.quality)), at, heardAt: at });
      return;
    }

    /* Nothing was named, and this is DROPPED rather than reported as a strum
     * of no chord.
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
    logged('no chord', heardAir, null);
  }

  /** A strum, however it was noticed. Throttled: one gesture is one hearing. */
  function struck(t) {
    if (t - lastOnsetAt <= MIN_GAP_MS) return;
    lastOnsetAt = t;
    armed = false;
    stats.onsets++;
    if (scoring) return;
    scoring = true;
    hear().catch(() => {}).then(() => { scoring = false; });
  }

  /**
   * THE NOTES' OWN ONSETS. Every pitch carries a counter that goes up when it
   * is struck again, so a chord is a handful of them going up together — and
   * a pitch struck quietly is struck all the same, which is what the level
   * cannot say. See the note at the top.
   */
  async function pollNotes(t) {
    let d = null;
    try { d = await audio.detectNotes(); } catch (_) { return; }
    if (!running || !d || !Array.isArray(d.notes)) return;
    let fresh = false;
    for (const n of d.notes) {
      if (!n || !Number.isFinite(n.midi) || !Number.isFinite(n.onsetSeq)) continue;
      const midi = Math.round(n.midi);
      const prev = seqSeen.get(midi);
      seqSeen.set(midi, n.onsetSeq);
      if (!primedNotes) continue;                       // the first poll is the baseline
      if (prev !== undefined && n.onsetSeq <= prev) continue;
      const c = Number(n.confidence);
      if (Number.isFinite(c) && c < ear.conf) continue;
      fresh = true;
    }
    primedNotes = true;
    if (!fresh) return;
    stats.struck++;
    struck(t);
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
        if (armed && level > onset && level - prevLevel > ear.slope) struck(t);
        prevLevel = level;
        /* And the notes, on the app's own cadence. `road()` has already been
         * asked once by then, so this costs nothing on a build without them. */
        if (await road() && t - notesAt >= NOTES_MS) {
          notesAt = t;
          await pollNotes(t);
        }
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
