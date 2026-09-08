/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE FLAWS OF THE EAR.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This file makes a perfect input imperfect, on purpose.
 *
 * A chord detector is not a key: it comes a tenth of a second late, now and
 * then it hears nothing, now and then it hears the chord that shares its notes
 * with the one played, and on a hard change it hears a dirty strum because the
 * strum *was* dirty. A game balanced on clean input is a game balanced on
 * something that does not exist.
 *
 * The confusions are not random: they are the pairs that share two notes out
 * of three. Am and C are the same hand minus one finger, and the detector does
 * swap them; C and F it never swaps, and that is why they are not in here.
 *
 * Every flaw goes through the seeded generator: the same service, wrong in the
 * same places, every time.
 */

/** Pairs that really do sound alike: two notes out of three in common. */
export const CONFUSIONS = {
  Am: ['C', 'A7'], C: ['Am', 'Em'], Em: ['G', 'C'], G: ['Em', 'G7'],
  Dm: ['F'], F: ['Dm'], E: ['E7'], E7: ['E'], D: ['D7'], D7: ['D'],
  G7: ['G'], A7: ['Am'], B7: ['D7'],
};

export const PROFILES = {
  perfect:        { latency: 0,   jitter: 0,  drop: 0,   wrong: 0,   dirty: 0,   dirtyFar: 0,   double: 0,   bleed: 0,   warmup: 0 },
  'latency-only': { latency: 90,  jitter: 30, drop: 0,   wrong: 0,   dirty: 0,   dirtyFar: 0,   double: 0,   bleed: 0,   warmup: 0 },
  real:           { latency: 90,  jitter: 30, drop: .03, wrong: .05, dirty: .12, dirtyFar: .35, double: .04, bleed: .06, warmup: 300 },
  worst:          { latency: 180, jitter: 60, drop: .06, wrong: .12, dirty: .25, dirtyFar: .50, double: .10, bleed: .10, warmup: 300 },
};

/**
 * Builds the filter. It takes a clean event and gives back zero, one or two
 * dirty ones, and it gives them back as a list because a real flaw can also
 * *add* something, not only spoil what is there.
 *
 * `far(ev)` says whether that strum is a hard change: the caller knows it (it
 * has the engine underneath), this file does not, and that is as it should be.
 */
export function createFlaws(profile, rand, opts) {
  const p = typeof profile === 'string' ? PROFILES[profile] : profile;
  if (!p) throw new Error('unknown profile: ' + profile);
  const o = opts || {};
  const far = o.far || (() => false);
  const pool = o.pool || null;

  return function flaw(ev) {
    // The detector takes a moment to come up. Before that it hears nothing.
    if (ev.at < p.warmup) return [];
    if (rand() < p.drop) return [];

    const out = [];
    const jitter = p.jitter ? (rand() * 2 - 1) * p.jitter : 0;
    const at = Math.max(0, Math.round(ev.at + p.latency + jitter));
    let chord = ev.chord;
    let quality = ev.quality === undefined ? 1 : ev.quality;

    if (chord && rand() < p.wrong) {
      const alt = (CONFUSIONS[chord] || pool || []).filter((c) => c !== chord);
      if (alt.length) chord = alt[Math.floor(rand() * alt.length) % alt.length];
    }
    const threshold = far(ev) ? p.dirtyFar : p.dirty;
    if (rand() < threshold) quality = Math.min(quality, 0.6);

    out.push(Object.assign({}, ev, { chord, quality, at, heardAt: ev.at }));

    // The double: one strum heard twice. The game has to take it on its own,
    // with no filter upstream, because it really does happen.
    if (rand() < p.double) {
      out.push(Object.assign({}, out[0], { at: at + 40 + Math.round(rand() * 40), double: true }));
    }
    // The bleed: neighbouring strings ringing on their own. It is not a chord,
    // and it is exactly the `chord: null` case of the contract.
    if (rand() < p.bleed) {
      out.push({ chord: null, quality: 0.3, at: at + 60 + Math.round(rand() * 120), heardAt: ev.at, bleed: true });
    }
    return out;
  };
}
