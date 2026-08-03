// Bracket construction for conference tournaments, the NCAA Tournament (68
// teams w/ First Four), the NIT, and D2/D3 national tournaments. All brackets
// reduce to the same generic single-elimination builder.

export interface SeedEntry {
  teamId: string;
  seed: number; // 1 = best
}

export interface BracketMatchup {
  round: number;
  slot: number; // position within the round, used to pair up next round
  teamA: string | null; // null = bye
  teamB: string | null;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard bracket seeding order (1 plays lowest seed, 2 plays next-lowest, etc.)
function seedingOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const sum = order.length * 2 + 1;
    for (const s of order) {
      next.push(s, sum - s);
    }
    order = next;
  }
  return order;
}

export function buildFirstRound(seeds: SeedEntry[]): BracketMatchup[] {
  const size = nextPowerOfTwo(seeds.length);
  const order = seedingOrder(size);
  const bySeed = new Map(seeds.map((s) => [s.seed, s.teamId]));

  const slots: (string | null)[] = order.map((seedNum) => bySeed.get(seedNum) ?? null);

  const matchups: BracketMatchup[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    matchups.push({ round: 1, slot: i / 2, teamA: slots[i], teamB: slots[i + 1] });
  }
  return matchups;
}

// Given completed round N winners (indexed by slot), build round N+1 matchups.
export function buildNextRound(round: number, winners: (string | null)[]): BracketMatchup[] {
  const matchups: BracketMatchup[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    matchups.push({ round: round + 1, slot: i / 2, teamA: winners[i] ?? null, teamB: winners[i + 1] ?? null });
  }
  return matchups;
}

export function totalRoundsForField(fieldSize: number): number {
  return Math.log2(nextPowerOfTwo(fieldSize));
}

// ---------- Field selection ----------

export interface ResumeTeam {
  teamId: string;
  conferenceId: string;
  wins: number;
  losses: number;
  prestige: number;
  isConferenceChampion: boolean;
}

function resumeScore(t: ResumeTeam): number {
  const games = t.wins + t.losses || 1;
  const winPct = t.wins / games;
  return winPct * 100 + t.prestige * 0.35;
}

export interface FieldSelectionResult {
  autoBids: ResumeTeam[];
  atLarge: ResumeTeam[];
  field: ResumeTeam[]; // sorted best -> worst, seeded 1..N
}

export function selectTournamentField(teams: ResumeTeam[], fieldSize: number): FieldSelectionResult {
  const champsByConf = new Map<string, ResumeTeam>();
  for (const t of teams) {
    if (t.isConferenceChampion) champsByConf.set(t.conferenceId, t);
  }
  const autoBids = [...champsByConf.values()];
  const autoIds = new Set(autoBids.map((t) => t.teamId));

  const remaining = teams
    .filter((t) => !autoIds.has(t.teamId))
    .sort((a, b) => resumeScore(b) - resumeScore(a));

  const atLargeCount = Math.max(0, fieldSize - autoBids.length);
  const atLarge = remaining.slice(0, atLargeCount);

  const field = [...autoBids, ...atLarge].sort((a, b) => resumeScore(b) - resumeScore(a));

  return { autoBids, atLarge, field };
}

export function seedField(field: ResumeTeam[]): SeedEntry[] {
  return field.map((t, i) => ({ teamId: t.teamId, seed: i + 1 }));
}
