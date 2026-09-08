import { MENU, dist, CHORDS } from '../src/menu.js';
console.log('liv  prezzo  passi  piatto');
for (const m of MENU) {
  let d = 0; for (let i=1;i<m.steps.length;i++) d += dist(m.steps[i-1], m.steps[i]);
  console.log(String(m.level).padStart(2), String(m.price).padStart(6), String(m.steps.length).padStart(5),
    '  ' + m.dish.padEnd(24), m.steps.join(' ').padEnd(22), 'dita ' + d);
}
console.log('\nmatrice delle distanze:');
process.stdout.write('     ' + CHORDS.map(c=>c.padStart(3)).join('') + '\n');
for (const a of CHORDS) process.stdout.write(a.padStart(4) + ' ' + CHORDS.map(b=>String(dist(a,b)).padStart(3)).join('') + '\n');
