/*
 * The clock, in two versions with the same face.
 *
 * The real one runs on the monitor and is not regular; the fake one takes a
 * step when it is told to. The game cannot tell which of the two it is
 * wearing, and that is the reason a ten minute service is tested in twenty
 * milliseconds.
 *
 * The step is fixed at 10 ms for both. A fixed step is not fussiness: the rest
 * fires 750 ms after the last strum, and with a `dt` that follows the frames
 * the exact same input would give different results on two monitors.
 */

export const STEP_MS = 10;

/** Rounds an instant onto the step grid: this way two runs of the same service
 *  land on the same ticks even when they start from real times. */
export const quantize = (t) => Math.round(t / STEP_MS) * STEP_MS;

/**
 * The real clock. It piles up frame time and spends it in fixed steps, with a
 * ceiling: if the tab comes back to the front after a minute, six thousand
 * ticks are not made up inside one frame, that time is lost and that is that.
 * A game on pause is on pause, not in debt.
 */
export function createClock(opts) {
  const o = opts || {};
  const raf = o.raf || ((fn) => requestAnimationFrame(fn));
  const cancel = o.cancelRaf || ((h) => cancelAnimationFrame(h));
  const now = o.now || (() => performance.now());
  const MAX_FRAME = o.maxFrameMs || 250;

  let handle = null, prev = 0, acc = 0, t = 0, onStep = null, onFrame = null;

  /* The loop survives a throw, and says so.
   *
   * `raf(frame)` used to be the last statement, so anything that threw out of
   * a step or a frame took the whole clock with it: the scene kept animating
   * off its own timer while the game stood still at whatever millisecond it
   * had reached, with nothing on the screen and nothing in the console to say
   * why. A frozen game that looks alive is the worst failure this file can
   * have, so the loop is re-armed first and the fault is reported once, with
   * its stack, instead of silently ending the service.
   *
   * It reports once per kind of fault and then counts: a bug in the drawing
   * would otherwise print sixty times a second and bury itself. */
  const seen = new Map();
  function complain(where, e) {
    const key = where + ':' + ((e && e.message) || e);
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    if (n === 1) {
      try { console.error('[fret-food] the ' + where + ' threw; the clock is carrying on:', e); } catch (_) { /* no console */ }
    }
  }

  function frame() {
    handle = raf(frame);
    const p = now();
    const dt = Math.min(MAX_FRAME, p - prev);
    prev = p;
    acc += dt;
    while (acc >= STEP_MS) {
      t += STEP_MS;
      acc -= STEP_MS;
      if (onStep) {
        try { onStep(STEP_MS, t); } catch (e) { complain('game step', e); }
      }
    }
    if (onFrame) {
      try { onFrame(t); } catch (e) { complain('frame', e); }
    }
  }

  /** What the loop has swallowed, for the console and for a test. */
  function faults() {
    return [...seen.entries()].map(([key, n]) => ({ key, n }));
  }

  return {
    kind: 'real',
    now: () => t,
    faults,
    start(step, render) {
      onStep = step; onFrame = render;
      prev = now(); acc = 0;
      if (handle === null) handle = raf(frame);
    },
    stop() { if (handle !== null) { cancel(handle); handle = null; } },
    get running() { return handle !== null; },
  };
}

/** The fake clock: it moves only when it is asked to. */
export function createVirtualClock() {
  let t = 0, onStep = null, onFrame = null;
  return {
    kind: 'virtual',
    now: () => t,
    start(step, render) { onStep = step; onFrame = render; },
    stop() { onStep = null; onFrame = null; },
    /** Lets `ms` milliseconds go by, one step at a time. */
    advance(ms) {
      let left = Math.max(0, ms);
      while (left >= STEP_MS) { t += STEP_MS; left -= STEP_MS; if (onStep) onStep(STEP_MS, t); }
      if (onFrame) onFrame(t);
    },
    get running() { return true; },
  };
}
