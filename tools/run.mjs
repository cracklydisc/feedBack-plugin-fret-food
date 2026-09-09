/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE BENCH ON THE COMMAND LINE: a whole service, with nobody in front of it.
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   node tools/run.mjs --input bot --profile real --seed 7 --seconds 300
 *   node tools/run.mjs --input scripted --profile perfect --json
 *
 * It builds the real and complete chain, virtual clock, port, flaws of the ear,
 * player, engine, and prints what happened. It is there to answer in two
 * seconds "and what if the burner rose by a tenth?", which is a question that
 * by hand has no answer.
 *
 * Ten minutes of service run in a few tens of milliseconds, so it can be done
 * in a shell loop over twenty different seeds and the average read off. It is
 * the reason the engine has never seen a `performance.now()`.
 *
 * The `runGame` below is exported on purpose: the balance tests measure
 * EXACTLY what is printed here, not a copy of their own that drifts away with
 * time.
 */

import { pathToFileURL } from 'node:url';
import { createGame } from '../src/engine.js';
import { MENU, LEVELS, dist, chordsUpTo } from '../src/menu.js';
import { inventMenu } from '../src/invent.js';
import { createPort } from '../src/input/port.js';
import { createFlaws, PROFILES } from '../src/input/flaws.js';
import { createScriptedAdapter, cook } from '../src/input/scripted.js';
import { createVirtualClock } from '../src/clock.js';
import { botAdapter } from '../src/bot.js';
import { createReport } from '../src/report.js';

/* The engine's own generator, again. It is not laziness: the flaws have to
 * fall on the same points of the bench, otherwise two services with the same
 * seed cannot be compared with each other. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * The metronome: strums in time on a fixed round of chords, without ever
 * looking at the counter.
 *
 * It is not a poor player, it is the term of comparison. It says how much of a
 * service comes from the rhythm and how much from looking at the right pots: if
 * the bot did not do much better than this, the game would not be asking you to
 * choose, it would only be asking you to keep time.
 */
export function metronomo(ms, beat) {
  const pool = ['C', 'Am', 'G', 'Dm', 'F'];
  const out = [];
  let at = 500, k = 0;
  while (at < ms) {
    out.push(...cook(pool[k % pool.length], { at, beat, hits: 2 }));
    at += beat * 3;                      // three beats per step, like `dish`
    k++;
  }
  return out;
}

/**
 * Runs one service and gives back the report.
 *
 * `input` 'bot' or 'scripted', `profile` one of those in flaws.js, `seed` the
 * seed (one only: both the dishes and the ear's mistakes come out of it),
 * `seconds` how long it lasts at most, `rules` the rules to change, `bot` the
 * player's options.
 */
export function runGame(opts) {
  const o = opts || {};
  const input = o.input || 'bot';
  const profile = o.profile || 'real';
  const seed = o.seed === undefined ? 7 : o.seed;
  const seconds = o.seconds === undefined ? 300 : o.seconds;

  // `rules` is there to ask "and what if the burner rose by a tenth?" without
  // touching the engine, and it is also the only way to make a service last all
  // 600 seconds (high STRIKES) to measure what the loop really costs.
  // The same menu the game plays: hand-written plus invented, out of the seed.
  const game = createGame({ menu: inventMenu(MENU, seed, 6), levels: LEVELS, seed, rules: o.rules });
  const report = createReport(game, { seed, profile, input });
  const port = createPort(input);
  const flaws = createFlaws(profile, rng(seed + 1), {
    // "far" is known only to whoever has the engine at hand: it is the change
    // from the shape the hand is holding now to the one it is about to make.
    far: (ev) => dist(game.state.hand, ev.chord) >= game.rules.RUSH_COST,
    pool: chordsUpTo(6),
  });

  const adapter = input === 'bot'
    ? botAdapter(port, game, Object.assign({ flaws }, o.bot))
    : createScriptedAdapter(port, { events: metronomo(seconds * 1000, game.rules.BEAT_MS), flaws });

  // A bleed is not a chord: it reaches the engine as a strum on nobody, with no
  // special case. It is the same line the bench writes.
  port.on('strum', (ev) => game.strum(ev.chord === null ? ' ' : ev.chord, ev.quality));
  const sync = () => port.setCandidates(game.snapshot().wants);
  for (const n of ['seat', 'step', 'serve', 'ruin']) game.on(n, sync);

  const clock = createVirtualClock();
  clock.start((dt) => {
    if (!game.state.running) return;
    adapter.pump(game.state.t);
    game.tick(dt);
    report.sample(game.state.t);
  });
  adapter.start();
  sync();
  clock.advance(seconds * 1000);
  adapter.stop();

  return report.finish();
}

/* ── the printing ──────────────────────────────────────────────────────── */

const pct = (x) => (x * 100).toFixed(0) + '%';
const row = (label, value) => '  ' + String(label).padEnd(16) + value;

/** A histogram on one line: the boxes in order, the empty ones skipped. */
function histogram(h, suffix) {
  const keys = Object.keys(h).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  return keys.map((k) => k + (suffix || '') + ':' + h[k]).join('  ') || '—';
}

export function stampa(r) {
  const out = [];
  out.push('');
  out.push('  FRET FOOD   ' + r.input + ' · ' + r.profile + ' · seed ' + r.seed);
  out.push('');
  out.push(row('duration', (r.durationMs / 1000).toFixed(1) + ' s' + (r.over ? '   closed: ' + r.why : '   still open')));
  out.push(row('level', r.level));
  out.push(row('takings', r.cash));
  out.push(row('served', r.served + '   lost ' + r.ruined + '   with a tip ' + pct(r.tipRatio)));
  out.push(row('steps cooked', r.cycles + '   clean ' + (r.cleanSteps === undefined ? '' : r.cleanSteps + ' ') + '(' + pct(r.cleanRatio) + ')'));
  out.push(row('slowest changes', (r.slowest || []).map((c) => c.from + '-' + c.to + ' ' + (c.ms / 1000).toFixed(1) + 's x' + c.n).join('   ') || '—'));
  out.push(row('strums', r.hits + '   on nobody ' + r.misses + ' (' + pct(r.missRatio) + ')'
    + '   too muddy to cook ' + (r.rough || 0)));
  out.push('');
  out.push(row('hits per step', Object.keys(r.hitsPerStep)
    .map((k) => 'lv ' + k + ': ' + (r.hitsPerStep[k] === null ? '—' : r.hitsPerStep[k].toFixed(1)))
    .join('   ') || '—'));
  out.push(row('gaps', histogram(r.gaps, 'ms')));
  out.push(row('hits/chord', histogram(r.perChord)));
  out.push(row('life at -1 beat', histogram(r.deaths, 's')));
  out.push(row('hash', r.hash));
  out.push('');
  return out.join('\n');
}

/* ── the command line ──────────────────────────────────────────────────── */

function args(argv) {
  const o = { input: 'bot', profile: 'real', seed: 7, seconds: 300, json: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--align') o.align = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--input') o.input = argv[++i];
    else if (a === '--profile') o.profile = argv[++i];
    else if (a === '--seed') o.seed = Number(argv[++i]);
    else if (a === '--seconds') o.seconds = Number(argv[++i]);
    else if (a === '--reaction') o.reactionMs = Number(argv[++i]);
    else throw new Error('I do not know what to do with "' + a + '"');
  }
  return o;
}

const USAGE = [
  'usage: node tools/run.mjs [options]',
  '  --input    bot | scripted        who plays (default bot)',
  '  --profile  ' + Object.keys(PROFILES).join(' | '),
  '  --seed     number                dishes and mistakes, all from here',
  '  --seconds  number                how long it lasts at most',
  '  --align                          the bot waits for whoever is sitting down',
  '  --reaction ms                    how long the bot takes to decide',
  '  --json                           the report as data, not as a page',
  '  --quiet                          one line only',
].join('\n');

function main(argv) {
  const o = args(argv);
  if (o.help) { process.stdout.write(USAGE + '\n'); return; }
  const r = runGame({
    input: o.input,
    profile: o.profile,
    seed: o.seed,
    seconds: o.seconds,
    bot: { align: o.align, reactionMs: o.reactionMs },
  });
  if (o.json) process.stdout.write(JSON.stringify(r) + '\n');
  else if (o.quiet) {
    process.stdout.write([
      r.input, r.profile, 'seed=' + r.seed, (r.durationMs / 1000).toFixed(1) + 's',
      'lv=' + r.level, 'cash=' + r.cash, 'clean=' + pct(r.cleanRatio), r.hash.slice(0, 12),
    ].join('  ') + '\n');
  } else process.stdout.write(stampa(r) + '\n');
}

// Run by hand from the shell it prints; imported by a test, it prints nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // A typo on the command line does not deserve a call stack: it deserves
  // being told what to write.
  try { main(process.argv.slice(2)); } catch (e) {
    process.stderr.write(e.message + '\n\n' + USAGE + '\n');
    process.exitCode = 2;
  }
}
