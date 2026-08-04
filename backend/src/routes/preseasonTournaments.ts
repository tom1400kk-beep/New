import { Router } from "express";
import { prisma } from "../db";
import { PRESEASON_EVENTS, type PreseasonEventDef } from "../engine/preseasonEvents";

export const preseasonTournamentsRouter = Router();

// How far below the field's current weakest invite a team's prestige can sit
// and still plausibly get a bid — mirrors the real-world gap between one
// prestige tier and the next (~14-18 points), so it's a genuine invite, not
// a rubber stamp.
const PRESTIGE_GRACE_MARGIN = 10;

function eventDefForTournamentName(name: string | null): PreseasonEventDef | undefined {
  if (!name) return undefined;
  return PRESEASON_EVENTS.find((e) => name === `${e.name} — ${e.location}`);
}

// Every PRESEASON_INVITATIONAL tournament (D1's curated list and D2/D3's
// procedurally generated ones alike) stores its full display name as
// "Event Name — Location" — split that back apart for display.
function splitNameLocation(fullName: string | null): { name: string; location: string | null } {
  if (!fullName) return { name: "", location: null };
  const idx = fullName.indexOf(" — ");
  if (idx === -1) return { name: fullName, location: null };
  return { name: fullName.slice(0, idx), location: fullName.slice(idx + 3) };
}

function isPrestigeEligible(userPrestige: number, field: { prestige: number }[]): boolean {
  if (field.length === 0) return true;
  const minFieldPrestige = Math.min(...field.map((f) => f.prestige));
  return userPrestige >= minFieldPrestige - PRESTIGE_GRACE_MARGIN;
}

async function loadFields(saveGameId: string, seasonYear: number, division?: string) {
  const tournaments = await prisma.tournament.findMany({
    where: { saveGameId, seasonYear, type: "PRESEASON_INVITATIONAL", ...(division ? { division } : {}) },
    include: { games: { select: { homeTeamId: true, awayTeamId: true, date: true } } },
  });
  const teamIds = new Set<string>();
  for (const t of tournaments) for (const g of t.games) { teamIds.add(g.homeTeamId); teamIds.add(g.awayTeamId); }
  const teams = await prisma.team.findMany({ where: { id: { in: [...teamIds] } }, select: { id: true, name: true, prestige: true } });
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return { tournaments, teamById };
}

preseasonTournamentsRouter.get("/saves/:id/preseason-tournaments", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const userTeamId = save.coachTeamId;
  const userTeam = userTeamId ? await prisma.team.findUnique({ where: { id: userTeamId }, select: { division: true, prestige: true } }) : null;

  const { tournaments, teamById } = await loadFields(save.id, save.currentSeasonYear, userTeam?.division);

  const board = tournaments.map((t) => {
    const fieldIds = [...new Set(t.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
    const field = fieldIds
      .map((id) => teamById.get(id))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .sort((a, b) => b.prestige - a.prestige);
    const eventDef = eventDefForTournamentName(t.name);
    const { name, location } = splitNameLocation(t.name);
    const minDate = t.games.length > 0 ? Math.min(...t.games.map((g) => g.date.getTime())) : Infinity;
    return {
      tournamentId: t.id,
      name,
      format: t.format ?? eventDef?.format ?? null,
      tier: eventDef?.tier ?? null,
      location,
      field: field.map((f) => ({ teamId: f.id, name: f.name, prestige: f.prestige })),
      userTeamIn: !!userTeamId && fieldIds.includes(userTeamId),
      eligible: userTeam ? isPrestigeEligible(userTeam.prestige, field) : false,
      minDate,
    };
  });

  // D1 teams are auto-assigned to at most one curated invitational and can
  // freely leave it; D2/D3 teams are auto-assigned to one or (occasionally)
  // two procedurally generated events, and only the later-dated of the two
  // — a bonus slot, not their primary placement — can be declined.
  let declinableTournamentId: string | null = null;
  if (userTeam && userTeam.division !== "D1") {
    const mine = board.filter((t) => t.userTeamIn).sort((a, b) => a.minDate - b.minDate);
    if (mine.length > 1) declinableTournamentId = mine[mine.length - 1].tournamentId;
  }

  const boardOut = board.map(({ minDate, ...rest }) => ({
    ...rest,
    canDecline: userTeam?.division === "D1" ? rest.userTeamIn : rest.tournamentId === declinableTournamentId,
  }));

  boardOut.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === "MAJOR" ? -1 : b.tier === "MAJOR" ? 1 : a.tier === "MID" ? -1 : 1));

  res.json({
    editable: save.currentPhase === "PRESEASON",
    userDivision: userTeam?.division ?? null,
    tournaments: boardOut,
  });
});

// Swaps a team's non-conference slate (including any preseason tournament
// games) with another team's — safe at this point since PRESEASON games are
// always unplayed, and it guarantees no orphaned or double-booked dates
// since both teams simply trade places game-for-game. When a team has two
// in-season events (D2/D3 only), excludeTournamentId keeps the OTHER
// (non-declined) event's games out of the swap entirely, so declining a
// bonus second event never disturbs the team's primary placement.
async function swapNonConferenceSlates(
  saveGameId: string, seasonYear: number, teamAId: string, teamBId: string, excludeTournamentId?: string | null,
) {
  const games = await prisma.game.findMany({
    where: {
      saveGameId, seasonYear, isConference: false,
      ...(excludeTournamentId ? { tournamentId: { not: excludeTournamentId } } : {}),
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

  const userTeam = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, select: { prestige: true, division: true } });
  if (tournament.division !== userTeam.division) {
    return res.status(400).json({ error: "That event isn't at your division" });
  }
  if (userTeam.division !== "D1") {
    return res.status(400).json({ error: "D2/D3 in-season events are auto-assigned — only a bonus second event, if offered, can be declined." });
  }
  if (!isPrestigeEligible(userTeam.prestige, fieldTeams)) {
    return res.status(400).json({ error: "Your program isn't competitive enough to draw an invite to this event" });
  }

  const partner = [...fieldTeams].sort((a, b) => a.prestige - b.prestige)[0];
  if (!partner) return res.status(400).json({ error: "Event has no field to swap into" });

  await swapNonConferenceSlates(save.id, save.currentSeasonYear, save.coachTeamId, partner.id);
  res.json({ ok: true, swappedWithTeamId: partner.id });
});

// D1: leaves a team's one auto-assigned invitational, freely, same as
// always. D2/D3: declines one of a team's auto-assigned in-season events —
// but only the later-dated of two (the bonus slot); a team's sole/primary
// event is mandatory and this route rejects an attempt to decline it.
preseasonTournamentsRouter.post("/saves/:id/preseason-tournaments/:tournamentId/leave", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });
  if (save.currentPhase !== "PRESEASON") return res.status(400).json({ error: "Schedule can only be edited during the preseason" });

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: req.params.tournamentId },
    include: { games: { select: { homeTeamId: true, awayTeamId: true, date: true } } },
  });
  if (tournament.saveGameId !== save.id || tournament.type !== "PRESEASON_INVITATIONAL") {
    return res.status(400).json({ error: "Not a preseason tournament for this save" });
  }
  const fieldIds = [...new Set(tournament.games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  if (!fieldIds.includes(save.coachTeamId)) return res.status(400).json({ error: "Not currently in this event" });

  const userTeam = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, select: { division: true } });

  let excludeTournamentId: string | null = null;
  if (userTeam.division !== "D1") {
    const { tournaments } = await loadFields(save.id, save.currentSeasonYear, userTeam.division);
    const mine = tournaments
      .filter((t) => t.games.some((g) => g.homeTeamId === save.coachTeamId || g.awayTeamId === save.coachTeamId))
      .map((t) => ({ id: t.id, minDate: Math.min(...t.games.map((g) => g.date.getTime())) }))
      .sort((a, b) => a.minDate - b.minDate);
    const declinable = mine.length > 1 ? mine[mine.length - 1].id : null;
    if (tournament.id !== declinable) {
      return res.status(400).json({ error: "This is your primary in-season event — it's auto-assigned and can't be declined. Only a bonus second event can be." });
    }
    excludeTournamentId = mine.find((t) => t.id !== tournament.id)?.id ?? null;
  }

  const assignedIds = new Set(
    (await prisma.tournament.findMany({
      where: { saveGameId: save.id, seasonYear: save.currentSeasonYear, type: "PRESEASON_INVITATIONAL" },
      include: { games: { select: { homeTeamId: true, awayTeamId: true } } },
    })).flatMap((t) => t.games.flatMap((g) => [g.homeTeamId, g.awayTeamId])),
  );
  const unassigned = await prisma.team.findMany({
    where: { saveGameId: save.id, division: userTeam.division, id: { notIn: [...assignedIds] } },
    select: { id: true },
    take: 50,
  });
  const partner = unassigned[Math.floor(Math.random() * unassigned.length)];
  if (!partner) return res.status(400).json({ error: "No open non-conference slate to swap into" });

  await swapNonConferenceSlates(save.id, save.currentSeasonYear, save.coachTeamId, partner.id, excludeTournamentId);
  res.json({ ok: true, swappedWithTeamId: partner.id });
});
