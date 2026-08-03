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
