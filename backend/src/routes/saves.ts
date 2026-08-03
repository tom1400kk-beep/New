import { Router } from "express";
import { prisma } from "../db";
import { createSaveWorld } from "../seed/createSaveWorld";
import { loadLeagueData, prestigeTierToScore, divisionDataAvailable } from "../seed/leagueData";
import { advanceOneDay } from "../season/advance";
import { computeStandings, winPct } from "../season/standings";
import { COACH_ARCHETYPES, type CoachArchetype } from "../engine/coachArchetypes";
import { COACH_BACKGROUNDS, type CoachBackground } from "../engine/coachBackgrounds";
import type { Division } from "../types";

export const savesRouter = Router();

savesRouter.get("/coach-options", (_req, res) => {
  res.json({ archetypes: COACH_ARCHETYPES, backgrounds: COACH_BACKGROUNDS });
});

savesRouter.get("/league-teams", (req, res) => {
  const division = (req.query.division as Division) || "D1";
  if (!divisionDataAvailable(division)) return res.json([]);
  const data = loadLeagueData(division);
  const teams = data.conferences.flatMap((c) =>
    c.members.map((m) => ({
      school: m.school,
      conference: c.name,
      division,
      state: m.state,
      prestige: prestigeTierToScore(m.prestigeTier),
    })),
  );
  res.json(teams);
});

savesRouter.get("/saves", async (_req, res) => {
  const saves = await prisma.saveGame.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(saves);
});

savesRouter.post("/saves", async (req, res) => {
  try {
    const { name, division, teamSchoolName, coachName, coachArchetype, coachBackground } = req.body;
    if (!name || !division || !teamSchoolName || !coachName) {
      return res.status(400).json({ error: "name, division, teamSchoolName, coachName are required" });
    }
    const archetype: CoachArchetype = COACH_ARCHETYPES.some((a) => a.key === coachArchetype) ? coachArchetype : "PROGRAM_BUILDER";
    const background: CoachBackground | null = COACH_BACKGROUNDS.some((b) => b.key === coachBackground) ? coachBackground : null;
    const result = await createSaveWorld({
      saveName: name, division, teamSchoolName, coachName, coachArchetype: archetype, coachBackground: background,
    });
    const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: result.saveGameId } });
    res.status(201).json(save);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

savesRouter.delete("/saves/:id", async (req, res) => {
  await prisma.saveGame.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

savesRouter.get("/saves/:id/dashboard", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json({ save, team: null });

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: save.coachTeamId },
    include: { headCoach: true, conference: true },
  });

  const standings = await computeStandings(save.id, save.currentSeasonYear);
  const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };

  const nextGame = await prisma.game.findFirst({
    where: {
      saveGameId: save.id,
      isPlayed: false,
      OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }],
    },
    orderBy: { date: "asc" },
    include: { homeTeam: true, awayTeam: true },
  });

  const pendingEvents = await prisma.gameEvent.findMany({ where: { saveGameId: save.id, status: "PENDING" } });

  res.json({ save, team, record, nextGame, pendingEvents });
});

savesRouter.get("/saves/:id/job-offers", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (save.coachTeamId) return res.json([]);
  const openTeams = await prisma.team.findMany({
    where: { saveGameId: save.id, headCoach: { isPlayerControlled: false } },
    include: { headCoach: true },
  });
  // Any team with no player-controlled coach and a below-average hot seat reading of 0
  // right after firing is a fresh vacancy; keep this simple and just surface all of them
  // the offseason engine already narrowed via generateJobOffers on the backend pass.
  res.json(openTeams.filter((t) => t.headCoach?.hotSeatLevel === 0 && t.headCoach?.careerWins === 0 && t.headCoach?.careerLosses === 0)
    .map((t) => ({ teamId: t.id, teamName: t.name, prestige: t.prestige, division: t.division })));
});

savesRouter.post("/saves/:id/accept-job", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const { teamId } = req.body;
  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: { headCoach: true } });
  if (!team.headCoach) return res.status(400).json({ error: "Team has no coach slot" });

  // Find the user's existing (now-benched) coach record to reuse their name/career stats.
  const priorCoach = await prisma.coach.findFirst({ where: { saveGameId: save.id, isPlayerControlled: true } });

  await prisma.coach.update({ where: { id: team.headCoach.id }, data: { isPlayerControlled: false } });
  if (priorCoach) {
    await prisma.team.update({ where: { id: teamId }, data: { headCoachId: priorCoach.id } });
    await prisma.coach.update({ where: { id: priorCoach.id }, data: { isPlayerControlled: true, hotSeatLevel: 0, yearsAtCurrentJob: 0 } });
  }

  await prisma.saveGame.update({ where: { id: save.id }, data: { coachTeamId: teamId, currentPhase: "PRESEASON" } });
  res.json({ ok: true });
});

savesRouter.post("/saves/:id/advance", async (req, res) => {
  try {
    const result = await advanceOneDay(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message, stack: err.stack });
  }
});
