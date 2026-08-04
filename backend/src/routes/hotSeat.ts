import { Router } from "express";
import { prisma } from "../db";
import { computeStandings } from "../season/standings";
import { expectedWinPct } from "../engine/career";

export const hotSeatRouter = Router();

// A league-wide "who's in danger" board — anyone hot enough to matter (or
// riskier), plus the user's own team regardless, so they can always see
// where they stand relative to everyone else actually on the hot seat.
const HOT_SEAT_THRESHOLD = 25;
const MAX_ROWS = 50;

hotSeatRouter.get("/saves/:id/hot-seat", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const teams = await prisma.team.findMany({ where: { saveGameId: save.id }, include: { headCoach: true } });
  const standings = await computeStandings(save.id, save.currentSeasonYear);

  const rows = teams
    .filter((t) => t.headCoach)
    .map((t) => {
      const record = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return {
        teamId: t.id, teamName: t.name, division: t.division, state: t.state, prestige: t.prestige,
        isUserTeam: t.id === save.coachTeamId,
        coach: {
          name: t.headCoach!.name, archetype: t.headCoach!.archetype, background: t.headCoach!.background,
          hotSeatLevel: t.headCoach!.hotSeatLevel, yearsAtCurrentJob: t.headCoach!.yearsAtCurrentJob,
        },
        record,
        expectedWinPct: expectedWinPct(t.prestige),
      };
    });

  const eligible = rows.filter((r) => r.coach.hotSeatLevel >= HOT_SEAT_THRESHOLD || r.isUserTeam);
  let board = eligible.sort((a, b) => b.coach.hotSeatLevel - a.coach.hotSeatLevel).slice(0, MAX_ROWS);

  const userRow = rows.find((r) => r.isUserTeam);
  if (userRow && !board.some((r) => r.isUserTeam)) {
    board = [...board, userRow].sort((a, b) => b.coach.hotSeatLevel - a.coach.hotSeatLevel);
  }

  res.json(board);
});
