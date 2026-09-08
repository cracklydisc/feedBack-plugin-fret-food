/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE MENU, and why no price here was chosen by hand.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A dish is a chord progression. What a dish is worth is not a number picked
 * to feel right: it is what the progression costs your hand. Below are the
 * real shapes on the neck, and everything else falls out of them: how far
 * apart two chords are, what a dish pays, which changes come out dirty when
 * you rush them, and the fingering diagram the player sees.
 *
 * One source for all four is the point. Add a chord and you write its shape
 * once; no table anywhere else needs updating, and the price of every dish
 * that uses it moves on its own.
 *
 * ── HOW A SHAPE IS WRITTEN ──────────────────────────────────────────────
 *
 * `frets` runs from string 6 (low E) to string 1 (high E), the way a chord box
 * is drawn. `0` is an open string, `-1` a string you do not play, and anything
 * else is a fret. `fingers` runs alongside it: 1 is the index, 4 the little
 * finger, 0 means no finger (open or muted).
 *
 * So C is `x 3 2 0 1 0`, which is what a beginner sees printed above the lyric
 * line. Storing it this way rather than as a bare list of fretted positions
 * costs nothing and buys the diagram: without the open and muted strings a
 * chord box is not a chord box, it is a guess.
 *
 * No full barre chords, no slash chords, no sevenths that are not dominant.
 * This is a game meant to be playable in your second month.
 */

export const SHAPES = {
  /* ── open position, the first tier: the six shapes a first month teaches.
   *
   * Em and D were up at the third and fourth tiers, with the sevenths and the
   * first barre, and E and A at the third — so a player who knew every open
   * chord met none of them until minute three, and every service opened on C
   * and G. They are open shapes with two and three fingers; they belong with
   * C. What makes the later tiers hard is the F, the sevenths' stretches and
   * the barres, not an open D. */
  C:  { level: 1, frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  Am: { level: 1, frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  G:  { level: 1, frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  Dm: { level: 1, frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  Em: { level: 1, frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  D:  { level: 1, frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },

  /* ── the second tier: the last two open shapes, and the first that hurts ── */
  A:  { level: 2, frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  E:  { level: 2, frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  F:  { level: 2, frets: [-1, -1, 3, 2, 1, 1], fingers: [0, 0, 3, 2, 1, 1] },

  /* ── the sevenths ────────────────────────────────────────────────────── */
  A7: { level: 3, frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 2, 0, 3, 0] },
  E7: { level: 3, frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  G7: { level: 3, frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1] },
  D7: { level: 3, frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },

  /* ── four fingers, and the first real barre ─────────────────────────── */
  B7: { level: 4, frets: [-1, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4] },
  Bb: { level: 4, frets: [-1, 1, 3, 3, 3, 1], fingers: [0, 1, 2, 3, 4, 1] },

  /* ── barres, held across the neck ───────────────────────────────────── */
  Bm:   { level: 5, frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1] },
  'F#m': { level: 5, frets: [2, 4, 4, 2, 2, 2], fingers: [1, 3, 4, 1, 1, 1] },

  /* ── the same barres, moved up the neck ─────────────────────────────── */
  'C#m': { level: 6, frets: [-1, 4, 6, 6, 5, 4], fingers: [0, 1, 3, 4, 2, 1] },
  Eb:   { level: 6, frets: [-1, 6, 8, 8, 8, 6], fingers: [0, 1, 2, 3, 4, 1] },
};

/**
 * The lowest service level at which a shape may be asked for.
 *
 * This is the SECOND axis of difficulty, and it is a separate one from the
 * length of a recipe. A four-chord dish made of C, Am, F and G is a long dish;
 * a three-chord dish made of Bb, F#m and C#m is a hard one, and up until now
 * the game had no way to say so. The shapes climb the neck: open position,
 * then the partial F, then the sevenths, then a first barre at the first fret,
 * then full barres, then the same barres moved up to the fourth and the sixth.
 *
 * Nothing enforces this by itself — a dish is what asks for a chord — so
 * `tests/menu.test.js` refuses a dish that asks for a shape from above its own
 * level. That is what keeps the curve a curve instead of a comment.
 */
export const chordLevel = (name) => (SHAPES[name] ? SHAPES[name].level || 1 : 1);

/** Whether a shape is a BARRE: one finger laid across two strings or more.
 *
 * Read off the fingering rather than off a list, because a list would have to
 * be kept in step with nineteen shapes and would be wrong the first time one
 * is added. It is what a dish's name needs to know before it calls itself a
 * barre: D has three fingers on three strings and is not one. */
export function isBarre(name) {
  const s = SHAPES[name];
  if (!s) return false;
  const count = new Map();
  s.fingers.forEach((f, i) => { if (f > 0 && s.frets[i] > 0) count.set(f, (count.get(f) || 0) + 1); });
  return [...count.values()].some((n) => n >= 2);
}

export const CHORDS = Object.keys(SHAPES);

/**
 * Where the fingers actually press: `{ string: fret }`, string 6 is low E.
 *
 * Open and muted strings are not in here, because nothing moves for them. This
 * is the view the distance and the chord detector both want; the full `frets`
 * array above is the one the diagram wants. Two views, one source.
 */
export function pressed(name) {
  const s = SHAPES[name];
  if (!s) return null;
  const out = {};
  s.frets.forEach((f, i) => { if (f > 0) out[6 - i] = f; });
  return out;
}

export const PRESSED = {};
for (const name of CHORDS) PRESSED[name] = pressed(name);

/**
 * How much of the hand moves to get from one shape to the other: the number of
 * STRINGS whose fret changes.
 *
 * Measured both ways round and the worse one kept: going from a two-finger
 * chord to a four-finger one costs what the trip back costs, because it is the
 * same movement seen from two ends.
 *
 * The scale is 0 (the same shape) to 6, and it used to be 0 to 4 because
 * nothing in the game pressed more than four strings. The barres press six, so
 * a change onto one of them measures five or six — which is the right answer
 * and not an overflow: it is more of the hand moving, it earns more money
 * through `price`, and rushing it inside a beat comes out dirty, which is
 * exactly what rushing onto a barre does in real life.
 */
export function dist(a, b) {
  if (!a || !b || a === b) return 0;
  const A = PRESSED[a];
  const B = PRESSED[b];
  if (!A || !B) return 2;                    // a chord we do not know: assume average
  const moved = (X, Y) => Object.keys(X).filter((s) => X[s] !== Y[s]).length;
  return Math.max(moved(A, B), moved(B, A));
}

/**
 * What a dish is worth: three a step, two for every finger that moves, and
 * three more for every F, which in your second month is the chord that makes
 * people swear. The arithmetic is meant to be visible. An expensive dish has
 * to LOOK expensive when you read the recipe, not only in the number.
 */
export function price(steps) {
  let d = 0;
  for (let i = 1; i < steps.length; i++) d += dist(steps[i - 1], steps[i]);
  /* Three for every step and two for every finger that moves between two
   * shapes. A step is one chord heard, so the count of steps is the length of
   * the job and the distance is its difficulty — and a REPEATED chord adds a
   * step while adding no distance, which is why a dish of repeats comes out
   * worth about half a dish of changes without anybody deciding that it
   * should. */
  return 3 * steps.length + 2 * d + 3 * steps.filter((c) => c === 'F').length;
}

/**
 * The chord box, ready to draw: one entry per string from low E to high E.
 *
 * The game shows this while you play, because the point of the whole thing is
 * the change between shapes. A player who has to stop and look a chord up
 * somewhere else has already lost the pot.
 */
export function diagram(name) {
  const s = SHAPES[name];
  if (!s) return null;
  const frets = s.frets.filter((f) => f > 0);
  return {
    name,
    strings: s.frets.map((f, i) => ({
      string: 6 - i,
      fret: f,
      finger: s.fingers[i] || 0,
      open: f === 0,
      muted: f < 0,
    })),
    lowestFret: frets.length ? Math.min(...frets) : 0,
    highestFret: frets.length ? Math.max(...frets) : 0,
    /** The compact form printed in chord books: `x32010`. */
    text: s.frets.map((f) => (f < 0 ? 'x' : String(f))).join(''),
  };
}

/*
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THE DISH LOOKS LIKE, and why it is data and not decoration.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every recipe gets its own pan and its own ingredients, because a counter
 * where five identical pots hold five identical orange blobs is a spreadsheet
 * with flames on it. A stockpot of minestrone and a pizza stone read as
 * different jobs from across the room, and that is most of what makes a
 * kitchen feel like a kitchen.
 *
 * ── ONE INGREDIENT PER STEP ────────────────────────────────────────────
 *
 * `ingredients.length === steps.length`, always, and there is a test that says
 * so. Cook a step and the next ingredient goes in, so the pan fills as the
 * progression advances. That is not a flourish bolted onto the rule: it is the
 * rule, drawn. A player who glances at a pan can see how far that order has
 * come without reading anything, and the thing they are watching fill up is
 * literally their chord changes landing.
 *
 * ── CLOSED VOCABULARIES ────────────────────────────────────────────────
 *
 * `COOKWARE` and `INGREDIENTS` are the complete lists, and a test refuses a
 * dish that names anything outside them. The reason is practical: the drawing
 * has one sprite per entry, so a new dish that quietly asked for "saffron"
 * would render as nothing at all and nobody would notice until a player saw an
 * empty pan. A closed list turns that into a failing test instead.
 */

/** Every pan the kitchen owns. The drawing has one shape for each. */
export const COOKWARE = [
  'skillet',      // shallow, wide: toasting, frying
  'saucepan',     // small, deep, one handle
  'stockpot',     // tall, two handles, the soup pot
  'casserole',    // heavy, lidded, the slow one
  'pizza',        // a stone, flat
  'roasting',     // rectangular tray
  'tub',          // the cold one, for gelato
  'fryer',        // deep oil
  'bowl',         // served cold, sits on ice
];

/** Everything that can go into a pan. One sprite each. */
export const INGREDIENTS = [
  'bread', 'tomato', 'basil', 'garlic', 'herbs', 'water', 'broth', 'rice',
  'butter', 'pasta', 'cream', 'pepper', 'dough', 'mozzarella', 'eggplant',
  'cheese', 'ribs', 'onion', 'wine', 'rosemary', 'sugar', 'vanilla', 'cherry',
  'kernels', 'oil', 'salt', 'potato', 'chicken', 'thyme', 'beans', 'carrot',
  'celery', 'bacon', 'chilli', 'parsley', 'cucumber', 'salami', 'flour',
  'ricotta', 'chocolate', 'pistachio', 'peel',
];

/* The first dishes REPEAT their chords, and the later ones stop.
 *
 * `C C Am Am` is hold it, play it twice, change, play that twice — one change
 * in a whole dish, which is the exercise a first lesson sets. By the fourth
 * service a dish is `Am F C G` and every step is a change. That is the whole
 * difficulty curve, written in the menu where it can be read, and it costs the
 * engine nothing: a step is one chord heard, so a repeat is just a step whose
 * chord happens to match the one before it.
 *
 * Every name carries the progression it is made of, so the menu teaches while
 * it sells: the Cadence Bruschetta is a perfect cadence, the Andalusian
 * Gazpacho is the Andalusian cadence, and Canon Cannoli is Pachelbel. */
const DISHES = [
  /* One chord for a whole dish: the very first thing anybody plays. Four steps
   * and no change at all, so the only thing it teaches is that the cards turn
   * over when you play what they say. */
  { id: 'toast',      dish: 'One-Chord Toast',       steps: ['C', 'C', 'C', 'C'],
    rn: 'I I I I',             level: 1, pan: 'skillet',
    ingredients: ['bread', 'butter', 'sugar', 'cherry'] },
  { id: 'crostini',   dish: 'One-Finger Crostini',   steps: ['C', 'C', 'Am', 'Am'],
    rn: 'I I vi vi',           level: 1, pan: 'skillet',
    ingredients: ['bread', 'tomato', 'oil', 'basil'] },
  { id: 'bruschetta', dish: 'Cadence Bruschetta',    steps: ['G', 'G', 'C', 'C'],
    rn: 'V V I I',             level: 1, pan: 'skillet',
    ingredients: ['bread', 'garlic', 'tomato', 'basil'] },
  { id: 'broth',      dish: 'Dorian Broth',          steps: ['Dm', 'Dm', 'G', 'G'],
    rn: 'ii ii V V',           level: 1, pan: 'saucepan',
    ingredients: ['water', 'herbs', 'salt', 'pepper'] },
  { id: 'pomodoro',   dish: 'Amen Pomodoro',         steps: ['F', 'F', 'C', 'C'],
    rn: 'IV IV I I',           level: 2, pan: 'saucepan',
    ingredients: ['tomato', 'garlic', 'oil', 'basil'] },
  { id: 'risotto',    dish: 'Two-Five-One Risotto',  steps: ['Dm', 'G', 'C'],
    rn: 'ii V I',              level: 2, pan: 'saucepan',
    ingredients: ['rice', 'broth', 'butter'] },
  { id: 'tortellini', dish: 'Turnaround Tortellini', steps: ['C', 'Am', 'Dm', 'G'],
    rn: 'I vi ii V',           level: 2, pan: 'stockpot',
    ingredients: ['water', 'pasta', 'cream', 'pepper'] },
  { id: 'margherita', dish: 'Three-Chord Margherita', steps: ['C', 'F', 'G'],
    rn: 'I IV V',              level: 2, pan: 'pizza',
    ingredients: ['dough', 'tomato', 'mozzarella'] },
  { id: 'eggplant',   dish: 'Eggplant Tango',        steps: ['Am', 'Dm', 'E7'],
    rn: 'i iv V7',             level: 3, pan: 'skillet',
    ingredients: ['eggplant', 'tomato', 'cheese'] },
  { id: 'ribs',       dish: 'Ragtime Ribs',          steps: ['C', 'A7', 'Dm', 'G7'],
    rn: 'I VI7 ii V7',         level: 3, pan: 'casserole',
    ingredients: ['ribs', 'onion', 'wine', 'rosemary'] },
  { id: 'gelato',     dish: 'Fifties Gelato',        steps: ['C', 'Am', 'F', 'G'],
    rn: 'I vi IV V',           level: 3, pan: 'tub',
    ingredients: ['cream', 'sugar', 'vanilla', 'cherry'] },
  { id: 'popcorn',    dish: 'Four-Chord Popcorn',    steps: ['C', 'G', 'Am', 'F'],
    rn: 'I V vi IV',           level: 3, pan: 'stockpot',
    ingredients: ['oil', 'kernels', 'salt', 'butter'] },
  { id: 'roast',      dish: 'Campfire Roast',        steps: ['G', 'D', 'Em', 'C'],
    rn: 'I V vi IV',           level: 2, pan: 'roasting',
    ingredients: ['potato', 'chicken', 'oil', 'thyme'] },
  { id: 'minestrone', dish: 'Minestrone in Minor',   steps: ['Am', 'F', 'C', 'G'],
    rn: 'vi IV I V',           level: 4, pan: 'stockpot',
    ingredients: ['beans', 'carrot', 'celery', 'pasta'] },
  { id: 'beans',      dish: 'Twelve-Bar Beans',      steps: ['A7', 'D7', 'A7', 'E7', 'D7', 'A7'],
    rn: 'I7 IV7 I7 V7 IV7 I7', level: 4, pan: 'casserole',
    ingredients: ['beans', 'bacon', 'tomato', 'chilli', 'onion', 'parsley'] },
  { id: 'gazpacho',   dish: 'Andalusian Gazpacho',   steps: ['Am', 'G', 'F', 'E'],
    rn: 'i VII VI V',          level: 5, pan: 'bowl',
    ingredients: ['tomato', 'pepper', 'cucumber', 'bread'] },
  { id: 'diavola',    dish: 'Blues Diavola',         steps: ['E7', 'A7', 'E7', 'B7', 'A7', 'E7'],
    rn: 'I7 IV7 I7 V7 IV7 I7', level: 5, pan: 'pizza',
    ingredients: ['dough', 'tomato', 'mozzarella', 'salami', 'chilli', 'oil'] },
  { id: 'cannoli',    dish: 'Canon Cannoli',         steps: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],
    rn: 'I V vi iii IV I IV V', level: 6, pan: 'fryer',
    ingredients: ['flour', 'butter', 'wine', 'ricotta', 'sugar', 'chocolate', 'pistachio', 'peel'] },

  /* ── the barres, and the same shapes further up ──────────────────────────
   *
   * These are the second axis: not longer recipes, harder SHAPES. The first
   * asks for a barre at the first fret, the next two for full barres, and the
   * last two live at the fourth and the sixth, where the diagram stops drawing
   * a nut and starts printing the fret it begins at. Their names say where
   * their hands go, because that is what is new about them. */
  { id: 'brasato',    dish: 'Barre Brasato',         steps: ['Bb', 'F', 'C'],
    rn: 'IV I V',              level: 4, pan: 'casserole',
    ingredients: ['ribs', 'wine', 'carrot'] },
  { id: 'bolognese',  dish: 'Second-Fret Bolognese', steps: ['Bm', 'G', 'D', 'A'],
    rn: 'vi IV I V',           level: 5, pan: 'saucepan',
    ingredients: ['tomato', 'onion', 'wine', 'celery'] },
  { id: 'focaccia',   dish: 'Movable Focaccia',      steps: ['F#m', 'D', 'A', 'E'],
    rn: 'vi IV I V',           level: 5, pan: 'pizza',
    ingredients: ['dough', 'oil', 'rosemary', 'salt'] },
  { id: 'sformato',   dish: 'Up-the-Neck Sformato',  steps: ['C#m', 'A', 'E', 'B7'],
    rn: 'vi IV I V7',          level: 6, pan: 'roasting',
    ingredients: ['potato', 'cheese', 'butter', 'thyme'] },
  { id: 'affogato',   dish: 'E-Flat Affogato',       steps: ['Eb', 'Bb', 'F', 'Bb'],
    rn: 'IV I V I',            level: 6, pan: 'bowl',
    ingredients: ['cream', 'sugar', 'chocolate', 'cherry'] },
];

/*
 * ─────────────────────────────────────────────────────────────────────────
 * AND A RECIPE MAY REPEAT A CHORD, which is how the easy dishes are easy.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * It could not, and the rule against it was right for its own rule: a step
 * used to be a bar of strums, and a strum that cooked step n heated step n+1
 * as well, so a repeated chord meant watching the recipe advance on its own.
 * A step is one chord heard now, so `C C Am Am` is four steps and four
 * chords: hold C, play it twice, change, play that twice. Which is exactly
 * the shape the four-strum bar was reaching for, arrived at from the side the
 * microphone can actually measure.
 *
 * The one thing a repeat needs is `STEP_GAP_MS` in the engine, because the
 * ear's phantom onsets cook a repeated step where they cannot cook a change.
 * With it, a repeat asks to be played in time; without it, one slow sweep
 * cooked four steps.
 *
 * A repeat is also CHEAP, and by arithmetic rather than by decision: `price`
 * pays three for a step and two for every finger that moves between two
 * shapes, and a chord repeated moves nothing. So a dish of repeats is worth
 * about half a dish of changes, which is what an easy dish should be worth.
 */

export const MENU = DISHES.map((d) => Object.assign({}, d, { price: price(d.steps) }));

/*
 * Who walks in.
 *
 * The kitchen is Italian and stays Italian: it is the setting, it is where the
 * dishes come from, and it is the sign over the door. Its CUSTOMERS are not,
 * and a roster of sixteen Italian first names made the room read like a
 * village rather than like a restaurant with a queue at the door. The place is
 * Italian; the neighbourhood is everyone. The interface is English throughout,
 * and the only Italian left in it is the kind that belongs on a menu.
 */
export const NAMES = [
  'Maria', 'Marco', 'Luigi', 'Sofia', 'Elena', 'Bruno', 'Giulia', 'Enzo',
  'Rosa', 'Nico', 'Chiara', 'Dario', 'Lucia', 'Piero', 'Anna', 'Tonio',
  'Ada', 'Omar', 'Yuki', 'Kwame', 'Ines', 'Noor', 'Diego', 'Freya',
  'Sam', 'Priya', 'Tomas', 'Leila', 'Hugo', 'Mei', 'Aziz', 'Wren',
];

/** How many portraits the drawing has to have. */
export const FACES = 12;

/*
 * The service, and how it tightens.
 *
 * `stations` is how many places the counter has grown to BY THE END of this
 * level, not how many it opens with: places arrive one at a time, every
 * `RULES.OPEN_MS`, so the counter grows in front of the player. The service
 * opens with a single pan and a two-chord dish, which is the whole game with
 * nothing else going on, and the second pan does not arrive until the first
 * one has been cooked half a dozen times.
 *
 * `maxSteps` is the longest recipe that may be ordered, `step` is what every
 * burner gains at the bell, and `burnerBoost` is what a place opening at this
 * level starts above the base. The three of them are the difficulty, and they
 * are deliberately staggered: a level either adds a pan, or lengthens the
 * recipes, or turns the gas up — never all three at once.
 *
 * ── `shapes` IS THE FOURTH AXIS, AND IT ALTERNATES WITH THE PANS ─────────
 *
 * The shapes a dish may ask for come in six tiers (`chordLevel`): open
 * position, the partial F, the sevenths, the first barre, full barres, and
 * the same barres up the neck. The tier used to be the level number itself,
 * so every bell that opened a new pan also unlocked new shapes: the first
 * barre of a player's life arrived at Afternoon TOGETHER with a fourth pot,
 * and with four pots the round trip is already what ends a service. The
 * first time you meet a hard recipe you are already too busy to read it.
 *
 * So a level now either unlocks a tier or adds a place, never both: a new
 * shape is met with the pans you already know how to keep, and a new pan is
 * fed with shapes your hand already has. Read `stations` and `shapes` down
 * the table and they take turns. Nine services instead of six, a minute each;
 * the flames climb by smaller steps because there are more of them.
 */
/* `maxSteps` counts CHORDS HEARD, and it went up when that became what a step
 * is. It was two at the opening because a step was a bar of strums and two
 * bars was already half a minute of playing; the opening dishes are four steps
 * now — `C C Am Am` — and they are the shortest thing on the menu. What the
 * cap really limits is how long a ticket sits there, and four chords at a
 * beginner's speed is about as long as two bars used to be. */
/* SHAPES FIRST, THEN PANS — the second session with a player said the
 * alternating table was still the wrong order. This is a chord-change drill:
 * what a novice has to get good at is the changes and the shapes, and a third
 * pot before the neck is done teaches juggling instead. So the whole ladder of
 * shapes is climbed on the opening's two pans — the second pan is kept, because
 * two pots wanting one chord is the one greedy play, and a round trip has to
 * exist for the clock to mean anything — and only then does the counter grow,
 * one place a service, with every shape already in the hand. Whoever wants
 * fewer pans than that has the picker (`MAX_STATIONS`). */
export const LEVELS = [
  { name: 'Opening',        stations: 2, shapes: 1, maxSteps: 4, step: 0.0, burnerBoost: 0.0 },
  { name: 'Lunch',          stations: 2, shapes: 2, maxSteps: 4, step: 0.3, burnerBoost: 0.3 },
  { name: 'Lunch Rush',     stations: 2, shapes: 3, maxSteps: 5, step: 0.4, burnerBoost: 0.6 },
  { name: 'Afternoon',      stations: 2, shapes: 4, maxSteps: 5, step: 0.4, burnerBoost: 0.9 },
  { name: 'Happy Hour',     stations: 2, shapes: 5, maxSteps: 6, step: 0.5, burnerBoost: 1.2 },
  { name: 'Dinner',         stations: 2, shapes: 6, maxSteps: 6, step: 0.5, burnerBoost: 1.5 },
  { name: 'Late Dinner',    stations: 3, shapes: 6, maxSteps: 6, step: 0.6, burnerBoost: 1.8 },
  { name: 'Saturday Night', stations: 4, shapes: 6, maxSteps: 8, step: 0.6, burnerBoost: 2.1 },
  { name: 'Closing Time',   stations: 5, shapes: 6, maxSteps: 8, step: 0.7, burnerBoost: 2.4 },
];

/** The shape tier a level allows: its own column, and the level number for a
 *  table that has none (the bench's one-line levels). */
export const shapesAt = (spec, level) => (spec && spec.shapes) || level;

/** How many CHANGES a dish asks for: the steps where the chord is not the one
 *  before it. It is the honest measure of how hard a recipe is now that a step
 *  can repeat, and the engine keeps one of the gentle ones on the counter with
 *  it. */
export function changes(m) {
  return m.steps.filter((c, i) => i > 0 && c !== m.steps[i - 1]).length;
}

/** The chords a player actually needs up to a given level. The chord detector
 *  reads this to know what to listen for, and the help card to know what to
 *  show. */
export function chordsUpTo(level) {
  const out = new Set();
  for (const m of MENU) if (m.level <= level) for (const c of m.steps) out.add(c);
  return [...out].sort();
}
