/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE SCENE: a 16-bit kitchen, drawn into a 480x270 buffer and scaled up.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The screen is one canvas. Every frame the static backdrop is copied in,
 * then the crowd, the customers, the cooks, the cards, the pans, the player
 * and the effects are drawn over it from the last snapshot and from the events
 * that arrived since. The buffer is then blown up onto the visible canvas by a
 * whole number, so that every pixel of it is the same size as every other.
 *
 * ── WHAT COMES FROM WHERE ────────────────────────────────────────────────
 *
 * Nothing that means anything on this screen is invented. The level name, the
 * clock, the served count, the three tickets, the takings, the queue, the
 * customers and their dishes, the stars, the chord owed now, the heat bar and
 * its line, the seconds left, the burner height, the pan, what is in it and
 * what goes in next, the combo, the chain and the total all come out of
 * `snapshot()`. The fingering comes from `diagram()` in the menu, which is
 * where the shapes live.
 *
 * The one thing that is scenery and nothing else is the CROWD: the people
 * standing behind the customers with a glass in their hand. They are drawn
 * from the level number alone (a fuller room as the service goes on) and they
 * are made to be told apart from a customer at a glance: darker, further
 * back, no bubble, no name, no stars. A face in the crowd that looked like an
 * order would be a lie, so none of them gets any of the three.
 *
 * ── WHAT A CUSTOMER'S BODY SAYS ──────────────────────────────────────────
 *
 * The seconds on the card are the number; the customer is the same number as
 * a posture. Plenty of time: their own habit (a phone, a chat, arms folded).
 * Under nine seconds: worried. Under five: leaning over the counter, fingers
 * drumming, brows down. Under two and a half: angry, and sweating. Served:
 * both arms up. Lost: arms folded, scowling, and gone.
 *
 * ── THE RULE YOU CAN SEE ─────────────────────────────────────────────────
 *
 * On every `strum` a note leaves the guitar for EACH pan that strum heated.
 * Two pans on the same chord, two notes. It is the greedy play of the game
 * (one strum feeds every pot that wants that chord) drawn rather than
 * explained. And on every cooked step the next ingredient leaves the side
 * plate and lands in the pan, so a pan half way through its recipe has half
 * its ingredients in it.
 *
 * ── THE BUDGET ───────────────────────────────────────────────────────────
 *
 * Sixty frames a second where the machine allows it and thirty where it does
 * not, one backdrop copy, cached sprites (people, pans, ingredients, stars,
 * tickets, notes), cached glyph atlases, no gradients and no shadows. Under
 * `prefers-reduced-motion` the flames stop flickering, the crowd stands still,
 * the cooks stop chopping and the steam stands still; the notes and the
 * falling ingredients still move, because they carry information.
 */

import { P, canvas, rect, plate, rrect, dither, blit, hash } from './art/pix.js';
import { text, measure, money } from './art/font.js';
import { seated, standing, crowd, cook, player, guitarGlow, PLAYER_STRINGS, PLAYER_GUITAR, FIGURE } from './art/people.js';
import {
  pan, panSurface, bitPos, steam, stars, ticket, clockIcon, plateIcon, dinnerPlate, sidePlate,
  drawIngredient, plated, note, COLD, ING,
} from './art/props.js';
import { buildBackdrop } from './art/backdrop.js';
import { GEO, slotX, slotCX } from './art/geo.js';
import { loadAtlas } from './art/atlas.js';
import { barLayout, stripLayout, chordBoxes, bubbleLayout, bubbleLines, coachText } from './art/hud.js';
import { chordSvg } from './art/chordsvg.js';
import { diagram, LEVELS, label } from './menu.js';
import { keyFor } from './input/keys.js';

/*
 * HOW OFTEN THE KITCHEN IS DRAWN.
 *
 * It was thirty a second, and measured at well under a millisecond a frame, so
 * the headroom was there and was being spent on nothing. A rhythm game is the
 * last place to leave half the frames on the table.
 *
 * What it is NOT is a gate that says "at least sixteen point seven milliseconds
 * since the last one". On a 144 Hz panel the browser offers a frame every 6.94
 * ms, and two of those are 13.9 while three are 20.8: the gate takes the third
 * one every time and the game runs at 48, which is worse than what it replaced.
 *
 * So the target is a WHOLE number of the panel's own frames — every frame at
 * 60 Hz, every second at 144 (72 a second), every fourth at 240 — chosen to
 * land as near sixty as that panel allows without ever landing under it. Even
 * spacing matters more here than hitting sixty exactly.
 */
const TARGET_MS = 1000 / 60;
const MAX_SKIP = 4;                  // one drawn frame in four, and no fewer
const BUDGET = 3;                    // a frame may cost a third of the time it has
/* The largest whole number the buffer is blown up by, and it was FOUR.
 *
 * Four is the wrong number on any screen that is not a plain one: a retina
 * panel showing the game 1200 CSS pixels wide wants five device pixels per
 * game pixel, 1440 wants six and a 4K one wants eight — and with the buffer
 * capped at four the browser was UPSCALING our own picture, with filtering,
 * to reach them. Measured across the sizes the game is played at, five of the
 * fourteen soft cases were this and nothing else: the display asked for a
 * whole number of pixels and the cap refused to give it. Eight costs a
 * 3840x2160 blit of one image per frame, which the frame budget in `tick`
 * measures and reports, and buys pixel-hard edges wherever the display wants
 * a whole number at all. */
const MAX_ZOOM = 8;
const LEVEL_MS = 60000;              // how long a service lasts; `t` counts up
const FLIGHT_MS = 460;               // a finished dish, from the pan to the counter
/* Eating, which is a beat of the game and not a flourish. The plate lands at
 * `FLIGHT_MS`, empties a piece at a time until `EAT_MS`, and the customer is
 * still in the chair for all of it; `GHOST_MS` adds the cheer and the hop off
 * the stool. `RULES.SEAT_DELAY_MS` in the engine is what keeps the place shut
 * until this is over, so the two numbers have to be read together. */
const EAT_MS = 1600;
const GHOST_MS = 2200;

/* Where the guitar sits inside the DRAWN cook, measured off `player.png` and
 * not guessed: the centroid of its orange body, taken below the shoulders so
 * that his ginger hair — the same orange, to within a shade — is not averaged
 * into the answer. The notes leave from here and the strings ring here.
 *
 * Re-measured every time the sprite is regenerated, because it has to be: the
 * cook has been 39x73, then 59x115, then 61x120, and is now a hand-drawn
 * 60x104 with the instrument in a different place every time — a number
 * carried over from the old one has the notes leaving from his elbow. */
const DRAWN_GUITAR = { x: 12, y: 67 };

/* Where the queue stands in the doorway: the front row first, so that
 * `queue[0]`, the next to be seated, is nearest the counter. Feet positions. */
const QUEUE_SPOTS = [
  [434, 108], [450, 108], [466, 108],
  [440, 100], [456, 100], [472, 100],
];

/* Where the crowd stands: two in front at every place, either side of the
 * stool, and three a step back, between. `depth` 1 is the back row. The order
 * they appear in as the room fills is decided once, from a hash, so the room
 * fills evenly instead of left to right. */
const CROWD_SPOTS = (() => {
  const out = [];
  for (let i = 0; i < GEO.SLOTS; i++) {
    const cx = slotCX(i);
    out.push({ x: cx - 30, foot: GEO.CROWD_FOOT, depth: 0 });
    out.push({ x: cx + 30, foot: GEO.CROWD_FOOT, depth: 0 });
    out.push({ x: cx - 15, foot: GEO.CROWD_BACK_FOOT, depth: 1 });
    out.push({ x: cx + 15, foot: GEO.CROWD_BACK_FOOT, depth: 1 });
    if (i > 0) out.push({ x: cx - 42, foot: GEO.CROWD_BACK_FOOT + 2, depth: 1 });
  }
  out.forEach((s, k) => { s.seed = 1000 + k * 7; s.order = hash(k, 3, 55); });
  out.sort((a, b) => a.order - b.order);
  return out;
})();
/* How many of them are in the room at each level; past the table, all. */
const CROWD_BY_LEVEL = [0, 4, 7, 10, 14, 18, 22];

export function createScene(container) {
  const { W, H } = GEO;

  /* ── mount ─────────────────────────────────────────────────────────────── */
  const root = document.createElement('div');
  root.className = 'kc-root';
  const stack = document.createElement('div');
  stack.className = 'kc-stack';
  const screen = document.createElement('canvas');
  screen.className = 'kc-screen';
  screen.setAttribute('aria-label', 'Fret Food');
  stack.appendChild(screen);
  root.appendChild(stack);
  container.appendChild(root);
  const sg = screen.getContext('2d');

  /**
   * The one layer that is not pixels: the chord diagrams.
   *
   * An SVG over the canvas, with the SAME coordinate system — its `viewBox` is
   * the game's 480 by 270 — so a box given in `GEO` units lands exactly where
   * the pixels expect it, and the browser draws it at the real resolution of
   * the screen. A fingering is the instruction, not scenery, and at three
   * pixels a digit the instruction was a smudge however big the smudge got.
   *
   * If it cannot be made, `chordBox` below still draws the pixel version, so
   * the game has a diagram either way.
   */
  const layer = (() => {
    try {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('class', 'kc-over');
      el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      el.setAttribute('preserveAspectRatio', 'none');
      el.setAttribute('aria-hidden', 'true');
      stack.appendChild(el);
      return el;
    } catch (_) { return null; }
  })();
  const back = canvas(W, H);
  const g = back.g;
  const backdrop = buildBackdrop();
  /* Drawn sprites, if any have been delivered. This answers `null` for
   * everything until the manifest and the images arrive, and for anything that
   * was never drawn, and the scene falls back to its own pixels for those. */
  const art = loadAtlas();

  const still = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; }
  })();

  let outW = W, outH = H;
  /* Whether the box is too small to read a fingering in. Below about 720 CSS
   * pixels a game pixel is one and a half screen pixels, the chips are five
   * of them tall and the finger numbers are guesses; the coach line says so,
   * because the game cannot make the window bigger and should not pretend. */
  let narrow = false;
  /**
   * How the 480 by 270 picture is put on the screen, and why it is not simply
   * stretched to the box.
   *
   * A pixel font only reads when every pixel is the same size. A canvas sized
   * to exactly fill its box usually is not: at 1.81 times, a stem is one device
   * pixel here and two there, and a letter three pixels wide loses a third of
   * its weight depending on where it happens to fall. Worse below 1, where
   * nearest-neighbour deletes whole rows and takes the crossbar off an A.
   *
   * So the buffer is blown up by a WHOLE number, which is even by
   * construction, and the browser is left to fit that image into the box. When
   * the whole number is the exact fit there is nothing left to fit and the
   * pixels stay hard; when it is not, the picture is scaled by a fraction with
   * filtering on, which costs a little softness and keeps every letter the same
   * weight. That is the trade a player can actually read.
   */
  function layout() {
    const bw = container.clientWidth || root.clientWidth || W;
    const bh = container.clientHeight || root.clientHeight || H;
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min((bw * dpr) / W, (bh * dpr) / H);
    /* HIT THE WHOLE NUMBER WHEN THERE IS ONE.
     *
     * `fit` is how many device pixels the display wants to give each game
     * pixel. When that is already a whole number — a 960 box at any ratio, a
     * 1200 box on a retina panel, 1440, 1920 — the buffer can be exactly that
     * size and every game pixel lands on a whole number of device pixels with
     * nothing left for the browser to interpolate. It used to round UP always,
     * which was right for the fractional cases and needlessly soft for the
     * exact ones the moment the ceiling of four stopped being reachable.
     *
     * Otherwise round up, so the buffer is never smaller than what is shown:
     * a browser downscaling our picture costs a little softness, and a browser
     * upscaling it costs a lot. */
    const whole = Math.abs(fit - Math.round(fit)) < 0.02 ? Math.round(fit) : Math.ceil(fit - 0.01);
    const k = Math.max(1, Math.min(MAX_ZOOM, whole));
    outW = W * k;
    outH = H * k;
    screen.width = outW;
    screen.height = outH;
    const cssW = Math.min(bw, (bh * W) / H);
    const cssH = (cssW * H) / W;
    screen.style.width = cssW + 'px';
    screen.style.height = cssH + 'px';
    // The vector layer rides on the canvas, so the box they share is sized
    // once and both of them fill it.
    stack.style.width = cssW + 'px';
    stack.style.height = cssH + 'px';
    narrow = cssW < 720;
    screen.style.imageRendering = Math.abs(cssW * dpr - outW) < 0.5 ? 'pixelated' : 'auto';
    sg.imageSmoothingEnabled = false;
  }
  layout();
  /* BOTH, and not one or the other.
   *
   * This was a `ResizeObserver` with a window-resize listener as the fallback
   * if the CONSTRUCTOR threw — which covers a browser that has no observer and
   * not the one that actually happens: an observer that exists, accepts
   * `observe()`, and never calls back. Measured in one such engine, a fresh
   * observer on the container fired zero times while the container went from
   * 900 pixels to 1085, so the picture kept the size it had at mount for the
   * rest of the session. Nothing on the screen says "this canvas stopped
   * listening"; it just quietly gets softer as the window moves away from the
   * size it was born at.
   *
   * `layout()` reads the box and writes the sizes, so calling it twice for one
   * change costs nothing and calling it once too often costs nothing either.
   * Two cheap sources of truth beat one that can go silent. */
  let ro = null;
  try {
    ro = new ResizeObserver(layout);
    ro.observe(container);
  } catch (_) { /* no observer here: the listener below is the whole story */ }
  window.addEventListener('resize', layout);

  /* ── state ─────────────────────────────────────────────────────────────── */
  let snap = null;
  /* Whether to print the key that plays each chord. On only when the KEYBOARD
   * is what is talking: with a guitar the letter on the card is the whole
   * instruction, and a key beside it would be noise. */
  let hints = false;
  const arrive = {};        // slot -> when the customer sat down
  const ghosts = {};        // slot -> the customer who just left, still drawn
  const flash = {};         // slot -> { kind, t0 }
  const cooked = {};        // slot -> when a step last cooked there
  const plates = {};        // slot -> { pan, ingredients, until } a dish on the counter
  const smoke = {};         // slot -> until: a ruined pan smokes
  const drops = {};         // slot -> { name, t0, x0, y0, x1, y1 } an ingredient in flight
  const shakes = {};        // slot -> when its card was last knocked about
  let notes = [];
  let flights = [];         // a finished dish on its way up to the counter
  let bursts = [];
  let floats = [];
  let banner = null;
  let over = null;
  let strumAt = -1e9;
  let comboAt = -1e9;
  let cookAt = -1e9;
  let chainLostAt = -1e9;
  let missAt = -1e9;

  /* ── what the game SAYS, over the picture ──────────────────────────────
   *
   * Three kinds of card lie over the scene and they are kept apart on purpose.
   * The BANNER is the level bell and belongs to the engine. A NOTICE is a
   * sentence or three the game owes the player at a moment — the keyboard is
   * on and these are its keys; that was a step under the line and this is what
   * it cost — queued, one at a time, and never over a banner. PAUSED is the
   * only one that stops the picture underneath it. */
  let notices = [];         // waiting: { lines, ms }
  let notice = null;        // showing: { lines, ms, t0 }
  let paused = null;        // { title, sub } while the service is held, else null
  /* THE OPTIONS PLATE: the layout `options.js` hands over while the service
   * is being chosen, `null` once it is. Nothing else the game says lands
   * while it is up — see `drawNotice`. */
  let menu = null;
  /* The coach speaks in the first service only. It is a flag the glue sets
   * from what it remembers, and the tips it has given are remembered here so
   * each is said once. */
  let coach = false;
  const taught = new Set();
  /* What the closing card prints besides the takings: the service number and
   * one line about the hand. */
  let closing = { seed: null, note: null };

  const now = () => performance.now();

  /* ── the loop ──────────────────────────────────────────────────────────── */
  let raf = 0;
  let last = 0;
  /* How long a frame takes on the main thread, smoothed and at worst. Not a
   * feature: it is how the four millisecond budget is checked from the console
   * instead of being asserted in a comment. */
  const stats = { frameMs: 0, worstMs: 0, frames: 0, notes: 0, fps: 60, every: 1, gapMs: TARGET_MS };
  let seen = 0;
  function tick(t) {
    raf = requestAnimationFrame(tick);
    // How fast this panel is, smoothed. A frame longer than a tenth of a second
    // is a stall or a tab coming back, and it is not evidence about the panel.
    if (last) {
      const gap = t - last;
      if (gap > 0 && gap < 100) stats.gapMs = stats.gapMs * 0.9 + gap * 0.1;
    }
    last = t;
    if (document.hidden || !snap) return;
    if (seen++ % stats.every) return;

    const t0 = performance.now();
    render(t);
    sg.drawImage(back.c, 0, 0, W, H, 0, 0, outW, outH);
    const ms = performance.now() - t0;
    stats.frames++;
    stats.frameMs = stats.frameMs ? stats.frameMs * 0.9 + ms * 0.1 : ms;
    if (ms > stats.worstMs) stats.worstMs = ms;

    /* How many of the panel's frames one drawn frame is worth. Normally the
     * whole number that puts the rate nearest sixty; more than that when a
     * frame is costing more than its share of the time it has, which is the
     * same rule at 60 Hz and at 144 and needs no list of machines. */
    if (stats.frames > 15) {
      let every = Math.max(1, Math.round(TARGET_MS / stats.gapMs));
      while (every < MAX_SKIP && stats.frameMs > (stats.gapMs * every) / BUDGET) every++;
      stats.every = every;
      stats.fps = Math.round(1000 / (stats.gapMs * every));
    }
  }
  raf = requestAnimationFrame(tick);

  /* ── the frame ─────────────────────────────────────────────────────────── */
  /**
   * A drawn sprite where there is one, and the coded sprite where there is not.
   *
   * Every person in this scene is now a generated sprite: the customers, the
   * crowd behind them and the two cooks at the pass. What the atlas gives back
   * is a rectangle inside a sheet, so the one thing this has to get right is
   * WHERE it lands — feet on a line, centred on a column — because a drawn
   * customer and a coded one are not the same height and never will be. Nothing
   * anywhere writes a sprite's size down twice.
   *
   * It returns the BOX it drew, or `null` when there was nothing to draw, so
   * the caller both falls back in one line and can hang something off the
   * sprite — a drop of sweat at the temple has to know where the head is, and
   * the head is in a different place on a drawn body than on a coded one.
   */
  function drawn(sheet, frame, cx, foot, o) {
    const f = art.frame(sheet, frame);
    if (!f) return null;
    const opt = o || {};
    const x = Math.round(cx - f.w / 2) + (opt.dx || 0);
    /* Feet on a line, unless the caller hangs it from the top instead. Almost
     * everybody stands: a customer, the crowd, the player. The two cooks at
     * the pass are the exception and it is the BAND that makes them one — see
     * `drawKitchen`, where the reason is written down. */
    const y = (opt.top === undefined ? foot - f.h : opt.top) + (opt.dy || 0);
    if (opt.alpha !== undefined) g.globalAlpha = opt.alpha;
    g.drawImage(f.img, f.sx, f.sy, f.w, f.h, x, y, f.w, f.h);
    if (opt.alpha !== undefined) g.globalAlpha = 1;
    /* The box is the CELL, and the cell is as wide as the widest sprite on
     * the sheet: a slim customer sits in the middle of a rectangle with air on
     * both sides. `body` is where the subject really is inside it, measured
     * off the sheet by the atlas, for whoever has to hang something off the
     * figure and not off its cell. */
    return { x, y, w: f.w, h: f.h, body: f.body || null };
  }

  /** The same, for a frame whose sheet the drawing does not care about: it is
   *  looked up by name across all of them. */
  function drawnAny(frame, cx, foot, o) {
    const f = art.find(frame);
    if (!f) return null;
    const opt = o || {};
    const x = Math.round(cx - f.w / 2) + (opt.dx || 0);
    const y = (opt.top === undefined ? foot - f.h : opt.top) + (opt.dy || 0);
    if (opt.alpha !== undefined) g.globalAlpha = opt.alpha;
    g.drawImage(f.img, f.sx, f.sy, f.w, f.h, x, y, f.w, f.h);
    if (opt.alpha !== undefined) g.globalAlpha = 1;
    return { x, y, w: f.w, h: f.h };
  }

  /** Which sheet a customer's face index comes from. `face` is the engine's own
   *  number and the sheets are named for it, so nothing has to be looked up. */
  const custSheet = (face) => 'cust-' + String((face % 12) + 1).padStart(2, '0');

  /* What the vector layer is currently showing, so it is rebuilt when the
   * chords change and not sixty times a second: five diagrams a frame would be
   * work nobody asked for, and a chord changes a few times a second at most. */
  let shownKey = '';
  function refreshChords(t) {
    if (!layer) return;
    const boxes = chordBoxes(snap, GEO, { compact: narrow });
    /* A card sliding out of the rail is clipped by the pixel layer and the
     * vector one is not, so the diagram waits for its card to land instead of
     * hanging in the air above it. */
    const landing = (i) => {
      const born = arrive[i];
      return !still && born !== undefined && t - born < 340;
    };
    const key = (narrow ? 'c|' : '') + boxes.map((b, i) => (b && !landing(i) ? b.chord : '-')).join('|');
    if (key === shownKey) return;
    shownKey = key;
    let markup = '';
    boxes.forEach((b, i) => {
      if (!b || landing(i)) return;
      const d = diagram(b.chord);
      if (d) markup += chordSvg(d, b);
    });
    try { layer.innerHTML = markup; } catch (_) { /* a drawing bug must not stop the service */ }
  }

  function render(t) {
    g.drawImage(backdrop, 0, 0);
    drawEvening();
    drawRoom(t);
    drawSign();
    drawBar(t);
    drawStrip(t);
    drawKitchen(t);
    drawFx(t);
    if (menu) drawMenu(t);
    if (banner) drawBanner(t);
    drawNotice(t);
    if (over) drawOver(t);
    if (paused) drawPause(t);
    refreshChords(t);
    // The closing card is a lid over the kitchen: the diagrams go under it.
    // A pause dims them with the rest of the picture.
    if (layer) layer.style.opacity = over ? '0' : paused ? '0.3' : '1';
  }

  /**
   * THE SIGN OVER THE DOOR, which the backdrop draws as an empty enamel plate
   * thirty by nine at `DOOR_X + 8, DOOR_Y - 1`. It says CLOSED until the first
   * chord, OPEN while the service runs, and CLOSED again when it is over: the
   * same fact the strip states in words, told the way a restaurant tells it,
   * and readable from the far side of the room.
   */
  function drawSign() {
    const open = snap.started !== false && !snap.over && !over;
    const cx = GEO.DOOR_X + 8 + 15;
    const y = GEO.DOOR_Y + 1;
    text(g, open ? 'OPEN' : 'CLOSED', cx, y, { font: 'S', color: open ? P.amber : P.greyLo, align: 'center' });
  }

  /**
   * THE EVENING. The place is a chain and a service is a day: the sky in the
   * doorway goes from morning to afternoon to dusk to night as the levels
   * pass, and from Dinner on the room dims and the lamps over the counter come
   * on. The backdrop is painted once with the night sky, so the earlier hours
   * are painted OVER it here, and the night is what is left when nothing is.
   * Nothing a player reads is touched: the people, the bubbles and the cards
   * are drawn after this.
   */
  const SKIES = [
    ['#8fc0f0', '#c8e4ff'],   // 1 Opening: morning
    ['#8fc0f0', '#c8e4ff'],   // 2 Lunch
    ['#a8c8e8', '#d8e8f8'],   // 3 Lunch Rush: the light flattens
    ['#e8b070', '#f8d0a0'],   // 4 Afternoon
    ['#d07050', '#f0a070'],   // 5 Happy Hour: dusk
  ];
  function drawEvening() {
    const level = Math.max(1, snap.level || 1);
    const { DOOR_X, DOOR_Y, DOOR_W } = GEO;
    const sky = SKIES[level - 1];
    if (sky) {
      // The sky through the door, over the baked night: twenty rows above the street.
      rect(g, DOOR_X, DOOR_Y, DOOR_W, 20, sky[0]);
      dither(g, DOOR_X, DOOR_Y + 12, DOOR_W, 8, sky[0], sky[1]);
      dither(g, DOOR_X, DOOR_Y + 20, DOOR_W, 4, sky[0], P.nightHi);
    }
    // From Dinner on the room dims a step a service, and the lamps come on.
    const dusk = Math.min(3, Math.max(0, level - 5));
    if (dusk > 0) {
      g.globalAlpha = 0.09 * dusk;
      rect(g, 0, GEO.ROOM_Y, GEO.RIGHT_X, GEO.COUNTER_Y - GEO.ROOM_Y, P.night);
      /* Each lamp is a bulb under the shelf and a CONE of light below it: four
       * bands, each wider and fainter than the one above, dithered so the
       * light keeps the grain of the picture. A single rectangle of light read
       * as a pane of frosted glass pasted on the wall. */
      for (const lx of [60, 150, 240, 330]) {
        g.globalAlpha = 0.9;
        rect(g, lx - 2, GEO.SHELF_Y + 1, 4, 2, P.lamp);
        for (let k = 0; k < 4; k++) {
          g.globalAlpha = (0.16 - 0.035 * k) * (0.6 + 0.13 * dusk);
          dither(g, lx - 5 - k * 4, GEO.SHELF_Y + 3 + k * 10, 10 + k * 8, 10, P.lamp, 'rgba(0,0,0,0)');
        }
      }
      g.globalAlpha = 1;
    }
  }

  /* ── the status bar ────────────────────────────────────────────────────── */

  /** One item off a layout, painted at the box the layout gave it. */
  function paintItem(it) {
    if (it.icon === 'clock') { clockIcon(g, it.x, it.y, it.color || P.white); return; }
    if (it.icon === 'plate') { plateIcon(g, it.x, it.y); return; }
    if (it.tickets) {
      for (let k = 0; k < it.tickets; k++) ticket(g, it.x + k * 11, it.y, k < it.alive);
      return;
    }
    text(g, it.s, it.x, it.y, { font: it.font, scale: it.scale, color: it.color || P.white, shadow: it.shadow });
  }

  /* Every plate up here is cut to what is written on it: see `hud.js`. This
   * function paints boxes it is handed and decides nothing about where they
   * go, which is why `SERVED 128` cannot walk off the end of its plate. */
  function drawBar() {
    const { panels, beam } = barLayout(snap, W, GEO, LEVEL_MS);
    for (const p of panels) {
      plate(g, p.x, p.y, p.w, p.h);
      for (const it of p.items) paintItem(it);
    }
    /* The name of the place, on a little enamel sign screwed to the beam.
     * Bare letters on the wood read as a word somebody forgot to translate;
     * a sign reads as the name of a restaurant, which is what it is. */
    if (beam) {
      plate(g, beam.x - 6, beam.y - 4, beam.w + 12, beam.h + 8, { border: P.amberLo, fill: P.woodInk });
      paintItem(Object.assign({}, beam, { color: P.gold, shadow: null }));
    }
  }

  /* ── the dining room ───────────────────────────────────────────────────── */

  /** What a customer's body is doing, from how long their pot has left. */
  function posture(i, st, t) {
    const since = arrive[i] === undefined ? 1e9 : t - arrive[i];
    if (since < 900) return { pose: 'rest', mood: 'happy' };
    if (t - (cooked[i] || -1e9) < 700) return { pose: 'rest', mood: 'thrilled' };
    const life = st.life === undefined ? 99 : st.life;
    const slow = still ? 0 : Math.floor(t / 1600 + i) % 2;
    const fast = still ? 0 : Math.floor(t / 260) % 2;
    if (life < 2.5) return { pose: 'lean', lean: true, mood: 'angry', frame: fast, sweat: true };
    if (life < 5) return { pose: 'lean', lean: true, mood: 'impatient', frame: fast };
    if (life < 9) return { pose: 'rest', mood: 'worried' };
    return { frame: slow };
  }

  function drawRoom(t) {
    const { COUNTER_Y, ROOM_Y, SEAT_FOOT, SLOT_W, RIGHT_X } = GEO;

    // The crowd, behind everything and under the counter. Scenery: how many
    // depends on the level and on nothing else.
    const n = Math.min(CROWD_SPOTS.length, CROWD_BY_LEVEL[Math.min(CROWD_BY_LEVEL.length - 1, Math.max(0, snap.level || 1))]);
    g.save();
    g.beginPath();
    /* To `RIGHT_X` and not four short of it: the rightmost standing spot is
     * the centre of the fifth place plus thirty, and a twenty-two wide patron
     * standing there reaches 419. Clipped at 416 the last person in the room
     * lost three columns off his shoulder — cut by a boundary nobody can see,
     * which is the one kind of cut that always reads as a bug. */
    g.rect(0, ROOM_Y, RIGHT_X, COUNTER_Y - ROOM_Y);
    g.clip();
    for (let d = 1; d >= 0; d--) {
      for (let k = 0; k < n; k++) {
        const sp = CROWD_SPOTS[k];
        if (sp.depth !== d) continue;
        const ph = hash(sp.seed, 1, 5);
        const frame = still ? 0 : Math.floor(t / (1300 + ph * 900) + ph * 9) % 2;
        const bob = still ? 0 : Math.floor(t / (800 + ph * 500) + ph * 3) % 2;
        /* Drawn scenery when there is any, and the coded crowd when there is
         * not.
         *
         * The back row used to be drawn at 0.55 and the FRONT row at 0.85, on
         * the idea that one sheet could stand for two distances. It cannot:
         * the wall behind them is brick, so at 0.55 the mortar lines run
         * straight through people's faces and at 0.85 they run faintly
         * through everybody. What that reads as is not depth, it is people
         * made of glass. Depth is already in the picture — the back row's feet
         * are eight rows higher and the front row is drawn over them — so the
         * dimming is gone and the only thing left of it is a touch off the
         * back row, small enough to sit under the brick instead of behind it. */
        /* By FRAME NAME across every sheet, because the twelve of them live on
         * two sheets now: six to a sheet is what makes a standing patron
         * sixty pixels tall instead of thirty-three, and which sheet a given
         * patron ended up on is a fact about a generation run. */
        const who = 'crowd-' + String(Math.floor(hash(sp.seed, 5, 31) * 12)).padStart(2, '0');
        if (!drawnAny(who, sp.x, sp.foot + bob, { alpha: sp.depth ? 0.92 : 1 })) {
          const spr = crowd(sp.seed, frame, sp.depth);
          blit(g, spr, sp.x - FIGURE.CX, sp.foot - spr.height + bob);
        }
      }
    }
    g.restore();

    /* The queue at the door, back row first, and CLIPPED TO THE DOORWAY.
     *
     * Six people forty-four pixels wide were being drawn between 434 and 472
     * on a screen that ends at 480, so the queue spanned 412 to 494 and the
     * last two in line were cut off by the edge of the world. A person cut by
     * the frame of the door they are standing in is a person in a doorway; the
     * same person cut by the side of the screen is a bug. Same pixels, and the
     * whole difference is whether something in the room did the cutting. */
    const q = snap.queue || [];
    g.save();
    g.beginPath();
    g.rect(GEO.DOOR_X, GEO.DOOR_Y, GEO.DOOR_W, COUNTER_Y - GEO.DOOR_Y);
    g.clip();
    for (let k = Math.min(q.length, QUEUE_SPOTS.length) - 1; k >= 0; k--) {
      const [sx, feet] = QUEUE_SPOTS[k];
      const ph = hash(k, 2, 9);
      const bob = still ? 0 : Math.floor(t / 700 + k) % 2;
      const pose = k === 0 ? 'stand' : ['stand', 'pocket', 'crossed', 'phone', 'talk', 'hips'][Math.floor(ph * 6)];
      const frame = still ? 0 : Math.floor(t / 1500 + k * 2) % 2;
      const spr = standing(q[k].face, { pose, frame, mood: k === 0 ? 'happy' : undefined });
      blit(g, spr, sx - FIGURE.CX, feet - spr.height + bob);
    }
    g.restore();

    // The customers, each clipped to its place so a customer rising from
    // behind the counter is hidden by it.
    for (let i = 0; i < GEO.SLOTS; i++) {
      const st = snap.stations[i];
      const cx = slotCX(i);
      g.save();
      g.beginPath();
      g.rect(slotX(i), ROOM_Y, SLOT_W, COUNTER_Y + 2 - ROOM_Y);
      g.clip();
      const ghost = ghosts[i];
      if (st && st.name) {
        const since = arrive[i] === undefined ? 1e9 : t - arrive[i];
        const p = Math.min(1, since / 420);
        const dy = Math.round((1 - ease(p)) * 44);
        const po = posture(i, st, t);
        /* The drawn customer is one pose, so the STATES are made here: a lean
         * over the counter when the pot is dying, and a faster bob. The art
         * gives a body and the code gives the performance, which is the same
         * split the cook is drawn under. */
        const lean = po.lean ? (Math.floor(t / 130) % 2 ? 1 : 0) : 0;
        let box = drawn(custSheet(st.face), 'wait', cx, SEAT_FOOT + dy, { dy: -lean, dx: lean });
        if (!box) {
          const spr = seated(st.face, po);
          blit(g, spr, cx - FIGURE.CX, SEAT_FOOT - spr.height + dy);
          box = { x: cx - FIGURE.CX, y: SEAT_FOOT - spr.height + dy, w: spr.width, h: spr.height };
        }
        if (po.sweat && !still) {
          /* A drop of sweat off the temple, falling — off whichever head is
           * actually there. Off the BODY, not the cell: the drawn customers
           * share a sheet whose cell is as wide as its widest figure, so the
           * drop hung four pixels in from the cell's edge, which on a slim
           * customer was a good ten pixels to the right of anybody's head. */
          const ph = (t / 500) % 1;
          const b = box.body;
          const tx = b ? box.x + Math.round(b.cx + b.w * 0.28) : box.x + box.w - 4;
          const ty = b ? box.y + b.top + 5 : box.y + 14;
          rect(g, tx, ty + Math.round(ph * 5), 1, 2, P.cyanHi);
        }
      } else if (ghost && t < ghost.until) {
        const p = (t - ghost.t0) / (ghost.until - ghost.t0);
        let dy = 0, dx = 0;
        let spr;
        if (ghost.mood === 'happy') {
          /* Eat, cheer, then down off the stool — in that order, and the order
           * is the fix. It used to hop for the first 45% of the window and
           * spend the other 55% leaving, which at the old window meant the
           * chair was empty before the food had finished arriving. */
          const eat = (EAT_MS - FLIGHT_MS) / GHOST_MS;
          const frame = still ? 0 : Math.floor(t / 140) % 2;
          if (p < eat) {
            // Still at the counter, leaning in over the plate, mouth full.
            spr = seated(ghost.face, { pose: 'lean', mood: 'happy', frame });
            dy = still ? 0 : Math.floor(t / 220) % 2;
          } else {
            const q = (p - eat) / (1 - eat);
            spr = seated(ghost.face, { pose: 'cheer', mood: 'cheer', frame });
            dy = q < 0.45 ? -Math.round(Math.sin((q / 0.45) * Math.PI) * 4) : Math.round(ease((q - 0.45) / 0.55) * 50);
          }
        } else {
          // Arms folded, fuming, then gone.
          spr = seated(ghost.face, { pose: 'crossed', mood: 'furious' });
          dy = p < 0.5 ? 0 : Math.round(ease((p - 0.5) / 0.5) * 50);
          dx = still ? 0 : (Math.floor(t / 70) % 2 ? 1 : -1);
          if (p < 0.5) smokePuffs(cx + 8, SEAT_FOOT - spr.height + 8, t, ghost.until, P.smoke);
        }
        if (!drawn(custSheet(ghost.face), ghost.mood === 'happy' ? 'happy' : 'angry',
          cx, SEAT_FOOT + dy, { dx })) {
          blit(g, spr, cx - FIGURE.CX + dx, SEAT_FOOT - spr.height + dy);
        }
      }
      g.restore();

      /* The plate on the counter in front of the place. It is empty until the
       * dish has actually arrived on it: the food is in the air between the
       * pan and here, and putting it on the plate as well would be two of it. */
      if (st) {
        const pl = plates[i];
        const landed = pl && t < pl.until && t - pl.t0 >= FLIGHT_MS;
        dinnerPlate(g, cx, COUNTER_Y + 2, landed ? eaten(pl, t) : null);
      }
    }

    // Speech bubbles last, over everything in the room.
    for (let i = 0; i < GEO.SLOTS; i++) {
      const st = snap.stations[i];
      if (!st || !st.name || !st.dish) continue;
      const since = arrive[i] === undefined ? 1e9 : t - arrive[i];
      if (since < 420) continue;
      bubble(i, st);
    }
  }

  /**
   * A plate part way through being eaten.
   *
   * The food goes a piece at a time, last on the plate first off it, over the
   * window between the plate landing and `EAT_MS`. It matters that it is the
   * INGREDIENTS that go and not the plate that fades: a dish disappearing in
   * one frame reads as the game taking it away, and a dish going down to an
   * empty plate reads as somebody eating it, which is the whole point of
   * holding the seat this long.
   */
  function eaten(pl, t) {
    const list = pl.ingredients || [];
    if (still || !list.length) return pl;
    const p = (t - pl.t0 - FLIGHT_MS) / Math.max(1, EAT_MS - FLIGHT_MS);
    const left = Math.max(0, Math.min(list.length, Math.ceil(list.length * (1 - p))));
    return left === list.length ? pl : { pan: pl.pan, ingredients: list.slice(0, left) };
  }

  /* The bubble is cut to what is in it — see `bubbleLayout`. A two-line dish
   * used to print its second line on the bubble's own last row, so every
   * descender on the menu sat on the outline. */
  function bubble(i, st) {
    // Cut by measured width, in a smaller font when the name will not go in
    // two lines of the bigger one: see `bubbleLines`.
    const { lines, font } = bubbleLines(st.dish, GEO);
    const b = bubbleLayout(st, i, GEO, lines, font);
    // The critic's bubble is edged in gold: the one customer worth recognising
    // from across the room, before reading a word.
    rrect(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, st.critic ? P.gold : P.ink, 2);
    rrect(g, b.x, b.y, b.w, b.h, P.paper, 1);
    // The tail, pointing at the head.
    const foot = b.y + b.h;
    const cx = b.cx;
    rect(g, cx - 3, foot, 7, 1, P.ink);
    rect(g, cx - 2, foot, 5, 1, P.paper);
    rect(g, cx - 2, foot + 1, 5, 1, P.ink);
    rect(g, cx - 1, foot + 1, 3, 1, P.paper);
    rect(g, cx - 1, foot + 2, 3, 1, P.ink);
    rect(g, cx, foot + 2, 1, 1, P.paper);
    rect(g, cx, foot + 3, 1, 1, P.ink);
    text(g, b.name.s, b.name.x, b.name.y, { font: 'S', color: st.critic ? P.amberLo : P.greyLo });
    // The stars on the right of the name: the soot, and nothing else.
    stars(g, b.stars.x, b.stars.y, b.stars.n, 5);
    for (const l of b.lines) text(g, l.s, l.x, l.y, { font: b.font, color: P.ink });
  }

  /* ── the strip ─────────────────────────────────────────────────────────── */
  function drawStrip(t) {
    const lost = t - chainLostAt < 450;
    /* The combo swells for a moment when it goes up. It is drawn from the
     * middle out so the two labels either side of it never move. */
    const since = t - comboAt;
    const pop = still || since > 260 ? 0 : Math.sin((1 - since / 260) * Math.PI) * 0.9;

    /* The coach line is decided here and not in the layout, because two of
     * the things it depends on are the drawing's to know: whether the keyboard
     * is what is talking and whether the window is too small to read in. The
     * legend for the keyboard takes turns with the rule, four seconds each. */
    const say = coachText(snap, { narrow, hints, alt: !still && Math.floor(t / 4000) % 2 === 1 });
    for (const it of stripLayout(snap, W, GEO, { coach: say }).items) {
      if (it.role === 'pips') {
        for (let k = 0; k < it.pips; k++) {
          rect(g, it.x + k * 7, it.y, 5, 6, P.ink);
          rect(g, it.x + 1 + k * 7, it.y + 1, 3, 4, lost ? P.red : k < it.lit ? P.amber : P.greyLo);
        }
        continue;
      }
      if (it.role === 'chain') { text(g, it.s, it.x, it.y, { font: 'M', color: lost ? P.red : P.amber }); continue; }
      if (it.role === 'coach') {
        // Urgent things are said in amber; the rule and the legend in grey.
        const urgent = snap.started === false || snap.silent;
        text(g, it.s, it.x, it.y, { font: 'S', color: urgent ? P.amber : P.grey });
        continue;
      }
      if (it.role === 'combo') {
        const d = Math.round(pop * 2);
        text(g, it.s, it.x + it.w / 2, it.y - d, {
          font: 'M', scale: 2, color: since < 220 ? P.gold : P.amber, align: 'center',
        });
        continue;
      }
      paintItem(it);
    }
  }

  /*
   * THE RULE, WRITTEN DOWN, where the eye already is — and now the rest of
   * what the game has to say.
   *
   * The middle of the strip has been four widgets. A beat meter, two dots and
   * a bar, for a rule the microphone could not measure. An instruction that
   * counted with you. The rule in four words beside a second heat bar for the
   * pot in most trouble — which was the third gauge on the screen for a fact
   * every card already shows twice, and the one thing it could not do was say
   * anything else. It is a LINE now, on the right of the strip where the total
   * used to be: `coachText` in `hud.js` decides what it says, and it is painted
   * with the rest of the strip's items. What it can say, and in what order of
   * urgency, is written there.
   */

  /* ── the kitchen ───────────────────────────────────────────────────────── */
  function drawKitchen(t) {
    const { PASS_Y, PAN_BASE_Y, STOVE_FRONT_Y, PLAYER_X, PLAYER_Y } = GEO;

    /*
     * TWO COOKS AT THE PASS, and the only figures on the screen that are hung
     * from the top of their band instead of stood on a line.
     *
     * The band is what makes them the exception. The kitchen starts at 134,
     * under the chain and combo strip, and the pass is at 162 with the chord
     * cards from 164: a cook standing behind that worktop has THIRTY ROWS to
     * be seen in. The coded cooks were thirty-two tall and fitted. The drawn
     * ones are fifty-six and forty-four, and stood on the pass the taller one
     * reached row 108 — straight through the strip and up into the dining
     * room, his hat over the combo counter. That is what "the cooks are on top
     * of the interface" was, and no amount of care in the sprite could have
     * fixed it, because the sprite was a whole standing cook and the room only
     * has room for a head.
     *
     * So they hang from the top of the kitchen and everything below the rail
     * is behind the cards, which are drawn next and are opaque. Both stand
     * inside a card's width on purpose — the backdrop already leaves the rail
     * bare between 100 and 152 and between 274 and 326 for them — so what is
     * cut off is cut off by a panel and not by an edge. Which is what a cook
     * behind a counter looks like.
     */
    const f0 = still ? 0 : Math.floor(t / 420) % 2;
    const f1 = still ? 0 : Math.floor(t / 560 + 1) % 2;
    // A bob rather than a chop: the drawn cooks are one pose each, so what
    // moves is the whole body, out of step with each other.
    /*
     * And the band is a CLIP, not a promise. It holds the cooks and the cards
     * both, because the cards need it too: one that has just opened slides
     * down into the rail from a card's height above it, and a card's height
     * above the rail is the chain and combo strip, so for the third of a
     * second a place opened an opaque panel crossed the interface. Clipped,
     * the same animation is a ticket dropping in from behind the hood — and
     * anything either of them grows by later is cut here instead of appearing
     * on top of the score.
     */
    g.save();
    g.beginPath();
    g.rect(0, GEO.KITCHEN_Y, GEO.W, GEO.KITCHEN_H);
    g.clip();

    /* Four rows above the band, and the clip takes them back. The sprites are
     * four rows taller than the band for exactly this: what those four rows
     * hold is the top of a hat, the strip is drawn before the cooks and cuts
     * it, and the thirty rows that remain hold a face and a chest instead of
     * a hat and an eyebrow. */
    const COOK_TOP = GEO.KITCHEN_Y - GEO.COOK_LIFT;
    const [cookA, cookB] = GEO.COOK_CX;
    /* Two of the twenty on the sheet, picked for what they are holding: the
     * pass reads as a working kitchen when one of them has a pan and the other
     * a spoon, and as a queue when they are both empty-handed. */
    if (!drawn('cooks', 'cook-10', cookA, 0, { top: COOK_TOP, dy: still ? 0 : -f0 })) {
      blit(g, cook(0, f0), cookA - FIGURE.COOK_W / 2, PASS_Y + 2 - FIGURE.COOK_H);
    }
    if (!drawn('cooks', 'cook-17', cookB, 0, { top: COOK_TOP, dy: still ? 0 : -f1 })) {
      blit(g, cook(1, f1), cookB - FIGURE.COOK_W / 2, PASS_Y + 2 - FIGURE.COOK_H);
    }

    for (let i = 0; i < GEO.SLOTS; i++) card(i, snap.stations[i], t);
    g.restore();

    // The pans and the stove front readouts.
    for (let i = 0; i < GEO.SLOTS; i++) {
      const st = snap.stations[i];
      const cx = slotCX(i);
      if (!st) continue;
      // The burner gauge: how high the flame is, in bars.
      const lit = Math.max(1, Math.min(5, Math.round((st.burner || 2.4) - 1.5)));
      for (let k = 0; k < 5; k++) {
        const bh = 2 * (k + 1);
        rect(g, cx + 29 + k * 3, STOVE_FRONT_Y + 11 - bh, 2, bh, k < lit ? (k >= 3 ? P.red : P.fireHi) : P.steelInk);
      }
      if (!st.dish) {
        if (smoke[i] && t < smoke[i]) smokePuffs(cx, PAN_BASE_Y - 8, t, smoke[i], P.smoke);
        continue;
      }
      const drop = drops[i] && t - drops[i].t0 < 460 ? drops[i] : null;
      const s = pan(g, cx, PAN_BASE_Y, st.pan, {
        soot: st.soot, inPan: st.inPan, heat: st.heat, burner: st.burner, t, still,
        hide: drop ? drop.name : null,
        /* `find` and not `frame`: a pan is looked up by its name across every
         * sheet, because which sheet a given pan ended up on is a fact about a
         * generation run and not about the game. Nothing here for a pan that
         * has not been drawn, and the coded vessel takes over. */
        sprite: art.find(st.pan),
      });
      // The side plate by the burner with what goes in next.
      sidePlate(g, cx - 34, PAN_BASE_Y - 2, drop ? null : st.nextIn);
      if (drop) drawDrop(drop, t);
      if (st.ready) steam(g, cx, s.y - 1, t, COLD.has(st.pan), still);
      const fl = flash[i];
      if (fl && fl.kind === 'dirty' && t - fl.t0 < 500) smokePuffs(cx, s.y - 2, t, fl.t0 + 500, P.smoke);
      /* Stars and what the dish PAYS NOW on the stove front, under the pan.
       * The tag printed the list price, a number the till never paid: the
       * dish goes out at the price times the multiplier, plus the tip while
       * the pot is clean. `worth` is that sum, so the tag falls with a lost
       * star and climbs with the chain, and the number the player reads when
       * choosing which pot to save is the number that arrives. Gold, like
       * every sum of money on the screen. */
      plate(g, cx - 26, STOVE_FRONT_Y + 2, 52, 12, { hi: false });
      stars(g, cx - 22, STOVE_FRONT_Y + 5, st.stars, 5);
      const worth = st.worth === undefined ? st.price : st.worth;
      text(g, '$' + worth, cx + 22, STOVE_FRONT_Y + 5, { font: 'S', color: P.gold, align: 'right' });
    }

    drawPlayer(t);
  }

  /**
   * THE COOK WITH THE GUITAR.
   *
   * He is a drawn sprite when one has been delivered and a coded one when it
   * has not, and the two are not the same size, so nothing about where he
   * stands is written twice: feet on `PLAYER_FOOT`, centred on `PLAYER_CX`,
   * whatever he happens to be.
   *
   * The model that draws him gives one pose and no way to ask for a second, so
   * everything he DOES is here: the bob on the strum, the hop when something
   * comes off the fire, the guitar glowing on the beat and the strings ringing
   * across the body. A drawn body and a coded performance is the honest split
   * between what a picture is good at and what code is.
   */
  function drawPlayer(t) {
    const strumming = t - strumAt < 130;
    const hop = t - cookAt < 260 ? -Math.round(Math.sin(((t - cookAt) / 260) * Math.PI) * 3) : 0;
    const bob = (strumming && !still ? 1 : 0) + (still ? 0 : hop);
    const drawn = art.frame('player', 'idle');
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(t / 300);

    if (drawn) {
      const x = Math.round(GEO.PLAYER_CX - drawn.w / 2);
      const y = GEO.PLAYER_FOOT - drawn.h + bob;
      // Where the guitar is inside him, measured off the sprite itself.
      const gx = x + DRAWN_GUITAR.x;
      const gy = y + DRAWN_GUITAR.y;
      g.globalAlpha = 0.10 + 0.12 * pulse + (strumming ? 0.30 : 0);
      const r = strumming ? 5 : 4;
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
        rect(g, gx - 9 + dx, gy - 8 + dy, 18, 16, P.cyan);
      }
      g.globalAlpha = 1;
      g.drawImage(drawn.img, drawn.sx, drawn.sy, drawn.w, drawn.h, x, y, drawn.w, drawn.h);
      if (strumming) {
        rect(g, gx - 8, gy - 1, 17, 1, P.cyanHi);
        rect(g, gx - 6, gy + 1, 13, 1, P.cyan);
      }
      if (t - missAt < 400) {
        text(g, '?', x + drawn.w + 2, y + 4, { font: 'M', scale: 2, color: P.grey, outline: P.ink });
      }
      return;
    }

    const mood = strumming ? 'sing' : t - missAt < 450 ? 'oops' : t - cookAt < 500 ? 'thrilled' : 'happy';
    const spr = player(strumming ? 1 : 0, mood);
    const px = Math.round(GEO.PLAYER_CX - spr.width / 2);
    const py = GEO.PLAYER_FOOT - spr.height + bob;
    const glow = guitarGlow();
    g.globalAlpha = 0.18 + 0.2 * pulse + (strumming ? 0.35 : 0);
    const r = strumming ? 4 : 3;
    for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r + 1, -r + 1], [r - 1, -r + 1], [-r + 1, r - 1], [r - 1, r - 1]]) {
      blit(g, glow, px + PLAYER_GUITAR.x + dx, py + PLAYER_GUITAR.y + dy);
    }
    g.globalAlpha = 1;
    blit(g, spr, px, py);
    if (strumming) {
      const sy = py + PLAYER_STRINGS.y;
      rect(g, px + PLAYER_GUITAR.x + 8, sy - 1, 20, 1, P.cyanHi);
      rect(g, px + PLAYER_GUITAR.x + 10, sy + 1, 16, 1, P.cyan);
    }
    if (t - missAt < 400) {
      text(g, '?', px + PLAYER_STRINGS.x - 6, py + 2, { font: 'M', scale: 2, color: P.grey, outline: P.ink });
    }
  }

  /** An ingredient in flight from the side plate to the pan, in an arc, with
   *  a splash when it lands. */
  function drawDrop(d, t) {
    const p = Math.min(1, (t - d.t0) / 400);
    if (p < 1) {
      const x = d.x0 + (d.x1 - d.x0) * p;
      const arc = Math.sin(p * Math.PI) * 18;
      const y = d.y0 + (d.y1 - d.y0) * p - arc;
      drawIngredient(g, d.name, x, y);
    } else {
      // The splash: a few pixels of the pan's colour flying up.
      const q = (t - d.t0 - 400) / 60;
      const col = d.base || P.steam;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI + 0.3;
        rect(g, d.x1 + Math.cos(a) * (2 + q * 4) - 1, d.y1 - Math.sin(a) * (2 + q * 3) - 1, 2, 1, col);
      }
    }
  }

  function smokePuffs(cx, topY, t, until, col) {
    for (let k = 0; k < 3; k++) {
      const ph = ((t / 700) + k / 3) % 1;
      const y = topY - Math.round(ph * 14);
      const x = cx - 6 + k * 5 + Math.round(Math.sin((ph + k) * 5) * 2);
      g.globalAlpha = 0.8 * (1 - ph);
      rect(g, x, y, 4, 3, col);
      rect(g, x + 1, y - 1, 2, 1, col);
      g.globalAlpha = 1;
    }
  }

  /* ── one chord card ────────────────────────────────────────────────────── */
  /**
   * The chord card, and the two things it does that are not standing still.
   *
   * It SLIDES OUT from behind the rail when an order arrives, so a new order
   * is something that happens rather than something that is suddenly there —
   * five cards changing between one frame and the next is the single easiest
   * way to miss that the counter moved.
   *
   * And it is KNOCKED about when its pan is spoiled or its customer walks:
   * one pixel of jitter and a jolt, which says WHICH pan went wrong, which a
   * flash on the whole screen cannot. One pixel is also all the room the card
   * has inside its place, so the jitter can never write into the next card.
   *
   * Both are clipped to the place they belong to, and both stop under
   * `prefers-reduced-motion`.
   */
  function card(i, st, t) {
    const { CARD_Y, CARD_W, CARD_H, SLOT_W } = GEO;
    const born = arrive[i];
    const slide = !still && born !== undefined && t - born < 340
      ? Math.round((1 - ease((t - born) / 340)) * (CARD_H + 4)) : 0;
    /* Never, and not zero: `performance.now()` starts at zero too, so a zero
     * here would knock every card about for the first frames of a game that
     * was mounted quickly enough. */
    const knock = shakes[i] === undefined ? -1e9 : shakes[i];
    const age = t - knock;
    const jolt = !still && age < 420 ? (1 - age / 420) : 0;
    const x = slotX(i) + 2 + (jolt ? (Math.floor(t / 45) % 2 ? 1 : -1) * Math.round(jolt) : 0);
    const y = CARD_Y - slide + Math.round(jolt * Math.sin(age / 32) * 2);

    if (slide || jolt) {
      g.save();
      g.beginPath();
      g.rect(slotX(i), CARD_Y, SLOT_W, CARD_H);
      g.clip();
      drawCard(i, st, t, x, y);
      g.restore();
      return;
    }
    drawCard(i, st, t, x, y);
  }

  function drawCard(i, st, t, x, y) {
    const { CARD_W, CARD_H } = GEO;

    if (!st) {
      plate(g, x, y, CARD_W, CARD_H, { border: P.frameLo, fill: P.ink, hi: false });
      const mid = x + CARD_W / 2;
      /* The place that is next to open counts itself in, because it is about
       * to happen and the player can plan for it. The ones after it name the
       * level that brings them, which is the only true thing there is to say:
       * they are on a clock that has not started yet.
       *
       * This card used to say "OPENS AT OPENING" for the second place — the
       * level the player was already in — because it read the level table for
       * a schedule that is no longer kept there. */
      /* Every place this level already allows counts itself in, not only the
       * next one: they open one after another, `openEvery` apart, so the third
       * of three knows its time from the first's. Naming the level for a place
       * the level has already rung for said `OPENS AT LATE DINNER` on Saturday
       * night. */
      const allowed = snap.allowed === undefined ? snap.stations.length + 1 : snap.allowed;
      const next = i >= snap.stations.length && i < allowed && snap.placeIn !== null && snap.placeIn !== undefined;
      if (next) {
        text(g, 'OPENS IN', mid, y + 16, { font: 'S', color: P.grey, align: 'center' });
        const wait = snap.placeIn + (i - snap.stations.length) * (snap.openEvery || 30000);
        const secs = Math.ceil(wait / 1000);
        text(g, String(secs), mid - 6, y + 24, { font: 'M', scale: 2, color: P.amber, align: 'center' });
        text(g, 'SEC', mid + 16, y + 33, { font: 'S', color: P.grey, align: 'center' });
        return;
      }
      text(g, 'CLOSED', mid, y + 18, { font: 'M', color: P.greyLo, align: 'center' });
      // A place past the counter's ceiling (the picker's choice) never opens,
      // and a card that named a level for it would be promising one.
      const cap = snap.maxStations === undefined ? GEO.SLOTS : snap.maxStations;
      const opens = i < cap ? LEVELS.find((l) => l.stations > i) : null;
      if (opens) {
        text(g, 'OPENS AT', mid, y + 30, { font: 'S', color: P.greyLo, align: 'center' });
        text(g, opens.name.toUpperCase(), mid, y + 38, { font: 'S', color: P.greyLo, align: 'center' });
      }
      return;
    }

    const fl = flash[i];
    const hit = fl && t - fl.t0 < 140 ? fl.kind : null;
    /* Before the first chord the kitchen is waiting, and the one card on the
     * counter says so by breathing: amber and gold in turn, the same two
     * colours the cooked step and the price use, so nothing new has to be
     * learnt to read it. */
    const waiting = snap.started === false;
    const breathe = waiting && !still && Math.floor(t / 400) % 2 === 1;
    const border = waiting ? (breathe ? P.gold : P.amber)
      : st.ready ? P.amber : hit === 'cook' ? P.green : hit === 'dirty' ? P.smoke : P.frame;
    plate(g, x, y, CARD_W, CARD_H, { border });

    if (!st.dish) {
      text(g, 'FREE', x + CARD_W / 2, y + 20, { font: 'M', color: P.grey, align: 'center' });
      text(g, 'NEXT GUEST SOON', x + CARD_W / 2, y + 32, { font: 'S', color: P.greyLo, align: 'center' });
      return;
    }

    /* The recipe as chips: done, owed now, still to come. The one that has
     * just been cooked keeps its green for a moment and is lifted a pixel, so
     * the progress of the recipe is something you SEE advance rather than
     * something you notice has advanced. */
    // No chips in a narrow window: the diagram takes their rows (see
    // `chordBoxes`), because the instruction outranks the progress.
    const n = narrow ? 0 : st.steps.length;
    const chipW = Math.min(18, Math.floor((CARD_W - 6 - (n - 1)) / Math.max(1, n)));
    const rowW = n * chipW + (n - 1);
    const fresh = !still && t - (cooked[i] || -1e9) < 420 ? st.step - 1 : -1;
    let cxp = x + Math.floor((CARD_W - rowW) / 2);
    for (let k = 0; k < n; k++) {
      const done = k < st.step;
      const cur = k === st.step;
      const lift = k === fresh ? -1 : 0;
      const cy = y + 3 + lift;
      rect(g, cxp, cy, chipW, 8, cur ? P.gold : k === fresh ? P.greenHi : P.ink);
      rect(g, cxp + (cur ? 1 : 0), cy + (cur ? 1 : 0), chipW - (cur ? 2 : 0), 8 - (cur ? 2 : 0),
        done ? P.greenLo : cur ? P.amber : P.plateHi);
      // Not uppercased: `Am` is a chord and `AM` is a different one, and the
      // small font grew a lowercase m so that this line could stop shouting.
      // A name wider than its chip — `Cadd9` in a chip cut for `Am` — keeps
      // its root and drops the rest: the chip is progress, the card below is
      // the instruction, and a root in the right place beats a smear.
      const step = label(st.steps[k]);
      const shown = measure(step, 'S') <= chipW ? step : (/^[A-G][#b]?/.exec(step) || [step])[0];
      text(g, shown, cxp + chipW / 2, cy + 2, {
        font: 'S', color: done ? P.greenHi : cur ? P.ink : P.grey, align: 'center',
      });
      cxp += chipW + 1;
    }

    /* The chord owed now, big; and how many pans want it. It jumps a pixel on
     * the strum that lands on it: with five cards up, that is how you see
     * which of them your last chord actually fed. */
    const wantsColor = hit === 'hit' ? P.white : hit === 'dirty' ? P.smoke : P.amber;
    const punch = !still && fl && t - fl.t0 < 120 ? 1 : 0;
    drawChordName(st.wants || '', x + 4, y + 13 - punch, wantsColor);

    // How many pans want this same chord: the greedy play, and the row below
    // says it in words.
    const together = snap.stations.filter((o) => o && o.dish && o.wants === st.wants).length;
    /* The small `x2` that used to sit beside the chord is gone: the row below
     * says `2 POTS`, and the same fact written twice an inch apart reads as
     * two facts. */

    /* The key that plays it, on a keyboard service. `^` is Shift, which is how
     * the capitals are reached. */
    if (hints) {
      const k = keyFor(st.wants);
      /* Beside the chord when the chord leaves room, and under it when it does
       * not: `F#m` at double size runs to `x + 38`, and a `^F` printed at
       * `x + 28` landed on its last letter. Below, it takes the right end of
       * the `2 POTS` row, which that label never reaches. */
      const wide = measure(st.wants || '', 'M', 2) > 23;
      if (k && !wide) text(g, k, x + 28, y + 22, { font: 'S', color: P.greyHi });
      if (k && wide) text(g, k, x + 38 - measure(k, 'S'), y + 28, { font: 'S', color: P.greyHi });
    }

    /* HOW MANY POTS WANT THIS CHORD, in the row the pips used to have.
     *
     * The pips were one per strum the step asked for, and they were the rule
     * made visible while the rule was a count. A step is one chord now — there
     * is nothing to count and nothing to draw — so the row goes to the only
     * other thing a player has to notice and cannot work out from one card:
     * that the chord in front of them is wanted somewhere else too. One chord
     * cooks every pot that wants it, which makes that the best-paid move on
     * the counter, and it was previously a two-character hint in the corner.
     */
    if (together > 1) {
      /* In the LEFT column, like everything else on this side of the card: the
       * chord diagram owns from `x + 40` and it is opaque, so a label written
       * across the whole card disappears under it — which is exactly what the
       * first version of this row did. `2 POTS` fits in what is left, and the
       * chord it wants is the big letter directly above. */
      const label = together + ' POTS';
      rect(g, x + 3, y + 27, measure(label, 'S') + 4, 7, P.ink);
      text(g, label, x + 5, y + 28, { font: 'S', color: P.cyanHi });
    }

    /* The diagram, on the vector layer when there is one, because it is the
     * panel a player has to READ. The pixel version is what is left if the
     * layer could not be made. */
    const d = diagram(st.wants);
    if (d && !layer) chordBox(x + 38, y + 12, d);

    /* Seconds left: the one number a player decides on, and it is ALWAYS on
     * the card.
     *
     * It used to blink by NOT BEING DRAWN every other hundred and eighty
     * milliseconds, and under three seconds that is half of the only moment
     * the number matters: the card showed a chord, a fingering and no clock,
     * and the first thing anyone asked looking at a card in that state was
     * where the time had gone. A number that has to shout changes COLOUR. It
     * does not leave the card. */
    const life = Math.max(0, st.life || 0);
    const secs = Math.ceil(life);
    const urgent = life < 3;
    const pulse = urgent && !still && Math.floor(t / 180) % 2 === 1;
    if (waiting) {
      /* No clock is running, so no clock is shown: the row says PLAY, in the
       * same breath as the border, and the card explains itself without the
       * strip. A grey `11 SEC` here read as a clock that had stopped. */
      /* At single size: the left column is thirty-four pixels wide and PLAY
       * at double size is forty-six, so the diagram's board — opaque, and on
       * the layer above — took the Y off it. Two lines of what fits instead. */
      text(g, 'PLAY', x + 4, y + 34, { font: 'M', color: breathe ? P.gold : P.amber });
      text(g, 'TO OPEN', x + 4, y + 43, { font: 'S', color: P.grey });
    } else {
      const lifeColor = urgent ? (pulse ? P.white : P.redHi) : life > 6 ? P.white : P.amber;
      text(g, String(secs), x + 4, y + 34, { font: 'M', scale: 2, color: lifeColor });
      text(g, 'SEC', x + 6 + measure(String(secs), 'M', 2), y + 43, { font: 'S', color: P.grey });
    }

    // The heat bar with the line it has to clear.
    const bx = x + 4, by = y + 49, bw = CARD_W - 8, bh = 5;
    rect(g, bx, by, bw, bh, P.ink);
    rect(g, bx + 1, by + 1, bw - 2, bh - 2, P.plateHi);
    const fillW = Math.round((bw - 2) * (st.heatPct / 100));
    const fillColor = st.ready ? (Math.floor(t / 200) % 2 || still ? P.greenHi : P.green) : P.green;
    rect(g, bx + 1, by + 1, fillW, bh - 2, fillColor);
    rect(g, bx + 1, by + 1, fillW, 1, P.greenHi);
    const tickX = bx + 1 + Math.round((bw - 2) * (st.readyPct / 100));
    rect(g, tickX, by - 1, 1, bh + 2, P.white);
    /* And the word on the bar, which is a PRICE and not a wall.
     *
     * The bar has been a heat gauge, and under the line it meant the rest
     * would cook nothing — so the word there was `HEAT`, a refusal. Under the
     * line the step still cooks and the dish is spoiled, so what the word has
     * to say is what playing it now COSTS: one star. Above the line there is
     * nothing to warn anybody about, so nothing is said. */
    if (!st.ready) {
      text(g, '-1 STAR', bx + bw / 2, by, { font: 'S', color: P.redHi, align: 'center', outline: P.ink });
    }
  }

  /**
   * THE CHORD BOX: six strings, the nut, three frets, and a numbered dot
   * wherever a finger goes.
   *
   * It was 32 wide with 5 pixels between strings, and at that pitch two fingers
   * on neighbouring strings are two blobs with no gap between them and a digit
   * inside each that nobody can read. This is the thing the player looks at to
   * know what to PLAY, so it gets the room:
   *
   *   - Three frets, not four. The widest shape this game asks for is F, and
   *     nothing in it reaches past the third fret, so the fourth was an empty
   *     row paid for out of the height of the other three.
   *   - Six pixels between strings instead of five, which is a whole pixel of
   *     air between two dots that used to touch.
   *   - Nine pixels between frets instead of seven, so a dot sits in the middle
   *     of its box instead of filling it.
   *   - The dot is gold with a black rim and the digit is punched out of it in
   *     ink, which is the highest contrast this palette has.
   *
   * 38 wide, 36 tall, at (dx, dy).
   */
  function chordBox(dx, dy, d) {
    const STRING = 6, FRETS = 3, FRET_H = 9;
    const sx = (k) => dx + 4 + k * STRING;        // string 6 (low E) at the left
    const left = sx(0);
    const right = sx(5);
    const top = dy + 7;
    const boardH = FRETS * FRET_H;

    // A dark board behind it, so the strings read on a card of any colour.
    rect(g, left - 3, top - 2, right - left + 7, boardH + 4, P.ink);

    // Open and muted markers over the nut.
    d.strings.forEach((st, k) => {
      const cx = sx(k);
      if (st.muted) {
        rect(g, cx - 2, dy, 1, 1, P.redHi); rect(g, cx + 2, dy, 1, 1, P.redHi);
        rect(g, cx - 1, dy + 1, 1, 1, P.redHi); rect(g, cx + 1, dy + 1, 1, 1, P.redHi);
        rect(g, cx, dy + 2, 1, 1, P.redHi);
        rect(g, cx - 1, dy + 3, 1, 1, P.redHi); rect(g, cx + 1, dy + 3, 1, 1, P.redHi);
        rect(g, cx - 2, dy + 4, 1, 1, P.redHi); rect(g, cx + 2, dy + 4, 1, 1, P.redHi);
      } else if (st.open) {
        rect(g, cx - 1, dy, 3, 1, P.cyanHi);
        rect(g, cx - 2, dy + 1, 1, 3, P.cyanHi); rect(g, cx + 2, dy + 1, 1, 3, P.cyanHi);
        rect(g, cx - 1, dy + 4, 3, 1, P.cyanHi);
      }
    });

    // The frets first, then the strings over them: a string is continuous and
    // a fret is what it crosses, and drawing it the other way round looks like
    // a ladder rather than a neck.
    for (let f = 1; f <= FRETS; f++) rect(g, left - 2, top + f * FRET_H, right - left + 5, 1, P.greyLo);
    for (let k = 0; k < 6; k++) rect(g, sx(k), top, 1, boardH, k < 3 ? P.greyHi : P.grey);
    rect(g, left - 2, top - 2, right - left + 5, 2, P.white);      // the nut

    // The fingers, last and brightest.
    d.strings.forEach((st, k) => {
      if (st.fret <= 0) return;
      const cx = sx(k);
      const cy = top + (st.fret - 1) * FRET_H + Math.floor(FRET_H / 2);
      rrect(g, cx - 3, cy - 3, 7, 7, P.ink, 1);
      rrect(g, cx - 2, cy - 2, 5, 5, P.gold, 1);
      rect(g, cx - 1, cy - 2, 3, 1, P.white);
      if (st.finger) text(g, String(st.finger), cx - 1, cy - 2, { font: 'S', color: P.ink });
    });
  }

  /* ── effects ───────────────────────────────────────────────────────────── */
  /**
   * The chord owed, in the card's left column. The column is thirty-six
   * pixels and was cut for three glyphs: `F#m` at the M font doubled is
   * thirty-four. `Cadd9` and `Asus4` are five, and doubled they run under
   * the diagram. So a name wider than the column is written the way a chord
   * book writes it — the root big, the rest small at its shoulder — and the
   * name is the shape's LABEL, so the two Fs both say F and the fingering
   * tells them apart, which is what a fingering is for.
   */
  function drawChordName(name, x, y, color) {
    const s = label(name);
    if (measure(s, 'M', 2) <= 36) { text(g, s, x, y, { font: 'M', scale: 2, color }); return; }
    const m = /^([A-G][#b]?)(.*)$/.exec(s) || [s, s, ''];
    const w = text(g, m[1], x, y, { font: 'M', scale: 2, color });
    text(g, m[2], x + w + 1, y, { font: 'M', color });
  }

  function drawFx(t) {
    // Notes in flight, from the guitar to the pans it heated.
    notes = notes.filter((n) => {
      const p = (t - n.t0) / n.dur;
      if (p >= 1) {
        bursts.push({ x: n.x1, y: n.y1, t0: t, dur: 320, color: n.color });
        return false;
      }
      const q = ease(p);
      const mx = (n.x0 + n.x1) / 2;
      const my = Math.min(n.y0, n.y1) - n.arc;
      const x = (1 - q) * (1 - q) * n.x0 + 2 * (1 - q) * q * mx + q * q * n.x1;
      const y = (1 - q) * (1 - q) * n.y0 + 2 * (1 - q) * q * my + q * q * n.y1;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) note(g, x - 2 + dx, y - 3 + dy, P.ink, n.double);
      note(g, x - 2, y - 3, n.color, n.double);
      // A short trail behind it.
      const q2 = ease(Math.max(0, p - 0.08));
      const x2 = (1 - q2) * (1 - q2) * n.x0 + 2 * (1 - q2) * q2 * mx + q2 * q2 * n.x1;
      const y2 = (1 - q2) * (1 - q2) * n.y0 + 2 * (1 - q2) * q2 * my + q2 * q2 * n.y1;
      rect(g, x2, y2, 2, 2, n.color);
      return true;
    });
    // Bursts: six sparks flying out.
    bursts = bursts.filter((b) => {
      const p = (t - b.t0) / b.dur;
      if (p >= 1) return false;
      const r = 2 + p * 9;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + (b.spin || 0);
        rect(g, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r * 0.6, 2, 2, b.color);
      }
      return true;
    });
    /* A finished dish on its way up to the counter.
     *
     * The kitchen is drawn below the room because that is where the player
     * stands, so a dish being passed up to a customer travels up the screen,
     * over the cards and the strip, which is why it is drawn here with the
     * effects and not with the room. It is the one moment that joins the two
     * halves of the picture: before this, a dish left a pan in one place and
     * appeared on a plate in another with nothing in between. */
    flights = flights.filter((f) => {
      const p = (t - f.t0) / FLIGHT_MS;
      if (p >= 1) return false;
      const q = ease(p);
      const x = f.x0 + (f.x1 - f.x0) * q;
      const y = f.y0 + (f.y1 - f.y0) * q - Math.sin(p * Math.PI) * 22;
      dinnerPlate(g, x, y, null);
      plated(g, x, y, f.pan, f.ingredients);
      return true;
    });

    // Floating words and money.
    floats = floats.filter((f) => {
      const p = (t - f.t0) / f.dur;
      if (p >= 1) return false;
      const y = f.y - Math.round(ease(p) * 14);
      g.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      text(g, f.text, f.x, y, { font: f.font || 'M', scale: f.scale || 1, color: f.color, align: 'center', outline: P.ink });
      g.globalAlpha = 1;
      return true;
    });
  }

  function drawBanner(t) {
    const p = (t - banner.t0) / 2400;
    if (p >= 1) { banner = null; return; }
    const a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
    g.globalAlpha = a;
    /* Thirty-eight, not thirty-four: the third row is printed at `y + 28` in a
     * font five tall and the plate's own border takes the last two rows, so
     * at thirty-four "2 PLACES OPEN" sat half under the frame. */
    const w = 200, h = 38;
    const x = Math.round(W / 2 - w / 2), y = 62;
    plate(g, x, y, w, h, { border: P.amber });
    text(g, 'LEVEL ' + banner.level, W / 2, y + 5, { font: 'S', color: P.amber, align: 'center' });
    text(g, banner.name.toUpperCase(), W / 2, y + 13, { font: 'M', scale: 2, color: P.white, align: 'center' });
    // A perfect service takes the third row: it is the better news.
    if (banner.perfect) text(g, 'PERFECT SERVICE +' + money(banner.perfect), W / 2, y + 28, { font: 'S', color: P.gold, align: 'center' });
    else if (banner.stations) text(g, banner.stations + ' PLACES OPEN', W / 2, y + 28, { font: 'S', color: P.grey, align: 'center' });
    g.globalAlpha = 1;
  }

  /**
   * A NOTICE: a title in the M font and a line or two of the S font under it,
   * on a plate over the dining room, for a few seconds. Queued, one at a time,
   * and it waits for a level banner to finish rather than landing on it. The
   * keyboard's legend, the coach's three tips and nothing else come this way:
   * a notice is a sentence the game owes the player at a moment, and a screen
   * that says something every few seconds has said nothing.
   */
  function drawNotice(t) {
    if (!notice) {
      // The options plate has the room: the keyboard's legend and the mode's
      // line wait until the service is chosen, and then say their piece.
      if (!notices.length || banner || over || menu) return;
      notice = Object.assign({ t0: t }, notices.shift());
    }
    const n = notice;
    /* A level bell that rings while a notice is up takes the room: the notice
     * holds its breath and its clock, and carries on when the banner has
     * gone, instead of the two plates landing on each other. */
    if (banner) { if (n.heldAt === undefined) n.heldAt = t; return; }
    if (n.heldAt !== undefined) { n.t0 += t - n.heldAt; n.heldAt = undefined; }
    const p = (t - n.t0) / n.ms;
    if (p >= 1) { notice = null; return; }
    const a = still ? 1 : p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1;
    const PAD = 8, GAP = 4;
    const title = n.lines[0] || '';
    const rest = n.lines.slice(1);
    const tw = measure(title, 'M');
    const rw = rest.reduce((m, s) => Math.max(m, measure(s, 'S')), 0);
    const w = Math.min(W - 8, Math.max(tw, rw) + PAD * 2);
    const h = PAD + 7 + (rest.length ? GAP + rest.length * 7 - 2 : 0) + PAD - 1;
    const x = Math.round(W / 2 - w / 2);
    const y = 44;
    g.globalAlpha = a;
    plate(g, x, y, w, h, { border: P.amber });
    text(g, title, W / 2, y + PAD - 1, { font: 'M', color: P.amber, align: 'center' });
    rest.forEach((s, k) => text(g, s, W / 2, y + PAD + 7 + GAP + k * 7, { font: 'S', color: P.cream, align: 'center' }));
    g.globalAlpha = 1;
  }

  /**
   * THE OPTIONS PLATE, over the dining room: `options.js` decides every box
   * and this only paints them. The room under it is dimmed the way the
   * kitchen is under the closing card, so the plate reads as the thing to
   * look at while the first ticket, the strip's line and the whole kitchen
   * stay in plain view below. The cursor row's name is amber with a caret
   * before it; a chosen chip is lit, a locked one is grey and its sentence
   * says why; START is gold, and so is the score the three choices make.
   */
  function drawMenu(t) {
    const m = menu;
    g.globalAlpha = 0.6;
    dither(g, 0, GEO.ROOM_Y, W, GEO.ROOM_H, P.ink, 'rgba(0,0,0,0)');
    g.globalAlpha = 1;
    plate(g, m.plate.x, m.plate.y, m.plate.w, m.plate.h, { border: P.amber });
    text(g, m.title.s, m.title.x, m.title.y, { font: 'M', color: P.amber });
    text(g, m.score.s, m.score.x, m.score.y, { font: 'M', color: m.score.scored ? P.gold : P.grey, align: 'right' });
    const blink = still || Math.floor(t / 500) % 2 === 0;
    for (const row of m.rows) {
      if (row.cursor && blink) {
        // A caret the S font does not have: three columns of a pixel triangle.
        rect(g, row.x, row.y, 1, 5, P.amber);
        rect(g, row.x + 1, row.y + 1, 1, 3, P.amber);
        rect(g, row.x + 2, row.y + 2, 1, 1, P.amber);
      }
      text(g, row.label, row.x + 6, row.y, { font: 'S', color: row.cursor ? P.amber : P.grey });
      for (const c of row.chips) {
        const lit = c.selected && !c.locked;
        const edge = c.locked ? P.greyLo : P.frame;
        rrect(g, c.x, c.y, c.w, c.h, lit ? (row.cursor ? P.gold : P.amber) : c.locked ? P.plate : P.plateHi, 1);
        if (!lit) {
          rect(g, c.x + 1, c.y, c.w - 2, 1, edge);
          rect(g, c.x + 1, c.y + c.h - 1, c.w - 2, 1, edge);
          rect(g, c.x, c.y + 1, 1, c.h - 2, edge);
          rect(g, c.x + c.w - 1, c.y + 1, 1, c.h - 2, edge);
        }
        text(g, c.label, c.x + c.w / 2, c.y + 2, { font: 'M', color: lit ? P.ink : c.locked ? P.greyLo : P.cream, align: 'center' });
        // Chosen and locked at once: the chip is underlined in grey, taken and refused.
        if (c.selected && c.locked) rect(g, c.x + 2, c.y + c.h - 2, c.w - 4, 1, P.grey);
      }
      const lockedRow = row.chips.some((c) => c.selected && c.locked);
      text(g, row.tell.s, row.tell.x, row.tell.y, { font: 'S', color: lockedRow ? P.grey : P.cream });
    }
    // Grey, not the dim grey: at one and a half screen pixels a game pixel
    // the dim one vanished into the plate, and the line is the instructions.
    text(g, m.footer.s, m.footer.x, m.footer.y, { font: 'S', color: P.grey });
    rrect(g, m.start.x, m.start.y, m.start.w, m.start.h, P.gold, 1);
    text(g, m.start.s, m.start.x + m.start.w / 2, m.start.y + 2, { font: 'M', color: P.ink, align: 'center' });
  }

  /**
   * PAUSED: the whole picture dimmed and one plate in the middle. The title
   * says what state the service is in and the second line what gets it out of
   * that state, because a paused screen with no way out written on it is the
   * one the player walks away from.
   */
  function drawPause() {
    // The same veil as the closing card: at full strength the checker and the
    // wash together left three pixels in ten, and on a brick wall that is
    // black. The kitchen has to stay visible under a pause, or it reads as a
    // crash.
    g.globalAlpha = 0.7;
    dither(g, 0, 0, W, H, P.ink, 'rgba(0,0,0,0)');
    rect(g, 0, 0, W, H, 'rgba(0,0,0,0.35)');
    g.globalAlpha = 1;
    const title = paused.title || 'PAUSED';
    const sub = paused.sub || '';
    const w = Math.min(W - 8, Math.max(measure(title, 'M', 2), measure(sub, 'S')) + 28);
    const h = 14 + (sub ? 13 : 0) + 22;
    const x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2);
    plate(g, x, y, w, h, { border: P.amber });
    text(g, title, W / 2, y + 11, { font: 'M', scale: 2, color: P.amber, align: 'center' });
    if (sub) text(g, sub, W / 2, y + 11 + 14 + 7, { font: 'S', color: P.cream, align: 'center' });
  }

  /** One of the coach's tips, said once per service and only in a first one. */
  function tip(key, lines) {
    if (!coach || taught.has(key)) return;
    taught.add(key);
    say(lines, 4200);
  }

  function drawOver(t) {
    const p = Math.min(1, (t - over.t0) / 600);
    g.globalAlpha = 0.7 * p;
    dither(g, 0, GEO.ROOM_Y, W, H - GEO.ROOM_Y, P.ink, 'rgba(0,0,0,0)');
    rect(g, 0, GEO.ROOM_Y, W, H - GEO.ROOM_Y, 'rgba(0,0,0,0.35)');
    g.globalAlpha = 1;
    if (p < 1) return;
    /* The closing card carries the house's mark. It is the one screen a player
     * looks at without a pot on the fire, so it is where the place gets to be
     * a place rather than a counter. The card is cut to fit the mark when there
     * is one and closes up when there is not. */
    /* The card is cut to the mark, the way a plate is cut to its number.
     *
     * It was 220 by 70 with the badge dropped in beside the text, which worked
     * while the badge was 40 pixels tall and stopped working the moment the
     * mark was redrawn at 121: a fixed box cannot hold a picture whose size is
     * decided somewhere else. So both dimensions come from what is actually in
     * it, and there is no size of mark that can overflow it. */
    const badge = art.frame('mark', 'idle');
    const AIR = 10;
    const rows = [
      { s: 'SERVICE CLOSED', font: 'M', scale: 2, color: P.amber, h: 14 },
      { s: money(snap.cash || 0), font: 'M', scale: 2, color: P.gold, h: 14 },
      { s: 'SERVED ' + snap.served + '   LOST ' + snap.ruined + '   BEST COMBO x' + (snap.comboBest || 0),
        font: 'S', color: P.grey, h: 5 },
      { s: 'LEVEL ' + snap.level + ' - ' + String(snap.levelName).toUpperCase(), font: 'S', color: P.grey, h: 5 },
    ];
    /* One line about the hand — the change that took longest — because this
     * is a drill and a drill owes its player one thing to practise. Then the
     * service number, so a service worth playing again can be. */
    if (closing.note) rows.push({ s: String(closing.note).toUpperCase(), font: 'S', color: P.cream, h: 5 });
    const sd = closing.seed || seed;
    if (sd) rows.push({ s: 'SERVICE ' + sd, font: 'S', color: P.greyLo, h: 5 });
    const GAP = 6;
    const textH = rows.reduce((a, r) => a + r.h, 0) + GAP * (rows.length - 1);
    const textW = Math.max(...rows.map((r) => measure(r.s, r.font, r.scale || 1)));
    const padL = badge ? badge.w + AIR : 0;
    const w = Math.min(W - 8, padL + textW + AIR * 2);
    const h = Math.max(textH, badge ? badge.h : 0) + AIR * 2;
    const x = Math.round(W / 2 - w / 2);
    const y = Math.round((H - h) / 2);
    plate(g, x, y, w, h, { border: P.amber });
    if (badge) {
      g.drawImage(badge.img, badge.sx, badge.sy, badge.w, badge.h,
        x + AIR, y + Math.round((h - badge.h) / 2), badge.w, badge.h);
    }
    const cx = x + padL + (w - padL) / 2;
    let ry = y + Math.round((h - textH) / 2);
    for (const r of rows) {
      text(g, r.s, cx, ry, { font: r.font, scale: r.scale, color: r.color, align: 'center' });
      ry += r.h + GAP;
    }
  }

  /* ── the engine's events ───────────────────────────────────────────────── */
  /** Where a note leaves from: the guitar, wherever the guitar actually is. */
  function guitarAt() {
    const drawn = art.frame('player', 'idle');
    if (drawn) {
      return [Math.round(GEO.PLAYER_CX - drawn.w / 2) + DRAWN_GUITAR.x,
        GEO.PLAYER_FOOT - drawn.h + DRAWN_GUITAR.y];
    }
    return [GEO.PLAYER_CX - 28 + PLAYER_STRINGS.x, GEO.PLAYER_FOOT - 94 + PLAYER_STRINGS.y];
  }

  function event(name, e) {
    const t = now();
    const [gx, gy] = guitarAt();
    switch (name) {
      case 'seat':
        arrive[e.station] = t;
        delete ghosts[e.station];
        delete smoke[e.station];
        delete drops[e.station];
        delete shakes[e.station];
        if (e.who && e.who.critic) {
          tip('critic', ['THE CRITIC IS IN', 'THE HARDEST DISH ON THE MENU, AND IT PAYS THREE TIMES', 'LOSE THEM AND IT IS A STRIKE LIKE ANY OTHER']);
        }
        break;
      case 'strum': {
        strumAt = t;
        const color = e.dirty ? P.smoke : e.together > 1 ? P.gold : P.cyan;
        for (const i of e.stations || []) {
          notes.push({
            x0: gx, y0: gy, x1: slotCX(i), y1: GEO.PAN_BASE_Y - 20,
            t0: t, dur: still ? 260 : 420 + Math.abs(gx - slotCX(i)) * 0.4, arc: 46 + hash(i, e.gain, 1) * 30,
            color, double: e.together > 1,
          });
          flash[i] = { kind: e.dirty ? 'dirty' : 'hit', t0: t };
          if (e.dirty) shakes[i] = t;
          stats.notes++;
        }
        if (e.together > 1) {
          tip('twoPots', ['TWO POTS, ONE CHORD', 'BOTH WANTED ' + e.chord + ' AND ONE STRUM COOKED BOTH', 'THE CARD SAYS 2 POTS WHEN IT IS ON']);
        }
        break;
      }
      case 'miss':
        missAt = t;
        bursts.push({ x: gx, y: gy, t0: t, dur: 260, color: P.smoke });
        break;
      case 'open':
        // The first chord: the kitchen is lit, and the strip's line changes
        // from an invitation to the rule. A word over the pass marks the moment.
        floats.push({ text: 'SERVICE OPEN', x: W / 2, y: GEO.CARD_Y - 4, t0: t, dur: 1400, color: P.amber, font: 'S' });
        break;
      case 'cycle': {
        comboAt = t;
        cookAt = t;
        /* A step cooked, marked WHERE it cooked. This used to hang off a `ring`
         * event the engine stopped emitting when the rest went, so the green
         * flash, the word COOKED, the lifted chip and the customer's delight
         * were all dead code: a card turned over with nothing to say it had.
         * `late` names the pots that cooked under the line, and those get the
         * cost in red where a star was just lost, instead of leaving the
         * player to notice one missing from the bubble. */
        const late = new Set(e.late || []);
        for (const i of e.stations || []) {
          cooked[i] = t;
          const spoiled = late.has(i);
          flash[i] = { kind: spoiled ? 'dirty' : 'cook', t0: t };
          bursts.push({ x: slotCX(i), y: GEO.PAN_BASE_Y - 18, t0: t, dur: 420, color: spoiled ? P.smoke : P.greenHi, spin: 0.5 });
          floats.push({
            /* From under the card up to its edge, never into it: started two
             * rows under the card and rising fourteen, the word spent the
             * middle of its life across the heat bar — green on green. It
             * starts over the pan now and stops where the card begins. */
            text: spoiled ? '-1 STAR' : 'COOKED', x: slotCX(i), y: GEO.CARD_Y + GEO.CARD_H + 16,
            t0: t, dur: spoiled ? 1100 : 800, color: spoiled ? P.redHi : P.greenHi, font: 'S',
          });
          if (spoiled) shakes[i] = t;
        }
        if (late.size) tip('late', ['UNDER THE LINE: ONE STAR OFF', 'THE STEP STILL COOKS, THE DISH PAYS LESS', 'CHANGE BEFORE THE BAR DROPS UNDER THE TICK']);
        else tip('cooked', ['STEP COOKED', 'KEEP THE BAR ABOVE THE WHITE TICK', 'AND THE NEXT STEP COMES OUT CLEAN']);
        /* In practice the time of the change is written over the card it
         * cooked: how long the hand took from the last chord to this one,
         * green when it beat the line and red when it did not. It is the one
         * number a chord-change drill is about, and practice is where it is
         * watched rather than raced. */
        if (timesOn && e.changeMs !== null && e.changeMs !== undefined && e.stations && e.stations.length) {
          floats.push({
            text: (e.changeMs / 1000).toFixed(1) + 'S', x: slotCX(e.stations[0]), y: GEO.CARD_Y - 6,
            t0: t, dur: 1400, color: late.size ? P.redHi : P.greenHi, font: 'M',
          });
        }
        break;
      }
      case 'step': {
        // A step cooked: the ingredient it earned leaves the side plate and
        // lands in the pan, at the spot it will keep.
        const i = e.station;
        const dish = e.dish || {};
        const ings = dish.ingredients || [];
        const name = ings[(e.step || 1) - 1];
        if (name && dish.pan) {
          const cx = slotCX(i);
          const s = panSurface(cx, GEO.PAN_BASE_Y, dish.pan);
          const bits = ings.slice(0, e.step).filter((n) => ING[n] && ING[n].kind !== 'liquid' && ING[n].kind !== 'disc');
          const k = bits.indexOf(name);
          const [x1, y1] = k >= 0 ? bitPos(s, bits.length, k) : [s.x + s.w / 2, s.y + s.h / 2];
          const base = ings.slice(0, e.step).map((n) => ING[n]).filter((d) => d && d.kind === 'liquid').pop();
          drops[i] = { name, t0: t, x0: cx - 34, y0: GEO.PAN_BASE_Y - 5, x1, y1, base: base ? base.hi : null };
        }
        break;
      }
      case 'serve': {
        const i = e.station;
        /* And now the dish gets EATEN, which is the part that was missing.
         *
         * The old numbers had the customer sliding off the stool 500ms after
         * the plate left the pan and the plate itself gone by 1800 — so the
         * one moment the player has earned, the finished dish in front of the
         * person who ordered it, went past in a third of a second while their
         * eyes were still on the pan. `EAT_MS` is that moment: the plate lands
         * at 460, the food comes off it a piece at a time until 1600, and only
         * then does anybody get up. The engine holds the seat for the whole of
         * it — see `SEAT_DELAY_MS`, which is this number plus the leaving. */
        if (e.who) ghosts[i] = { face: e.who.face, name: e.who.name, mood: 'happy', t0: t, until: t + GHOST_MS };
        const dish = e.dish || {};
        plates[i] = { pan: dish.pan, ingredients: dish.ingredients || [], t0: t, until: t + EAT_MS + 260 };
        flights.push({
          pan: dish.pan, ingredients: dish.ingredients || [], t0: t,
          x0: slotCX(i), y0: GEO.PAN_BASE_Y - 10, x1: slotCX(i), y1: GEO.COUNTER_Y + 2,
        });
        delete drops[i];
        floats.push({ text: '+' + money(e.money), x: slotCX(i), y: GEO.SEAT_FOOT - 50, t0: t, dur: 1300, color: P.gold });
        if (e.tip) floats.push({ text: 'TIP!', x: slotCX(i) + 22, y: GEO.SEAT_FOOT - 38, t0: t + 150, dur: 1100, color: P.greenHi, font: 'S' });
        break;
      }
      case 'ruin': {
        const i = e.station;
        if (e.who) ghosts[i] = { face: e.who.face, name: e.who.name, mood: 'angry', t0: t, until: t + 1200 };
        smoke[i] = t + 1800;
        shakes[i] = t;
        delete drops[i];
        floats.push({ text: 'LOST', x: slotCX(i), y: GEO.SEAT_FOOT - 50, t0: t, dur: 1300, color: P.redHi });
        break;
      }
      case 'redeem':
        /* A lost customer won back: the ticket lights up again on the bar, and
         * the word goes up from where the tickets are. Gold, because it is the
         * best-paid thing on the screen that is not money. */
        floats.push({ text: 'TICKET WON BACK', x: 150, y: GEO.BAR_H + 6, t0: t, dur: 1600, color: P.gold, font: 'S' });
        tip('redeem', ['A CUSTOMER WON BACK', 'EIGHT CLEAN DISHES IN A ROW LIGHT A LOST TICKET AGAIN', 'THE STRIP COUNTS THEM DOWN FOR YOU']);
        break;
      case 'level':
        banner = { level: e.level, name: e.name || 'SERVICE', stations: e.stations, perfect: e.perfect || 0, t0: t };
        break;
      case 'chainLost':
        chainLostAt = t;
        break;
      case 'over':
        over = { t0: t };
        break;
      default:
        break;
    }
  }

  function update(s) {
    snap = s;
  }

  /** Turn the keyboard hints on or off. The glue calls this when it knows what
   *  is actually talking, which can change mid-service if a guitar drops out. */
  /** The number this service was dealt from, printed on the closing card so a
   *  service worth playing again can be: `?seed=` pins it exactly. Without it
   *  the card says nothing, which is what it did while every service was the
   *  same one. */
  let seed = null;
  function setSeed(n) { seed = n; }

  function setHints(on) {
    hints = !!on;
  }

  /** Whether the coach speaks this service: the glue says, from what it remembers. */
  function setCoach(on) { coach = !!on; }

  /** Whether the time of every change is written over its card (practice). */
  let timesOn = false;
  function setTimes(on) { timesOn = !!on; }

  /** A notice for the player: a title and up to two lines, for `ms`. Queued.
   *
   * `say` and not `notice`: `notice` is the one being SHOWN and `notices` are
   * the ones waiting, and a third thing with the same name is how a file ends
   * up with `Identifier 'notice' has already been declared` — which is what
   * this was, and it took the whole scene down with it. */
  function say(lines, ms) {
    notices.push({ lines: (lines || []).map((s) => String(s)), ms: ms || 3600 });
  }

  /** The options plate to draw — a layout from `menuLayout` — or `null`. */
  function setMenu(layout) {
    menu = layout || null;
    try { screen.style.cursor = menu ? 'pointer' : ''; } catch (_) {}
  }

  /* A click or a tap on the picture, in GAME pixels: whoever registers gets
   * the point where it landed on the 480 by 270 and decides what is there.
   * The canvas is scaled to its box, so the box is what the point is
   * measured against, not the buffer. */
  let pointer = null;
  function onPointer(fn) { pointer = typeof fn === 'function' ? fn : null; }
  function pointerDown(e) {
    if (!pointer) return;
    let r;
    try { r = screen.getBoundingClientRect(); } catch (_) { return; }
    if (!r || !r.width || !r.height) return;
    const gx = ((e.clientX - r.left) / r.width) * W;
    const gy = ((e.clientY - r.top) / r.height) * H;
    try { pointer(gx, gy, e); } catch (_) { /* a handler must not stop the picture */ }
  }
  try { screen.addEventListener('pointerdown', pointerDown); } catch (_) {}

  /** Holds the picture: `{ title, sub }` while paused, `null` to resume. */
  function setPaused(state) {
    paused = state ? { title: state.title || 'PAUSED', sub: state.sub || '' } : null;
  }

  /** What the closing card prints besides the takings: `{ seed, note }`. */
  function setClosing(c) { closing = Object.assign({}, closing, c || {}); }

  function destroy() {
    cancelAnimationFrame(raf);
    flights = [];
    try { screen.removeEventListener('pointerdown', pointerDown); } catch (_) {}
    try { if (layer) layer.innerHTML = ''; } catch (_) {}
    try { if (ro) ro.disconnect(); } catch (_) {}
    try { window.removeEventListener('resize', layout); } catch (_) {}
    try { root.remove(); } catch (_) {}
  }

  return {
    update, event, setHints, setSeed, setCoach, setTimes, say, setPaused, setClosing, setMenu, onPointer, destroy,
    get stats() { return stats; },
  };
}

function ease(p) {
  const q = Math.max(0, Math.min(1, p));
  return q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
}
