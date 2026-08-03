import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { loadLeagueData, prestigeTierToScore } from "./leagueData";
import { toStateAbbr } from "./stateAbbr";
import { mulberry32, clamp, randNormal } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect } from "../engine/generation";
import { nilBudgetForTeam, facilitiesForTeam } from "../engine/budget";
import { generateSeasonSchedule } from "../engine/schedule";

export interface CreateSaveInput {
  saveName: string;
  division: Division;
  teamSchoolName: string;
  coachName: string;
}

export interface CreateSaveResult {
  saveGameId: string;
  coachTeamId: string;
}

export async function createSaveWorld(input: CreateSaveInput): Promise<CreateSaveResult> {
  const { saveName, division, teamSchoolName, coachName } = input;
  const league = loadLeagueData(division);
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  const seasonYear = new Date().getFullYear();
  const currentDate = new Date(Date.UTC(seasonYear, 9, 1)); // Oct 1 preseason

  const saveGame = await prisma.saveGame.create({
    data: {
      id: randomUUID(),
      name: saveName,
      currentDate,
      currentSeasonYear: seasonYear,
      currentPhase: "PRESEASON",
    },
  });

  type PendingTeam = {
    id: string;
    name: string;
    state: string;
    conferenceId: string;
    prestige: number;
    coachId: string;
    isPlayerControlled: boolean;
  };

  const conferenceRows: { id: string; saveGameId: string; name: string; abbreviation: string; division: string }[] = [];
  const coachRows: {
    id: string; saveGameId: string; name: string; isPlayerControlled: boolean; reputation: number;
    hotSeatLevel: number; offenseSkill: number; defenseSkill: number; recruitingSkill: number; developmentSkill: number;
  }[] = [];
  const teamRows: {
    id: string; saveGameId: string; name: string; state: string; division: string; conferenceId: string;
    prestige: number; nilBudget: number; facilitiesRating: number; isPlayerControlled: boolean; headCoachId: string;
  }[] = [];
  const playerRows: any[] = [];
  const pendingTeams: PendingTeam[] = [];

  let foundChosenTeam = false;

  for (const conf of league.conferences) {
    const conferenceId = randomUUID();
    conferenceRows.push({ id: conferenceId, saveGameId: saveGame.id, name: conf.name, abbreviation: conf.abbreviation, division });

    for (const member of conf.members) {
      const teamId = randomUUID();
      const coachId = randomUUID();
      const prestige = prestigeTierToScore(member.prestigeTier);
      const isPlayerControlled = member.school === teamSchoolName;
      if (isPlayerControlled) foundChosenTeam = true;

      const skillMean = 45 + prestige * 0.2;
      coachRows.push({
        id: coachId,
        saveGameId: saveGame.id,
        name: isPlayerControlled ? coachName : `${randomFirstName(rng)} ${randomLastName(rng)}`,
        isPlayerControlled,
        reputation: Math.round(clamp(randNormal(rng, prestige * 0.6 + 15, 12), 5, 95)),
        hotSeatLevel: 0,
        offenseSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
        defenseSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
        recruitingSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
        developmentSkill: Math.round(clamp(randNormal(rng, skillMean, 12), 15, 95)),
      });

      const nilBudget = nilBudgetForTeam(rng, prestige, division);
      const facilitiesRating = facilitiesForTeam(rng, prestige);
      const state = toStateAbbr(member.state);

      teamRows.push({
        id: teamId, saveGameId: saveGame.id, name: member.school, state, division, conferenceId,
        prestige, nilBudget, facilitiesRating, isPlayerControlled, headCoachId: coachId,
      });
      pendingTeams.push({ id: teamId, name: member.school, state, conferenceId, prestige, coachId, isPlayerControlled });

      const rosterSize = DIVISION_RULES[division].rosterCap;
      const roster = generateRosterForTeam(rng, prestige, division, rosterSize);
      for (const p of roster) {
        playerRows.push({
          id: randomUUID(),
          saveGameId: saveGame.id,
          teamId,
          firstName: p.firstName,
          lastName: p.lastName,
          position: p.position,
          classYear: p.classYear,
          heightInches: p.ratings.heightInches,
          hometownState: p.hometownState,
          origin: p.origin,
          scoring: p.ratings.scoring,
          threePoint: p.ratings.threePoint,
          finishing: p.ratings.finishing,
          playmaking: p.ratings.playmaking,
          rebounding: p.ratings.rebounding,
          defense: p.ratings.defense,
          athleticism: p.ratings.athleticism,
          basketballIq: p.ratings.basketballIq,
          stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
          potential: p.ratings.potential,
          characterRating: p.ratings.characterRating,
          eligibilityYearsLeft: p.eligibilityYearsLeft,
        });
      }
    }
  }

  if (!foundChosenTeam) {
    throw new Error(`Team "${teamSchoolName}" not found in ${division} league data`);
  }

  await prisma.conference.createMany({ data: conferenceRows });
  await prisma.coach.createMany({ data: coachRows });
  await prisma.team.createMany({ data: teamRows });

  // chunk player inserts to stay well under sqlite parameter limits
  const chunkSize = 400;
  for (let i = 0; i < playerRows.length; i += chunkSize) {
    await prisma.player.createMany({ data: playerRows.slice(i, i + chunkSize) });
  }

  const chosenTeam = pendingTeams.find((t) => t.isPlayerControlled)!;
  await prisma.saveGame.update({ where: { id: saveGame.id }, data: { coachTeamId: chosenTeam.id } });

  await prisma.season.create({ data: { id: randomUUID(), saveGameId: saveGame.id, year: seasonYear } });

  // Recruiting pool for the upcoming signing class
  const prospectRows: any[] = [];
  const hsCount = Math.round(pendingTeams.length * 3);
  const jucoCount = Math.round(pendingTeams.length * 0.6);
  for (let i = 0; i < hsCount; i++) {
    const p = generateHighSchoolProspect(rng, seasonYear + 1);
    prospectRows.push(prospectFromGenerated(saveGame.id, p));
  }
  for (let i = 0; i < jucoCount; i++) {
    const p = generateJucoProspect(rng, seasonYear + 1);
    prospectRows.push(prospectFromGenerated(saveGame.id, p));
  }
  for (let i = 0; i < prospectRows.length; i += chunkSize) {
    await prisma.prospect.createMany({ data: prospectRows.slice(i, i + chunkSize) });
  }

  // Season schedule for this division
  const scheduleTeams = pendingTeams.map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
  const schedule = generateSeasonSchedule(scheduleTeams, division, seasonYear, rng);
  const gameRows = schedule.map((g) => ({
    id: randomUUID(),
    saveGameId: saveGame.id,
    seasonYear,
    date: g.date,
    homeTeamId: g.homeTeamId,
    awayTeamId: g.awayTeamId,
    isConference: g.isConference,
    isPlayed: false,
  }));
  for (let i = 0; i < gameRows.length; i += chunkSize) {
    await prisma.game.createMany({ data: gameRows.slice(i, i + chunkSize) });
  }

  return { saveGameId: saveGame.id, coachTeamId: chosenTeam.id };
}

function prospectFromGenerated(saveGameId: string, p: ReturnType<typeof generateHighSchoolProspect>) {
  return {
    id: randomUUID(),
    saveGameId,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    hometownState: p.hometownState,
    source: p.source,
    starRating: p.starRating,
    scoring: p.ratings.scoring,
    threePoint: p.ratings.threePoint,
    finishing: p.ratings.finishing,
    playmaking: p.ratings.playmaking,
    rebounding: p.ratings.rebounding,
    defense: p.ratings.defense,
    athleticism: p.ratings.athleticism,
    basketballIq: p.ratings.basketballIq,
    potential: p.ratings.potential,
    characterRating: p.ratings.characterRating,
    scoutingNoise: p.scoutingNoise,
    graduationYear: p.graduationYear,
  };
}
