import { clamp, randNormal } from "./rng";
import { PRIORITY_KEYS, sameRegion, isWarmState, type PriorityProfile } from "./priorities";
import { pipelineScore, pipelineMultiplier } from "./pipeline";
import { tourRecruitingMultiplier } from "./internationalTour";
import { cityCoordinate, haversineMiles } from "./geo";
import { regionForState } from "./travelRegions";
import { eyblTeamRegion } from "./generation";
import type { Division, PositionType } from "../types";

// Real-world ceiling on how much star power a division can plausibly land —
// blue-chip prospects essentially always end up D1 regardless of a D2/D3
// program's resources, so this gates on top of (not instead of) the existing
// resource-based difficulty penalty below.
const DIVISION_STAR_CEILING: Record<Division, number> = { D1: 5, D2: 2.5, D3: 1.5 };

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
  hometownCity?: string | null;
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
  previousSchool?: string | null; // set for transfer portal players — the program they're leaving
  source?: string; // ProspectSource: "HIGH_SCHOOL" | "JUCO" | "INTERNATIONAL"
  playedEYBL?: boolean;
  eyblTeam?: string | null;
}

export interface RecruitingTeamInput {
  division: Division;
  state: string;
  city?: string;
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
  hasScholarshipOpen?: boolean; // explicitly false = this program is only offering a walk-on spot right now
  coachTransferPipeline?: Record<string, number>; // per-school connection strength, built by landing transfers from that program
  currentSeasonYear?: number;
  internationalTourCountry?: string | null; // country of the program's last foreign exhibition tour
  internationalTourSeasonYear?: number | null;
  eyblCommitsThisClass?: number; // other EYBL prospects in the same graduating class already committed here
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

  // Real city-to-city distance, not just a same-state/same-region bucket —
  // a recruit in Miami now reads as meaningfully closer to Tampa than to
  // Jacksonville, even though all three are "FL". Falls back to the old
  // state/region buckets only if a coordinate genuinely can't be resolved
  // (e.g. a non-US team state on an override list).
  let proximityHome = 50;
  if (!isInternational && prospect.hometownState) {
    const prospectCoord = cityCoordinate(prospect.hometownCity ?? "", prospect.hometownState);
    const teamCoord = cityCoordinate(team.city ?? "", team.state);
    if (prospectCoord && teamCoord) {
      const miles = haversineMiles(prospectCoord, teamCoord);
      proximityHome = clamp(100 - miles / 28, 12, 100);
    } else {
      proximityHome = prospect.hometownState === team.state ? 100 : sameRegion(prospect.hometownState, team.state) ? 60 : 25;
    }
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

  // Division ceiling: no amount of prestige/NIL lets a D2/D3 program
  // realistically compete for talent well above their level — this is what
  // makes recruits who miss a D1 offer actually cascade down to D2/D3
  // instead of every division fishing from the same effective pool.
  const overCeiling = Math.max(0, prospect.starRating - DIVISION_STAR_CEILING[team.division]);
  const divisionGatePenalty = overCeiling * 22;

  let base = pointsInvested * 0.55 + fitScore * 0.45 + internationalReach - difficultyPenalty - divisionGatePenalty;

  // Background perks: a coach's own history gives a specific, narrow edge on
  // top of general fit — not a blanket recruiting boost.
  if (team.coachBackground === "HIGH_SCHOOL_COACH" && !isInternational && prospect.hometownState === team.state) {
    base *= 1.12; // "Home Turf" — deep local ties from running a powerhouse HS program here
  }
  if (team.coachBackground === "BLUE_BLOOD_ASSISTANT" && prospect.starRating >= 4) {
    base *= 1.1; // "Big-Time Pedigree" — blue-chips recognize the résumé
  }
  if (team.coachBackground === "JUCO_COACH" && prospect.source === "JUCO") {
    base *= 1.15; // "JUCO Pipeline" — knows that circuit better than anyone
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
  if (team.internationalTourCountry && team.currentSeasonYear !== undefined) {
    base *= tourRecruitingMultiplier(
      team.internationalTourCountry, team.internationalTourSeasonYear, team.currentSeasonYear, prospect.countryOfOrigin,
    );
  }
  if (team.playedProDomestic && prospect.starRating >= 4) {
    base *= 1.05; // "Pro Pedigree" — a smaller nationwide blue-chip edge
  }

  // Transfer school pipeline: landing one transfer from a program builds a
  // real connection there (a guy already in the building who can vouch for
  // it) — the next transfer portal player from that same school is easier
  // to land as a result.
  if (team.coachTransferPipeline && prospect.previousSchool) {
    base *= pipelineMultiplier(pipelineScore(team.coachTransferPipeline, prospect.previousSchool));
  }

  // EYBL circuit pull: kids on the circuit run in the same circles and talk
  // to each other — a program that's already landed one EYBL commit this
  // class becomes a real word-of-mouth draw for the next one. Caps out so it
  // doesn't snowball into an unstoppable pipeline.
  if (prospect.playedEYBL && team.eyblCommitsThisClass) {
    base *= 1 + Math.min(team.eyblCommitsThisClass, 3) * 0.08;
  }

  // Local AAU/EYBL ties: a program that's a fixture on the same regional
  // circuit as the prospect's EYBL team already has coaches and boosters who
  // know that program and those families — a real, separate edge from the
  // national word-of-mouth bonus above.
  if (prospect.eyblTeam) {
    const teamRegion = eyblTeamRegion(prospect.eyblTeam);
    if (teamRegion && teamRegion === regionForState(team.state)) {
      base *= 1.12;
    }
  }

  // A walk-on offer (no guaranteed aid) is a real tradeoff, not a footnote —
  // recruits chasing money/security punish it hard, while ones chasing
  // exposure or a shot at winning now barely blink at the missing scholarship.
  if (team.hasScholarshipOpen === false) {
    const toughness = clamp(prospect.priorities.NIL_MONEY * 1.3 - prospect.priorities.BRAND_EXPOSURE * 0.5 - prospect.priorities.WINNING * 0.4, 0, 60);
    base *= clamp(1 - toughness / 100, 0.35, 1);
  }

  return clamp(base, 0, 100);
}

// Chance a given team wins a commitment once a prospect is ready to decide,
// relative to every other program actively recruiting them.
export function commitmentWeights(interestByTeam: { teamId: string; interest: number }[]): { teamId: string; weight: number }[] {
  return interestByTeam.map((t) => ({ teamId: t.teamId, weight: Math.max(1, t.interest) ** 2 }));
}

// Gentle year-over-year drift for a still-in-high-school prospect's rating —
// a slight pull toward their long-run potential plus small random noise from
// how their season actually went, deliberately subtle so scouting reports
// stay meaningful rather than reshuffling the board every offseason.
export function driftProspectRating(rng: () => number, current: number, potential: number): number {
  const pull = (potential - current) * 0.06;
  return Math.round(clamp(current + pull + randNormal(rng, 0, 1.5), 15, 99));
}

// Odds a D1-bound HS recruit commits a year early as a junior rather than
// waiting for senior year to sign.
export const JUNIOR_EARLY_COMMIT_CHANCE = 0.25;

// Base odds an early-committed junior decommits before signing day, and the
// bump applied when their committed program just fired its head coach — a
// realistic, common reason to reopen a commitment.
export const JUNIOR_DECOMMIT_BASE_CHANCE = 0.07;
export const JUNIOR_DECOMMIT_COACH_FIRED_CHANCE = 0.35;
