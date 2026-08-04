import { Router } from "express";
import { prisma } from "../db";
import { computeStandings } from "../season/standings";
import { computeKenPomRatings, type TeamGameBoxScore } from "../engine/kenpom";
import { computeRPI, type RPIGameResult } from "../engine/rpi";
import { projectBracketology, type BracketTeamInput } from "../engine/bracketology";

export const rankingsRouter = Router();

export async function d1Teams(saveGameId: string) {
  return prisma.team.findMany({ where: { saveGameId, division: "D1" }, select: { id: true, name: true, conferenceId: true, prestige: true } });
}

// KenPom-style ratings weigh every game played, including conference and
// NCAA tournament games, the same way the real system updates all season —
// unlike the W-L record shown elsewhere, which is regular-season only.
export async function buildKenPomBoxScores(saveGameId: string, seasonYear: number): Promise<TeamGameBoxScore[]> {
  const games = await prisma.game.findMany({
    where: { saveGameId, seasonYear, isPlayed: true },
    select: { id: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });
  const gameIds = games.map((g) => g.id);
  const grouped = await prisma.playerGameStat.groupBy({
    by: ["gameId", "teamId"],
    where: { gameId: { in: gameIds } },
    _sum: { fga: true, fta: true, turnovers: true, rebounds: true },
  });
  const statByGameTeam = new Map<string, { fga: number; fta: number; turnovers: number; rebounds: number }>();
  for (const g of grouped) {
    statByGameTeam.set(`${g.gameId}|${g.teamId}`, {
      fga: g._sum.fga ?? 0, fta: g._sum.fta ?? 0, turnovers: g._sum.turnovers ?? 0, rebounds: g._sum.rebounds ?? 0,
    });
  }

  const boxScores: TeamGameBoxScore[] = [];
  for (const g of games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeStats = statByGameTeam.get(`${g.id}|${g.homeTeamId}`);
    const awayStats = statByGameTeam.get(`${g.id}|${g.awayTeamId}`);
    if (!homeStats || !awayStats) continue;
    boxScores.push({ gameId: g.id, teamId: g.homeTeamId, points: g.homeScore, opponentPoints: g.awayScore, ...homeStats });
    boxScores.push({ gameId: g.id, teamId: g.awayTeamId, points: g.awayScore, opponentPoints: g.homeScore, ...awayStats });
  }
  return boxScores;
}

// RPI sticks to the regular-season game set (matches the W-L record shown
// everywhere else in the app), the traditional convention for the metric.
export async function buildRPIResults(saveGameId: string, seasonYear: number): Promise<RPIGameResult[]> {
  const games = await prisma.game.findMany({
    where: { saveGameId, seasonYear, isPlayed: true, tournamentId: null },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });
  const results: RPIGameResult[] = [];
  for (const g of games) {
    if (g.homeScore === null || g.awayScore === null) continue;
    const homeWon = g.homeScore > g.awayScore;
    results.push({ teamId: g.homeTeamId, opponentId: g.awayTeamId, won: homeWon });
    results.push({ teamId: g.awayTeamId, opponentId: g.homeTeamId, won: !homeWon });
  }
  return results;
}

rankingsRouter.get("/saves/:id/kenpom", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const teams = await d1Teams(save.id);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const boxScores = await buildKenPomBoxScores(save.id, save.currentSeasonYear);
  const ratings = computeKenPomRatings(boxScores.filter((b) => teamById.has(b.teamId)));

  const rows = [...ratings.values()]
    .filter((r) => teamById.has(r.teamId))
    .sort((a, b) => b.adjEM - a.adjEM)
    .map((r, i) => ({ rank: i + 1, name: teamById.get(r.teamId)!.name, ...r }));
  res.json(rows);
});

rankingsRouter.get("/saves/:id/rpi", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const teams = await d1Teams(save.id);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const results = await buildRPIResults(save.id, save.currentSeasonYear);
  const ratings = computeRPI(results.filter((r) => teamById.has(r.teamId)));

  const rows = [...ratings.values()]
    .filter((r) => teamById.has(r.teamId))
    .sort((a, b) => b.rpi - a.rpi)
    .map((r, i) => ({ rank: i + 1, name: teamById.get(r.teamId)!.name, ...r }));
  res.json(rows);
});

rankingsRouter.get("/saves/:id/bracketology", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const teams = await d1Teams(save.id);

  const [boxScores, rpiResults, standings] = await Promise.all([
    buildKenPomBoxScores(save.id, save.currentSeasonYear),
    buildRPIResults(save.id, save.currentSeasonYear),
    computeStandings(save.id, save.currentSeasonYear),
  ]);
  const kenpom = computeKenPomRatings(boxScores);
  const rpi = computeRPI(rpiResults);

  const kenpomRankOf = new Map([...kenpom.values()].sort((a, b) => b.adjEM - a.adjEM).map((r, i) => [r.teamId, i + 1]));
  const rpiRankOf = new Map([...rpi.values()].sort((a, b) => b.rpi - a.rpi).map((r, i) => [r.teamId, i + 1]));

  const inputs: BracketTeamInput[] = teams
    .filter((t) => kenpomRankOf.has(t.id) && rpiRankOf.has(t.id))
    .map((t) => {
      const record = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return {
        teamId: t.id, name: t.name, conferenceId: t.conferenceId,
        wins: record.wins, losses: record.losses, confWins: record.confWins, confLosses: record.confLosses,
        kenpomRank: kenpomRankOf.get(t.id)!, rpiRank: rpiRankOf.get(t.id)!,
      };
    });

  res.json(projectBracketology(inputs));
});
