import { label } from '../menu.js';

// Preview the playable fingering, including the full F barre.
export const previewName = (chord) => chord === 'F+' ? 'F BAR' : label(chord);

/** Two upcoming strums, written directly on the chalkboard. Repeated
 * chords remain separate: each one is a real step the player must play. */
export function recipeLayout(st, slot, geo) {
  if (!st || !st.dish || !st.steps?.length) return null;
  const x = slot * geo.SLOT_W + 2;
  const hidden = Math.max(0, st.steps.length - st.step - 3);
  const wideCount = hidden >= 10;
  return {
    x, y: geo.CARD_Y, w: geo.CARD_W, h: geo.CARD_H,
    next: st.steps[st.step + 1] || null,
    hidden,
    more: { x: x + (wideCount ? 67 : 70), y: geo.CARD_Y + 4, w: wideCount ? 11 : 8, dividerX: x + (wideCount ? 65 : 68) },
    cells: st.steps.slice(st.step + 1, st.step + 3).map((chord, k) => ({
      chord, name: previewName(chord), index: st.step + 1 + k,
      state: k === 0 ? 'next' : 'future',
      x: x + 3 + k * (wideCount ? 31 : 32), y: geo.CARD_Y + 2, w: wideCount ? 30 : 31, h: 10,
    })),
  };
}
