import { clamp } from "./rng";

export interface RecruitingInputs {
  prestige: number; // 1-100
  nilBudget: number; // dollars
  facilitiesRating: number; // 1-100
  recruitingSkill: number; // head coach, 1-100
  assistantRecruitingSkill: number; // best assistant assigned to recruiting, 1-100, 0 if none
  hometownState: string;
  teamState: string;
  pointsInvested: number; // cumulative points this team has spent on this prospect
  prospectStarRating: number;
}

// Weekly recruiting points a program can allocate, driven by staff quality.
export function weeklyRecruitingPoints(recruitingSkill: number, assistantRecruitingSkill: number): number {
  return Math.round(20 + recruitingSkill * 0.3 + assistantRecruitingSkill * 0.2);
}

// NIL budget expressed as a 0-100 pull factor relative to a $2.5M ceiling
// (roughly today's biggest blue-blood collectives) — used so budget disparity
// actually matters without needing exact real dollar figures to be "correct".
function nilPullFactor(nilBudget: number): number {
  const ceiling = 2_500_000;
  return clamp((nilBudget / ceiling) * 100, 0, 100);
}

export function computeInterestGain(inputs: RecruitingInputs): number {
  const {
    prestige, nilBudget, facilitiesRating, recruitingSkill, assistantRecruitingSkill,
    hometownState, teamState, pointsInvested, prospectStarRating,
  } = inputs;

  const nilPull = nilPullFactor(nilBudget);
  const homeStateBonus = hometownState === teamState ? 8 : 0;

  // Higher-rated recruits are harder to move the needle on for lower-prestige programs.
  const difficultyPenalty = Math.max(0, prospectStarRating * 6 - prestige * 0.15);

  const base =
    pointsInvested * 0.6 +
    prestige * 0.25 +
    nilPull * 0.2 +
    facilitiesRating * 0.1 +
    recruitingSkill * 0.15 +
    assistantRecruitingSkill * 0.1 +
    homeStateBonus -
    difficultyPenalty;

  return clamp(base, 0, 100);
}

// Chance a given team wins a commitment once a prospect is ready to decide,
// relative to every other program actively recruiting them.
export function commitmentWeights(interestByTeam: { teamId: string; interest: number }[]): { teamId: string; weight: number }[] {
  return interestByTeam.map((t) => ({ teamId: t.teamId, weight: Math.max(1, t.interest) ** 2 }));
}
