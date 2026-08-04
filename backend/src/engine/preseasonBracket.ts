// Bracket/pool generation for early-season multi-team events (MTEs).
// Distinct from the single-elimination engine in postseason.ts: real MTEs
// guarantee every team a fixed number of games (a win/consolation "ladder"
// for bracket-style events, or straight round-robin for pool-play events)
// rather than eliminating losers outright.

export interface MTESeed {
  teamId: string;
  seed: number; // 1 = best
}

export interface MTEMatchup {
  slot: number;
  teamA: string;
  teamB: string;
}

export interface MTERoundResult {
  slot: number;
  winnerTeamId: string;
  loserTeamId: string;
}

function bySeed(seeds: MTESeed[]): MTESeed[] {
  return [...seeds].sort((a, b) => a.seed - b.seed);
}

// 8-team bracket, round 1: standard MTE seeding (1v8, 4v5, 2v7, 3v6) so the
// top seed's path mirrors the tightest real bracket structure.
export function buildBracket8FirstRound(seeds: MTESeed[]): MTEMatchup[] {
  const s = bySeed(seeds);
  const byId = (n: number) => s[n - 1]?.teamId;
  return [
    { slot: 0, teamA: byId(1), teamB: byId(8) },
    { slot: 1, teamA: byId(4), teamB: byId(5) },
    { slot: 2, teamA: byId(2), teamB: byId(7) },
    { slot: 3, teamA: byId(3), teamB: byId(6) },
  ].filter((m) => m.teamA && m.teamB);
}

// Round 2: winners of slots 0/1 continue in the championship half (new slots
// 0/1), losers of slots 0/1 continue in the consolation half (new slots 2/3),
// mirrored for slots 2/3 — everyone keeps playing regardless of round 1.
export function buildBracket8SecondRound(round1: MTERoundResult[]): MTEMatchup[] {
  const bySlot = new Map(round1.map((r) => [r.slot, r]));
  const r = (n: number) => bySlot.get(n);
  const matchups: MTEMatchup[] = [];
  const g0 = r(0), g1 = r(1), g2 = r(2), g3 = r(3);
  if (g0 && g1) matchups.push({ slot: 0, teamA: g0.winnerTeamId, teamB: g1.winnerTeamId });
  if (g2 && g3) matchups.push({ slot: 1, teamA: g2.winnerTeamId, teamB: g3.winnerTeamId });
  if (g0 && g1) matchups.push({ slot: 2, teamA: g0.loserTeamId, teamB: g1.loserTeamId });
  if (g2 && g3) matchups.push({ slot: 3, teamA: g2.loserTeamId, teamB: g3.loserTeamId });
  return matchups;
}

// Round 3 (final round): championship, 3rd-place, 5th-place, 7th-place games
// — every one of the 8 teams finishes with exactly 3 games and a final
// placement, matching the real Maui/Battle 4 Atlantis-style ladder.
export function buildBracket8ThirdRound(round2: MTERoundResult[]): MTEMatchup[] {
  const bySlot = new Map(round2.map((r) => [r.slot, r]));
  const r = (n: number) => bySlot.get(n);
  const matchups: MTEMatchup[] = [];
  const g0 = r(0), g1 = r(1), g2 = r(2), g3 = r(3);
  if (g0 && g1) {
    matchups.push({ slot: 0, teamA: g0.winnerTeamId, teamB: g1.winnerTeamId }); // championship
    matchups.push({ slot: 1, teamA: g0.loserTeamId, teamB: g1.loserTeamId }); // 3rd place
  }
  if (g2 && g3) {
    matchups.push({ slot: 2, teamA: g2.winnerTeamId, teamB: g3.winnerTeamId }); // 5th place
    matchups.push({ slot: 3, teamA: g2.loserTeamId, teamB: g3.loserTeamId }); // 7th place
  }
  return matchups;
}

// 4-team bracket, round 1: 1v4, 2v3.
export function buildBracket4FirstRound(seeds: MTESeed[]): MTEMatchup[] {
  const s = bySeed(seeds);
  const byId = (n: number) => s[n - 1]?.teamId;
  return [
    { slot: 0, teamA: byId(1), teamB: byId(4) },
    { slot: 1, teamA: byId(2), teamB: byId(3) },
  ].filter((m) => m.teamA && m.teamB);
}

// Round 2 (final round): championship + 3rd-place game — everyone finishes
// with exactly 2 games.
export function buildBracket4SecondRound(round1: MTERoundResult[]): MTEMatchup[] {
  const bySlot = new Map(round1.map((r) => [r.slot, r]));
  const g0 = bySlot.get(0), g1 = bySlot.get(1);
  if (!g0 || !g1) return [];
  return [
    { slot: 0, teamA: g0.winnerTeamId, teamB: g1.winnerTeamId }, // championship
    { slot: 1, teamA: g0.loserTeamId, teamB: g1.loserTeamId }, // 3rd place
  ];
}

// Standard "circle method" round-robin scheduling: splits every pairing
// among an even-sized team list into rounds where each team appears exactly
// once per round — so a 4-team pool plays out over 3 non-overlapping days
// instead of every pairing landing on the same date.
function scheduleRoundRobinRounds(teamIds: string[]): [string, string][][] {
  const n = teamIds.length;
  if (n < 2) return [];
  const ids = [...teamIds];
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      round.push([ids[i], ids[n - 1 - i]]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop()!); // rotate all but the fixed first team
  }
  return rounds;
}

// Pool play: split the field into `poolCount` even pools via snake-draft
// seeding (so each pool gets a balanced spread of talent, same idea as
// seeding conference tournament brackets), then full round-robin within each
// pool — no cross-pool games, no elimination. Games carry a `round` (0-based)
// so each team plays on `gamesPerTeam` separate days instead of everything
// piling onto the same date.
export function buildPoolGames(seeds: MTESeed[], poolCount: number): { poolIndex: number; round: number; teamA: string; teamB: string }[] {
  const s = bySeed(seeds);
  const pools: string[][] = Array.from({ length: poolCount }, () => []);
  s.forEach((seed, i) => {
    const lap = Math.floor(i / poolCount);
    const poolIndex = lap % 2 === 0 ? i % poolCount : poolCount - 1 - (i % poolCount);
    pools[poolIndex].push(seed.teamId);
  });

  const games: { poolIndex: number; round: number; teamA: string; teamB: string }[] = [];
  pools.forEach((pool, poolIndex) => {
    const rounds = scheduleRoundRobinRounds(pool);
    rounds.forEach((round, roundIndex) => {
      for (const [teamA, teamB] of round) {
        games.push({ poolIndex, round: roundIndex, teamA, teamB });
      }
    });
  });
  return games;
}
