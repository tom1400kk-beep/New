import { clamp } from "./rng";
import type { Division } from "../types";

export interface AtmosphereContext {
  division: Division;
  prestige: number;
  winPct: number;
  expectedWinPct: number;
  yearsAtCurrentJob: number;
  madeTournament: boolean;
  tournamentWins: number;
}

// Building a following happens faster, and means more, on a small stage: a
// national-tournament run at a D3 program moves this meter dramatically,
// while the same run barely registers at a blue-blood where it was half
// expected anyway. Tenure matters too — a program's culture is built over
// years at the same job, not any single season, which is the direct payoff
// for staying and building rather than always chasing the next job up.
export function atmosphereTarget(ctx: AtmosphereContext): number {
  const divisionResponsiveness = ctx.division === "D3" ? 1.6 : ctx.division === "D2" ? 1.3 : 1.0;
  const performanceGap = (ctx.winPct - ctx.expectedWinPct) * 100;
  const successTerm = performanceGap * 0.45 * divisionResponsiveness;
  const tenureTerm = Math.min(ctx.yearsAtCurrentJob, 10) * 2;
  const tournamentTerm = ctx.madeTournament ? (8 + ctx.tournamentWins * 7) * divisionResponsiveness : 0;
  const base = 30 + ctx.prestige * 0.25;
  return clamp(base + successTerm + tenureTerm + tournamentTerm, 5, 99);
}

// Atmosphere builds and erodes gradually — it's earned over seasons, not
// swung by any single game the way media perception can be.
export function driftAtmosphere(current: number, target: number, rate = 0.3): number {
  return Math.round(current + (target - current) * rate);
}

// A rocking home gym is a real edge — folded directly into the home team's
// effective skill for that game (mirrors how filmStudyBonus works).
export function homeCourtBonus(atmosphere: number): number {
  return Math.round((atmosphere - 50) / 12);
}

export function atmosphereLabel(atmosphere: number): string {
  if (atmosphere >= 90) return "Legendary";
  if (atmosphere >= 75) return "Electric";
  if (atmosphere >= 60) return "Buzzing";
  if (atmosphere >= 40) return "Building";
  if (atmosphere >= 25) return "Quiet";
  return "Dead";
}
