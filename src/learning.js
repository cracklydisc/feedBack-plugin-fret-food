import { CHORDS } from './menu.js';

export const MIN_OBSERVATIONS = 5;
export const HISTORY_KEY = 'fretfood.learning.v1';
export const DEFAULT_PAIR = { from: 'C', to: 'G' };
export const validPair = p => !!p && p.from !== p.to && CHORDS.includes(p.from) && CHORDS.includes(p.to);
export const median = values => {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y), m = Math.floor(a.length / 2);
  return Math.round(a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2);
};
export function learningContext(o = {}) {
  const pans = o.mode === 'loop' ? 1 : Number(o.pans || 5);
  return { mode: o.mode || 'service', kind: o.mode === 'loop' ? 'pair-drill' : pans === 1 ? 'single-pot' : 'service',
    assistance: o.assistance === 'memory' ? 'memory' : 'guided', input: o.input || 'unknown',
    ear: o.ear || 'unknown', profile: o.profile || 'none', pace: o.pace || 'normal', pans };
}
export const contextKey = o => JSON.stringify(learningContext(o));

/** Measures accepted transitions once per input, not once per pan. Initial waits,
 * customer turnover and repeats are not hand changes. Errors and revealed hints
 * remain observable, but never enter the unassisted/first-attempt median. */
export function createLearning(game, initial = {}) {
  let context = learningContext(initial), last = null, errors = 0;
  const trials = [], answers = [], requests = [], failedLessons = [], revealed = new Set(), attempts = new Map();
  const token = st => st && st.order ? `${st.i}:${st.seatAt}:${st.order.id}:${st.step}` : null;
  const active = () => game.state.stations.filter(st => st.order);
  const markError = () => {
    errors++;
    for (const st of active()) { const key = token(st); attempts.set(key, (attempts.get(key) || 0) + 1); }
  };
  game.on('miss', markError); game.on('rough', markError);
  game.on('cycle', e => {
    const targetStates = e.stations.map(i => game.state.stations[i]).filter(Boolean);
    const helped = targetStates.some(st => revealed.has(token(st)));
    const precededByError = errors > 0;
    if (last && last.chord !== e.chord) trials.push({ from: last.chord, to: e.chord,
      ms: game.state.t - last.t, helped, precededByError, late: !!e.late?.length });
    for (const st of targetStates) {
      const key = token(st);
      answers.push({ chord: e.chord, firstTry: !attempts.get(key), helped: revealed.has(key),
        lesson: st.order.lessonChord === e.chord, lost: false });
      attempts.delete(key); revealed.delete(key);
    }
    last = { chord: e.chord, t: game.state.t }; errors = 0;
  });
  const clear = e => {
    const st = game.state.stations[e.station];
    if (st?.order && e.strikes !== undefined) {
      const chord = st.order.steps[st.step];
      answers.push({ chord, firstTry: false, helped: revealed.has(token(st)),
        lesson: st.order.lessonChord === chord, lost: true });
      if (st.order.lessonChord) failedLessons.push(st.order.lessonChord);
    }
    if (!active().some(s => s.i !== e.station)) { last = null; errors = 0; }
    for (const key of revealed) if (key.startsWith(e.station + ':')) revealed.delete(key);
    for (const key of attempts.keys()) if (key.startsWith(e.station + ':')) attempts.delete(key);
  };
  game.on('serve', clear); game.on('ruin', clear);
  return {
    setContext(o) { if (game.state.started) return false; context = learningContext(o); return true; },
    breakTiming() { last = null; errors = 0; },
    reveal(i) {
      if (context.assistance !== 'memory' || game.state.over) return false;
      const key = token(game.state.stations[i]);
      if (!key || revealed.has(key)) return false;
      revealed.add(key); requests.push({ chord: game.state.stations[i].order.steps[game.state.stations[i].step] });
      return true;
    },
    visible(i) { return context.assistance !== 'memory' || revealed.has(token(game.state.stations[i])); },
    snapshot(snap) { return { ...snap, assistance: context.assistance,
      stations: snap.stations.map(st => ({ ...st, diagramVisible: context.assistance !== 'memory' || revealed.has(token(game.state.stations[st.i])) })) }; },
    finish({ closed = false } = {}) {
      const pairs = new Map();
      for (const t of trials) {
        const key = t.from + '>' + t.to;
        if (!pairs.has(key)) pairs.set(key, { from: t.from, to: t.to, observations: 0, afterError: 0, helped: 0, clean: 0, samples: [] });
        const p = pairs.get(key); p.observations++; p.afterError += +t.precededByError; p.helped += +t.helped;
        p.clean += +(!t.precededByError && !t.late);
        if (!t.precededByError && !t.helped) p.samples.push(t.ms);
      }
      const abandoned = closed ? active().filter(st => st.order.lessonChord).map(st => st.order.lessonChord) : [];
      const chords = [...new Set(answers.map(a => a.chord).concat(requests.map(r => r.chord), failedLessons, abandoned))].map(chord => {
        const a = answers.filter(x => x.chord === chord);
        return { chord, observations: a.length, firstTry: a.filter(x => x.firstTry && !x.helped && !x.lost).length,
          helped: a.filter(x => x.helped).length, lost: a.filter(x => x.lost).length,
          lessonAttempts: a.filter(x => x.lesson).length, lessonLost: failedLessons.filter(x => x === chord).length,
          lessonAbandoned: abandoned.filter(x => x === chord).length };
      });
      return { version: 1, context, helpRequests: requests.length, chords,
        pairs: [...pairs.values()].map(p => ({ ...p, n: p.samples.length, medianMs: median(p.samples),
          samples: p.samples.slice(-100), eligible: p.samples.length >= MIN_OBSERVATIONS })) };
    },
  };
}

export function loadLearning(storage) {
  try { const data = JSON.parse((storage || localStorage).getItem(HISTORY_KEY));
    if (data?.version !== 1 || !Array.isArray(data.sessions)) return { version: 1, sessions: [], records: {} };
    data.sessions = data.sessions.filter(s => s && s.context && Array.isArray(s.pairs) && Array.isArray(s.chords)).slice(-24);
    data.records = data.records && typeof data.records === 'object' ? data.records : {};
    return data;
  } catch { return { version: 1, sessions: [], records: {} }; }
}
export function saveLearning(report, score, storage) {
  const data = loadLearning(storage), key = contextKey(report.context);
  data.sessions = [...data.sessions, report].slice(-24);
  data.records ||= {};
  if (score !== null) data.records[key] = Math.max(data.records[key] || 0, Number(score) || 0);
  try { (storage || localStorage).setItem(HISTORY_KEY, JSON.stringify(data)); } catch { /* storage can be unavailable */ }
  return score === null ? null : data.records[key];
}
/** Prefer evidence from a matching isolated exercise. Never rank a one-off mean
 * or mix assistance, input, detector configuration, pace or counter load. */
export function recommendPair(history, context) {
  const matching = (history?.sessions || []).filter(s => contextKey(s.context) === contextKey(context));
  const pairs = new Map();
  for (const s of matching) for (const p of s.pairs || []) {
    if (!validPair(p)) continue;
    const key = p.from + '>' + p.to;
    if (!pairs.has(key)) pairs.set(key, { from: p.from, to: p.to, samples: [] });
    pairs.get(key).samples.push(...(p.samples || []).filter(x => Number.isFinite(x) && x >= 0));
  }
  return [...pairs.values()].filter(p => p.samples.length >= MIN_OBSERVATIONS)
    .map(p => ({ from: p.from, to: p.to, n: p.samples.length, medianMs: median(p.samples) }))
    .sort((a, b) => b.medianMs - a.medianMs)[0] || null;
}

export function previousRecall(history, report) {
  const previous = [...(history?.sessions || [])].reverse().find(s => s.chords?.some(c => c.observations) && contextKey(s.context) === contextKey(report.context));
  if (!previous) return [];
  return report.chords.flatMap(c => {
    const old = previous.chords.find(p => p.chord === c.chord);
    return old && c.observations && old.observations ? [{ chord: c.chord, now: c, previous: old }] : [];
  });
}

export function chooseLoopTarget(history, options) {
  const base = learningContext(options);
  for (const session of [...(history?.sessions || [])].reverse()) {
    const c = session.context;
    if (c.assistance !== base.assistance || c.input !== base.input || c.ear !== base.ear
      || c.profile !== base.profile || c.pace !== base.pace) continue;
    // A service candidate is a reason to try a drill, not a drill measurement.
    const pair = recommendPair(history, c);
    if (pair) return { ...pair, source: c.kind };
  }
  return null;
}
