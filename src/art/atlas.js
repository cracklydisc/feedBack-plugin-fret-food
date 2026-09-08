/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE ATLAS, and why every sprite in it is optional.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The scene draws its people, pans and dishes procedurally. That is a ceiling,
 * not a choice: code is good at brick, tiles, panels and gauges, and bad at
 * faces, hands and food. So drawn sprites can be dropped into `assets/art/`
 * with a manifest, and each one that exists REPLACES the procedural version of
 * that one thing.
 *
 * The important property is that it degrades in both directions. No manifest at
 * all, and the game looks exactly as it does today. Half the sheets delivered,
 * and half the game is drawn art and half is generated, which is what the
 * middle of the job actually looks like. Nothing here throws if a file is
 * missing, because a missing sprite is a normal state and not an error.
 *
 * ── WHY THE NAMES MATTER ────────────────────────────────────────────────
 *
 * Frames for pans and dishes are looked up by the SAME keys the game already
 * uses: `COOKWARE` entries and dish `id`s from `menu.js`. So a sheet whose
 * frame is called "pot" instead of "stockpot" silently draws nothing, and that
 * is the kind of defect nobody notices for a week. `tests/atlas.test.js`
 * refuses it. See `docs/asset-brief.md` for the naming, sizes and the prompts
 * the sheets are generated from.
 */

/**
 * Where the art is, worked out from where this file itself was served.
 *
 * The app serves the plugin's `src/` and `assets/` under
 * `/api/plugins/fret-food/`, and the preview page serves the repository root, so
 * a path written out here is right in one of the two and wrong in the other.
 * The module's own URL knows which it is.
 */
const BASE = new URL('../../assets/art/', import.meta.url).href;

/*
 * ── WHICH SHEETS ARE IN PLAY, AND WHY THAT IS A LIST ─────────────────────
 *
 * The mix is HYBRID on purpose, and the mix is a decision. Everything in
 * `assets/art/` is cut, checked in and ready; this names the sheets the game
 * actually draws from, so switching one on or off is one line and a reason,
 * rather than a question of which files happen to be on disk.
 *
 * The rule the list encodes: a drawn sprite has to be better than the coded
 * one AND fit the band it goes in. Code loses badly at faces, hands and cloth,
 * so every person in the room is drawn. Code wins at anything the GAME has to
 * say about an object over time — a pan that fills one ingredient per step,
 * darkens with soot, sits in a flame whose height is the burner, and steams
 * when it is ready — and it wins again at anything smaller than the model's
 * floor, which is where the shelf clutter and the plated dishes live.
 *
 * The two entries that are OFF each cost a day to find out:
 *
 *   props   thirty-six kitchen objects, and lovely. They come back 21 to 30 art
 *           pixels tall; the shelf they go on is 8 rows deep and the hanging
 *           rail 17. The room is drawn once into a buffer before the atlas has
 *           even loaded, so using them also means rebuilding the backdrop when
 *           the sheets arrive. Neither is hard. Both are more than the coded
 *           props are costing.
 *   dishes  twenty-two plated dishes at 65 to 114 pixels wide for a plate that
 *           is 22. Not a quality problem and not fixable by cutting: the model
 *           draws about a fixed number of pixel cells per image, so asking for
 *           something small enough gives fewer, bigger pixels and not a smaller
 *           picture. The procedural plating stays.
 *
 * The pans took eight takes to earn their place, for the same reason: the same
 * prompt at the same settings came back anywhere from 6 to 57 pixels tall
 * depending on the seed, and a half-size pan does not read as a small pan, it
 * reads as a stove with nothing on it — with a flame, a ring, a food surface
 * and a plume of steam all tuned around a pan twice its size.
 */
const DRAWN = new Set([
  'player',                          // the cook with the guitar
  'cooks',                           // twenty busts, two of them at the pass
  'crowd-a', 'crowd-b',              // the room's background people, six to a sheet
  'mark',                            // the house badge
  ...Array.from({ length: 12 }, (_, i) => 'cust-' + String(i + 1).padStart(2, '0')),
]);

/*
 * ── AND THE PANS ARE OFF, WHICH IS A PROJECTION AND NOT A QUALITY ────────
 *
 * They are drawn, cut, measured into the stove's band, centred on their own
 * bodies and wired all the way through the fire, the food and the soot. And
 * they are wrong in the shot, because they are seen from three quarters ABOVE
 * and this kitchen is drawn front on: the cooktop, the stove front, the pass
 * and the cards are all flat elevations, and a vessel with its rim drawn as an
 * ellipse sits in that like a photograph pasted into a diagram. Every other
 * generated sheet got away with it — a person seen front on IS a flat
 * elevation, and so is a bust, and a badge has no projection at all.
 *
 * The two honest ways out are to tilt the whole room to meet nine pans, or to
 * keep the pans the room already agrees with. `pans` stays in the manifest and
 * on disk: adding it to the set above brings it back in one line, which is
 * what makes this a decision rather than a deletion.
 */

/**
 * Loads the manifest and the sheets it names — the ones in `DRAWN`, at least.
 *
 * Returns immediately with an atlas that answers `null` to everything, and
 * fills in as the images arrive: the scene asks for a frame every time it draws
 * one, so there is nothing to notify and no loading state to hold.
 *
 * `opts.use` is a Set that replaces `DRAWN`, for a test or a preview that wants
 * to see one sheet against its coded twin.
 */
export function loadAtlas(opts) {
  const o = opts || {};
  const base = o.base || BASE;
  const sheets = new Map();          // name -> { img, cols, rows, cell, frames }
  let manifest = null;

  const atlas = {
    get ready() { return manifest !== null; },
    get sheetsLoaded() { return sheets.size; },

    /**
     * One frame, ready for `drawImage`, or `null` when it has not been drawn.
     * `null` is the signal to fall back to the procedural sprite.
     *
     * `body`, when it could be measured, is where the SUBJECT is inside that
     * rectangle — see `measure` below for why a frame's box is not good enough
     * to place a pan by.
     */
    frame(sheetName, frameName) {
      const s = sheets.get(sheetName);
      if (!s || !s.img.complete || !s.img.naturalWidth) return null;
      const i = s.frames.indexOf(frameName);
      if (i < 0) return null;
      const col = i % s.cols;
      const row = Math.floor(i / s.cols);
      if (!s.bodies && !s.measured) measure(s);
      return {
        img: s.img,
        sx: col * s.cell[0], sy: row * s.cell[1],
        w: s.cell[0], h: s.cell[1],
        body: s.bodies ? s.bodies[frameName] : null,
      };
    },

    /** Looks for `name` in every sheet, for the callers that do not care which
     *  sheet a pan or a dish ended up on. */
    find(frameName) {
      for (const name of sheets.keys()) {
        const f = atlas.frame(name, frameName);
        if (f) return f;
      }
      return null;
    },
  };

  /**
   * WHERE THE SUBJECT IS INSIDE ITS FRAME, read off the sheet's own pixels.
   *
   * A frame is a rectangle in a grid, and for a person that is all anybody
   * needs: feet on the bottom row, centred left to right. A pan is not a
   * person. Every second pan on the sheet has a HANDLE sticking out of one
   * side, so the middle of its rectangle is three to five pixels away from the
   * middle of the vessel — and the fire, which is drawn centred on the burner,
   * came out under the handle. The rectangle is wider than the vessel too, by
   * up to a third, so the flame was a third too wide and licked out past a pan
   * it was supposed to be under. And because every cell in a sheet is as tall
   * as the tallest sprite in it, a twenty-pixel roasting tray sat in a cell of
   * thirty-one and got a stockpot's flame.
   *
   * All three are the same missing fact. It could be written down — nine pans,
   * three numbers each — and then it would be twenty-seven numbers that have to
   * be re-measured by hand every time a sheet is regenerated, which is the kind
   * of bookkeeping that is right once and wrong for the rest of the project.
   * The sheet already knows: the body is the run of COLUMNS that are nearly as
   * tall as the tallest one, because a handle is thin and a pan is not.
   *
   * Once per sheet, on the first frame anybody asks for, and never again.
   */
  function measure(s) {
    s.measured = true;
    try {
      const [cw, ch] = s.cell;
      const c = document.createElement('canvas');
      c.width = s.img.naturalWidth;
      c.height = s.img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(s.img, 0, 0);
      const px = g.getImageData(0, 0, c.width, c.height).data;
      const bodies = {};
      s.frames.forEach((name, i) => {
        const ox = (i % s.cols) * cw;
        const oy = Math.floor(i / s.cols) * ch;
        const height = new Array(cw).fill(0);
        let top = ch;
        for (let y = 0; y < ch; y++) {
          for (let x = 0; x < cw; x++) {
            if (px[((oy + y) * c.width + ox + x) * 4 + 3] > 0) {
              height[x]++;
              if (y < top) top = y;
            }
          }
        }
        const tallest = Math.max(...height);
        if (!tallest) return;
        // The longest run of columns at least 45% as tall as the tallest one.
        const cut = tallest * 0.45;
        let best = null, runStart = -1;
        for (let x = 0; x <= cw; x++) {
          const tall = x < cw && height[x] >= cut;
          if (tall && runStart < 0) runStart = x;
          if (!tall && runStart >= 0) {
            if (!best || x - runStart > best.w) best = { x0: runStart, x1: x - 1, w: x - runStart };
            runStart = -1;
          }
        }
        if (!best) return;
        bodies[name] = {
          x0: best.x0, x1: best.x1, w: best.w,
          cx: (best.x0 + best.x1 + 1) / 2,
          top, h: ch - top,
        };
      });
      if (Object.keys(bodies).length) s.bodies = bodies;
    } catch (_) {
      /* No DOM, or a canvas the browser will not let us read. The callers all
       * fall back to the frame's own box, which is what they used to use. */
    }
  }

  fetch(base + 'atlas.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (!json || !json.sheets) return;               // no art yet: procedural it is
      manifest = json;
      for (const name of Object.keys(json.sheets)) {
        /* A sheet the manifest carries and the game does not draw from. It is
         * still cut, still checked in, still tested: `DRAWN` above says why
         * each of those is waiting rather than in. */
        if (!(o.use || DRAWN).has(name)) continue;
        const spec = json.sheets[name] || {};
        const cell = spec.cell || json.cellSize;
        if (!cell || !spec.frames || !spec.cols) continue;
        const img = new Image();
        img.src = base + name + '.png';
        sheets.set(name, {
          img,
          cols: spec.cols,
          rows: spec.rows || Math.ceil(spec.frames.length / spec.cols),
          cell,
          frames: spec.frames,
        });
      }
    })
    .catch(() => { /* offline, or no art: the game does not care */ });

  return atlas;
}

/**
 * The frame names the game will ask for, worked out from the game's own data.
 *
 * This is exported so the test can check a manifest against it instead of
 * against a list written twice. Add a dish to the menu and the expected frames
 * change on their own; deliver a sheet that does not have it and the test says
 * which one is missing.
 */
export function expectedFrames(cookware, dishIds) {
  return {
    pans: cookware.slice(),
    dishes: dishIds.slice(),
    player: ['idle', 'strum', 'flourish', 'slump'],
    customer: ['wait', 'impatient', 'happy', 'angry'],
    /* The room's background people. Twelve of them, indexed rather than named,
     * because they are scenery: the scene picks one per standing spot from a
     * hash and none of them is anybody. */
    crowd: Array.from({ length: 12 }, (_, i) => 'crowd-' + String(i).padStart(2, '0')),
    /* The kitchen's staff, and the props on its shelves. Indexed for the same
     * reason as the crowd, plus one of its own: both sheets are drawn as a
     * crowded grid — which is the only way to get a sprite small enough for
     * the band it goes in — and at that density the model stops laying the
     * subjects out in the order they were asked for. A numbered slot is an
     * honest name for a cell whose contents are chosen by looking. */
    cooks: Array.from({ length: 20 }, (_, i) => 'cook-' + String(i).padStart(2, '0')),
    props: Array.from({ length: 30 }, (_, i) => 'prop-' + String(i).padStart(2, '0')),
    /* And the spares, which are the honest name for a cell the sheet HAS and
     * the game does not use. Asked for nine pans the model draws eleven
     * objects; the sheet is read by what is in it, so the two the kitchen has
     * no use for are still cut, still numbered, and never asked for. Without
     * this the only ways to keep a set were to re-roll until the model counts
     * or to lie about what a cell holds. */
    spare: Array.from({ length: 12 }, (_, i) => 'spare-' + String(i).padStart(2, '0')),
  };
}
