import { createLearning } from './learning.js';

/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE MEASUREMENTS, and why a service has to be signable.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The report is not there to look good at the end of a service: it is there to
 * answer "did the game change?" without having to play it. These are numbers
 * you compare between two runs, not numbers you look at once.
 *
 * The ratios are three and say three different things:
 *   cleanRatio  the share of cooked steps that beat the clock and came out clean.
 *               If it drops, either the burner rose or the ear got worse.
 *   missRatio   strums on nobody / total strums: how much is played at
 *               nothing. With the perfect detector it has to be a flat zero:
 *               if it is not, whoever is playing is guessing.
 *   tipRatio    clean serves / serves: how much soot gets left around.
 *
 * ── THE HASH, AND WHY IT IS WRITTEN BY HAND IN HERE ───────────────────
 *
 * The same seed and the same profile have to give the exact same service in
 * the browser and in Node. Not "nearly": the same. `node:crypto` is there on
 * one side only and `crypto.subtle` is asynchronous, which means it does not
 * fit in a `finish()` that has to stay synchronous and pure. Forty lines of
 * SHA-256 cost less than an `if (Node)` branch nobody then tries from the
 * other side.
 *
 * Not one floating point number goes into the signed log: only times
 * (multiples of the step), integers and names. A hash that changed on the last
 * digit of a `heat` would not sign the service, it would sign the CPU.
 */

/* ── SHA-256, synchronous, the same everywhere ─────────────────────────── */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x, n) => (x >>> n) | (x << (32 - n));

/** UTF-8 by hand: `TextEncoder` is there nearly always, and "nearly" is not
 *  enough for a file that has to give the same hash in two different worlds. */
function utf8(str) {
  const out = [];
  for (const ch of str) {
    const c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function sha256(str) {
  const m = utf8(str);
  const bits = m.length * 8;
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  const hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
  m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
    (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array(64);
  for (let i = 0; i < m.length; i += 64) {
    for (let j = 0; j < 16; j++) {
      const p = i + j * 4;
      w[j] = (m[p] << 24) | (m[p + 1] << 16) | (m[p + 2] << 8) | m[p + 3];
    }
    for (let j = 16; j < 64; j++) {
      const x = w[j - 15], y = w[j - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  let out = '';
  for (const x of h) out += (x >>> 0).toString(16).padStart(8, '0');
  return out;
}

/* ── the histograms ────────────────────────────────────────────────────── */

/* The gaps between one strum and the next, in boxes. The edges are not regular
 * on purpose: they are the times the game knows about (half a beat, a beat,
 * the beat and a half of a far change). A histogram in boxes of a hundred
 * milliseconds would say the same thing unreadably. */
const GAPS = [0, 125, 250, 375, 500, 750, 1125, 1500, 2250];

/* The life a pot had left one beat before going out, in boxes of a quarter of
 * a second. The boxes are fine because the interesting number is narrow: a pot
 * nobody touches has, one beat before dying, exactly one beat of life (0.75 s),
 * and in fact almost every death falls there. The other boxes are the deaths
 * somebody tried to avoid, a rest that came late, a hit that was not enough,
 * and they are the ones to look at when a number in the rules moves. */
const DEATHS = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];

const bump = (h, k) => { h[k] = (h[k] || 0) + 1; };

function bucket(edges, v) {
  let b = edges[0];
  for (const e of edges) if (v >= e) b = e;
  return String(b);
}

/**
 * The measurements of one service. It hangs off the events and touches
 * nothing: the engine does not know it is being measured, which is the only
 * way the measurement is worth anything.
 *
 * `sample(t)` is optional and the game loop calls it. It is there for one
 * thing: knowing how much life a pot had ONE BEAT BEFORE going out. Once the
 * death has happened the heat is zero and says nothing; one beat earlier says
 * whether the customer died of an oversight (plenty left and nobody looked at
 * it) or because it was already doomed (half a second left).
 */
export function createReport(game, opts) {
  const o = opts || {};
  const R = game.rules;
  const S = game.state;
  const learning = createLearning(game, o);

  const lines = [];
  const gaps = {};
  const deaths = {};
  const perChord = {};
  const hitsAt = {};                 // hits per level
  const stepsAt = {};                // steps cooked per level
  let level = 1;
  let tips = 0;
  let lastStrumAt = null;
  let why = null;

  /* The signed log: one event per line, the fields in order of name. The fixed
   * order is what makes two runs written by two different JavaScript engines
   * comparable. */
  const fmt = (v) => (Array.isArray(v) ? v.join(',') : String(v));
  function line(name, e) {
    /* One sample on every event, on top of the ones the game loop asks for.
     * Whoever mounts the report inside the app does not call `sample()`, having
     * no reason to know about it, and without this line the deaths histogram
     * would stay empty exactly where it needs looking at. The 50 ms brake is
     * inside `sample`, so calling it twice costs nothing. */
    sample(S.t);
    let s = name + '|' + S.t;
    const keys = Object.keys(e).sort();
    for (const k of keys) s += '|' + k + '=' + (k === 'dish' ? (e.dish ? e.dish.id : '') : fmt(e[k]));
    lines.push(s);
  }

  const NAMES = ['seat', 'strum', 'miss', 'open', 'cycle', 'step', 'serve', 'ruin', 'redeem', 'perfect', 'level', 'chainLost', 'over'];
  for (const n of NAMES) game.on(n, (e) => line(n, e));

  game.on('strum', (e) => {
    bump(perChord, e.chord);
    hitsAt[level] = (hitsAt[level] || 0) + 1;
    if (lastStrumAt !== null) bump(gaps, bucket(GAPS, S.t - lastStrumAt));
    lastStrumAt = S.t;
  });
  function slowest(n) {
    return learning.finish().pairs.filter(p => p.eligible)
      .sort((a, b) => b.medianMs - a.medianMs).slice(0, n || 3)
      .map(p => ({ from: p.from, to: p.to, n: p.n, ms: p.medianMs, medianMs: p.medianMs }));
  }
  game.on('cycle', (e) => { stepsAt[level] = (stepsAt[level] || 0) + e.stations.length; });
  game.on('serve', (e) => { if (e.tip) tips++; });
  game.on('level', (e) => { level = e.level; });
  game.on('over', (e) => { why = e.why; });
  game.on('ruin', (e) => {
    const v = lifeBefore(e.station);
    bump(deaths, v === null ? 'unknown' : bucket(DEATHS, v));
  });

  /* A ring of samples a little longer than a beat: further back than that is
   * of no use to anybody, and keeping a whole service in memory to look at
   * half a second would be waste paid for over a thousand services. */
  const SAMPLE_MS = 50;
  const SLOTS = Math.ceil(R.BEAT_MS / SAMPLE_MS) + 2;
  const buf = new Array(SLOTS).fill(null);
  let slot = 0;
  let nextSampleAt = 0;

  function sample(t) {
    if (t < nextSampleAt) return;
    nextSampleAt = t + SAMPLE_MS;
    const silent = game.silent();
    const lives = [];
    for (const st of S.stations) lives.push(st.order ? game.life(st, silent) : -1);
    buf[slot % SLOTS] = { t, lives };
    slot++;
  }

  function lifeBefore(i) {
    const want = S.t - R.BEAT_MS;
    let best = null;
    for (const s of buf) {
      if (!s || s.lives[i] === undefined || s.lives[i] < 0) continue;
      if (!best || Math.abs(s.t - want) < Math.abs(best.t - want)) best = s;
    }
    return best ? best.lives[i] : null;
  }

  /* Hits per cooked step, level by level: it is the difficulty curve measured
   * instead of declared. `null` means nothing was cooked at that level, and
   * not Infinity, which JSON writes as `null` just the same but only after
   * having let you hope otherwise. */
  function perStep() {
    const out = {};
    for (const k of Object.keys(hitsAt)) out[k] = stepsAt[k] ? hitsAt[k] / stepsAt[k] : null;
    return out;
  }

  return {
    sample, learning,
    /** The report. It can be called more than once: it consumes nothing. */
    finish(options = {}) {
      const shots = S.hits + S.misses;
      return {
        seed: o.seed === undefined ? null : o.seed,
        profile: o.profile || null,
        input: o.input || null,
        durationMs: S.t,
        over: S.over,
        why,
        level: S.level,
        levelName: S.levelName || null,
        cash: S.cash,
        // The arcade number, kept separate from `chain` on purpose: `chain` is
        // the money multiplier and it is capped, this is how long the player
        // went without a mistake.
        comboBest: S.comboBest || 0,
        served: S.served,
        ruined: S.ruined,
        cycles: S.cycles,
        spoiled: S.spoiled,
        hits: S.hits,
        misses: S.misses,
        /* Chords named right and played too roughly to cook: the count that
         * says whether `RULES.CLEAN` is set where this guitar and this room
         * can reach. It is the one number that would say the bar is too high,
         * and without it the threshold is invisible from the chair. */
        rough: S.rough,
        /* What share of the steps cooked came out CLEAN.
         *
         * It used to be cooked cycles over rests — how often the right gesture
         * worked — and that question has no answer any more, because the right
         * gesture always works: one chord heard is one step cooked. What is
         * worth measuring now is how many of them beat the clock, which is the
         * only thing the game asks. */
        cleanRatio: S.cycles ? 1 - S.spoiled / S.cycles : 0,
        cleanSteps: S.cycles - S.spoiled,
        tipRatio: S.served ? tips / S.served : 0,
        missRatio: shots ? S.misses / shots : 0,
        hitsPerStep: perStep(),
        slowest: slowest(3),
        learning: learning.finish(options),
        gaps,
        deaths,
        perChord,
        hash: sha256(lines.join('\n')),
      };
    },
    /** The signed log, for whoever compares two services line by line. */
    get lines() { return lines; },
  };
}
