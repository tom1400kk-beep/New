// Real-world-informed recruiting hotbed weighting, used so procedurally
// generated recruits realistically cluster where actual HS/JUCO talent does,
// while still producing prospects from everywhere.

export const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY",
  "LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH",
  "OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// weight = relative frequency prospects come from this state
// qualityBias = shifts the star-rating distribution up/down for that state
interface StateProfile {
  weight: number;
  qualityBias: number;
}

const TIER_A: [string, number][] = [["CA", 12], ["TX", 12], ["FL", 10], ["GA", 8], ["IL", 7], ["NY", 7]];
const TIER_B: [string, number][] = [
  ["NC", 6], ["OH", 6], ["VA", 5], ["MD", 5], ["PA", 6], ["IN", 5], ["MI", 5], ["LA", 5], ["NJ", 5], ["TN", 5],
];
const TIER_C: [string, number][] = [
  ["AL", 4], ["SC", 4], ["MO", 4], ["KY", 4], ["NV", 3], ["AZ", 4], ["WA", 4], ["DC", 2], ["MA", 3], ["CT", 3],
  ["OK", 3], ["MS", 3], ["AR", 3], ["WI", 3], ["MN", 3], ["CO", 3], ["OR", 3],
];
// everything else: low-volume but not zero — realism means talent still pops up anywhere
const REMAINING = STATES.filter(
  (s) => ![...TIER_A, ...TIER_B, ...TIER_C].some(([st]) => st === s),
);

export const STATE_PROFILES: Record<string, StateProfile> = {};
for (const [s, w] of TIER_A) STATE_PROFILES[s] = { weight: w, qualityBias: 1.0 };
for (const [s, w] of TIER_B) STATE_PROFILES[s] = { weight: w, qualityBias: 0.5 };
for (const [s, w] of TIER_C) STATE_PROFILES[s] = { weight: w, qualityBias: 0 };
for (const s of REMAINING) STATE_PROFILES[s] = { weight: 1.5, qualityBias: -0.5 };

export function weightedStateList(): { item: string; weight: number }[] {
  return STATES.map((s) => ({ item: s, weight: STATE_PROFILES[s].weight }));
}
