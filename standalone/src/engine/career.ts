import { clamp, randInt } from "./rng";

// Higher-prestige jobs come with higher win expectations from the AD — this
// is what makes the hot seat meaningful (going 18-13 is fine at a low-major,
// a firing offense at a blue-blood).
export function expectedWinPct(prestige: number): number {
  return clamp(0.3 + (prestige / 100) * 0.45, 0.3, 0.75);
}

export function updateHotSeat(
  currentHotSeat: number,
  wins: number,
  losses: number,
  prestige: number,
  archetype?: string | null,
  legalityReputation?: number,
  academicReputation?: number,
): number {
  const games = wins + losses || 1;
  const actual = wins / games;
  const expected = expectedWinPct(prestige);
  const diff = expected - actual; // positive = underperformed
  let delta = diff * 140; // a full season well below expectation swings hot seat hard
  // A Program Builder's administration/fanbase is more patient in both directions.
  if (archetype === "PROGRAM_BUILDER") delta *= 0.7;
  // A scandal-prone program burns hotter at image-conscious (high-academic-reputation) schools.
  if (legalityReputation !== undefined && academicReputation !== undefined) {
    delta += clamp((academicReputation - legalityReputation) / 8, 0, 8);
  }
  return Math.round(clamp(currentHotSeat + delta, 0, 100));
}

// Legality reputation drifts back toward a neutral baseline each offseason —
// gives a bad stretch room to recover instead of permanently tanking a save.
export function driftLegalityReputation(current: number): number {
  return Math.round(clamp(current + (75 - current) * 0.15, 5, 99));
}

// Image-conscious (high-academic-reputation) programs won't hire a coach
// whose players keep getting arrested, even if the wins are there.
export function meetsLegalityBar(legalityReputation: number, academicReputation: number): boolean {
  const threshold = 25 + academicReputation * 0.5;
  return legalityReputation >= threshold;
}

export function shouldFire(hotSeatLevel: number, rng: () => number): boolean {
  if (hotSeatLevel < 70) return false;
  const fireChance = (hotSeatLevel - 70) / 30; // 70 -> 0%, 100 -> 100%
  return rng() < fireChance;
}

export function updatePrestige(
  currentPrestige: number,
  wins: number,
  losses: number,
  madeTournament: boolean,
  tournamentWins: number,
  background?: string | null,
): number {
  const games = wins + losses || 1;
  const winPct = wins / games;
  const performanceScore = winPct * 100 + (madeTournament ? 8 : 0) + tournamentWins * 4;
  let delta = (performanceScore - currentPrestige) * 0.06;
  // A Mid-Major Grinder has built a program up from nothing before — prestige
  // climbs a bit faster for them when they're overperforming.
  if (background === "MID_MAJOR_GRINDER" && delta > 0) delta *= 1.25;
  return Math.round(clamp(currentPrestige + delta, 5, 99));
}

export interface JobOpening {
  teamId: string;
  prestige: number;
  academicReputation?: number;
}

// A coach's reputation determines the ceiling of jobs realistically offered
// to them; success unlocks the coaching carousel upward.
export function generateJobOffers(
  reputation: number,
  currentPrestige: number,
  openings: JobOpening[],
  rng: () => number,
  maxOffers = 3,
  legalityReputation = 75,
): JobOpening[] {
  const ceiling = clamp(reputation + randInt(rng, -5, 15), 0, 100);
  const eligible = openings.filter((o) => {
    if (o.prestige > ceiling || o.prestige <= currentPrestige - 10) return false;
    if (o.academicReputation !== undefined && !meetsLegalityBar(legalityReputation, o.academicReputation)) return false;
    return true;
  });
  const sorted = [...eligible].sort((a, b) => b.prestige - a.prestige);
  return sorted.slice(0, maxOffers);
}

export function updateReputation(currentReputation: number, wins: number, losses: number, madeTournament: boolean, tournamentWins: number, wasFired: boolean): number {
  const games = wins + losses || 1;
  const winPct = wins / games;
  let delta = (winPct - 0.5) * 12 + (madeTournament ? 4 : -1) + tournamentWins * 3;
  if (wasFired) delta -= 15;
  return Math.round(clamp(currentReputation + delta, 1, 99));
}
