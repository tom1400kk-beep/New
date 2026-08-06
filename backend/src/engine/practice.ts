import { clamp, randNormal } from "./rng";

// Weekly practice emphasis the user's coach can set — the only mechanic in
// the codebase besides the once-a-year offseason growth jump (see
// season/offseason.ts) and the HS-prospect drift (see
// recruiting.ts::driftProspectRating) that moves a player's ratings.
// BALANCED spreads a small amount of growth across everything with no
// tradeoff; every other option grows its own fields faster at the cost of
// growing everything else slower — practice time is zero-sum.
export type PracticeFocus =
  | "BALANCED"
  | "SHOOTING"
  | "FINISHING"
  | "PLAYMAKING"
  | "REBOUNDING"
  | "DEFENSE"
  | "ATHLETICISM"
  | "IQ";

export const PRACTICE_FOCUS_OPTIONS: PracticeFocus[] = [
  "BALANCED", "SHOOTING", "FINISHING", "PLAYMAKING", "REBOUNDING", "DEFENSE", "ATHLETICISM", "IQ",
];

export type PracticeRatingField =
  | "scoring" | "threePoint" | "finishing" | "playmaking" | "rebounding" | "defense" | "athleticism" | "basketballIq" | "stamina";

const ALL_FIELDS: PracticeRatingField[] = [
  "scoring", "threePoint", "finishing", "playmaking", "rebounding", "defense", "athleticism", "basketballIq", "stamina",
];

export const PRACTICE_FOCUS_FIELDS: Record<PracticeFocus, PracticeRatingField[]> = {
  BALANCED: ALL_FIELDS,
  SHOOTING: ["scoring", "threePoint"],
  FINISHING: ["finishing"],
  PLAYMAKING: ["playmaking"],
  REBOUNDING: ["rebounding"],
  DEFENSE: ["defense"],
  ATHLETICISM: ["athleticism", "stamina"],
  IQ: ["basketballIq"],
};

export interface PracticePlayerRatings {
  scoring: number;
  threePoint: number;
  finishing: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  athleticism: number;
  basketballIq: number;
  stamina: number;
  potential: number;
}

// Focused fields pull toward potential noticeably faster than unfocused ones
// — over a full season of dedicated practice this can rival a single
// offseason jump (see offseason.ts's growth formula), which is the point:
// committing a whole season to one skill should be a real, visible strategic
// choice, not a rounding error. BALANCED sits in between on every field
// since nothing is being sacrificed for it.
const FOCUS_PULL_RATE = 0.02;
const FOCUS_NOISE_SD = 0.4;
const OFF_FOCUS_PULL_RATE = 0.004;
const OFF_FOCUS_NOISE_SD = 0.12;
const BALANCED_PULL_RATE = 0.008;
const BALANCED_NOISE_SD = 0.2;

// A coach's developmentSkill (until now purely a recruiting-appeal stat, see
// engine/recruiting.ts) finally has a mechanical effect here — this is also
// what gives the PLAYER_DEVELOPER archetype (see coachArchetypes.ts) real
// teeth instead of just inflating a number recruits look at.
export function developmentMultiplier(developmentSkill: number): number {
  return 0.7 + (developmentSkill / 100) * 0.6;
}

export function applyWeeklyPractice(
  rng: () => number,
  ratings: PracticePlayerRatings,
  focus: PracticeFocus,
  developmentSkill: number,
): PracticePlayerRatings {
  const mult = developmentMultiplier(developmentSkill);
  const focusFields = new Set(PRACTICE_FOCUS_FIELDS[focus]);
  const next: PracticePlayerRatings = { ...ratings };

  for (const field of ALL_FIELDS) {
    const current = ratings[field];
    const isBalanced = focus === "BALANCED";
    const isFocused = isBalanced || focusFields.has(field);
    const rate = isBalanced ? BALANCED_PULL_RATE : isFocused ? FOCUS_PULL_RATE : OFF_FOCUS_PULL_RATE;
    const noiseSd = isBalanced ? BALANCED_NOISE_SD : isFocused ? FOCUS_NOISE_SD : OFF_FOCUS_NOISE_SD;
    const pull = (ratings.potential - current) * rate * mult + randNormal(rng, 0, noiseSd);
    next[field] = Math.round(clamp(current + pull, 15, 99));
  }

  return next;
}
