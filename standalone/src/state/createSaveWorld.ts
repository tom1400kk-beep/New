import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { loadLeagueData, prestigeTierToScore } from "./leagueData";
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
import { newId, type WorldState, type TeamRow, type CoachRow, type ConferenceRow, type PlayerRow, type ProspectRow, type GameRow, type AthleticDirectorRow, type RivalryRow, type TournamentRow } from "./types";
import { generatePreseasonTournaments } from "./preseasonTournaments";

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
  const initialPipelineJson = JSON.stringify(seedPipeline(playingCareer.hometownState, playingCareer.collegeState));
  const ALL_DIVISIONS: Division[] = ["D1", "D2", "D3"];
  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));

  const seasonYear = new Date().getFullYear();
  const currentDate = new Date(Date.UTC(seasonYear, 9, 1));
  const saveId = newId();

  const conferences: ConferenceRow[] = [];
  const coaches: CoachRow[] = [];
  const athleticDirectors: AthleticDirectorRow[] = [];
  const teams: TeamRow[] = [];
  const players: PlayerRow[] = [];
  const prospects: ProspectRow[] = [];

  type PendingTeam = { id: string; conferenceId: string; division: Division; prestige: number };
  const pendingTeams: PendingTeam[] = [];
  let chosenTeamId: string | null = null;

  for (const div of ALL_DIVISIONS) {
    const league = loadLeagueData(div);

    for (const conf of league.conferences) {
    const conferenceId = newId();
    conferences.push({ id: conferenceId, name: conf.name, abbreviation: conf.abbreviation, division: div });

    for (const member of conf.members) {
      const teamId = newId();
      const coachId = newId();
      const prestige = prestigeTierToScore(member.prestigeTier);
      const isPlayerControlled = div === division && member.school === teamSchoolName;
      if (isPlayerControlled) chosenTeamId = teamId;
      const baseSalary = salaryForTeam(rng, prestige, div);

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
        hometownState: isPlayerControlled ? playingCareer.hometownState : null,
        pipelineStatesJson: isPlayerControlled ? initialPipelineJson : "{}",
        transferPipelineJson: "{}",
        adRelationshipsJson: "{}",
        currentSalary: isPlayerControlled ? baseSalary : 300000, raiseRequestedThisSeason: false,
        teamPerception: 65, nationalPerception: 20, localPerception: 50, campusAtmosphere: 40,
        careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
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

      const adId = newId();
      athleticDirectors.push({
        id: adId, name: `${randomFirstName(rng)} ${randomLastName(rng)}`,
        ...generateADTraits(rng, academicReputation),
        // Stagger tenure clocks so the whole league isn't in lockstep from day one.
        yearsAtCurrentJob: randInt(rng, 0, 6),
      });

      teams.push({
        id: teamId, name: member.school, state, division: div, conferenceId,
        prestige, nilBudget, facilitiesRating, internationalScoutingRating, academicReputation, baseSalary, venueCapacity,
        arenaUpgradeRequestedThisSeason: false, isPlayerControlled,
        headCoachId: coachId, athleticDirectorId: adId,
      });
      pendingTeams.push({ id: teamId, conferenceId, division: div, prestige });

      const rosterSize = DIVISION_RULES[div].rosterCap;
      const scholarshipLimit = DIVISION_RULES[div].scholarshipLimit;
      const roster = generateRosterForTeam(rng, prestige, div, rosterSize, internationalScoutingRating);
      roster.forEach((p, i) => {
        players.push({
          id: newId(), teamId,
          firstName: p.firstName, lastName: p.lastName, position: p.position, classYear: p.classYear,
          heightInches: p.ratings.heightInches, hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, origin: p.origin,
          scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
          playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
          athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq,
          stamina: Math.round(clamp(randNormal(rng, 65, 15), 20, 99)),
          potential: p.ratings.potential, characterRating: p.ratings.characterRating,
          disciplineRating: p.ratings.disciplineRating, chemistryImpact: 0,
          eligibilityYearsLeft: p.eligibilityYearsLeft, inTransferPortal: false, previousSchool: null, prioritiesJson: "{}", isInjured: false, injuryWeeksLeft: 0,
          isSuspended: false, suspensionDaysLeft: 0,
          onScholarship: i < scholarshipLimit,
        });
      });
    }
    }
  }

  if (!chosenTeamId) {
    throw new Error(`Team "${teamSchoolName}" not found in ${division} league data`);
  }

  // ---- Seed traditional rivalries: same-state conference-mates are the
  // strongest real-world predictor of a genuine college rivalry. Every
  // conference is guaranteed at least one (its two most prestigious members)
  // even if no same-state pair exists. ----
  const rivalries: RivalryRow[] = [];
  const seededPairs = new Set<string>();
  const teamsByConference = new Map<string, TeamRow[]>();
  for (const t of teams) {
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
        rivalries.push({
          id: newId(), teamAId, teamBId, active: true,
          intensity: traditionalIntensity(a.prestige, b.prestige), postseasonMeetings: 0,
          origin: "TRADITIONAL", establishedYear: seasonYear,
        });
      }
    }
    if (!seededInConf && confTeams.length >= 2) {
      const [a, b] = [...confTeams].sort((x, y) => y.prestige - x.prestige).slice(0, 2);
      const [teamAId, teamBId] = sortedPair(a.id, b.id);
      rivalries.push({
        id: newId(), teamAId, teamBId, active: true,
        intensity: traditionalIntensity(a.prestige, b.prestige), postseasonMeetings: 0,
        origin: "TRADITIONAL", establishedYear: seasonYear,
      });
    }
  }

  // Sized off each team's own division roster cap (see runOffseason's
  // matching comment), summed across the whole merged league, so D2/D3's
  // bigger rosters aren't quietly under-supplied relative to D1.
  let totalDemand = 0;
  for (const t of pendingTeams) totalDemand += DIVISION_RULES[t.division].rosterCap / 4;
  const recruitingPoolTarget = Math.round(totalDemand * 1.6);
  const hsCount = Math.round(recruitingPoolTarget * (3 / 4.4));
  const jucoCount = Math.round(recruitingPoolTarget * (0.6 / 4.4));
  const internationalCount = Math.round(recruitingPoolTarget * (0.8 / 4.4));
  for (let i = 0; i < hsCount; i++) {
    prospects.push(prospectFromGenerated(generateHighSchoolProspect(rng, seasonYear + 1)));
  }
  for (let i = 0; i < jucoCount; i++) {
    prospects.push(prospectFromGenerated(generateJucoProspect(rng, seasonYear + 1)));
  }
  for (let i = 0; i < internationalCount; i++) {
    prospects.push(prospectFromGenerated(generateInternationalProspect(rng, seasonYear + 1)));
  }

  // Preseason multi-team events (Maui Invitational, Battle 4 Atlantis, etc.)
  // — D1-only, matching reality — claim their games and dates before the
  // rest of the non-conference slate is generated around them.
  const tournaments: TournamentRow[] = [];
  const nonConfWindowStart = new Date(Date.UTC(seasonYear, 10, 4)); // Nov 4, matches schedule.ts
  const d1TeamsForPreseason = pendingTeams.filter((t) => t.division === "D1").map((t) => ({ id: t.id, prestige: t.prestige }));
  const preseasonGames: GameRow[] = [];
  const preseasonResult = generatePreseasonTournaments({ tournaments, games: preseasonGames }, seasonYear, d1TeamsForPreseason, nonConfWindowStart, rng);

  let schedule: ScheduledGame[] = [];
  for (const d of ALL_DIVISIONS) {
    const divTeams = pendingTeams.filter((t) => t.division === d).map((t) => ({ id: t.id, conferenceId: t.conferenceId }));
    if (divTeams.length === 0) continue;
    schedule = schedule.concat(generateSeasonSchedule(divTeams, d, seasonYear, rng, d === "D1" ? preseasonResult : undefined));
  }
  const games: GameRow[] = [...preseasonGames, ...schedule.map((g) => ({
    id: newId(), seasonYear, date: g.date, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId,
    homeScore: null, awayScore: null, attendance: null, isPlayed: false, isConference: g.isConference,
    tournamentId: null, round: null, bracketSlot: null,
  }))];

  return {
    save: {
      id: saveId, name: saveName, createdAt: new Date(), updatedAt: new Date(),
      currentDate, currentSeasonYear: seasonYear, currentPhase: "PRESEASON", coachTeamId: chosenTeamId,
    },
    conferences, teams, coaches, athleticDirectors, assistants: [], players, prospects, interests: [],
    transferInterests: [],
    seasons: [{ id: newId(), year: seasonYear }], games, stats: [], tournaments, events: [], rivalries,
    walkOnCandidates: [],
  };
}

function prospectFromGenerated(p: ReturnType<typeof generateHighSchoolProspect>): ProspectRow {
  return {
    id: newId(), firstName: p.firstName, lastName: p.lastName, position: p.position,
    hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating,
    scoring: p.ratings.scoring, threePoint: p.ratings.threePoint, finishing: p.ratings.finishing,
    playmaking: p.ratings.playmaking, rebounding: p.ratings.rebounding, defense: p.ratings.defense,
    athleticism: p.ratings.athleticism, basketballIq: p.ratings.basketballIq, potential: p.ratings.potential,
    characterRating: p.ratings.characterRating, disciplineRating: p.ratings.disciplineRating,
    scoutingNoise: p.scoutingNoise, graduationYear: p.graduationYear,
    signed: false, committedTeamId: null, prioritiesJson: JSON.stringify(p.priorities),
  };
}
