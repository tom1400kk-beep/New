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
// noise) but works off the raw national school list instead of live
// vacancies, since this runs before any world exists. First-time coaching
// is D3 country — every program at that level is realistically in reach.
// D2 takes a real (if modest) résumé to get a call from. D1 — even its
// weakest program — takes a genuinely elite creator build (archetype +
// background + playing career reputation bonuses stacked together).
// Everyone else builds up to it the old-fashioned way, through results.
const D1_REPUTATION_THRESHOLD = 65;
const D1_PRESTIGE_CAP = 42;
const D2_REPUTATION_THRESHOLD = 50;

const DIVISION_ORDER: Record<Division, number> = { D3: 0, D2: 1, D1: 2 };

export function generateStartingJobOffers(
  draft: CoachProfileDraft,
  allCandidates: CandidateJob[],
  rng: () => number,
): { reputation: number; offers: CandidateJob[] } {
  const reputation = estimateReputation(draft);
  const ceiling = clamp(reputation + randInt(rng, -5, 15), 0, 100);

  const eligible = allCandidates.filter((c) => {
    if (c.prestige > ceiling) return false;
    if (c.division === "D1") return reputation >= D1_REPUTATION_THRESHOLD && c.prestige <= D1_PRESTIGE_CAP;
    if (c.division === "D2") return reputation >= D2_REPUTATION_THRESHOLD;
    return true; // D3 — always in reach once prestige clears the ceiling
  });

  // D3 listed first and most plentiful, D2 next, D1 last and rarest — the
  // full slate of every job this coach could realistically land, not just
  // a handful of picks.
  const offers = [...eligible].sort((a, b) => {
    if (a.division !== b.division) return DIVISION_ORDER[a.division] - DIVISION_ORDER[b.division];
    return b.prestige - a.prestige;
  });

  return { reputation, offers };
}
