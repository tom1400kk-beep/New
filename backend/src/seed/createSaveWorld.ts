import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { loadLeagueData, prestigeTierToScore, divisionDataAvailable } from "./leagueData";
import { toStateAbbr } from "./stateAbbr";
import { mulberry32, clamp, randNormal, randInt } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect, generateInternationalProspect } from "../engine/generation";
import { nilBudgetForTeam, facilitiesForTeam, internationalScoutingForTeam, academicReputationForTeam, salaryForTeam, venueCapacityForTeam } from "../engine/budget";
import { generateSeasonSchedule, type ScheduledGame } from "../engine/schedule";
import { generateCoachSkills, randomArchetype, mergeDeltas, type CoachArchetype } from "../engine/coachArchetypes";
import { getBackgroundProfile, type CoachBackground } from "../engine/coachBackgrounds";
import { playingCareerEffects, NO_PLAYING_CAREER, type PlayingCareerChoice } from "../engine/playingCareer";
import { seedPipeline } from "../engine/pipeline";
import { generateADTraits } from "../engine/athleticDirector";
import { TRADITIONAL_RIVALRY_CHANCE, traditionalIntensity, sortedPair } from "../engine/rivalry";

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
  const ALL_DIVISIONS: Division[] = ["D1", "D2", "D3"];
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
    division: Division;
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

  for (const div of ALL_DIVISIONS) {
    if (!divisionDataAvailable(div)) continue;
    const league = loadLeagueData(div);

    for (const conf of league.conferences) {
    const conferenceId = randomUUID();
    conferenceRows.push({ id: conferenceId, saveGameId: saveGame.id, name: conf.name, abbreviation: conf.abbreviation, division: div });

    for (const member of conf.members) {
      const teamId = randomUUID();
      const coachId = randomUUID();
      const prestige = prestigeTierToScore(member.prestigeTier);
      const isPlayerControlled = div === division && member.school === teamSchoolName;
      if (isPlayerControlled) foundChosenTeam = true;
      const baseSalary = salaryForTeam(rng, prestige, div);

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

      const nilBudget = nilBudgetForTeam(rng, prestige, div);
      const facilitiesRating = facilitiesForTeam(rng, prestige);
      let internationalScoutingRating = internationalScoutingForTeam(rng, prestige);
      if (isPlayerControlled && chosenBackground === "INTERNATIONAL_SCOUT") {
        internationalScoutingRating = Math.round(clamp(internationalScoutingRating + 25, 5, 99));
      }
      if (isPlayerControlled && playingCareer.proPath === "OVERSEAS_PRO") {
        internationalScoutingRating = Math.round(clamp(internationalScoutingRating + 12, 5, 99));
      }
      const academicReputation = academicReputationForTeam(rng, prestige);
      const venueCapacity = venueCapacityForTeam(rng, prestige, div);
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
        id: teamId, saveGameId: saveGame.id, name: member.school, state, division: div, conferenceId,
        prestige, nilBudget, facilitiesRating, internationalScoutingRating, academicReputation, baseSalary, venueCapacity, isPlayerControlled,
        headCoachId: coachId, athleticDirectorId: adId,
      });
      pendingTeams.push({ id: teamId, name: member.school, state, conferenceId, prestige, coachId, isPlayerControlled, division: div });

      const rosterSize = DIVISION_RULES[div].rosterCap;
      const scholarshipLimit = DIVISION_RULES[div].scholarshipLimit;
      const roster = generateRosterForTeam(rng, prestige, div, rosterSize, internationalScoutingRating);
      roster.forEach((p, i) => {
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
          hometownCity: p.hometownCity,
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
          onScholarship: i < scholarshipLimit,
        });
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

  // ---- Seed traditional rivalries: same-state conference-mates are the
  // strongest real-world predictor of a genuine college rivalry. Every
  // conference is guaranteed at least one (its two most prestigious members)
  // even if no same-state pair exists. ----
  const rivalryRows: { id: string; saveGameId: string; teamAId: string; teamBId: string; active: boolean; intensity: number; origin: string; establishedYear: number }[] = [];
  const seededPairs = new Set<string>();
  const teamsByConference = new Map<string, typeof teamRows>();
  for (const t of teamRows) {
    if (!teamsByConference.has(t.conferenceId)) teamsByConference.set(t.conferenceId, []);
    teamsByConference.get(t.conferenceId)!.push(t);
  }
  for (const confTeams of teamsByConference.values()) {
    let seededInConf = false;
    for (let i = 0; i < confTeams.length; i++) {
      for (let j = i + 1; j < confTeams.length; j++) {
        const a = confTeams[i], b = confTeams[j];
        if (a.state !== b.state) continue;
        if (rng() > TRADITIONAL_RIVALRY_CHANCE) continue;
        const [teamAId, teamBId] = sortedPair(a.id, b.id);
        const key = `${teamAId}|${teamBId}`;
        if (seededPairs.has(key)) continue;
        seededPairs.add(key);
        seededInConf = true;
        rivalryRows.push({
          id: randomUUID(), saveGameId: saveGame.id, teamAId, teamBId, active: true,
          intensity: traditionalIntensity(a.prestige, b.prestige), origin: "TRADITIONAL", establishedYear: seasonYear,
        });
      }
    }
    if (!seededInConf && confTeams.length >= 2) {
      const [a, b] = [...confTeams].sort((x, y) => y.prestige - x.prestige).slice(0, 2);
      const [teamAId, teamBId] = sortedPair(a.id, b.id);
      rivalryRows.push({
        id: randomUUID(), saveGameId: saveGame.id, teamAId, teamBId, active: true,
        intensity: traditionalIntensity(a.prestige, b.prestige), origin: "TRADITIONAL", establishedYear: seasonYear,
      });
    }
  }
  if (rivalryRows.length > 0) await prisma.rivalry.createMany({ data: rivalryRows });

  // chunk player inserts to stay well under sqlite parameter limits
  const chunkSize = 400;
  for (let i = 0; i < playerRows.length; i += chunkSize) {
    await prisma.player.createMany({ data: playerRows.slice(i, i + chunkSize) });
  }

  const chosenTeam = pendingTeams.find((t) => t.isPlayerControlled)!;
  await prisma.saveGame.update({ where: { id: saveGame.id }, data: { coachTeamId: chosenTeam.id } });

  await prisma.season.create({ data: { id: randomUUID(), saveGameId: saveGame.id, year: seasonYear } });

  // Recruiting pool for the upcoming signing class — sized off each team's
  // own division roster cap (see runOffseason's matching comment) and summed
  // across the whole merged league, so D2/D3's bigger rosters aren't quietly
  // under-supplied relative to D1.
  const prospectRows: any[] = [];
  let totalDemand = 0;
  for (const t of pendingTeams) totalDemand += DIVISION_RULES[t.division].rosterCap / 4;
  const recruitingPoolTarget = Math.round(totalDemand * 1.6);
  const hsCount = Math.round(recruitingPoolTarget * (3 / 4.4));
  const jucoCount = Math.round(recruitingPoolTarget * (0.6 / 4.4));
  const internationalCount = Math.round(recruitingPoolTarget * (0.8 / 4.4));
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

  // Season schedule, generated separately per division so non-conference
  // pairings never cross divisions, then merged into one calendar.
  let schedule: ScheduledGame[] = [];
  for (const div of ALL_DIVISIONS) {
    const divTeams = pendingTeams.filter((t) => t.division === div).map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
    if (divTeams.length === 0) continue;
    schedule = schedule.concat(generateSeasonSchedule(divTeams, div, seasonYear, rng));
  }
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
    hometownCity: p.hometownCity,
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
