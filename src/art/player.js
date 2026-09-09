// Matches assets/art/source/player-strum.lua. Each input restarts the gesture;
// it never loops while the player is waiting for the next chord.
export const PLAYER_ART = {
  w: 60, h: 104,
  guitar: { x: 12, y: 67 },
  strumFrames: ['strum-0', 'strum-1', 'strum-2', 'strum-3'],
  durations: [55, 65, 85, 95],
};

export function playerFrame(age, reducedMotion = false) {
  if (reducedMotion || age < 0) return 'idle';
  for (let i = 0; i < PLAYER_ART.durations.length; i++) {
    if (age < PLAYER_ART.durations[i]) return PLAYER_ART.strumFrames[i];
    age -= PLAYER_ART.durations[i];
  }
  return 'idle';
}
