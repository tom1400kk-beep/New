import { clamp } from "./rng";

// How often a program cuts a player loose purely for accumulated off-court
// judgment issues (distinct from the one-off ARREST event's "dismiss" choice,
// which fires on top of this). Concentrated almost entirely on the real
// discipline-risk tail — a merely-average player is essentially never cut.
// A Disciplinarian's accountability culture catches (and removes) problems
// earlier, so cuts happen somewhat more often under one.
export function disciplineDismissalChance(disciplineRating: number, coachArchetype?: string | null): number {
  let chance = 0.001 + Math.max(0, 40 - disciplineRating) * 0.0025;
  if (coachArchetype === "DISCIPLINARIAN") chance *= 1.3;
  return clamp(chance, 0, 0.12);
}

// The reputational cost of taking a chance on a player another program cut —
// real, but modest, and worse for a genuinely bad discipline case than a
// borderline one. Applied to the signing team's academicReputation once, at
// signing time — separate from (and smaller than) the ongoing elevated
// incident risk the player brings just by being on the roster (the existing
// ARREST event weighting already scales off the roster's worst disciplineRating).
export function disciplineSigningReputationHit(disciplineRating: number): number {
  return Math.round(clamp((45 - disciplineRating) * 0.12, 1, 6));
}
