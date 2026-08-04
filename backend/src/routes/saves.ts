import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { createSaveWorld } from "../seed/createSaveWorld";
import { loadLeagueData, prestigeTierToScore, divisionDataAvailable } from "../seed/leagueData";
import { advanceOneDay } from "../season/advance";
import { computeStandings, winPct } from "../season/standings";
import { COACH_ARCHETYPES, type CoachArchetype } from "../engine/coachArchetypes";
import { COACH_BACKGROUNDS, type CoachBackground } from "../engine/coachBackgrounds";
import { NO_PLAYING_CAREER, type PlayingCareerChoice } from "../engine/playingCareer";
import { generateStartingJobOffers, type CandidateJob } from "../engine/coachCreation";
import { meetsLegalityBar, expectedWinPct, generateJobOffers, type JobOpening } from "../engine/career";
import { parseAdRelationships, adRelationshipScore, updateAdRelationship } from "../engine/athleticDirector";
import { EUROPEAN_COUNTRIES } from "../engine/countries";
import { mulberry32, clamp } from "../engine/rng";
import { costOfLivingIndex } from "../engine/costOfLiving";
import { arenaUpgradeGrantChance, nextArenaCapacity, isArenaNearCap } from "../engine/attendance";
import { normalizeScholarshipsForDivision } from "../engine/conferenceRealignment";
import { overall } from "../engine/simulate";
import { generateCoachSkills, randomArchetype } from "../engine/coachArchetypes";
import { randomFirstName, randomLastName } from "../engine/names";
import type { Division } from "../types";

export const savesRouter = Router();

const ALL_DIVISIONS: Division[] = ["D1", "D2", "D3"];

savesRouter.get("/coach-options", (_req, res) => {
  res.json({ archetypes: COACH_ARCHETYPES, backgrounds: COACH_BACKGROUNDS, countries: EUROPEAN_COUNTRIES });
});

// The full national school list (all divisions), used both for the alma
// mater picker and as the candidate pool for starting job offers.
savesRouter.get("/all-teams", (_req, res) => {
  const teams: CandidateJob[] = [];
  for (const division of ALL_DIVISIONS) {
    if (!divisionDataAvailable(division)) continue;
    const data = loadLeagueData(division);
    for (const c of data.conferences) {
      for (const m of c.members) {
        teams.push({ school: m.school, conference: c.name, division, state: m.state, prestige: prestigeTierToScore(m.prestigeTier) });
      }
    }
  }
  res.json(teams);
});

savesRouter.post("/coach-offers", (req, res) => {
  const { coachArchetype, coachBackground, playingCareer } = req.body;
  const archetype: CoachArchetype = COACH_ARCHETYPES.some((a) => a.key === coachArchetype) ? coachArchetype : "PROGRAM_BUILDER";
  const background: CoachBackground | null = COACH_BACKGROUNDS.some((b) => b.key === coachBackground) ? coachBackground : null;
  const career: PlayingCareerChoice = playingCareer ?? NO_PLAYING_CAREER;

  const allCandidates: CandidateJob[] = [];
  for (const division of ALL_DIVISIONS) {
    if (!divisionDataAvailable(division)) continue;
    const data = loadLeagueData(division);
    for (const c of data.conferences) {
      for (const m of c.members) {
        allCandidates.push({ school: m.school, conference: c.name, division, state: m.state, prestige: prestigeTierToScore(m.prestigeTier) });
      }
    }
  }

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const result = generateStartingJobOffers({ archetype, background, playingCareer: career }, allCandidates, rng);
  res.json(result);
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
    const { name, division, teamSchoolName, coachName, coachArchetype, coachBackground, playingCareer } = req.body;
    if (!name || !division || !teamSchoolName || !coachName) {
      return res.status(400).json({ error: "name, division, teamSchoolName, coachName are required" });
    }
    const archetype: CoachArchetype = COACH_ARCHETYPES.some((a) => a.key === coachArchetype) ? coachArchetype : "PROGRAM_BUILDER";
    const background: CoachBackground | null = COACH_BACKGROUNDS.some((b) => b.key === coachBackground) ? coachBackground : null;
    const career: PlayingCareerChoice = playingCareer && typeof playingCareer === "object" ? { ...NO_PLAYING_CAREER, ...playingCareer } : NO_PLAYING_CAREER;
    const result = await createSaveWorld({
      saveName: name, division, teamSchoolName, coachName, coachArchetype: archetype, coachBackground: background,
      playingCareer: career,
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
    include: { headCoach: true, conference: true, athleticDirector: true },
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

  const adRelationships = team.headCoach ? parseAdRelationships(team.headCoach.adRelationshipsJson) : {};
  const adPerception = team.athleticDirector ? adRelationshipScore(adRelationships, team.athleticDirector.id) : null;

  const homeGames = await prisma.game.findMany({
    where: { saveGameId: save.id, seasonYear: save.currentSeasonYear, homeTeamId: team.id, isPlayed: true, attendance: { not: null } },
  });
  const avgTurnoutPct = homeGames.length >= 3
    ? Math.round((homeGames.reduce((s, g) => s + (g.attendance ?? 0), 0) / homeGames.length / team.venueCapacity) * 100)
    : null;

  res.json({
    save,
    team: { ...team, costOfLivingIndex: costOfLivingIndex(team.state), adPerception, avgTurnoutPct, homeGamesPlayedThisSeason: homeGames.length },
    record, nextGame, pendingEvents,
  });
});

savesRouter.get("/saves/:id/job-offers", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  const myCoach = await prisma.coach.findFirst({ where: { saveGameId: save.id, isPlayerControlled: true } });
  const myRelationships = myCoach ? parseAdRelationships(myCoach.adRelationshipsJson) : {};

  // When employed, the player's own team is excluded from its own market
  // listing, and its salary/state become the baseline the comparison fields
  // are computed against ("test the waters" without leaving first).
  const currentTeam = save.coachTeamId ? await prisma.team.findUnique({ where: { id: save.coachTeamId } }) : null;

  const openTeams = await prisma.team.findMany({
    where: {
      saveGameId: save.id,
      headCoach: { isPlayerControlled: false },
      ...(save.coachTeamId ? { id: { not: save.coachTeamId } } : {}),
    },
    include: { headCoach: true, athleticDirector: true },
  });

  let eligible = openTeams;
  if (save.coachTeamId) {
    // Employed and just browsing the market ("test the waters") — any
    // AI-run program is fair game to inquire about, vacancy or not.
    eligible = openTeams
      .filter((t) => !myCoach || meetsLegalityBar(myCoach.legalityReputation, t.academicReputation, t.athleticDirector?.integrityStandard))
      .filter((t) => !t.athleticDirector || adRelationshipScore(myRelationships, t.athleticDirector.id) > 30);
  } else {
    // Unemployed — every AI-run program in the league is a real candidate
    // (not just teams whose coach happened to be fired the instant we were),
    // gated by the same reputation/career-record ceiling the offseason
    // engine uses, with a guaranteed floor so there's always somewhere to go.
    const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
    const gamesCoached = (myCoach?.careerWins ?? 0) + (myCoach?.careerLosses ?? 0);
    const careerWinPct = gamesCoached > 0 ? (myCoach!.careerWins / gamesCoached) : undefined;
    const openings: JobOpening[] = openTeams.map((t) => ({
      teamId: t.id, prestige: t.prestige, academicReputation: t.academicReputation,
      athleticDirectorId: t.athleticDirector?.id, integrityStandard: t.athleticDirector?.integrityStandard,
    }));
    const reputation = myCoach?.reputation ?? 50;
    const offers = generateJobOffers(reputation, reputation, openings, rng, 8, myCoach?.legalityReputation ?? 75, myRelationships, careerWinPct);
    const offerTeamIds = new Set(offers.map((o) => o.teamId));
    eligible = openTeams.filter((t) => offerTeamIds.has(t.id));
  }

  res.json(eligible
    .map((t) => {
      const relScore = t.athleticDirector ? adRelationshipScore(myRelationships, t.athleticDirector.id) : null;
      const col = costOfLivingIndex(t.state);
      const currentCol = currentTeam ? costOfLivingIndex(currentTeam.state) : null;
      return {
        teamId: t.id, teamName: t.name, prestige: t.prestige, division: t.division,
        athleticDirectorName: t.athleticDirector?.name ?? null,
        adRemembersYou: relScore !== null && relScore >= 70,
        salary: t.baseSalary,
        state: t.state,
        costOfLivingIndex: col,
        salaryDeltaPct: currentTeam ? Math.round(((t.baseSalary - currentTeam.baseSalary) / currentTeam.baseSalary) * 100) : null,
        colDeltaPct: currentCol !== null ? Math.round(((col - currentCol) / currentCol) * 100) : null,
      };
    }));
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
    await prisma.coach.update({ where: { id: priorCoach.id }, data: { isPlayerControlled: true, hotSeatLevel: 0, yearsAtCurrentJob: 0, campusAtmosphere: 40 } });
  }

  await prisma.saveGame.update({ where: { id: save.id }, data: { coachTeamId: teamId, currentPhase: "PRESEASON" } });
  res.json({ ok: true });
});

// The "current school doesn't want to up your contract" mechanic: once per
// season, the player can ask their own AD for a raise. Whether it's granted
// depends on the coach-AD relationship, the AD's own loyalty, and how well
// the team has performed (proxied by hot seat level, since a coach whose job
// is safe has more leverage than one already on thin ice).
savesRouter.post("/saves/:id/request-raise", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "Not currently employed" });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { headCoach: true, athleticDirector: true } });
  const coach = team.headCoach;
  if (!coach) return res.status(400).json({ error: "No coach on this team" });
  if (coach.raiseRequestedThisSeason) return res.status(400).json({ error: "Already asked for a raise this season" });

  const relationships = parseAdRelationships(coach.adRelationshipsJson);
  const relScore = team.athleticDirector ? adRelationshipScore(relationships, team.athleticDirector.id) : 50;
  const relTerm = (relScore - 50) / 200;
  const loyaltyTerm = team.athleticDirector ? (team.athleticDirector.loyalty - 50) / 250 : 0;
  const perfTerm = ((100 - coach.hotSeatLevel) / 100) * 0.3;
  const grantChance = clamp(0.15 + relTerm + loyaltyTerm + perfTerm, 0.05, 0.85);

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const granted = rng() < grantChance;
  const newSalary = granted ? Math.round(coach.currentSalary * 1.15) : coach.currentSalary;
  const newRelJson = granted && team.athleticDirector
    ? JSON.stringify({ ...relationships, [team.athleticDirector.id]: clamp(relScore + 3, 5, 99) })
    : coach.adRelationshipsJson;

  await prisma.coach.update({
    where: { id: coach.id },
    data: { currentSalary: newSalary, raiseRequestedThisSeason: true, adRelationshipsJson: newRelJson },
  });

  res.json({ granted, newSalary, oldSalary: coach.currentSalary });
});

// Voluntarily leaving a current job for a new one while still employed — the
// "test the waters" outcome once the current school won't budge on pay.
// Distinct from /accept-job, which only ever runs from the unemployed state.
savesRouter.post("/saves/:id/resign-and-accept", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "Not currently employed" });
  const { teamId } = req.body;
  if (!teamId || teamId === save.coachTeamId) return res.status(400).json({ error: "Invalid target team" });

  const oldTeam = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { headCoach: true, athleticDirector: true } });
  const newTeam = await prisma.team.findUniqueOrThrow({ where: { id: teamId }, include: { headCoach: true } });
  const myCoach = oldTeam.headCoach;
  if (!myCoach || !newTeam.headCoach) return res.status(400).json({ error: "Coach slot missing" });

  // Walking out on the old AD costs some goodwill there, in case this coach's
  // path crosses that school's again down the line.
  const relationships = parseAdRelationships(myCoach.adRelationshipsJson);
  const updatedRelationships = oldTeam.athleticDirector
    ? { ...relationships, [oldTeam.athleticDirectorId!]: clamp((relationships[oldTeam.athleticDirectorId!] ?? 50) - 10, 5, 99) }
    : relationships;

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const replacementArchetype = randomArchetype(rng);
  const replacementSkills = generateCoachSkills(rng, oldTeam.prestige, replacementArchetype);

  // Give the old program a fresh AI coach (mirrors the same replacement
  // pattern used when a coach is fired at the end of a season).
  const replacement = await prisma.coach.create({
    data: {
      id: randomUUID(), saveGameId: save.id, name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
      isPlayerControlled: false, hotSeatLevel: 0,
      offenseSkill: replacementSkills.offenseSkill, defenseSkill: replacementSkills.defenseSkill,
      recruitingSkill: replacementSkills.recruitingSkill, developmentSkill: replacementSkills.developmentSkill,
      reputation: replacementSkills.reputation, archetype: replacementArchetype,
      careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
    },
  });
  await prisma.team.update({ where: { id: oldTeam.id }, data: { headCoachId: replacement.id } });

  // Established, in-demand coaches negotiate a small premium over the raw
  // posted salary rather than just taking the sticker price.
  const negotiatedSalary = Math.round(newTeam.baseSalary * 1.05);
  await prisma.coach.update({ where: { id: newTeam.headCoach.id }, data: { isPlayerControlled: false } });
  await prisma.team.update({ where: { id: teamId }, data: { headCoachId: myCoach.id } });
  await prisma.coach.update({
    where: { id: myCoach.id },
    data: {
      isPlayerControlled: true, hotSeatLevel: 0, yearsAtCurrentJob: 0, raiseRequestedThisSeason: false, campusAtmosphere: 40,
      currentSalary: negotiatedSalary, adRelationshipsJson: JSON.stringify(updatedRelationships),
    },
  });

  await prisma.saveGame.update({ where: { id: save.id }, data: { coachTeamId: teamId, currentPhase: "PRESEASON" } });
  res.json({ ok: true, newSalary: negotiatedSalary });
});

// Whether the AD signs off on expanding the arena — gated on team success
// (record vs. what's expected for this prestige level), the building
// actually generating box-office demand right now ("making money"), and how
// receptive this specific AD is, in general and toward this coach.
savesRouter.post("/saves/:id/upgrade-arena", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "Not currently employed" });
  const team = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { headCoach: true, athleticDirector: true } });
  const coach = team.headCoach;
  if (!coach) return res.status(400).json({ error: "No coach on this team" });
  if (team.arenaUpgradeRequestedThisSeason) return res.status(400).json({ error: "Already asked the AD about the arena this season" });
  if (isArenaNearCap(team.venueCapacity, team.division as Division)) {
    return res.status(400).json({ error: "The arena is already about as big as this level of program supports" });
  }

  const standings = await computeStandings(save.id, save.currentSeasonYear);
  const record = standings.get(team.id);
  const gamesPlayed = record ? record.wins + record.losses : 0;
  const seasonWinPct = gamesPlayed >= 3 && record ? winPct(record) : null;

  const homeGames = await prisma.game.findMany({
    where: { saveGameId: save.id, seasonYear: save.currentSeasonYear, homeTeamId: team.id, isPlayed: true, attendance: { not: null } },
  });
  const avgTurnoutPct = homeGames.length >= 3
    ? (homeGames.reduce((s, g) => s + (g.attendance ?? 0), 0) / homeGames.length / team.venueCapacity) * 100
    : null;

  const relationships = parseAdRelationships(coach.adRelationshipsJson);
  const relScore = team.athleticDirector ? adRelationshipScore(relationships, team.athleticDirector.id) : undefined;

  const grantChance = arenaUpgradeGrantChance({
    prestige: team.prestige, division: team.division as Division, expectedWinPct: expectedWinPct(team.prestige),
    seasonWinPct, avgTurnoutPct, adWinFocus: team.athleticDirector?.winFocus, adRelationshipScore: relScore,
  });

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const granted = rng() < grantChance;
  const oldCapacity = team.venueCapacity;
  const newCapacity = granted ? nextArenaCapacity(rng, team.venueCapacity, team.division as Division) : team.venueCapacity;

  await prisma.team.update({
    where: { id: team.id },
    data: {
      venueCapacity: newCapacity,
      arenaUpgradeRequestedThisSeason: true,
      facilitiesRating: granted ? Math.round(clamp(team.facilitiesRating + 3 + rng() * 5, 10, 99)) : team.facilitiesRating,
    },
  });
  if (granted && team.athleticDirector) {
    const updated = { ...relationships, [team.athleticDirector.id]: Math.round(clamp((relScore ?? 50) + 2, 5, 99)) };
    await prisma.coach.update({ where: { id: coach.id }, data: { adRelationshipsJson: JSON.stringify(updated) } });
  }

  res.json({ granted, oldCapacity, newCapacity, avgTurnoutPct, seasonWinPct });
});

// Resolving a conference-realignment invite handed back from the last /advance
// call (see engine/conferenceRealignment.ts). The offer is ephemeral — not
// persisted between requests — so the client passes back exactly what it was
// shown; declining is just a no-op.
savesRouter.post("/saves/:id/conference-invite/respond", async (req, res) => {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: req.params.id } });
  if (!save.coachTeamId) return res.status(400).json({ error: "Not currently employed" });
  const { accept, targetConferenceId, targetDivision, replacingTeamId } = req.body as {
    accept: boolean; targetConferenceId: string; targetDivision: Division; replacingTeamId: string;
  };
  if (!accept) return res.json({ applied: false });

  const myTeam = await prisma.team.findUniqueOrThrow({ where: { id: save.coachTeamId }, include: { players: true } });
  const replacingTeam = await prisma.team.findUniqueOrThrow({ where: { id: replacingTeamId }, include: { players: true } });
  const targetConference = await prisma.conference.findUniqueOrThrow({ where: { id: targetConferenceId } });

  const oldConferenceId = myTeam.conferenceId;
  const oldDivision = myTeam.division as Division;

  await prisma.team.update({
    where: { id: myTeam.id },
    data: { conferenceId: targetConferenceId, division: targetDivision },
  });
  await prisma.team.update({
    where: { id: replacingTeam.id },
    data: { conferenceId: oldConferenceId, division: oldDivision },
  });

  // Only the displaced team can end up over its new (lower) scholarship limit —
  // the promoted team only ever moves to a division with equal or more room.
  if (targetDivision !== oldDivision) {
    const scholarshipMap = normalizeScholarshipsForDivision(
      replacingTeam.players.map((p) => ({ id: p.id, onScholarship: p.onScholarship, overallRating: overall(p) })),
      oldDivision
    );
    await Promise.all(
      [...scholarshipMap.entries()].map(([playerId, onScholarship]) =>
        prisma.player.update({ where: { id: playerId }, data: { onScholarship } })
      )
    );
  }

  res.json({
    applied: true,
    newConferenceName: targetConference.name,
    newDivision: targetDivision,
    replacingTeamName: replacingTeam.name,
  });
});

savesRouter.post("/saves/:id/advance", async (req, res) => {
  try {
    const result = await advanceOneDay(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message, stack: err.stack });
  }
});
