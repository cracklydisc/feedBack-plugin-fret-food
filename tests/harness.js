/*
 * The bench. It is not a test file: it is what runs a whole service with no
 * browser, no guitar and nobody in front of it.
 *
 * It mounts the real chain (script, flaws, port, engine) because a test that
 * calls `game.strum()` by hand tests the engine and does not test the game.
 */

import { createGame, RULES } from '../src/engine.js';
import { MENU, LEVELS, dist } from '../src/menu.js';
import { createPort } from '../src/input/port.js';
import { createFlaws } from '../src/input/flaws.js';
import { createScriptedAdapter } from '../src/input/scripted.js';
import { STEP_MS } from '../src/clock.js';

export const B = RULES.BEAT_MS;

/** The same generator the engine uses, here for the flaws: same seed, same
 *  service going wrong in the same places. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * A game with the kitchen already OPEN.
 *
 * The real kitchen waits for the first chord before anything cools or any
 * clock runs (`open()` in the engine). The bench measures a kitchen that is
 * running, so it opens it here; the one test about the wait builds its game
 * without this helper.
 */
export function newGame(over) {
  const g = createGame(Object.assign({ menu: MENU, levels: LEVELS, seed: 42 }, over || {}));
  g.open();
  return g;
}

/**
 * One station on its own, with the burner we choose and the pot at the heat
 * that is left after a step cooks. It is there to test the rhythm rule at
 * every height of flame without waiting five minutes of service.
 */
export function onePot(opts) {
  const o = opts || {};
  const g = createGame({
    menu: [o.dish || {
      id: 'p', dish: 'Test', steps: o.steps || ['C', 'Am'], rn: '', price: 10, level: 1,
      pan: 'saucepan', ingredients: (o.steps || ['C', 'Am']).map(() => 'water'),
    }],
    levels: [{ stations: 1, maxSteps: 8, step: 0, burnerBoost: 0 }],
    seed: o.seed || 1,
    rules: o.rules,
  });
  g.open();                             // the bench measures a kitchen that is running
  g.tick(STEP_MS);                      // the customer sits down
  const st = g.state.stations[0];
  st.burner = o.burner === undefined ? 2.4 : o.burner;
  if (o.heat !== undefined) st.heat = o.heat;
  /* A game that has just been created has never heard a strum, so the engine
   * takes it to be SILENT and cools at double rate. That is not the state a
   * freshly cooked pot is in: there the player has just played. Without this
   * line the bench measures a kitchen twice as cruel as the real game, and the
   * tests on the rhythm turn into lies. */
  g.state.lastHitAt = g.state.t;
  g.state.lastEventAt = g.state.t;
  return { game: g, st };
}

/**
 * A game with every place its level allows already open.
 *
 * The service opens with ONE pan and adds another every `RULES.OPEN_MS`, which
 * is a rule about pacing and not about anything most of these tests are
 * checking. `OPEN_MS: 0` opens them as fast as the level table allows, so a
 * test about two pots wanting the same chord can have two pots without waiting
 * half a minute of game time for the second — or, worse, without the service
 * striking out first, because nobody is playing it.
 */
export function wideOpen(over) {
  return newGame(Object.assign({}, over, { rules: Object.assign({ OPEN_MS: 0 }, (over || {}).rules) }));
}

/**
 * Runs a service. It collects every engine event in order: it is the log the
 * invariants and the balance are measured on.
 */
export function play(game, opts) {
  const o = opts || {};
  const seed = o.seed || 7;
  const log = [];
  const NAMES = ['seat', 'strum', 'miss', 'open', 'cycle', 'step', 'serve', 'ruin', 'redeem', 'perfect', 'level', 'chainLost', 'over'];
  for (const n of NAMES) game.on(n, (e) => log.push(Object.assign({ ev: n, t: game.state.t }, e)));

  const port = createPort(o.source || 'script');
  const rand = rng(seed + 1);
  const flaws = o.profile
    ? createFlaws(o.profile, rand, {
      // "far" is known only by whoever has the engine to hand: it is the change
      // from the shape the hand is holding now to the one it is about to make,
      // and it is exactly what the real detector hears worst.
      far: (ev) => dist(game.state.hand, ev.chord) >= game.rules.RUSH_COST,
    })
    : undefined;

  const adapter = createScriptedAdapter(port, { events: o.events || [], flaws });
  port.on('strum', (ev) => game.strum(ev.chord, ev.quality));
  const sync = () => port.setCandidates(game.snapshot().wants);
  for (const n of ['seat', 'step', 'serve', 'ruin']) game.on(n, sync);
  adapter.start();
  sync();

  const ms = o.ms === undefined ? 30000 : o.ms;
  for (let t = 0; t < ms; t += STEP_MS) {
    if (!game.state.running && o.stopOnOver !== false) break;
    adapter.pump(game.state.t);
    game.tick(STEP_MS);
  }
  return { log, port, adapter, snapshot: game.snapshot() };
}

/** Counts the events of one kind in the log. */
export const count = (log, ev) => log.filter((e) => e.ev === ev).length;
export const only = (log, ev) => log.filter((e) => e.ev === ev);
