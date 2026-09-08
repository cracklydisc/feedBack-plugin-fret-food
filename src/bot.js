/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE AUTOMATIC PLAYER, and it is not a help for whoever is playing.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * This file exists to measure. Fret Food is tuned on the question "how far up do
 * you get?", and that question has no answer until somebody plays a hundred
 * whole services with the detector getting one chord in twenty wrong. A human
 * does not do it: you get tired at the third attempt, and two of your services
 * are never the same service.
 *
 * So the bot comes in through the same door as everybody else,
 * `port.emit('strum')`, and goes through the same flaws of the ear. One that
 * called `game.strum()` straight would measure a game nobody will ever play.
 *
 * ── WHAT IT SEES ───────────────────────────────────────────────────────
 *
 * It reads the engine's state, but only the things that are on the screen as
 * well: the heat of the pots, the height of the flames, the shape the hand is
 * holding now, the empty seat where somebody is about to sit down. It does not
 * read the seed, it does not know which dish will arrive, it touches nothing.
 *
 * ── AND WHAT IT HAS TO MODEL IS A HAND ────────────────────────────────
 *
 * The game asks for one thing: play the chord the ticket wants, and it cooks.
 * A bot that did only that would answer instantly and measure a game nobody
 * can play, because the part that takes time on a guitar is not the strum, it
 * is getting the fingers there. So the bot spends `MIN_GAP_MS` on any change
 * and `PER_FINGER_MS` more for every finger that has to move — C to Am is one
 * finger and C to F is four, and the second one really does take three times
 * as long. That is the same quantity the engine's `FINGER_GRACE` pays out on
 * the other side, which is what makes the measurement fair: the hand is slower
 * on a hard change and the clock is kinder to it.
 *
 * It used to model something else entirely — two hits, then a whole beat of
 * STAYING STILL while three other pots cooled — because the rule used to be a
 * bar of strums and a rest. That rule could not survive a microphone: see the
 * long note in `engine.js` about why counting strums is not a measurement this
 * input can make.
 */

import { dist } from './menu.js';

/**
 * The player. `decide(t)` returns `null` (I am not playing) or the strum to
 * play now; whoever calls it gets that to the engine however it likes.
 *
 * Options: `panicLife` (seconds below which a pot is worth going to first),
 * `minGapMs` and `perFingerMs` (how fast the modelled hand changes chord),
 * `align`, `reactionMs`.
 */
export function createBot(game, opts) {
  const o = opts || {};
  const S = game.state;
  const R = game.rules;
  const panicLife = o.panicLife === undefined ? 2.5 : o.panicLife;
  const align = !!o.align;
  const reactionMs = o.reactionMs || 0;
  const quality = o.quality === undefined ? 1 : o.quality;
  /* The hand, in milliseconds. Any change costs the first number and every
   * finger that has to move costs the second: a one-finger change lands in
   * about a third of a second and a four-finger barre takes twice that, which
   * is roughly a beginner's speed on a real neck. They are options so a test
   * can ask "and what if the player were quicker?" */
  const MIN_GAP_MS = o.minGapMs === undefined ? 260 : o.minGapMs;
  const PER_FINGER_MS = o.perFingerMs === undefined ? 90 : o.perFingerMs;

  /* No phases: the game has none. Play the chord that pays, wait for the hand
   * to arrive at the next one, play that. */
  let lastPlayed = null;
  let lastAt = -1e9;                 // the last strum PLAYED, on my own clock
  let holdUntil = reactionMs;

  const wants = (st) => game.wants(st);
  function count(chord) {
    let n = 0;
    for (const st of S.stations) if (st.order && wants(st) === chord) n++;
    return n;
  }

  /** There is a pot dying and it wants another chord. */
  function dying(chord) {
    const silent = game.silent();
    for (const st of S.stations) {
      if (!st.order || wants(st) === chord) continue;
      if (game.life(st, silent) < panicLife) return true;
    }
    return false;
  }

  /**
   * The chord that pays right now: ten points for every pot that wants it,
   * minus the life of the one closest to dying.
   *
   * The two terms fight on purpose. The ten makes it prefer the doubles, which
   * are the only play the game really rewards; the subtracted life makes it
   * choose, with pots equal, the one about to go out. One dying in three
   * seconds beats a comfortable double, and it has to be that way: one customer
   * lost in three closes the service, a missed double does not.
   *
   * The third term is the beat lost waiting for the hand on a far change, and
   * it is not an elegant number: it is a measured one. Over ten seeds, taking
   * it from 0 to 12, the average takings with the perfect detector rise from
   * 6567 to 8211 and the wasted rests drop from one in four to one in ten; past
   * 12 nothing changes any more. It is worth more than a whole pot because the
   * still beat is not only time lost: it is time in which ALL the pots go down,
   * and the ones that go below the line then cost one strum more each. Whoever
   * has only far changes in front of them pays it anyway: the cost is taken off
   * everybody, so it blocks nothing.
   */
  function choose(t0) {
    const silent = game.silent();
    let best = null, bestScore = -Infinity;
    for (const st of S.stations) {
      if (!st.order) continue;
      const c = wants(st);
      if (c === best) continue;
      let n = 0, low = Infinity;
      for (const other of S.stations) {
        if (!other.order || wants(other) !== c) continue;
        n++;
        const l = game.life(other, silent);
        if (l < low) low = l;
      }
      /* Ten for every pot that wants it, minus the life of the one closest to
       * going out, minus what the change costs the hand. That last term used
       * to be a flat penalty for a far change made inside a beat, because such
       * a change came out dirty; the dirt is gone and the TIME is not — every
       * finger that has to move is time all the other pots spend cooling. */
      let score = 10 * n - low - dist(S.hand, c) * 1.5;
      // The tie breaks on the name: two equal services have to stay equal.
      if (score > bestScore || (score === bestScore && c < best)) { bestScore = score; best = c; }
    }
    return best;
  }

  /**
   * Somebody is about to sit down.
   *
   * Waiting for them is not a blind bet: `pickDish` picks on purpose, four
   * times out of ten from level 2 on, a dish that starts where somebody else
   * already is. The customer on the way often wants exactly the chord in my
   * hand, and cooking them together is worth twice cooking them one after the
   * other. The wait is short by construction: an empty seat fills within a
   * beat or it is not waited for.
   */
  function seating(t) {
    for (const st of S.stations) {
      if (st.order) continue;
      if (st.seatAt >= t && st.seatAt - t <= R.BEAT_MS) return true;
    }
    return false;
  }

  function hit(t, chord) {
    lastAt = t;
    lastPlayed = chord;
    return { chord, quality };
  }

  /**
   * How long this hand needs before it can play `chord`.
   *
   * A change is fingers moving, and the fingers that move are exactly what
   * `dist` counts. Nothing here is a game rule: it is a model of an arm, and
   * it is the reason the bot's numbers mean anything. Without it the bot plays
   * a chord every frame and reports a game in which nobody is ever late.
   */
  const handMs = (chord) => MIN_GAP_MS + dist(S.hand, chord) * PER_FINGER_MS;

  function decide(t) {
    if (!S.running) return null;
    if (t < holdUntil) return null;
    const chord = choose(t);
    if (!chord) return null;
    if (t - lastAt < handMs(chord)) return null;
    /* `align`: with one pot here and somebody about to sit down, a beat of
     * waiting can be worth a double — two cards turning over on one chord.
     * `dying(null)` asks "is anybody going out?", and since no pot wants the
     * chord `null` it looks at them all: whoever is going out waits for
     * nobody. */
    if (align && count(chord) === 1 && seating(t) && !dying(null)) return null;
    return hit(t, chord);
  }

  return {
    decide,
    /** For whoever is watching the play: what it is doing now. */
    get chord() { return lastPlayed; },
  };
}

/**
 * The bot plugged into the port, with the same contract as the scripted one:
 * it is pumped from the game loop and spits out strums.
 *
 * The events go through `flaws` like all the others, and the `pending` queue is
 * there for the same reason: a flaw can move a strum forward in time or split
 * it in two, and whoever receives it has to see it arrive at that time.
 */
export function botAdapter(port, game, opts) {
  const o = opts || {};
  const bot = createBot(game, o);
  const flaw = o.flaws || ((ev) => [ev]);
  const pending = [];

  return {
    kind: 'bot',
    bot,
    start() { port.emit('status', { ready: true, source: port.source, reason: 'bot' }); },
    stop() { port.emit('status', { ready: false, source: port.source, reason: 'bot over' }); },
    pump(t) {
      const move = bot.decide(t);
      if (move) for (const ev of flaw({ at: t, chord: move.chord, quality: move.quality })) pending.push(ev);
      if (pending.length > 1) pending.sort((a, b) => a.at - b.at);
      while (pending.length && pending[0].at <= t) {
        const ev = pending.shift();
        port.emit('strum', Object.assign({ source: port.source, quality: 1 }, ev));
      }
      return false;
    },
    get remaining() { return pending.length; },
  };
}
