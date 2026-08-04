import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { computeInterestGain, weeklyRecruitingPoints, type RecruitingProspectInput, type RecruitingTeamInput } from "../engine/recruiting";
import { PRIORITY_KEYS, topPriorities, type PriorityProfile } from "../engine/priorities";
import { clamp } from "../engine/rng";
import { parsePipelineStates, bumpPipelineState } from "../engine/pipeline";
import { computeStandings, winPct } from "../season/standings";
import { aggregateCareerStats, type RawGameStatLine } from "../engine/careerStats";
import { DIVISION_RULES, type Division } from "../types";

export const transfersRouter = Router();

function playerOverall(p: { scoring: number; threePoint: number; finishing: number; playmaking: number; rebounding: number; defense: number; athleticism: number; basketballIq: number }): number {
  return Math.round((p.scoring + p.threePoint + p.finishing + p.playmaking + p.rebounding + p.defense + p.athleticism + p.basketballIq) / 8);
}

function scholarshipOpen(division: Division, currentScholarshipCount: number): boolean {
  const rules = DIVISION_RULES[division];
  return rules.hasScholarships && currentScholarshipCount < rules.scholarshipLimit;
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

transfersRouter.get("/saves/:id/transfers", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.json([]);

  const team = await prisma.team.findUnique({ where: { id: save.coachTeamId }, include: { headCoach: true } });
  const transferPipeline = parsePipelineStates(team?.headCoach?.transferPipelineJson ?? "{}");

  const players = await prisma.player.findMany({
    where: { saveGameId: save.id, inTransferPortal: true },
    include: { transferInterest: { where: { teamId: save.coachTeamId } } },
    orderBy: { scoring: "desc" },
    take: 200,
  });

  // Real box-score history from their old school(s) — what they actually put
  // up on the court, not just their scouted ratings.
  const statRows = await prisma.playerGameStat.findMany({
    where: { playerId: { in: players.map((p) => p.id) } },
    include: { game: { select: { seasonYear: true } } },
  });
  const statsByPlayer = new Map<string, RawGameStatLine[]>();
  for (const row of statRows) {
    if (!statsByPlayer.has(row.playerId)) statsByPlayer.set(row.playerId, []);
    statsByPlayer.get(row.playerId)!.push({ seasonYear: row.game.seasonYear, ...row });
  }

  const board = players.map((p) => {
    const interest = p.transferInterest[0];
    const priorities = parsePriorities(p.prioritiesJson);
    const careerStats = aggregateCareerStats(statsByPlayer.get(p.id) ?? []);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      classYear: p.classYear,
      hometownState: p.hometownState,
      hometownCity: p.hometownCity,
      countryOfOrigin: p.countryOfOrigin,
      previousSchool: p.previousSchool,
      eligibilityYearsLeft: p.eligibilityYearsLeft,
      overall: playerOverall(p),
      topPriorities: topPriorities(priorities, 3),
      careerStats,
      pipelineScore: p.previousSchool ? (transferPipeline[p.previousSchool] ?? 50) : null,
      // A transfer is a known college player — true ratings, no scouting noise.
      scoring: p.scoring,
      threePoint: p.threePoint,
      finishing: p.finishing,
      playmaking: p.playmaking,
      rebounding: p.rebounding,
      defense: p.defense,
      athleticism: p.athleticism,
      basketballIq: p.basketballIq,
      characterRating: p.characterRating,
      disciplineRating: p.disciplineRating,
      interestLevel: interest?.interestLevel ?? 0,
      pointsInvested: interest?.pointsInvested ?? 0,
      offered: interest?.offered ?? false,
    };
  });

  res.json(board);
});

transfersRouter.post("/saves/:id/transfers/:playerId/pursue", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "No active team" });

  const points = Math.max(1, Math.min(50, Number(req.body.points) || 10));
  const team = await prisma.team.findUniqueOrThrow({
    where: { id: save.coachTeamId },
    include: { headCoach: true, assistants: true, players: true },
  });
  const player = await prisma.player.findUniqueOrThrow({ where: { id: req.params.playerId } });
  if (!player.inTransferPortal) return res.status(400).json({ error: "This player isn't in the transfer portal" });

  const budget = weeklyRecruitingPoints(team.headCoach?.recruitingSkill ?? 50, Math.max(0, ...team.assistants.filter((a) => a.role === "RECRUITING").map((a) => a.rating), 0));
  const spend = Math.min(points, budget);

  const existing = await prisma.transferInterest.findUnique({ where: { playerId_teamId: { playerId: player.id, teamId: team.id } } });
  const pointsInvested = (existing?.pointsInvested ?? 0) + spend;

  const standings = await computeStandings(save.id, save.currentSeasonYear);
  const record = standings.get(team.id);
  const recentWinPct = record && record.wins + record.losses > 0 ? winPct(record) : team.prestige / 100;

  const overall = playerOverall(player);
  const prospectInput: RecruitingProspectInput = {
    position: player.position,
    hometownState: player.hometownState,
    countryOfOrigin: player.countryOfOrigin,
    characterRating: player.characterRating,
    scoring: player.scoring,
    threePoint: player.threePoint,
    finishing: player.finishing,
    playmaking: player.playmaking,
    rebounding: player.rebounding,
    defense: player.defense,
    starRating: clamp(Math.round(overall / 20), 1, 5),
    priorities: parsePriorities(player.prioritiesJson),
    previousSchool: player.previousSchool,
  };

  const teamInput: RecruitingTeamInput = {
    division: team.division as Division,
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
    coachBackground: team.headCoach?.background ?? null,
    proCountry: team.headCoach?.proCountry ?? null,
    playedProDomestic: team.headCoach?.proPath === "DOMESTIC_PRO",
    coachPipelineStates: parsePipelineStates(team.headCoach?.pipelineStatesJson ?? "{}"),
    campusAtmosphere: team.headCoach?.campusAtmosphere,
    hasScholarshipOpen: scholarshipOpen(team.division as Division, team.players.filter((p) => p.onScholarship).length),
    coachTransferPipeline: parsePipelineStates(team.headCoach?.transferPipelineJson ?? "{}"),
    currentSeasonYear: save.currentSeasonYear,
    internationalTourCountry: team.internationalTourCountry,
    internationalTourSeasonYear: team.internationalTourSeasonYear,
  };

  const gain = computeInterestGain(prospectInput, teamInput, pointsInvested);

  const interest = await prisma.transferInterest.upsert({
    where: { playerId_teamId: { playerId: player.id, teamId: team.id } },
    create: { id: randomUUID(), playerId: player.id, teamId: team.id, interestLevel: Math.round(gain), pointsInvested, offered: true },
    update: { interestLevel: Math.round(gain), pointsInvested, offered: true },
  });

  res.json(interest);
});
