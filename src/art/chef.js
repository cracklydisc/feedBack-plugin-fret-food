// The Aseprite loop keeps its authored anticipation, toss and recovery timing.
export const CHEF_TOSS = {
  sheet: 'chef-toss',
  frames: Array.from({ length: 8 }, (_, i) => `toss-${i}`),
  durations: [220, 120, 90, 100, 160, 120, 100, 190],
  w: 56, h: 30,
  bodyX: 19, // The skillet extends to the right of the chef's body.
};

const LOOP_MS = CHEF_TOSS.durations.reduce((sum, ms) => sum + ms, 0);

export const HYBRID_CHEFS = [
  { sheet: 'chef-male-hybrid', bodyX: 21, frames: Array.from({ length: 8 }, (_, i) => `hybrid-male-${i}`), durations: [250, 130, 100, 120, 160, 130, 140, 270] },
  { sheet: 'chef-female-hybrid', bodyX: 24, frames: Array.from({ length: 6 }, (_, i) => `hybrid-female-${i}`), durations: [260, 180, 180, 260, 180, 240] },
];

export function hybridChefFrame(chef, time) {
  const total = chef.durations.reduce((sum, ms) => sum + ms, 0);
  let phase = ((time % total) + total) % total;
  for (let i = 0; i < chef.durations.length; i++) {
    if (phase < chef.durations[i]) return chef.frames[i];
    phase -= chef.durations[i];
  }
  return chef.frames[0];
}

export function chefTossFrame(time) {
  let phase = ((time % LOOP_MS) + LOOP_MS) % LOOP_MS;
  for (let i = 0; i < CHEF_TOSS.durations.length; i++) {
    if (phase < CHEF_TOSS.durations[i]) return CHEF_TOSS.frames[i];
    phase -= CHEF_TOSS.durations[i];
  }
  return CHEF_TOSS.frames[0];
}
