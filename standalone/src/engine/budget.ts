import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { clamp, randNormal } from "./rng";

// NIL/booster budgets vary sharply by prestige, mirroring real collectives:
// a handful of blue-bloods sit in the multi-million range while most
// programs operate on far less. D2/D3 realistically have negligible NIL.
export function nilBudgetForTeam(rng: () => number, prestige: number, division: Division): number {
  if (!DIVISION_RULES[division].hasNil) {
    return Math.round(clamp(randNormal(rng, 8000, 4000), 0, 25000));
  }

  // Exponential-ish curve: prestige 95+ -> $3-5M, prestige 50 -> ~$400K, prestige 20 -> ~$60K
  const curve = Math.pow(prestige / 100, 3.2) * 5_000_000;
  const noise = randNormal(rng, 1, 0.18);
  return Math.round(clamp(curve * noise + 30_000, 20_000, 6_000_000));
}

// Head coach base salary — mirrors the NIL curve's shape (a handful of
// blue-bloods pay enormously more than everyone else) but scaled to
// realistic coaching-salary bands per division, since D2/D3 pay is nowhere
// close to D1 even at the top of those divisions.
export function salaryForTeam(rng: () => number, prestige: number, division: Division): number {
  if (division === "D3") {
    return Math.round(clamp(randNormal(rng, 55_000 + prestige * 250, 8_000), 35_000, 95_000));
  }
  if (division === "D2") {
    return Math.round(clamp(randNormal(rng, 75_000 + prestige * 900, 15_000), 55_000, 220_000));
  }
  // D1: prestige 25 -> ~$200K, 42 -> ~$500K, 60 -> ~$1.4M, 78 -> ~$3.3M, 92 -> ~$5.8M
  const curve = Math.pow(prestige / 100, 3.5) * 7_500_000;
  const noise = randNormal(rng, 1, 0.15);
  return Math.round(clamp(curve * noise + 150_000, 150_000, 9_000_000));
}

export function facilitiesForTeam(rng: () => number, prestige: number): number {
  return Math.round(clamp(randNormal(rng, prestige, 10), 10, 99));
}

// International/European scouting strength is deliberately close to
// independent of prestige — a mid-major with the right staff connections
// can out-recruit a blue-blood overseas, and vice versa.
export function internationalScoutingForTeam(rng: () => number, prestige: number): number {
  return Math.round(clamp(randNormal(rng, 35 + prestige * 0.15, 22), 5, 95));
}

// Academic reputation is deliberately its own axis, not a prestige proxy —
// plenty of real mid-majors (Davidson, Butler-type programs) out-academic
// blue-bloods, and vice versa.
export function academicReputationForTeam(rng: () => number, prestige: number): number {
  return Math.round(clamp(randNormal(rng, 55 + prestige * 0.1, 20), 10, 99));
}
