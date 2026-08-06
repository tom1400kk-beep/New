import { Router } from "express";
import { prisma } from "../db";

export const awardsRouter = Router();

interface AwardEntry {
  type: string;
  playerId: string | null;
  playerName: string | null;
  coachId: string | null;
  coachName: string | null;
  teamId: string | null;
  teamName: string | null;
}

// Season/division-scoped view of end-of-regular-season honors (see
// engine/awards.ts + season/awards.ts for how these get computed and stored).
// Defaults to the most recent season with any awards, and D1, so the page
// has something to show without the caller needing prior knowledge.
awardsRouter.get("/saves/:id/awards", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });

  const seasonRows = await prisma.seasonAward.findMany({
    where: { saveGameId: save.id },
    select: { seasonYear: true },
    distinct: ["seasonYear"],
    orderBy: { seasonYear: "desc" },
  });
  const availableSeasons = seasonRows.map((r) => r.seasonYear);

  const requestedSeason = req.query.seasonYear ? Number(req.query.seasonYear) : undefined;
  const seasonYear = requestedSeason ?? availableSeasons[0] ?? null;
  const division = typeof req.query.division === "string" ? req.query.division : "D1";

  if (seasonYear === null) {
    return res.json({ seasonYear: null, division, availableSeasons, playerOfYear: null, coachOfYear: null, allAmerican: { first: [], second: [], third: [] }, allConference: [] });
  }

  const awards = await prisma.seasonAward.findMany({ where: { saveGameId: save.id, seasonYear } });

  const conferences = await prisma.conference.findMany({ where: { saveGameId: save.id, division }, select: { id: true, name: true } });
  const conferenceIds = new Set(conferences.map((c) => c.id));
  const conferenceNameById = new Map(conferences.map((c) => [c.id, c.name]));

  const playerIds = [...new Set(awards.map((a) => a.playerId).filter((x): x is string => x !== null))];
  const coachIds = [...new Set(awards.map((a) => a.coachId).filter((x): x is string => x !== null))];
  const teamIds = [...new Set(awards.map((a) => a.teamId).filter((x): x is string => x !== null))];

  const [players, coaches, teams] = await Promise.all([
    prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.coach.findMany({ where: { id: { in: coachIds } }, select: { id: true, name: true } }),
    prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } }),
  ]);
  const playerNameById = new Map(players.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const coachNameById = new Map(coaches.map((c) => [c.id, c.name]));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  function toEntry(a: (typeof awards)[number]): AwardEntry {
    return {
      type: a.type,
      playerId: a.playerId, playerName: a.playerId ? playerNameById.get(a.playerId) ?? null : null,
      coachId: a.coachId, coachName: a.coachId ? coachNameById.get(a.coachId) ?? null : null,
      teamId: a.teamId, teamName: a.teamId ? teamNameById.get(a.teamId) ?? null : null,
    };
  }

  const nationalAwards = awards.filter((a) => a.division === division);
  const poyRow = nationalAwards.find((a) => a.type === "PLAYER_OF_YEAR");
  const coyRow = nationalAwards.find((a) => a.type === "COACH_OF_YEAR");

  const allAmerican = {
    first: nationalAwards.filter((a) => a.type === "ALL_AMERICAN_FIRST").map(toEntry),
    second: nationalAwards.filter((a) => a.type === "ALL_AMERICAN_SECOND").map(toEntry),
    third: nationalAwards.filter((a) => a.type === "ALL_AMERICAN_THIRD").map(toEntry),
  };

  const confAwards = awards.filter((a) => a.conferenceId && conferenceIds.has(a.conferenceId));
  const allConference = conferences
    .map((c) => ({
      conferenceId: c.id,
      conferenceName: c.name,
      first: confAwards.filter((a) => a.conferenceId === c.id && a.type === "ALL_CONFERENCE_FIRST").map(toEntry),
      second: confAwards.filter((a) => a.conferenceId === c.id && a.type === "ALL_CONFERENCE_SECOND").map(toEntry),
    }))
    .filter((c) => c.first.length > 0 || c.second.length > 0);

  res.json({
    seasonYear, division, availableSeasons,
    playerOfYear: poyRow ? toEntry(poyRow) : null,
    coachOfYear: coyRow ? toEntry(coyRow) : null,
    allAmerican, allConference,
  });
});
