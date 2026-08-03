import { clamp, randInt } from "./rng";

// Higher-prestige jobs come with higher win expectations from the AD — this
// is what makes the hot seat meaningful (going 18-13 is fine at a low-major,
// a firing offense at a blue-blood).
export function expectedWinPct(prestige: number): number {
  return clamp(0.3 + (prestige / 100) * 0.45, 0.3, 0.75);
}

export interface HotSeatModifiers {
  archetype?: string | null;
  legalityReputation?: number;
  academicReputation?: number;
  adPatience?: number; // AD's personal patience — damps swings independent of archetype
  adWinFocus?: number; // how much this AD weighs wins/losses vs everything else
}

export function updateHotSeat(
  currentHotSeat: number,
  wins: number,
  losses: number,
  prestige: number,
  mods: HotSeatModifiers = {},
): number {
  const games = wins + losses || 1;
  const actual = wins / games;
  const expected = expectedWinPct(prestige);
  const diff = expected - actual; // positive = underperformed
  let delta = diff * 140; // a full season well below expectation swings hot seat hard
  // A Program Builder's administration/fanbase is more patient in both directions.
  if (mods.archetype === "PROGRAM_BUILDER") delta *= 0.7;
  // A scandal-prone program burns hotter at image-conscious (high-academic-reputation) schools.
  if (mods.legalityReputation !== undefined && mods.academicReputation !== undefined) {
    delta += clamp((mods.academicReputation - mods.legalityReputation) / 8, 0, 8);
  }
  // The AD in charge has their own temperament — a win-obsessed AD swings harder,
  // a patient one damps it, independent of the coach's own archetype.
  if (mods.adWinFocus !== undefined) delta *= 0.5 + mods.adWinFocus / 100;
  if (mods.adPatience !== undefined) delta *= clamp(1.3 - mods.adPatience * 0.006, 0.7, 1.3);
  return Math.round(clamp(currentHotSeat + delta, 0, 100));
}

// Legality reputation drifts back toward a neutral baseline each offseason —
// gives a bad stretch room to recover instead of permanently tanking a save.
export function driftLegalityReputation(current: number): number {
  return Math.round(clamp(current + (75 - current) * 0.15, 5, 99));
}

// Image-conscious (high-academic-reputation) programs won't hire a coach
// whose players keep getting arrested, even if the wins are there — and the
// specific AD's own personal integrity standard stacks on top of that.
export function meetsLegalityBar(legalityReputation: number, academicReputation: number, integrityStandard?: number): boolean {
  const threshold = integrityStandard !== undefined
    ? 15 + academicReputation * 0.3 + integrityStandard * 0.35
    : 25 + academicReputation * 0.5;
  return legalityReputation >= threshold;
}

// adLoyalty/relationshipScore: a loyal AD who has a good personal history with
// this coach is slower to pull the trigger — but a loyal AD who already feels
// burned by this coach is actually quicker to, not slower.
export function shouldFire(hotSeatLevel: number, rng: () => number, adLoyalty?: number, relationshipScore?: number): boolean {
  if (hotSeatLevel < 70) return false;
  let fireChance = (hotSeatLevel - 70) / 30; // 70 -> 0%, 100 -> 100%
  if (adLoyalty !== undefined && relationshipScore !== undefined) {
    const loyaltyEffect = (adLoyalty / 100) * clamp((relationshipScore - 50) / 50, -1, 1);
    fireChance = clamp(fireChance - loyaltyEffect * 0.3, 0, 1);
  }
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
  athleticDirectorId?: string;
  integrityStandard?: number;
}

// A coach's reputation determines the ceiling of jobs realistically offered
// to them; success unlocks the coaching carousel upward. An AD who remembers
// this coach well from a previous job together can open a door a little
// wider than reputation alone would; one who remembers them badly won't
// hire them again at all, no matter how good the résumé looks now.
export function generateJobOffers(
  reputation: number,
  currentPrestige: number,
  openings: JobOpening[],
  rng: () => number,
  maxOffers = 3,
  legalityReputation = 75,
  coachAdRelationships: Record<string, number> = {},
): JobOpening[] {
  const ceiling = clamp(reputation + randInt(rng, -5, 15), 0, 100);
  const eligible = openings.filter((o) => {
    const relScore = o.athleticDirectorId ? coachAdRelationships[o.athleticDirectorId] ?? 50 : 50;
    if (relScore <= 30) return false; // bad blood — this AD won't bring them back
    if (o.academicReputation !== undefined && !meetsLegalityBar(legalityReputation, o.academicReputation, o.integrityStandard)) return false;
    const effectiveCeiling = relScore >= 70 ? ceiling + 10 : ceiling;
    if (o.prestige > effectiveCeiling || o.prestige <= currentPrestige - 10) return false;
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
