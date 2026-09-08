/*
 * ─────────────────────────────────────────────────────────────────────────
 * THE SOUNDS, and why every one of them is a knock and not a note.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * An arcade game without sound loses half its feedback: a step that cooks, a
 * dish that goes out, a customer who leaves — each of those is a moment the
 * ear should get before the eye does. But this game is PLAYED INTO A
 * MICROPHONE. Whatever the speakers say, the guitar's pickup or the room mic
 * hears too, and the engine scores what it hears against the chords on the
 * counter. A chime is a pitched thing: a bell at 660 Hz is an E, and an E in
 * the room is a string the scorer will count. So nothing here has a pitch.
 * Every sound is a short burst of filtered noise with a fast decay — a wood
 * block, a pan lid, a till drawer, a thud — a few tens of milliseconds long,
 * at a volume well under the guitar's, and none of it lines up with a
 * fundamental the harmonic verifier could mistake for a string.
 *
 * Synthesised, not sampled: no assets, no loading, and every parameter is a
 * number somebody can read. `M` mutes, and the choice is remembered.
 *
 * The AudioContext is made on the first sound, never at load: browsers refuse
 * a context that no user gesture preceded, and the hub's Start button is that
 * gesture. Nothing here throws — a machine with no audio gets a silent game
 * and not a broken one.
 */

const VOLUME = 0.22;
const KEY = 'fretfood.sound';

export function createSfx(opts) {
  const o = opts || {};
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = (o.storage || localStorage).getItem(KEY) === 'off'; } catch (_) { /* no storage */ }

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }

  /* One burst of noise through a band-pass, shaped by an envelope. `hz` is
   * the band's centre — a colour, not a pitch: the band is wide (Q around 1)
   * and the burst is too short to read as a tone. */
  function knock(hz, ms, gain, q) {
    const c = ensure();
    if (!c || muted) return;
    try {
      if (c.state === 'suspended') c.resume().catch(() => {});
      const n = Math.max(1, Math.round((c.sampleRate * ms) / 1000));
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = hz;
      f.Q.value = q || 1;
      const g = c.createGain();
      const t = c.currentTime;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
      src.stop(t + ms / 1000 + 0.01);
    } catch (_) { /* a sound that fails is a sound nobody hears */ }
  }

  const later = (fn, ms) => { try { setTimeout(fn, ms); } catch (_) {} };

  return {
    /** A step cooked: one tap of a spoon on a pan. */
    cooked() { knock(1800, 45, 0.7, 1.2); },
    /** Under the line: the same tap, dull. */
    spoiled() { knock(500, 70, 0.6, 0.8); },
    /** A dish out: the till drawer, two knocks. With a tip, a third. */
    served(tip) { knock(2600, 35, 0.6, 1.5); later(() => knock(3200, 30, 0.5, 1.5), 70); if (tip) later(() => knock(3800, 30, 0.45, 1.5), 140); },
    /** A customer lost: a pan lid dropped. */
    lost() { knock(240, 160, 0.9, 0.7); later(() => knock(180, 120, 0.5, 0.7), 90); },
    /** A chord nobody wanted: a dry click. */
    miss() { knock(900, 25, 0.35, 2); },
    /** The bell of a level: a shaker, not a bell. */
    level() { knock(4000, 90, 0.5, 0.6); later(() => knock(4200, 90, 0.4, 0.6), 110); },
    /** A ticket won back: three rising knocks. */
    redeem() { knock(1400, 40, 0.6, 1.4); later(() => knock(2000, 40, 0.6, 1.4), 90); later(() => knock(2800, 50, 0.6, 1.4), 180); },
    /** The kitchen opens: one knock on the pass. */
    open() { knock(1100, 60, 0.6, 1); },
    mute(on) {
      muted = on === undefined ? !muted : !!on;
      if (master) master.gain.value = muted ? 0 : VOLUME;
      try { (o.storage || localStorage).setItem(KEY, muted ? 'off' : 'on'); } catch (_) {}
      return muted;
    },
    get muted() { return muted; },
    destroy() {
      try { if (ctx) ctx.close(); } catch (_) {}
      ctx = null; master = null;
    },
  };
}
