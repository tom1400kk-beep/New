import { clamp } from "./rng";

// A rivalry needs three postseason meetings before it's "real" — a single
// tournament clash is a good story, not yet a rivalry.
export const POSTSEASON_RIVALRY_THRESHOLD = 3;

// Sort so a team pair always resolves to the same key regardless of which
// team was home/away or which order they're looked up in.
export function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Traditional rivalries are seeded at world creation between same-state
// conference-mates — the single strongest real-world predictor of a genuine
// college rivalry (in-state bragging rights beat almost anything else).
export const TRADITIONAL_RIVALRY_CHANCE = 0.55;

export function traditionalIntensity(prestigeA: number, prestigeB: number): number {
  return Math.round(clamp(35 + (prestigeA + prestigeB) / 4, 25, 90));
}

// A rivalry forged by repeated postseason combat starts hot — these two
// programs have already been fighting for a title spot, not just bragging rights.
export function postseasonForgedIntensity(): number {
  return 55;
}

// Every additional meeting between existing rivals raises the stakes further;
// a rivalry cools slowly in years the two teams don't happen to play.
export function growIntensityOnMeeting(current: number): number {
  return Math.round(clamp(current + 4, 10, 99));
}

export function decayIntensity(current: number): number {
  return Math.round(clamp(current - 1, 10, 99));
}
