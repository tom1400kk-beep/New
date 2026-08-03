import { Router } from "express";
import { prisma } from "../db";
import { computeStandings } from "../season/standings";

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
  res.json(games);
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
