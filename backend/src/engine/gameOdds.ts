// Realistic point-spread and moneyline odds for an upcoming game, built the
// way real predictive markets work: an efficiency-margin rating (KenPom
// AdjEM once enough games are in, blended from a prestige-based prior early
// in the season) converts to an expected scoring margin, then to a win
// probability via a normal-distribution model of game-to-game variance,
// then to American odds with a standard sportsbook overround baked in.

import { clamp } from "./rng";

export interface OddsTeamInput {
  prestige: number; // 1-100
  kenpomAdjEM: number | null; // null if no rating yet (too early in the season, or non-D1)
  gamesPlayed: number; // this team's games played this season
}

export interface GameOdds {
  homeSpread: number; // negative = home favored by this many points
  awaySpread: number; // always -homeSpread
  homeMoneyline: number; // American odds, e.g. -120 or +150
  awayMoneyline: number;
  homeWinProbability: number; // 0-1, fair (no-vig) probability
  awayWinProbability: number;
  favorite: "home" | "away" | "even";
}

const HOME_COURT_ADVANTAGE = 3; // points — matches simulateGame's default home edge
const GAME_MARGIN_STD_DEV = 11; // typical game-to-game scoring variance in college hoops
// Real books shade both sides by a few points of implied probability rather
// than scaling probability multiplicatively — the latter blows up into
// absurd moneylines (-5000+) for perfectly ordinary double-digit favorites,
// which isn't how an actual board looks outside of true mismatch buy games.
const SPORTSBOOK_MARGIN = 0.045; // ~4.5% total overround, split evenly

// Ramps a team's rating from a prestige-only prior at 0 games played to a
// pure KenPom AdjEM reading by game 3 — enough of a sample to mean something
// without overreacting to one early blowout or near-miss.
function teamRating(team: OddsTeamInput): number {
  const prestigeEM = (team.prestige - 55) * 0.5;
  if (team.kenpomAdjEM === null) return prestigeEM;
  const weight = clamp(team.gamesPlayed / 3, 0, 1);
  return team.kenpomAdjEM * weight + prestigeEM * (1 - weight);
}

// Abramowitz-Stegun approximation of the error function, accurate to ~1e-7.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function toAmericanOdds(probability: number): number {
  const p = clamp(probability, 0.01, 0.99);
  if (p >= 0.5) return Math.round((-100 * p) / (1 - p));
  return Math.round((100 * (1 - p)) / p);
}

export function computeGameOdds(home: OddsTeamInput, away: OddsTeamInput): GameOdds {
  const ratingDiff = teamRating(home) - teamRating(away) + HOME_COURT_ADVANTAGE;

  const homeSpread = -Math.round(ratingDiff * 2) / 2; // nearest half point; negative = home favored
  const awaySpread = -homeSpread;

  const homeWinProbability = normCdf(ratingDiff / GAME_MARGIN_STD_DEV);
  const awayWinProbability = 1 - homeWinProbability;

  const vigHome = homeWinProbability + SPORTSBOOK_MARGIN / 2;
  const vigAway = awayWinProbability + SPORTSBOOK_MARGIN / 2;

  return {
    homeSpread,
    awaySpread,
    homeMoneyline: toAmericanOdds(vigHome),
    awayMoneyline: toAmericanOdds(vigAway),
    homeWinProbability,
    awayWinProbability,
    favorite: homeSpread < 0 ? "home" : homeSpread > 0 ? "away" : "even",
  };
}
