import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { computeStandings } from "./standings";
import { updateHotSeat, updatePrestige, updateReputation, shouldFire, generateJobOffers, driftLegalityReputation, expectedWinPct } from "../engine/career";
import { parsePipelineStates, decayPipeline } from "../engine/pipeline";
import { generateADTraits, adTurnoverRoll, parseAdRelationships, updateAdRelationship } from "../engine/athleticDirector";
import { driftPerception } from "../engine/media";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect, generateInternationalProspect } from "../engine/generation";
import { generateSeasonSchedule } from "../engine/schedule";
import { mulberry32, clamp, randNormal, randInt } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import { commitmentWeights } from "../engine/recruiting";
import { generateCoachSkills, randomArchetype } from "../engine/coachArchetypes";
import type { ClassYear, Division } from "../types";
import { DIVISION_RULES } from "../types";

const CLASS_PROGRESSION: Record<ClassYear, ClassYear | null> = {
  FR: "SO", SO: "JR", JR: "SR", SR: null, GR: null,
};

async function tournamentWinsForTeam(saveGameId: string, seasonYear: number, teamId: string): Promise<{ made: boolean; wins: number }> {
  const games = await prisma.game.findMany({
    where: {
      saveGameId, seasonYear,
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      tournament: { type: { in: ["NCAA_TOURNAMENT", "D2_NATIONAL", "D3_NATIONAL"] } },
      isPlayed: true,
    },
  });
  if (games.length === 0) return { made: false, wins: 0 };
  const wins = games.filter((g) => (g.homeTeamId === teamId ? (g.homeScore ?? 0) > (g.awayScore ?? 0) : (g.awayScore ?? 0) > (g.homeScore ?? 0))).length;
  return { made: true, wins };
}

export async function runOffseason(saveGameId: string): Promise<{ userFired: boolean; jobOffers: { teamId: string; teamName: string; prestige: number }[] }> {
  const save = await prisma.saveGame.findUniqueOrThrow({ where: { id: saveGameId } });
  const seasonYear = save.currentSeasonYear;
  const teams = await prisma.team.findMany({ where: { saveGameId }, include: { headCoach: true, athleticDirector: true } });
  const division = teams[0]?.division as Division;
  const standings = await computeStandings(saveGameId, seasonYear);
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  let userFired = false;
  let userTeamId: string | null = null;
  let userNewReputation = 50;
  let userNewPrestige = 50;
  let userNewLegality = 75;
  let userNewAdRelationshipsJson = "{}";
  let jobOffers: { teamId: string; teamName: string; prestige: number }[] = [];
  const vacancies: { teamId: string; prestige: number; academicReputation: number }[] = [];

  for (const team of teams) {
    if (!team.headCoach) continue;
    const record = standings.get(team.id) ?? { wins: 0, losses: 0, confWins: 0, confLosses: 0 };
    const { made, wins } = await tournamentWinsForTeam(saveGameId, seasonYear, team.id);
    const games = record.wins + record.losses || 1;
    const winPct = record.wins / games;
    const ad = team.athleticDirector;
    const coachAdRelationships = parseAdRelationships(team.headCoach.adRelationshipsJson);
    const currentRelScore = ad ? coachAdRelationships[ad.id] ?? 50 : 50;

    const newHotSeat = updateHotSeat(team.headCoach.hotSeatLevel, record.wins, record.losses, team.prestige, {
      archetype: team.headCoach.archetype,
      legalityReputation: team.headCoach.legalityReputation,
      academicReputation: team.academicReputation,
      adPatience: ad?.patience,
      adWinFocus: ad?.winFocus,
    });
    const fired = shouldFire(newHotSeat, rng, ad?.loyalty, currentRelScore);
    const newReputation = updateReputation(team.headCoach.reputation, record.wins, record.losses, made, wins, fired);
    const newPrestige = updatePrestige(team.prestige, record.wins, record.losses, made, wins, team.headCoach.background);
    const newLegality = driftLegalityReputation(team.headCoach.legalityReputation);
    // Pipeline decay and AD-relationship tracking are coach-scoped and only
    // matter for the player's own coach — skip the extra work for every AI
    // coach every season (their identities get discarded on firing anyway).
    const newPipelineJson = team.headCoach.isPlayerControlled
      ? JSON.stringify(decayPipeline(parsePipelineStates(team.headCoach.pipelineStatesJson)))
      : undefined;
    const newAdRelationshipsJson = team.headCoach.isPlayerControlled && ad
      ? JSON.stringify({ ...coachAdRelationships, [ad.id]: updateAdRelationship(currentRelScore, winPct, expectedWinPct(team.prestige), fired) })
      : undefined;

    if (team.headCoach.isPlayerControlled) {
      userTeamId = team.id;
      userNewReputation = newReputation;
      userNewPrestige = newPrestige;
      userNewLegality = newLegality;
      if (newAdRelationshipsJson) userNewAdRelationshipsJson = newAdRelationshipsJson;
      if (fired) userFired = true;
    }

    if (fired) {
      vacancies.push({ teamId: team.id, prestige: newPrestige, academicReputation: team.academicReputation });
      const replacementArchetype = randomArchetype(rng);
      const replacementSkillRoll = generateCoachSkills(rng, team.prestige, replacementArchetype);
      const replacementSkills = {
        reputation: replacementSkillRoll.reputation,
        offenseSkill: replacementSkillRoll.offenseSkill,
        defenseSkill: replacementSkillRoll.defenseSkill,
        recruitingSkill: replacementSkillRoll.recruitingSkill,
        developmentSkill: replacementSkillRoll.developmentSkill,
        archetype: replacementArchetype,
        background: null as string | null,
      };
      if (team.headCoach.isPlayerControlled) {
        // Bench the user's coach (identity + career stats persist) rather than
        // overwriting them — a fresh AI coach takes over the vacated program.
        const replacement = await prisma.coach.create({
          data: {
            id: randomUUID(), saveGameId, name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
            isPlayerControlled: false, hotSeatLevel: 0, ...replacementSkills, careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
          },
        });
        await prisma.team.update({ where: { id: team.id }, data: { headCoachId: replacement.id } });
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: {
            careerWins: team.headCoach.careerWins + record.wins, careerLosses: team.headCoach.careerLosses + record.losses,
            legalityReputation: newLegality, pipelineStatesJson: newPipelineJson, adRelationshipsJson: newAdRelationshipsJson,
          },
        });
      } else {
        await prisma.coach.update({
          where: { id: team.headCoach.id },
          data: {
            name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
            isPlayerControlled: false,
            hotSeatLevel: 0,
            ...replacementSkills,
            careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
          },
        });
      }
    } else {
      await prisma.coach.update({
        where: { id: team.headCoach.id },
        data: {
          hotSeatLevel: newHotSeat,
          reputation: newReputation,
          legalityReputation: newLegality,
          pipelineStatesJson: newPipelineJson,
          adRelationshipsJson: newAdRelationshipsJson,
          raiseRequestedThisSeason: false,
          teamPerception: driftPerception(team.headCoach.teamPerception, 60, 0.05),
          nationalPerception: driftPerception(team.headCoach.nationalPerception, 20, 0.15),
          localPerception: driftPerception(team.headCoach.localPerception, 50, 0.1),
          careerWins: team.headCoach.careerWins + record.wins,
          careerLosses: team.headCoach.careerLosses + record.losses,
          yearsAtCurrentJob: team.headCoach.yearsAtCurrentJob + 1,
        },
      });
    }

    await prisma.team.update({ where: { id: team.id }, data: { prestige: newPrestige } });
  }

  // ---- Athletic director turnover: ~7-year average tenure (memoryless yearly
  // hazard), and a departing AD sometimes moves to a different school instead
  // of retiring — same "carousel" idea as the coaching job market. ----
  const departingADs: { teamId: string; academicReputation: number; ad: NonNullable<(typeof teams)[number]["athleticDirector"]> }[] = [];
  for (const team of teams) {
    if (!team.athleticDirector) continue;
    if (adTurnoverRoll(rng)) {
      departingADs.push({ teamId: team.id, academicReputation: team.academicReputation, ad: team.athleticDirector });
    } else {
      await prisma.athleticDirector.update({ where: { id: team.athleticDirector.id }, data: { yearsAtCurrentJob: team.athleticDirector.yearsAtCurrentJob + 1 } });
    }
  }
  // athleticDirectorId is unique on Team, so a departing team's slot must be
  // cleared before anyone else can be assigned into it — otherwise a school
  // "swapping in" an AD who hasn't yet been released by their old team trips
  // the unique constraint.
  for (const { teamId } of departingADs) {
    await prisma.team.update({ where: { id: teamId }, data: { athleticDirectorId: null } });
  }
  const movingAdPool = [...departingADs].sort(() => rng() - 0.5).map((d) => d.ad);
  for (const { teamId, academicReputation, ad } of departingADs) {
    const moveIn = movingAdPool.length > 0 && rng() < 0.4 ? movingAdPool.pop() : undefined;
    if (moveIn && moveIn.id !== ad.id) {
      await prisma.team.update({ where: { id: teamId }, data: { athleticDirectorId: moveIn.id } });
      await prisma.athleticDirector.update({ where: { id: moveIn.id }, data: { yearsAtCurrentJob: 0 } });
    } else {
      const freshTraits = generateADTraits(rng, academicReputation);
      const fresh = await prisma.athleticDirector.create({
        data: { id: randomUUID(), saveGameId, name: `${randomFirstName(rng)} ${randomLastName(rng)}`, ...freshTraits, yearsAtCurrentJob: 0 },
      });
      await prisma.team.update({ where: { id: teamId }, data: { athleticDirectorId: fresh.id } });
    }
  }

  // Job market resolves after every program's outcome (and every AD's) is
  // known, so offers reflect the full set of openings league-wide rather than
  // just whichever teams were processed first.
  if (userTeamId) {
    const openings = vacancies.filter((v) => v.teamId !== userTeamId);
    const openingTeams = await prisma.team.findMany({ where: { id: { in: openings.map((o) => o.teamId) } }, include: { athleticDirector: true } });
    const openingsWithAd = openings.map((o) => {
      const t = openingTeams.find((tt) => tt.id === o.teamId);
      return { ...o, athleticDirectorId: t?.athleticDirector?.id, integrityStandard: t?.athleticDirector?.integrityStandard };
    });
    const maxOffers = userFired ? 3 : 2;
    const coachAdRelationships = parseAdRelationships(userNewAdRelationshipsJson);
    const offers = generateJobOffers(userNewReputation, userNewPrestige, openingsWithAd, rng, maxOffers, userNewLegality, coachAdRelationships);
    if (offers.length > 0) {
      const offerTeams = await prisma.team.findMany({ where: { id: { in: offers.map((o) => o.teamId) } } });
      jobOffers = offerTeams.map((t) => ({ teamId: t.id, teamName: t.name, prestige: t.prestige }));
    }
    if (userFired) {
      await prisma.saveGame.update({ where: { id: saveGameId }, data: { coachTeamId: null } });
    }
  }

  // ---- Roster progression: graduate seniors, develop everyone else ----
  const players = await prisma.player.findMany({ where: { saveGameId, teamId: { not: null } } });
  for (const p of players) {
    const nextClass = CLASS_PROGRESSION[p.classYear as ClassYear];
    if (nextClass === null || p.eligibilityYearsLeft <= 1) {
      await prisma.player.update({ where: { id: p.id }, data: { teamId: null } }); // graduates out of the league
      continue;
    }
    const growth = Math.round(((p.potential - (p.scoring + p.defense + p.rebounding) / 3) / 100) * randInt(rng, 6, 14));
    await prisma.player.update({
      where: { id: p.id },
      data: {
        classYear: nextClass,
        eligibilityYearsLeft: p.eligibilityYearsLeft - 1,
        scoring: Math.round(clamp(p.scoring + growth, 15, 99)),
        threePoint: Math.round(clamp(p.threePoint + growth, 15, 99)),
        finishing: Math.round(clamp(p.finishing + growth, 15, 99)),
        playmaking: Math.round(clamp(p.playmaking + growth, 15, 99)),
        rebounding: Math.round(clamp(p.rebounding + growth, 15, 99)),
        defense: Math.round(clamp(p.defense + growth, 15, 99)),
      },
    });
  }

  // ---- Recruiting resolution: signed prospects join a roster ----
  const classToSign = await prisma.prospect.findMany({
    where: { saveGameId, signed: false, graduationYear: seasonYear + 1 },
    include: { interest: true },
  });
  for (const prospect of classToSign) {
    if (prospect.interest.length === 0) continue;
    const weights = commitmentWeights(prospect.interest.map((i) => ({ teamId: i.teamId, interest: i.interestLevel })));
    const total = weights.reduce((s, w) => s + w.weight, 0);
    if (total <= 0) continue;
    let r = rng() * total;
    let winnerTeamId = weights[0]?.teamId;
    for (const w of weights) {
      r -= w.weight;
      if (r <= 0) { winnerTeamId = w.teamId; break; }
    }

    await prisma.prospect.update({ where: { id: prospect.id }, data: { signed: true, committedTeamId: winnerTeamId } });
    await prisma.player.create({
      data: {
        id: randomUUID(), saveGameId, teamId: winnerTeamId,
        firstName: prospect.firstName, lastName: prospect.lastName, position: prospect.position,
        classYear: "FR", heightInches: 76, hometownState: prospect.hometownState,
        countryOfOrigin: prospect.countryOfOrigin,
        origin: prospect.source,
        scoring: prospect.scoring, threePoint: prospect.threePoint, finishing: prospect.finishing,
        playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
        athleticism: prospect.athleticism, basketballIq: prospect.basketballIq,
        stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
        potential: prospect.potential, characterRating: prospect.characterRating,
        disciplineRating: prospect.disciplineRating,
        eligibilityYearsLeft: prospect.source === "JUCO" ? 2 : 4,
      },
    });
  }

  // ---- Generate next recruiting class ----
  const teamCount = teams.length;
  const nextProspects: any[] = [];
  for (let i = 0; i < Math.round(teamCount * 3); i++) {
    const p = generateHighSchoolProspect(rng, seasonYear + 2);
    nextProspects.push({
      id: randomUUID(), saveGameId, firstName: p.firstName, lastName: p.lastName, position: p.position,
      hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
      scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
      playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
      athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
      prioritiesJson: JSON.stringify(p.priorities),
    });
  }
  for (let i = 0; i < Math.round(teamCount * 0.6); i++) {
    const p = generateJucoProspect(rng, seasonYear + 2);
    nextProspects.push({
      id: randomUUID(), saveGameId, firstName: p.firstName, lastName: p.lastName, position: p.position,
      hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
      scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
      playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
      athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
      prioritiesJson: JSON.stringify(p.priorities),
    });
  }
  for (let i = 0; i < Math.round(teamCount * 0.8); i++) {
    const p = generateInternationalProspect(rng, seasonYear + 2);
    nextProspects.push({
      id: randomUUID(), saveGameId, firstName: p.firstName, lastName: p.lastName, position: p.position,
      hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
      scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
      playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
      athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
      prioritiesJson: JSON.stringify(p.priorities),
    });
  }
  for (let i = 0; i < nextProspects.length; i += 400) {
    await prisma.prospect.createMany({ data: nextProspects.slice(i, i + 400) });
  }

  // ---- Backfill rosters below scholarship limits with walk-on-level fillers ----
  const rosterCap = DIVISION_RULES[division].rosterCap;
  const currentTeams = await prisma.team.findMany({ where: { saveGameId }, include: { players: true } });
  for (const team of currentTeams) {
    const need = rosterCap - team.players.length;
    if (need <= 0) continue;
    const roster = generateRosterForTeam(rng, team.prestige, division, need, team.internationalScoutingRating);
    const rows = roster.map((p) => ({
      id: randomUUID(), saveGameId, teamId: team.id, firstName: p.firstName, lastName: p.lastName,
      position: p.position, classYear: "FR" as ClassYear, heightInches: p.ratings.heightInches,
      hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, origin: p.origin, scoring: p.ratings.scoring, threePoint: p.ratings.threePoint,
      finishing: p.ratings.finishing, playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding,
      defense: p.ratings.defense, athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
      stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)), potential: p.ratings.potential,
      characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
      eligibilityYearsLeft: 4,
    }));
    if (rows.length > 0) await prisma.player.createMany({ data: rows });
  }

  // ---- Next season schedule ----
  const nextSeasonYear = seasonYear + 1;
  await prisma.season.create({ data: { id: randomUUID(), saveGameId, year: nextSeasonYear } });
  const scheduleTeams = teams.map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
  const schedule = generateSeasonSchedule(scheduleTeams, division, nextSeasonYear, rng);
  const gameRows = schedule.map((g) => ({
    id: randomUUID(), saveGameId, seasonYear: nextSeasonYear, date: g.date,
    homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, isConference: g.isConference, isPlayed: false,
  }));
  for (let i = 0; i < gameRows.length; i += 400) {
    await prisma.game.createMany({ data: gameRows.slice(i, i + 400) });
  }

  await prisma.saveGame.update({
    where: { id: saveGameId },
    data: {
      currentSeasonYear: nextSeasonYear,
      currentDate: new Date(Date.UTC(nextSeasonYear, 9, 1)),
      currentPhase: userFired ? "OFFSEASON" : "PRESEASON",
    },
  });

  return { userFired, jobOffers };
}
