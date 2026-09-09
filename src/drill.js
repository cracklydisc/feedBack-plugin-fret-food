import { price } from './menu.js';
import { DEFAULT_PAIR, validPair } from './learning.js';

// Twelve transitions give six observations in each direction, after one
// untimed starting chord. A finished dish ends this short exercise.
export function pairRecipe(target) {
  const pair = validPair(target) ? target : DEFAULT_PAIR;
  const steps = Array.from({ length: 13 }, (_, i) => i % 2 ? pair.to : pair.from);
  return { id: 'pair-' + pair.from + '-' + pair.to, dish: 'PAIR PRACTICE', level: 1,
    steps, price: price(steps), pan: 'skillet', rn: '',
    ingredients: steps.map((_, i) => i % 2 ? 'basil' : 'tomato'), pair: { ...pair } };
}

/** Short first encounters use a shape from the current tier and an already
 * encountered anchor. They reuse the existing tier schedule and dish artwork. */
export function introductionRecipe(dish, familiar) {
  const target = dish.steps.find(c => !familiar.has(c));
  if (!target) return dish;
  const anchor = dish.steps.find(c => c !== target && familiar.has(c)) || [...familiar][0];
  const steps = anchor ? [anchor, target, anchor, target] : [target, target];
  return { ...dish, id: dish.id + '-intro-' + target, dish: 'NEW SHAPE SPECIAL',
    steps, price: price(steps), rn: '', lessonChord: target,
    ingredients: steps.map((_, i) => dish.ingredients?.[i % dish.ingredients.length] || 'tomato') };
}
