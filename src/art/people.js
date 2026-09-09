/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE PEOPLE: customers, the crowd, the cooks, and the one with the guitar.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A person is layers, and the point of layers is that twelve faces become a
 * full room. One head template; fourteen hairstyles, five hats; five skins;
 * ten hair colours; eight outfits over twenty-four colours; facial hair,
 * glasses, earrings, headphones, a scarf; five body types; and a POSE, which
 * is a layer like the others: arms crossed, a hand in a pocket, leaning on the
 * counter, looking at a phone, gesturing, holding a glass. The same look in two
 * poses is two people to the eye, and the same person in two poses is a mood.
 *
 * The twelve regulars (`face` 0..11) come out of a table so they are the same
 * people every service: face 3 is still the balding man with the moustache in
 * the yellow overalls. The crowd is generated from a seed with the same layers,
 * and a seed always gives the same person, which is what lets the room stay
 * still between frames.
 *
 * Mood is a face and a pose together. An impatient customer leans forward,
 * drums their fingers and lowers their brows; a served one throws both hands
 * up; a lost one folds their arms and scowls. None of it is text.
 *
 * Every figure has a one pixel near-black outline, the way a 16-bit sprite
 * does, and nothing in here is anti-aliased. Everything is built once and kept
 * in a cache: the frame loop only ever blits.
 */

import { P, SKINS, HAIRS, CLOTHES, TROUSERS, canvas, sprite, stamp, rect, blit, hash, tinted } from './pix.js';

/* ── the head ─────────────────────────────────────────────────────────────
 * 12 wide, 12 tall, ten rows of face and two of neck. `o` outline, `s` skin,
 * `S` skin in shadow. No eyes and no mouth here: those belong to the mood and
 * are stamped over it. */
const HEAD = [
  '..oooooooo..',
  '.osssssssso.',
  '.osssssssso.',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  'osSssssssSso',
  '.osssssssso.',
  '.osssssssso.',
  '..oSSSSSSo..',
  '...oSSSSo...',
  '...oSSSSo...',
];
export const HEAD_W = 12;
export const HEAD_H = 12;

/* Eyes: `e` the eye, `w` its highlight. */
const EYES = {
  open: { at: 4, rows: ['...ew..ew...'] },
  down: { at: 5, rows: ['...ew..ew...'] },          // at a phone, a plate, the floor
  closed: { at: 5, rows: ['...ee..ee...'] },        // singing, or savouring
  wide: { at: 3, rows: ['...ee..ee...', '...ew..ew...'] },  // shocked
};
/* Brows: `o` ink, `d` skin in shadow (a raised brow is a soft one). */
const BROWS = {
  angry: { at: 2, rows: ['..o......o..', '...oo..oo...'] },
  low: { at: 3, rows: ['...oo..oo...'] },
  raised: { at: 2, rows: ['...dd..dd...'] },
  worried: { at: 2, rows: ['....o..o....', '...o....o...'] },
};
/* Mouths: `m` mouth, `w` teeth, `r` the inside, `o` ink. */
const MOUTHS = {
  flat: { at: 7, rows: ['.....mm.....'] },
  line: { at: 7, rows: ['....mmmm....'] },
  smile: { at: 6, rows: ['....m..m....', '.....mm.....'] },
  grin: { at: 6, rows: ['....m..m....', '....mwwm....', '.....mm.....'] },
  frown: { at: 7, rows: ['.....mm.....', '....m..m....'] },
  open: { at: 7, rows: ['....oooo....', '....orro....', '.....oo.....'] },
  oh: { at: 7, rows: ['.....oo.....', '.....oo.....'] },
};

/** What a mood does to a face. The pose it goes with is the caller's choice. */
export const MOODS = {
  neutral: { eyes: 'open', mouth: 'flat' },
  happy: { eyes: 'open', brows: 'raised', mouth: 'smile' },
  thrilled: { eyes: 'closed', brows: 'raised', mouth: 'grin' },
  cheer: { eyes: 'closed', brows: 'raised', mouth: 'open' },
  angry: { eyes: 'open', brows: 'angry', mouth: 'frown' },
  furious: { eyes: 'open', brows: 'angry', mouth: 'open' },
  impatient: { eyes: 'open', brows: 'low', mouth: 'line' },
  worried: { eyes: 'open', brows: 'worried', mouth: 'frown' },
  down: { eyes: 'down', mouth: 'flat' },
  bored: { eyes: 'down', brows: 'low', mouth: 'flat' },
  sing: { eyes: 'closed', brows: 'raised', mouth: 'open' },
  oops: { eyes: 'wide', brows: 'worried', mouth: 'oh' },
  talk: { eyes: 'open', mouth: 'open' },
  chew: { eyes: 'closed', mouth: 'oh' },
};

/* ── hair ─────────────────────────────────────────────────────────────────
 * Anchored so row index 4 lands on head row 0: four rows may rise above the
 * skull. `h` hair, `p` the parting or a highlight, `o` outline. */
const HAIR_UP = 4;
const HAIR = [
  [ // 0 short crop
    '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohh......hho', 'oh........ho',
  ],
  [ // 1 long
    '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohh......hho', 'ohh......hho',
    'ohh......hho', 'ohh......hho', 'ohh......hho', 'ohh......hho', 'ohhh....hhho', 'ohhh....hhho', '.oo......oo.',
  ],
  [ // 2 slick back
    '............', '...oooooo...',
    '..ohhhhhho..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohh......hho', 'oh........ho',
  ],
  [ // 3 quiff
    '....o.oo....', '...ohohho...',
    '..ohhhhhho..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohhh.....hho', 'oh........ho',
  ],
  [ // 4 bun
    '....oooo....', '...ohhhho...',
    '..ohhhhhho..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohh......hho', 'oh........ho',
  ],
  [ // 5 bald with tufts
    '............', '............', '............', '............',
    '............', '.oh......ho.', 'ohh......hho', 'oh........ho',
  ],
  [ // 6 bob
    '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohh......hho', 'ohh......hho',
    'ohh......hho', 'ohh......hho', 'ohhh....hhho', '.ooo....ooo.',
  ],
  [ // 7 curly
    '............', '...o.oo.o...',
    '..ohhhhhho..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohhh....hhho', 'ohh......hho',
    'oho......oho', '.o........o.',
  ],
  [ // 8 mohawk
    '.....oo.....', '....ohho....',
    '....ohho....', '....ohho....', '..ooohhooo..', '.....hh.....', '.....hh.....',
  ],
  [ // 9 side parting
    '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'ohhhphhhhhho', 'ohhhphhhhhho', 'ohh......hho', 'oh........ho',
  ],
  [ // 10 fringe swept to one side
    '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohhhhhh..hho', 'ohhhh.....ho',
  ],
  [ // 11 buzz cut
    '............', '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'oh........ho',
  ],
  [ // 12 afro
    '...oooooo...', '..ohhhhhho..',
    '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohhh....hhho', 'ohh......hho', 'oh........ho',
  ],
  [ // 13 pigtails: a bun-like top and two tufts at the ears
    '............', '............',
    '..oooooooo..', '.ohhhhhhhho.', 'ohhhhhhhhhho', 'ohhhhhhhhhho', 'ohh......hho', 'ohh......hho',
    'ohh......hho', 'oho......oho',
  ],
];
const HAIR_COLORS = [...HAIRS, '#d84a9a', '#4a78d0', '#ece8f0'];

/* ── hats ─────────────────────────────────────────────────────────────────
 * Drawn over the hair, anchored like it. `a` the hat, `A` its band or brim
 * underside, `o` outline. A hat covers the top of the skull, so only the hair
 * below it shows. */
const HATS = {
  cap: [
    '............', '...oooooo...',
    '..oaaaaaao..', '.oaaaaaaaao.', 'oaaaaaaaaaao', 'oaaaaaaaaaao', '.oAAAAAAAAAoo',
  ],
  beanie: [
    '............', '............',
    '..oooooooo..', '.oaaaaaaaao.', 'oaaaaaaaaaao', 'oaaaaaaaaaao', 'oAAAAAAAAAAo', 'oAAAAAAAAAAo',
  ],
  fedora: [
    '............', '...oooooo...',
    '..oaaaaaao..', '..oaaaaaao..', 'oooAAAAAAooo', 'oaaaaaaaaaao', '.oooooooooo.',
  ],
  bandana: [
    '............', '............',
    '..oooooooo..', '.oaAaAaAaAo.', 'oaAaAaAaAaAo', 'oAaAaAaAaAao', '.oooooooooo.',
  ],
  toque: [
    '..oooooooo..', '.otttttttto.', 'otttttttttto', 'otttttttttto', 'otttttttttto', '.otttttttto.',
    '.oTTTTTTTTo.', '.oTTTTTTTTo.',
  ],
};
const TOQUE_UP = 6;

/* ── the face's extras ─────────────────────────────────────────────────── */
const GLASSES = {
  round: { at: 3, rows: ['..aaa..aaa..', '..a..aaa..a.', '..aaa..aaa..'] },
  square: { at: 3, rows: ['.aaaa..aaaa.', '.a..aaaa..a.', '.aaaa..aaaa.'] },
  shades: { at: 3, rows: ['.aaaaaaaaaa.', '..aaa..aaa..', '..aaa..aaa..'] },
};
const FACIAL = {
  moustache: { at: 6, rows: ['...hhhhhh...'] },
  beard: { at: 7, rows: ['.ohh....hho.', '..ohhhhhho..', '...oooooo...'] },
  goatee: { at: 8, rows: ['....hhhh....', '.....hh.....'] },
  stubble: { at: 7, rows: ['.h.h....h.h.', '..h.h..h.h..', '...h.hh.h...'] },
};

/* ── bodies ───────────────────────────────────────────────────────────────
 * `sh` half the shoulder width, `ch` half the chest below it, `torso` the
 * height from neck to hip standing, `legs` hip to sole, `seat` the height from
 * the neck to the counter when sitting. */
const BODIES = {
  slim: { sh: 7, ch: 6, torso: 17, legs: 16, seat: 32 },
  normal: { sh: 8, ch: 7, torso: 17, legs: 16, seat: 33 },
  wide: { sh: 10, ch: 9, torso: 18, legs: 15, seat: 34 },
  short: { sh: 8, ch: 7, torso: 14, legs: 12, seat: 29 },
  tall: { sh: 8, ch: 7, torso: 20, legs: 19, seat: 37 },
};
const BODY_NAMES = Object.keys(BODIES);
const OUTFITS = ['shirt', 'tee', 'sweater', 'jacket', 'overalls', 'tank', 'hoodie', 'coat'];

/** A darker version of a hex colour, for the shadow side of things. */
export function shade(hex, k) {
  const f = k === undefined ? 0.68 : k;
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/** A lighter version. */
export function tint(hex, k) {
  const f = k === undefined ? 0.35 : k;
  const n = parseInt(hex.slice(1), 16);
  const up = (v) => Math.round(v + (255 - v) * f);
  const r = up((n >> 16) & 255), g = up((n >> 8) & 255), b = up(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* ── who is who ───────────────────────────────────────────────────────────
 * Twelve rows, one per face. A table rather than arithmetic because it can be
 * read: face 3 is the balding man with the moustache in the yellow overalls,
 * and will be for the rest of the project. `pose` is how they sit when nothing
 * is wrong; the mood overrides it. */
const REGULARS = [
  { skin: 0, hair: 1, hairColor: 2, outfit: 'jacket', color: 0, shirt: 22, body: 'normal', pose: 'rest' },
  { skin: 1, hair: 0, hairColor: 0, outfit: 'shirt', color: 1, body: 'wide', glasses: 'round', pose: 'crossed' },
  { skin: 2, hair: 3, hairColor: 6, outfit: 'shirt', color: 2, tie: true, body: 'slim', pose: 'phone' },
  { skin: 3, hair: 5, hairColor: 1, outfit: 'overalls', color: 3, shirt: 11, facial: 'moustache', body: 'wide', pose: 'rest' },
  { skin: 0, hair: 6, hairColor: 3, outfit: 'sweater', color: 4, body: 'slim', earrings: true, pose: 'chin' },
  { skin: 4, hair: 0, hairColor: 6, outfit: 'tee', color: 5, facial: 'beard', body: 'tall', pose: 'talk' },
  { skin: 1, hair: 0, hairColor: 0, hat: 'cap', hatColor: '#3a8a3a', outfit: 'hoodie', color: 6, body: 'normal', pose: 'rest' },
  { skin: 2, hair: 1, hairColor: 0, outfit: 'jacket', color: 7, shirt: 19, tie: true, body: 'tall', pose: 'crossed' },
  { skin: 0, hair: 4, hairColor: 5, outfit: 'tee', color: 8, glasses: 'round', necklace: true, body: 'normal', pose: 'phone' },
  { skin: 3, hair: 3, hairColor: 0, outfit: 'coat', color: 9, scarf: 13, body: 'normal', pose: 'rest' },
  { skin: 4, hair: 6, hairColor: 4, outfit: 'overalls', color: 10, shirt: 15, body: 'short', pose: 'talk' },
  { skin: 1, hair: 4, hairColor: 1, outfit: 'shirt', color: 11, facial: 'moustache', glasses: 'square', body: 'short', pose: 'chin' },
  { skin: 3, hair: 12, hairColor: 0, outfit: 'jacket', color: 3, shirt: 7, body: 'normal', earrings: true, pose: 'chin' },
  { skin: 1, hair: 0, hairColor: 4, hat: 'cap', hatColor: '#53613a', outfit: 'jacket', color: 10, shirt: 7, facial: 'moustache', body: 'wide', pose: 'rest' },
];

/** Resolves a description into the colours the drawing uses. */
function resolve(d) {
  const skin = SKINS[d.skin % SKINS.length];
  const color = CLOTHES[d.color % CLOTHES.length];
  const shirt = CLOTHES[(d.shirt === undefined ? 22 : d.shirt) % CLOTHES.length];
  return {
    body: BODIES[d.body] || BODIES.normal,
    skin, skinLo: shade(skin), skinInk: shade(skin, 0.5),
    hair: d.hair % HAIR.length, hairColor: HAIR_COLORS[d.hairColor % HAIR_COLORS.length],
    hat: d.hat || null, hatColor: d.hatColor || CLOTHES[(d.color + 5) % CLOTHES.length],
    outfit: d.outfit || 'shirt', color, lo: shade(color), hi: tint(color, 0.25),
    shirt, shirtLo: shade(shirt),
    trousers: TROUSERS[(d.trousers === undefined ? d.color : d.trousers) % TROUSERS.length],
    skirt: !!d.skirt,
    tie: !!d.tie, scarf: d.scarf === undefined ? null : CLOTHES[d.scarf % CLOTHES.length],
    facial: d.facial || null, glasses: d.glasses || null,
    earrings: !!d.earrings, necklace: !!d.necklace, headphones: !!d.headphones,
    rolled: !!d.rolled, drink: d.drink || 'beer',
    pose: d.pose || 'rest',
  };
}

/** One of the regulars; keep the fallback identities available without the atlas. */
export function look(face) {
  const f = ((face % REGULARS.length) + REGULARS.length) % REGULARS.length;
  return resolve(REGULARS[f]);
}

/**
 * Somebody from the crowd: every layer picked from `seed`, so the same seed is
 * the same person for as long as the room is drawn. The poses are the ones
 * that make sense for someone on their feet with nothing to do but wait.
 */
const STANDING_POSES = ['stand', 'stand', 'pocket', 'crossed', 'drink', 'drink', 'phone', 'talk', 'hips'];
export function lookFrom(seed) {
  const pick = (k, n) => Math.floor(hash(seed, k, 977) * n);
  const outfit = OUTFITS[pick(4, OUTFITS.length)];
  const d = {
    skin: pick(1, SKINS.length),
    hair: pick(2, HAIR.length),
    hairColor: pick(3, HAIR_COLORS.length),
    outfit,
    color: pick(5, CLOTHES.length),
    shirt: pick(6, CLOTHES.length),
    trousers: pick(7, TROUSERS.length),
    body: BODY_NAMES[pick(8, BODY_NAMES.length)],
    pose: STANDING_POSES[pick(9, STANDING_POSES.length)],
    drink: ['beer', 'wine', 'water'][pick(17, 3)],
  };
  const r = hash(seed, 10, 977);
  if (r < 0.12) d.hat = 'cap';
  else if (r < 0.2) d.hat = 'beanie';
  else if (r < 0.26) d.hat = 'fedora';
  else if (r < 0.3) d.hat = 'bandana';
  if (d.hat) d.hatColor = CLOTHES[pick(11, CLOTHES.length)];
  const f = hash(seed, 12, 977);
  if (f < 0.12) d.facial = 'moustache';
  else if (f < 0.24) d.facial = 'beard';
  else if (f < 0.32) d.facial = 'goatee';
  else if (f < 0.42) d.facial = 'stubble';
  const gl = hash(seed, 13, 977);
  if (gl < 0.14) d.glasses = 'round';
  else if (gl < 0.24) d.glasses = 'square';
  else if (gl < 0.3) d.glasses = 'shades';
  d.earrings = hash(seed, 14, 977) < 0.25;
  d.necklace = hash(seed, 15, 977) < 0.2;
  d.headphones = !d.hat && hash(seed, 16, 977) < 0.1;
  d.tie = outfit === 'shirt' && hash(seed, 18, 977) < 0.3;
  d.scarf = outfit === 'coat' ? pick(19, CLOTHES.length) : undefined;
  d.rolled = (outfit === 'shirt' || outfit === 'sweater') && hash(seed, 20, 977) < 0.4;
  d.skirt = hash(seed, 21, 977) < 0.25;
  return resolve(d);
}

/* ── drawing the pieces ─────────────────────────────────────────────────── */

/**
 * Draws a head with its top-left at (x, y): the skull, the hair (which may
 * rise above y), the hat over the hair, facial hair, glasses, earrings,
 * headphones, and the mood's eyes, brows and mouth.
 */
function drawHead(g, x, y, L, moodName) {
  const M = MOODS[moodName] || MOODS.neutral;
  stamp(g, HEAD, { o: P.ink, s: L.skin, S: L.skinLo }, x, y);
  const hmap = { o: P.ink, h: L.hairColor, p: tint(L.hairColor, 0.3) };
  if (L.hat === 'toque') {
    // Only the hair at the temples shows under a toque.
    stamp(g, HAIR[L.hair === 5 ? 5 : 0].slice(HAIR_UP + 2), hmap, x, y + 2);
    stamp(g, HATS.toque, { o: P.ink, t: P.white, T: P.greyHi }, x, y - TOQUE_UP);
  } else {
    stamp(g, HAIR[L.hair], hmap, x, y - HAIR_UP);
    if (L.hat && HATS[L.hat]) {
      stamp(g, HATS[L.hat], { o: P.ink, a: L.hatColor, A: shade(L.hatColor, 0.6) }, x, y - HAIR_UP);
    }
  }
  if (L.facial) stamp(g, FACIAL[L.facial].rows, { h: L.hairColor, o: P.ink }, x, y + FACIAL[L.facial].at);
  const fm = { e: P.ink, w: P.white, o: P.ink, d: L.skinInk, m: L.skinInk, r: '#8a2a2a' };
  const eyes = EYES[M.eyes] || EYES.open;
  stamp(g, eyes.rows, fm, x, y + eyes.at);
  if (M.brows) stamp(g, BROWS[M.brows].rows, fm, x, y + BROWS[M.brows].at);
  const mouth = MOUTHS[M.mouth] || MOUTHS.flat;
  stamp(g, mouth.rows, fm, x, y + mouth.at);
  if (L.glasses) stamp(g, GLASSES[L.glasses].rows, { a: L.glasses === 'shades' ? P.ink : '#2a2a30' }, x, y + GLASSES[L.glasses].at);
  if (L.earrings) { rect(g, x, y + 7, 1, 1, P.gold); rect(g, x + 11, y + 7, 1, 1, P.gold); }
  if (L.headphones) {
    rect(g, x - 1, y + 4, 2, 4, P.ink); rect(g, x + 11, y + 4, 2, 4, P.ink);
    rect(g, x - 1, y + 5, 1, 2, P.steelHi); rect(g, x + 12, y + 5, 1, 2, P.steelHi);
    rect(g, x + 1, y - HAIR_UP + 1, 10, 1, P.ink);
    rect(g, x, y - HAIR_UP + 2, 1, 2, P.ink); rect(g, x + 11, y - HAIR_UP + 2, 1, 2, P.ink);
  }
}

/**
 * The torso from the neck row `y` down for `h` rows, centred on `cx`: rounded
 * shoulders, a chest that narrows to the hips, an outline all round, and the
 * shadow side on the right. The outfit is drawn over it afterwards.
 */
function halfAt(B, j, extra) {
  const sh = B.sh + (extra || 0);
  if (j === 0) return sh - 3;
  if (j === 1) return sh - 1;
  if (j <= 7) return sh;
  const k = Math.min(1, (j - 7) / 3);
  return Math.round(sh + (B.ch + (extra || 0) - sh) * k);
}
function torso(g, cx, y, B, h, fill, lo, hi, extra) {
  rect(g, cx - halfAt(B, 0, extra) - 1, y - 1, 2 * halfAt(B, 0, extra) + 3, 1, P.ink);
  for (let j = 0; j < h; j++) {
    const w = halfAt(B, j, extra);
    rect(g, cx - w - 1, y + j, 2 * w + 3, 1, P.ink);
  }
  for (let j = 0; j < h; j++) {
    const w = halfAt(B, j, extra);
    rect(g, cx - w, y + j, 2 * w + 1, 1, fill);
    if (j >= 1) rect(g, cx + w - 2, y + j, 3, 1, lo);
    if (j >= 2) rect(g, cx - w + 1, y + j, 1, 1, hi);
  }
}

/** What the outfit adds to a plain torso. `h` is the visible height. */
function dressTorso(g, cx, y, L, h) {
  const B = L.body;
  switch (L.outfit) {
    case 'shirt':
      // A collar open at the neck, buttons down the front.
      rect(g, cx - 3, y, 6, 1, L.hi); rect(g, cx - 2, y + 1, 4, 1, L.hi);
      rect(g, cx - 1, y + 2, 2, 1, L.skin); rect(g, cx - 2, y + 1, 1, 1, L.skin); rect(g, cx + 1, y + 1, 1, 1, L.skin);
      for (let j = 4; j < h - 1; j += 3) rect(g, cx, y + j, 1, 1, P.ink);
      if (L.tie) { rect(g, cx - 1, y + 2, 2, Math.min(h - 3, 11), '#8a1a2a'); rect(g, cx - 1, y + 3, 1, 1, P.white); }
      break;
    case 'tee':
      rect(g, cx - 3, y, 6, 1, L.lo);
      // A print on the chest.
      rect(g, cx - 2, y + 6, 4, 3, L.hi); rect(g, cx - 1, y + 7, 2, 1, L.lo);
      break;
    case 'sweater':
      // A ribbed neck, and a band across the chest.
      for (let k = -3; k <= 3; k++) rect(g, cx + k, y + (k % 2 ? 1 : 0), 1, 1, L.lo);
      rect(g, cx - B.ch, y + 9, 2 * B.ch + 1, 1, L.hi);
      rect(g, cx - B.ch, y + 11, 2 * B.ch + 1, 1, L.hi);
      break;
    case 'jacket':
      // Open over a shirt, lapels darker.
      rect(g, cx - 2, y, 5, h, L.shirt);
      rect(g, cx - 3, y, 1, h, L.lo); rect(g, cx + 3, y, 1, h, L.lo);
      rect(g, cx - 4, y, 1, 4, L.hi); rect(g, cx + 4, y, 1, 4, L.hi);
      if (L.tie) { rect(g, cx - 1, y + 1, 2, Math.min(h - 2, 10), '#8a1a2a'); rect(g, cx - 1, y + 2, 1, 1, P.white); }
      else { rect(g, cx, y + 3, 1, 1, P.ink); rect(g, cx, y + 7, 1, 1, P.ink); }
      break;
    case 'overalls': {
      // The shirt shows at the shoulders; the bib and straps are the colour.
      const bib = L.color, bibLo = L.lo;
      for (let j = 0; j < 4; j++) { const w = halfAt(B, j); rect(g, cx - w, y + j, 2 * w + 1, 1, L.shirt); rect(g, cx + w - 2, y + j, 3, 1, L.shirtLo); }
      rect(g, cx - B.ch + 1, y + 4, 2 * B.ch - 1, h - 4, bib);
      rect(g, cx + B.ch - 2, y + 4, 2, h - 4, bibLo);
      rect(g, cx - B.ch + 1, y, 1, 4, bib); rect(g, cx + B.ch - 1, y, 1, 4, bib);
      rect(g, cx - 2, y + 6, 5, 4, bibLo); rect(g, cx - 2, y + 6, 5, 1, P.ink);
      rect(g, cx - B.ch + 1, y + 4, 1, 1, P.gold); rect(g, cx + B.ch - 1, y + 4, 1, 1, P.gold);
      break;
    }
    case 'tank':
      // Bare shoulders, two straps.
      for (let j = 0; j < 4; j++) { const w = halfAt(B, j); rect(g, cx - w, y + j, 2 * w + 1, 1, L.skin); rect(g, cx + w - 2, y + j, 3, 1, L.skinLo); }
      rect(g, cx - B.ch + 1, y, 2, 4, L.color); rect(g, cx + B.ch - 2, y, 2, 4, L.color);
      rect(g, cx - 3, y + 3, 7, 1, L.skin);
      break;
    case 'hoodie':
      // The hood bunched behind the neck, drawstrings, a pocket.
      rect(g, cx - 5, y - 2, 11, 1, P.ink); rect(g, cx - 6, y - 1, 13, 1, P.ink);
      rect(g, cx - 5, y - 1, 11, 1, L.lo); rect(g, cx - 6, y, 3, 2, L.lo); rect(g, cx + 4, y, 3, 2, L.lo);
      rect(g, cx - 2, y + 2, 1, 7, P.white); rect(g, cx + 2, y + 2, 1, 6, P.white);
      rect(g, cx - B.ch + 2, y + h - 6, 2 * B.ch - 3, 5, L.lo); rect(g, cx - B.ch + 2, y + h - 6, 2 * B.ch - 3, 1, P.ink);
      break;
    case 'coat':
      // Heavy, double breasted, a scarf around the neck with a tail.
      for (let j = 4; j < h - 1; j += 3) { rect(g, cx - 2, y + j, 1, 1, P.ink); rect(g, cx + 2, y + j, 1, 1, P.ink); }
      if (L.scarf) {
        rect(g, cx - 5, y - 1, 11, 3, L.scarf); rect(g, cx - 5, y + 1, 11, 1, shade(L.scarf));
        rect(g, cx + 2, y + 2, 3, 7, L.scarf); rect(g, cx + 4, y + 2, 1, 7, shade(L.scarf));
        rect(g, cx + 2, y + 9, 3, 1, P.ink);
      }
      break;
    default:
      break;
  }
  if (L.necklace) { rect(g, cx - 2, y, 5, 1, P.gold); rect(g, cx, y + 1, 1, 1, P.gold); }
}

/**
 * A limb: squares of three along a polyline of joints, outlined first and
 * filled after so the outline stays outside. `colors[k]` is the colour of the
 * k-th segment; skin for a bare forearm.
 */
function limb(g, pts, colors) {
  const dots = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      dots.push([Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), i]);
    }
  }
  for (const [x, y] of dots) rect(g, x - 2, y - 2, 5, 5, P.ink);
  for (const [x, y, i] of dots) rect(g, x - 1, y - 1, 3, 3, colors[Math.min(i, colors.length - 1)]);
}

/** A hand: a skin square with a line for the fingers. `fist` closes it. */
function hand(g, x, y, L, fist) {
  rect(g, x - 2, y - 2, 5, 5, P.ink);
  rect(g, x - 1, y - 1, 3, 3, L.skin);
  if (fist) rect(g, x - 1, y, 3, 1, L.skinLo);
  else rect(g, x - 1, y + 1, 3, 1, L.skinLo);
}

/** A glass in a hand, drawn before the hand so the fingers wrap it. */
function glass(g, x, y, kind) {
  const liquid = kind === 'wine' ? '#8a1a3a' : kind === 'water' ? '#a8d8f8' : '#e8a020';
  rect(g, x - 2, y - 7, 5, 9, P.ink);
  rect(g, x - 1, y - 6, 3, 7, liquid);
  if (kind === 'beer') rect(g, x - 1, y - 6, 3, 1, P.white);
  if (kind === 'wine') rect(g, x - 1, y - 6, 3, 2, '#e8e0f0');
  rect(g, x - 1, y - 5, 1, 4, '#ffffff66');
}

/** A phone in a hand. */
function phone(g, x, y) {
  rect(g, x - 2, y - 6, 5, 8, P.ink);
  rect(g, x - 1, y - 5, 3, 5, '#cfe8ff');
  rect(g, x, y - 4, 1, 1, P.white);
}

/*
 * The poses. Each returns the arms as polylines from the shoulder, a hand
 * position, and what the hand holds. Anchors: `cx`, `ny` the neck row, `sh`
 * the shoulder half width, `ch` the chest half width, `hip` the hip row
 * (standing) and `foot` the last row of the sprite (the counter, or the shoes).
 *
 * The right arm (the viewer's right) is the busy one.
 */
function poseArms(pose, A, frame) {
  const { cx, ny, sh, ch, foot, hip } = A;
  const SL = [cx - sh + 1, ny + 3], SR = [cx + sh - 1, ny + 3];
  const rest = (side) => ({
    pts: [side < 0 ? SL : SR, [cx + side * (sh + 1), ny + 12], [cx + side * (ch + 3), foot - 3]],
    hand: [cx + side * (ch + 3), foot - 3],
  });
  const down = (side) => ({
    pts: [side < 0 ? SL : SR, [cx + side * (sh + 1), ny + 10], [cx + side * (ch + 3), hip + 3]],
    hand: [cx + side * (ch + 3), hip + 3],
  });
  switch (pose) {
    case 'rest':
      return [rest(-1), rest(1)];
    case 'fists':
      return [
        { pts: [SL, [cx - sh - 1, ny + 12], [cx - 5, foot - 3]], hand: [cx - 5, foot - 3], fist: true },
        { pts: [SR, [cx + sh + 1, ny + 12], [cx + 5, foot - 3]], hand: [cx + 5, foot - 3], fist: true },
      ];
    case 'lean':
      // Forearms flat on the counter, the busy hand drumming.
      return [
        { pts: [SL, [cx - sh - 2, ny + 11], [cx - sh - 3, foot - 4], [cx - 3, foot - 3]], hand: [cx - 3, foot - 3] },
        { pts: [SR, [cx + sh + 2, ny + 11], [cx + sh + 3, foot - 4], [cx + 4, foot - 3 - frame]], hand: [cx + 4, foot - 3 - frame], tap: true },
      ];
    case 'crossed':
      return [
        { pts: [SL, [cx - sh - 1, ny + 12], [cx + ch - 2, ny + 13]], hand: [cx + ch - 2, ny + 13], fist: true },
        { pts: [SR, [cx + sh + 1, ny + 13], [cx - ch + 2, ny + 16]], hand: [cx - ch + 2, ny + 16], fist: true },
      ];
    case 'chin':
      return [
        rest(-1),
        { pts: [SR, [cx + sh + 3, foot - 6], [cx + 5, ny - 2]], hand: [cx + 5, ny - 2], fist: true },
      ];
    case 'phone':
      return [
        A.standing ? down(-1) : rest(-1),
        { pts: [SR, [cx + sh + 1, ny + 12], [cx + 6, ny + 5]], hand: [cx + 6, ny + 5], holds: 'phone' },
      ];
    case 'talk':
      return [
        A.standing ? down(-1) : rest(-1),
        frame
          ? { pts: [SR, [cx + sh + 3, ny + 11], [cx + sh + 8, ny + 7]], hand: [cx + sh + 8, ny + 7] }
          : { pts: [SR, [cx + sh + 3, ny + 10], [cx + sh + 6, ny + 1]], hand: [cx + sh + 6, ny + 1] },
      ];
    case 'cheer':
      return [
        { pts: [SL, [cx - sh - 3, ny + 3], [cx - sh - 2 - frame * 2, ny - 12 + frame * 3]], hand: [cx - sh - 2 - frame * 2, ny - 12 + frame * 3] },
        { pts: [SR, [cx + sh + 3, ny + 3], [cx + sh + 2 + frame * 2, ny - 12 + frame * 3]], hand: [cx + sh + 2 + frame * 2, ny - 12 + frame * 3] },
      ];
    case 'wave':
      return [
        A.standing ? down(-1) : rest(-1),
        { pts: [SR, [cx + sh + 3, ny + 2], [cx + sh + 4 + frame * 3, ny - 10]], hand: [cx + sh + 4 + frame * 3, ny - 10] },
      ];
    case 'stand':
      return [down(-1), down(1)];
    case 'pocket':
      return [
        down(-1),
        { pts: [SR, [cx + sh + 1, ny + 10], [cx + ch - 1, hip]], hand: null },
      ];
    case 'drink':
      return [
        down(-1),
        frame
          ? { pts: [SR, [cx + sh + 2, ny + 11], [cx + 5, ny - 1]], hand: [cx + 5, ny - 1], holds: 'glass' }
          : { pts: [SR, [cx + sh + 2, ny + 12], [cx + 4, ny + 9]], hand: [cx + 4, ny + 9], holds: 'glass' },
      ];
    case 'hips':
      return [
        { pts: [SL, [cx - sh - 5, ny + 9], [cx - ch - 1, hip - 2]], hand: [cx - ch - 1, hip - 2], fist: true },
        { pts: [SR, [cx + sh + 5, ny + 9], [cx + ch + 1, hip - 2]], hand: [cx + ch + 1, hip - 2], fist: true },
      ];
    default:
      return [rest(-1), rest(1)];
  }
}

/** The colour of a sleeve, and whether the forearm is bare. */
function sleeves(L) {
  const bare = L.outfit === 'tank' || L.outfit === 'tee' || L.rolled;
  const upper = L.outfit === 'tank' ? L.skin : L.outfit === 'overalls' ? L.shirt : L.color;
  return bare ? [upper, L.skin] : [upper, upper];
}

function drawArms(g, arms, L) {
  const cols = sleeves(L);
  for (const a of arms) {
    limb(g, a.pts, cols);
    if (!a.hand) continue;
    const [hx, hy] = a.hand;
    if (a.holds === 'glass') glass(g, hx, hy, L.drink);
    if (a.holds === 'phone') phone(g, hx + 1, hy);
    hand(g, hx, hy, L, a.fist || !!a.holds);
    if (a.tap) rect(g, hx + 2, hy + 1, 1, 1, L.skin);
  }
}

/** Legs and shoes from the hip row down to `foot`. */
function legs(g, cx, hip, foot, L) {
  const ch = L.body.ch;
  const h = foot - hip;
  rect(g, cx - ch - 1, hip, 2 * ch + 3, h, P.ink);
  if (L.skirt) {
    const sk = Math.min(h - 4, 9);
    for (let j = 0; j < sk; j++) {
      const w = ch + Math.floor(j / 3);
      rect(g, cx - w - 1, hip + j, 2 * w + 3, 1, P.ink);
      rect(g, cx - w, hip + j, 2 * w + 1, 1, L.trousers);
      rect(g, cx + w - 2, hip + j, 3, 1, shade(L.trousers, 0.75));
    }
    rect(g, cx - ch + 1, hip + sk, ch - 2, h - sk - 2, L.skin);
    rect(g, cx + 1, hip + sk, ch - 2, h - sk - 2, L.skinLo);
  } else {
    rect(g, cx - ch, hip, ch, h - 2, L.trousers);
    rect(g, cx + 1, hip, ch, h - 2, shade(L.trousers, 0.8));
    rect(g, cx - ch, hip, 2 * ch + 1, 1, shade(L.trousers, 0.7));
  }
  rect(g, cx - ch - 1, foot - 2, ch + 1, 2, P.ink); rect(g, cx + 1, foot - 2, ch + 1, 2, P.ink);
  rect(g, cx - ch, foot - 2, ch - 1, 1, '#3a2a1a'); rect(g, cx + 1, foot - 2, ch - 1, 1, '#3a2a1a');
}

/* ── the figures ──────────────────────────────────────────────────────────
 * Every sprite is anchored at its BOTTOM: the counter for a seated customer,
 * the shoes for someone standing. The scene places them by that edge. */

const FIG_W = 44;
const FIG_CX = 22;
const SEAT_H = 60;
const STAND_H = 64;

/**
 * A customer at the counter, seen from the chest up: hair, head, shoulders
 * and the arms in `pose`. `lean` tips them forward: the head comes down and
 * the shoulders come out, which is what a body does when it wants something.
 */
function buildSeated(L, pose, mood, frame, lean) {
  const { c, g } = canvas(FIG_W, SEAT_H);
  const cx = FIG_CX;
  const B = L.body;
  const foot = SEAT_H;
  const ny = foot - B.seat + (lean ? 2 : 0);
  const headY = ny - 11;
  const extra = lean ? 1 : 0;
  torso(g, cx, ny, B, foot - ny, L.color, L.lo, L.hi, extra);
  dressTorso(g, cx, ny, L, foot - ny);
  const arms = poseArms(pose, { cx, ny, sh: B.sh + extra, ch: B.ch + extra, foot, hip: foot, standing: false }, frame);
  drawArms(g, arms, L);
  drawHead(g, cx - 6, headY, L, mood);
  return c;
}

/**
 * Somebody on their feet, head to shoes, in `pose`. The crowd, and the queue at
 * the door.
 */
function buildStanding(L, pose, mood, frame) {
  const { c, g } = canvas(FIG_W, STAND_H);
  const cx = FIG_CX;
  const B = L.body;
  const foot = STAND_H;
  const hip = foot - B.legs;
  const ny = hip - B.torso;
  const headY = ny - 11;
  legs(g, cx, hip, foot, L);
  torso(g, cx, ny, B, B.torso + 1, L.color, L.lo, L.hi);
  dressTorso(g, cx, ny, L, B.torso + 1);
  const arms = poseArms(pose, { cx, ny, sh: B.sh, ch: B.ch, foot, hip, standing: true }, frame);
  drawArms(g, arms, L);
  drawHead(g, cx - 6, headY, L, mood);
  return c;
}

/* ── the cooks ────────────────────────────────────────────────────────────
 * Draw at the actual 34×34 game resolution. Broad colour clusters survive
 * small displays; heads stay identical across the two working poses. */
const COOK_W = 34, COOK_H = 34;
function buildCook(n, frame) {
  const { c, g } = canvas(COOK_W, COOK_H);
  const r = (x, y, w, h, color) => rect(g, x, y, w, h, color);
  const skin = n ? '#cf9463' : '#eab27c';
  const skinLo = n ? '#a86742' : '#bf8050';
  const hair = n ? '#30201b' : '#573322';
  const scarf = n ? P.copper : P.amber;

  // A continuous coat silhouette, with two broad shadow panels.
  r(9, 22, 17, 12, P.ink); r(6, 24, 23, 10, P.ink);
  r(9, 23, 17, 11, P.cream); r(7, 25, 21, 9, P.cream);
  r(10, 23, 13, 11, P.white); r(24, 25, 3, 9, P.greyHi);
  r(17, 25, 1, 9, P.cream);
  for (const y of [27, 31]) { r(14, y, 1, 1, P.woodInk); r(20, y, 1, 1, P.woodInk); }
  r(14, 20, 7, 4, P.ink); r(15, 20, 5, 3, skinLo);
  r(12, 23, 5, 2, scarf); r(18, 23, 5, 2, scarf);
  r(16, 24, 3, 3, scarf); r(17, 26, 2, 2, P.copperLo);

  // Compact faces: paired eyes, a single nose shadow, deliberate hair masses.
  if (n) { r(9, 12, 17, 12, P.ink); r(10, 12, 15, 11, hair); }
  r(11, 10, 13, 10, P.ink); r(13, 19, 9, 3, P.ink);
  r(10, 14, 2, 4, skinLo); r(24, 14, 2, 4, skinLo);
  r(12, 11, 11, 8, skin); r(14, 18, 7, 3, skin);
  r(22, 12, 1, 6, skinLo); r(20, 18, 2, 2, skinLo);
  r(12, 11, n ? 4 : 2, 3, hair); r(22, 11, 1, 3, hair);
  r(14, 14, 2, 1, hair); r(20, 14, 2, 1, hair);
  r(15, 15, 1, 1, P.ink); r(20, 15, 1, 1, P.ink);
  r(18, 16, 1, 2, skinLo);
  if (n) { r(17, 19, 3, 1, P.woodInk); r(12, 18, 1, 1, P.gold); }
  else { r(15, 18, 3, 1, hair); r(19, 18, 3, 1, hair); r(16, 19, 5, 1, hair); }

  // Toque pleats use only two large warm-white areas, no mottled texture.
  r(14, 4, 7, 1, P.ink); r(10, 5, 15, 5, P.ink);
  r(9, 6, 17, 3, P.ink);
  r(11, 9, 13, 3, P.ink);
  r(14, 5, 7, 4, P.white); r(11, 6, 13, 3, P.white);
  r(10, 7, 15, 2, P.white);
  r(12, 9, 11, 2, P.cream); r(13, 9, 8, 1, P.white);
  r(15, 6, 1, 2, P.cream); r(21, 5, 1, 3, P.cream);

  // Sleeves connect visibly to hands; tools never cross the face.
  r(5, 27, 5, 5, P.ink); r(6, 27, 4, 3, P.white);
  r(25, 26, 5, 5, P.ink); r(25, 26, 4, 3, P.white);
  if (!n) {
    const py = 29 - frame;
    r(8, py, 15, 4, P.ink); r(10, py + 1, 11, 2, P.copper);
    r(10, py, 11, 1, P.steelHi); r(12, py + 1, 4, 1, P.copperHi);
    r(23, py, 6, 2, P.woodInk); r(24, py, 4, 1, P.woodHi);
    r(6, 29, 3, 2, skin); r(26, py - 1, 3, 2, skin);
  } else {
    r(10, 29, 15, 5, P.ink); r(11, 30, 13, 3, P.copper);
    r(11, 29, 13, 1, P.steelHi); r(12, 30, 3, 2, P.copperHi);
    r(22, 30, 2, 3, P.copperLo);
    const sx = frame ? 20 : 22;
    r(sx, 25, 2, 6, P.woodInk); r(sx, 25, 1, 5, P.woodHi);
    r(sx + 1, 26, 4, 2, skin); r(8, 29, 3, 2, skin);
  }
  return c;
}

/* ── the player ────────────────────────────────────────────────────────────
 * A red-haired cook in a white jacket and a red apron, playing an electric
 * guitar with a sunburst body. Two frames: arm up, arm down on the strings,
 * and a face for what just happened. */

/* The guitar: a sunburst body low on the left, the neck rising to the right
 * with fret markers, a bridge and a pickguard. 34 wide, 31 tall. */
const GUITAR = [
  '..............................ohho',
  '.............................ohhho',
  '............................ohhhho',
  '...........................onnnno.',
  '..........................onnnno..',
  '.........................onfnno...',
  '........................onnnno....',
  '.......................onnfno.....',
  '......................onnnno......',
  '.....................onfnno.......',
  '....................onnnno........',
  '...................onnfno.........',
  '..................onnnno..........',
  '.................onfnno...........',
  '................onnnno............',
  '...........oooooonnfnoooo.........',
  '.........ooddddddnnnnddddoo.......',
  '........oddrrrrrrrrrrrrrrddo......',
  '.......odrrrryyyyyyyyyyyrrrdo.....',
  '......odrryyyyyyyyyyyyyyyyrrdo....',
  '.....odrryyyyyppppyyyyyyyyyrrdo...',
  '.....odryyyyyppppppyyyyyykyyrdo...',
  '....odrryyyyypppppyyybbyyyyyrrdo..',
  '....odrryyyyyyppyyyybbbbyyykyrrdo.',
  '....odrryyyyyyyyyyyyybbyyyyyyrrdo.',
  '....odrrryyyyyyyyyyyyyyyyyyyrrrdo.',
  '.....odrrryyyyyyyyyyyyyyyyyrrrdo..',
  '.....oddrrrryyyyyyyyyyyyyrrrrddo..',
  '......oddrrrrrrrrrrrrrrrrrrrddo...',
  '.......ooddddddddddddddddddoo.....',
  '.........oooooooooooooooooo.......',
];
const GUITAR_MAP = {
  o: P.ink, h: '#3a2010', n: '#8a5a2a', f: P.greyHi,
  d: '#4a1a0a', r: '#c8481c', y: '#f0b040', p: P.cream, k: P.ink, b: '#2a1a10',
};

/** The guitar's silhouette in one colour: the glow is this, drawn around it. */
function silhouette(spr, color) {
  const { c, g } = canvas(spr.width, spr.height);
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, spr.width, spr.height);
  return c;
}

const PLAYER_W = 56, PLAYER_H = 94;
const PLAYER_CX = 22;
const PLAYER_HEAD_Y = TOQUE_UP + 2;
const PLAYER_BODY_Y = PLAYER_HEAD_Y + 11;
const GUITAR_AT = { x: PLAYER_CX - 10, y: PLAYER_BODY_Y + 14 };

/**
 * The player, 56 wide and 94 tall. `frame` 0 is the strumming arm raised, 1 is
 * the arm down on the strings; `mood` is the face: 'happy' between strums,
 * 'sing' on the strum, 'oops' after a miss, 'thrilled' when a step cooks.
 */
function buildPlayer(frame, mood) {
  const L = look(0);
  L.hairColor = HAIRS[5]; L.hair = 3; L.skin = SKINS[0]; L.skinLo = shade(SKINS[0]); L.skinInk = shade(SKINS[0], 0.5);
  L.hat = 'toque'; L.glasses = null; L.earrings = false;
  const W = PLAYER_W, H = PLAYER_H;
  const { c, g } = canvas(W, H);
  const cx = PLAYER_CX;
  const headY = PLAYER_HEAD_Y;
  const bodyY = PLAYER_BODY_Y;
  const B = BODIES.normal;

  // Jacket, then the red apron from the waist down, then the legs.
  torso(g, cx, bodyY, B, 24, P.white, P.greyHi, P.white, 2);
  for (let j = 4; j < 22; j += 3) { rect(g, cx - 2, bodyY + j, 1, 1, P.ink); rect(g, cx + 2, bodyY + j, 1, 1, P.ink); }
  rect(g, cx - 3, bodyY, 7, 2, P.red); rect(g, cx - 1, bodyY + 2, 3, 1, P.redLo);   // the kerchief
  rect(g, cx - 11, bodyY + 24, 22, 24, P.ink);
  rect(g, cx - 10, bodyY + 24, 20, 23, P.red);
  rect(g, cx + 6, bodyY + 24, 4, 23, P.redLo);
  rect(g, cx - 10, bodyY + 24, 20, 1, P.redLo);
  rect(g, cx - 6, bodyY + 38, 12, 6, P.redLo); rect(g, cx - 6, bodyY + 38, 12, 1, P.ink);   // the pocket
  rect(g, cx + 7, bodyY + 30, 3, 10, P.cream); rect(g, cx + 7, bodyY + 30, 3, 1, P.ink);   // a towel at the hip
  // Legs and shoes.
  rect(g, cx - 9, bodyY + 47, 18, 12, P.ink);
  rect(g, cx - 8, bodyY + 48, 7, 9, '#2c2430'); rect(g, cx + 1, bodyY + 48, 7, 9, '#221c26');
  rect(g, cx - 9, bodyY + 57, 8, 3, P.ink); rect(g, cx + 1, bodyY + 57, 8, 3, P.ink);
  rect(g, cx - 8, bodyY + 57, 6, 1, '#3a2a1a'); rect(g, cx + 2, bodyY + 57, 6, 1, '#3a2a1a');

  // The glow, then the guitar. The glow is the silhouette drawn around it.
  const gs = sprite(GUITAR, GUITAR_MAP);
  const glow = silhouette(gs, P.cyan);
  g.globalAlpha = 0.55;
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    blit(g, glow, GUITAR_AT.x + dx, GUITAR_AT.y + dy);
  }
  g.globalAlpha = 1;
  blit(g, gs, GUITAR_AT.x, GUITAR_AT.y);

  // The fretting arm: from the far shoulder up the neck, hand on the frets.
  const nx = GUITAR_AT.x + 22, ny = GUITAR_AT.y + 8;
  limb(g, [[cx + B.sh + 1, bodyY + 3], [cx + B.sh + 6, bodyY + 10], [nx, ny]], [P.white]);
  hand(g, nx + 1, ny + 1, L, true);

  // The strumming arm: down from the near shoulder and across to the strings.
  const hy = GUITAR_AT.y + (frame ? 22 : 16);
  limb(g, [[cx - B.sh - 1, bodyY + 3], [cx - B.sh - 4, bodyY + 15], [cx + 3, hy]], [P.white]);
  hand(g, cx + 3, hy, L, true);
  if (frame) rect(g, cx + 3, hy + 3, 3, 1, P.cyanHi);       // the pick on the strings

  drawHead(g, cx - 6, headY, L, mood || 'happy');
  return c;
}

/** The guitar's glow on its own, for the pulse the scene draws over the player. */
function buildGlow() {
  return silhouette(sprite(GUITAR, GUITAR_MAP), P.cyan);
}

/* ── the cache ─────────────────────────────────────────────────────────────
 * Everything above is built the first time it is asked for and kept. */
const cache = new Map();
function memo(key, build) {
  let v = cache.get(key);
  if (!v) { v = build(); cache.set(key, v); }
  return v;
}

/**
 * A regular at the counter. `state` is what the scene knows about them:
 * `mood` (a key of MOODS), `pose` (defaults to their habit), `frame` 0/1,
 * `lean` to tip them forward.
 */
export function seated(face, state) {
  const s = state || {};
  const L = look(face);
  const pose = s.pose || L.pose;
  const mood = s.mood || (pose === 'phone' ? 'down' : pose === 'talk' ? (s.frame ? 'neutral' : 'talk') : 'neutral');
  const frame = s.frame ? 1 : 0;
  const lean = s.lean ? 1 : 0;
  return memo('seat|' + face + '|' + pose + '|' + mood + '|' + frame + '|' + lean, () => buildSeated(L, pose, mood, frame, lean));
}

/** A regular on their feet, in the queue at the door. */
export function standing(face, state) {
  const s = state || {};
  const L = look(face);
  const pose = s.pose || 'stand';
  const mood = s.mood || 'neutral';
  const frame = s.frame ? 1 : 0;
  return memo('stand|' + face + '|' + pose + '|' + mood + '|' + frame, () => buildStanding(L, pose, mood, frame));
}

/**
 * Somebody in the crowd, from a seed: their own look, their own pose, `frame`
 * for the little they move, and `depth` 0 (front) or 1 (a row back, darker).
 */
export function crowd(seed, frame, depth) {
  const f = frame ? 1 : 0;
  const d = depth ? 1 : 0;
  return memo('crowd|' + seed + '|' + f + '|' + d, () => {
    const L = lookFrom(seed);
    const pose = L.pose;
    const mood = pose === 'phone' ? 'down'
      : pose === 'talk' ? (f ? 'neutral' : 'talk')
        : pose === 'drink' && f ? 'chew'
          : hash(seed, 30, 977) < 0.3 ? 'happy' : 'neutral';
    const spr = buildStanding(L, pose, mood, f);
    return tinted(spr, d ? 'rgba(8,6,12,0.42)' : 'rgba(8,6,12,0.2)');
  });
}

export const cook = (n, frame) => memo('cook|' + n + '|' + (frame ? 1 : 0), () => buildCook(n, frame ? 1 : 0));
export const player = (frame, mood) => memo('player|' + (frame ? 1 : 0) + '|' + (mood || 'happy'), () => buildPlayer(frame ? 1 : 0, mood || 'happy'));
export const guitarGlow = () => memo('glow', buildGlow);

/** Sizes the scene needs to place things by their bottom edge. */
export const FIGURE = { W: FIG_W, CX: FIG_CX, SEAT_H, STAND_H, COOK_W, COOK_H };

/** Where the guitar sits on the player sprite, and where the strings are:
 *  notes leave from there. */
export const PLAYER_GUITAR = GUITAR_AT;
export const PLAYER_STRINGS = { x: PLAYER_CX + 4, y: GUITAR_AT.y + 22 };
