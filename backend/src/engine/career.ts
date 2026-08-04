import { clamp, randInt } from "./rng";
import type { CoachArchetype } from "./coachArchetypes";

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
  campusAtmosphere?: number; // 1-100 — a coach who's built something beloved gets more benefit of the doubt
  rivalryWinPct?: number; // 0-1, this season's record specifically against active rivals — fans and the AD notice this independent of the overall record
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
  // Firing a coach who's built a beloved program is its own political cost —
  // a legendary atmosphere buys real leash during a rough patch.
  if (delta > 0 && mods.campusAtmosphere !== undefined) delta *= clamp(1.15 - mods.campusAtmosphere / 500, 0.85, 1.15);
  // Beating your rivals matters on its own, independent of the overall record.
  if (mods.rivalryWinPct !== undefined) delta += (0.5 - mods.rivalryWinPct) * 20;
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
  return Math.round(clamp(currentPrestige + delta, 5, 99));
}

export interface JobOpening {
  teamId: string;
  prestige: number;
  academicReputation?: number;
  athleticDirectorId?: string;
  integrityStandard?: number;
  state?: string; // team's home state — drives locality-aware offer generation below
  winFocus?: number; // AD trait, used to infer this program's preferred-hire profile
  patience?: number; // AD trait, used to infer this program's preferred-hire profile
  targetedHire?: boolean; // set on the returned offer when this program specifically wants this coach's profile
}

// A coach's real ties to a state — hometown, alma mater, or a recruiting
// pipeline built up over a career — make a local job meaningfully easier to
// land than a same-prestige job somewhere with no connection at all. Mirrors
// how actual coaching searches lean on "who already knows this place."
export interface CoachLocality {
  hometownState?: string | null;
  collegeState?: string | null;
  pipelineStates?: Record<string, number>;
}

function localityBonus(opening: JobOpening, locality?: CoachLocality): number {
  if (!locality || !opening.state) return 0;
  if (locality.hometownState && locality.hometownState === opening.state) return 18;
  if (locality.collegeState && locality.collegeState === opening.state) return 10;
  const score = locality.pipelineStates?.[opening.state];
  if (score === undefined) return 0;
  return clamp((score - 50) * 0.24, 0, 12);
}

// Some programs know exactly what they want rather than taking whoever's
// reachable: a win-obsessed AD wants a proven closer on the recruiting trail
// right now, a patient one is fine investing in a program-builder for the
// long haul. Most jobs have no strong preference either way.
export function preferredArchetypeForOpening(winFocus?: number, patience?: number): CoachArchetype | null {
  if (winFocus !== undefined && winFocus >= 70) return "RECRUITER";
  if (patience !== undefined && patience >= 70) return "PROGRAM_BUILDER";
  return null;
}

// A coach's reputation determines the ceiling of jobs realistically offered
// to them; success unlocks the coaching carousel upward. An AD who remembers
// this coach well from a previous job together can open a door a little
// wider than reputation alone would; one who remembers them badly won't
// hire them again at all, no matter how good the résumé looks now.
//
// careerWinPct (cumulative wins / (wins+losses) across the whole coaching
// career, undefined if they've never coached a game) layers a longer-run
// track record on top of reputation, which is itself just a single-season-
// weighted number — a career .650 coach and a career .350 coach with the
// same current reputation shouldn't see the same ceiling.
export function generateJobOffers(
  reputation: number,
  currentPrestige: number,
  openings: JobOpening[],
  rng: () => number,
  maxOffers = 3,
  legalityReputation = 75,
  coachAdRelationships: Record<string, number> = {},
  careerWinPct?: number,
  coachLocality?: CoachLocality,
  coachArchetype?: string,
): JobOpening[] {
  const trackRecordAdjust = careerWinPct !== undefined ? clamp((careerWinPct - 0.5) * 40, -20, 20) : 0;
  const ceiling = clamp(reputation + trackRecordAdjust + randInt(rng, -5, 15), 0, 100);

  const scored = openings.map((o) => {
    const locBonus = localityBonus(o, coachLocality);
    const preferredArchetype = preferredArchetypeForOpening(o.winFocus, o.patience);
    const targeted = !!(preferredArchetype && coachArchetype && preferredArchetype === coachArchetype);
    return { o, locBonus, targeted };
  });

  const eligible = scored.filter(({ o, locBonus, targeted }) => {
    const relScore = o.athleticDirectorId ? coachAdRelationships[o.athleticDirectorId] ?? 50 : 50;
    if (relScore <= 30) return false; // bad blood — this AD won't bring them back
    if (o.academicReputation !== undefined && !meetsLegalityBar(legalityReputation, o.academicReputation, o.integrityStandard)) return false;
    let effectiveCeiling = relScore >= 70 ? ceiling + 10 : ceiling;
    effectiveCeiling += locBonus;
    if (targeted) effectiveCeiling += 15; // they specifically want this coach — willing to stretch for them
    if (o.prestige > effectiveCeiling || o.prestige <= currentPrestige - 10) return false;
    return true;
  });
  const sorted = [...eligible].sort((a, b) =>
    (b.o.prestige + b.locBonus * 0.4 + (b.targeted ? 6 : 0)) - (a.o.prestige + a.locBonus * 0.4 + (a.targeted ? 6 : 0)));
  if (sorted.length > 0) return sorted.slice(0, maxOffers).map(({ o, targeted }) => ({ ...o, targetedHire: targeted }));
  if (openings.length === 0) return [];

  // Guaranteed floor: a real coaching search never leaves someone with
  // literally nowhere to go — some program at the bottom of a division will
  // always take a chance on a coach willing to take the job. This is what
  // keeps a rough stretch from ever becoming a permanent dead end.
  const legalityOk = openings.filter((o) =>
    o.academicReputation === undefined || meetsLegalityBar(legalityReputation, o.academicReputation, o.integrityStandard));
  const pool = legalityOk.length > 0 ? legalityOk : openings;
  const floor = [...pool].sort((a, b) => a.prestige - b.prestige)[0];
  return [floor];
}

export function updateReputation(currentReputation: number, wins: number, losses: number, madeTournament: boolean, tournamentWins: number, wasFired: boolean): number {
  const games = wins + losses || 1;
  const winPct = wins / games;
  let delta = (winPct - 0.5) * 12 + (madeTournament ? 4 : -1) + tournamentWins * 3;
  if (wasFired) delta -= 15;
  return Math.round(clamp(currentReputation + delta, 1, 99));
}
