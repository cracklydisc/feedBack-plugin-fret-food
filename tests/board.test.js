/*
 * What the screen is allowed to show.
 *
 * Everything on a game screen has to come from somewhere. A star rating, a
 * queue of faces at the door, a combo counter: if the engine does not produce
 * them, the drawing invents them, and invented numbers are worse than no
 * numbers because they look exactly as real as the true ones.
 *
 * So each of these tests pins one thing the screen shows to the rule that
 * produces it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, RULES } from '../src/engine.js';
import { LEVELS, NAMES, FACES } from '../src/menu.js';
import { STEP_MS } from '../src/clock.js';
import { B, newGame, wideOpen, onePot, play, only } from './harness.js';

const step = (g, ms) => { for (let t = 0; t < ms; t += STEP_MS) g.tick(STEP_MS); };

// ── who is at the counter ────────────────────────────────────────────────

test('a customer has a name and a face, and keeps them while they sit', () => {
  // The counter opens with one place and grows, so a counter with more than
  // one customer at it is a state the service arrives at, not one it starts in.
  const g = wideOpen({ seed: 21 });
  step(g, 3000);
  const seated = g.snapshot().stations.filter((s) => s.dish);
  assert.ok(seated.length >= 2, 'the opening level should reach two places');
  for (const s of seated) {
    assert.ok(NAMES.includes(s.name), 'unknown name: ' + s.name);
    assert.ok(s.face >= 0 && s.face < FACES, 'no portrait for ' + s.name);
  }
  /* Whoever is STILL sitting there has to be the same person, which is not
   * the same claim as "everybody is still sitting there". This used to compare
   * the two lists head to head, and it passed only because a pot could be left
   * alone for four seconds: a pot is a clock now, ten seconds of life and half
   * that in silence, so a customer nobody plays for does leave. That is the
   * game working. The identity is what this test is about. */
  const before = new Map(g.snapshot().stations.filter((s) => s.dish).map((s) => [s.i, s.name + '/' + s.face]));
  step(g, 1800);
  let checked = 0;
  for (const s of g.snapshot().stations) {
    if (!s || !s.dish || !before.has(s.i)) continue;
    assert.equal(s.name + '/' + s.face, before.get(s.i), 'a seated customer must not change face');
    checked++;
  }
  assert.ok(checked >= 1, 'somebody has to still be sitting there for this to have checked anything');
});

test('an empty station has nobody, not a leftover name', () => {
  // Before the first tick: the place exists, the customer has not walked in.
  const g = newGame({ seed: 4 });
  const empty = g.snapshot().stations.filter((s) => !s.dish);
  assert.ok(empty.length > 0, 'a place that has just opened has nobody at it yet');
  for (const s of empty) {
    assert.equal(s.name, null);
    assert.equal(s.face, -1);
    assert.equal(s.stars, 0);
  }
});

test('the queue is always full, and it holds people and not orders', () => {
  const g = newGame({ seed: 8 });
  step(g, 5000);
  const q = g.snapshot().queue;
  assert.equal(q.length, RULES.QUEUE, 'the doorway should always look busy');
  for (const person of q) {
    assert.ok(NAMES.includes(person.name));
    assert.ok(person.face >= 0 && person.face < FACES);
    // What they will order is decided when they sit down, because that choice
    // needs to see the counter. A dish in the queue would be a promise the
    // engine cannot keep.
    assert.equal(person.dish, undefined, 'the queue must not carry a dish');
  }
});

test('sitting down takes the person at the front of the queue', () => {
  const g = newGame({ seed: 15 });
  const next = g.snapshot().queue[0].name;
  const seated = only(play(g, { events: [], ms: 1000 }).log, 'seat');
  assert.ok(seated.length >= 1);
  assert.equal(seated[0].who.name, next, 'the first to sit should be the first in line');
});

// ── the stars ────────────────────────────────────────────────────────────

test('stars are the soot and nothing else, so they agree with the tip', () => {
  /* Five steps, because every chord heard cooks one: a test that wanted four
   * marks of soot on one dish used to play the same chord four times, and
   * playing the same chord four times now cooks four different steps. */
  const { game, st } = onePot({ steps: ['C', 'Am', 'C', 'Am', 'C'], burner: 2.4 });
  assert.equal(game.snapshot().stations[0].stars, RULES.STARS, 'a clean pot is worth full marks');

  game.strum('C', 0.6);                            // scored badly: one soot
  assert.equal(st.soot, 1);
  assert.equal(game.snapshot().stations[0].stars, RULES.STARS - 1);

  game.strum('Am', 0.6);
  game.strum('C', 0.6);
  game.strum('Am', 0.6);                           // soot caps
  assert.equal(st.soot, RULES.SOOT_MAX);
  assert.equal(game.snapshot().stations[0].stars, RULES.STARS - RULES.SOOT_MAX,
    'the worst dish still gets some stars, because zero reads as broken');
});

test('a dish served on full stars is the dish that got the tip', () => {
  // Cook one dish and check the stars and the tip agree at the moment it goes
  // out, because they are two readings of one condition and a screen that
  // showed four stars next to a tip would be lying about which.
  const one = onePot({ steps: ['C'], burner: 2.4, heat: RULES.HEAT_FULL });
  const served = [];
  one.game.on('serve', (e) => served.push(e));
  one.game.strum('C'); step(one.game, 40);
  assert.equal(served.length, 1);
  assert.equal(served[0].stars, RULES.STARS);
  assert.equal(served[0].tip, true, 'full stars and the tip are the same condition');
});

// ── the two counters ─────────────────────────────────────────────────────

test('the combo counts cooked steps and only a mistake breaks it', () => {
  const one = onePot({ steps: ['C', 'Am', 'C', 'Am'], burner: 2.4, heat: RULES.HEAT_FULL });
  const g = one.game;
  // One chord heard is one step cooked: see the long note in `engine.js`.
  const cook = (chord) => { g.strum(chord); step(g, 40); };
  cook('C');
  assert.equal(g.snapshot().combo, 1);
  cook('Am');
  assert.equal(g.snapshot().combo, 2);

  // Standing still costs the chain but must NOT cost the combo: stopping to
  // think is not a mistake, and a streak that punishes thinking punishes
  // exactly the player this game is for.
  step(g, B * 6);
  assert.equal(g.state.chain, 1, 'the chain goes on standing still');
  assert.equal(g.snapshot().combo, 2, 'the combo does not');

  // Three strums nobody wants is a mistake, and that does break it.
  g.strum('B7'); g.strum('B7'); g.strum('B7');
  assert.equal(g.snapshot().combo, 0);
});

test('losing a customer breaks the combo', () => {
  const one = onePot({ steps: ['C', 'Am'], burner: 2.4, heat: RULES.HEAT_FULL, rules: { STRIKES: 100000 } });
  one.game.strum('C'); step(one.game, 40);
  assert.ok(one.game.snapshot().combo > 0);
  step(one.game, 60000);                     // let the pot die
  assert.ok(one.game.state.ruined > 0, 'the pot should have died');
  assert.equal(one.game.snapshot().combo, 0);
});

test('the combo counts both pots when one strum cooks two', () => {
  const g = createGame({
    menu: [{ id: 'x', dish: 'Same', steps: ['C', 'Am'], rn: '', price: 10, level: 1 }],
    levels: [{ name: 'Test', stations: 3, maxSteps: 2, step: 0, burnerBoost: 0 }], seed: 7,
    // The greedy strum is what is under test, not the opening schedule: open
    // the three places at once so the test says what it means.
    rules: { OPEN_MS: 0 },
  });
  g.open();
  step(g, 3000);
  const live = g.state.stations.filter((s) => s.order && g.wants(s) === 'C');
  assert.ok(live.length >= 2, 'two pots should want the same chord');
  for (const st of live) st.heat = RULES.HEAT_FULL;
  g.state.lastHitAt = g.state.t;
  g.state.lastEventAt = g.state.t;
  step(g, B);
  g.strum('C'); step(g, 40);
  assert.equal(g.snapshot().combo, live.length, 'one strum, two cooked, two on the streak');
});

// ── the level ────────────────────────────────────────────────────────────

test('a level has a name, and the takings for that level reset with it', () => {
  const g = newGame({ seed: 5, rules: { STRIKES: 100000 } });
  assert.equal(g.snapshot().levelName, LEVELS[0].name);

  const one = onePot({ steps: ['C'], burner: 2.4, heat: RULES.HEAT_FULL });
  one.game.strum('C'); step(one.game, 40);
  assert.ok(one.game.snapshot().levelCash > 0, 'a dish out means takings on this level');
  assert.equal(one.game.snapshot().levelCash, one.game.snapshot().cash);

  const { log } = play(g, { events: [], ms: RULES.LEVEL_MS + 1000 });
  const up = only(log, 'level')[0];
  assert.ok(up, 'the level should have turned');
  assert.equal(up.name, LEVELS[1].name, 'and the turn should say which service it is');
  assert.equal(g.snapshot().levelName, LEVELS[1].name);
  assert.equal(g.snapshot().levelCash, 0, 'the level takings start again');
});

test('past the last level the last one repeats and the number keeps going', () => {
  /* The threshold has to be far out of reach, and 99 is not: `STRIKES` is a
   * COUNT of lost customers, not a switch that turns losing off, and a counter
   * nobody plays loses one about every two and a half seconds. At 99 the
   * service closes after four minutes, which is before the clock gets here. */
  const g = newGame({ seed: 6, rules: { STRIKES: 100000 } });
  play(g, { events: [], ms: RULES.LEVEL_MS * (LEVELS.length + 1) + 1000 });
  assert.ok(g.state.level > LEVELS.length, 'the number does not stop at the last named level');
  assert.equal(g.snapshot().levelName, LEVELS[LEVELS.length - 1].name);
});

// ── the heat bar ─────────────────────────────────────────────────────────

test('the heat bar and its mark come out of the engine in the same units', () => {
  const { game, st } = onePot({ burner: 2.4, heat: 40 });
  let s = game.snapshot().stations[0];
  assert.equal(s.readyPct, RULES.READY, 'the mark is the rule, not a number the drawing guesses');
  assert.ok(Math.abs(s.heatPct - st.heat) < 0.01);
  assert.equal(s.ready, false);

  st.heat = 90;
  s = game.snapshot().stations[0];
  assert.equal(s.ready, true, 'over the mark the pot is hot');
  assert.ok(s.heatPct <= 100, 'the bar never overflows its own track');
});

// ── the pan fills as the recipe advances ─────────────────────────────────

test('cooking a step drops the next ingredient in the pan', () => {
  const recipe = { id: 'p', dish: 'Test', steps: ['C', 'Am', 'C'], rn: '', price: 10, level: 1,
    pan: 'saucepan', ingredients: ['rice', 'broth', 'butter'] };
  const one = onePot({ dish: recipe, burner: 2.4, heat: RULES.HEAT_FULL });
  const g = one.game;
  const seen = () => g.snapshot().stations[0];

  assert.equal(seen().pan, 'saucepan');
  assert.deepEqual(seen().inPan, [], 'an untouched order has an empty pan');
  assert.equal(seen().nextIn, 'rice', 'and the first thing waiting to go in');

  // One chord heard is one step cooked: see the long note in `engine.js`.
  const cook = (chord) => { g.strum(chord); step(g, 40); };
  cook('C');
  assert.deepEqual(seen().inPan, ['rice']);
  assert.equal(seen().nextIn, 'broth');
  cook('Am');
  assert.deepEqual(seen().inPan, ['rice', 'broth']);
  assert.equal(seen().nextIn, 'butter');
});

test('an empty station has no pan and nothing in it', () => {
  const g = newGame({ seed: 4 });
  step(g, 100);
  for (const s of g.snapshot().stations.filter((x) => !x.dish)) {
    assert.equal(s.pan, null);
    assert.deepEqual(s.inPan, []);
    assert.equal(s.nextIn, null);
  }
});


test('the counter opens with one place and grows one at a time', () => {
  /* The service used to start with three burners lit, which is three chords to
   * hold in your head in the first ten seconds of a game whose rule nobody has
   * explained yet. It starts with one. The rest arrive on a clock, one at a
   * time, capped by what the level table allows — so the counter grows in
   * front of the player instead of arriving. */
  /* A table of its own: the schedule is under test, not the real one, which
   * keeps two pans for six services while the shapes are climbed. */
  const table = [{ name: 'T', stations: 5, maxSteps: 4, step: 0, burnerBoost: 0 }];
  const g = newGame({ seed: 5, levels: table });
  assert.equal(g.snapshot().stations.length, 1, 'the service opens with a single pan');

  const opened = [];
  g.on('place', () => opened.push(g.state.t));
  const bot = { pump() {} };
  for (let t = 0; t < 4 * RULES.OPEN_MS; t += STEP_MS) {
    // Keep the pots alive by hand: what is under test is the schedule, and a
    // service that struck out would stop growing for the wrong reason.
    for (const st of g.state.stations) st.heat = Math.max(st.heat, RULES.HEAT_NEW);
    g.state.lastHitAt = g.state.t;
    bot.pump();
    g.tick(STEP_MS);
  }
  assert.ok(opened.length >= 2, 'the counter should have grown at least twice');
  for (let k = 1; k < opened.length; k++) {
    assert.ok(opened[k] - opened[k - 1] >= RULES.OPEN_MS - STEP_MS,
      'two places opened inside one another: ' + opened.join(', '));
  }
  assert.ok(g.snapshot().stations.length <= table[Math.min(table.length, g.snapshot().level) - 1].stations,
    'the counter grew past what the level allows');
});

test('the counter never grows past the burners the player asked for', () => {
  /* The picker's Burners: `MAX_STATIONS` caps what any level may open, so a
   * novice can play the whole ladder of shapes on one pot, and the closed
   * cards past the cap have no level to name. */
  const g = wideOpen({ seed: 5, rules: { MAX_STATIONS: 1 } });
  for (let t = 0; t < 3 * RULES.OPEN_MS; t += STEP_MS) {
    for (const st of g.state.stations) st.heat = Math.max(st.heat, RULES.HEAT_FULL);
    g.state.lastHitAt = g.state.t;
    g.tick(STEP_MS);
  }
  const s = g.snapshot();
  assert.equal(s.stations.length, 1, 'one burner asked for, one burner lit');
  assert.equal(s.maxStations, 1);
  assert.equal(s.placeIn, null, 'and no place is counting down to open');
});

// ── two services are two services ────────────────────────────────────────

test('a different seed deals a different service', () => {
  /* This was a real defect and not a theoretical one: the game read
   * `Number(q.get('seed') || 7) || 7`, so without a seed in the URL every
   * session was seed 7 — the same customers with the same names and faces in
   * the same order, ordering the same dishes, off the same invented menu. The
   * second service a player ever played was a repeat of the first and nothing
   * on the screen said why. `game.js` deals a fresh one now; this holds the
   * engine to its half of that, which is that the seed actually reaches
   * everything a player sees. */
  const service = (seed) => {
    const g = newGame({ seed, rules: { OPEN_MS: 0 } });
    const seats = only(play(g, { events: [], ms: 8000 }).log, 'seat');
    return seats.map((e) => e.who.name + '/' + e.who.face + '/' + e.dish.id);
  };
  const a = service(11);
  const b = service(12);
  assert.ok(a.length >= 2, 'enough customers to compare (' + a.length + ')');
  assert.notDeepEqual(a, b, 'two seeds have to deal two services');
  assert.deepEqual(a, service(11), 'and one seed has to deal one service, twice');
});
