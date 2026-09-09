import { MIN_OBSERVATIONS } from './learning.js';
import { previewName } from './art/recipe.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const seconds = n => n === null ? '—' : (n / 1000).toFixed(2) + ' s';
export function learningSummary(r, previous = [], next = null, record = null) {
  if (!r) return '';
  const c = r.context;
  const kind = c.kind === 'pair-drill' ? 'Isolated pair exercise' : c.kind === 'single-pot' ? 'Single-pot exercise' : 'Service decisions and changes';
  const rows = r.pairs.slice().sort((a, b) => (b.medianMs || 0) - (a.medianMs || 0)).map(p =>
    '<tr><th scope="row">' + esc(previewName(p.from) + ' → ' + previewName(p.to)) + '</th><td>' + seconds(p.medianMs)
    + '</td><td>' + p.n + '/' + p.observations + '</td></tr>'
    + '<tr class="kc-change-note"><td colspan="3">Clean: ' + p.clean + ' · After error: ' + p.afterError
    + ' · Helped: ' + p.helped + '</td></tr>').join('');
  const recall = r.chords.reduce((a, x) => ({ n: a.n + x.observations, first: a.first + x.firstTry, lost: a.lost + x.lost }), { n: 0, first: 0, lost: 0 });
  const comparison = previous.map(p => esc(previewName(p.chord)) + ': ' + p.now.firstTry + '/' + p.now.observations
    + ' now; ' + esc(p.previous.firstTry) + '/' + esc(p.previous.observations) + ' previously').join(' · ');
  const lessons = r.chords.filter(p => p.lessonAttempts || p.lessonLost || p.lessonAbandoned).map(p => esc(previewName(p.chord)) + ': '
    + p.lessonAttempts + ' observations, ' + p.lessonLost + ' lost, ' + p.lessonAbandoned + ' abandoned').join(' · ');
  return '<dl class="kc-summary"><dt>First attempts</dt><dd>' + recall.first + '/' + recall.n
    + (c.assistance === 'memory' ? ' · ' + r.helpRequests + ' hints' : ' · guided') + '</dd></dl>'
    + '<p class="kc-next"><strong>Next practice</strong> ' + (next ? esc(previewName(next.from) + ' ↔ ' + previewName(next.to))
      + '<small>Choose LOOP · ' + seconds(next.medianMs) + ' median · n=' + next.n + '</small>'
      : 'Keep gathering changes.<small>Not enough comparable observations. LOOP starts with C ↔ G.</small>') + '</p>'
    + '<details class="kc-details"><summary>Learning details</summary>'
    + '<p>' + esc(kind + ' · ' + c.assistance + ' · ' + c.input + ' · ' + c.pace + ' · ' + c.pans + ' pot(s)') + '</p>'
    + '<p>' + recall.first + '/' + recall.n + ' first attempts without an intervening error or requested hint; ' + recall.lost + ' lost targets. '
    + 'Help requests: ' + r.helpRequests + (c.assistance === 'guided' ? ' (diagrams always visible).' : ' (once per revealed target).') + '</p>'
    + (rows ? '<table><thead><tr><th scope="col">Change</th><th scope="col">Median</th><th scope="col">Eligible/all</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p>No measured change yet.</p>')
    + '<p class="kc-muted">Initial waits and customer turnover are excluded. Medians exclude retries and requested hints. '
    + (c.kind === 'service' ? 'Service times include choosing between orders. ' : '')
    + MIN_OBSERVATIONS + ' eligible observations are required before recommending a pair.</p>'
    + (comparison ? '<p><strong>Same-context previous session</strong><br>' + comparison + '</p>' : '')
    + (lessons ? '<p><strong>New-shape introductions</strong><br>' + lessons + '</p>' : '')
    + (record === null ? '' : '<p><strong>Local best: ' + esc(record) + '</strong><br>Same mode, input, assistance, ear, profile, pace and counter size.</p>')
    + '</details>';
}
