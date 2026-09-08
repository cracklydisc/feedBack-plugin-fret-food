/*
 * The ear that the first chord chooses.
 *
 * The three grades of the guitar's ear were a URL parameter, which is to say
 * nobody's. The first chord of a service is heard with the kindest grade, so
 * that it is heard at all on a guitar the game has never met, and its score
 * says which grade this guitar and this room deserve. The rule is a pure
 * function and the adapter can change grade while it runs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earFor, EARS, createEngineAdapter } from '../src/input/engine.js';
import { createPort } from '../src/input/port.js';

test('the first chord picks the ear: whole gets hard, thin gets easy', () => {
  assert.equal(earFor(0.95), 'hard');
  assert.equal(earFor(0.85), 'hard');
  assert.equal(earFor(0.7), 'medium');
  assert.equal(earFor(0.5), 'medium');
  assert.equal(earFor(0.45), 'easy');
  assert.equal(earFor(0.1), 'easy');
  // Nonsense is the middle, never a throw.
  assert.equal(earFor(undefined), 'medium');
  assert.equal(earFor('what'), 'medium');
});

test('the adapter changes its ear while it runs, and says which one it has', () => {
  const port = createPort('guitar');
  const audio = { async getLevels() { return { inputLevel: 0 }; }, async scoreChord() { return { score: 0 }; } };
  const ad = createEngineAdapter(port, { audio, ear: 'easy', schedule: () => 0, unschedule: () => {} });
  assert.equal(ad.stats.ear, 'easy', 'it starts with the grade it was given');
  ad.setEar('hard');
  assert.equal(ad.stats.ear, 'hard');
  ad.setEar('nonsense');
  assert.equal(ad.stats.ear, 'medium', 'a grade that does not exist is the middle one');
  for (const name of Object.keys(EARS)) {
    ad.setEar(name);
    assert.equal(ad.stats.ear, name);
  }
});
