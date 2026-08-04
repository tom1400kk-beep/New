import { computeInterestGain, weeklyRecruitingPoints, type RecruitingProspectInput, type RecruitingTeamInput } from "../engine/recruiting";
import { PRIORITY_KEYS, topPriorities, type PriorityKey, type PriorityProfile } from "../engine/priorities";
import { clamp, randInt, mulberry32 } from "../engine/rng";
import type { EventEffects, EventOption } from "../engine/events";
import { meetsLegalityBar, expectedWinPct, generateJobOffers, type JobOpening } from "../engine/career";
import { parsePipelineStates, pipelineScore, bumpPipelineState } from "../engine/pipeline";
import { parseAdRelationships, adRelationshipScore } from "../engine/athleticDirector";
import { costOfLivingIndex } from "../engine/costOfLiving";
import { arenaUpgradeGrantChance, nextArenaCapacity, isArenaNearCap } from "../engine/attendance";
import { disciplineSigningReputationHit } from "../engine/disciplineDrops";
import type { Division } from "../types";
import { DIVISION_RULES } from "../types";
import { generateCoachSkills, randomArchetype } from "../engine/coachArchetypes";
import { randomFirstName, randomLastName } from "../engine/names";
import { computeStandings, winPct } from "./standings";
import { aggregateCareerStats, type CareerSeasonLine, type RawGameStatLine } from "../engine/careerStats";
import { newId, type WorldState } from "./types";
import { PRESEASON_EVENTS, type PreseasonEventDef } from "../engine/preseasonEvents";
import { TOUR_COOLDOWN_YEARS, TOUR_COUNTRIES, isTourEligible, isTourAffordable, simulateTourGames } from "../engine/internationalTour";
import type { SimTeam } from "../engine/simulate";
import { overall } from "../engine/simulate";
import { normalizeScholarshipsForDivision } from "../engine/conferenceRealignment";

function noisy(rng: () => number, value: number, noise: number): number {
  return Math.round(clamp(value + randInt(rng, -noise, noise), 1, 99));
}

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
    const even = 100 / PRIORITY_KEYS.length;
    return PRIORITY_KEYS.reduce((acc, k) => ({ ...acc, [k]: even }), {} as PriorityProfile);
  }
}

export interface RecruitingBoardEntry {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  hometownState: string;
  hometownCity: string;
  highSchool: string;
  countryOfOrigin: string | null;
  source: string;
  starRating: number;
  graduationYear: number;
  playedEYBL: boolean;
  eyblTeam: string | null;
  topPriorities: PriorityKey[];
  pipelineScore: number | null;
  scouted: {
    scoring: number; threePoint: number; finishing: number; playmaking: number;
    rebounding: number; defense: number; athleticism: number; characterRating: number; disciplineRating: number;
  };
  interestLevel: number;
  pointsInvested: number;
  offered: boolean;
}

export function getRecruitingBoard(state: WorldState): RecruitingBoardEntry[] {
  if (!state.save.coachTeamId) return [];
  const teamId = state.save.coachTeamId;
  const rng = mulberry32(42);

  const team = state.teams.find((t) => t.id === teamId);
  const coach = team ? state.coaches.find((c) => c.id === team.headCoachId) : undefined;
  const pipeline = parsePipelineStates(coach?.pipelineStatesJson ?? "{}");

  return state.prospects
    .filter((p) => !p.signed && p.graduationYear >= state.save.currentSeasonYear + 1)
    .sort((a, b) => b.starRating - a.starRating)
    .slice(0, 200)
    .map((p) => {
      const interest = state.interests.find((i) => i.prospectId === p.id && i.teamId === teamId);
      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position,
        hometownState: p.hometownState, hometownCity: p.hometownCity, highSchool: p.highSchool, countryOfOrigin: p.countryOfOrigin, source: p.source, starRating: p.starRating, graduationYear: p.graduationYear,
        playedEYBL: p.playedEYBL, eyblTeam: p.eyblTeam,
        topPriorities: topPriorities(parsePriorities(p.prioritiesJson), 3),
        pipelineScore: p.hometownState ? pipelineScore(pipeline, p.hometownState) : null,
        scouted: {
          scoring: noisy(rng, p.scoring, p.scoutingNoise), threePoint: noisy(rng, p.threePoint, p.scoutingNoise),
          finishing: noisy(rng, p.finishing, p.scoutingNoise), playmaking: noisy(rng, p.playmaking, p.scoutingNoise),
          rebounding: noisy(rng, p.rebounding, p.scoutingNoise), defense: noisy(rng, p.defense, p.scoutingNoise),
          athleticism: noisy(rng, p.athleticism, p.scoutingNoise), characterRating: noisy(rng, p.characterRating, p.scoutingNoise + 5),
          disciplineRating: noisy(rng, p.disciplineRating, p.scoutingNoise + 8),
        },
        interestLevel: interest?.interestLevel ?? 0, pointsInvested: interest?.pointsInvested ?? 0, offered: interest?.offered ?? false,
      };
    });
}

export function pursueRecruit(state: WorldState, prospectId: string, points: number) {
  if (!state.save.coachTeamId) throw new Error("No active team");
  const spendRequested = Math.max(1, Math.min(50, points || 10));
  const team = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  const coach = state.coaches.find((c) => c.id === team.headCoachId)!;
  const prospect = state.prospects.find((p) => p.id === prospectId)!;
  const assistants = state.assistants.filter((a) => a.teamId === team.id && a.role === "RECRUITING");
  const bestAssistant = Math.max(0, ...assistants.map((a) => a.rating), 0);

  const budget = weeklyRecruitingPoints(coach.recruitingSkill, bestAssistant);
  const spend = Math.min(spendRequested, budget);

  let interest = state.interests.find((i) => i.prospectId === prospectId && i.teamId === team.id);
  const pointsInvested = (interest?.pointsInvested ?? 0) + spend;

  const standings = computeStandings(state, state.save.currentSeasonYear);
  const record = standings.get(team.id);
  const recentWinPct = record && record.wins + record.losses > 0 ? winPct(record) : team.prestige / 100;
  const roster = state.players.filter((p) => p.teamId === team.id);

  const prospectInput: RecruitingProspectInput = {
    position: prospect.position, hometownState: prospect.hometownState, countryOfOrigin: prospect.countryOfOrigin,
    characterRating: prospect.characterRating, scoring: prospect.scoring, threePoint: prospect.threePoint,
    finishing: prospect.finishing, playmaking: prospect.playmaking, rebounding: prospect.rebounding, defense: prospect.defense,
    starRating: prospect.starRating, priorities: parsePriorities(prospect.prioritiesJson),
    source: prospect.source,
  };

  const teamInput: RecruitingTeamInput = {
    division: team.division as Division,
    state: team.state, prestige: team.prestige, nilBudget: team.nilBudget, facilitiesRating: team.facilitiesRating,
    academicReputation: team.academicReputation, internationalScoutingRating: team.internationalScoutingRating,
    recruitingSkill: coach.recruitingSkill, assistantRecruitingSkill: bestAssistant, developmentSkill: coach.developmentSkill,
    offenseSkill: coach.offenseSkill, defenseSkill: coach.defenseSkill, hotSeatLevel: coach.hotSeatLevel,
    recentWinPct, roster: roster.map((p) => ({ position: p.position, overall: playerOverall(p), characterRating: p.characterRating })),
    coachBackground: coach.background,
    proCountry: coach.proCountry,
    playedProDomestic: coach.proPath === "DOMESTIC_PRO",
    coachPipelineStates: parsePipelineStates(coach.pipelineStatesJson),
    campusAtmosphere: coach.campusAtmosphere,
    hasScholarshipOpen: scholarshipOpen(team.division as Division, roster.filter((p) => p.onScholarship).length),
  };

  const gain = computeInterestGain(prospectInput, teamInput, pointsInvested);

  if (interest) {
    interest.interestLevel = Math.round(gain);
    interest.pointsInvested = pointsInvested;
    interest.offered = true;
  } else {
    interest = { id: newId(), prospectId, teamId: team.id, interestLevel: Math.round(gain), pointsInvested, offered: true, visitCompleted: false };
    state.interests.push(interest);
  }

  // Actively recruiting a prospect strengthens the coach's personal pipeline
  // in their home state — this persists on the coach, not the team.
  if (prospect.hometownState) {
    coach.pipelineStatesJson = JSON.stringify(bumpPipelineState(teamInput.coachPipelineStates!, prospect.hometownState));
  }

  return interest;
}

export interface TransferBoardEntry {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  classYear: string;
  hometownState: string;
  hometownCity: string;
  countryOfOrigin: string | null;
  previousSchool: string | null;
  eligibilityYearsLeft: number;
  overall: number;
  topPriorities: PriorityKey[];
  pipelineScore: number | null;
  scoring: number; threePoint: number; finishing: number; playmaking: number;
  rebounding: number; defense: number; athleticism: number; basketballIq: number;
  characterRating: number; disciplineRating: number;
  interestLevel: number;
  pointsInvested: number;
  offered: boolean;
  careerStats: CareerSeasonLine[];
}

export function getTransferBoard(state: WorldState): TransferBoardEntry[] {
  if (!state.save.coachTeamId) return [];
  const teamId = state.save.coachTeamId;
  const team = state.teams.find((t) => t.id === teamId);
  const coach = team ? state.coaches.find((c) => c.id === team.headCoachId) : undefined;
  const transferPipeline = parsePipelineStates(coach?.transferPipelineJson ?? "{}");
  const seasonYearByGame = new Map(state.games.map((g) => [g.id, g.seasonYear]));

  return state.players
    .filter((p) => p.inTransferPortal)
    .sort((a, b) => b.scoring - a.scoring)
    .slice(0, 200)
    .map((p) => {
      const interest = state.transferInterests.find((i) => i.playerId === p.id && i.teamId === teamId);
      const statRows: RawGameStatLine[] = state.stats
        .filter((s) => s.playerId === p.id)
        .map((s) => ({ ...s, seasonYear: seasonYearByGame.get(s.gameId) ?? 0 }))
        .filter((s) => s.seasonYear !== 0);
      return {
        id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position, classYear: p.classYear,
        hometownState: p.hometownState, hometownCity: p.hometownCity, countryOfOrigin: p.countryOfOrigin, previousSchool: p.previousSchool,
        eligibilityYearsLeft: p.eligibilityYearsLeft, overall: playerOverall(p),
        topPriorities: topPriorities(parsePriorities(p.prioritiesJson), 3),
        pipelineScore: p.previousSchool ? pipelineScore(transferPipeline, p.previousSchool) : null,
        scoring: p.scoring, threePoint: p.threePoint, finishing: p.finishing, playmaking: p.playmaking,
        rebounding: p.rebounding, defense: p.defense, athleticism: p.athleticism, basketballIq: p.basketballIq,
        characterRating: p.characterRating, disciplineRating: p.disciplineRating,
        interestLevel: interest?.interestLevel ?? 0, pointsInvested: interest?.pointsInvested ?? 0, offered: interest?.offered ?? false,
        careerStats: aggregateCareerStats(statRows),
      };
    });
}

export function pursueTransfer(state: WorldState, playerId: string, points: number) {
  if (!state.save.coachTeamId) throw new Error("No active team");
  const spendRequested = Math.max(1, Math.min(50, points || 10));
  const team = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  const coach = state.coaches.find((c) => c.id === team.headCoachId)!;
  const player = state.players.find((p) => p.id === playerId)!;
  if (!player.inTransferPortal) throw new Error("This player isn't in the transfer portal");
  const assistants = state.assistants.filter((a) => a.teamId === team.id && a.role === "RECRUITING");
  const bestAssistant = Math.max(0, ...assistants.map((a) => a.rating), 0);

  const budget = weeklyRecruitingPoints(coach.recruitingSkill, bestAssistant);
  const spend = Math.min(spendRequested, budget);

  let interest = state.transferInterests.find((i) => i.playerId === playerId && i.teamId === team.id);
  const pointsInvested = (interest?.pointsInvested ?? 0) + spend;

  const standings = computeStandings(state, state.save.currentSeasonYear);
  const record = standings.get(team.id);
  const recentWinPct = record && record.wins + record.losses > 0 ? winPct(record) : team.prestige / 100;
  const roster = state.players.filter((p) => p.teamId === team.id);

  const overall = playerOverall(player);
  const prospectInput: RecruitingProspectInput = {
    position: player.position, hometownState: player.hometownState, countryOfOrigin: player.countryOfOrigin,
    characterRating: player.characterRating, scoring: player.scoring, threePoint: player.threePoint,
    finishing: player.finishing, playmaking: player.playmaking, rebounding: player.rebounding, defense: player.defense,
    starRating: clamp(Math.round(overall / 20), 1, 5), priorities: parsePriorities(player.prioritiesJson),
    previousSchool: player.previousSchool, source: player.origin,
  };

  const teamInput: RecruitingTeamInput = {
    division: team.division as Division,
    state: team.state, prestige: team.prestige, nilBudget: team.nilBudget, facilitiesRating: team.facilitiesRating,
    academicReputation: team.academicReputation, internationalScoutingRating: team.internationalScoutingRating,
    recruitingSkill: coach.recruitingSkill, assistantRecruitingSkill: bestAssistant, developmentSkill: coach.developmentSkill,
    offenseSkill: coach.offenseSkill, defenseSkill: coach.defenseSkill, hotSeatLevel: coach.hotSeatLevel,
    recentWinPct, roster: roster.map((p) => ({ position: p.position, overall: playerOverall(p), characterRating: p.characterRating })),
    coachBackground: coach.background,
    proCountry: coach.proCountry,
    playedProDomestic: coach.proPath === "DOMESTIC_PRO",
    coachPipelineStates: parsePipelineStates(coach.pipelineStatesJson),
    campusAtmosphere: coach.campusAtmosphere,
    hasScholarshipOpen: scholarshipOpen(team.division as Division, roster.filter((p) => p.onScholarship).length),
    coachTransferPipeline: parsePipelineStates(coach.transferPipelineJson),
  };

  const gain = computeInterestGain(prospectInput, teamInput, pointsInvested);

  if (interest) {
    interest.interestLevel = Math.round(gain);
    interest.pointsInvested = pointsInvested;
    interest.offered = true;
  } else {
    interest = { id: newId(), playerId, teamId: team.id, interestLevel: Math.round(gain), pointsInvested, offered: true };
    state.transferInterests.push(interest);
  }

  return interest;
}

export function getPendingEvents(state: WorldState) {
  return state.events
    .filter((e) => e.status === "PENDING")
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((e) => ({ ...e, options: JSON.parse(e.optionsJson) as EventOption[] }));
}

export function resolveEvent(state: WorldState, eventId: string, optionId: string) {
  const event = state.events.find((e) => e.id === eventId);
  if (!event) throw new Error("Event not found");
  const options = JSON.parse(event.optionsJson) as EventOption[];
  const chosen = options.find((o) => o.id === optionId);
  if (!chosen) throw new Error("Invalid option");

  applyEffects(state, event.teamId, event.playerId, chosen.effects);
  event.status = "RESOLVED";
  event.chosenOptionId = chosen.id;
  return { resolved: true };
}

function applyEffects(state: WorldState, teamId: string | null, playerId: string | null, effects: EventEffects) {
  let sourceTeamName: string | null = null;
  if (teamId) {
    const team = state.teams.find((t) => t.id === teamId);
    if (team) {
      sourceTeamName = team.name;
      if (effects.prestigeDelta) team.prestige = Math.round(clamp(team.prestige + effects.prestigeDelta, 5, 99));
      if (effects.nilBudgetDelta) team.nilBudget = Math.max(0, team.nilBudget + effects.nilBudgetDelta);
      if (effects.hotSeatDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        if (coach) coach.hotSeatLevel = Math.round(clamp(coach.hotSeatLevel + effects.hotSeatDelta, 0, 100));
      }
      if (effects.legalityDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        if (coach) coach.legalityReputation = Math.round(clamp(coach.legalityReputation + effects.legalityDelta, 5, 99));
      }
      if (effects.teamPerceptionDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        if (coach) coach.teamPerception = Math.round(clamp(coach.teamPerception + effects.teamPerceptionDelta, 1, 100));
      }
      if (effects.nationalPerceptionDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        if (coach) coach.nationalPerception = Math.round(clamp(coach.nationalPerception + effects.nationalPerceptionDelta, 1, 100));
      }
      if (effects.localPerceptionDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        if (coach) coach.localPerception = Math.round(clamp(coach.localPerception + effects.localPerceptionDelta, 1, 100));
      }
      if (effects.adRelationshipDelta) {
        const coach = state.coaches.find((c) => c.id === team.headCoachId);
        const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
        if (coach && ad) {
          const relationships = parseAdRelationships(coach.adRelationshipsJson);
          const current = adRelationshipScore(relationships, ad.id);
          coach.adRelationshipsJson = JSON.stringify({ ...relationships, [ad.id]: Math.round(clamp(current + effects.adRelationshipDelta, 5, 99)) });
        }
      }
      if (effects.chemistryDelta) {
        for (const p of state.players) {
          if (p.teamId === team.id) p.characterRating = Math.round(clamp(p.characterRating + effects.chemistryDelta!, 5, 99));
        }
      }
    }
  }

  if (playerId) {
    const player = state.players.find((p) => p.id === playerId);
    if (player) {
      if (effects.playerCharacterDelta) player.characterRating = Math.round(clamp(player.characterRating + effects.playerCharacterDelta, 5, 99));
      if (effects.injuryWeeks) { player.isInjured = true; player.injuryWeeksLeft = effects.injuryWeeks * 7; }
      if (effects.suspensionDays) { player.isSuspended = true; player.suspensionDaysLeft = effects.suspensionDays; }
      if (effects.transferToTeamId) {
        player.teamId = effects.transferToTeamId;
        player.previousSchool = sourceTeamName;
      } else if (effects.removePlayerForDiscipline) {
        player.teamId = null;
        player.droppedForDiscipline = true;
        player.previousSchool = sourceTeamName;
      } else if (effects.removePlayer) {
        player.teamId = null;
      }
    }
  }
}

export function getJobOffers(state: WorldState) {
  const myCoach = state.coaches.find((c) => c.isPlayerControlled);
  const myRelationships = myCoach ? parseAdRelationships(myCoach.adRelationshipsJson) : {};
  const currentTeam = state.save.coachTeamId ? state.teams.find((t) => t.id === state.save.coachTeamId) : undefined;
  const currentCol = currentTeam ? costOfLivingIndex(currentTeam.state) : null;

  const aiCoachedTeams = state.teams
    .filter((t) => t.id !== state.save.coachTeamId)
    .filter((t) => {
      const c = state.coaches.find((cc) => cc.id === t.headCoachId);
      return !!c && !c.isPlayerControlled;
    });

  let eligibleTeams: typeof aiCoachedTeams;
  if (currentTeam) {
    // Employed and just browsing the market ("test the waters") — any
    // AI-run program is fair game to inquire about, vacancy or not.
    eligibleTeams = aiCoachedTeams
      .filter((t) => !myCoach || meetsLegalityBar(myCoach.legalityReputation, t.academicReputation, state.athleticDirectors.find((a) => a.id === t.athleticDirectorId)?.integrityStandard))
      .filter((t) => {
        const ad = state.athleticDirectors.find((a) => a.id === t.athleticDirectorId);
        return !ad || adRelationshipScore(myRelationships, ad.id) > 30;
      });
  } else {
    // Unemployed — every AI-run program in the league is a real candidate
    // (not just teams whose coach happened to be fired the instant we were),
    // gated by the same reputation/career-record ceiling the offseason
    // engine uses, with a guaranteed floor so there's always somewhere to go.
    const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
    const gamesCoached = (myCoach?.careerWins ?? 0) + (myCoach?.careerLosses ?? 0);
    const careerWinPct = gamesCoached > 0 ? (myCoach!.careerWins / gamesCoached) : undefined;
    const openings: JobOpening[] = aiCoachedTeams.map((t) => {
      const ad = state.athleticDirectors.find((a) => a.id === t.athleticDirectorId);
      return { teamId: t.id, prestige: t.prestige, academicReputation: t.academicReputation, athleticDirectorId: ad?.id, integrityStandard: ad?.integrityStandard };
    });
    const reputation = myCoach?.reputation ?? 50;
    const offers = generateJobOffers(reputation, reputation, openings, rng, 8, myCoach?.legalityReputation ?? 75, myRelationships, careerWinPct);
    const offerTeamIds = new Set(offers.map((o) => o.teamId));
    eligibleTeams = aiCoachedTeams.filter((t) => offerTeamIds.has(t.id));
  }

  return eligibleTeams
    .map((t) => ({ team: t, ad: state.athleticDirectors.find((a) => a.id === t.athleticDirectorId) }))
    .map(({ team, ad }) => {
      const col = costOfLivingIndex(team.state);
      return {
        teamId: team.id, teamName: team.name, prestige: team.prestige, division: team.division,
        athleticDirector: ad ? {
          id: ad.id, name: ad.name, patience: ad.patience, winFocus: ad.winFocus,
          integrityStandard: ad.integrityStandard, loyalty: ad.loyalty, yearsAtCurrentJob: ad.yearsAtCurrentJob,
        } : null,
        adRemembersYou: ad ? adRelationshipScore(myRelationships, ad.id) >= 70 : false,
        salary: team.baseSalary,
        state: team.state,
        costOfLivingIndex: col,
        salaryDeltaPct: currentTeam ? Math.round(((team.baseSalary - currentTeam.baseSalary) / currentTeam.baseSalary) * 100) : null,
        colDeltaPct: currentCol !== null ? Math.round(((col - currentCol) / currentCol) * 100) : null,
      };
    });
}

export function acceptJob(state: WorldState, teamId: string) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) throw new Error("Team not found");
  const newTeamCoach = state.coaches.find((c) => c.id === team.headCoachId);
  if (!newTeamCoach) throw new Error("Team has no coach slot");

  const priorCoach = state.coaches.find((c) => c.isPlayerControlled);

  newTeamCoach.isPlayerControlled = false;
  if (priorCoach) {
    team.headCoachId = priorCoach.id;
    priorCoach.isPlayerControlled = true;
    priorCoach.hotSeatLevel = 0;
    priorCoach.yearsAtCurrentJob = 0;
    priorCoach.campusAtmosphere = 40;
  }

  state.save.coachTeamId = teamId;
  state.save.currentPhase = "PRESEASON";
  return { ok: true };
}

// The "current school doesn't want to up your contract" mechanic: once per
// season, the player can ask their own AD for a raise. Whether it's granted
// depends on the coach-AD relationship, the AD's own loyalty, and how well
// the team has performed (proxied by hot seat level, since a coach whose job
// is safe has more leverage than one already on thin ice).
export function requestRaise(state: WorldState) {
  if (!state.save.coachTeamId) throw new Error("Not currently employed");
  const team = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!team) throw new Error("Team not found");
  const coach = state.coaches.find((c) => c.id === team.headCoachId);
  if (!coach) throw new Error("No coach on this team");
  if (coach.raiseRequestedThisSeason) throw new Error("Already asked for a raise this season");

  const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
  const relationships = parseAdRelationships(coach.adRelationshipsJson);
  const relScore = ad ? adRelationshipScore(relationships, ad.id) : 50;
  const relTerm = (relScore - 50) / 200;
  const loyaltyTerm = ad ? (ad.loyalty - 50) / 250 : 0;
  const perfTerm = ((100 - coach.hotSeatLevel) / 100) * 0.3;
  const grantChance = clamp(0.15 + relTerm + loyaltyTerm + perfTerm, 0.05, 0.85);

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const granted = rng() < grantChance;
  const oldSalary = coach.currentSalary;
  const newSalary = granted ? Math.round(coach.currentSalary * 1.15) : coach.currentSalary;

  coach.currentSalary = newSalary;
  coach.raiseRequestedThisSeason = true;
  if (granted && ad) {
    coach.adRelationshipsJson = JSON.stringify({ ...relationships, [ad.id]: clamp(relScore + 3, 5, 99) });
  }

  return { granted, newSalary, oldSalary };
}

// Voluntarily leaving a current job for a new one while still employed — the
// "test the waters" outcome once the current school won't budge on pay.
// Distinct from acceptJob, which only ever runs from the unemployed state.
export function resignAndAccept(state: WorldState, teamId: string) {
  if (!state.save.coachTeamId) throw new Error("Not currently employed");
  if (!teamId || teamId === state.save.coachTeamId) throw new Error("Invalid target team");

  const oldTeam = state.teams.find((t) => t.id === state.save.coachTeamId);
  const newTeam = state.teams.find((t) => t.id === teamId);
  if (!oldTeam || !newTeam) throw new Error("Team not found");
  const myCoach = state.coaches.find((c) => c.id === oldTeam.headCoachId);
  const newTeamCoach = state.coaches.find((c) => c.id === newTeam.headCoachId);
  if (!myCoach || !newTeamCoach) throw new Error("Coach slot missing");

  // Walking out on the old AD costs some goodwill there, in case this coach's
  // path crosses that school's again down the line.
  const oldAd = state.athleticDirectors.find((a) => a.id === oldTeam.athleticDirectorId);
  const relationships = parseAdRelationships(myCoach.adRelationshipsJson);
  const updatedRelationships = oldAd
    ? { ...relationships, [oldAd.id]: clamp((relationships[oldAd.id] ?? 50) - 10, 5, 99) }
    : relationships;

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const replacementArchetype = randomArchetype(rng);
  const replacementSkills = generateCoachSkills(rng, oldTeam.prestige, replacementArchetype);

  // Give the old program a fresh AI coach (mirrors the same replacement
  // pattern used when a coach is fired at the end of a season).
  const replacement = {
    id: newId(), name: `${randomFirstName(rng)} ${randomLastName(rng)}`, isPlayerControlled: false,
    reputation: replacementSkills.reputation, hotSeatLevel: 0,
    offenseSkill: replacementSkills.offenseSkill, defenseSkill: replacementSkills.defenseSkill,
    recruitingSkill: replacementSkills.recruitingSkill, developmentSkill: replacementSkills.developmentSkill,
    archetype: replacementArchetype, background: null as string | null,
    playedCollege: false, collegeTeamName: null as string | null, collegeState: null as string | null,
    proPath: "NONE", proCountry: null as string | null, legalityReputation: 75,
    hometownState: null as string | null, pipelineStatesJson: "{}", transferPipelineJson: "{}", adRelationshipsJson: "{}",
    currentSalary: 300000, raiseRequestedThisSeason: false,
    teamPerception: 65, nationalPerception: 20, localPerception: 50, campusAtmosphere: 40,
    careerWins: 0, careerLosses: 0, yearsAtCurrentJob: 0,
  };
  state.coaches.push(replacement);
  oldTeam.headCoachId = replacement.id;

  // Established, in-demand coaches negotiate a small premium over the raw
  // posted salary rather than just taking the sticker price.
  const negotiatedSalary = Math.round(newTeam.baseSalary * 1.05);
  newTeamCoach.isPlayerControlled = false;
  newTeam.headCoachId = myCoach.id;
  myCoach.isPlayerControlled = true;
  myCoach.hotSeatLevel = 0;
  myCoach.yearsAtCurrentJob = 0;
  myCoach.raiseRequestedThisSeason = false;
  myCoach.campusAtmosphere = 40;
  myCoach.currentSalary = negotiatedSalary;
  myCoach.adRelationshipsJson = JSON.stringify(updatedRelationships);

  state.save.coachTeamId = teamId;
  state.save.currentPhase = "PRESEASON";
  return { ok: true, newSalary: negotiatedSalary };
}

// Whether the AD signs off on expanding the arena — gated on team success
// (record vs. what's expected for this prestige level), the building
// actually generating box-office demand right now ("making money"), and how
// receptive this specific AD is, in general and toward this coach.
export function upgradeArena(state: WorldState) {
  if (!state.save.coachTeamId) throw new Error("Not currently employed");
  const team = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!team) throw new Error("Team not found");
  const coach = state.coaches.find((c) => c.id === team.headCoachId);
  if (!coach) throw new Error("No coach on this team");
  if (team.arenaUpgradeRequestedThisSeason) throw new Error("Already asked the AD about the arena this season");
  if (isArenaNearCap(team.venueCapacity, team.division as Division)) {
    throw new Error("The arena is already about as big as this level of program supports");
  }

  const standings = computeStandings(state, state.save.currentSeasonYear);
  const record = standings.get(team.id);
  const gamesPlayed = record ? record.wins + record.losses : 0;
  const seasonWinPct = gamesPlayed >= 3 && record ? winPct(record) : null;

  const homeGames = state.games.filter((g) => g.seasonYear === state.save.currentSeasonYear && g.homeTeamId === team.id && g.isPlayed && g.attendance != null);
  const avgTurnoutPct = homeGames.length >= 3
    ? (homeGames.reduce((s, g) => s + (g.attendance ?? 0), 0) / homeGames.length / team.venueCapacity) * 100
    : null;

  const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
  const relationships = parseAdRelationships(coach.adRelationshipsJson);
  const relScore = ad ? adRelationshipScore(relationships, ad.id) : undefined;

  const grantChance = arenaUpgradeGrantChance({
    prestige: team.prestige, division: team.division as Division, expectedWinPct: expectedWinPct(team.prestige),
    seasonWinPct, avgTurnoutPct, adWinFocus: ad?.winFocus, adRelationshipScore: relScore,
  });

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const granted = rng() < grantChance;
  const oldCapacity = team.venueCapacity;

  team.arenaUpgradeRequestedThisSeason = true;
  if (granted) {
    team.venueCapacity = nextArenaCapacity(rng, team.venueCapacity, team.division as Division);
    team.facilitiesRating = Math.round(clamp(team.facilitiesRating + 3 + rng() * 5, 10, 99));
    if (ad) {
      coach.adRelationshipsJson = JSON.stringify({ ...relationships, [ad.id]: Math.round(clamp((relScore ?? 50) + 2, 5, 99)) });
    }
  }

  return { granted, oldCapacity, newCapacity: team.venueCapacity, avgTurnoutPct, seasonWinPct };
}

// Resolving a conference-realignment invite handed back from the last advance
// call (see engine/conferenceRealignment.ts). The offer is ephemeral — not
// persisted between calls — so the caller passes back exactly what it was
// shown; declining is just a no-op.
export function respondToConferenceInvite(
  state: WorldState,
  accept: boolean,
  targetConferenceId: string,
  targetDivision: Division,
  replacingTeamId: string
) {
  if (!state.save.coachTeamId) throw new Error("Not currently employed");
  if (!accept) return { applied: false };

  const myTeam = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!myTeam) throw new Error("Team not found");
  const replacingTeam = state.teams.find((t) => t.id === replacingTeamId);
  if (!replacingTeam) throw new Error("Replacing team not found");
  const targetConference = state.conferences.find((c) => c.id === targetConferenceId);
  if (!targetConference) throw new Error("Target conference not found");

  const oldConferenceId = myTeam.conferenceId;
  const oldDivision = myTeam.division as Division;

  myTeam.conferenceId = targetConferenceId;
  myTeam.division = targetDivision;
  replacingTeam.conferenceId = oldConferenceId;
  replacingTeam.division = oldDivision;

  // Only the displaced team can end up over its new (lower) scholarship limit —
  // the promoted team only ever moves to a division with equal or more room.
  if (targetDivision !== oldDivision) {
    const replacingPlayers = state.players.filter((p) => p.teamId === replacingTeam.id);
    const scholarshipMap = normalizeScholarshipsForDivision(
      replacingPlayers.map((p) => ({ id: p.id, onScholarship: p.onScholarship, overallRating: overall(p) })),
      oldDivision
    );
    for (const p of replacingPlayers) {
      const onScholarship = scholarshipMap.get(p.id);
      if (onScholarship !== undefined) p.onScholarship = onScholarship;
    }
  }

  return {
    applied: true,
    newConferenceName: targetConference.name,
    newDivision: targetDivision,
    replacingTeamName: replacingTeam.name,
  };
}

export function addWalkOn(state: WorldState, candidateId: string) {
  if (!state.save.coachTeamId) throw new Error("No active team");
  const team = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!team) throw new Error("Team not found");
  const candidate = state.walkOnCandidates.find((c) => c.id === candidateId && c.teamId === team.id);
  if (!candidate) throw new Error("Candidate not found");

  const rosterCount = state.players.filter((p) => p.teamId === team.id).length;
  const rosterCap = DIVISION_RULES[team.division as Division].rosterCap;
  if (rosterCount >= rosterCap) throw new Error("Roster is already full");

  const player = {
    id: newId(), teamId: team.id, firstName: candidate.firstName, lastName: candidate.lastName, position: candidate.position,
    classYear: "FR", heightInches: 76, hometownState: candidate.hometownState, hometownCity: candidate.hometownCity, highSchool: "",
    countryOfOrigin: candidate.countryOfOrigin,
    origin: candidate.origin,
    scoring: candidate.scoring, threePoint: candidate.threePoint, finishing: candidate.finishing,
    playmaking: candidate.playmaking, rebounding: candidate.rebounding, defense: candidate.defense,
    athleticism: candidate.athleticism, basketballIq: candidate.basketballIq,
    stamina: 60, potential: candidate.potential, characterRating: candidate.characterRating,
    disciplineRating: candidate.disciplineRating, chemistryImpact: 0,
    eligibilityYearsLeft: 4, inTransferPortal: false, previousSchool: null, prioritiesJson: "{}", isInjured: false, injuryWeeksLeft: 0, injuryType: null,
    isSuspended: false, suspensionDaysLeft: 0, onScholarship: false, droppedForDiscipline: false,
  };
  state.players.push(player);
  state.walkOnCandidates = state.walkOnCandidates.filter((c) => c.id !== candidateId);
  return player;
}

export function signDisciplineDrop(state: WorldState, playerId: string) {
  if (!state.save.coachTeamId) throw new Error("No active team");
  const team = state.teams.find((t) => t.id === state.save.coachTeamId);
  if (!team) throw new Error("Team not found");
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.droppedForDiscipline || player.teamId) throw new Error("Player not available");

  const rosterCap = DIVISION_RULES[team.division as Division].rosterCap;
  const rosterCount = state.players.filter((p) => p.teamId === team.id).length;
  if (rosterCount >= rosterCap) throw new Error("Roster is already full");

  const ad = state.athleticDirectors.find((a) => a.id === team.athleticDirectorId);
  if (!meetsLegalityBar(player.disciplineRating, team.academicReputation, ad?.integrityStandard)) {
    throw new Error(
      `Your AD won't sign off on this one — ${player.firstName} ${player.lastName}'s history is too much risk for what this program is willing to carry.`
    );
  }

  const rules = DIVISION_RULES[team.division as Division];
  const scholarshipCount = state.players.filter((p) => p.teamId === team.id && p.onScholarship).length;
  const onScholarship = rules.hasScholarships && scholarshipCount < rules.scholarshipLimit;
  const reputationHit = disciplineSigningReputationHit(player.disciplineRating);

  player.teamId = team.id;
  player.onScholarship = onScholarship;
  team.academicReputation = Math.round(clamp(team.academicReputation - reputationHit, 5, 99));

  return { player, reputationHit };
}

export interface PreseasonTournamentBoardEntry {
  tournamentId: string;
  name: string | null;
  format: string | null;
  tier: string | null;
  location: string | null;
  field: { teamId: string; name: string; prestige: number }[];
  userTeamIn: boolean;
  eligible: boolean;
}

function eventDefForTournamentName(name: string | null): PreseasonEventDef | undefined {
  if (!name) return undefined;
  return PRESEASON_EVENTS.find((e) => name === `${e.name} — ${e.location}`);
}

// Every PRESEASON_INVITATIONAL tournament (D1's curated list and D2/D3's
// procedurally generated ones alike) stores its full display name as
// "Event Name — Location" — split that back apart for display.
function splitNameLocation(fullName: string | null): { name: string; location: string | null } {
  if (!fullName) return { name: "", location: null };
  const idx = fullName.indexOf(" — ");
  if (idx === -1) return { name: fullName, location: null };
  return { name: fullName.slice(0, idx), location: fullName.slice(idx + 3) };
}

const TIER_RANK: Record<string, number> = { MAJOR: 0, MID: 1, SMALL: 2 };

// How far below the field's current weakest invite a team's prestige can sit
// and still plausibly get a bid — mirrors the real-world gap between one
// prestige tier and the next (~14-18 points), so it's a genuine invite, not
// a rubber stamp.
const PRESTIGE_GRACE_MARGIN = 10;

function isPrestigeEligible(userPrestige: number, field: { prestige: number }[]): boolean {
  if (field.length === 0) return true;
  const minFieldPrestige = Math.min(...field.map((f) => f.prestige));
  return userPrestige >= minFieldPrestige - PRESTIGE_GRACE_MARGIN;
}

export function getPreseasonTournaments(state: WorldState): { editable: boolean; userDivision: string | null; tournaments: PreseasonTournamentBoardEntry[] } {
  const userTeamId = state.save.coachTeamId;
  const userTeam = userTeamId ? state.teams.find((t) => t.id === userTeamId) : undefined;
  const seasonYear = state.save.currentSeasonYear;
  const tournaments = state.tournaments.filter(
    (t) => t.seasonYear === seasonYear && t.type === "PRESEASON_INVITATIONAL" && (!userTeam || t.division === userTeam.division),
  );

  const board = tournaments.map((t) => {
    const games = state.games.filter((g) => g.tournamentId === t.id);
    const fieldIds = [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
    const field = fieldIds
      .map((id) => state.teams.find((tt) => tt.id === id))
      .filter((tt): tt is NonNullable<typeof tt> => !!tt)
      .sort((a, b) => b.prestige - a.prestige);
    const eventDef = eventDefForTournamentName(t.name);
    const { name, location } = splitNameLocation(t.name);
    return {
      tournamentId: t.id,
      name,
      format: t.format ?? eventDef?.format ?? null,
      tier: eventDef?.tier ?? null,
      location,
      field: field.map((f) => ({ teamId: f.id, name: f.name, prestige: f.prestige })),
      userTeamIn: !!userTeamId && fieldIds.includes(userTeamId),
      eligible: userTeam ? isPrestigeEligible(userTeam.prestige, field) : false,
    };
  });

  board.sort((a, b) => (TIER_RANK[a.tier ?? ""] ?? 3) - (TIER_RANK[b.tier ?? ""] ?? 3));

  return { editable: state.save.currentPhase === "PRESEASON", userDivision: userTeam?.division ?? null, tournaments: board };
}

// Swaps a team's entire non-conference slate (including any preseason
// tournament games) with another team's — safe at this point since PRESEASON
// games are always unplayed, and it guarantees no orphaned or double-booked
// dates since both teams simply trade places game-for-game.
function swapNonConferenceSlates(state: WorldState, seasonYear: number, teamAId: string, teamBId: string): void {
  for (const g of state.games) {
    if (g.seasonYear !== seasonYear || g.isConference) continue;
    if (g.homeTeamId !== teamAId && g.homeTeamId !== teamBId && g.awayTeamId !== teamAId && g.awayTeamId !== teamBId) continue;
    const newHome = g.homeTeamId === teamAId ? teamBId : g.homeTeamId === teamBId ? teamAId : g.homeTeamId;
    const newAway = g.awayTeamId === teamAId ? teamBId : g.awayTeamId === teamBId ? teamAId : g.awayTeamId;
    g.homeTeamId = newHome;
    g.awayTeamId = newAway;
  }
}

export function joinPreseasonTournament(state: WorldState, tournamentId: string): { ok: true; swappedWithTeamId: string } {
  if (!state.save.coachTeamId) throw new Error("No active team");
  if (state.save.currentPhase !== "PRESEASON") throw new Error("Schedule can only be edited during the preseason");

  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  if (!tournament || tournament.type !== "PRESEASON_INVITATIONAL") throw new Error("Not a preseason tournament for this save");

  const games = state.games.filter((g) => g.tournamentId === tournamentId);
  const fieldIds = [...new Set(games.flatMap((g) => [g.homeTeamId, g.awayTeamId]))];
  if (fieldIds.includes(state.save.coachTeamId)) throw new Error("Already in this event");

  const fieldTeams = fieldIds.map((id) => state.teams.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => !!t);

  const userTeam = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  if (tournament.division !== userTeam.division) {
    throw new Error("That event isn't at your division");
  }
  if (!isPrestigeEligible(userTeam.prestige, fieldTeams)) {
    throw new Error("Your program isn't competitive enough to draw an invite to this event");
  }

  const partner = [...fieldTeams].sort((a, b) => a.prestige - b.prestige)[0];
  if (!partner) throw new Error("Event has no field to swap into");

  swapNonConferenceSlates(state, state.save.currentSeasonYear, state.save.coachTeamId, partner.id);
  return { ok: true, swappedWithTeamId: partner.id };
}

export function leavePreseasonTournament(state: WorldState): { ok: true; swappedWithTeamId: string } {
  if (!state.save.coachTeamId) throw new Error("No active team");
  if (state.save.currentPhase !== "PRESEASON") throw new Error("Schedule can only be edited during the preseason");

  const seasonYear = state.save.currentSeasonYear;
  const tournaments = state.tournaments.filter((t) => t.seasonYear === seasonYear && t.type === "PRESEASON_INVITATIONAL");
  const assignedIds = new Set(
    tournaments.flatMap((t) => state.games.filter((g) => g.tournamentId === t.id).flatMap((g) => [g.homeTeamId, g.awayTeamId])),
  );
  if (!assignedIds.has(state.save.coachTeamId)) throw new Error("Not currently in a preseason event");

  const userTeam = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  const unassigned = state.teams.filter((t) => t.division === userTeam.division && !assignedIds.has(t.id));
  const partner = unassigned[Math.floor(Math.random() * unassigned.length)];
  if (!partner) throw new Error("No open non-conference slate to swap into");

  swapNonConferenceSlates(state, seasonYear, state.save.coachTeamId, partner.id);
  return { ok: true, swappedWithTeamId: partner.id };
}

export function getInternationalTour(state: WorldState) {
  const userTeamId = state.save.coachTeamId;
  if (!userTeamId) return { editable: false, eligible: false, affordable: false, countries: TOUR_COUNTRIES, currentCountry: null, currentTourSeasonYear: null, nextEligibleSeasonYear: null, thisSeasonTour: null };

  const team = state.teams.find((t) => t.id === userTeamId)!;
  const seasonYear = state.save.currentSeasonYear;
  const cooldownOk = isTourEligible(team.internationalTourSeasonYear, seasonYear);
  const affordable = isTourAffordable(team.division as Division, team.prestige);
  const thisSeasonTour = state.internationalTours.find((t) => t.teamId === team.id && t.seasonYear === seasonYear);

  return {
    editable: state.save.currentPhase === "PRESEASON",
    eligible: cooldownOk && affordable,
    affordable,
    countries: TOUR_COUNTRIES,
    currentCountry: team.internationalTourCountry,
    currentTourSeasonYear: team.internationalTourSeasonYear,
    nextEligibleSeasonYear: !cooldownOk && team.internationalTourSeasonYear !== null ? team.internationalTourSeasonYear + TOUR_COOLDOWN_YEARS : null,
    thisSeasonTour: thisSeasonTour ? { country: thisSeasonTour.country, games: thisSeasonTour.games } : null,
  };
}

export function bookInternationalTour(state: WorldState, country: string) {
  if (!state.save.coachTeamId) throw new Error("No active team");
  if (state.save.currentPhase !== "PRESEASON") throw new Error("The tour can only be booked during the preseason");
  if (!TOUR_COUNTRIES.includes(country)) throw new Error("Not a valid tour destination");

  const team = state.teams.find((t) => t.id === state.save.coachTeamId)!;
  const seasonYear = state.save.currentSeasonYear;
  if (!isTourAffordable(team.division as Division, team.prestige)) {
    throw new Error("Your program isn't successful enough yet to attract the booster support a foreign tour takes");
  }
  if (!isTourEligible(team.internationalTourSeasonYear, seasonYear)) {
    throw new Error("This program toured within the last 4 years — not eligible yet");
  }
  if (team.internationalTourSeasonYear === seasonYear) throw new Error("Already toured this season");

  const headCoach = state.coaches.find((c) => c.id === team.headCoachId);
  const rosterPlayers = state.players.filter((p) => p.teamId === team.id);
  const simTeam: SimTeam = {
    id: team.id,
    players: rosterPlayers.map((p) => ({
      id: p.id, position: p.position, scoring: p.scoring, threePoint: p.threePoint, finishing: p.finishing,
      playmaking: p.playmaking, rebounding: p.rebounding, defense: p.defense, athleticism: p.athleticism,
      basketballIq: p.basketballIq, characterRating: p.characterRating, isInjured: p.isInjured, isSuspended: p.isSuspended,
    })),
    offenseSkill: headCoach?.offenseSkill ?? 50,
    defenseSkill: headCoach?.defenseSkill ?? 50,
  };

  const rng = mulberry32(Date.now() ^ Math.floor(Math.random() * 1e9));
  const games = simulateTourGames(simTeam, country, rng);

  state.internationalTours.push({ id: newId(), teamId: team.id, seasonYear, country, games, createdAt: new Date() });
  team.internationalTourCountry = country;
  team.internationalTourSeasonYear = seasonYear;

  return { ok: true, country, games };
}
