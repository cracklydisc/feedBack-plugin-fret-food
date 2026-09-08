/*
 * A static server for the preview, and one thing more: it takes the pictures.
 *
 * `tools/anteprima.html` is a page of ES modules, and a browser will not load a
 * module from a `file://` address. So: the project folder over HTTP, with the
 * handful of MIME types the page needs, on a port that nothing else is likely
 * to hold. No dependency, because the plugin has none.
 *
 *     node tools/serve.mjs            then open http://localhost:8765/tools/anteprima.html
 *     PORT=9000 node tools/serve.mjs
 *
 * ── THE SCREENSHOTS ────────────────────────────────────────────────────
 *
 * The pictures in the README are the game's own back buffer and not a
 * screenshot of a window: `POST /shot?name=service` with a PNG body writes
 * `docs/service.png`, and the page gets the PNG from its canvas with
 * `toBlob`. That is the only way to a picture at a whole number of screen
 * pixels per game pixel with nothing of the host around it, and it works
 * from the preview and from the hub alike — the hub is another origin, so
 * the answer carries the one CORS header that lets it. Names are a word or
 * two of letters, digits and dashes, and land in `docs/` and nowhere else.
 *
 *     const c = document.querySelector('.kc-screen');
 *     c.toBlob((b) => fetch('http://localhost:8765/shot?name=service', { method: 'POST', body: b }));
 */

import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8765;
const SHOTS = join(ROOT, 'docs');

/** Reads a request body whole, as one buffer. */
function body(req) {
  return new Promise((ok, fail) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', fail);
  });
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

async function shot(req, res, url) {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  const name = String(url.searchParams.get('name') || '');
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/i.test(name)) {
    res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain' }, CORS));
    res.end('name: letters, digits and dashes');
    return;
  }
  const png = await body(req);
  // A PNG starts with these eight bytes, and nothing else is written to disk.
  if (png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) {
    res.writeHead(400, Object.assign({ 'Content-Type': 'text/plain' }, CORS));
    res.end('not a PNG');
    return;
  }
  await mkdir(SHOTS, { recursive: true });
  const file = join(SHOTS, name + '.png');
  await writeFile(file, png);
  process.stdout.write(`shot: ${file} (${png.length} bytes)\n`);
  res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain' }, CORS));
  res.end('docs/' + name + '.png');
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/shot') {
    try { await shot(req, res, url); } catch (e) {
      res.writeHead(500, Object.assign({ 'Content-Type': 'text/plain' }, CORS));
      res.end(String((e && e.message) || e));
    }
    return;
  }
  // `normalize` folds any `..` so a request cannot climb out of the project.
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([.][.][\\/])+/, '');
  const file = join(ROOT, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(302, { Location: '/tools/anteprima.html' }); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found: ' + rel);
  }
}).listen(PORT, () => {
  process.stdout.write(`fret-food preview: http://localhost:${PORT}/tools/anteprima.html\n`);
});
