import { clamp, randInt } from "./rng";
import { getArchetypeProfile, type CoachArchetype } from "./coachArchetypes";
import { getBackgroundProfile, type CoachBackground } from "./coachBackgrounds";
import { playingCareerEffects, NO_PLAYING_CAREER, type PlayingCareerChoice } from "./playingCareer";
import type { Division } from "../types";

export interface CoachProfileDraft {
  archetype: CoachArchetype;
  background: CoachBackground | null;
  playingCareer: PlayingCareerChoice;
}

export interface CandidateJob {
  school: string;
  conference: string;
  division: Division;
  state: string;
  prestige: number;
}

// A rough, deterministic estimate of a brand-new coach's starting reputation
// from their creator choices — used only to gate which jobs they'd
// realistically be offered. The real, final reputation is rolled with
// variance once the world actually exists (see generateCoachSkills).
export function estimateReputation(draft: CoachProfileDraft): number {
  const archetypeDelta = getArchetypeProfile(draft.archetype).deltas.reputation ?? 0;
  const backgroundDelta = draft.background ? (getBackgroundProfile(draft.background)?.deltas.reputation ?? 0) : 0;
  const careerDelta = playingCareerEffects(draft.playingCareer ?? NO_PLAYING_CAREER).deltas.reputation ?? 0;
  return Math.round(clamp(45 + archetypeDelta + backgroundDelta + careerDelta, 5, 95));
}

// Mirrors engine/career.ts's generateJobOffers logic (ceiling = reputation +
// noise, take the best jobs under it) but works off the raw national school
// list instead of live vacancies, since this runs before any world exists.
export function generateStartingJobOffers(
  draft: CoachProfileDraft,
  allCandidates: CandidateJob[],
  rng: () => number,
  maxOffers = 3,
): { reputation: number; offers: CandidateJob[] } {
  const reputation = estimateReputation(draft);
  const ceiling = clamp(reputation + randInt(rng, -5, 15), 0, 100);
  const eligible = allCandidates.filter((c) => c.prestige <= ceiling);
  const sorted = [...eligible].sort((a, b) => b.prestige - a.prestige);
  return { reputation, offers: sorted.slice(0, maxOffers) };
}
