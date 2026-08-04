// Once-every-4-years foreign exhibition tour: a program picks a country,
// plays 3 exempt exhibition games there against fabricated in-country
// opposition, and earns a recruiting boost for prospects from that country
// that's strongest the year of the tour and fades out by the time the
// program is eligible to tour again.

import { clamp } from "./rng";
import { EUROPEAN_COUNTRIES, COUNTRY_PROFILES } from "./countries";
import { simulateGame, overall, type SimTeam, type SimPlayer } from "./simulate";
import type { Division } from "../types";

export const TOUR_COOLDOWN_YEARS = 4;

// Only countries with an actual prospect pool (see countries.ts) give the
// recruiting boost real mechanical effect, so the tour is offered to the
// same list rather than a broader real-world destination list.
export const TOUR_COUNTRIES = EUROPEAN_COUNTRIES;

// D1 programs can plausibly fund a foreign tour at any prestige level (the
// real-world rule doesn't gate on it). D2/D3 boosters can't — a tour there
// is a reward for sustained success, not a baseline perk, so it's restricted
// to prestige tier 4-5 programs (~top 7-8% of each division).
const D2_D3_PRESTIGE_THRESHOLD = 75;

export function isTourAffordable(division: Division, prestige: number): boolean {
  if (division === "D1") return true;
  return prestige >= D2_D3_PRESTIGE_THRESHOLD;
}

export function isTourEligible(lastTourSeasonYear: number | null, currentSeasonYear: number): boolean {
  if (lastTourSeasonYear === null || lastTourSeasonYear === undefined) return true;
  return currentSeasonYear - lastTourSeasonYear >= TOUR_COOLDOWN_YEARS;
}

// +30% the year of the tour, fading linearly to nothing by the time the
// program can tour again — matches "lowers each year after."
export function tourRecruitingMultiplier(
  tourCountry: string | null | undefined,
  tourSeasonYear: number | null | undefined,
  currentSeasonYear: number,
  prospectCountry: string | null,
): number {
  if (!tourCountry || tourSeasonYear === null || tourSeasonYear === undefined || !prospectCountry) return 1;
  if (prospectCountry !== tourCountry) return 1;
  const yearsSince = currentSeasonYear - tourSeasonYear;
  if (yearsSince < 0 || yearsSince >= TOUR_COOLDOWN_YEARS) return 1;
  const strength = 1 - yearsSince / TOUR_COOLDOWN_YEARS;
  return 1 + 0.3 * strength;
}

const OPPONENT_TEMPLATES = [
  "National Select Team", "Club All-Stars", "Regional All-Stars", "U-23 Select Team", "Basketball Federation XI",
];

function fabricateOpponent(country: string, userTeamOverall: number, rng: () => number): SimTeam {
  const bias = COUNTRY_PROFILES[country]?.qualityBias ?? 0;
  const base = clamp(userTeamOverall + bias * 8 + (rng() - 0.5) * 10, 35, 85);
  const players: SimPlayer[] = Array.from({ length: 9 }, (_, i) => {
    const v = clamp(base + (rng() - 0.5) * 12 - i * 1.5, 25, 90);
    return {
      id: `tour-opp-${i}`, position: "F", scoring: v, threePoint: v, finishing: v, playmaking: v,
      rebounding: v, defense: v, athleticism: v, basketballIq: v, characterRating: 70,
      isInjured: false, isSuspended: false,
    };
  });
  return { id: "tour-opponent", players, offenseSkill: 50, defenseSkill: 50 };
}

export interface TourGameResult {
  opponentName: string;
  teamScore: number;
  opponentScore: number;
  win: boolean;
}

// Road trip against unfamiliar opposition, so a small disadvantage instead of
// the usual home-court bump.
export function simulateTourGames(userTeam: SimTeam, country: string, rng: () => number): TourGameResult[] {
  const ratings = userTeam.players.map(overall);
  const teamOverall = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 50;
  const templates = [...OPPONENT_TEMPLATES].sort(() => rng() - 0.5).slice(0, 3);
  return templates.map((template) => {
    const opponent = fabricateOpponent(country, teamOverall, rng);
    const result = simulateGame(userTeam, opponent, -2);
    return {
      opponentName: `${country} ${template}`,
      teamScore: result.homeScore,
      opponentScore: result.awayScore,
      win: result.homeScore > result.awayScore,
    };
  });
}
