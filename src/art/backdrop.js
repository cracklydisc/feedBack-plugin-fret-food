/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE BACKDROP: everything that never moves, drawn once.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The brick, the wood, the shelves and what stands on them, the doorway, the
 * hood, the tiles, the rail with the pans and ladles on it, the pass with the
 * sacks and the knife block, the stove: all of it is painted into one
 * offscreen canvas when the scene is created and copied to the frame with a
 * single `drawImage`. That copy is the cheapest thing in the whole frame, and
 * it is what leaves the four millisecond budget to the things that do move.
 *
 * Nothing here reads the game. The dark burners for places not yet open, the
 * lit ones, the crowd, the customers, the cooks and the cards are drawn over
 * this by the scene.
 */

import { P, rect, dither, oval, plate, rrect, hash } from './pix.js';
import {
  bricks, tiles, shadow, boards, planks, shelf, pillar, steel, hood, rail, jar, bottle, oilBottle,
  squeeze, plates, cup, ladle, whisk, spatula, loaf, board, knifeBlock, sack, towel, eggs, basket,
  produce, hangingPan, garlic, chillies, stool, baked,
} from './props.js';
import { GEO, slotX, slotCX } from './geo.js';

export function buildBackdrop() {
  const { W, H } = GEO;
  return baked(W, H, (g) => {
    bar(g);
    room(g);
    strip(g);
    kitchen(g);
  });
}

/* ── the status bar: a dark wooden beam the plates hang on ───────────────── */
function bar(g) {
  const { W, BAR_Y, BAR_H } = GEO;
  rect(g, 0, BAR_Y, W, BAR_H, P.woodLo);
  dither(g, 0, BAR_Y, W, BAR_H, P.woodLo, P.woodInk);
  rect(g, 0, BAR_Y, W, 1, P.wood);
  rect(g, 0, BAR_Y + BAR_H - 2, W, 2, P.woodInk);
  for (let x = 30; x < W; x += 60) rect(g, x, BAR_Y + 3, 1, BAR_H - 6, P.woodInk);
}

/* ── the dining room ─────────────────────────────────────────────────────── */
function room(g) {
  const { W, ROOM_Y, COUNTER_Y, COUNTER_FRONT_Y, STRIP_Y, RIGHT_X, SHELF_Y } = GEO;

  bricks(g, 0, ROOM_Y, W, COUNTER_Y - ROOM_Y, 11);
  // The wall darkens toward the counter, where the crowd's shadows fall.
  shadow(g, 0, COUNTER_Y - 30, W, 30, 0.25);
  shadow(g, 0, COUNTER_Y - 16, W, 16, 0.35);
  shadow(g, 0, COUNTER_Y - 6, W, 6, 0.4);

  // Wooden pillars between the places.
  for (let i = 1; i < GEO.SLOTS; i++) pillar(g, slotX(i) - 2, ROOM_Y, 4, COUNTER_Y - ROOM_Y);
  pillar(g, RIGHT_X - 3, ROOM_Y, 5, COUNTER_Y - ROOM_Y);

  // The top shelf across the room, and what is on it.
  shelf(g, 2, SHELF_Y, RIGHT_X - 6);
  const items = [
    () => jar(g, 8, SHELF_Y - 8, 7, 8, '#c83a2a', P.woodLo),
    () => jar(g, 18, SHELF_Y - 7, 6, 7, '#4a8a3a', P.woodLo),
    () => bottle(g, 28, SHELF_Y - 8, 8, '#8a9a30', P.amber),
    () => jar(g, 36, SHELF_Y - 9, 8, 9, '#e0a030', P.greyHi),
    () => loaf(g, 50, SHELF_Y - 5),
    () => bottle(g, 66, SHELF_Y - 9, 9, '#7a1030', P.ink),
    () => jar(g, 74, SHELF_Y - 7, 7, 7, '#f0ece0', P.woodLo),
    () => plates(g, 92, SHELF_Y - 2, 3),
    () => jar(g, 118, SHELF_Y - 8, 7, 8, '#3a9a5a', P.woodLo),
    () => bottle(g, 130, SHELF_Y - 8, 8, '#d8c030', P.amber),
    () => plates(g, 140, SHELF_Y - 2, 3),
    () => jar(g, 160, SHELF_Y - 9, 8, 9, '#c83a2a', P.greyHi),
    () => produce(g, 174, SHELF_Y - 5, '#e8d8f0', '#ffffff', 5),
    () => produce(g, 182, SHELF_Y - 5, '#d83028', '#ff8a7a', 5),
    () => cup(g, 194, SHELF_Y - 6, P.white),
    () => cup(g, 204, SHELF_Y - 6, '#c83a2a'),
    () => jar(g, 220, SHELF_Y - 7, 6, 7, '#e0a030', P.woodLo),
    () => bottle(g, 230, SHELF_Y - 9, 9, '#8a9a30', P.amber),
    () => bottle(g, 236, SHELF_Y - 7, 7, '#7a1030', P.ink),
    () => jar(g, 246, SHELF_Y - 8, 7, 8, '#4a8a3a', P.woodLo),
    () => cup(g, 258, SHELF_Y - 6, P.white),
    () => cup(g, 268, SHELF_Y - 6, '#c83a2a'),
    () => loaf(g, 282, SHELF_Y - 5),
    () => jar(g, 296, SHELF_Y - 9, 8, 9, '#f0ece0', P.greyHi),
    () => plates(g, 310, SHELF_Y - 2, 4),
    () => jar(g, 334, SHELF_Y - 8, 7, 8, '#c83a2a', P.woodLo),
    () => bottle(g, 346, SHELF_Y - 8, 8, '#d8c030', P.amber),
    () => plates(g, 354, SHELF_Y - 2, 4),
    () => produce(g, 372, SHELF_Y - 5, '#f08020', '#ffb060', 5),
    () => produce(g, 380, SHELF_Y - 4, '#3a9a3a', '#7ad060', 4),
    () => jar(g, 390, SHELF_Y - 9, 8, 9, '#e0a030', P.greyHi),
    () => bottle(g, 404, SHELF_Y - 9, 9, '#7a1030', P.ink),
  ];
  for (const it of items) it();

  // What hangs on the wall at the sides of each place, where a seated customer
  // never covers it: pictures, a clock, a chalkboard, hooks, a small shelf.
  // Different at every place, so the room does not repeat. Most of it will be
  // behind the crowd on a busy night, which is what a wall is for.
  for (let i = 0; i < GEO.SLOTS; i++) {
    const lx = slotX(i) + 5;
    const rx = slotX(i) + GEO.SLOT_W - 19;
    switch (i % 5) {
      case 0:
        picture(g, lx, 40, '#3c6cba', '#e0a030');
        hook(g, rx + 4, 38);
        break;
      case 1:
        wallClock(g, lx + 1, 39);
        picture(g, rx, 42, '#3a9a5a', '#d83028');
        break;
      case 2:
        chalkboard(g, lx - 1, 38);
        miniShelf(g, rx - 1, 46);
        break;
      case 3:
        picture(g, lx, 38, '#e0a030', '#7a1030');
        picture(g, lx + 1, 52, '#8a9a30', '#3c6cba');
        hook(g, rx + 4, 40);
        break;
      default:
        miniShelf(g, lx - 1, 44);
        wallClock(g, rx + 3, 40);
    }
  }

  // The doorway on the right: frame, the street at night, a lamp over it.
  const { DOOR_X, DOOR_W, DOOR_Y } = GEO;
  rect(g, DOOR_X - 3, DOOR_Y - 3, DOOR_W + 6, COUNTER_Y - DOOR_Y + 3, P.woodInk);
  rect(g, DOOR_X - 2, DOOR_Y - 2, DOOR_W + 4, COUNTER_Y - DOOR_Y + 2, P.wood);
  rect(g, DOOR_X - 2, DOOR_Y - 2, DOOR_W + 4, 1, P.woodHi);
  rect(g, DOOR_X, DOOR_Y, DOOR_W, COUNTER_Y - DOOR_Y, P.night);
  dither(g, DOOR_X, DOOR_Y, DOOR_W, 20, P.night, P.nightHi);
  // Cobbles outside, a lamp post, its light.
  dither(g, DOOR_X, COUNTER_Y - 10, DOOR_W, 10, '#2c3244', '#3a4258');
  rect(g, DOOR_X + DOOR_W - 8, DOOR_Y + 6, 2, COUNTER_Y - DOOR_Y - 12, '#3a3a44');
  rect(g, DOOR_X + DOOR_W - 10, DOOR_Y + 4, 6, 4, P.ink);
  rect(g, DOOR_X + DOOR_W - 9, DOOR_Y + 5, 4, 2, P.lamp);
  g.globalAlpha = 0.22;
  dither(g, DOOR_X + DOOR_W - 18, DOOR_Y + 8, 20, 26, P.lamp, 'rgba(0,0,0,0)');
  g.globalAlpha = 1;
  // The sign over the door.
  plate(g, DOOR_X + 8, DOOR_Y - 1, 30, 9, { border: P.frameHi });

  // Stools, seen over the counter: only the seat shows, and only at a free place.
  for (let i = 0; i < GEO.SLOTS; i++) stool(g, slotCX(i), COUNTER_Y - 8);

  // The counter: boards on top, planks in front, a dark edge between.
  boards(g, 0, COUNTER_Y, W, COUNTER_FRONT_Y - COUNTER_Y, 5);
  rect(g, 0, COUNTER_Y, W, 1, P.woodHi);
  rect(g, 0, COUNTER_FRONT_Y - 1, W, 1, P.woodInk);
  planks(g, 0, COUNTER_FRONT_Y, W, STRIP_Y - COUNTER_FRONT_Y);
}

/* Wall decoration, each a few rectangles with an outline. */
function picture(g, x, y, sky, ground) {
  rect(g, x, y, 14, 12, P.woodInk); rect(g, x + 1, y + 1, 12, 10, P.cream);
  rect(g, x + 2, y + 2, 10, 5, sky); rect(g, x + 2, y + 7, 10, 3, ground);
  rect(g, x + 4, y + 3, 3, 2, P.white);
}
function wallClock(g, x, y) {
  oval(g, x + 5, y + 5, 11, 11, P.woodInk);
  oval(g, x + 5, y + 5, 9, 9, P.cream);
  rect(g, x + 5, y + 2, 1, 3, P.ink); rect(g, x + 5, y + 5, 3, 1, P.ink);
  rect(g, x + 5, y + 5, 1, 1, P.red);
}
function chalkboard(g, x, y) {
  rect(g, x, y, 16, 14, P.woodInk); rect(g, x + 1, y + 1, 14, 12, '#1e2a22');
  rect(g, x + 3, y + 3, 10, 1, P.cream); rect(g, x + 3, y + 6, 7, 1, P.greyHi);
  rect(g, x + 3, y + 9, 9, 1, P.greyHi); rect(g, x + 10, y + 6, 3, 1, P.amber);
}
function hook(g, x, y) {
  rect(g, x, y, 3, 2, P.steelHi); rect(g, x + 1, y + 2, 1, 2, P.steelHi);
  // A folded apron on it.
  rect(g, x - 2, y + 4, 7, 12, P.ink); rect(g, x - 1, y + 5, 5, 10, P.white);
  rect(g, x, y + 8, 3, 1, P.red);
}
function miniShelf(g, x, y) {
  shelf(g, x, y, 16);
  jar(g, x + 2, y - 7, 6, 7, '#c83a2a', P.woodLo);
  bottle(g, x + 10, y - 8, 8, '#8a9a30', P.amber);
}

/* ── the strip ───────────────────────────────────────────────────────────── */
function strip(g) {
  const { W, STRIP_Y, STRIP_H } = GEO;
  rect(g, 0, STRIP_Y, W, STRIP_H, P.ink);
  rect(g, 0, STRIP_Y, W, 1, P.frameLo);
  rect(g, 0, STRIP_Y + STRIP_H - 1, W, 1, P.frameLo);
  dither(g, 0, STRIP_Y + 1, W, STRIP_H - 2, P.ink, P.plate);
}

/* ── the kitchen ─────────────────────────────────────────────────────────── */
function kitchen(g) {
  const { W, H, KITCHEN_Y, HOOD_Y, HOOD_H, PASS_Y, CARD_Y, RIGHT_X, COOKTOP_Y, PAN_BASE_Y, STOVE_FRONT_Y } = GEO;

  // Tiles from under the hood to the cooktop, the whole width.
  tiles(g, 0, HOOD_Y + HOOD_H, W, COOKTOP_Y - HOOD_Y - HOOD_H, 23);
  shadow(g, 0, HOOD_Y + HOOD_H, W, 4, 0.4);
  // The wall darkens toward the stove, behind the pans.
  shadow(g, 0, COOKTOP_Y - 14, W, 14, 0.25);
  shadow(g, 0, COOKTOP_Y - 5, W, 5, 0.35);

  // The hood over everything.
  hood(g, 0, HOOD_Y, W, HOOD_H);

  // The rail under the hood, and what hangs from it. Nothing between 100 and
  // 152 or between 274 and 326: the two cooks stand there.
  const ry = HOOD_Y + HOOD_H + 3;
  rail(g, 4, ry, RIGHT_X - 8);
  hangingPan(g, 22, ry + 1);
  ladle(g, 42, ry + 1);
  whisk(g, 56, ry + 1);
  hangingPan(g, 156, ry + 1, 'iron');
  garlic(g, 176, ry);
  spatula(g, 212, ry + 1);
  hangingPan(g, 226, ry + 1);
  chillies(g, 248, ry + 1);
  towel(g, 330, ry - 1, P.white);
  hangingPan(g, 344, ry + 1, 'steel');
  ladle(g, 366, ry + 1);
  towel(g, 402, ry - 1, P.cream);

  // Warm pools of work light under the two staff stations. Hard pixel steps
  // preserve the tiled wall; no soft glow competing with the chord names.
  for (const cx of GEO.COOK_CX) {
    rect(g, cx - 19, HOOD_Y + HOOD_H + 1, 38, 1, P.cream);
    rect(g, cx - 18, HOOD_Y + HOOD_H + 2, 36, 1, P.steelHi);
  }

  // The pass: a steel worktop edge the cards hang from, and what sits on it.
  sack(g, 4, PASS_Y - 14);
  knifeBlock(g, 70, PASS_Y - 8);
  eggs(g, 86, PASS_Y - 7);
  basket(g, 190, PASS_Y - 9);
  board(g, 258, PASS_Y - 4);
  oilBottle(g, 380, PASS_Y - 15, 15);
  bottle(g, 390, PASS_Y - 12, 12, '#7a1030', P.ink);
  jar(g, 402, PASS_Y - 9, 8, 9, '#4a8a3a', P.woodLo);
  rect(g, 0, PASS_Y, RIGHT_X, 1, P.steelHi);
  rect(g, 0, PASS_Y + 1, RIGHT_X, 2, P.steel);
  rect(g, 0, PASS_Y + 3, RIGHT_X, 1, P.steelInk);
  // The ticket rail: a bar with a clip over every card.
  for (let i = 0; i < GEO.SLOTS; i++) {
    const x = slotX(i) + 2;
    rect(g, x + 8, CARD_Y - 1, 6, 3, P.ink); rect(g, x + 9, CARD_Y - 1, 4, 1, P.steelHi);
    rect(g, x + GEO.CARD_W - 14, CARD_Y - 1, 6, 3, P.ink); rect(g, x + GEO.CARD_W - 13, CARD_Y - 1, 4, 1, P.steelHi);
  }

  // Shelves on the right, over the player: produce, oil, bread.
  shelf(g, RIGHT_X + 2, KITCHEN_Y + 26, W - RIGHT_X - 4);
  produce(g, RIGHT_X + 6, KITCHEN_Y + 21, '#d83028', '#ff8a7a', 5);
  produce(g, RIGHT_X + 13, KITCHEN_Y + 22, '#f08020', '#ffb060', 4);
  bottle(g, RIGHT_X + 22, KITCHEN_Y + 18, 8, '#8a9a30', P.amber);
  jar(g, RIGHT_X + 30, KITCHEN_Y + 18, 7, 8, '#4a8a3a', P.woodLo);
  produce(g, RIGHT_X + 41, KITCHEN_Y + 21, '#e8d8f0', '#ffffff', 5);
  loaf(g, RIGHT_X + 48, KITCHEN_Y + 21);
  shelf(g, RIGHT_X + 2, KITCHEN_Y + 44, W - RIGHT_X - 4);
  jar(g, RIGHT_X + 5, KITCHEN_Y + 35, 8, 9, '#c83a2a', P.greyHi);
  bottle(g, RIGHT_X + 17, KITCHEN_Y + 36, 8, '#7a1030', P.ink);
  bottle(g, RIGHT_X + 23, KITCHEN_Y + 35, 9, '#d8c030', P.amber);
  cup(g, RIGHT_X + 32, KITCHEN_Y + 38, P.white);
  jar(g, RIGHT_X + 47, KITCHEN_Y + 36, 7, 8, '#e0a030', P.woodLo);

  /* The cooktop: brushed steel, and a BURNER per place rather than three flat
   * ovals. A burner seen front on is a drip well, a cast-iron grate sitting in
   * it and the grate's fingers where the pan lands — a dark well, a ring with a
   * lit top edge, and five notches along the top. The lit ring of the flame
   * (`pan()` draws it) falls exactly on the grate, which is where the fire is. */
  steel(g, 0, COOKTOP_Y, W, STOVE_FRONT_Y - COOKTOP_Y);
  // Brushing: a few faint horizontal strokes along the surface, seeded so the
  // same pixels come back every time.
  for (let k = 0; k < 40; k++) {
    const x = Math.floor(hash(k, 1, 91) * (W - 12));
    const y = COOKTOP_Y + 4 + Math.floor(hash(k, 2, 91) * (STOVE_FRONT_Y - COOKTOP_Y - 6));
    rect(g, x, y, 6 + Math.floor(hash(k, 3, 91) * 6), 1, hash(k, 4, 91) < 0.5 ? P.steelHi : P.steelLo);
  }
  for (let i = 0; i < GEO.SLOTS; i++) {
    const cx = slotCX(i);
    oval(g, cx, PAN_BASE_Y + 1, 58, 8, P.steelInk);        // the drip well
    oval(g, cx, PAN_BASE_Y + 1, 52, 6, P.steelLo);         // the grate
    oval(g, cx, PAN_BASE_Y, 48, 3, P.steelHi);             // its lit top edge
    oval(g, cx, PAN_BASE_Y + 1, 44, 3, P.steelInk);        // the hole the fire comes through
    for (let k = -2; k <= 2; k++) rect(g, cx + k * 10 - 1, PAN_BASE_Y - 2, 2, 2, P.steelInk);  // the fingers
  }
  // The front: a chrome lip under the cooktop's edge, the panel, a toe-kick.
  rect(g, 0, STOVE_FRONT_Y, W, 1, P.steelInk);
  rect(g, 0, STOVE_FRONT_Y + 1, W, H - STOVE_FRONT_Y - 1, P.steelLo);
  rect(g, 0, STOVE_FRONT_Y + 1, W, 1, P.steelHi);
  dither(g, 0, STOVE_FRONT_Y + 2, W, 2, P.steelLo, P.steel);
  rect(g, 0, H - 3, W, 1, P.steelInk);
  dither(g, 0, H - 2, W, 2, P.steelInk, P.ink);
  for (let i = 0; i < GEO.SLOTS; i++) {
    const cx = slotCX(i);
    /* The knob: round, with a pointer and a catch of light, where a square
     * with a notch read as a switch. And the burner gauge's frame beside the
     * tag, which the scene fills with bars. */
    rrect(g, cx - 41, STOVE_FRONT_Y + 4, 8, 8, P.ink, 2);
    rrect(g, cx - 40, STOVE_FRONT_Y + 5, 6, 6, P.steelHi, 1);
    rect(g, cx - 38, STOVE_FRONT_Y + 5, 2, 3, P.steelInk);
    rect(g, cx - 40, STOVE_FRONT_Y + 9, 2, 1, P.white);
    rect(g, cx + 27, STOVE_FRONT_Y + 3, 16, 10, P.ink);
  }

  // A squeeze bottle or two at the ends of the cooktop, where no pan reaches.
  squeeze(g, 2, COOKTOP_Y - 8, '#f0c020');
  squeeze(g, RIGHT_X - 8, COOKTOP_Y - 8, P.red);
}
