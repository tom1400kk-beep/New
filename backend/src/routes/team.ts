import { Router } from "express";
import { prisma } from "../db";
import { computeStandings } from "../season/standings";
import { sortedPair } from "../engine/rivalry";

export const teamRouter = Router();

teamRouter.get("/saves/:id/roster", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json([]);
  const players = await prisma.player.findMany({
    where: { saveGameId: save.id, teamId: save.coachTeamId },
    orderBy: [{ classYear: "asc" }, { scoring: "desc" }],
  });
  res.json(players);
});

teamRouter.get("/saves/:id/schedule", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json([]);
  const games = await prisma.game.findMany({
    where: {
      saveGameId: save.id,
      seasonYear: save.currentSeasonYear,
      OR: [{ homeTeamId: save.coachTeamId }, { awayTeamId: save.coachTeamId }],
    },
    include: { homeTeam: true, awayTeam: true, tournament: true },
    orderBy: { date: "asc" },
  });
  const rivalries = await prisma.rivalry.findMany({
    where: { saveGameId: save.id, active: true, OR: [{ teamAId: save.coachTeamId }, { teamBId: save.coachTeamId }] },
  });
  const rivalIntensityByOpponent = new Map<string, number>();
  for (const r of rivalries) {
    rivalIntensityByOpponent.set(r.teamAId === save.coachTeamId ? r.teamBId : r.teamAId, r.intensity);
  }
  res.json(games.map((g) => {
    const opponentId = g.homeTeamId === save.coachTeamId ? g.awayTeamId : g.homeTeamId;
    const rivalryIntensity = rivalIntensityByOpponent.get(opponentId);
    return { ...g, isRivalry: rivalryIntensity !== undefined, rivalryIntensity: rivalryIntensity ?? null };
  }));
});

teamRouter.get("/saves/:id/rivalries", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json([]);
  const rivalries = await prisma.rivalry.findMany({
    where: { saveGameId: save.id, active: true, OR: [{ teamAId: save.coachTeamId }, { teamBId: save.coachTeamId }] },
    orderBy: { intensity: "desc" },
  });
  const opponentIds = rivalries.map((r) => (r.teamAId === save.coachTeamId ? r.teamBId : r.teamAId));
  const opponents = await prisma.team.findMany({ where: { id: { in: opponentIds } } });
  const opponentById = new Map(opponents.map((t) => [t.id, t]));

  const result = [];
  for (const r of rivalries) {
    const opponentId = r.teamAId === save.coachTeamId ? r.teamBId : r.teamAId;
    const opponent = opponentById.get(opponentId);
    if (!opponent) continue;
    const [pairA, pairB] = sortedPair(save.coachTeamId, opponentId);
    const meetings = await prisma.game.findMany({
      where: { saveGameId: save.id, isPlayed: true, OR: [{ homeTeamId: pairA, awayTeamId: pairB }, { homeTeamId: pairB, awayTeamId: pairA }] },
    });
    const wins = meetings.filter((g) => g.homeTeamId === save.coachTeamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0)).length;
    result.push({
      teamId: opponent.id, teamName: opponent.name, intensity: r.intensity, origin: r.origin,
      establishedYear: r.establishedYear, postseasonMeetings: r.postseasonMeetings,
      allTimeRecord: { wins, losses: meetings.length - wins },
    });
  }
  res.json(result);
});

teamRouter.get("/saves/:id/standings", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json({ conferenceName: null, rows: [] });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId } });
  const confTeams = await prisma.team.findMany({ where: { saveGameId: save.id, conferenceId: team.conferenceId }, include: { conference: true } });
  const standings = await computeStandings(save.id, save.currentSeasonYear);

  const rows = confTeams
    .map((t) => {
      const r = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return { teamId: t.id, name: t.name, wins: r.wins, losses: r.losses, confWins: r.confWins, confLosses: r.confLosses };
    })
    .sort((a, b) => b.confWins / Math.max(1, b.confWins + b.confLosses) - a.confWins / Math.max(1, a.confWins + a.confLosses));

  res.json({ conferenceName: confTeams[0]?.conference?.name ?? null, rows });
});
