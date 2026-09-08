/*
 * THE PAPER SCREEN: a canvas that draws nothing and remembers everything.
 *
 * The scene is the one part of this game that needs a browser, and it is also
 * the part where a defect is invisible from Node: a number two pixels past the
 * edge of its plate is still a number, the tests pass, and the screen is wrong.
 *
 * So this is a 2D context that keeps a list of what it was asked to paint
 * instead of painting it. It is enough for `pix.js`, `font.js` and `scene.js`
 * to run unchanged, and it makes one question answerable in a test: WHERE did
 * every letter land.
 *
 * ── HOW A LETTER IS RECOGNISED ───────────────────────────────────────────
 *
 * No hook was added to the game for this. `font.js` prints a glyph with the
 * nine argument form of `drawImage` (a rectangle cut out of a glyph atlas);
 * every sprite in the game is blitted with the three argument form. So on the
 * back buffer, a nine argument `drawImage` is a letter and nothing else is.
 *
 * Consecutive letters from the same atlas on the same line are then glued back
 * into a RUN, which is the string as the player sees it: one box, with the
 * font, the colour and the scale it was printed at.
 */

/* ── the fake context ─────────────────────────────────────────────────── */

let nextId = 1;

function context(canvas) {
  const ops = [];
  const stack = [];
  let alpha = 1;
  /* The clip is tracked because the scene uses it to mean something: a card
   * sliding out of the rail is drawn where it is going to be and cut off by
   * the rail, and a harness that ignored that would report letters at
   * coordinates the player never sees. `beginPath` + `rect` + `clip` is the
   * only shape of clipping in this game, which is why one rectangle is
   * enough. */
  let clip = null;
  let path = null;
  const cut = (box) => {
    if (!clip) return box;
    const x = Math.max(box.x, clip.x);
    const y = Math.max(box.y, clip.y);
    const w = Math.min(box.x + box.w, clip.x + clip.w) - x;
    const h = Math.min(box.y + box.h, clip.y + clip.h) - y;
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  };
  const ctx = {
    __id: nextId++,
    canvas,
    fillStyle: '#000',
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    get globalAlpha() { return alpha; },
    set globalAlpha(v) { alpha = v; },
    fillRect(x, y, w, h) {
      const b = cut({ x, y, w, h });
      if (b) ops.push(Object.assign({ kind: 'rect', color: String(this.fillStyle), alpha }, b));
    },
    drawImage(src, ...a) {
      // (sx, sy, sw, sh, dx, dy, dw, dh) is a glyph out of an atlas; the three
      // argument form is a sprite. Nothing else in the game prints letters.
      const raw = a.length === 8
        ? { kind: 'glyph', src: src.__id, x: a[4], y: a[5], w: a[6], h: a[7] }
        : { kind: 'blit', src: src.__id, x: a[0], y: a[1], w: src.width, h: src.height };
      const b = cut(raw);
      if (b) ops.push(Object.assign(raw, b, { alpha }));
    },
    createPattern() { return { __pattern: true }; },
    save() { stack.push({ alpha, clip }); },
    restore() { const p = stack.pop(); if (p) { alpha = p.alpha; clip = p.clip; } },
    beginPath() { path = null; },
    rect(x, y, w, h) { path = { x, y, w, h }; },
    clip() { clip = path ? cut(path) || { x: 0, y: 0, w: 0, h: 0 } : clip; },
    translate() {}, scale() {},
    __ops: ops,
    __reset() { ops.length = 0; },
  };
  return ctx;
}

function element(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    __id: nextId++,
    className: '',
    style: {},
    children: [],
    width: 300,
    height: 150,
    clientWidth: 0,
    clientHeight: 0,
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter((k) => k !== c); },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute() {}, addEventListener() {}, removeEventListener() {},
    getContext() { this.__ctx = this.__ctx || context(this); return this.__ctx; },
  };
  return el;
}

/** Installs the fake browser. Idempotent, and returns the page it built. */
export function paper(opts) {
  const o = opts || {};
  const canvases = [];
  const doc = {
    hidden: false,
    createElement(tag) {
      const el = element(tag);
      if (tag === 'canvas') canvases.push(el);
      return el;
    },
    /* The scene puts its chord diagrams on an SVG layer over the canvas. This
     * page gives it one that accepts everything and shows nothing, so the
     * pixel side of the scene can still be measured here; the layer's own
     * geometry is checked as a pure function instead (`chordBoxes`), which is
     * a better test of it than a fake DOM would be. */
    createElementNS(ns, tag) {
      const el = element(tag);
      el.namespaceURI = ns;
      return el;
    },
    getElementById() { return null; },
  };
  const win = {
    devicePixelRatio: o.dpr || 1,
    matchMedia: () => ({ matches: !!o.still }),
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.document = doc;
  globalThis.window = win;
  /* The scene drives itself off `requestAnimationFrame`, so the page holds the
   * callback and the test decides when a frame happens and what time it is.
   * That is what a browser does, and it is what makes a frame reproducible. */
  let pending = null;
  globalThis.requestAnimationFrame = (fn) => { pending = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { pending = null; };
  delete globalThis.ResizeObserver;              // the scene falls back to a resize listener

  const container = element('div');
  container.clientWidth = o.w || 960;
  container.clientHeight = o.h || 540;

  return {
    container,
    /** Lets one frame happen, at time `t`. */
    frame(t) { const fn = pending; pending = null; if (fn) fn(t); },
    /**
     * Runs `fn` and returns what was drawn on the back buffer.
     *
     * The back buffer is the context that did the work: the visible canvas
     * receives exactly one call a frame (the whole buffer, scaled up) and a
     * cached sprite receives none after the first, so "the busiest context"
     * names it without the scene having to hand it over.
     */
    capture(fn) {
      for (const c of canvases) if (c.__ctx) c.__ctx.__reset();
      fn();
      let best = null;
      for (const c of canvases) {
        if (!c.__ctx) continue;
        if (!best || c.__ctx.__ops.length > best.__ops.length) best = c.__ctx;
      }
      const ops = best ? best.__ops.slice() : [];
      return { ops, runs: runs(ops) };
    },
  };
}

/* ── letters back into strings ────────────────────────────────────────── */

/**
 * Glues consecutive glyphs from one atlas on one line into a run.
 *
 * A run breaks on a new atlas (a different colour, font or scale), on a new
 * line, or on a horizontal gap wider than a space. Two of the four gaps a
 * printer leaves are worth knowing: one pixel times the scale between letters,
 * and the width of a space where the printer skipped one.
 */
export function runs(ops) {
  const out = [];
  let cur = null;
  const close = () => { if (cur) out.push(cur); cur = null; };
  for (const op of ops) {
    if (op.kind !== 'glyph') continue;
    /* A run breaks on a new atlas, a new line, or a gap wider than a space.
     * A space is one advance plus the sliver between letters, which is two
     * cells at the outside; three cells would glue two separate readouts on
     * the same line into one box and hide a collision between them. */
    if (cur && op.src === cur.src && op.y === cur.y && op.h === cur.h
        && op.x >= cur.x1 && op.x - cur.x1 <= 2 * op.w) {
      cur.x1 = op.x + op.w;
      cur.n++;
      continue;
    }
    close();
    cur = { src: op.src, x: op.x, y: op.y, x1: op.x + op.w, h: op.h, cell: op.w, n: 1, alpha: op.alpha };
  }
  close();
  for (const r of out) r.w = r.x1 - r.x;
  return out;
}

/** Two boxes overlap when they share at least one pixel. */
export function hits(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Drops the copies an outline or a shadow makes.
 *
 * `text()` with an outline prints the same string nine times, eight of them a
 * pixel away in each direction; a shadow prints it twice. Those are one string
 * on the screen, so a run that sits within a scale of another run of the same
 * size is folded into it.
 */
export function distinct(list) {
  const out = [];
  for (const r of list) {
    const twin = out.find((o) => o.h === r.h && Math.abs(o.x - r.x) <= r.cell && Math.abs(o.y - r.y) <= r.cell
      && Math.abs(o.w - r.w) <= r.cell);
    if (twin) {
      const x1 = Math.max(twin.x + twin.w, r.x + r.w);
      twin.x = Math.min(twin.x, r.x);
      twin.w = x1 - twin.x;
      twin.copies = (twin.copies || 1) + 1;
      continue;
    }
    out.push(Object.assign({}, r));
  }
  return out;
}
