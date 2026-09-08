/*
 * The engine, tested with no browser and no guitar.
 *
 * The test that carries the weight is the first one: the rhythm the game
 * rewards (strum, strum, silence) has to cook a step at every height of flame
 * up to where the game claims to be playable, and hammering must never cook
 * anything. If that one falls, all the rest is decoration.
 *
 * It has already fallen once in silence: with the old rule a clean cycle
 * stopped cooking from the second step onward, and nothing said so. This file
 * comes from there.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, RULES, handCost, scoreOf } from '../src/engine.js';
import { MENU, LEVELS, dist, price, changes, chordLevel, label } from '../src/menu.js';
import { cook, dish, dishDuration } from '../src/input/scripted.js';
import { STEP_MS } from '../src/clock.js';
import { createFlaws } from '../src/input/flaws.js';
import { B, newGame, wideOpen, onePot, play, count, only, rng } from './harness.js';
import { inventMenu, voicings, voice } from '../src/invent.js';

// ── the rhythm: if this one is red, nothing else is worth looking at ─────

test('one chord heard is one step cooked, at every height of flame', () => {
  /* ── THE RHYTHM, and it is a change and not a count ─────────────────
   *
   * The step wanted a BAR of strums and a beat of silence until a real guitar
   * was pointed at it. Counting strums is not a measurement this input can
   * make — `input/engine.js` re-arms its onset detector after 180 ms whether
   * the sound has died or not, because the gate that waits for it to die was
   * eating the second strum of every pair — so one slow sweep across six
   * strings fires three or four times and a four-strum bar fills itself. What
   * the ear knows is WHICH CHORD is sounding, which is a state and is
   * reliable, so that is the whole rule: play what the ticket wants and the
   * step is cooked, at once. */
  for (const burner of [2.4, 3.2, 4.0, 4.8, 5.5, 8, 12]) {
    const { game, st } = onePot({ burner });
    game.strum('C');
    assert.equal(st.step, 1, 'one C has to cook the step at burner ' + burner);
  }
});

test('the pot is a clock, and being late costs the dish, not the step', () => {
  /* Above the line the step comes out clean; under it the step still cooks and
   * the pot takes a mark of soot. There is nothing a player can do right and
   * have nothing happen — the whole failure the old rule had. */
  const quick = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  quick.game.strum('C');
  assert.equal(quick.st.step, 1);
  quick.game.strum('Am');
  assert.equal(quick.st.step, 2, 'in time');
  assert.equal(quick.st.soot, 0, 'and clean');

  const slow = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  slow.game.strum('C');
  step(slow.game, 3000);                 // long enough to fall under the line
  slow.game.strum('Am');
  assert.equal(slow.st.step, 2, 'late still cooks');
  assert.equal(slow.st.soot, 1, 'and spoils the dish');
});

test('a change that moves more fingers is given more room', () => {
  /* `FINGER_GRACE`. A drill that paid the same for C-to-Am as for C-to-F would
   * be measuring the fingering and not the hand: one of those is one finger
   * and the other is three, and on a real neck the second takes about three
   * times as long. */
  const near = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  const far = onePot({ steps: ['C', 'F', 'Dm'], burner: 2.4 });
  assert.ok(dist('C', 'F') > dist('C', 'Am'), 'C to F really is the harder change');

  // A wait that is late for the easy change and in time for the hard one.
  const WAIT = 2600;
  near.game.strum('C'); step(near.game, WAIT); near.game.strum('Am');
  far.game.strum('C'); step(far.game, WAIT); far.game.strum('F');
  assert.equal(near.st.soot, 1, 'one finger, and this long is late');
  assert.equal(far.st.soot, 0, 'three fingers, and the same wait is not');
});

test('a chord the ear scored badly cooks, and spoils', () => {
  /* The other thing the ear CAN measure: how well the chord matched. A
   * fumbled shape that still reads as the right chord moves the recipe on and
   * costs the dish, which is the same bargain as being late. */
  const { game, st } = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  game.strum('C', 0.5);
  assert.equal(st.step, 1, 'it was the right chord, so the step cooked');
  assert.equal(st.soot, 1, 'but it was not played cleanly');
});

test('a chord nobody wants cooks nothing and is a miss', () => {
  const { game, st } = onePot({ steps: ['C', 'Am'], burner: 2.4 });
  const r = game.strum('G');
  assert.equal(r.ok, false);
  assert.equal(st.step, 0, 'the recipe has not moved');
  assert.equal(game.state.misses, 1);
});


test('one strum heats every station that wants that chord', () => {
  const g = createGame({
    menu: [{ id: 'x', dish: 'Same', steps: ['C', 'Am'], rn: '', price: 10, level: 1 }],
    levels: [{ stations: 3, maxSteps: 2, step: 0, burnerBoost: 0 }], seed: 7,
    rules: { OPEN_MS: 0 },              // three places at once: the schedule is not what is under test
  });
  g.open();                             // the wait for the first chord is not what is under test either
  step(g, 3000);
  const live = g.state.stations.filter((s) => s.order);
  assert.ok(live.length >= 2, 'at least two seated stations are needed');
  const before = live.map((s) => s.heat);
  const r = g.strum('C');
  assert.equal(r.together, live.length);
  live.forEach((s, k) => assert.ok(s.heat > before[k], 'station ' + s.i + ' has to heat up'));
});

// ── the chain ────────────────────────────────────────────────────────────

test('the chain and the combo count cooked steps', () => {
  const { game } = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  assert.equal(game.state.chain, 1);
  game.strum('C');
  assert.equal(game.state.chain, 2, 'a cooked step raises the chain');
  assert.equal(game.state.combo, 1, 'and the combo with it');

  /* A spoiled step is still a step: it cooked, the recipe moved on, and the
   * price is what it cost. What breaks the chain is playing on NOBODY, three
   * times over, and what loses it is standing still — the next two tests. */
  const late = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  late.game.strum('C');
  step(late.game, 3000);
  late.game.strum('Am');
  assert.equal(late.st.soot, 1, 'this one was late');
  assert.equal(late.game.state.chain, 3, 'and the chain still counts it');
});


test('the chain is lost by standing still', () => {
  const { game } = onePot({ burner: 2.4 });
  game.strum('C'); step(game, 40);
  assert.equal(game.state.chain, 2);
  step(game, B * 5);
  assert.equal(game.state.chain, 1, 'four beats standing still and the chain is gone');
});

// ── the dish and the money ───────────────────────────────────────────────

test('cooking every step serves the dish and takes the money', () => {
  const steps = ['G', 'C'];
  const g = createGame({
    menu: [{ id: 'b', dish: 'Bruschetta', steps, rn: 'V I', price: 12, level: 1 }],
    levels: [{ stations: 1, maxSteps: 2, step: 0, burnerBoost: 0 }], seed: 3,
  });
  const { log } = play(g, { events: dish(steps, { at: 500, beat: B }), ms: dishDuration(steps, { beat: B }) + 2000 });

  const served = only(log, 'serve');
  assert.equal(served.length, 1, 'the dish has to have gone out');
  assert.ok(served[0].money >= 12, 'at least the list price comes in');
  assert.equal(g.state.cash, served[0].money);
  assert.equal(count(log, 'cycle'), 2, 'two steps, two cooked cycles');
});

test('served with no soot, the tip shows in the money', () => {
  const steps = ['Dm', 'G'];
  const g = createGame({
    menu: [{ id: 'd', dish: 'Dorian', steps, rn: 'ii V', price: 12, level: 1 }],
    levels: [{ stations: 1, maxSteps: 2, step: 0, burnerBoost: 0 }], seed: 5,
  });
  const { log } = play(g, { events: dish(steps, { at: 500, beat: B }), ms: dishDuration(steps, { beat: B }) + 2000 });
  const s = only(log, 'serve')[0];
  assert.ok(s, 'served');
  assert.equal(s.tip, true, 'with no soot there has to be a tip');
  assert.equal(s.money, Math.round(12 * s.chain * RULES.TIP));
});

test('a dirty chord leaves soot, and soot costs life', () => {
  const { game, st } = onePot({ burner: 2.4, heat: 50 });
  const lifeBefore = game.life(st, false);
  game.strum('C', 0.6);                    // ratio under 0.8: dirty
  assert.equal(st.soot, 1, 'one soot');
  assert.ok(game.life(st, false) < lifeBefore + 3, 'the soot eats the life that was gained');
});

// ── the time that passes ─────────────────────────────────────────────────

test('the kitchen waits for the first chord, and then runs on its own', () => {
  /* Not the harness: the harness opens the kitchen, and the wait is what is
   * under test. Before the first chord the first customer sits down and that
   * is all — no heat is lost, no clock runs — because a beginner reading their
   * first fingering was being timed for the reading. Measured before this
   * rule: the first customer lost at seven seconds with no input at all. */
  const g = createGame({ menu: MENU, levels: LEVELS, seed: 42 });
  const { log } = play(g, { events: [], ms: 30000 });
  assert.equal(count(log, 'ruin'), 0, 'nobody is lost before anybody has played');
  const s = g.snapshot();
  assert.equal(s.started, false);
  assert.ok(s.stations[0].dish, 'the first customer is seated and waiting');
  assert.equal(s.stations[0].heatPct, 100, 'the first pot has not cooled');
  assert.equal(s.clock, 0, 'the clock has not started');
  assert.equal(s.silent, false, 'and a kitchen that has not opened is not silent');
  assert.equal(s.stations.length, 1, 'no second place opens while nobody plays');
  /* And the closed card's count does not run either: it used to read
   * `nextPlaceAt - t` with `t` running from the mount, so after thirty seconds
   * of reading the first fingering the card said `OPENS IN 0 SEC` for a place
   * that was not opening. */
  assert.equal(s.placeIn, RULES.OPEN_MS, 'the next place\'s count waits for the first chord too');

  // A bleed is not a chord: it opens nothing.
  g.strum(null);
  assert.equal(g.state.started, false);

  // The first chord opens it, and from there the service runs on its own.
  g.strum(s.wants[0]);
  assert.equal(g.state.started, true);
  const after = play(g, { events: [], ms: 120000 });
  assert.equal(count(after.log, 'over'), 1, 'abandoned after opening, the service closes');
});

test('with nobody playing the pots die and the service closes', () => {
  const g = newGame();
  const { log } = play(g, { events: [], ms: 120000 });
  assert.equal(count(log, 'over'), 1, 'three customers lost have to close the service');
  assert.equal(g.state.strikes, RULES.STRIKES);
  assert.equal(g.state.cash, 0, 'with nothing served nothing comes in');
  /* Three strikes on a counter that opens with ONE place is three customers
   * lost one after the other, each of whom has to walk in, go cold and be
   * replaced: about a minute, where three places abandoned at once took half
   * of that. It still has to close on its own, and well inside the two minutes
   * played here. */
  assert.ok(g.state.t < 100000, 'and it has to close on its own, not run out the clock');
});

test('the flames rise on their own', () => {
  const g = newGame({ rules: { STRIKES: 99 } });
  const b0 = g.state.stations[0].burner;
  play(g, { events: [], ms: 30000 });
  const expected = RULES.GROW_PER_S * 30;
  assert.ok(g.state.stations[0].burner > b0 + expected * 0.9,
    'after thirty seconds the fire is higher (' + b0 + ' -> ' + g.state.stations[0].burner.toFixed(2) + ')');
});

test('the level goes up and opens a station', () => {
  const g = newGame({ rules: { STRIKES: 99 } });
  const { log } = play(g, { events: [], ms: RULES.LEVEL_MS * 2 + 2000 });
  const levels = only(log, 'level');
  assert.equal(levels.length, 2, 'two minutes, two levels');
  assert.equal(g.state.level, 3);
  assert.equal(g.state.stations.length, LEVELS[2].stations, 'at level 3 the fourth station arrives');
});

// ── the hand ─────────────────────────────────────────────────────────────

test('the distance between shapes is the real one on the neck', () => {
  assert.equal(handCost('C', 'C'), 0);
  assert.equal(handCost('C', 'Am'), 1, 'C and Am are the same hand minus one finger');
  assert.equal(handCost('C', 'F'), 3, 'C -> F is a real jump');
  assert.equal(handCost('F', 'C'), 3, 'and it holds in both directions');
  assert.equal(handCost('C', 'G'), 3, 'C -> G moves everything too');
  assert.ok(handCost('E', 'E7') < RULES.RUSH_COST, 'E -> E7 is one finger: it is not a jump');
});

test('the prices follow the fingers, not a whim', () => {
  const crostini = MENU.find((m) => m.id === 'toast');      // C C C C, no change at all
  const margherita = MENU.find((m) => m.id === 'margherita'); // C F G, all far apart, with the F
  assert.ok(margherita.price > crostini.price * 2, 'a hard dish has to pay a great deal more');
  assert.equal(crostini.price, price(crostini.steps));

  /* And a REPEAT is cheap, by arithmetic and not by decision: a step is worth
   * three and every finger that moves between two shapes is worth two, so a
   * chord repeated adds the step and no distance. Which is exactly what an
   * easy dish should be — the same four steps, half the money. */
  const held = price(['C', 'C', 'C', 'C']);
  const changed = price(['C', 'F', 'C', 'F']);
  assert.ok(changed > held * 1.5, 'four changes have to pay much more than four of the same chord');
});

test('a far change in a hurry is a REWARD now, not a fault', () => {
  /* This test used to assert the opposite, and the rule it tested was written
   * for a game where the chords came slowly: a change of three fingers or more
   * played inside a beat came out dirty, on the grounds that the detector
   * hears that gesture worst and a beginner fumbles it.
   *
   * The game is a chord-change drill now — one chord heard is one step — so
   * punishing a fast change would be punishing the only thing it asks for. The
   * ear's own score does the job the rush rule was standing in for: a fumbled
   * shape either is not recognised at all or comes back with a poor quality,
   * and a poor quality spoils the dish. So a clean far change made fast is
   * exactly what the game wants, and it pays. */
  const { game, st } = onePot({ steps: ['C', 'F', 'Dm'], burner: 2.4 });
  game.strum('C');
  const r = game.strum('F');                 // no beat of grace at all
  assert.equal(r.ok, true);
  assert.equal(st.step, 2, 'the change cooked');
  assert.equal(st.soot, 0, 'and being quick about it cost nothing');
});


test('a repeated step cannot be cooked twice by one sweep of the hand', () => {
  /* The one thing a repeat needs from the engine, and the reason it was
   * forbidden for so long.
   *
   * The ear re-arms every 180 ms whether the sound has died back or not, so a
   * slow sweep across six strings reaches the engine as strums at 0, 180, 360
   * and 540. Where the chord CHANGES every step those extra onsets land on a
   * chord nobody wants and are harmless. Where it repeats, every one of them
   * cooks a real step: measured before `STEP_GAP_MS` existed, one sweep cooked
   * four steps of `C C C C C`. */
  const sweep = (gaps, steps) => {
    const { game, st } = onePot({ steps, burner: 2.4 });
    let last = 0;
    for (const at of gaps) {
      step(game, at - last);
      last = at;
      game.strum(steps[Math.min(st.step, steps.length - 1)], 1);
    }
    return st.step;
  };
  const five = ['C', 'C', 'C', 'C', 'C'];
  assert.equal(sweep([0, 180, 360, 540], five), 1, 'one sweep is one step, however many onsets it made');
  assert.equal(sweep([0, 750, 1500, 2250], five), 4, 'four strums a beat apart are four steps');

  // And the floor is on the REPEAT, not on cooking: changes stay unthrottled.
  assert.equal(sweep([0, 260, 520, 780], ['C', 'Am', 'Dm', 'G', 'C']), 4,
    'a hand quick enough to change four times in a second has earned all four');
});

test('a short dish always stays on the counter, while the game is young', () => {
  const g = newGame({ rules: { STRIKES: 99 }, seed: 11 });
  const { log } = play(g, { events: [], ms: RULES.LEVEL_MS * 3 });
  /* Gentle means FEW CHANGES and no longer few steps: a step is one chord
   * heard, so `C C Am Am` is four steps, one change, and the most forgiving
   * thing on the menu. */
  let quick = 0, total = 0;
  for (const e of only(log, 'seat')) {
    total++;
    if (changes(e.dish) <= 1) quick++;
  }
  assert.ok(total > 5, 'enough customers are needed to say anything (' + total + ')');
  assert.ok(quick >= 1, 'up to level 4 some gentle dish has to arrive');
  // And never two long recipes at once: checked on the state, not on the log.
  assert.ok(g.state.stations.filter((s) => s.order && s.order.steps.length >= 6).length <= 1);
});

// ── the fake source ──────────────────────────────────────────────────────

test('the script delivers the events at the right time, latency included', () => {
  const g = newGame();
  const { log } = play(g, {
    events: [{ at: 1000, chord: 'ZZ' }],
    profile: 'latency-only', seed: 2, ms: 3000, stopOnOver: false,
  });
  const miss = only(log, 'miss')[0];
  assert.ok(miss, 'a chord nobody wants has to arrive as a miss');
  assert.ok(miss.t >= 1000 + 60, 'with the latency it arrives later (' + miss.t + ')');
  assert.ok(miss.t <= 1000 + 200);
});

test('the flaws of the ear: latency, wrong chords, doubles, bleeds', () => {
  const flaw = createFlaws('worst', rng(3), { far: () => false });
  const out = [];
  for (let k = 0; k < 300; k++) out.push(...flaw({ at: 1000 + k * 300, chord: 'C', quality: 1 }));

  assert.ok(out.some((e) => e.chord && e.chord !== 'C'), 'some chord heard wrong');
  assert.ok(out.every((e) => e.chord !== 'F'), 'but never an impossible confusion: C does not become F');
  assert.ok(out.some((e) => e.quality < 0.8), 'some dirty chord');
  assert.ok(out.some((e) => e.double), 'some strum heard twice');
  assert.ok(out.some((e) => e.chord === null), 'some bleed that is not a chord');
  assert.ok(out.every((e) => e.at >= e.heardAt), 'the detector cannot hear before it is played');

  // And the perfect profile must not touch anything: it is the yardstick.
  const clean = createFlaws('perfect', rng(3))({ at: 1000, chord: 'C', quality: 1 });
  assert.deepEqual(clean, [{ at: 1000, chord: 'C', quality: 1, heardAt: 1000 }]);
});

test('the worst profile really does change the service', () => {
  const steps = ['C', 'Am', 'F', 'G'];
  const clean = play(newGame({ seed: 4 }), { events: dish(steps, { at: 500, beat: B }), ms: 12000, seed: 3 });
  const dirty = play(newGame({ seed: 4 }), { events: dish(steps, { at: 500, beat: B }), ms: 12000, seed: 3, profile: 'worst' });
  const played = (r) => count(r.log, 'strum') + count(r.log, 'miss');
  assert.notEqual(played(clean), played(dirty));
});

test('same seed, same service', () => {
  const one = play(newGame({ seed: 9 }), { events: dish(['C', 'Am'], { at: 500, beat: B }), ms: 20000, seed: 5, profile: 'real' });
  const two = play(newGame({ seed: 9 }), { events: dish(['C', 'Am'], { at: 500, beat: B }), ms: 20000, seed: 5, profile: 'real' });
  assert.deepEqual(one.log, two.log, 'two identical runs have to give the same log');
});

// ── the invariants: true on any input, even the worst ────────────────────

test('the invariants hold even with the worst profile', () => {
  const g = newGame({ seed: 21, rules: { STRIKES: 99 } });
  const events = [];
  // Five minutes of random but deterministic stuff, on the game's chords.
  const pool = ['C', 'Am', 'Dm', 'G', 'F', 'Em', 'E7', 'A7'];
  let t = 400, k = 0;
  while (t < 300000) { events.push({ at: t, chord: pool[(k * 7 + 3) % pool.length] }); t += 260 + (k % 5) * 120; k++; }
  const { log } = play(g, { events, ms: 300000, seed: 13, profile: 'worst' });

  const s = g.snapshot();
  for (const st of s.stations) assert.ok(st.heat >= 0 && st.heat <= 100, 'heat off the scale: ' + st.heat);

  /* I2: every cooked step and every dish served has a STRUM before it on the
   * same station, at the same instant. There is no other way in.
   *
   * It used to look for a `ring` — the rest that judged the pot — because
   * cooking happened in the silence. Cooking happens on the chord now, so the
   * event to look for is the strum that carried it, and the invariant is the
   * same one: nothing advances a recipe except a player playing. */
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (e.ev !== 'step' && e.ev !== 'serve') continue;
    const played = log.slice(0, i).reverse()
      .find((x) => x.ev === 'strum' && x.t === e.t && x.stations.includes(e.station));
    assert.ok(played, 'a ' + e.ev + ' at t=' + e.t + ' with no chord cooking it');
  }
  // I4: the till is exactly the sum of what has been paid — the dishes, and
  // the perfect-service bonuses rung up at the bells.
  assert.equal(g.state.cash,
    only(log, 'serve').reduce((n, e) => n + e.money, 0) + only(log, 'perfect').reduce((n, e) => n + e.bonus, 0));
  // I7: the chain stays inside its banks.
  assert.ok(g.state.chain >= 1 && g.state.chain <= RULES.CHAIN_MAX);
});

test('after the close nothing happens any more', () => {
  const g = newGame({ seed: 33 });
  const { log } = play(g, { events: [], ms: 120000, stopOnOver: false });
  const end = log.findIndex((e) => e.ev === 'over');
  assert.ok(end >= 0, 'the service has to close');
  assert.deepEqual(log.slice(end + 1), [], 'no events after the close');
  assert.equal(g.state.strikes, RULES.STRIKES, 'and no strikes pile up past the third');
});

/** Lets time go by with the clock's real step. */
function step(game, ms) {
  for (let t = 0; t < ms; t += STEP_MS) game.tick(STEP_MS);
}

/**
 * A full cycle the way a real hand makes it, and the first beat counts.
 *
 * After the rest the hand has to reach the next shape: that beat is part of
 * the cycle, and during the cycle the burner goes on eating heat. A bench that
 * started the strums straight away would measure a shorter window than the
 * real one and would say the game is easier than it is.
 */
/* One chord heard is one step cooked, so a "cycle" is one strum and whatever
 * time the test wants to pass afterwards. It kept its name because every test
 * below reads better for it: `cycle(game, 'C')` is the gesture. */
function cycle(game, chord, after) {
  game.strum(chord);
  step(game, after === undefined ? 40 : after);
}

// ── two pots on one chord ────────────────────────────────────────────────

test('two pots on the same chord cook together, and one chord feeds both', () => {
  /* THE GREEDY PLAY, which is the one decision the game really rewards and the
   * question the first guitar player asked: it is normal to have two tickets
   * wanting the same chord, and playing the second one feeds the first — so
   * does that go wrong?
   *
   * It goes RIGHT, and more plainly than it ever did. One chord heard cooks the
   * step of every pot that wants it, so both cards turn over on the same
   * strum, each judged on its own clock. There used to be a whole paragraph
   * here about a pot that walked in mid-cycle inheriting the hand's strum count
   * and cooking off a single strum — an arithmetic accident that could only
   * exist while a step was a COUNT. A step is a chord now, and there is no
   * count for anybody to inherit. */
  const g = createGame({
    menu: [{ id: 'x', dish: 'Same', steps: ['C', 'Am'], rn: '', price: 10, level: 1,
      pan: 'saucepan', ingredients: ['water', 'herbs'] }],
    levels: [{ name: 'T', stations: 2, maxSteps: 2, step: 0, burnerBoost: 0 }],
    seed: 7, rules: { OPEN_MS: 0 },
  });
  g.open();
  step(g, 3000);
  const live = g.state.stations.filter((s) => s.order && g.wants(s) === 'C');
  assert.equal(live.length, 2, 'both pots should want the same chord here');
  for (const st of live) st.heat = RULES.HEAT_FULL;
  g.state.lastHitAt = g.state.t;
  g.state.lastEventAt = g.state.t;

  const r = g.strum('C');
  assert.equal(r.together, 2, 'one chord, two pots');
  for (const st of live) assert.equal(st.step, 1, 'and both cooked a step off it');

  /* And a pot behind on its own clock pays for its own lateness and nobody
   * else's. The wait is `STEP_GAP_MS`, because these two pots have just cooked
   * a C and a second C inside that floor is the ear talking to itself. */
  const late = g.state.stations[1];
  late.step = 0;
  late.heat = RULES.HEAT_FULL / 4;             // seated a long time ago
  step(g, RULES.STEP_GAP_MS + 40);
  g.strum('C');
  assert.equal(late.step, 1, 'it cooked, like everybody else');
  assert.equal(late.soot, 1, 'and it paid for its own lateness, not for the hand’s');
});

test('the first two customers are the lesson, and no recipe is dealt twice at once', () => {
  /* The menu says One-Chord Toast is "the very first thing anybody plays",
   * and nothing made it so: the first ticket could be a change before the
   * screen had shown that a card turns over when you play what it says. And
   * at the second service three customers side by side ordered the same dish,
   * which reads as a bug and teaches nothing. */
  for (const seed of [1, 2, 3, 5, 7, 11, 4101469671]) {
    const g = wideOpen({ seed, menu: inventMenu(MENU, seed, 6) });
    step(g, 2000);
    const dishes = g.state.stations.filter((s) => s.order).map((s) => s.order);
    assert.ok(dishes.length >= 2, 'seed ' + seed + ': two places should be seated');
    assert.equal(changes(dishes[0]), 0, 'seed ' + seed + ': the first ticket has a change in it: ' + dishes[0].steps.join(' '));
    assert.ok(changes(dishes[1]) <= 1, 'seed ' + seed + ': the second ticket asks for more than one change: ' + dishes[1].steps.join(' '));
    const ids = dishes.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length, 'seed ' + seed + ': the same recipe twice on the counter: ' + ids.join(', '));
  }
});

test('eight clean dishes in a row win a lost customer back', () => {
  /* Three strikes closed the service and the count only ever went up, so a
   * service was as long as its three worst moments. `REDEEM_TIPS` dishes
   * served with the tip, in a row, bring one lost customer back; a dish that
   * lost a star breaks the run, and so does losing somebody. */
  const { game } = onePot({ steps: ['C', 'Am'], burner: 2.4, rules: { SEAT_DELAY_MS: 500 } });
  const redeemed = [];
  game.on('redeem', (e) => redeemed.push(e));
  game.state.strikes = 2;
  const serveClean = () => {
    // Fresh customer, full pot: two chords in a row, both above the line.
    game.strum('C'); game.strum('Am');
    step(game, 600);                          // the seat is cleared and filled again
  };
  for (let k = 0; k < RULES.REDEEM_TIPS - 1; k++) serveClean();
  assert.equal(game.state.strikes, 2, 'one short of the run, nothing is won back yet');
  assert.equal(game.snapshot().redeemIn, 1, 'and the strip can say how far it is');
  serveClean();
  assert.equal(game.state.strikes, 1, 'the run brings one customer back');
  assert.equal(redeemed.length, 1);
  assert.equal(game.state.tipRun, 0, 'and starts over');

  // A dish without its tip breaks the run. The LAST step has to be the dirty
  // one: a clean strum after a dirty one wipes a mark of soot off the pot,
  // which is the engine's own rule and not this test's business.
  for (let k = 0; k < 4; k++) serveClean();
  assert.equal(game.state.tipRun, 4);
  game.strum('C'); game.strum('Am', 0.5); step(game, 600);   // served with soot: no tip
  assert.equal(game.state.tipRun, 0, 'a spoiled dish breaks the run');
  assert.equal(game.state.strikes, 1);

  // With nobody lost there is nothing to win back, and the strip says nothing.
  game.state.strikes = 0;
  assert.equal(game.snapshot().redeemIn, null);
});

// ── the second session's asks ────────────────────────────────────────────

test('a dish is dealt in a key of its own, at the same tier and with the same changes', () => {
  /* Every service opened with C and then G, because One-Chord Toast is
   * `I I I I` written in C and the cadence is written in C too. A dish is a
   * progression; the key it is dealt in is drawn, among the keys whose chords
   * the tier allows, and the price follows the recipe actually asked. */
  const toast = MENU.find((m) => m.id === 'toast');
  const alts = voicings(toast, 1);
  assert.ok(alts.length >= 1, 'One-Chord Toast can be played in more than one key at the first tier');
  for (const a of alts) {
    assert.equal(a.steps.length, toast.steps.length);
    assert.equal(changes({ steps: a.steps }), 0, 'a one-chord dish stays a one-chord dish: ' + a.steps.join(' '));
    for (const c of a.steps) assert.ok(chordLevel(c) <= 1, a.steps.join(' ') + ' reaches past the tier');
  }
  const bruschetta = MENU.find((m) => m.id === 'bruschetta');
  for (const a of voicings(bruschetta, 6)) assert.equal(changes({ steps: a.steps }), changes(bruschetta));
  // Degrees no key has (a minor key): the dish stays as written.
  const tango = MENU.find((m) => m.id === 'eggplant');
  assert.equal(voicings(tango, 6).length, 0);
  assert.equal(voice(tango, 6, () => 0.5), tango);
  // The written key is one of the choices, and the choice is the seed's.
  assert.equal(voice(toast, 1, () => 0.999).steps.join(' '), toast.steps.join(' '));
  const other = voice(toast, 1, () => 0);
  assert.notEqual(other.steps.join(' '), toast.steps.join(' '));
  assert.equal(other.price, price(other.steps), 'the pot pays for the recipe it was asked');
  // And over seeds the opening chord varies.
  const firsts = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const g = wideOpen({ seed });
    step(g, 100);
    firsts.add(g.state.stations[0].order.steps[0]);
  }
  assert.ok(firsts.size >= 2, 'the opening chord should vary with the seed: ' + [...firsts].join(','));
});

test('a level with nobody lost pays a perfect-service bonus at the bell', () => {
  const { game } = onePot({ steps: ['C', 'Am'], burner: 2.4, rules: { SEAT_DELAY_MS: 500, LEVEL_MS: 5000 } });
  const perfects = [];
  game.on('perfect', (e) => perfects.push(e));
  const levels = [];
  game.on('level', (e) => levels.push(e));
  game.strum('C'); game.strum('Am');                  // one dish out, cleanly
  const before = game.state.cash;
  step(game, 5200);                                    // the bell
  assert.equal(perfects.length, 1, 'a served level with nobody lost is perfect');
  assert.ok(perfects[0].bonus >= RULES.PERFECT_MIN);
  assert.equal(game.state.cash, before + perfects[0].bonus, 'and the bonus is in the till');
  assert.equal(levels[0].perfect, perfects[0].bonus, 'the bell carries it, so the banner can say it');
  // A level with a loss pays nothing, however much was served.
  const st = game.state.stations[0];
  game.strum(st.order.steps[0]); game.strum(st.order.steps[1]);
  step(game, 700);
  game.state.stations[0].heat = 0.05;                  // and one goes out
  step(game, 5000);
  assert.equal(perfects.length, 1, 'a level with a customer lost is not perfect');
  assert.equal(levels[1].perfect, 0);
});

test('the critic: from the second service, never two at once, the hardest dish, three times the pay', () => {
  const g = wideOpen({ seed: 3, rules: { STRIKES: 999, CRITIC_CHANCE: 1, LEVEL_MS: 1000 } });
  const alive = () => { for (const st of g.state.stations) st.heat = RULES.HEAT_FULL; g.state.lastHitAt = g.state.t; };
  for (let t = 0; t < 900; t += STEP_MS) { alive(); g.tick(STEP_MS); }
  assert.ok(g.state.stations.every((s) => !(s.who && s.who.critic)), 'no critic in the first service, however likely');
  for (let t = 0; t < 200; t += STEP_MS) { alive(); g.tick(STEP_MS); }
  assert.equal(g.state.level, 2);
  for (const st of g.state.stations) { st.order = null; st.who = null; st.seatAt = g.state.t; }
  g.tick(STEP_MS);
  const critics = g.state.stations.filter((s) => s.who && s.who.critic);
  assert.equal(critics.length, 1, 'one critic at a time');
  const c = critics[0];
  assert.equal(c.who.name, 'THE CRITIC');
  for (const o of g.state.stations) {
    if (o === c || !o.order) continue;
    assert.ok(changes(c.order) >= changes(o.order), 'the critic orders the hardest dish on the counter');
  }
  assert.equal(g.snapshot().stations[c.i].critic, true);
  assert.equal(g.snapshot().stations[c.i].worth, Math.round(c.order.price * g.state.chain * RULES.TIP * RULES.CRITIC_PAY),
    'the tag says what the critic pays');
  const served = [];
  g.on('serve', (e) => served.push(e));
  c.step = c.order.steps.length - 1; c.heat = RULES.HEAT_FULL; g.state.lastHitAt = g.state.t;
  g.strum(c.order.steps[c.step]);
  const e = served.find((s) => s.critic);
  assert.ok(e, 'the critic was served');
  // Off the event: the station is cleared the moment the dish goes out.
  assert.equal(e.money, Math.round(e.dish.price * e.chain * RULES.TIP * RULES.CRITIC_PAY), 'and paid three times');

  // Switched off, as it is until the hub's unlock is earned, nobody like that comes.
  const off = wideOpen({ seed: 3, rules: { STRIKES: 999, CRITIC: false, CRITIC_CHANCE: 1, LEVEL_MS: 1000, SEAT_DELAY_MS: 100 } });
  for (let t = 0; t < 3000; t += STEP_MS) {
    for (const st of off.state.stations) st.heat = RULES.HEAT_FULL;
    off.state.lastHitAt = off.state.t;
    off.tick(STEP_MS);
    if (t % 500 === 0) for (const st of off.state.stations) { st.order = null; st.who = null; st.seatAt = off.state.t; }
  }
  assert.ok(off.state.stations.every((s) => !(s.who && s.who.critic)), 'with CRITIC off there is no critic');
});

test('a LOOP service deals one dish over and over, and can be pointed at a change', () => {
  const g = wideOpen({ seed: 2, rules: { LOOP: true, MAX_STATIONS: 1, SEAT_DELAY_MS: 200 } });
  const ids = new Set();
  for (let k = 0; k < 40 && ids.size < 2; k++) {
    const st = g.state.stations[0];
    if (!st.order) { g.tick(STEP_MS); continue; }
    ids.add(st.order.id);
    st.step = st.order.steps.length - 1; st.heat = RULES.HEAT_FULL; g.state.lastHitAt = g.state.t;
    g.strum(st.order.steps[st.step]);
    step(g, 300);
  }
  assert.equal(ids.size, 1, 'one recipe, every time: ' + [...ids].join(','));
  const aimed = wideOpen({ seed: 2, rules: { LOOP: true, MAX_STATIONS: 1, LOOP_TARGET: { from: 'C', to: 'F' } } });
  step(aimed, 100);
  const d = aimed.state.stations[0].order;
  assert.ok(d.steps.some((c, i) => i > 0 && d.steps[i - 1] === 'C' && c === 'F'),
    'the loop finds a dish with the change to drill: ' + d.steps.join(' '));
});

test('a timed service closes at its bell, whatever the strikes say', () => {
  const g = newGame({ rules: { TIME_LIMIT_MS: 3000, STRIKES: 999 } });
  const overs = [];
  g.on('over', (e) => overs.push(e));
  assert.equal(g.snapshot().timeLeft, 3000);
  step(g, 3100);
  assert.equal(overs.length, 1);
  assert.equal(overs[0].why, 'time');
  assert.equal(g.snapshot().timeLeft, 0);
});

test('a cooked change carries how long the hand took', () => {
  const { game } = onePot({ steps: ['C', 'Am', 'Dm'], burner: 2.4 });
  const cycles = [];
  game.on('cycle', (e) => cycles.push(e));
  game.strum('C');
  assert.equal(cycles[0].changeMs, null, 'the first chord of a service changed from nothing');
  step(game, 800);
  game.strum('Am');
  assert.equal(cycles[1].changeMs, 800, 'from the last chord that landed to this one');
});

test('the rules may change until the first chord, and the counter is dealt again', () => {
  /* The options plate: the first customer is already seated when the player
   * picks a pace, a cap and a mode, so the rules are laid over in place and
   * the same person sits down again under them. */
  const g = createGame({ menu: MENU, levels: LEVELS, seed: 42 });
  g.tick(10);                                         // the first customer sits
  const before = g.state.stations[0];
  assert.ok(before.order, 'somebody is seated before the first chord');
  const who = before.who;
  assert.ok(g.setRules({ MAX_STATIONS: 1, LOOP: true, STRIKES: 9999 }));
  assert.equal(g.rules.MAX_STATIONS, 1);
  assert.equal(g.rules.STRIKES, 9999);
  const after = g.state.stations[0];
  assert.ok(after.order, 'and somebody is seated after');
  assert.equal(after.who, who, 'the same person: a face the player has read does not change under them');
  assert.equal(after.order, g.state.loopDish, 'a LOOP has its one dish on the card before the kitchen opens');
  assert.equal(g.state.seated, 1, 'seated once, as far as the lesson is concerned');
  assert.equal(g.snapshot().maxStations, 1);
  // Back to a service: the loop dish is forgotten and a fresh one is dealt.
  assert.ok(g.setRules({ LOOP: false, MAX_STATIONS: 5 }));
  assert.equal(g.state.loopDish, null);
  assert.ok(g.state.stations[0].order);
  assert.equal(g.state.stations[0].who, who);
  // Once the kitchen is open the rules are the rules.
  g.open();
  const dish = g.state.stations[0].order;
  assert.equal(g.setRules({ MAX_STATIONS: 2 }), false);
  assert.equal(g.rules.MAX_STATIONS, 5);
  assert.equal(g.state.stations[0].order, dish);
});

test('a step cooked gives every other pot a fifth of a pot back', () => {
  /* The plates on sticks: with two pots the round trip is what kills, so a
   * touch on one plate steadies the others a little. A fifth, not a reset —
   * camp on one pot and the others still go. */
  const g = createGame({
    menu: [{ id: 'x', dish: 'Same', steps: ['C', 'Am'], rn: '', price: 10, level: 1 },
      { id: 'y', dish: 'Other', steps: ['G', 'D'], rn: '', price: 10, level: 1 }],
    levels: [{ stations: 2, maxSteps: 2, step: 0, burnerBoost: 0 }], seed: 5,
    rules: { OPEN_MS: 0 },
  });
  g.open();
  step(g, 2000);
  const live = g.state.stations.filter((s) => s.order);
  assert.equal(live.length, 2);
  const [a, b] = live;
  a.heat = 90; b.heat = 50;
  g.state.lastHitAt = g.state.t;
  g.strum(g.wants(a));
  assert.equal(a.heat, RULES.HEAT_FULL, 'the pot that cooked is full');
  assert.equal(b.heat, 50 + RULES.HEAT_FULL * RULES.SPIN_BONUS, 'the other pot gets a fifth back');
  b.heat = 95;
  g.strum(g.wants(a));
  assert.equal(b.heat, RULES.HEAT_FULL, 'and never past full');
  // A miss steadies nothing.
  b.heat = 40;
  g.strum('Eb');
  assert.equal(b.heat, 40);
});

test('the drills are two or three shapes in a random order, named for their changes', () => {
  const menu = inventMenu(MENU, 11, 6);
  const ds = menu.filter((m) => m.drill);
  assert.ok(ds.length >= 6, 'every tier gets a few drills: ' + ds.length);
  for (const d of ds) {
    assert.ok(d.steps.length >= 2);
    for (const c of d.steps) assert.ok(chordLevel(c) <= d.level, d.dish + ' asks for ' + c + ' above its tier');
    assert.ok(changes(d) >= 1, d.dish + ' has no change to drill');
    const shapes = [...new Set(d.steps)];
    assert.ok(shapes.length >= 2 && shapes.length <= 3, d.dish + ' should be two or three shapes: ' + d.steps.join(' '));
    // Named by LABEL: the whole F is written F, in a dish's name as on its card.
    for (const c of shapes) assert.ok(d.dish.includes(label(c)), d.dish + ' does not name ' + label(c));
    assert.equal(d.price, price(d.steps));
    assert.equal(d.ingredients.length, d.steps.length);
  }
  // Tier one drills reach the open shapes that used to wait until minute three.
  const early = ds.filter((d) => d.level === 1).flatMap((d) => d.steps);
  assert.ok(early.some((c) => ['Em', 'D'].includes(c)), 'the first tier drills the open shapes: ' + [...new Set(early)].join(' '));
});

test('only the guitar scores: the keyboard and the script report nothing', () => {
  /* Development inputs, both of them. A hub that counts dB across its games
   * cannot be handed a service a finger on the C key played. */
  assert.equal(scoreOf(1000, { input: 'guitar' }).score, 1000);
  assert.equal(scoreOf(1000, { input: 'keyboard' }).score, 0);
  assert.equal(scoreOf(1000, { input: 'keyboard' }).mult, 0);
  assert.equal(scoreOf(1000, { input: 'script' }).score, 0);
  assert.equal(scoreOf(1000, { pace: 'rush', pans: 5, mode: 'service', input: 'keyboard' }).score, 0, 'no choice buys the keyboard a score');
  // An input the table has never heard of is not free: it scores.
  assert.equal(scoreOf(1000, { input: 'midi' }).score, 1000);
  assert.equal(scoreOf(1000, {}).score, 1000, 'and no input named is the bench, which scores as it always did');
});

test('the score is the takings scaled by what was chosen', () => {
  assert.equal(scoreOf(1000, { pace: 'normal', pans: 5, mode: 'service' }).score, 1000);
  assert.equal(scoreOf(1000, { pace: 'relaxed', pans: 1, mode: 'service' }).score, 375);
  assert.equal(scoreOf(1000, { pace: 'rush', pans: 5, mode: 'sprint' }).score, 1250);
  assert.equal(scoreOf(1000, { pace: 'normal', pans: 5, mode: 'practice' }).score, 0, 'practice is not a score');
  assert.equal(scoreOf(1000, {}).score, 1000, 'nothing chosen is the full service');
});
