import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { computeStandings } from "../season/standings";
import { sortedPair } from "../engine/rivalry";
import { meetsLegalityBar } from "../engine/career";
import { disciplineSigningReputationHit } from "../engine/disciplineDrops";
import { clamp } from "../engine/rng";
import { costOfLivingIndex } from "../engine/costOfLiving";
import { computeKenPomRatings } from "../engine/kenpom";
import { computeRPI } from "../engine/rpi";
import { d1Teams, buildKenPomBoxScores, buildRPIResults } from "./rankings";
import { DIVISION_RULES, type Division } from "../types";

export const teamRouter = Router();

// Full profile for an arbitrary team (not just the user's own) — powers the
// "click any team name" feature across the UI. KenPom/RPI are D1-only,
// mirroring the rest of the app's ranking pages.
teamRouter.get("/saves/:id/teams/:teamId", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: req.params.teamId },
    include: { headCoach: true, athleticDirector: true, conference: true },
  });
  if (team.saveGameId !== save.id) return res.status(404).json({ error: "Team not found in this save" });

  const standings = await computeStandings(save.id, save.currentSeasonYear);
  const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };

  const roster = await prisma.player.findMany({
    where: { saveGameId: save.id, teamId: team.id },
    orderBy: [{ classYear: "asc" }, { scoring: "desc" }],
  });

  let kenpom: { rank: number; adjEM: number } | null = null;
  let rpi: { rank: number; rpi: number } | null = null;
  if (team.division === "D1") {
    const teams = await d1Teams(save.id);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const [boxScores, rpiResults] = await Promise.all([
      buildKenPomBoxScores(save.id, save.currentSeasonYear),
      buildRPIResults(save.id, save.currentSeasonYear),
    ]);
    const kenpomSorted = [...computeKenPomRatings(boxScores.filter((b) => teamById.has(b.teamId))).values()]
      .filter((r) => teamById.has(r.teamId)).sort((a, b) => b.adjEM - a.adjEM);
    const rpiSorted = [...computeRPI(rpiResults.filter((r) => teamById.has(r.teamId))).values()]
      .filter((r) => teamById.has(r.teamId)).sort((a, b) => b.rpi - a.rpi);
    const kenpomIdx = kenpomSorted.findIndex((r) => r.teamId === team.id);
    const rpiIdx = rpiSorted.findIndex((r) => r.teamId === team.id);
    if (kenpomIdx >= 0) kenpom = { rank: kenpomIdx + 1, adjEM: kenpomSorted[kenpomIdx].adjEM };
    if (rpiIdx >= 0) rpi = { rank: rpiIdx + 1, rpi: rpiSorted[rpiIdx].rpi };
  }

  res.json({
    id: team.id, name: team.name, state: team.state, city: team.city, division: team.division,
    conferenceName: team.conference.name, conferenceAbbreviation: team.conference.abbreviation,
    prestige: team.prestige, nilBudget: team.nilBudget, facilitiesRating: team.facilitiesRating,
    academicReputation: team.academicReputation, venueCapacity: team.venueCapacity,
    isPlayerControlled: team.isPlayerControlled,
    costOfLivingIndex: costOfLivingIndex(team.state),
    headCoach: team.headCoach ? {
      id: team.headCoach.id, name: team.headCoach.name, archetype: team.headCoach.archetype, background: team.headCoach.background,
      hotSeatLevel: team.headCoach.hotSeatLevel, reputation: team.headCoach.reputation,
    } : null,
    athleticDirector: team.athleticDirector ? {
      id: team.athleticDirector.id, name: team.athleticDirector.name, patience: team.athleticDirector.patience, winFocus: team.athleticDirector.winFocus,
      integrityStandard: team.athleticDirector.integrityStandard, loyalty: team.athleticDirector.loyalty,
      yearsAtCurrentJob: team.athleticDirector.yearsAtCurrentJob,
    } : null,
    record, kenpom, rpi, roster,
  });
});

teamRouter.get("/saves/:id/roster", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json([]);
  const players = await prisma.player.findMany({
    where: { saveGameId: save.id, teamId: save.coachTeamId },
    orderBy: [{ classYear: "asc" }, { scoring: "desc" }],
  });
  res.json(players);
});

teamRouter.get("/saves/:id/walkons", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json({ candidates: [], rosterCount: 0, rosterCap: 0 });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { players: true } });
  const candidates = await prisma.walkOnCandidate.findMany({
    where: { saveGameId: save.id, teamId: team.id },
    orderBy: { scoring: "desc" },
  });
  res.json({ candidates, rosterCount: team.players.length, rosterCap: DIVISION_RULES[team.division as Division].rosterCap });
});

teamRouter.post("/saves/:id/walkons/:candidateId/add", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { players: true } });
  const candidate = await prisma.walkOnCandidate.findUnique({ where: { id: req.params.candidateId } });
  if (!candidate || candidate.teamId !== team.id) return res.status(404).json({ error: "Candidate not found" });

  const rosterCap = DIVISION_RULES[team.division as Division].rosterCap;
  if (team.players.length >= rosterCap) return res.status(400).json({ error: "Roster is already full" });

  const player = await prisma.player.create({
    data: {
      id: randomUUID(), saveGameId: save.id, teamId: team.id,
      firstName: candidate.firstName, lastName: candidate.lastName, position: candidate.position,
      classYear: "FR", heightInches: 76, hometownState: candidate.hometownState, hometownCity: candidate.hometownCity, countryOfOrigin: candidate.countryOfOrigin,
      origin: candidate.origin,
      scoring: candidate.scoring, threePoint: candidate.threePoint, finishing: candidate.finishing,
      playmaking: candidate.playmaking, rebounding: candidate.rebounding, defense: candidate.defense,
      athleticism: candidate.athleticism, basketballIq: candidate.basketballIq,
      stamina: 60, potential: candidate.potential, characterRating: candidate.characterRating,
      disciplineRating: candidate.disciplineRating, eligibilityYearsLeft: 4, onScholarship: false,
    },
  });
  await prisma.walkOnCandidate.delete({ where: { id: candidate.id } });
  res.json(player);
});

// Leaguewide, not team-scoped like walk-ons — these are players other
// programs already cut loose, so any team (with the AD's blessing) can sign one.
teamRouter.get("/saves/:id/discipline-drops", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const players = await prisma.player.findMany({
    where: { saveGameId: save.id, droppedForDiscipline: true, teamId: null },
    orderBy: { disciplineRating: "asc" },
  });
  let rosterCount = 0;
  let rosterCap = 0;
  let adWouldAllowById = new Map<string, boolean>();
  if (save.coachTeamId) {
    const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { players: true, athleticDirector: true } });
    rosterCount = team.players.length;
    rosterCap = DIVISION_RULES[team.division as Division].rosterCap;
    adWouldAllowById = new Map(
      players.map((p) => [p.id, meetsLegalityBar(p.disciplineRating, team.academicReputation, team.athleticDirector?.integrityStandard)])
    );
  }
  res.json({
    players: players.map((p) => ({ ...p, adWouldAllow: adWouldAllowById.get(p.id) ?? null })),
    rosterCount, rosterCap,
  });
});

teamRouter.post("/saves/:id/discipline-drops/:playerId/sign", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { players: true, athleticDirector: true } });
  const player = await prisma.player.findUnique({ where: { id: req.params.playerId } });
  if (!player || !player.droppedForDiscipline || player.teamId) return res.status(404).json({ error: "Player not available" });

  const rosterCap = DIVISION_RULES[team.division as Division].rosterCap;
  if (team.players.length >= rosterCap) return res.status(400).json({ error: "Roster is already full" });

  if (!meetsLegalityBar(player.disciplineRating, team.academicReputation, team.athleticDirector?.integrityStandard)) {
    return res.status(400).json({
      error: `Your AD won't sign off on this one — ${player.firstName} ${player.lastName}'s history is too much risk for what this program is willing to carry.`,
    });
  }

  const rules = DIVISION_RULES[team.division as Division];
  const scholarshipCount = team.players.filter((p) => p.onScholarship).length;
  const onScholarship = rules.hasScholarships && scholarshipCount < rules.scholarshipLimit;
  const reputationHit = disciplineSigningReputationHit(player.disciplineRating);

  const updatedPlayer = await prisma.player.update({ where: { id: player.id }, data: { teamId: team.id, onScholarship } });
  await prisma.team.update({
    where: { id: team.id },
    data: { academicReputation: Math.round(clamp(team.academicReputation - reputationHit, 5, 99)) },
  });

  res.json({ player: updatedPlayer, reputationHit });
});

teamRouter.get("/saves/:id/schedule", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json({ teamName: null, games: [] });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, select: { name: true } });
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
  const gamesOut = games.map((g) => {
    const isHome = g.homeTeamId === save.coachTeamId;
    const opponentId = isHome ? g.awayTeamId : g.homeTeamId;
    const opponent = isHome ? g.awayTeam : g.homeTeam;
    const rivalryIntensity = rivalIntensityByOpponent.get(opponentId);
    return { ...g, isHome, opponentId, opponentName: opponent.name, isRivalry: rivalryIntensity !== undefined, rivalryIntensity: rivalryIntensity ?? null };
  });
  res.json({ teamName: team.name, games: gamesOut });
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

// Defaults to the user's own conference when no conferenceId is given, so
// existing callers keep working unchanged; pass ?conferenceId= to look at
// any other conference in the save (powers the division/conference switcher
// on the Standings page).
teamRouter.get("/saves/:id/standings", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  let conferenceId = typeof req.query.conferenceId === "string" ? req.query.conferenceId : null;
  if (!conferenceId) {
    if (!save.coachTeamId) return res.json({ conferenceName: null, conferenceId: null, division: null, rows: [] });
    const myTeam = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId } });
    conferenceId = myTeam.conferenceId;
  }

  const confTeams = await prisma.team.findMany({ where: { saveGameId: save.id, conferenceId }, include: { conference: true } });
  if (confTeams.length === 0) return res.json({ conferenceName: null, conferenceId: null, division: null, rows: [] });
  const standings = await computeStandings(save.id, save.currentSeasonYear);

  const rows = confTeams
    .map((t) => {
      const r = standings.get(t.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
      return { teamId: t.id, name: t.name, wins: r.wins, losses: r.losses, confWins: r.confWins, confLosses: r.confLosses };
    })
    .sort((a, b) => b.confWins / Math.max(1, b.confWins + b.confLosses) - a.confWins / Math.max(1, a.confWins + a.confLosses));

  res.json({
    conferenceName: confTeams[0]?.conference?.name ?? null, conferenceId,
    division: confTeams[0]?.conference?.division ?? null, rows,
  });
});

// Powers the division/conference switcher on the Standings page.
teamRouter.get("/saves/:id/conferences", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const division = typeof req.query.division === "string" ? req.query.division : "D1";
  const conferences = await prisma.conference.findMany({
    where: { saveGameId: save.id, division }, orderBy: { name: "asc" },
  });
  res.json(conferences.map((c) => ({ id: c.id, name: c.name, abbreviation: c.abbreviation })));
});
