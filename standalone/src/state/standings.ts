import type { WorldState } from "./types";

export interface TeamRecord {
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
}

export function computeStandings(state: WorldState, seasonYear: number): Map<string, TeamRecord> {
  const map = new Map<string, TeamRecord>();
  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, { wins: 0, losses: 0, confWins: 0, confLosses: 0 });
    return map.get(id)!;
  };

  for (const g of state.games) {
    if (g.seasonYear !== seasonYear || !g.isPlayed || g.tournamentId !== null) continue;
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeWon = g.homeScore > g.awayScore;
    const home = ensure(g.homeTeamId);
    const away = ensure(g.awayTeamId);
    if (homeWon) {
      home.wins++; away.losses++;
      if (g.isConference) { home.confWins++; away.confLosses++; }
    } else {
      away.wins++; home.losses++;
      if (g.isConference) { away.confWins++; home.confLosses++; }
    }
  }

  return map;
}

export function winPct(r: TeamRecord): number {
  const games = r.wins + r.losses;
  return games === 0 ? 0 : r.wins / games;
}

export function confWinPct(r: TeamRecord): number {
  const games = r.confWins + r.confLosses;
  return games === 0 ? 0 : r.confWins / games;
}
