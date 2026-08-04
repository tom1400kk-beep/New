import { randInt, weightedPick } from "./rng";

// Every recruit weighs these 11 real-world factors differently — this is
// what makes recruiting battles feel like actual people with actual goals,
// not a single "prestige wins" formula.
export type PriorityKey =
  | "PLAYING_TIME"
  | "WINNING"
  | "NIL_MONEY"
  | "DEVELOPMENT"
  | "CULTURE_FIT"
  | "SCHEME_FIT"
  | "BRAND_EXPOSURE"
  | "COACH_STABILITY"
  | "PROXIMITY_HOME"
  | "ACADEMICS"
  | "LIFESTYLE";

export const PRIORITY_KEYS: PriorityKey[] = [
  "PLAYING_TIME", "WINNING", "NIL_MONEY", "DEVELOPMENT", "CULTURE_FIT",
  "SCHEME_FIT", "BRAND_EXPOSURE", "COACH_STABILITY", "PROXIMITY_HOME", "ACADEMICS", "LIFESTYLE",
];

export const PRIORITY_LABELS: Record<PriorityKey, string> = {
  PLAYING_TIME: "Playing Time",
  WINNING: "Winning Now",
  NIL_MONEY: "NIL Money",
  DEVELOPMENT: "Player Development",
  CULTURE_FIT: "Locker Room Fit",
  SCHEME_FIT: "Scheme Fit",
  BRAND_EXPOSURE: "Brand/Exposure",
  COACH_STABILITY: "Coaching Stability",
  PROXIMITY_HOME: "Close to Home",
  ACADEMICS: "Academics",
  LIFESTYLE: "Lifestyle/Location",
};

export type PriorityProfile = Record<PriorityKey, number>; // weights sum to ~100

// Most recruits have 2-3 things they genuinely care about and are lukewarm
// on the rest — not a uniform blend of all 11 factors.
export function generateProspectPriorities(rng: () => number): PriorityProfile {
  const dominantCount = randInt(rng, 2, 3);
  const shuffled = [...PRIORITY_KEYS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const dominant = new Set(shuffled.slice(0, dominantCount));

  const raw: Partial<PriorityProfile> = {};
  for (const key of PRIORITY_KEYS) {
    raw[key] = dominant.has(key) ? randInt(rng, 22, 38) : randInt(rng, 2, 10);
  }
  const total = PRIORITY_KEYS.reduce((s, k) => s + (raw[k] ?? 0), 0);
  const normalized = {} as PriorityProfile;
  for (const key of PRIORITY_KEYS) {
    normalized[key] = Math.round(((raw[key] ?? 0) / total) * 100);
  }
  return normalized;
}

export function topPriorities(profile: PriorityProfile, count = 3): PriorityKey[] {
  return [...PRIORITY_KEYS].sort((a, b) => profile[b] - profile[a]).slice(0, count);
}

// Nudges one key up by a flat amount and renormalizes back to ~100 — used to
// reflect a prospect's real-world experience shifting what they care about
// (e.g. a recruit who's already played in front of every staff in the
// country on national TV naturally starts weighing brand/exposure more).
export function boostPriority(profile: PriorityProfile, key: PriorityKey, amount: number): PriorityProfile {
  const raw: Partial<PriorityProfile> = { ...profile, [key]: profile[key] + amount };
  const total = PRIORITY_KEYS.reduce((s, k) => s + (raw[k] ?? 0), 0);
  const normalized = {} as PriorityProfile;
  for (const k of PRIORITY_KEYS) normalized[k] = Math.round(((raw[k] ?? 0) / total) * 100);
  return normalized;
}

// ---------- Region + climate, used for the PROXIMITY_HOME and LIFESTYLE scores ----------

const REGIONS: Record<string, string> = {
  ME: "NE", NH: "NE", VT: "NE", MA: "NE", RI: "NE", CT: "NE", NY: "NE", NJ: "NE", PA: "NE",
  OH: "MW", MI: "MW", IN: "MW", IL: "MW", WI: "MW", MN: "MW", IA: "MW", MO: "MW", ND: "MW", SD: "MW", NE: "MW", KS: "MW",
  DE: "S", MD: "S", DC: "S", VA: "S", WV: "S", NC: "S", SC: "S", GA: "S", FL: "S", KY: "S", TN: "S",
  AL: "S", MS: "S", AR: "S", LA: "S", OK: "S", TX: "S",
  MT: "W", ID: "W", WY: "W", CO: "W", NM: "W", AZ: "W", UT: "W", NV: "W", WA: "W", OR: "W", CA: "W", AK: "W", HI: "W",
};

export function sameRegion(stateA: string, stateB: string): boolean {
  return REGIONS[stateA] !== undefined && REGIONS[stateA] === REGIONS[stateB];
}

const WARM_STATES = new Set([
  "FL", "TX", "GA", "AL", "MS", "LA", "AZ", "CA", "NV", "SC", "HI", "NM", "OK",
]);

export function isWarmState(state: string): boolean {
  return WARM_STATES.has(state);
}
