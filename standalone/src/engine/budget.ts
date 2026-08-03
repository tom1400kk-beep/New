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

export function facilitiesForTeam(rng: () => number, prestige: number): number {
  return Math.round(clamp(randNormal(rng, prestige, 10), 10, 99));
}
