import { newGame, play } from '../tests/harness.js';
import { RULES } from '../src/engine.js';
import { LEVELS } from '../src/menu.js';
const g = newGame({ seed: 6, rules: { STRIKES: 99 } });
const r = play(g, { events: [], ms: RULES.LEVEL_MS * (LEVELS.length + 1) + 1000 });
console.log('t', g.state.t, 'level', g.state.level, 'running', g.state.running, 'over', g.state.over, 'strikes', g.state.strikes);
console.log('livelli emessi', r.log.filter(e => e.ev === 'level').length, 'over', r.log.filter(e => e.ev === 'over').length);
