import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { computeInterestGain, weeklyRecruitingPoints, type RecruitingProspectInput, type RecruitingTeamInput } from "../engine/recruiting";
import { PRIORITY_KEYS, topPriorities, type PriorityProfile } from "../engine/priorities";
import { clamp, randInt, mulberry32 } from "../engine/rng";
import { computeStandings, winPct } from "../season/standings";

export const recruitingRouter = Router();

function noisy(rng: () => number, value: number, noise: number): number {
  return Math.round(clamp(value + randInt(rng, -noise, noise), 1, 99));
}

function playerOverall(p: { scoring: number; threePoint: number; finishing: number; playmaking: number; rebounding: number; defense: number; athleticism: number; basketballIq: number }): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

function parsePriorities(json: string): PriorityProfile {
  try {
    const parsed = JSON.parse(json);
    const profile = {} as PriorityProfile;
    for (const key of PRIORITY_KEYS) profile[key] = parsed[key] ?? 0;
    return profile;
  } catch {
    return PRIORITY_KEYS.reduce((acc, k) => ({ ...acc, [k]: 100 / PRIORITY_KEYS.length }), {} as PriorityProfile);
  }
}

recruitingRouter.get("/saves/:id/recruiting", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json([]);

  const prospects = await prisma.prospect.findMany({
    where: { saveGameId: save.id, signed: false, graduationYear: { gte: save.currentSeasonYear + 1 } },
    include: { interest: { where: { teamId: save.coachTeamId } } },
    orderBy: { starRating: "desc" },
    take: 200,
  });

  const rng = mulberry32(42);
  const board = prospects.map((p) => {
    const interest = p.interest[0];
    const priorities = parsePriorities(p.prioritiesJson);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      hometownState: p.hometownState,
      countryOfOrigin: p.countryOfOrigin,
      source: p.source,
      starRating: p.starRating,
      graduationYear: p.graduationYear,
      topPriorities: topPriorities(priorities, 3),
      // scouted ratings include noise proportional to scoutingNoise — true ratings are hidden
      scouted: {
        scoring: noisy(rng, p.scoring, p.scoutingNoise),
        threePoint: noisy(rng, p.threePoint, p.scoutingNoise),
        finishing: noisy(rng, p.finishing, p.scoutingNoise),
        playmaking: noisy(rng, p.playmaking, p.scoutingNoise),
        rebounding: noisy(rng, p.rebounding, p.scoutingNoise),
        defense: noisy(rng, p.defense, p.scoutingNoise),
        athleticism: noisy(rng, p.athleticism, p.scoutingNoise),
        characterRating: noisy(rng, p.characterRating, p.scoutingNoise + 5),
        disciplineRating: noisy(rng, p.disciplineRating, p.scoutingNoise + 8),
      },
      interestLevel: interest?.interestLevel ?? 0,
      pointsInvested: interest?.pointsInvested ?? 0,
      offered: interest?.offered ?? false,
    };
  });

  res.json(board);
});

recruitingRouter.post("/saves/:id/recruiting/:prospectId/pursue", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });

  const points = Math.max(1, Math.min(50, Number(req.body.points) || 10));
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: save.coachTeamId },
    include: { headCoach: true, assistants: true, players: true },
  });
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: req.params.prospectId } });

  const budget = weeklyRecruitingPoints(team.headCoach?.recruitingSkill ?? 50, Math.max(0, ...team.assistants.filter((a) => a.role === "RECRUITING").map((a) => a.rating), 0));
  const spend = Math.min(points, budget);

  const existing = await prisma.recruitInterest.findUnique({ where: { prospectId_teamId: { prospectId: prospect.id, teamId: team.id } } });
  const pointsInvested = (existing?.pointsInvested ?? 0) + spend;

  const standings = await computeStandings(save.id, save.currentSeasonYear);
  const record = standings.get(team.id);
  const recentWinPct = record && record.wins + record.losses > 0 ? winPct(record) : team.prestige / 100;

  const prospectInput: RecruitingProspectInput = {
    position: prospect.position,
    hometownState: prospect.hometownState,
    countryOfOrigin: prospect.countryOfOrigin,
    characterRating: prospect.characterRating,
    scoring: prospect.scoring,
    threePoint: prospect.threePoint,
    finishing: prospect.finishing,
    playmaking: prospect.playmaking,
    rebounding: prospect.rebounding,
    defense: prospect.defense,
    starRating: prospect.starRating,
    priorities: parsePriorities(prospect.prioritiesJson),
  };

  const teamInput: RecruitingTeamInput = {
    state: team.state,
    prestige: team.prestige,
    nilBudget: team.nilBudget,
    facilitiesRating: team.facilitiesRating,
    academicReputation: team.academicReputation,
    internationalScoutingRating: team.internationalScoutingRating,
    recruitingSkill: team.headCoach?.recruitingSkill ?? 50,
    assistantRecruitingSkill: Math.max(0, ...team.assistants.filter((a) => a.role === "RECRUITING").map((a) => a.rating), 0),
    developmentSkill: team.headCoach?.developmentSkill ?? 50,
    offenseSkill: team.headCoach?.offenseSkill ?? 50,
    defenseSkill: team.headCoach?.defenseSkill ?? 50,
    hotSeatLevel: team.headCoach?.hotSeatLevel ?? 0,
    recentWinPct,
    roster: team.players.map((p) => ({ position: p.position, overall: playerOverall(p), characterRating: p.characterRating })),
  };

  const gain = computeInterestGain(prospectInput, teamInput, pointsInvested);

  const interest = await prisma.recruitInterest.upsert({
    where: { prospectId_teamId: { prospectId: prospect.id, teamId: team.id } },
    create: { id: randomUUID(), prospectId: prospect.id, teamId: team.id, interestLevel: Math.round(gain), pointsInvested, offered: true },
    update: { interestLevel: Math.round(gain), pointsInvested, offered: true },
  });

  res.json(interest);
});
