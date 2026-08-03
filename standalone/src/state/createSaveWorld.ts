import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { loadLeagueData, prestigeTierToScore } from "./leagueData";
import { toStateAbbr } from "./stateAbbr";
import { mulberry32, clamp, randNormal } from "../engine/rng";
import { randomFirstName, randomLastName } from "../engine/names";
import { generateRosterForTeam, generateHighSchoolProspect, generateJucoProspect, generateInternationalProspect } from "../engine/generation";
import { nilBudgetForTeam, facilitiesForTeam, internationalScoutingForTeam, academicReputationForTeam } from "../engine/budget";
import { generateSeasonSchedule } from "../engine/schedule";
import { generateCoachSkills, randomArchetype, mergeDeltas, type CoachArchetype } from "../engine/coachArchetypes";
import { getBackgroundProfile, type CoachBackground } from "../engine/coachBackgrounds";
import { playingCareerEffects, NO_PLAYING_CAREER, type PlayingCareerChoice } from "../engine/playingCareer";
import { newId, type WorldState, type TeamRow, type CoachRow, type ConferenceRow, type PlayerRow, type ProspectRow, type GameRow } from "./types";

export interface CreateSaveInput {
  saveName: string;
  division: Division;
  teamSchoolName: string;
  coachName: string;
  coachArchetype?: CoachArchetype;
  coachBackground?: CoachBackground | null;
  playingCareer?: PlayingCareerChoice;
}

export function createSaveWorld(input: CreateSaveInput): WorldState {
  const { saveName, division, teamSchoolName, coachName } = input;
  const chosenArchetype: CoachArchetype = input.coachArchetype ?? "PROGRAM_BUILDER";
  const chosenBackground: CoachBackground | null = input.coachBackground ?? null;
  const backgroundProfile = getBackgroundProfile(chosenBackground);
  const playingCareer: PlayingCareerChoice = input.playingCareer ?? NO_PLAYING_CAREER;
  const careerEffects = playingCareerEffects(playingCareer);
  const combinedExtraDeltas = mergeDeltas(backgroundProfile?.deltas, careerEffects.deltas);
  const league = loadLeagueData(division);
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  const seasonYear = new Date().getFullYear();
  const currentDate = new Date(Date.UTC(seasonYear, 9, 1));
  const saveId = newId();

  const conferences: ConferenceRow[] = [];
  const coaches: CoachRow[] = [];
  const teams: TeamRow[] = [];
  const players: PlayerRow[] = [];
  const prospects: ProspectRow[] = [];

  type PendingTeam = { id: string; conferenceId: string };
  const pendingTeams: PendingTeam[] = [];
  let chosenTeamId: string | null = null;

  for (const conf of league.conferences) {
    const conferenceId = newId();
    conferences.push({ id: conferenceId, name: conf.name, abbreviation: conf.abbreviation, division });

    for (const member of conf.members) {
      const teamId = newId();
      const coachId = newId();
      const prestige = prestigeTierToScore(member.prestigeTier);
      const isPlayerControlled = member.school === teamSchoolName;
      if (isPlayerControlled) chosenTeamId = teamId;

      const archetype: CoachArchetype = isPlayerControlled ? chosenArchetype : randomArchetype(rng);
      const background: CoachBackground | null = isPlayerControlled ? chosenBackground : null;
      const skills = generateCoachSkills(rng, prestige, archetype, isPlayerControlled ? combinedExtraDeltas : undefined);
      coaches.push({
        id: coachId,
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
        legalityReputation: 75,
        careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
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
      const state = toStateAbbr(member.state);

      teams.push({
        id: teamId, name: member.school, state, division, conferenceId,
        prestige, nilBudget, facilitiesRating, internationalScoutingRating, academicReputation, isPlayerControlled, headCoachId: coachId,
      });
      pendingTeams.push({ id: teamId, conferenceId });

      const rosterSize = DIVISION_RULES[division].rosterCap;
      const roster = generateRosterForTeam(rng, prestige, division, rosterSize, internationalScoutingRating);
      for (const p of roster) {
        players.push({
          id: newId(), teamId,
          firstName: p.firstName, lastName: p.lastName, position: p.position, classYear: p.classYear,
          heightInches: p.ratings.heightInches, hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, origin: p.origin,
          scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
          playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
          athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
          stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
          potential: p.ratings.potential, characterRating: p.ratings.characterRating,
          disciplineRating: p.ratings.disciplineRating, chemistryImpact: 0,
          eligibilityYearsLeft: p.eligibilityYearsLeft, inTransferPortal: false, isInjured: false, injuryWeeksLeft: 0,
          isSuspended: false, suspensionDaysLeft: 0,
        });
      }
    }
  }

  if (!chosenTeamId) {
    throw new Error(`Team "${teamSchoolName}" not found in ${division} league data`);
  }

  const hsCount = Math.round(pendingTeams.length * 3);
  const jucoCount = Math.round(pendingTeams.length * 0.6);
  const internationalCount = Math.round(pendingTeams.length * 0.8);
  for (let i = 0; i < hsCount; i++) {
    prospects.push(prospectFromGenerated(generateHighSchoolProspect(rng, seasonYear + 1)));
  }
  for (let i = 0; i < jucoCount; i++) {
    prospects.push(prospectFromGenerated(generateJucoProspect(rng, seasonYear + 1)));
  }
  for (let i = 0; i < internationalCount; i++) {
    prospects.push(prospectFromGenerated(generateInternationalProspect(rng, seasonYear + 1)));
  }

  const scheduleTeams = pendingTeams.map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
  const schedule = generateSeasonSchedule(scheduleTeams, division, seasonYear, rng);
  const games: GameRow[] = schedule.map((g) => ({
    id: newId(), seasonYear, date: g.date, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
    homeScore: null, awayScore: null, isPlayed: false, isConference: g.isConference,
    tournamentId: null, round: null, bracketSlot: null,
  }));

  return {
    save: {
      id: saveId, name: saveName, createdAt: new Date(), updatedAt: new Date(),
      currentDate, currentSeasonYear: seasonYear, currentPhase: "PRESEASON", coachTeamId: chosenTeamId,
    },
    conferences, teams, coaches, assistants: [], players, prospects, interests: [],
    seasons: [{ id: newId(), year: seasonYear }], games, stats: [], tournaments: [], events: [],
  };
}

function prospectFromGenerated(p: ReturnType<typeof generateHighSchoolProspect>): ProspectRow {
  return {
    id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position,
    hometownState: p.hometownState, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
    scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
    playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
    athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
    characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
    scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
    signed: false, committedTeamId: null, prioritiesJson: JSON.stringify(p.priorities),
  };
}
