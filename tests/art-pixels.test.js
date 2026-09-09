import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { FACES } from '../src/menu.js';
import { CROWD_COUNT } from '../src/art/atlas.js';

const root = new URL('../assets/art/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('atlas.json', root), 'utf8'));

// Read the actual shipped RGBA pixels: a manifest-only check cannot detect
// a colour key that has removed the inside of a character's shirt.
function pixels(name) {
  const png = readFileSync(new URL(name + '.png', root));
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  assert.equal(png[24], 8, 'sprite bit depth');
  assert.equal(png[25], 6, 'sprites use RGBA');
  assert.equal(png[28], 0, 'sprites are not interlaced');
  const chunks = [];
  for (let p = 8; p < png.length;) {
    const n = png.readUInt32BE(p);
    if (png.toString('ascii', p + 4, p + 8) === 'IDAT') chunks.push(png.subarray(p + 8, p + 8 + n));
    p += n + 12;
  }
  const data = inflateSync(Buffer.concat(chunks));
  const stride = w * 4, out = new Uint8Array(stride * h);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const filter = data[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= 4 ? out[i - 4] : 0;
      const b = y ? out[i - stride] : 0;
      const c = y && x >= 4 ? out[i - stride - 4] : 0;
      const prediction = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      out[i] = data[y * (stride + 1) + x + 1] + prediction;
    }
  }
  return { w, h, alpha: (x, y) => out[(y * w + x) * 4 + 3] };
}

test('every selectable customer and crowd identity has a shipped sprite', () => {
  for (let face = 1; face <= FACES; face++) {
    const name = 'cust-' + String(face).padStart(2, '0');
    const spec = manifest.sheets[name];
    assert.ok(spec, name);
    assert.deepEqual(spec.frames, ['wait', 'impatient', 'happy', 'angry']);
    const p = pixels(name);
    assert.equal(p.w, spec.cols * spec.cell[0]);
    assert.equal(p.h, spec.rows * spec.cell[1]);
  }
  const crowd = Object.entries(manifest.sheets).filter(([name]) => name.startsWith('crowd-'));
  const frames = crowd.flatMap(([, s]) => s.frames);
  assert.equal(new Set(frames).size, CROWD_COUNT);
  for (let i = 0; i < CROWD_COUNT; i++) assert.ok(frames.includes('crowd-' + String(i).padStart(2, '0')));
});

test('background customers have opaque shirts, with real transparency outside the silhouette', () => {
  for (const [name, spec] of Object.entries(manifest.sheets)) {
    if (!name.startsWith('crowd-')) continue;
    const p = pixels(name), [w, h] = spec.cell;
    assert.equal(p.w, spec.cols * w);
    assert.equal(p.h, spec.rows * h);
    for (let k = 0; k < spec.frames.length; k++) {
      const ox = k % spec.cols * w, oy = Math.floor(k / spec.cols) * h;
      let x0 = w, x1 = 0, y0 = h, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!p.alpha(ox + x, oy + y)) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
      }
      assert.ok(x1 > x0 && y1 > y0, spec.frames[k] + ' is empty');
      assert.equal(p.alpha(ox, oy), 0, spec.frames[k] + ' has an opaque background');
      let solid = 0, total = 0;
      // The central chest, excluding the gaps between arms and beside legs.
      for (let y = Math.round(y0 + (y1 - y0) * .32); y < Math.round(y0 + (y1 - y0) * .55); y++) {
        for (let x = Math.round(x0 + (x1 - x0) * .4); x < Math.round(x0 + (x1 - x0) * .6); x++) {
          total++;
          if (p.alpha(ox + x, oy + y) === 255) solid++;
        }
      }
      assert.ok(solid / total >= .9, spec.frames[k] + ' has a transparent shirt');
    }
  }
});
