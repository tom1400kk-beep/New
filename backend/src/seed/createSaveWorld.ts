import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { loadLeagueData, prestigeTierToScore } from "./leagueData";
import { toStateAbbr } from "./stateAbbr";
import { mulberry32, clamp, randNormal, randInt } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect, generateInternationalProspect } from "../engine/generation";
import { nilBudgetForTeam, facilitiesForTeam, internationalScoutingForTeam, academicReputationForTeam, salaryForTeam, venueCapacityForTeam } from "../engine/budget";
import { generateSeasonSchedule } from "../engine/schedule";
import { generateCoachSkills, randomArchetype, mergeDeltas, type CoachArchetype } from "../engine/coachArchetypes";
import { getBackgroundProfile, type CoachBackground } from "../engine/coachBackgrounds";
import { playingCareerEffects, NO_PLAYING_CAREER, type PlayingCareerChoice } from "../engine/playingCareer";
import { seedPipeline } from "../engine/pipeline";
import { generateADTraits } from "../engine/athleticDirector";

export interface CreateSaveInput {
  saveName: string;
  division: Division;
  teamSchoolName: string;
  coachName: string;
  coachArchetype?: CoachArchetype;
  coachBackground?: CoachBackground | null;
  playingCareer?: PlayingCareerChoice;
}

export interface CreateSaveResult {
  saveGameId: string;
  coachTeamId: string;
}

export async function createSaveWorld(input: CreateSaveInput): Promise<CreateSaveResult> {
  const { saveName, division, teamSchoolName, coachName } = input;
  const chosenArchetype: CoachArchetype = input.coachArchetype ?? "PROGRAM_BUILDER";
  const chosenBackground: CoachBackground | null = input.coachBackground ?? null;
  const backgroundProfile = getBackgroundProfile(chosenBackground);
  const playingCareer: PlayingCareerChoice = input.playingCareer ?? NO_PLAYING_CAREER;
  const careerEffects = playingCareerEffects(playingCareer);
  const combinedExtraDeltas = mergeDeltas(backgroundProfile?.deltas, careerEffects.deltas);
  const initialPipelineJson = JSON.stringify(seedPipeline(playingCareer.hometownState, playingCareer.collegeState));
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
    archetype: string; background: string | null;
    playedCollege: boolean; collegeTeamName: string | null; collegeState: string | null;
    proPath: string; proCountry: string | null;
    hometownState: string | null; pipelineStatesJson: string;
    currentSalary?: number;
  }[] = [];
  const teamRows: {
    id: string; saveGameId: string; name: string; state: string; division: string; conferenceId: string;
    prestige: number; nilBudget: number; facilitiesRating: number; internationalScoutingRating: number; academicReputation: number;
    baseSalary: number; venueCapacity: number; isPlayerControlled: boolean; headCoachId: string; athleticDirectorId: string;
  }[] = [];
  const adRows: {
    id: string; saveGameId: string; name: string;
    patience: number; winFocus: number; integrityStandard: number; loyalty: number; yearsAtCurrentJob: number;
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
      const baseSalary = salaryForTeam(rng, prestige, division);

      const archetype: CoachArchetype = isPlayerControlled ? chosenArchetype : randomArchetype(rng);
      const background: CoachBackground | null = isPlayerControlled ? chosenBackground : null;
      const skills = generateCoachSkills(rng, prestige, archetype, isPlayerControlled ? combinedExtraDeltas : undefined);
      coachRows.push({
        id: coachId,
        saveGameId: saveGame.id,
        name: isPlayerControlled ? coachName : `${randomFirstName(rng)} ${randomLastName(rng)}`,
        isPlayerControlled,
        reputation: skills.reputation,
        hotSeatLevel: 0,
        offenseSkill: skills.offenseSkill,
        defenseSkill: skills.defenseSkill,
        recruitingSkill: skills.recruitingSkill,
        developmentSkill: skills.developmentSkill,
        archetype,
        background,
        playedCollege: isPlayerControlled ? playingCareer.playedCollege : false,
        collegeTeamName: isPlayerControlled ? playingCareer.collegeTeamName : null,
        collegeState: isPlayerControlled ? playingCareer.collegeState : null,
        proPath: isPlayerControlled ? playingCareer.proPath : "NONE",
        proCountry: isPlayerControlled ? playingCareer.proCountry : null,
        hometownState: isPlayerControlled ? playingCareer.hometownState : null,
        pipelineStatesJson: isPlayerControlled ? initialPipelineJson : "{}",
        ...(isPlayerControlled ? { currentSalary: baseSalary } : {}),
      });

      const nilBudget = nilBudgetForTeam(rng, prestige, division);
      const facilitiesRating = facilitiesForTeam(rng, prestige);
      let internationalScoutingRating = internationalScoutingForTeam(rng, prestige);
      if (isPlayerControlled && chosenBackground === "INTERNATIONAL_SCOUT") {
        internationalScoutingRating = Math.round(clamp(internationalScoutingRating + 25, 5, 99));
      }
      if (isPlayerControlled && playingCareer.proPath === "OVERSEAS_PRO") {
        internationalScoutingRating = Math.round(clamp(internationalScoutingRating + 12, 5, 99));
      }
      const academicReputation = academicReputationForTeam(rng, prestige);
      const venueCapacity = venueCapacityForTeam(rng, prestige, division);
      const state = toStateAbbr(member.state);

      const adId = randomUUID();
      const adTraits = generateADTraits(rng, academicReputation);
      adRows.push({
        id: adId, saveGameId: saveGame.id, name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
        ...adTraits,
        // Stagger tenure clocks so the whole league isn't in lockstep from day one.
        yearsAtCurrentJob: randInt(rng, 0, 6),
      });

      teamRows.push({
        id: teamId, saveGameId: saveGame.id, name: member.school, state, division, conferenceId,
        prestige, nilBudget, facilitiesRating, internationalScoutingRating, academicReputation, baseSalary, venueCapacity, isPlayerControlled,
        headCoachId: coachId, athleticDirectorId: adId,
      });
      pendingTeams.push({ id: teamId, name: member.school, state, conferenceId, prestige, coachId, isPlayerControlled });

      const rosterSize = DIVISION_RULES[division].rosterCap;
      const roster = generateRosterForTeam(rng, prestige, division, rosterSize, internationalScoutingRating);
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
          countryOfOrigin: p.countryOfOrigin,
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
          disciplineRating: p.ratings.disciplineRating,
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
  await prisma.athleticDirector.createMany({ data: adRows });
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
  const internationalCount = Math.round(pendingTeams.length * 0.8);
  for (let i = 0; i < hsCount; i++) {
    const p = generateHighSchoolProspect(rng, seasonYear + 1);
    prospectRows.push(prospectFromGenerated(saveGame.id, p));
  }
  for (let i = 0; i < jucoCount; i++) {
    const p = generateJucoProspect(rng, seasonYear + 1);
    prospectRows.push(prospectFromGenerated(saveGame.id, p));
  }
  for (let i = 0; i < internationalCount; i++) {
    const p = generateInternationalProspect(rng, seasonYear + 1);
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
    countryOfOrigin: p.countryOfOrigin,
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
    disciplineRating: p.ratings.disciplineRating,
    scoutingNoise: p.scoutingNoise,
    graduationYear: p.graduationYear,
    prioritiesJson: JSON.stringify(p.priorities),
  };
}
