import { clamp, randNormal } from "./rng";
import type { Division } from "../types";

export interface AttendanceContext {
  capacity: number;
  division: Division;
  homePrestige: number;
  awayPrestige: number;
  localPerception: number; // home coach's local perception, 1-100
  nationalPerception: number; // home coach's national perception, 1-100
  isConference: boolean;
  isTournament: boolean;
}

// Baseline percentage of the building filled on a normal night — brand-name
// programs sell out or come close, weaker ones play in front of a half-empty
// gym even before any game-specific bump or dip is applied.
function baseTurnout(prestige: number, division: Division): number {
  if (division === "D1") return clamp(0.35 + prestige / 200, 0.32, 0.95);
  if (division === "D2") return clamp(0.32 + prestige / 250, 0.28, 0.85);
  return clamp(0.3 + prestige / 300, 0.25, 0.8);
}

// "People care more about the team" is modeled two ways: localPerception (the
// coach's standing with the hometown fanbase/boosters — the direct lever the
// media-interview system moves) and nationalPerception (buzz that pulls in
// curious walk-ups). A marquee visiting opponent and bigger-stakes games
// (conference play, postseason) also reliably move real attendance.
export function computeAttendance(rng: () => number, ctx: AttendanceContext): number {
  let turnout = baseTurnout(ctx.homePrestige, ctx.division);
  turnout += (ctx.localPerception - 50) / 200;
  turnout += clamp((ctx.nationalPerception - 20) / 300, -0.05, 0.2);
  turnout += clamp((ctx.awayPrestige - 50) / 300, -0.1, 0.15);
  if (ctx.isConference) turnout += 0.05;
  if (ctx.isTournament) turnout += 0.15;
  turnout += randNormal(rng, 0, 0.05);
  turnout = clamp(turnout, 0.12, 1);
  return Math.round(ctx.capacity * turnout);
}

// A program can only grow its building so far past what its level supports —
// mirrors the ceilings used when arenas are first generated.
export const ARENA_CAPACITY_CAP: Record<Division, number> = { D1: 22000, D2: 4000, D3: 2200 };

export function isArenaNearCap(capacity: number, division: Division): boolean {
  return capacity >= ARENA_CAPACITY_CAP[division] * 0.97;
}

export interface ArenaUpgradeContext {
  prestige: number;
  division: Division;
  expectedWinPct: number; // from career.ts's expectedWinPct(prestige)
  seasonWinPct: number | null; // null if too early in the season to judge
  avgTurnoutPct: number | null; // 0-100, null if not enough home games played yet
  adWinFocus?: number;
  adRelationshipScore?: number;
}

// The AD's decision blends three things the request explicitly ties an
// upgrade to: how the team is doing (vs. what's expected for its prestige),
// whether the building is actually generating box-office demand right now
// ("making money" — a good proxy for gate revenue without inventing a whole
// separate athletic-department ledger), and how receptive this particular AD
// is, both in general (win-focused ADs favor investment) and personally
// (their relationship with this coach).
export function arenaUpgradeGrantChance(ctx: ArenaUpgradeContext): number {
  const prestigeTerm = clamp((ctx.prestige - 50) / 300, -0.1, 0.15);
  const formTerm = ctx.seasonWinPct !== null ? clamp((ctx.seasonWinPct - ctx.expectedWinPct) * 0.6, -0.2, 0.25) : 0;
  const financeTerm = ctx.avgTurnoutPct !== null ? clamp((ctx.avgTurnoutPct - 55) / 150, -0.2, 0.2) : -0.05;
  const adTerm = clamp(((ctx.adWinFocus ?? 50) - 50) / 400, -0.08, 0.12) + clamp(((ctx.adRelationshipScore ?? 50) - 50) / 300, -0.12, 0.15);
  return clamp(0.15 + prestigeTerm + formTerm + financeTerm + adTerm, 0.05, 0.85);
}

// An approved expansion grows the building by a realistic single-project
// increment (roughly 8-22%), capped at what the division supports.
export function nextArenaCapacity(rng: () => number, capacity: number, division: Division): number {
  const grown = Math.round(capacity * (1.08 + rng() * 0.14));
  return Math.min(grown, ARENA_CAPACITY_CAP[division]);
}
