/*
 * The written service: nobody at the keyboard, no guitar.
 *
 * `events` is a list of `{ at, chord }` in game milliseconds. It has no clock
 * of its own: it is the game loop that asks it "we are at t, what happened?".
 * That way a ten minute service runs inside a test in a few milliseconds, and
 * two runs give the exact same result.
 *
 * The events go through the flaw filter before they come out, so the script
 * can arrive late, double up or get the chord wrong exactly the way the real
 * detector will.
 */

/**
 * The gesture the game rewards, written as events: two strums half a beat
 * apart and then silence. The silence is not an event: it is what is missing,
 * and that is the point.
 *
 * This is not a convenience for the tests: it is the executable definition of
 * the rhythm. If one day the rhythm changes, it changes here, and the tests
 * follow it.
 */
export function cook(chord, opts) {
  const o = opts || {};
  const beat = o.beat || 750;
  const hits = o.hits || 2;
  const at = o.at || 0;
  const out = [];
  for (let k = 0; k < hits; k++) out.push({ at: at + k * (beat / 2), chord, quality: o.quality });
  return out;
}

/**
 * A whole dish: one cycle for every step of the recipe.
 *
 * Three beats a step, and the third one is not generosity. After the rest the
 * hand has to have time to reach the next shape: without that beat the engine
 * files the change as rushed, the chord comes out dirty, and a dirty cycle
 * does not get above the line. A tighter sequence cooks nothing, and nobody
 * says so unless it is written down here.
 */
export function dish(steps, opts) {
  const o = opts || {};
  const beat = o.beat || 750;
  const at = o.at || 0;
  const out = [];
  steps.forEach((chord, k) => { out.push(...cook(chord, { at: at + k * beat * 3, beat, hits: o.hits })); });
  return out;
}

/** How long a dish written with `dish` lasts, closing rest included. */
export function dishDuration(steps, opts) {
  const beat = (opts && opts.beat) || 750;
  return steps.length * beat * 3;
}

/**
 * The adapter. It plugs into the port like every other one; the only
 * difference is that the game loop has to pump it instead of it listening to
 * the world.
 */
export function createScriptedAdapter(port, opts) {
  const o = opts || {};
  const raw = (o.events || []).slice().sort((a, b) => a.at - b.at);
  const flaw = o.flaws || ((ev) => [ev]);
  const pending = [];
  let i = 0;

  return {
    kind: 'script',
    start() { port.emit('status', { ready: true, source: port.source, reason: 'script' }); },
    stop() { port.emit('status', { ready: false, source: port.source, reason: 'script over' }); },
    /** Call it from the loop with the current game time. */
    pump(t) {
      while (i < raw.length && raw[i].at <= t) {
        for (const ev of flaw(raw[i])) pending.push(ev);
        i++;
      }
      pending.sort((a, b) => a.at - b.at);
      while (pending.length && pending[0].at <= t) {
        const ev = pending.shift();
        port.emit('strum', Object.assign({ source: port.source, quality: 1 }, ev));
      }
      return i >= raw.length && pending.length === 0;
    },
    get remaining() { return raw.length - i + pending.length; },
  };
}
