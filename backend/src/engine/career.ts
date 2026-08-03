import { clamp, randInt } from "./rng";

// Higher-prestige jobs come with higher win expectations from the AD — this
// is what makes the hot seat meaningful (going 18-13 is fine at a low-major,
// a firing offense at a blue-blood).
export function expectedWinPct(prestige: number): number {
  return clamp(0.3 + (prestige / 100) * 0.45, 0.3, 0.75);
}

export function updateHotSeat(currentHotSeat: number, wins: number, losses: number, prestige: number): number {
  const games = wins + losses || 1;
  const actual = wins / games;
  const expected = expectedWinPct(prestige);
  const diff = expected - actual; // positive = underperformed
  const delta = diff * 140; // a full season well below expectation swings hot seat hard
  return Math.round(clamp(currentHotSeat + delta, 0, 100));
}

export function shouldFire(hotSeatLevel: number, rng: () => number): boolean {
  if (hotSeatLevel < 70) return false;
  const fireChance = (hotSeatLevel - 70) / 30; // 70 -> 0%, 100 -> 100%
  return rng() < fireChance;
}

export function updatePrestige(currentPrestige: number, wins: number, losses: number, madeTournament: boolean, tournamentWins: number): number {
  const games = wins + losses || 1;
  const winPct = wins / games;
  const performanceScore = winPct * 100 + (madeTournament ? 8 : 0) + tournamentWins * 4;
  const delta = (performanceScore - currentPrestige) * 0.06;
  return Math.round(clamp(currentPrestige + delta, 5, 99));
}

export interface JobOpening {
  teamId: string;
  prestige: number;
}

// A coach's reputation determines the ceiling of jobs realistically offered
// to them; success unlocks the coaching carousel upward.
export function generateJobOffers(
  reputation: number,
  currentPrestige: number,
  openings: JobOpening[],
  rng: () => number,
  maxOffers = 3,
): JobOpening[] {
  const ceiling = clamp(reputation + randInt(rng, -5, 15), 0, 100);
  const eligible = openings.filter((o) => o.prestige <= ceiling && o.prestige > currentPrestige - 10);
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
