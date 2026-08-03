import { clamp } from "./rng";
import { PRIORITY_KEYS, sameRegion, isWarmState, type PriorityProfile } from "./priorities";
import { pipelineScore, pipelineMultiplier } from "./pipeline";
import type { PositionType } from "../types";

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

export interface RecruitingRosterPlayer {
  position: PositionType | string;
  overall: number; // 0-100 composite
  characterRating: number;
}

export interface RecruitingProspectInput {
  position: PositionType | string;
  hometownState: string;
  countryOfOrigin: string | null;
  characterRating: number;
  scoring: number;
  threePoint: number;
  finishing: number;
  playmaking: number;
  rebounding: number;
  defense: number;
  starRating: number;
  priorities: PriorityProfile;
}

export interface RecruitingTeamInput {
  state: string;
  prestige: number;
  nilBudget: number;
  facilitiesRating: number;
  academicReputation: number;
  internationalScoutingRating: number;
  recruitingSkill: number;
  assistantRecruitingSkill: number;
  developmentSkill: number;
  offenseSkill: number;
  defenseSkill: number;
  hotSeatLevel: number;
  recentWinPct: number; // 0-1; caller should fall back to prestige/100 pre-season
  roster: RecruitingRosterPlayer[];
  coachBackground?: string | null;
  proCountry?: string | null;
  playedProDomestic?: boolean;
  coachPipelineStates?: Record<string, number>;
  campusAtmosphere?: number; // 1-100, program culture/environment — a buzzing program is a real recruiting draw
}

// Each of the 11 recruit priorities maps to a concrete 0-100 "how well does
// this program fit that specific thing" score. This is what makes two
// recruits with identical talent chase completely different schools.
function computeDimensionScores(prospect: RecruitingProspectInput, team: RecruitingTeamInput): Record<string, number> {
  const isInternational = prospect.countryOfOrigin !== null && !prospect.hometownState;

  const samePosition = team.roster.filter((p) => p.position === prospect.position).sort((a, b) => b.overall - a.overall);
  const topAtPosition = samePosition.slice(0, 2);
  const avgDepthOverall = topAtPosition.length > 0 ? topAtPosition.reduce((s, p) => s + p.overall, 0) / topAtPosition.length : 40;
  const playingTime = clamp(115 - avgDepthOverall, 5, 95);

  const winning = clamp(team.recentWinPct * 100, 0, 100);
  const nilMoney = nilPullFactor(team.nilBudget);
  const development = clamp(team.developmentSkill * 0.7 + team.facilitiesRating * 0.3, 0, 100);

  const avgRosterCharacter = team.roster.length > 0 ? team.roster.reduce((s, p) => s + p.characterRating, 0) / team.roster.length : 60;
  const rosterCultureMatch = clamp(100 - Math.abs(avgRosterCharacter - prospect.characterRating), 10, 100);
  // A buzzing campus atmosphere is a real part of "does this place feel right,"
  // independent of whether the current roster's personalities happen to match.
  const cultureFit = clamp(rosterCultureMatch * 0.7 + (team.campusAtmosphere ?? 50) * 0.3, 10, 100);

  const perimeterLean = (prospect.threePoint + prospect.playmaking) - (prospect.rebounding + prospect.finishing) * 0.5;
  const schemeFit = clamp(perimeterLean >= 0 ? team.offenseSkill : team.defenseSkill, 0, 100);

  const brandExposure = clamp(team.prestige, 0, 100);
  const coachStability = clamp(100 - team.hotSeatLevel, 0, 100);

  let proximityHome = 50;
  if (!isInternational && prospect.hometownState) {
    proximityHome = prospect.hometownState === team.state ? 100 : sameRegion(prospect.hometownState, team.state) ? 60 : 25;
  }

  const academics = clamp(team.academicReputation, 0, 100);

  let lifestyle = 55;
  if (!isInternational && prospect.hometownState) {
    lifestyle = isWarmState(prospect.hometownState) === isWarmState(team.state) ? 75 : 45;
  }

  return {
    PLAYING_TIME: playingTime,
    WINNING: winning,
    NIL_MONEY: nilMoney,
    DEVELOPMENT: development,
    CULTURE_FIT: cultureFit,
    SCHEME_FIT: schemeFit,
    BRAND_EXPOSURE: brandExposure,
    COACH_STABILITY: coachStability,
    PROXIMITY_HOME: proximityHome,
    ACADEMICS: academics,
    LIFESTYLE: lifestyle,
  };
}

export function computeInterestGain(prospect: RecruitingProspectInput, team: RecruitingTeamInput, pointsInvested: number): number {
  const scores = computeDimensionScores(prospect, team);
  const fitScore = PRIORITY_KEYS.reduce((sum, key) => sum + (prospect.priorities[key] / 100) * scores[key], 0);

  // International recruits lean extra on the program's overseas scouting
  // network actually reaching them at all, on top of general fit.
  const isInternational = prospect.countryOfOrigin !== null && !prospect.hometownState;
  const internationalReach = isInternational ? team.internationalScoutingRating * 0.25 : 0;

  // Resource gap: elite recruits are genuinely hard to land for programs
  // without the prestige/NIL pull to back it up, regardless of fit.
  const resourceLevel = team.prestige * 0.6 + nilPullFactor(team.nilBudget) * 0.4;
  const difficultyPenalty = Math.max(0, prospect.starRating * 6 - resourceLevel * 0.15);

  let base = pointsInvested * 0.55 + fitScore * 0.45 + internationalReach - difficultyPenalty;

  // Background perks: a coach's own history gives a specific, narrow edge on
  // top of general fit — not a blanket recruiting boost.
  if (team.coachBackground === "HIGH_SCHOOL_COACH" && !isInternational && prospect.hometownState === team.state) {
    base *= 1.12; // "Home Turf" — deep local ties from running a powerhouse HS program here
  }
  if (team.coachBackground === "BLUE_BLOOD_ASSISTANT" && prospect.starRating >= 4) {
    base *= 1.1; // "Big-Time Pedigree" — blue-chips recognize the résumé
  }

  // Recruiting pipeline: a persistent, per-coach connection strength for each
  // US state, seeded by hometown/alma mater and built (or let go cold) by
  // actually recruiting there over time — travels with the coach across jobs.
  if (team.coachPipelineStates && !isInternational && prospect.hometownState) {
    base *= pipelineMultiplier(pipelineScore(team.coachPipelineStates, prospect.hometownState));
  }
  if (team.proCountry && prospect.countryOfOrigin === team.proCountry) {
    base *= 1.15; // "International Playing Ties" — a specific-country match is rarer, so it counts more
  }
  if (team.playedProDomestic && prospect.starRating >= 4) {
    base *= 1.05; // "Pro Pedigree" — a smaller nationwide blue-chip edge
  }

  return clamp(base, 0, 100);
}

// Chance a given team wins a commitment once a prospect is ready to decide,
// relative to every other program actively recruiting them.
export function commitmentWeights(interestByTeam: { teamId: string; interest: number }[]): { teamId: string; weight: number }[] {
  return interestByTeam.map((t) => ({ teamId: t.teamId, weight: Math.max(1, t.interest) ** 2 }));
}
