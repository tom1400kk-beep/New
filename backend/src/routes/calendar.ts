import { Router } from "express";
import { prisma } from "../db";
import { buildSeasonCalendar } from "../engine/seasonCalendar";
import type { Division, TournamentType } from "../types";

export const calendarRouter = Router();

function nationalTournamentType(division: Division): TournamentType {
  return division === "D1" ? "NCAA_TOURNAMENT" : division === "D2" ? "D2_NATIONAL" : "D3_NATIONAL";
}

calendarRouter.get("/saves/:id/calendar", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });

  let division: Division = "D1";
  if (save.coachTeamId) {
    const team = await prisma.team.findUnique({ where: { id: save.coachTeamId }, select: { division: true } });
    if (team) division = team.division as Division;
  }
  const seasonYear = save.currentSeasonYear;

  const [regAgg, preAgg, confAgg, natAgg, confs] = await Promise.all([
    prisma.game.aggregate({
      where: { saveGameId: save.id, seasonYear, tournamentId: null, homeTeam: { is: { division } } },
      _min: { date: true }, _max: { date: true },
    }),
    prisma.game.aggregate({
      where: { saveGameId: save.id, seasonYear, tournament: { is: { type: "PRESEASON_INVITATIONAL", division } } },
      _min: { date: true },
    }),
    prisma.game.aggregate({
      where: { saveGameId: save.id, seasonYear, tournament: { is: { type: "CONFERENCE_TOURNAMENT", division } } },
      _min: { date: true }, _max: { date: true },
    }),
    prisma.game.aggregate({
      where: { saveGameId: save.id, seasonYear, tournament: { is: { type: nationalTournamentType(division), division } } },
      _min: { date: true }, _max: { date: true },
    }),
    prisma.conference.findMany({ where: { saveGameId: save.id, division }, select: { teams: { select: { id: true } } } }),
  ]);

  const conferenceTeamCounts = confs.map((c) => c.teams.length);
  const divisionTeamCount = conferenceTeamCounts.reduce((s, n) => s + n, 0);

  const milestones = buildSeasonCalendar({
    seasonYear,
    division,
    regularSeasonRange: regAgg._min.date && regAgg._max.date ? { start: regAgg._min.date, end: regAgg._max.date } : null,
    preseasonEventsStart: preAgg._min.date ?? null,
    conferenceTeamCounts,
    divisionTeamCount,
    confTourneyRange: confAgg._min.date && confAgg._max.date ? { start: confAgg._min.date, end: confAgg._max.date } : null,
    nationalRange: natAgg._min.date && natAgg._max.date ? { start: natAgg._min.date, end: natAgg._max.date } : null,
  });

  res.json({
    seasonYear, division,
    currentDate: save.currentDate, currentPhase: save.currentPhase,
    milestones,
  });
});
