/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE GEOMETRY: 480 by 270, three bands, five places at the counter.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Every number the drawing shares lives here, so the backdrop, the people and
 * the cards agree on where the counter is without asking each other.
 *
 *     0..22    the status bar: level, clock, served, lives, takings
 *    22..118   the dining room: shelf, bubbles, the crowd, the customers, the counter
 *   118..134   the strip: chain, combo, total
 *   134..270   the kitchen: hood and cooks, the ticket rail with the cards,
 *              the pans on the stove, the stove front, the player
 *
 * The counter has FIVE places whatever the level says. Places the engine has
 * not opened yet are dark burners with a closed card. A kitchen that grows a
 * place in one frame reads as a layout; one with two cold burners waiting
 * reads as a place. The sixth column, on the right, is the doorway upstairs
 * and the player downstairs.
 *
 * The kitchen band is read from the bottom up. The pans are the second thing
 * on the screen after the cards, so they get thirty pixels of height and the
 * cards give up sixteen to pay for it: a card is fifty-six tall now, and what
 * it lost was the step counter and the roman numerals, never the chord, the
 * seconds or the fingering.
 */

export const GEO = {
  W: 480,
  H: 270,

  BAR_Y: 0, BAR_H: 22,
  ROOM_Y: 22, ROOM_H: 96,
  STRIP_Y: 118, STRIP_H: 16,
  KITCHEN_Y: 134, KITCHEN_H: 136,

  SLOT_W: 84,
  SLOTS: 5,
  RIGHT_X: 420,                 // the doorway and the player start here

  SHELF_Y: 30,                  // the board of the top shelf
  /* Speech bubbles. The HEIGHT here is the tallest one gets, for the band a
   * test looks in and for the clip: the real height is cut to the number of
   * lines by `bubbleLayout`, the same way a plate is cut to its number. */
  BUBBLE_Y: 33, BUBBLE_H: 30,
  SEAT_FOOT: 110,               // a seated customer's sprite ends here, on the counter
  CROWD_FOOT: 110,              // the front row of the crowd stands to here (hidden by the counter)
  CROWD_BACK_FOOT: 102,         // the back row, a step further from us
  COUNTER_Y: 108,               // the counter's top surface, 108..112
  COUNTER_FRONT_Y: 112,         // its front, 112..118

  DOOR_X: 428, DOOR_W: 46, DOOR_Y: 28,

  HOOD_Y: 134, HOOD_H: 8,       // the extractor hood, top of the kitchen
  PASS_Y: 162,                  // the pass: the cooks' worktop edge, the ticket rail
  /* Where the two cooks stand at the pass, and these are not free numbers.
   * Each one has to sit inside ONE card's width, because the card is what
   * hides the cook below the rail — a cook straddling the gap between two
   * cards shows a flat cut through the middle of him. The backdrop leaves the
   * hanging rail bare over both of them for the same reason. */
  COOK_CX: [126, 300],
  /* How far ABOVE the kitchen band the cooks are hung, and why they are hung
   * at all: the band is thirty rows and a sprite cut to thirty filled it with
   * a hat. Four rows up, with the strip drawn first and cutting them, the same
   * thirty rows show a face and a chest. The sheet's box has to be this much
   * taller than the band or the cook stops short of the cards and floats. */
  COOK_LIFT: 4,
  CARD_Y: 164, CARD_H: 56,      // the chord cards hang from the rail
  CARD_W: 80,
  COOKTOP_Y: 244,               // the steel surface, 244..256
  PAN_BASE_Y: 252,              // pans sit here
  STOVE_FRONT_Y: 256,           // steel front, 256..270

  PLAYER_X: 424, PLAYER_Y: 172, // the player drawn in code, 56 by 94
  /* Where the player stands, for a sprite of any height: feet on this line,
   * centred on this column. The drawn cook has been 39 by 73, 59 by 115 and
   * 61 by 120, and none of those numbers belongs anywhere but here.
   *
   * The column is what is left of the screen: the fifth card ends at 418 and
   * the screen at 480, so a sprite up to sixty-one wide fits and a wider one
   * has to come off something. 449, not 450, for exactly that reason — at 450
   * a sixty-one wide cook starts at 420 and loses his tuning pegs off the
   * right edge. This is the number that has to move when the sprite grows,
   * and if it cannot move the sprite is wrong: a cook posed too wide for this
   * column arrives already cut, and nothing downstream can uncut him. */
  PLAYER_CX: 449, PLAYER_FOOT: 268,
};

export const slotX = (i) => i * GEO.SLOT_W;
export const slotCX = (i) => i * GEO.SLOT_W + GEO.SLOT_W / 2;
