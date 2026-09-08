/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE KEYBOARD: the guitar that is always there.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * It is here for two things, and neither of them is "playing without a
 * guitar".
 *
 * The first: trying the game by hand when the guitar is not around or the
 * detector will not start. The script tests a service decided beforehand; the
 * keyboard tests what the script cannot, which is a human getting it wrong
 * whenever they feel like it.
 * The second: `0`. It switches on the flaws of the ear (`flaws.js`, profile
 * `real`) over a clean input, so you can see what a service sounds like with
 * latency, doubles and bleeds without plugging anything in. The same switch
 * exists on the real detector: it is the only way to tell whether a problem
 * belongs to the game or to the ear.
 *
 * ── WHY IT DOES NOT GO THROUGH THE APP'S SHORTCUT REGISTRY ──────────────
 *
 * `kit/shortcuts.js` wraps `window.registerShortcut`, and it is the right
 * thing for a COMMAND: one entry, one description, and the app lists it in the
 * `?` panel. Here the keys are an INSTRUMENT instead, and an instrument asks
 * for three things a command registry does not give:
 *
 *   - `e.repeat`: holding a key down is not a strum repeated at 300 Hz.
 *     Without the event in hand there is no way to throw it away.
 *   - `Ctrl+c` and `c` are the SAME key played two ways (clean and dirty), not
 *     two different commands.
 *   - the tests: `register()` gives back an empty function when
 *     `window.registerShortcut` is missing, so an adapter built on that alone
 *     cannot be tested outside the app. Here the listener target comes in
 *     through `opts.target`, and in a test it is a fake `EventTarget` with no
 *     DOM around it.
 *
 * What is left of the kit is what is really needed: `isTaken()`, to notice
 * that the app has helped itself to one of our letters instead of finding out
 * when a player presses `c` and the app's player does something else.
 */

import { createFlaws } from './flaws.js';
import { isTaken } from '../kit/shortcuts.js';

/* The letters are the degrees in C: c d e f g a b -> I ii iii IV V vi vii.
 * It is not a map picked at random, it is the scale: whoever knows where `a`
 * sits knows it is the sixth degree, and Am is the sixth degree of C. The
 * numbers are the sevenths, which have no letter left free on the keyboard. */
export const KEYS = {
  c: 'C', d: 'Dm', e: 'Em', f: 'F', g: 'G', a: 'Am', b: 'B7',
  1: 'A7', 2: 'D7', 3: 'E7', 4: 'G7',
  // The flats have no letter of their own, so they take the two spare digits.
  5: 'Bb', 6: 'Eb',
};

/* Held down, the letter gives the OTHER chord of that name: the major where
 * the plain key is a minor, the minor where it is a major, and the sharp minor
 * on the two letters whose barre shape the game asks for. The capital is the
 * same letter "pulled up", which is roughly what the ear does.
 *
 * Every shape in `SHAPES` has to be reachable from the keyboard — that is how
 * the game is tested without a guitar plugged in — and `tests/input.test.js`
 * falls over if a chord is added and given no key. */
export const SHIFT_KEYS = { d: 'D', e: 'E', a: 'A', b: 'Bm', f: 'F#m', c: 'C#m' };

/**
 * Which key plays a chord, printable.
 *
 * The guitar path is blocked by the host (see `detector.js`), so today the game
 * is played from the keyboard — and nineteen shapes across letters, capitals
 * and digits is not something anybody holds in their head. The scene prints
 * this beside the chord a ticket owes when the keyboard is what is talking, so
 * the answer is on the card instead of in the README.
 *
 * `null` for a chord with no key, which `tests/input.test.js` refuses to let
 * happen.
 */
export function keyFor(chord) {
  for (const k of Object.keys(KEYS)) if (KEYS[k] === chord) return String(k).toUpperCase();
  for (const k of Object.keys(SHIFT_KEYS)) if (SHIFT_KEYS[k] === chord) return '^' + String(k).toUpperCase();
  return null;
}

export const NULL_KEY = 'x';       // a strum nobody wants: it tests the holes
export const FLAWS_KEY = '0';      // switches the imperfect ear on and off
export const DIRTY_QUALITY = 0.6;  // under 0.8 the engine calls it dirty

/* A real strum does not repeat more than fifteen or so times a second, and the
 * bounce of a key under a playing finger comes much thicker than that. 60 ms
 * takes nothing away from anybody and takes away the involuntary tremolo. */
export const DEBOUNCE_MS = 60;

/** Is the focus inside a text field? Then the keyboard is not an instrument:
 *  it is a keyboard. Without this, the player typing their name into the
 *  leaderboard plays half the menu while they type it. */
function typing(target) {
  const doc = (target && (target.ownerDocument || target.document)) || target;
  const el = doc && doc.activeElement;
  if (!el) return false;
  const tag = String(el.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (el.isContentEditable) return true;
  const attr = typeof el.getAttribute === 'function' ? el.getAttribute('contenteditable') : null;
  return attr !== null && attr !== undefined && attr !== 'false';
}

/** The letters the app has already taken. Empty outside the app: the registry
 *  lives on `window`, and the tests run in Node. */
function stolen(keys) {
  if (typeof window === 'undefined' || typeof window.getAllShortcuts !== 'function') return [];
  try { return keys.filter((k) => isTaken(k)); } catch (_) { return []; }
}

/**
 * The adapter. Same shape as `createScriptedAdapter`, minus `pump()`: here the
 * time is made by the player.
 *
 * `opts.target` is whoever brings the `keydown` events (normally `document`),
 * `opts.now` what time it is, `opts.rand` the generator for the flaws,
 * `opts.later`/`opts.cancel` the timers. They are all injectable for the same
 * reason the engine has no clock of its own: a test that depends on the DOM
 * and on the real time of day is not a test.
 */
export function createKeysAdapter(port, opts) {
  const o = opts || {};
  const target = o.target || (typeof document !== 'undefined' ? document : null);
  const now = o.now || (() => Date.now());
  const rand = o.rand || Math.random;
  const later = o.later || ((fn, ms) => setTimeout(fn, ms));
  const cancel = o.cancel || ((id) => clearTimeout(id));

  const clean = (ev) => [ev];
  let flaw = o.flaws || clean;
  let running = false;
  const last = new Map();          // physical key -> when we heard it
  const pending = new Set();       // strums running late because of the flaws

  /* The flaws can push an event into the future, and a shift nobody waits for
   * is not a delay: it is only a different number in `at`. The engine reads
   * its own clock, not ours, so the latency exists only if the strum ARRIVES
   * later. Hence the timer. */
  function send(ev) {
    port.emit('strum', Object.assign({ source: port.source, quality: 1 }, ev));
  }

  function fire(chord, quality) {
    const at = now();
    for (const ev of flaw({ chord, quality, at, heardAt: at })) {
      const wait = Math.max(0, (ev.at === undefined ? at : ev.at) - at);
      if (!wait) { send(ev); continue; }
      const slot = {};
      pending.add(slot);
      slot.id = later(() => { pending.delete(slot); send(ev); }, wait);
    }
  }

  function onKey(e) {
    if (!e || e.repeat) return;                 // held down is not played
    if (e.altKey || e.metaKey) return;          // system business, not ours
    if (typing(target)) return;

    const raw = String(e.key === undefined ? '' : e.key);
    const slot = raw.toLowerCase();             // Ctrl+c, Shift+c and c: one key
    const chord = e.shiftKey
      ? SHIFT_KEYS[slot]
      : (Object.prototype.hasOwnProperty.call(KEYS, slot) ? KEYS[slot] : undefined);
    const known = chord !== undefined || slot === NULL_KEY || slot === FLAWS_KEY;
    if (!known) return;

    const t = now();
    const prev = last.get(slot);
    if (prev !== undefined && t - prev < DEBOUNCE_MS) return;
    last.set(slot, t);

    /* From here on the key is ours. Without this, `Ctrl+a` selects the whole
     * page and `Ctrl+f` opens the search while a pot is cooking. */
    if (typeof e.preventDefault === 'function') e.preventDefault();

    if (slot === FLAWS_KEY) {
      flaw = flaw === clean ? createFlaws('real', rand) : clean;
      port.emit('status', {
        ready: true, source: port.source,
        reason: flaw === clean ? 'perfect ear' : 'real ear',
      });
      return;
    }
    const q = e.ctrlKey ? DIRTY_QUALITY : 1;
    fire(slot === NULL_KEY ? null : chord, q);
  }

  return {
    kind: 'keyboard',
    start() {
      if (running) return;                      // two start() calls = one listener
      running = true;
      if (target && typeof target.addEventListener === 'function') {
        target.addEventListener('keydown', onKey);
      }
      const taken = stolen(Object.keys(KEYS).concat(Object.keys(SHIFT_KEYS), NULL_KEY, FLAWS_KEY));
      if (taken.length) console.warn('[fret-food] keys taken by the app: ' + taken.join(' '));
      port.emit('status', { ready: true, source: port.source, reason: 'keyboard' });
    },
    stop() {
      /* It always detaches, even if it never started: a listener left behind
       * on `document` plays by itself in the next service. */
      if (target && typeof target.removeEventListener === 'function') {
        target.removeEventListener('keydown', onKey);
      }
      for (const slot of pending) { try { cancel(slot.id); } catch (_) { /* already fired */ } }
      pending.clear();
      last.clear();
      if (!running) return;
      running = false;
      port.emit('status', { ready: false, source: port.source, reason: 'keyboard off' });
    },
    get flawed() { return flaw !== clean; },
  };
}
