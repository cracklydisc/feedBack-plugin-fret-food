/*
 * ─────────────────────────────────────────────────────────────────────────
 * INVENTING DISHES, which is not the same thing as generating them at random.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Twenty-three dishes are written by hand in `menu.js` and they are the ones
 * worth writing by hand: Canon Cannoli is Pachelbel, Twelve-Bar Beans is a
 * twelve bar blues, Andalusian Gazpacho is the Andalusian cadence. Each one
 * teaches a progression a guitarist should know, and no generator is going to
 * come up with those.
 *
 * What a generator IS for is volume, and the volume matters: four dishes a
 * level means a player sees the same four tickets over and over inside one
 * service. This makes more of them, gated on difficulty by level, from a
 * vocabulary that is declared rather than sampled.
 *
 * ── WHY NOT ACTUALLY AT RANDOM ─────────────────────────────────────────
 *
 * Two reasons, and both are things a random draw gets wrong in a way a player
 * notices at once.
 *
 * A random walk over the chords a level has taught is not a progression. It is
 * a list. `Am Bb Em D7` is playable and means nothing, and this game's whole
 * claim is that the menu teaches while it sells — a name that carries its
 * progression is a lie if the progression is noise. So a recipe is built from
 * a KEY and a PATTERN OF DEGREES, which is how progressions are actually made:
 * pick a key the level can play, pick `I V vi IV`, and what comes out is
 * something a teacher would set.
 *
 * And a random draw from forty-two ingredients is not a dish. `chocolate,
 * ribs, cucumber` is funny once. So the ingredients come from FAMILIES — a
 * pan, a pool of things that belong together, and a set of food nouns for the
 * name — and a dish is one family all the way through.
 *
 * ── THE GATE ───────────────────────────────────────────────────────────
 *
 * Difficulty is three numbers and they are all readable off the recipe: how
 * many steps it has, how many of those steps are CHANGES, and the hardest
 * shape it asks for. The level says the band for each, and `BANDS` below is
 * the whole difficulty curve of the game in six lines. A dish that lands
 * outside its band is not adjusted, it is thrown away and re-rolled: a gate
 * that bends is not a gate.
 */

import { CHORDS, chordLevel, isBarre, price, changes } from './menu.js';

/*
 * The keys, as degrees. Only the chords this game has shapes for: F major's ii
 * is a Gm and there is no Gm on the neck yet, so the key of F has no ii and
 * says so instead of quietly substituting something.
 *
 * The two blues keys are here for the same reason the twelve-bar dishes are on
 * the menu: dominant sevenths in a I-IV-V are a different sound and a
 * different lesson from the diatonic keys above them.
 */
const KEYS = [
  { root: 'C', deg: { I: 'C', ii: 'Dm', iii: 'Em', IV: 'F', V: 'G', vi: 'Am', V7: 'G7' } },
  { root: 'G', deg: { I: 'G', ii: 'Am', iii: 'Bm', IV: 'C', V: 'D', vi: 'Em', V7: 'D7' } },
  { root: 'D', deg: { I: 'D', ii: 'Em', iii: 'F#m', IV: 'G', V: 'A', vi: 'Bm', V7: 'A7' } },
  { root: 'A', deg: { I: 'A', ii: 'Bm', iii: 'C#m', IV: 'D', V: 'E', vi: 'F#m', V7: 'E7' } },
  { root: 'F', deg: { I: 'F', iii: 'Am', IV: 'Bb', V: 'C', vi: 'Dm' } },
  { root: 'Bb', deg: { I: 'Bb', IV: 'Eb', V: 'F' } },
  { root: 'A7', blues: true, deg: { I7: 'A7', IV7: 'D7', V7: 'E7' } },
  { root: 'E7', blues: true, deg: { I7: 'E7', IV7: 'A7', V7: 'B7' } },
];

/*
 * The patterns, in degrees, with the word each one puts in a dish's name.
 *
 * The name is not decoration: `Cadence Bruschetta` is a perfect cadence and a
 * player who cooks it twenty times has met one. So every pattern here carries
 * the word for what it IS, and an invented dish is named by its progression
 * exactly the way the hand-written ones are.
 */
const PATTERNS = [
  /* The two-degree patterns carry the opening service on their own, because at
   * level one the neck has four shapes on it and a progression can only be so
   * many things. Without them the first six tickets were five copies of `C C G
   * G` with different food on them. */
  { deg: ['V', 'I'], name: 'Cadence' },
  { deg: ['IV', 'I'], name: 'Amen' },
  { deg: ['I', 'V'], name: 'Open' },
  { deg: ['I', 'vi'], name: 'One-Finger' },
  { deg: ['ii', 'V'], name: 'Half-Step' },
  { deg: ['vi', 'V'], name: 'Nightfall' },
  { deg: ['I', 'IV'], name: 'Plain' },
  { deg: ['iii', 'vi'], name: 'Shadow' },
  { deg: ['ii', 'V', 'I'], name: 'Two-Five-One' },
  { deg: ['I', 'IV', 'V'], name: 'Three-Chord' },
  { deg: ['I', 'V', 'vi', 'IV'], name: 'Fifties' },
  { deg: ['I', 'vi', 'IV', 'V'], name: 'Turnaround' },
  { deg: ['vi', 'IV', 'I', 'V'], name: 'Sunset' },
  { deg: ['I', 'iii', 'IV', 'V'], name: 'Rising' },
  { deg: ['ii', 'V', 'I', 'vi'], name: 'Rondo' },
  { deg: ['I', 'V', 'vi', 'iii', 'IV', 'I'], name: 'Canon' },
  { deg: ['I7', 'IV7', 'I7', 'V7'], name: 'Jump' },
  { deg: ['I7', 'I7', 'IV7', 'I7', 'V7', 'IV7'], name: 'Twelve-Bar' },
];

/*
 * The families: one pan, one pool of things that belong in it, and the food
 * words a dish from it can be called. A dish is one family all the way
 * through, which is the difference between a recipe and a shopping accident.
 */
const FAMILIES = [
  {
    id: 'pasta', pan: 'stockpot',
    pool: ['water', 'pasta', 'tomato', 'basil', 'cream', 'cheese', 'pepper', 'garlic', 'butter'],
    nouns: ['Tagliatelle', 'Rigatoni', 'Carbonara', 'Cacio e Pepe', 'Lasagne', 'Gnocchi'],
  },
  {
    id: 'pizza', pan: 'pizza',
    pool: ['dough', 'tomato', 'mozzarella', 'basil', 'oil', 'salami', 'chilli', 'cheese'],
    nouns: ['Margherita', 'Diavola', 'Focaccia', 'Calzone', 'Marinara'],
  },
  {
    id: 'soup', pan: 'stockpot',
    pool: ['water', 'broth', 'beans', 'carrot', 'celery', 'onion', 'herbs', 'potato', 'rice'],
    nouns: ['Minestrone', 'Ribollita', 'Pasta e Fagioli', 'Stracciatella', 'Broth'],
  },
  {
    id: 'roast', pan: 'roasting',
    pool: ['potato', 'chicken', 'oil', 'thyme', 'rosemary', 'garlic', 'onion', 'wine', 'salt'],
    nouns: ['Roast', 'Porchetta', 'Sformato', 'Arrosto', 'Tray Bake'],
  },
  {
    id: 'fry', pan: 'skillet',
    pool: ['bread', 'oil', 'butter', 'garlic', 'tomato', 'cheese', 'salami', 'herbs', 'eggplant'],
    nouns: ['Crostini', 'Bruschetta', 'Frittata', 'Panzanella', 'Caponata'],
  },
  {
    id: 'stew', pan: 'casserole',
    pool: ['ribs', 'wine', 'carrot', 'onion', 'celery', 'bacon', 'rosemary', 'beans', 'broth'],
    nouns: ['Brasato', 'Ragu', 'Spezzatino', 'Stufato', 'Bollito'],
  },
  {
    id: 'sweet', pan: 'bowl',
    pool: ['cream', 'sugar', 'chocolate', 'cherry', 'vanilla', 'pistachio', 'ricotta', 'peel', 'flour'],
    nouns: ['Cannoli', 'Affogato', 'Panna Cotta', 'Cassata', 'Zabaione', 'Tiramisu'],
  },
  {
    id: 'cold', pan: 'tub',
    pool: ['cream', 'sugar', 'vanilla', 'pistachio', 'cherry', 'chocolate', 'peel'],
    nouns: ['Gelato', 'Sorbetto', 'Semifreddo', 'Granita'],
  },
];

/*
 * ── THE BANDS, which are the difficulty curve ──────────────────────────
 *
 * `steps` is how long the ticket is, `changes` how many of those steps are a
 * chord change, `hold` how many steps one degree of the pattern may take.
 *
 * Read the `hold` column downwards and the whole design is there: at the
 * opening a degree is held for two steps, so `V I` becomes `G G C C` — four
 * chords and ONE change, which is what a first lesson asks for. By the fourth
 * service nothing is held, so every step is a change. Difficulty moves from
 * holding a shape to changing it, which is the order a guitarist learns in.
 */
const BANDS = [
  null,
  { steps: [4, 4], changes: [0, 1], hold: [2, 2] },   // 1 Opening
  { steps: [3, 4], changes: [1, 3], hold: [1, 2] },   // 2 Lunch
  { steps: [4, 5], changes: [2, 4], hold: [1, 2] },   // 3 Lunch Rush
  { steps: [4, 6], changes: [3, 5], hold: [1, 1] },   // 4 Afternoon
  { steps: [4, 6], changes: [3, 5], hold: [1, 1] },   // 5 Dinner
  { steps: [6, 8], changes: [5, 7], hold: [1, 1] },   // 6 Saturday Night
];

const band = (level) => BANDS[Math.max(1, Math.min(BANDS.length - 1, level))];
const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];
const between = ([lo, hi], rand) => lo + Math.floor(rand() * (hi - lo + 1));

/** Every shape at or below `level`, which is the gate on what may be asked for. */
export const playable = (level) => CHORDS.filter((c) => chordLevel(c) <= level);

/** The keys a level can play: every chord of the key has to be a shape the
 *  player has met. A key with fewer than two degrees left is not a key. */
export function keysFor(level) {
  const can = new Set(playable(level));
  const out = [];
  for (const key of KEYS) {
    const deg = {};
    for (const [d, c] of Object.entries(key.deg)) if (can.has(c)) deg[d] = c;
    if (Object.keys(deg).length >= 2) out.push({ root: key.root, blues: key.blues, deg });
  }
  return out;
}

/**
 * One dish, or `null` if this roll did not land inside the level's band.
 *
 * Returning `null` rather than fixing it up is the point: a gate that bends is
 * not a gate, and a recipe stretched to fit a band is a recipe nobody designed.
 * `invent` rolls again.
 */
function roll(level, rand, used) {
  const b = band(level);
  const keys = keysFor(level);
  if (!keys.length) return null;
  const key = pick(keys, rand);
  const usable = PATTERNS.filter((p) => p.deg.every((d) => key.deg[d]));
  if (!usable.length) return null;
  const pattern = pick(usable, rand);

  // Hold each degree for one step or two, and let the band decide which.
  const steps = [];
  const holds = [];
  for (const d of pattern.deg) {
    const hold = between(b.hold, rand);
    holds.push(hold);
    for (let k = 0; k < hold; k++) steps.push(key.deg[d]);
  }
  if (steps.length < b.steps[0] || steps.length > b.steps[1]) return null;

  const m = { steps };
  const n = changes(m);
  if (n < b.changes[0] || n > b.changes[1]) return null;

  const family = pick(FAMILIES, rand);
  /* The pool is rotated, so two dishes out of the same family are not the same
   * shopping list in the same order. */
  const from = Math.floor(rand() * family.pool.length);
  const noun = family.nouns.find((x) => !used.has(x)) || pick(family.nouns, rand);
  used.add(noun);

  /* The name says what the progression IS, and then what is in the pan. The
   * qualifier in front comes off the recipe rather than out of a list: a dish
   * that never changes chord is a One-Chord something, one that reaches a
   * barre says so, and one played on the top shapes says where the hand goes.
   * Which is the same promise the hand-written names make. */
  const reach = Math.max(...steps.map(chordLevel));
  const minor = steps.filter((c) => /m$/.test(c)).length > steps.length / 2;
  /* `Barre` is asked of the FINGERING and not of the level — D is a level four
   * shape with no barre in it, and a dish called Barre something that can be
   * fretted with three fingers is the menu lying — and it is asked only of the
   * barres BEYOND F. F is a barre and it is also the level two lesson, so
   * every dish containing one would be called Barre and the pattern names
   * would drown: the hand-written menu calls its F dish Amen Pomodoro, after
   * its progression, and keeps Barre for Bb and above. */
  const barre = steps.some((c) => isBarre(c) && chordLevel(c) >= 4);
  const word = n === 0 ? 'One-Chord'
    : reach >= 5 && barre ? 'Up-the-Neck'
      : barre ? 'Barre'
        : pattern.name;
  const dish = word + ' ' + noun + (minor ? ' in Minor' : '');

  return {
    id: 'inv-' + level + '-' + key.root.replace('#', 's') + '-' + pattern.deg.join('') + '-' + family.id,
    dish,
    steps,
    /* One degree per step, holds included, so the numeral line under the name
     * counts the same way the recipe does. */
    rn: holds.map((h, k) => new Array(h).fill(pattern.deg[k]).join(' ')).join(' '),
    level,
    pan: family.pan,
    ingredients: steps.map((_, k) => family.pool[(from + k) % family.pool.length]),
    price: price(steps),
  };
}

/**
 * `count` invented dishes for `level`, all inside its band, none the same.
 *
 * Deterministic: the same seed gives the same menu, which is what lets a bench
 * run mean anything and what makes two players on the same seed play the same
 * service.
 */
export function invent(level, rand, count, used) {
  const out = [];
  const seen = used || new Set();
  const ids = new Set();
  const shapes = new Set();
  for (let tries = 0; out.length < count && tries < count * 80; tries++) {
    const d = roll(level, rand, seen);
    if (!d || ids.has(d.id)) continue;
    /* And no two dishes on one level with the same PROGRESSION. The variety a
     * player feels is the chords under their hand, not the word on the ticket:
     * six tickets that all read `C C G G` with different food on them is one
     * exercise pretending to be six. Where the level has fewer progressions
     * than it was asked for, it returns fewer — an honest four beats a padded
     * six. */
    const shape = d.steps.join(' ');
    if (shapes.has(shape)) continue;
    shapes.add(shape);
    ids.add(d.id);
    out.push(d);
  }
  return out;
}

/**
 * The menu the game is played with: everything written by hand, plus invented
 * dishes to fill each level out.
 *
 * The hand-written ones come first and are weighted by the engine's own
 * chooser, so the named progressions stay the backbone and the invented ones
 * are the variety around them.
 */
/*
 * ── THE DRILLS, which are not progressions and do not pretend to be ────────
 *
 * The harmonic dishes above are the menu's claim: every name is a progression.
 * But this is an arcade about the speed of the CHANGE, and after five services
 * a player has had enough of opening on the cadence in C. A drill is two or
 * three shapes the tier allows, in a random order, with the holds the band
 * asks for — `E E A A`, `D G D` — and its name says exactly which changes it
 * is: `E-to-A Frittata`, `D-G-D Skewers`. No key, no degrees, so it is never
 * voiced; the price is the fingers that move, as for every other dish. One
 * chord of the newest tier goes in whenever the tier has one, so a drill is
 * how a new shape is met most often.
 */
function drill(level, rand, used) {
  const b = band(level);
  const pool = playable(level);
  if (pool.length < 2) return null;
  const fresh = pool.filter((c) => chordLevel(c) === level);
  const n = rand() < 0.65 ? 2 : 3;
  const chords = [];
  if (fresh.length) chords.push(pick(fresh, rand));
  while (chords.length < n) {
    const c = pick(pool, rand);
    if (!chords.includes(c)) chords.push(c);
  }
  // Shuffled, so the new shape is not always the first thing asked for.
  for (let i = chords.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1);
    [chords[i], chords[j]] = [chords[j], chords[i]];
  }
  const steps = [];
  for (const c of chords) {
    const hold = between(b.hold, rand);
    for (let k = 0; k < hold; k++) steps.push(c);
  }
  // Back to the first shape when there is room: a change drill goes there and back.
  if (steps.length + 1 <= b.steps[1] && rand() < 0.5) steps.push(chords[0]);
  if (steps.length < b.steps[0] || steps.length > b.steps[1]) return null;
  const m = { steps };
  const ch = changes(m);
  if (ch < Math.max(1, b.changes[0]) || ch > b.changes[1]) return null;

  const family = pick(FAMILIES, rand);
  const from = Math.floor(rand() * family.pool.length);
  const noun = family.nouns.find((x) => !used.has(x)) || pick(family.nouns, rand);
  used.add(noun);
  const word = chords.length === 2 ? chords[0] + '-to-' + chords[1] : chords.join('-');
  return {
    id: 'drl-' + level + '-' + chords.join('').replace(/#/g, 's') + '-' + family.id,
    dish: word + ' ' + noun,
    steps,
    rn: '',
    level,
    drill: true,
    pan: family.pan,
    ingredients: steps.map((_, k) => family.pool[(from + k) % family.pool.length]),
    price: price(steps),
  };
}

/** `count` drills for `level`, none the same shape. */
export function drills(level, rand, count, used) {
  const out = [];
  const seen = used || new Set();
  const shapes = new Set();
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    const d = drill(level, rand, seen);
    if (!d) continue;
    const shape = d.steps.join(' ');
    if (shapes.has(shape)) continue;
    shapes.add(shape);
    out.push(d);
  }
  return out;
}

export function inventMenu(handWritten, seed, perLevel) {
  const n = perLevel === undefined ? 6 : perLevel;
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const used = new Set(handWritten.map((m) => m.dish.split(' ').pop()));
  const out = handWritten.slice();
  /* Half as many drills as progressions at every tier, so the menu stays a
   * menu of progressions with the change drills around them — and the first
   * services stop opening on the same two chords. */
  const d = Math.max(1, Math.round(n / 2));
  for (let level = 1; level < BANDS.length; level++) {
    out.push(...invent(level, rand, n, used));
    out.push(...drills(level, rand, d, used));
  }
  return out;
}

export { FAMILIES, PATTERNS, BANDS, KEYS };

/**
 * THE SAME DISH IN ANOTHER KEY.
 *
 * A dish is a progression, and its name says which one: Cadence Bruschetta is
 * `V V I I` whatever key it is played in. The recipe written on the menu is one
 * key of it, and a service that dealt the menu as written started every time
 * with the same two chords — C, then G — because One-Chord Toast is `I I I I`
 * in C and the cadence is in C too. So a dish is VOICED when it is dealt: its
 * degrees are realised in a key whose chords are all shapes the level allows,
 * and the pot pays for the recipe that was actually asked (`price` counts the
 * fingers that move), so the money follows the hand and not the ticket.
 *
 * `voicings` is every other key the dish can be played in at `tier`; `voice`
 * picks one of those or the original, uniformly, off the game's own `rand`,
 * so two players on one seed get one service. A dish whose degrees no key has
 * (`i iv V7`, `I VI7 ii V7`) stays as written.
 */
export function voicings(dish, tier) {
  if (!dish || !dish.rn || !dish.steps) return [];
  const degs = String(dish.rn).trim().split(/\s+/);
  if (degs.length !== dish.steps.length) return [];
  const written = dish.steps.join(' ');
  const out = [];
  for (const key of KEYS) {
    const steps = degs.map((d) => key.deg[d]);
    if (steps.some((c) => !c || chordLevel(c) > tier)) continue;
    if (steps.join(' ') === written) continue;
    out.push({ root: key.root, steps });
  }
  return out;
}

export function voice(dish, tier, rand) {
  const alts = voicings(dish, tier);
  if (!alts.length) return dish;
  const k = Math.floor(rand() * (alts.length + 1)) % (alts.length + 1);
  if (k === alts.length) return dish;              // the written key is one of the choices
  const steps = alts[k].steps;
  return Object.assign({}, dish, { steps, price: price(steps), key: alts[k].root });
}
