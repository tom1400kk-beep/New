// Real transfer portal movement skews upward: a genuine D2/D3 standout gets
// looked at by D1 programs, and a mid-major D1 breakout star draws power-
// conference interest — not just whatever the user's own team personally
// pursues. This generates that AI-side interest so the portal's existing
// weighted-commitment lottery (see season/offseason.ts) naturally pulls good
// players up the ladder the way real transfers do.

import { clamp } from "./rng";
import type { Division } from "../types";

export interface PortalCandidateTeam {
  teamId: string;
  division: Division;
  prestige: number;
}

export interface PortalRiserInterest {
  teamId: string;
  interestLevel: number;
}

// Calibrated against this engine's actual overall() output by division/
// prestige: elite D2 programs average ~67 overall (max ~73), elite D3 ~55
// (max ~61), and a prestige-60 D1 roster averages ~64 with a ~70 90th
// percentile. So clearing these numbers is a real step above a player's own
// level, and a sub-65-prestige D1 "mid-major" player clearing 68 is a
// genuine breakout, not just a solid rotation piece.
const D2_TO_D1_THRESHOLD = 58;
const D3_TO_D1_THRESHOLD = 55;
const D3_TO_D2_THRESHOLD = 48;
const MID_MAJOR_PRESTIGE_CEILING = 65;
const MID_MAJOR_RISER_THRESHOLD = 68;
const POWER_PROGRAM_PRESTIGE_FLOOR = 75;

export function poachingDestinationPool(
  candidateTeams: PortalCandidateTeam[],
  playerOverall: number,
  sourceDivision: Division,
  sourcePrestige: number,
): PortalCandidateTeam[] {
  if (sourceDivision === "D2" && playerOverall >= D2_TO_D1_THRESHOLD) {
    return candidateTeams.filter((t) => t.division === "D1" && t.prestige <= 70);
  }
  if (sourceDivision === "D3") {
    if (playerOverall >= D3_TO_D1_THRESHOLD) {
      return candidateTeams.filter((t) => t.division === "D1" && t.prestige <= 60);
    }
    if (playerOverall >= D3_TO_D2_THRESHOLD) {
      return candidateTeams.filter((t) => t.division === "D2" && t.prestige >= 40);
    }
  }
  if (sourceDivision === "D1" && sourcePrestige < MID_MAJOR_PRESTIGE_CEILING && playerOverall >= MID_MAJOR_RISER_THRESHOLD) {
    return candidateTeams.filter((t) => t.division === "D1" && t.prestige >= POWER_PROGRAM_PRESTIGE_FLOOR);
  }
  return [];
}

// 1-3 programs from the pool take real interest, weighted toward the
// stronger prestige within it — a genuine offer, not a rubber stamp.
export function generatePoachingInterest(rng: () => number, pool: PortalCandidateTeam[], playerOverall: number): PortalRiserInterest[] {
  if (pool.length === 0) return [];
  const count = Math.min(pool.length, 1 + Math.floor(rng() * 3));
  const remaining = [...pool];
  const picks: PortalCandidateTeam[] = [];
  for (let i = 0; i < count; i++) {
    const weights = remaining.map((t) => Math.max(1, t.prestige));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let idx = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      r -= weights[j];
      if (r <= 0) { idx = j; break; }
    }
    picks.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return picks.map((t) => ({
    teamId: t.teamId,
    interestLevel: Math.round(clamp(45 + playerOverall * 0.4 + (rng() - 0.5) * 20, 40, 95)),
  }));
}
