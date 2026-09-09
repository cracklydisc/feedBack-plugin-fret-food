import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { MENU, LEVELS } from '../src/menu.js';
import { createReport } from '../src/report.js';
import { createLearning, median, contextKey, learningContext, recommendPair, saveLearning, loadLearning, previousRecall } from '../src/learning.js';
import { introductionRecipe, pairRecipe } from '../src/drill.js';
import { learningSummary } from '../src/learning-summary.js';
import { chordBoxes } from '../src/art/hud.js';
import { GEO } from '../src/art/geo.js';

const context = { mode: 'loop', pans: 1, assistance: 'memory', input: 'guitar', pace: 'normal', ear: 'medium' };
const drill = target => createGame({ menu: MENU, levels: LEVELS, seed: 7,
  rules: { LOOP: true, MAX_STATIONS: 1, LOOP_TARGET: target || { from: 'C', to: 'F' } } });
const storage = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k,v) => m.set(k,v) }; };

test('a pair drill contains only the requested shapes, ends after six changes each way, and never cools', () => {
  const g = drill(); g.tick(10000);
  const order = g.state.stations[0].order;
  assert.equal(order.steps.length, 13);
  assert.deepEqual([...new Set(order.steps)], ['C', 'F']);
  assert.equal(g.state.started, false);
  g.strum('C'); g.tick(120000);
  assert.equal(g.state.stations.length, 1);
  assert.equal(g.state.level, 1);
  assert.equal(g.state.stations[0].heat, g.rules.HEAT_FULL);
  assert.equal(g.strum('F', 0.1).ok, false);
  assert.equal(g.state.stations[0].step, 1);
  for (let i = 1; i < 13; i++) { g.tick(900); g.strum(order.steps[i]); }
  assert.equal(g.state.over, true);
  assert.equal(g.state.served, 1);
  assert.equal(g.state.ruined, 0);
  assert.equal(pairRecipe({ from: 'BAD', to: 'C' }).steps[0], 'C');
});

test('memory reveals only the current target, never a future shape or the same shape on another step', () => {
  const g = drill(), l = createLearning(g, context); g.tick(10);
  assert.equal(l.visible(0), false);
  const hidden = l.snapshot(g.snapshot());
  assert.equal(hidden.stations[0].wants, 'C');
  assert.equal(chordBoxes(hidden, GEO)[0], null);
  assert.equal(l.reveal(0), true);
  assert.equal(l.reveal(0), false);
  assert.ok(chordBoxes(l.snapshot(g.snapshot()), GEO)[0]);
  g.strum('C');
  assert.equal(l.visible(0), false);
  assert.equal(l.setContext({ ...context, assistance: 'guided' }), false, 'the chosen assistance is locked once play starts');
  assert.equal(l.finish().helpRequests, 1);
  assert.equal(l.finish().chords[0].helped, 1);
});

test('guided diagrams stay visible without counting a request', () => {
  const g = drill(), l = createLearning(g, { ...context, assistance: 'guided' }); g.tick(10);
  assert.equal(l.visible(0), true); assert.equal(l.reveal(0), false);
  g.strum('C'); assert.equal(l.visible(0), true);
  assert.equal(l.finish().helpRequests, 0);
});

test('directional medians omit initial waits, retain counts and need five first-attempt observations', () => {
  const g = drill(), report = createReport(g, context);
  g.tick(20000); g.strum('C');
  for (let i = 1; i < 13; i++) { g.tick(i % 2 ? 600 : 1000); g.strum(i % 2 ? 'F' : 'C'); }
  const r = report.finish();
  const cf = r.learning.pairs.find(p => p.from === 'C'), fc = r.learning.pairs.find(p => p.from === 'F');
  assert.equal(cf.medianMs, 600); assert.equal(fc.medianMs, 1000);
  assert.equal(cf.n, 6); assert.equal(fc.n, 6);
  assert.equal(r.slowest[0].from, 'F'); assert.equal(r.slowest[0].n, 6);
  assert.equal(median([10, 10000, 20, 30, 40]), 30);
  assert.equal(median([10, 20]), 15);
});

test('wrong and rough attempts and requested hints are counted but excluded from the clean median', () => {
  const g = drill(), l = createLearning(g, context); g.tick(10); g.strum('C');
  g.tick(500); g.strum('D'); g.tick(500); g.strum('F');
  g.tick(500); g.strum('C', 0.1); g.tick(500); g.strum('C');
  l.reveal(0); g.tick(700); g.strum('F');
  const pairs = l.finish().pairs;
  const cf = pairs.find(p => p.from === 'C'), fc = pairs.find(p => p.from === 'F');
  assert.equal(cf.observations, 2); assert.equal(cf.afterError, 1); assert.equal(cf.helped, 1);
  assert.equal(cf.n, 0); assert.equal(cf.medianMs, null); assert.equal(fc.afterError, 1);
  assert.equal(recommendPair({ sessions: [l.finish()] }, context), null);
});

test('pauses and empty-counter waits cannot become a slow transition', () => {
  const g = drill(), l = createLearning(g, context); g.tick(10); g.strum('C');
  l.breakTiming(); g.tick(30000); g.strum('F');
  assert.equal(l.finish().pairs.length, 0);
  g.tick(700); g.strum('C'); assert.equal(l.finish().pairs[0].medianMs, 700);
});

test('history and local records never pool different inputs, assistance or exercise contexts', () => {
  const s = storage();
  const session = { version: 1, context: learningContext(context), helpRequests: 0,
    chords: [{ chord: 'C', observations: 5, firstTry: 3 }],
    pairs: [{ from: 'C', to: 'F', samples: [600, 700, 800, 900], n: 4 }] };
  saveLearning(session, 10, s);
  assert.equal(recommendPair(loadLearning(s), context), null);
  for (const over of [{ assistance: 'guided' }, { input: 'keyboard' }, { mode: 'service', pans: 5 }, { ear: 'easy' }]) {
    const other = { ...session, context: learningContext({ ...context, ...over }) };
    saveLearning(other, 99, s);
    assert.equal(recommendPair(loadLearning(s), context), null);
    assert.notEqual(contextKey(other.context), contextKey(context));
  }
  saveLearning({ ...session, pairs: [{ ...session.pairs[0], samples: [1000], n: 1 }] }, 12, s);
  const next = recommendPair(loadLearning(s), context);
  assert.equal(next.n, 5); assert.equal(next.medianMs, 800);
  assert.equal(loadLearning(s).records[contextKey(context)], 12);
  assert.equal(previousRecall(loadLearning(s), session)[0].previous.firstTry, 3);
  assert.deepEqual(loadLearning({ getItem() { throw Error('blocked'); } }).sessions, []);
});

test('introductions contain one new shape and use an already encountered anchor', () => {
  const original = MENU.find(m => m.steps.includes('F'));
  const lesson = introductionRecipe({ ...original, steps: ['C', 'F', 'Am', 'G'] }, new Set(['C']));
  assert.deepEqual(lesson.steps, ['C', 'F', 'C', 'F']);
  assert.equal(lesson.lessonChord, 'F'); assert.equal(lesson.ingredients.length, 4);
  assert.deepEqual(introductionRecipe({ ...original, steps: ['C', 'F'] }, new Set()).steps, ['C', 'C']);
  assert.equal(introductionRecipe(original, new Set(original.steps)), original);
});

test('the learning path delays other orders during an introduction; the arcade deal is unchanged', () => {
  const g = createGame({ menu: MENU, levels: LEVELS, seed: 3, rules: { LEARNING: true, OPEN_MS: 10 } });
  g.tick(10); const first = g.state.stations[0].order;
  assert.ok(first.lessonChord); assert.ok(first.steps.length <= 4);
  g.strum(first.steps[0]); g.tick(1000);
  assert.equal(g.state.stations.filter(s => s.order).length, 1);
  assert.equal(g.state.stations.length, 1);
  g.strum(first.steps[1]); assert.equal(g.state.served, 1);
  g.tick(10); assert.ok(g.state.stations.length > 1);
  const arcade = createGame({ menu: MENU, levels: LEVELS, seed: 3 }); arcade.tick(10);
  assert.equal(arcade.state.stations[0].order.lessonChord, undefined);
});

test('the report labels the measurement context and prints sample counts, medians and exclusions', () => {
  const g = drill(), l = createLearning(g, context); g.tick(10); g.strum('C'); g.tick(700); g.strum('F');
  const html = learningSummary(l.finish());
  assert.match(html, /Isolated pair exercise/); assert.match(html, /0.70 s/);
  assert.match(html, /1\/1/); assert.match(html, /Not enough comparable observations/);
  assert.match(html, /After error/); assert.match(html, /Helped/);
});

test('quitting during a new shape records an abandoned introduction without inventing a failed chord', () => {
  const g = createGame({ menu: MENU, levels: LEVELS, seed: 3, rules: { LEARNING: true } });
  const r = createReport(g, { mode: 'practice', input: 'guitar' });
  g.tick(10);
  const chord = g.state.stations[0].order.lessonChord;
  assert.equal(r.finish().learning.chords.length, 0);
  const result = r.finish({ closed: true }).learning;
  assert.equal(result.chords[0].chord, chord);
  assert.equal(result.chords[0].lessonAbandoned, 1);
  assert.equal(result.chords[0].observations, 0);
  assert.match(learningSummary(result), /1 abandoned/);
});

test('the wait for a new customer is excluded from directional timing', () => {
  const g = createGame({ menu: [{ id: 'two', dish: 'Two', steps: ['C', 'G'], ingredients: ['tomato','basil'], price: 10, pan: 'skillet' }],
    levels: LEVELS, seed: 3, rules: { MAX_STATIONS: 1, COOL: 0, GROW_PER_S: 0, SEAT_DELAY_MS: 20000 } });
  const l = createLearning(g, { mode: 'practice', pans: 1 });
  g.tick(10); g.strum(g.state.stations[0].order.steps[0]);
  g.tick(700); g.strum(g.state.stations[0].order.steps[1]);
  assert.equal(l.finish().pairs.length, 1);
  g.tick(20000); g.strum(g.state.stations[0].order.steps[0]);
  assert.equal(l.finish().pairs.length, 1);
  assert.equal(l.finish().pairs[0].medianMs, 700);
});

test('losing an introduction on its familiar anchor belongs to the introduced shape', () => {
  const g = createGame({ menu: MENU, levels: LEVELS, seed: 3, rules: { LEARNING: true, MAX_STATIONS: 1 } });
  const l = createLearning(g, { mode: 'practice', pans: 1 });
  g.tick(10);
  g.state.stations[0].order = { ...g.state.stations[0].order, steps: ['C', 'F', 'C', 'F'], lessonChord: 'F' };
  g.strum('C'); g.tick(700); g.strum('F');
  g.tick(60000);
  assert.equal(g.state.ruined, 1);
  const chords = l.finish().chords;
  assert.equal(chords.find(c => c.chord === 'F').lessonLost, 1);
  assert.equal(chords.find(c => c.chord === 'F').lessonAttempts, 1);
  assert.equal(chords.find(c => c.chord === 'C').lessonLost, 0);
  assert.equal(chords.find(c => c.chord === 'C').lost, 1);
});
