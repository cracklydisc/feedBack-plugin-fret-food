/*
 * The menu and the shapes.
 *
 * A wrong number in a chord shape is the only defect in this game that does
 * damage off the screen: the player learns the wrong chord and takes it away
 * with them. So the shapes are checked against the chord book, not against
 * themselves.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, CHORDS, MENU, LEVELS, COOKWARE, INGREDIENTS, dist, price, diagram, pressed, chordsUpTo, chordLevel, changes, isBarre, label,
} from '../src/menu.js';
import { inventMenu } from '../src/invent.js';

/* The shapes as they are printed in every beginner's chord book, low E first.
 * Written out by hand on purpose: comparing the code to itself would prove
 * nothing. */
const BOOK = {
  C: 'x32010', Dm: 'xx0231', Em: '022000', F: 'xx3211',
  G: '320003', G7: '320001', Am: 'x02210', E: '022100',
  E7: '020100', A7: 'x02020', D: 'xx0232', D7: 'xx0212', B7: 'x21202',
  A: 'x02220',
  // The small movements: a finger lifted or added, and the bass stepping down.
  Dsus4: 'xx0233', Cadd9: 'x32033', Gsus4: '320013', Asus2: 'x02200', Asus4: 'x02230', 'G/B': 'x20003',
  // The barres, and the same two shapes moved up the neck.
  Bb: 'x13331', Bm: 'x24432', 'F#m': '244222',
  'C#m': 'x46654', Eb: 'x68886',
  // The whole F, and the two that finish the key of E.
  'F+': '133211', B: 'x24442', 'G#m': '466444',
};

test('the whole F is written F, and only the fingering tells it from the small one', () => {
  assert.equal(label('F+'), 'F');
  assert.equal(label('F'), 'F');
  assert.equal(label('Cadd9'), 'Cadd9', 'a shape with no display name is called by its key');
  assert.equal(label('nonsense'), 'nonsense');
  assert.notEqual(diagram('F+').text, diagram('F').text);
  assert.ok(isBarre('F+'), 'the whole F is a barre');
  assert.equal(diagram('F+').strings.filter((s) => !s.muted).length, 6, 'across all six strings');
  assert.equal(diagram('F').strings.filter((s) => !s.muted).length, 4, 'where the small one sounds four');
  assert.ok(chordLevel('F+') > chordLevel('F'), 'and it comes later');
});

test('every shape matches the chord book', () => {
  for (const name of CHORDS) {
    assert.equal(diagram(name).text, BOOK[name], name + ' is not the shape people are taught');
  }
  assert.deepEqual(Object.keys(BOOK).sort(), CHORDS.slice().sort(), 'a chord was added without a book entry');
});

test('a fingering is playable by a hand that has four fingers', () => {
  for (const name of CHORDS) {
    const d = diagram(name);
    const sounding = d.strings.filter((s) => !s.muted);
    assert.ok(sounding.length >= 3, name + ' would sound too thin');

    for (const s of d.strings) {
      if (s.fret > 0) assert.ok(s.finger >= 1 && s.finger <= 4, name + ' presses string ' + s.string + ' with no finger');
      else assert.equal(s.finger, 0, name + ' puts a finger on a string it does not press');
    }
    /* Four FINGERS, not four strings. This counted the strings, which was the
     * same number until the barres arrived: one finger lying across the neck
     * holds up to six of them and is still one finger. */
     const used = new Set(d.strings.filter((s) => s.finger).map((s) => s.finger));
    assert.ok(used.size <= 4, name + ' needs more than four fingers');

    // Two fingers on one fret of two strings is a small barre and is fine; the
    // same finger on two different frets is not something a hand can do.
    const byFinger = new Map();
    for (const s of d.strings) {
      if (!s.finger) continue;
      if (byFinger.has(s.finger)) {
        assert.equal(byFinger.get(s.finger), s.fret, name + ': finger ' + s.finger + ' is asked to be on two frets');
      }
      byFinger.set(s.finger, s.fret);
    }
    /* A shape has to fit in the four fret spaces the diagram draws, wherever on
     * the neck it sits. This used to say `highestFret <= 4` — every chord was
     * an open shape and the sentence was true by accident. It is the SPAN that
     * matters: C#m at the fourth fret and Eb at the sixth are four frets wide
     * and drawable; a shape six frets wide would not be, and no hand this game
     * is for would want it. */
    const span = d.highestFret > 0 ? d.highestFret - d.lowestFret : 0;
    assert.ok(span < 4, name + ' spans ' + (span + 1) + ' frets, more than the diagram can show');
    assert.ok(d.highestFret <= 9, name + ' sits too far up the neck for this game');
  }
});

test('muted strings are the low ones, never a hole in the middle', () => {
  // A muted string between two ringing ones takes a technique a beginner does
  // not have. If a shape ever needs one, it does not belong in this game.
  for (const name of CHORDS) {
    const played = diagram(name).strings.map((s) => !s.muted);
    const first = played.indexOf(true);
    assert.ok(first >= 0);
    assert.ok(played.slice(first).every(Boolean), name + ' mutes a string in the middle');
  }
});

test('distance is symmetric, zero on itself, and never more than six', () => {
  /* Six, not four: the bound was four because nothing pressed more than four
   * strings. A barre presses six, so a change onto one measures five or six,
   * which is the right answer and not an overflow — it earns more money and it
   * comes out dirty when it is rushed, both of which are what a barre does. */
  for (const a of CHORDS) {
    assert.equal(dist(a, a), 0);
    for (const b of CHORDS) {
      assert.equal(dist(a, b), dist(b, a), a + ' and ' + b + ' disagree on how far apart they are');
      assert.ok(dist(a, b) >= 0 && dist(a, b) <= 6, a + ' to ' + b + ' measures ' + dist(a, b));
    }
  }
  // And the hardest change in the game really is onto a barre, not between two
  // open shapes: that is the whole point of the second axis.
  const open = CHORDS.filter((c) => chordLevel(c) <= 3);
  const worstOpen = Math.max(...open.flatMap((a) => open.map((b) => dist(a, b))));
  const worstAny = Math.max(...CHORDS.flatMap((a) => CHORDS.map((b) => dist(a, b))));
  assert.ok(worstAny > worstOpen, 'the barres should be further from everything than the open shapes are');
});

test('distance counts the fingers that actually move', () => {
  assert.equal(dist('C', 'Am'), 1, 'C to Am is the same hand minus one finger');
  assert.equal(dist('E', 'E7'), 1, 'E to E7 lifts one finger');
  assert.equal(dist('C', 'F'), 3, 'C to F moves everything');
  assert.equal(dist('C', 'G'), 3);
  assert.equal(dist('Dm', 'D'), 1, 'the minor to the major is one finger');
});

test('a dish is priced by its own recipe, with nothing added by hand', () => {
  for (const m of MENU) {
    assert.equal(m.price, price(m.steps), m.dish + ' has a price that does not come from its recipe');
    assert.ok(m.price > 0);
  }
  /* The easiest dish on the menu is the one that never changes chord, and the
   * comparison is against the showpiece rather than against a neighbour: the
   * opening dishes are four steps now, so `crostini` is no longer the cheapest
   * thing there is. */
  const toast = MENU.find((m) => m.id === 'toast');
  const cannoli = MENU.find((m) => m.id === 'cannoli');
  assert.ok(cannoli.price > toast.price * 2, 'a hard dish has to pay a lot more than an easy one');
});

test('the opening dishes repeat their chords, and the late ones change every step', () => {
  /* THE DIFFICULTY CURVE, and it lives in the menu.
   *
   * A dish may repeat a chord — `C C Am Am` is four steps and one change —
   * which is the exercise a first lesson sets and was impossible under the old
   * rule, where a strum that cooked step n heated step n+1 as well. A step is
   * one chord heard now, so a repeat is simply a step whose chord matches the
   * one before it, and `STEP_GAP_MS` in the engine is what keeps the ear's
   * phantom onsets from cooking it for free.
   *
   * So the claim is about SHAPE and not about legality: the first service is
   * mostly repeats and the fifth is mostly changes. */
  const changes = (m) => m.steps.filter((c, i) => i > 0 && c !== m.steps[i - 1]).length;
  const density = (m) => changes(m) / (m.steps.length - 1);

  const early = MENU.filter((m) => m.level === 1);
  const late = MENU.filter((m) => m.level >= 4);
  assert.ok(early.some((m) => density(m) < 0.5), 'the first service needs a dish that mostly holds one chord');
  for (const m of late) {
    assert.equal(density(m), 1, m.dish + ' is a late dish and should change on every step');
  }

  // And a repeat is cheap, by arithmetic: a chord that repeats moves no finger.
  const held = MENU.find((m) => density(m) === 0);
  assert.ok(held, 'there should be a dish that is one chord all the way through');
  assert.ok(held.price < Math.min(...late.map((m) => m.price)),
    held.dish + ' has to be worth less than every dish that asks for changes');
});

test('every dish is playable with the chords its level has taught', () => {
  for (const m of MENU) {
    const known = chordsUpTo(m.level);
    for (const c of m.steps) {
      assert.ok(known.includes(c), m.dish + ' needs ' + c + ' before any dish introduces it');
      assert.ok(SHAPES[c], m.dish + ' names a chord with no shape');
    }
  }
});

test('levels only ever get harder', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].stations >= LEVELS[i - 1].stations, 'level ' + (i + 1) + ' takes a station away');
    assert.ok(LEVELS[i].shapes >= LEVELS[i - 1].shapes, 'level ' + (i + 1) + ' forgets a shape');
    assert.ok(LEVELS[i].maxSteps >= LEVELS[i - 1].maxSteps, 'level ' + (i + 1) + ' shortens the recipes');
    assert.ok(LEVELS[i].burnerBoost >= LEVELS[i - 1].burnerBoost, 'level ' + (i + 1) + ' turns the fire down');
  }
  // Every level has to have a dish that fits in it, or a customer sits down and
  // nothing can be served to them.
  for (let n = 1; n <= LEVELS.length; n++) {
    const fits = MENU.filter((m) => m.level <= LEVELS[n - 1].shapes && m.steps.length <= LEVELS[n - 1].maxSteps);
    assert.ok(fits.length > 0, 'level ' + n + ' has no dish that fits');
  }
});

test('a level unlocks a shape tier or adds a place, never both', () => {
  /* The first barre of a player's life used to arrive in the same bell as a
   * fourth pot, and with four pots the round trip is already what ends a
   * service: the first time you met a hard recipe you were too busy to read
   * it. So the two axes take turns, and the table has to keep to that. */
  for (let i = 1; i < LEVELS.length; i++) {
    const morePans = LEVELS[i].stations > LEVELS[i - 1].stations;
    const moreShapes = LEVELS[i].shapes > LEVELS[i - 1].shapes;
    assert.ok(!(morePans && moreShapes), LEVELS[i].name + ' adds a place and unlocks shapes in one bell');
    assert.ok(morePans || moreShapes || LEVELS[i].maxSteps > LEVELS[i - 1].maxSteps,
      LEVELS[i].name + ' adds nothing to play');
  }
  // And the whole neck is reached: the last level allows every tier there is.
  const top = Math.max(...Object.keys(SHAPES).map((c) => chordLevel(c)));
  assert.equal(LEVELS[LEVELS.length - 1].shapes, top, 'the last level should unlock the last tier');
  // The first tier is met alone, with the opening's pans and nothing new.
  assert.equal(LEVELS[0].shapes, 1);
});

test('the pressed view and the drawing agree', () => {
  for (const name of CHORDS) {
    const p = pressed(name);
    const drawn = diagram(name).strings.filter((s) => s.fret > 0);
    assert.equal(Object.keys(p).length, drawn.length, name + ' presses a different number of strings in the two views');
    for (const s of drawn) assert.equal(p[s.string], s.fret, name + ' disagrees on string ' + s.string);
  }
});

// ── the pan and what goes in it ──────────────────────────────────────────

test('every dish has its own pan, from the set the kitchen owns', () => {
  for (const m of MENU) {
    assert.ok(m.pan, m.dish + ' has no pan');
    assert.ok(COOKWARE.includes(m.pan), m.dish + ' asks for a pan nobody drew: ' + m.pan);
  }
  // A kitchen where every order is the same pot is a spreadsheet with flames
  // on it. Four different pans across seventeen dishes is the floor.
  const used = new Set(MENU.map((m) => m.pan));
  assert.ok(used.size >= 5, 'the counter should not be five identical pots (found ' + used.size + ')');
});

test('one ingredient per step, and never one more or one less', () => {
  // This is the rule the drawing leans on: cook a step, the next ingredient
  // goes in. Break the count and the pan either fills early or stops filling,
  // and either way it stops telling the truth about the order.
  for (const m of MENU) {
    assert.equal(m.ingredients.length, m.steps.length,
      m.dish + ' has ' + m.ingredients.length + ' ingredients for ' + m.steps.length + ' steps');
  }
});

test('nothing goes in a pan that has no sprite', () => {
  for (const m of MENU) {
    for (const item of m.ingredients) {
      assert.ok(INGREDIENTS.includes(item), m.dish + ' calls for ' + item + ', which nobody drew');
    }
  }
  // The other direction is a warning, not a failure: a spare sprite costs
  // nothing, a missing one draws an empty pan.
  const used = new Set(MENU.flatMap((m) => m.ingredients));
  const spare = INGREDIENTS.filter((i) => !used.has(i));
  assert.ok(spare.length <= 4, 'sprites drawn for nothing: ' + spare.join(', '));
});

test('the vocabularies have no duplicates', () => {
  assert.equal(new Set(COOKWARE).size, COOKWARE.length);
  assert.equal(new Set(INGREDIENTS).size, INGREDIENTS.length);
});

test('a dish opens with something that reads as a start', () => {
  // The first ingredient is what a player sees land when the first step cooks,
  // and it should look like the beginning of that dish and not its garnish.
  const garnish = new Set(['parsley', 'basil', 'thyme', 'rosemary', 'pepper', 'salt', 'cherry', 'peel']);
  for (const m of MENU) {
    assert.ok(!garnish.has(m.ingredients[0]), m.dish + ' starts with a garnish: ' + m.ingredients[0]);
  }
});

// ── the second axis: where the hand goes ─────────────────────────────────

test('no dish asks for a shape from above its own level', () => {
  /* The neck position is a difficulty axis of its own, separate from how long
   * a recipe is: a four-chord dish of C Am F G is LONG, and a three-chord dish
   * of Bb F C is HARD. `SHAPES[x].level` says when a shape becomes allowed and
   * a dish is what asks for it, so nothing enforces the curve by itself. This
   * does. Without it the axis is a comment. */
  const bad = [];
  for (const d of MENU) {
    for (const c of d.steps) {
      if (chordLevel(c) > d.level) bad.push(d.id + ' (level ' + d.level + ') asks for ' + c + ' (level ' + chordLevel(c) + ')');
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('every shape tier introduces a shape the one before it did not have', () => {
  // A curve with a flat step in it is a tier that added nothing to play. The
  // tiers are the shapes' own ladder; which LEVEL unlocks each is the level
  // table's business, and it has its own test above.
  const tiers = [...new Set(Object.keys(SHAPES).map((c) => chordLevel(c)))].sort();
  assert.deepEqual(tiers, [1, 2, 3, 4, 5, 6], 'the shapes should span all six tiers: ' + tiers.join(','));
  for (let tier = 2; tier <= 6; tier++) {
    const added = chordsUpTo(tier).filter((c) => !chordsUpTo(tier - 1).includes(c));
    assert.ok(added.length > 0, 'tier ' + tier + ' asks for nothing new');
  }
});

test('a shape up the neck really is up the neck', () => {
  /* The point of the top two levels is that the hand LEAVES the first
   * position. If every level 6 shape still sat at the nut, the axis would be
   * a label rather than a difficulty. */
  const high = Object.keys(SHAPES).filter((c) => chordLevel(c) >= 6);
  assert.ok(high.length >= 2, 'the last level should bring more than one shape');
  for (const c of high) {
    assert.ok(diagram(c).lowestFret >= 4, c + ' is a level 6 shape but starts at fret ' + diagram(c).lowestFret);
  }
  const barred = Object.keys(SHAPES).filter((c) => chordLevel(c) >= 5);
  for (const c of barred) {
    const fingers = diagram(c).strings.filter((s) => s.fret > 0).map((s) => s.finger);
    const counts = {};
    for (const f of fingers) counts[f] = (counts[f] || 0) + 1;
    assert.ok(Object.values(counts).some((n) => n > 1), c + ' is meant to be a barre and no finger holds two strings');
  }
});

/*
 * ── THE INVENTED DISHES ──────────────────────────────────────────────────
 *
 * Twenty-three dishes are written by hand and the rest are invented, so the
 * invented ones have to answer to every rule the written ones do. If they did
 * not, the generator would be a way of getting round the menu's own tests —
 * which is the only real danger in generating content: not that it is bad, but
 * that nobody checks it.
 */
test('an invented dish answers to every rule a written one does', () => {
  const menu = inventMenu(MENU, 7, 6);
  const made = menu.filter((m) => m.id.startsWith('inv-'));
  assert.ok(made.length >= 25, 'there should be a few dozen invented dishes: ' + made.length);

  for (const m of made) {
    assert.ok(m.dish && m.dish.length > 3, 'a dish needs a name: ' + JSON.stringify(m));
    assert.ok(COOKWARE.includes(m.pan), m.dish + ' cooks in a pan the kitchen does not own: ' + m.pan);
    assert.equal(m.ingredients.length, m.steps.length, m.dish + ' has an ingredient per step or it does not');
    for (const i of m.ingredients) assert.ok(INGREDIENTS.includes(i), m.dish + ' asks for ' + i);
    assert.equal(m.price, price(m.steps), m.dish + ' is priced by hand');
    assert.equal(m.rn.split(' ').length, m.steps.length, m.dish + ' numerals do not count its steps');
    // The gate: nothing above the level it is served at.
    for (const c of m.steps) {
      assert.ok(chordLevel(c) <= m.level, m.dish + ' is a level ' + m.level + ' dish asking for ' + c);
    }
  }
});

test('the invented dishes land inside their level band, and vary', () => {
  const menu = inventMenu(MENU, 7, 6);
  for (let level = 1; level <= 6; level++) {
    const made = menu.filter((m) => m.id.startsWith('inv-') && m.level === level);
    assert.ok(made.length >= 4, 'level ' + level + ' should have invented dishes: ' + made.length);

    /* No two dishes on one level with the same PROGRESSION. What a player feels
     * as variety is the chords under their hand, not the word on the ticket:
     * six tickets reading `C C G G` with different food on them is one exercise
     * pretending to be six, and that is exactly what the first version did. */
    const shapes = made.map((m) => m.steps.join(' '));
    assert.equal(new Set(shapes).size, shapes.length, 'level ' + level + ' repeats a progression: ' + shapes.join(' | '));

    // And the curve: the opening holds its chords, the late services change.
    const density = (m) => changes(m) / Math.max(1, m.steps.length - 1);
    if (level === 1) {
      for (const m of made) assert.ok(density(m) <= 0.5, m.dish + ' asks a beginner for too many changes');
    }
    /* And the late services do not HOLD a chord — but a pattern may repeat one
     * of its own accord, and one does: a twelve-bar blues is two bars of I
     * before it moves, which is the form and not a beginner's crutch. So the
     * claim is a band and not an equality. */
    if (level >= 4) {
      for (const m of made) {
        assert.ok(density(m) >= 0.7, m.dish + ' holds too much for a late dish: ' + m.steps.join(' '));
      }
    }
  }
});

test('a dish is only called Barre when a finger really lies across the neck', () => {
  /* The names carry the progression, and a name that carries the wrong one is
   * worse than no name. D is a level four shape and has no barre in it; F has
   * one and is the level two lesson, so its dishes are named after their
   * progression the way the hand-written Amen Pomodoro is. */
  for (const m of inventMenu(MENU, 3, 6).filter((d) => d.id.startsWith('inv-'))) {
    const real = m.steps.some((c) => isBarre(c) && chordLevel(c) >= 4);
    if (/Barre|Up-the-Neck/.test(m.dish)) {
      assert.ok(real, m.dish + ' says barre and asks for none: ' + m.steps.join(' '));
    }
  }
});

test('the same seed invents the same menu', () => {
  const a = inventMenu(MENU, 11, 6).map((m) => m.id + ':' + m.steps.join(''));
  const b = inventMenu(MENU, 11, 6).map((m) => m.id + ':' + m.steps.join(''));
  assert.deepEqual(a, b, 'two players on one seed have to get one service');
  const c = inventMenu(MENU, 12, 6).map((m) => m.id + ':' + m.steps.join(''));
  assert.notDeepEqual(a, c, 'and a different seed has to give a different menu');
});

/* ── the variety a service actually offers ─────────────────────────── */

/** Every recipe a tier can be dealt, and the changes inside them. */
function offered(menu, tier) {
  const pool = menu.filter((m) => (m.level || 1) <= tier);
  const changes = new Set();
  for (const m of pool) {
    for (let i = 1; i < m.steps.length; i++) {
      if (m.steps[i] !== m.steps[i - 1]) changes.add(m.steps[i - 1] + '>' + m.steps[i]);
    }
  }
  return { pool, changes };
}

test('no two dishes on the menu are the same recipe', () => {
  /* The variety a player feels is the chords under their hand, not the word on
   * the ticket. `Dm Dm G G` was Dorian Broth written by hand AND Half-Step Ragu
   * invented beside it: two tickets, one exercise. The inventor deduped within
   * a level, which caught neither the hand-written menu nor the level above. */
  for (const seed of [1, 7, 11, 42]) {
    const menu = inventMenu(MENU, seed, 10);
    const seen = new Map();
    for (const m of menu) {
      const recipe = m.steps.join(' ');
      assert.equal(seen.has(recipe), false,
        'seed ' + seed + ': ' + m.dish + ' is ' + seen.get(recipe) + ' again — ' + recipe);
      seen.set(recipe, m.dish);
    }
  }
});

test('the opening deals more than one silhouette', () => {
  /* Every dish the Opening could invent used to be `X X Y Y`: the band held
   * each degree for exactly two steps and allowed one change, so eleven of its
   * fourteen tickets had the same shape. A session felt it as "sempre lo
   * stesso ordine di combinazione di accordi" — the chords varied, the drill
   * never did. Where the change FALLS is most of what a change drill is. */
  const { pool } = offered(inventMenu(MENU, 7, 10), 1);
  const shapes = new Set();
  for (const m of pool) {
    // The silhouette: how long each chord is held, `C C G` -> "2,1".
    const runs = [];
    for (const c of m.steps) {
      if (runs.length && runs[runs.length - 1].c === c) runs[runs.length - 1].n++;
      else runs.push({ c, n: 1 });
    }
    shapes.add(runs.map((r) => r.n).join(','));
  }
  assert.ok(shapes.size >= 4, 'the opening deals one drill in several shapes: ' + [...shapes].join('  '));
});

test('every tier offers enough to drill without repeating itself', () => {
  /* Measured before this was written, at six invented dishes a tier: the
   * Opening had fourteen tickets and eleven distinct changes, and a service
   * spends forty-five seconds there. The bands below are what ten a tier buys.
   * They are floors and not targets — the point is to notice if a change to
   * the inventor quietly empties a tier, which is the one thing a player
   * feels immediately and no other test would see. */
  /* The worst case over thirty seeds, less a little: floors, not targets. The
   * point is to notice if a change to the inventor quietly empties a tier —
   * the one thing a player feels immediately and no other test would see.
   *
   * Tier one's change count is the tier's own ceiling and not the inventor's:
   * six shapes and one change to a dish is at most a few dozen ordered pairs,
   * and twenty tickets cannot show more than twenty of them. What the Opening
   * gained is not more changes, it is more SHAPES of drill on the same ones —
   * which is the test above, and is what the session was actually describing. */
  const floors = [null, [18, 11], [40, 34], [58, 55], [76, 80], [95, 105], [108, 125]];
  for (const seed of [1, 7, 11, 42]) {
    const menu = inventMenu(MENU, seed, 10);
    for (let tier = 1; tier <= 6; tier++) {
      const { pool, changes } = offered(menu, tier);
      const [dishes, moves] = floors[tier];
      assert.ok(pool.length >= dishes,
        'seed ' + seed + ' tier ' + tier + ' offers only ' + pool.length + ' dishes');
      assert.ok(changes.size >= moves,
        'seed ' + seed + ' tier ' + tier + ' offers only ' + changes.size + ' distinct changes');
    }
  }
});

test('every shape the game teaches is asked for by some dish', () => {
  /* A shape with no dish behind it is a diagram nobody is ever sent to play.
   * `Gsus4` was one: the neck learned it and the menu never asked, because
   * `KEYS` gave most keys an `Isus4`, an `Iadd9`, a `Vsus4` and a `V/3` and
   * not one PATTERN used any of them — those degrees reached a player only
   * through the handful of dishes written by hand for them.
   *
   * Reaching them evenly needed weighting, not more patterns: `Iadd9` lives in
   * one key where `I V vi IV` can be written in every key there is, so an even
   * draw over PATTERNS is a very uneven draw over SHAPES. Measured over forty
   * seeds before the weight, Cadd9 reached an invented dish in 13 and Gsus4 in
   * 15; after, 21 and 26, and the whole menu covers both on 40 of 40 because
   * the hand-written dishes carry what the roll misses. */
  for (const seed of [1, 7, 11, 42]) {
    const asked = new Set(inventMenu(MENU, seed, 10).flatMap((m) => m.steps));
    for (const c of Object.keys(SHAPES)) {
      assert.ok(asked.has(c), 'seed ' + seed + ': no dish on the menu ever asks for ' + c);
    }
  }
});
