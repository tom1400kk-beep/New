import { Router } from "express";
import { prisma } from "../db";
import { PRESEASON_EVENTS, type PreseasonEventDef } from "../engine/preseasonEvents";

export const preseasonTournamentsRouter = Router();

function eventDefForTournamentName(name: string | null): PreseasonEventDef | undefined {
  if (!name) return undefined;
  return PRESEASON_EVENTS.find((e) => name === `${e.name} — ${e.location}`);
}

async function loadFields(saveGameId: string, seasonYear: number) {
  const tournaments = await prisma.tournament.findMany({
    where: { saveGameId, seasonYear, type: "PRESEASON_INVITATIONAL" },
    include: { games: { select: { homeTeamId: true, awayTeamId: true } } },
  });
  const teamIds = new Set<string>();
  for (const t of tournaments) for (const g of t.games) { teamIds.add(g.homeTeamId); teamIds.add(g.awayTeamId); }
  const teams = await prisma.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id: true, name: true, prestige: true } });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return { tournaments, teamById };
}

preseasonTournamentsRouter.get("/saves/:id/preseason-tournaments", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const { tournaments, teamById } = await loadFields(save.id, save.currentSeasonYear);

  const userTeamId = save.coachTeamId;
  const board = tournaments.map((t) => {
    const fieldIds = [...new Set(t.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
    const field = fieldIds
      .map((id) => teamById.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .sort((a, b) => b.prestige - a.prestige);
    const eventDef = eventDefForTournamentName(t.name);
    return {
      tournamentId: t.id,
      name: t.name,
      format: eventDef?.format ?? null,
      tier: eventDef?.tier ?? null,
      field: field.map((f) => ({ teamId: f.id, name: f.name, prestige: f.prestige })),
      userTeamIn: !!userTeamId && fieldIds.includes(userTeamId),
    };
  });

  board.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "MAJOR" ? -1 : b.tier === "MAJOR" ? 1 : a.tier === "MID" ? -1 : 1));

  res.json({
    editable: save.currentPhase === "PRESEASON",
    userDivision: userTeamId ? (await prisma.team.findUnique({ where: { id: userTeamId }, select: { division: true } }))?.division ?? null : null,
    tournaments: board,
  });
});

// Swaps a team's entire non-conference slate (including any preseason
// tournament games) with another team's — safe at this point since PRESEASON
// games are always unplayed, and it guarantees no orphaned or double-booked
// dates since both teams simply trade places game-for-game.
async function swapNonConferenceSlates(saveGameId: string, seasonYear: number, teamAId: string, teamBId: string) {
  const games = await prisma.game.findMany({
    where: {
      saveGameId, seasonYear, isConference: false,
      OR: [{ homeTeamId: teamAId }, { awayTeamId: teamAId }, { homeTeamId: teamBId }, { awayTeamId: teamBId }],
    },
  });
  for (const g of games) {
    const newHome = g.homeTeamId === teamAId ? teamBId : g.homeTeamId === teamBId ? teamAId : g.homeTeamId;
    const newAway = g.awayTeamId === teamAId ? teamBId : g.awayTeamId === teamBId ? teamAId : g.awayTeamId;
    if (newHome !== g.homeTeamId || newAway !== g.awayTeamId) {
      await prisma.game.update({ where: { id: g.id }, data: { homeTeamId: newHome, awayTeamId: newAway } });
    }
  }
}

preseasonTournamentsRouter.post("/saves/:id/preseason-tournaments/:tournamentId/join", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });
  if (save.currentPhase !== "PRESEASON") return res.status(400).json({ error: "Schedule can only be edited during the preseason" });

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: req.params.tournamentId },
    include: { games: { select: { homeTeamId: true, awayTeamId: true } } },
  });
  if (tournament.saveGameId !== save.id || tournament.type !== "PRESEASON_INVITATIONAL") {
    return res.status(400).json({ error: "Not a preseason tournament for this save" });
  }

  const fieldIds = [...new Set(tournament.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  if (fieldIds.includes(save.coachTeamId)) return res.status(400).json({ error: "Already in this event" });

  const fieldTeams = await prisma.team.findMany({ where: { id: { in: fieldIds } }, select: { id: true, prestige: true } });
  const partner = [...fieldTeams].sort((a, b) => a.prestige - b.prestige)[0];
  if (!partner) return res.status(400).json({ error: "Event has no field to swap into" });

  await swapNonConferenceSlates(save.id, save.currentSeasonYear, save.coachTeamId, partner.id);
  res.json({ ok: true, swappedWithTeamId: partner.id });
});

preseasonTournamentsRouter.post("/saves/:id/preseason-tournaments/leave", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });
  if (save.currentPhase !== "PRESEASON") return res.status(400).json({ error: "Schedule can only be edited during the preseason" });

  const { tournaments } = await loadFields(save.id, save.currentSeasonYear);
  const assignedIds = new Set(tournaments.flatMap((t) => t.games.flatMap((g) => [g.homeTeamId, g.awayTeamId])));
  if (!assignedIds.has(save.coachTeamId)) return res.status(400).json({ error: "Not currently in a preseason event" });

  const userTeam = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, select: { division: true } });
  const unassigned = await prisma.team.findMany({
    where: { saveGameId: save.id, division: userTeam.division, id: { notIn: [...assignedIds] } },
    select: { id: true },
    take: 50,
  });
  const partner = unassigned[Math.floor(Math.random() * unassigned.length)];
  if (!partner) return res.status(400).json({ error: "No open non-conference slate to swap into" });

  await swapNonConferenceSlates(save.id, save.currentSeasonYear, save.coachTeamId, partner.id);
  res.json({ ok: true, swappedWithTeamId: partner.id });
});
