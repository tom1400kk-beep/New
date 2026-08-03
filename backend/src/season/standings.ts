import { prisma } from "../db";

export interface TeamRecord {
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
}

export async function computeStandings(saveGameId: string, seasonYear: number): Promise<Map<string, TeamRecord>> {
  const games = await prisma.game.findMany({
    where: { saveGameId, seasonYear, isPlayed: true, tournamentId: null },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, isConference: true },
  });

  const map = new Map<string, TeamRecord>();
  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, { wins: 0, losses: 0, confWins: 0, confLosses: 0 });
    return map.get(id)!;
  };

  for (const g of games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeWon = g.homeScore > g.awayScore;
    const home = ensure(g.homeTeamId);
    const away = ensure(g.awayTeamId);
    if (homeWon) {
      home.wins++;
      away.losses++;
      if (g.isConference) { home.confWins++; away.confLosses++; }
    } else {
      away.wins++;
      home.losses++;
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
