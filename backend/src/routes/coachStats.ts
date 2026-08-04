import { Router } from "express";
import { prisma } from "../db";

export const coachStatsRouter = Router();

coachStatsRouter.get("/saves/:id/coach-stats", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json(null);

  const team = await prisma.team.findUnique({ where: { id: save.coachTeamId }, include: { headCoach: true } });
  if (!team?.headCoach) return res.json(null);
  const coach = team.headCoach;

  const seasonRecords = await prisma.coachSeasonRecord.findMany({
    where: { coachId: coach.id },
    orderBy: { seasonYear: "asc" },
  });
  const teamIds = [...new Set(seasonRecords.map((r) => r.teamId))];
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } });
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const bySeason = seasonRecords.map((r) => ({
    seasonYear: r.seasonYear,
    teamId: r.teamId,
    teamName: teamNameById.get(r.teamId) ?? "—",
    wins: r.wins,
    losses: r.losses,
    confWins: r.confWins,
    confLosses: r.confLosses,
    madePostseason: r.madePostseason,
    postseasonWins: r.postseasonWins,
  }));

  const byTeamMap = new Map<string, { teamId: string; teamName: string; seasons: number; wins: number; losses: number }>();
  for (const r of seasonRecords) {
    const existing = byTeamMap.get(r.teamId) ?? { teamId: r.teamId, teamName: teamNameById.get(r.teamId) ?? "—", seasons: 0, wins: 0, losses: 0 };
    existing.seasons += 1;
    existing.wins += r.wins;
    existing.losses += r.losses;
    byTeamMap.set(r.teamId, existing);
  }
  const byTeam = [...byTeamMap.values()].sort((a, b) => b.seasons - a.seasons);

  res.json({
    coachName: coach.name,
    total: { wins: coach.careerWins, losses: coach.careerLosses },
    bySeason,
    byTeam,
  });
});
