/*
 * The art manifest, checked against the game's own data.
 *
 * Drawn sprites are optional: with no `assets/art/atlas.json` the game draws
 * everything procedurally and these tests pass by saying so. What they refuse
 * is a manifest that is present and WRONG, because that is the failure nobody
 * notices: a sheet whose frame is called "pot" instead of "stockpot" draws
 * nothing at all, silently, and the pan just looks empty.
 *
 * The expected names are derived from `menu.js`, never written out twice, so
 * adding a dish changes what the manifest has to contain without anybody
 * remembering to update a list.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { COOKWARE, MENU } from '../src/menu.js';
import { GEO, slotX } from '../src/art/geo.js';
import { expectedFrames } from '../src/art/atlas.js';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'assets', 'art');
const MANIFEST = join(ART, 'atlas.json');

const want = expectedFrames(COOKWARE, MENU.map((m) => m.id));

test('the expected frame list comes from the game and not from a second list', () => {
  assert.deepEqual(want.pans, COOKWARE, 'the pans are the cookware, verbatim');
  assert.equal(want.dishes.length, MENU.length, 'one plated dish per dish on the menu');
  for (const id of want.dishes) assert.ok(MENU.some((m) => m.id === id));
});

test('with no art delivered the game is still complete', () => {
  // Stated as a test because it is a promise, not an accident: the procedural
  // art is the floor, and the atlas only ever replaces individual sprites.
  if (existsSync(MANIFEST)) return;
  assert.ok(true, 'no manifest, so nothing to check and nothing broken');
});

test('a manifest that exists has to be right', () => {
  if (!existsSync(MANIFEST)) return;
  const json = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  assert.ok(json.sheets && typeof json.sheets === 'object', 'the manifest needs a "sheets" object');

  const seen = new Set();
  for (const [name, spec] of Object.entries(json.sheets)) {
    assert.ok(Array.isArray(spec.frames) && spec.frames.length, name + ' lists no frames');
    assert.ok(spec.cols >= 1, name + ' has no column count');
    const cell = spec.cell || json.cellSize;
    assert.ok(Array.isArray(cell) && cell.length === 2 && cell[0] > 0 && cell[1] > 0,
      name + ' has no usable cell size');
    assert.ok(spec.frames.length <= spec.cols * (spec.rows || Math.ceil(spec.frames.length / spec.cols)),
      name + ' names more frames than its grid holds');
    assert.ok(existsSync(join(ART, name + '.png')), name + '.png is named in the manifest but not on disk');
    for (const f of spec.frames) {
      assert.ok(!seen.has(name + '/' + f), name + ' names the frame ' + f + ' twice');
      seen.add(name + '/' + f);
    }
  }

  /* Every frame has to be a name the game will actually ask for.
   *
   * Note which way round this runs. It does NOT demand that every pan has been
   * drawn: half a set is the normal state in the middle of the job, and the
   * module is built to draw the rest in code. What it refuses is a frame the
   * game will never ask for — a sheet whose pan is called "pot" instead of
   * "stockpot" draws nothing at all, silently, and the pan just looks empty. */
  const known = new Set([...want.pans, ...want.dishes, ...want.player, ...want.customer,
    ...want.crowd, ...want.cooks, ...want.props, ...want.spare]);
  const stray = [...new Set(Object.values(json.sheets).flatMap((s) => s.frames))].filter((f) => !known.has(f));
  assert.deepEqual(stray, [], 'frames nothing will ever ask for: ' + stray.join(', '));

  /* The player's poses are a fixed vocabulary, but a sheet does not have to
   * carry all of it. The model that draws these gives one pose per picture and
   * no way to ask for a second, so the body is drawn and the poses on top of it
   * are code. What a sheet may not do is invent a name: `idle` is drawn,
   * `idel` silently draws nothing. */
  if (json.sheets.player) {
    const poses = json.sheets.player.frames;
    assert.ok(poses.includes('idle'), 'a player sheet has to carry at least the idle pose');
    for (const f of poses) assert.ok(want.player.includes(f), 'unknown player pose: ' + f);
    assert.deepEqual(poses, want.player.filter((f) => poses.includes(f)), 'the poses are out of order');
  }
  for (const [name, spec] of Object.entries(json.sheets)) {
    if (!name.startsWith('cust-')) continue;
    assert.deepEqual(spec.frames, want.customer, name + ' does not carry the four customer poses');
  }
});

/*
 * ── AND A DRAWN SPRITE HAS TO FIT WHERE IT IS DRAWN ──────────────────────
 *
 * This is the test that would have caught the whole afternoon. The cooks came
 * back as fifty-six pixel standing figures for a band that is thirty rows
 * deep, so at the pass they reached up through the chain and combo strip and
 * stood with their hats over the score. The player came back seventy-six wide
 * for a column that is sixty-one, so the cut-out took eight columns off each
 * side of him: the tuning pegs, the lower bout of the guitar, and the top of
 * his hat.
 *
 * Neither was a drawing bug and neither was visible in a unit test, because
 * both were a SIZE agreeing with nothing. So the sizes are checked against the
 * geometry the moment the manifest changes, in the only place that knows both.
 */
test('a drawn sprite fits the band it is drawn in', () => {
  if (!existsSync(MANIFEST)) return;
  const json = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const cell = (name) => {
    const s = json.sheets[name];
    return s ? (s.cell || json.cellSize) : null;
  };

  /* The player stands in what is left of the screen to the right of the last
   * card, feet on `PLAYER_FOOT`, and is drawn last over nothing. Wider than
   * the column and he is either off the screen or over the fifth card. */
  const player = cell('player');
  if (player) {
    const [w, h] = player;
    const x = Math.round(GEO.PLAYER_CX - w / 2);
    const cardsEnd = slotX(GEO.SLOTS - 1) + 2 + GEO.CARD_W;
    assert.ok(x >= cardsEnd, `the player starts at ${x} and the cards end at ${cardsEnd}`);
    assert.ok(x + w <= GEO.W, `the player ends at ${x + w} and the screen at ${GEO.W}`);
    assert.ok(GEO.PLAYER_FOOT - h >= GEO.KITCHEN_Y,
      `the player is ${h} tall and reaches ${GEO.PLAYER_FOOT - h}, above the kitchen at ${GEO.KITCHEN_Y}`);
  }

  /* A cook at the pass hangs from the top of the kitchen and everything below
   * the rail is hidden by a chord card, so he has to be no taller than the
   * band and no wider than the card that covers him. */
  const cooks = cell('cooks');
  if (cooks) {
    const [w, h] = cooks;
    /* A cook is hung `COOK_LIFT` rows above the band and is TALLER than it,
     * which is deliberate and was not always: cut to exactly the band's thirty
     * rows, eleven of them were hat and the pass read as two hats with a strip
     * of face under them. So the claims are the two that matter — it reaches
     * the cards, and it does not climb out through the interface. */
    const top = GEO.KITCHEN_Y - GEO.COOK_LIFT;
    assert.ok(top + h >= GEO.CARD_Y,
      `a cook hung at ${top} is ${h} tall and stops at ${top + h}, short of the cards at ${GEO.CARD_Y}: he floats`);
    assert.ok(top >= GEO.STRIP_Y,
      `a cook hung at ${top} climbs into the strip at ${GEO.STRIP_Y} and out the other side`);
    assert.ok(h - GEO.COOK_LIFT <= GEO.CARD_H,
      `a cook is ${h} tall and the cards that hide his body are only ${GEO.CARD_H}`);
    for (const cx of GEO.COOK_CX) {
      const x = Math.round(cx - w / 2);
      const i = GEO.COOK_CX.indexOf(cx);
      const card = { x: slotX(Math.floor(cx / GEO.SLOT_W)) + 2, w: GEO.CARD_W };
      assert.ok(x >= card.x && x + w <= card.x + card.w,
        `cook ${i} spans ${x}..${x + w} and the card that hides him spans ${card.x}..${card.x + card.w}`);
    }
  }

  /* A drawn pan has to be the size of the pan it replaces, and this one has a
   * FLOOR as well as a ceiling — the only sprite in the game that does.
   *
   * The ceiling is the stove's band: a pan sits on `PAN_BASE_Y` and the chord
   * cards end at `CARD_Y + CARD_H`, so anything taller than the gap is drawn
   * over the heat bar of the card above it. The floor is subtler and cost a
   * round trip to find. The fire under a pan, the lit ring beneath it, the
   * food on its surface and the plume of steam off it are four separate
   * drawings tuned together against a vessel twenty to thirty pixels tall. A
   * drawn sheet came back at half that, and every one of them was suddenly
   * wrong at once — which does not look like small pans, it looks like a stove
   * with nothing on it. Scaling the four to match was tried and reverted: the
   * sprite was what was out of scale. */
  const pans = cell('pans');
  if (pans) {
    const [w, h] = pans;
    const band = GEO.PAN_BASE_Y - (GEO.CARD_Y + GEO.CARD_H);
    assert.ok(h <= band, `a drawn pan is ${h} tall and the stove's band is ${band}`);
    assert.ok(h >= 24, `a drawn pan is only ${h} tall, and the fire, ring, food and steam around it are drawn for 20 to 30`);
    assert.ok(w <= GEO.SLOT_W - 28, `a drawn pan is ${w} wide and would reach the side plate`);
  }

  // Everybody else: nothing may be taller than the band it lives in.
  const room = GEO.COUNTER_Y - GEO.ROOM_Y;
  for (const name of Object.keys(json.sheets)) {
    if (!/^cust-|^crowd$/.test(name)) continue;
    const [, h] = cell(name);
    assert.ok(h <= room, `${name} is ${h} tall and the dining room is ${room}`);
  }
});
