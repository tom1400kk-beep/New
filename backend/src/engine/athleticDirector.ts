import { clamp, randNormal } from "./rng";

// Athletic directors are the ones who actually hire and fire coaches. Their
// personal values shape how forgiving or trigger-happy they are, and they
// remember coaches they've worked with before — a coach's history with a
// specific AD travels with the coach even after the AD moves to a new school.
export interface ADTraits {
  patience: number; // damps/amplifies hot-seat swings
  winFocus: number; // how much win/loss record (vs everything else) drives the hot seat
  integrityStandard: number; // personal legality bar — stacks with the school's academic reputation
  loyalty: number; // how much a good (or bad) personal relationship protects (or dooms) a coach
}

export function generateADTraits(rng: () => number, academicReputation: number): ADTraits {
  return {
    patience: Math.round(clamp(randNormal(rng, 50, 18), 5, 95)),
    winFocus: Math.round(clamp(randNormal(rng, 55, 18), 5, 95)),
    // Image-conscious (high academic reputation) schools tend to hire stricter ADs.
    integrityStandard: Math.round(clamp(randNormal(rng, 35 + academicReputation * 0.3, 15), 5, 95)),
    loyalty: Math.round(clamp(randNormal(rng, 50, 18), 5, 95)),
  };
}

// Flat yearly hazard rate that produces a ~7-year average tenure
// (memoryless: P(still there after n years) = (1 - 1/7)^n).
const AD_TURNOVER_CHANCE = 1 / 7;

export function adTurnoverRoll(rng: () => number): boolean {
  return rng() < AD_TURNOVER_CHANCE;
}

export const AD_RELATIONSHIP_BASELINE = 50;

export function parseAdRelationships(json: string): Record<string, number> {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function adRelationshipScore(relationships: Record<string, number>, adId: string): number {
  return relationships[adId] ?? AD_RELATIONSHIP_BASELINE;
}

// Called once per season for every (coach, AD) pair that worked together that
// season — outperforming expectations builds goodwill, getting fired tanks it.
export function updateAdRelationship(current: number, winPct: number, expectedWinPct: number, wasFired: boolean): number {
  let delta = (winPct - expectedWinPct) * 40;
  if (wasFired) delta -= 25;
  return Math.round(clamp(current + delta, 5, 99));
}
