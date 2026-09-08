/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE PORT: where the chords come from, and why the game must not know.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The engine gets `strum(chord, quality)` and nothing more. Whoever calls it
 * can be the real detector, the keyboard, or a SCRIPT: a whole service with
 * nobody sitting in front of it. The third one is why this file exists: a game
 * you drive by playing cannot be tested by hand every time a number moves, and
 * without a fake source the level curve and the scores are checked by eye,
 * which is to say not checked at all.
 *
 * ── THE TRAP ────────────────────────────────────────────────────────────
 *
 * A perfect fake source tests a game that does not exist. The real detector
 * arrives late, now and then it hears the wrong chord, now and then it hears
 * nothing at all, and often it hears a dirty strum. That is why the scripted
 * source goes through the same flaws (see `flaws.js`): a service that holds
 * together only on clean input is a service that will break the day somebody
 * plugs a guitar in.
 *
 * ── THE CONTRACT ────────────────────────────────────────────────────────
 *
 *   'strum'  { chord, quality, at, heardAt, source, raw }
 *            `chord: null` = something was heard that is not a chord of this
 *            game. The engine treats it as a miss, with no special case
 *            anywhere.
 *   'status' { ready, source, reason }
 *
 * No adapter emits rests. A rest is silence, and silence is measured by
 * `tick()` inside the engine: it is the only place that knows what time it is.
 */

export function createPort(source) {
  const fns = { strum: new Set(), status: new Set() };
  let candidates = [];
  let ready = false;

  return {
    source,
    on(type, fn) {
      const set = fns[type];
      if (!set) throw new Error('the port does not know "' + type + '"');
      set.add(fn);
      return () => set.delete(fn);
    },
    emit(type, ev) {
      const set = fns[type];
      if (!set) return;
      if (type === 'status') ready = !!ev.ready;
      for (const fn of set) { try { fn(ev); } catch (_) { /* a broken listener does not stop the service */ } }
    },
    /** The chords somebody wants right now. The detector reads them to know
     *  what to listen for; the other adapters ignore them. */
    setCandidates(list) {
      const next = [...new Set(list || [])].sort();
      if (next.join() === candidates.join()) return false;
      candidates = next;
      return true;
    },
    get candidates() { return candidates; },
    get ready() { return ready; },
  };
}
