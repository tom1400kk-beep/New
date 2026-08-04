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
// A brand-new coach has to earn their way up through the ranks — prestige
// tiers are shared across divisions (a rough D1 school and a strong D3 one
// can carry the same score), so gating purely on prestige let mediocre
// first-time builds walk straight into a D1 job. Landing any D1 offer now
// needs a genuinely elite creator build (archetype + background + playing
// career reputation bonuses stacked together), and even then only the
// weakest D1 programs are realistic — everyone else starts at D2/D3 and
// climbs from there through actual coaching results.
const D1_REPUTATION_THRESHOLD = 65;
const D1_PRESTIGE_CAP = 42;

export function generateStartingJobOffers(
  draft: CoachProfileDraft,
  allCandidates: CandidateJob[],
  rng: () => number,
  maxOffers = 3,
): { reputation: number; offers: CandidateJob[] } {
  const reputation = estimateReputation(draft);
  const ceiling = clamp(reputation + randInt(rng, -5, 15), 0, 100);

  const nonD1Eligible = allCandidates.filter((c) => c.division !== "D1" && c.prestige <= ceiling);
  const offers = [...nonD1Eligible].sort((a, b) => b.prestige - a.prestige).slice(0, maxOffers);

  // A capped-prestige D1 job would otherwise get crowded out of the sorted
  // list by bigger, more prestigious D2/D3 programs, so an eligible coach's
  // one realistic D1 shot is swapped in explicitly rather than left to
  // compete on raw prestige — the rest of the offers stay the safer,
  // higher-prestige lower-division options.
  if (reputation >= D1_REPUTATION_THRESHOLD) {
    const bestD1 = allCandidates
      .filter((c) => c.division === "D1" && c.prestige <= Math.min(ceiling, D1_PRESTIGE_CAP))
      .sort((a, b) => b.prestige - a.prestige)[0];
    if (bestD1) {
      if (offers.length < maxOffers) offers.push(bestD1);
      else offers[offers.length - 1] = bestD1;
    }
  }

  return { reputation, offers };
}
