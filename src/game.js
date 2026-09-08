/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE GLUE: the only file that knows a browser exists.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * All the game proper (`engine.js`, `menu.js`, `clock.js`, `input/*`, `bot.js`,
 * `report.js`) is pure code: no `window`, no `document`, no `Date`, no
 * `Math.random`. That boundary is the reason a whole service can be played in
 * Node in twenty milliseconds. In here we touch the DOM, talk to the Minigames
 * SDK and read the real clock, and no game rule belongs here: if you feel like
 * writing a number in this file, the right place is `RULES`.
 *
 * ── HOW IT STARTS ───────────────────────────────────────────────────────
 *
 * The Minigames hub creates a `<div class="mg-game-root">` and calls
 * `spec.start({ container, modifiers, sdk })`. The game has no page of its own:
 * it builds the scene inside that container and takes it down in `stop()`.
 *
 * Plugins load alphabetically, so "fret-food" can arrive before the SDK: the
 * `__feedBackMinigamesPending` queue exists for exactly that, and is used
 * instead of waiting.
 *
 * ── WHAT THIS FILE ACTUALLY DOES ────────────────────────────────────────
 *
 * Six wires and nothing else. It picks where the chords come from, turns the
 * keys and clicks on the options plate into a pace, a cap on the counter and
 * a mode, hands the engine's snapshot to the scene once per frame, forwards
 * the engine's events to the scene so it can animate them, holds the service
 * for a pause or a quit, and reports the run to the hub when the service
 * closes.
 *
 * ── THE OPTIONS PLATE ───────────────────────────────────────────────────
 *
 * The hub's picker used to ask for the pace, the burners and the mode: three
 * rows of grey buttons with a word on each. A tester said the settings needed
 * explaining and needed to look like this game, and both are true, so the
 * manifest declares no modifiers now and the choice is made on a plate the
 * scene draws over the dining room (`options.js`), while the first customer
 * already sits with their ticket up. Arrows and Enter, a click, or the first
 * chord — which closes the plate and opens the kitchen in one gesture. Every
 * change is laid over the engine's rules on the spot (`setRules`) so the
 * ticket on the card is already the ticket the choice deals; the choice is
 * kept for next time; the address and whatever the hub still hands over
 * preselect it.
 */

import * as kit from './kit/index.js';
import { createGame, RULES, PACES, scoreOf } from './engine.js';
import { createOptions, menuLayout, menuHit, loadChoices, saveChoices } from './options.js';
import { GEO } from './art/geo.js';
import { MENU, LEVELS, chordsUpTo, label } from './menu.js';
import { inventMenu } from './invent.js';
import { createClock } from './clock.js';
import { createPort } from './input/port.js';
import { createFlaws } from './input/flaws.js';
import { createKeysAdapter } from './input/keys.js';
import { createDetectorAdapter } from './input/detector.js';
import { createEngineAdapter, audioBridge, earFor } from './input/engine.js';
import { botAdapter } from './bot.js';
import { createReport } from './report.js';
import { createScene } from './scene.js';
import { createSfx } from './sfx.js';
import { isTaken } from './kit/shortcuts.js';

const ID = 'fret-food';
const VERSION = '0.1.0';

/* Every event the scene can animate. Forwarded verbatim: the scene decides what
 * is worth a flourish, and this file does not get an opinion. */
const EVENTS = ['seat', 'strum', 'miss', 'open', 'cycle', 'step', 'serve', 'ruin', 'redeem', 'perfect', 'level', 'chainLost', 'over'];

/* The sprint: three minutes from the first chord. The modes themselves are
 * the options plate's rows (`options.js`); what each does to the rules is
 * `rulesFor`, below. */
const SPRINT_MS = 180000;

/* How long the hub is given to say what this player has unlocked before the
 * service starts without the answer. A local server answers in a few
 * milliseconds; a slow one is not worth a blank screen. */
const UNLOCKS_WAIT_MS = 500;

/* The mute key, beside the pause key: also free on the keyboard instrument. */
const MUTE_KEY = 'm';

/* How long the closing card stays on the screen before the hub takes over.
 *
 * `over` used to call `finish()` in the same tick, and `finish()` calls the
 * hub's `end()`, which hides the stage and tears the scene down in the same
 * frame. So the card the scene draws when the service closes — the mark, the
 * takings, served and lost, the service number that lets a service be played
 * again — was drawn once and never seen inside the app. It was only ever seen
 * in the preview, which has no hub. Three and a half seconds is long enough to
 * read four lines and short enough that nobody reaches for the Quit button. */
const OVER_HOLD_MS = 3400;

/* The pause key. Not Escape: the app owns Escape in the player and the hub's
 * own summary listens for it, and a pause that also navigates is not a pause.
 * `P` is free on the keyboard instrument (`c d e f g a b`, the digits) and it
 * is the letter people try first. */
const PAUSE_KEY = 'p';

/* Whether the coach has already spoken to this player, remembered across
 * services. The three tips are said in a first service and never again. */
const COACHED_KEY = 'fretfood.coached';

kit.install({ id: ID, version: VERSION });

/* ── where the chords come from ─────────────────────────────────────────
 *
 * The guitar, and nothing else a player can choose. `?fretfood_input=keys`
 * and `=scripted` exist for the preview and the bench, and a run from either
 * reports no score (`SCORE_MULT.input`). The keyboard used to be a setting as
 * well, and a setting is a thing a player finds: a service played on the C
 * key is not one the hub's dB should count, so the address is the only way
 * in, and it is a developer's way.
 */
function readWanted() {
  let q = null;
  try { q = new URLSearchParams(location.search); } catch (_) { /* not in a real browser */ }
  const url = q && q.get('fretfood_input');
  /* How hard the ear is, for a real guitar: `?fretfood_ear=easy|medium|hard`,
   * or the settings page's choice, or AUTO — which is the default and means
   * the first chord of the service decides (`earFor`). */
  let ear = null;
  try { ear = localStorage.getItem('fretfood.ear'); } catch (_) { /* private mode */ }
  return {
    source: url || 'detector',
    ear: (q && q.get('fretfood_ear')) || ear || 'auto',
    /* The mode, the pace and the pans, from the address, for the bench and
     * the preview: they preselect the options plate, which still shows. */
    mode: (q && q.get('fretfood_mode')) || null,
    profile: (q && q.get('profile')) || 'perfect',
    pace: (q && q.get('fretfood_pace')) || null,
    pans: Number(q && q.get('fretfood_pans')) || null,
    /*
     * ── THE SEED IS FRESH EVERY TIME, and it was not ──────────────────
     *
     * It read `Number(q.get('seed') || 7) || 7`, so without a seed in the URL
     * every session was seed 7: the same customers with the same names and
     * faces arriving in the same order, ordering the same dishes — and, since
     * the invented half of the menu comes out of the same seed, the same
     * thirty-five invented dishes as well. The second service a player ever
     * played was a repeat of the first, and nothing on the screen said why.
     *
     * That default was right for the bench and wrong for the game. It is a
     * fresh service now, and `?seed=` still pins one exactly: the closing card
     * prints the number, so a service worth playing again can be.
     */
    seed: Number(q && q.get('seed')) || freshSeed(),
  };
}

/** A seed nobody chose. `crypto` where there is one, because `Math.random`
 *  seeded from a coarse clock can hand two tabs opened together the same
 *  service — which is the one thing this is for. */
function freshSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    if (a[0]) return a[0];
  } catch (_) { /* no crypto: the clock and a random will do */ }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0 || 7;
}

/**
 * What a choice on the options plate does to the rules — the WHOLE set, every
 * time, because the choice can change while the plate is up and a rule the
 * last choice set has to be unset by this one: a pace is two numbers laid
 * over the rules (`PACES`), the pans one more (`MAX_STATIONS`), and a mode a
 * few — practice is strikes out of reach, the loop is one dish on one pot
 * aimed at the change the last report said was slowest, the sprint is a bell.
 * The critic is the hub's to switch on.
 */
function rulesFor(ch, unlocked, slow) {
  return Object.assign(
    {
      COOL: RULES.COOL, GROW_PER_S: RULES.GROW_PER_S, MAX_STATIONS: ch.pans,
      CRITIC: unlocked.has('critic'), STRIKES: RULES.STRIKES, LOOP: false, LOOP_TARGET: null, TIME_LIMIT_MS: 0,
    },
    PACES[ch.pace] || {},
    ch.mode === 'practice' ? { STRIKES: 9999 } : {},
    ch.mode === 'loop' ? { LOOP: true, STRIKES: 9999, MAX_STATIONS: 1, LOOP_TARGET: slow ? { from: slow.from, to: slow.to } : null } : {},
    ch.mode === 'sprint' ? { TIME_LIMIT_MS: SPRINT_MS } : {});
}

/**
 * What the hub says this player has earned, as bare ids (`critic`, `sprint`,
 * `signature`): the manifest declares the thresholds and the hub's profile
 * answers with `fret-food:<id>` for each one reached. A slow or absent hub
 * answers nothing within `ms`, and the service starts with nothing unlocked
 * rather than not at all.
 */
async function fetchUnlocks(ms) {
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch (_) {} }, ms);
    const r = await fetch('/api/plugins/minigames/profile', ctrl ? { signal: ctrl.signal } : undefined);
    clearTimeout(timer);
    const j = await r.json();
    const list = Array.isArray(j && j.unlocks) ? j.unlocks : [];
    return new Set(list.map((k) => String(k).replace(/^fret-food:/, '')));
  } catch (_) {
    return new Set();
  }
}

/** The last service's report, for the loop to aim at its slowest change. */
function lastReport() {
  try { return JSON.parse(localStorage.getItem('fretfood.lastReport') || 'null'); } catch (_) { return null; }
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Whether this is the player's first service, as far as this machine knows. */
function firstTime() {
  try { return !localStorage.getItem(COACHED_KEY); } catch (_) { return false; }
}

/** Is the focus inside a text field? Then a key is a key, not a command. */
function typing() {
  try {
    const el = document.activeElement;
    if (!el) return false;
    const tag = String(el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || !!el.isContentEditable;
  } catch (_) { return false; }
}

/**
 * Builds the source. It always returns something: if the detector is not
 * available the game still has to start, on the keyboard, with a badge that
 * says so, rather than showing an empty counter.
 */
function buildSource(kind, port, game, opts) {
  const rand = rng(opts.seed);
  const flaws = opts.profile && opts.profile !== 'perfect'
    ? createFlaws(opts.profile, rand, { pool: chordsUpTo(6) })
    : undefined;

  if (kind === 'keys') return { adapter: createKeysAdapter(port, { flaws }), label: 'keyboard' };

  /* The guitar, on the desktop build: the JUCE engine scores a chord shape
   * against the live audio with no chart and no song, which is the one road
   * that works. `detector.js` documents the three that do not.
   *
   * It is tried BEFORE the SDK's chord scoring, and not as a fallback after
   * it, because the SDK's road is the one that is closed: leaving it first
   * would mean every desktop player got the refusal and the keyboard while a
   * working engine sat one property away. */
  if (kind !== 'notedetect' && audioBridge()) {
    return { adapter: createEngineAdapter(port, { flaws, ear: opts.ear }), label: 'guitar' };
  }

  /* Inside the app "scripted" means the automatic player, not a list of chords
   * decided in advance. A fixed list would play what the counter is NOT asking
   * for, since customers arrive at random, and you would watch a service made
   * of nothing but misses. The bot reads the snapshot and cooks what is there,
   * which is the only way to watch the game actually work.
   * The fixed event script still exists, and it is the one the tests and
   * `tools/run.mjs` use, where a service has to be identical every run. */
  if (kind === 'bot' || kind === 'scripted') {
    return { adapter: botAdapter(port, game, { flaws }), label: 'script' };
  }
  return { adapter: createDetectorAdapter(port, Object.assign({ flaws }, opts)), label: 'guitar' };
}

/* ── the run ────────────────────────────────────────────────────────────── */

let live = null;

async function start({ container, modifiers, sdk }) {
  stop();                                   // idempotent: two starts are not two services

  const wanted = readWanted();
  /* What this player has earned, asked of the hub before the service starts:
   * the critic visits, the sprint opens and the menu grows with the dB the
   * hub keeps across its games. */
  const unlocked = await fetchUnlocks(UNLOCKS_WAIT_MS);
  const last = lastReport();
  const slow = last && Array.isArray(last.slowest) && last.slowest[0] ? last.slowest[0] : null;
  /* The choice: the address first, then whatever the hub still hands over,
   * then last time's, then the defaults. It is only the plate's opening
   * position — the plate itself is what decides. */
  const pinned = Object.assign({}, modifiers || {});
  if (wanted.pace) pinned.pace = wanted.pace;
  if (wanted.pans) pinned.pans = wanted.pans;
  if (wanted.mode) pinned.mode = wanted.mode;
  const options = createOptions({ saved: loadChoices(), pinned, unlocked });
  let ch = options.resolved();
  let pace = ch.pace, pans = ch.pans, mode = ch.mode;
  // A sprint not yet earned is a service, and the player is told so when the plate closes.
  let sprintLocked = ch.locked === 'sprint';
  /* The menu is the hand-written dishes plus invented ones, gated by tier:
   * see `invent.js`. Six a tier on top of the twenty-three named ones — nine
   * with the signature menu unlocked — out of the same seed as everything
   * else, so two players on one seed get one service. */
  const menu = inventMenu(MENU, wanted.seed, unlocked.has('signature') ? 9 : 6);
  const game = createGame({ menu, levels: LEVELS, seed: wanted.seed, rules: rulesFor(ch, unlocked, slow) });
  const report = createReport(game, { seed: wanted.seed, profile: wanted.profile, input: wanted.source });
  const scene = createScene(container);
  const port = createPort(wanted.source);
  /* The ear the guitar is heard with. AUTO starts in the MIDDLE — where the
   * answer between two shapes is sharpest — and the first chord moves it up
   * or down from there: see `earFor`. It started at the kindest grade, and a
   * session said why not: a kind ear names the ring of the last chord as the
   * next one. */
  const calibrate = wanted.ear === 'auto';
  const built = buildSource(wanted.source, port, game, Object.assign({}, wanted, { ear: calibrate ? 'medium' : wanted.ear }));
  let current = built.adapter;
  const clock = createClock();
  const sfx = createSfx();

  let label = built.label;
  let ended = false;
  let refused = false;                      // no guitar can be heard here: said once
  let toldKeys = false;
  let paused = false;
  let quitArmed = false;
  let overTimer = null;
  let calibrating = calibrate;
  const startedAt = Date.now();
  const coach = firstTime();
  scene.setCoach(coach);
  scene.setTimes(mode === 'practice');
  scene.setClosing({ seed: wanted.seed });

  /* ── the options plate ──────────────────────────────────────────────
   *
   * Up while the service is chosen. Arrows move the cursor and turn a value,
   * Enter and START close it, a click on a chip chooses it, and the first
   * chord closes it too — the kitchen opens on that chord as it always did.
   * Every change is laid over the rules at once, so the first ticket under
   * the plate is already the one the choice deals. */
  let menuOpen = true;
  const showMenu = () => { try { scene.setMenu(menuLayout(options, GEO)); } catch (_) {} };
  function applyChoices() {
    ch = options.resolved();
    pace = ch.pace; pans = ch.pans; mode = ch.mode;
    sprintLocked = ch.locked === 'sprint';
    game.setRules(rulesFor(ch, unlocked, slow));
    try { scene.setTimes(mode === 'practice'); } catch (_) {}
    showMenu();
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    try { scene.setMenu(null); } catch (_) {}
    saveChoices(null, options.toJSON());
    modeNotices();
  }
  /* What the mode is, said once when the plate closes, and why a sprint is a
   * service when it is not yet earned. Queued behind the keyboard's legend. */
  function modeNotices() {
    if (sprintLocked) {
      scene.say(['SPRINT OPENS AT 1000 DB', 'UNTIL THEN THIS IS A SERVICE', 'THE HUB COUNTS THE DB ACROSS ITS GAMES'], 5000);
    } else if (mode === 'practice') {
      scene.say(['PRACTICE', 'NO STRIKES - THE TIME OF EVERY CHANGE IS WRITTEN OVER ITS CARD', 'NOTHING IS SCORED'], 5000);
    } else if (mode === 'loop') {
      scene.say(['ONE DISH, ON A LOOP', slow ? 'WORKING ON ' + label(slow.from) + '-' + label(slow.to) + ', YOUR SLOWEST CHANGE LAST TIME' : 'THE SAME RECIPE EVERY TIME, ON ONE POT', 'NO STRIKES, NOTHING SCORED'], 5000);
    } else if (mode === 'sprint') {
      scene.say(['SPRINT', 'THREE MINUTES FROM THE FIRST CHORD', 'THE TAKINGS ARE THE SCORE'], 5000);
    }
  }
  showMenu();
  scene.onPointer((gx, gy) => {
    if (!menuOpen) return;
    const hit = menuHit(menuLayout(options, GEO), gx, gy);
    if (!hit) return;
    if (hit.kind === 'start') { closeMenu(); return; }
    if (options.set(hit.row, hit.value)) { try { sfx.cooked(); } catch (_) {} applyChoices(); }
  });

  /* The engine takes a chord and a quality, and nothing else. `null` means
   * something was heard that is not a chord of this game, and it is passed
   * straight through: the engine finds no station wanting it and files a miss.
   *
   * It is passed through rather than swapped for a placeholder chord, and that
   * is not tidiness. `strum` keeps the last shape the hand made, and a bleed of
   * ringing strings does not move your hand. A placeholder would move it, and
   * the next real change would be measured from a shape nobody ever played.
   */
  port.on('strum', (ev) => {
    if (!game.state.running || paused) return;
    // The first chord is the START button too: see the options plate above.
    if (menuOpen) closeMenu();
    /* THE FIRST CHORD SETS THE EAR. Heard with the kindest grade, its score
     * says what this guitar in this room can afford: a chord that comes back
     * nearly whole earns the strict ear, where the answer is sharpest; one
     * that barely clears the floor keeps the kind one. Once a service. */
    if (calibrating && ev.chord && label === 'guitar') {
      calibrating = false;
      const tier = earFor(ev.quality);
      try { if (current && current.setEar) current.setEar(tier); } catch (_) {}
      try {
        scene.say(['EAR SET FROM YOUR FIRST CHORD', 'THIS GUITAR GETS THE ' + tier.toUpperCase() + ' EAR',
          'PIN ONE IN SETTINGS IF IT HEARS TOO LITTLE OR TOO MUCH'], 5000);
      } catch (_) {}
    }
    game.strum(ev.chord === undefined ? null : ev.chord, ev.quality);
  });

  port.on('status', (ev) => {
    /* The detector is missing or cannot hold: no guitar can be heard here.
     *
     * This used to fall back to the keyboard, so the player was not left in
     * front of a counter that ignored them. It is not a fallback any more,
     * and the reason is the hub: it counts dB across its games, and a service
     * played on the C key in a browser is not a service. So the kitchen stays
     * closed, the scene says why in one line, and the badge says NO GUITAR
     * instead of claiming one. Whoever is developing has `?fretfood_input=keys`
     * and knows it. (Detection is a given on this app: nobody plays without an
     * instrument plugged in, or they are not the player this is for.)
     *
     * ONCE. Stopping the detector used to answer with another `ready: false`,
     * which landed back here, which stopped it again — a recursion that ran
     * until the stack gave out. The adapter no longer answers a stop it never
     * started, and this guard stands whether it does or not. */
    if (ev.ready === false && wanted.source === 'detector' && !refused) {
      refused = true;
      label = 'none';
      try { built.adapter.stop(); } catch (_) {}
      try {
        scene.say(['NO GUITAR CAN BE HEARD HERE', 'FRET FOOD NEEDS THE FEEDBACK DESKTOP BUILD AND A GUITAR PLUGGED IN',
          'THE KITCHEN STAYS CLOSED'], 9000);
      } catch (_) {}
    }
    updateBadge();
  });

  // The detector needs to know what to listen for, and that changes every step.
  const sync = () => port.setCandidates(game.snapshot().wants);
  for (const n of ['seat', 'step', 'serve', 'ruin']) game.on(n, sync);

  // Everything the scene animates comes through here, unchanged; and the
  // sounds hang off the same events. See `sfx.js` for why none has a pitch.
  function sound(n, e) {
    switch (n) {
      case 'cycle': if (e.late && e.late.length) sfx.spoiled(); else sfx.cooked(); break;
      case 'serve': sfx.served(e.tip); break;
      case 'ruin': sfx.lost(); break;
      case 'miss': sfx.miss(); break;
      case 'level': sfx.level(); break;
      case 'redeem': sfx.redeem(); break;
      case 'open': sfx.open(); break;
      default: break;
    }
  }
  for (const n of EVENTS) {
    game.on(n, (e) => {
      try { scene.event(n, e); } catch (_) { /* a drawing bug must not stop the service */ }
      try { sound(n, e); } catch (_) { /* nor a sound that fails */ }
    });
  }

  /* The service closes: the input is switched off, the closing card gets its
   * one line about the hand and its service number, and the hub is told
   * AFTER the card has been read. See `OVER_HOLD_MS`. */
  game.on('over', () => {
    try { current.stop(); } catch (_) {}
    if (paused) setPause(false);
    try {
      const r = report.finish();
      const slow = r.slowest && r.slowest[0];
      scene.setClosing({
        seed: wanted.seed,
        note: slow ? 'SLOWEST CHANGE ' + label(slow.from) + '-' + label(slow.to) + ' ' + (slow.ms / 1000).toFixed(1) + 'S' : null,
      });
    } catch (_) { /* the card can do without the line */ }
    overTimer = setTimeout(() => finish('over'), OVER_HOLD_MS);
  });

  /* One snapshot per frame, and no throttle.
   *
   * This used to hand the scene twenty a second, on the reasoning that the eye
   * does not need a hundred. The eye does not; the SCENE does. It draws up to
   * sixty frames a second, and a heat bar fed at twenty climbs in three-frame
   * steps while everything around it moves smoothly — and a gate counted in
   * game time, which advances in ten millisecond steps, does not even land on
   * the frames evenly. A snapshot is a plain object over five stations and
   * costs a fraction of the frame that is about to draw it, so the numbers on
   * the screen are simply never older than the picture they are drawn on. */
  function render() {
    scene.update(game.snapshot());
  }

  /* ── the pause ────────────────────────────────────────────────────────
   *
   * A practice tool gets interrupted: a string to tune, a hand to reposition,
   * somebody at the door. Every interruption used to cost customers, and the
   * hub's Quit button archived the service on the first click. So `P` holds
   * the picture, the window losing focus holds it too, and Quit holds it and
   * asks — a second click closes, `P` goes back to cooking. The engine never
   * hears about any of this: the clock below simply stops feeding it. */
  function setPause(on, why) {
    if (ended || game.state.over) return;
    paused = !!on;
    if (!paused) quitArmed = false;
    try {
      scene.setPaused(paused
        ? (why === 'quit'
          ? { title: 'CLOSE THE SERVICE?', sub: 'QUIT AGAIN TO CLOSE - P TO KEEP COOKING' }
          : { title: 'PAUSED', sub: 'P TO KEEP COOKING' })
        : null);
    } catch (_) { /* the drawing must not stop the service */ }
  }
  function onKey(e) {
    if (!e || e.repeat || e.altKey || e.metaKey || e.ctrlKey || typing()) return;
    const k = String(e.key || '').toLowerCase();
    if (menuOpen) {
      /* The plate: arrows, Enter. The chord keys are not caught here — they
       * reach the keyboard instrument, whose strum closes the plate as a
       * guitar's would. P holds nothing before the first chord; M still mutes. */
      const raw = String(e.key || '');
      const stop = () => { if (typeof e.preventDefault === 'function') e.preventDefault(); };
      if (raw === 'ArrowUp' || raw === 'ArrowDown') { stop(); options.move(raw === 'ArrowUp' ? -1 : 1); showMenu(); return; }
      if (raw === 'ArrowLeft' || raw === 'ArrowRight') {
        stop();
        options.turn(raw === 'ArrowLeft' ? -1 : 1);
        try { sfx.cooked(); } catch (_) {}
        applyChoices();
        return;
      }
      if (raw === 'Enter') { stop(); closeMenu(); return; }
      if (k === PAUSE_KEY) return;
    }
    if (k === PAUSE_KEY) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      setPause(!paused);
    } else if (k === MUTE_KEY) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const off = sfx.mute();
      try { scene.say([off ? 'SOUND OFF' : 'SOUND ON', 'M TURNS IT ' + (off ? 'BACK ON' : 'OFF')], 1800); } catch (_) {}
    }
  }
  function onBlur() {
    // Before the first chord nothing is running, so there is nothing to hold.
    if (game.state.started && !game.state.over) setPause(true);
  }
  try { document.addEventListener('keydown', onKey); } catch (_) {}
  try { window.addEventListener('blur', onBlur); } catch (_) {}

  const badge = mountBadge(sdk);
  claimQuit(() => {
    if (ended) return;
    // Nothing to lose before the first chord, and nothing left to lose after
    // the last one: those quits are immediate.
    if (game.state.over || !game.state.started || quitArmed) { finish('quit'); return; }
    quitArmed = true;
    setPause(true, 'quit');
  });

  /* The keys, said once, where the player is looking. The badge in the hub's
   * bar is eleven pixels at sixty-five percent, and it was the only sign that
   * a guitar was not being heard; the caret in `^D` was a question mark in a
   * font that had no caret. So when the keyboard is what is talking the scene
   * says so, with the keys, and says why when a guitar was expected. */
  function tellKeys() {
    if (toldKeys) return;
    toldKeys = true;
    const lines = ['KEYBOARD ON - FOR DEVELOPMENT - NOTHING IS SCORED'];
    lines.push('C D E F G A B PLAY THE CHORDS - SHIFT FOR THE OTHER ONE');
    lines.push('1 TO 6 PLAY THE 7THS AND THE FLATS - P PAUSES - M MUTES');
    lines.push('7 8 9 Q W R Y U AND SHIFT-G PLAY THE OTHER SHAPES - THE CARD SAYS WHICH');
    let shared = [];
    try { shared = ['c', 'd', 'e', 'f', 'g', 'a', 'b', 'p'].filter((k) => isTaken(k)); } catch (_) {}
    if (shared.length) lines.push('KEY ' + shared.join(' ').toUpperCase() + ' IS ALSO USED BY THE APP');
    try { scene.say(lines, 7000); } catch (_) {}
  }

  function updateBadge() {
    // The scene prints the key beside each chord when the keyboard is what is
    // talking, so the badge and the hints are decided in the same place.
    try { scene.setHints(label === 'keyboard'); } catch (_) {}
    try { scene.setSeed(wanted.seed); } catch (_) {}
    if (label === 'keyboard') tellKeys();
    if (!badge) return;
    const text = label === 'guitar' ? 'GUITAR' : label === 'keyboard' ? 'KEYBOARD' : label === 'none' ? 'NO GUITAR' : 'SCRIPT';
    if (badge.textContent !== text) badge.textContent = text;
  }
  updateBadge();

  current.start(clock);
  sync();
  scene.update(game.snapshot());

  clock.start((dt, t) => {
    if (paused) return;
    if (current.pump) current.pump(t);
    game.tick(dt);
  }, render);

  function finish(why) {
    if (ended) return;
    ended = true;
    if (overTimer) { clearTimeout(overTimer); overTimer = null; }
    clock.stop();
    try { current.stop(); } catch (_) {}
    try { sfx.destroy(); } catch (_) {}
    try { document.removeEventListener('keydown', onKey); } catch (_) {}
    try { window.removeEventListener('blur', onBlur); } catch (_) {}
    const snap = game.snapshot();
    const r = report.finish();
    // The coach has spoken, if there was anything to speak over: a service quit
    // before its first chord does not use up the first-time tips.
    if (coach && game.state.started) { try { localStorage.setItem(COACHED_KEY, '1'); } catch (_) {} }
    /* The score is the takings scaled by what was chosen — see `scoreOf` —
     * so a personal best is not beaten by choosing an easier service. And by
     * what played: only the guitar scores, the keyboard and the script are
     * development inputs and report nothing. */
    const input = label === 'guitar' ? 'guitar' : label === 'keyboard' ? 'keyboard' : 'script';
    const { score, mult } = scoreOf(game.state.cash, { pace, pans, mode, input });
    try {
      sdk.end({
        score,
        durationMs: Date.now() - startedAt,
        // The choice, in the shape the hub's own picker used to hand over,
        // so a Play Again with cached options reopens the plate on it.
        modifiers: { pace, pans: String(pans), mode: sprintLocked ? 'sprint' : mode },
        meta: {
          input: label, profile: wanted.profile, seed: wanted.seed, pace, pans, mode, mult, why,
          cash: game.state.cash, level: r.level, served: r.served, ruined: r.ruined,
          cycles: r.cycles, cleanRatio: r.cleanRatio, hash: r.hash,
          comboBest: snap.comboBest, slowest: r.slowest, ear: (current && current.stats && current.stats.ear) || null,
        },
        summaryHtml: summary(r, snap, { seed: wanted.seed, pace, pans, mode, mult, score, input }),
      });
    } catch (e) {
      console.warn('[fret-food] end() complained:', e);
    }
    try { localStorage.setItem('fretfood.lastReport', JSON.stringify(r)); } catch (_) {}
  }

  live = { game, clock, scene, port, adapter: current, finish, badge, pause: setPause };
  /* A service door for the console inside the app: it is how you check that
   * what is on the screen really is the state, instead of trusting the drawing.
   */
  try {
    window.__fretfood = {
      snapshot: () => game.snapshot(),
      state: () => game.state,
      report: () => report.finish(),
      // What the loop has had to swallow. Empty is the answer you want.
      faults: () => (clock.faults ? clock.faults() : []),
      /* What the input is hearing, which is the difference between "it does
       * not work" and a diagnosis. `label` says which road is live; on the
       * guitar, `onsets` counts strums the level detector saw, `named` the
       * ones a chord was found for, `unknown` the ones where nothing on the
       * counter fitted, `ring` the ones that were the chord the hand already
       * held and `quick` the ones that named a change faster than a hand can
       * make one. No onsets means the level is not reaching the app (input
       * device, gain); onsets without names means the ear is too strict for
       * this guitar — try `?fretfood_ear=easy`; `ring` climbing with the
       * pots cooking is the ear doing its job. `road` says which of the two
       * the engine gave us: `notes` is the polyphonic detector naming what
       * rang, `shapes` the older per-shape scorer, and `air` is the last set
       * of pitches the notes road heard. */
      input: () => Object.assign({ label, source: wanted.source, pace }, (current && current.stats) || {}),
      // The options plate: whether it is up, and what it says.
      menu: () => ({ open: menuOpen, choices: options.toJSON(), resolved: options.resolved() }),
      // What the drawing is costing, and how many of the panel's frames it is
      // using. It is the only way to answer "is it smooth here" on a machine
      // that is not this one.
      stats: () => scene.stats,
      pause: (on) => setPause(on === undefined ? !paused : !!on),
      // The scene itself, for checking a notice or an overlay from the console.
      scene,
      end: () => finish('debug'),
    };
  } catch (_) {}
}

/**
 * Takes over the hub's Quit button, and it is not rudeness.
 *
 * The hub wires that button to `end({ score: 0 })` (minigames/screen.js:727),
 * and `end()` clears its own session BEFORE it calls the game's `stop()`
 * (screen.js:754 then :762). So a game that reports its score from `stop()`
 * reports it into a session that no longer exists, and every quit lands on the
 * leaderboard as a zero. Measured in the app: a run worth $1,345 with nineteen
 * dishes out was recorded as SCORE 0.
 *
 * That is the wrong rule for this game. You cooked those dishes; walking away
 * from the counter does not un-cook them, and a leaderboard that only ever sees
 * runs which ended in failure is not a leaderboard. So the button is rebound to
 * finish the run properly first, which reaches `end()` while the session is
 * still open — and, since the pass above, to ASK first: the first click holds
 * the service and the second closes it.
 *
 * If the host ever stops mounting that button, nothing happens and the hub's
 * own behaviour stands.
 */
function claimQuit(onQuit) {
  try {
    const quit = document.getElementById('mg-stage-quit');
    if (quit) quit.onclick = onQuit;
  } catch (_) { /* not inside the hub */ }
}

/**
 * The one thing left in the hub's own HUD bar: which input is live.
 *
 * Everything else the player reads is inside the scene, where a game keeps it.
 * This stays outside because it is not part of the fiction: it answers "is my
 * guitar actually being heard", and that question is about the app, not about
 * the kitchen. Styled inline on purpose, so it survives whatever the scene's
 * stylesheet turns into.
 */
function mountBadge(sdk) {
  try {
    sdk.ui.mountHUD('<span class="kc-src" style="font:700 11px ui-monospace,monospace;'
      + 'letter-spacing:.12em;opacity:.65"></span>');
  } catch (_) { return null; }
  try { return document.querySelector('#mg-stage-hud .kc-src'); } catch (_) { return null; }
}

/**
 * The run summary the hub shows under its own three numbers.
 *
 * It said "Clean cycles 90 (54%)", and the ninety was the total, not the clean
 * ones; a run with nothing served said "1 (100%)". It now says how many steps
 * out of how many beat the clock, names the changes that took the hand longest
 * — the one thing a chord-change drill owes its player — and prints the service
 * number with the way to play it again. `.kc-summary` in the stylesheet is the
 * shape.
 */
function summary(r, snap, extra) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const money = (n) => '$' + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const pct = (x) => (x === null || x === undefined ? '-' : Math.round(x * 100) + '%');
  const slow = (r.slowest || []).map((c) => label(c.from) + '→' + label(c.to) + ' ' + (c.ms / 1000).toFixed(1) + ' s').join(' · ');
  const pace = String(extra.pace || 'normal');
  const mode = String(extra.mode || 'service');
  const mult = extra.mult === undefined ? 1 : extra.mult;
  const devInput = extra.input && extra.input !== 'guitar';
  return '<dl class="kc-summary">'
    + (mode !== 'service' ? '<dt>Mode</dt><dd>' + esc(mode.charAt(0).toUpperCase() + mode.slice(1)) + '</dd>' : '')
    + (devInput
      ? '<dt>Score</dt><dd>' + esc(money(snap.cash || 0)) + ' <small>not scored: played from the ' + esc(extra.input) + ', which is for development</small></dd>'
      : mult !== 1
        ? '<dt>Score</dt><dd>' + esc(money(snap.cash || 0)) + ' <small>x ' + esc(mult.toFixed(2)) + ' for what was chosen = ' + esc(extra.score) + '</small></dd>'
        : '')
    + '<dt>Service</dt><dd>' + esc(snap.levelName || '') + ' <small>level ' + r.level + '</small></dd>'
    + '<dt>Dishes out</dt><dd><b>' + r.served + '</b></dd>'
    + '<dt>Customers lost</dt><dd>' + r.ruined + '</dd>'
    + '<dt>Best combo</dt><dd>x' + (snap.comboBest || 0) + '</dd>'
    + '<dt>Clean steps</dt><dd>' + (r.cleanSteps === undefined ? r.cycles : r.cleanSteps) + ' of ' + r.cycles
    + ' <small>' + pct(r.cleanRatio) + '</small></dd>'
    + (slow ? '<dt>Slowest changes</dt><dd>' + esc(slow) + '</dd>' : '')
    + (pace !== 'normal' ? '<dt>Pace</dt><dd>' + esc(pace.charAt(0).toUpperCase() + pace.slice(1)) + '</dd>' : '')
    + (extra.pans && extra.pans < 5 ? '<dt>Burners</dt><dd>' + esc(extra.pans) + ' of 5</dd>' : '')
    + '<dt>Service no.</dt><dd>' + esc(extra.seed) + ' <small>?seed=' + esc(extra.seed) + ' plays it again</small></dd>'
    + '</dl>';
}

function stop() {
  if (!live) return;
  try { live.finish('stop'); } catch (_) {}
  try { live.clock.stop(); } catch (_) {}
  try { live.adapter.stop(); } catch (_) {}
  try { live.scene.destroy(); } catch (_) {}
  try { delete window.__fretfood; } catch (_) {}
  live = null;
}

/* ── the settings page ─────────────────────────────────────────────────
 *
 * Two things are a player's and not a service's, and they live here rather
 * than on the options plate: which ear hears the guitar, and whether the game
 * makes its sounds. The keyboard was a third and is not any more — see
 * `readWanted` — because a setting is a thing a player finds, and a service
 * from the keyboard is not one the hub should count. `settings.html` is a
 * shim that asks for `mountSettings`; the page is built here, beside the code
 * that reads the values, with the kit's controls, so the two cannot fall out
 * of step. Values are kept in `localStorage` under the keys the game already
 * read; the default is stored as an absence.
 */
const SETTINGS = {
  ear: { key: 'fretfood.ear', fallback: 'auto', values: ['auto', 'easy', 'medium', 'hard'] },
  sound: { key: 'fretfood.sound', fallback: 'on', values: ['on', 'off'] },
};

function readSetting(name) {
  const s = SETTINGS[name];
  if (!s) return null;
  try {
    const v = localStorage.getItem(s.key);
    return s.values.includes(v) ? v : s.fallback;
  } catch (_) { return s.fallback; }
}

function writeSetting(name, value) {
  const s = SETTINGS[name];
  if (!s || !s.values.includes(value)) return false;
  try {
    if (value === s.fallback) localStorage.removeItem(s.key);
    else localStorage.setItem(s.key, value);
  } catch (_) { /* private mode: the choice lasts the session */ }
  return true;
}

function mountSettings(root) {
  const c = kit.controls;
  root.textContent = '';
  root.classList.add('kc-settings');

  const seg = (name, items, aria) => {
    const s = c.segmented(items.map(([value, label]) => ({ value, label })), (v) => {
      writeSetting(name, v);
      s.set(v);
    }, aria);
    s.set(readSetting(name));
    return s;
  };
  const block = (title, label, note, control) => {
    root.appendChild(c.section(title));
    const f = c.field({ label });
    f.body.appendChild(control.el);
    root.appendChild(f.el);
    root.appendChild(c.el('p', 'kc-settings-note', note));
  };

  block('THE EAR', 'How the guitar is heard',
    'Auto lets the first chord of every service decide: it is heard with the kindest ear, and how well it '
    + 'comes back picks the grade for the rest of the service. Pin a grade if the game hears too little '
    + '(easy) or takes chords you did not play (hard).',
    seg('ear', [['auto', 'Auto'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], 'Ear'));
  block('SOUND', 'Knocks and clicks',
    'Every sound the game makes is a short knock and never a note, so the microphone that hears your '
    + 'guitar is not fooled by it. M mutes during a service.',
    seg('sound', [['on', 'On'], ['off', 'Off']], 'Sound'));
  root.appendChild(c.el('p', 'kc-settings-note',
    'The chords come from your guitar, through the fee[dB]ack desktop build. There is no keyboard '
    + 'option: a service played from the keys would not be a service, and the hub would count it.'));
}

try {
  window.fretFood = {
    version: VERSION,
    mountSettings,
    settings: { get: readSetting, set: writeSetting },
  };
} catch (_) { /* not in a browser */ }

/* ── registration ────────────────────────────────────────────────────────
 *
 * `spec.id` has to be identical to the `id` in `plugin.json`, or runs land on
 * the leaderboard under a game that does not exist and the hub falls back to
 * the title written here instead of the manifest's.
 */
const spec = { id: ID, title: 'Fret Food', start, stop };

if (window.feedBackMinigames) {
  window.feedBackMinigames.register(spec);
} else {
  (window.__feedBackMinigamesPending = window.__feedBackMinigamesPending || []).push(spec);
}
